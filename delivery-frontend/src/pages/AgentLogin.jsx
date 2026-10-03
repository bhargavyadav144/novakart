import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDeliveryAuth } from '../context/DeliveryAuthContext';
import deliveryApi from '../services/deliveryApi';

export default function AgentLogin() {
  const [loginMode, setLoginMode] = useState('password'); // 'password' | 'otp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP State
  const [otpEmail, setOtpEmail] = useState('');
  const [otpStep, setOtpStep] = useState(1);
  const [otpCode, setOtpCode] = useState('');
  const [demoOtp, setDemoOtp] = useState(null);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Password Change Option during OTP Login
  const [wantsChangePassword, setWantsChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const { login, loading } = useDeliveryAuth() || {};
  const navigate = useNavigate();

  // Smart Email Auto-Fill: Appends @gmail.com if @ is not typed
  const formatEmail = (val) => {
    if (!val) return '';
    const trimmed = val.trim();
    if (!trimmed) return '';
    if (!trimmed.includes('@')) {
      return `${trimmed}@gmail.com`;
    }
    return trimmed;
  };

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

  // Password Login Handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!login) return;
    const cleanEmail = formatEmail(email);
    const res = await login(cleanEmail, password);
    if (res.success) {
      navigate('/orders', { replace: true });
    } else {
      setErrorMsg(res.message);
    }
  };

  // Switch to OTP Login via "Forgot? Use OTP" Link
  const handleSwitchToOtp = () => {
    setErrorMsg('');
    setSuccessMsg('');
    const cleanEmail = formatEmail(email || otpEmail);
    if (cleanEmail) {
      setOtpEmail(cleanEmail);
    }
    setLoginMode('otp');
    setOtpStep(1);
    setWantsChangePassword(false);
  };

  // Send OTP Handler
  const handleSendOTP = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    const cleanEmail = formatEmail(otpEmail || email);
    if (!cleanEmail) {
      setErrorMsg('Please enter your email address or username.');
      setSubmitting(false);
      return;
    }
    setOtpEmail(cleanEmail);

    try {
      const { data } = await deliveryApi.post('/auth/send-otp', { email: cleanEmail, purpose: 'login' });
      if (data.demoOtp) setDemoOtp(data.demoOtp);
      setOtpStep(2);
      setTimer(60);
      setCanResend(false);
      setSuccessMsg(`Login verification code sent to ${cleanEmail}`);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to send OTP code. Please check email address.');
    } finally {
      setSubmitting(false);
    }
  };

  // Verify OTP & Complete Sign In
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanEmail = formatEmail(otpEmail || email);
    const payload = {
      identifier: cleanEmail,
      otp: otpCode,
      expectedRole: 'delivery'
    };

    if (wantsChangePassword) {
      if (!newPassword || newPassword.length < 6) {
        setErrorMsg('New password must be at least 6 characters long.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg('New passwords do not match. Please re-type correctly.');
        return;
      }
      payload.newPassword = newPassword;
    }

    setSubmitting(true);
    try {
      const { data } = await deliveryApi.post('/auth/login-otp', payload);
      if (login) {
        await login(cleanEmail, null, data.token, data.user);
      }
      navigate('/orders', { replace: true });
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Invalid or expired OTP code.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    border: '1.5px solid #CBD5E1',
    borderRadius: '8px',
    fontSize: '0.88rem',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    background: '#FFFFFF',
    color: '#0F172A',
    fontWeight: '700'
  };

  return (
    <div style={{
      minHeight: '100%',
      padding: '24px 16px',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      boxSizing: 'border-box'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        padding: '26px 20px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
        boxSizing: 'border-box'
      }}>
        
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem',
            margin: '0 auto 10px auto',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)'
          }}>
            <i className="fa-solid fa-motorcycle"></i>
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '900', color: '#0F172A', margin: 0 }}>
            Nova<span style={{ color: '#10B981' }}>Fleet</span> Delivery Login
          </h1>
          <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '3px 0 0 0' }}>
            Access nearby delivery requests radar and daily payouts
          </p>
        </div>

        {/* Alert Messages */}
        {errorMsg && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '10px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-circle-exclamation"></i>
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', color: '#166534', padding: '10px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-circle-check"></i>
            <span>{successMsg}</span>
          </div>
        )}

        {/* MODE 1: PASSWORD LOGIN FORM (DEFAULT) */}
        {loginMode === 'password' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.76rem', fontWeight: '800', color: '#334155', display: 'block', marginBottom: '4px' }}>
                Agent Email Address *
              </label>
              <input
                type="text"
                style={inputStyle}
                placeholder="Enter your Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '0.76rem', fontWeight: '800', color: '#334155' }}>Password *</label>
                <button
                  type="button"
                  onClick={handleSwitchToOtp}
                  style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '0.76rem', cursor: 'pointer', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <i className="fa-solid fa-envelope-circle-check"></i> Forgot? Use OTP Login
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  style={{ ...inputStyle, paddingRight: '40px' }}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                background: '#2563EB',
                color: '#FFFFFF',
                border: 'none',
                padding: '12px',
                borderRadius: '10px',
                fontWeight: '800',
                fontSize: '0.88rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
                marginTop: '4px'
              }}
            >
              {loading ? 'Verifying Credentials...' : 'Sign In to Radar →'}
            </button>

            <button
              type="button"
              onClick={() => setIsMobileModalOpen(true)}
              style={{
                background: '#F0FDF4',
                color: '#166534',
                border: '1.5px dashed #86EFAC',
                padding: '9px 12px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <i className="fa-solid fa-mobile-screen"></i>
              <span>📱 Open on Smartphone &bull; Scan QR Code</span>
            </button>
          </form>
        )}

        {/* MODE 2: OTP LOGIN FORM (TRIGGERED VIA FORGOT / USE OTP LINK) */}
        {loginMode === 'otp' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="fa-solid fa-mobile-screen" style={{ color: '#10B981' }}></i> Verified Email OTP Login
              </span>
              <button
                type="button"
                onClick={() => { setLoginMode('password'); setErrorMsg(''); setSuccessMsg(''); }}
                style={{ background: 'none', border: 'none', color: '#64748B', fontSize: '0.74rem', cursor: 'pointer', fontWeight: '700' }}
              >
                ← Back to Password Login
              </button>
            </div>

            {otpStep === 1 ? (
              <form onSubmit={handleSendOTP} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: '800', color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Registered Email Address *
                  </label>
                  <input
                    type="text"
                    style={inputStyle}
                    placeholder="Enter your Email"
                    value={otpEmail}
                    onChange={(e) => setOtpEmail(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    background: '#10B981',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '12px',
                    borderRadius: '10px',
                    fontWeight: '800',
                    fontSize: '0.88rem',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(16,185,129,0.25)',
                    marginTop: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <i className="fa-solid fa-paper-plane"></i>
                  {submitting ? 'Sending OTP Code...' : 'Send 6-Digit Email OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTP} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                
                {demoOtp && (
                  <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '8px', padding: '8px 12px', fontSize: '0.78rem', color: '#B45309', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>⚡ Demo OTP: <strong>{demoOtp}</strong></span>
                    <button type="button" onClick={() => setOtpCode(demoOtp)} style={{ background: '#F59E0B', color: '#FFF', border: 'none', borderRadius: '4px', padding: '3px 8px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: '800' }}>
                      Auto-Fill
                    </button>
                  </div>
                )}

                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: '800', color: '#334155', display: 'block', marginBottom: '4px' }}>Enter 6-Digit Email OTP *</label>
                  <input type="text" maxLength="6" style={{ ...inputStyle, textAlign: 'center', fontSize: '1.6rem', letterSpacing: '8px', fontWeight: '900', border: '1.5px solid #10B981' }} placeholder="••••••" value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))} autoFocus required />
                </div>

                {/* OTP Action Choice: Skip vs Change Password */}
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '10px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: '800', marginBottom: '6px' }}>
                    Password Option after OTP Verification:
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setWantsChangePassword(false)}
                      style={{
                        padding: '7px 4px',
                        borderRadius: '6px',
                        border: `1.5px solid ${!wantsChangePassword ? '#10B981' : '#CBD5E1'}`,
                        background: !wantsChangePassword ? '#ECFDF5' : '#FFFFFF',
                        color: !wantsChangePassword ? '#047857' : '#64748B',
                        fontSize: '0.72rem',
                        fontWeight: '800',
                        cursor: 'pointer'
                      }}
                    >
                      🚀 Skip &amp; Continue
                    </button>

                    <button
                      type="button"
                      onClick={() => setWantsChangePassword(true)}
                      style={{
                        padding: '7px 4px',
                        borderRadius: '6px',
                        border: `1.5px solid ${wantsChangePassword ? '#2563EB' : '#CBD5E1'}`,
                        background: wantsChangePassword ? '#EFF6FF' : '#FFFFFF',
                        color: wantsChangePassword ? '#1D4ED8' : '#64748B',
                        fontSize: '0.72rem',
                        fontWeight: '800',
                        cursor: 'pointer'
                      }}
                    >
                      🔒 Set New Password
                    </button>
                  </div>

                  {wantsChangePassword && (
                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '0.7rem', color: '#334155', fontWeight: '800', display: 'block', marginBottom: '2px' }}>New Password *</label>
                        <input type="password" required={wantsChangePassword} placeholder="Min 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ ...inputStyle, padding: '7px 10px', fontSize: '0.82rem' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.7rem', color: '#334155', fontWeight: '800', display: 'block', marginBottom: '2px' }}>Confirm New Password *</label>
                        <input type="password" required={wantsChangePassword} placeholder="Re-type new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ ...inputStyle, padding: '7px 10px', fontSize: '0.82rem' }} />
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting || otpCode.length < 6}
                  style={{
                    background: wantsChangePassword ? '#2563EB' : '#10B981',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '12px',
                    borderRadius: '10px',
                    fontWeight: '800',
                    fontSize: '0.88rem',
                    cursor: (submitting || otpCode.length < 6) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    marginTop: '2px'
                  }}
                >
                  {submitting
                    ? 'Verifying OTP...'
                    : wantsChangePassword
                      ? '🔒 Set Password & Sign In →'
                      : 'Verify & Sign In directly →'}
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '0.76rem' }}>
                  <button type="button" onClick={() => setOtpStep(1)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', textDecoration: 'underline', fontWeight: '700' }}>
                    ← Change Email
                  </button>
                  {timer > 0 ? (
                    <span style={{ color: '#94A3B8', fontWeight: '700' }}>Resend in {timer}s</span>
                  ) : (
                    <button type="button" onClick={handleSendOTP} style={{ background: 'none', border: 'none', color: '#10B981', cursor: 'pointer', fontWeight: '800' }}>
                      Resend OTP
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #E2E8F0', fontSize: '0.78rem', color: '#64748B' }}>
          New delivery partner?{' '}
          <Link to="/register" style={{ color: '#10B981', fontWeight: '900', textDecoration: 'none' }}>
            Visit Hub for Onboarding
          </Link>
        </div>
      </div>
    </div>
  );
}
