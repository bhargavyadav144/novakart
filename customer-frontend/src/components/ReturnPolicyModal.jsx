import React from 'react';

export default function ReturnPolicyModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '560px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
        border: '1px solid #E2E8F0'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: '#10B981',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem'
            }}>
              <i className="fa-solid fa-shield-halved"></i>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: '#FFFFFF' }}>
                7-Day Easy Return &amp; Exchange Policy
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                100% Buyer Protection &bull; Free Doorstep Pickup
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              fontSize: '1.5rem',
              cursor: 'pointer',
              lineHeight: 1
            }}
          >
            &times;
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '22px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Top Guarantee Card */}
          <div style={{
            background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
            border: '1px solid #BFDBFE',
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: '#2563EB',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem',
              flexShrink: 0
            }}>
              <i className="fa-solid fa-clock-rotate-left"></i>
            </div>
            <div>
              <h4 style={{ margin: '0 0 2px 0', fontSize: '0.96rem', fontWeight: '800', color: '#1E3A8A' }}>
                Hassle-Free 7-Day Window
              </h4>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#1E40AF', lineHeight: '1.4' }}>
                You have <b>7 full calendar days</b> from the time of doorstep delivery to request a complete refund or replacement for any item.
              </p>
            </div>
          </div>

          {/* Key Pillars Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px 14px', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <i className="fa-solid fa-truck-ramp-box" style={{ color: '#10B981', fontSize: '1.1rem' }}></i>
                <h5 style={{ margin: 0, fontSize: '0.86rem', fontWeight: '800', color: '#0F172A' }}>Free Doorstep Pickup</h5>
              </div>
              <p style={{ margin: 0, fontSize: '0.76rem', color: '#64748B', lineHeight: '1.4' }}>
                A verified delivery agent will visit your address to inspect and collect the parcel. No courier fees or drop-off required.
              </p>
            </div>

            <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px 14px', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <i className="fa-solid fa-bolt" style={{ color: '#F59E0B', fontSize: '1.1rem' }}></i>
                <h5 style={{ margin: 0, fontSize: '0.86rem', fontWeight: '800', color: '#0F172A' }}>Instant Wallet Refund</h5>
              </div>
              <p style={{ margin: 0, fontSize: '0.76rem', color: '#64748B', lineHeight: '1.4' }}>
                Choose Store Wallet for instant credit as soon as the courier scans the return, or original UPI/Card account (3-5 banking days).
              </p>
            </div>

            <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px 14px', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <i className="fa-solid fa-arrows-rotate" style={{ color: '#3B82F6', fontSize: '1.1rem' }}></i>
                <h5 style={{ margin: 0, fontSize: '0.86rem', fontWeight: '800', color: '#0F172A' }}>Easy Size &amp; Item Exchange</h5>
              </div>
              <p style={{ margin: 0, fontSize: '0.76rem', color: '#64748B', lineHeight: '1.4' }}>
                Need a different size or received a damaged piece? Swap for a replacement item with zero restocking or shipping charges.
              </p>
            </div>

            <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px 14px', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <i className="fa-solid fa-certificate" style={{ color: '#8B5CF6', fontSize: '1.1rem' }}></i>
                <h5 style={{ margin: 0, fontSize: '0.86rem', fontWeight: '800', color: '#0F172A' }}>Transparent Criteria</h5>
              </div>
              <p style={{ margin: 0, fontSize: '0.76rem', color: '#64748B', lineHeight: '1.4' }}>
                Items must be in original condition with brand tags, packaging, and accessories intact.
              </p>
            </div>
          </div>

          {/* Simple Step-by-Step Flow */}
          <div>
            <h4 style={{ fontSize: '0.88rem', fontWeight: '800', color: '#0F172A', marginBottom: '10px' }}>
              How Return &amp; Exchange Works:
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#0F172A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.74rem', fontWeight: '800', flexShrink: 0 }}>
                  1
                </span>
                <span style={{ fontSize: '0.8rem', color: '#334155' }}>
                  <b>Tap &ldquo;Return or Exchange&rdquo;</b> on your delivered order in Order History or Tracking page.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#0F172A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.74rem', fontWeight: '800', flexShrink: 0 }}>
                  2
                </span>
                <span style={{ fontSize: '0.8rem', color: '#334155' }}>
                  <b>Select the reason</b> (e.g. Defective, Size Issue, Wrong Item) and choose either <b>Refund</b> or <b>Exchange Replacement</b>.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#0F172A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.74rem', fontWeight: '800', flexShrink: 0 }}>
                  3
                </span>
                <span style={{ fontSize: '0.8rem', color: '#334155' }}>
                  <b>Doorstep Handover:</b> A delivery partner arrives to inspect the parcel and complete the pickup within 48 hours.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#10B981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.74rem', fontWeight: '800', flexShrink: 0 }}>
                  ✓
                </span>
                <span style={{ fontSize: '0.8rem', color: '#334155' }}>
                  <b>Instant Resolution:</b> Your refund is immediately credited to your wallet, or your replacement item is dispatched!
                </span>
              </div>
            </div>
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              background: '#0F172A',
              color: '#FFFFFF',
              fontWeight: '800',
              fontSize: '0.9rem',
              cursor: 'pointer',
              marginTop: '6px'
            }}
          >
            Understood &amp; Close Policy
          </button>
        </div>
      </div>
    </div>
  );
}
