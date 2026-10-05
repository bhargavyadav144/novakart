import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SellerAuthProvider, useSellerAuth } from './context/SellerAuthContext';
import SellerSidebar from './components/SellerSidebar';

// Pages
import SellerDashboard from './pages/SellerDashboard';
import SellerProducts from './pages/SellerProducts';
import AddProductPage from './pages/AddProductPage';
import EditProductPage from './pages/EditProductPage';
import SellerOrders from './pages/SellerOrders';
import SellerProfile from './pages/SellerProfile';
import SellerPayouts from './pages/SellerPayouts';
import SellerLogin from './pages/SellerLogin';
import SellerRegister from './pages/SellerRegister';
import SellerVerificationPage from './pages/SellerVerificationPage';
import SellerBiometricReminderBanner from './components/SellerBiometricReminderBanner';

import './styles/seller.css';

function ProtectedSellerLayout({ children, requireApproval = false }) {
  const { sellerUser } = useSellerAuth();
  if (!sellerUser) return <Navigate to="/login" replace />;

  const isPending = !sellerUser.isApproved;

  // If a route specifically requires approval (like adding products) and seller is pending:
  if (requireApproval && isPending) {
    return (
      <div className="seller-layout">
        <SellerSidebar />
        <main className="seller-content" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '36px 24px', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '40px 32px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
            }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', margin: '0 auto 16px auto' }}>
                <i className="fa-solid fa-hourglass-half"></i>
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', margin: '0 0 10px 0' }}>
                Store Under Admin Verification
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.92rem', lineHeight: '1.6', margin: '0 0 24px 0' }}>
                Your merchant application is currently pending admin review. Product catalog publishing and customer storefront visibility unlock as soon as the administrator clears your store premises and product categories.
              </p>
              <a
                href="/verification"
                style={{
                  display: 'inline-block',
                  background: '#0f766e',
                  color: '#ffffff',
                  padding: '12px 24px',
                  borderRadius: '10px',
                  fontWeight: '800',
                  textDecoration: 'none',
                  fontSize: '0.9rem'
                }}
              >
                Open Verification Center &amp; KYC Progress &rarr;
              </a>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="seller-layout">
      <SellerSidebar />
      <main className="seller-content" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Status notice if pending */}
        {isPending && (
          <div style={{
            background: '#fffbeb',
            borderBottom: '1px solid #fde68a',
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.84rem',
            color: '#92400e',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-clock-rotate-left" style={{ color: '#d97706', fontSize: '1rem' }}></i>
              <span>
                <strong>Store Under Review:</strong> Complete all 100% verification milestones so Admin can clear your store products for customers.
              </span>
            </div>
            <a
              href="/verification"
              style={{
                background: '#d97706',
                color: '#ffffff',
                padding: '6px 14px',
                borderRadius: '6px',
                fontWeight: '700',
                textDecoration: 'none',
                fontSize: '0.78rem'
              }}
            >
              KYC Progress &rarr;
            </a>
          </div>
        )}
        <SellerBiometricReminderBanner />
        <div style={{ flex: 1, padding: '24px' }}>
          {children}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <SellerAuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<SellerLogin />} />
          <Route path="/register" element={<SellerRegister />} />
          
          {/* Main Dashboard & Verification */}
          <Route path="/" element={<ProtectedSellerLayout><SellerDashboard /></ProtectedSellerLayout>} />
          <Route path="/verification" element={<ProtectedSellerLayout><SellerVerificationPage /></ProtectedSellerLayout>} />

          {/* Product Management (Requires KYC Approval) */}
          <Route path="/products" element={<ProtectedSellerLayout><SellerProducts /></ProtectedSellerLayout>} />
          <Route path="/products/new" element={<ProtectedSellerLayout requireApproval={true}><AddProductPage /></ProtectedSellerLayout>} />
          <Route path="/products/edit/:id" element={<ProtectedSellerLayout requireApproval={true}><EditProductPage /></ProtectedSellerLayout>} />

          {/* Orders, Settlements & Profile */}
          <Route path="/orders" element={<ProtectedSellerLayout><SellerOrders /></ProtectedSellerLayout>} />
          <Route path="/payouts" element={<ProtectedSellerLayout><SellerPayouts /></ProtectedSellerLayout>} />
          <Route path="/profile" element={<ProtectedSellerLayout><SellerProfile /></ProtectedSellerLayout>} />
        </Routes>
      </Router>
    </SellerAuthProvider>
  );
}
