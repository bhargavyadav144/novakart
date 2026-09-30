import React from 'react';

export default function ProximityDeliveryAlertModal({
  isOpen,
  order,
  stopIndex = 0,
  onTrackDeliver,
  onCallCustomer,
  onDeliverLater
}) {
  if (!isOpen || !order) return null;

  const addressStr = order.deliveryAddress
    ? `${order.deliveryAddress.street}, ${order.deliveryAddress.city}`
    : 'Customer Address';

  const isCOD = order.paymentMethod === 'Cash on Delivery (COD)' || order.paymentMethod === 'COD';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(9, 13, 22, 0.94)',
      backdropFilter: 'blur(10px)',
      color: '#FFFFFF',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      animation: 'proximityFadeIn 0.25s ease-out'
    }}>
      <style>{`
        @keyframes proximityFadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes pulseYellowGlow {
          0% { box-shadow: 0 0 0 0 rgba(234, 179, 8, 0.7); }
          70% { box-shadow: 0 0 0 20px rgba(234, 179, 8, 0); }
          100% { box-shadow: 0 0 0 0 rgba(234, 179, 8, 0); }
        }
      `}</style>

      <div style={{
        background: '#0F172A',
        border: '2px solid #EAB308',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '460px',
        overflow: 'hidden',
        boxShadow: '0 25px 60px -15px rgba(234, 179, 8, 0.4)',
        display: 'flex',
        flexDirection: 'column'
      }}>

        {/* ─── 1. TOP PULSING HEADER BANNER ─── */}
        <div style={{
          background: 'linear-gradient(135deg, #CA8A04 0%, #A16207 100%)',
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          color: '#FFFFFF'
        }}>
          <div style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            background: '#FEF08A',
            color: '#854D0E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.6rem',
            animation: 'pulseYellowGlow 1.5s infinite',
            flexShrink: 0
          }}>
            <i className="fa-solid fa-location-dot"></i>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', color: '#FEF08A' }}>
              📍 LIVE PROXIMITY ALERT &bull; STOP #{stopIndex + 1}
            </div>
            <h2 style={{ margin: '2px 0 0 0', fontSize: '1.2rem', fontWeight: '900', color: '#FFFFFF' }}>
              You are near customer location!
            </h2>
          </div>
        </div>

        {/* ─── 2. ORDER & CUSTOMER DETAILS ─── */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          <div style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.74rem', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' }}>
                Order #{order.orderNumber}
              </span>
              <span style={{
                fontSize: '0.74rem',
                fontWeight: '800',
                padding: '4px 10px',
                borderRadius: '12px',
                background: isCOD ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                color: isCOD ? '#FBBF24' : '#6EE7B7',
                border: isCOD ? '1px solid #F59E0B' : '1px solid #10B981'
              }}>
                {isCOD ? `Collect COD: ₹${order.totalAmount}` : 'PREPAID ONLINE'}
              </span>
            </div>

            <div>
              <div style={{ fontSize: '1.15rem', fontWeight: '900', color: '#FFFFFF' }}>
                👤 {order.deliveryAddress?.fullName || 'Customer'}
              </div>
              <div style={{ fontSize: '0.86rem', color: '#CBD5E1', marginTop: '4px', lineHeight: '1.4' }}>
                📍 {addressStr}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#94A3B8', marginTop: '4px' }}>
                📞 <strong>{order.deliveryAddress?.phone || 'N/A'}</strong>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.78rem', color: '#94A3B8', textAlign: 'center', background: 'rgba(234, 179, 8, 0.1)', border: '1px dashed rgba(234, 179, 8, 0.3)', padding: '8px 12px', borderRadius: '10px' }}>
            💡 You have reached the customer stop on your route. Tap <strong>Track / Deliver</strong> to scan package barcode and handover.
          </div>

          {/* ─── 3. ACTION BUTTONS ─── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>

            {/* ACTION 1: TRACK & DELIVER THIS ORDER */}
            <button
              type="button"
              onClick={onTrackDeliver}
              style={{
                background: 'linear-gradient(135deg, #EAB308 0%, #CA8A04 100%)',
                color: '#0F172A',
                border: 'none',
                padding: '16px',
                borderRadius: '14px',
                fontSize: '1rem',
                fontWeight: '900',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: '0 4px 20px rgba(234, 179, 8, 0.45)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              <i className="fa-solid fa-box-open" style={{ fontSize: '1.2rem' }}></i> Track &amp; Deliver This Order
            </button>

            {/* ACTION 2: CALL CUSTOMER */}
            <button
              type="button"
              onClick={onCallCustomer}
              style={{
                background: 'rgba(37, 99, 235, 0.2)',
                border: '1px solid #2563EB',
                color: '#60A5FA',
                padding: '14px',
                borderRadius: '14px',
                fontSize: '0.92rem',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <i className="fa-solid fa-phone"></i> Call Customer Before Handover
            </button>

            {/* ACTION 3: DELIVER LATER / SKIP */}
            <button
              type="button"
              onClick={onDeliverLater}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#94A3B8',
                padding: '12px',
                borderRadius: '14px',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              <i className="fa-solid fa-clock-rotate-left"></i> Deliver Later / Continue Route
            </button>

          </div>
        </div>

      </div>
    </div>
  );
}
