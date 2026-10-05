import React, { useState, useEffect, useRef, useCallback } from 'react';
import api, { SOCKET_BASE_URL } from '../services/api';
import { io } from 'socket.io-client';

export default function CustomerOrderChatModal({ orderId, isOpen, onClose }) {
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState(null);
  const [chatData, setChatData] = useState(null);
  const [chatStatus, setChatStatus] = useState(null);
  const [counterparty, setCounterparty] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMsg, setInputMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [extending, setExtending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [linkWarning, setLinkWarning] = useState('');

  const messagesEndRef = useRef(null);

  const linkRegex = /(https?:\/\/|www\.[^\s]+|[a-zA-Z0-9-]+\.(com|in|org|net|co|io|biz|xyz|app|me|info|gov|edu)[^\s]*|wa\.me|t\.me|telegram\.me|bit\.ly|tinyurl|\b\d{10,}\b|\+?\d{1,3}[-.\s]?\d{10})/i;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChat = useCallback(async () => {
    if (!orderId) return;
    try {
      const { data } = await api.get(`/orders/${orderId}/chat`);
      if (data.success) {
        setChatData(data.chat);
        setChatStatus(data.chatStatus);
        setOrderData(data.order);
        setCounterparty(data.counterparty);
        setMessages(data.chat?.messages || []);
      }
    } catch (err) {
      console.error('Failed to load order chat:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to load order chat.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (isOpen && orderId) {
      setLoading(true);
      setErrorMsg('');
      setLinkWarning('');
      fetchChat();

      const socket = io(SOCKET_BASE_URL);
      socket.emit('join_room', `order_${orderId}`);

      socket.on('new_order_chat_message', (payload) => {
        if (payload.orderId === orderId && payload.message) {
          setMessages((prev) => [...prev, payload.message]);
          if (payload.chatStatus) setChatStatus(payload.chatStatus);
        }
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [isOpen, orderId, fetchChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputMsg(val);
    if (linkRegex.test(val)) {
      setLinkWarning('⚠️ Security Warning: External website links, URLs, and phone numbers are prohibited. Only plain text customer service is permitted.');
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

    if (chatStatus?.isExpired) {
      setErrorMsg('⚠️ Chat is closed: The post-delivery return window has expired.');
      return;
    }

    setSending(true);
    setErrorMsg('');

    try {
      const { data } = await api.post(`/orders/${orderId}/chat`, {
        message: inputMsg.trim()
      });

      if (data.success) {
        setInputMsg('');
        setLinkWarning('');
        setMessages((prev) => [...prev, data.message]);
        if (data.chatStatus) setChatStatus(data.chatStatus);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleRequestExchange = async () => {
    if (!window.confirm('Request product exchange extension? This grants 7 extra days to coordinate replacement or return with the seller.')) {
      return;
    }

    setExtending(true);
    setErrorMsg('');
    try {
      const { data } = await api.post(`/orders/${orderId}/chat/exchange-extension`);
      if (data.success) {
        alert('✅ 7 Additional Days Granted! Your post-delivery exchange window has been extended.');
        fetchChat();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to extend exchange window.');
    } finally {
      setExtending(false);
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
        maxWidth: '660px',
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
          background: '#131921',
          color: '#ffffff',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: '800' }}>Order #{orderData?.orderNumber || '...'}</span>
              <span style={{
                fontSize: '0.72rem',
                background: orderData?.orderStatus === 'DELIVERED' ? '#10b981' : '#ff9900',
                color: '#fff',
                padding: '2px 8px',
                borderRadius: '12px',
                fontWeight: '700'
              }}>
                {orderData?.orderStatus || 'PENDING'}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>
              Seller: <strong>{counterparty?.seller?.storeName || 'Merchant Store'}</strong> &bull; Verified Proprietor
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.25rem',
              cursor: 'pointer',
              padding: '6px'
            }}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* 7-Day Window Status Banner */}
        <div style={{
          padding: '10px 16px',
          background: chatStatus?.isExpired ? '#fee2e2' : (chatStatus?.stage === 'POST_DELIVERY_ACTIVE' ? '#ecfdf5' : '#eff6ff'),
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
            <i className={`fa-solid ${chatStatus?.isExpired ? 'fa-lock' : 'fa-clock'}`}
               style={{ color: chatStatus?.isExpired ? '#dc2626' : (chatStatus?.stage === 'POST_DELIVERY_ACTIVE' ? '#059669' : '#2563eb') }}></i>
            <span style={{ color: chatStatus?.isExpired ? '#991b1b' : '#1e293b' }}>
              <strong>{chatStatus?.statusLabel || 'Checking Window...'}</strong> &bull; {chatStatus?.message}
            </span>
          </div>

          {chatStatus?.canRequestExchange && orderData?.orderStatus === 'DELIVERED' && (
            <button
              onClick={handleRequestExchange}
              disabled={extending}
              style={{
                background: '#ff9900',
                color: '#131921',
                border: 'none',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title="Add 7 extra days for product return/exchange coordination"
            >
              <i className="fa-solid fa-arrows-rotate"></i>
              {extending ? 'Extending...' : 'Request Exchange (+7 Days)'}
            </button>
          )}
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
          padding: '16px',
          background: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.5rem', marginBottom: '8px', display: 'block' }}></i>
              Loading chat...
            </div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              <i className="fa-regular fa-comments" style={{ fontSize: '2rem', marginBottom: '8px', display: 'block' }}></i>
              No messages yet. Send a message to the seller regarding this order.
            </div>
          ) : (
            messages.map((m, idx) => {
              const isMe = m.senderRole === 'customer';
              const isSystem = m.senderRole === 'system';

              if (isSystem) {
                return (
                  <div key={idx} style={{ textAlign: 'center', margin: '8px 0' }}>
                    <div style={{
                      display: 'inline-block',
                      background: '#e2e8f0',
                      color: '#475569',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '0.74rem',
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
                    alignItems: isMe ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div style={{
                    fontSize: '0.72rem',
                    color: '#64748b',
                    marginBottom: '2px',
                    padding: '0 4px'
                  }}>
                    {isMe ? 'You' : `${m.senderName || 'Seller'} (Merchant)`} &bull; {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{
                    maxWidth: '75%',
                    padding: '10px 14px',
                    borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                    background: isMe ? '#2563eb' : '#ffffff',
                    color: isMe ? '#ffffff' : '#0f172a',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    border: isMe ? 'none' : '1px solid #e2e8f0',
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
          padding: '14px 16px',
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0'
        }}>
          {chatStatus?.isExpired ? (
            <div style={{
              background: '#f1f5f9',
              padding: '12px',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#64748b',
              fontSize: '0.84rem'
            }}>
              <i className="fa-solid fa-lock" style={{ marginRight: '6px' }}></i>
              Chat closed: The 7-day post-delivery service window for this order has expired.
            </div>
          ) : (
            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder="Message the merchant (plain text only, no links)..."
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
                  background: linkWarning ? '#94a3b8' : '#2563eb',
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
          )}

          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '6px', textAlign: 'center' }}>
            🛡️ NovaKart Security: Only plain-text customer support permitted. Links and redirects are blocked.
          </div>
        </div>
      </div>
    </div>
  );
}
