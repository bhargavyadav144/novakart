import mongoose from 'mongoose';

const warehouseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  type: {
    type: String,
    enum: ['Mother Warehouse', 'Regional Sorting Hub', 'Delivery Branch'],
    default: 'Delivery Branch'
  },
  state: {
    type: String,
    enum: ['Andhra Pradesh', 'Telangana'],
    required: true
  },
  city: { type: String, required: true },
  address: { type: String, required: true },
  pincode: { type: String, required: true },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  manager: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    employeeId: { type: String, required: true },
    bankDetails: {
      accountHolderName: { type: String, default: '' },
      bankName: { type: String, default: 'Andhra Bank / Union Bank of India' },
      accountNumber: { type: String, default: '012910100084729' },
      ifscCode: { type: String, default: 'UBIN0801291' },
      panNumber: { type: String, default: 'ABCDE1234F' },
      monthlySalary: { type: Number, default: 45000 },
      isVerified: { type: Boolean, default: true }
    },
    biometricStatus: {
      faceAuthEnrolled: { type: Boolean, default: true },
      fingerprintEnrolled: { type: Boolean, default: true },
      lastVerifiedAt: { type: Date, default: Date.now }
    }
  },
  capacity: { type: Number, default: 25000 },
  currentLoad: { type: Number, default: 0 },
  contactPhone: { type: String },
  status: {
    type: String,
    enum: ['active', 'maintenance'],
    default: 'active'
  },
  // Admin-Configured Warehouse Territory / Coverage Area
  serviceArea: {
    pincodes: [{ type: String }],
    center: {
      lat: { type: Number },
      lng: { type: Number }
    },
    radiusKm: { type: Number, default: 100 },
    color: { type: String, default: '#2563EB' },
    markedByAdmin: { type: Boolean, default: true },
    updatedAt: { type: Date, default: Date.now }
  },
  // Warehouse Manager Defined Delivery Zones with Distinct Colors
  deliveryZones: [{
    zoneId: { type: String, required: true },
    zoneName: { type: String, required: true },
    mandal: { type: String, default: '' },
    pincodes: [{ type: String }],
    center: {
      lat: { type: Number, default: 16.3067 },
      lng: { type: Number, default: 80.4365 }
    },
    radiusKm: { type: Number, default: 5 },
    color: { type: String, default: '#10B981' },
    assignedAgentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryAgent' }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }],
  isZonesInitialized: { type: Boolean, default: false }
}, { timestamps: true });

// Geospatial indexing
warehouseSchema.index({ 'location.lat': 1, 'location.lng': 1 });

export const Warehouse = mongoose.models.Warehouse || mongoose.model('Warehouse', warehouseSchema);
