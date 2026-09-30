import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PaymentAuthProvider, usePaymentAuth } from './context/PaymentAuthContext';
import PaymentLogin from './pages/PaymentLogin';
import TreasuryDashboard from './pages/TreasuryDashboard';

class PaymentErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Treasury Portal Runtime Exception:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#090D16', color: '#F8FAFC', padding: '24px', fontFamily: 'sans-serif' }}>
          <div style={{ maxWidth: '520px', width: '100%', background: '#0F172A', border: '1px solid #1E293B', borderRadius: '16px', padding: '32px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', margin: '0 auto 16px auto' }}>
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: '800', marginBottom: '8px' }}>Treasury Core View Notice</h2>
            <p style={{ color: '#94A3B8', fontSize: '0.88rem', marginBottom: '20px', lineHeight: '1.5' }}>
              An error occurred while rendering the Treasury console. You can reload or reset your portal session below.
            </p>
            <div style={{ background: '#090D16', padding: '12px', borderRadius: '8px', fontSize: '0.78rem', color: '#F87171', textAlign: 'left', marginBottom: '20px', wordBreak: 'break-word', fontFamily: 'monospace' }}>
              {this.state.error?.message || 'Unknown view exception'}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                onClick={() => window.location.reload()} 
                style={{ padding: '10px 18px', background: '#10B981', color: '#090D16', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
              >
                Reload Page
              </button>
              <button 
                onClick={() => {
                  localStorage.removeItem('novakart_finance_token');
                  localStorage.removeItem('novakart_finance_user');
                  window.location.href = '/';
                }} 
                style={{ padding: '10px 18px', background: '#334155', color: '#F8FAFC', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
              >
                Clear Cache &amp; Re-login
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedApp() {
  const { user, loading } = usePaymentAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#090D16', color: '#10B981', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2.5rem', marginBottom: '14px' }}></i>
          <p style={{ fontWeight: '600', color: '#94A3B8' }}>Connecting to NovaKart Nodal Treasury Core...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <PaymentLogin />;
  }

  return (
    <Routes>
      <Route path="/" element={<TreasuryDashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <PaymentErrorBoundary>
      <BrowserRouter>
        <PaymentAuthProvider>
          <ProtectedApp />
        </PaymentAuthProvider>
      </BrowserRouter>
    </PaymentErrorBoundary>
  );
}

