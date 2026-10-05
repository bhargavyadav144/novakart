import mongoose from 'mongoose';

const sellerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  storeName: { type: String, required: true },
  ownerName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  businessAddress: { type: String, required: true },
  location: {
    lat: { type: Number, default: 28.6139 },
    lng: { type: Number, default: 77.2090 },
    city: { type: String, default: 'New Delhi' },
    state: { type: String, default: 'Delhi' },
    postalCode: { type: String, default: '110001' }
  },
  status: { type: String, enum: ['pending', 'pending_approval', 'approved', 'rejected', 'suspended', 'blocked', 'active'], default: 'pending_approval' },
  isApproved: { type: Boolean, default: false },
  revenue: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  completedOrders: { type: Number, default: 0 },
  logo: { type: String, default: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=200&q=80' },
  banner: { type: String, default: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80' },
  acceptedTerms: { type: Boolean, default: false },
  bankDetails: {
    accountHolderName: { type: String, default: '' },
    bankName: { type: String, default: 'HDFC Bank' },
    accountNumber: { type: String, default: '50100234891244' },
    ifscCode: { type: String, default: 'HDFC0001234' },
    upiId: { type: String, default: '' },
    isVerified: { type: Boolean, default: true }
  },
  wallet: {
    availableBalance: { type: Number, default: 0 },
    pendingEscrowBalance: { type: Number, default: 0 },
    totalWithdrawn: { type: Number, default: 0 }
  },
  isFaceVerified: { type: Boolean, default: false },
  faceVerificationPhoto: { type: String, default: '' },
  faceVerifiedAt: { type: Date, default: null },
  // Multi-biometric security enrollment: up to 3 fingerprints and 2 face scans
  enrolledFingerprints: [
    {
      id: { type: String, required: true },
      name: { type: String, default: 'Fingerprint 1' },
      fingerType: { type: String, default: 'Thumb' },
      enrolledAt: { type: Date, default: Date.now },
      credentialId: { type: String, default: '' }
    }
  ],
  enrolledFaces: [
    {
      id: { type: String, required: true },
      label: { type: String, default: 'Primary Face Scan (Frontal)' },
      photo: { type: String, required: true },
      enrolledAt: { type: Date, default: Date.now }
    }
  ],
  isBiometricEnrolled: { type: Boolean, default: false },
  biometricsEnrolledAt: { type: Date, default: null },
  lastWithdrawalDate: { type: Date, default: null },
  lastBiometricVerification: {
    verifiedAt: { type: Date, default: null },
    action: { type: String, default: '' },
    confidence: { type: Number, default: 0 },
    biometricType: { type: String, default: '' },
    token: { type: String, default: '' }
  }
}, { timestamps: true });

export const Seller = mongoose.models.Seller || mongoose.model('Seller', sellerSchema);
