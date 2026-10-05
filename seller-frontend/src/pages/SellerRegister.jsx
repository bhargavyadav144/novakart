import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSellerAuth } from '../context/SellerAuthContext';

export default function SellerRegister() {
  const [currentStep, setCurrentStep] = useState(1); // 1 = Store & Owner, 2 = Contact & Location, 3 = Security & Confirm

  // Step 1: Store & Owner
  const [ownerName, setOwnerName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeType, setStoreType] = useState('retail_store'); // 'retail_store' | 'home_business'

  // Step 2: Contact & Location
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [city, setCity] = useState('Guntur');
  const [postalCode, setPostalCode] = useState('522002');
  const [lat, setLat] = useState('16.3067');
  const [lng, setLng] = useState('80.4365');

  // Step 3: Security & Confirm
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const { register, loading } = useSellerAuth();
  const navigate = useNavigate();

  const handleStep1Next = (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!ownerName.trim() || !storeName.trim()) {
      setErrorMsg('Please enter both owner name and store name.');
      return;
    }
    setCurrentStep(2);
  };

  const handleStep2Next = (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email.trim() || !phone.trim() || !businessAddress.trim()) {
      setErrorMsg('Please enter your email, contact phone, and business address.');
      return;
    }
    setCurrentStep(3);
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (!acceptedTerms) {
      setErrorMsg('Please accept the Merchant Agreement & Verification Terms to proceed.');
      return;
    }

    const res = await register({
      storeName: storeName.trim(),
      ownerName: ownerName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      password,
      storeType,
      businessAddress: `${businessAddress.trim()}, ${city.trim()} - ${postalCode.trim()}`,
      lat,
      lng,
      acceptedTerms
    });

    if (res.success) {
      // Direct merchant to the onboarding verification dashboard
      navigate('/');
    } else {
      setErrorMsg(res.message);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '11px 14px',
    border: '1.5px solid var(--seller-border, #e2e8f0)',
    borderRadius: '8px',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit'
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--seller-bg, #f8fafc)', padding: '32px 16px' }}>
      <div style={{ background: '#fff', border: '1px solid var(--seller-border, #e2e8f0)', borderRadius: '16px', padding: '36px', width: '100%', maxWidth: '520px', boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0,0,0,0.05))' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: '#ecfdf5', color: '#0f766e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', margin: '0 auto 12px auto' }}>
            <i className="fa-solid fa-store"></i>
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: '800', color: 'var(--seller-primary, #0f172a)', margin: 0 }}>
            Register Merchant Store
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#64748B', marginTop: '6px' }}>
            Sell your products on NovaKart. Fast registration with progressive KYC verification.
          </p>
        </div>

        {/* Stepper Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '15px', left: '15%', right: '15%', height: '2px', background: '#e2e8f0', zIndex: 0 }}>
            <div style={{ width: currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : '100%', height: '100%', background: '#0f766e', transition: 'width 0.3s ease' }}></div>
          </div>

          {[
            { num: 1, label: 'Identity' },
            { num: 2, label: 'Store & Address' },
            { num: 3, label: 'Security' }
          ].map((s) => (
            <div key={s.num} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: currentStep >= s.num ? '#0f766e' : '#f1f5f9',
                color: currentStep >= s.num ? '#ffffff' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.85rem',
                fontWeight: '800',
                border: currentStep === s.num ? '3px solid #99f6e4' : 'none',
                boxShadow: currentStep === s.num ? '0 0 0 2px #0f766e' : 'none'
              }}>
                {currentStep > s.num ? '✓' : s.num}
              </div>
              <span style={{ fontSize: '0.72rem', color: currentStep >= s.num ? '#0f766e' : '#94a3b8', fontWeight: '700', marginTop: '4px' }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Status Error Banner */}
        {errorMsg && (
          <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px', lineHeight: '1.4' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px' }}></i>
            {errorMsg}
          </div>
        )}

        {/* STEP 1: STORE & OWNER IDENTITY */}
        {currentStep === 1 && (
          <form onSubmit={handleStep1Next} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Store Owner Full Name *
              </label>
              <input
                type="text"
                style={inputStyle}
                placeholder="e.g. Ramesh Kumar"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Store / Business Name *
              </label>
              <input
                type="text"
                style={inputStyle}
                placeholder="e.g. Nova Fresh Supermarket"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '8px' }}>
                Business Facility Type *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div
                  onClick={() => setStoreType('retail_store')}
                  style={{
                    border: storeType === 'retail_store' ? '2px solid #0f766e' : '1.5px solid #e2e8f0',
                    background: storeType === 'retail_store' ? '#f0fdf4' : '#ffffff',
                    borderRadius: '10px',
                    padding: '12px',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <i className="fa-solid fa-store" style={{ fontSize: '1.2rem', color: storeType === 'retail_store' ? '#0f766e' : '#64748b', display: 'block', marginBottom: '4px' }}></i>
                  <strong style={{ fontSize: '0.82rem', color: '#0f172a', display: 'block' }}>Physical Store</strong>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Showroom / Market</span>
                </div>

                <div
                  onClick={() => setStoreType('home_business')}
                  style={{
                    border: storeType === 'home_business' ? '2px solid #0f766e' : '1.5px solid #e2e8f0',
                    background: storeType === 'home_business' ? '#f0fdf4' : '#ffffff',
                    borderRadius: '10px',
                    padding: '12px',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <i className="fa-solid fa-house" style={{ fontSize: '1.2rem', color: storeType === 'home_business' ? '#0f766e' : '#64748b', display: 'block', marginBottom: '4px' }}></i>
                  <strong style={{ fontSize: '0.82rem', color: '#0f172a', display: 'block' }}>Home Business</strong>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Kitchen / Studio</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn-seller btn-seller-primary"
              style={{ padding: '12px', justifyContent: 'center', width: '100%', fontSize: '0.9rem', fontWeight: '800', marginTop: '8px' }}
            >
              Continue to Contact Details →
            </button>
          </form>
        )}

        {/* STEP 2: CONTACT & ADDRESS */}
        {currentStep === 2 && (
          <form onSubmit={handleStep2Next} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Business Email Address *
              </label>
              <input
                type="email"
                style={inputStyle}
                placeholder="storeowner@merchant.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Mobile Contact Number *
              </label>
              <input
                type="tel"
                style={inputStyle}
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Business / Warehouse Address *
              </label>
              <textarea
                style={{ ...inputStyle, minHeight: '64px', resize: 'vertical' }}
                placeholder="Shop No., Street, Landmark, Area"
                value={businessAddress}
                onChange={(e) => setBusinessAddress(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>City *</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>Pincode *</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                style={{ padding: '12px', border: '1.5px solid #cbd5e1', borderRadius: '8px', background: '#fff', color: '#475569', fontWeight: '700', cursor: 'pointer', flex: 1 }}
              >
                ← Back
              </button>
              <button
                type="submit"
                className="btn-seller btn-seller-primary"
                style={{ padding: '12px', justifyContent: 'center', flex: 2, fontSize: '0.9rem', fontWeight: '800' }}
              >
                Continue to Password →
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: SECURITY & COMPLETE REGISTRATION */}
        {currentStep === 3 && (
          <form onSubmit={handleFinalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Account Password *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  style={{ ...inputStyle, paddingRight: '42px' }}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Confirm Password *
              </label>
              <input
                type="password"
                style={inputStyle}
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', fontSize: '0.78rem', color: '#475569', lineHeight: '1.5' }}>
              <div style={{ fontWeight: '800', color: '#0f172a', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="fa-solid fa-shield-halved" style={{ color: '#0f766e' }}></i> Post-Registration KYC Checklist
              </div>
              After registering, you will be guided through:
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                <li>Store premises facade or home production proof</li>
                <li>Biometric verification (2 Face Scans &amp; Touch Fingerprint)</li>
                <li>Government ID (Aadhaar / Voter / Passport) &amp; PAN card</li>
                <li>Product category clearance for customer storefront</li>
              </ul>
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.82rem', color: '#334155', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                style={{ marginTop: '3px' }}
                required
              />
              <span>
                I agree to the NovaKart Merchant Terms of Service and acknowledge that store products are visible after Admin KYC clearance.
              </span>
            </label>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                style={{ padding: '12px', border: '1.5px solid #cbd5e1', borderRadius: '8px', background: '#fff', color: '#475569', fontWeight: '700', cursor: 'pointer', flex: 1 }}
                disabled={loading}
              >
                ← Back
              </button>
              <button
                type="submit"
                className="btn-seller btn-seller-primary"
                style={{ padding: '12px', justifyContent: 'center', flex: 2, fontSize: '0.9rem', fontWeight: '800' }}
                disabled={loading}
              >
                {loading ? <><i className="fa-solid fa-spinner fa-spin"></i> Registering...</> : 'Complete Registration 🚀'}
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #f1f5f9', fontSize: '0.85rem', color: '#64748B' }}>
          Already have a Merchant Account?{' '}
          <Link to="/login" style={{ color: 'var(--seller-primary, #0f172a)', fontWeight: '800' }}>
            Sign In Here
          </Link>
        </div>

      </div>
    </div>
  );
}
