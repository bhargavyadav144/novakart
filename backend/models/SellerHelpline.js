import mongoose from 'mongoose';

const sellerHelplineMessageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderRole: { type: String, enum: ['seller', 'admin', 'system'], required: true },
  senderName: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const sellerHelplineSchema = new mongoose.Schema({
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true, unique: true, index: true },
  storeName: { type: String, required: true },
  ownerName: { type: String, default: '' },
  subject: { type: String, default: 'Merchant Platform Helpline Inquiry' },
  status: { type: String, enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED'], default: 'OPEN' },
  priority: { type: String, enum: ['NORMAL', 'HIGH', 'URGENT'], default: 'NORMAL' },
  messages: [sellerHelplineMessageSchema],
  lastMessageAt: { type: Date, default: Date.now }
}, { timestamps: true });

export const SellerHelpline = mongoose.models.SellerHelpline || mongoose.model('SellerHelpline', sellerHelplineSchema);
