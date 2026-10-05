import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSellerAuth } from '../context/SellerAuthContext';
import sellerApi from '../services/sellerApi';

export default function SellerLogin() {
  const [loginMode, setLoginMode] = useState('password'); // 'password' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Forgot Password State
  const [forgotStep, setForgotStep] = useState(1); // 1 = Enter Email, 2 = Enter OTP + New Password
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const { login, loading } = useSellerAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let interval = null;
    if (loginMode === 'forgot' && forgotStep === 2 && timer > 0) {
      interval = setInterval(() => setTimer((p) => p - 1), 1000);
    } else if (timer === 0) {
      setCanResend(true);
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [loginMode, forgotStep, timer]);

  // Standard Password Login
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    const res = await login(email.trim(), password);
    if (res.success) {
      // Check approval status: if approved go to real portal, else verification hub
      if (res.user?.isApproved) {
        navigate('/');
      } else {
        navigate('/verification');
      }
    } else {
      setErrorMsg(res.message);
    }
  };

  // Step 1: Send Reset OTP to Registered Email
  const handleSendResetOTP = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email.trim()) {
      setErrorMsg('Please enter your registered store owner email.');
      return;
    }

    setSubmitting(true);
    try {
      await sellerApi.post('/auth/send-otp', {
        email: email.trim(),
        purpose: 'forgot_password',
        expectedRole: 'seller'
      });

      setForgotStep(2);
      setTimer(60);
      setCanResend(false);
      setSuccessMsg(`A 6-digit security code was dispatched to ${email.trim()}`);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send security code. Please check your email.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: Verify OTP and Set New Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!resetOtp.trim() || resetOtp.length < 6) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMsg('Passwords do not match. Please re-enter your new password.');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await sellerApi.post('/auth/reset-password', {
        email: email.trim(),
        otp: resetOtp.trim(),
        newPassword
      });

      setSuccessMsg(data.message || 'Password reset successfully! Please sign in with your new password.');
      setLoginMode('password');
      setPassword('');
      setResetOtp('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to reset password. Please check the code.');
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
            <i className="fa-solid fa-store" style={{ color: 'var(--seller-accent)' }}></i> {loginMode === 'forgot' ? 'Reset Password' : 'Merchant Sign In'}
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#64748B', marginTop: '4px' }}>
            {loginMode === 'forgot'
              ? 'Verify your registered email to create a new password'
              : 'Access your store catalog, orders, and settlement ledger'}
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
              {/* Only Forgot Password? link above the password field */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155' }}>
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('forgot');
                    setForgotStep(1);
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  style={{ background: 'none', border: 'none', color: '#0f766e', fontSize: '0.78rem', cursor: 'pointer', fontWeight: '700', padding: 0 }}
                >
                  Forgot Password?
                </button>
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

        {/* 2. FORGOT PASSWORD FLOW */}
        {loginMode === 'forgot' && (
          <div>
            {forgotStep === 1 ? (
              <form onSubmit={handleSendResetOTP} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Registered Merchant Email
                  </label>
                  <input
                    type="email"
                    style={inputStyle}
                    placeholder="merchant@store.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <p style={{ margin: '6px 0 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    We will send a 6-digit security code to this email to reset your password.
                  </p>
                </div>

                <button
                  type="submit"
                  className="btn-seller btn-seller-primary"
                  style={{ padding: '12px', justifyContent: 'center', width: '100%', fontSize: '0.9rem', fontWeight: '800' }}
                  disabled={submitting}
                >
                  {submitting ? <><i className="fa-solid fa-spinner fa-spin"></i> Verifying Account...</> : <><i className="fa-solid fa-paper-plane"></i> Send Reset Code</>}
                </button>

                <div style={{ textAlign: 'center', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => { setLoginMode('password'); setErrorMsg(''); setSuccessMsg(''); }}
                    style={{ background: 'none', border: 'none', color: '#0f766e', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '700' }}
                  >
                    ← Back to Merchant Sign In
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                    6-Digit Security Code sent to {email}
                  </label>
                  <input
                    type="text"
                    maxLength="6"
                    style={{ ...inputStyle, textAlign: 'center', fontSize: '1.6rem', letterSpacing: '8px', fontWeight: '800', padding: '8px' }}
                    placeholder="••••••"
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    autoFocus
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                    New Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      style={{ ...inputStyle, paddingRight: '42px' }}
                      placeholder="Minimum 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                    >
                      <i className={`fa-solid ${showNewPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Confirm New Password
                  </label>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    style={inputStyle}
                    placeholder="Re-enter new password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn-seller btn-seller-primary"
                  style={{ padding: '12px', justifyContent: 'center', width: '100%', fontSize: '0.9rem', fontWeight: '800', marginTop: '4px' }}
                  disabled={submitting || resetOtp.length < 6}
                >
                  {submitting ? 'Updating Password...' : 'Reset Password & Sign In →'}
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#64748B' }}>
                  <button
                    type="button"
                    onClick={() => { setForgotStep(1); setResetOtp(''); }}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.8rem' }}
                  >
                    ← Change Email
                  </button>

                  <div>
                    {timer > 0 ? (
                      <span>Resend code in <strong>{timer}s</strong></span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendResetOTP}
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
                    ← Back to Merchant Sign In
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
