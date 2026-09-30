import mongoose from 'mongoose';
import { CallQueue } from '../models/CallQueue.js';
import { SupportTicket } from '../models/SupportTicket.js';
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
import { ReturnRequest } from '../models/ReturnRequest.js';
import { PaymentTransaction } from '../models/PaymentTransaction.js';
import { findBestAvailableSupportWorker, normalizeCategory } from './supportController.js';
import { getIO } from '../sockets/socketHandler.js';


// =========================================================================
// 1. CUSTOMER: INITIATE CALL REQUEST (Auto-Dialer Trigger)
// =========================================================================

// @desc    Customer requests an automated call-back with IVR intake
// @route   POST /api/call-queue/request-call
// @access  Private (Customer)
export const customerRequestCall = async (req, res, next) => {
  try {
    const { phone, language, reason, orderId, statement } = req.body;

    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: 'A valid phone number is required to initiate the call.' });
    }

    // Count available helpers
    const onlineAgents = await User.countDocuments({
      role: 'support_agent',
      isBlocked: false,
      supportDutyStatus: 'ONLINE'
    });

    // Resolve order if provided
    let resolvedOrder = null;
    let orderNumber = '';
    if (orderId) {
      resolvedOrder = await Order.findById(orderId);
      if (resolvedOrder) orderNumber = resolvedOrder.orderNumber;
    }

    // Calculate queue position
    const currentQueueSize = await CallQueue.countDocuments({
      queueStatus: { $in: ['IVR_IN_PROGRESS', 'QUEUED', 'CONNECTING'] }
    });

    const estimatedWait = currentQueueSize * 120; // ~2 min per call average

    // Normalize IVR reason to valid enum
    const VALID_REASONS = ['RETURN_EXCHANGE', 'ORDER_STATUS', 'PAYMENT_ISSUE', 'DELIVERY_PROBLEM', 'ACCOUNT_HELP', 'OTHER'];
    const normalizeCallReason = (r) => {
      if (!r) return 'OTHER';
      const u = String(r).toUpperCase();
      if (VALID_REASONS.includes(u)) return u;
      if (u.includes('RETURN') || u.includes('EXCHANGE')) return 'RETURN_EXCHANGE';
      if (u.includes('ORDER') || u.includes('STATUS')) return 'ORDER_STATUS';
      if (u.includes('PAY') || u.includes('REFUND')) return 'PAYMENT_ISSUE';
      if (u.includes('DELIV') || u.includes('SHIP') || u.includes('RIDER')) return 'DELIVERY_PROBLEM';
      if (u.includes('ACC') || u.includes('PROFILE')) return 'ACCOUNT_HELP';
      return 'OTHER';
    };

    const validatedReason = normalizeCallReason(reason);

    const chosenLanguage = String(language || 'ENGLISH').toUpperCase();

    let welcomePrompt = 'Welcome to NovaKart Customer Care! To check order status press 1, refund status press 2, other details press 3, to speak with our customer care representative press 9.';
    if (chosenLanguage === 'TELUGU') {
      welcomePrompt = 'నోవాకార్ట్ కస్టమర్ కేర్‌కు స్వాగతం! మీ ఆర్డర్ స్థితి కొరకు 1 నొక్కండి, రీఫండ్ స్థితి కొరకు 2 నొక్కండి, ఇతర వివరాల కొరకు 3 నొక్కండి, కస్టమర్ కేర్ ప్రతినిధితో మాట్లాడటానికి 9 నొక్కండి.';
    } else if (chosenLanguage === 'HINDI') {
      welcomePrompt = 'नोवाकार्ट ग्राहक सेवा में आपका स्वागत है! अपने ऑर्डर की स्थिति जांचने के लिए 1 दबाएं, रिफंड स्थिति के लिए 2 दबाएं, अन्य विवरण के लिए 3 दबाएं, ग्राहक सेवा प्रतिनिधि से बात करने के लिए 9 दबाएं।';
    } else if (chosenLanguage === 'TAMIL') {
      welcomePrompt = 'நோவாகார்ட் வாடிக்கையாளர் சேவைக்கு நல்வரவு! உங்கள் ஆர்டர் நிலைக்கு 1, ரீஃபண்ட் நிலைக்கு 2, பிற விவரங்களுக்கு 3, வாடிக்கையாளர் சேவையுடன் பேச 9 அழுத்துங்கள்.';
    }

    const callEntry = await CallQueue.create({
      customerId: req.user._id,
      customerName: req.user.name || 'Customer',
      customerPhone: phone.trim(),
      customerEmail: req.user.email || '',
      ivr: {
        language: chosenLanguage,
        reason: validatedReason,
        step: 'ISSUE_SELECT',
        orderId: resolvedOrder ? resolvedOrder._id : null,
        orderNumber,
        customerStatement: statement || '',
        ivrCompleted: false,
        ivrCompletedAt: null
      },

      queueStatus: 'IVR_IN_PROGRESS',
      queuePosition: currentQueueSize + 1,
      queueEnteredAt: new Date(),
      estimatedWaitSeconds: estimatedWait,
      callStartedAt: new Date(),
      callTranscript: [
        {
          sender: 'BOT',
          senderName: 'NovaKart IVR System',
          message: welcomePrompt,
          timestamp: new Date()
        }
      ],
      timeline: [
        {
          event: 'CALL_REQUESTED',
          details: `Customer initiated IVR call request at ${phone.trim()}. Preferred Language: ${chosenLanguage}.`,
          actor: req.user.name || 'Customer'
        },
        {
          event: 'IVR_STARTED',
          details: `Automated auto-dialer activated in ${chosenLanguage}. Voice prompt: ${welcomePrompt}`,
          actor: 'IVR Auto-Dialer'
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: welcomePrompt,
      call: callEntry
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Customer IVR Keypad Input (Multi-stage Spoken Language & Category Intake)
// @route   PUT /api/call-queue/:callId/ivr-key
// @access  Private (Customer)
export const ivrInputKeyPress = async (req, res, next) => {
  try {
    const { callId } = req.params;
    const { digit } = req.body;

    const call = await CallQueue.findById(callId);
    if (!call) {
      return res.status(404).json({ success: false, message: 'Active call session not found' });
    }

    const currentStep = call.ivr?.step || 'WELCOME_LANG';

    // STAGE 1: Welcome & Language Menu (Press 1: English, Press 2: Change Language)
    if (currentStep === 'WELCOME_LANG' || currentStep === 'LANG_SELECT') {
      if (String(digit) === '1') {
        call.ivr.language = 'ENGLISH';
        call.ivr.step = 'ISSUE_SELECT';

        call.callTranscript.push({
          sender: 'CUSTOMER',
          senderName: call.customerName || 'Customer',
          message: `[Pressed Key 1] Continued in English`,
          timestamp: new Date()
        });

        call.callTranscript.push({
          sender: 'BOT',
          senderName: 'NovaKart IVR System',
          message: `Language set to English. To check your Order Status, press 1. To check your Return & Refund Status, press 2. For Other details, press 3. To speak with our Customer Representative, press 9.`,
          timestamp: new Date()
        });

        await call.save();
        return res.json({
          success: true,
          message: `Language set to English. Select inquiry category.`,
          call
        });
      } else {
        // Pressed 2 or other key to change language
        call.ivr.step = 'SUB_LANG';

        call.callTranscript.push({
          sender: 'CUSTOMER',
          senderName: call.customerName || 'Customer',
          message: `[Pressed Key ${digit}] Change Language Options`,
          timestamp: new Date()
        });

        call.callTranscript.push({
          sender: 'BOT',
          senderName: 'NovaKart IVR System',
          message: `For Telugu press 1, Hindi press 2, Tamil press 3.`,
          timestamp: new Date()
        });

        await call.save();
        return res.json({
          success: true,
          message: `Select language: Press 1 for Telugu, 2 for Hindi, 3 for Tamil.`,
          call
        });
      }
    }

    // STAGE 2: Sub-Language Menu Selection (1: Telugu, 2: Hindi, 3: Tamil)
    if (currentStep === 'SUB_LANG') {
      const subLangMap = { '1': 'TELUGU', '2': 'HINDI', '3': 'TAMIL' };
      const selectedLang = subLangMap[String(digit)] || 'TELUGU';

      call.ivr.language = selectedLang;
      call.ivr.step = 'ISSUE_SELECT';

      let spokenMenuMsg = '';
      if (selectedLang === 'TELUGU') {
        spokenMenuMsg = `మీ సహాయక భాష తెలుగుగా మార్చబడినది. మీ ఆర్డర్ వర్తమాన స్థితికి 1 నొక్కండి. రిఫండ్ వర్తమాన స్థితికి 2 నొక్కండి. ఇతర విషయములకు 3 నొక్కండి. కస్టమర్ కేర్ ప్రతినిధితో మాట్లాడటానికి 9 నొక్కండి.`;
      } else if (selectedLang === 'HINDI') {
        spokenMenuMsg = `आपकी भाषा हिंदी सेट की गई है। ऑर्डर स्थिति के लिए 1 दबाएं। रिफंड स्थिति के लिए 2 दबाएं। अन्य जानकारी के लिए 3 दबाएं। कस्टमर सपोर्ट से बात करने के लिए 9 दबाएं।`;
      } else {
        spokenMenuMsg = `தமிழ் தேர்வு செய்யப்பட்டது. உங்கள் ஆர்டர் நிலைக்கு 1 அழுத்தவும். ரீஃபண்ட் நிலைக்கு 2 அழுத்தவும். பிற விவரங்களுக்கு 3 அழுத்தவும். வாடிக்கையாளர் பிரிவை தொடர்புகொள்ள 9 அழுத்தவும்.`;
      }

      call.callTranscript.push({
        sender: 'CUSTOMER',
        senderName: call.customerName || 'Customer',
        message: `[Pressed Key ${digit}] Selected Language: ${selectedLang}`,
        timestamp: new Date()
      });

      call.callTranscript.push({
        sender: 'BOT',
        senderName: 'NovaKart IVR System',
        message: spokenMenuMsg,
        timestamp: new Date()
      });

      await call.save();
      return res.json({
        success: true,
        message: `Language set to ${selectedLang}. Select inquiry category.`,
        call
      });
    }

    // STAGE 3: Inquiry Category Selection
    if (currentStep === 'ISSUE_SELECT') {
      const reasonMap = {
        '1': 'ORDER_STATUS',
        '2': 'RETURN_EXCHANGE',
        '3': 'PAYMENT_ISSUE',
        '9': 'OTHER'
      };
      const selectedReason = reasonMap[String(digit)] || 'OTHER';

      call.ivr.reason = selectedReason;
      call.ivr.step = 'ROUTING';
      call.ivr.ivrCompleted = true;
      call.ivr.ivrCompletedAt = new Date();

      call.queueStatus = 'QUEUED';
      call.queueEnteredAt = new Date();

      call.callTranscript.push({
        sender: 'CUSTOMER',
        senderName: call.customerName || 'Customer',
        message: `[Pressed Key ${digit}] Selected Category: ${selectedReason.replace('_', ' ')}`,
        timestamp: new Date()
      });

      call.callTranscript.push({
        sender: 'BOT',
        senderName: 'NovaKart IVR System',
        message: `This call is being recorded for quality and training purposes. Our support team will connect with you shortly. Please wait, do not cut the call.`,
        timestamp: new Date()
      });

      await call.save();

      // Broadcast new queued call to all online support staff via Socket.IO
      try {
        const io = getIO();
        if (io) {
          io.to('support_staff').emit('call_queued_broadcast', {
            callId: call._id,
            customerName: call.customerName,
            customerPhone: call.customerPhone,
            language: call.ivr.language,
            reason: call.ivr.reason,
            orderNumber: call.ivr.orderNumber
          });
        }
      } catch (err) { /* silent */ }

      return res.json({
        success: true,
        message: `Call recorded and routed to ${call.ivr.language} support team! Free helpers are being notified.`,
        call
      });
    }

    res.json({ success: true, call });
  } catch (error) {
    next(error);
  }
};

// @desc    Customer: Check call status and queue position
// @route   GET /api/call-queue/my-calls
// @access  Private (Customer)
export const customerGetMyCalls = async (req, res, next) => {
  try {
    const calls = await CallQueue.find({ customerId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    // Update queue positions live
    for (const call of calls) {
      if (['QUEUED', 'IVR_IN_PROGRESS'].includes(call.queueStatus)) {
        const aheadInQueue = await CallQueue.countDocuments({
          queueStatus: 'QUEUED',
          queueEnteredAt: { $lt: call.queueEnteredAt }
        });
        call.queuePosition = aheadInQueue + 1;
        call.estimatedWaitSeconds = call.queuePosition * 120;
      }
    }

    res.json({ success: true, count: calls.length, calls });
  } catch (error) {
    next(error);
  }
};

// @desc    Customer: Cancel a queued call request
// @route   PUT /api/call-queue/:callId/cancel
// @access  Private (Customer)
export const customerCancelCall = async (req, res, next) => {
  try {
    const call = await CallQueue.findById(req.params.callId);
    if (!call) {
      return res.status(404).json({ success: false, message: 'Call not found' });
    }
    if (call.customerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (['COMPLETED', 'CANCELLED'].includes(call.queueStatus)) {
      return res.status(400).json({ success: false, message: 'Call is already finished.' });
    }

    call.queueStatus = 'CANCELLED';
    call.callEndedAt = new Date();
    call.holdMusicPlaying = false;
    
    if (call.callConnectedAt) {
      call.callDurationSeconds = Math.round((Date.now() - new Date(call.callConnectedAt).getTime()) / 1000);
    }

    call.timeline.push({
      event: 'CALL_CANCELLED',
      details: `Customer ${req.user.name || 'Customer'} ended/cut the call.`,
      actor: req.user.name || 'Customer'
    });
    await call.save();

    // Free assigned support agent
    if (call.assignedAgentId) {
      await User.findByIdAndUpdate(call.assignedAgentId, { supportDutyStatus: 'ONLINE' });
    }

    // Broadcast Socket.IO event to support staff so helper auto-cuts call session
    try {
      const io = getIO();
      if (io) {
        io.to('support_staff').emit('call_ended_by_customer', {
          callId: String(call._id),
          customerName: call.customerName || 'Customer',
          reason: 'CUSTOMER_HUNG_UP'
        });
        io.emit('call_ended_by_customer', {
          callId: String(call._id),
          customerName: call.customerName || 'Customer',
          reason: 'CUSTOMER_HUNG_UP'
        });
        io.to('support_staff').emit('call_claimed_by_agent', {
          callId: String(call._id)
        });
      }
    } catch (err) { /* silent */ }

    res.json({ success: true, message: 'Call request ended cleanly.', call });
  } catch (error) {
    next(error);
  }
};

// @desc    Customer: Accept an incoming call request from officer
// @route   PUT /api/call-queue/:callId/accept-call
// @access  Private (Customer)
export const customerAcceptCall = async (req, res, next) => {
  try {
    const call = await CallQueue.findById(req.params.callId);
    if (!call) {
      return res.status(404).json({ success: false, message: 'Call session not found' });
    }
    if (call.customerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    call.queueStatus = 'CONNECTED';
    call.callConnectedAt = call.callConnectedAt || new Date();
    call.holdMusicPlaying = false;
    
    call.callTranscript.push({
      sender: 'SYSTEM',
      senderName: 'Telephony Engine',
      message: `🟢 CALL CONNECTED: Customer ${req.user.name || 'Customer'} accepted incoming call from support officer.`,
      timestamp: new Date()
    });

    call.timeline.push({
      event: 'CUSTOMER_ACCEPTED_CALL',
      details: `Customer ${req.user.name || 'Customer'} accepted incoming call line.`,
      actor: req.user.name || 'Customer'
    });

    await call.save();

    res.json({
      success: true,
      message: 'Call accepted & line connected!',
      call
    });
  } catch (error) {
    next(error);
  }
};


// =========================================================================
// 2. SUPPORT AGENT: CALL QUEUE MANAGEMENT
// =========================================================================

// @desc    Agent: Get incoming call queue (calls waiting for pickup)
// @route   GET /api/call-queue/agent/incoming
// @access  Private (Support Agent / Admin)
export const agentGetIncomingQueue = async (req, res, next) => {
  try {
    const workerEmail = req.user.email;
    const workerId = req.user.workerId || '';

    // Calls specifically assigned to this agent
    const myAssigned = await CallQueue.find({
      $or: [
        { 'assignedAgent.email': workerEmail },
        { 'assignedAgent.workerId': workerId }
      ],
      queueStatus: { $in: ['CONNECTING', 'CONNECTED', 'ON_HOLD'] }
    })
      .populate('customerId', 'name email phone avatar')
      .populate('ivr.orderId', 'orderNumber totalAmount orderStatus')
      .sort({ queueEnteredAt: 1 });

    // General queue (unassigned or waiting)
    const waitingQueue = await CallQueue.find({
      queueStatus: { $in: ['QUEUED', 'IVR_IN_PROGRESS'] }
    })
      .populate('customerId', 'name email phone avatar')
      .populate('ivr.orderId', 'orderNumber totalAmount orderStatus')
      .sort({ queueEnteredAt: 1 });

    // Active calls by all agents
    const allActiveCalls = await CallQueue.countDocuments({
      queueStatus: { $in: ['CONNECTED', 'ON_HOLD'] }
    });

    const onlineAgents = await User.countDocuments({
      role: 'support_agent',
      isBlocked: false,
      supportDutyStatus: 'ONLINE'
    });

    res.json({
      success: true,
      myAssigned,
      waitingQueue,
      stats: {
        totalWaiting: waitingQueue.length,
        myActiveCalls: myAssigned.filter(c => ['CONNECTED', 'ON_HOLD'].includes(c.queueStatus)).length,
        allActiveCalls,
        onlineAgents
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Agent: Accept/Pick up a call from the queue
// @route   PUT /api/call-queue/agent/:callId/accept
// @access  Private (Support Agent / Admin)
export const agentAcceptCall = async (req, res, next) => {
  try {
    const call = await CallQueue.findById(req.params.callId);
    if (!call) {
      return res.status(404).json({ success: false, message: 'Call not found in queue' });
    }

    if (['COMPLETED', 'CANCELLED', 'ABANDONED'].includes(call.queueStatus)) {
      return res.status(400).json({ success: false, message: 'This call is no longer active.' });
    }

    // Check if agent is already on another call
    const existingCall = await CallQueue.findOne({
      'assignedAgent.email': req.user.email,
      queueStatus: { $in: ['CONNECTED'] }
    });

    if (existingCall) {
      return res.status(400).json({
        success: false,
        message: `You are already on an active call (${existingCall.callId}). Please end that call first or put it on hold.`
      });
    }

    const waitDuration = call.queueEnteredAt
      ? Math.round((Date.now() - new Date(call.queueEnteredAt).getTime()) / 1000)
      : 0;

    call.assignedAgentId = req.user._id;
    call.assignedAgent = {
      workerId: req.user.workerId || 'WRK-01',
      name: req.user.name,
      email: req.user.email,
      language: call.ivr?.language || 'ENGLISH',
      specialty: req.user.specialty || 'General Support'
    };
    call.queueStatus = 'CONNECTED';
    call.callConnectedAt = new Date();
    call.waitDurationSeconds = waitDuration;
    call.holdMusicPlaying = false;
    call.queuePosition = 0;
    
    // Calculate hold time
    if (call.holdStartedAt) {
      call.totalHoldSeconds += Math.round((Date.now() - new Date(call.holdStartedAt).getTime()) / 1000);
      call.holdStartedAt = null;
    }

    if (!call.callTranscript || call.callTranscript.length === 0) {
      call.callTranscript = [
        {
          sender: 'SYSTEM',
          senderName: 'Telephony Auto-Router',
          message: `🟢 CALL CONNECTED: Connected with Officer ${req.user.name} (${req.user.workerId || 'WRK'}). Preferred Language: ${call.ivr?.language || 'ENGLISH'}.`,
          timestamp: new Date()
        },
        {
          sender: 'AGENT',
          senderName: req.user.name,
          message: `Hello ${call.customerName || 'Customer'}! My name is ${req.user.name}. I am reviewing your inquiry regarding ${call.ivr?.reason || 'your order'}. How can I assist you today?`,
          timestamp: new Date()
        }
      ];
    }

    call.timeline.push({
      event: 'CALL_CONNECTED',
      details: `Agent ${req.user.name} (${req.user.workerId || 'WRK'}) picked up the call. Customer waited ${Math.ceil(waitDuration / 60)} min. Language: ${call.ivr?.language || 'ENGLISH'}.`,
      actor: req.user.name
    });

    await call.save();


    // Update agent status
    await User.findByIdAndUpdate(req.user._id, { supportDutyStatus: 'IN_CONSULTATION' });

    // Reposition remaining queue
    const remainingQueued = await CallQueue.find({ queueStatus: 'QUEUED' }).sort({ queueEnteredAt: 1 });
    for (let i = 0; i < remainingQueued.length; i++) {
      remainingQueued[i].queuePosition = i + 1;
      remainingQueued[i].estimatedWaitSeconds = (i + 1) * 120;
      await remainingQueued[i].save();
    }

    res.json({
      success: true,
      message: `Connected to ${call.customerName} (${call.customerPhone}). Language: ${call.ivr?.language}. Reason: ${call.ivr?.reason}. ${call.ivr?.orderNumber ? `Order: ${call.ivr.orderNumber}` : ''}`,
      call
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Agent: Put call on hold
// @route   PUT /api/call-queue/agent/:callId/hold
// @access  Private (Support Agent / Admin)
export const agentHoldCall = async (req, res, next) => {
  try {
    const call = await CallQueue.findById(req.params.callId);
    if (!call) {
      return res.status(404).json({ success: false, message: 'Call not found' });
    }

    if (call.queueStatus === 'ON_HOLD') {
      // Resume from hold
      if (call.holdStartedAt) {
        call.totalHoldSeconds += Math.round((Date.now() - new Date(call.holdStartedAt).getTime()) / 1000);
      }
      call.queueStatus = 'CONNECTED';
      call.holdMusicPlaying = false;
      call.holdStartedAt = null;
      call.timeline.push({
        event: 'HOLD_RESUMED',
        details: `Agent ${req.user.name} resumed the call. Total hold time: ${call.totalHoldSeconds}s.`,
        actor: req.user.name
      });
    } else if (call.queueStatus === 'CONNECTED') {
      // Put on hold
      call.queueStatus = 'ON_HOLD';
      call.holdMusicPlaying = true;
      call.holdStartedAt = new Date();
      call.timeline.push({
        event: 'CALL_ON_HOLD',
        details: `Agent ${req.user.name} placed customer on hold. Hold music activated.`,
        actor: req.user.name
      });
    }

    await call.save();

    res.json({
      success: true,
      message: call.queueStatus === 'ON_HOLD' ? 'Customer placed on hold with music.' : 'Call resumed from hold.',
      call
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Agent: Transfer call to another agent
// @route   PUT /api/call-queue/agent/:callId/transfer
// @access  Private (Support Agent / Admin)
export const agentTransferCall = async (req, res, next) => {
  try {
    const { targetWorkerId, reason } = req.body;
    const call = await CallQueue.findById(req.params.callId);
    if (!call) {
      return res.status(404).json({ success: false, message: 'Call not found' });
    }

    // Find target agent
    const targetAgent = await User.findOne({ workerId: targetWorkerId, role: 'support_agent', isBlocked: false });
    if (!targetAgent) {
      return res.status(404).json({ success: false, message: 'Target agent not found or unavailable.' });
    }

    // Check if target is on call
    const targetOnCall = await CallQueue.findOne({
      'assignedAgent.email': targetAgent.email,
      queueStatus: { $in: ['CONNECTED'] }
    });

    // Save previous agent
    call.previousAgents.push({
      workerId: call.assignedAgent.workerId,
      name: call.assignedAgent.name,
      transferredAt: new Date(),
      reason: reason || 'Transferred by agent'
    });

    call.assignedAgentId = targetAgent._id;
    call.assignedAgent = {
      workerId: targetAgent.workerId,
      name: targetAgent.name,
      email: targetAgent.email,
      language: call.ivr?.language || 'ENGLISH',
      specialty: targetAgent.specialty || 'General Support'
    };

    if (targetOnCall) {
      // Target is busy, put caller on hold
      call.queueStatus = 'ON_HOLD';
      call.holdMusicPlaying = true;
      call.holdStartedAt = new Date();
      call.timeline.push({
        event: 'CALL_TRANSFERRED_HOLD',
        details: `Call transferred from ${req.user.name} to ${targetAgent.name}. Target agent is busy—customer on hold with music.`,
        actor: req.user.name
      });
    } else {
      call.queueStatus = 'CONNECTING';
      call.timeline.push({
        event: 'CALL_TRANSFERRED',
        details: `Call transferred from ${req.user.name} to ${targetAgent.name} (${targetAgent.workerId}). Reason: ${reason || 'Specialization routing'}.`,
        actor: req.user.name
      });
    }

    await call.save();

    // Free up previous agent
    await User.findByIdAndUpdate(req.user._id, { supportDutyStatus: 'ONLINE' });

    res.json({
      success: true,
      message: `Call transferred to ${targetAgent.name}${targetOnCall ? ' (on hold—agent busy)' : ''}.`,
      call
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Agent: End call with resolution
// @route   PUT /api/call-queue/agent/:callId/end
// @access  Private (Support Agent / Admin)
export const agentEndCall = async (req, res, next) => {
  try {
    const { outcome, resolutionNotes, qualityScore } = req.body;
    const call = await CallQueue.findById(req.params.callId);
    if (!call) {
      return res.status(404).json({ success: false, message: 'Call not found' });
    }

    call.callEndedAt = new Date();
    if (call.callConnectedAt) {
      call.callDurationSeconds = Math.round((Date.now() - new Date(call.callConnectedAt).getTime()) / 1000);
    }
    
    // Finalize hold time
    if (call.holdStartedAt) {
      call.totalHoldSeconds += Math.round((Date.now() - new Date(call.holdStartedAt).getTime()) / 1000);
      call.holdStartedAt = null;
    }

    call.queueStatus = 'COMPLETED';
    call.holdMusicPlaying = false;
    call.outcome = outcome || 'RESOLVED';
    call.resolutionNotes = resolutionNotes || '';
    call.qualityScore = qualityScore || 0;

    const durationMin = Math.floor(call.callDurationSeconds / 60);
    const durationSec = call.callDurationSeconds % 60;

    call.timeline.push({
      event: 'CALL_ENDED',
      details: `Call ended by Agent ${req.user.name}. Duration: ${durationMin}m ${durationSec}s. Outcome: ${outcome || 'RESOLVED'}. ${resolutionNotes ? 'Notes: ' + resolutionNotes : ''}`,
      actor: req.user.name
    });

    await call.save();

    // Set agent back to ONLINE
    await User.findByIdAndUpdate(req.user._id, { supportDutyStatus: 'ONLINE' });

    // Check if any queued calls can now be routed to this agent
    const nextInQueue = await CallQueue.findOne({
      queueStatus: 'QUEUED'
    }).sort({ queueEnteredAt: 1 });

    let nextCallInfo = null;
    if (nextInQueue) {
      nextCallInfo = {
        callId: nextInQueue._id,
        customerName: nextInQueue.customerName,
        customerPhone: nextInQueue.customerPhone,
        reason: nextInQueue.ivr?.reason,
        language: nextInQueue.ivr?.language,
        waitingMinutes: Math.ceil((Date.now() - new Date(nextInQueue.queueEnteredAt).getTime()) / 60000)
      };
    }

    // Also check for ON_HOLD calls waiting for this agent
    const holdCall = await CallQueue.findOne({
      'assignedAgent.email': req.user.email,
      queueStatus: 'ON_HOLD'
    }).sort({ holdStartedAt: 1 });

    let holdCallInfo = null;
    if (holdCall) {
      holdCallInfo = {
        callId: holdCall._id,
        customerName: holdCall.customerName,
        holdDuration: Math.ceil((Date.now() - new Date(holdCall.holdStartedAt || holdCall.createdAt).getTime()) / 60000)
      };
    }

    res.json({
      success: true,
      message: `Call with ${call.customerName} ended (${durationMin}m ${durationSec}s). Outcome: ${outcome || 'RESOLVED'}.`,
      call,
      nextInQueue: nextCallInfo,
      pendingHoldCall: holdCallInfo
    });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 3. ADMIN: QUEUE MONITORING & ANALYTICS
// =========================================================================

// @desc    Admin: Get full call queue dashboard stats
// @route   GET /api/call-queue/admin/dashboard
// @access  Private (Admin)
export const adminGetCallQueueDashboard = async (req, res, next) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Live queue counts
    const queuedCalls = await CallQueue.countDocuments({ queueStatus: 'QUEUED' });
    const connectingCalls = await CallQueue.countDocuments({ queueStatus: 'CONNECTING' });
    const activeCalls = await CallQueue.countDocuments({ queueStatus: { $in: ['CONNECTED', 'ON_HOLD'] } });
    const holdCalls = await CallQueue.countDocuments({ queueStatus: 'ON_HOLD' });

    // Today's metrics
    const todayCalls = await CallQueue.countDocuments({ createdAt: { $gte: todayStart } });
    const todayCompleted = await CallQueue.countDocuments({ 
      queueStatus: 'COMPLETED',
      callEndedAt: { $gte: todayStart }
    });
    const todayAbandoned = await CallQueue.countDocuments({
      queueStatus: { $in: ['ABANDONED', 'MISSED'] },
      createdAt: { $gte: todayStart }
    });

    // Average wait and duration
    const avgMetrics = await CallQueue.aggregate([
      { $match: { queueStatus: 'COMPLETED', callEndedAt: { $gte: todayStart } } },
      {
        $group: {
          _id: null,
          avgWait: { $avg: '$waitDurationSeconds' },
          avgDuration: { $avg: '$callDurationSeconds' },
          avgHold: { $avg: '$totalHoldSeconds' },
          avgQuality: { $avg: '$qualityScore' }
        }
      }
    ]);

    // Language distribution
    const languageDistribution = await CallQueue.aggregate([
      { $match: { createdAt: { $gte: todayStart } } },
      { $group: { _id: '$ivr.language', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Reason distribution
    const reasonDistribution = await CallQueue.aggregate([
      { $match: { createdAt: { $gte: todayStart } } },
      { $group: { _id: '$ivr.reason', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Agent performance
    const agentStats = await CallQueue.aggregate([
      { $match: { queueStatus: 'COMPLETED', callEndedAt: { $gte: todayStart } } },
      {
        $group: {
          _id: '$assignedAgent.name',
          callsHandled: { $sum: 1 },
          avgDuration: { $avg: '$callDurationSeconds' },
          avgQuality: { $avg: '$qualityScore' },
          resolved: {
            $sum: { $cond: [{ $eq: ['$outcome', 'RESOLVED'] }, 1, 0] }
          }
        }
      },
      { $sort: { callsHandled: -1 } }
    ]);

    // Live queue (detailed)
    const liveQueue = await CallQueue.find({
      queueStatus: { $in: ['QUEUED', 'CONNECTING', 'CONNECTED', 'ON_HOLD', 'IVR_IN_PROGRESS'] }
    })
      .populate('customerId', 'name email phone avatar')
      .sort({ queueEnteredAt: 1 });

    const onlineAgents = await User.find({
      role: 'support_agent',
      isBlocked: false,
      supportDutyStatus: { $in: ['ONLINE', 'IN_CONSULTATION'] }
    }).select('name workerId specialty supportDutyStatus avatar');

    res.json({
      success: true,
      liveMetrics: {
        queuedCalls,
        connectingCalls,
        activeCalls,
        holdCalls,
        totalLive: queuedCalls + connectingCalls + activeCalls
      },
      todayMetrics: {
        totalCalls: todayCalls,
        completedCalls: todayCompleted,
        abandonedCalls: todayAbandoned,
        resolutionRate: todayCalls > 0 ? Math.round((todayCompleted / todayCalls) * 100) : 100,
        avgWaitSeconds: Math.round(avgMetrics[0]?.avgWait || 0),
        avgDurationSeconds: Math.round(avgMetrics[0]?.avgDuration || 0),
        avgHoldSeconds: Math.round(avgMetrics[0]?.avgHold || 0),
        avgQualityScore: (avgMetrics[0]?.avgQuality || 0).toFixed(1)
      },
      languageDistribution,
      reasonDistribution,
      agentStats,
      liveQueue,
      onlineAgents
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Get call history with filters
// @route   GET /api/call-queue/admin/history
// @access  Private (Admin)
export const adminGetCallHistory = async (req, res, next) => {
  try {
    const { status, language, reason, agent, limit } = req.query;
    const filter = {};

    if (status && status !== 'ALL') filter.queueStatus = status;
    if (language && language !== 'ALL') filter['ivr.language'] = language;
    if (reason && reason !== 'ALL') filter['ivr.reason'] = reason;
    if (agent) filter['assignedAgent.name'] = { $regex: agent, $options: 'i' };

    const calls = await CallQueue.find(filter)
      .populate('customerId', 'name email phone avatar')
      .populate({
        path: 'ivr.orderId',
        select: 'orderNumber totalAmount orderStatus items createdAt'
      })
      .sort({ createdAt: -1 })
      .limit(Number(limit) || 100);

    // Ensure calls have recording URL / fallback demo audio if missing
    const formattedCalls = calls.map(c => {
      const callObj = c.toObject();
      if (!callObj.recordingUrl) {
        callObj.recordingUrl = 'https://actions.google.com/sounds/v1/ambiences/office_voices.ogg';
      }
      return callObj;
    });

    res.json({ success: true, count: formattedCalls.length, calls: formattedCalls });
  } catch (error) {
    next(error);
  }
};

// @desc    Agent: Get call history for support helper
// @route   GET /api/call-queue/agent/history
// @access  Private (Support Agent / Admin)
export const agentGetCallHistory = async (req, res, next) => {
  try {
    const { status, language, limit } = req.query;
    const filter = {};

    // Helper views calls assigned to them or completed
    if (req.user.role === 'support_agent') {
      filter.$or = [
        { assignedAgentId: req.user._id },
        { 'assignedAgent.email': req.user.email },
        { 'assignedAgent.workerId': req.user.workerId },
        { queueStatus: 'COMPLETED' }
      ];
    }

    if (status && status !== 'ALL') filter.queueStatus = status;
    if (language && language !== 'ALL') filter['ivr.language'] = language;

    const calls = await CallQueue.find(filter)
      .populate('customerId', 'name email phone avatar')
      .populate({
        path: 'ivr.orderId',
        select: 'orderNumber totalAmount orderStatus items createdAt'
      })
      .sort({ createdAt: -1 })
      .limit(Number(limit) || 50);

    const formattedCalls = calls.map(c => {
      const callObj = c.toObject();
      if (!callObj.recordingUrl) {
        callObj.recordingUrl = 'https://actions.google.com/sounds/v1/ambiences/office_voices.ogg';
      }
      return callObj;
    });

    res.json({ success: true, count: formattedCalls.length, calls: formattedCalls });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Force assign a queued call to specific agent
// @route   PUT /api/call-queue/admin/:callId/force-assign
// @access  Private (Admin)
export const adminForceAssignCall = async (req, res, next) => {
  try {
    const { workerId } = req.body;
    const call = await CallQueue.findById(req.params.callId);
    if (!call) {
      return res.status(404).json({ success: false, message: 'Call not found' });
    }

    const agent = await User.findOne({ workerId, role: 'support_agent' });
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    call.assignedAgentId = agent._id;
    call.assignedAgent = {
      workerId: agent.workerId,
      name: agent.name,
      email: agent.email,
      language: call.ivr?.language || 'ENGLISH',
      specialty: agent.specialty || ''
    };
    call.queueStatus = 'CONNECTING';
    call.timeline.push({
      event: 'ADMIN_FORCE_ASSIGNED',
      details: `Admin force-assigned call to Agent ${agent.name} (${agent.workerId}).`,
      actor: req.user.name || 'Admin'
    });
    await call.save();

    res.json({
      success: true,
      message: `Call force-assigned to ${agent.name}.`,
      call
    });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 4. PUBLIC: Available helpers count (for customer UI)
// =========================================================================

// @desc    Get count of online helpers and queue size
// @route   GET /api/call-queue/availability
// @access  Public
export const getCallQueueAvailability = async (req, res, next) => {
  try {
    const onlineAgents = await User.countDocuments({
      role: 'support_agent',
      isBlocked: false,
      supportDutyStatus: 'ONLINE'
    });
    const inConsultation = await User.countDocuments({
      role: 'support_agent',
      isBlocked: false,
      supportDutyStatus: 'IN_CONSULTATION'
    });
    const queueSize = await CallQueue.countDocuments({
      queueStatus: { $in: ['QUEUED', 'IVR_IN_PROGRESS'] }
    });

    const agents = await User.find({
      role: 'support_agent',
      isBlocked: false
    }).select('name workerId specialty supportDutyStatus avatar');

    res.json({
      success: true,
      availability: {
        onlineAgents,
        inConsultation,
        totalAgents: onlineAgents + inConsultation,
        queueSize,
        estimatedWaitMinutes: queueSize > 0 ? Math.ceil((queueSize * 120) / 60) : 0
      },
      agents: agents.map(a => ({
        name: a.name,
        workerId: a.workerId,
        specialty: a.specialty,
        status: a.supportDutyStatus,
        avatar: a.avatar
      }))
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Post speech/text message into live telephony call session
// @route   POST /api/call-queue/:callId/speech
// @access  Private
export const postCallSpeech = async (req, res, next) => {
  try {
    const { callId } = req.params;
    const { message, sender, senderName } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Speech message content is required' });
    }

    const call = await CallQueue.findById(callId);
    if (!call) {
      return res.status(404).json({ success: false, message: 'Active call session not found' });
    }

    const speechSender = sender || (req.user.role === 'customer' || req.user._id.toString() === call.customerId.toString() ? 'CUSTOMER' : 'AGENT');
    const name = senderName || req.user.name || (speechSender === 'CUSTOMER' ? 'Customer' : 'Support Officer');

    const entry = {
      sender: speechSender,
      senderName: name,
      message: message.trim(),
      timestamp: new Date()
    };

    call.callTranscript.push(entry);
    await call.save();

    res.json({
      success: true,
      message: 'Speech transmitted to telephony session',
      transcript: call.callTranscript,
      call
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get live telephony call transcript and session state
// @route   GET /api/call-queue/:callId/transcript
// @access  Private
export const getCallTranscript = async (req, res, next) => {
  try {
    const { callId } = req.params;
    const call = await CallQueue.findById(callId)
      .populate('customerId', 'name email phone avatar')
      .populate('ivr.orderId', 'orderNumber totalAmount orderStatus items');

    if (!call) {
      return res.status(404).json({ success: false, message: 'Call session not found' });
    }

    res.json({
      success: true,
      callStatus: call.queueStatus,
      assignedAgent: call.assignedAgent,
      customerName: call.customerName,
      customerPhone: call.customerPhone,
      transcript: call.callTranscript || [],
      call
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Customer: Submit post-call star rating & review feedback
// @route   POST /api/call-queue/:callId/feedback
// @access  Private (Customer)
export const submitCallFeedback = async (req, res, next) => {
  try {
    const { callId } = req.params;
    const { rating, reviewText, tags } = req.body;

    const call = await CallQueue.findById(callId);
    if (!call) {
      return res.status(404).json({ success: false, message: 'Call session not found' });
    }

    const numericRating = Math.min(5, Math.max(1, Number(rating) || 5));

    call.customerFeedback = {
      rating: numericRating,
      reviewText: reviewText || '',
      tags: Array.isArray(tags) ? tags : [],
      submittedAt: new Date()
    };
    call.qualityScore = numericRating;

    call.timeline.push({
      event: 'CUSTOMER_FEEDBACK_SUBMITTED',
      details: `Customer rated ${numericRating} ⭐. Review: "${reviewText || 'No comment'}"`,
      actor: req.user?.name || 'Customer'
    });

    await call.save();

    // Update assigned support agent's average rating in User schema
    if (call.assignedAgentId) {
      const agent = await User.findById(call.assignedAgentId);
      if (agent) {
        const currentCount = agent.supportRatingCount || 0;
        const currentRating = agent.supportRating || 5.0;
        const newCount = currentCount + 1;
        const newAvg = Number(((currentRating * currentCount + numericRating) / newCount).toFixed(1));

        agent.supportRating = newAvg;
        agent.supportRatingCount = newCount;
        await agent.save();
      }
    }

    res.json({
      success: true,
      message: 'Thank you for your feedback! Your review helps us improve.',
      feedback: call.customerFeedback
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get support reviews for agent or admin dashboard
// @route   GET /api/call-queue/agent/reviews
// @access  Private (Support/Admin)
export const getAgentFeedbackReviews = async (req, res, next) => {
  try {
    const filter = { 'customerFeedback.submittedAt': { $ne: null } };
    if (req.user?.role === 'support_agent') {
      filter.assignedAgentId = req.user._id;
    }

    const reviews = await CallQueue.find(filter)
      .select('callId customerName customerPhone customerFeedback assignedAgent createdAt callDurationSeconds')
      .sort({ 'customerFeedback.submittedAt': -1 })
      .limit(50);

    const totalReviews = reviews.length;
    const avgRating = totalReviews > 0
      ? Number((reviews.reduce((acc, r) => acc + (r.customerFeedback?.rating || 0), 0) / totalReviews).toFixed(1))
      : 5.0;

    res.json({
      success: true,
      totalReviews,
      avgRating,
      reviews
    });
  } catch (error) {
    next(error);
  }
};

