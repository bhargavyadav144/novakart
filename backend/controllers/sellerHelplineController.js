import { Seller } from '../models/Seller.js';
import { SellerHelpline } from '../models/SellerHelpline.js';
import { getSocketIO, emitToUser } from '../services/socketService.js';
import { containsProhibitedLinks } from './orderChatController.js';
import { createNotification } from './notificationController.js';

// @desc    Get merchant helpline thread
// @route   GET /api/sellers/helpline
// @access  Seller
export const getSellerHelpline = async (req, res, next) => {
  try {
    const seller = await Seller.findOne({ userId: req.user._id });
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller profile not found' });
    }

    let thread = await SellerHelpline.findOne({ sellerId: seller._id });
    if (!thread) {
      thread = await SellerHelpline.create({
        sellerId: seller._id,
        storeName: seller.storeName,
        ownerName: seller.ownerName,
        messages: [{
          senderId: req.user._id,
          senderRole: 'system',
          senderName: 'NovaKart Admin Helpline',
          message: `👋 Welcome to the NovaKart Admin Helpline for "${seller.storeName}". Direct support is available for onboarding verification, catalog clearance, logistics, and payout inquiries. External links and external contact numbers are strictly prohibited.`,
          timestamp: new Date()
        }]
      });
    }

    res.json({ success: true, thread, seller });
  } catch (error) {
    next(error);
  }
};

// @desc    Send message from merchant to Admin Helpline
// @route   POST /api/sellers/helpline/message
// @access  Seller
export const sendSellerHelplineMessage = async (req, res, next) => {
  try {
    const { message, priority = 'NORMAL' } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message content cannot be empty.' });
    }

    // Anti-Fraud Link Filter
    if (containsProhibitedLinks(message)) {
      return res.status(400).json({
        success: false,
        message: '⚠️ Security Policy Violation: External URLs, website links, and redirection codes are strictly prohibited. Plain text support only.'
      });
    }

    const seller = await Seller.findOne({ userId: req.user._id });
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller profile not found' });
    }

    let thread = await SellerHelpline.findOne({ sellerId: seller._id });
    if (!thread) {
      thread = await SellerHelpline.create({
        sellerId: seller._id,
        storeName: seller.storeName,
        ownerName: seller.ownerName,
        messages: []
      });
    }

    const newMsg = {
      senderId: req.user._id,
      senderRole: 'seller',
      senderName: seller.storeName || req.user.name || 'Merchant',
      message: message.trim(),
      timestamp: new Date()
    };

    thread.messages.push(newMsg);
    thread.status = 'OPEN';
    thread.priority = priority;
    thread.lastMessageAt = new Date();
    await thread.save();

    // Broadcast to Admin socket room
    const io = getSocketIO();
    if (io) {
      io.to('admin_room').emit('new_seller_helpline_message', {
        sellerId: seller._id,
        storeName: seller.storeName,
        message: newMsg
      });
    }

    res.json({ success: true, message: newMsg, thread });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Get all seller helpline threads
// @route   GET /api/admin/helpline/threads
// @access  Admin
export const getAdminHelplineThreads = async (req, res, next) => {
  try {
    const threads = await SellerHelpline.find().sort({ lastMessageAt: -1 }).populate('sellerId');
    res.json({ success: true, threads });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Reply to seller helpline thread
// @route   POST /api/admin/helpline/:sellerId/reply
// @access  Admin
export const replyAdminHelplineMessage = async (req, res, next) => {
  try {
    const { sellerId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Reply content cannot be empty.' });
    }

    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }

    let thread = await SellerHelpline.findOne({ sellerId });
    if (!thread) {
      thread = await SellerHelpline.create({
        sellerId,
        storeName: seller.storeName,
        ownerName: seller.ownerName,
        messages: []
      });
    }

    const newMsg = {
      senderId: req.user._id,
      senderRole: 'admin',
      senderName: `Admin (${req.user.name || 'Support Desk'})`,
      message: message.trim(),
      timestamp: new Date()
    };

    thread.messages.push(newMsg);
    thread.status = 'IN_PROGRESS';
    thread.lastMessageAt = new Date();
    await thread.save();

    // Real-time notify seller
    emitToUser(seller.userId, 'admin_helpline_reply', {
      title: '🎧 Admin Helpline Reply',
      message: message.trim().slice(0, 100),
      newMsg
    });

    createNotification({
      recipientId: seller.userId,
      role: 'seller',
      title: '🎧 Admin Helpline Reply Received',
      message: `NovaKart Admin replied: "${message.trim().slice(0, 80)}"`,
      type: 'SELLER_APPROVAL',
      link: '/helpline'
    });

    res.json({ success: true, message: newMsg, thread });
  } catch (error) {
    next(error);
  }
};
