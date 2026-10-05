import { Order } from '../models/Order.js';
import { Seller } from '../models/Seller.js';
import { User } from '../models/User.js';
import { OrderChat } from '../models/OrderChat.js';
import { getSocketIO, emitToUser } from '../services/socketService.js';
import { createNotification } from './notificationController.js';

// Anti-Fraud Link & Redirect Filter
export const containsProhibitedLinks = (text) => {
  if (!text || typeof text !== 'string') return false;
  const linkRegex = /(https?:\/\/|www\.[^\s]+|[a-zA-Z0-9-]+\.(com|in|org|net|co|io|biz|xyz|app|me|info|gov|edu)[^\s]*|wa\.me|t\.me|telegram\.me|bit\.ly|tinyurl|\b\d{10,}\b|\+?\d{1,3}[-.\s]?\d{10})/i;
  return linkRegex.test(text);
};

// Calculate 7-Day Rule and Exchange Window Status
export const calculateOrderChatStatus = (order, chat) => {
  const isDelivered = order.orderStatus === 'DELIVERED';

  if (!isDelivered) {
    return {
      isActive: true,
      isExpired: false,
      stage: 'PRE_DELIVERY',
      statusLabel: 'Order In Fulfillment',
      expiresAt: null,
      daysRemaining: null,
      hoursRemaining: null,
      totalWindowDays: null,
      isExchangeOrReturn: false,
      canRequestExchange: false,
      message: 'Chat is active for order fulfillment and delivery coordination.'
    };
  }

  // Delivery timestamp
  const deliveredAt = order.proofOfDelivery?.verifiedAt || order.deliveredAt || order.updatedAt || new Date();
  const deliveryTime = new Date(deliveredAt).getTime();

  // Exchange or Return Extension Rule:
  // Standard window is 7 days. If customer or seller initiated exchange/return, grant 7 additional days (total 14 days post-delivery)
  const isExchangeOrReturn = Boolean(
    chat?.exchangeExtensionGranted ||
    order.returnStatus === 'EXCHANGE_REQUESTED' ||
    order.returnStatus === 'RETURN_REQUESTED' ||
    order.returnStatus === 'EXCHANGE_APPROVED' ||
    order.returnStatus === 'RETURN_APPROVED'
  );

  const totalWindowDays = isExchangeOrReturn ? 14 : 7;
  const windowMs = totalWindowDays * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(deliveryTime + windowMs);
  const now = Date.now();
  const msRemaining = expiresAt.getTime() - now;
  const isExpired = msRemaining <= 0;

  if (isExpired) {
    return {
      isActive: false,
      isExpired: true,
      stage: 'EXPIRED',
      statusLabel: 'Chat Disabled (Window Expired)',
      expiresAt,
      daysRemaining: 0,
      hoursRemaining: 0,
      totalWindowDays,
      isExchangeOrReturn,
      canRequestExchange: false,
      message: `Chat closed: The ${totalWindowDays}-day post-delivery service window for this order has expired. In accordance with platform return policy, communication is automatically disabled.`
    };
  }

  const daysRemaining = Math.max(1, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
  const hoursRemaining = Math.max(1, Math.ceil(msRemaining / (60 * 60 * 1000)));

  return {
    isActive: true,
    isExpired: false,
    stage: 'POST_DELIVERY_ACTIVE',
    statusLabel: `${daysRemaining} Day${daysRemaining > 1 ? 's' : ''} Remaining (${hoursRemaining}h)`,
    expiresAt,
    daysRemaining,
    hoursRemaining,
    totalWindowDays,
    isExchangeOrReturn,
    canRequestExchange: !isExchangeOrReturn,
    message: isExchangeOrReturn
      ? `Exchange window active: 7 additional days granted for return/replacement coordination.`
      : `Post-delivery support active: ${daysRemaining} day(s) remaining for return/exchange inquiries.`
  };
};

// @desc    Get or initialize order chat
// @route   GET /api/orders/:id/chat
// @access  Customer, Seller, Admin
export const getOrderChat = async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId).populate('sellerId');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Determine user role and check access
    const userId = req.user._id.toString();
    const userRole = req.user.role;
    let sellerDoc = null;

    if (userRole === 'seller') {
      sellerDoc = await Seller.findOne({ userId: req.user._id });
      if (!sellerDoc) {
        return res.status(403).json({ success: false, message: 'Merchant profile not found' });
      }
      const isSellerOfOrder = order.sellerId?._id?.toString() === sellerDoc._id.toString() ||
        order.items?.some(i => i.sellerId?.toString() === sellerDoc._id.toString());
      if (!isSellerOfOrder && userRole !== 'admin') {
        return res.status(403).json({ success: false, message: 'Unauthorized access to this order chat' });
      }
    } else if (userRole === 'customer') {
      if (order.customerId.toString() !== userId && userRole !== 'admin') {
        return res.status(403).json({ success: false, message: 'Unauthorized access to this order chat' });
      }
    } else if (userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized access to order chat' });
    }

    // Find or create Chat
    let chat = await OrderChat.findOne({ orderId: order._id });
    if (!chat) {
      const effectiveSellerId = order.sellerId?._id || order.items[0]?.sellerId || (sellerDoc?._id);
      chat = await OrderChat.create({
        orderId: order._id,
        sellerId: effectiveSellerId,
        customerId: order.customerId,
        messages: [{
          senderId: order.customerId,
          senderRole: 'system',
          senderName: 'NovaKart Order Support',
          message: `💬 Order Chat Room initialized for Order #${order.orderNumber}. Plain-text customer support active. External links and phone numbers are prohibited.`,
          timestamp: new Date()
        }]
      });
    }

    const chatStatus = calculateOrderChatStatus(order, chat);

    // Fetch counterparty details
    const customer = await User.findById(order.customerId).select('name email phone');
    const seller = order.sellerId || (await Seller.findById(chat.sellerId));

    res.json({
      success: true,
      chat,
      chatStatus,
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        returnStatus: order.returnStatus,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        items: order.items
      },
      counterparty: {
        customer: customer ? { name: customer.name, email: customer.email } : null,
        seller: seller ? { storeName: seller.storeName, ownerName: seller.ownerName } : null
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send plain-text message in order chat
// @route   POST /api/orders/:id/chat
// @access  Customer, Seller, Admin
export const sendOrderChatMessage = async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message content cannot be empty.' });
    }

    // ANTI-FRAUD SECURITY LINK FILTER
    if (containsProhibitedLinks(message)) {
      return res.status(400).json({
        success: false,
        message: '⚠️ Security Policy Violation: Sharing links, redirection URLs, websites, and external contact numbers is strictly prohibited. Only plain text customer service is permitted.'
      });
    }

    const order = await Order.findById(orderId).populate('sellerId');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    let chat = await OrderChat.findOne({ orderId: order._id });
    if (!chat) {
      const effectiveSellerId = order.sellerId?._id || order.items[0]?.sellerId;
      chat = await OrderChat.create({
        orderId: order._id,
        sellerId: effectiveSellerId,
        customerId: order.customerId,
        messages: []
      });
    }

    // Verify 7-Day Window Rule
    const chatStatus = calculateOrderChatStatus(order, chat);
    if (chatStatus.isExpired) {
      return res.status(403).json({
        success: false,
        message: `Chat Disabled: The ${chatStatus.totalWindowDays}-day post-delivery service window for this order has expired. Further communication is closed.`
      });
    }

    // Identify Sender Role
    const userId = req.user._id.toString();
    let senderRole = 'customer';
    let senderName = req.user.name || 'Customer';

    if (req.user.role === 'seller') {
      senderRole = 'seller';
      const s = await Seller.findOne({ userId: req.user._id });
      senderName = s?.storeName || req.user.name || 'Store Merchant';
    } else if (req.user.role === 'admin') {
      senderRole = 'system';
      senderName = 'Platform Administrator';
    }

    const newMsg = {
      senderId: req.user._id,
      senderRole,
      senderName,
      message: message.trim(),
      timestamp: new Date()
    };

    chat.messages.push(newMsg);
    chat.lastMessageAt = new Date();
    await chat.save();

    // Real-Time Socket Broadcast
    const io = getSocketIO();
    if (io) {
      io.to(`order_${order._id}`).emit('new_order_chat_message', {
        orderId: order._id,
        message: newMsg,
        chatStatus
      });
    }

    // Notifications to counterparty
    if (senderRole === 'seller') {
      emitToUser(order.customerId, 'order_chat_notification', {
        title: `💬 New Message from ${senderName}`,
        message: `Merchant sent a message regarding Order #${order.orderNumber}`,
        orderId: order._id
      });
      createNotification({
        recipientId: order.customerId,
        role: 'customer',
        title: `💬 Message from ${senderName}`,
        message: `${senderName}: ${message.trim().slice(0, 80)}`,
        type: 'ORDER_UPDATE',
        link: `/orders`
      });
    } else if (senderRole === 'customer') {
      const seller = await Seller.findById(chat.sellerId);
      if (seller) {
        emitToUser(seller.userId, 'order_chat_notification', {
          title: `💬 New Customer Message on #${order.orderNumber}`,
          message: `${senderName}: ${message.trim().slice(0, 80)}`,
          orderId: order._id
        });
        createNotification({
          recipientId: seller.userId,
          role: 'seller',
          title: `💬 Message for Order #${order.orderNumber}`,
          message: `${senderName}: ${message.trim().slice(0, 80)}`,
          type: 'ORDER_UPDATE',
          link: `/orders`
        });
      }
    }

    res.json({
      success: true,
      message: newMsg,
      chatStatus
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Grant 7 additional days for exchange/return coordination
// @route   POST /api/orders/:id/chat/exchange-extension
// @access  Customer, Seller
export const requestOrderExchangeExtension = async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.orderStatus !== 'DELIVERED') {
      return res.status(400).json({ success: false, message: 'Exchange extension is only applicable post-delivery.' });
    }

    let chat = await OrderChat.findOne({ orderId: order._id });
    if (!chat) {
      chat = await OrderChat.create({
        orderId: order._id,
        sellerId: order.sellerId || order.items[0]?.sellerId,
        customerId: order.customerId,
        messages: []
      });
    }

    if (chat.exchangeExtensionGranted) {
      return res.status(400).json({
        success: false,
        message: 'Exchange extension has already been granted for this order (+7 additional days active).'
      });
    }

    chat.exchangeExtensionGranted = true;
    chat.exchangeExtensionGrantedAt = new Date();

    if (order.returnStatus === 'NONE' || !order.returnStatus) {
      order.returnStatus = 'EXCHANGE_REQUESTED';
      await order.save();
    }

    const sysMsg = {
      senderId: req.user._id,
      senderRole: 'system',
      senderName: 'NovaKart Exchange Protection',
      message: '🔄 Product Exchange / Return Extension Granted: 7 additional days added to customer support window for return and replacement coordination.',
      timestamp: new Date()
    };

    chat.messages.push(sysMsg);
    chat.lastMessageAt = new Date();
    await chat.save();

    const updatedStatus = calculateOrderChatStatus(order, chat);

    // Socket Broadcast
    const io = getSocketIO();
    if (io) {
      io.to(`order_${order._id}`).emit('new_order_chat_message', {
        orderId: order._id,
        message: sysMsg,
        chatStatus: updatedStatus
      });
    }

    res.json({
      success: true,
      message: '7 additional days granted successfully for exchange coordination.',
      chatStatus: updatedStatus
    });
  } catch (error) {
    next(error);
  }
};
