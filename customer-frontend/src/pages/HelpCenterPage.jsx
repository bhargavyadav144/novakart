import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function HelpCenterPage() {
  const { user } = useAuth();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [orders, setOrders] = useState([]);

  // Create Ticket Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newTicketData, setNewTicketData] = useState({
    category: 'RETURNS_EXCHANGES',
    subject: '',
    description: '',
    orderId: '',
    priority: 'MEDIUM'
  });

  // Call Back Modal State (IVR Call Queue)
  const [isCallBackModalOpen, setIsCallBackModalOpen] = useState(false);
  const [submittingCallBack, setSubmittingCallBack] = useState(false);
  const [callBackFormData, setCallBackFormData] = useState({
    phone: '',
    orderId: '',
    language: 'ENGLISH',
    reason: 'OTHER',
    statement: ''
  });
  const [callQueueAvailability, setCallQueueAvailability] = useState(null);
  const [myActiveCalls, setMyActiveCalls] = useState([]);
  const [showCallTracker, setShowCallTracker] = useState(false);
  const [callTrackerInterval, setCallTrackerInterval] = useState(null);

  // AI Chat Bot State
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiMessages, setAiMessages] = useState([
    {
      role: 'bot',
      text: `👋 Hello${user?.name ? `, ${user.name.split(' ')[0]}` : ''}! I'm SmartCart AI Assistant. I can help you with:\n\n• 📦 Check order status\n• 🔄 Return & exchange info\n• 💳 Payment & refund queries\n• 🚚 Delivery tracking\n• ❓ General questions\n\nType your question or enter an **Order ID** to get started!`,
      time: new Date()
    }
  ]);
  const [aiInput, setAiInput] = useState('');
  const [aiTyping, setAiTyping] = useState(false);
  const [customerSpeechInput, setCustomerSpeechInput] = useState('');
  const [sendingSpeech, setSendingSpeech] = useState(false);
  const chatEndRef = useRef(null);

  const handleSendCustomerSpeech = async (callId) => {
    if (!customerSpeechInput || !customerSpeechInput.trim()) return;
    setSendingSpeech(true);
    try {
      const res = await api.post(`/call-queue/${callId}/speech`, {
        message: customerSpeechInput.trim(),
        sender: 'CUSTOMER',
        senderName: user?.name || 'Customer'
      });
      if (res.data.success) {
        setCustomerSpeechInput('');
        refreshMyActiveCalls();
      }
    } catch (err) {
      console.error('Failed to send speech:', err);
    } finally {
      setSendingSpeech(false);
    }
  };


  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiMessages, aiTyping]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [ticketsRes, ordersRes, availRes, callsRes] = await Promise.allSettled([
        api.get('/support/my-tickets'),
        api.get('/orders/my-orders'),
        api.get('/call-queue/availability'),
        api.get('/call-queue/my-calls')
      ]);

      if (ticketsRes.status === 'fulfilled' && ticketsRes.value.data.success) {
        const fetchedTickets = ticketsRes.value.data.tickets || [];
        setTickets(fetchedTickets);
        if (fetchedTickets.length > 0 && !selectedTicket) {
          setSelectedTicket(fetchedTickets[0]);
        }
      }

      if (ordersRes.status === 'fulfilled' && ordersRes.value.data.orders) {
        setOrders(ordersRes.value.data.orders || []);
      }

      if (availRes.status === 'fulfilled' && availRes.value.data.success) {
        setCallQueueAvailability(availRes.value.data.availability);
      }

      if (callsRes.status === 'fulfilled' && callsRes.value.data.success) {
        const activeCalls = (callsRes.value.data.calls || []).filter(c => !['COMPLETED', 'CANCELLED', 'ABANDONED', 'MISSED'].includes(c.queueStatus));
        setMyActiveCalls(activeCalls);
        if (activeCalls.length > 0) setShowCallTracker(true);
      }
    } catch (err) {
      console.error('Error fetching help center data:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshMyActiveCalls = async () => {
    try {
      const [callsRes, ticketsRes] = await Promise.allSettled([
        api.get('/call-queue/my-calls'),
        api.get('/support/my-tickets')
      ]);

      if (callsRes.status === 'fulfilled' && callsRes.value.data.success) {
        const activeCalls = (callsRes.value.data.calls || []).filter(c => !['COMPLETED', 'CANCELLED', 'ABANDONED', 'MISSED'].includes(c.queueStatus));
        setMyActiveCalls(activeCalls);
        if (activeCalls.length === 0 && !tickets.some(t => t.callBackDetails?.status === 'CALLING')) {
          setShowCallTracker(false);
          if (callTrackerInterval) { clearInterval(callTrackerInterval); setCallTrackerInterval(null); }
        }
      }

      if (ticketsRes.status === 'fulfilled' && ticketsRes.value.data.success) {
        setTickets(ticketsRes.value.data.tickets || []);
      }
    } catch (e) { /* silent */ }
  };

  const handleAcceptIncomingCall = async (ticketId, callId) => {
    try {
      if (ticketId) {
        await api.put(`/support/tickets/${ticketId}/accept-call`);
      }
      if (callId) {
        await api.put(`/call-queue/${callId}/accept-call`);
      }
      refreshMyActiveCalls();
    } catch (err) {
      console.error('Accept call error:', err);
    }
  };

  const handleDeclineIncomingCall = async (ticketId, callId) => {
    try {
      if (ticketId) {
        await api.put(`/support/tickets/${ticketId}/decline-call`);
      }
      if (callId) {
        await api.put(`/call-queue/${callId}/cancel`);
      }
      refreshMyActiveCalls();
    } catch (err) {
      console.error('Decline call error:', err);
    }
  };

  const handleIVRKeyPress = async (callId, digit) => {
    try {
      const res = await api.put(`/call-queue/${callId}/ivr-key`, { digit });
      if (res.data.success) {
        refreshMyActiveCalls();
        const botMsgs = res.data.call?.callTranscript?.filter(t => t.sender === 'BOT');
        if (botMsgs && botMsgs.length > 0 && window.speechSynthesis) {
          const lastMsg = botMsgs[botMsgs.length - 1].message;
          const utterance = new SpeechSynthesisUtterance(lastMsg);
          window.speechSynthesis.speak(utterance);
        }
      }
    } catch (err) {
      console.error('IVR keypress error:', err);
    }
  };


  useEffect(() => {
    if (user?.phone) {
      setCallBackFormData(prev => ({ ...prev, phone: user.phone }));
    }
  }, [user]);

  const handleRequestCallBack = async (e) => {
    e.preventDefault();
    if (!callBackFormData.phone || !callBackFormData.phone.trim()) {
      alert('Please provide a valid contact phone number.');
      return;
    }
    setSubmittingCallBack(true);
    try {
      const res = await api.post('/call-queue/request-call', {
        phone: callBackFormData.phone,
        language: callBackFormData.language,
        reason: callBackFormData.reason,
        orderId: callBackFormData.orderId || undefined,
        statement: callBackFormData.statement
      });
      if (res.data.success) {
        setIsCallBackModalOpen(false);
        setCallBackFormData({ phone: user?.phone || '', orderId: '', language: 'ENGLISH', reason: 'OTHER', statement: '' });
        setMyActiveCalls(prev => [res.data.call, ...prev]);
        setShowCallTracker(true);
        const interval = setInterval(refreshMyActiveCalls, 5000);
        setCallTrackerInterval(interval);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit call request');
    } finally {
      setSubmittingCallBack(false);
    }
  };

  const handleCancelCall = async (callId) => {
    try {
      await api.put(`/call-queue/${callId}/cancel`);
      refreshMyActiveCalls();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel call');
    }
  };

  const handleOpenTicketModal = (category = 'RETURNS_EXCHANGES') => {
    setNewTicketData(prev => ({ ...prev, category }));
    setIsCreateModalOpen(true);
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!newTicketData.subject.trim() || !newTicketData.description.trim()) {
      alert('Please provide both a subject and issue description.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        category: newTicketData.category,
        subject: newTicketData.subject,
        description: newTicketData.description,
        priority: newTicketData.priority,
        orderId: newTicketData.orderId || undefined
      };
      const res = await api.post('/support/tickets', payload);
      if (res.data.success) {
        alert(`Support ticket #${res.data.ticket.ticketNumber} created successfully!`);
        setIsCreateModalOpen(false);
        setNewTicketData({ category: 'RETURNS_EXCHANGES', subject: '', description: '', orderId: '', priority: 'MEDIUM' });
        const refRes = await api.get('/support/my-tickets');
        if (refRes.data.success) {
          setTickets(refRes.data.tickets);
          setSelectedTicket(refRes.data.ticket || refRes.data.tickets[0]);
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  // ═══════════════════════════════════════════
  // AI CHAT BOT ENGINE
  // ═══════════════════════════════════════════
  const handleAISend = async () => {
    const msg = aiInput.trim();
    if (!msg) return;

    const userMsg = { role: 'user', text: msg, time: new Date() };
    setAiMessages(prev => [...prev, userMsg]);
    setAiInput('');
    setAiTyping(true);

    // Simulate AI processing delay
    await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));

    let botReply = '';

    // Check if user typed an order number/ID pattern
    const orderIdMatch = msg.match(/ORD[-_]?\d+/i) || msg.match(/[a-f0-9]{24}/i);

    if (orderIdMatch) {
      // Try to look up the order
      try {
        const lookupId = orderIdMatch[0];
        const matchedOrder = orders.find(o =>
          o.orderNumber?.toUpperCase() === lookupId.toUpperCase() ||
          o._id === lookupId
        );

        if (matchedOrder) {
          const statusEmoji = {
            'PENDING': '⏳', 'SELLER_ACCEPTED': '✅', 'AGENT_ASSIGNED': '🛵',
            'PICKED_UP': '📦', 'OUT_FOR_DELIVERY': '🚚', 'DELIVERED': '✓',
            'COMPLETED': '🎉', 'CANCELLED': '❌', 'REJECTED': '⛔'
          };
          botReply = `📋 **Order Found: ${matchedOrder.orderNumber}**\n\n` +
            `${statusEmoji[matchedOrder.orderStatus] || '📌'} Status: **${matchedOrder.orderStatus?.replace(/_/g, ' ')}**\n` +
            `💰 Total: **₹${matchedOrder.totalAmount}**\n` +
            `📅 Placed: ${new Date(matchedOrder.createdAt).toLocaleDateString('en-IN')}\n` +
            `📦 Items: ${matchedOrder.items?.length || 0} product(s)\n` +
            `💳 Payment: ${matchedOrder.paymentMethod} (${matchedOrder.paymentStatus})\n\n` +
            `Need help with this order? You can:\n• Create a **support ticket** for expert assistance\n• **Request a call** to speak with an agent`;
        } else {
          botReply = `🔍 I couldn't find order **${lookupId}** in your recent orders. Please double-check the Order ID from your email confirmation or Order History page.`;
        }
      } catch {
        botReply = `⚠️ I had trouble looking up that order. Please try again or create a support ticket for assistance.`;
      }
    } else {
      // AI response based on keywords
      const lower = msg.toLowerCase();

      if (lower.includes('return') || lower.includes('exchange') || lower.includes('replace')) {
        botReply = `🔄 **Returns & Exchanges**\n\nHere's how our return process works:\n\n1️⃣ **Request Return** — Submit via Order History or create a ticket\n2️⃣ **Admin Review** — Our team verifies eligibility\n3️⃣ **Pickup Scheduled** — Delivery agent picks up from your doorstep\n4️⃣ **Warehouse QC** — Product inspected at our fulfillment center\n5️⃣ **Refund Processed** — Payment admin approves & releases funds\n\n📌 Returns are accepted within 7 days of delivery.\n\nWould you like to **create a return ticket** or **check an existing return**?`;
      } else if (lower.includes('refund') || lower.includes('payment') || lower.includes('money') || lower.includes('wallet')) {
        botReply = `💳 **Payments & Refunds**\n\nRefund timeline after return QC approval:\n• **UPI/Online**: 3-5 business days\n• **Wallet Credit**: Instant after admin approval\n• **COD Refund**: 5-7 business days via bank transfer\n\n⚠️ Refunds are only processed **after warehouse QC verification** of the returned product.\n\nTo check your refund status, please share your **Order ID** or create a support ticket.`;
      } else if (lower.includes('delivery') || lower.includes('track') || lower.includes('shipping') || lower.includes('where')) {
        botReply = `🚚 **Delivery & Tracking**\n\nYour delivery goes through these stages:\n1. Seller Accepted → Warehouse Assigned\n2. Delivery Agent Picked Up\n3. Out for Delivery → GPS Tracking Active\n4. Delivered with Proof of Handover\n\n📍 Real-time tracking is available on your **Order Tracking** page.\n\nShare your **Order ID** and I can check the current status for you!`;
      } else if (lower.includes('cancel') || lower.includes('stop order')) {
        botReply = `❌ **Order Cancellation**\n\nOrders can be cancelled if they haven't been picked up yet.\n\n• If status is **PENDING** or **SELLER_ACCEPTED**: You can cancel directly from Order History\n• If already **PICKED_UP** or beyond: Please create a support ticket for our team to handle\n\nWould you like me to help you check an order for cancellation?`;
      } else if (lower.includes('damaged') || lower.includes('broken') || lower.includes('defect') || lower.includes('wrong')) {
        botReply = `⚠️ **Damaged/Defective Product**\n\nSorry to hear about this! Here's what to do:\n\n1. **Create a ticket** under "Damaged or Defective Item" category\n2. Our support team will authorize an immediate return pickup\n3. After warehouse inspection, you'll get a **replacement or full refund**\n\n📸 If possible, keep photos of the damage ready — the support agent may need them.\n\nShall I open a ticket for you?`;
      } else if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey') || lower.includes('help')) {
        botReply = `Hello! 😊 I'm here to help! You can:\n\n• Type an **Order ID** (e.g., ORD-12345) to check status\n• Ask about **returns**, **refunds**, **delivery**, or **cancellations**\n• Create a **support ticket** for expert help\n• **Request a call** to speak with a live agent\n\nWhat would you like help with?`;
      } else if (lower.includes('agent') || lower.includes('human') || lower.includes('person') || lower.includes('call') || lower.includes('speak')) {
        botReply = `📞 **Connect with a Human Agent**\n\nYou have two options:\n\n1. 🎫 **Create a Support Ticket** — An assigned specialist will investigate your issue and update you\n2. 📞 **Request a Call** — Join our call queue and a support agent will call you directly\n\nUse the buttons at the top of this page to get started!`;
      } else if (lower.includes('thank') || lower.includes('thanks') || lower.includes('great') || lower.includes('awesome')) {
        botReply = `You're welcome! 😊 Happy to help. If you need anything else, just ask!\n\n🌟 Don't forget — you can always check your **Order History** for real-time updates or create a **Support Ticket** for any complex issues.`;
      } else {
        botReply = `I understand you're asking about: "${msg}"\n\n🤖 Here's what I can help with:\n• **Order lookup** — Type your Order ID\n• **Returns & Exchanges** — Ask about return process\n• **Payment & Refunds** — Check refund status\n• **Delivery** — Track your shipment\n• **Support Ticket** — Get expert assistance\n\nCould you rephrase your question or try one of these topics?`;
      }
    }

    setAiTyping(false);
    setAiMessages(prev => [...prev, { role: 'bot', text: botReply, time: new Date() }]);
  };

  const categoryCards = [
    { key: 'RETURNS_EXCHANGES', title: 'Returns & Exchanges', subtitle: 'Doorstep pickup, product QC status & replacement', icon: 'fa-solid fa-rotate-left', color: '#3B82F6', bg: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)' },
    { key: 'PAYMENTS_REFUNDS', title: 'Payments & Refunds', subtitle: 'QC verified refund approvals & payouts', icon: 'fa-solid fa-credit-card', color: '#10B981', bg: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)' },
    { key: 'DELIVERY_TRACKING', title: 'Delivery & Tracking', subtitle: 'Real-time courier GPS & reschedule', icon: 'fa-solid fa-truck-fast', color: '#F59E0B', bg: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)' },
    { key: 'DAMAGED_DEFECTIVE', title: 'Damaged or Defective', subtitle: 'Broken seal, missing parts or wrong product', icon: 'fa-solid fa-triangle-exclamation', color: '#EF4444', bg: 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)' },
    { key: 'ACCOUNT_SECURITY', title: 'Account & Security', subtitle: 'Password recovery & authentication', icon: 'fa-solid fa-shield-halved', color: '#8B5CF6', bg: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)' },
    { key: 'OTHER', title: 'General Inquiries', subtitle: 'Platform policy & specialized assistance', icon: 'fa-solid fa-circle-question', color: '#6B7280', bg: 'linear-gradient(135deg, #F9FAFB 0%, #F3F4F6 100%)' }
  ];

  const getStatusBadge = (status) => {
    const badges = {
      'OPEN': { bg: '#DBEAFE', color: '#1E40AF', label: '● OPEN' },
      'IN_PROGRESS': { bg: '#FEF3C7', color: '#B45309', label: '⚡ IN PROGRESS' },
      'WAITING_CUSTOMER': { bg: '#FDE68A', color: '#92400E', label: '⏳ ACTION REQUIRED' },
      'RESOLVED': { bg: '#D1FAE5', color: '#065F46', label: '✓ RESOLVED' },
      'CLOSED': { bg: '#E5E7EB', color: '#374151', label: '✕ CLOSED' }
    };
    const b = badges[status] || { bg: '#F3F4F6', color: '#374151', label: status };
    return <span style={{ background: b.bg, color: b.color, padding: '3px 9px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700' }}>{b.label}</span>;
  };

  return (
    <div className="help-center-page" style={{ background: '#F8FAFC', minHeight: '85vh', paddingBottom: '60px' }}>
      {/* Hero Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
        color: '#FFFFFF',
        padding: '48px 24px',
        textAlign: 'center',
        position: 'relative'
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)',
            padding: '6px 16px', borderRadius: '24px', fontSize: '0.85rem', color: '#93C5FD', marginBottom: '16px'
          }}>
            <i className="fa-solid fa-headset"></i> Smart Help Center & AI Assistant
          </div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: '800', marginBottom: '12px', letterSpacing: '-0.5px' }}>
            How can we help you today?
          </h1>
          <p style={{ fontSize: '1.05rem', color: '#94A3B8', maxWidth: '650px', margin: '0 auto 24px' }}>
            AI-powered support for Returns, Refunds, Delivery Tracking & Order Inquiries. Create tickets for expert human assistance.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleOpenTicketModal('RETURNS_EXCHANGES')}
              style={{
                background: '#0071E3', color: '#FFFFFF', border: 'none', borderRadius: '8px',
                padding: '12px 22px', fontSize: '0.95rem', fontWeight: '700', cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0, 113, 227, 0.35)', display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              <i className="fa-solid fa-plus-circle"></i> Create Support Ticket
            </button>
            <button
              onClick={() => { setShowAIChat(true); }}
              style={{
                background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
                color: '#FFFFFF', border: 'none', borderRadius: '8px',
                padding: '12px 22px', fontSize: '0.95rem', fontWeight: '700', cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(139, 92, 246, 0.4)', display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              <i className="fa-solid fa-robot"></i> AI Chat Support
            </button>
            <button
              onClick={() => {
                if (user?.phone) setCallBackFormData(prev => ({ ...prev, phone: user.phone }));
                setIsCallBackModalOpen(true);
              }}
              style={{
                background: 'linear-gradient(135deg, #E11D48 0%, #BE123C 100%)',
                color: '#FFFFFF', border: 'none', borderRadius: '8px',
                padding: '12px 22px', fontSize: '0.95rem', fontWeight: '700', cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(225, 29, 72, 0.4)', display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              <i className="fa-solid fa-phone-volume fa-shake"></i> Request Call
            </button>
            <Link
              to="/orders"
              style={{
                background: 'rgba(255, 255, 255, 0.1)', color: '#FFFFFF',
                border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px',
                padding: '12px 20px', fontSize: '0.95rem', fontWeight: '600',
                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              <i className="fa-solid fa-clock-rotate-left"></i> Order History
            </Link>
          </div>
        </div>
      </div>

      {/* 📞 HIGH-PRIORITY INCOMING CALL RINGING MODAL */}
      {(() => {
        const ringingTicket = tickets.find(t => t.callBackDetails && ['CALLING', 'RINGING'].includes(t.callBackDetails.status));
        const connectingCall = myActiveCalls.find(c => ['CONNECTING', 'RINGING'].includes(c.queueStatus));

        const incomingCall = ringingTicket ? {
          ticketId: ringingTicket._id,
          officerName: ringingTicket.assignedWorker?.name || 'Support Representative',
          ticketNumber: ringingTicket.ticketNumber,
          phone: ringingTicket.customerPhone
        } : connectingCall ? {
          callId: connectingCall._id,
          officerName: connectingCall.assignedAgent?.name || 'Support Representative',
          phone: connectingCall.customerPhone
        } : null;

        if (!incomingCall) return null;

        return (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(12px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%)',
              border: '2px solid #10B981',
              borderRadius: '24px',
              maxWidth: '460px',
              width: '100%',
              padding: '32px 24px',
              textAlign: 'center',
              color: '#FFFFFF',
              boxShadow: '0 25px 50px -12px rgba(16, 185, 129, 0.4)',
              animation: 'pulse 1.5s infinite'
            }}>
              <div style={{
                width: '84px', height: '84px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: '#FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2.4rem', margin: '0 auto 20px',
                boxShadow: '0 0 30px #10B981'
              }}>
                <i className="fa-solid fa-phone-volume fa-shake"></i>
              </div>

              <h3 style={{ fontSize: '1.45rem', fontWeight: '800', marginBottom: '6px' }}>
                📞 Incoming Call from NovaKart Support
              </h3>
              <p style={{ fontSize: '0.92rem', color: '#E2E8F0', marginBottom: '6px', lineHeight: '1.4' }}>
                Officer <strong>{incomingCall.officerName}</strong> is dialing your registered line ({incomingCall.phone || 'on file'}).
              </p>
              <div style={{ fontSize: '0.78rem', color: '#6EE7B7', fontWeight: '700', marginBottom: '24px' }}>
                Please accept the call to connect live with the support representative.
              </div>

              <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
                <button
                  onClick={() => handleDeclineIncomingCall(incomingCall.ticketId, incomingCall.callId)}
                  style={{
                    flex: 1, padding: '14px', borderRadius: '12px', border: 'none',
                    background: '#EF4444', color: '#FFFFFF', fontSize: '0.95rem',
                    fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}
                >
                  <i className="fa-solid fa-phone-slash"></i> Decline
                </button>
                <button
                  onClick={() => handleAcceptIncomingCall(incomingCall.ticketId, incomingCall.callId)}
                  style={{
                    flex: 1, padding: '14px', borderRadius: '12px', border: 'none',
                    background: '#10B981', color: '#FFFFFF', fontSize: '0.95rem',
                    fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
                  }}
                >
                  <i className="fa-solid fa-phone"></i> Accept Call
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ════════ LIVE CALL QUEUE TRACKER ════════ */}
      {showCallTracker && myActiveCalls.length > 0 && (

        <div style={{ maxWidth: '1200px', margin: '-20px auto 16px', padding: '0 16px', zIndex: 10, position: 'relative' }}>
          {myActiveCalls.map(call => {
            const isIvr = call.queueStatus === 'IVR_IN_PROGRESS';
            const isQueued = call.queueStatus === 'QUEUED';
            const isConnecting = call.queueStatus === 'CONNECTING';
            const isConnected = call.queueStatus === 'CONNECTED';
            const isOnHold = call.queueStatus === 'ON_HOLD';

            const statusLabel = isIvr ? '📞 IVR AUTO-DIALER ACTIVE' : isConnected ? '🟢 CONNECTED' : isConnecting ? '🟡 CONNECTING...' : isOnHold ? '🟣 ON HOLD' : `🔵 QUEUE #${call.queuePosition || '?'}`;

            return (
              <div key={call._id || call.callId} style={{
                background: `linear-gradient(135deg, ${isConnected ? '#064E3B' : isOnHold ? '#4C1D95' : isIvr ? '#1E3A8A' : '#1E293B'} 0%, ${isConnected ? '#065F46' : isOnHold ? '#5B21B6' : isIvr ? '#1E293B' : '#0F172A'} 100%)`,
                borderRadius: '16px', padding: '20px', marginBottom: '14px', color: '#FFFFFF',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)', animation: (isQueued || isOnHold || isIvr) ? 'pulse 2s infinite' : 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: (isConnected || isOnHold || isIvr) ? '16px' : '0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem'
                    }}>
                      <i className={isConnected ? 'fa-solid fa-phone-flip' : isOnHold ? 'fa-solid fa-music' : isIvr ? 'fa-solid fa-robot' : 'fa-solid fa-phone-volume'}></i>
                    </div>
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{statusLabel}</span>
                        {isConnected && (
                          <span style={{ fontSize: '0.72rem', background: '#10B981', color: '#064E3B', padding: '2px 8px', borderRadius: '10px', fontWeight: '800' }}>
                            🎙️ LIVE AUDIO ACTIVE
                          </span>
                        )}
                        {isOnHold && <span style={{ marginLeft: '8px', fontSize: '0.8rem', opacity: 0.9 }}>♫ Hold music playing...</span>}
                      </div>
                      <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: '2px' }}>
                        {isIvr && `Auto-dialer connected. Complete IVR choices on pad.`}
                        {isQueued && `Estimated wait: ~${Math.ceil((call.estimatedWaitSeconds || 120) / 60)} min`}
                        {isConnecting && `Agent is dialing your line...`}
                        {isConnected && `Connected with Officer ${call.assignedAgent?.name || 'Support Representative'}`}
                        {isOnHold && `Officer placed call on hold - will return shortly`}
                      </div>
                      <div style={{ fontSize: '0.72rem', opacity: 0.6, marginTop: '2px' }}>
                        Call ID: {call.callId} • Language: {call.ivr?.language || 'EN'} • Reason: {call.ivr?.reason?.replace(/_/g, ' ') || 'General'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {isQueued && (
                      <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 14px', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: '800' }}>#{call.queuePosition || '?'}</div>
                        <div style={{ fontSize: '0.65rem', opacity: 0.7 }}>IN LINE</div>
                      </div>
                    )}
                    <button onClick={() => handleCancelCall(call._id)} style={{
                      background: 'rgba(239, 68, 68, 0.25)', border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#FCA5A5', borderRadius: '8px', padding: '8px 14px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer'
                    }}>{isConnected ? 'End Call' : 'Cancel Call'}</button>
                  </div>
                </div>

                {/* 🤖 IVR INTERACTIVE KEYPAD CONTROLLER */}
                {isIvr && (
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    borderRadius: '12px',
                    padding: '16px',
                    marginTop: '12px',
                    border: '1px solid rgba(59, 130, 246, 0.4)'
                  }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#60A5FA', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-robot"></i>
                      <span>Automated IVR Interactive Dialer (Press Key on Pad)</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#E2E8F0', marginBottom: '14px', background: 'rgba(255,255,255,0.08)', padding: '10px 14px', borderRadius: '8px', fontStyle: 'italic' }}>
                      "{call.callTranscript?.[call.callTranscript.length - 1]?.message || 'Welcome to NovaKart Support Telephony!'}"
                    </div>

                    {(!call.ivr?.step || call.ivr?.step === 'LANG_SELECT') && (
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase', color: '#93C5FD', marginBottom: '8px' }}>
                          Step 1: Select Spoken Language
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
                          <button onClick={() => handleIVRKeyPress(call._id, '1')} style={{ background: '#2563EB', color: '#FFF', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: '800', cursor: 'pointer' }}>[1] English 🇬🇧</button>
                          <button onClick={() => handleIVRKeyPress(call._id, '2')} style={{ background: '#2563EB', color: '#FFF', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: '800', cursor: 'pointer' }}>[2] Hindi 🇮🇳</button>
                          <button onClick={() => handleIVRKeyPress(call._id, '3')} style={{ background: '#2563EB', color: '#FFF', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: '800', cursor: 'pointer' }}>[3] Telugu 🇮🇳</button>
                          <button onClick={() => handleIVRKeyPress(call._id, '4')} style={{ background: '#2563EB', color: '#FFF', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: '800', cursor: 'pointer' }}>[4] Tamil 🇮🇳</button>
                        </div>
                      </div>
                    )}

                    {call.ivr?.step === 'ISSUE_SELECT' && (
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase', color: '#93C5FD', marginBottom: '8px' }}>
                          Step 2: Select Inquiry Category
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                          <button onClick={() => handleIVRKeyPress(call._id, '1')} style={{ background: '#059669', color: '#FFF', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: '800', cursor: 'pointer' }}>[1] Order Status 📦</button>
                          <button onClick={() => handleIVRKeyPress(call._id, '2')} style={{ background: '#059669', color: '#FFF', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: '800', cursor: 'pointer' }}>[2] Returns 🔄</button>
                          <button onClick={() => handleIVRKeyPress(call._id, '3')} style={{ background: '#059669', color: '#FFF', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: '800', cursor: 'pointer' }}>[3] Payment Issue 💳</button>
                          <button onClick={() => handleIVRKeyPress(call._id, '9')} style={{ background: '#D97706', color: '#FFF', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: '800', cursor: 'pointer' }}>[9] Talk to Helper 🎧</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 💬 LIVE TELEPHONY CONVERSATION TRANSCRIPT FEED */}
                {(isConnected || isOnHold) && (
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.35)',
                    borderRadius: '12px',
                    padding: '14px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6EE7B7' }}>
                        🎙️ Live Voice Speech Dialogue Feed ({call.callTranscript?.length || 0} Entries)
                      </span>
                      <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                        Both Customer &amp; Officer can speak into the live call line
                      </span>
                    </div>

                    <div style={{
                      maxHeight: '160px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      marginBottom: '12px',
                      paddingRight: '6px'
                    }}>
                      {(!call.callTranscript || call.callTranscript.length === 0) ? (
                        <div style={{ fontSize: '0.8rem', opacity: 0.7, fontStyle: 'italic', textAlign: 'center', padding: '10px' }}>
                          Connecting voice line... Speak or type below to talk with Officer.
                        </div>
                      ) : (
                        call.callTranscript.map((t, idx) => {
                          const isCust = t.sender === 'CUSTOMER';
                          const isSys = t.sender === 'SYSTEM';
                          return (
                            <div key={idx} style={{
                              alignSelf: isSys ? 'center' : isCust ? 'flex-end' : 'flex-start',
                              maxWidth: isSys ? '90%' : '80%',
                              background: isSys ? 'rgba(255, 255, 255, 0.1)' : isCust ? '#059669' : '#1E293B',
                              color: '#FFFFFF',
                              borderRadius: isSys ? '8px' : isCust ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                              padding: '8px 12px',
                              fontSize: '0.82rem',
                              border: isSys ? '1px dashed rgba(255,255,255,0.2)' : 'none'
                            }}>
                              <div style={{ fontSize: '0.68rem', fontWeight: '800', opacity: 0.8, marginBottom: '2px' }}>
                                {t.senderName || t.sender} • {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              <div>{t.message}</div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Speech Input Box for Customer */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Type to speak to support officer on call..."
                        value={customerSpeechInput}
                        onChange={(e) => setCustomerSpeechInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSendCustomerSpeech(call._id);
                        }}
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.2)',
                          background: 'rgba(255,255,255,0.1)',
                          color: '#FFFFFF',
                          fontSize: '0.85rem',
                          outline: 'none'
                        }}
                      />
                      <button
                        onClick={() => handleSendCustomerSpeech(call._id)}
                        disabled={sendingSpeech || !customerSpeechInput.trim()}
                        style={{
                          background: '#10B981',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '10px 16px',
                          fontSize: '0.85rem',
                          fontWeight: '800',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <i className="fa-solid fa-paper-plane"></i>
                        <span>Speak</span>
                      </button>
                    </div>

                    {/* Quick speech chips */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                      <span style={{ fontSize: '0.7rem', opacity: 0.7, alignSelf: 'center' }}>Quick Speak:</span>
                      {[
                        "Hello Officer, I need help with my delivery status.",
                        "Can you please check why my order is delayed?",
                        "I want to request a return and instant wallet refund."
                      ].map((chip, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setCustomerSpeechInput(chip);
                          }}
                          style={{
                            background: 'rgba(255,255,255,0.12)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: '#FFFFFF',
                            borderRadius: '12px',
                            padding: '3px 8px',
                            fontSize: '0.7rem',
                            cursor: 'pointer'
                          }}
                        >
                          "{chip}"
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}


      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px 0' }}>
        {/* Category Cards */}
        <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0F172A', marginBottom: '16px' }}>
          Quick Problem Solutions & Ticket Categories
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '36px' }}>
          {categoryCards.map(cat => (
            <div
              key={cat.key}
              onClick={() => handleOpenTicketModal(cat.key)}
              style={{
                background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0',
                padding: '20px', cursor: 'pointer', transition: 'all 0.2s ease',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = cat.color; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.05)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '10px', background: cat.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: cat.color, fontSize: '1.2rem', marginBottom: '14px'
                }}>
                  <i className={cat.icon}></i>
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0F172A', marginBottom: '6px' }}>{cat.title}</h3>
                <p style={{ fontSize: '0.85rem', color: '#64748B', lineHeight: '1.4' }}>{cat.subtitle}</p>
              </div>
              <div style={{
                marginTop: '16px', paddingTop: '12px', borderTop: '1px dashed #F1F5F9',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                color: cat.color, fontSize: '0.82rem', fontWeight: '700'
              }}>
                <span>Report Issue</span>
                <i className="fa-solid fa-arrow-right"></i>
              </div>
            </div>
          ))}
        </div>

        {/* ═══════ TICKETS LIST (No Chat — Status Only) ═══════ */}
        <div style={{
          background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)', overflow: 'hidden', marginBottom: '40px'
        }}>
          <div style={{
            padding: '18px 24px', borderBottom: '1px solid #E2E8F0',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC'
          }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                <i className="fa-solid fa-ticket" style={{ color: '#0071E3', marginRight: '8px' }}></i>
                My Support Tickets ({tickets.length})
              </h2>
              <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                Track status & updates from our investigation team
              </span>
            </div>
            <button onClick={() => handleOpenTicketModal()} style={{
              background: '#0071E3', color: '#FFFFFF', border: 'none', borderRadius: '6px',
              padding: '8px 16px', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer'
            }}>+ New Ticket</button>
          </div>

          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>
              <i className="fa-solid fa-spinner fa-spin fa-2x" style={{ color: '#0071E3', marginBottom: '12px' }}></i>
              <div>Loading tickets...</div>
            </div>
          ) : tickets.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center' }}>
              <div style={{
                width: '64px', height: '64px', background: '#EFF6FF', borderRadius: '50%',
                color: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.8rem', margin: '0 auto 16px'
              }}>
                <i className="fa-solid fa-ticket"></i>
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#1E293B', marginBottom: '6px' }}>No Tickets Yet</h3>
              <p style={{ color: '#64748B', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto 20px' }}>
                Have an issue? Create a ticket and our team will investigate & resolve it.
              </p>
              <button onClick={() => handleOpenTicketModal()} style={{
                background: '#0071E3', color: '#FFFFFF', border: 'none', borderRadius: '6px',
                padding: '10px 20px', fontSize: '0.88rem', fontWeight: '700', cursor: 'pointer'
              }}>Open First Ticket</button>
            </div>
          ) : (
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {tickets.map(t => (
                <div
                  key={t._id}
                  style={{
                    padding: '16px 24px', borderBottom: '1px solid #F1F5F9',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    cursor: 'default', transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#FAFAFA'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#0071E3' }}>{t.ticketNumber}</span>
                      {getStatusBadge(t.status)}
                      <span style={{ fontSize: '0.72rem', color: '#94A3B8', background: '#F1F5F9', padding: '2px 8px', borderRadius: '4px' }}>
                        {t.category?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0F172A', marginBottom: '4px' }}>
                      {t.subject}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748B', display: 'flex', gap: '16px' }}>
                      <span>Created: {new Date(t.createdAt).toLocaleDateString('en-IN')}</span>
                      {t.assignedWorker?.name && <span>Assigned: <strong>{t.assignedWorker.name}</strong></span>}
                      {t.priority && <span>Priority: <strong>{t.priority}</strong></span>}
                    </div>
                    {t.resolutionNotes && (
                      <div style={{ marginTop: '6px', padding: '8px 12px', background: '#ECFDF5', borderRadius: '8px', fontSize: '0.82rem', color: '#065F46', border: '1px solid #D1FAE5' }}>
                        <i className="fa-solid fa-circle-check" style={{ marginRight: '6px' }}></i>
                        <strong>Resolution:</strong> {t.resolutionNotes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══════ CREATE TICKET MODAL ═══════ */}
      {isCreateModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '16px', width: '100%', maxWidth: '540px',
            padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#0071E3', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                  <i className="fa-solid fa-ticket"></i>
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0F172A', margin: 0 }}>Create Support Ticket</h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Our investigation team will check & resolve your issue</span>
                </div>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleCreateTicket}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Issue Category *</label>
                <select value={newTicketData.category} onChange={(e) => setNewTicketData({ ...newTicketData, category: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.88rem', background: '#FFFFFF' }}>
                  <option value="RETURNS_EXCHANGES">Returns & Exchanges</option>
                  <option value="PAYMENTS_REFUNDS">Payments & Refunds</option>
                  <option value="DELIVERY_TRACKING">Delivery & Tracking</option>
                  <option value="DAMAGED_DEFECTIVE">Damaged or Defective Item</option>
                  <option value="ACCOUNT_SECURITY">Account & Security</option>
                  <option value="OTHER">Other Questions</option>
                </select>
              </div>

              {orders.length > 0 && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Related Order (Optional)</label>
                  <select value={newTicketData.orderId} onChange={(e) => setNewTicketData({ ...newTicketData, orderId: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.88rem', background: '#FFFFFF' }}>
                    <option value="">-- No specific order --</option>
                    {orders.map(ord => (
                      <option key={ord._id} value={ord._id}>
                        {ord.orderNumber} - ₹{ord.totalAmount} ({ord.orderStatus})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Subject *</label>
                <input type="text" placeholder="e.g. Return pickup delayed" value={newTicketData.subject} onChange={(e) => setNewTicketData({ ...newTicketData, subject: e.target.value })} required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem' }} />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Description *</label>
                <textarea rows={4} placeholder="Describe the issue in detail..." value={newTicketData.description} onChange={(e) => setNewTicketData({ ...newTicketData, description: e.target.value })} required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.88rem', resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsCreateModalOpen(false)} style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '10px 18px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ background: '#0071E3', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '10px 24px', fontWeight: '700', cursor: submitting ? 'not-allowed' : 'pointer' }}>
                  {submitting ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════ CALL QUEUE REQUEST MODAL ═══════ */}
      {isCallBackModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px'
        }}>
          <div style={{ background: '#FFFFFF', borderRadius: '20px', width: '100%', maxWidth: '580px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)', padding: '20px 24px', color: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #E11D48 0%, #BE123C 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>
                  <i className="fa-solid fa-headset"></i>
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0 }}>Request a Call</h3>
                  <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>IVR routes you to the right specialist</span>
                </div>
              </div>
              <button onClick={() => setIsCallBackModalOpen(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#94A3B8', fontSize: '1.1rem', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '8px' }}>✕</button>
            </div>

            {callQueueAvailability && (
              <div style={{ padding: '12px 24px', background: callQueueAvailability.onlineAgents > 0 ? '#ECFDF5' : '#FEF2F2', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: callQueueAvailability.onlineAgents > 0 ? '#10B981' : '#EF4444', display: 'inline-block' }}></span>
                  <span style={{ fontSize: '0.82rem', fontWeight: '700', color: callQueueAvailability.onlineAgents > 0 ? '#065F46' : '#991B1B' }}>
                    {callQueueAvailability.onlineAgents > 0 ? `${callQueueAvailability.onlineAgents} Agent(s) Online` : 'All agents busy'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: '#64748B' }}>
                  {callQueueAvailability.queueSize > 0 && <span><i className="fa-solid fa-users" style={{ marginRight: '4px' }}></i>{callQueueAvailability.queueSize} in queue</span>}
                  {callQueueAvailability.estimatedWaitMinutes > 0 && <span><i className="fa-solid fa-clock" style={{ marginRight: '4px' }}></i>~{callQueueAvailability.estimatedWaitMinutes} min wait</span>}
                </div>
              </div>
            )}

            <form onSubmit={handleRequestCallBack} style={{ padding: '20px 24px' }}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  <i className="fa-solid fa-phone" style={{ marginRight: '6px', color: '#3B82F6' }}></i>Contact Number *
                </label>
                <input type="tel" required placeholder="+91 98765 43210" value={callBackFormData.phone}
                  onChange={(e) => setCallBackFormData({ ...callBackFormData, phone: e.target.value })}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '2px solid #E2E8F0', fontSize: '0.95rem', fontFamily: 'monospace' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    <i className="fa-solid fa-language" style={{ marginRight: '6px', color: '#8B5CF6' }}></i>Language
                  </label>
                  <select value={callBackFormData.language} onChange={(e) => setCallBackFormData({ ...callBackFormData, language: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '2px solid #E2E8F0', fontSize: '0.88rem' }}>
                    <option value="ENGLISH">🇬🇧 English</option>
                    <option value="HINDI">🇮🇳 Hindi</option>
                    <option value="TELUGU">తెలుగు Telugu</option>
                    <option value="TAMIL">தமிழ் Tamil</option>
                    <option value="KANNADA">ಕನ್ನಡ Kannada</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    <i className="fa-solid fa-list-check" style={{ marginRight: '6px', color: '#F59E0B' }}></i>Reason
                  </label>
                  <select value={callBackFormData.reason} onChange={(e) => setCallBackFormData({ ...callBackFormData, reason: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '2px solid #E2E8F0', fontSize: '0.88rem' }}>
                    <option value="RETURN_EXCHANGE">📦 Return / Exchange</option>
                    <option value="ORDER_STATUS">📋 Order Status</option>
                    <option value="PAYMENT_ISSUE">💳 Payment Issue</option>
                    <option value="DELIVERY_PROBLEM">🚚 Delivery Problem</option>
                    <option value="OTHER">❓ Other</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Brief Description</label>
                <textarea rows={2} placeholder="Describe your issue briefly..." value={callBackFormData.statement}
                  onChange={(e) => setCallBackFormData({ ...callBackFormData, statement: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '2px solid #E2E8F0', fontSize: '0.85rem', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsCallBackModalOpen(false)} style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '10px', padding: '11px 20px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={submittingCallBack} style={{
                  background: 'linear-gradient(135deg, #E11D48 0%, #BE123C 100%)', color: '#FFFFFF', border: 'none',
                  borderRadius: '10px', padding: '11px 24px', fontWeight: '700', cursor: submittingCallBack ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(225, 29, 72, 0.35)'
                }}>
                  {submittingCallBack ? <><i className="fa-solid fa-spinner fa-spin"></i><span>Connecting...</span></> : <><i className="fa-solid fa-phone-volume"></i><span>Join Call Queue</span></>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* AI CHAT SUPPORT FLOATING PANEL              */}
      {/* ═══════════════════════════════════════════ */}
      {showAIChat && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px', width: '420px', maxHeight: '620px',
          background: '#FFFFFF', borderRadius: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 200,
          border: '1px solid #E2E8F0', animation: 'slideUp 0.3s ease'
        }}>
          {/* Chat Header */}
          <div style={{
            background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
            padding: '16px 20px', color: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem'
              }}>
                <i className="fa-solid fa-robot"></i>
              </div>
              <div>
                <div style={{ fontWeight: '800', fontSize: '0.95rem' }}>SmartCart AI Assistant</div>
                <div style={{ fontSize: '0.72rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34D399', display: 'inline-block' }}></span>
                  Always online • Instant responses
                </div>
              </div>
            </div>
            <button onClick={() => setShowAIChat(false)} style={{
              background: 'rgba(255,255,255,0.15)', border: 'none', color: '#FFFFFF',
              width: '32px', height: '32px', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>✕</button>
          </div>

          {/* Chat Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
            background: '#F8FAFC', maxHeight: '420px', minHeight: '320px'
          }}>
            {aiMessages.map((msg, idx) => (
              <div key={idx} style={{
                display: 'flex', flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '88%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start'
              }}>
                <div style={{
                  background: msg.role === 'user' ? 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)' : '#FFFFFF',
                  color: msg.role === 'user' ? '#FFFFFF' : '#1E293B',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  padding: '12px 16px', fontSize: '0.88rem', lineHeight: '1.55',
                  boxShadow: msg.role === 'user' ? '0 2px 8px rgba(124, 58, 237, 0.3)' : '0 1px 4px rgba(0,0,0,0.06)',
                  border: msg.role === 'user' ? 'none' : '1px solid #E2E8F0',
                  whiteSpace: 'pre-wrap'
                }}>
                  {msg.text.split('**').map((part, i) =>
                    i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
                  )}
                </div>
                <span style={{ fontSize: '0.65rem', color: '#94A3B8', marginTop: '4px', padding: '0 4px' }}>
                  {msg.role === 'user' ? 'You' : '🤖 AI'} • {new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}

            {aiTyping && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
                background: '#FFFFFF', borderRadius: '16px 16px 16px 4px', alignSelf: 'flex-start',
                border: '1px solid #E2E8F0', maxWidth: '120px'
              }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{
                      width: '8px', height: '8px', borderRadius: '50%', background: '#7C3AED',
                      animation: `bounce 1.4s ease-in-out ${i * 0.16}s infinite both`, display: 'inline-block'
                    }}></span>
                  ))}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Suggestions */}
          <div style={{
            padding: '8px 16px', borderTop: '1px solid #E2E8F0', background: '#FFFFFF',
            display: 'flex', gap: '6px', overflowX: 'auto'
          }}>
            {['Check order status', 'Return process', 'Refund status', 'Track delivery'].map(q => (
              <button key={q} onClick={() => { setAiInput(q); }}
                style={{
                  background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '20px',
                  padding: '5px 12px', fontSize: '0.72rem', color: '#475569', cursor: 'pointer',
                  whiteSpace: 'nowrap', fontWeight: '600'
                }}
              >{q}</button>
            ))}
          </div>

          {/* Chat Input */}
          <div style={{
            padding: '12px 16px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '8px', background: '#FFFFFF'
          }}>
            <input
              type="text"
              placeholder="Type your question or Order ID..."
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAISend(); }}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: '10px', border: '2px solid #E2E8F0',
                fontSize: '0.88rem', outline: 'none', transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#7C3AED'}
              onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
            />
            <button onClick={handleAISend} disabled={aiTyping} style={{
              background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)', color: '#FFFFFF',
              border: 'none', borderRadius: '10px', width: '44px', fontSize: '1rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </div>
        </div>
      )}

      {/* Floating AI Chat Button (when chat is closed) */}
      {!showAIChat && (
        <button onClick={() => setShowAIChat(true)} style={{
          position: 'fixed', bottom: '24px', right: '24px', width: '60px', height: '60px',
          borderRadius: '50%', background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
          color: '#FFFFFF', border: 'none', fontSize: '1.4rem', cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(124, 58, 237, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, transition: 'transform 0.2s', animation: 'pulse 2s infinite'
        }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <i className="fa-solid fa-robot"></i>
        </button>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
