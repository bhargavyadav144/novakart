import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSellerAuth } from '../context/SellerAuthContext';
import SellerNotificationBell from './SellerNotificationBell';

export default function SellerSidebar() {
  const { sellerUser, logout } = useSellerAuth();
  const isApproved = Boolean(sellerUser?.isApproved);

  return (
    <aside className="seller-sidebar">
      <div className="seller-brand">
        <i className="fa-solid fa-store" style={{ color: 'var(--seller-accent)' }}></i>
        <span>Merchant</span> Hub
      </div>

      <div style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.05)', margin: '14px', borderRadius: '10px' }}>
        <p style={{ fontSize: '0.74rem', color: '#94A3B8', textTransform: 'uppercase', margin: 0, letterSpacing: '0.5px' }}>Active Store</p>
        <p style={{ fontWeight: '800', fontSize: '0.96rem', color: '#fff', margin: '4px 0' }}>{sellerUser?.storeName || 'My Store'}</p>
        <span style={{
          fontSize: '0.72rem',
          background: isApproved ? '#10B981' : '#F59E0B',
          color: '#fff',
          padding: '2px 8px',
          borderRadius: '4px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontWeight: '700'
        }}>
          <i className={`fa-solid ${isApproved ? 'fa-circle-check' : 'fa-clock-rotate-left'}`}></i>
          {isApproved ? 'Verified Merchant' : 'KYC Under Review'}
        </span>
      </div>

      <nav className="seller-nav">
        {/* Verification Hub: Always accessible, prominent when pending */}
        <NavLink to="/verification" style={{ background: !isApproved ? 'rgba(217, 119, 6, 0.15)' : undefined, color: !isApproved ? '#fbbf24' : undefined }}>
          <i className="fa-solid fa-shield-halved"></i>
          <span>Verification Hub</span>
          {!isApproved && <span style={{ marginLeft: 'auto', fontSize: '0.68rem', background: '#d97706', color: '#fff', padding: '1px 6px', borderRadius: '8px' }}>Action</span>}
        </NavLink>

        {/* Operational Real Portal Links (Unlocked on Admin Approval) */}
        <NavLink to="/" end>
          <i className="fa-solid fa-chart-line"></i>
          <span>Dashboard</span>
          {!isApproved && <i className="fa-solid fa-lock" style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#64748b' }}></i>}
        </NavLink>

        <NavLink to="/products">
          <i className="fa-solid fa-boxes-stacked"></i>
          <span>Products Inventory</span>
          {!isApproved && <i className="fa-solid fa-lock" style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#64748b' }}></i>}
        </NavLink>

        <NavLink to="/products/new">
          <i className="fa-solid fa-circle-plus"></i>
          <span>Add New Product</span>
          {!isApproved && <i className="fa-solid fa-lock" style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#64748b' }}></i>}
        </NavLink>

        <NavLink to="/orders">
          <i className="fa-solid fa-receipt"></i>
          <span>Store Orders</span>
          {!isApproved && <i className="fa-solid fa-lock" style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#64748b' }}></i>}
        </NavLink>

        <NavLink to="/payouts">
          <i className="fa-solid fa-building-columns"></i>
          <span>Settlements &amp; Payouts</span>
          {!isApproved && <i className="fa-solid fa-lock" style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#64748b' }}></i>}
        </NavLink>

        {/* Support & Admin Helpline */}
        <NavLink to="/helpline">
          <i className="fa-solid fa-headset"></i>
          <span>Admin Helpline</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.65rem', background: '#1A237E', color: '#fff', padding: '1px 5px', borderRadius: '6px' }}>Help</span>
        </NavLink>

        <NavLink to="/profile">
          <i className="fa-solid fa-shop"></i>
          <span>Store Settings</span>
        </NavLink>

        <NavLink to="/terms">
          <i className="fa-solid fa-file-contract"></i>
          <span>Terms &amp; Policies</span>
        </NavLink>

        <a href="http://localhost:3000" target="_blank" rel="noreferrer">
          <i className="fa-solid fa-arrow-up-right-from-square"></i>
          <span>Customer Store</span>
        </a>
      </nav>

      <SellerNotificationBell />

      <div style={{ padding: '20px 14px' }}>
        <button onClick={logout} style={{ width: '100%', background: 'rgba(239,68,68,0.2)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.4)', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
          <i className="fa-solid fa-right-from-bracket"></i> Sign Out
        </button>
      </div>
    </aside>
  );
}
