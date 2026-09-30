import mongoose from 'mongoose';

const returnRequestSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  orderNumber: { type: String, required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' },
  type: {
    type: String,
    enum: ['RETURN', 'EXCHANGE'],
    required: true,
    default: 'RETURN'
  },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    image: { type: String, default: '' },
    quantity: { type: Number, required: true, default: 1 },
    price: { type: Number, required: true },
    reason: { type: String, default: 'DEFECTIVE_DAMAGED' }
  }],
  reasonCategory: {
    type: String,
    enum: [
      'DEFECTIVE_DAMAGED',
      'WRONG_ITEM_OR_SIZE',
      'NOT_AS_DESCRIBED',
      'QUALITY_NOT_EXPECTED',
      'SIZE_FIT_ISSUE',
      'ARRIVED_LATE',
      'OTHER'
    ],
    default: 'DEFECTIVE_DAMAGED'
  },
  reasonDetails: { type: String, default: '' },
  
  // Specific for Exchanges
  exchangePreference: {
    exchangeType: { type: String, enum: ['REPLACEMENT_PIECE', 'DIFFERENT_SIZE', 'DIFFERENT_COLOR'], default: 'REPLACEMENT_PIECE' },
    desiredSize: { type: String, default: '' },
    desiredColor: { type: String, default: '' },
    notes: { type: String, default: '' }
  },

  // Specific for Returns (Refund destination)
  refundPreference: {
    type: String,
    enum: ['WALLET', 'ORIGINAL_PAYMENT'],
    default: 'ORIGINAL_PAYMENT'
  },
  estimatedRefundAmount: { type: Number, default: 0 },

  // Courier Pickup Location
  pickupAddress: {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true }
  },

  // ─── MULTI-ROLE PIPELINE ASSIGNMENTS & VERIFICATIONS ───
  assignedDeliveryAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryAgent', default: null },
  destinationWarehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },

  // Stage 2: Admin Approval
  adminApproval: {
    isApproved: { type: Boolean, default: false },
    approvedBy: { type: String, default: '' },
    approvedAt: { type: Date, default: null },
    adminNotes: { type: String, default: '' }
  },

  // Stage 3: Delivery Agent Doorstep Pickup
  agentPickup: {
    isPickedUp: { type: Boolean, default: false },
    pickedUpAt: { type: Date, default: null },
    barcodeScanned: { type: String, default: '' },
    pickupProofNotes: { type: String, default: '' }
  },

  // Stage 4: Warehouse Hub QC Inspection
  warehouseQC: {
    isInspected: { type: Boolean, default: false },
    passed: { type: Boolean, default: false },
    inspectedBy: { type: String, default: '' },
    inspectedAt: { type: Date, default: null },
    conditionRating: { type: String, enum: ['PRISTINE_TAGS_INTACT', 'ACCEPTABLE', 'DAMAGED_REJECTED', 'PENDING'], default: 'PENDING' },
    qcNotes: { type: String, default: '' },
    paymentRequestSent: { type: Boolean, default: false },
    paymentRequestSentAt: { type: Date, default: null }
  },

  // Stage 5: Payment Admin Disbursal
  paymentApproval: {
    isDisbursed: { type: Boolean, default: false },
    disbursedAt: { type: Date, default: null },
    disbursedBy: { type: String, default: '' },
    amountDisbursed: { type: Number, default: 0 },
    payoutDestination: { type: String, default: 'ORIGINAL_PAYMENT' },
    transactionRef: { type: String, default: '' },
    paymentAdminNotes: { type: String, default: '' }
  },

  // Lifecycle status
  status: {
    type: String,
    enum: [
      'REQUESTED',
      'ADMIN_APPROVED',
      'PICKUP_ASSIGNED',
      'PICKUP_SCHEDULED',
      'PICKED_UP',
      'WAREHOUSE_RECEIVED',
      'QC_PASSED',
      'QC_FAILED',
      'REFUND_PENDING_APPROVAL',
      'REFUND_DISBURSED',
      'EXCHANGE_DISPATCHED',
      'COMPLETED',
      'CANCELLED',
      'REJECTED'
    ],
    default: 'REQUESTED'
  },
  
  scheduledPickupDate: { type: Date, default: null },
  resolvedAt: { type: Date, default: null },

  timeline: [{
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    note: { type: String, default: '' },
    updatedBy: { type: String, default: 'System' }
  }]
}, { timestamps: true });

returnRequestSchema.pre('save', function (next) {
  if (!this.timeline || this.timeline.length === 0) {
    this.timeline = [{
      status: this.status,
      timestamp: new Date(),
      note: `${this.type === 'RETURN' ? 'Return' : 'Exchange'} request submitted by customer.`,
      updatedBy: 'Customer'
    }];
  }
  next();
});

export const ReturnRequest = mongoose.models.ReturnRequest || mongoose.model('ReturnRequest', returnRequestSchema);
