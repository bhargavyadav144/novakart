import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SupportAuthProvider, useSupportAuth } from './context/SupportAuthContext';
import SupportLogin from './pages/SupportLogin';
import SupportDeskDashboard from './pages/SupportDeskDashboard';

function ProtectedSupportApp() {
  const { worker, loading } = useSupportAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0A0E17',
        color: '#06B6D4',
        fontFamily: 'sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <i className="fa-solid fa-headset fa-spin" style={{ fontSize: '2.5rem', marginBottom: '16px' }}></i>
          <p style={{ fontWeight: '700', color: '#94A3B8' }}>Connecting to NovaKart Help Center Engine (Port 3006)...</p>
        </div>
      </div>
    );
  }

  if (!worker) {
    return <SupportLogin />;
  }

  return (
    <Routes>
      <Route path="/" element={<SupportDeskDashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SupportAuthProvider>
        <ProtectedSupportApp />
      </SupportAuthProvider>
    </BrowserRouter>
  );
}
