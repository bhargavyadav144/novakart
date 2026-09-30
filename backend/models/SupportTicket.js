import mongoose from 'mongoose';

const supportTicketSchema = new mongoose.Schema({
  ticketNumber: { type: String, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  orderNumber: { type: String, default: '' },
  
  category: {
    type: String,
    enum: [
      'RETURN_REFUND',
      'DELIVERY_ISSUE',
      'DAMAGED_ITEM',
      'PAYMENT_PROBLEM',
      'ACCOUNT_PROFILE',
      'GENERAL_INQUIRY'
    ],
    default: 'GENERAL_INQUIRY'
  },

  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
    default: 'MEDIUM'
  },

  status: {
    type: String,
    enum: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    default: 'OPEN'
  },

  subject: { type: String, required: true },

  contactChannel: {
    type: String,
    enum: ['CHAT', 'CALL_BACK', 'PRIORITY_ESCALATION'],
    default: 'CHAT'
  },
  customerPhone: { type: String, default: '' },

  callBackDetails: {
    status: {
      type: String,
      enum: ['PENDING', 'CALLING', 'COMPLETED', 'UNREACHABLE', 'CANCELLED'],
      default: 'PENDING'
    },
    requestedAt: { type: Date, default: Date.now },
    calledAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: 0 },
    callNotes: { type: String, default: '' },
    outcome: { type: String, default: '' }
  },

  assignedWorker: {
    workerId: { type: String, default: '' },
    name: { type: String, default: 'Unassigned (Triage Pool)' },
    role: { type: String, default: 'Customer Care' },
    email: { type: String, default: '' },
    avatar: { type: String, default: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80' },
    autoAssigned: { type: Boolean, default: false },
    assignedAt: { type: Date, default: null }
  },

  messages: [{
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    senderName: { type: String, required: true },
    senderRole: { type: String, enum: ['customer', 'support_agent', 'admin', 'system'], default: 'customer' },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }],

  resolutionAction: {
    actionType: {
      type: String,
      enum: [
        'NONE',
        'INSTANT_REFUND',
        'RETURN_PICKUP_DISPATCHED',
        'EXPEDITED_DELIVERY',
        'GOODWILL_CREDIT',
        'ORDER_CANCELLED',
        'INQUIRY_RESOLVED'
      ],
      default: 'NONE'
    },
    amount: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    executedBy: { type: String, default: '' },
    executedAt: { type: Date, default: null }
  },

  resolutionNotes: { type: String, default: '' },
  resolvedAt: { type: Date, default: null }
}, { timestamps: true });

supportTicketSchema.pre('save', function (next) {
  if (!this.ticketNumber) {
    this.ticketNumber = 'TKT-' + Math.floor(10000 + Math.random() * 90000);
  }
  next();
});

export const SupportTicket = mongoose.models.SupportTicket || mongoose.model('SupportTicket', supportTicketSchema);
