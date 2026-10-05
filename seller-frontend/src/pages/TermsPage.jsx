import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import sellerApi from '../services/sellerApi';

export default function TermsPage() {
  const [activeRole, setActiveRole] = useState('seller'); // 'seller' | 'customer' | 'delivery'
  const [termsData, setTermsData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchTerms = (role) => {
    setLoading(true);
    sellerApi.get(`/terms/${role}`)
      .then(({ data }) => {
        if (data.terms) {
          setTermsData(data.terms);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch remote terms, falling back to cached:', err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTerms(activeRole);
  }, [activeRole]);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '36px 16px', color: '#0f172a' }}>
      <div style={{ maxWidth: '880px', margin: '0 auto' }}>
        
        {/* Top Navigation Back to Portal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <Link
            to="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#0f766e',
              textDecoration: 'none',
              fontWeight: '700',
              fontSize: '0.88rem'
            }}
          >
            &larr; Return to Sign In / Dashboard
          </Link>

          <button
            onClick={() => window.print()}
            style={{
              background: '#ffffff',
              border: '1.5px solid #cbd5e1',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#475569'
            }}
          >
            <i className="fa-solid fa-print"></i> Print Terms
          </button>
        </div>

        {/* Header Card */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: '18px',
          padding: '36px 28px',
          color: '#ffffff',
          boxShadow: '0 10px 25px rgba(15, 23, 42, 0.15)',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#34d399',
              border: '1px solid rgba(52, 211, 153, 0.4)',
              padding: '3px 10px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: '800'
            }}>
              OFFICIAL POLICY
            </span>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Version {termsData?.version || '2.0'} &bull; Effective {termsData?.effectiveDate ? new Date(termsData.effectiveDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'October 2026'}
            </span>
          </div>

          <h1 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '0 0 10px 0', lineHeight: '1.3' }}>
            {termsData?.title || 'NovaKart Platform Terms & Conditions'}
          </h1>

          <p style={{ margin: 0, fontSize: '0.92rem', color: '#cbd5e1', lineHeight: '1.6' }}>
            {termsData?.summary || 'These terms govern your rights, obligations, and security protocols across the NovaKart multi-vendor e-commerce platform.'}
          </p>
        </div>

        {/* Role Selector Tabs */}
        <div style={{
          display: 'flex',
          gap: '8px',
          background: '#ffffff',
          padding: '6px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          marginBottom: '24px'
        }}>
          {[
            { id: 'seller', label: '🏪 Merchant & Store Terms', icon: 'fa-store' },
            { id: 'customer', label: '🛒 Customer Terms of Service', icon: 'fa-user' },
            { id: 'delivery', label: '🚴 Delivery Partner Agreement', icon: 'fa-motorcycle' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveRole(tab.id)}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                border: 'none',
                background: activeRole === tab.id ? '#0f766e' : 'transparent',
                color: activeRole === tab.id ? '#ffffff' : '#64748b',
                fontWeight: activeRole === tab.id ? '800' : '600',
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <i className={`fa-solid ${tab.icon}`}></i>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Terms Content Body */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '36px 32px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
        }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.6rem', marginBottom: '10px', display: 'block' }}></i>
              Loading updated policy clauses...
            </div>
          ) : (
            <div>
              {/* Introduction */}
              <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '20px', marginBottom: '24px' }}>
                <p style={{ fontSize: '0.95rem', color: '#334155', lineHeight: '1.7', margin: 0 }}>
                  {termsData?.fullText}
                </p>
              </div>

              {/* Structured Sections */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {termsData?.sections && termsData.sections.length > 0 ? (
                  termsData.sections.map((sec, idx) => (
                    <div key={idx} style={{ background: '#f8fafc', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0' }}>
                      <h3 style={{ margin: '0 0 10px 0', fontSize: '1.05rem', fontWeight: '800', color: '#0f172a' }}>
                        {sec.title}
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', lineHeight: '1.65' }}>
                        {sec.content}
                      </p>
                    </div>
                  ))
                ) : (
                  <p style={{ color: '#64748b', fontStyle: 'italic' }}>No detailed sections provided for this policy.</p>
                )}
              </div>

              {/* Policy Footer Notice */}
              <div style={{
                marginTop: '32px',
                paddingTop: '20px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                fontSize: '0.78rem',
                color: '#64748b'
              }}>
                <div>
                  © 2026 NovaKart Inc. All rights reserved. &bull; Contact Legal: legal@novakart.com
                </div>
                <div style={{ display: 'flex', gap: '14px' }}>
                  <span style={{ color: '#10b981', fontWeight: '700' }}>✓ Verified by Platform Administrator</span>
                </div>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
