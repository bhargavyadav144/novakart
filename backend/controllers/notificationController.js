import { Notification } from '../models/Notification.js';
import { Seller } from '../models/Seller.js';
import { emitToUser } from '../services/socketService.js';

// Helper: Create a notification and emit it in real-time
export const createNotification = async ({ recipientId, role, title, message, type, link, orderId, otpCode, emailSent, emailSubject, emailBody }) => {
  try {
    const notif = await Notification.create({
      recipientId,
      userId: recipientId,
      role: role || 'customer',
      title,
      message,
      type: type || 'ORDER_STATUS',
      link: link || '',
      orderId: orderId || null,
      otpCode: otpCode || '',
      emailSent: Boolean(emailSent),
      emailSubject: emailSubject || '',
      emailBody: emailBody || ''
    });
    // Push to user's browser in real-time
    emitToUser(recipientId, 'new_notification', {
      _id: notif._id,
      title: notif.title,
      message: notif.message,
      type: notif.type,
      link: notif.link,
      orderId: notif.orderId,
      otpCode: notif.otpCode,
      emailSent: notif.emailSent,
      emailSubject: notif.emailSubject,
      emailBody: notif.emailBody,
      isRead: false,
      createdAt: notif.createdAt,
    });
    return notif;
  } catch (err) {
    console.error('[Notification] Failed to create:', err.message);
  }
};

// @desc  Get notifications for the logged-in user
// @route GET /api/notifications
// @access Private
export const getMyNotifications = async (req, res, next) => {
  try {
    let notifications = await Notification.find({ recipientId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    let unreadCount = await Notification.countDocuments({ recipientId: req.user._id, isRead: false });

    // For sellers: check if biometric registration (3 fingerprints & 2 faces) is complete
    if (req.user.role === 'seller') {
      const seller = await Seller.findOne({ userId: req.user._id });
      if (seller) {
        const hasCompleteBiometrics = Boolean(seller.isBiometricEnrolled && (seller.enrolledFaces?.length || 0) >= 2 && (seller.enrolledFingerprints?.length || 0) >= 1);
        if (!hasCompleteBiometrics) {
          const biometricNotif = {
            _id: `biometric-mandatory-${seller._id}`,
            recipientId: req.user._id,
            title: '🚨 Mandatory Biometrics Incomplete (Action Required)',
            message: 'NovaKart Security Compliance: You must register up to 3 fingerprints and 2 face scans to enable payout withdrawals and protect your store ledger.',
            type: 'BIOMETRIC_SECURITY',
            link: '/profile',
            isRead: false,
            createdAt: new Date()
          };
          notifications = [biometricNotif, ...notifications];
          unreadCount += 1;
        }
      }
    }

    res.json({ success: true, notifications, unreadCount });
  } catch (error) {
    next(error);
  }
};

// @desc  Mark a single notification as read
// @route PUT /api/notifications/:id/read
// @access Private
export const markNotificationRead = async (req, res, next) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.user._id },
      { isRead: true }
    );
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// @desc  Mark all notifications as read
// @route PUT /api/notifications/read-all
// @access Private
export const markAllNotificationsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipientId: req.user._id, isRead: false },
      { isRead: true }
    );
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    next(error);
  }
};

// @desc  Delete a notification
// @route DELETE /api/notifications/:id
// @access Private
export const deleteNotification = async (req, res, next) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, recipientId: req.user._id });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
