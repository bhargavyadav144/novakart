import React, { useState, useEffect, useRef, useCallback } from 'react';
import adminApi, { SOCKET_BASE_URL } from '../services/adminApi';
import { io } from 'socket.io-client';

export default function AdminHelpline() {
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replyMsg, setReplyMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const messagesEndRef = useRef(null);

  const fetchThreads = useCallback(async () => {
    try {
      const { data } = await adminApi.get('/admin/helpline/threads');
      if (data.success) {
        setThreads(data.threads || []);
        if (selectedThread) {
          const updated = (data.threads || []).find(t => t._id === selectedThread._id);
          if (updated) setSelectedThread(updated);
        }
      }
    } catch (err) {
      console.error('Failed to fetch helpline threads:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedThread]);

  useEffect(() => {
    fetchThreads();

    const socket = io(SOCKET_BASE_URL);
    socket.emit('join_room', 'admin_room');

    socket.on('new_seller_helpline_message', (payload) => {
      fetchThreads();
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchThreads]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedThread?.messages]);

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyMsg.trim() || !selectedThread) return;

    setSending(true);
    setErrorMsg('');
    try {
      const sellerId = selectedThread.sellerId?._id || selectedThread.sellerId;
      const { data } = await adminApi.post(`/admin/helpline/${sellerId}/reply`, {
        message: replyMsg.trim()
      });

      if (data.success) {
        setReplyMsg('');
        fetchThreads();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const filteredThreads = threads.filter(t => {
    const term = search.toLowerCase();
    return (
      t.storeName?.toLowerCase().includes(term) ||
      t.ownerName?.toLowerCase().includes(term) ||
      t.subject?.toLowerCase().includes(term)
    );
  });

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.65rem', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fa-solid fa-headset" style={{ color: '#0EA5E9' }}></i> Merchant Helpline Desk
        </h1>
        <p style={{ color: '#64748B', fontSize: '0.88rem', margin: '4px 0 0' }}>
          Provide real-time administrative support to registered and onboarding merchants regarding KYC, catalogue permissions, logistics, and disbursals.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '20px', height: '720px' }}>
        {/* Left: Threads List */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '14px', borderBottom: '1px solid #E2E8F0' }}>
            <input
              type="text"
              placeholder="Search merchant store..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.85rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                <i className="fa-solid fa-spinner fa-spin"></i> Loading threads...
              </div>
            ) : filteredThreads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8' }}>
                <i className="fa-solid fa-inbox" style={{ fontSize: '2rem', marginBottom: '8px', display: 'block' }}></i>
                No active helpline inquiries found.
              </div>
            ) : (
              filteredThreads.map((t) => {
                const isSelected = selectedThread?._id === t._id;
                const lastMsg = t.messages?.[t.messages.length - 1];

                return (
                  <div
                    key={t._id}
                    onClick={() => setSelectedThread(t)}
                    style={{
                      padding: '14px 16px',
                      borderBottom: '1px solid #F1F5F9',
                      cursor: 'pointer',
                      background: isSelected ? '#EFF6FF' : '#ffffff',
                      borderLeft: isSelected ? '4px solid #0EA5E9' : '4px solid transparent',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '0.9rem', color: '#0F172A' }}>{t.storeName}</strong>
                      <span style={{
                        fontSize: '0.7rem',
                        background: t.priority === 'URGENT' ? '#FEE2E2' : (t.priority === 'HIGH' ? '#FEF3C7' : '#F1F5F9'),
                        color: t.priority === 'URGENT' ? '#DC2626' : (t.priority === 'HIGH' ? '#D97706' : '#475569'),
                        padding: '1px 6px',
                        borderRadius: '6px',
                        fontWeight: '700'
                      }}>
                        {t.priority}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {lastMsg ? `${lastMsg.senderName}: ${lastMsg.message}` : 'No messages'}
                    </div>

                    <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '4px' }}>
                      {new Date(t.lastMessageAt || t.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Selected Chat View */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {selectedThread ? (
            <>
              {/* Header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid #E2E8F0',
                background: '#F8FAFC',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: '#0F172A' }}>
                    {selectedThread.storeName}
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
                    Proprietor: <strong>{selectedThread.ownerName || 'Merchant'}</strong> &bull; Status: <span style={{ color: '#059669', fontWeight: '700' }}>{selectedThread.status}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    background: '#E0F2FE',
                    color: '#0284C7',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontWeight: '700'
                  }}>
                    Helpline Channel
                  </span>
                </div>
              </div>

              {/* Messages Body */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                background: '#F8FAFC',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {(selectedThread.messages || []).map((m, idx) => {
                  const isAdmin = m.senderRole === 'admin';
                  const isSystem = m.senderRole === 'system';

                  if (isSystem) {
                    return (
                      <div key={idx} style={{ textAlign: 'center', margin: '4px 0' }}>
                        <span style={{
                          display: 'inline-block',
                          background: '#E2E8F0',
                          color: '#475569',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '0.74rem'
                        }}>
                          {m.message}
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
                        alignItems: isAdmin ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div style={{ fontSize: '0.72rem', color: '#64748B', marginBottom: '2px', padding: '0 4px' }}>
                        {isAdmin ? 'You (Admin)' : m.senderName} &bull; {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{
                        maxWidth: '75%',
                        padding: '10px 14px',
                        borderRadius: isAdmin ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                        background: isAdmin ? '#0EA5E9' : '#FFFFFF',
                        color: isAdmin ? '#FFFFFF' : '#0F172A',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                        border: isAdmin ? 'none' : '1px solid #E2E8F0',
                        fontSize: '0.88rem',
                        lineHeight: '1.45',
                        wordBreak: 'break-word'
                      }}>
                        {m.message}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Input */}
              <div style={{ padding: '14px 18px', borderTop: '1px solid #E2E8F0', background: '#ffffff' }}>
                {errorMsg && (
                  <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', marginBottom: '8px' }}>
                    {errorMsg}
                  </div>
                )}
                <form onSubmit={handleSendReply} style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="Type official admin reply to merchant..."
                    value={replyMsg}
                    onChange={(e) => setReplyMsg(e.target.value)}
                    disabled={sending}
                    style={{
                      flex: 1,
                      padding: '11px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid #CBD5E1',
                      fontSize: '0.88rem',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="submit"
                    disabled={sending || !replyMsg.trim()}
                    style={{
                      background: '#0EA5E9',
                      color: '#ffffff',
                      border: 'none',
                      padding: '0 20px',
                      borderRadius: '8px',
                      fontWeight: '700',
                      fontSize: '0.88rem',
                      cursor: (sending || !replyMsg.trim()) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {sending ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>}
                    <span>Reply</span>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94A3B8', flexDirection: 'column' }}>
              <i className="fa-solid fa-comments" style={{ fontSize: '3rem', marginBottom: '12px' }}></i>
              <p style={{ margin: 0, fontSize: '0.95rem' }}>Select a merchant helpline inquiry from the left to view and reply</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
