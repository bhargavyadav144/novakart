import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSellerAuth } from '../context/SellerAuthContext';
import sellerApi from '../services/sellerApi';

const COUNTRY_CODES = [
  { code: '+91', country: 'India 🇮🇳' },
  { code: '+1', country: 'USA / Canada 🇺🇸' },
  { code: '+44', country: 'United Kingdom 🇬🇧' },
  { code: '+971', country: 'UAE 🇦🇪' },
  { code: '+65', country: 'Singapore 🇸🇬' },
  { code: '+61', country: 'Australia 🇦🇺' },
  { code: '+49', country: 'Germany 🇩🇪' },
  { code: '+81', country: 'Japan 🇯🇵' },
  { code: '+966', country: 'Saudi Arabia 🇸🇦' },
  { code: '+33', country: 'France 🇫🇷' }
];

export default function SellerRegister() {
  // 1. Name
  const [ownerName, setOwnerName] = useState('');

  // 2. Email & 3. Email OTP Verification
  const [email, setEmail] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // 4. Country Code & Phone Number
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');

  // 5. Store Name & Type
  const [storeName, setStoreName] = useState('');
  const [storeType, setStoreType] = useState('retail_store'); // 'retail_store' | 'home_business'

  // 6. Password & New Password / Confirm
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 7. Terms & Conditions
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // General Status
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const { register, loading } = useSellerAuth();
  const navigate = useNavigate();

  // Countdown timer for OTP resend
  useEffect(() => {
    let interval = null;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer(p => p - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Send Email OTP
  const handleSendEmailOTP = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address first.');
      return;
    }

    setSendingOtp(true);
    try {
      const { data } = await sellerApi.post('/auth/send-otp', {
        email: cleanEmail,
        purpose: 'registration'
      });
      setIsOtpSent(true);
      setResendTimer(60);
      setSuccessMsg(`A 6-digit verification code was sent to ${cleanEmail}. Please enter it below.`);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to send OTP code. Please check your email.');
    } finally {
      setSendingOtp(false);
    }
  };

  // Verify Email OTP
  const handleVerifyEmailOTP = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otpCode.trim();

    if (!cleanOtp || cleanOtp.length < 6) {
      setErrorMsg('Please enter the complete 6-digit code received on your email.');
      return;
    }

    setVerifyingOtp(true);
    try {
      const { data } = await sellerApi.post('/auth/verify-otp', {
        identifier: cleanEmail,
        otp: cleanOtp,
        purpose: 'registration'
      });

      setIsEmailVerified(true);
      setSuccessMsg('✅ Email verified successfully! You may now proceed with registration.');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Invalid or expired verification code.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Complete Registration
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!ownerName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    if (!isEmailVerified) {
      setErrorMsg('🔒 Email verification is mandatory. Please enter and verify the OTP code sent to your email.');
      return;
    }

    if (!phone.trim()) {
      setErrorMsg('Please enter your mobile contact number.');
      return;
    }

    if (!storeName.trim()) {
      setErrorMsg('Please enter your store or business name.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter your password.');
      return;
    }

    if (!acceptedTerms) {
      setErrorMsg('You must accept the NovaKart Terms & Conditions to register.');
      return;
    }

    const fullPhone = `${countryCode} ${phone.trim()}`;

    const res = await register({
      ownerName: ownerName.trim(),
      email: email.trim().toLowerCase(),
      phone: fullPhone,
      storeName: storeName.trim(),
      storeType,
      password,
      businessAddress: 'Address pending verification',
      acceptedTerms: true
    });

    if (res.success) {
      navigate('/verification');
    } else {
      setErrorMsg(res.message);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '11px 14px',
    border: '1.5px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit'
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8fafc', padding: '36px 16px' }}>
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '36px', width: '100%', maxWidth: '540px', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: '#ecfdf5', color: '#0f766e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', margin: '0 auto 12px auto' }}>
            <i className="fa-solid fa-store"></i>
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
            Create Merchant Account
          </h1>
          <p style={{ fontSize: '0.84rem', color: '#64748b', marginTop: '6px' }}>
            Enter your details, verify your email, and register your store on NovaKart
          </p>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '0.84rem', marginBottom: '16px', lineHeight: '1.4' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px' }}></i>
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div style={{ background: '#ecfdf5', color: '#047857', padding: '10px 14px', borderRadius: '8px', fontSize: '0.84rem', marginBottom: '16px', border: '1px solid #a7f3d0' }}>
            <i className="fa-solid fa-circle-check" style={{ marginRight: '6px' }}></i>
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* 1. OWNER FULL NAME */}
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
              1. Store Owner Full Name *
            </label>
            <input
              type="text"
              style={inputStyle}
              placeholder="e.g. Ramesh Kumar"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              required
            />
          </div>

          {/* 2. EMAIL ADDRESS & 3. EMAIL OTP VERIFICATION */}
          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: isEmailVerified ? '1.5px solid #10b981' : '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155' }}>
                2. Business Email &amp; OTP Verification *
              </label>
              {isEmailVerified && (
                <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.72rem', fontWeight: '800', padding: '2px 8px', borderRadius: '12px' }}>
                  ✓ Email Verified
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="email"
                style={{ ...inputStyle, flex: 1, background: isEmailVerified ? '#f0fdf4' : '#ffffff' }}
                placeholder="storeowner@merchant.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setIsEmailVerified(false);
                  setIsOtpSent(false);
                }}
                disabled={isEmailVerified}
                required
              />
              {!isEmailVerified && (
                <button
                  type="button"
                  onClick={handleSendEmailOTP}
                  disabled={sendingOtp || (resendTimer > 0 && isOtpSent)}
                  style={{
                    background: '#0f766e',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0 16px',
                    fontSize: '0.82rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {sendingOtp ? 'Sending...' : resendTimer > 0 ? `Resend (${resendTimer}s)` : isOtpSent ? 'Resend OTP' : 'Send Code'}
                </button>
              )}
            </div>

            {/* OTP Code Entry (Appears after code is sent) */}
            {isOtpSent && !isEmailVerified && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Enter the 6-digit verification code sent to your email:
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    maxLength="6"
                    style={{ ...inputStyle, flex: 1, letterSpacing: '6px', textAlign: 'center', fontWeight: '800', fontSize: '1.1rem' }}
                    placeholder="••••••"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyEmailOTP}
                    disabled={verifyingOtp || otpCode.length < 6}
                    style={{
                      background: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0 18px',
                      fontSize: '0.82rem',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    {verifyingOtp ? 'Verifying...' : 'Verify Code ✓'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. COUNTRY CODE & PHONE NUMBER */}
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
              3. Country Code &amp; Mobile Phone Number *
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                style={{
                  width: '160px',
                  padding: '11px 10px',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: '700',
                  background: '#ffffff',
                  outline: 'none'
                }}
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} {c.country}
                  </option>
                ))}
              </select>

              <input
                type="tel"
                style={{ ...inputStyle, flex: 1 }}
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                required
              />
            </div>
          </div>

          {/* 5. STORE NAME & FACILITY TYPE */}
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
              4. Store / Business Name &amp; Facility Type *
            </label>
            <input
              type="text"
              style={inputStyle}
              placeholder="e.g. Balaji Fresh Groceries & Organics"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              required
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
              <div
                onClick={() => setStoreType('retail_store')}
                style={{
                  border: storeType === 'retail_store' ? '2px solid #0f766e' : '1.5px solid #e2e8f0',
                  background: storeType === 'retail_store' ? '#f0fdf4' : '#ffffff',
                  borderRadius: '8px',
                  padding: '10px',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                <i className="fa-solid fa-store" style={{ color: storeType === 'retail_store' ? '#0f766e' : '#64748b' }}></i>
                <div style={{ fontSize: '0.78rem', fontWeight: '800', marginTop: '2px' }}>Physical Store</div>
              </div>

              <div
                onClick={() => setStoreType('home_business')}
                style={{
                  border: storeType === 'home_business' ? '2px solid #0f766e' : '1.5px solid #e2e8f0',
                  background: storeType === 'home_business' ? '#f0fdf4' : '#ffffff',
                  borderRadius: '8px',
                  padding: '10px',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                <i className="fa-solid fa-house" style={{ color: storeType === 'home_business' ? '#0f766e' : '#64748b' }}></i>
                <div style={{ fontSize: '0.78rem', fontWeight: '800', marginTop: '2px' }}>Home Business</div>
              </div>
            </div>
          </div>

          {/* 6. PASSWORD & CONFIRM / NEW PASSWORD */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                5. Password *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  style={{ ...inputStyle, paddingRight: '36px' }}
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} style={{ fontSize: '0.85rem' }}></i>
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Confirm / New Password *
              </label>
              <input
                type="password"
                style={{
                  ...inputStyle,
                  borderColor: confirmPassword && password !== confirmPassword ? '#ef4444' : confirmPassword && password === confirmPassword ? '#10b981' : '#cbd5e1'
                }}
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {/* 7. TERMS & CONDITIONS (DEDICATED PAGE LINK) */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', marginTop: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.82rem', color: '#334155', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                style={{ marginTop: '3px', width: '16px', height: '16px', accentColor: '#0f766e' }}
                required
              />
              <span style={{ lineHeight: '1.5' }}>
                I have read and agree to the NovaKart{' '}
                <Link
                  to="/terms"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#0f766e', fontWeight: '800', textDecoration: 'underline' }}
                >
                  Terms &amp; Conditions Policy
                </Link>
                {' '}(opens dedicated policy page). I understand that any future policy updates published by Admin will be notified to my account.
              </span>
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="btn-seller btn-seller-primary"
            style={{ padding: '13px', justifyContent: 'center', width: '100%', fontSize: '0.92rem', fontWeight: '800', marginTop: '6px' }}
            disabled={loading}
          >
            {loading ? <><i className="fa-solid fa-spinner fa-spin"></i> Registering...</> : 'Create Merchant Account & Proceed →'}
          </button>
        </form>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '22px', paddingTop: '16px', borderTop: '1px solid #f1f5f9', fontSize: '0.85rem', color: '#64748B' }}>
          Already have a Merchant Account?{' '}
          <Link to="/login" style={{ color: '#0f766e', fontWeight: '800' }}>
            Sign In Here
          </Link>
        </div>

      </div>
    </div>
  );
}
