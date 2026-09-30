import { ReturnRequest } from '../models/ReturnRequest.js';
import { Order } from '../models/Order.js';
import { DeliveryAgent } from '../models/DeliveryAgent.js';
import { Warehouse } from '../models/Warehouse.js';
import { User } from '../models/User.js';

const RETURN_WINDOW_DAYS = 7;

// ==========================================
// 1. CUSTOMER PORTAL CONTROLLERS
// ==========================================

// @desc    Submit Return or Exchange Request for Delivered Order
// @route   POST /api/returns/request
// @access  Private (Customer)
export const createReturnOrExchange = async (req, res, next) => {
  try {
    const {
      orderId,
      type, // 'RETURN' or 'EXCHANGE'
      items,
      reasonCategory,
      reasonDetails,
      exchangePreference,
      refundPreference,
      pickupAddress
    } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Verify ownership
    if (order.customerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to request return for this order' });
    }

    // Verify order is delivered
    if (order.orderStatus !== 'DELIVERED' && order.orderStatus !== 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Return or Exchange can only be requested after the order has been delivered.'
      });
    }

    // Verify 7-day return window
    const deliveryDate = order.proofOfDelivery?.verifiedAt || order.updatedAt || order.createdAt;
    const daysSinceDelivery = (Date.now() - new Date(deliveryDate).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceDelivery > RETURN_WINDOW_DAYS) {
      return res.status(400).json({
        success: false,
        message: `The ${RETURN_WINDOW_DAYS}-day return window for this order expired on ${new Date(new Date(deliveryDate).getTime() + RETURN_WINDOW_DAYS * 86400000).toLocaleDateString('en-IN')}.`
      });
    }

    // Check if an active return request already exists
    const existing = await ReturnRequest.findOne({
      orderId: order._id,
      status: { $in: ['REQUESTED', 'ADMIN_APPROVED', 'PICKUP_ASSIGNED', 'PICKED_UP', 'WAREHOUSE_RECEIVED', 'QC_PASSED', 'REFUND_PENDING_APPROVAL'] }
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `A ${existing.type === 'RETURN' ? 'Return' : 'Exchange'} request (#${existing._id}) is already in progress for this order.`
      });
    }

    // Format items and calculate refund
    const returnItems = (items && items.length > 0)
      ? items
      : order.items.map(it => ({
          productId: it.productId,
          name: it.name,
          image: it.image || (it.productId?.images && it.productId.images[0]) || '',
          quantity: it.quantity,
          price: it.price,
          reason: reasonCategory || 'DEFECTIVE_DAMAGED'
        }));

    const totalRefund = returnItems.reduce((acc, it) => acc + (Number(it.price) * Number(it.quantity || 1)), 0);

    // Schedule courier pickup for 2 business days out
    const pickupDate = new Date();
    pickupDate.setDate(pickupDate.getDate() + 2);

    const returnReq = await ReturnRequest.create({
      orderId: order._id,
      orderNumber: order.orderNumber,
      customerId: req.user._id,
      sellerId: order.sellerId,
      type: type === 'EXCHANGE' ? 'EXCHANGE' : 'RETURN',
      items: returnItems,
      reasonCategory: reasonCategory || 'DEFECTIVE_DAMAGED',
      reasonDetails: reasonDetails || '',
      exchangePreference: exchangePreference || {},
      refundPreference: refundPreference || 'ORIGINAL_PAYMENT',
      estimatedRefundAmount: totalRefund,
      pickupAddress: pickupAddress || {
        fullName: order.deliveryAddress.fullName,
        phone: order.deliveryAddress.phone,
        street: order.deliveryAddress.street,
        city: order.deliveryAddress.city,
        state: order.deliveryAddress.state,
        postalCode: order.deliveryAddress.postalCode
      },
      status: 'REQUESTED',
      scheduledPickupDate: pickupDate,
      timeline: [{
        status: 'REQUESTED',
        timestamp: new Date(),
        note: `Customer initiated ${type === 'EXCHANGE' ? 'Exchange' : 'Return'} request. Awaiting Admin review and Hub dispatch.`,
        updatedBy: req.user.name || 'Customer'
      }]
    });

    // Update order status
    order.returnRequest = returnReq._id;
    order.returnStatus = type === 'EXCHANGE' ? 'EXCHANGE_REQUESTED' : 'RETURN_REQUESTED';
    order.timeline.push({
      status: order.returnStatus,
      timestamp: new Date(),
      note: `Customer requested ${type === 'EXCHANGE' ? 'Exchange for replacement' : 'Return for refund'} (Request ID: ${returnReq._id})`,
      updatedBy: req.user.name || 'Customer'
    });
    await order.save();

    res.status(201).json({
      success: true,
      message: `${type === 'EXCHANGE' ? 'Exchange' : 'Return'} request submitted successfully! Admin will review and dispatch courier pickup.`,
      returnRequest: returnReq
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Return/Exchange Request for a specific Order
// @route   GET /api/returns/order/:orderId
// @access  Private (Customer / Admin)
export const getOrderReturnRequest = async (req, res, next) => {
  try {
    const returnReq = await ReturnRequest.findOne({ orderId: req.params.orderId })
      .populate('destinationWarehouseId', 'name city state address pincode')
      .populate('assignedDeliveryAgentId', 'fullName phone vehicleType vehicleNumber')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      returnRequest: returnReq || null
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all Return/Exchange Requests for logged-in Customer
// @route   GET /api/returns/my-returns
// @access  Private (Customer)
export const getCustomerReturns = async (req, res, next) => {
  try {
    const returns = await ReturnRequest.find({ customerId: req.user._id })
      .populate('orderId', 'orderNumber totalAmount paymentMethod createdAt')
      .populate('destinationWarehouseId', 'name city state address')
      .populate('assignedDeliveryAgentId', 'fullName phone vehicleNumber')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: returns.length,
      returns
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel an open Return/Exchange Request
// @route   PUT /api/returns/:id/cancel
// @access  Private (Customer)
export const cancelReturnRequest = async (req, res, next) => {
  try {
    const returnReq = await ReturnRequest.findById(req.params.id);
    if (!returnReq) {
      return res.status(404).json({ success: false, message: 'Return request not found' });
    }

    if (returnReq.customerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this request' });
    }

    if (!['REQUESTED', 'ADMIN_APPROVED', 'PICKUP_ASSIGNED'].includes(returnReq.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel return request in status: ${returnReq.status}. Parcel has already been picked up or processed.`
      });
    }

    returnReq.status = 'CANCELLED';
    returnReq.timeline.push({
      status: 'CANCELLED',
      timestamp: new Date(),
      note: 'Customer chose to retain the item and cancelled the request.',
      updatedBy: req.user.name || 'Customer'
    });
    await returnReq.save();

    // Update Order
    await Order.findByIdAndUpdate(returnReq.orderId, {
      returnStatus: 'RETURN_CANCELLED',
      $push: {
        timeline: {
          status: 'RETURN_CANCELLED',
          timestamp: new Date(),
          note: 'Customer cancelled the return/exchange request.',
          updatedBy: req.user.name || 'Customer'
        }
      }
    });

    res.json({
      success: true,
      message: 'Return request cancelled successfully. You can continue enjoying your product!',
      returnRequest: returnReq
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 2. ADMIN PORTAL CONTROLLERS
// ==========================================

// @desc    Admin: Get all returns across the platform with filtering
// @route   GET /api/returns/admin/all
// @access  Private (Admin)
export const getAllAdminReturns = async (req, res, next) => {
  try {
    const { status, type, search } = req.query;
    const filter = {};

    if (status && status !== 'ALL') {
      filter.status = status;
    }
    if (type && type !== 'ALL') {
      filter.type = type;
    }
    if (search) {
      filter.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'pickupAddress.fullName': { $regex: search, $options: 'i' } },
        { 'pickupAddress.phone': { $regex: search, $options: 'i' } },
        { 'items.name': { $regex: search, $options: 'i' } }
      ];
    }

    const returns = await ReturnRequest.find(filter)
      .populate('customerId', 'name email phone avatar')
      .populate('orderId', 'orderNumber totalAmount paymentMethod createdAt orderStatus')
      .populate('destinationWarehouseId', 'name code city state pincode manager')
      .populate('assignedDeliveryAgentId', 'fullName phone vehicleType vehicleNumber isOnline')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: returns.length,
      returns
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Accept Return, Assign Destination Warehouse & Pickup Delivery Agent
// @route   PUT /api/returns/admin/:id/approve-and-dispatch
// @access  Private (Admin)
export const adminApproveAndDispatchReturn = async (req, res, next) => {
  try {
    const { destinationWarehouseId, assignedDeliveryAgentId, adminNotes } = req.body;

    const returnReq = await ReturnRequest.findById(req.params.id);
    if (!returnReq) {
      return res.status(404).json({ success: false, message: 'Return request not found' });
    }

    if (returnReq.status !== 'REQUESTED') {
      return res.status(400).json({
        success: false,
        message: `Return request is in '${returnReq.status}' status and cannot be approved again.`
      });
    }

    // Validate Warehouse
    let warehouse = null;
    if (destinationWarehouseId) {
      warehouse = await Warehouse.findById(destinationWarehouseId);
    }
    if (!warehouse) {
      // Pick first active warehouse as fallback if none provided
      warehouse = await Warehouse.findOne({ status: 'active' }) || await Warehouse.findOne();
    }

    // Validate Delivery Agent
    let agent = null;
    if (assignedDeliveryAgentId) {
      agent = await DeliveryAgent.findById(assignedDeliveryAgentId);
    }
    if (!agent) {
      // Pick active approved delivery agent
      agent = await DeliveryAgent.findOne({ isApproved: true }) || await DeliveryAgent.findOne();
    }

    returnReq.destinationWarehouseId = warehouse ? warehouse._id : null;
    returnReq.assignedDeliveryAgentId = agent ? agent._id : null;

    returnReq.adminApproval = {
      isApproved: true,
      approvedBy: req.user.name || 'System Admin',
      approvedAt: new Date(),
      adminNotes: adminNotes || 'Return approved by Admin. Dispatched to regional Hub & courier agent for doorstep pickup.'
    };

    returnReq.status = 'ADMIN_APPROVED';
    returnReq.timeline.push({
      status: 'ADMIN_APPROVED',
      timestamp: new Date(),
      note: `Admin approved return. Assigned to Hub [${warehouse?.name || 'Central Warehouse'}] and Delivery Agent [${agent?.fullName || 'Assigned Courier'}].`,
      updatedBy: req.user.name || 'Admin'
    });

    await returnReq.save();

    // Update order timeline
    await Order.findByIdAndUpdate(returnReq.orderId, {
      returnStatus: 'RETURN_IN_PROGRESS',
      $push: {
        timeline: {
          status: 'RETURN_APPROVED_BY_ADMIN',
          timestamp: new Date(),
          note: `Admin accepted return request. Dispatched to Hub [${warehouse?.name || 'Hub'}] & Agent [${agent?.fullName || 'Courier'}].`,
          updatedBy: req.user.name || 'Admin'
        }
      }
    });

    const populated = await ReturnRequest.findById(returnReq._id)
      .populate('customerId', 'name email phone')
      .populate('destinationWarehouseId', 'name city code')
      .populate('assignedDeliveryAgentId', 'fullName phone vehicleNumber');

    res.json({
      success: true,
      message: `Return #${returnReq._id} accepted by Admin and dispatched to Hub (${warehouse?.name}) & Delivery Agent (${agent?.fullName})!`,
      returnRequest: populated
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Reject Return Request
// @route   PUT /api/returns/admin/:id/reject
// @access  Private (Admin)
export const adminRejectReturn = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const returnReq = await ReturnRequest.findById(req.params.id);
    if (!returnReq) {
      return res.status(404).json({ success: false, message: 'Return request not found' });
    }

    returnReq.status = 'REJECTED';
    returnReq.timeline.push({
      status: 'REJECTED',
      timestamp: new Date(),
      note: `Return request rejected by Admin. Reason: ${reason || 'Does not comply with return criteria.'}`,
      updatedBy: req.user.name || 'Admin'
    });
    await returnReq.save();

    await Order.findByIdAndUpdate(returnReq.orderId, {
      returnStatus: 'RETURN_REJECTED',
      $push: {
        timeline: {
          status: 'RETURN_REJECTED',
          timestamp: new Date(),
          note: `Admin rejected return request: ${reason || 'Ineligible'}`,
          updatedBy: req.user.name || 'Admin'
        }
      }
    });

    res.json({
      success: true,
      message: 'Return request rejected.',
      returnRequest: returnReq
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 3. DELIVERY AGENT PORTAL CONTROLLERS
// ==========================================

// @desc    Delivery Agent: Get assigned Doorstep Return Pickups
// @route   GET /api/returns/delivery/my-pickups
// @access  Private (Delivery Agent / Admin)
export const getDeliveryAgentReturnPickups = async (req, res, next) => {
  try {
    let agentFilter = {};

    if (req.user.role === 'delivery') {
      const agent = await DeliveryAgent.findOne({ userId: req.user._id });
      if (agent) {
        agentFilter = { assignedDeliveryAgentId: agent._id };
      }
    }

    const pickups = await ReturnRequest.find({
      ...agentFilter,
      status: { $in: ['ADMIN_APPROVED', 'PICKUP_ASSIGNED', 'PICKED_UP'] }
    })
      .populate('customerId', 'name phone email avatar')
      .populate('orderId', 'orderNumber totalAmount paymentMethod')
      .populate('destinationWarehouseId', 'name city address pincode')
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      count: pickups.length,
      pickups
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delivery Agent: Confirm Doorstep Return Pickup (Barcode scan / physical collection)
// @route   PUT /api/returns/delivery/:id/pickup-confirm
// @access  Private (Delivery Agent / Admin)
export const deliveryAgentConfirmPickup = async (req, res, next) => {
  try {
    const { barcodeScanned, pickupProofNotes } = req.body;

    const returnReq = await ReturnRequest.findById(req.params.id);
    if (!returnReq) {
      return res.status(404).json({ success: false, message: 'Return request not found' });
    }

    if (!['ADMIN_APPROVED', 'PICKUP_ASSIGNED'].includes(returnReq.status)) {
      return res.status(400).json({
        success: false,
        message: `Parcel cannot be picked up in status '${returnReq.status}'.`
      });
    }

    returnReq.agentPickup = {
      isPickedUp: true,
      pickedUpAt: new Date(),
      barcodeScanned: barcodeScanned || `RET-SCAN-${Date.now()}`,
      pickupProofNotes: pickupProofNotes || 'Parcel safely collected from customer doorstep with original packaging.'
    };

    returnReq.status = 'PICKED_UP';
    returnReq.timeline.push({
      status: 'PICKED_UP',
      timestamp: new Date(),
      note: `Delivery Agent completed doorstep pickup. Barcode verified: [${returnReq.agentPickup.barcodeScanned}]. En route to Hub for QC inspection.`,
      updatedBy: req.user.name || 'Delivery Agent'
    });

    await returnReq.save();

    // Update order timeline
    await Order.findByIdAndUpdate(returnReq.orderId, {
      $push: {
        timeline: {
          status: 'RETURN_PARCEL_PICKED_UP',
          timestamp: new Date(),
          note: 'Return parcel picked up from customer doorstep by courier agent.',
          updatedBy: req.user.name || 'Delivery Agent'
        }
      }
    });

    res.json({
      success: true,
      message: 'Doorstep pickup verified successfully! Parcel marked en route to Warehouse Hub.',
      returnRequest: returnReq
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 4. WAREHOUSE HUB CONTROLLERS
// ==========================================

// @desc    Warehouse: Get returned packages arriving or requiring QC verification
// @route   GET /api/returns/warehouse/pending-qc
// @access  Private (Warehouse Manager / Admin)
export const getWarehouseReturnPackages = async (req, res, next) => {
  try {
    let filter = {
      status: { $in: ['PICKED_UP', 'WAREHOUSE_RECEIVED', 'QC_PASSED', 'QC_FAILED', 'REFUND_PENDING_APPROVAL', 'REFUND_DISBURSED'] }
    };

    // If warehouse manager, limit to their facility if assigned
    if (req.user.role === 'warehouse_manager' && req.user.warehouseId) {
      filter.destinationWarehouseId = req.user.warehouseId;
    }

    const packages = await ReturnRequest.find(filter)
      .populate('customerId', 'name phone email')
      .populate('orderId', 'orderNumber totalAmount paymentMethod')
      .populate('assignedDeliveryAgentId', 'fullName phone vehicleNumber')
      .populate('destinationWarehouseId', 'name code city address')
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      count: packages.length,
      packages
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Warehouse: QC Inspect Product and send Payment Release Request to Payment Admin
// @route   PUT /api/returns/warehouse/:id/qc-verify
// @access  Private (Warehouse Manager / Admin)
export const warehouseQCVerifyAndSendPaymentRequest = async (req, res, next) => {
  try {
    const { conditionRating, passed, qcNotes } = req.body;

    const returnReq = await ReturnRequest.findById(req.params.id);
    if (!returnReq) {
      return res.status(404).json({ success: false, message: 'Return request not found' });
    }

    if (!['PICKED_UP', 'WAREHOUSE_RECEIVED'].includes(returnReq.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot conduct QC on return in status '${returnReq.status}'. Product must be picked up first.`
      });
    }

    const isPassed = Boolean(passed);

    returnReq.warehouseQC = {
      isInspected: true,
      passed: isPassed,
      inspectedBy: req.user.name || 'Warehouse QC Inspector',
      inspectedAt: new Date(),
      conditionRating: conditionRating || (isPassed ? 'PRISTINE_TAGS_INTACT' : 'DAMAGED_REJECTED'),
      qcNotes: qcNotes || (isPassed ? 'Product unboxed, verified all tags intact and condition pristine.' : 'Item showed signs of heavy damage or missing tags.'),
      paymentRequestSent: isPassed,
      paymentRequestSentAt: isPassed ? new Date() : null
    };

    if (isPassed) {
      returnReq.status = 'REFUND_PENDING_APPROVAL';
      returnReq.timeline.push({
        status: 'REFUND_PENDING_APPROVAL',
        timestamp: new Date(),
        note: `Warehouse QC PASSED (${returnReq.warehouseQC.conditionRating}). Verification complete: Formal payment release request submitted to Payment Admin.`,
        updatedBy: req.user.name || 'Warehouse Manager'
      });
    } else {
      returnReq.status = 'QC_FAILED';
      returnReq.timeline.push({
        status: 'QC_FAILED',
        timestamp: new Date(),
        note: `Warehouse QC REJECTED: ${returnReq.warehouseQC.qcNotes}. Refund claim disqualified.`,
        updatedBy: req.user.name || 'Warehouse Manager'
      });
    }

    await returnReq.save();

    // Update order timeline
    await Order.findByIdAndUpdate(returnReq.orderId, {
      $push: {
        timeline: {
          status: isPassed ? 'RETURN_QC_PASSED' : 'RETURN_QC_FAILED',
          timestamp: new Date(),
          note: isPassed
            ? 'Returned item inspected at Warehouse Hub and verified. Payment authorization request sent to Treasury/Payment Admin.'
            : 'Returned item failed Warehouse QC inspection.',
          updatedBy: req.user.name || 'Warehouse'
        }
      }
    });

    res.json({
      success: true,
      message: isPassed
        ? 'Product successfully checked and verified! Payment release request sent to Payment Admin.'
        : 'QC inspection failed. Return marked as QC_FAILED.',
      returnRequest: returnReq
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 5. PAYMENT ADMIN / TREASURY CONTROLLERS
// ==========================================

// @desc    Payment Admin: Get QC-Verified Returns Pending Payment Release
// @route   GET /api/returns/payments/pending-refunds
// @access  Private (Payment Admin / Finance)
export const getPendingRefundReturnsForPayments = async (req, res, next) => {
  try {
    const returns = await ReturnRequest.find({
      'warehouseQC.passed': true,
      'warehouseQC.paymentRequestSent': true,
      'paymentApproval.isDisbursed': { $ne: true },
      status: { $in: ['REFUND_PENDING_APPROVAL', 'QC_PASSED'] }
    })
      .populate('customerId', 'name email phone avatar walletBalance')
      .populate('orderId', 'orderNumber totalAmount paymentMethod paymentStatus')
      .populate('destinationWarehouseId', 'name city')
      .sort({ 'warehouseQC.paymentRequestSentAt': -1 });

    res.json({
      success: true,
      count: returns.length,
      returns
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Payment Admin: Approve & Disburse Customer Refund
// @route   PUT /api/returns/payments/:id/disburse-refund
// @access  Private (Payment Admin / Finance)
export const paymentAdminDisburseRefund = async (req, res, next) => {
  try {
    const { payoutDestination, paymentAdminNotes, amountDisbursed } = req.body;

    const returnReq = await ReturnRequest.findById(req.params.id)
      .populate('customerId', 'name email phone walletBalance')
      .populate('orderId');

    if (!returnReq) {
      return res.status(404).json({ success: false, message: 'Return request not found' });
    }

    // STRICT CHECK: Payment is ONLY released AFTER taking product and checking in warehouse
    if (!returnReq.warehouseQC?.isInspected || !returnReq.warehouseQC?.passed) {
      return res.status(400).json({
        success: false,
        message: 'STRICT PAYMENT POLICY: Payment can ONLY be released after the product is received and verified by the Warehouse QC team.'
      });
    }

    if (returnReq.paymentApproval?.isDisbursed || returnReq.status === 'REFUND_DISBURSED') {
      return res.status(400).json({
        success: false,
        message: 'Refund has already been disbursed for this return request.'
      });
    }

    const finalRefundAmount = Number(amountDisbursed) || Number(returnReq.estimatedRefundAmount) || Number(returnReq.orderId?.totalAmount) || 0;
    const destination = payoutDestination || returnReq.refundPreference || 'WALLET';
    const txnRef = `REF-TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // If WALLET, credit customer wallet balance directly
    if (destination === 'WALLET' && returnReq.customerId) {
      await User.findByIdAndUpdate(returnReq.customerId._id, {
        $inc: { walletBalance: finalRefundAmount }
      });
    }

    returnReq.paymentApproval = {
      isDisbursed: true,
      disbursedAt: new Date(),
      disbursedBy: req.user.name || 'Payment Admin',
      amountDisbursed: finalRefundAmount,
      payoutDestination: destination,
      transactionRef: txnRef,
      paymentAdminNotes: paymentAdminNotes || `Refund of ₹${finalRefundAmount} accepted and disbursed via ${destination}.`
    };

    returnReq.status = 'REFUND_DISBURSED';
    returnReq.timeline.push({
      status: 'REFUND_DISBURSED',
      timestamp: new Date(),
      note: `Payment Admin authorized and disbursed ₹${finalRefundAmount} via [${destination}]. Ref: ${txnRef}.`,
      updatedBy: req.user.name || 'Payment Admin'
    });

    await returnReq.save();

    // Update order status to REFUNDED
    if (returnReq.orderId) {
      await Order.findByIdAndUpdate(returnReq.orderId._id, {
        paymentStatus: 'REFUNDED',
        returnStatus: 'RETURN_REFUNDED',
        $push: {
          timeline: {
            status: 'REFUND_COMPLETED',
            timestamp: new Date(),
            note: `Refund of ₹${finalRefundAmount} disbursed by Payment Admin. Transaction Ref: ${txnRef}.`,
            updatedBy: req.user.name || 'Payment Admin'
          }
        }
      });
    }

    res.json({
      success: true,
      message: `Refund of ₹${finalRefundAmount} accepted and disbursed successfully! (Transaction: ${txnRef})`,
      returnRequest: returnReq
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send Payment Disbursal Request to Payment Admin (Port 3005)
// @route   PUT /api/returns/:id/send-payment-request
// @access  Private (Admin/Support Worker)
export const sendReturnPaymentRequestToAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { refundAmount, payoutDestination, paymentAdminNotes, customerInstructions, warehouseQcNotes } = req.body;

    let returnReq = await ReturnRequest.findById(id);

    if (!returnReq) {
      // Try finding by orderId
      returnReq = await ReturnRequest.findOne({ orderId: id });
    }

    if (!returnReq) {
      // Create return request for the order if it exists
      const order = await Order.findById(id);
      if (!order) {
        return res.status(404).json({ success: false, message: 'Return request or Order not found.' });
      }

      returnReq = await ReturnRequest.create({
        orderId: order._id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        sellerId: order.sellerId,
        type: 'RETURN',
        items: order.items.map(it => ({
          productId: it.productId,
          name: it.name,
          quantity: it.quantity,
          price: it.price,
          reason: 'DEFECTIVE_DAMAGED'
        })),
        reasonCategory: 'DEFECTIVE_DAMAGED',
        reasonDetails: customerInstructions || 'Escalated by Support Officer for direct payment disbursal.',
        refundPreference: payoutDestination || 'ORIGINAL_PAYMENT',
        estimatedRefundAmount: Number(refundAmount) || Number(order.totalAmount) || 0,
        status: 'REFUND_PENDING_APPROVAL',
        pickupAddress: order.deliveryAddress,
        timeline: []
      });

      order.returnRequest = returnReq._id;
      order.returnStatus = 'RETURN_REQUESTED';
      await order.save();
    }

    // Update QC and Payout Request flags
    returnReq.warehouseQC = {
      ...returnReq.warehouseQC,
      isInspected: true,
      passed: true,
      qcNotes: warehouseQcNotes || returnReq.warehouseQC?.qcNotes || 'QC verified by Support/Admin team.',
      paymentRequestSent: true,
      paymentRequestSentAt: new Date(),
      inspectedAt: returnReq.warehouseQC?.inspectedAt || new Date(),
      inspectedBy: req.user?.name || 'Support/Admin Officer'
    };

    if (payoutDestination) {
      returnReq.refundPreference = payoutDestination;
    }
    if (refundAmount) {
      returnReq.estimatedRefundAmount = Number(refundAmount);
    }

    returnReq.status = 'REFUND_PENDING_APPROVAL';
    returnReq.timeline.push({
      status: 'REFUND_PENDING_APPROVAL',
      timestamp: new Date(),
      note: paymentAdminNotes || `Officer dispatched formal refund request (₹${returnReq.estimatedRefundAmount} via ${returnReq.refundPreference}) to Payment Admin (Port 3005).`,
      updatedBy: req.user?.name || 'Support/Admin Officer'
    });

    await returnReq.save();

    if (returnReq.orderId) {
      await Order.findByIdAndUpdate(returnReq.orderId, {
        returnStatus: 'REFUND_PENDING_APPROVAL',
        $push: {
          timeline: {
            status: 'REFUND_PENDING_APPROVAL',
            timestamp: new Date(),
            note: `Refund request dispatched to Payment Admin by ${req.user?.name || 'Officer'}. Amount: ₹${returnReq.estimatedRefundAmount}`,
            updatedBy: req.user?.name || 'Support/Admin Officer'
          }
        }
      });
    }

    res.json({
      success: true,
      message: `Refund request for ₹${returnReq.estimatedRefundAmount} successfully dispatched to Payment Admin (Port 3005)!`,
      returnRequest: returnReq
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Return Request Instructions & Data (Reason, Pickup, QC Notes, Instructions)
// @route   PUT /api/returns/:id/update-instructions-data
// @access  Private (Admin/Support Worker)
export const updateReturnInstructionsAndData = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      reasonCategory,
      reasonDetails,
      customerInstructions,
      courierNotes,
      warehouseQcNotes,
      pickupAddress,
      refundPreference,
      estimatedRefundAmount
    } = req.body;

    let returnReq = await ReturnRequest.findById(id);
    if (!returnReq) {
      returnReq = await ReturnRequest.findOne({ orderId: id });
    }

    if (!returnReq) {
      return res.status(404).json({ success: false, message: 'Return Request not found' });
    }

    if (reasonCategory) returnReq.reasonCategory = reasonCategory;
    if (reasonDetails !== undefined) returnReq.reasonDetails = reasonDetails;
    if (refundPreference) returnReq.refundPreference = refundPreference;
    if (estimatedRefundAmount !== undefined) returnReq.estimatedRefundAmount = Number(estimatedRefundAmount);

    if (customerInstructions !== undefined) {
      returnReq.customerInstructions = customerInstructions;
    }
    if (courierNotes !== undefined) {
      returnReq.courierNotes = courierNotes;
    }
    if (pickupAddress) {
      returnReq.pickupAddress = {
        ...returnReq.pickupAddress,
        ...pickupAddress
      };
    }
    if (warehouseQcNotes !== undefined) {
      returnReq.warehouseQC = {
        ...returnReq.warehouseQC,
        qcNotes: warehouseQcNotes
      };
    }

    returnReq.timeline.push({
      status: returnReq.status,
      timestamp: new Date(),
      note: `Return Request details & instructions updated by ${req.user?.name || 'Officer'}.`,
      updatedBy: req.user?.name || 'Support/Admin Officer'
    });

    await returnReq.save();

    res.json({
      success: true,
      message: 'Return Request instructions and data updated successfully!',
      returnRequest: returnReq
    });
  } catch (error) {
    next(error);
  }
};

