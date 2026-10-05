import mongoose from 'mongoose';

const orderChatMessageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderRole: { type: String, enum: ['seller', 'customer', 'system'], required: true },
  senderName: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const orderChatSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true, index: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  messages: [orderChatMessageSchema],
  exchangeExtensionGranted: { type: Boolean, default: false },
  exchangeExtensionGrantedAt: { type: Date, default: null },
  lastMessageAt: { type: Date, default: Date.now }
}, { timestamps: true });

export const OrderChat = mongoose.models.OrderChat || mongoose.model('OrderChat', orderChatSchema);
