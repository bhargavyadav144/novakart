import mongoose from 'mongoose';

const callQueueSchema = new mongoose.Schema({
  // ─── CALLER IDENTITY ───
  callId: { type: String, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customerName: { type: String, default: '' },
  customerPhone: { type: String, required: true },
  customerEmail: { type: String, default: '' },

  // ─── IVR AUTOMATED INTAKE ───
  ivr: {
    language: {
      type: String,
      enum: ['ENGLISH', 'HINDI', 'TELUGU', 'TAMIL', 'KANNADA', 'MALAYALAM', 'BENGALI', 'MARATHI', 'GUJARATI'],
      default: 'ENGLISH'
    },
    reason: {
      type: String,
      enum: ['RETURN_EXCHANGE', 'ORDER_STATUS', 'PAYMENT_ISSUE', 'DELIVERY_PROBLEM', 'ACCOUNT_HELP', 'OTHER'],
      default: 'OTHER'
    },
    step: {
      type: String,
      enum: ['LANG_SELECT', 'ISSUE_SELECT', 'ROUTING', 'COMPLETED'],
      default: 'LANG_SELECT'
    },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    orderNumber: { type: String, default: '' },
    customerStatement: { type: String, default: '' },
    ivrCompleted: { type: Boolean, default: false },
    ivrCompletedAt: { type: Date, default: null }
  },


  // ─── QUEUE & HOLD STATE ───
  queueStatus: {
    type: String,
    enum: [
      'IVR_IN_PROGRESS',     // Customer answering automated prompts
      'QUEUED',              // Waiting for agent
      'CONNECTING',          // Being routed to agent
      'CONNECTED',           // Live call with agent
      'ON_HOLD',             // Agent put customer on hold
      'TRANSFERRED',         // Transferred to another agent
      'COMPLETED',           // Call finished
      'ABANDONED',           // Customer hung up while waiting
      'MISSED',              // No agent picked up
      'CANCELLED'            // Cancelled by system/admin
    ],
    default: 'IVR_IN_PROGRESS'
  },
  queuePosition: { type: Number, default: 0 },
  queueEnteredAt: { type: Date, default: null },
  estimatedWaitSeconds: { type: Number, default: 0 },
  holdMusicPlaying: { type: Boolean, default: false },
  holdStartedAt: { type: Date, default: null },
  totalHoldSeconds: { type: Number, default: 0 },

  // ─── AGENT ASSIGNMENT ───
  assignedAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedAgent: {
    workerId: { type: String, default: '' },
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    language: { type: String, default: 'ENGLISH' },
    specialty: { type: String, default: '' }
  },
  previousAgents: [{
    workerId: { type: String },
    name: { type: String },
    transferredAt: { type: Date, default: Date.now },
    reason: { type: String, default: '' }
  }],

  // ─── CALL LIFECYCLE ───
  callStartedAt: { type: Date, default: null },
  callConnectedAt: { type: Date, default: null },
  callEndedAt: { type: Date, default: null },
  callDurationSeconds: { type: Number, default: 0 },
  waitDurationSeconds: { type: Number, default: 0 },

  // ─── RESOLUTION ───
  outcome: {
    type: String,
    enum: ['RESOLVED', 'ESCALATED', 'FOLLOW_UP_NEEDED', 'CUSTOMER_HUNG_UP', 'TRANSFERRED', 'UNRESOLVED', 'NONE'],
    default: 'NONE'
  },
  resolutionNotes: { type: String, default: '' },
  linkedTicketId: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportTicket', default: null },
  linkedReturnId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReturnRequest', default: null },

  // ─── CALL RECORDING & AUDIT ───
  isRecorded: { type: Boolean, default: true },
  qualityScore: { type: Number, default: 0, min: 0, max: 5 },
  
  // ─── CUSTOMER FEEDBACK & STAR REVIEW ───
  customerFeedback: {
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewText: { type: String, default: '' },
    tags: [{ type: String }],
    submittedAt: { type: Date, default: null }
  },
  
  // ─── REAL-TIME TWO-WAY SPEECH & TRANSCRIPT ───
  callTranscript: [{
    sender: { type: String, enum: ['CUSTOMER', 'AGENT', 'SYSTEM', 'BOT'], default: 'CUSTOMER' },
    senderName: { type: String, default: '' },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    audioUrl: { type: String, default: '' }
  }],

  timeline: [{
    event: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    details: { type: String, default: '' },
    actor: { type: String, default: 'System' }
  }]
}, { timestamps: true });


// Auto-generate call ID
callQueueSchema.pre('save', function (next) {
  if (!this.callId) {
    this.callId = 'CALL-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000);
  }
  next();
});

// Index for efficient queue queries
callQueueSchema.index({ queueStatus: 1, queueEnteredAt: 1 });
callQueueSchema.index({ 'assignedAgent.workerId': 1, queueStatus: 1 });
callQueueSchema.index({ customerId: 1, createdAt: -1 });

export const CallQueue = mongoose.models.CallQueue || mongoose.model('CallQueue', callQueueSchema);
