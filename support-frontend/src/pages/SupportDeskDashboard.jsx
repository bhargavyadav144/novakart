import React, { useState, useEffect, useRef } from 'react';
import { useSupportAuth } from '../context/SupportAuthContext';
import supportApi from '../services/supportApi';

export default function SupportDeskDashboard() {
  const { worker, logout, updateDutyStatus, liveTicketAlert, clearAlert, socket } = useSupportAuth();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('MY_ASSIGNED'); // 'MY_ASSIGNED', 'CALL_BACK', 'UNASSIGNED', 'ALL', 'RESOLVED'
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Case View Sub-Tab: 'ORDER_WORKBENCH' vs 'CHAT_THREAD'
  const [caseViewMode, setCaseViewMode] = useState('ORDER_WORKBENCH'); // Default to Order Diagnostic Workbench!

  // Chat message & quick replies
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // ==========================================
  // TELEPHONY & PERSISTENT LIVE CALL BAR STATE
  // ==========================================
  const [activeCallTicket, setActiveCallTicket] = useState(null);
  const [callTimer, setCallTimer] = useState(0);
  const [callIntervalId, setCallIntervalId] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callOutcome, setCallOutcome] = useState('RESOLVED_ON_CALL');
  const [callNotes, setCallNotes] = useState('');
  const [isCallMinimized, setIsCallMinimized] = useState(false);

  // ==========================================
  // ORDER INVESTIGATION & DIAGNOSTICS WORKBENCH
  // ==========================================
  const [orderSearchInput, setOrderSearchInput] = useState('');
  const [inspectedOrderData, setInspectedOrderData] = useState(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  // ==========================================
  // RESOLUTION ACTIONS MODALS
  // ==========================================
  const [actionModalType, setActionModalType] = useState(null); // 'REFUND', 'PICKUP', 'EXPEDITE', 'GOODWILL', 'CANCEL'
  const [actionFormData, setActionFormData] = useState({
    amount: '',
    reason: '',
    exchangeOrRefund: 'REFUND',
    priorityNotes: '',
    cancellationReason: ''
  });

  const chatBottomRef = useRef(null);

  // ==========================================
  // CALL QUEUE & CALL HISTORY STATE
  // ==========================================
  const [callQueueData, setCallQueueData] = useState({ myAssigned: [], waitingQueue: [], stats: {} });
  const [callQueueLoading, setCallQueueLoading] = useState(false);
  const [activeQueueCall, setActiveQueueCall] = useState(null); // The call currently connected
  const [showCallQueue, setShowCallQueue] = useState(true);
  const [helperCallHistory, setHelperCallHistory] = useState([]);
  const [callHistoryLoading, setCallHistoryLoading] = useState(false);
  const [selectedHistoryCall, setSelectedHistoryCall] = useState(null);

  const fetchHelperCallHistory = async () => {
    setCallHistoryLoading(true);
    try {
      const { data } = await supportApi.get('/call-queue/agent/history');
      if (data.success) {
        setHelperCallHistory(data.calls || []);
      }
    } catch (err) {
      console.error('Error fetching helper call history:', err);
    } finally {
      setCallHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'CALL_HISTORY') {
      fetchHelperCallHistory();
    } else {
      fetchTickets();
    }
  }, [activeTab, categoryFilter]);

  // Poll incoming call queue every 8 seconds
  useEffect(() => {
    fetchCallQueue();
    const interval = setInterval(fetchCallQueue, 8000);
    return () => clearInterval(interval);
  }, []);

  // Listen for real-time Socket.IO call queue events (Multi-Agent Race Condition Removal)
  useEffect(() => {
    if (!socket) return;
    socket.emit('join_support_room', { workerId: worker?._id, language: worker?.languages });

    const handleCallClaimed = (data) => {
      if (data && data.callId) {
        setCallQueueData(prev => ({
          ...prev,
          waitingQueue: (prev.waitingQueue || []).filter(c => (c._id || c.callId) !== data.callId)
        }));
      }
    };

    const handleCallQueued = () => {
      fetchCallQueue();
    };

    const handleCustomerCutCall = (data) => {
      setActiveQueueCall(prev => {
        if (!prev) return null;
        if (!data || !data.callId || String(prev._id || prev.callId) === String(data.callId)) {
          if (updateDutyStatus) updateDutyStatus('ONLINE');
          return null;
        }
        return prev;
      });
      setIsCallMinimized(false);
      fetchCallQueue();
    };

    socket.on('call_claimed_by_agent', handleCallClaimed);
    socket.on('call_queued_broadcast', handleCallQueued);
    socket.on('call_ended_by_customer', handleCustomerCutCall);

    return () => {
      socket.off('call_claimed_by_agent', handleCallClaimed);
      socket.off('call_queued_broadcast', handleCallQueued);
      socket.off('call_ended_by_customer', handleCustomerCutCall);
    };
  }, [socket, worker?._id]);

  // ==========================================
  // ORDER INSPECTOR (CORE INVESTIGATION PROCESS)
  // ==========================================
  const handleInspectOrder = async (orderIdentifier, showToast = true) => {
    if (!orderIdentifier || !orderIdentifier.trim()) return;
    setInspectLoading(true);
    try {
      const { data } = await supportApi.get(`/support/orders/inspect/${orderIdentifier.trim()}`);
      if (data.success) {
        setInspectedOrderData(data);
        setActionFormData(prev => ({
          ...prev,
          amount: data.order?.totalAmount || ''
        }));
      }
    } catch (err) {
      if (showToast) {
        alert(err.response?.data?.message || `Order '${orderIdentifier}' not found in database.`);
      }
    } finally {
      setInspectLoading(false);
    }
  };

  // Caller's Pending Orders, Deliveries & Return Requests State
  const [callerOrders, setCallerOrders] = useState([]);
  const [callerReturns, setCallerReturns] = useState([]);
  const [callerOrdersLoading, setCallerOrdersLoading] = useState(false);

  const fetchCallerPendingOrders = async (customerId, phone, email) => {
    if (!customerId && !phone && !email) {
      setCallerOrders([]);
      setCallerReturns([]);
      return;
    }
    setCallerOrdersLoading(true);
    try {
      const { data } = await supportApi.get('/support/customer-pending-orders', {
        params: { customerId, phone, email }
      });
      if (data.success) {
        const ordersList = data.recentOrders || [];
        const returnsList = data.returnRequests || [];
        setCallerOrders(ordersList);
        setCallerReturns(returnsList);
      }
    } catch (err) {
      console.error('Error fetching caller pending orders:', err);
    } finally {
      setCallerOrdersLoading(false);
    }
  };

  // Auto-fetch caller's pending orders & auto-inspect when call connects
  useEffect(() => {
    if (activeQueueCall) {
      const custId = activeQueueCall.customerId?._id || activeQueueCall.customerId;
      fetchCallerPendingOrders(custId, activeQueueCall.customerPhone, activeQueueCall.customerEmail);
    }
  }, [activeQueueCall?._id]);

  // When selected ticket changes, auto-inspect its associated order and fetch caller pending orders
  useEffect(() => {
    if (selectedTicket) {
      const custId = selectedTicket.customerId?._id || selectedTicket.customerId;
      const phone = selectedTicket.customerPhone || selectedTicket.customerId?.phone;
      const email = selectedTicket.customerEmail || selectedTicket.customerId?.email;
      fetchCallerPendingOrders(custId, phone, email);

      if (selectedTicket.orderNumber || selectedTicket.orderId) {
        const orderIdToInspect = selectedTicket.orderNumber || (selectedTicket.orderId?._id || selectedTicket.orderId);
        setOrderSearchInput(selectedTicket.orderNumber || '');
        handleInspectOrder(orderIdToInspect, false);
      }
    }
  }, [selectedTicket?._id]);

  // Scroll chat to bottom when selected ticket changes or new message added
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedTicket?.messages, caseViewMode]);

  // Refresh if live alert arrives
  useEffect(() => {
    if (liveTicketAlert) {
      fetchTickets(false);
    }
  }, [liveTicketAlert]);

  // Call timer interval handler
  useEffect(() => {
    let interval = null;
    const isConnectedCall = (activeQueueCall && activeQueueCall.queueStatus === 'CONNECTED') || (activeCallTicket && activeCallTicket.callBackDetails?.status === 'CALLING');

    if (isConnectedCall) {
      interval = setInterval(() => {
        setCallTimer(prev => prev + 1);
      }, 1000);
    } else {
      setCallTimer(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeQueueCall?._id, activeQueueCall?.queueStatus, activeCallTicket?.callBackDetails?.status]);

  // Real-time Audio Speech Synthesis listening (Reads customer spoken text aloud to officer)
  const lastSpokenMsgTimeRef = useRef(null);
  useEffect(() => {
    if (!activeQueueCall || !activeQueueCall.callTranscript || activeQueueCall.callTranscript.length === 0) return;
    const custMsgs = activeQueueCall.callTranscript.filter(t => t.sender === 'CUSTOMER');
    if (custMsgs.length === 0) return;

    const lastMsg = custMsgs[custMsgs.length - 1];
    const msgTime = new Date(lastMsg.timestamp).getTime();

    if (lastSpokenMsgTimeRef.current !== msgTime) {
      lastSpokenMsgTimeRef.current = msgTime;
      if (window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(lastMsg.message);
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [activeQueueCall?.callTranscript]);

  const [agentSpeechInput, setAgentSpeechInput] = useState('');
  const [showLiveCallConsole, setShowLiveCallConsole] = useState(true);
  const [sendingAgentSpeech, setSendingAgentSpeech] = useState(false);

  const handleSendAgentSpeech = async (callId) => {
    if (!agentSpeechInput || !agentSpeechInput.trim()) return;
    setSendingAgentSpeech(true);
    try {
      const { data } = await supportApi.post(`/call-queue/${callId}/speech`, {
        message: agentSpeechInput.trim(),
        sender: 'AGENT',
        senderName: worker?.name || 'Support Officer'
      });
      if (data.success) {
        setAgentSpeechInput('');
        if (data.call) setActiveQueueCall(data.call);
        fetchCallQueue();
      }
    } catch (err) {
      console.error('Failed to transmit agent speech:', err);
    } finally {
      setSendingAgentSpeech(false);
    }
  };

  const fetchCallQueue = async () => {
    try {
      const { data } = await supportApi.get('/call-queue/agent/incoming');
      if (data.success) {
        setCallQueueData({
          myAssigned: data.myAssigned || [],
          waitingQueue: data.waitingQueue || [],
          stats: data.stats || {}
        });

        if (activeQueueCall) {
          const updatedActive = (data.myAssigned || []).find(c => c._id === activeQueueCall._id);
          if (updatedActive && ['CONNECTED', 'ON_HOLD'].includes(updatedActive.queueStatus)) {
            setActiveQueueCall(updatedActive);
          } else {
            // Customer cut the call -> automatically clear helper active call session
            setActiveQueueCall(null);
            if (updateDutyStatus) updateDutyStatus('ONLINE');
          }
        } else if (data.myAssigned && data.myAssigned.length > 0) {
          const active = data.myAssigned.find(c => ['CONNECTED', 'ON_HOLD'].includes(c.queueStatus));
          if (active) setActiveQueueCall(active);
        }
      }
    } catch (err) {
      console.error('Error fetching call queue:', err);
    }
  };

  const handleAcceptQueueCall = async (callId) => {
    try {
      setCallQueueLoading(true);
      const { data } = await supportApi.put(`/call-queue/agent/${callId}/accept`);
      if (data.success) {
        setActiveQueueCall(data.call);
        if (updateDutyStatus) updateDutyStatus('IN_CONSULTATION');
        
        // Fetch caller's pending orders & ongoing shipments (displayed as selectable cards)
        const custId = data.call.customerId?._id || data.call.customerId;
        const phone = data.call.customerPhone || data.call.customerId?.phone;
        const email = data.call.customerEmail || data.call.customerId?.email;
        fetchCallerPendingOrders(custId, phone, email);

        if (data.call.ivr?.orderNumber) {
          setOrderSearchInput(data.call.ivr.orderNumber);
        }
        fetchCallQueue();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to accept call');
    } finally {
      setCallQueueLoading(false);
    }
  };

  const handleHoldQueueCall = async (callId) => {
    try {
      const { data } = await supportApi.put(`/call-queue/agent/${callId}/hold`);
      if (data.success) {
        setActiveQueueCall(data.call);
        fetchCallQueue();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to toggle hold');
    }
  };

  const handleEndQueueCall = async (callId, outcome = 'RESOLVED') => {
    try {
      setActionLoading(true);
      const { data } = await supportApi.put(`/call-queue/agent/${callId}/end`, { outcome, resolutionNotes });
      if (data.success) {
        setActiveQueueCall(null);
        if (updateDutyStatus) updateDutyStatus('ONLINE');
        // Clear inspected order and caller data after call finishes
        setInspectedOrderData(null);
        setOrderSearchInput('');
        setCallerOrders([]);
        setCallerReturns([]);
        alert('Call session ended cleanly.');
        fetchCallQueue();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to end call');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransferQueueCall = async (callId, targetWorkerId) => {
    try {
      const { data } = await supportApi.put(`/call-queue/agent/${callId}/transfer`, {
        targetWorkerId,
        reason: 'Specialization routing'
      });
      if (data.success) {
        setActiveQueueCall(null);
        fetchCallQueue();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to transfer call');
    }
  };

  const fetchTickets = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const params = {};
      if (activeTab !== 'ALL') params.status = activeTab;
      if (categoryFilter !== 'ALL') params.category = categoryFilter;

      const { data } = await supportApi.get('/support/worker/my-tickets', { params });
      setTickets(data.tickets || []);
      if (data.tickets && data.tickets.length > 0 && !selectedTicket) {
        setSelectedTicket(data.tickets[0]);
      }
    } catch (err) {
      console.error('Error fetching support tickets:', err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  // ==========================================
  // TELEPHONY ACTIONS (NON-BLOCKING DOCKED CALL)
  // ==========================================
  const handleStartCall = async (ticket) => {
    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
      alert('🔒 Complaint is already SOLVED. Phone call option is disabled for resolved complaints.');
      return;
    }
    setActionLoading(true);
    try {
      const { data } = await supportApi.put(`/support/worker/tickets/${ticket._id}/call-start`);
      if (data.success) {
        setActiveCallTicket(data.ticket);
        setSelectedTicket(data.ticket);
        setCallTimer(0);
        setCallNotes('');
        setCallOutcome('RESOLVED_ON_CALL');
        // Switch view directly to the Order Diagnostic Workbench so officer can work on the order during call!
        setCaseViewMode('ORDER_WORKBENCH');
        if (data.ticket.orderNumber || data.ticket.orderId) {
          handleInspectOrder(data.ticket.orderNumber || data.ticket.orderId._id || data.ticket.orderId);
        }
        await fetchTickets(false);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to initiate telephony dialer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndCall = async (resolveTicketAfterCall = false) => {
    if (!activeCallTicket) return;
    setActionLoading(true);
    try {
      const { data } = await supportApi.put(`/support/worker/tickets/${activeCallTicket._id}/call-end`, {
        durationSeconds: callTimer,
        callNotes: callNotes || 'Customer call completed.',
        outcome: callOutcome,
        resolveTicket: resolveTicketAfterCall
      });
      if (data.success) {
        setSelectedTicket(data.ticket);
        setActiveCallTicket(null);
        setCallTimer(0);
        await fetchTickets(false);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to conclude call session');
    } finally {
      setActionLoading(false);
    }
  };



  // ==========================================
  // RESOLUTION ACTIONS (ONE-CLICK CONCRETE FIXES)
  // ==========================================
  const handleExecuteResolution = async (e) => {
    e.preventDefault();
    if (!inspectedOrderData?.order) return;
    const orderId = inspectedOrderData.order._id;
    const ticketId = selectedTicket?._id;
    setActionLoading(true);

    try {
      if (actionModalType === 'REFUND') {
        const { data } = await supportApi.post(`/support/worker/orders/${orderId}/refund`, {
          amount: Number(actionFormData.amount),
          reason: actionFormData.reason,
          ticketId
        });
        alert(data.message);
        if (data.ticket) setSelectedTicket(data.ticket);
      } else if (actionModalType === 'PICKUP') {
        const { data } = await supportApi.post(`/support/worker/orders/${orderId}/authorize-return-pickup`, {
          reason: actionFormData.reason,
          exchangeOrRefund: actionFormData.exchangeOrRefund,
          ticketId
        });
        alert(data.message);
        if (data.ticket) setSelectedTicket(data.ticket);
      } else if (actionModalType === 'EXPEDITE') {
        const { data } = await supportApi.post(`/support/worker/orders/${orderId}/expedite-delivery`, {
          priorityNotes: actionFormData.priorityNotes,
          ticketId
        });
        alert(data.message);
        if (data.ticket) setSelectedTicket(data.ticket);
      } else if (actionModalType === 'GOODWILL') {
        const custId = inspectedOrderData.order.customerId?._id || inspectedOrderData.order.customerId;
        const { data } = await supportApi.post(`/support/worker/customers/${custId}/goodwill-credit`, {
          amount: Number(actionFormData.amount) || 100,
          reason: actionFormData.reason,
          ticketId
        });
        alert(data.message);
        if (data.ticket) setSelectedTicket(data.ticket);
      } else if (actionModalType === 'CANCEL') {
        const { data } = await supportApi.post(`/support/worker/orders/${orderId}/cancel-and-refund`, {
          cancellationReason: actionFormData.cancellationReason,
          ticketId
        });
        alert(data.message);
        if (data.ticket) setSelectedTicket(data.ticket);
      } else if (actionModalType === 'PAYMENT_ADMIN_REQUEST') {
        const { data } = await supportApi.post(`/support/worker/orders/${orderId}/send-payment-request`, {
          refundAmount: Number(actionFormData.amount) || Number(inspectedOrderData.order.totalAmount),
          payoutDestination: actionFormData.payoutDestination || 'ORIGINAL_PAYMENT',
          paymentAdminNotes: actionFormData.paymentAdminNotes || actionFormData.reason,
          customerInstructions: actionFormData.customerInstructions,
          warehouseQcNotes: actionFormData.warehouseQcNotes,
          ticketId
        });
        alert(data.message);
        if (data.ticket) setSelectedTicket(data.ticket);
      } else if (actionModalType === 'UPDATE_RR_INSTRUCTIONS') {
        const returnId = inspectedOrderData.returnRequest?._id || orderId;
        const { data } = await supportApi.put(`/returns/${returnId}/update-instructions-data`, {
          customerInstructions: actionFormData.customerInstructions,
          courierNotes: actionFormData.courierNotes,
          warehouseQcNotes: actionFormData.warehouseQcNotes,
          reasonDetails: actionFormData.reason,
          refundPreference: actionFormData.payoutDestination,
          estimatedRefundAmount: actionFormData.amount ? Number(actionFormData.amount) : undefined
        });
        alert(data.message);
      }

      setActionModalType(null);
      // Re-inspect to refresh diagnostics and ticket list
      await handleInspectOrder(inspectedOrderData.order._id, false);
      await fetchTickets(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to execute resolution action');
    } finally {
      setActionLoading(false);
    }
  };

  // Claim Ticket
  const handleClaimTicket = async (ticketId) => {
    setActionLoading(true);
    try {
      const { data } = await supportApi.put(`/support/worker/tickets/${ticketId}/claim`);
      if (data.success) {
        setSelectedTicket(data.ticket);
        await fetchTickets(false);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to claim ticket');
    } finally {
      setActionLoading(false);
    }
  };

  // Update Status
  const handleUpdateStatus = async (ticketId, status, notes = '') => {
    setActionLoading(true);
    try {
      const { data } = await supportApi.put(`/support/tickets/${ticketId}/status`, {
        status,
        resolutionNotes: notes || (status === 'RESOLVED' ? 'Issue verified and resolved by support worker.' : undefined)
      });
      if (data.success) {
        setSelectedTicket(data.ticket);
        setShowResolveModal(false);
        setResolutionNotes('');
        await fetchTickets(false);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update ticket status');
    } finally {
      setActionLoading(false);
    }
  };

  // Send message in ticket
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!messageInput.trim() || !selectedTicket) return;

    setSendingMessage(true);
    try {
      const { data } = await supportApi.post(`/support/tickets/${selectedTicket._id}/messages`, {
        message: messageInput.trim(),
        senderName: worker.name,
        senderRole: 'support_agent'
      });
      if (data.success) {
        setSelectedTicket(data.ticket);
        setMessageInput('');
        fetchTickets(false);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send reply');
    } finally {
      setSendingMessage(false);
    }
  };

  // Quick reply macros
  const quickMacros = [
    {
      title: '📦 Return Pickup Scheduled',
      text: `Hello! Your return request has been authorized by our QC team. A delivery agent has been assigned to pick up the package from your doorstep. Please keep the original box and invoice ready.`
    },
    {
      title: '💰 Refund Initiated',
      text: `We are pleased to inform you that your returned product has been inspected and verified at our fulfillment center. Your refund has been initiated and credited to your payment method.`
    },
    {
      title: '🛵 Delivery Route Update',
      text: `Our logistics tracking shows the delivery rider is on the way to your GPS coordinates. We have expedited this shipment to arrive today.`
    },
    {
      title: '🛡️ Quality Verified',
      text: `We sincerely apologize for the defect. Our quality assurance wing has recorded this batch issue with the seller and we have authorized an instant replacement for you.`
    }
  ];

  // Filtering
  const filteredTickets = tickets.filter(t => {
    if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = t.ticketNumber?.toLowerCase().includes(q);
      const matchSub = t.subject?.toLowerCase().includes(q);
      const matchCust = t.customerId?.name?.toLowerCase().includes(q);
      const matchPhone = t.customerPhone?.includes(q);
      if (!matchNum && !matchSub && !matchCust && !matchPhone) return false;
    }
    return true;
  });

  const myAssignedCount = tickets.filter(t => t.assignedWorker?.workerId === worker.workerId && t.status !== 'RESOLVED').length;
  const callBackQueueCount = tickets.filter(t => t.contactChannel === 'CALL_BACK' && t.status !== 'RESOLVED').length;
  const unassignedCount = tickets.filter(t => (!t.assignedWorker?.workerId || t.status === 'OPEN') && t.status !== 'RESOLVED').length;
  const resolvedCount = tickets.filter(t => t.status === 'RESOLVED').length;

  const formatSeconds = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const renderOrderWorkbenchSection = () => (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Instant Order Search Input Box */}
      <div style={{
        background: 'rgba(30, 41, 59, 0.4)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <i className="fa-solid fa-magnifying-glass" style={{ color: '#06B6D4', fontSize: '1.1rem' }}></i>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' }}>
            Diagnostic Order ID Inspector (Type any Order Number or ID to inspect &amp; solve)
          </div>
          <input
            type="text"
            placeholder="Type or paste Order ID (e.g. ORD-235548-1217)..."
            value={orderSearchInput}
            onChange={(e) => setOrderSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInspectOrder(orderSearchInput)}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              color: '#F1F5F9',
              fontSize: '0.95rem',
              fontWeight: '700',
              outline: 'none',
              marginTop: '4px',
              fontFamily: 'var(--font-mono)'
            }}
          />
        </div>
        <button
          onClick={() => handleInspectOrder(orderSearchInput)}
          className="btn-primary"
          style={{ padding: '8px 18px', fontSize: '0.82rem' }}
        >
          {inspectLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-search"></i>}
          <span>Inspect Diagnostics</span>
        </button>
      </div>

      {/* AUTO-LOADED CALLER'S PENDING ORDERS, DELIVERIES & RETURNS PANEL */}
      {callerOrdersLoading ? (
        <div style={{ background: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: '12px', padding: '14px', textAlign: 'center', color: '#06B6D4', fontSize: '0.82rem', marginBottom: '16px' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
          <span>Auto-fetching caller's pending orders, shipments &amp; return requests...</span>
        </div>
      ) : ((callerOrders && callerOrders.length > 0) || (callerReturns && callerReturns.length > 0) || activeQueueCall) && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 100%)',
          border: '1px solid #0284C7',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '16px',
          boxShadow: '0 4px 14px rgba(2, 132, 199, 0.2)'
        }}>
          {/* ORDERS SECTION */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: '800', color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                🛍️ Caller's Orders &amp; Ongoing Deliveries ({callerOrders?.length || 0})
              </span>
              <span style={{ background: '#0284C7', color: '#FFFFFF', padding: '1px 8px', borderRadius: '10px', fontSize: '0.68rem', fontWeight: '800' }}>
                Auto-Retrieved
              </span>
            </div>
            <span style={{ fontSize: '0.74rem', color: '#94A3B8' }}>
              Tap any order below to inspect diagnostics &amp; execute 1-click remediation
            </span>
          </div>

          {callerOrders && callerOrders.length > 0 ? (
            <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '10px' }}>
              {callerOrders.map(ord => {
                const isInspected = inspectedOrderData?.order?.orderNumber === ord.orderNumber;
                const isPending = ['PENDING', 'SELLER_ACCEPTED', 'DELIVERY_REQUESTED', 'AGENT_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'RETURN_REQUESTED', 'PROCESSING'].includes(ord.orderStatus);

                return (
                  <div
                    key={ord._id}
                    onClick={() => {
                      setOrderSearchInput(ord.orderNumber);
                      handleInspectOrder(ord.orderNumber, false);
                    }}
                    style={{
                      minWidth: '260px',
                      maxWidth: '300px',
                      background: isInspected ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                      border: isInspected ? '2px solid #06B6D4' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '10px',
                      padding: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#38BDF8', fontFamily: 'monospace' }}>
                        #{ord.orderNumber}
                      </span>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: '800',
                        padding: '2px 7px',
                        borderRadius: '10px',
                        background: isPending ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                        color: isPending ? '#FBBF24' : '#34D399',
                        border: isPending ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)'
                      }}>
                        ● {ord.orderStatus}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: '#F1F5F9', fontWeight: '700', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ord.items && ord.items.length > 0 ? ord.items.map(i => i.name || i.title).join(', ') : 'Order Items'}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', color: '#94A3B8', marginTop: '6px' }}>
                      <span style={{ color: '#34D399', fontWeight: '800' }}>₹{ord.totalAmount}</span>
                      <span>{new Date(ord.createdAt).toLocaleDateString('en-IN')}</span>
                    </div>

                    <button
                      style={{
                        width: '100%',
                        marginTop: '10px',
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: 'none',
                        background: isInspected ? '#06B6D4' : 'rgba(255, 255, 255, 0.1)',
                        color: '#FFFFFF',
                        fontSize: '0.72rem',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      <i className="fa-solid fa-bolt"></i>
                      <span>{isInspected ? 'Currently Inspecting' : 'Tap to Select & Work on Order'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: '0.78rem', color: '#64748B', fontStyle: 'italic', marginBottom: '10px' }}>
              No active pending orders found for this caller.
            </div>
          )}

          {/* RETURN REQUESTS SECTION */}
          {callerReturns && callerReturns.length > 0 && (
            <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px dashed rgba(255, 255, 255, 0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: '800', color: '#F43F5E', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  ↩️ Caller's Return &amp; Exchange Requests ({callerReturns.length})
                </span>
                <span style={{ background: '#F43F5E', color: '#FFFFFF', padding: '1px 8px', borderRadius: '10px', fontSize: '0.66rem', fontWeight: '800' }}>
                  Action Needed
                </span>
              </div>

              <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '6px' }}>
                {callerReturns.map(ret => {
                  const ordNum = ret.orderId?.orderNumber || ret.orderNumber;
                  const isInspected = inspectedOrderData?.order?.orderNumber === ordNum;

                  return (
                    <div
                      key={ret._id}
                      onClick={() => {
                        if (ordNum) {
                          setOrderSearchInput(ordNum);
                          handleInspectOrder(ordNum, false);
                        }
                      }}
                      style={{
                        minWidth: '270px',
                        maxWidth: '310px',
                        background: isInspected ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                        border: isInspected ? '2px solid #F43F5E' : '1px solid rgba(244, 63, 94, 0.3)',
                        borderRadius: '10px',
                        padding: '12px',
                        cursor: 'pointer',
                        position: 'relative'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#FB7185', fontFamily: 'monospace' }}>
                          Order #{ordNum || 'UNKNOWN'}
                        </span>
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: '800',
                          padding: '2px 7px',
                          borderRadius: '10px',
                          background: 'rgba(244, 63, 94, 0.2)',
                          color: '#FDA4AF',
                          border: '1px solid rgba(244, 63, 94, 0.4)'
                        }}>
                          ● {ret.status}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.76rem', color: '#F1F5F9', fontWeight: '700', marginBottom: '4px' }}>
                        {ret.type === 'EXCHANGE' ? '🔄 Exchange Request' : '↩️ Wallet/Bank Return'} ({ret.reasonCategory || 'Return'})
                      </div>

                      <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginBottom: '6px' }}>
                        Reason: {ret.reasonDetails || 'Customer requested return.'}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', color: '#94A3B8', marginTop: '6px' }}>
                        <span style={{ color: '#34D399', fontWeight: '800' }}>Est. Refund: ₹{ret.estimatedRefundAmount || 0}</span>
                        <span>{new Date(ret.createdAt).toLocaleDateString('en-IN')}</span>
                      </div>

                      <button
                        style={{
                          width: '100%',
                          marginTop: '10px',
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: 'none',
                          background: isInspected ? '#F43F5E' : 'rgba(244, 63, 94, 0.2)',
                          color: '#FFFFFF',
                          fontSize: '0.72rem',
                          fontWeight: '800',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        <i className="fa-solid fa-arrows-rotate"></i>
                        <span>{isInspected ? 'Currently Inspecting Return' : 'Tap to Inspect Return Order'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {inspectLoading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
          <i className="fa-solid fa-spinner fa-spin fa-2x" style={{ color: '#06B6D4', marginBottom: '10px' }}></i>
          <div>Running diagnostic scan on order...</div>
        </div>
      ) : !inspectedOrderData?.order ? (
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px dashed var(--border-color)',
          borderRadius: '14px',
          padding: '40px 20px',
          textAlign: 'center',
          color: '#64748B'
        }}>
          <i className="fa-solid fa-barcode fa-3x" style={{ color: '#334155', marginBottom: '12px' }}></i>
          <h4 style={{ color: '#94A3B8', margin: '0 0 6px' }}>No Order Diagnostics Loaded Yet</h4>
          <p style={{ fontSize: '0.82rem', margin: 0 }}>
            Type an Order ID in the search bar above or select a ticket that contains an order to inspect all details and execute resolution actions.
          </p>
        </div>
      ) : (
        <div>
          {/* Order Diagnostic Overview Card */}
          <div style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' }}>
                Diagnostic Target
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#F1F5F9', fontFamily: 'var(--font-mono)' }}>
                #{inspectedOrderData.order.orderNumber}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                Placed on {new Date(inspectedOrderData.order.createdAt).toLocaleString()}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Order Status</div>
                <span style={{ fontSize: '0.88rem', fontWeight: '800', color: '#FBBF24' }}>
                  {inspectedOrderData.order.orderStatus}
                </span>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Payment Status</div>
                <span style={{ fontSize: '0.88rem', fontWeight: '800', color: inspectedOrderData.order.paymentStatus === 'REFUNDED' ? '#34D399' : '#38BDF8' }}>
                  {inspectedOrderData.order.paymentStatus}
                </span>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Total Amount</div>
                <span style={{ fontSize: '0.95rem', fontWeight: '800', color: '#34D399' }}>
                  ₹{inspectedOrderData.order.totalAmount}
                </span>
              </div>

              {/* Close (X) Cross Symbol Button to dismiss inspected product details */}
              <button
                type="button"
                onClick={() => {
                  setInspectedOrderData(null);
                  setOrderSearchInput('');
                }}
                style={{
                  background: 'rgba(239, 68, 68, 0.18)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#F87171',
                  borderRadius: '50%',
                  width: '34px',
                  height: '34px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                  fontWeight: '900',
                  cursor: 'pointer',
                  marginLeft: '8px'
                }}
                title="Close Product Details (Return to Order List)"
              >
                ✕
              </button>
            </div>
          </div>

          {/* DIRECT RESOLUTION ACTIONS BAR (EXECUTE WHILE ON THE CALL) */}
          <div style={{
            background: 'rgba(6, 182, 212, 0.08)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            borderRadius: '12px',
            padding: '14px 18px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#38BDF8', textTransform: 'uppercase' }}>
                ⚡ Immediate Problem Solving Actions (Execute during call):
              </span>
              <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                Directly modifies order, credits wallet &amp; dispatches logistics
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setActionModalType('REFUND')}
                className="btn-primary"
                style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', fontSize: '0.8rem', padding: '8px 14px' }}
              >
                <i className="fa-solid fa-hand-holding-dollar"></i>
                <span>Instant Wallet Refund</span>
              </button>

              <button
                onClick={() => setActionModalType('PICKUP')}
                className="btn-primary"
                style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)', fontSize: '0.8rem', padding: '8px 14px' }}
              >
                <i className="fa-solid fa-truck-ramp-box"></i>
                <span>Schedule Return Pickup</span>
              </button>

              <button
                onClick={() => setActionModalType('EXPEDITE')}
                className="btn-primary"
                style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', fontSize: '0.8rem', padding: '8px 14px' }}
              >
                <i className="fa-solid fa-motorcycle"></i>
                <span>Expedite Delivery Rider</span>
              </button>

              <button
                onClick={() => setActionModalType('GOODWILL')}
                className="btn-primary"
                style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)', fontSize: '0.8rem', padding: '8px 14px' }}
              >
                <i className="fa-solid fa-gift"></i>
                <span>Grant Goodwill Apology Credit</span>
              </button>

              <button
                onClick={() => setActionModalType('CANCEL')}
                className="btn-primary"
                style={{ background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)', fontSize: '0.8rem', padding: '8px 14px' }}
              >
                <i className="fa-solid fa-ban"></i>
                <span>Emergency Cancel &amp; Refund</span>
              </button>
            </div>
          </div>

          {/* Customer & Delivery Fleet Diagnostics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px 18px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#06B6D4', textTransform: 'uppercase', marginBottom: '8px' }}>
                👤 Customer Profile &amp; Balance
              </div>
              <div style={{ fontSize: '0.92rem', fontWeight: '700', color: '#F1F5F9' }}>
                {inspectedOrderData.order.customerId?.name}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
                Email: {inspectedOrderData.order.customerId?.email}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
                Phone: {inspectedOrderData.order.customerId?.phone || 'N/A'}
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#10B981', marginTop: '6px' }}>
                Store Wallet Balance: ₹{inspectedOrderData.order.customerId?.walletBalance || 0}
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px 18px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#F59E0B', textTransform: 'uppercase', marginBottom: '8px' }}>
                🛵 Courier &amp; Logistics Tracking
              </div>
              {inspectedOrderData.order.deliveryAgentId ? (
                <div>
                  <div style={{ fontSize: '0.92rem', fontWeight: '700', color: '#F1F5F9' }}>
                    Rider: {inspectedOrderData.order.deliveryAgentId.name}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
                    Phone: {inspectedOrderData.order.deliveryAgentId.phone}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
                    Vehicle: {inspectedOrderData.order.deliveryAgentId.vehicleType}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#10B981', fontWeight: '700', marginTop: '4px' }}>
                    Handover OTP: {inspectedOrderData.order.deliveryOtp || '1234'}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.82rem', color: '#64748B' }}>
                  Package is in fulfillment hub or transit (No local rider assigned yet).
                </div>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', marginBottom: '8px' }}>
              Purchased Items ({inspectedOrderData.order.items?.length || 0})
            </div>
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-elevated)', color: '#94A3B8', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '8px 14px' }}>Product</th>
                    <th style={{ padding: '8px 14px' }}>Qty</th>
                    <th style={{ padding: '8px 14px' }}>Unit Price</th>
                    <th style={{ padding: '8px 14px', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {inspectedOrderData.order.items?.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      <td style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {item.image && (
                          <img src={item.image} alt={item.name} style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover' }} />
                        )}
                        <span style={{ fontWeight: '700', color: '#F1F5F9' }}>{item.name}</span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#94A3B8' }}>{item.quantity}</td>
                      <td style={{ padding: '10px 14px', color: '#94A3B8' }}>₹{item.price}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: '#34D399' }}>
                        ₹{item.price * item.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Delivery Address & Barcode Handover Log */}
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px 18px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#A78BFA', textTransform: 'uppercase', marginBottom: '6px' }}>
              📍 Delivery Address &amp; Proof of Handover
            </div>
            <div style={{ fontSize: '0.82rem', color: '#CBD5E1' }}>
              {inspectedOrderData.order.deliveryAddress?.fullName} • {inspectedOrderData.order.deliveryAddress?.street}, {inspectedOrderData.order.deliveryAddress?.city}, {inspectedOrderData.order.deliveryAddress?.postalCode}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>
              Verified Method: <strong>{inspectedOrderData.order.proofOfDelivery?.verifiedMethod || 'PENDING'}</strong>
              {inspectedOrderData.order.proofOfDelivery?.scannedCode ? ` • Barcode: ${inspectedOrderData.order.proofOfDelivery.scannedCode}` : ''}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* Top Application Header */}
      <header style={{
        background: 'rgba(17, 24, 39, 0.95)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-color)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        {/* Brand & Port Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: '1.25rem',
            boxShadow: '0 4px 12px rgba(6, 182, 212, 0.35)'
          }}>
            <i className="fa-solid fa-headset"></i>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#F1F5F9', margin: 0 }}>
                NovaKart Resolution Engine
              </h1>
              <span style={{
                background: 'rgba(6, 182, 212, 0.15)',
                color: '#22D3EE',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: '800',
                fontFamily: 'var(--font-mono)'
              }}>
                PORT 3006
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
              Core Process: Live Order ID Investigation, Diagnostics &amp; One-Click Remediation
            </div>
          </div>
        </div>

        {/* Live Duty Status Switcher & Worker Profile */}
        {(() => {
          const isOnCall = worker.supportDutyStatus === 'IN_CONSULTATION' || !!activeQueueCall || !!activeCallTicket;
          const isOnline = worker.supportDutyStatus === 'ONLINE' && !isOnCall;
          const isOffline = worker.supportDutyStatus === 'OFFLINE' && !isOnCall;

          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* Duty Status Selector */}
              <div style={{
                background: 'rgba(31, 41, 55, 0.8)',
                border: '1px solid var(--border-color)',
                borderRadius: '30px',
                padding: '4px 6px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#94A3B8', padding: '0 6px' }}>
                  Duty:
                </span>
                <button
                  onClick={() => updateDutyStatus('ONLINE')}
                  style={{
                    background: isOnline ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
                    color: isOnline ? '#34D399' : '#64748B',
                    border: isOnline ? '1px solid rgba(16, 185, 129, 0.5)' : 'none',
                    borderRadius: '20px',
                    padding: '3px 10px',
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10B981' }} className={isOnline ? 'pulse-green' : ''}></span>
                  ONLINE
                </button>

                <button
                  onClick={() => updateDutyStatus('IN_CONSULTATION')}
                  style={{
                    background: isOnCall ? 'rgba(245, 158, 11, 0.3)' : 'transparent',
                    color: isOnCall ? '#FBBF24' : '#64748B',
                    border: isOnCall ? '1.5px solid #F59E0B' : 'none',
                    boxShadow: isOnCall ? '0 0 12px rgba(245, 158, 11, 0.5)' : 'none',
                    borderRadius: '20px',
                    padding: '3px 10px',
                    fontSize: '0.72rem',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#F59E0B' }} className={isOnCall ? 'pulse-green' : ''}></span>
                  ● ON CALL
                </button>

                <button
                  onClick={() => updateDutyStatus('OFFLINE')}
                  style={{
                    background: isOffline ? 'rgba(100, 116, 139, 0.2)' : 'transparent',
                    color: isOffline ? '#CBD5E1' : '#64748B',
                    border: isOffline ? '1px solid rgba(100, 116, 139, 0.4)' : 'none',
                    borderRadius: '20px',
                    padding: '3px 10px',
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#64748B' }}></span>
                  OFFLINE
                </button>
              </div>

          {/* Officer Identity Card */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(31, 41, 55, 0.8)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '6px 14px'
          }}>
            <img
              src={worker.avatar}
              alt={worker.name}
              style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #06B6D4' }}
            />
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#F1F5F9', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{worker.name}</span>
                <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', background: 'rgba(255, 255, 255, 0.08)', padding: '1px 6px', borderRadius: '4px', color: '#06B6D4' }}>
                  {worker.workerId}
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                {worker.specialty}
              </div>
            </div>
          </div>

          {/* Link to Admin & Logout */}
          <a
            href="http://localhost:3003/help-center"
            target="_blank"
            rel="noreferrer"
            className="btn-secondary"
            style={{ fontSize: '0.78rem', padding: '8px 12px' }}
            title="Open Admin Monitor"
          >
            <i className="fa-solid fa-shield"></i>
            <span>Admin (3003)</span>
          </a>

          <button
            onClick={logout}
            className="btn-secondary"
            style={{ fontSize: '0.78rem', padding: '8px 12px', color: '#FB7185', borderColor: 'rgba(244, 63, 94, 0.3)' }}
            title="Sign Out"
          >
            <i className="fa-solid fa-power-off"></i>
          </button>
        </div>
        );
      })()}
      </header>

      {/* ========================================================================= */}
      {/* PERSISTENT DOCKED IN-CALL CONTROL STRIP (NON-BLOCKING WHILE ON CALL) */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 📱 SLEEK FLOATING MINIMIZED CALL PILL (NEAT COMPACT WIDGET WHEN MINIMIZED) */}
      {/* ========================================================================= */}
      {isCallMinimized && (activeQueueCall || activeCallTicket) && (
        <div style={{
          position: 'fixed',
          top: '16px',
          right: '24px',
          zIndex: 99999,
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(6, 78, 59, 0.95) 100%)',
          border: '2px solid #10B981',
          borderRadius: '30px',
          padding: '8px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 12px 35px rgba(0, 0, 0, 0.6), 0 0 20px rgba(16, 185, 129, 0.4)',
          color: '#FFFFFF',
          backdropFilter: 'blur(12px)',
          animation: 'fadeIn 0.25s ease-out'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: '#10B981',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.9rem',
            boxShadow: '0 0 12px #10B981'
          }}>
            <i className="fa-solid fa-phone-volume fa-shake"></i>
          </div>

          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#34D399' }}>🟢 ON CALL</span>
              <span style={{ color: '#F1F5F9', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeQueueCall?.customerName || activeCallTicket?.customerId?.name || 'Customer'}
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>
              {activeQueueCall?.customerPhone || activeCallTicket?.customerPhone}
            </div>
          </div>

          {/* Live Call Duration Timer Pill */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(52, 211, 153, 0.4)',
            borderRadius: '20px',
            padding: '4px 10px',
            fontFamily: 'var(--font-mono)',
            fontWeight: '800',
            fontSize: '0.88rem',
            color: '#34D399'
          }}>
            ⏱️ {formatSeconds(callTimer)}
          </div>

          {/* Expand Full Bar */}
          <button
            onClick={() => setIsCallMinimized(false)}
            title="Expand Full Call Bar &amp; Speech Console"
            style={{
              background: '#0284C7',
              border: 'none',
              borderRadius: '20px',
              padding: '6px 14px',
              color: '#FFFFFF',
              fontSize: '0.75rem',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)'
            }}
          >
            <i className="fa-solid fa-expand"></i>
            <span>Expand</span>
          </button>

          {/* Quick Cut Call */}
          <button
            onClick={() => {
              if (activeQueueCall) handleEndQueueCall(activeQueueCall._id, 'CANCELLED');
              else if (activeCallTicket) handleEndCall(false);
            }}
            title="Cut Call"
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              color: '#F87171',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem'
            }}
          >
            <i className="fa-solid fa-phone-slash"></i>
          </button>

          {/* End & Resolve */}
          <button
            onClick={() => {
              if (activeQueueCall) handleEndQueueCall(activeQueueCall._id, 'RESOLVED');
              else if (activeCallTicket) handleEndCall(true);
            }}
            title="End Call &amp; Resolve Issue"
            style={{
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              border: 'none',
              borderRadius: '20px',
              padding: '6px 14px',
              color: '#FFFFFF',
              fontSize: '0.75rem',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)'
            }}
          >
            <i className="fa-solid fa-check"></i>
            <span>Resolve</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PERSISTENT DOCKED IN-CALL CONTROL STRIP (EXPANDED MODE) */}
      {/* ========================================================================= */}
      {!isCallMinimized && activeCallTicket && (
        <div style={{
          background: 'linear-gradient(90deg, #881337 0%, #1E1B4B 100%)',
          borderBottom: '2px solid #F43F5E',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          zIndex: 45
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: '#E11D48',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
              boxShadow: '0 0 15px rgba(244, 63, 94, 0.8)'
            }}>
              <i className="fa-solid fa-phone fa-shake"></i>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: '800', background: 'rgba(244, 63, 94, 0.3)', color: '#FECDD3', padding: '1px 6px', borderRadius: '4px' }}>
                  ● LIVE PHONE CONSULTATION
                </span>
                <span style={{ fontSize: '0.88rem', fontWeight: '800', color: '#FFFFFF' }}>
                  {activeCallTicket.customerId?.name || 'Customer'}
                </span>
                <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', color: '#38BDF8' }}>
                  ({activeCallTicket.customerPhone || '+91 98765 00000'})
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#FDA4AF' }}>
                💡 Tip: Inspect orders below while speaking with customer to resolve issues.
              </div>
            </div>
          </div>

          {/* Call Controls & Live Duration */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              padding: '6px 14px',
              fontFamily: 'var(--font-mono)',
              fontWeight: '800',
              fontSize: '1.1rem',
              color: '#10B981'
            }}>
              ⏱️ {formatSeconds(callTimer)}
            </div>

            <button
              onClick={() => setIsCallMinimized(true)}
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '6px 12px', background: 'rgba(255, 255, 255, 0.12)', color: '#FFFFFF' }}
            >
              <i className="fa-solid fa-compress"></i>
              <span>Minimize Call</span>
            </button>

            <button
              onClick={() => setIsMuted(!isMuted)}
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '6px 10px', color: isMuted ? '#FB7185' : '#F1F5F9' }}
            >
              <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
              <span>{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            <select
              value={callOutcome}
              onChange={(e) => setCallOutcome(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                background: 'rgba(0, 0, 0, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#F1F5F9',
                fontSize: '0.75rem'
              }}
            >
              <option value="RESOLVED_ON_CALL">✓ Resolved on Call</option>
              <option value="REFUND_SCHEDULED">💰 Instant Refund Issued</option>
              <option value="RETURN_PICKUP_SCHEDULED">📦 Return Pickup Dispatched</option>
              <option value="DELIVERY_EXPEDITED">🛵 Delivery Expedited</option>
              <option value="CUSTOMER_BUSY">⚠️ Customer Busy / Retry</option>
            </select>

            <button
              onClick={() => handleEndCall(false)}
              disabled={actionLoading}
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '6px 12px' }}
            >
              <i className="fa-solid fa-phone-slash"></i>
              <span>End Call (Keep Case Open)</span>
            </button>

            <button
              onClick={() => handleEndCall(true)}
              disabled={actionLoading}
              className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', fontSize: '0.75rem', padding: '6px 14px' }}
            >
              <i className="fa-solid fa-circle-check"></i>
              <span>End Call &amp; Resolve Case</span>
            </button>
          </div>
        </div>
      )}

      {/* Live Ticket Toast Alert */}
      {liveTicketAlert && (
        <div style={{
          background: 'linear-gradient(90deg, #06B6D4 0%, #3B82F6 100%)',
          color: '#FFFFFF',
          padding: '8px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.82rem',
          fontWeight: '700'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa-solid fa-bell fa-shake"></i>
            <span>{liveTicketAlert.message}</span>
          </div>
          <button
            onClick={clearAlert}
            style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer', fontWeight: '800' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 📞 HIGH-PRIORITY CENTER SCREEN ANIMATED INCOMING TELEPHONE OVERLAY FOR SUPPORT OFFICER */}
      {(() => {
        if (activeQueueCall) return null;
        const waitingCall = (callQueueData.waitingQueue || []).find(c => ['QUEUED', 'IVR_IN_PROGRESS'].includes(c.queueStatus));
        if (!waitingCall) return null;

        return (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(16px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%)',
              border: '3px solid #10B981',
              borderRadius: '28px',
              maxWidth: '520px',
              width: '100%',
              padding: '36px 28px',
              textAlign: 'center',
              color: '#FFFFFF',
              boxShadow: '0 25px 60px -12px rgba(16, 185, 129, 0.5)',
              animation: 'pulse 1.2s infinite'
            }}>
              <div style={{
                width: '96px', height: '96px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                color: '#FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2.8rem', margin: '0 auto 24px',
                boxShadow: '0 0 35px #10B981'
              }}>
                <i className="fa-solid fa-phone-volume fa-shake"></i>
              </div>

              <div style={{
                fontSize: '0.78rem', fontWeight: '800', background: 'rgba(16, 185, 129, 0.2)',
                color: '#6EE7B7', padding: '4px 14px', borderRadius: '20px', display: 'inline-block', marginBottom: '12px'
              }}>
                📞 INCOMING CALL QUEUE REQUEST
              </div>

              <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '6px' }}>
                {waitingCall.customerName || 'Customer Inquiry'}
              </h2>
              <div style={{ fontSize: '1.05rem', color: '#93C5FD', fontWeight: '700', fontFamily: 'var(--font-mono)', marginBottom: '16px' }}>
                {waitingCall.customerPhone}
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '24px' }}>
                <span style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#93C5FD', border: '1px solid rgba(59, 130, 246, 0.4)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '700' }}>
                  🌐 Language: {waitingCall.ivr?.language || 'ENGLISH'}
                </span>
                <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#FDE68A', border: '1px solid rgba(245, 158, 11, 0.4)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '700' }}>
                  📌 Category: {waitingCall.ivr?.reason?.replace(/_/g, ' ') || 'General'}
                </span>
                {waitingCall.ivr?.orderNumber && (
                  <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6EE7B7', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '700' }}>
                    📦 Order #{waitingCall.ivr.orderNumber}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                <button
                  onClick={() => handleAcceptQueueCall(waitingCall._id)}
                  style={{
                    flex: 1, padding: '16px', borderRadius: '16px', border: 'none',
                    background: '#10B981', color: '#FFFFFF', fontSize: '1.05rem',
                    fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                    boxShadow: '0 8px 25px rgba(16, 185, 129, 0.5)'
                  }}
                >
                  <i className="fa-solid fa-phone"></i> Accept &amp; Connect Call
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* INCOMING CALL QUEUE PANEL (EXPANDED MODE)                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {!isCallMinimized && activeQueueCall && (
        <div style={{
          background: activeQueueCall.queueStatus === 'ON_HOLD' ? 'linear-gradient(90deg, #4C1D95 0%, #5B21B6 100%)' : 'linear-gradient(90deg, #064E3B 0%, #065F46 100%)',
          borderBottom: `2px solid ${activeQueueCall.queueStatus === 'ON_HOLD' ? '#A78BFA' : '#34D399'}`,
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          color: '#FFFFFF'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem',
              animation: activeQueueCall.queueStatus === 'ON_HOLD' ? 'pulse 2s infinite' : 'none'
            }}>
              <i className={activeQueueCall.queueStatus === 'ON_HOLD' ? 'fa-solid fa-music' : 'fa-solid fa-phone'}></i>
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{activeQueueCall.queueStatus === 'ON_HOLD' ? '🟣 ON HOLD (Music Playing)' : '🟢 LIVE CALL'}</span>
                <span style={{ marginLeft: '6px', fontWeight: '400', fontSize: '0.82rem', opacity: 0.9 }}>
                  {activeQueueCall.customerName} • {activeQueueCall.customerPhone}
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>
                Language: {activeQueueCall.ivr?.language || 'EN'} • Reason: {activeQueueCall.ivr?.reason?.replace(/_/g, ' ') || 'General'}
                {activeQueueCall.ivr?.orderNumber ? ` • Order: ${activeQueueCall.ivr.orderNumber}` : ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Live Call Duration Timer */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.45)',
              border: '1px solid rgba(16, 185, 129, 0.5)',
              borderRadius: '8px',
              padding: '6px 14px',
              fontFamily: 'var(--font-mono)',
              fontWeight: '800',
              fontSize: '1rem',
              color: '#34D399',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <i className="fa-solid fa-clock"></i>
              <span>{formatSeconds(callTimer)}</span>
            </div>

            <button
              onClick={() => setIsCallMinimized(true)}
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '6px 12px', background: 'rgba(255,255,255,0.15)', color: '#FFFFFF' }}
            >
              <i className="fa-solid fa-compress"></i>
              <span>Minimize Call</span>
            </button>

            <button
              onClick={() => setShowLiveCallConsole(!showLiveCallConsole)}
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '6px 12px', background: showLiveCallConsole ? '#1E293B' : 'rgba(255,255,255,0.15)', color: '#FFFFFF' }}
            >
              <i className="fa-solid fa-comments"></i>
              <span>{showLiveCallConsole ? 'Hide Speech Console' : '🎙️ Open Speech Console'} ({activeQueueCall.callTranscript?.length || 0})</span>
            </button>
            <button
              onClick={() => handleHoldQueueCall(activeQueueCall._id)}
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '6px 12px', color: activeQueueCall.queueStatus === 'ON_HOLD' ? '#34D399' : '#FBBF24' }}
            >
              <i className={`fa-solid ${activeQueueCall.queueStatus === 'ON_HOLD' ? 'fa-play' : 'fa-pause'}`}></i>
              <span>{activeQueueCall.queueStatus === 'ON_HOLD' ? 'Resume' : 'Hold'}</span>
            </button>
            {activeQueueCall.ivr?.orderNumber && (
              <button
                onClick={() => { setOrderSearchInput(activeQueueCall.ivr.orderNumber); handleInspectOrder(activeQueueCall.ivr.orderNumber, false); }}
                className="btn-secondary"
                style={{ fontSize: '0.75rem', padding: '6px 12px' }}
              >
                <i className="fa-solid fa-magnifying-glass"></i>
                <span>Inspect Order</span>
              </button>
            )}
            <button
              onClick={() => handleEndQueueCall(activeQueueCall._id, 'CANCELLED')}
              disabled={actionLoading}
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '6px 12px', color: '#F87171', borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.15)' }}
            >
              <i className="fa-solid fa-phone-slash"></i>
              <span>Cut Call</span>
            </button>
            <button
              onClick={() => handleEndQueueCall(activeQueueCall._id, 'RESOLVED')}
              className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', fontSize: '0.75rem', padding: '6px 14px' }}
            >
              <i className="fa-solid fa-circle-check"></i>
              <span>End &amp; Resolve</span>
            </button>
          </div>
        </div>
      )}

      {/* 🎙️ EXPANDABLE LIVE TELEPHONY VOICE & SPEECH STUDIO */}
      {!isCallMinimized && activeQueueCall && showLiveCallConsole && (
        <div style={{
          background: '#0F172A',
          borderBottom: '3px solid #10B981',
          padding: '16px 24px',
          color: '#F8FAFC',
          boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.5)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                🎙️ Telephony Voice Speech Console (Real-time 2-Way Audio Dialogue)
              </span>
              <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                Connected with {activeQueueCall.customerName} ({activeQueueCall.customerPhone})
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
              Language: <strong>{activeQueueCall.ivr?.language || 'ENGLISH'}</strong>
            </span>
          </div>

          {/* Transcript Feed */}
          <div style={{
            background: '#1E293B',
            borderRadius: '10px',
            padding: '12px',
            maxHeight: '180px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginBottom: '12px',
            border: '1px solid #334155'
          }}>
            {(!activeQueueCall.callTranscript || activeQueueCall.callTranscript.length === 0) ? (
              <div style={{ fontSize: '0.82rem', color: '#94A3B8', textAlign: 'center', fontStyle: 'italic', padding: '12px' }}>
                Voice channel open. Speak or select a quick response below to communicate with customer.
              </div>
            ) : (
              activeQueueCall.callTranscript.map((t, idx) => {
                const isAgent = t.sender === 'AGENT';
                const isSys = t.sender === 'SYSTEM';
                return (
                  <div key={idx} style={{
                    alignSelf: isSys ? 'center' : isAgent ? 'flex-end' : 'flex-start',
                    maxWidth: isSys ? '90%' : '80%',
                    background: isSys ? '#334155' : isAgent ? '#2563EB' : '#059669',
                    color: '#FFFFFF',
                    borderRadius: isSys ? '8px' : isAgent ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    padding: '8px 12px',
                    fontSize: '0.83rem',
                    border: isSys ? '1px dashed #64748B' : 'none'
                  }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: '800', opacity: 0.85, marginBottom: '2px' }}>
                      {t.senderName || t.sender} • {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div>{t.message}</div>
                  </div>
                );
              })
            )}
          </div>

          {/* Speech Input Box for Agent */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <input
              type="text"
              placeholder="Type speech to speak to customer on line..."
              value={agentSpeechInput}
              onChange={(e) => setAgentSpeechInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendAgentSpeech(activeQueueCall._id);
              }}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #475569',
                background: '#1E293B',
                color: '#FFFFFF',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
            <button
              onClick={() => handleSendAgentSpeech(activeQueueCall._id)}
              disabled={sendingAgentSpeech || !agentSpeechInput.trim()}
              style={{
                background: '#2563EB',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 18px',
                fontSize: '0.85rem',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <i className="fa-solid fa-microphone"></i>
              <span>Speak to Customer</span>
            </button>
          </div>

          {/* Quick Agent Responses */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: '700' }}>Quick Officer Speak Presets:</span>
            {[
              "Hello! I am reviewing your order details right now.",
              "I have authorized doorstep return pickup for your shipment.",
              "Your refund has been initiated directly to your account.",
              "Could you please confirm your delivery address?"
            ].map((preset, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setAgentSpeechInput(preset);
                }}
                style={{
                  background: '#1E293B',
                  border: '1px solid #475569',
                  color: '#CBD5E1',
                  borderRadius: '12px',
                  padding: '4px 10px',
                  fontSize: '0.73rem',
                  cursor: 'pointer'
                }}
              >
                "{preset}"
              </button>
            ))}
          </div>
        </div>
      )}

      {(callQueueData.waitingQueue.length > 0 || callQueueData.myAssigned.filter(c => c.queueStatus === 'CONNECTING').length > 0) && (
        <div style={{
          background: 'rgba(17, 24, 39, 0.95)',
          borderBottom: '1px solid var(--border-color)',
          padding: '10px 24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-phone-volume" style={{ color: '#F43F5E', animation: 'pulse 1.5s infinite' }}></i>
              <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#F1F5F9' }}>
                Incoming Call Queue ({callQueueData.waitingQueue.length + callQueueData.myAssigned.filter(c => c.queueStatus === 'CONNECTING').length})
              </span>
              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                • {callQueueData.stats?.onlineAgents || 0} agents online • {callQueueData.stats?.allActiveCalls || 0} active calls
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
            {/* Calls assigned to me (CONNECTING) */}
            {callQueueData.myAssigned.filter(c => c.queueStatus === 'CONNECTING').map(call => (
              <div key={call._id} style={{
                background: 'linear-gradient(135deg, #7C2D12 0%, #9A3412 100%)',
                border: '2px solid #F97316',
                borderRadius: '12px',
                padding: '10px 14px',
                minWidth: '260px',
                animation: 'pulse 1.5s infinite'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#FDBA74' }}>📲 ASSIGNED TO YOU</span>
                  <span style={{ fontSize: '0.68rem', color: '#FB923C' }}>{call.ivr?.language}</span>
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: '700', color: '#FFFFFF', marginBottom: '4px' }}>
                  {call.customerName || 'Customer'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#FDBA74', marginBottom: '8px' }}>
                  📞 {call.customerPhone} • {call.ivr?.reason?.replace(/_/g, ' ')}
                  {call.ivr?.orderNumber ? ` • ${call.ivr.orderNumber}` : ''}
                </div>
                <button
                  onClick={() => handleAcceptQueueCall(call._id)}
                  disabled={callQueueLoading}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    color: '#FFFFFF', border: 'none', borderRadius: '8px',
                    padding: '8px', fontWeight: '700', fontSize: '0.82rem',
                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-phone"></i> Accept Call
                </button>
              </div>
            ))}
            {/* General waiting queue */}
            {callQueueData.waitingQueue.map(call => (
              <div key={call._id} style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '10px 14px',
                minWidth: '240px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#38BDF8' }}>#{call.queuePosition || '?'} in queue</span>
                  <span style={{ fontSize: '0.65rem', color: '#64748B', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{call.ivr?.language}</span>
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#F1F5F9', marginBottom: '3px' }}>
                  {call.customerName || 'Customer'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginBottom: '8px' }}>
                  📞 {call.customerPhone} • {call.ivr?.reason?.replace(/_/g, ' ')}
                </div>
                <button
                  onClick={() => handleAcceptQueueCall(call._id)}
                  disabled={callQueueLoading || !!activeQueueCall}
                  style={{
                    width: '100%',
                    background: activeQueueCall ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)',
                    color: '#FFFFFF', border: 'none', borderRadius: '8px',
                    padding: '7px', fontWeight: '700', fontSize: '0.78rem',
                    cursor: activeQueueCall ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    opacity: activeQueueCall ? 0.5 : 1
                  }}
                >
                  <i className="fa-solid fa-phone"></i> {activeQueueCall ? 'Finish current call first' : 'Pick Up'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Console Split View */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '380px 1fr',
        gap: '16px',
        padding: '16px 24px 24px',
        overflow: 'hidden'
      }}>
        {/* Left Column: Tickets Queue Navigation */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Queue Tab Bar */}
          <div style={{
            padding: '10px 12px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            gap: '4px',
            background: 'var(--bg-surface-elevated)'
          }}>
            {[
              { id: 'MY_ASSIGNED', label: 'My Cases', count: myAssignedCount },
              { id: 'CALL_BACK', label: `📞 Calls`, count: callBackQueueCount },
              { id: 'CALL_HISTORY', label: `📜 History`, count: helperCallHistory.length },
              { id: 'UNASSIGNED', label: 'Triage', count: unassignedCount },
              { id: 'ALL', label: 'All Open', count: tickets.length },
              { id: 'RESOLVED', label: 'Resolved', count: resolvedCount }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  background: activeTab === tab.id ? 'var(--bg-primary)' : 'transparent',
                  color: activeTab === tab.id ? '#38BDF8' : '#94A3B8',
                  border: activeTab === tab.id ? '1px solid var(--border-color)' : '1px solid transparent',
                  borderRadius: '6px',
                  padding: '6px 4px',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span style={{
                    fontSize: '0.65rem',
                    background: tab.id === 'CALL_BACK' ? '#E11D48' : 'rgba(255, 255, 255, 0.1)',
                    color: '#FFFFFF',
                    padding: '1px 5px',
                    borderRadius: '10px'
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search & Category Filter */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748B', fontSize: '0.75rem' }}></i>
              <input
                type="text"
                placeholder="Search ticket #, phone, customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 30px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: '#F1F5F9',
                  fontSize: '0.78rem',
                  outline: 'none'
                }}
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                padding: '6px 8px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: '#F1F5F9',
                fontSize: '0.75rem',
                outline: 'none'
              }}
            >
              <option value="ALL">All Depts</option>
              <option value="RETURN_REFUND">Returns & QC</option>
              <option value="DELIVERY_ISSUE">Logistics</option>
              <option value="PAYMENT_PROBLEM">Payments</option>
              <option value="DAMAGED_ITEM">Defects</option>
              <option value="GENERAL_INQUIRY">General</option>
            </select>
          </div>

          {/* Ticket & Call History Cards List */}
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
            {activeTab === 'CALL_HISTORY' ? (
              callHistoryLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                  <i className="fa-solid fa-spinner fa-spin fa-2x" style={{ color: '#06B6D4', marginBottom: '10px' }}></i>
                  <div style={{ fontSize: '0.82rem' }}>Loading Call History...</div>
                </div>
              ) : helperCallHistory.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B' }}>
                  <i className="fa-solid fa-phone-slash fa-3x" style={{ color: '#334155', marginBottom: '12px' }}></i>
                  <div style={{ fontWeight: '700', color: '#94A3B8', fontSize: '0.88rem' }}>No Call History Found</div>
                  <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>Answered call records will appear here.</div>
                </div>
              ) : (
                helperCallHistory.map(call => {
                  const isSelected = selectedHistoryCall?._id === call._id;
                  const durationMin = Math.floor((call.callDurationSeconds || 0) / 60);
                  const durationSec = (call.callDurationSeconds || 0) % 60;
                  const formattedDuration = `${durationMin.toString().padStart(2, '0')}:${durationSec.toString().padStart(2, '0')}`;
                  const orderNum = call.ivr?.orderId?.orderNumber || call.ivr?.orderNumber || 'No Order';

                  return (
                    <div
                      key={call._id}
                      onClick={() => setSelectedHistoryCall(call)}
                      style={{
                        padding: '12px 14px',
                        borderBottom: '1px solid var(--border-color)',
                        background: isSelected ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
                        borderLeft: isSelected ? '4px solid #06B6D4' : '4px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.76rem', fontWeight: '800', color: '#38BDF8', fontFamily: 'monospace' }}>
                          {call.callId}
                        </span>
                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: '800',
                          padding: '2px 6px',
                          borderRadius: '10px',
                          background: call.queueStatus === 'COMPLETED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                          color: call.queueStatus === 'COMPLETED' ? '#34D399' : '#FB7185'
                        }}>
                          {call.queueStatus}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#F8FAFC' }}>
                        📞 {call.customerName || 'Customer'} ({call.customerPhone})
                      </div>

                      <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span>🌐 {call.ivr?.language || 'ENGLISH'}</span>
                        <span>• 📦 {orderNum}</span>
                        <span>• ⏱️ {formattedDuration}</span>
                      </div>
                    </div>
                  );
                })
              )
            ) : loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                <i className="fa-solid fa-spinner fa-spin fa-2x" style={{ color: '#06B6D4', marginBottom: '10px' }}></i>
                <div style={{ fontSize: '0.82rem' }}>Loading Queue...</div>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B' }}>
                <i className="fa-solid fa-clipboard-check fa-3x" style={{ color: '#334155', marginBottom: '12px' }}></i>
                <div style={{ fontWeight: '700', color: '#94A3B8', fontSize: '0.88rem' }}>No tickets in this queue</div>
                <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>All inquiries currently handled.</div>
              </div>
            ) : (
              filteredTickets.map(t => {
                const isSelected = selectedTicket?._id === t._id;
                const isAssignedToMe = t.assignedWorker?.workerId === worker.workerId;
                const isCallBack = t.contactChannel === 'CALL_BACK';

                return (
                  <div
                    key={t._id}
                    onClick={() => setSelectedTicket(t)}
                    style={{
                      padding: '14px 16px',
                      borderBottom: '1px solid var(--border-color)',
                      background: isSelected ? 'rgba(6, 182, 212, 0.08)' : 'transparent',
                      borderLeft: isSelected ? '4px solid #06B6D4' : '4px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#38BDF8', fontFamily: 'var(--font-mono)' }}>
                          {t.ticketNumber}
                        </span>
                        {isCallBack && (
                          <span style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#FB7185', border: '1px solid rgba(244, 63, 94, 0.3)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '800' }}>
                            📞 CALL
                          </span>
                        )}
                        {t.assignedWorker?.autoAssigned && (
                          <span style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#A78BFA', padding: '1px 5px', borderRadius: '4px', fontSize: '0.62rem', fontWeight: '700' }} title="Assigned by system load balancing">
                            🤖 AUTO
                          </span>
                        )}
                      </div>
                      <span className={`badge ${
                        t.status === 'OPEN' ? 'badge-open' :
                        t.status === 'IN_PROGRESS' ? 'badge-progress' :
                        t.status === 'WAITING_CUSTOMER' ? 'badge-waiting' : 'badge-resolved'
                      }`}>
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.88rem', fontWeight: '700', color: '#F1F5F9', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.subject}
                    </div>

                    <div style={{ fontSize: '0.75rem', color: '#94A3B8', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>👤 {t.customerId?.name || 'Customer'}</span>
                      <span style={{ color: '#64748B' }}>{new Date(t.updatedAt || t.createdAt).toLocaleDateString('en-IN')}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
                      <span style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        color: '#94A3B8'
                      }}>
                        {t.category.replace('_', ' ')}
                      </span>

                      {isAssignedToMe ? (
                        <span style={{ color: '#10B981', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <i className="fa-solid fa-check-double"></i> Assigned to You
                        </span>
                      ) : t.assignedWorker?.name ? (
                        <span style={{ color: '#64748B' }}>
                          {t.assignedWorker.name.split(' ')[0]} ({t.assignedWorker.workerId})
                        </span>
                      ) : (
                        <span style={{ color: '#F59E0B', fontWeight: '700' }}>
                          ⚠️ Unclaimed
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Dual Resolution Workbench / Call History Inspector */}
        {activeTab === 'CALL_HISTORY' ? (
          selectedHistoryCall ? (
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              padding: '24px'
            }}>
              {/* Call Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', pb: '16px', marginBottom: '20px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: '800', color: '#38BDF8', fontFamily: 'monospace' }}>
                      {selectedHistoryCall.callId}
                    </span>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: '800',
                      padding: '3px 10px',
                      borderRadius: '20px',
                      background: selectedHistoryCall.queueStatus === 'COMPLETED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                      color: selectedHistoryCall.queueStatus === 'COMPLETED' ? '#34D399' : '#FB7185'
                    }}>
                      ● {selectedHistoryCall.queueStatus}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#94A3B8', marginTop: '4px' }}>
                    Customer: <strong>{selectedHistoryCall.customerName || 'Customer'}</strong> ({selectedHistoryCall.customerPhone}) • Email: {selectedHistoryCall.customerEmail || selectedHistoryCall.customerId?.email || 'N/A'}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Call Duration</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#38BDF8' }}>
                    ⏱️ {Math.floor((selectedHistoryCall.callDurationSeconds || 0) / 60)}m {(selectedHistoryCall.callDurationSeconds || 0) % 60}s
                  </div>
                </div>
              </div>

              {/* Call Recording Player */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid #334155',
                borderRadius: '12px',
                padding: '16px 20px',
                marginBottom: '20px'
              }}>
                <div style={{ fontSize: '0.82rem', fontWeight: '800', color: '#38BDF8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-file-audio"></i>
                  <span>Recorded Voice Message &amp; Call Audio</span>
                </div>
                <audio controls src={selectedHistoryCall.recordingUrl} style={{ width: '100%', outline: 'none', height: '40px' }} />
                <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '6px' }}>
                  🔒 Encrypted audio recording logged for quality audit.
                </div>
              </div>

              {/* Details Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                {/* Product / Order Info */}
                <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#10B981', textTransform: 'uppercase', marginBottom: '8px' }}>
                    📦 Product / Order Details
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#F1F5F9', fontFamily: 'monospace' }}>
                    Order #: {selectedHistoryCall.ivr?.orderId?.orderNumber || selectedHistoryCall.ivr?.orderNumber || 'No Order Linked'}
                  </div>
                  {selectedHistoryCall.ivr?.orderId?.totalAmount && (
                    <div style={{ fontSize: '0.82rem', color: '#94A3B8', marginTop: '4px' }}>
                      Order Amount: <strong>₹{selectedHistoryCall.ivr.orderId.totalAmount}</strong> • Status: <span style={{ color: '#34D399', fontWeight: '700' }}>{selectedHistoryCall.ivr.orderId.orderStatus}</span>
                    </div>
                  )}
                  {selectedHistoryCall.ivr?.orderId?.items && selectedHistoryCall.ivr.orderId.items.length > 0 && (
                    <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#CBD5E1' }}>
                      Products: {selectedHistoryCall.ivr.orderId.items.map(i => i.title || i.productName || 'Item').join(', ')}
                    </div>
                  )}
                </div>

                {/* IVR Language & Reason */}
                <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#F59E0B', textTransform: 'uppercase', marginBottom: '8px' }}>
                    🌐 IVR Intake &amp; Language
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#F1F5F9' }}>
                    Selected Language: <strong style={{ color: '#38BDF8' }}>{selectedHistoryCall.ivr?.language || 'ENGLISH'}</strong>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#F1F5F9', marginTop: '4px' }}>
                    Intake Reason: <strong>{(selectedHistoryCall.ivr?.reason || 'OTHER').replace('_', ' ')}</strong>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: '4px' }}>
                    Assigned Helper: {selectedHistoryCall.assignedAgent?.name || worker.name} ({selectedHistoryCall.assignedAgent?.workerId || worker.workerId})
                  </div>
                </div>
              </div>

              {/* Call Timings Timeline */}
              <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#A78BFA', textTransform: 'uppercase', marginBottom: '8px' }}>
                  🕒 Call Timings Audit
                </div>
                <div style={{ fontSize: '0.78rem', color: '#CBD5E1', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  <span>Request Created: <strong>{new Date(selectedHistoryCall.createdAt).toLocaleString('en-IN')}</strong></span>
                  <span>Connected At: <strong>{selectedHistoryCall.callConnectedAt ? new Date(selectedHistoryCall.callConnectedAt).toLocaleTimeString('en-IN') : 'N/A'}</strong></span>
                  <span>Ended At: <strong>{selectedHistoryCall.callEndedAt ? new Date(selectedHistoryCall.callEndedAt).toLocaleTimeString('en-IN') : 'N/A'}</strong></span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', color: '#64748B' }}>
              <i className="fa-solid fa-phone-volume fa-3x" style={{ marginBottom: '16px', color: '#334155' }}></i>
              <div style={{ fontSize: '1rem', fontWeight: '700', color: '#94A3B8' }}>Select a call record to inspect audio recording &amp; timings</div>
              <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>Click any call item on the left panel.</div>
            </div>
          )
        ) : selectedTicket ? (
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Top Case Meta & Telephony Action Bar */}
            <div style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg-surface-elevated)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#06B6D4', fontFamily: 'var(--font-mono)' }}>
                    {selectedTicket.ticketNumber}
                  </span>
                  <span className={`badge ${
                    selectedTicket.status === 'OPEN' ? 'badge-open' :
                    selectedTicket.status === 'IN_PROGRESS' ? 'badge-progress' :
                    selectedTicket.status === 'WAITING_CUSTOMER' ? 'badge-waiting' : 'badge-resolved'
                  }`}>
                    {selectedTicket.status.replace('_', ' ')}
                  </span>
                  <span style={{ fontSize: '0.72rem', background: 'rgba(255, 255, 255, 0.08)', color: '#CBD5E1', padding: '2px 8px', borderRadius: '4px' }}>
                    {selectedTicket.category.replace('_', ' ')}
                  </span>
                  {selectedTicket.contactChannel === 'CALL_BACK' && (
                    <span style={{ background: 'rgba(244, 63, 94, 0.2)', color: '#FB7185', border: '1px solid rgba(244, 63, 94, 0.4)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '800' }}>
                      📞 PHONE CALL REQUEST
                    </span>
                  )}
                  {selectedTicket.assignedWorker?.autoAssigned && (
                    <span style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#A78BFA', border: '1px solid rgba(139, 92, 246, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '700' }}>
                      🤖 Auto-Assigned by Engine
                    </span>
                  )}
                </div>

                <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#F1F5F9', margin: 0 }}>
                  {selectedTicket.subject}
                </h2>

                <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: '4px', display: 'flex', gap: '16px' }}>
                  <span>Customer: <strong style={{ color: '#F1F5F9' }}>{selectedTicket.customerId?.name}</strong></span>
                  <span>Email: <strong style={{ color: '#F1F5F9' }}>{selectedTicket.customerId?.email}</strong></span>
                  <span>Phone: <strong style={{ color: '#F1F5F9' }}>{selectedTicket.customerPhone || selectedTicket.customerId?.phone || 'N/A'}</strong></span>
                </div>
              </div>

              {/* Action Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>

                {/* Call Customer Option - Enabled at ANY time UNTIL complaint is solved */}
                {selectedTicket.status !== 'RESOLVED' && selectedTicket.status !== 'CLOSED' ? (
                  <button
                    onClick={() => handleStartCall(selectedTicket)}
                    disabled={actionLoading || activeCallTicket?._id === selectedTicket._id}
                    className="btn-primary"
                    style={{
                      background: activeCallTicket?._id === selectedTicket._id
                        ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                        : 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
                      fontSize: '0.78rem',
                      padding: '7px 14px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <i className="fa-solid fa-phone"></i>
                    <span>{activeCallTicket?._id === selectedTicket._id ? '📞 Call Active...' : '📞 Call Customer'}</span>
                  </button>
                ) : (
                  <span style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#F87171',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: '700',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <i className="fa-solid fa-phone-slash"></i>
                    <span>Call Disabled (Complaint Solved)</span>
                  </span>
                )}

                {selectedTicket.assignedWorker?.workerId !== worker.workerId && (
                  <button
                    onClick={() => handleClaimTicket(selectedTicket._id)}
                    disabled={actionLoading}
                    className="btn-primary"
                    style={{ padding: '7px 14px', fontSize: '0.8rem' }}
                  >
                    <i className="fa-solid fa-hand"></i>
                    <span>Claim Case</span>
                  </button>
                )}

                <button
                  onClick={() => setShowResolveModal(true)}
                  disabled={actionLoading || selectedTicket.status === 'RESOLVED'}
                  className="btn-primary"
                  style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', fontSize: '0.78rem', padding: '7px 12px' }}
                >
                  <i className="fa-solid fa-check"></i>
                  <span>Resolve Case</span>
                </button>
              </div>
            </div>

            {/* CUSTOMER DETAILS & COMPLETED PRODUCTS CARD */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.95)',
              borderBottom: '1px solid var(--border-color)',
              padding: '12px 20px',
              display: 'flex',
              gap: '16px',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              {/* Customer Info Box */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0EA5E9 0%, #2563EB 100%)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '800',
                  fontSize: '0.9rem'
                }}>
                  {selectedTicket.customerId?.name?.charAt(0) || 'C'}
                </div>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: '800', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>Customer: {selectedTicket.customerId?.name || 'Customer'}</span>
                    <span style={{ fontSize: '0.7rem', color: '#34D399', background: 'rgba(52, 211, 153, 0.15)', padding: '1px 6px', borderRadius: '4px' }}>Verified User</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#94A3B8', display: 'flex', gap: '12px', marginTop: '2px' }}>
                    <span>📞 {selectedTicket.customerPhone || selectedTicket.customerId?.phone || 'N/A'}</span>
                    <span>✉️ {selectedTicket.customerId?.email || 'N/A'}</span>
                    {selectedTicket.customerId?.walletBalance !== undefined && (
                      <span style={{ color: '#F59E0B' }}>💰 Wallet: ₹{selectedTicket.customerId.walletBalance}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Completed Products Summary Box */}
              {(selectedTicket.orderNumber || selectedTicket.orderId || inspectedOrderData) && (
                <div style={{
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '8px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px'
                }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#38BDF8', textTransform: 'uppercase' }}>
                      📦 Completed Order / Products
                    </div>
                    <div style={{ fontSize: '0.82rem', fontWeight: '800', color: '#F1F5F9', fontFamily: 'var(--font-mono)' }}>
                      #{selectedTicket.orderNumber || selectedTicket.orderId?.orderNumber || inspectedOrderData?.orderNumber || 'Order Linked'}
                    </div>
                  </div>

                  {(selectedTicket.orderId?.items || inspectedOrderData?.items) && (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {(selectedTicket.orderId?.items || inspectedOrderData?.items || []).slice(0, 3).map((item, idx) => (
                        <div key={idx} title={item.title || item.name} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#0F172A', padding: '3px 8px', borderRadius: '6px', border: '1px solid #334155', fontSize: '0.72rem', color: '#CBD5E1' }}>
                          {item.image && <img src={item.image} alt="" style={{ width: '16px', height: '16px', borderRadius: '3px', objectFit: 'cover' }} />}
                          <span style={{ maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title || item.name}</span>
                          <span style={{ color: '#94A3B8' }}>x{item.quantity || 1}</span>
                        </div>
                      ))}
                      {(selectedTicket.orderId?.items || inspectedOrderData?.items || []).length > 3 && (
                        <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>+{(selectedTicket.orderId?.items || inspectedOrderData?.items).length - 3} more</span>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setCaseViewMode('ORDER_WORKBENCH');
                      if (selectedTicket.orderNumber || selectedTicket.orderId) {
                        handleInspectOrder(selectedTicket.orderNumber || selectedTicket.orderId?._id || selectedTicket.orderId);
                      }
                    }}
                    style={{
                      background: '#0EA5E9',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '0.72rem',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Inspect Products
                  </button>
                </div>
              )}
            </div>

            {/* CASE SUB-TAB SELECTOR: ORDER INVESTIGATION (CORE PROCESS) vs CHAT */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.9)',
              borderBottom: '1px solid var(--border-color)',
              padding: '0 20px',
              display: 'flex',
              gap: '12px'
            }}>
              <button
                onClick={() => setCaseViewMode('ORDER_WORKBENCH')}
                style={{
                  padding: '10px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: caseViewMode === 'ORDER_WORKBENCH' ? '3px solid #06B6D4' : '3px solid transparent',
                  color: caseViewMode === 'ORDER_WORKBENCH' ? '#38BDF8' : '#94A3B8',
                  fontWeight: '800',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <i className="fa-solid fa-magnifying-glass-chart"></i>
                <span>🔍 Order Investigation &amp; Remediation (Core Process)</span>
                {inspectedOrderData && <span style={{ background: '#10B981', color: '#FFFFFF', padding: '1px 6px', borderRadius: '10px', fontSize: '0.65rem' }}>Active</span>}
              </button>
            </div>

            {/* ========================================================================= */}
            {/* SUB-VIEW 1: ORDER INVESTIGATION & REMEDIATION WORKBENCH */}
            {/* "the main process is here not calling or msg uing checking order" */}
            {/* ========================================================================= */}
            {caseViewMode === 'ORDER_WORKBENCH' && renderOrderWorkbenchSection()}

            {/* ========================================================================= */}
            {/* SUB-VIEW 2: CHAT & TELEPHONY AUDIT THREAD */}
            {/* ========================================================================= */}
            {caseViewMode === 'CHAT_THREAD' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  {selectedTicket.messages && selectedTicket.messages.map((msg, idx) => {
                    const isCustomer = msg.senderRole === 'customer';
                    const isSystem = msg.senderRole === 'system';

                    if (isSystem) {
                      return (
                        <div key={idx} style={{ textAlign: 'center', margin: '6px 0' }}>
                          <span style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '20px',
                            padding: '4px 14px',
                            fontSize: '0.74rem',
                            color: '#CBD5E1',
                            display: 'inline-block',
                            maxWidth: '85%'
                          }}>
                            {msg.message} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isCustomer ? 'flex-start' : 'flex-end',
                          maxWidth: '75%',
                          alignSelf: isCustomer ? 'flex-start' : 'flex-end'
                        }}
                      >
                        <div style={{ fontSize: '0.72rem', color: '#64748B', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{msg.senderName}</span>
                          <span style={{
                            fontSize: '0.65rem',
                            background: isCustomer ? 'rgba(59, 130, 246, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                            color: isCustomer ? '#60A5FA' : '#22D3EE',
                            padding: '1px 5px',
                            borderRadius: '4px'
                          }}>
                            {isCustomer ? 'Customer' : 'Support Officer'}
                          </span>
                          <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        <div style={{
                          background: isCustomer ? 'var(--bg-surface-elevated)' : 'linear-gradient(135deg, #0284C7 0%, #2563EB 100%)',
                          color: '#F1F5F9',
                          border: isCustomer ? '1px solid var(--border-color)' : 'none',
                          borderRadius: isCustomer ? '14px 14px 14px 2px' : '14px 14px 2px 14px',
                          padding: '10px 14px',
                          fontSize: '0.85rem',
                          lineHeight: '1.5',
                          boxShadow: isCustomer ? 'none' : '0 2px 8px rgba(37, 99, 235, 0.25)'
                        }}>
                          {msg.message}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatBottomRef} />
                </div>

                {/* Quick Reply Macros Toolbar */}
                <div style={{
                  padding: '8px 16px',
                  borderTop: '1px solid var(--border-color)',
                  background: 'rgba(17, 24, 39, 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  overflowX: 'auto'
                }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748B', whiteSpace: 'nowrap' }}>
                    Quick Macros:
                  </span>
                  {quickMacros.map((macro, i) => (
                    <button
                      key={i}
                      onClick={() => setMessageInput(macro.text)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--border-color)',
                        color: '#94A3B8',
                        borderRadius: '20px',
                        padding: '3px 10px',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s'
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.borderColor = '#06B6D4'; e.currentTarget.style.color = '#F1F5F9'; }}
                      onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = '#94A3B8'; }}
                    >
                      {macro.title}
                    </button>
                  ))}
                </div>

                {/* Message Reply Form */}
                <form onSubmit={handleSendMessage} style={{
                  padding: '12px 16px',
                  borderTop: '1px solid var(--border-color)',
                  background: 'var(--bg-surface-elevated)',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-end'
                }}>
                  <textarea
                    rows="2"
                    placeholder={`Type resolution reply as Officer ${worker.name}...`}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                      color: '#F1F5F9',
                      fontSize: '0.85rem',
                      resize: 'none',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="submit"
                    disabled={sendingMessage || !messageInput.trim()}
                    className="btn-primary"
                    style={{ height: '44px', padding: '0 18px', opacity: messageInput.trim() ? 1 : 0.6 }}
                  >
                    {sendingMessage ? (
                      <i className="fa-solid fa-spinner fa-spin"></i>
                    ) : (
                      <>
                        <i className="fa-solid fa-paper-plane"></i>
                        <span>Send</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        ) : (
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg-surface-elevated)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#F1F5F9', margin: 0 }}>
                  🔍 Live Order Diagnostics &amp; Remediation Workbench
                </h2>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '2px' }}>
                  Core Process: Type or paste any Order ID to check all details and execute instant remediation.
                </div>
              </div>
            </div>
            {renderOrderWorkbenchSection()}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* RESOLUTION ACTION EXECUTION MODAL (Forms for Refund, Pickup, etc.) */}
      {/* ========================================================================= */}
      {actionModalType && inspectedOrderData?.order && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 120,
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '500px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#F1F5F9', margin: 0 }}>
                {actionModalType === 'REFUND' && '💰 Issue Instant Wallet Refund'}
                {actionModalType === 'PICKUP' && '📦 Authorize Return & Dispatch Courier'}
                {actionModalType === 'EXPEDITE' && '🛵 Expedite Delayed Order'}
                {actionModalType === 'GOODWILL' && '🎁 Grant Customer Goodwill Store Credit'}
                {actionModalType === 'CANCEL' && '✕ Cancel Order & Refund Full Amount'}
              </h3>
              <button
                onClick={() => setActionModalType(null)}
                style={{ background: 'transparent', border: 'none', color: '#64748B', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteResolution}>
              {(actionModalType === 'REFUND' || actionModalType === 'GOODWILL') && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#94A3B8', marginBottom: '6px' }}>
                    Credit Amount (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    value={actionFormData.amount}
                    onChange={(e) => setActionFormData({ ...actionFormData, amount: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: '#F1F5F9',
                      fontSize: '0.9rem',
                      fontFamily: 'var(--font-mono)'
                    }}
                  />
                </div>
              )}

              {actionModalType === 'PICKUP' && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#94A3B8', marginBottom: '6px' }}>
                    Return Resolution Type
                  </label>
                  <select
                    value={actionFormData.exchangeOrRefund}
                    onChange={(e) => setActionFormData({ ...actionFormData, exchangeOrRefund: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: '#F1F5F9',
                      fontSize: '0.85rem'
                    }}
                  >
                    <option value="REFUND">Doorstep Pickup + Full Refund</option>
                    <option value="EXCHANGE">Doorstep Pickup + Size / Variant Exchange</option>
                  </select>
                </div>
              )}

              {actionModalType === 'EXPEDITE' && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#94A3B8', marginBottom: '6px' }}>
                    Priority Escalation Instructions
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Customer urgently departing, prioritize before 2 PM"
                    value={actionFormData.priorityNotes}
                    onChange={(e) => setActionFormData({ ...actionFormData, priorityNotes: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: '#F1F5F9',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
              )}

              {actionModalType === 'CANCEL' && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#94A3B8', marginBottom: '6px' }}>
                    Reason for Emergency Cancellation
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Courier lost package / Customer request"
                    value={actionFormData.cancellationReason}
                    onChange={(e) => setActionFormData({ ...actionFormData, cancellationReason: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: '#F1F5F9',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
              )}

              {(actionModalType === 'REFUND' || actionModalType === 'PICKUP' || actionModalType === 'GOODWILL') && (
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#94A3B8', marginBottom: '6px' }}>
                    Internal Resolution Reason &amp; Audit Note *
                  </label>
                  <textarea
                    rows="3"
                    required
                    placeholder="Enter reason for audit trail..."
                    value={actionFormData.reason}
                    onChange={(e) => setActionFormData({ ...actionFormData, reason: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: '#F1F5F9',
                      fontSize: '0.85rem',
                      resize: 'none'
                    }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setActionModalType(null)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-primary"
                  style={{
                    background: actionModalType === 'CANCEL' ? '#DC2626' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                  }}
                >
                  {actionLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                  <span>Confirm &amp; Execute Action</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolution Notes Modal */}
      {showResolveModal && selectedTicket && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '520px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#34D399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fa-solid fa-circle-check"></i>
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#F1F5F9', margin: 0 }}>
                    Resolve Ticket #{selectedTicket.ticketNumber}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Officer Resolution Note &amp; Audit Trail</span>
                </div>
              </div>
              <button
                onClick={() => setShowResolveModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: '#94A3B8', fontSize: '0.82rem', marginBottom: '14px', lineHeight: '1.4' }}>
              Document the resolution actions taken (e.g. Return authorized, refund credited, replacement dispatched, or phone inquiry clarified).
            </p>

            <textarea
              rows="4"
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Enter official resolution details for audit..."
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                color: '#F1F5F9',
                fontSize: '0.85rem',
                outline: 'none',
                marginBottom: '18px'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowResolveModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateStatus(selectedTicket._id, 'RESOLVED', resolutionNotes)}
                disabled={actionLoading}
                className="btn-primary"
                style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
              >
                {actionLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                <span>Confirm Resolution &amp; Close</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
