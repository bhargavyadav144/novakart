import mongoose from 'mongoose';

const deliveryAgentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  vehicleType: { type: String, required: true },
  vehicleNumber: { type: String, required: true },
  drivingLicense: { type: String, required: true },
  profileImage: { type: String },
  vehicleImage: { type: String },
  isFaceVerified: { type: Boolean, default: false },
  faceVerificationPhoto: { type: String, default: '' },
  additionalFacePhotos: [{ type: String }],
  faceVerifiedAt: { type: Date, default: null },
  faceChangeAuthorizedUntil: { type: Date, default: null },
  lastFaceBiometricVerification: {
    verifiedAt: { type: Date, default: null },
    action: { type: String, default: '' },
    confidence: { type: Number, default: 0 },
    token: { type: String, default: '' }
  },
  bankDetails: {
    accountName: { type: String, default: '' },
    accountNumber: { type: String, default: '309204918204' },
    bankName: { type: String, default: 'State Bank of India' },
    ifscCode: { type: String, default: 'SBIN0004521' },
    upiId: { type: String, default: '' },
    isVerified: { type: Boolean, default: true }
  },
  wallet: {
    availableBalance: { type: Number, default: 0 },
    pendingVerificationBalance: { type: Number, default: 0 },
    totalWithdrawn: { type: Number, default: 0 }
  },
  currentLocation: {
    lat: { type: Number, default: 28.6139 },
    lng: { type: Number, default: 77.2090 },
    address: { type: String, default: 'Connaught Place, New Delhi' }
  },
  status: { type: String, enum: ['pending', 'pending_approval', 'approved', 'rejected', 'suspended', 'blocked', 'active'], default: 'pending_approval' },
  isApproved: { type: Boolean, default: false },
  isOnline: { type: Boolean, default: false },
  isAvailable: { type: Boolean, default: false },
  todayDeliveries: { type: Number, default: 0 },
  completedDeliveries: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  activeOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  activeOrderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
  maxConcurrentOrders: { type: Number, default: 5 },
  assignedWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
  onboardedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  mustChangePassword: { type: Boolean, default: false },
  assignedRoute: {
    routeName: { type: String, default: 'Guntur - Tenali Delivery Corridor' },
    routeTitle: { type: String, default: 'Regional Delivery Route' },
    startWarehouseName: { type: String, default: 'Guntur Regional Logistics Hub' },
    startPincode: { type: String, default: '522001' },
    endPincode: { type: String, default: '522201' },
    endVillageName: { type: String, default: 'Tenali Delivery Hub (Last Stop)' },
    corridorRadiusKm: { type: Number, default: 10 },
    assignedByWarehouseManager: { type: String, default: 'Warehouse Manager' },
    assignedAt: { type: Date, default: Date.now },
    totalStops: { type: Number, default: 0 },
    stops: [{
      stopIndex: Number,
      orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
      orderNumber: String,
      recipientName: String,
      areaName: String,
      street: String,
      pincode: String,
      coordinates: {
        lat: Number,
        lng: Number
      },
      status: String
    }],
    startCoordinates: {
      lat: { type: Number, default: 16.3067 },
      lng: { type: Number, default: 80.4365 }
    },
    endCoordinates: {
      lat: { type: Number, default: 16.2430 },
      lng: { type: Number, default: 80.6400 }
    }
  },
  emergencyContact: {
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    relation: { type: String, default: '' }
  },
  lastWithdrawalDate: { type: Date, default: null },
  pendingBankDetails: {
    accountName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    bankName: { type: String, default: '' },
    ifscCode: { type: String, default: '' },
    upiId: { type: String, default: '' },
    requestedAt: { type: Date, default: null },
    status: { type: String, enum: ['NONE', 'PENDING', 'APPROVED', 'REJECTED'], default: 'NONE' }
  },
  supportTickets: [{
    ticketId: String,
    issueType: { type: String, default: 'PAYMENT' }, // PAYMENT, FUEL, BONUS, OTHER
    description: String,
    amountRequested: { type: Number, default: 0 },
    status: { type: String, enum: ['OPEN', 'RESOLVED', 'REJECTED'], default: 'OPEN' },
    resolvedAmount: { type: Number, default: 0 },
    adminNotes: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    resolvedAt: Date
  }],
  // Territory Zone assigned by Warehouse Manager (Primary)
  assignedZone: {
    zoneId: { type: String, default: '' },
    zoneName: { type: String, default: 'General Route Corridor' },
    mandal: { type: String, default: '' },
    pincodes: [{ type: String }],
    center: {
      lat: { type: Number, default: 16.3067 },
      lng: { type: Number, default: 80.4365 }
    },
    radiusKm: { type: Number, default: 5 },
    color: { type: String, default: '#10B981' },
    assignedByWarehouseManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedAt: { type: Date, default: Date.now }
  },
  // N-Number Multi-Mandal Assignments based on distance and mandal size
  assignedZones: [{
    zoneId: { type: String, default: '' },
    zoneName: { type: String, default: '' },
    mandal: { type: String, default: '' },
    mandalTelugu: { type: String, default: '' },
    pincodes: [{ type: String }],
    center: {
      lat: { type: Number, default: 16.3067 },
      lng: { type: Number, default: 80.4365 }
    },
    radiusKm: { type: Number, default: 5 },
    color: { type: String, default: '#10B981' },
    assignedByWarehouseManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedAt: { type: Date, default: Date.now }
  }],
  preferredPincodes: [{ type: String }]
}, { timestamps: true });

export const DeliveryAgent = mongoose.models.DeliveryAgent || mongoose.model('DeliveryAgent', deliveryAgentSchema);
