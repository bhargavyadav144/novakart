import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  customerName: { type: String, default: 'Verified Buyer' },
  rating: { type: Number, required: true, min: 1, max: 5, default: 5 },
  title: { type: String, default: 'Verified Customer Review' },
  comment: { type: String, default: '' },
  isVerifiedPurchase: { type: Boolean, default: true },
  deliveredDate: { type: Date, default: null },
  photos: [{ type: String }]
}, { timestamps: true });

export const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);
