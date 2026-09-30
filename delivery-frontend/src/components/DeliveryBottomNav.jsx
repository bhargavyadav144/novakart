import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

export default function DeliveryBottomNav({ onOpenScanner, activeOrdersCount = 0 }) {
  const location = useLocation();

  return (
    <nav style={{
      height: '66px',
      minHeight: '66px',
      maxHeight: '66px',
      background: '#0F172A',
      borderTop: '1px solid #1E293B',
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      flexShrink: 0,
      zIndex: 1000,
      padding: '0 4px calc(4px + env(safe-area-inset-bottom, 0px)) 4px',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
      userSelect: 'none'
    }}>
      {/* BUTTON 1: Dedicated Orders List */}
      <NavLink
        to="/orders"
        title="Assigned Route Orders List"
        style={({ isActive }) => ({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
          flex: 1,
          padding: '6px 0',
          position: 'relative'
        })}
      >
        {({ isActive }) => (
          <>
            <div style={{
              width: '36px',
              height: '32px',
              borderRadius: '10px',
              background: isActive ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
              border: isActive ? '1.5px solid #38BDF8' : '1px solid transparent',
              color: isActive ? '#38BDF8' : '#94A3B8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.15rem',
              transition: 'all 0.2s ease',
              transform: isActive ? 'scale(1.05)' : 'none',
              position: 'relative'
            }}>
              <i className="fa-solid fa-boxes-stacked"></i>
              {activeOrdersCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-6px',
                  background: '#EF4444',
                  color: '#fff',
                  fontSize: '0.62rem',
                  fontWeight: '900',
                  minWidth: '16px',
                  height: '16px',
                  padding: '0 3px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #0F172A',
                  boxShadow: '0 0 6px rgba(239, 68, 68, 0.6)'
                }}>
                  {activeOrdersCount}
                </span>
              )}
            </div>
            <span style={{
              fontSize: '0.66rem',
              fontWeight: isActive ? '800' : '600',
              color: isActive ? '#38BDF8' : '#64748B',
              marginTop: '3px',
              letterSpacing: '-0.1px'
            }}>
              Orders
            </span>
          </>
        )}
      </NavLink>

      {/* BUTTON 2: Live Map & Live Tracking (like Rapido / Google Maps) */}
      <NavLink
        to="/map"
        title="Live Rapido/Google Maps Navigation & Submit Order"
        style={({ isActive }) => ({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
          flex: 1,
          padding: '6px 0',
          position: 'relative'
        })}
      >
        {({ isActive }) => (
          <>
            <div style={{
              width: '36px',
              height: '32px',
              borderRadius: '10px',
              background: isActive ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
              border: isActive ? '1.5px solid #10B981' : '1px solid transparent',
              color: isActive ? '#10B981' : '#94A3B8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.15rem',
              transition: 'all 0.2s ease',
              transform: isActive ? 'scale(1.05)' : 'none',
              position: 'relative'
            }}>
              <i className="fa-solid fa-map-location-dot"></i>
              {activeOrdersCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#10B981',
                  boxShadow: '0 0 6px #10B981'
                }}></span>
              )}
            </div>
            <span style={{
              fontSize: '0.66rem',
              fontWeight: isActive ? '800' : '600',
              color: isActive ? '#10B981' : '#64748B',
              marginTop: '3px',
              letterSpacing: '-0.1px'
            }}>
              Live Map
            </span>
          </>
        )}
      </NavLink>

      {/* BUTTON 3: Center Elevated Barcode Scanner */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 2px' }}>
        <button
          type="button"
          onClick={onOpenScanner}
          title="Scan Warehouse Package Barcode"
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
            border: '3px solid #0F172A',
            color: '#090D16',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.55)',
            transform: 'translateY(-8px)',
            transition: 'transform 0.15s ease'
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(-6px) scale(0.95)'; }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(-8px) scale(1)'; }}
        >
          <i className="fa-solid fa-barcode"></i>
        </button>
        <span style={{
          fontSize: '0.62rem',
          fontWeight: '700',
          color: '#10B981',
          marginTop: '-4px',
          letterSpacing: '-0.1px'
        }}>
          Scan
        </span>
      </div>

      {/* BUTTON 4: Earnings & Disbursals */}
      <NavLink
        to="/earnings"
        title="Earnings & Disbursals"
        style={({ isActive }) => ({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
          flex: 1,
          padding: '6px 0',
          position: 'relative'
        })}
      >
        {({ isActive }) => (
          <>
            <div style={{
              width: '36px',
              height: '32px',
              borderRadius: '10px',
              background: isActive ? 'rgba(251, 191, 36, 0.18)' : 'transparent',
              border: isActive ? '1.5px solid #FBBF24' : '1px solid transparent',
              color: isActive ? '#FBBF24' : '#94A3B8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
              transition: 'all 0.2s ease',
              transform: isActive ? 'scale(1.05)' : 'none'
            }}>
              <i className="fa-solid fa-wallet"></i>
            </div>
            <span style={{
              fontSize: '0.66rem',
              fontWeight: isActive ? '800' : '600',
              color: isActive ? '#FBBF24' : '#64748B',
              marginTop: '3px',
              letterSpacing: '-0.1px'
            }}>
              Earnings
            </span>
          </>
        )}
      </NavLink>

      {/* BUTTON 5: Delivery History */}
      <NavLink
        to="/history"
        title="Delivery History"
        style={({ isActive }) => ({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
          flex: 1,
          padding: '6px 0',
          position: 'relative'
        })}
      >
        {({ isActive }) => (
          <>
            <div style={{
              width: '36px',
              height: '32px',
              borderRadius: '10px',
              background: isActive ? 'rgba(168, 85, 247, 0.18)' : 'transparent',
              border: isActive ? '1.5px solid #A855F7' : '1px solid transparent',
              color: isActive ? '#A855F7' : '#94A3B8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
              transition: 'all 0.2s ease',
              transform: isActive ? 'scale(1.05)' : 'none'
            }}>
              <i className="fa-solid fa-clock-rotate-left"></i>
            </div>
            <span style={{
              fontSize: '0.66rem',
              fontWeight: isActive ? '800' : '600',
              color: isActive ? '#A855F7' : '#64748B',
              marginTop: '3px',
              letterSpacing: '-0.1px'
            }}>
              History
            </span>
          </>
        )}
      </NavLink>
    </nav>
  );
}
