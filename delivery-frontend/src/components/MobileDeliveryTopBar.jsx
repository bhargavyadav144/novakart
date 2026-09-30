import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDeliveryAuth } from '../context/DeliveryAuthContext';
import DeliveryNotificationBell from './DeliveryNotificationBell';
import MobileConnectModal from './MobileConnectModal';

export default function MobileDeliveryTopBar() {
  const { agentUser, logout } = useDeliveryAuth() || {};
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const isOnline = !!agentUser?.isOnline;
  const avatarImg = agentUser?.profileImage || agentUser?.faceVerificationPhoto || agentUser?.avatar;
  const initial = (agentUser?.fullName || agentUser?.name || 'A').charAt(0).toUpperCase();

  return (
    <>
      <MobileConnectModal isOpen={isMobileModalOpen} onClose={() => setIsMobileModalOpen(false)} />
      <header style={{
        height: '56px',
        minHeight: '56px',
        maxHeight: '56px',
        padding: '0 16px',
        background: '#0F172A',
        borderBottom: '1px solid #1E293B',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
        zIndex: 1000,
        color: '#FFFFFF'
      }}>
        {/* Brand & Duty Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', textDecoration: 'none' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: '#090D16',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
              fontWeight: '900'
            }}>
              <i className="fa-solid fa-motorcycle"></i>
            </div>
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: '900', letterSpacing: '-0.2px' }}>
                Nova<span style={{ color: '#10B981' }}>Fleet</span>
              </div>
              <div style={{ fontSize: '0.64rem', color: isOnline ? '#34D399' : '#EF4444', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '-2px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isOnline ? '#10B981' : '#EF4444', boxShadow: `0 0 6px ${isOnline ? '#10B981' : '#EF4444'}` }}></span>
                {isOnline ? 'DUTY ONLINE' : 'OFF DUTY'}
              </div>
            </div>
          </Link>
        </div>

        {/* Right Controls: Mobile URL button, Notifications & Profile / Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setIsMobileModalOpen(true)}
            style={{
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#34D399',
              border: '1px solid #10B981',
              padding: '5px 9px',
              borderRadius: '8px',
              fontSize: '0.72rem',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
            title="Get Mobile Phone URL & QR Code"
          >
            <i className="fa-solid fa-mobile-screen"></i>
            <span>Mobile URL</span>
          </button>

          <DeliveryNotificationBell />
        <Link
          to="/profile"
          style={{
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title={agentUser?.fullName || 'Rider Profile'}
        >
          {avatarImg ? (
            <img
              src={avatarImg}
              alt="Profile"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid #10B981'
              }}
            />
          ) : (
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '900',
              fontSize: '0.88rem',
              border: '2px solid #3B82F6',
              boxShadow: '0 2px 8px rgba(37,99,235,0.35)'
            }}>
              {initial}
            </div>
          )}
        </Link>
        <button
          onClick={logout}
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#F87171',
            border: 'none',
            width: '30px',
            height: '30px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '0.78rem'
          }}
          title="Logout"
        >
          <i className="fa-solid fa-arrow-right-from-bracket"></i>
        </button>
      </div>
    </header>
    </>
  );
}
