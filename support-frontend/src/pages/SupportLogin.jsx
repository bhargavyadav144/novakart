import React, { useState } from 'react';
import { useSupportAuth } from '../context/SupportAuthContext';

export default function SupportLogin() {
  const { login } = useSupportAuth();
  const [email, setEmail] = useState('priya.returns@novakart.in');
  const [password, setPassword] = useState('Support@1234');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const quickOfficers = [
    {
      name: 'Priya Sharma',
      id: 'WRK-01',
      role: 'Returns & QC Specialist',
      email: 'priya.returns@novakart.in',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
      badge: 'Returns / Refunds'
    },
    {
      name: 'Vikramaditya Rao',
      id: 'WRK-02',
      role: 'Logistics & Dispatch Lead',
      email: 'vikram.delivery@novakart.in',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      badge: 'Rider Delays'
    },
    {
      name: 'Ananya Reddy',
      id: 'WRK-03',
      role: 'Payments & Treasury Associate',
      email: 'ananya.payments@novakart.in',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&q=80',
      badge: 'Refunds / Wallets'
    },
    {
      name: 'Karthik Varma',
      id: 'WRK-04',
      role: 'Technical & Product Quality',
      email: 'karthik.tech@novakart.in',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
      badge: 'Damaged Goods'
    },
    {
      name: 'Neha Chawla',
      id: 'WRK-05',
      role: 'Customer Care Lead',
      email: 'neha.care@novakart.in',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
      badge: 'General Care'
    },
    {
      name: 'Rohan Sen',
      id: 'WRK-06',
      role: 'Escalation & High Priority Claims',
      email: 'rohan.sen@novakart.in',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
      badge: 'Admin Added'
    }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOfficer = (officerEmail) => {
    setEmail(officerEmail);
    setPassword('Support@1234');
    setError('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% -20%, #16243B 0%, #0A0E17 75%)',
      padding: '24px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '920px',
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(17, 24, 39, 0.85)',
        backdropFilter: 'blur(20px)',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
      }}>
        {/* Left: System Information & Quick Staff Roster */}
        <div style={{
          padding: '40px',
          background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.8) 100%)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontSize: '1.3rem',
                boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)'
              }}>
                <i className="fa-solid fa-headset"></i>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#06B6D4', fontWeight: '800' }}>
                  NovaKart Enterprise Service Desk
                </span>
                <h1 style={{ fontSize: '1.45rem', fontWeight: '800', color: '#F1F5F9', margin: 0 }}>
                  Help Center Desk
                </h1>
              </div>
            </div>

            <div style={{
              background: 'rgba(6, 182, 212, 0.08)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38BDF8', fontSize: '0.82rem', fontWeight: '700' }}>
                <i className="fa-solid fa-shield-halved"></i>
                <span>Strict Admin-Only Staff Governance</span>
              </div>
              <p style={{ color: '#94A3B8', fontSize: '0.78rem', marginTop: '4px', lineHeight: '1.4' }}>
                Public registration is disabled. Every Support Worker is provisioned and vetted strictly by System Administrator at Port 3003.
              </p>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Fast-Fill Certified Officers:
              </span>
            </div>

            {/* Quick Staff Select List */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {quickOfficers.map(off => {
                const isSelected = email === off.email;
                return (
                  <div
                    key={off.id}
                    onClick={() => handleSelectOfficer(off.email)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '10px',
                      border: isSelected ? '1px solid #06B6D4' : '1px solid rgba(255, 255, 255, 0.06)',
                      background: isSelected ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <img
                      src={off.avatar}
                      alt={off.name}
                      style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: '700', color: isSelected ? '#38BDF8' : '#F1F5F9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {off.name}
                      </div>
                      <div style={{ fontSize: '0.66rem', color: '#64748B' }}>
                        {off.id} • {off.badge}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#64748B' }}>
            <span>Dedicated Help Center: <strong>Port 3006</strong></span>
            <span>Default Pwd: <strong style={{ color: '#94A3B8' }}>Support@1234</strong></span>
          </div>
        </div>

        {/* Right: Login Form */}
        <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#F1F5F9', marginBottom: '6px' }}>
              Officer Sign In
            </h2>
            <p style={{ color: '#64748B', fontSize: '0.82rem' }}>
              Enter your officer credentials generated by Admin.
            </p>
          </div>

          {error && (
            <div style={{
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: '10px',
              padding: '10px 14px',
              marginBottom: '18px',
              color: '#FB7185',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <i className="fa-solid fa-circle-exclamation"></i>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#94A3B8', marginBottom: '6px' }}>
                Officer Work Email
              </label>
              <div style={{ position: 'relative' }}>
                <i className="fa-solid fa-envelope" style={{ position: 'absolute', left: '12px', top: '13px', color: '#64748B', fontSize: '0.85rem' }}></i>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@novakart.in"
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    borderRadius: '8px',
                    background: '#151D2C',
                    border: '1px solid #27354A',
                    color: '#F1F5F9',
                    fontSize: '0.88rem',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#94A3B8', marginBottom: '6px' }}>
                Access Password
              </label>
              <div style={{ position: 'relative' }}>
                <i className="fa-solid fa-lock" style={{ position: 'absolute', left: '12px', top: '13px', color: '#64748B', fontSize: '0.85rem' }}></i>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    borderRadius: '8px',
                    background: '#151D2C',
                    border: '1px solid #27354A',
                    color: '#F1F5F9',
                    fontSize: '0.88rem',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '12px',
                fontSize: '0.92rem'
              }}
            >
              {loading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-right-to-bracket"></i>
                  <span>Enter Support Desk</span>
                </>
              )}
            </button>
          </form>

          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <a
              href="http://localhost:3003/help-center"
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: '0.78rem', color: '#06B6D4', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <i className="fa-solid fa-shield"></i>
              <span>Need Staff Access? Open Admin Control (Port 3003)</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
