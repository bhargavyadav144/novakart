import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { io } from 'socket.io-client';
import { SOCKET_BASE_URL } from '../services/api';
import { useAuth } from '../context/AuthContext';

const TYPE_ICONS = {
  ORDER_STATUS:      { icon: 'fa-box', color: '#3B82F6' },
  DELIVERY_DISPATCH: { icon: 'fa-truck-fast', color: '#10B981' },
  DELIVERY_OTP:      { icon: 'fa-key', color: '#F59E0B' },
  GIFT_CARD:         { icon: 'fa-gift', color: '#10B981' },
  SELLER_APPROVAL:   { icon: 'fa-store', color: '#8B5CF6' },
  AGENT_APPROVAL:    { icon: 'fa-id-badge', color: '#F59E0B' },
  PAYMENT:           { icon: 'fa-indian-rupee-sign', color: '#10B981' },
  PROMO:             { icon: 'fa-tag', color: '#EC4899' },
};

export default function NotificationBell({ theme = 'light' }) {
  const { user, token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('alerts'); // 'alerts', 'giftcards', 'otps', 'emails'
  const [copiedOtpId, setCopiedOtpId] = useState(null);
  const [copiedGiftCardId, setCopiedGiftCardId] = useState(null);
  const [selectedMail, setSelectedMail] = useState(null);
  const panelRef = useRef(null);
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch { /* silent */ }
  }, [token]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time socket listener
  useEffect(() => {
    if (!user?._id && !user?.id) return;
    const userId = user._id || user.id;
    const s = io(SOCKET_BASE_URL);
    s.emit('join_user_room', userId);
    s.on('new_notification', (notif) => {
      setNotifications(prev => [notif, ...prev]);
      setUnreadCount(prev => prev + 1);
    });
    return () => s.disconnect();
  }, [user]);

  // Close panel on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkRead = async (id) => {
    try { await api.put(`/notifications/${id}/read`); } catch { /* silent */ }
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async () => {
    try { await api.put('/notifications/read-all'); } catch { /* silent */ }
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try { await api.delete(`/notifications/${id}`); } catch { /* silent */ }
    const notif = notifications.find(n => n._id === id);
    setNotifications(prev => prev.filter(n => n._id !== id));
    if (notif && !notif.isRead) setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleClick = async (notif) => {
    if (!notif.isRead) await handleMarkRead(notif._id);
    setOpen(false);
    const isGiftCardNotif = notif.giftCardCode || notif.type === 'GIFT_CARD' || notif.title?.includes('Gift Card') || notif.title?.includes('GC-');
    if (isGiftCardNotif) {
      navigate('/profile?tab=rewards');
    } else if (notif.orderId) {
      navigate(`/orders/${notif.orderId}/track`);
    } else if (notif.link) {
      navigate(notif.link);
    } else {
      navigate('/orders');
    }
  };

  const handleCopyOtp = (e, otpCode, notifId) => {
    e.stopPropagation();
    if (!otpCode) return;
    navigator.clipboard.writeText(otpCode);
    setCopiedOtpId(notifId);
    setTimeout(() => setCopiedOtpId(null), 2500);
  };

  const handleCopyGiftCard = (e, cardCode, notifId) => {
    e.stopPropagation();
    if (!cardCode) return;
    navigator.clipboard.writeText(cardCode);
    setCopiedGiftCardId(notifId);
    setTimeout(() => setCopiedGiftCardId(null), 2500);
  };

  // Filter categories
  const giftCardNotifications = notifications.filter(n => n.giftCardCode || n.type === 'GIFT_CARD' || n.title?.includes('Gift Card') || n.title?.includes('GC-'));
  const otpNotifications = notifications.filter(n => n.otpCode || n.type === 'DELIVERY_OTP' || n.title?.includes('OTP'));
  const mailNotifications = notifications.filter(n => n.emailSent || n.emailSubject);

  const displayList = activeTab === 'giftcards'
    ? giftCardNotifications
    : activeTab === 'otps' 
      ? otpNotifications 
      : activeTab === 'emails' 
        ? mailNotifications 
        : notifications;

  const iconColor = theme === 'dark' ? '#fff' : '#fff';
  const badgeBg = '#EF4444';

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      {/* Bell Button */}
      <button
        id="notification-bell-btn"
        onClick={() => setOpen(!open)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', padding: '4px 6px', color: iconColor, fontSize: '1.25rem' }}
        title="Notifications & Delivery OTPs"
      >
        <i className="fa-solid fa-bell"></i>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '-2px', right: '-2px',
            background: badgeBg, color: '#fff', borderRadius: '50%',
            width: '18px', height: '18px', fontSize: '0.65rem', fontWeight: '800',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid transparent', lineHeight: 1
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 10px)',
          width: '420px', background: '#ffffff', borderRadius: '14px',
          boxShadow: '0 14px 45px rgba(0,0,0,0.22)', zIndex: 9999,
          border: '1px solid #e5e7eb', overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontWeight: '800', fontSize: '0.98rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-bell" style={{ color: '#3B82F6' }}></i>
                Notification Center
                {unreadCount > 0 && <span style={{ background: '#EF4444', color: '#fff', borderRadius: '10px', padding: '1px 7px', fontSize: '0.72rem' }}>{unreadCount} new</span>}
              </span>
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: '0.78rem', cursor: 'pointer', fontWeight: '700' }}>
                  Mark all read
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', background: '#e2e8f0', padding: '3px', borderRadius: '8px', gap: '3px' }}>
              <button
                onClick={() => { setActiveTab('alerts'); setSelectedMail(null); }}
                style={{
                  flex: 1, padding: '5px 0', border: 'none', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '700',
                  background: activeTab === 'alerts' ? '#ffffff' : 'transparent',
                  color: activeTab === 'alerts' ? '#1E40AF' : '#64748b',
                  cursor: 'pointer', transition: 'all 0.15s'
                }}
              >
                🔔 All ({notifications.length})
              </button>
              <button
                onClick={() => { setActiveTab('giftcards'); setSelectedMail(null); }}
                style={{
                  flex: 1, padding: '5px 0', border: 'none', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '700',
                  background: activeTab === 'giftcards' ? '#0F172A' : 'transparent',
                  color: activeTab === 'giftcards' ? '#F59E0B' : '#64748b',
                  cursor: 'pointer', transition: 'all 0.15s'
                }}
              >
                🎁 Cards ({giftCardNotifications.length})
              </button>
              <button
                onClick={() => { setActiveTab('otps'); setSelectedMail(null); }}
                style={{
                  flex: 1, padding: '5px 0', border: 'none', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '700',
                  background: activeTab === 'otps' ? '#ffffff' : 'transparent',
                  color: activeTab === 'otps' ? '#D97706' : '#64748b',
                  cursor: 'pointer', transition: 'all 0.15s'
                }}
              >
                🔑 OTPs ({otpNotifications.length})
              </button>
              <button
                onClick={() => { setActiveTab('emails'); setSelectedMail(null); }}
                style={{
                  flex: 1, padding: '5px 0', border: 'none', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '700',
                  background: activeTab === 'emails' ? '#ffffff' : 'transparent',
                  color: activeTab === 'emails' ? '#059669' : '#64748b',
                  cursor: 'pointer', transition: 'all 0.15s'
                }}
              >
                📧 Mail ({mailNotifications.length})
              </button>
            </div>
          </div>


          {/* List Content */}
          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            {/* Mail Modal Preview if Selected */}
            {selectedMail ? (
              <div style={{ padding: '16px', background: '#f8fafc' }}>
                <button
                  onClick={() => setSelectedMail(null)}
                  style={{ background: '#e2e8f0', border: 'none', color: '#334155', padding: '4px 10px', borderRadius: '6px', fontSize: '0.76rem', fontWeight: '700', cursor: 'pointer', marginBottom: '12px' }}
                >
                  ← Back to Mails
                </button>
                <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>
                    <strong>From:</strong> NovaKart Notifications &lt;no-reply@novakart.com&gt;
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '8px' }}>
                    <strong>To:</strong> {user?.email || 'customer@novakart.com'}
                  </div>
                  <h4 style={{ margin: '0 0 10px', fontSize: '0.92rem', color: '#0f172a', fontWeight: '800', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                    {selectedMail.emailSubject || selectedMail.title}
                  </h4>
                  <div style={{ fontSize: '0.84rem', color: '#334155', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
                    {selectedMail.emailBody || selectedMail.message}
                  </div>
                </div>
              </div>
            ) : displayList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                <i className="fa-regular fa-bell-slash" style={{ fontSize: '2rem', marginBottom: '10px', display: 'block' }}></i>
                <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: '600' }}>
                  {activeTab === 'otps' ? 'No OTPs received yet' : activeTab === 'emails' ? 'No emails sent yet' : 'No notifications yet'}
                </p>
              </div>
            ) : (
              displayList.map(notif => {
                const meta = TYPE_ICONS[notif.type] || TYPE_ICONS.ORDER_STATUS;
                const isOtpNotif = notif.otpCode || notif.type === 'DELIVERY_OTP';
                const isGiftCardNotif = notif.giftCardCode || notif.type === 'GIFT_CARD' || notif.title?.includes('GC-');
                const cardCode = notif.giftCardCode || (notif.title.match(/GC-[\w-]+/) || [])[0] || (notif.message.match(/GC-[\w-]+/) || [])[0];

                return (
                  <div
                    key={notif._id}
                    onClick={() => {
                      if (activeTab === 'emails') {
                        setSelectedMail(notif);
                      } else {
                        handleClick(notif);
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '12px',
                      padding: '12px 16px', cursor: 'pointer',
                      background: notif.isRead ? '#ffffff' : '#EFF6FF',
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background 0.15s',
                      position: 'relative'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = notif.isRead ? '#f8fafc' : '#DBEAFE'}
                    onMouseLeave={e => e.currentTarget.style.background = notif.isRead ? '#ffffff' : '#EFF6FF'}
                  >
                    {/* Icon */}
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '50%',
                      background: isGiftCardNotif ? '#0F172A' : isOtpNotif ? '#FEF3C7' : `${meta.color}1A`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, border: isGiftCardNotif ? '2px solid #F59E0B' : isOtpNotif ? '1px solid #F59E0B' : 'none',
                      color: isGiftCardNotif ? '#F59E0B' : isOtpNotif ? '#D97706' : meta.color
                    }}>
                      <i className={`fa-solid ${isGiftCardNotif ? 'fa-gift' : isOtpNotif ? 'fa-key' : meta.icon}`} style={{ fontSize: '0.9rem' }}></i>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: '0 0 2px', fontWeight: notif.isRead ? '600' : '800', fontSize: '0.86rem', color: '#0f172a' }}>
                        {notif.title}
                      </p>
                      <p style={{ margin: '0 0 6px', fontSize: '0.78rem', color: '#475569', lineHeight: '1.4' }}>
                        {notif.message}
                      </p>

                      {/* Interactive Scratch & Claim Callout for Gift Card Notifications */}
                      {(isGiftCardNotif || cardCode) && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          background: '#0F172A', border: '1px solid #F59E0B',
                          borderRadius: '8px', padding: '5px 12px', margin: '4px 0 6px',
                          boxShadow: '0 2px 8px rgba(15,23,42,0.3)',
                          color: '#FCD34D', fontSize: '0.78rem', fontWeight: '800'
                        }}>
                          <i className="fa-solid fa-gift" style={{ color: '#F59E0B' }}></i>
                          <span>✨ Tap to Scratch &amp; Claim Reward in Profile →</span>
                        </div>
                      )}

                      {/* Highlighted OTP Badge if present */}
                      {isOtpNotif && notif.otpCode && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '8px',
                          background: '#FEF3C7', border: '1px dashed #F59E0B',
                          borderRadius: '8px', padding: '4px 10px', margin: '4px 0 6px'
                        }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#92400E' }}>
                            OTP: <strong style={{ fontSize: '1.1rem', letterSpacing: '2px', color: '#B45309' }}>{notif.otpCode}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyOtp(e, notif.otpCode, notif._id)}
                            style={{
                              background: copiedOtpId === notif._id ? '#059669' : '#D97706',
                              color: '#fff', border: 'none', borderRadius: '4px',
                              padding: '2px 8px', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer'
                            }}
                          >
                            {copiedOtpId === notif._id ? '✓ Copied!' : '📋 Copy'}
                          </button>
                        </div>
                      )}


                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                          {new Date(notif.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {!notif.isRead && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3B82F6', display: 'inline-block' }}></span>}
                        {notif.emailSent && (
                          <span style={{ fontSize: '0.7rem', color: '#059669', background: '#D1FAE5', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                            📧 Email Sent
                          </span>
                        )}
                        {notif.link && !isGiftCardNotif && (
                          <span style={{ fontSize: '0.72rem', color: '#3B82F6', fontWeight: '700', marginLeft: 'auto' }}>→ View</span>
                        )}
                      </div>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={(e) => handleDelete(e, notif._id)}
                      style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '0.8rem', flexShrink: 0, padding: '2px 4px' }}
                      title="Remove notification"
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', textAlign: 'center', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>{notifications.length} notification{notifications.length !== 1 ? 's' : ''} total</span>
              <span style={{ fontSize: '0.76rem', color: '#059669', fontWeight: '700' }}>📧 Live Email Sync Active</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
