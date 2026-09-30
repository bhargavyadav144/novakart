import React, { useState } from 'react';

export default function MobileConnectModal({ isOpen, onClose }) {
  const [copied, setCopied] = useState(false);
  const defaultIp = '172.16.49.17';
  const port = '3002';
  const [mobileIp, setMobileIp] = useState(defaultIp);

  if (!isOpen) return null;

  const mobileUrl = `http://${mobileIp}:${port}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(mobileUrl)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(mobileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

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
        color: '#F8FAFC',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
          borderBottom: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: '#10B981',
              color: '#090D16',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem'
            }}>
              <i className="fa-solid fa-mobile-screen"></i>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: '#FFF' }}>
                Delivery Mobile Radar
              </h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#94A3B8' }}>
                Scan or open URL on your smartphone
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
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', textAlign: 'center' }}>
          {/* QR Code Container */}
          <div style={{
            background: '#FFFFFF',
            padding: '14px',
            borderRadius: '18px',
            display: 'inline-block',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            marginBottom: '18px',
            position: 'relative'
          }}>
            <img
              src={qrCodeUrl}
              alt="Scan Mobile Delivery Radar QR Code"
              style={{
                width: '210px',
                height: '210px',
                display: 'block',
                borderRadius: '8px'
              }}
              onError={(e) => {
                // Fallback if offline
                e.target.style.display = 'none';
                e.target.parentNode.innerHTML = `<div style="width:210px;height:210px;display:flex;align-items:center;justify-content:center;color:#0F172A;font-weight:700;font-size:0.9rem;text-align:center;">Scan with Camera or visit:<br/><span style="color:#059669;word-break:break-all;">${mobileUrl}</span></div>`;
              }}
            />
            <div style={{
              position: 'absolute',
              bottom: '-10px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#10B981',
              color: '#090D16',
              fontSize: '0.68rem',
              fontWeight: '900',
              padding: '3px 10px',
              borderRadius: '20px',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              boxShadow: '0 2px 8px rgba(16,185,129,0.4)',
              whiteSpace: 'nowrap'
            }}>
              <i className="fa-solid fa-camera"></i> Scan with Phone
            </div>
          </div>

          {/* URL Box */}
          <div style={{
            background: '#1E293B',
            border: '1px solid #334155',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            marginBottom: '16px'
          }}>
            <div style={{ textAlign: 'left', overflow: 'hidden' }}>
              <div style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' }}>
                Mobile Access URL
              </div>
              <div style={{
                fontSize: '0.92rem',
                fontWeight: '700',
                color: '#34D399',
                fontFamily: 'monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {mobileUrl}
              </div>
            </div>

            <button
              onClick={handleCopy}
              style={{
                background: copied ? '#10B981' : '#334155',
                color: copied ? '#090D16' : '#FFF',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '0.78rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flexShrink: 0
              }}
            >
              <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`}></i>
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>

          {/* Quick instructions */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.5)',
            borderRadius: '12px',
            padding: '14px',
            textAlign: 'left',
            fontSize: '0.78rem',
            color: '#CBD5E1',
            lineHeight: '1.5'
          }}>
            <div style={{ fontWeight: '800', color: '#FFF', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa-solid fa-wifi" style={{ color: '#10B981' }}></i>
              How to connect your smartphone:
            </div>
            <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>Connect smartphone to the <strong>same Wi-Fi network</strong> as your laptop.</li>
              <li>Point camera at QR code or open <strong>{mobileUrl}</strong> in mobile browser (Chrome/Safari).</li>
              <li>Grant camera permission on mobile for <strong>Live Face Authentication</strong> and package barcode scanning.</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          background: '#1E293B',
          borderTop: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
            Port 3002 &bull; Vite Dev Host 0.0.0.0
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
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
