import React, { useState, useEffect, useRef, useCallback } from 'react';
import sellerApi, { SOCKET_BASE_URL } from '../services/sellerApi';
import { io } from 'socket.io-client';
import { useSellerAuth } from '../context/SellerAuthContext';

export default function AdminHelplineModal({ isOpen, onClose }) {
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
    if (isOpen) {
      setLoading(true);
      setErrorMsg('');
      setLinkWarning('');
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
    }
  }, [isOpen, sellerUser, fetchHelpline]);

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

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '16px'
    }}>
      <div style={{
        background: '#ffffff',
        width: '100%',
        maxWidth: '680px',
        height: '88vh',
        maxHeight: '740px',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          background: '#0f766e',
          color: '#ffffff',
          padding: '18px 22px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.15rem', fontWeight: '800' }}>
                <i className="fa-solid fa-headset" style={{ marginRight: '6px' }}></i> NovaKart Admin Helpline
              </span>
              <span style={{
                fontSize: '0.72rem',
                background: '#14b8a6',
                color: '#fff',
                padding: '2px 8px',
                borderRadius: '12px',
                fontWeight: '700'
              }}>
                Direct Admin Desk
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#ccfbf1' }}>
              Inquiries regarding KYC clearance, category approvals, payments &amp; catalog support
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              color: '#ffffff',
              fontSize: '1.1rem',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Priority Filter Bar */}
        <div style={{
          padding: '10px 18px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Store: <strong>{sellerUser?.storeName || 'My Store'}</strong> &bull; Status: <strong style={{ color: '#0f766e' }}>{thread?.status || 'ACTIVE'}</strong>
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.76rem', color: '#64748b' }}>Priority:</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              style={{
                fontSize: '0.76rem',
                padding: '3px 8px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                outline: 'none'
              }}
            >
              <option value="NORMAL">Normal Query</option>
              <option value="HIGH">High Priority</option>
              <option value="URGENT">Urgent Help</option>
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

        {/* Messages Body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '18px',
          background: '#f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.5rem', marginBottom: '8px', display: 'block' }}></i>
              Connecting to Admin Helpline...
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
                  <div key={idx} style={{ textAlign: 'center', margin: '6px 0' }}>
                    <div style={{
                      display: 'inline-block',
                      background: '#e2e8f0',
                      color: '#475569',
                      padding: '5px 14px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
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
                    {isMerchant ? 'You (Merchant)' : (m.senderName || 'Platform Admin')} &bull; {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{
                    maxWidth: '75%',
                    padding: '10px 14px',
                    borderRadius: isMerchant ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                    background: isMerchant ? '#0f766e' : '#ffffff',
                    color: isMerchant ? '#ffffff' : '#0f172a',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    border: isMerchant ? 'none' : '1px solid #e2e8f0',
                    fontSize: '0.88rem',
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
          padding: '14px 18px',
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0'
        }}>
          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              placeholder="Ask Admin about KYC clearance, product category approval, or account queries..."
              value={inputMsg}
              onChange={handleInputChange}
              disabled={sending}
              style={{
                flex: 1,
                padding: '11px 14px',
                borderRadius: '8px',
                border: linkWarning ? '1.5px solid #d97706' : '1.5px solid #cbd5e1',
                fontSize: '0.88rem',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={sending || !inputMsg.trim() || Boolean(linkWarning)}
              style={{
                background: linkWarning ? '#94a3b8' : '#0f766e',
                color: '#ffffff',
                border: 'none',
                padding: '0 20px',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '0.88rem',
                cursor: (linkWarning || !inputMsg.trim()) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {sending ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>}
              <span>Send</span>
            </button>
          </form>

          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '6px', textAlign: 'center' }}>
            🛡️ Official NovaKart Merchant Helpline &bull; External URLs and contact sharing prohibited.
          </div>
        </div>
      </div>
    </div>
  );
}
