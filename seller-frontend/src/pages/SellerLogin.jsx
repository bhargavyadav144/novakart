import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSellerAuth } from '../context/SellerAuthContext';
import sellerApi from '../services/sellerApi';

export default function SellerLogin() {
  const [loginMode, setLoginMode] = useState('password'); // 'password' | 'otp' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP State
  const [otpStep, setOtpStep] = useState(1);
  const [otpCode, setOtpCode] = useState('');
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const { login, loading } = useSellerAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let interval = null;
    if (loginMode === 'otp' && otpStep === 2 && timer > 0) {
      interval = setInterval(() => setTimer((p) => p - 1), 1000);
    } else if (timer === 0) {
      setCanResend(true);
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [loginMode, otpStep, timer]);

  // Standard Password Login
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    const res = await login(email.trim(), password);
    if (res.success) {
      navigate('/');
    } else {
      setErrorMsg(res.message);
    }
  };

  // Send OTP with Immediate Account Verification
  const handleSendOTP = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const { data } = await sellerApi.post('/auth/send-otp', {
        email: email.trim(),
        purpose: 'login',
        expectedRole: 'seller'
      });

      setOtpStep(2);
      setTimer(60);
      setCanResend(false);
      setSuccessMsg(`A 6-digit verification code was sent to ${email.trim()}`);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send verification code. Please verify your email.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Verify OTP Login
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      const { data } = await sellerApi.post('/auth/login-otp', {
        identifier: email.trim(),
        otp: otpCode.trim(),
        expectedRole: 'seller'
      });

      if (data.token) {
        localStorage.setItem('seller_token', data.token);
        if (data.user) localStorage.setItem('seller_user', JSON.stringify(data.user));
        window.location.href = '/';
      } else {
        navigate('/');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Invalid or expired verification code.');
    } finally {
      setSubmitting(false);
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
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--seller-bg)', padding: '24px 16px' }}>
      <div style={{ background: '#fff', border: '1px solid var(--seller-border)', borderRadius: '16px', padding: '36px', width: '100%', maxWidth: '420px', boxShadow: 'var(--shadow-md)' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '26px' }}>
          <h1 style={{ fontSize: '1.65rem', fontWeight: '800', color: 'var(--seller-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <i className="fa-solid fa-store" style={{ color: 'var(--seller-accent)' }}></i> Merchant Sign In
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#64748B', marginTop: '4px' }}>
            Access your store catalog, orders, and settlement ledger
          </p>
        </div>

        {/* Status Alerts */}
        {errorMsg && (
          <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px', lineHeight: '1.4' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px' }}></i>
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div style={{ background: '#ecfdf5', color: '#047857', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px', border: '1px solid #a7f3d0' }}>
            <i className="fa-solid fa-circle-check" style={{ marginRight: '6px' }}></i>
            {successMsg}
          </div>
        )}

        {/* 1. PASSWORD SIGN IN (DEFAULT) */}
        {loginMode === 'password' && (
          <form onSubmit={handlePasswordLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Store Owner Email
              </label>
              <input
                type="email"
                style={inputStyle}
                placeholder="merchant@store.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              {/* Contextual links above the password field */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155' }}>
                  Password
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => { setLoginMode('otp'); setErrorMsg(''); setSuccessMsg(''); setOtpStep(1); }}
                    style={{ background: 'none', border: 'none', color: '#0f766e', fontSize: '0.78rem', cursor: 'pointer', fontWeight: '700', padding: 0 }}
                  >
                    OTP Login
                  </button>
                  <span style={{ color: '#cbd5e1', fontSize: '0.78rem' }}>&bull;</span>
                  <button
                    type="button"
                    onClick={() => { setLoginMode('otp'); setErrorMsg(''); setSuccessMsg(''); setOtpStep(1); }}
                    style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.78rem', cursor: 'pointer', padding: 0 }}
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>

              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  style={{ ...inputStyle, paddingRight: '42px' }}
                  placeholder="••••••••••••"
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

            <button
              type="submit"
              className="btn-seller btn-seller-primary"
              style={{ padding: '12px', justifyContent: 'center', width: '100%', fontSize: '0.9rem', fontWeight: '800', marginTop: '6px' }}
              disabled={loading}
            >
              {loading ? <><i className="fa-solid fa-spinner fa-spin"></i> Authenticating...</> : 'Sign In as Seller →'}
            </button>
          </form>
        )}

        {/* 2. OTP SIGN IN */}
        {loginMode === 'otp' && (
          <div>
            {otpStep === 1 ? (
              <form onSubmit={handleSendOTP} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155' }}>
                      Registered Merchant Email
                    </label>
                    <button
                      type="button"
                      onClick={() => { setLoginMode('password'); setErrorMsg(''); setSuccessMsg(''); }}
                      style={{ background: 'none', border: 'none', color: '#0f766e', fontSize: '0.78rem', cursor: 'pointer', fontWeight: '700', padding: 0 }}
                    >
                      ← Use Password
                    </button>
                  </div>
                  <input
                    type="email"
                    style={inputStyle}
                    placeholder="merchant@store.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                    We will send a secure 6-digit login verification code to your email
                  </p>
                </div>

                <button
                  type="submit"
                  className="btn-seller btn-seller-primary"
                  style={{ padding: '12px', justifyContent: 'center', width: '100%', fontSize: '0.9rem', fontWeight: '800' }}
                  disabled={submitting}
                >
                  {submitting ? <><i className="fa-solid fa-spinner fa-spin"></i> Verifying Account...</> : <><i className="fa-solid fa-paper-plane"></i> Send OTP Code</>}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTP} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ textAlign: 'center' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '10px' }}>
                    Enter 6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    maxLength="6"
                    style={{ ...inputStyle, textAlign: 'center', fontSize: '1.8rem', letterSpacing: '12px', fontWeight: '800', padding: '10px' }}
                    placeholder="••••••"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                    autoFocus
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn-seller btn-seller-primary"
                  style={{ padding: '12px', justifyContent: 'center', width: '100%', fontSize: '0.9rem', fontWeight: '800' }}
                  disabled={submitting || otpCode.length < 6}
                >
                  {submitting ? 'Verifying Code...' : 'Verify & Sign In →'}
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#64748B' }}>
                  <button
                    type="button"
                    onClick={() => { setOtpStep(1); setOtpCode(''); }}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.8rem' }}
                  >
                    ← Change Email
                  </button>

                  <div>
                    {timer > 0 ? (
                      <span>Resend in <strong>{timer}s</strong></span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendOTP}
                        style={{ background: 'none', border: 'none', color: '#0f766e', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem' }}
                      >
                        Resend Code
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => { setLoginMode('password'); setErrorMsg(''); setSuccessMsg(''); }}
                    style={{ background: 'none', border: 'none', color: '#0f766e', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '700' }}
                  >
                    ← Sign In with Password instead
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #f1f5f9', fontSize: '0.85rem', color: '#64748B' }}>
          Want to sell on NovaKart?{' '}
          <Link to="/register" style={{ color: 'var(--seller-primary)', fontWeight: '800' }}>
            Register Store
          </Link>
        </div>
      </div>
    </div>
  );
}
