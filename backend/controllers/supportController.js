import mongoose from 'mongoose';
import { SupportTicket } from '../models/SupportTicket.js';
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
import { PaymentTransaction } from '../models/PaymentTransaction.js';
import { ReturnRequest } from '../models/ReturnRequest.js';
import { generateToken } from '../utils/tokenHelper.js';
import { ROLES } from '../config/constants.js';

export const DEFAULT_SUPPORT_WORKERS = [
  {
    workerId: 'WRK-01',
    name: 'Priya Sharma',
    role: 'Senior Returns & Refund Specialist',
    email: 'priya.returns@novakart.in',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
    specialty: 'Returns & QC Verification'
  },
  {
    workerId: 'WRK-02',
    name: 'Vikramaditya Rao',
    role: 'Logistics & Doorstep Delivery Lead',
    email: 'vikram.delivery@novakart.in',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    specialty: 'Rider Dispatch & Route Delays'
  },
  {
    workerId: 'WRK-03',
    name: 'Ananya Reddy',
    role: 'Payments & Treasury Associate',
    email: 'ananya.payments@novakart.in',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&q=80',
    specialty: 'Wallet Disbursals & Banking Settlements'
  },
  {
    workerId: 'WRK-04',
    name: 'Karthik Varma',
    role: 'Product Quality & Technical Support',
    email: 'karthik.tech@novakart.in',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    specialty: 'Damaged Products & Size Exchange'
  },
  {
    workerId: 'WRK-05',
    name: 'Neha Chawla',
    role: 'Customer Care Lead',
    email: 'neha.care@novakart.in',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
    specialty: 'General Support & Order Tracking'
  }
];

// Ensure default support workers exist in database for Help Center portal login
export const ensureSupportWorkersSeeded = async () => {
  try {
    for (const def of DEFAULT_SUPPORT_WORKERS) {
      const exists = await User.findOne({ email: def.email });
      if (!exists) {
        await User.create({
          name: def.name,
          email: def.email,
          password: 'Support@1234',
          role: 'support_agent',
          workerId: def.workerId,
          specialty: def.specialty,
          avatar: def.avatar,
          phone: '+91 98765 000' + def.workerId.slice(-2),
          supportDutyStatus: 'ONLINE'
        });
      }
    }
  } catch (err) {
    console.error('Error seeding support workers:', err);
  }
};

// Auto-seed on module import
ensureSupportWorkersSeeded();

// Helper to normalize category
export const normalizeCategory = (cat) => {
  if (!cat) return 'GENERAL_INQUIRY';
  const c = cat.toUpperCase();
  if (c.includes('RETURN') || c.includes('EXCHANGE')) return 'RETURN_REFUND';
  if (c.includes('DELIVERY') || c.includes('TRACKING')) return 'DELIVERY_ISSUE';
  if (c.includes('PAYMENT') || c.includes('REFUND')) return 'PAYMENT_PROBLEM';
  if (c.includes('DAMAGE') || c.includes('DEFECT')) return 'DAMAGED_ITEM';
  if (c.includes('ACCOUNT') || c.includes('SECURITY')) return 'ACCOUNT_PROFILE';
  return 'GENERAL_INQUIRY';
};

// Dynamic Intelligent Auto-Assignment Engine (Round-Robin & Least-Busy Free Worker Routing)
export const findBestAvailableSupportWorker = async (category) => {
  try {
    const normalizedCat = normalizeCategory(category);
    // Find all active support workers onboarded by admin
    const activeWorkers = await User.find({ role: 'support_agent', isBlocked: false });
    if (!activeWorkers || activeWorkers.length === 0) {
      return {
        ...DEFAULT_SUPPORT_WORKERS[0],
        autoAssigned: true,
        assignedAt: new Date()
      };
    }

    // Split workers: prioritize ONLINE duty status
    const onlineWorkers = activeWorkers.filter(w => w.supportDutyStatus === 'ONLINE');
    const candidatePool = onlineWorkers.length > 0 ? onlineWorkers : activeWorkers;

    // Calculate active load and domain affinity for each candidate
    const candidatesWithScore = await Promise.all(
      candidatePool.map(async (w) => {
        const activeCount = await SupportTicket.countDocuments({
          $or: [
            { 'assignedWorker.workerId': w.workerId },
            { 'assignedWorker.email': w.email }
          ],
          status: { $in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_CUSTOMER'] }
        });

        // Domain specialty match bonus (lower score is chosen first)
        let specialtyPenalty = 1;
        const spec = (w.specialty || '').toUpperCase();
        if (normalizedCat === 'RETURN_REFUND' && spec.includes('RETURN')) specialtyPenalty = 0;
        else if (normalizedCat === 'DELIVERY_ISSUE' && (spec.includes('DELIVERY') || spec.includes('LOGISTICS') || spec.includes('RIDER'))) specialtyPenalty = 0;
        else if (normalizedCat === 'PAYMENT_PROBLEM' && (spec.includes('PAYMENT') || spec.includes('TREASURY') || spec.includes('WALLET'))) specialtyPenalty = 0;
        else if (normalizedCat === 'DAMAGED_ITEM' && (spec.includes('DAMAGE') || spec.includes('QUALITY') || spec.includes('EXCHANGE'))) specialtyPenalty = 0;

        return {
          worker: w,
          activeCount,
          score: activeCount * 10 + specialtyPenalty
        };
      })
    );

    candidatesWithScore.sort((a, b) => a.score - b.score);
    const chosen = candidatesWithScore[0].worker;

    return {
      workerId: chosen.workerId || 'WRK-01',
      name: chosen.name,
      role: chosen.specialty || 'Support Resolution Officer',
      email: chosen.email,
      avatar: chosen.avatar || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
      autoAssigned: true,
      assignedAt: new Date()
    };
  } catch (err) {
    console.error('Error auto-routing support worker:', err);
    return {
      ...DEFAULT_SUPPORT_WORKERS[0],
      autoAssigned: true,
      assignedAt: new Date()
    };
  }
};

// ==========================================
// 1. PUBLIC & CUSTOMER CONTROLLERS
// ==========================================

// @desc    Get List of Support Workers (DB + Fallback)
// @route   GET /api/support/workers
// @access  Public / Private
export const getSupportWorkers = async (req, res) => {
  try {
    const dbWorkers = await User.find({ role: 'support_agent', isBlocked: false })
      .select('name email phone avatar workerId specialty supportDutyStatus');

    if (dbWorkers && dbWorkers.length > 0) {
      const formatted = dbWorkers.map(w => ({
        workerId: w.workerId || 'WRK-0' + Math.floor(Math.random() * 9),
        name: w.name,
        role: w.specialty || 'Customer Support Officer',
        email: w.email,
        avatar: w.avatar,
        specialty: w.specialty || 'Problem Resolution',
        supportDutyStatus: w.supportDutyStatus || 'ONLINE'
      }));
      return res.json({
        success: true,
        count: formatted.length,
        workers: formatted
      });
    }

    res.json({
      success: true,
      count: DEFAULT_SUPPORT_WORKERS.length,
      workers: DEFAULT_SUPPORT_WORKERS
    });
  } catch (error) {
    res.json({
      success: true,
      count: DEFAULT_SUPPORT_WORKERS.length,
      workers: DEFAULT_SUPPORT_WORKERS
    });
  }
};

// @desc    Customer Creates Support Ticket
// @route   POST /api/support/tickets
// @access  Private (Customer)
export const createSupportTicket = async (req, res, next) => {
  try {
    const { category, subject, message, description, orderId, priority } = req.body;
    const initialText = message || description;

    if (!subject || !initialText) {
      return res.status(400).json({ success: false, message: 'Subject and message/description are required' });
    }

    let resolvedOrderNumber = '';
    if (orderId) {
      const ord = await Order.findById(orderId);
      if (ord) resolvedOrderNumber = ord.orderNumber;
    }

    const normalizedCat = normalizeCategory(category);
    // Dynamic Auto-Assign to available/least-loaded online worker
    const assignedWorker = await findBestAvailableSupportWorker(normalizedCat);

    const ticket = await SupportTicket.create({
      customerId: req.user._id,
      orderId: orderId || null,
      orderNumber: resolvedOrderNumber,
      category: normalizedCat,
      priority: priority || 'MEDIUM',
      status: 'ASSIGNED',
      subject: subject.trim(),
      assignedWorker,
      messages: [
        {
          senderId: req.user._id,
          senderName: req.user.name || 'Customer',
          senderRole: 'customer',
          message: initialText.trim(),
          timestamp: new Date()
        },
        {
          senderName: assignedWorker.name,
          senderRole: 'support_agent',
          message: `Hello ${req.user.name || 'there'}! I'm ${assignedWorker.name}, your assigned ${assignedWorker.role}. I have taken ownership of ticket and am actively looking into this for you.`,
          timestamp: new Date(Date.now() + 1000)
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: `Support ticket #${ticket.ticketNumber} created and assigned to ${assignedWorker.name}!`,
      ticket
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all tickets submitted by logged-in Customer
// @route   GET /api/support/my-tickets
// @access  Private (Customer)
export const getMyTickets = async (req, res, next) => {
  try {
    const tickets = await SupportTicket.find({ customerId: req.user._id })
      .populate('orderId', 'orderNumber totalAmount orderStatus')
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      count: tickets.length,
      tickets
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Single Ticket Details with Messages
// @route   GET /api/support/tickets/:id
// @access  Private
export const getTicketById = async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('customerId', 'name email phone avatar walletBalance')
      .populate('orderId', 'orderNumber totalAmount orderStatus deliveryAddress items');

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Support ticket not found' });
    }

    // Customer can only view own tickets
    if (req.user.role === 'customer' && ticket.customerId?._id?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this ticket' });
    }

    res.json({ success: true, ticket });
  } catch (error) {
    next(error);
  }
};

// @desc    Send Message in Ticket (Customer, Support Worker, or Admin)
// @route   POST /api/support/tickets/:id/messages
// @access  Private
export const sendTicketMessage = async (req, res, next) => {
  try {
    const { message, text, senderName, senderRole } = req.body;
    const msgContent = message || text;

    if (!msgContent || !msgContent.trim()) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Support ticket not found' });
    }

    const isAgentOrAdmin = ['admin', 'support_agent'].includes(req.user.role);
    const role = isAgentOrAdmin ? 'support_agent' : 'customer';
    const name = senderName || req.user.name || (role === 'support_agent' ? ticket.assignedWorker.name : 'Customer');

    ticket.messages.push({
      senderId: req.user._id,
      senderName: name,
      senderRole: senderRole || role,
      message: msgContent.trim(),
      timestamp: new Date()
    });

    if (!isAgentOrAdmin && ticket.status === 'RESOLVED') {
      ticket.status = 'IN_PROGRESS'; // Customer reopened
    } else if (isAgentOrAdmin && (ticket.status === 'OPEN' || ticket.status === 'ASSIGNED')) {
      ticket.status = 'IN_PROGRESS';
    }

    await ticket.save();

    const populated = await SupportTicket.findById(ticket._id)
      .populate('customerId', 'name email phone avatar')
      .populate('orderId', 'orderNumber totalAmount orderStatus');

    res.json({
      success: true,
      message: 'Message sent successfully',
      ticket: populated
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 2. SUPPORT WORKER PORTAL CONTROLLERS (PORT 3006)
// ==========================================

// @desc    Support Worker Login to Dedicated Help Center Portal
// @route   POST /api/support/auth/login
// @access  Public
export const workerLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Staff account not found. All Support Workers must be added by System Administrator.'
      });
    }

    if (user.role !== 'support_agent' && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: This portal is strictly for certified Help Center Support Officers.'
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Your Support Officer credentials have been suspended by System Admin.'
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid Support Officer credentials' });
    }

    const token = generateToken({ id: user._id, role: user.role });

    res.json({
      success: true,
      message: `Welcome back, Officer ${user.name}! Connected to Help Center Desk.`,
      token,
      worker: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        workerId: user.workerId || 'WRK-01',
        specialty: user.specialty || 'General Care',
        supportDutyStatus: user.supportDutyStatus || 'ONLINE',
        avatar: user.avatar
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Support Worker: Get Assigned Tickets & Queue
// @route   GET /api/support/worker/my-tickets
// @access  Private (Support Worker / Admin)
export const workerGetMyTickets = async (req, res, next) => {
  try {
    const { status, filter, channel } = req.query;
    const workerId = req.user.workerId || '';
    const workerEmail = req.user.email || '';

    let query = {};

    if (filter === 'MY_ASSIGNED') {
      query = {
        $or: [
          { 'assignedWorker.workerId': workerId },
          { 'assignedWorker.email': workerEmail }
        ]
      };
    } else if (filter === 'UNASSIGNED') {
      query = {
        $or: [
          { status: 'OPEN' },
          { 'assignedWorker.workerId': '' }
        ]
      };
    } else {
      // Default: show both assigned to me and unassigned triage tickets
      query = {
        $or: [
          { 'assignedWorker.workerId': workerId },
          { 'assignedWorker.email': workerEmail },
          { status: 'OPEN' },
          { 'assignedWorker.workerId': '' }
        ]
      };
    }

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (channel && channel !== 'ALL') {
      query.contactChannel = channel;
    }

    const tickets = await SupportTicket.find(query)
      .populate('customerId', 'name email phone avatar walletBalance')
      .populate('orderId', 'orderNumber totalAmount orderStatus items deliveryAddress')
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      count: tickets.length,
      tickets
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Support Worker: Claim an open ticket
// @route   PUT /api/support/worker/tickets/:id/claim
// @access  Private (Support Worker / Admin)
export const workerClaimTicket = async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    ticket.assignedWorker = {
      workerId: req.user.workerId || 'WRK-01',
      name: req.user.name,
      role: req.user.specialty || 'Support Resolution Officer',
      email: req.user.email,
      avatar: req.user.avatar
    };
    ticket.status = 'IN_PROGRESS';
    ticket.messages.push({
      senderId: req.user._id,
      senderName: 'System',
      senderRole: 'system',
      message: `Ticket claimed by Officer ${req.user.name} (${req.user.workerId || 'Help Center'}).`,
      timestamp: new Date()
    });

    await ticket.save();

    res.json({
      success: true,
      message: `Ticket #${ticket.ticketNumber} claimed! You are now the assigned officer.`,
      ticket
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Support Worker: Toggle Duty Status (Online / In Consultation / Offline)
// @route   PUT /api/support/worker/duty-status
// @access  Private (Support Worker)
export const workerUpdateDutyStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['ONLINE', 'IN_CONSULTATION', 'OFFLINE'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid duty status' });
    }

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { supportDutyStatus: status },
      { new: true }
    );

    res.json({
      success: true,
      message: `Duty status updated to ${status}!`,
      dutyStatus: updated.supportDutyStatus
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 3. ADMIN ONLY CONTROLLERS (PORT 3003)
// "EVERY ONE WILL BE ADDED BY ADMIN ONLY"
// ==========================================

// @desc    Admin: Onboard / Add New Support Worker
// @route   POST /api/support/admin/workers
// @access  Private (Admin ONLY)
export const adminAddSupportWorker = async (req, res, next) => {
  try {
    const { name, email, password, workerId, specialty, phone, roleTitle } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists' });
    }

    const nextWorkerCount = await User.countDocuments({ role: 'support_agent' });
    const assignedWorkerId = workerId || `WRK-0${nextWorkerCount + 1}`;

    const newWorker = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: 'support_agent',
      workerId: assignedWorkerId,
      specialty: specialty || roleTitle || 'Customer Issue Resolution',
      phone: phone || '+91 98765 43210',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      supportDutyStatus: 'ONLINE'
    });

    res.status(201).json({
      success: true,
      message: `🎉 Support Worker ${newWorker.name} ([${newWorker.workerId}]) successfully created by Admin! They can now log in at Port 3006.`,
      worker: {
        _id: newWorker._id,
        name: newWorker.name,
        email: newWorker.email,
        workerId: newWorker.workerId,
        specialty: newWorker.specialty,
        role: newWorker.role,
        phone: newWorker.phone,
        supportDutyStatus: newWorker.supportDutyStatus
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: List all Support Workers with active ticket loads
// @route   GET /api/support/admin/workers
// @access  Private (Admin ONLY)
export const adminGetSupportWorkers = async (req, res, next) => {
  try {
    const workers = await User.find({ role: 'support_agent' })
      .select('name email phone workerId specialty supportDutyStatus isBlocked createdAt avatar');

    // Attach active ticket load to each worker
    const workersWithLoads = await Promise.all(
      workers.map(async (w) => {
        const activeCount = await SupportTicket.countDocuments({
          $or: [
            { 'assignedWorker.workerId': w.workerId },
            { 'assignedWorker.email': w.email }
          ],
          status: { $in: ['ASSIGNED', 'IN_PROGRESS', 'WAITING_CUSTOMER'] }
        });
        const resolvedCount = await SupportTicket.countDocuments({
          $or: [
            { 'assignedWorker.workerId': w.workerId },
            { 'assignedWorker.email': w.email }
          ],
          status: 'RESOLVED'
        });

        return {
          ...w.toObject(),
          activeTickets: activeCount,
          resolvedTickets: resolvedCount
        };
      })
    );

    res.json({
      success: true,
      count: workersWithLoads.length,
      workers: workersWithLoads
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Toggle Worker Suspension / Blocking
// @route   PUT /api/support/admin/workers/:id/toggle-block
// @access  Private (Admin ONLY)
export const adminToggleWorkerBlock = async (req, res, next) => {
  try {
    const worker = await User.findById(req.params.id);
    if (!worker || worker.role !== 'support_agent') {
      return res.status(404).json({ success: false, message: 'Support worker not found' });
    }

    worker.isBlocked = !worker.isBlocked;
    await worker.save();

    res.json({
      success: true,
      message: `Support worker ${worker.name} has been ${worker.isBlocked ? 'SUSPENDED' : 'ACTIVATED'}!`,
      isBlocked: worker.isBlocked
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Get all tickets across the platform with filtering
// @route   GET /api/support/admin/tickets
// @access  Private (Admin)
export const getAdminTickets = async (req, res, next) => {
  try {
    const { status, category, priority, search } = req.query;
    const filter = {};

    if (status && status !== 'ALL') filter.status = status;
    if (category && category !== 'ALL') filter.category = category;
    if (priority && priority !== 'ALL') filter.priority = priority;
    if (search) {
      filter.$or = [
        { ticketNumber: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { 'assignedWorker.name': { $regex: search, $options: 'i' } }
      ];
    }

    const tickets = await SupportTicket.find(filter)
      .populate('customerId', 'name email phone avatar walletBalance')
      .populate('orderId', 'orderNumber totalAmount orderStatus')
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      count: tickets.length,
      tickets
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Reassign Ticket to specific Support Worker
// @route   PUT /api/support/admin/tickets/:id/assign
// @access  Private (Admin)
export const assignTicketWorker = async (req, res, next) => {
  try {
    const { workerId } = req.body;

    // Check in database first
    const dbWorker = await User.findOne({ workerId, role: 'support_agent' });
    let workerToAssign;

    if (dbWorker) {
      workerToAssign = {
        workerId: dbWorker.workerId,
        name: dbWorker.name,
        role: dbWorker.specialty || 'Support Resolution Officer',
        email: dbWorker.email,
        avatar: dbWorker.avatar
      };
    } else {
      workerToAssign = DEFAULT_SUPPORT_WORKERS.find(w => w.workerId === workerId);
    }

    if (!workerToAssign) {
      return res.status(404).json({ success: false, message: 'Support worker not found' });
    }

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    ticket.assignedWorker = workerToAssign;
    ticket.status = ticket.status === 'OPEN' ? 'ASSIGNED' : ticket.status;
    ticket.messages.push({
      senderName: 'System',
      senderRole: 'system',
      message: `Reassigned to Officer ${workerToAssign.name} (${workerToAssign.workerId}) by Admin.`,
      timestamp: new Date()
    });

    await ticket.save();

    res.json({
      success: true,
      message: `Ticket #${ticket.ticketNumber} reassigned to ${workerToAssign.name}!`,
      ticket
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Update Ticket Status & Resolution Notes
// @route   PUT /api/support/admin/tickets/:id/status
// @access  Private (Admin)
export const updateTicketStatus = async (req, res, next) => {
  try {
    const { status, resolutionNotes } = req.body;

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    ticket.status = status;
    if (resolutionNotes) {
      ticket.resolutionNotes = resolutionNotes;
    }
    if (status === 'RESOLVED') {
      ticket.resolvedAt = new Date();
      ticket.messages.push({
        senderName: 'Support Team',
        senderRole: 'system',
        message: `Issue marked as RESOLVED. Resolution notes: ${resolutionNotes || 'Case resolved according to policy.'}`,
        timestamp: new Date()
      });
    }

    await ticket.save();

    res.json({
      success: true,
      message: `Ticket status updated to ${status}!`,
      ticket
    });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 4. TELEPHONY CALL-BACK SYSTEM (INBOUND PHONE CALLS & SOFTPHONE DIALER)
// =========================================================================

// @desc    Customer: Request an Instant Call Back
// @route   POST /api/support/callback-request
// @access  Private (Customer)
export const requestCallBack = async (req, res, next) => {
  try {
    const { phone, orderId, category, reason, preferredTime } = req.body;

    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: 'Valid contact phone number is required for call-back.' });
    }

    let resolvedOrderNumber = '';
    let foundOrder = null;
    if (orderId) {
      foundOrder = await Order.findById(orderId);
      if (foundOrder) resolvedOrderNumber = foundOrder.orderNumber;
    }

    const normalizedCat = normalizeCategory(category);
    const assignedWorker = await findBestAvailableSupportWorker(normalizedCat);

    const ticket = await SupportTicket.create({
      customerId: req.user._id,
      orderId: foundOrder ? foundOrder._id : null,
      orderNumber: resolvedOrderNumber,
      category: normalizedCat,
      priority: 'HIGH',
      status: 'ASSIGNED',
      contactChannel: 'CALL_BACK',
      customerPhone: phone.trim(),
      callBackDetails: {
        status: 'PENDING',
        requestedAt: new Date(),
        callNotes: preferredTime ? `Preferred call window: ${preferredTime}` : 'Immediate callback requested'
      },
      subject: `📞 Call Back Request: ${reason || 'Customer Inbound Phone Inquiry'}`,
      assignedWorker,
      messages: [
        {
          senderId: req.user._id,
          senderName: req.user.name || 'Customer',
          senderRole: 'customer',
          message: `Customer requested a phone call back at ${phone.trim()}. Reason: ${reason || 'Order / Service Inquiry'}.`,
          timestamp: new Date()
        },
        {
          senderName: assignedWorker.name,
          senderRole: 'system',
          message: `🤖 Auto-Routing Engine: Ticket automatically assigned to Officer ${assignedWorker.name} (${assignedWorker.workerId}) based on availability and domain specialty. Phone dialer session ready on Port 3006.`,
          timestamp: new Date(Date.now() + 500)
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: `Call-back request confirmed! Officer ${assignedWorker.name} has been assigned to call you at ${phone.trim()}.`,
      ticket
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Support Worker: Start Phone Call with Customer
// @route   PUT /api/support/worker/tickets/:id/call-start
// @access  Private (Support Worker / Admin)
export const workerStartCall = async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
      return res.status(400).json({
        success: false,
        message: '🔒 Phone call option is disabled because this complaint has already been resolved and closed.'
      });
    }

    ticket.callBackDetails.status = 'CALLING';
    ticket.callBackDetails.calledAt = new Date();
    if (ticket.status === 'OPEN' || ticket.status === 'ASSIGNED') {
      ticket.status = 'IN_PROGRESS';
    }

    ticket.messages.push({
      senderId: req.user._id,
      senderName: 'Telephony Engine',
      senderRole: 'system',
      message: `📞 Outbound softphone call dialed by Officer ${req.user.name} to customer phone: ${ticket.customerPhone || 'on file'}.`,
      timestamp: new Date()
    });

    await ticket.save();

    res.json({
      success: true,
      message: `Ringing customer line ${ticket.customerPhone}... Waiting for customer to accept call.`,
      ticket
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Customer accepts incoming call from support officer
// @route   PUT /api/support/tickets/:id/accept-call
// @access  Private (Customer / Admin)
export const customerAcceptCall = async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    ticket.callBackDetails.status = 'CONNECTED';
    ticket.messages.push({
      senderId: req.user._id,
      senderName: 'Telephony Engine',
      senderRole: 'system',
      message: `🟢 Call Connected: Customer ${req.user.name || 'Customer'} accepted incoming call from Support Officer.`,
      timestamp: new Date()
    });

    await ticket.save();

    res.json({
      success: true,
      message: 'Call accepted & line connected!',
      ticket
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Customer declines incoming call from support officer
// @route   PUT /api/support/tickets/:id/decline-call
// @access  Private (Customer / Admin)
export const customerDeclineCall = async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    ticket.callBackDetails.status = 'MISSED';
    ticket.messages.push({
      senderId: req.user._id,
      senderName: 'Telephony Engine',
      senderRole: 'system',
      message: `🔴 Call Declined: Customer declined/missed incoming call from Support Officer.`,
      timestamp: new Date()
    });

    await ticket.save();

    res.json({
      success: true,
      message: 'Call declined.',
      ticket
    });
  } catch (error) {
    next(error);
  }
};


// @desc    Support Worker: End Call & Log Call Outcome
// @route   PUT /api/support/worker/tickets/:id/call-end
// @access  Private (Support Worker / Admin)
export const workerEndCall = async (req, res, next) => {
  try {
    const { durationSeconds, callNotes, outcome, resolveTicket } = req.body;
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    ticket.callBackDetails.status = 'COMPLETED';
    ticket.callBackDetails.durationSeconds = durationSeconds || 0;
    ticket.callBackDetails.callNotes = callNotes || '';
    ticket.callBackDetails.outcome = outcome || 'CALL_COMPLETED';

    const mins = Math.floor((durationSeconds || 0) / 60);
    const secs = (durationSeconds || 0) % 60;
    const durationStr = `${mins > 0 ? `${mins}m ` : ''}${secs}s`;

    ticket.messages.push({
      senderId: req.user._id,
      senderName: req.user.name,
      senderRole: 'support_agent',
      message: `📞 Phone Call Concluded (${durationStr}). Disposition: ${outcome || 'COMPLETED'}.\nCall Notes: ${callNotes || 'Customer inquiry addressed.'}`,
      timestamp: new Date()
    });

    if (resolveTicket) {
      ticket.status = 'RESOLVED';
      ticket.resolvedAt = new Date();
      ticket.resolutionNotes = callNotes || 'Issue addressed and resolved during telephone consultation.';
    }

    await ticket.save();

    res.json({
      success: true,
      message: `Call session logged successfully (${durationStr}).`,
      ticket
    });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 5. ORDER INVESTIGATION & DIAGNOSTICS SUITE
// =========================================================================

// @desc    Support Worker: Inspect Order Diagnostics by ID or Order Number
// @route   GET /api/support/orders/inspect/:identifier
// @access  Private (Support Worker / Admin)
export const inspectOrderForSupport = async (req, res, next) => {
  try {
    const { identifier } = req.params;

    let query = {};
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      query = { $or: [{ _id: identifier }, { orderNumber: identifier }] };
    } else {
      query = { orderNumber: identifier };
    }

    const order = await Order.findOne(query)
      .populate('customerId', 'name email phone walletBalance avatar address')
      .populate('deliveryAgentId', 'name phone vehicleType currentLat currentLng isOnline')
      .populate('sellerId', 'storeName contactEmail phone pickupAddress');

    if (!order) {
      return res.status(404).json({ success: false, message: `Order '${identifier}' not found in database.` });
    }

    // Associated Return Request (if any)
    const returnReq = await ReturnRequest.findOne({ orderId: order._id }).sort({ createdAt: -1 });

    // Associated Payment Transactions
    const payments = await PaymentTransaction.find({
      $or: [
        { orderId: order._id },
        { transactionId: order.transactionId || 'none' },
        { 'sender.name': order.customerId?.name }
      ]
    }).sort({ createdAt: -1 }).limit(5);

    // Calculate resolution action eligibility
    const canRefund = order.paymentStatus !== 'REFUNDED' && order.totalAmount > 0;
    const canReturnPickup = ['DELIVERED', 'COMPLETED'].includes(order.orderStatus) && order.returnStatus !== 'PICKUP_SCHEDULED';
    const canExpedite = ['SELLER_ACCEPTED', 'DELIVERY_REQUESTED', 'AGENT_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY'].includes(order.orderStatus);
    const canCancel = ['PENDING', 'SELLER_ACCEPTED', 'DELIVERY_REQUESTED'].includes(order.orderStatus);

    res.json({
      success: true,
      order,
      returnRequest: returnReq,
      paymentTransactions: payments,
      capabilities: {
        canRefund,
        canReturnPickup,
        canExpedite,
        canGoodwillCredit: true,
        canCancel
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Support Worker / Admin: Fetch caller's pending orders & recent deliveries
// @route   GET /api/support/customer-pending-orders
// @access  Private (Support Worker / Admin)
export const getCustomerPendingOrdersForSupport = async (req, res, next) => {
  try {
    const { customerId, phone, email } = req.query;

    let targetCustomerId = customerId;

    if (!targetCustomerId || !mongoose.Types.ObjectId.isValid(targetCustomerId)) {
      if (phone) {
        const cleanPhone = String(phone).replace(/[^0-9]/g, '');
        const last4 = cleanPhone.length >= 4 ? cleanPhone.slice(-4) : cleanPhone;
        const user = await User.findOne({
          $or: [
            { phone: phone },
            { phone: cleanPhone },
            { phone: { $regex: last4, $options: 'i' } }
          ]
        });
        if (user) targetCustomerId = user._id;
      } else if (email) {
        const user = await User.findOne({ email: String(email).toLowerCase().trim() });
        if (user) targetCustomerId = user._id;
      }
    }

    const orderQueryConditions = [];
    if (targetCustomerId) {
      orderQueryConditions.push({ customerId: targetCustomerId });
    }
    if (phone) {
      const cleanPhone = String(phone).replace(/[^0-9]/g, '');
      const last4 = cleanPhone.length >= 4 ? cleanPhone.slice(-4) : cleanPhone;
      orderQueryConditions.push({ customerPhone: phone });
      orderQueryConditions.push({ customerPhone: cleanPhone });
      orderQueryConditions.push({ customerPhone: { $regex: last4, $options: 'i' } });
      orderQueryConditions.push({ 'deliveryAddress.phone': { $regex: last4, $options: 'i' } });
      orderQueryConditions.push({ 'deliveryAddress.recipientPhone': { $regex: last4, $options: 'i' } });
    }
    if (email) {
      orderQueryConditions.push({ customerEmail: String(email).toLowerCase().trim() });
    }

    let orders = [];
    let returnRequests = [];

    if (orderQueryConditions.length > 0) {
      orders = await Order.find({ $or: orderQueryConditions })
        .populate('customerId', 'name email phone avatar walletBalance')
        .populate('deliveryAgentId', 'name phone vehicleType currentLat currentLng')
        .populate('sellerId', 'storeName phone')
        .sort({ createdAt: -1 })
        .limit(20);

      const orderIds = orders.map(o => o._id);
      returnRequests = await ReturnRequest.find({
        $or: [
          ...(targetCustomerId ? [{ customerId: targetCustomerId }] : []),
          { orderId: { $in: orderIds } }
        ]
      })
        .populate('orderId', 'orderNumber totalAmount orderStatus items')
        .sort({ createdAt: -1 });
    } else {
      orders = await Order.find()
        .populate('customerId', 'name email phone avatar walletBalance')
        .populate('deliveryAgentId', 'name phone vehicleType currentLat currentLng')
        .sort({ createdAt: -1 })
        .limit(10);
    }

    const PENDING_STATUSES = [
      'PENDING',
      'SELLER_ACCEPTED',
      'DELIVERY_REQUESTED',
      'AGENT_ASSIGNED',
      'PICKED_UP',
      'OUT_FOR_DELIVERY',
      'RETURN_REQUESTED',
      'RETURN_PICKUP_SCHEDULED',
      'PROCESSING'
    ];

    const pendingOrders = orders.filter(o => PENDING_STATUSES.includes(o.orderStatus));
    const recentOrders = orders;

    res.json({
      success: true,
      count: orders.length,
      pendingCount: pendingOrders.length,
      pendingOrders,
      recentOrders,
      returnRequests
    });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 6. ONE-CLICK CONCRETE RESOLUTION ACTIONS (BEYOND JUST CHATTING)
// =========================================================================

// @desc    Support Worker: Issue Instant Wallet / Bank Refund
// @route   POST /api/support/worker/orders/:orderId/refund
// @access  Private (Support Worker / Admin)
export const executeInstantRefund = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { amount, reason, ticketId } = req.body;

    const order = await Order.findById(orderId).populate('customerId');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const refundAmount = Number(amount) || order.totalAmount;

    // 1. Credit Customer Wallet
    const customer = await User.findById(order.customerId._id || order.customerId);
    if (customer) {
      customer.walletBalance = (customer.walletBalance || 0) + refundAmount;
      await customer.save();
    }

    // 2. Update Order State
    order.paymentStatus = 'REFUNDED';
    order.timeline.push({
      status: 'REFUND_DISBURSED',
      timestamp: new Date(),
      note: `Instant refund of ₹${refundAmount} credited to customer wallet by Officer ${req.user.name}. Reason: ${reason || 'Support Resolution'}`
    });
    await order.save();

    // 3. Create Refund Transaction Ledger Entry
    const txId = 'REF-' + Date.now() + '-' + Math.floor(100 + Math.random() * 900);
    await PaymentTransaction.create({
      transactionId: txId,
      utrNumber: 'UTR-WAL-' + Date.now(),
      type: 'REFUND',
      amount: refundAmount,
      subtotal: refundAmount,
      netDisbursedAmount: refundAmount,
      orderId: order._id,
      orderNumber: order.orderNumber,
      sender: { name: 'NovaKart Treasury & Support Pool', role: 'platform', accountOrVpa: 'NovaKart Internal Treasury Wallet' },
      recipient: { name: customer?.name || 'Customer', role: 'customer', accountNumber: customer?.email || 'customer@store.com' },
      paymentMethod: 'Store Wallet / Balance',
      status: 'SUCCESS',
      verificationStatus: 'VERIFIED',
      notes: `Help Center Instant Refund authorized by Officer ${req.user.name}: ${reason || 'Order dispute resolution'}`
    });

    // 4. Update Support Ticket if linked
    let updatedTicket = null;
    if (ticketId) {
      updatedTicket = await SupportTicket.findById(ticketId);
      if (updatedTicket) {
        updatedTicket.status = 'RESOLVED';
        updatedTicket.resolvedAt = new Date();
        updatedTicket.resolutionNotes = `Instant Refund of ₹${refundAmount} credited to customer wallet. Reason: ${reason || 'Approved by support officer'}`;
        updatedTicket.resolutionAction = {
          actionType: 'INSTANT_REFUND',
          amount: refundAmount,
          notes: reason || 'Customer dispute settled with instant wallet credit.',
          executedBy: req.user.name,
          executedAt: new Date()
        };
        updatedTicket.messages.push({
          senderId: req.user._id,
          senderName: req.user.name,
          senderRole: 'support_agent',
          message: `💰 Instant Refund Authorized: ₹${refundAmount} has been credited to your NovaKart Store Wallet. Transaction Reference: ${txId}. Your current wallet balance is now ₹${customer?.walletBalance}.`,
          timestamp: new Date()
        });
        await updatedTicket.save();
      }
    }

    res.json({
      success: true,
      message: `🎉 Instant Refund of ₹${refundAmount} successfully credited to ${customer?.name}'s wallet!`,
      newWalletBalance: customer?.walletBalance,
      transactionId: txId,
      ticket: updatedTicket
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Support Worker: Authorize Return & Dispatch Pickup Courier
// @route   POST /api/support/worker/orders/:orderId/authorize-return-pickup
// @access  Private (Support Worker / Admin)
export const executeReturnPickupDispatch = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { reason, ticketId, exchangeOrRefund } = req.body;

    const order = await Order.findById(orderId).populate('customerId');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.returnStatus = 'PICKUP_SCHEDULED';
    order.timeline.push({
      status: 'PICKUP_SCHEDULED',
      timestamp: new Date(),
      note: `Return pickup authorized by Officer ${req.user.name}. Doorstep courier collection assigned.`
    });
    await order.save();

    // Check or create ReturnRequest
    let returnReq = await ReturnRequest.findOne({ orderId: order._id });
    if (!returnReq) {
      returnReq = await ReturnRequest.create({
        orderId: order._id,
        customerId: order.customerId._id || order.customerId,
        reason: reason || 'Verified by Help Center Officer',
        type: exchangeOrRefund === 'EXCHANGE' ? 'EXCHANGE' : 'REFUND',
        status: 'PICKUP_SCHEDULED',
        timeline: [{
          status: 'PICKUP_SCHEDULED',
          note: `Pickup scheduled by Support Desk Officer ${req.user.name}`
        }]
      });
    } else {
      returnReq.status = 'PICKUP_SCHEDULED';
      returnReq.timeline.push({
        status: 'PICKUP_SCHEDULED',
        timestamp: new Date(),
        note: `Support Desk Officer ${req.user.name} approved return and dispatched courier pickup.`
      });
      await returnReq.save();
    }

    // Update Ticket
    let updatedTicket = null;
    if (ticketId) {
      updatedTicket = await SupportTicket.findById(ticketId);
      if (updatedTicket) {
        updatedTicket.resolutionAction = {
          actionType: 'RETURN_PICKUP_DISPATCHED',
          notes: `Return pickup authorized. Courier assigned to inspect item at customer coordinates.`,
          executedBy: req.user.name,
          executedAt: new Date()
        };
        updatedTicket.messages.push({
          senderId: req.user._id,
          senderName: req.user.name,
          senderRole: 'support_agent',
          message: `📦 Return Authorized: A pickup agent has been dispatched to your doorstep (${order.deliveryAddress?.street || 'your address'}). Please keep the item intact with original tags for handover.`,
          timestamp: new Date()
        });
        await updatedTicket.save();
      }
    }

    res.json({
      success: true,
      message: `Return pickup authorized for Order #${order.orderNumber}. Courier fleet notified for collection!`,
      returnRequest: returnReq,
      ticket: updatedTicket
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Support Worker: Expedite Delayed Delivery
// @route   POST /api/support/worker/orders/:orderId/expedite-delivery
// @access  Private (Support Worker / Admin)
export const executeExpediteDelivery = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { priorityNotes, ticketId } = req.body;

    const order = await Order.findById(orderId).populate('deliveryAgentId customerId');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.timeline.push({
      status: 'EXPEDITED_BY_SUPPORT',
      timestamp: new Date(),
      note: `Delivery priority raised to URGENT by Officer ${req.user.name}. Priority notes: ${priorityNotes || 'Customer escalated delivery delay.'}`
    });
    await order.save();

    // Update Ticket
    let updatedTicket = null;
    if (ticketId) {
      updatedTicket = await SupportTicket.findById(ticketId);
      if (updatedTicket) {
        updatedTicket.resolutionAction = {
          actionType: 'EXPEDITED_DELIVERY',
          notes: priorityNotes || 'Expedited delivery priority broadcasted to logistics hub.',
          executedBy: req.user.name,
          executedAt: new Date()
        };
        updatedTicket.messages.push({
          senderId: req.user._id,
          senderName: req.user.name,
          senderRole: 'support_agent',
          message: `🛵 Logistics Escalation Broadcasted: We have marked Order #${order.orderNumber} as HIGH PRIORITY with our local delivery hub. Our logistics supervisor has been alerted to prioritize delivery today.`,
          timestamp: new Date()
        });
        await updatedTicket.save();
      }
    }

    res.json({
      success: true,
      message: `Delivery for Order #${order.orderNumber} expedited successfully! Dispatch team notified.`,
      ticket: updatedTicket
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Support Worker: Issue Goodwill Store Credit (Apology Compensation)
// @route   POST /api/support/worker/customers/:customerId/goodwill-credit
// @access  Private (Support Worker / Admin)
export const executeGoodwillCredit = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const { amount, reason, ticketId } = req.body;

    const creditAmount = Number(amount) || 100;

    const customer = await User.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer account not found' });
    }

    customer.walletBalance = (customer.walletBalance || 0) + creditAmount;
    await customer.save();

    let updatedTicket = null;
    if (ticketId) {
      updatedTicket = await SupportTicket.findById(ticketId);
      if (updatedTicket) {
        updatedTicket.resolutionAction = {
          actionType: 'GOODWILL_CREDIT',
          amount: creditAmount,
          notes: reason || 'Goodwill compensation issued for service delay.',
          executedBy: req.user.name,
          executedAt: new Date()
        };
        updatedTicket.messages.push({
          senderId: req.user._id,
          senderName: req.user.name,
          senderRole: 'support_agent',
          message: `🎁 Service Apology Credit: We deeply value your patience. Officer ${req.user.name} has credited ₹${creditAmount} directly to your NovaKart Wallet as a gesture of goodwill. Your new balance is ₹${customer.walletBalance}.`,
          timestamp: new Date()
        });
        await updatedTicket.save();
      }
    }

    res.json({
      success: true,
      message: `₹${creditAmount} Goodwill Apology credit granted to ${customer.name}! New Wallet Balance: ₹${customer.walletBalance}.`,
      newWalletBalance: customer.walletBalance,
      ticket: updatedTicket
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Support Worker: Emergency Cancel & Instant Refund
// @route   POST /api/support/worker/orders/:orderId/cancel-and-refund
// @access  Private (Support Worker / Admin)
export const executeCancelAndRefund = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { cancellationReason, ticketId } = req.body;

    const order = await Order.findById(orderId).populate('customerId');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const refundAmount = order.totalAmount;

    // 1. Cancel Order
    order.orderStatus = 'CANCELLED';
    order.cancellationReason = cancellationReason || `Cancelled by Help Center Officer ${req.user.name}`;
    order.paymentStatus = 'REFUNDED';
    order.timeline.push({
      status: 'ORDER_CANCELLED_BY_SUPPORT',
      timestamp: new Date(),
      note: `Order cancelled & ₹${refundAmount} refunded by Officer ${req.user.name}. Reason: ${cancellationReason || 'Customer dispute'}`
    });
    await order.save();

    // 2. Refund Customer Wallet
    const customer = await User.findById(order.customerId._id || order.customerId);
    if (customer) {
      customer.walletBalance = (customer.walletBalance || 0) + refundAmount;
      await customer.save();
    }

    // 3. Update Ticket
    let updatedTicket = null;
    if (ticketId) {
      updatedTicket = await SupportTicket.findById(ticketId);
      if (updatedTicket) {
        updatedTicket.status = 'RESOLVED';
        updatedTicket.resolvedAt = new Date();
        updatedTicket.resolutionNotes = `Order cancelled and full amount ₹${refundAmount} refunded to customer wallet.`;
        updatedTicket.resolutionAction = {
          actionType: 'ORDER_CANCELLED',
          amount: refundAmount,
          notes: cancellationReason || 'Order cancelled and refunded by support worker.',
          executedBy: req.user.name,
          executedAt: new Date()
        };
        updatedTicket.messages.push({
          senderId: req.user._id,
          senderName: req.user.name,
          senderRole: 'support_agent',
          message: `✕ Order #${order.orderNumber} has been successfully cancelled. The full amount of ₹${refundAmount} has been immediately credited to your NovaKart Wallet.`,
          timestamp: new Date()
        });
        await updatedTicket.save();
      }
    }

    res.json({
      success: true,
      message: `Order #${order.orderNumber} cancelled and ₹${refundAmount} refunded to ${customer?.name}'s wallet!`,
      newWalletBalance: customer?.walletBalance,
      ticket: updatedTicket
    });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 7. ADMIN EXECUTIVE RESOLUTION OVERVIEW METRICS
// =========================================================================

// @desc    Admin: Get Executive CX & Resolution Desk Analytics
// @route   GET /api/support/admin/executive-metrics
// @access  Private (Admin)
export const getSupportExecutiveMetrics = async (req, res, next) => {
  try {
    const totalTickets = await SupportTicket.countDocuments();
    const openTickets = await SupportTicket.countDocuments({ status: { $in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } });
    const resolvedTickets = await SupportTicket.countDocuments({ status: 'RESOLVED' });

    const totalCallbacks = await SupportTicket.countDocuments({ contactChannel: 'CALL_BACK' });
    const completedCallbacks = await SupportTicket.countDocuments({
      contactChannel: 'CALL_BACK',
      'callBackDetails.status': 'COMPLETED'
    });

    const activeOnlineWorkers = await User.countDocuments({
      role: 'support_agent',
      isBlocked: false,
      supportDutyStatus: 'ONLINE'
    });

    // Sum total refunds executed by support workers
    const refundActions = await SupportTicket.aggregate([
      { $match: { 'resolutionAction.actionType': { $in: ['INSTANT_REFUND', 'ORDER_CANCELLED', 'GOODWILL_CREDIT'] } } },
      { $group: { _id: null, totalDisbursed: { $sum: '$resolutionAction.amount' }, count: { $sum: 1 } } }
    ]);

    const totalRefundDisbursed = refundActions[0]?.totalDisbursed || 0;
    const totalResolutionDispatches = refundActions[0]?.count || 0;

    res.json({
      success: true,
      metrics: {
        totalTickets,
        openTickets,
        resolvedTickets,
        resolutionRate: totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 100,
        totalCallbacks,
        completedCallbacks,
        activeOnlineWorkers,
        totalRefundDisbursed,
        totalResolutionDispatches
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Support Officer / Admin Direct Disbursal Request to Payment Admin (Port 3005)
// @route   POST /api/support/worker/orders/:orderId/send-payment-request
// @access  Private (Admin/Support Agent)
export const executeSendPaymentRequestToPaymentAdmin = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { refundAmount, payoutDestination, paymentAdminNotes, customerInstructions, warehouseQcNotes, ticketId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    let returnReq = await ReturnRequest.findOne({ orderId: order._id });

    if (!returnReq) {
      returnReq = await ReturnRequest.create({
        orderId: order._id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        sellerId: order.sellerId,
        type: 'RETURN',
        items: order.items.map(it => ({
          productId: it.productId,
          name: it.name,
          quantity: it.quantity,
          price: it.price,
          reason: 'DEFECTIVE_DAMAGED'
        })),
        reasonCategory: 'DEFECTIVE_DAMAGED',
        reasonDetails: customerInstructions || 'Escalated by Support Officer for direct payment disbursal.',
        refundPreference: payoutDestination || 'ORIGINAL_PAYMENT',
        estimatedRefundAmount: Number(refundAmount) || Number(order.totalAmount) || 0,
        status: 'REFUND_PENDING_APPROVAL',
        pickupAddress: order.deliveryAddress,
        timeline: []
      });

      order.returnRequest = returnReq._id;
      order.returnStatus = 'RETURN_REQUESTED';
      await order.save();
    }

    // Mark QC as passed and payment request sent
    returnReq.warehouseQC = {
      ...returnReq.warehouseQC,
      isInspected: true,
      passed: true,
      qcNotes: warehouseQcNotes || returnReq.warehouseQC?.qcNotes || 'QC verified by Support/Admin team.',
      paymentRequestSent: true,
      paymentRequestSentAt: new Date(),
      inspectedAt: returnReq.warehouseQC?.inspectedAt || new Date(),
      inspectedBy: req.user?.name || 'Support Officer'
    };

    if (payoutDestination) returnReq.refundPreference = payoutDestination;
    if (refundAmount) returnReq.estimatedRefundAmount = Number(refundAmount);

    returnReq.status = 'REFUND_PENDING_APPROVAL';
    returnReq.timeline.push({
      status: 'REFUND_PENDING_APPROVAL',
      timestamp: new Date(),
      note: paymentAdminNotes || `Support Officer dispatched formal payment release request (₹${returnReq.estimatedRefundAmount} via ${returnReq.refundPreference}) to Payment Admin (Port 3005).`,
      updatedBy: req.user?.name || 'Support Officer'
    });

    await returnReq.save();

    // Update order status
    order.returnStatus = 'REFUND_PENDING_APPROVAL';
    order.timeline.push({
      status: 'REFUND_PENDING_APPROVAL',
      timestamp: new Date(),
      note: `Refund request dispatched to Payment Admin by ${req.user?.name || 'Support Officer'}. Amount: ₹${returnReq.estimatedRefundAmount}`,
      updatedBy: req.user?.name || 'Support Officer'
    });
    await order.save();

    // Update Support Ticket if ticketId provided
    if (ticketId) {
      await SupportTicket.findByIdAndUpdate(ticketId, {
        status: 'RESOLVED',
        resolutionNotes: paymentAdminNotes || `Dispatched refund request of ₹${returnReq.estimatedRefundAmount} to Payment Admin`,
        resolutionAction: {
          actionType: 'INSTANT_REFUND',
          amount: returnReq.estimatedRefundAmount,
          executedAt: new Date(),
          executedBy: req.user?.name || 'Support Officer',
          details: `Sent to Payment Admin (Port 3005) for ${returnReq.refundPreference} disbursal.`
        }
      });
    }

    res.json({
      success: true,
      message: `Refund request for ₹${returnReq.estimatedRefundAmount} successfully dispatched to Payment Admin (Port 3005)!`,
      returnRequest: returnReq
    });
  } catch (error) {
    next(error);
  }
};

