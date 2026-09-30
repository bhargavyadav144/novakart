import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useDeliveryAuth } from '../context/DeliveryAuthContext';
import DeliveryNotificationBell from './DeliveryNotificationBell';
import MobileConnectModal from './MobileConnectModal';

export default function DeliveryHeader() {
  const { agentUser, logout } = useDeliveryAuth();
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);

  return (
    <>
      <MobileConnectModal isOpen={isMobileModalOpen} onClose={() => setIsMobileModalOpen(false)} />
      <header className="delivery-nav">
        <div className="delivery-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" style={{ fontSize: '1.3rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-motorcycle" style={{ color: 'var(--agent-accent)' }}></i>
            <span>NovaKart <span style={{ color: 'var(--agent-accent)' }}>Fleet</span></span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <NavLink to="/" style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600' }}>Duty Radar</NavLink>
            <NavLink to="/active" style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600' }}>Active Order</NavLink>
            <NavLink to="/history" style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600' }}>History</NavLink>
            <NavLink to="/earnings" style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600' }}>Earnings</NavLink>
            <NavLink to="/profile" style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600' }}>Profile &amp; Security</NavLink>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setIsMobileModalOpen(true)}
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34D399',
                border: '1px solid #10B981',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Get Mobile Phone URL & QR Code"
            >
              <i className="fa-solid fa-mobile-screen"></i>
              <span>📱 Mobile URL</span>
            </button>

            <span style={{ fontSize: '0.85rem', color: '#94A3B8' }}>{agentUser?.fullName}</span>
            <DeliveryNotificationBell />
            <button onClick={logout} style={{ background: 'rgba(239,68,68,0.2)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.4)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}>
              Logout
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
