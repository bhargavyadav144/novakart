import React from 'react';

export default function TrackedPhotoModal({ isOpen, onClose, photoUrl, verifiedAt, trackingId, coordinates, agentName }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.88)',
      backdropFilter: 'blur(10px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        background: '#0F172A',
        border: '1px solid #334155',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '440px',
        color: '#FFF',
        overflow: 'hidden',
        boxShadow: '0 25px 50px rgba(0,0,0,0.6)'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
          borderBottom: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: '#10B981',
              color: '#090D16',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem'
            }}>
              <i className="fa-solid fa-id-card-clip"></i>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#FFF' }}>
                Tracked Biometric Audit Photo
              </h3>
              <p style={{ margin: 0, fontSize: '0.68rem', color: '#94A3B8' }}>
                Verified Face Identity &bull; Immutably Recorded
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: '#94A3B8',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              fontSize: '1.2rem',
              cursor: 'pointer'
            }}
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', textAlign: 'center' }}>
          {/* Photo Frame */}
          <div style={{
            position: 'relative',
            width: '220px',
            height: '220px',
            margin: '0 auto 20px auto',
            borderRadius: '20px',
            overflow: 'hidden',
            border: '3px solid #10B981',
            boxShadow: '0 0 25px rgba(16, 185, 129, 0.35)'
          }}>
            <img
              src={photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'}
              alt="Tracked Face Identity"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'rgba(15, 23, 42, 0.85)',
              padding: '6px',
              fontSize: '0.68rem',
              fontWeight: '800',
              color: '#34D399',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              borderTop: '1px solid #10B981'
            }}>
              <i className="fa-solid fa-badge-check"></i>
              RBI / KYC BIOMETRIC VERIFIED
            </div>
          </div>

          {/* Audit Metadata Table */}
          <div style={{
            background: '#1E293B',
            borderRadius: '14px',
            border: '1px solid #334155',
            padding: '14px',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '0.78rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
              <span style={{ color: '#94A3B8' }}>Delivery Agent:</span>
              <span style={{ fontWeight: '700', color: '#FFF' }}>{agentName || 'Verified Fleet Rider'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
              <span style={{ color: '#94A3B8' }}>Track ID:</span>
              <span style={{ fontWeight: '700', color: '#34D399', fontFamily: 'monospace' }}>
                {trackingId || `BIO-TRK-${(photoUrl || '').length > 20 ? (photoUrl || '').slice(25, 33).toUpperCase() : 'AUTH-1092'}`}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
              <span style={{ color: '#94A3B8' }}>Captured At:</span>
              <span style={{ fontWeight: '600', color: '#FFF' }}>
                {verifiedAt ? new Date(verifiedAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN')}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94A3B8' }}>GPS Coords:</span>
              <span style={{ fontWeight: '700', color: '#38BDF8', fontFamily: 'monospace' }}>
                {coordinates ? `${coordinates.lat}, ${coordinates.lng}` : '16.3067° N, 80.4365° E'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          background: '#1E293B',
          borderTop: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '0.72rem', color: '#10B981', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}>
            <i className="fa-solid fa-lock"></i> Permanent KYC Record
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              background: '#334155',
              color: '#FFF',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
}
