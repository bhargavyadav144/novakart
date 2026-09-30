import React, { useEffect, useState, useRef } from 'react';
import adminApi from '../services/adminApi';

export default function AdminHelpCenterPage() {
  // Main Mode Navigation: 'WORKBENCH' (Default Primary Process!), 'TICKETS', 'STAFF'
  const [activeMainTab, setActiveMainTab] = useState('WORKBENCH');

  // ==========================================
  // SUPPORT WORKERS & STAFF ROSTER
  // ==========================================
  const [workers, setWorkers] = useState([]);
  const [workersLoading, setWorkersLoading] = useState(true);
  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);
  const [submittingWorker, setSubmittingWorker] = useState(false);
  const [workerForm, setWorkerForm] = useState({
    name: '',
    email: '',
    password: 'Support@1234',
    specialty: 'Returns & QC Verification',
    phone: '+91 98765 43210',
    workerId: ''
  });

  // ==========================================
  // INBOUND TICKETS & CALL-BACK REQUESTS
  // ==========================================
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Ticket sub-tab: 'ORDER_DIAGNOSTICS' (Default) vs 'CHAT_THREAD'
  const [ticketSubTab, setTicketSubTab] = useState('ORDER_DIAGNOSTICS');

  // Reply & Resolution State
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [showResolveModal, setShowResolveModal] = useState(false);

  // Executive metrics state
  const [executiveMetrics, setExecutiveMetrics] = useState(null);

  // ==========================================
  // TELEPHONY & PERSISTENT LIVE CALL BAR (NON-BLOCKING)
  // ==========================================
  const [activeCallTicket, setActiveCallTicket] = useState(null);
  const [callTimer, setCallTimer] = useState(0);
  const [callIntervalId, setCallIntervalId] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callOutcome, setCallOutcome] = useState('RESOLVED_ON_CALL');
  const [callNotes, setCallNotes] = useState('');

  // ==========================================
  // ORDER INVESTIGATION & REMEDIATION WORKBENCH
  // ==========================================
  const [orderSearchInput, setOrderSearchInput] = useState('');
  const [inspectedOrderData, setInspectedOrderData] = useState(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  // ==========================================
  // CONCRETE RESOLUTION ACTIONS MODAL STATE
  // ==========================================
  const [actionModalType, setActionModalType] = useState(null); // 'REFUND' | 'PICKUP' | 'EXPEDITE' | 'GOODWILL' | 'CANCEL'
  const [actionFormData, setActionFormData] = useState({
    amount: '',
    reason: '',
    exchangeOrRefund: 'REFUND',
    priorityNotes: '',
    cancellationReason: ''
  });
  const [actionLoading, setActionLoading] = useState(false);

  const chatBottomRef = useRef(null);

  // ==========================================
  // ADMIN TELEPHONY & CALL HISTORY STATE
  // ==========================================
  const [adminCallHistory, setAdminCallHistory] = useState([]);
  const [adminCallHistoryLoading, setAdminCallHistoryLoading] = useState(false);
  const [adminCallStatusFilter, setAdminCallStatusFilter] = useState('ALL');
  const [adminCallLangFilter, setAdminCallLangFilter] = useState('ALL');
  const [adminCallSearch, setAdminCallSearch] = useState('');
  const [selectedAdminCall, setSelectedAdminCall] = useState(null);

  const fetchAdminCallHistory = async () => {
    setAdminCallHistoryLoading(true);
    try {
      const { data } = await adminApi.get('/call-queue/admin/history', {
        params: {
          status: adminCallStatusFilter !== 'ALL' ? adminCallStatusFilter : undefined,
          language: adminCallLangFilter !== 'ALL' ? adminCallLangFilter : undefined,
          agent: adminCallSearch || undefined
        }
      });
      if (data.success) {
        setAdminCallHistory(data.calls || []);
      }
    } catch (err) {
      console.error('Error fetching admin call history:', err);
    } finally {
      setAdminCallHistoryLoading(false);
    }
  };

  // Caller Pending Orders & Recent Deliveries State
  const [callerOrders, setCallerOrders] = useState([]);
  const [callerOrdersLoading, setCallerOrdersLoading] = useState(false);

  const fetchCallerPendingOrders = async (customerId, phone, email) => {
    if (!customerId && !phone && !email) {
      setCallerOrders([]);
      return;
    }
    setCallerOrdersLoading(true);
    try {
      const { data } = await adminApi.get('/support/customer-pending-orders', {
        params: { customerId, phone, email }
      });
      if (data.success) {
        setCallerOrders(data.recentOrders || []);
      }
    } catch (err) {
      console.error('Error fetching caller pending orders:', err);
    } finally {
      setCallerOrdersLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTicket) {
      const custId = selectedTicket.customerId?._id || selectedTicket.customerId;
      const phone = selectedTicket.customerPhone || selectedTicket.customerId?.phone;
      const email = selectedTicket.customerEmail || selectedTicket.customerId?.email;
      fetchCallerPendingOrders(custId, phone, email);
    }
  }, [selectedTicket?._id]);

  useEffect(() => {
    fetchWorkers();
    fetchTickets();
    fetchExecutiveMetrics();
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [statusFilter, categoryFilter]);

  useEffect(() => {
    if (activeMainTab === 'CALL_HISTORY') {
      fetchAdminCallHistory();
    }
  }, [activeMainTab, adminCallStatusFilter, adminCallLangFilter]);

  // When selected ticket changes, pre-load order into inspector
  useEffect(() => {
    if (selectedTicket) {
      if (selectedTicket.orderNumber || selectedTicket.orderId) {
        const orderIdToInspect = selectedTicket.orderNumber || (selectedTicket.orderId?._id || selectedTicket.orderId);
        setOrderSearchInput(selectedTicket.orderNumber || orderIdToInspect);
        handleInspectOrder(orderIdToInspect, false);
      }
    }
  }, [selectedTicket?._id]);

  // Call timer interval handler
  useEffect(() => {
    if (activeCallTicket && activeCallTicket.callBackDetails?.status === 'CALLING') {
      const interval = setInterval(() => {
        setCallTimer(prev => prev + 1);
      }, 1000);
      setCallIntervalId(interval);
      return () => clearInterval(interval);
    } else {
      if (callIntervalId) clearInterval(callIntervalId);
    }
  }, [activeCallTicket?.callBackDetails?.status]);

  // Scroll chat to bottom when chat messages change
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedTicket?.messages, ticketSubTab]);

  const fetchExecutiveMetrics = async () => {
    try {
      const { data } = await adminApi.get('/support/admin/executive-metrics');
      if (data.success) {
        setExecutiveMetrics(data.metrics);
      }
    } catch (err) {
      console.error('Error fetching executive metrics:', err);
    }
  };

  const fetchWorkers = async () => {
    setWorkersLoading(true);
    try {
      const { data } = await adminApi.get('/support/admin/workers');
      if (data.success) {
        setWorkers(data.workers || []);
      }
    } catch (err) {
      console.error('Error fetching support workers:', err);
    } finally {
      setWorkersLoading(false);
    }
  };

  const fetchTickets = async () => {
    setTicketsLoading(true);
    try {
      const { data } = await adminApi.get('/support/admin/tickets', {
        params: {
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
          search: searchQuery || undefined
        }
      });
      if (data.success) {
        setTickets(data.tickets || []);
        if (data.tickets.length > 0 && !selectedTicket) {
          setSelectedTicket(data.tickets[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching admin tickets:', err);
    } finally {
      setTicketsLoading(false);
    }
  };

  // ==========================================
  // TELEPHONY ACTIONS (NON-BLOCKING DOCKED CALL)
  // ==========================================
  const handleStartCall = async (ticket) => {
    setActionLoading(true);
    try {
      const { data } = await adminApi.put(`/support/worker/tickets/${ticket._id}/call-start`);
      if (data.success) {
        setActiveCallTicket(data.ticket);
        setSelectedTicket(data.ticket);
        setCallTimer(0);
        setCallNotes('');
        setCallOutcome('RESOLVED_ON_CALL');
        // Pre-fill and inspect order on call start
        if (data.ticket.orderNumber || data.ticket.orderId) {
          const ordId = data.ticket.orderNumber || data.ticket.orderId._id || data.ticket.orderId;
          setOrderSearchInput(ordId);
          handleInspectOrder(ordId, false);
        }
        await fetchTickets();
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
      const { data } = await adminApi.put(`/support/worker/tickets/${activeCallTicket._id}/call-end`, {
        durationSeconds: callTimer,
        callNotes: callNotes || 'Customer call completed by Admin.',
        outcome: callOutcome,
        resolveTicket: resolveTicketAfterCall
      });
      if (data.success) {
        setSelectedTicket(data.ticket);
        setActiveCallTicket(null);
        setCallTimer(0);
        await fetchTickets();
        await fetchExecutiveMetrics();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to conclude call session');
    } finally {
      setActionLoading(false);
    }
  };

  // ==========================================
  // ORDER INSPECTION (THE PRIMARY CORE PROCESS)
  // ==========================================
  const handleInspectOrder = async (orderIdToSearch = null, showAlerts = true) => {
    const target = orderIdToSearch || orderSearchInput;
    if (!target || !target.trim()) {
      if (showAlerts) alert('Please enter an Order ID or Ticket Order Number to inspect');
      return;
    }

    setInspectLoading(true);
    try {
      const { data } = await adminApi.get(`/support/orders/inspect/${encodeURIComponent(target.trim())}`);
      if (data.success) {
        setInspectedOrderData(data);
      }
    } catch (err) {
      console.error('Inspection error:', err);
      if (showAlerts) alert(err.response?.data?.message || 'Order or return details not found for this query.');
      setInspectedOrderData(null);
    } finally {
      setInspectLoading(false);
    }
  };

  // ==========================================
  // CONCRETE REMEDIATION ACTIONS (ONE-CLICK FIXES)
  // ==========================================
  const handleExecuteResolution = async (e) => {
    e.preventDefault();
    if (!inspectedOrderData?.order) return;
    const orderId = inspectedOrderData.order._id;
    const ticketId = selectedTicket?._id;
    setActionLoading(true);

    try {
      if (actionModalType === 'REFUND') {
        const { data } = await adminApi.post(`/support/worker/orders/${orderId}/refund`, {
          amount: Number(actionFormData.amount),
          reason: actionFormData.reason,
          ticketId
        });
        alert(data.message);
        if (data.ticket) setSelectedTicket(data.ticket);
      } else if (actionModalType === 'PICKUP') {
        const { data } = await adminApi.post(`/support/worker/orders/${orderId}/authorize-return-pickup`, {
          reason: actionFormData.reason,
          exchangeOrRefund: actionFormData.exchangeOrRefund,
          ticketId
        });
        alert(data.message);
        if (data.ticket) setSelectedTicket(data.ticket);
      } else if (actionModalType === 'EXPEDITE') {
        const { data } = await adminApi.post(`/support/worker/orders/${orderId}/expedite-delivery`, {
          priorityNotes: actionFormData.priorityNotes,
          ticketId
        });
        alert(data.message);
        if (data.ticket) setSelectedTicket(data.ticket);
      } else if (actionModalType === 'GOODWILL') {
        const custId = inspectedOrderData.order.customerId?._id || inspectedOrderData.order.customerId;
        const { data } = await adminApi.post(`/support/worker/customers/${custId}/goodwill-credit`, {
          amount: Number(actionFormData.amount) || 100,
          reason: actionFormData.reason,
          ticketId
        });
        alert(data.message);
        if (data.ticket) setSelectedTicket(data.ticket);
      } else if (actionModalType === 'CANCEL') {
        const { data } = await adminApi.post(`/support/worker/orders/${orderId}/cancel-and-refund`, {
          cancellationReason: actionFormData.cancellationReason,
          ticketId
        });
        alert(data.message);
        if (data.ticket) setSelectedTicket(data.ticket);
      } else if (actionModalType === 'PAYMENT_ADMIN_REQUEST') {
        const { data } = await adminApi.post(`/support/worker/orders/${orderId}/send-payment-request`, {
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
        const { data } = await adminApi.put(`/returns/${returnId}/update-instructions-data`, {
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
      // Re-inspect to refresh diagnostics
      await handleInspectOrder(inspectedOrderData.order._id, false);
      await fetchTickets();
      await fetchExecutiveMetrics();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to execute resolution action');
    } finally {
      setActionLoading(false);
    }
  };

  // Staff onboarding & status
  const handleAddWorker = async (e) => {
    e.preventDefault();
    if (!workerForm.name || !workerForm.email || !workerForm.password) {
      alert('Please fill in Name, Email and Password');
      return;
    }

    setSubmittingWorker(true);
    try {
      const { data } = await adminApi.post('/support/admin/workers', workerForm);
      if (data.success) {
        alert(data.message || 'Support Worker successfully created by Admin!');
        setShowAddWorkerModal(false);
        setWorkerForm({
          name: '',
          email: '',
          password: 'Support@1234',
          specialty: 'Returns & QC Verification',
          phone: '+91 98765 43210',
          workerId: ''
        });
        fetchWorkers();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to onboard support worker');
    } finally {
      setSubmittingWorker(false);
    }
  };

  const handleToggleBlockWorker = async (workerId, currentBlocked, workerName) => {
    const action = currentBlocked ? 'ACTIVATE' : 'SUSPEND';
    if (!confirm(`Are you sure you want to ${action} Officer ${workerName}?`)) return;

    try {
      const { data } = await adminApi.put(`/support/admin/workers/${workerId}/toggle-block`);
      if (data.success) {
        alert(data.message);
        fetchWorkers();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to toggle status');
    }
  };

  const handleAssignWorker = async (ticketId, workerId) => {
    try {
      const res = await adminApi.put(`/support/admin/tickets/${ticketId}/assign`, { workerId });
      if (res.data.success) {
        alert(`Assigned ticket to support worker!`);
        setSelectedTicket(res.data.ticket);
        fetchTickets();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign worker');
    }
  };

  const handleUpdateStatus = async (ticketId, status) => {
    try {
      const res = await adminApi.put(`/support/admin/tickets/${ticketId}/status`, {
        status,
        resolutionNotes: status === 'RESOLVED' ? (resolutionNotes || 'Issue verified and resolved according to company policy.') : undefined
      });
      if (res.data.success) {
        alert(`Ticket status updated to ${status}!`);
        setSelectedTicket(res.data.ticket);
        setResolutionNotes('');
        setShowResolveModal(false);
        fetchTickets();
        fetchExecutiveMetrics();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleSendAdminReply = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim() || !selectedTicket) return;

    setSendingReply(true);
    try {
      const res = await adminApi.post(`/support/tickets/${selectedTicket._id}/messages`, {
        message: replyMessage.trim()
      });
      if (res.data.success) {
        setSelectedTicket(res.data.ticket);
        setReplyMessage('');
        fetchTickets();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send message');
    } finally {
      setSendingReply(false);
    }
  };

  const formatSeconds = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'OPEN':
        return <span style={{ background: '#DBEAFE', color: '#1E40AF', padding: '3px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: '800' }}>● OPEN</span>;
      case 'IN_PROGRESS':
        return <span style={{ background: '#FEF3C7', color: '#B45309', padding: '3px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: '800' }}>⚡ IN PROGRESS</span>;
      case 'WAITING_CUSTOMER':
        return <span style={{ background: '#FDE68A', color: '#92400E', padding: '3px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: '800' }}>⏳ WAITING CUSTOMER</span>;
      case 'RESOLVED':
        return <span style={{ background: '#D1FAE5', color: '#065F46', padding: '3px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: '800' }}>✓ RESOLVED</span>;
      case 'CLOSED':
        return <span style={{ background: '#E5E7EB', color: '#374151', padding: '3px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: '800' }}>✕ CLOSED</span>;
      default:
        return <span>{status}</span>;
    }
  };

  // Render the Order Investigation & Diagnostics component (Used in Workbench tab and in ticket detail)
  const renderOrderWorkbench = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Instant Order Search Input Box */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #CBD5E1',
          borderRadius: '12px',
          padding: '14px 20px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#EFF6FF', color: '#0071E3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
            <i className="fa-solid fa-magnifying-glass"></i>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Direct Order ID Investigation (Type any Order ID to check all details &amp; execute fixes)
            </div>
            <input
              type="text"
              placeholder="Type or paste Order ID (e.g. ORD-235548-1217 or MongoDB ID)..."
              value={orderSearchInput}
              onChange={(e) => setOrderSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInspectOrder(orderSearchInput)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: '#0F172A',
                fontSize: '1rem',
                fontWeight: '700',
                outline: 'none',
                marginTop: '4px',
                fontFamily: 'monospace'
              }}
            />
          </div>

          <button
            onClick={() => handleInspectOrder(orderSearchInput)}
            disabled={inspectLoading || !orderSearchInput.trim()}
            style={{
              background: '#0071E3',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              fontSize: '0.85rem',
              fontWeight: '700',
              cursor: inspectLoading || !orderSearchInput.trim() ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 10px rgba(0, 113, 227, 0.25)'
            }}
          >
            {inspectLoading ? (
              <i className="fa-solid fa-spinner fa-spin"></i>
            ) : (
              <i className="fa-solid fa-search"></i>
            )}
          </button>
        </div>

        {/* AUTO-LOADED CALLER'S PENDING ORDERS & RECENT DELIVERIES PANEL */}
        {callerOrdersLoading ? (
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '14px', textAlign: 'center', color: '#1E40AF', fontSize: '0.82rem' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
            <span>Auto-fetching caller's pending orders &amp; recent deliveries...</span>
          </div>
        ) : callerOrders && callerOrders.length > 0 && (
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #0071E3',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 4px 12px rgba(0, 113, 227, 0.08)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: '800', color: '#0071E3', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  🛍️ Customer's Pending Orders &amp; Recent Deliveries ({callerOrders.length})
                </span>
                <span style={{ background: '#0071E3', color: '#FFFFFF', padding: '1px 8px', borderRadius: '10px', fontSize: '0.68rem', fontWeight: '800' }}>
                  Auto-Retrieved
                </span>
              </div>
              <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                Tap any order below to inspect diagnostics &amp; execute resolution
              </span>
            </div>

            <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '6px' }}>
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
                      background: isInspected ? '#EFF6FF' : '#F8FAFC',
                      border: isInspected ? '2px solid #0071E3' : '1px solid #E2E8F0',
                      borderRadius: '10px',
                      padding: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#0071E3', fontFamily: 'monospace' }}>
                        #{ord.orderNumber}
                      </span>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: '800',
                        padding: '2px 7px',
                        borderRadius: '10px',
                        background: isPending ? '#FEF3C7' : '#D1FAE5',
                        color: isPending ? '#B45309' : '#065F46'
                      }}>
                        ● {ord.orderStatus}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: '#1E293B', fontWeight: '700', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ord.items && ord.items.length > 0 ? ord.items.map(i => i.name || i.title).join(', ') : 'Order Items'}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', color: '#64748B', marginTop: '6px' }}>
                      <span style={{ color: '#059669', fontWeight: '800' }}>₹{ord.totalAmount}</span>
                      <span>{new Date(ord.createdAt).toLocaleDateString('en-IN')}</span>
                    </div>

                    <button
                      style={{
                        width: '100%',
                        marginTop: '10px',
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: 'none',
                        background: isInspected ? '#0071E3' : '#E2E8F0',
                        color: isInspected ? '#FFFFFF' : '#334155',
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
          </div>
        )}

        {/* Inspected Order Details View */}
        {inspectedOrderData?.order ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Top Order Overview Banner */}
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '18px 22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '14px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0F172A', fontFamily: 'monospace' }}>
                    {inspectedOrderData.order.orderNumber}
                  </span>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    background: inspectedOrderData.order.orderStatus === 'DELIVERED' ? '#D1FAE5' : inspectedOrderData.order.orderStatus === 'RETURN_REQUESTED' ? '#FEE2E2' : '#EFF6FF',
                    color: inspectedOrderData.order.orderStatus === 'DELIVERED' ? '#065F46' : inspectedOrderData.order.orderStatus === 'RETURN_REQUESTED' ? '#991B1B' : '#1D4ED8'
                  }}>
                    ● {inspectedOrderData.order.orderStatus}
                  </span>
                  <span style={{ fontSize: '0.75rem', background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontWeight: '600' }}>
                    {inspectedOrderData.order.paymentMethod || 'PREPAID'} • {inspectedOrderData.order.paymentStatus || 'COMPLETED'}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                  Placed: {new Date(inspectedOrderData.order.createdAt).toLocaleString('en-IN')} • System ID: <code>{inspectedOrderData.order._id}</code>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Total Order Value</div>
                <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0F172A' }}>
                  ₹{inspectedOrderData.order.totalAmount}
                </div>
              </div>
            </div>

            {/* Diagnostics Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
              {/* Card 1: Customer Profile & Live Wallet Balance */}
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#0284C7', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fa-solid fa-user-shield"></i>
                  <span>Customer &amp; Live Wallet</span>
                </div>
                <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '0.92rem' }}>
                  {inspectedOrderData.customer?.name || inspectedOrderData.order.customerId?.name || 'Customer'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
                  {inspectedOrderData.customer?.email || inspectedOrderData.order.customerId?.email}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
                  📞 {inspectedOrderData.customer?.phone || inspectedOrderData.order.customerId?.phone || 'No phone'}
                </div>

                {/* Live Wallet Sync */}
                <div style={{
                  marginTop: '12px',
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: '700' }}>
                    Live Wallet Balance
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: '800', color: '#15803D' }}>
                    ₹{inspectedOrderData.customer?.walletBalance ?? inspectedOrderData.order.customerId?.walletBalance ?? 0}
                  </div>
                </div>
              </div>

              {/* Card 2: Logistics, Delivery Rider & OTP Verification */}
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#059669', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fa-solid fa-truck-fast"></i>
                  <span>Logistics &amp; Delivery Tracking</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#334155' }}>
                  Carrier: <strong>{inspectedOrderData.order.courierPartner || 'NovaKart Express'}</strong>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#334155', marginTop: '3px' }}>
                  Tracking #: <code style={{ color: '#0071E3', fontWeight: '700' }}>{inspectedOrderData.order.trackingNumber || 'TRK-PENDING'}</code>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#334155', marginTop: '3px' }}>
                  Delivery Boy: <strong>{inspectedOrderData.order.deliveryAgentId?.name || 'Assigned to Hub'}</strong>
                  {inspectedOrderData.order.deliveryAgentId?.phone && ` (${inspectedOrderData.order.deliveryAgentId.phone})`}
                </div>
                <div style={{
                  marginTop: '10px',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  fontSize: '0.75rem',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span style={{ color: '#64748B' }}>Doorstep OTP:</span>
                  <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>{inspectedOrderData.order.deliveryOtp || '9482'}</strong>
                </div>
              </div>

              {/* Card 3: Return & Physical QC Status */}
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#E11D48', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fa-solid fa-rotate-left"></i>
                  <span>Return &amp; QC Verification</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#334155' }}>
                  Return Status: <strong style={{ color: inspectedOrderData.order.returnStatus ? '#E11D48' : '#64748B' }}>
                    {inspectedOrderData.order.returnStatus || 'NONE REQUESTED'}
                  </strong>
                </div>
                {inspectedOrderData.order.returnReason && (
                  <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '4px' }}>
                    Reason: <em>"{inspectedOrderData.order.returnReason}"</em>
                  </div>
                )}
                {inspectedOrderData.order.returnPickupAgent && (
                  <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '4px' }}>
                    Pickup Agent: <strong>{inspectedOrderData.order.returnPickupAgent?.name}</strong>
                  </div>
                )}
                <div style={{ marginTop: '10px', fontSize: '0.72rem', color: '#64748B' }}>
                  Inspection Mandate: Physical &amp; Quality verification before refund.
                </div>
              </div>
            </div>

            {/* Remediation Action Command Center (5 Concrete Fixes) */}
            <div style={{
              background: '#0F172A',
              borderRadius: '12px',
              padding: '16px 20px',
              color: '#FFFFFF'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-bolt" style={{ color: '#F59E0B' }}></i>
                  <span style={{ fontSize: '0.88rem', fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    Immediate Remediation Engine (Execute One-Click Concrete Fix)
                  </span>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                  Authorized Admin Actions • Direct Wallet Disbursal &amp; Courier Logistics
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setActionModalType('REFUND')}
                  disabled={actionLoading}
                  style={{
                    background: '#E11D48',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 16px',
                    fontSize: '0.82rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-wallet"></i>
                  <span>💰 Instant Wallet Refund</span>
                </button>

                <button
                  onClick={() => setActionModalType('PICKUP')}
                  disabled={actionLoading}
                  style={{
                    background: '#2563EB',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 16px',
                    fontSize: '0.82rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-truck-ramp-box"></i>
                  <span>📦 Authorize Return Pickup</span>
                </button>

                <button
                  onClick={() => setActionModalType('EXPEDITE')}
                  disabled={actionLoading}
                  style={{
                    background: '#D97706',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 16px',
                    fontSize: '0.82rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-forward-fast"></i>
                  <span>⚡ Expedite Delivery</span>
                </button>

                <button
                  onClick={() => setActionModalType('GOODWILL')}
                  disabled={actionLoading}
                  style={{
                    background: '#059669',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 16px',
                    fontSize: '0.82rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-gift"></i>
                  <span>🎁 Goodwill Apology Credit</span>
                </button>

                <button
                  onClick={() => setActionModalType('CANCEL')}
                  disabled={actionLoading}
                  style={{
                    background: '#DC2626',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 16px',
                    fontSize: '0.82rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-ban"></i>
                  <span>✕ Cancel &amp; Full Refund</span>
                </button>

                <button
                  onClick={() => {
                    setActionFormData(prev => ({
                      ...prev,
                      amount: inspectedOrderData.returnRequest?.estimatedRefundAmount || inspectedOrderData.order.totalAmount || '',
                      payoutDestination: inspectedOrderData.returnRequest?.refundPreference || 'ORIGINAL_PAYMENT',
                      customerInstructions: inspectedOrderData.returnRequest?.customerInstructions || '',
                      warehouseQcNotes: inspectedOrderData.returnRequest?.warehouseQC?.qcNotes || '',
                      paymentAdminNotes: 'Formal refund request submitted directly to Treasury & Payment Admin (Port 3005).'
                    }));
                    setActionModalType('PAYMENT_ADMIN_REQUEST');
                  }}
                  disabled={actionLoading}
                  style={{
                    background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 16px',
                    fontSize: '0.82rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)'
                  }}
                >
                  <i className="fa-solid fa-building-columns"></i>
                  <span>🏛️ Send Request to Payment Admin (Port 3005)</span>
                </button>

                <button
                  onClick={() => {
                    setActionFormData(prev => ({
                      ...prev,
                      amount: inspectedOrderData.returnRequest?.estimatedRefundAmount || '',
                      reason: inspectedOrderData.returnRequest?.reasonDetails || '',
                      customerInstructions: inspectedOrderData.returnRequest?.customerInstructions || '',
                      courierNotes: inspectedOrderData.returnRequest?.courierNotes || '',
                      warehouseQcNotes: inspectedOrderData.returnRequest?.warehouseQC?.qcNotes || '',
                      payoutDestination: inspectedOrderData.returnRequest?.refundPreference || 'ORIGINAL_PAYMENT'
                    }));
                    setActionModalType('UPDATE_RR_INSTRUCTIONS');
                  }}
                  disabled={actionLoading}
                  style={{
                    background: '#0D9488',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 16px',
                    fontSize: '0.82rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-pen-to-square"></i>
                  <span>📝 Update Instructions &amp; RR Data</span>
                </button>
              </div>
            </div>

            {/* RETURN REQUEST (RR) STATUS & INSTRUCTIONS DIAGNOSTIC CARD */}
            {(inspectedOrderData.returnRequest || inspectedOrderData.order.returnStatus) && (
              <div style={{
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-boxes-packing" style={{ color: '#0284C7', fontSize: '1.1rem' }}></i>
                    <span style={{ fontWeight: '800', color: '#0F172A', fontSize: '0.9rem' }}>
                      Return Request (RR) Diagnostic &amp; Payout Status
                    </span>
                    {inspectedOrderData.returnRequest?._id && (
                      <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#64748B', background: '#E2E8F0', padding: '2px 6px', borderRadius: '4px' }}>
                        #{inspectedOrderData.returnRequest._id}
                      </span>
                    )}
                  </div>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    background: inspectedOrderData.returnRequest?.status === 'REFUND_DISBURSED' ? '#D1FAE5' : '#FEF3C7',
                    color: inspectedOrderData.returnRequest?.status === 'REFUND_DISBURSED' ? '#065F46' : '#92400E'
                  }}>
                    ● {inspectedOrderData.returnRequest?.status || inspectedOrderData.order.returnStatus}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '0.8rem' }}>
                  <div style={{ background: '#FFFFFF', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <span style={{ color: '#64748B', fontSize: '0.72rem', display: 'block', fontWeight: '700' }}>Customer Packaging Instructions:</span>
                    <strong style={{ color: '#0F172A' }}>
                      {inspectedOrderData.returnRequest?.customerInstructions || 'Hand original product with bill to pickup agent.'}
                    </strong>
                  </div>

                  <div style={{ background: '#FFFFFF', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <span style={{ color: '#64748B', fontSize: '0.72rem', display: 'block', fontWeight: '700' }}>Courier Pickup Directives:</span>
                    <strong style={{ color: '#0F172A' }}>
                      {inspectedOrderData.returnRequest?.courierNotes || 'Verify order items and serial number at door.'}
                    </strong>
                  </div>

                  <div style={{ background: '#FFFFFF', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <span style={{ color: '#64748B', fontSize: '0.72rem', display: 'block', fontWeight: '700' }}>Warehouse QC Verification:</span>
                    <strong style={{ color: inspectedOrderData.returnRequest?.warehouseQC?.passed ? '#059669' : '#D97706' }}>
                      {inspectedOrderData.returnRequest?.warehouseQC?.passed ? '✓ QC Passed & Approved' : 'Inspection Pending'}
                    </strong>
                  </div>
                </div>
              </div>
            )}


            {/* Line Items Table */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: '0.8rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>
                Order Line Items ({inspectedOrderData.order.items?.length || 0} Products)
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ padding: '10px 18px' }}>Product</th>
                    <th style={{ padding: '10px 18px' }}>Qty</th>
                    <th style={{ padding: '10px 18px' }}>Unit Price</th>
                    <th style={{ padding: '10px 18px', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {inspectedOrderData.order.items?.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {item.image && (
                          <img src={item.image} alt={item.name} style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover' }} />
                        )}
                        <span style={{ fontWeight: '700', color: '#0F172A' }}>{item.name}</span>
                      </td>
                      <td style={{ padding: '12px 18px', color: '#475569' }}>{item.quantity}</td>
                      <td style={{ padding: '12px 18px', color: '#475569' }}>₹{item.price}</td>
                      <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: '800', color: '#059669' }}>
                        ₹{item.price * item.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Shipping Address & Verification */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px 18px', fontSize: '0.82rem', color: '#475569' }}>
              <div style={{ fontWeight: '800', color: '#0F172A', marginBottom: '4px' }}>
                📍 Shipping &amp; Handover Location:
              </div>
              <div>
                {inspectedOrderData.order.deliveryAddress?.fullName} • {inspectedOrderData.order.deliveryAddress?.street}, {inspectedOrderData.order.deliveryAddress?.city}, {inspectedOrderData.order.deliveryAddress?.postalCode}
              </div>
              <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#64748B' }}>
                Proof of Delivery Status: <strong>{inspectedOrderData.order.proofOfDelivery?.verifiedMethod || 'PENDING'}</strong>
                {inspectedOrderData.order.proofOfDelivery?.scannedCode ? ` • Barcode: ${inspectedOrderData.order.proofOfDelivery.scannedCode}` : ''}
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            background: '#FFFFFF',
            border: '2px dashed #CBD5E1',
            borderRadius: '16px',
            padding: '50px 20px',
            textAlign: 'center',
            color: '#64748B'
          }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#EFF6FF', color: '#0071E3', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '1.6rem' }}>
              <i className="fa-solid fa-receipt"></i>
            </div>
            <h3 style={{ color: '#0F172A', marginBottom: '6px', fontSize: '1.15rem' }}>Ready to Inspect Order</h3>
            <p style={{ fontSize: '0.85rem', maxWidth: '440px', margin: '0 auto 16px', lineHeight: '1.5' }}>
              Type or paste any Customer Order ID above to check all details, courier tracking, delivery OTP, customer wallet balance, and execute instant remediation actions.
            </p>
            {tickets.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569' }}>Quick test from queue:</span>
                {tickets.slice(0, 3).map(t => (
                  <button
                    key={t._id}
                    onClick={() => {
                      const id = t.orderNumber || t.orderId?._id || t.orderId || t.ticketNumber;
                      setOrderSearchInput(id);
                      handleInspectOrder(id);
                    }}
                    style={{
                      background: '#F1F5F9',
                      border: '1px solid #CBD5E1',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      color: '#0071E3',
                      cursor: 'pointer'
                    }}
                  >
                    {t.orderNumber || t.ticketNumber}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Top Header with Launch Port 3006 & Add Worker CTA */}
      <div className="admin-top-header" style={{ marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: '800', color: '#0F172A', margin: 0 }}>
              Help Center Staff &amp; Resolution Command
            </h1>
            <span style={{ background: '#E0F2FE', color: '#0369A1', fontSize: '0.75rem', fontWeight: '800', padding: '2px 8px', borderRadius: '6px' }}>
              PORT 3006 WEB
            </span>
          </div>
          <p style={{ color: '#64748B', fontSize: '0.88rem', margin: 0 }}>
            Core Process: Order ID Investigation &amp; Remediation. Telephony and Chat operate in parallel without blocking screen workflow.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setShowAddWorkerModal(true)}
            style={{
              background: '#0F172A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 16px',
              fontSize: '0.85rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className="fa-solid fa-user-plus"></i>
            <span>+ Onboard Support Worker</span>
          </button>

          <a
            href="http://localhost:3006"
            target="_blank"
            rel="noreferrer"
            style={{
              background: 'linear-gradient(135deg, #0284C7 0%, #2563EB 100%)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 18px',
              fontSize: '0.85rem',
              fontWeight: '700',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
            }}
          >
            <i className="fa-solid fa-headset"></i>
            <span>Launch Help Desk (Port 3006)</span>
            <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.72rem' }}></i>
          </a>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PERSISTENT DOCKED IN-CALL CONTROL STRIP (NON-BLOCKING WHILE ON CALL) */}
      {/* ========================================================================= */}
      {activeCallTicket && (
        <div style={{
          background: 'linear-gradient(90deg, #991B1B 0%, #1E1B4B 100%)',
          borderBottom: '3px solid #EF4444',
          borderRadius: '12px',
          padding: '12px 20px',
          marginBottom: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 8px 24px rgba(153, 27, 27, 0.3)',
          position: 'sticky',
          top: '10px',
          zIndex: 60
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: '#EF4444',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
              boxShadow: '0 0 16px rgba(239, 68, 68, 0.9)'
            }}>
              <i className="fa-solid fa-phone fa-shake"></i>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: '800', background: 'rgba(239, 68, 68, 0.3)', color: '#FECDD3', padding: '2px 8px', borderRadius: '4px' }}>
                  ● LIVE PHONE CONSULTATION (ADMIN ON-CALL)
                </span>
                <span style={{ fontSize: '0.92rem', fontWeight: '800', color: '#FFFFFF' }}>
                  {activeCallTicket.customerId?.name || 'Customer'}
                </span>
                <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: '#7DD3FC' }}>
                  ({activeCallTicket.customerPhone || '+91 98765 00000'})
                </span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#FDA4AF', marginTop: '2px' }}>
                💡 In-Call Multitasking: You can type any Order ID below to inspect line items, rider tracking, and issue refunds while talking!
              </div>
            </div>
          </div>

          {/* Call Controls & Live Duration */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'rgba(0, 0, 0, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              padding: '6px 14px',
              fontFamily: 'monospace',
              fontWeight: '800',
              fontSize: '1.15rem',
              color: '#34D399'
            }}>
              ⏱️ {formatSeconds(callTimer)}
            </div>

            <button
              onClick={() => setIsMuted(!isMuted)}
              style={{
                background: isMuted ? '#EF4444' : 'rgba(255, 255, 255, 0.1)',
                color: '#FFFFFF',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                padding: '7px 12px',
                fontSize: '0.78rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`} style={{ marginRight: '6px' }}></i>
              <span>{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            <select
              value={callOutcome}
              onChange={(e) => setCallOutcome(e.target.value)}
              style={{
                padding: '7px 10px',
                borderRadius: '6px',
                background: '#0F172A',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#FFFFFF',
                fontSize: '0.78rem'
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
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                padding: '7px 12px',
                fontSize: '0.78rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <i className="fa-solid fa-phone-slash" style={{ marginRight: '6px' }}></i>
              <span>End Call (Keep Open)</span>
            </button>

            <button
              onClick={() => handleEndCall(true)}
              disabled={actionLoading}
              style={{
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                padding: '7px 14px',
                fontSize: '0.78rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <i className="fa-solid fa-circle-check" style={{ marginRight: '6px' }}></i>
              <span>End Call &amp; Resolve</span>
            </button>
          </div>
        </div>
      )}

      {/* EXECUTIVE KPI MONITOR RIBBON */}
      {executiveMetrics && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '14px',
          marginBottom: '20px'
        }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px 18px' }}>
            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Total Inbound Cases</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0F172A', marginTop: '3px' }}>{executiveMetrics.totalTickets}</div>
            <div style={{ fontSize: '0.72rem', color: '#10B981', marginTop: '2px' }}>{executiveMetrics.resolutionRate}% Resolved Rate</div>
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px 18px' }}>
            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Telephony Call-Backs</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#E11D48', marginTop: '3px' }}>{executiveMetrics.totalCallbacks} Calls</div>
            <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>{executiveMetrics.completedCallbacks} Completed On-Call</div>
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px 18px' }}>
            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Active Online Staff</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#10B981', marginTop: '3px' }}>{executiveMetrics.activeOnlineWorkers} Online</div>
            <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>Auto-Work Assignment Active</div>
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px 18px' }}>
            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Support Refunds Disbursed</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0284C7', marginTop: '3px' }}>₹{executiveMetrics.totalRefundDisbursed}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>Instant Wallet Credits</div>
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px 18px' }}>
            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Resolution Actions</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#8B5CF6', marginTop: '3px' }}>{executiveMetrics.totalResolutionDispatches} Executed</div>
            <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>Pickups &amp; Replacements</div>
          </div>
        </div>
      )}

      {/* Main Mode Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '10px',
        borderBottom: '2px solid #E2E8F0',
        marginBottom: '20px'
      }}>
        {/* TAB 1: ORDER WORKBENCH (CORE PROCESS!) */}
        <button
          onClick={() => setActiveMainTab('WORKBENCH')}
          style={{
            padding: '10px 18px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeMainTab === 'WORKBENCH' ? '3px solid #0071E3' : '3px solid transparent',
            color: activeMainTab === 'WORKBENCH' ? '#0071E3' : '#64748B',
            fontWeight: '800',
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '-2px'
          }}
        >
          <i className="fa-solid fa-magnifying-glass-chart"></i>
          <span>🔍 Order Investigation &amp; Remediation (Core Process)</span>
          {inspectedOrderData && <span style={{ background: '#10B981', color: '#FFFFFF', padding: '1px 6px', borderRadius: '10px', fontSize: '0.68rem' }}>Active</span>}
        </button>

        {/* TAB 2: INBOUND TICKETS */}
        <button
          onClick={() => setActiveMainTab('TICKETS')}
          style={{
            padding: '10px 18px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeMainTab === 'TICKETS' ? '3px solid #0071E3' : '3px solid transparent',
            color: activeMainTab === 'TICKETS' ? '#0071E3' : '#64748B',
            fontWeight: '800',
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '-2px'
          }}
        >
          <i className="fa-solid fa-ticket"></i>
          <span>Inbound Tickets Console ({tickets.length})</span>
        </button>

        {/* TAB 3: STAFF ROSTER */}
        <button
          onClick={() => setActiveMainTab('STAFF')}
          style={{
            padding: '10px 18px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeMainTab === 'STAFF' ? '3px solid #0071E3' : '3px solid transparent',
            color: activeMainTab === 'STAFF' ? '#0071E3' : '#64748B',
            fontWeight: '800',
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '-2px'
          }}
        >
          <i className="fa-solid fa-users-gear"></i>
          <span>Support Workers Roster ({workers.length})</span>
        </button>

        {/* TAB 4: CALL HISTORY & VOICE RECORDINGS */}
        <button
          onClick={() => setActiveMainTab('CALL_HISTORY')}
          style={{
            padding: '10px 18px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeMainTab === 'CALL_HISTORY' ? '3px solid #0071E3' : '3px solid transparent',
            color: activeMainTab === 'CALL_HISTORY' ? '#0071E3' : '#64748B',
            fontWeight: '800',
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '-2px'
          }}
        >
          <i className="fa-solid fa-phone-volume"></i>
          <span>📞 Call History &amp; Recordings ({adminCallHistory.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1 CONTENT: ORDER INVESTIGATION & REMEDIATION (PRIMARY CORE PROCESS) */}
      {/* ========================================================================= */}
      {activeMainTab === 'WORKBENCH' && (
        <div>
          {renderOrderWorkbench()}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2 CONTENT: INBOUND TICKETS & DISPUTE RESOLUTION CONSOLE */}
      {/* ========================================================================= */}
      {activeMainTab === 'TICKETS' && (
        <div>
          {/* Filters Bar */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            padding: '12px 18px',
            border: '1px solid #E2E8F0',
            marginBottom: '20px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['ALL', 'OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    background: statusFilter === s ? '#0071E3' : '#F1F5F9',
                    color: statusFilter === s ? '#FFFFFF' : '#475569',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.82rem',
                  background: '#FFFFFF'
                }}
              >
                <option value="ALL">All Categories</option>
                <option value="RETURNS_EXCHANGES">Returns &amp; Exchanges</option>
                <option value="PAYMENTS_REFUNDS">Payments &amp; Refunds</option>
                <option value="DELIVERY_TRACKING">Delivery &amp; Tracking</option>
                <option value="DAMAGED_DEFECTIVE">Damaged / Defective</option>
                <option value="ACCOUNT_SECURITY">Account &amp; Security</option>
                <option value="OTHER">General</option>
              </select>

              <input
                type="text"
                placeholder="Search Ticket # or Subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchTickets()}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.82rem',
                  width: '200px'
                }}
              />
            </div>
          </div>

          {/* Main Console Split View */}
          {ticketsLoading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>
              <i className="fa-solid fa-spinner fa-spin fa-2x" style={{ color: '#0071E3', marginBottom: '12px' }}></i>
              <div>Loading Help Center tickets...</div>
            </div>
          ) : tickets.length === 0 ? (
            <div style={{ background: '#FFFFFF', padding: '60px', textAlign: 'center', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              <i className="fa-solid fa-headset fa-3x" style={{ color: '#94A3B8', marginBottom: '12px' }}></i>
              <h3 style={{ color: '#1E293B' }}>No support tickets matching filters</h3>
              <p style={{ color: '#64748B', fontSize: '0.88rem' }}>When customers submit help requests, they will populate here in real time.</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '380px 1fr',
              background: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
              minHeight: '650px'
            }}>
              {/* Left Column: Ticket List */}
              <div style={{ borderRight: '1px solid #E2E8F0', overflowY: 'auto', maxHeight: '720px', background: '#FAFAFA' }}>
                {tickets.map(t => {
                  const isSelected = selectedTicket?._id === t._id;
                  const isCallBack = t.contactChannel === 'CALL_BACK';

                  return (
                    <div
                      key={t._id}
                      onClick={() => setSelectedTicket(t)}
                      style={{
                        padding: '14px 18px',
                        borderBottom: '1px solid #E2E8F0',
                        cursor: 'pointer',
                        background: isSelected ? '#FFFFFF' : 'transparent',
                        borderLeft: isSelected ? '4px solid #0071E3' : '4px solid transparent',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#0071E3', fontFamily: 'monospace' }}>
                            {t.ticketNumber}
                          </span>
                          {isCallBack && (
                            <span style={{ background: '#FFE4E6', color: '#E11D48', border: '1px solid #FDA4AF', padding: '1px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '800' }}>
                              📞 CALL
                            </span>
                          )}
                        </div>
                        {getStatusBadge(t.status)}
                      </div>

                      <div style={{ fontSize: '0.88rem', fontWeight: '700', color: '#0F172A', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.subject}
                      </div>

                      <div style={{ fontSize: '0.76rem', color: '#475569', marginBottom: '4px' }}>
                        Customer: <strong>{t.customerId?.name || 'Customer'}</strong> ({t.customerPhone || t.customerId?.phone || 'No phone'})
                      </div>

                      <div style={{ fontSize: '0.72rem', color: '#64748B', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Worker: <strong>{t.assignedWorker?.name?.split(' ')[0] || 'Unassigned'}</strong></span>
                        <span>{new Date(t.createdAt).toLocaleDateString('en-IN')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right Column: Active Ticket Management & Workbench */}
              {selectedTicket ? (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '720px' }}>
                  {/* Ticket Top Command Bar */}
                  <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid #E2E8F0',
                    background: '#FFFFFF',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: '800', color: '#0071E3', fontFamily: 'monospace' }}>{selectedTicket.ticketNumber}</span>
                        {getStatusBadge(selectedTicket.status)}
                        <span style={{ fontSize: '0.75rem', background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: '4px' }}>
                          {selectedTicket.category.replace('_', ' ')}
                        </span>
                        {selectedTicket.contactChannel === 'CALL_BACK' && (
                          <span style={{ background: '#FFE4E6', color: '#E11D48', border: '1px solid #FDA4AF', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '800' }}>
                            📞 PHONE CALL-BACK REQUEST
                          </span>
                        )}
                      </div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                        {selectedTicket.subject}
                      </h3>
                      <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
                        Customer: <strong>{selectedTicket.customerId?.name}</strong> ({selectedTicket.customerId?.email}) • Phone: <strong>{selectedTicket.customerPhone || selectedTicket.customerId?.phone || 'N/A'}</strong>
                      </div>
                    </div>

                    {/* Quick Dial & Assignment Toolbar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {/* Telephony Dial Customer Button */}
                      {(selectedTicket.customerPhone || selectedTicket.customerId?.phone) && (
                        <button
                          onClick={() => handleStartCall(selectedTicket)}
                          style={{
                            background: '#E11D48',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '8px 14px',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 8px rgba(225, 29, 72, 0.3)'
                          }}
                        >
                          <i className="fa-solid fa-phone-volume fa-shake"></i>
                          <span>Dial Customer</span>
                        </button>
                      )}

                      {/* Worker Re-assignment Dropdown */}
                      <select
                        value={selectedTicket.assignedWorker?.workerId || ''}
                        onChange={(e) => handleAssignWorker(selectedTicket._id, e.target.value)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          fontSize: '0.82rem',
                          fontWeight: '700',
                          background: '#F8FAFC'
                        }}
                      >
                        <option value="">Unassigned</option>
                        {workers.map(w => (
                          <option key={w.workerId} value={w.workerId}>
                            {w.name} ({w.workerId})
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => setShowResolveModal(true)}
                        disabled={selectedTicket.status === 'RESOLVED'}
                        style={{
                          background: '#10B981',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontSize: '0.8rem',
                          fontWeight: '700',
                          cursor: selectedTicket.status === 'RESOLVED' ? 'not-allowed' : 'pointer'
                        }}
                      >
                        ✓ Resolve
                      </button>
                    </div>
                  </div>

                  {/* Sub-Tab Bar: Order Investigation (Default) vs Chat Thread */}
                  <div style={{
                    background: '#F8FAFC',
                    borderBottom: '1px solid #E2E8F0',
                    padding: '0 20px',
                    display: 'flex',
                    gap: '12px'
                  }}>
                    <button
                      onClick={() => setTicketSubTab('ORDER_DIAGNOSTICS')}
                      style={{
                        padding: '10px 14px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: ticketSubTab === 'ORDER_DIAGNOSTICS' ? '3px solid #0071E3' : '3px solid transparent',
                        color: ticketSubTab === 'ORDER_DIAGNOSTICS' ? '#0071E3' : '#64748B',
                        fontWeight: '800',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <i className="fa-solid fa-magnifying-glass-chart"></i>
                      <span>Order Diagnostics &amp; Remediation</span>
                    </button>

                    <button
                      onClick={() => setTicketSubTab('CHAT_THREAD')}
                      style={{
                        padding: '10px 14px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: ticketSubTab === 'CHAT_THREAD' ? '3px solid #0071E3' : '3px solid transparent',
                        color: ticketSubTab === 'CHAT_THREAD' ? '#0071E3' : '#64748B',
                        fontWeight: '800',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <i className="fa-solid fa-comments"></i>
                      <span>Chat &amp; Telephony Audit ({selectedTicket.messages?.length || 0})</span>
                    </button>
                  </div>

                  {/* Sub-Tab 1: Order Diagnostics & Remediation */}
                  {ticketSubTab === 'ORDER_DIAGNOSTICS' && (
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                      {renderOrderWorkbench()}
                    </div>
                  )}

                  {/* Sub-Tab 2: Chat & Conversation Audit */}
                  {ticketSubTab === 'CHAT_THREAD' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                      <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '20px',
                        background: '#F8FAFC',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}>
                        {selectedTicket.messages && selectedTicket.messages.map((m, idx) => {
                          const isCustomer = m.senderRole === 'customer';
                          return (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: isCustomer ? 'flex-start' : 'flex-end'
                              }}
                            >
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                marginBottom: '3px',
                                fontSize: '0.72rem',
                                color: '#64748B'
                              }}>
                                <strong>{m.senderName} ({m.senderRole})</strong>
                                <span>•</span>
                                <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <div style={{
                                maxWidth: '75%',
                                padding: '10px 16px',
                                borderRadius: isCustomer ? '12px 12px 12px 2px' : '12px 12px 2px 12px',
                                background: isCustomer ? '#FFFFFF' : '#0071E3',
                                color: isCustomer ? '#1E293B' : '#FFFFFF',
                                border: isCustomer ? '1px solid #E2E8F0' : 'none',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                                fontSize: '0.88rem',
                                lineHeight: '1.4'
                              }}>
                                {m.message || m.text}
                              </div>
                            </div>
                          );
                        })}
                        <div ref={chatBottomRef} />
                      </div>

                      {/* Admin Reply Box */}
                      <form onSubmit={handleSendAdminReply} style={{
                        padding: '14px 20px',
                        background: '#FFFFFF',
                        borderTop: '1px solid #E2E8F0',
                        display: 'flex',
                        gap: '10px'
                      }}>
                        <input
                          type="text"
                          placeholder={`Reply as Resolution Officer (${selectedTicket.assignedWorker?.name || 'Admin'})...`}
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '10px 14px',
                            border: '1px solid #CBD5E1',
                            borderRadius: '8px',
                            fontSize: '0.88rem'
                          }}
                        />
                        <button
                          type="submit"
                          disabled={sendingReply || !replyMessage.trim()}
                          style={{
                            background: '#0071E3',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '0 20px',
                            fontWeight: '700',
                            fontSize: '0.85rem',
                            cursor: sendingReply || !replyMessage.trim() ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {sendingReply ? 'Sending...' : 'Send Reply'}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3 CONTENT: SUPPORT STAFF / WORKERS MANAGEMENT */}
      {/* ========================================================================= */}
      {activeMainTab === 'STAFF' && (
        <div>
          {/* Admin Policy Notice Card */}
          <div style={{
            background: '#F0F9FF',
            border: '1px solid #BAE6FD',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#0284C7', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                <i className="fa-solid fa-shield-halved"></i>
              </div>
              <div>
                <div style={{ fontWeight: '800', color: '#0369A1', fontSize: '0.92rem' }}>
                  Admin Staff Authorization Mandate
                </div>
                <div style={{ color: '#0C4A6E', fontSize: '0.82rem', marginTop: '2px' }}>
                  Public worker self-registration is permanently disabled. Support Workers log in at <strong>http://localhost:3006</strong> using the credentials you configure below.
                </div>
              </div>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#0284C7', fontWeight: '700', textAlign: 'right', whiteSpace: 'nowrap' }}>
              Standard Initial Password: <code style={{ background: '#FFFFFF', padding: '2px 6px', borderRadius: '4px', border: '1px solid #BAE6FD' }}>Support@1234</code>
            </div>
          </div>

          {/* Workers Table */}
          <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' }}>
                  <th style={{ padding: '14px 18px' }}>Officer</th>
                  <th style={{ padding: '14px 18px' }}>Worker ID</th>
                  <th style={{ padding: '14px 18px' }}>Specialty / Domain</th>
                  <th style={{ padding: '14px 18px' }}>Contact</th>
                  <th style={{ padding: '14px 18px' }}>Live Duty</th>
                  <th style={{ padding: '14px 18px' }}>Active Load</th>
                  <th style={{ padding: '14px 18px' }}>Resolved</th>
                  <th style={{ padding: '14px 18px' }}>Account Status</th>
                  <th style={{ padding: '14px 18px', textAlign: 'right' }}>Admin Actions</th>
                </tr>
              </thead>
              <tbody>
                {workersLoading ? (
                  <tr>
                    <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                      <i className="fa-solid fa-spinner fa-spin fa-2x" style={{ color: '#0071E3', marginBottom: '10px' }}></i>
                      <div>Loading Support Staff...</div>
                    </td>
                  </tr>
                ) : workers.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                      No support workers found. Click "+ Onboard Support Worker" above.
                    </td>
                  </tr>
                ) : (
                  workers.map(w => (
                    <tr key={w._id} style={{ borderBottom: '1px solid #F1F5F9', fontSize: '0.84rem' }}>
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img
                            src={w.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
                            alt={w.name}
                            style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                          <div>
                            <div style={{ fontWeight: '700', color: '#0F172A' }}>{w.name}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Certified Support Officer</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '12px 18px', fontFamily: 'monospace', fontWeight: '700', color: '#0071E3' }}>
                        {w.workerId || 'WRK-00'}
                      </td>

                      <td style={{ padding: '12px 18px' }}>
                        <span style={{ background: '#F1F5F9', color: '#334155', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700' }}>
                          {w.specialty || 'General Care'}
                        </span>
                      </td>

                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ color: '#0F172A', fontWeight: '600' }}>{w.email}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{w.phone || '+91 98765 00000'}</div>
                      </td>

                      <td style={{ padding: '12px 18px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.72rem',
                          fontWeight: '800',
                          background: w.supportDutyStatus === 'ONLINE' ? '#D1FAE5' : w.supportDutyStatus === 'IN_CONSULTATION' ? '#FEF3C7' : '#F1F5F9',
                          color: w.supportDutyStatus === 'ONLINE' ? '#065F46' : w.supportDutyStatus === 'IN_CONSULTATION' ? '#92400E' : '#475569'
                        }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: w.supportDutyStatus === 'ONLINE' ? '#10B981' : w.supportDutyStatus === 'IN_CONSULTATION' ? '#F59E0B' : '#94A3B8'
                          }}></span>
                          {w.supportDutyStatus || 'ONLINE'}
                        </span>
                      </td>

                      <td style={{ padding: '12px 18px', fontWeight: '700', color: '#0284C7' }}>
                        {w.activeTickets || 0} tickets
                      </td>

                      <td style={{ padding: '12px 18px', fontWeight: '700', color: '#059669' }}>
                        {w.resolvedTickets || 0} resolved
                      </td>

                      <td style={{ padding: '12px 18px' }}>
                        {w.isBlocked ? (
                          <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '800' }}>
                            SUSPENDED
                          </span>
                        ) : (
                          <span style={{ background: '#DCFCE7', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '800' }}>
                            ACTIVE
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleToggleBlockWorker(w._id, w.isBlocked, w.name)}
                          style={{
                            background: w.isBlocked ? '#DCFCE7' : '#FEE2E2',
                            color: w.isBlocked ? '#166534' : '#991B1B',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          {w.isBlocked ? 'Activate Access' : 'Suspend Access'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4 CONTENT: TELEPHONY CALL HISTORY & AUDIO RECORDINGS AUDIT */}
      {/* ========================================================================= */}
      {activeMainTab === 'CALL_HISTORY' && (
        <div>
          {/* Filters Bar */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            padding: '14px 20px',
            border: '1px solid #E2E8F0',
            marginBottom: '20px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['ALL', 'COMPLETED', 'QUEUED', 'MISSED', 'CANCELLED'].map(s => (
                <button
                  key={s}
                  onClick={() => setAdminCallStatusFilter(s)}
                  style={{
                    background: adminCallStatusFilter === s ? '#0071E3' : '#F1F5F9',
                    color: adminCallStatusFilter === s ? '#FFFFFF' : '#475569',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  {s}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <select
                value={adminCallLangFilter}
                onChange={(e) => setAdminCallLangFilter(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.82rem',
                  fontWeight: '700',
                  background: '#FFFFFF'
                }}
              >
                <option value="ALL">All Languages</option>
                <option value="ENGLISH">English</option>
                <option value="TELUGU">Telugu</option>
                <option value="HINDI">Hindi</option>
                <option value="TAMIL">Tamil</option>
              </select>

              <input
                type="text"
                placeholder="Search Helper or Phone..."
                value={adminCallSearch}
                onChange={(e) => setAdminCallSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchAdminCallHistory()}
                style={{
                  padding: '7px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.82rem',
                  width: '220px'
                }}
              />
            </div>
          </div>

          {/* Call Records Table */}
          <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', textAlign: 'left', fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Call ID &amp; Status</th>
                  <th style={{ padding: '12px 16px' }}>Customer Profile</th>
                  <th style={{ padding: '12px 16px' }}>Assigned Helper</th>
                  <th style={{ padding: '12px 16px' }}>Product / Order</th>
                  <th style={{ padding: '12px 16px' }}>IVR &amp; Language</th>
                  <th style={{ padding: '12px 16px' }}>Timings</th>
                  <th style={{ padding: '12px 16px' }}>Voice Recording</th>
                </tr>
              </thead>
              <tbody>
                {adminCallHistoryLoading ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                      <i className="fa-solid fa-spinner fa-spin fa-2x" style={{ color: '#0071E3' }}></i>
                      <div style={{ marginTop: '8px' }}>Fetching Telephony Logs &amp; Recordings...</div>
                    </td>
                  </tr>
                ) : adminCallHistory.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                      <i className="fa-solid fa-phone-slash fa-2x" style={{ color: '#94A3B8', marginBottom: '8px' }}></i>
                      <div style={{ fontWeight: '700' }}>No Telephony Call Records Found</div>
                      <div style={{ fontSize: '0.78rem', marginTop: '2px' }}>Customer phone calls will log here automatically.</div>
                    </td>
                  </tr>
                ) : (
                  adminCallHistory.map(call => {
                    const durationMin = Math.floor((call.callDurationSeconds || 0) / 60);
                    const durationSec = (call.callDurationSeconds || 0) % 60;
                    const durationStr = `${durationMin.toString().padStart(2, '0')}:${durationSec.toString().padStart(2, '0')}`;
                    const orderNum = call.ivr?.orderId?.orderNumber || call.ivr?.orderNumber || 'No Order';
                    const orderAmt = call.ivr?.orderId?.totalAmount ? `₹${call.ivr.orderId.totalAmount}` : '';

                    return (
                      <tr key={call._id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: '800', fontFamily: 'monospace', color: '#0071E3' }}>{call.callId}</div>
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: '800',
                            padding: '2px 6px',
                            borderRadius: '10px',
                            background: call.queueStatus === 'COMPLETED' ? '#D1FAE5' : '#FEE2E2',
                            color: call.queueStatus === 'COMPLETED' ? '#065F46' : '#991B1B'
                          }}>
                            ● {call.queueStatus}
                          </span>
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: '700', color: '#0F172A' }}>{call.customerName || 'Customer'}</div>
                          <div style={{ fontSize: '0.76rem', color: '#64748B' }}>📞 {call.customerPhone}</div>
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          {call.assignedAgent?.name ? (
                            <div>
                              <div style={{ fontWeight: '700', color: '#0F172A' }}>{call.assignedAgent.name}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748B' }}>ID: {call.assignedAgent.workerId || 'AG-AGENT'}</div>
                            </div>
                          ) : (
                            <span style={{ color: '#F59E0B', fontWeight: '700', fontSize: '0.75rem' }}>Unassigned</span>
                          )}
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: '700', fontFamily: 'monospace', color: '#0F172A' }}>{orderNum}</div>
                          {orderAmt && <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: '700' }}>{orderAmt}</div>}
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ background: '#EFF6FF', color: '#1E40AF', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '800' }}>
                            🌐 {call.ivr?.language || 'ENGLISH'}
                          </span>
                          <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '3px' }}>
                            {(call.ivr?.reason || 'OTHER').replace('_', ' ')}
                          </div>
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: '700', color: '#0071E3' }}>⏱️ {durationStr}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                            {new Date(call.createdAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                          </div>
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <audio controls src={call.recordingUrl} style={{ height: '36px', width: '210px', outline: 'none' }} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RESOLUTION ACTION EXECUTION MODAL (Forms for Refund, Pickup, etc.) */}
      {/* ========================================================================= */}
      {actionModalType && inspectedOrderData?.order && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 120,
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '520px',
            background: '#FFFFFF',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                {actionModalType === 'REFUND' && '💰 Issue Instant Wallet Refund'}
                {actionModalType === 'PICKUP' && '📦 Authorize Return & Dispatch Courier'}
                {actionModalType === 'EXPEDITE' && '🛵 Expedite Delayed Order Delivery'}
                {actionModalType === 'GOODWILL' && '🎁 Grant Customer Goodwill Store Credit'}
                {actionModalType === 'CANCEL' && '✕ Cancel Order & Disburse Full Refund'}
              </h3>
              <button
                onClick={() => setActionModalType(null)}
                style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteResolution}>
              {(actionModalType === 'REFUND' || actionModalType === 'GOODWILL') && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
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
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>
              )}

              {actionModalType === 'PICKUP' && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Return Resolution Type
                  </label>
                  <select
                    value={actionFormData.exchangeOrRefund}
                    onChange={(e) => setActionFormData({ ...actionFormData, exchangeOrRefund: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
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
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Priority Escalation Instructions
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Customer departing urgently, prioritize delivery today"
                    value={actionFormData.priorityNotes}
                    onChange={(e) => setActionFormData({ ...actionFormData, priorityNotes: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
              )}

              {actionModalType === 'CANCEL' && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Reason for Emergency Cancellation
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Customer request on call / Courier transit lost"
                    value={actionFormData.cancellationReason}
                    onChange={(e) => setActionFormData({ ...actionFormData, cancellationReason: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
              )}

              {actionModalType === 'PAYMENT_ADMIN_REQUEST' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                        Requested Refund Amount (₹) *
                      </label>
                      <input
                        type="number"
                        required
                        value={actionFormData.amount}
                        onChange={(e) => setActionFormData({ ...actionFormData, amount: e.target.value })}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                        Payout Channel / Destination
                      </label>
                      <select
                        value={actionFormData.payoutDestination}
                        onChange={(e) => setActionFormData({ ...actionFormData, payoutDestination: e.target.value })}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                      >
                        <option value="ORIGINAL_PAYMENT">Original Payment Method (UPI / Card / Bank)</option>
                        <option value="WALLET">NovaKart Customer Wallet (Instant Credit)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                      Instructions for Payment Admin (Port 3005 Audit Note) *
                    </label>
                    <textarea
                      rows="3"
                      required
                      placeholder="e.g. Return item received & QC passed. Authorize ₹2999 refund disburse."
                      value={actionFormData.paymentAdminNotes}
                      onChange={(e) => setActionFormData({ ...actionFormData, paymentAdminNotes: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', resize: 'none' }}
                    />
                  </div>
                </>
              )}

              {actionModalType === 'UPDATE_RR_INSTRUCTIONS' && (
                <>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                      Customer Packaging & Handover Instructions
                    </label>
                    <textarea
                      rows="2"
                      placeholder="Instructions sent to customer on packaging..."
                      value={actionFormData.customerInstructions}
                      onChange={(e) => setActionFormData({ ...actionFormData, customerInstructions: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', resize: 'none' }}
                    />
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                      Courier Pickup Notes & Rider Directives
                    </label>
                    <input
                      type="text"
                      placeholder="Pickup window, OTP instructions, or courier priority notes..."
                      value={actionFormData.courierNotes}
                      onChange={(e) => setActionFormData({ ...actionFormData, courierNotes: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                      Warehouse QC Inspection Directives
                    </label>
                    <input
                      type="text"
                      placeholder="QC checklist notes, serial match requirement..."
                      value={actionFormData.warehouseQcNotes}
                      onChange={(e) => setActionFormData({ ...actionFormData, warehouseQcNotes: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                    />
                  </div>
                </>
              )}

              {(actionModalType === 'REFUND' || actionModalType === 'PICKUP' || actionModalType === 'GOODWILL') && (
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Internal Resolution Reason &amp; Audit Trail *
                  </label>
                  <textarea
                    rows="3"
                    required
                    placeholder="Enter reason for audit record..."
                    value={actionFormData.reason}
                    onChange={(e) => setActionFormData({ ...actionFormData, reason: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
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
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#F1F5F9',
                    color: '#475569',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: actionModalType === 'CANCEL' ? '#DC2626' : '#10B981',
                    color: '#FFFFFF',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
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

      {/* Resolve Ticket Modal */}
      {showResolveModal && selectedTicket && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#D1FAE5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fa-solid fa-circle-check"></i>
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                    Resolve Ticket #{selectedTicket.ticketNumber}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Audit Note &amp; Customer Closeout</span>
                </div>
              </div>
              <button
                onClick={() => setShowResolveModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <textarea
              rows="4"
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Enter official resolution details for audit..."
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.85rem',
                outline: 'none',
                marginBottom: '16px'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowResolveModal(false)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#F1F5F9',
                  color: '#475569',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleUpdateStatus(selectedTicket._id, 'RESOLVED')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#10B981',
                  color: '#FFFFFF',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Confirm Resolution &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ONBOARD NEW SUPPORT WORKER (ADMIN ONLY) */}
      {showAddWorkerModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#0F172A', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fa-solid fa-user-shield"></i>
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                    Onboard Support Worker
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Admin Staff Authorization • Help Center Portal</span>
                </div>
              </div>
              <button
                onClick={() => setShowAddWorkerModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddWorker}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  Worker Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sundaram"
                  value={workerForm.name}
                  onChange={(e) => setWorkerForm({ ...workerForm, name: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Work Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="name@novakart.in"
                    value={workerForm.email}
                    onChange={(e) => setWorkerForm({ ...workerForm, email: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Initial Password *
                  </label>
                  <input
                    type="text"
                    required
                    value={workerForm.password}
                    onChange={(e) => setWorkerForm({ ...workerForm, password: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  Assigned Specialty / Domain
                </label>
                <select
                  value={workerForm.specialty}
                  onChange={(e) => setWorkerForm({ ...workerForm, specialty: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', background: '#FFFFFF' }}
                >
                  <option value="Returns & QC Verification">Returns &amp; QC Verification (Physical &amp; Quality Inspection)</option>
                  <option value="Logistics & Doorstep Delivery">Logistics &amp; Doorstep Delivery (Rider Delays &amp; Geocoding)</option>
                  <option value="Payments & Treasury Disbursals">Payments &amp; Treasury Disbursals (Refunds &amp; Wallets)</option>
                  <option value="Damaged Products & Size Exchange">Damaged Products &amp; Size Exchange (Replacements)</option>
                  <option value="General Customer Care">General Customer Care &amp; Order Tracking</option>
                  <option value="Escalation & High Priority Claims">Escalation &amp; High Priority Claims</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={workerForm.phone}
                    onChange={(e) => setWorkerForm({ ...workerForm, phone: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Worker ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder={`e.g. WRK-0${workers.length + 1}`}
                    value={workerForm.workerId}
                    onChange={(e) => setWorkerForm({ ...workerForm, workerId: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddWorkerModal(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#F1F5F9',
                    color: '#475569',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingWorker}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#0F172A',
                    color: '#FFFFFF',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    cursor: submittingWorker ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {submittingWorker ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      <span>Creating Worker Account...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-check"></i>
                      <span>Create Support Worker</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
