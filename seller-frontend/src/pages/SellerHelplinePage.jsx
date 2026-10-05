import React, { useState, useEffect, useRef, useCallback } from 'react';
import sellerApi, { SOCKET_BASE_URL } from '../services/sellerApi';
import { io } from 'socket.io-client';
import { useSellerAuth } from '../context/SellerAuthContext';

export default function SellerHelplinePage() {
  const { sellerUser } = useSellerAuth();
  const [loading, setLoading] = useState(true);
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMsg, setInputMsg] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [linkWarning, setLinkWarning] = useState('');

  const messagesEndRef = useRef(null);

  const linkRegex = /(https?:\/\/|www\.[^\s]+|[a-zA-Z0-9-]+\.(com|in|org|net|co|io|biz|xyz|app|me|info|gov|edu)[^\s]*|wa\.me|t\.me|telegram\.me|bit\.ly|tinyurl|\b\d{10,}\b|\+?\d{1,3}[-.\s]?\d{10})/i;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchHelpline = useCallback(async () => {
    try {
      const { data } = await sellerApi.get('/sellers/helpline');
      if (data.success && data.thread) {
        setThread(data.thread);
        setMessages(data.thread.messages || []);
      }
    } catch (err) {
      console.error('Failed to load helpline thread:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to load helpline.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHelpline();

    const socket = io(SOCKET_BASE_URL);
    if (sellerUser?.id) {
      socket.emit('join_user_room', sellerUser.id);
    }

    socket.on('admin_helpline_reply', (payload) => {
      if (payload.newMsg) {
        setMessages((prev) => [...prev, payload.newMsg]);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [sellerUser, fetchHelpline]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputMsg(val);
    if (linkRegex.test(val)) {
      setLinkWarning('⚠️ Security Policy: Sharing links, redirection URLs, websites, and external contact numbers is strictly prohibited.');
    } else {
      setLinkWarning('');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;

    if (linkRegex.test(inputMsg)) {
      setErrorMsg('⚠️ Message blocked: External links or websites are prohibited.');
      return;
    }

    setSending(true);
    setErrorMsg('');

    try {
      const { data } = await sellerApi.post('/sellers/helpline/message', {
        message: inputMsg.trim(),
        priority
      });

      if (data.success) {
        setInputMsg('');
        setLinkWarning('');
        setMessages((prev) => [...prev, data.message]);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to send helpline query.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '16px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fa-solid fa-headset" style={{ color: '#1A237E' }}></i> Admin Helpline Desk
        </h1>
        <p style={{ color: '#64748B', fontSize: '0.88rem', margin: '4px 0 0' }}>
          Direct communication channel with NovaKart Platform Administration for KYC verification, store approval, product categories, and settlements.
        </p>
      </div>

      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        height: '680px',
        overflow: 'hidden'
      }}>
        {/* Status / Priority Header */}
        <div style={{
          padding: '14px 20px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#10b981',
              display: 'inline-block'
            }}></span>
            <span style={{ fontSize: '0.86rem', color: '#1e293b', fontWeight: '700' }}>
              Connected to NovaKart Operations Support
            </span>
            <span style={{
              fontSize: '0.72rem',
              background: '#EEF2FF',
              color: '#1A237E',
              padding: '2px 8px',
              borderRadius: '12px',
              fontWeight: '700'
            }}>
              Ticket: {thread?.status || 'OPEN'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Inquiry Urgency:</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              style={{
                fontSize: '0.8rem',
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                outline: 'none',
                background: '#fff'
              }}
            >
              <option value="NORMAL">Standard Query</option>
              <option value="HIGH">High Priority</option>
              <option value="URGENT">Urgent Escalation</option>
            </select>
          </div>
        </div>

        {/* Warnings */}
        {linkWarning && (
          <div style={{ background: '#fef3c7', color: '#92400e', padding: '8px 16px', fontSize: '0.78rem', borderBottom: '1px solid #fde68a' }}>
            {linkWarning}
          </div>
        )}
        {errorMsg && (
          <div style={{ background: '#fee2e2', color: '#dc2626', padding: '8px 16px', fontSize: '0.78rem', borderBottom: '1px solid #fecaca' }}>
            {errorMsg}
          </div>
        )}

        {/* Chat Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          background: '#f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.5rem', marginBottom: '8px', display: 'block' }}></i>
              Loading helpline messages...
            </div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              <i className="fa-solid fa-comments" style={{ fontSize: '2rem', marginBottom: '8px', display: 'block' }}></i>
              No messages yet. Send an inquiry below to chat with an Administrator.
            </div>
          ) : (
            messages.map((m, idx) => {
              const isMerchant = m.senderRole === 'seller';
              const isSystem = m.senderRole === 'system';

              if (isSystem) {
                return (
                  <div key={idx} style={{ textAlign: 'center', margin: '8px 0' }}>
                    <div style={{
                      display: 'inline-block',
                      background: '#e2e8f0',
                      color: '#475569',
                      padding: '6px 16px',
                      borderRadius: '12px',
                      fontSize: '0.76rem',
                      fontWeight: '600'
                    }}>
                      {m.message}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isMerchant ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div style={{
                    fontSize: '0.72rem',
                    color: '#64748b',
                    marginBottom: '2px',
                    padding: '0 4px'
                  }}>
                    {isMerchant ? 'You (Merchant)' : (m.senderName || 'Platform Administrator')} &bull; {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{
                    maxWidth: '75%',
                    padding: '12px 16px',
                    borderRadius: isMerchant ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                    background: isMerchant ? '#1A237E' : '#ffffff',
                    color: isMerchant ? '#ffffff' : '#0f172a',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    border: isMerchant ? 'none' : '1px solid #e2e8f0',
                    fontSize: '0.9rem',
                    lineHeight: '1.45',
                    wordBreak: 'break-word'
                  }}>
                    {m.message}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div style={{
          padding: '16px 20px',
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0'
        }}>
          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              placeholder="Ask Admin about store KYC review, product category approval, or settlements..."
              value={inputMsg}
              onChange={handleInputChange}
              disabled={sending}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '8px',
                border: linkWarning ? '1.5px solid #d97706' : '1.5px solid #cbd5e1',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={sending || !inputMsg.trim() || Boolean(linkWarning)}
              style={{
                background: linkWarning ? '#94a3b8' : '#1A237E',
                color: '#ffffff',
                border: 'none',
                padding: '0 24px',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '0.9rem',
                cursor: (linkWarning || !inputMsg.trim()) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {sending ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>}
              <span>Send</span>
            </button>
          </form>

          <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '8px', textAlign: 'center' }}>
            🛡️ Official NovaKart Merchant Helpline &bull; External URLs and contact sharing prohibited &bull; Responses dispatched in real time
          </div>
        </div>
      </div>
    </div>
  );
}
