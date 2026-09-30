import React from 'react';
import { NavLink } from 'react-router-dom';
import { useWarehouseAuth } from '../context/WarehouseAuthContext';

export default function WarehouseNavbar({ warehouse }) {
  const { managerUser, logout } = useWarehouseAuth();

  const managerInitials = managerUser?.name
    ? managerUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'MGR';

  return (
    <aside className="wh-sidebar" style={{
      width: '270px',
      background: '#0F172A',
      color: '#FFFFFF',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 0',
      borderRight: '1px solid rgba(255,255,255,0.08)',
      position: 'sticky',
      top: 0,
      height: '100vh',
      flexShrink: 0,
      alignSelf: 'flex-start',
      zIndex: 100
    }}>
      {/* Brand Header */}
      <div className="wh-brand" style={{ padding: '0 20px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className="wh-brand-logo" style={{
          width: '42px',
          height: '42px',
          background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justify: 'center',
          fontSize: '1.25rem',
          color: '#FFFFFF',
          boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
          flexShrink: 0
        }}>
          <i className="fa-solid fa-warehouse"></i>
        </div>
        <div>
          <div className="wh-brand-title" style={{ fontSize: '1.1rem', fontWeight: '800', color: '#FFFFFF', lineHeight: 1.2 }}>NovaKart Warehouse</div>
          <div className="wh-brand-subtitle" style={{ fontSize: '0.7rem', color: '#38BDF8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>HUB COMMAND CENTER</div>
        </div>
      </div>

      {/* Active Warehouse Facility Badge Card */}
      {warehouse && (
        <div style={{
          margin: '16px 14px',
          padding: '14px',
          background: 'rgba(59, 130, 246, 0.12)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: '800', color: '#93C5FD' }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: warehouse.status === 'active' ? '#10B981' : '#EF4444',
                boxShadow: warehouse.status === 'active' ? '0 0 8px #10B981' : 'none'
              }}></span>
              OPERATIONAL HUB
            </div>
            <span style={{
              background: warehouse.state === 'Andhra Pradesh' ? '#059669' : '#D97706',
              color: '#FFFFFF',
              fontSize: '0.65rem',
              padding: '2px 7px',
              borderRadius: '4px',
              fontWeight: '800'
            }}>
              {warehouse.state === 'Andhra Pradesh' ? 'AP' : 'TS'}
            </span>
          </div>

          <div style={{ fontWeight: '800', fontSize: '0.92rem', color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {warehouse.name}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#60A5FA', fontFamily: 'monospace', marginTop: '2px' }}>
            [{warehouse.code}]
          </div>
        </div>
      )}

      {/* Vertical Navigation Links */}
      <nav className="wh-nav-links" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 14px', flex: 1 }}>
        <NavLink to="/" end className={({ isActive }) => `wh-nav-link ${isActive ? 'active' : ''}`} style={navLinkStyle}>
          <i className="fa-solid fa-truck-ramp-box" style={{ width: '20px' }}></i> Hub Shipments
        </NavLink>

        <NavLink to="/scan-inbound" className={({ isActive }) => `wh-nav-link ${isActive ? 'active' : ''}`} style={navLinkStyle}>
          <i className="fa-solid fa-barcode" style={{ width: '20px', color: '#60A5FA' }}></i> Scan Inbound Parcels
        </NavLink>

        <NavLink to="/inventory" className={({ isActive }) => `wh-nav-link ${isActive ? 'active' : ''}`} style={navLinkStyle}>
          <i className="fa-solid fa-boxes-stacked" style={{ width: '20px' }}></i> Facility Capacity
        </NavLink>

        <NavLink to="/riders" className={({ isActive }) => `wh-nav-link ${isActive ? 'active' : ''}`} style={navLinkStyle}>
          <i className="fa-solid fa-motorcycle" style={{ width: '20px' }}></i> Fleet &amp; Riders
        </NavLink>

        <NavLink to="/fleet-map" className={({ isActive }) => `wh-nav-link ${isActive ? 'active' : ''}`} style={navLinkStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-map-location-dot" style={{ width: '20px', color: '#10B981' }}></i> Fleet Live Map
            </span>
            <span style={{
              background: '#065F46',
              color: '#34D399',
              fontSize: '0.62rem',
              fontWeight: '800',
              padding: '1px 5px',
              borderRadius: '4px'
            }}>LIVE</span>
          </div>
        </NavLink>

        <NavLink to="/returns" className={({ isActive }) => `wh-nav-link ${isActive ? 'active' : ''}`} style={navLinkStyle}>
          <i className="fa-solid fa-rotate-left" style={{ width: '20px' }}></i> Return QC &amp; Release
        </NavLink>
      </nav>

      {/* Facility Manager Profile & Exit Footer */}
      <div style={{ padding: '16px 14px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15, 23, 42, 0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #1E293B, #0F172A)',
            border: '2px solid #3B82F6',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justify: 'center',
            fontWeight: '800',
            fontSize: '0.95rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            flexShrink: 0
          }}>
            {managerInitials}
          </div>

          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontSize: '0.86rem', fontWeight: '800', color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {managerUser?.name || 'Venkat Rao'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>ID: <strong style={{ fontFamily: 'monospace', color: '#38BDF8' }}>{managerUser?.employeeId || 'MGR-AP-15'}</strong></span>
            </div>
            <div style={{ fontSize: '0.65rem', color: '#10B981', fontWeight: '700', marginTop: '1px' }}>
              ✓ Hub Director
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          style={{
            width: '100%',
            padding: '9px',
            background: 'rgba(239, 68, 68, 0.12)',
            color: '#F87171',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            fontSize: '0.8rem',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justify: 'center',
            gap: '8px',
            transition: 'background 0.2s'
          }}
        >
          <i className="fa-solid fa-right-from-bracket"></i> Exit Hub Command
        </button>
      </div>
    </aside>
  );
}

const navLinkStyle = ({ isActive }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  color: isActive ? '#FFFFFF' : '#94A3B8',
  background: isActive ? '#3B82F6' : 'transparent',
  padding: '11px 16px',
  borderRadius: '8px',
  fontWeight: isActive ? '800' : '600',
  fontSize: '0.88rem',
  textDecoration: 'none',
  transition: 'all 0.15s'
});
