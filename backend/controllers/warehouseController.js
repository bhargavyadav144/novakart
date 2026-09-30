import { Warehouse } from '../models/Warehouse.js';
import { User } from '../models/User.js';
import { Order } from '../models/Order.js';
import { DeliveryAgent } from '../models/DeliveryAgent.js';
import { Seller } from '../models/Seller.js';
import { Product } from '../models/Product.js';
import { ROLES, ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES } from '../config/constants.js';
import { emitToOrderRoom, emitToSeller, emitToUser, emitToAdmin, emitToWarehouseFleet } from '../services/socketService.js';
import { detectTerritoryFromCircle, REGIONAL_MANDALS } from '../utils/regionalTerritoryData.js';

// Haversine distance calculator in KM
export const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 99999;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
};

// Helper to compute active delivery destination and navigation telemetry
const buildRiderDeliveryTelemetry = (r, warehouse, activeOrders = []) => {
  const activeOrder = activeOrders.find(
    o => (r.activeOrderId && o._id.toString() === r.activeOrderId.toString()) ||
         (o.deliveryAgentId && o.deliveryAgentId.toString() === r._id.toString())
  );

  const agentLat = r.currentLocation?.lat || warehouse?.location?.lat || 16.3067;
  const agentLng = r.currentLocation?.lng || warehouse?.location?.lng || 80.4365;

  let activeDelivery = null;
  if (activeOrder) {
    const rawCoords = activeOrder.deliveryAddress?.coordinates;
    const isDefaultFarCoords = !rawCoords?.lat ||
      (Math.abs(rawCoords.lat - 28.6139) < 0.1 && Math.abs(rawCoords.lng - 77.2090) < 0.1);

    const destCoords = (!isDefaultFarCoords && rawCoords?.lat && rawCoords?.lng)
      ? rawCoords
      : {
          lat: (warehouse?.location?.lat || 16.3067) + 0.0145,
          lng: (warehouse?.location?.lng || 80.4365) + 0.0210
        };

    const distKm = calculateDistanceKm(agentLat, agentLng, destCoords.lat, destCoords.lng);
    const etaMins = Math.max(4, Math.round(distKm * 2.5));

    activeDelivery = {
      orderId: activeOrder._id,
      orderNumber: activeOrder.orderNumber,
      orderStatus: activeOrder.orderStatus,
      totalAmount: activeOrder.totalAmount,
      paymentMethod: activeOrder.paymentMethod,
      itemsCount: activeOrder.items?.length || 1,
      itemsSummary: (activeOrder.items || []).map(it => `${it.name || 'Product'} (x${it.quantity || 1})`).join(', '),
      destination: {
        recipientName: activeOrder.deliveryAddress?.fullName || 'Customer',
        phone: activeOrder.deliveryAddress?.phone || 'N/A',
        street: activeOrder.deliveryAddress?.street || 'Customer Doorstep Address',
        city: activeOrder.deliveryAddress?.city || warehouse?.city || 'Guntur',
        state: activeOrder.deliveryAddress?.state || warehouse?.state || 'AP',
        postalCode: activeOrder.deliveryAddress?.postalCode || '522002',
        lat: destCoords.lat,
        lng: destCoords.lng
      },
      currentPosition: {
        lat: agentLat,
        lng: agentLng,
        address: r.currentLocation?.address || `${warehouse?.city || 'Regional'} Hub Operations Sector`
      },
      distanceKm: distKm,
      etaMinutes: etaMins,
      statusText: activeOrder.orderStatus === 'OUT_FOR_DELIVERY' ? 'Out for Doorstep Delivery' : 'En Route with Shipment'
    };
  } else if (r.isOnline) {
    const destLat = r.assignedZone?.center?.lat || (agentLat + 0.008);
    const destLng = r.assignedZone?.center?.lng || (agentLng + 0.011);
    const distKm = calculateDistanceKm(agentLat, agentLng, destLat, destLng);
    activeDelivery = {
      orderId: null,
      orderNumber: null,
      orderStatus: 'ON_DUTY_STANDBY',
      statusText: `On Active Duty • Sector: ${r.assignedZone?.mandal || r.assignedZone?.zoneName || warehouse?.city || 'Operational Hub'}`,
      destination: {
        recipientName: `${r.assignedZone?.zoneName || 'Territory Sector'} Center`,
        phone: '',
        street: `Patrolling ${r.assignedZone?.mandal || 'Assigned'} Mandal Delivery Zone`,
        city: warehouse?.city || 'Guntur',
        state: warehouse?.state || 'AP',
        postalCode: r.assignedZone?.pincodes?.[0] || '522001',
        lat: destLat,
        lng: destLng
      },
      currentPosition: {
        lat: agentLat,
        lng: agentLng,
        address: r.currentLocation?.address || `${r.assignedZone?.mandal || warehouse?.city || 'Regional'} Delivery Zone`
      },
      distanceKm: distKm,
      etaMinutes: Math.max(3, Math.round(distKm * 2.5))
    };
  }

  return {
    currentLocation: {
      lat: agentLat,
      lng: agentLng,
      address: r.currentLocation?.address || `${warehouse?.city || 'Hub'} Area`
    },
    activeDelivery,
    isOnDuty: r.isOnline || !!activeDelivery,
    activeOrdersCount: r.activeOrderIds?.length || (r.activeOrderId ? 1 : (activeDelivery?.orderId ? 1 : 0))
  };
};

// @desc    Get all warehouses with optional state/type/search filtering
// @route   GET /api/warehouses
// @access  Public or Protected
export const getAllWarehouses = async (req, res) => {
  try {
    const { state, type, search, status } = req.query;
    const filter = {};

    if (state) filter.state = state;
    if (type) filter.type = type;
    if (status) filter.status = status;

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { 'manager.name': { $regex: search, $options: 'i' } },
        { pincode: { $regex: search, $options: 'i' } }
      ];
    }

    const warehouses = await Warehouse.find(filter)
      .populate('manager.userId', 'name email phone role isBlocked')
      .sort({ state: 1, city: 1 });

    res.json({
      success: true,
      count: warehouses.length,
      warehouses
    });
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    res.status(500).json({ success: false, message: 'Server error fetching warehouses' });
  }
};

// @desc    Find nearest warehouse to given GPS coordinates
// @route   GET /api/warehouses/nearest
// @access  Public
export const getNearestWarehouse = async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const type = req.query.type;

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ success: false, message: 'Valid lat and lng coordinates required' });
    }

    const filter = { status: 'active' };
    if (type) filter.type = type;

    const warehouses = await Warehouse.find(filter);
    if (!warehouses || warehouses.length === 0) {
      return res.status(404).json({ success: false, message: 'No active warehouses found' });
    }

    let nearest = null;
    let minDistance = Infinity;

    for (const wh of warehouses) {
      const dist = calculateDistanceKm(lat, lng, wh.location.lat, wh.location.lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = { ...wh.toObject(), distanceKm: dist };
      }
    }

    res.json({
      success: true,
      nearestWarehouse: nearest,
      distanceKm: minDistance
    });
  } catch (error) {
    console.error('Error finding nearest warehouse:', error);
    res.status(500).json({ success: false, message: 'Server error finding nearest warehouse' });
  }
};

// @desc    Get warehouse by ID
// @route   GET /api/warehouses/:id
// @access  Public / Protected
export const getWarehouseById = async (req, res) => {
  try {
    const warehouse = await Warehouse.findById(req.params.id)
      .populate('manager.userId', 'name email phone role isBlocked');
    if (!warehouse) {
      return res.status(404).json({ success: false, message: 'Warehouse not found' });
    }
    res.json({ success: true, warehouse });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error retrieving warehouse' });
  }
};

// @desc    Get Current Logged-in Manager's Warehouse Facility
// @route   GET /api/warehouses/my-warehouse
// @access  Private (Warehouse Manager / Admin)
export const getMyWarehouse = async (req, res) => {
  try {
    let warehouse = null;
    if (req.user.role === ROLES.ADMIN && req.query.id) {
      warehouse = await Warehouse.findById(req.query.id);
    } else {
      warehouse = await Warehouse.findOne({
        $or: [
          { 'manager.userId': req.user._id },
          { 'manager.email': req.user.email?.toLowerCase().trim() }
        ]
      });
    }

    if (!warehouse) {
      // Fallback: Return first active warehouse for demo / preview
      warehouse = await Warehouse.findOne({ status: 'active' });
    }

    if (!warehouse) {
      return res.status(404).json({ success: false, message: 'No warehouse facility found' });
    }

    res.json({ success: true, warehouse });
  } catch (error) {
    console.error('Error fetching manager warehouse:', error);
    res.status(500).json({ success: false, message: 'Server error fetching warehouse' });
  }
};

// @desc    Update Manager's Warehouse Operational Status & Load
// @route   PUT /api/warehouses/my-warehouse
// @access  Private (Warehouse Manager / Admin)
export const updateMyWarehouse = async (req, res) => {
  try {
    const { status, currentLoad, capacity } = req.body;
    let warehouse = await Warehouse.findOne({
      $or: [
        { 'manager.userId': req.user._id },
        { 'manager.email': req.user.email?.toLowerCase().trim() }
      ]
    });

    if (!warehouse && req.user.role === ROLES.ADMIN && req.query.id) {
      warehouse = await Warehouse.findById(req.query.id);
    }

    if (!warehouse) {
      return res.status(404).json({ success: false, message: 'No warehouse found to update' });
    }

    if (status) warehouse.status = status;
    if (currentLoad !== undefined) warehouse.currentLoad = Math.max(0, Number(currentLoad));
    if (capacity !== undefined) warehouse.capacity = Number(capacity);

    await warehouse.save();
    res.json({ success: true, warehouse, message: 'Facility parameters updated successfully' });
  } catch (error) {
    console.error('Error updating my warehouse:', error);
    res.status(500).json({ success: false, message: 'Error updating facility parameters' });
  }
};

// @desc    Get Shipments Routed Through This Warehouse
// @route   GET /api/warehouses/my-warehouse/shipments
// @access  Private (Warehouse Manager / Admin)
export const getWarehouseShipments = async (req, res) => {
  try {
    let warehouse = await Warehouse.findOne({
      $or: [
        { 'manager.userId': req.user._id },
        { 'manager.email': req.user.email?.toLowerCase().trim() }
      ]
    });

    if (!warehouse && req.user.role === ROLES.ADMIN && req.query.warehouseId) {
      warehouse = await Warehouse.findById(req.query.warehouseId);
    }

    if (!warehouse) {
      warehouse = await Warehouse.findOne({ status: 'active' });
    }

    if (!warehouse) {
      return res.json({ success: true, count: 0, orders: [] });
    }

    const { stage, search } = req.query;
    let filter = {};

    if (search && search.trim()) {
      const cleanSearch = search.trim().replace(/^#/, '');
      filter = {
        $or: [
          { orderNumber: { $regex: cleanSearch, $options: 'i' } },
          { 'deliveryAddress.fullName': { $regex: cleanSearch, $options: 'i' } },
          { 'deliveryAddress.city': { $regex: cleanSearch, $options: 'i' } },
          { 'items.name': { $regex: cleanSearch, $options: 'i' } }
        ]
      };
    } else {
      filter = {
        $or: [
          { 'logisticsRoute.originWarehouse': warehouse._id },
          { 'logisticsRoute.destinationBranch': warehouse._id },
          { 'deliveryAddress.pincode': warehouse.pincode },
          { 'deliveryAddress.city': { $regex: warehouse.city || 'Guntur', $options: 'i' } },
          { orderStatus: { $in: ['PENDING', 'ACCEPTED', 'SELLER_ACCEPTED', 'DISPATCHED_TO_HUB', 'IN_TRANSIT', 'AT_DELIVERY_BRANCH', 'OUT_FOR_DELIVERY', 'DELIVERED'] } }
        ]
      };

      if (stage && stage !== 'ALL') {
        filter['logisticsRoute.transitStage'] = stage;
      }
    }

    const orders = await Order.find(filter)
      .populate('customerId', 'name email phone')
      .populate('sellerId', 'storeName email phone businessAddress')
      .populate('deliveryAgentId', 'fullName email phone vehicleNumber')
      .populate('items.productId', 'name title images thumbnail price')
      .populate('logisticsRoute.originWarehouse')
      .populate('logisticsRoute.destinationBranch')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: orders.length,
      warehouse,
      orders
    });
  } catch (error) {
    console.error('Error fetching warehouse shipments:', error);
    res.status(500).json({ success: false, message: 'Error fetching shipments' });
  }
};

// @desc    Advance Shipment Transit Stage & Auto-Attach Facility (Received, In Transit, At Branch, Out for Delivery)
// @route   PUT /api/warehouses/my-warehouse/shipments/:orderId/stage
// @access  Private (Warehouse Manager / Admin)
export const updateShipmentStage = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { stage, notes } = req.body;

    const validStages = [
      'AT_STORE',
      'DISPATCHED_TO_HUB',
      'IN_REGIONAL_HUB',
      'IN_TRANSIT_TO_BRANCH',
      'AT_DELIVERY_BRANCH',
      'OUT_FOR_DELIVERY',
      'DELIVERED'
    ];

    if (!validStages.includes(stage)) {
      return res.status(400).json({ success: false, message: `Invalid transit stage: ${stage}` });
    }

    let warehouse = await Warehouse.findOne({
      $or: [
        { 'manager.userId': req.user._id },
        { 'manager.email': req.user.email?.toLowerCase().trim() }
      ]
    });
    if (!warehouse) {
      warehouse = await Warehouse.findOne({ status: 'active' });
    }

    const cleanId = String(orderId).trim().replace(/^#/, '');

    // Search by ObjectId OR orderNumber regex
    let order = await Order.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(cleanId) ? cleanId : null },
        { orderNumber: orderId },
        { orderNumber: cleanId },
        { orderNumber: { $regex: cleanId, $options: 'i' } }
      ]
    })
      .populate('logisticsRoute.originWarehouse')
      .populate('logisticsRoute.destinationBranch');

    if (!order) {
      return res.status(404).json({ success: false, message: `Order '${orderId}' not found in database.` });
    }

    if (!order.logisticsRoute) {
      order.logisticsRoute = {};
    }

    // Auto-attach warehouse facility to order's logistics route
    if (warehouse) {
      if (!order.logisticsRoute.originWarehouse) {
        order.logisticsRoute.originWarehouse = warehouse._id;
      }
      if (['AT_DELIVERY_BRANCH', 'OUT_FOR_DELIVERY', 'IN_TRANSIT_TO_BRANCH'].includes(stage)) {
        order.logisticsRoute.destinationBranch = warehouse._id;
      }
    }

    // Calculate 9:00 AM Delivery Cutoff & Rider Dispatch Batch
    const now = new Date();
    const currentHour = now.getHours(); // 0 to 23
    const isBefore9AM = currentHour < 9;

    const cutoffNotice = isBefore9AM
      ? `⚡ SAME-DAY DELIVERY (Scanned & Received Before 9:00 AM Cutoff) — Assigned for Today's 9:00 AM Rider Delivery Route.`
      : `📦 NEXT-DAY DELIVERY BATCH (Arrived After 9:00 AM Cutoff) — Scheduled for Tomorrow Morning's 9:00 AM Rider Dispatch Batch.`;

    order.logisticsRoute.transitStage = stage;
    order.logisticsRoute.deliverySchedule = {
      isBefore9AM,
      scannedAt: now,
      targetDeliveryDay: isBefore9AM ? 'TODAY' : 'TOMORROW',
      dispatchBatchTime: isBefore9AM ? '9:00 AM Today' : '9:00 AM Tomorrow',
      noticeText: cutoffNotice
    };

    if (notes) {
      order.logisticsRoute.notes = `${notes} | ${cutoffNotice}`;
    }

    // Sync root orderStatus for customer/delivery portals
    if (stage === 'OUT_FOR_DELIVERY') {
      order.orderStatus = ORDER_STATUSES.OUT_FOR_DELIVERY;
    } else if (stage === 'DELIVERED') {
      order.orderStatus = ORDER_STATUSES.DELIVERED;
    }

    order.timeline.push({
      status: `LOGISTICS_${stage}`,
      timestamp: now,
      note: notes ? `${notes} (${cutoffNotice})` : `Shipment advanced to ${stage.replace(/_/g, ' ')} by facility manager. ${cutoffNotice}`,
      updatedBy: req.user.name || 'Warehouse Manager'
    });

    await order.save();

    // Broadcast real-time alerts
    emitToOrderRoom(order._id, 'order_status_update', {
      orderId: order._id,
      stage,
      status: order.orderStatus,
      deliverySchedule: order.logisticsRoute.deliverySchedule,
      message: `Logistics status updated to ${stage.replace(/_/g, ' ')}`
    });
    emitToSeller(order.sellerId, 'seller_order_update', { orderId: order._id, stage });
    emitToUser(order.customerId, 'order_status_update', { orderId: order._id, stage, deliverySchedule: order.logisticsRoute.deliverySchedule });
    emitToAdmin('admin_order_update', { orderId: order._id, stage });
    if (order.logisticsRoute.destinationBranch?._id) {
      emitToWarehouseFleet(order.logisticsRoute.destinationBranch._id, 'warehouse_package_scanned', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        stage,
        deliverySchedule: order.logisticsRoute.deliverySchedule
      });
    }

    res.json({
      success: true,
      message: `Shipment stage successfully updated to ${stage}. ${cutoffNotice}`,
      deliverySchedule: order.logisticsRoute.deliverySchedule,
      order
    });
  } catch (error) {
    console.error('Error updating shipment stage:', error);
    res.status(500).json({ success: false, message: 'Error updating shipment stage' });
  }
};

// @desc    Create a new warehouse with Manager User credentials
// @route   POST /api/warehouses
// @access  Admin
export const createWarehouse = async (req, res) => {
  try {
    const existing = await Warehouse.findOne({ code: req.body.code });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Warehouse code already exists' });
    }

    const managerData = req.body.manager || {};
    const managerEmail = (managerData.email || req.body.managerEmail || '').toLowerCase().trim();
    const managerPassword = req.body.managerPassword || 'ManagerSecure123!';

    let managerUser = null;
    if (managerEmail) {
      managerUser = await User.findOne({ email: managerEmail });
      if (!managerUser) {
        managerUser = await User.create({
          name: managerData.name || 'Warehouse Manager',
          email: managerEmail,
          password: managerPassword,
          phone: managerData.phone || '',
          role: ROLES.WAREHOUSE_MANAGER
        });
      } else {
        managerUser.role = ROLES.WAREHOUSE_MANAGER;
        if (req.body.managerPassword) {
          managerUser.password = managerPassword;
        }
        await managerUser.save();
      }
    }

    const whData = {
      ...req.body,
      manager: {
        ...managerData,
        userId: managerUser ? managerUser._id : undefined
      }
    };

    const warehouse = await Warehouse.create(whData);

    if (managerUser) {
      managerUser.warehouseId = warehouse._id;
      await managerUser.save();
    }

    res.status(201).json({
      success: true,
      warehouse,
      managerCredentials: {
        email: managerEmail,
        temporaryPassword: managerPassword
      },
      message: 'Warehouse created and Manager credentials issued successfully'
    });
  } catch (error) {
    console.error('Error creating warehouse:', error);
    res.status(400).json({ success: false, message: error.message || 'Error creating warehouse' });
  }
};

// @desc    Update warehouse or reset manager credentials
// @route   PUT /api/warehouses/:id
// @access  Admin
export const updateWarehouse = async (req, res) => {
  try {
    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) {
      return res.status(404).json({ success: false, message: 'Warehouse not found' });
    }

    // Check if manager credentials need update
    const managerData = req.body.manager || {};
    const managerEmail = (managerData.email || warehouse.manager?.email || '').toLowerCase().trim();
    const managerPassword = req.body.managerPassword;

    if (managerEmail) {
      let managerUser = await User.findOne({ email: managerEmail });
      if (!managerUser) {
        managerUser = await User.create({
          name: managerData.name || warehouse.manager?.name || 'Warehouse Manager',
          email: managerEmail,
          password: managerPassword || 'ManagerSecure123!',
          phone: managerData.phone || warehouse.manager?.phone || '',
          role: ROLES.WAREHOUSE_MANAGER,
          warehouseId: warehouse._id
        });
      } else {
        managerUser.role = ROLES.WAREHOUSE_MANAGER;
        managerUser.warehouseId = warehouse._id;
        if (managerPassword) {
          managerUser.password = managerPassword;
        }
        if (managerData.name) managerUser.name = managerData.name;
        if (managerData.phone) managerUser.phone = managerData.phone;
        await managerUser.save();
      }

      req.body.manager = {
        ...(warehouse.manager ? warehouse.manager.toObject() : {}),
        ...managerData,
        userId: managerUser._id
      };
    }

    const updatedWarehouse = await Warehouse.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      warehouse: updatedWarehouse,
      message: 'Warehouse and manager credentials updated successfully'
    });
  } catch (error) {
    console.error('Error updating warehouse:', error);
    res.status(400).json({ success: false, message: error.message || 'Error updating warehouse' });
  }
};

// @desc    Delete warehouse
// @route   DELETE /api/warehouses/:id
// @access  Admin
export const deleteWarehouse = async (req, res) => {
  try {
    const warehouse = await Warehouse.findByIdAndDelete(req.params.id);
    if (!warehouse) {
      return res.status(404).json({ success: false, message: 'Warehouse not found' });
    }
    res.json({ success: true, message: 'Warehouse deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting warehouse' });
  }
};

// @desc    Get All Delivery Riders Registered / Assigned to This Warehouse
// @route   GET /api/warehouses/my-warehouse/riders
// @access  Private (Warehouse Manager / Admin)
export const getWarehouseRiders = async (req, res) => {
  try {
    let warehouse = null;
    if (req.user.role === ROLES.WAREHOUSE_MANAGER) {
      warehouse = await Warehouse.findById(req.user.warehouseId);
    } else if (req.query.warehouseId) {
      warehouse = await Warehouse.findById(req.query.warehouseId);
    }

    if (!warehouse) {
      return res.status(404).json({ success: false, message: 'Warehouse facility not found' });
    }

    // Find riders explicitly assigned to this warehouse, or in proximity/city
    const riders = await DeliveryAgent.find({
      $or: [
        { assignedWarehouse: warehouse._id },
        { 'currentLocation.address': { $regex: warehouse.city, $options: 'i' } },
        { address: { $regex: warehouse.city, $options: 'i' } }
      ]
    })
      .populate('userId', 'name email phone avatar mustChangePassword createdAt')
      .populate('assignedWarehouse', 'name code city state')
      .sort({ createdAt: -1 });

    // Ensure all returned riders have assignedWarehouse linked if missing
    for (const r of riders) {
      if (!r.assignedWarehouse) {
        r.assignedWarehouse = warehouse._id;
        await r.save();
      }
    }

    // Find active orders for riders in this warehouse to track on-duty destinations
    const riderIds = riders.map(r => r._id);
    const activeOrders = await Order.find({
      $or: [
        { deliveryAgentId: { $in: riderIds }, orderStatus: { $in: ['OUT_FOR_DELIVERY', 'PICKED_UP', 'ACCEPTED', 'CONFIRMED'] } },
        { _id: { $in: riders.map(r => r.activeOrderId).filter(Boolean) } }
      ]
    }).select('orderNumber orderStatus deliveryAddress totalAmount paymentMethod items customerId createdAt deliveryAgentId');

    // Return rich sanitized rider profiles with assigned territory, live coordinates & active destination
    const sanitized = riders.map(r => {
      const telemetry = buildRiderDeliveryTelemetry(r, warehouse, activeOrders);

      return {
        _id: r._id,
        userId: r.userId?._id,
        fullName: r.fullName,
        email: r.email,
        phone: r.phone,
        address: r.address,
        vehicleType: r.vehicleType,
        vehicleNumber: r.vehicleNumber,
        drivingLicense: r.drivingLicense,
        profileImage: r.profileImage || r.userId?.avatar,
        isApproved: r.isApproved,
        status: r.status,
        isOnline: r.isOnline,
        isAvailable: r.isAvailable,
        todayDeliveries: r.todayDeliveries,
        completedDeliveries: r.completedDeliveries,
        totalEarnings: r.totalEarnings,
        maxConcurrentOrders: r.maxConcurrentOrders,
        assignedWarehouse: r.assignedWarehouse,
        mustChangePassword: r.mustChangePassword || r.userId?.mustChangePassword || false,
        emergencyContact: r.emergencyContact,
        createdAt: r.createdAt,
        currentLocation: telemetry.currentLocation,
        assignedZone: r.assignedZone || null,
        activeDelivery: telemetry.activeDelivery,
        isOnDuty: telemetry.isOnDuty,
        activeOrdersCount: telemetry.activeOrdersCount
      };
    });

    res.json({
      success: true,
      count: sanitized.length,
      warehouse: {
        id: warehouse._id,
        name: warehouse.name,
        code: warehouse.code,
        city: warehouse.city
      },
      riders: sanitized
    });
  } catch (error) {
    console.error('Error fetching warehouse riders:', error);
    res.status(500).json({ success: false, message: 'Error retrieving fleet riders' });
  }
};

// @desc    Register & Onboard New Delivery Rider from Warehouse
// @route   POST /api/warehouses/my-warehouse/riders
// @access  Private (Warehouse Manager / Admin)
export const onboardWarehouseRider = async (req, res) => {
  try {
    let warehouse = null;
    if (req.user.role === ROLES.WAREHOUSE_MANAGER) {
      warehouse = await Warehouse.findById(req.user.warehouseId);
    } else if (req.body.warehouseId) {
      warehouse = await Warehouse.findById(req.body.warehouseId);
    }

    if (!warehouse) {
      return res.status(404).json({ success: false, message: 'Assigned warehouse not found' });
    }

    const {
      fullName,
      email,
      phone,
      password, // Initial temporary password given by manager
      vehicleType,
      vehicleNumber,
      drivingLicense,
      address,
      emergencyContact,
      profileImage
    } = req.body;

    if (!fullName || !email || !phone || !password || !vehicleNumber || !drivingLicense) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: full name, email, phone, initial password, vehicle number, and driving license.'
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: cleanEmail }, { phone: phone.trim() }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: `An account with email (${cleanEmail}) or phone (${phone}) already exists in the system.`
      });
    }

    // 1. Create User account with mustChangePassword flag
    const riderUser = await User.create({
      name: fullName.trim(),
      email: cleanEmail,
      password, // Hashed by User.js pre-save hook
      phone: phone.trim(),
      role: ROLES.DELIVERY,
      warehouseId: warehouse._id,
      mustChangePassword: true,
      address: address || `${warehouse.city}, ${warehouse.state}`,
      avatar: profileImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
    });

    // 2. Create DeliveryAgent fleet profile
    const agent = await DeliveryAgent.create({
      userId: riderUser._id,
      fullName: fullName.trim(),
      email: cleanEmail,
      phone: phone.trim(),
      address: address || `${warehouse.city}, ${warehouse.state}`,
      vehicleType: vehicleType || 'Motorcycle',
      vehicleNumber: vehicleNumber.toUpperCase().trim(),
      drivingLicense: drivingLicense.toUpperCase().trim(),
      profileImage: riderUser.avatar,
      assignedWarehouse: warehouse._id,
      onboardedBy: req.user._id,
      status: 'active',
      isApproved: true,
      isOnline: false,
      isAvailable: false,
      mustChangePassword: true,
      maxConcurrentOrders: 10,
      currentLocation: {
        lat: warehouse.location?.coordinates?.[1] || 16.3067,
        lng: warehouse.location?.coordinates?.[0] || 80.4365,
        address: `${warehouse.name}, ${warehouse.city}`
      },
      emergencyContact: emergencyContact || { name: '', phone: '', relation: '' }
    });

    res.status(201).json({
      success: true,
      message: `🎉 Delivery Rider ${fullName} successfully onboarded to ${warehouse.name}! Initial credentials generated.`,
      rider: {
        _id: agent._id,
        userId: riderUser._id,
        fullName: agent.fullName,
        email: agent.email,
        phone: agent.phone,
        vehicleType: agent.vehicleType,
        vehicleNumber: agent.vehicleNumber,
        drivingLicense: agent.drivingLicense,
        assignedWarehouse: {
          id: warehouse._id,
          name: warehouse.name,
          code: warehouse.code
        },
        mustChangePassword: true,
        createdAt: agent.createdAt
      }
    });
  } catch (error) {
    console.error('Error onboarding warehouse rider:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to onboard delivery rider' });
  }
};

// @desc    Issue New Temporary Password for Rider (Cannot view existing password)
// @route   PUT /api/warehouses/my-warehouse/riders/:id/reset-temp-password
// @access  Private (Warehouse Manager / Admin)
export const resetRiderTempPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newTempPassword } = req.body;

    if (!newTempPassword || newTempPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid temporary password with at least 6 characters.'
      });
    }

    const agent = await DeliveryAgent.findById(id);
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Delivery agent profile not found' });
    }

    const user = await User.findById(agent.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found' });
    }

    user.password = newTempPassword;
    user.mustChangePassword = true;
    await user.save();

    agent.mustChangePassword = true;
    await agent.save();

    res.json({
      success: true,
      message: `✅ Temporary password successfully issued for rider ${agent.fullName}. They will be prompted to change it upon login.`
    });
  } catch (error) {
    console.error('Error resetting temp password:', error);
    res.status(500).json({ success: false, message: 'Failed to reset temporary password' });
  }
};

// @desc    Update/Reset Warehouse Manager Password
// @route   PUT /api/warehouses/:id/manager-password
// @access  Admin
export const updateWarehouseManagerPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.trim().length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) {
      return res.status(404).json({ success: false, message: 'Warehouse facility not found' });
    }

    const managerEmail = (warehouse.manager?.email || '').toLowerCase().trim();
    if (!managerEmail) {
      return res.status(400).json({
        success: false,
        message: 'No assigned manager email found for this warehouse facility'
      });
    }

    let managerUser = await User.findOne({ email: managerEmail });
    if (!managerUser) {
      managerUser = await User.create({
        name: warehouse.manager?.name || 'Warehouse Manager',
        email: managerEmail,
        password: password.trim(),
        phone: warehouse.manager?.phone || '',
        role: ROLES.WAREHOUSE_MANAGER,
        warehouseId: warehouse._id
      });
      warehouse.manager.userId = managerUser._id;
      await warehouse.save();
    } else {
      managerUser.password = password.trim();
      managerUser.role = ROLES.WAREHOUSE_MANAGER;
      managerUser.warehouseId = warehouse._id;
      await managerUser.save();
    }

    res.json({
      success: true,
      message: `Password successfully updated for ${warehouse.manager?.name || 'Manager'} (${managerEmail})`,
      credentials: {
        warehouseName: warehouse.name,
        warehouseCode: warehouse.code,
        portalUrl: 'http://localhost:3004',
        managerName: warehouse.manager?.name,
        employeeId: warehouse.manager?.employeeId || 'N/A',
        email: managerEmail,
        password: password.trim()
      }
    });
  } catch (error) {
    console.error('Error updating warehouse manager password:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update warehouse manager password'
    });
  }
};

// @desc    Get Warehouse Manager Credentials for Admin Copy/View
// @route   GET /api/warehouses/:id/credentials
// @access  Admin
export const getWarehouseCredentials = async (req, res) => {
  try {
    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) {
      return res.status(404).json({ success: false, message: 'Warehouse not found' });
    }

    const managerEmail = (warehouse.manager?.email || '').toLowerCase().trim();
    const managerUser = managerEmail ? await User.findOne({ email: managerEmail }) : null;

    res.json({
      success: true,
      credentials: {
        warehouseName: warehouse.name,
        warehouseCode: warehouse.code,
        type: warehouse.type,
        city: warehouse.city,
        state: warehouse.state,
        portalUrl: 'http://localhost:3004',
        managerName: warehouse.manager?.name || 'Unassigned',
        employeeId: warehouse.manager?.employeeId || 'N/A',
        phone: warehouse.manager?.phone || 'N/A',
        email: managerEmail,
        defaultPassword: 'ManagerSecure123!',
        accountReady: !!managerUser
      }
    });
  } catch (error) {
    console.error('Error fetching warehouse credentials:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch warehouse credentials' });
  }
};

// @desc    Admin: Update Warehouse Coverage Territory / Service Area (Pincodes & Radius)
// @route   PUT /api/warehouses/:id/service-area
// @access  Admin
export const updateWarehouseServiceArea = async (req, res) => {
  try {
    const { id } = req.params;
    const { pincodes, center, radiusKm, color } = req.body;

    const warehouse = await Warehouse.findById(id);
    if (!warehouse) {
      return res.status(404).json({ success: false, message: 'Warehouse not found' });
    }

    warehouse.serviceArea = {
      pincodes: Array.isArray(pincodes) ? pincodes.map(p => String(p).trim()).filter(Boolean) : (warehouse.serviceArea?.pincodes || []),
      center: {
        lat: center?.lat !== undefined ? parseFloat(center.lat) : (warehouse.serviceArea?.center?.lat || warehouse.location.lat),
        lng: center?.lng !== undefined ? parseFloat(center.lng) : (warehouse.serviceArea?.center?.lng || warehouse.location.lng)
      },
      radiusKm: radiusKm !== undefined ? Number(radiusKm) : (warehouse.serviceArea?.radiusKm || 15),
      color: color || warehouse.serviceArea?.color || '#2563EB',
      markedByAdmin: true,
      updatedAt: new Date()
    };

    await warehouse.save();

    res.json({
      success: true,
      message: `✅ Warehouse coverage territory updated for ${warehouse.name}!`,
      serviceArea: warehouse.serviceArea
    });
  } catch (error) {
    console.error('Error updating warehouse service area:', error);
    res.status(500).json({ success: false, message: 'Failed to update warehouse service area' });
  }
};

// @desc    Warehouse Manager: Get Delivery Territory Zones & Active Fleet for Map
// @route   GET /api/warehouses/my-warehouse/zones
// @access  Warehouse Manager
export const getWarehouseZones = async (req, res) => {
  try {
    const managerEmail = (req.user.email || '').toLowerCase().trim();
    const warehouse = await Warehouse.findOne({
      $or: [
        { 'manager.userId': req.user._id },
        { 'manager.email': managerEmail }
      ]
    });

    if (!warehouse) {
      return res.status(404).json({ success: false, message: 'Manager warehouse not found' });
    }

    // Default sample zones if none created yet and not initialized
    if ((!warehouse.deliveryZones || warehouse.deliveryZones.length === 0) && !warehouse.isZonesInitialized) {
      const wLat = warehouse.location?.lat || 16.3067;
      const wLng = warehouse.location?.lng || 80.4365;

      warehouse.deliveryZones = [
        {
          zoneId: 'ZONE-ETUKURU',
          zoneName: 'Etukuru Urban Corridor',
          pincodes: ['522017', '522003'],
          center: { lat: wLat - 0.025, lng: wLng + 0.035 },
          radiusKm: 4.5,
          color: '#10B981', // Emerald Green
          assignedAgentIds: []
        },
        {
          zoneId: 'ZONE-BUDAMPADU',
          zoneName: 'Budampadu Highway Sector',
          pincodes: ['522018', '522005'],
          center: { lat: wLat - 0.065, lng: wLng + 0.025 },
          radiusKm: 5.5,
          color: '#F59E0B', // Amber
          assignedAgentIds: []
        },
        {
          zoneId: 'ZONE-CENTRAL',
          zoneName: 'City Central & Station Sector',
          pincodes: ['522001', '522002'],
          center: { lat: wLat + 0.015, lng: wLng - 0.015 },
          radiusKm: 3.5,
          color: '#8B5CF6', // Purple
          assignedAgentIds: []
        }
      ];
      warehouse.isZonesInitialized = true;
      await warehouse.save();
    }

    // Fetch all delivery agents registered under this warehouse (or nearby)
    const riders = await DeliveryAgent.find({
      $or: [
        { assignedWarehouse: warehouse._id },
        { 'assignedRoute.startWarehouseName': warehouse.name },
        { status: 'approved' }
      ]
    }).populate('userId', 'name email isOnline isBlocked');

    // Fetch active orders for these riders to track where on-duty riders are going
    const riderIds = riders.map(r => r._id);
    const activeOrders = await Order.find({
      $or: [
        { deliveryAgentId: { $in: riderIds }, orderStatus: { $in: ['OUT_FOR_DELIVERY', 'PICKED_UP', 'ACCEPTED', 'CONFIRMED'] } },
        { _id: { $in: riders.map(r => r.activeOrderId).filter(Boolean) } }
      ]
    }).select('orderNumber orderStatus deliveryAddress totalAmount paymentMethod items customerId createdAt deliveryAgentId');

    res.json({
      success: true,
      warehouse: {
        _id: warehouse._id,
        name: warehouse.name,
        code: warehouse.code,
        city: warehouse.city,
        state: warehouse.state,
        location: warehouse.location,
        serviceArea: warehouse.serviceArea || {
          pincodes: [warehouse.pincode, '522017', '522018', '522001'],
          center: warehouse.location,
          radiusKm: 15,
          color: '#2563EB'
        }
      },
      zones: warehouse.deliveryZones || [],
      riders: riders.map(r => {
        const telemetry = buildRiderDeliveryTelemetry(r, warehouse, activeOrders);
        return {
          _id: r._id,
          fullName: r.fullName,
          phone: r.phone,
          email: r.email,
          vehicleType: r.vehicleType,
          vehicleNumber: r.vehicleNumber,
          isOnline: r.isOnline,
          status: r.status,
          currentLocation: telemetry.currentLocation,
          assignedZone: r.assignedZone,
          assignedZones: r.assignedZones && r.assignedZones.length > 0 ? r.assignedZones : (r.assignedZone?.mandal ? [r.assignedZone] : []),
          activeOrdersCount: telemetry.activeOrdersCount,
          activeDelivery: telemetry.activeDelivery,
          isOnDuty: telemetry.isOnDuty,
          todayDeliveries: r.todayDeliveries,
          completedDeliveries: r.completedDeliveries
        };
      })
    });
  } catch (error) {
    console.error('Error fetching warehouse zones:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch warehouse zones' });
  }
};

// @desc    Warehouse Manager: Create or Update Territory Zone on Map with Color & Assigned Riders
// @route   POST /api/warehouses/my-warehouse/zones
// @access  Warehouse Manager
export const createOrUpdateWarehouseZone = async (req, res) => {
  try {
    const managerEmail = (req.user.email || '').toLowerCase().trim();
    const warehouse = await Warehouse.findOne({
      $or: [
        { 'manager.userId': req.user._id },
        { 'manager.email': managerEmail }
      ]
    });

    if (!warehouse) {
      return res.status(404).json({ success: false, message: 'Manager warehouse not found' });
    }

    const { zoneId, zoneName, mandal, pincodes, center, radiusKm, color, assignedAgentIds } = req.body;

    if (!zoneName) {
      return res.status(400).json({ success: false, message: 'Zone name is required.' });
    }

    const cleanPincodes = Array.isArray(pincodes)
      ? pincodes.map(p => String(p).trim()).filter(Boolean)
      : (typeof pincodes === 'string' ? pincodes.split(',').map(p => p.trim()).filter(Boolean) : []);

    const cleanMandal = (mandal || '').trim();
    const targetZoneId = zoneId || `ZONE-${Date.now().toString().slice(-6)}`;
    const zoneColor = color || '#10B981';
    const zoneRadius = radiusKm ? Math.min(Math.max(1, Number(radiusKm)), 100) : 5;
    const zoneCenter = {
      lat: center?.lat ? parseFloat(center.lat) : warehouse.location.lat,
      lng: center?.lng ? parseFloat(center.lng) : warehouse.location.lng
    };
    const validAgentIds = Array.isArray(assignedAgentIds) ? assignedAgentIds : [];

    const existingIndex = (warehouse.deliveryZones || []).findIndex(z => z.zoneId === targetZoneId);

    const zoneObj = {
      zoneId: targetZoneId,
      zoneName: zoneName.trim(),
      mandal: cleanMandal,
      pincodes: cleanPincodes,
      center: zoneCenter,
      radiusKm: zoneRadius,
      color: zoneColor,
      assignedAgentIds: validAgentIds,
      updatedAt: new Date()
    };

    if (existingIndex >= 0) {
      warehouse.deliveryZones[existingIndex] = { ...warehouse.deliveryZones[existingIndex], ...zoneObj };
    } else {
      warehouse.deliveryZones.push(zoneObj);
    }

    warehouse.isZonesInitialized = true;
    await warehouse.save();

    // Sync assignedZone to all assigned delivery agents (with multi-pincodes and mandal)
    if (validAgentIds.length > 0) {
      await DeliveryAgent.updateMany(
        { _id: { $in: validAgentIds } },
        {
          assignedWarehouse: warehouse._id,
          assignedZone: {
            zoneId: targetZoneId,
            zoneName: zoneName.trim(),
            mandal: cleanMandal,
            pincodes: cleanPincodes,
            center: zoneCenter,
            radiusKm: zoneRadius,
            color: zoneColor,
            assignedByWarehouseManager: req.user._id,
            assignedAt: new Date()
          }
        }
      );
    }

    res.json({
      success: true,
      message: `✅ Territory Zone "${zoneName}" ${cleanMandal ? `(Mandal: ${cleanMandal})` : ''} with ${cleanPincodes.length} pincodes configured successfully for ${validAgentIds.length} assigned rider(s)!`,
      zone: zoneObj,
      zones: warehouse.deliveryZones
    });
  } catch (error) {
    console.error('Error saving warehouse zone:', error);
    res.status(500).json({ success: false, message: 'Failed to configure territory zone' });
  }
};

// @desc    Warehouse Manager: Delete Territory Zone
// @route   DELETE /api/warehouses/my-warehouse/zones/:zoneId
// @access  Warehouse Manager
export const deleteWarehouseZone = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const managerEmail = (req.user.email || '').toLowerCase().trim();
    const warehouse = await Warehouse.findOne({
      $or: [
        { 'manager.userId': req.user._id },
        { 'manager.email': managerEmail }
      ]
    });

    if (!warehouse) {
      return res.status(404).json({ success: false, message: 'Manager warehouse not found' });
    }

    warehouse.deliveryZones = (warehouse.deliveryZones || []).filter(
      z => z.zoneId !== zoneId && z._id?.toString() !== zoneId
    );
    warehouse.isZonesInitialized = true;
    await warehouse.save();

    await DeliveryAgent.updateMany(
      { $or: [{ 'assignedZone.zoneId': zoneId }, { 'assignedZone._id': zoneId }] },
      { $unset: { assignedZone: 1 } }
    );


    res.json({
      success: true,
      message: 'Territory zone deleted successfully',
      zones: warehouse.deliveryZones
    });
  } catch (error) {
    console.error('Error deleting warehouse zone:', error);
    res.status(500).json({ success: false, message: 'Failed to delete territory zone' });
  }
};

// @desc    Warehouse Manager: Directly Assign Rider to 1 or N Mandal Territory Zones
// @route   PUT /api/warehouses/my-warehouse/riders/:agentId/assign-zone
// @access  Warehouse Manager
export const assignRiderToZone = async (req, res) => {
  try {
    const { agentId } = req.params;
    let { zones, zoneId, zoneName, mandal, pincodes, center, radiusKm, color } = req.body;

    const agent = await DeliveryAgent.findById(agentId);
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Delivery agent not found' });
    }

    // Determine list of input zones (N mandals)
    let inputZonesList = [];
    if (Array.isArray(zones) && zones.length > 0) {
      inputZonesList = zones;
    } else {
      inputZonesList = [{ zoneId, zoneName, mandal, pincodes, center, radiusKm, color }];
    }

    const cleanZones = inputZonesList.map((z, idx) => {
      const zPincodes = Array.isArray(z.pincodes)
        ? z.pincodes.map(p => String(p).trim()).filter(Boolean)
        : (typeof z.pincodes === 'string' ? z.pincodes.split(',').map(s => s.trim()).filter(Boolean) : []);
      const zMandal = (z.mandal || '').trim();
      const zZoneId = z.zoneId || `ZONE-${Date.now().toString().slice(-6)}-${idx}`;
      const zColor = z.color || '#10B981';
      const zRadius = z.radiusKm ? Math.min(Math.max(1, Number(z.radiusKm)), 100) : 5;
      const zCenter = {
        lat: z.center?.lat ? parseFloat(z.center.lat) : 16.3067,
        lng: z.center?.lng ? parseFloat(z.center.lng) : 80.4365
      };
      return {
        zoneId: zZoneId,
        zoneName: z.zoneName || (zMandal ? `${zMandal} Sector` : 'Assigned Territory'),
        mandal: zMandal,
        pincodes: zPincodes,
        center: zCenter,
        radiusKm: zRadius,
        color: zColor,
        assignedByWarehouseManager: req.user._id,
        assignedAt: new Date()
      };
    });

    // Save assignedZones (array of N mandals) and primary assignedZone
    agent.assignedZones = cleanZones;
    agent.assignedZone = cleanZones[0];

    // Combine all pincodes & mandal names across N assigned mandals
    const allPincodes = Array.from(new Set(cleanZones.flatMap(z => z.pincodes)));
    const allMandals = Array.from(new Set(cleanZones.map(z => z.mandal).filter(Boolean)));
    const primaryMandal = cleanZones[0]?.mandal || 'Hub Operational Area';

    // Retrieve warehouse facility
    let warehouse = null;
    if (req.user.warehouseId) {
      warehouse = await Warehouse.findById(req.user.warehouseId);
    } else if (agent.assignedWarehouse) {
      warehouse = await Warehouse.findById(agent.assignedWarehouse);
    }

    // Realign active orders matching ANY of the N assigned mandals or pincodes
    await Order.updateMany(
      {
        deliveryAgentId: agent._id,
        orderStatus: { $in: [ORDER_STATUSES.AGENT_ASSIGNED, ORDER_STATUSES.PICKED_UP, ORDER_STATUSES.OUT_FOR_DELIVERY] },
        'deliveryAddress.postalCode': { $nin: allPincodes },
        'deliveryAddress.city': { $nin: allMandals }
      },
      {
        deliveryAgentId: null,
        orderStatus: ORDER_STATUSES.SELLER_ACCEPTED
      }
    );

    let matchingOrders = await Order.find({
      $or: [
        { deliveryAgentId: agent._id, orderStatus: { $in: [ORDER_STATUSES.AGENT_ASSIGNED, ORDER_STATUSES.PICKED_UP, ORDER_STATUSES.OUT_FOR_DELIVERY] } },
        { 'deliveryAddress.postalCode': { $in: allPincodes }, deliveryAgentId: null },
        { 'deliveryAddress.city': { $in: allMandals }, deliveryAgentId: null }
      ]
    }).limit(5);

    for (const ord of matchingOrders) {
      ord.deliveryAgentId = agent._id;
      ord.orderStatus = ORDER_STATUSES.OUT_FOR_DELIVERY;
      await ord.save();
    }

    agent.activeOrderIds = matchingOrders.map(o => o._id);
    agent.activeOrderId = matchingOrders[0]?._id || null;

    // Update assigned route
    const totalCoverageRadius = Math.round(cleanZones.reduce((sum, z) => sum + z.radiusKm, 0));
    agent.assignedRoute = {
      routeName: `${primaryMandal} & ${cleanZones.length - 1 > 0 ? `${cleanZones.length - 1} Adjacent Mandals` : 'Corridor'}`,
      routeTitle: `Multi-Mandal Delivery Route (${cleanZones.length} Mandals Assigned)`,
      startWarehouseName: warehouse ? warehouse.name : 'District Logistics Hub',
      startPincode: allPincodes[0] || '522001',
      endPincode: allPincodes[allPincodes.length - 1] || '522019',
      endVillageName: `${cleanZones[cleanZones.length - 1]?.mandal || 'Sector'} Sector Stop`,
      corridorRadiusKm: totalCoverageRadius,
      assignedByWarehouseManager: req.user.name || 'Warehouse Manager',
      assignedAt: new Date(),
      startCoordinates: warehouse?.location || { lat: 16.3067, lng: 80.4365 },
      endCoordinates: cleanZones[cleanZones.length - 1]?.center || { lat: 16.3067, lng: 80.4365 },
      totalStops: matchingOrders.length,
      stops: matchingOrders.map((ord, idx) => ({
        stopIndex: idx + 1,
        orderId: ord._id,
        orderNumber: ord.orderNumber,
        recipientName: ord.deliveryAddress?.fullName || `Customer ${idx + 1}`,
        areaName: ord.deliveryAddress?.city || primaryMandal,
        street: ord.deliveryAddress?.street,
        pincode: ord.deliveryAddress?.postalCode,
        coordinates: ord.deliveryAddress?.coordinates || cleanZones[0].center,
        status: ord.orderStatus
      }))
    };

    await agent.save();

    // Link agent to all N zones inside warehouse.deliveryZones
    if (warehouse) {
      if (!warehouse.deliveryZones) warehouse.deliveryZones = [];
      cleanZones.forEach(z => {
        const zIndex = warehouse.deliveryZones.findIndex(wz => wz.zoneId === z.zoneId || (wz.mandal && wz.mandal.toLowerCase() === z.mandal.toLowerCase()));
        if (zIndex >= 0) {
          if (!warehouse.deliveryZones[zIndex].assignedAgentIds) warehouse.deliveryZones[zIndex].assignedAgentIds = [];
          if (!warehouse.deliveryZones[zIndex].assignedAgentIds.includes(agent._id)) {
            warehouse.deliveryZones[zIndex].assignedAgentIds.push(agent._id);
          }
        } else {
          warehouse.deliveryZones.push({
            ...z,
            assignedAgentIds: [agent._id]
          });
        }
      });
      await warehouse.save();

      // Emit real-time notification to warehouse fleet radar & agent
      emitToWarehouseFleet(warehouse._id, 'warehouse_zone_updated', {
        agentId: agent._id,
        zone: agent.assignedZone,
        route: agent.assignedRoute
      });
    }

    // Broadcast instant update to rider app (orders list & route map)
    if (agent.userId) {
      emitToUser(agent.userId, 'agent_zone_assigned', {
        zone: agent.assignedZone,
        route: agent.assignedRoute
      });
      emitToUser(agent.userId, 'route_updated', {
        zone: agent.assignedZone,
        route: agent.assignedRoute
      });
    }

    res.json({
      success: true,
      message: `✅ Rider ${agent.fullName} assigned to ${cleanZones.length} Mandal(s) (${allMandals.join(', ')})!`,
      assignedZone: agent.assignedZone,
      assignedZones: agent.assignedZones,
      preferredPincodes: agent.preferredPincodes,
      agent
    });
  } catch (error) {
    console.error('Error assigning rider to multiple mandal zones:', error);
    res.status(500).json({ success: false, message: 'Failed to assign mandal zones to rider' });
  }
};

// @desc    Get Order Demand & Volume by Mandal for Dynamic Territory Expansion
// @route   GET /api/warehouses/my-warehouse/mandal-demand
// @access  Private (Warehouse Manager)
export const getMandalOrderDemand = async (req, res) => {
  try {
    const unassignedOrders = await Order.find({
      orderStatus: { $in: [ORDER_STATUSES.PENDING, ORDER_STATUSES.SELLER_ACCEPTED, ORDER_STATUSES.DELIVERY_REQUESTED, 'AT_STORE'] },
      deliveryAgentId: null
    }).select('deliveryAddress items totalAmount orderNumber');

    const demandMap = {};
    unassignedOrders.forEach(ord => {
      const city = (ord.deliveryAddress?.city || 'Unassigned Sector').trim();
      const pin = (ord.deliveryAddress?.postalCode || '').trim();

      if (!demandMap[city]) {
        demandMap[city] = {
          mandal: city,
          orderCount: 0,
          pincodes: new Set(),
          totalValue: 0
        };
      }
      demandMap[city].orderCount += 1;
      if (pin) demandMap[city].pincodes.add(pin);
      demandMap[city].totalValue += ord.totalAmount || 0;
    });

    const mandalDemand = Object.values(demandMap).map(d => ({
      mandal: d.mandal,
      orderCount: d.orderCount,
      pincodes: Array.from(d.pincodes),
      totalValue: Math.round(d.totalValue)
    })).sort((a, b) => b.orderCount - a.orderCount);

    res.json({
      success: true,
      count: mandalDemand.length,
      mandalDemand
    });
  } catch (error) {
    console.error('Error fetching mandal order demand:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch mandal order demand' });
  }
};

// @desc    Auto-detect & Verify Mandals and Pincodes from Mouse-drawn Circle on Map
// @route   POST /api/warehouses/my-warehouse/detect-area-pincodes
// @access  Private (Warehouse Manager)
export const detectAreaPincodesAndMandal = async (req, res) => {
  try {
    const { center, radiusKm, lat, lng } = req.body;
    const targetLat = center?.lat !== undefined ? parseFloat(center.lat) : (lat !== undefined ? parseFloat(lat) : null);
    const targetLng = center?.lng !== undefined ? parseFloat(center.lng) : (lng !== undefined ? parseFloat(lng) : null);

    if (targetLat === null || targetLng === null || isNaN(targetLat) || isNaN(targetLng)) {
      return res.status(400).json({ success: false, message: 'Valid center coordinates (lat, lng) are required.' });
    }

    const clampedRadius = Math.min(Math.max(1, parseFloat(radiusKm) || 5.5), 100);
    const detected = detectTerritoryFromCircle(targetLat, targetLng, clampedRadius);

    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${targetLat}&lon=${targetLng}&addressdetails=1`,
        { headers: { 'User-Agent': 'SmartCart-Warehouse/1.0' }, signal: AbortSignal.timeout(3000) }
      );
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        const address = geoData.address || {};
        const realPin = address.postcode;
        const realMandal = address.subdistrict || address.county || address.village || address.town || address.city;

        if (realPin && /^\d{6}$/.test(realPin.trim())) {
          const pin = realPin.trim();
          if (!detected.autoVerifiedPincodes.includes(pin)) {
            detected.autoVerifiedPincodes.unshift(pin);
          }
        }
        if (realMandal && detected.primaryMandal === 'Guntur Urban' && targetLat > 16.32 && targetLng < 80.38) {
          detected.primaryMandal = realMandal;
          detected.zoneName = `${realMandal} Sector`;
        }
      }
    } catch (geoErr) {
      console.log('Live reverse-geocode fallback triggered:', geoErr.message);
    }

    res.json(detected);
  } catch (error) {
    console.error('Error detecting area pincodes:', error);
    res.status(500).json({ success: false, message: 'Failed to auto-verify area territory.' });
  }
};

// @desc    Check Delivery Serviceability & Maintenance Status for Customer Address / Pincode
// Helper: Resolve Warehouse & Mandal strictly for a target Pincode / Address
export const findServiceWarehouseForPincode = async (cleanPin, city = '', lat = null, lng = null) => {
  const allWarehouses = await Warehouse.find({});
  if (!allWarehouses || allWarehouses.length === 0) {
    return { warehouse: null, mandal: null };
  }

  let matchedWarehouse = null;
  let matchedMandal = null;

  if (cleanPin && String(cleanPin).trim().length >= 5) {
    const pin = String(cleanPin).trim();

    // 1. Direct match on Warehouse pincode or serviceArea / deliveryZones
    matchedWarehouse = allWarehouses.find(w =>
      w.pincode === pin ||
      w.serviceArea?.pincodes?.includes(pin) ||
      (w.deliveryZones && w.deliveryZones.some(z => z.pincodes && z.pincodes.includes(pin)))
    );

    // 2. Check active DeliveryAgents for assigned/preferred pincodes
    if (!matchedWarehouse) {
      const activeAgents = await DeliveryAgent.find({
        $or: [{ agentPincodes: pin }, { preferredPincodes: pin }]
      });
      if (activeAgents.length > 0 && activeAgents[0].assignedHub) {
        matchedWarehouse = allWarehouses.find(w =>
          w.name === activeAgents[0].assignedHub || w.city.toLowerCase() === activeAgents[0].assignedHub.toLowerCase()
        );
      }
    }

    // 3. Match via REGIONAL_MANDALS dataset
    if (!matchedWarehouse) {
      const regionalMandal = REGIONAL_MANDALS.find(m => m.pincodes && m.pincodes.includes(pin));
      if (regionalMandal) {
        matchedMandal = regionalMandal;
        const dName = regionalMandal.district.toLowerCase();
        matchedWarehouse = allWarehouses.find(w =>
          w.city.toLowerCase().includes(dName) ||
          w.name.toLowerCase().includes(dName) ||
          dName.includes(w.city.toLowerCase())
        );
      }
    }

    // 4. Match via standard regional postal prefix (50xxxx, 51xxxx, 52xxxx, 53xxxx)
    if (!matchedWarehouse && /^(50|51|52|53)\d{4}$/.test(pin)) {
      const prefix = pin.substring(0, 2);
      if (prefix === '52') {
        matchedWarehouse = allWarehouses.find(w => w.city === 'Guntur' || w.city === 'Vijayawada' || w.code === 'WH-AP-GNT01') || allWarehouses.find(w => w.state === 'Andhra Pradesh');
      } else if (prefix === '53') {
        matchedWarehouse = allWarehouses.find(w => w.city === 'Visakhapatnam' || w.code === 'WH-AP-VSKP01') || allWarehouses.find(w => w.state === 'Andhra Pradesh');
      } else if (prefix === '50') {
        matchedWarehouse = allWarehouses.find(w => w.city === 'Hyderabad' || w.code === 'WH-TS-HYD01') || allWarehouses.find(w => w.state === 'Telangana');
      } else if (prefix === '51') {
        matchedWarehouse = allWarehouses.find(w => w.city === 'Tirupati' || w.code === 'WH-AP-TPT01') || allWarehouses.find(w => w.state === 'Andhra Pradesh');
      }
    }
  }

  // Fallback to city match if pincode was not supplied or unmapped
  if (!matchedWarehouse && city) {
    const cleanCity = String(city).toLowerCase().trim();
    matchedWarehouse = allWarehouses.find(w =>
      w.city.toLowerCase().includes(cleanCity) || cleanCity.includes(w.city.toLowerCase())
    );
  }

  // Fallback to GPS coordinates if supplied
  if (!matchedWarehouse && lat && lng) {
    const targetLat = parseFloat(lat);
    const targetLng = parseFloat(lng);
    if (!isNaN(targetLat) && !isNaN(targetLng)) {
      let minDistance = Infinity;
      for (const w of allWarehouses) {
        const dist = calculateDistanceKm(targetLat, targetLng, w.location.lat, w.location.lng);
        if (dist < minDistance && dist <= 100) {
          minDistance = dist;
          matchedWarehouse = w;
        }
      }
    }
  }

  return { warehouse: matchedWarehouse, mandal: matchedMandal };
};

// @desc    Check Delivery Serviceability & Maintenance Status strictly by Pincode / Address
// @route   GET /api/warehouses/check-serviceability
// @access  Public
export const checkServiceability = async (req, res) => {
  try {
    const { pincode, city, lat, lng } = req.query;
    const cleanPin = String(pincode || '').trim();

    if (!cleanPin && !city && (!lat || !lng)) {
      return res.json({
        success: false,
        isServiceable: false,
        status: 'invalid',
        message: 'Please provide a valid 6-digit postal pincode to check delivery availability.'
      });
    }

    const { warehouse: matchedWarehouse, mandal } = await findServiceWarehouseForPincode(cleanPin, city, lat, lng);

    if (!matchedWarehouse) {
      return res.json({
        success: false,
        isServiceable: false,
        status: 'unserviceable',
        pincode: cleanPin,
        message: `❌ No delivery service available for pincode ${cleanPin || 'this location'}. We do not currently service this area.`
      });
    }

    // Check if matched warehouse status is 'maintenance' or 'inactive'
    if (matchedWarehouse.status === 'maintenance' || matchedWarehouse.status === 'inactive') {
      return res.json({
        success: false,
        isServiceable: false,
        status: 'maintenance',
        pincode: cleanPin,
        warehouseName: matchedWarehouse.name,
        warehouseCode: matchedWarehouse.code,
        message: `⚠️ Delivery Service Suspended. Delivery in pincode ${cleanPin || matchedWarehouse.pincode} is temporarily paused because the local warehouse hub (${matchedWarehouse.name}) is under maintenance.`
      });
    }

    return res.json({
      success: true,
      isServiceable: true,
      status: 'active',
      pincode: cleanPin || matchedWarehouse.pincode,
      mandal: mandal?.mandal || null,
      district: mandal?.district || matchedWarehouse.city,
      warehouseName: matchedWarehouse.name,
      warehouseCode: matchedWarehouse.code,
      warehouseCity: matchedWarehouse.city,
      estimatedTransitDays: '1-2 Days',
      message: `✅ Delivery Available! Delivered via ${matchedWarehouse.name} (${matchedWarehouse.city}).`
    });
  } catch (error) {
    console.error('Error checking serviceability:', error);
    res.status(500).json({ success: false, message: 'Server error checking address serviceability.' });
  }
};


