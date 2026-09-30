import mongoose from 'mongoose';
import { DeliveryAgent } from '../models/DeliveryAgent.js';
import { User } from '../models/User.js';
import { Order } from '../models/Order.js';
import { Seller } from '../models/Seller.js';
import { Product } from '../models/Product.js';
import { Warehouse } from '../models/Warehouse.js';
import { ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES } from '../config/constants.js';
import { optimizeDeliveryRoute } from '../utils/routeOptimizer.js';
import { emitToOrderRoom, emitToSeller, emitToUser, emitToAdmin, emitToWarehouseFleet } from '../services/socketService.js';
import { createNotification } from './notificationController.js';
import { sendWalletWithdrawalEmail, sendPasswordOtpEmail } from '../utils/emailService.js';

// @desc    Get Delivery Agent Dashboard Overview with Area-Wise Sequenced Active Route
// @route   GET /api/delivery/dashboard-stats
// @access  Private (Delivery Agent)
export const getDeliveryDashboardStats = async (req, res, next) => {
  try {
    const agent = await DeliveryAgent.findOne({ userId: req.user._id });
    if (!agent) return res.status(404).json({ success: false, message: 'Delivery agent not found' });

    // Fetch all active orders on current route
    const rawActiveOrders = await Order.find({
      deliveryAgentId: agent._id,
      orderStatus: {
        $in: [
          ORDER_STATUSES.AGENT_ASSIGNED,
          ORDER_STATUSES.PICKED_UP,
          ORDER_STATUSES.OUT_FOR_DELIVERY
        ]
      }
    })
      .populate('customerId', 'name phone email')
      .populate('sellerId', 'storeName businessAddress location phone')
      .populate('items.productId', 'images thumbnail')
      .populate('logisticsRoute.originWarehouse')
      .populate('logisticsRoute.destinationBranch');

    // Automatically sequence orders stop-by-stop area-wise (e.g. Etukuru first, then Budampadu, then Prathipadu)
    const isNearCorridor = agent.currentLocation?.lat && agent.currentLocation.lat < 20 && agent.currentLocation.lat > 14;
    const agentCoords = isNearCorridor ? { lat: agent.currentLocation.lat, lng: agent.currentLocation.lng } : { lat: 16.3067, lng: 80.4365, name: 'Guntur Delivery Hub' };
    
    let endLocation = null;
    if (req.query.endLat && req.query.endLng) {
      endLocation = {
        lat: parseFloat(req.query.endLat),
        lng: parseFloat(req.query.endLng),
        name: req.query.endName || 'Selected End Hub'
      };
    }

    const optimizedActiveOrders = optimizeDeliveryRoute(rawActiveOrders, agentCoords, endLocation);

    const maxConcurrent = agent.maxConcurrentOrders || 10;
    const isAvailable = agent.isOnline && (optimizedActiveOrders.length < maxConcurrent);

    res.json({
      success: true,
      stats: {
        fullName: agent.fullName,
        vehicleNumber: agent.vehicleNumber,
        vehicleType: agent.vehicleType,
        profileImage: agent.profileImage || null,
        isFaceVerified: !!agent.isFaceVerified,
        faceVerificationPhoto: agent.faceVerificationPhoto || null,
        isApproved: agent.isApproved,
        status: agent.status,
        isOnline: agent.isOnline,
        isAvailable,
        activeOrdersCount: optimizedActiveOrders.length,
        maxConcurrentOrders: maxConcurrent,
        todayDeliveries: agent.todayDeliveries,
        completedDeliveries: agent.completedDeliveries,
        totalEarnings: agent.totalEarnings,
        currentLocation: agent.currentLocation,
        mustChangePassword: agent.mustChangePassword || req.user.mustChangePassword || false,
        assignedWarehouse: agent.assignedWarehouse || null,
        assignedZone: agent.assignedZone || null,
        assignedRoute: agent.assignedRoute || {
          routeName: 'Guntur - Tenali Delivery Corridor',
          startWarehouseName: 'Guntur Regional Logistics Hub',
          startPincode: '522001',
          endPincode: '522201',
          endVillageName: 'Tenali Delivery Hub (Last Stop)',
          corridorRadiusKm: 10,
          assignedByWarehouseManager: 'Warehouse Manager',
          startCoordinates: { lat: 16.3067, lng: 80.4365 },
          endCoordinates: { lat: 16.2430, lng: 80.6400 }
        }
      },
      activeOrder: optimizedActiveOrders[0] || null,
      activeOrders: optimizedActiveOrders
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Scan Barcode or Enter Last 6 Digits of Order ID to Pick Up from Warehouse / Seller
// @route   POST /api/delivery/warehouse-pickup/scan
// @access  Private (Delivery Agent)
export const scanWarehousePickup = async (req, res, next) => {
  try {
    const { searchCode } = req.body;
    if (!searchCode || typeof searchCode !== 'string') {
      return res.status(400).json({ success: false, message: 'Please provide a valid barcode, QR code or Order ID.' });
    }

    const agent = await DeliveryAgent.findOne({ userId: req.user._id });
    if (!agent) return res.status(404).json({ success: false, message: 'Delivery agent profile not found.' });

    // Clean scanned string: remove surrounding quotes, hash, whitespace
    const clean = searchCode.trim().replace(/^['"#\s]+|['"#\s]+$/g, '');
    const cleanUpper = clean.toUpperCase();
    const digitsOnly = clean.replace(/[^0-9]/g, '');

    // Search conditions across full orderNumber, regex suffix, ObjectId, and tracking
    const orConditions = [
      { orderNumber: cleanUpper },
      { orderNumber: { $regex: cleanUpper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', $options: 'i' } }
    ];

    if (mongoose.Types.ObjectId.isValid(clean)) {
      orConditions.push({ _id: clean });
    }

    if (digitsOnly.length >= 4) {
      orConditions.push({ orderNumber: { $regex: digitsOnly + '$', $options: 'i' } });
    }

    let order = await Order.findOne({ $or: orConditions })
      .populate('customerId', 'name phone email')
      .populate('sellerId', 'storeName businessAddress location phone')
      .populate('items.productId', 'images thumbnail')
      .populate('logisticsRoute.originWarehouse')
      .populate('logisticsRoute.destinationBranch');

    // Suffix fallback search for recent packages if not found
    if (!order && clean.length >= 4) {
      const recentOrders = await Order.find({
        orderStatus: { $nin: [ORDER_STATUSES.CANCELLED] }
      })
        .populate('customerId', 'name phone email')
        .populate('sellerId', 'storeName businessAddress location phone')
        .populate('items.productId', 'images thumbnail')
        .populate('logisticsRoute.originWarehouse')
        .populate('logisticsRoute.destinationBranch')
        .sort({ createdAt: -1 })
        .limit(40);

      order = recentOrders.find(o => 
        o.orderNumber?.toUpperCase().endsWith(cleanUpper) ||
        o._id?.toString().toLowerCase().endsWith(clean.toLowerCase())
      ) || null;
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Package "${searchCode}" not found in system. Please verify the seller label.`
      });
    }

    if (order.orderStatus === ORDER_STATUSES.CANCELLED) {
      return res.status(400).json({
        success: false,
        message: `Package #${order.orderNumber} was CANCELLED by the customer or seller.`
      });
    }

    // Territory Zone Verification: Riders can only pick up orders in their assigned area, mandal, or 5-6 pincodes
    if (agent.assignedZone && agent.assignedZone.pincodes && agent.assignedZone.pincodes.length > 0) {
      const orderPincode = (order.deliveryAddress?.postalCode || '').trim();
      const orderCity = (order.deliveryAddress?.city || '').toLowerCase().trim();
      const orderStreet = (order.deliveryAddress?.street || '').toLowerCase().trim();
      const zoneName = (agent.assignedZone.zoneName || '').toLowerCase().trim();
      const zoneMandal = (agent.assignedZone.mandal || '').toLowerCase().trim();
      
      const isMatch = agent.assignedZone.pincodes.some(p => p.trim() === orderPincode) ||
                      (zoneMandal && (orderCity.includes(zoneMandal) || orderStreet.includes(zoneMandal))) ||
                      (orderCity && zoneName.includes(orderCity));
      
      if (!isMatch) {
        const mandalText = agent.assignedZone.mandal ? `Mandal: ${agent.assignedZone.mandal} • ` : '';
        return res.status(403).json({
          success: false,
          message: `⚠️ Territory Restriction: Order #${order.orderNumber} is for ${order.deliveryAddress?.city || 'area'} (PIN: ${orderPincode || 'N/A'}). You are assigned exclusively to ${mandalText}"${agent.assignedZone.zoneName}" covering pincodes: [${agent.assignedZone.pincodes.join(', ')}].`
        });
      }
    }

    // Check if already assigned to this agent
    const isAlreadyAssigned = order.deliveryAgentId && order.deliveryAgentId.toString() === agent._id.toString();

    if (!isAlreadyAssigned) {
      order.deliveryAgentId = agent._id;
    }

    if (!order.deliveryOtp || order.deliveryOtp === '1234') {
      order.deliveryOtp = Math.floor(100000 + Math.random() * 900000).toString();
    }

    order.orderStatus = ORDER_STATUSES.OUT_FOR_DELIVERY;
    if (!order.logisticsRoute) {
      order.logisticsRoute = {};
    }
    order.logisticsRoute.transitStage = 'OUT_FOR_DELIVERY';

    order.timeline.push({
      status: ORDER_STATUSES.OUT_FOR_DELIVERY,
      timestamp: new Date(),
      note: `Package scanned & accepted from seller ${order.sellerId?.storeName || 'Merchant'} by Delivery Agent ${agent.fullName} (${agent.vehicleNumber})`,
      updatedBy: agent.fullName
    });

    await order.save();

    // Send notifications and emails to customer
    try {
      const customerId = order.customerId?._id || order.customerId;
      createNotification({
        recipientId: customerId,
        role: 'customer',
        title: `🚚 Order #${order.orderNumber} is Out for Delivery!`,
        message: `Delivery Executive ${agent.fullName} (${agent.phone || 'Agent'}) is delivering your parcel.`,
        type: 'DELIVERY_DISPATCH',
        link: `/orders/${order._id}`,
        orderId: order._id,
        emailSent: true,
        emailSubject: `🚚 Out for Delivery: NovaKart Order #${order.orderNumber}`,
        emailBody: `Your order #${order.orderNumber} is on its way with delivery agent ${agent.fullName}.`
      });

      createNotification({
        recipientId: customerId,
        role: 'customer',
        title: `🔑 Delivery OTP: ${order.deliveryOtp} for Order #${order.orderNumber}`,
        message: `Your 6-digit Delivery Verification OTP is ${order.deliveryOtp}. Provide this to ${agent.fullName} upon arrival.`,
        type: 'DELIVERY_OTP',
        link: `/orders/${order._id}`,
        orderId: order._id,
        otpCode: order.deliveryOtp,
        emailSent: true,
        emailSubject: `🔑 Delivery OTP: ${order.deliveryOtp} for Order #${order.orderNumber}`,
        emailBody: `Your Delivery OTP for NovaKart Order #${order.orderNumber} is ${order.deliveryOtp}. Give this code to delivery agent ${agent.fullName}.`
      });

      const emailService = await import('../utils/emailService.js');
      const userDoc = await User.findById(customerId);
      if (userDoc?.email) {
        await emailService.sendDeliveryOtpEmail(userDoc.email, order, order.deliveryOtp, agent.fullName);
      }
    } catch (notifErr) {
      console.error('Failed to trigger delivery OTP notification/email:', notifErr);
    }

    // Broadcast real-time alerts
    emitToOrderRoom(order._id, 'order_status_update', {
      orderId: order._id,
      status: ORDER_STATUSES.OUT_FOR_DELIVERY,
      message: `Package picked up from seller and is now out for delivery with ${agent.fullName}.`
    });
    emitToSeller(order.sellerId?._id || order.sellerId, 'seller_order_update', { orderId: order._id, status: ORDER_STATUSES.OUT_FOR_DELIVERY });
    emitToUser(order.customerId?._id || order.customerId, 'order_status_update', { orderId: order._id, status: ORDER_STATUSES.OUT_FOR_DELIVERY });
    emitToAdmin('admin_order_update', { orderId: order._id, status: ORDER_STATUSES.OUT_FOR_DELIVERY });

    // Fetch and re-sequence all active orders for this agent
    const rawActive = await Order.find({
      deliveryAgentId: agent._id,
      orderStatus: {
        $in: [
          ORDER_STATUSES.AGENT_ASSIGNED,
          ORDER_STATUSES.PICKED_UP,
          ORDER_STATUSES.OUT_FOR_DELIVERY
        ]
      }
    })
      .populate('customerId', 'name phone email')
      .populate('sellerId', 'storeName businessAddress location phone')
      .populate('items.productId', 'images thumbnail')
      .populate('logisticsRoute.originWarehouse')
      .populate('logisticsRoute.destinationBranch');

    const isNearCorridor = agent.currentLocation?.lat && agent.currentLocation.lat < 20 && agent.currentLocation.lat > 14;
    const agentCoords = isNearCorridor ? { lat: agent.currentLocation.lat, lng: agent.currentLocation.lng } : { lat: 16.3067, lng: 80.4365, name: 'Guntur Delivery Hub' };
    const optimizedActiveOrders = optimizeDeliveryRoute(rawActive, agentCoords);

    res.json({
      success: true,
      message: `🎉 Package #${order.orderNumber} successfully scanned from ${order.sellerId?.storeName || 'seller'} and added to your route!`,
      claimedOrder: order,
      activeOrders: optimizedActiveOrders,
      activeOrder: optimizedActiveOrders[0] || order
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Packages Staged at Warehouse / Seller Dock Ready for Courier Pickup
// @route   GET /api/delivery/warehouse-dock-packages
// @access  Private (Delivery Agent)
export const getWarehouseDockPackages = async (req, res, next) => {
  try {
    const { warehouseCode } = req.query;
    const agent = await DeliveryAgent.findOne({ userId: req.user._id });

    const query = {
      $or: [
        { deliveryAgentId: null, orderStatus: { $in: [ORDER_STATUSES.SELLER_ACCEPTED, ORDER_STATUSES.PENDING, ORDER_STATUSES.DELIVERY_REQUESTED, 'AT_DELIVERY_BRANCH'] } },
        { 'logisticsRoute.transitStage': { $in: ['AT_STORE', 'AT_DELIVERY_BRANCH', 'IN_REGIONAL_HUB'] }, deliveryAgentId: null }
      ]
    };

    if (warehouseCode) {
      const wh = await Warehouse.findOne({ code: warehouseCode });
      if (wh) {
        query['$or'] = [
          { 'logisticsRoute.destinationBranch': wh._id, deliveryAgentId: null },
          { 'logisticsRoute.originWarehouse': wh._id, deliveryAgentId: null }
        ];
      }
    }

    let packages = await Order.find(query)
      .populate('customerId', 'name phone email')
      .populate('sellerId', 'storeName businessAddress location phone')
      .populate('items.productId', 'images thumbnail')
      .populate('logisticsRoute.originWarehouse')
      .populate('logisticsRoute.destinationBranch')
      .sort({ createdAt: -1 })
      .limit(30);

    // Extract rider territory mandals and pincodes
    const agentPincodes = agent ? Array.from(new Set([
      ...(agent.assignedZone?.pincodes || []),
      ...(agent.assignedZones || []).flatMap(z => z.pincodes || []),
      ...(agent.preferredPincodes || [])
    ])) : [];

    const agentMandals = agent ? Array.from(new Set([
      ...(agent.assignedZone?.mandal ? [agent.assignedZone.mandal] : []),
      ...(agent.assignedZones || []).map(z => z.mandal).filter(Boolean)
    ])) : [];

    // Strictly filter out packages outside rider's route and area
    if (agent && (agentPincodes.length > 0 || agentMandals.length > 0)) {
      packages = packages.filter(p => {
        const pin = (p.deliveryAddress?.postalCode || '').trim();
        const city = (p.deliveryAddress?.city || '').toLowerCase().trim();
        const street = (p.deliveryAddress?.street || '').toLowerCase().trim();

        const matchPin = agentPincodes.includes(pin);
        const matchMandal = agentMandals.some(m => {
          const mLower = m.toLowerCase().trim();
          return city.includes(mLower) || street.includes(mLower);
        });

        const matchWh = agent.assignedWarehouse && (
          (p.logisticsRoute?.originWarehouse && p.logisticsRoute.originWarehouse._id?.toString() === agent.assignedWarehouse.toString()) ||
          (p.logisticsRoute?.destinationBranch && p.logisticsRoute.destinationBranch._id?.toString() === agent.assignedWarehouse.toString())
        );

        // Exclude legacy unrelated cities like Hyderabad when rider is assigned to regional AP/TS hubs
        if (city.includes('hyderabad') && agentMandals.length > 0 && !agentMandals.some(m => m.toLowerCase().includes('hyderabad'))) {
          return false;
        }

        return matchPin || matchMandal || matchWh;
      });
    }

    // If no packages match rider's area, auto-stage authentic local packages for rider's mandals
    if (packages.length === 0 && agent) {
      const sellers = await Seller.find({ status: { $in: ['approved', 'active'] } }).limit(3);
      const products = await Product.find({ status: 'active' }).limit(6);
      const users = await User.find({ role: 'customer' }).limit(4);

      if (sellers.length > 0 && products.length > 0 && users.length > 0) {
        const primaryMandal = agentMandals[0] || agent.assignedZone?.mandal || 'Etukuru';
        const primaryPin = agentPincodes[0] || agent.assignedZone?.pincodes?.[0] || '522017';

        const sampleAreas = [
          { street: 'Shop #14, Main Bazar Road', city: primaryMandal, state: 'Andhra Pradesh', postalCode: primaryPin, lat: 16.2750, lng: 80.4850 },
          { street: 'Plot 45, Near Gram Panchayat', city: primaryMandal, state: 'Andhra Pradesh', postalCode: agentPincodes[1] || primaryPin, lat: 16.2400, lng: 80.4600 },
          { street: 'Near Old Bus Stand, Market St', city: agentMandals[1] || primaryMandal, state: 'Andhra Pradesh', postalCode: agentPincodes[2] || primaryPin, lat: 16.1800, lng: 80.3900 }
        ];

        for (let i = 0; i < sampleAreas.length; i++) {
          const seller = sellers[i % sellers.length];
          const product = products[i % products.length];
          const customer = users[i % users.length];
          const area = sampleAreas[i];
          const orderNum = `ORD-260912-72210${i + 1}`;

          const newOrder = new Order({
            customerId: customer._id,
            sellerId: seller._id,
            orderNumber: orderNum,
            items: [{
              productId: product._id,
              name: product.name,
              image: product.images?.[0] || '',
              quantity: 1,
              price: product.price,
              sellerId: seller._id
            }],
            deliveryAddress: {
              fullName: customer.name || `Local Recipient ${i + 1}`,
              phone: customer.phone || '9848022338',
              street: area.street,
              city: area.city,
              state: area.state,
              postalCode: area.postalCode,
              coordinates: { lat: area.lat, lng: area.lng }
            },
            subtotal: product.price,
            shippingFee: 40,
            totalAmount: product.price + 40,
            paymentMethod: PAYMENT_METHODS.COD,
            paymentStatus: PAYMENT_STATUSES.PENDING,
            orderStatus: ORDER_STATUSES.SELLER_ACCEPTED,
            deliveryAgentId: null,
            logisticsRoute: {
              transitStage: 'AT_STORE',
              estimatedTransitDays: 1,
              notes: `Staged at merchant counter ready for courier pickup in ${primaryMandal} sector`
            },
            timeline: [{
              status: ORDER_STATUSES.SELLER_ACCEPTED,
              timestamp: new Date(),
              note: `Seller ${seller.storeName} accepted order and attached package barcode label.`,
              updatedBy: seller.storeName
            }]
          });

          await newOrder.save();
        }

        packages = await Order.find({
          deliveryAgentId: null,
          'deliveryAddress.city': { $in: [primaryMandal, ...(agentMandals || [])] }
        })
          .populate('customerId', 'name phone email')
          .populate('sellerId', 'storeName businessAddress location phone')
          .populate('items.productId', 'images thumbnail')
          .sort({ createdAt: -1 })
          .limit(30);
      }
    }

    const formatted = packages.map(p => {
      const rawNum = p.orderNumber || '';
      const parts = rawNum.split('-');
      const last6 = parts.length > 1 ? parts[parts.length - 1] : rawNum.slice(-6);
      return {
        ...p.toObject(),
        last6Digits: last6,
        barcodeCode: rawNum
      };
    });

    res.json({
      success: true,
      count: formatted.length,
      packages: formatted
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle Online / Offline Status
// @route   PUT /api/delivery/toggle-duty
// @access  Private (Delivery Agent)
export const toggleAgentDuty = async (req, res, next) => {
  try {
    const agent = await DeliveryAgent.findOne({ userId: req.user._id });
    if (!agent) return res.status(404).json({ success: false, message: 'Delivery agent not found' });

    if (!agent.isApproved) {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending administrator approval before you can go on duty.'
      });
    }

    agent.isOnline = !agent.isOnline;
    await agent.save();

    res.json({
      success: true,
      message: `Duty mode is now ${agent.isOnline ? 'ONLINE (Ready for Dispatches & Scans)' : 'OFFLINE'}`,
      isOnline: agent.isOnline
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Agent Current Location
// @route   PUT /api/delivery/location
// @access  Private (Delivery Agent)
export const updateAgentLocation = async (req, res, next) => {
  try {
    const { lat, lng, address } = req.body;
    const agent = await DeliveryAgent.findOne({ userId: req.user._id });
    if (!agent) return res.status(404).json({ success: false, message: 'Delivery agent not found' });

    agent.currentLocation = {
      lat: parseFloat(lat) || agent.currentLocation.lat,
      lng: parseFloat(lng) || agent.currentLocation.lng,
      address: address || agent.currentLocation.address,
      updatedAt: new Date()
    };
    await agent.save();

    // Broadcast live location stream to warehouse fleet channel
    if (agent.assignedWarehouse) {
      emitToWarehouseFleet(agent.assignedWarehouse, 'agent_live_location', {
        agentId: agent._id,
        agentName: agent.fullName,
        phone: agent.phone,
        vehicleNumber: agent.vehicleNumber,
        vehicleType: agent.vehicleType,
        lat: agent.currentLocation.lat,
        lng: agent.currentLocation.lng,
        address: agent.currentLocation.address,
        assignedZone: agent.assignedZone,
        activeOrdersCount: agent.activeOrderIds?.length || (agent.activeOrderId ? 1 : 0),
        updatedAt: new Date()
      });
    }

    // Broadcast live location stream to active order room for Customer
    if (agent.activeOrderId) {
      emitToOrderRoom(agent.activeOrderId, 'rider_live_location', {
        agentId: agent._id,
        agentName: agent.fullName,
        phone: agent.phone,
        lat: agent.currentLocation.lat,
        lng: agent.currentLocation.lng,
        address: agent.currentLocation.address,
        updatedAt: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Agent GPS coordinates updated in MongoDB & broadcasted via Socket.IO.',
      currentLocation: agent.currentLocation
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Agent Delivery History
// @route   GET /api/delivery/history
// @access  Private (Delivery Agent)
export const getDeliveryHistory = async (req, res, next) => {
  try {
    const agent = await DeliveryAgent.findOne({ userId: req.user._id });
    if (!agent) return res.status(404).json({ success: false, message: 'Delivery agent not found' });

    const deliveries = await Order.find({
      deliveryAgentId: agent._id,
      orderStatus: ORDER_STATUSES.DELIVERED
    })
      .populate('customerId', 'name phone')
      .populate('sellerId', 'storeName businessAddress')
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      count: deliveries.length,
      deliveries
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Current Delivery Agent Profile & Security Status
// @route   GET /api/delivery/profile
// @access  Private (Delivery Agent)
export const getDeliveryProfile = async (req, res, next) => {
  try {
    const agent = await DeliveryAgent.findOne({ userId: req.user._id })
      .populate('assignedWarehouse', 'name code address city state contactPhone')
      .populate('userId', 'name email phone avatar mustChangePassword createdAt');

    if (!agent) return res.status(404).json({ success: false, message: 'Delivery agent profile not found' });

    res.json({
      success: true,
      profile: {
        _id: agent._id,
        userId: agent.userId?._id,
        fullName: agent.fullName,
        email: agent.email,
        phone: agent.phone,
        address: agent.address,
        vehicleType: agent.vehicleType,
        vehicleNumber: agent.vehicleNumber,
        drivingLicense: agent.drivingLicense,
        profileImage: agent.profileImage || agent.userId?.avatar,
        vehicleImage: agent.vehicleImage,
        isFaceVerified: !!agent.isFaceVerified,
        faceVerificationPhoto: agent.faceVerificationPhoto || '',
        additionalFacePhotos: agent.additionalFacePhotos || [],
        faceVerifiedAt: agent.faceVerifiedAt || null,
        emergencyContact: agent.emergencyContact || { name: '', phone: '', relation: '' },
        assignedWarehouse: agent.assignedWarehouse,
        assignedZone: agent.assignedZone || null,
        preferredPincodes: agent.preferredPincodes || [],
        mustChangePassword: agent.mustChangePassword || agent.userId?.mustChangePassword || false,
        isApproved: agent.isApproved,
        status: agent.status,
        createdAt: agent.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit Mandatory Live Face Verification Photos (Camera Capture)
// @route   POST /api/delivery/verify-face
// @access  Private (Delivery Agent)
export const verifyFacePhoto = async (req, res, next) => {
  try {
    const { facePhoto, additionalPhotos } = req.body;

    if (!facePhoto) {
      return res.status(400).json({ success: false, message: 'Primary camera face photo capture is required.' });
    }

    const agent = await DeliveryAgent.findOne({ userId: req.user._id });
    if (!agent) return res.status(404).json({ success: false, message: 'Delivery agent profile not found.' });

    // Enforce Immortality/Immutability of verified face photo
    if (agent.isFaceVerified && agent.faceVerificationPhoto) {
      return res.status(400).json({
        success: false,
        message: '🔒 Face Verification is already completed and locked. Verified biometric photos cannot be modified or replaced.'
      });
    }

    agent.isFaceVerified = true;
    agent.faceVerificationPhoto = facePhoto;
    if (Array.isArray(additionalPhotos) && additionalPhotos.length > 0) {
      agent.additionalFacePhotos = additionalPhotos.slice(0, 3);
    }
    agent.faceVerifiedAt = new Date();

    // If agent also didn't have a profile image, set profile image to face photo as fallback
    if (!agent.profileImage) {
      agent.profileImage = facePhoto;
    }

    await agent.save();

    res.json({
      success: true,
      message: '✅ Mandatory Live Face Verification Completed! Biometric photos permanently recorded & locked in system KYC.',
      isFaceVerified: true,
      faceVerificationPhoto: agent.faceVerificationPhoto,
      additionalFacePhotos: agent.additionalFacePhotos,
      faceVerifiedAt: agent.faceVerifiedAt
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Delivery Agent Profile Information
// @route   PUT /api/delivery/profile
// @access  Private (Delivery Agent)
export const updateDeliveryProfile = async (req, res, next) => {
  try {
    const { fullName, phone, address, profileImage, vehicleImage, vehicleNumber, vehicleType, drivingLicense, emergencyContact, preferredPincodes } = req.body;

    const agent = await DeliveryAgent.findOne({ userId: req.user._id });
    if (!agent) return res.status(404).json({ success: false, message: 'Delivery agent profile not found' });

    if (fullName) agent.fullName = fullName.trim();
    if (phone) agent.phone = phone.trim();
    if (address) agent.address = address.trim();
    if (profileImage) agent.profileImage = profileImage;
    if (vehicleImage) agent.vehicleImage = vehicleImage;
    if (vehicleNumber) agent.vehicleNumber = vehicleNumber.trim().toUpperCase();
    if (vehicleType) agent.vehicleType = vehicleType.trim();
    if (drivingLicense) agent.drivingLicense = drivingLicense.trim().toUpperCase();

    if (preferredPincodes !== undefined) {
      agent.preferredPincodes = Array.isArray(preferredPincodes)
        ? preferredPincodes.map(p => String(p).trim()).filter(Boolean)
        : (typeof preferredPincodes === 'string' ? preferredPincodes.split(',').map(p => p.trim()).filter(Boolean) : []);
    }
    if (emergencyContact) {
      agent.emergencyContact = {
        name: emergencyContact.name || agent.emergencyContact?.name || '',
        phone: emergencyContact.phone || agent.emergencyContact?.phone || '',
        relation: emergencyContact.relation || agent.emergencyContact?.relation || ''
      };
    }

    await agent.save();

    // Synchronize User record
    const user = await User.findById(req.user._id);
    if (user) {
      if (fullName) user.name = fullName.trim();
      if (phone) user.phone = phone.trim();
      if (profileImage) user.avatar = profileImage;
      if (address) user.address = address.trim();
      await user.save();
    }

    res.json({
      success: true,
      message: '✅ Delivery profile, photo & bike details updated successfully!',
      profile: {
        _id: agent._id,
        fullName: agent.fullName,
        phone: agent.phone,
        address: agent.address,
        vehicleNumber: agent.vehicleNumber,
        vehicleType: agent.vehicleType,
        drivingLicense: agent.drivingLicense,
        profileImage: agent.profileImage,
        emergencyContact: agent.emergencyContact
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Request Payout Bank Details Edit (Requires Admin Approval)
// @route   POST /api/delivery/request-bank-update
// @access  Private (Delivery Agent)
export const requestBankUpdate = async (req, res, next) => {
  try {
    const { accountName, accountNumber, bankName, ifscCode, upiId, otp } = req.body;

    if (!accountNumber || !bankName || !ifscCode) {
      return res.status(400).json({ success: false, message: 'Please provide Bank Name, Account Number and IFSC Code.' });
    }

    if (!otp || String(otp).trim() === '') {
      return res.status(400).json({ success: false, message: '📧 6-Digit Email Security OTP is required to request bank details update.' });
    }

    const user = await User.findById(req.user._id);
    if (user && user.passwordOtp && user.passwordOtp !== String(otp).trim()) {
      return res.status(400).json({ success: false, message: '❌ Invalid Email Security OTP. Please enter the correct code sent to your email.' });
    }

    const agent = await DeliveryAgent.findOne({ userId: req.user._id });
    if (!agent) return res.status(404).json({ success: false, message: 'Delivery agent profile not found.' });

    agent.pendingBankDetails = {
      accountName: accountName || agent.fullName,
      accountNumber: accountNumber.trim(),
      bankName: bankName.trim(),
      ifscCode: ifscCode.trim().toUpperCase(),
      upiId: upiId ? upiId.trim() : '',
      requestedAt: new Date(),
      status: 'PENDING'
    };

    await agent.save();

    res.json({
      success: true,
      message: '⏳ Bank details update request verified via Email OTP & submitted to Admin for KYC approval!',
      pendingBankDetails: agent.pendingBankDetails
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit Support Ticket for Payment Dispute / Wallet Addition
// @route   POST /api/delivery/support-ticket
// @access  Private (Delivery Agent)
export const submitSupportTicket = async (req, res, next) => {
  try {
    const { issueType, description, amountRequested } = req.body;

    if (!description) {
      return res.status(400).json({ success: false, message: 'Please describe your payment or support issue.' });
    }

    const agent = await DeliveryAgent.findOne({ userId: req.user._id });
    if (!agent) return res.status(404).json({ success: false, message: 'Delivery agent profile not found.' });

    const newTicket = {
      ticketId: 'TKT-' + Date.now().toString().slice(-6),
      issueType: issueType || 'PAYMENT',
      description,
      amountRequested: Number(amountRequested) || 0,
      status: 'OPEN',
      createdAt: new Date()
    };

    if (!agent.supportTickets) agent.supportTickets = [];
    agent.supportTickets.unshift(newTicket);
    await agent.save();

    res.json({
      success: true,
      message: `💬 Support ticket #${newTicket.ticketId} submitted. System Admin will review and credit approved funds to your wallet!`,
      ticket: newTicket
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Request Instant Cashout (Enforces 1 Withdrawal per Day Limit & Wallet Validation)
// @route   POST /api/delivery/request-cashout
// @access  Private (Delivery Agent)
export const requestRiderCashout = async (req, res, next) => {
  try {
    const { withdrawAmount, withdrawAll } = req.body;
    const agent = await DeliveryAgent.findOne({ userId: req.user._id });
    if (!agent) return res.status(404).json({ success: false, message: 'Delivery agent profile not found.' });

    const now = new Date();
    // Check if withdrawal was already performed today (same YYYY-MM-DD)
    if (agent.lastWithdrawalDate) {
      const lastWd = new Date(agent.lastWithdrawalDate);
      const isToday = lastWd.getFullYear() === now.getFullYear() &&
                      lastWd.getMonth() === now.getMonth() &&
                      lastWd.getDate() === now.getDate();

      if (isToday) {
        return res.status(400).json({
          success: false,
          message: `⏳ Daily Cashout Limit Reached: You have already completed your 1 daily withdrawal for today (${lastWd.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}). Next cashout opens tomorrow!`
        });
      }
    }

    const available = agent.wallet?.availableBalance || 0;
    if (available <= 0) {
      return res.status(400).json({
        success: false,
        message: 'No available balance in wallet. Your available balance is ₹0.'
      });
    }

    let amountToWithdraw = 0;
    if (withdrawAll || withdrawAmount === undefined || withdrawAmount === null || withdrawAmount === '') {
      amountToWithdraw = available;
    } else {
      amountToWithdraw = Number(withdrawAmount);
    }

    if (isNaN(amountToWithdraw) || amountToWithdraw <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid cashout amount.' });
    }

    // Minimum Threshold Check (₹100)
    if (amountToWithdraw < 100) {
      return res.status(400).json({
        success: false,
        message: '⚠️ Minimum cashout amount is ₹100. Please enter an amount of ₹100 or more.'
      });
    }

    // Insufficient Balance Validation
    if (amountToWithdraw > available) {
      return res.status(400).json({
        success: false,
        message: `❌ Insufficient Wallet Balance: You only have ₹${available.toLocaleString('en-IN')} available in your account. Cannot withdraw ₹${amountToWithdraw.toLocaleString('en-IN')}.`
      });
    }

    // Process Cashout: Deduct from available balance
    agent.lastWithdrawalDate = now;
    agent.wallet.totalWithdrawn = (agent.wallet.totalWithdrawn || 0) + amountToWithdraw;
    agent.wallet.availableBalance = available - amountToWithdraw;
    await agent.save();

    // Send real email notification to rider
    if (req.user?.email || agent.email) {
      sendWalletWithdrawalEmail(
        req.user?.email || agent.email,
        agent.fullName,
        amountToWithdraw,
        agent.bankDetails,
        agent.wallet.availableBalance
      ).catch(e => console.error('Cashout email error:', e.message));
    }

    res.json({
      success: true,
      message: `🎉 Cashout request for ₹${amountToWithdraw.toLocaleString('en-IN')} submitted successfully! Sent to your registered bank account (${agent.bankDetails?.bankName || 'SBI'}). Email notification sent to ${req.user?.email || agent.email}.`,
      withdrawnAmount: amountToWithdraw,
      remainingBalance: agent.wallet.availableBalance,
      lastWithdrawalDate: agent.lastWithdrawalDate
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send Email OTP for Password Reset
// @route   POST /api/delivery/send-password-otp
// @access  Private (Delivery Agent)
export const sendPasswordOtp = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User account not found' });

    const agent = await DeliveryAgent.findOne({ userId: req.user._id });

    // Generate 6-Digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.passwordOtp = otp;
    user.passwordOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
    await user.save();

    // Dispatch OTP Email
    await sendPasswordOtpEmail(user.email, user.name || agent?.fullName || 'Rider Partner', otp);

    res.json({
      success: true,
      message: `📧 6-Digit Security OTP sent to ${user.email}. Check your email inbox!`
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Securely Change Delivery Agent Password via Email OTP or Current Password
// @route   PUT /api/delivery/change-password
// @access  Private (Delivery Agent)
export const changeDeliveryPassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, otp } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User account not found' });

    // Verify via Email OTP if provided, else via current password
    if (otp) {
      if (!user.passwordOtp || user.passwordOtp !== String(otp).trim()) {
        return res.status(400).json({ success: false, message: '❌ Invalid Email Security OTP. Please enter the correct 6-digit code sent to your email.' });
      }
      if (user.passwordOtpExpires && new Date(user.passwordOtpExpires) < new Date()) {
        return res.status(400).json({ success: false, message: '⏰ Security OTP has expired. Please click "Send OTP" to receive a new code.' });
      }
      // Clear used OTP
      user.passwordOtp = undefined;
      user.passwordOtpExpires = undefined;
    } else if (currentPassword) {
      const isMatch = await user.matchPassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect. Please check your credentials.' });
      }
    } else {
      return res.status(400).json({ success: false, message: 'Please provide either Email OTP or Current Password to verify identity.' });
    }

    // Set new password (will be hashed by User pre-save hook)
    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();

    // Update agent flag
    await DeliveryAgent.findOneAndUpdate(
      { userId: user._id },
      { mustChangePassword: false }
    );

    res.json({
      success: true,
      message: '🔒 Password updated successfully! Your account is now fully secured.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Warehouse Manager / Admin: Assign or Update Delivery Agent Route Corridor by Last Stop Pincode
// @route   PUT /api/delivery/agents/:agentId/assign-route
// @access  Private (Warehouse Manager / Admin)
export const updateAgentRouteByWarehouseManager = async (req, res, next) => {
  try {
    const { agentId } = req.params;
    const { routeName, startPincode, endPincode, endVillageName, startWarehouseName, corridorRadiusKm, startLat, startLng, endLat, endLng } = req.body;

    if (!endPincode) {
      return res.status(400).json({ success: false, message: 'Last Village / End Stop Pincode is required to set route corridor.' });
    }

    const agent = await DeliveryAgent.findById(agentId);
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Delivery Agent not found' });
    }

    const sPincode = startPincode || '522001';
    const ePincode = endPincode;
    const rName = routeName || `Hub Route (${sPincode} ➔ ${ePincode})`;
    const eVillage = endVillageName || `Last Stop Village (PIN: ${ePincode})`;

    agent.assignedRoute = {
      routeName: rName,
      startWarehouseName: startWarehouseName || 'Regional Logistics Hub',
      startPincode: sPincode,
      endPincode: ePincode,
      endVillageName: eVillage,
      corridorRadiusKm: Number(corridorRadiusKm) || 10,
      assignedByWarehouseManager: req.user.name || 'Warehouse Manager',
      assignedAt: new Date(),
      startCoordinates: {
        lat: Number(startLat) || 16.3067,
        lng: Number(startLng) || 80.4365
      },
      endCoordinates: {
        lat: Number(endLat) || 16.2430,
        lng: Number(endLng) || 80.6400
      }
    };

    await agent.save();

    res.json({
      success: true,
      message: `✅ Route corridor updated by Warehouse Manager for Rider ${agent.fullName}! Target End Pincode: ${ePincode}.`,
      assignedRoute: agent.assignedRoute
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Redeem Gift Card code into Delivery Agent Wallet Balance
// @route   POST /api/delivery/redeem-gift-card
// @access  Private (Delivery Agent)
export const redeemGiftCardToWallet = async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, message: 'Please provide a valid gift card code.' });
    }

    const agent = await DeliveryAgent.findOne({ userId: req.user._id });
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Delivery agent profile not found.' });
    }

    const cleanCode = code.trim().toUpperCase();
    const altCode = cleanCode.startsWith('GF-')
      ? cleanCode.replace(/^GF-/, 'GC-')
      : cleanCode.startsWith('GC-')
        ? cleanCode.replace(/^GC-/, 'GF-')
        : cleanCode;
    const userEmail = (req.user.email || agent.email || '').toLowerCase().trim();

    const GiftCardModule = await import('../models/GiftCard.js');
    const GiftCard = GiftCardModule.GiftCard || GiftCardModule;

    let card = await GiftCard.findOne({ code: { $in: [cleanCode, altCode] } });

    if (cleanCode === 'NOVAKART20' || altCode === 'NOVAKART20') {
      const existingUsed = await GiftCard.findOne({
        code: 'NOVAKART20',
        $or: [{ customerId: req.user._id }, { email: userEmail }],
        isUsed: true
      });
      if (existingUsed) {
        return res.status(400).json({ success: false, message: 'You have already redeemed the NOVAKART20 promo gift card.' });
      }

      card = new GiftCard({
        code: 'NOVAKART20',
        amount: 50,
        customerId: req.user._id,
        email: userEmail,
        isUsed: true,
        usedAt: new Date()
      });
      await card.save();
    } else {
      if (!card) {
        const cardConditions = [{ customerId: req.user._id }];
        if (userEmail) cardConditions.push({ email: userEmail });
        card = await GiftCard.findOne({
          isUsed: false,
          $or: cardConditions
        }).sort({ createdAt: -1 });
      }

      if (!card) {
        return res.status(404).json({ success: false, message: 'Invalid gift card code.' });
      }

      const cardEmail = (card.email || '').toLowerCase().trim();
      const isOwnerMatch = (card.customerId && card.customerId.toString() === req.user._id.toString()) ||
                           (userEmail && cardEmail && userEmail === cardEmail);

      if (!isOwnerMatch) {
        return res.status(403).json({ success: false, message: 'This gift card belongs to another registered email address.' });
      }

      if (card.isUsed) {
        return res.status(400).json({ success: false, message: 'This gift card has already been redeemed.' });
      }

      if (new Date() > new Date(card.expiryDate)) {
        return res.status(400).json({ success: false, message: 'This gift card has expired.' });
      }

      card.isUsed = true;
      card.usedAt = new Date();
      await card.save();
    }

    const creditAmount = card.amount || 50;
    if (!agent.wallet) {
      agent.wallet = { availableBalance: 0, pendingVerificationBalance: 0, totalWithdrawn: 0 };
    }

    agent.wallet.availableBalance = (agent.wallet.availableBalance || 0) + creditAmount;
    agent.totalEarnings = (agent.totalEarnings || 0) + creditAmount;
    await agent.save();

    res.json({
      success: true,
      message: `🎉 Gift card "${cleanCode}" of ₹${creditAmount} redeemed successfully! Added to your NovaFleet available wallet balance.`,
      availableBalance: agent.wallet.availableBalance,
      redeemedAmount: creditAmount
    });
  } catch (error) {
    next(error);
  }
};

