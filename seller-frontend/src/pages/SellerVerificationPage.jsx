import React from 'react';
import SellerVerificationCenter from '../components/SellerVerificationCenter';

export default function SellerVerificationPage() {
  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fa-solid fa-shield-halved" style={{ color: '#0f766e' }}></i> Merchant Verification Hub
        </h1>
        <p style={{ color: '#64748B', fontSize: '0.88rem', margin: '4px 0 0' }}>
          Complete all store verification stages to unlock product publishing, settlement transfers, and customer storefront listings.
        </p>
      </div>

      <SellerVerificationCenter />
    </div>
  );
}
