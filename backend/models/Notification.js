import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, default: 'customer' },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, default: 'ORDER_STATUS' },
  link: { type: String, default: '' },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  otpCode: { type: String, default: '' },
  giftCardCode: { type: String, default: '' },
  emailSent: { type: Boolean, default: false },
  emailSubject: { type: String, default: '' },
  emailBody: { type: String, default: '' },
  isRead: { type: Boolean, default: false }

}, { timestamps: true });

export const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
