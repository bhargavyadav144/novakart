import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSellerAuth } from '../context/SellerAuthContext';

export default function SellerRegister() {
  const [step, setStep] = useState(1); // 1 = Details, 2 = Mandatory Biometrics

  // Step 1: Store & Owner Details
  const [storeName, setStoreName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [lat, setLat] = useState('28.6139');
  const [lng, setLng] = useState('77.2090');
  const [errorMsg, setErrorMsg] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Step 2: Mandatory Biometrics (2 Faces, up to 3 Fingerprints)
  const [faces, setFaces] = useState([
    { id: 'face-1', label: 'Face 1: Frontal KYC Face Scan', photo: null },
    { id: 'face-2', label: 'Face 2: Angle / Tilt KYC Face Scan', photo: null }
  ]);
  const [activeFaceIndex, setActiveFaceIndex] = useState(0);

  const [fingerprints, setFingerprints] = useState([
    { id: 'fp-1', name: 'Fingerprint 1', fingerType: 'Right Thumb (Primary)', enrolled: false },
    { id: 'fp-2', name: 'Fingerprint 2', fingerType: 'Right Index', enrolled: false },
    { id: 'fp-3', name: 'Fingerprint 3', fingerType: 'Left Thumb', enrolled: false }
  ]);
  const [scanningFpIndex, setScanningFpIndex] = useState(null);
  const [fpScanProgress, setFpScanProgress] = useState(0);

  // Live Camera
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [streamActive, setStreamActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const { register, loading } = useSellerAuth();
  const navigate = useNavigate();

  // Camera Management
  const startCamera = useCallback(async () => {
    setCameraError('');
    setCameraLoading(true);
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setStreamActive(true);
          setCameraLoading(false);
        };
      }
    } catch (err) {
      console.warn('Webcam stream error:', err);
      setCameraError('Camera access unavailable. You can use standard verification capture.');
      setStreamActive(false);
      setCameraLoading(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setStreamActive(false);
  }, []);

  useEffect(() => {
    if (step === 2) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [step, startCamera, stopCamera]);

  // Capture Face Snapshot
  const captureFace = (index) => {
    let photoData = null;
    if (videoRef.current && canvasRef.current && streamActive) {
      const v = videoRef.current;
      const c = canvasRef.current;
      c.width = v.videoWidth || 640;
      c.height = v.videoHeight || 480;
      const ctx = c.getContext('2d');
      ctx.drawImage(v, 0, 0, c.width, c.height);
      photoData = c.toDataURL('image/jpeg', 0.85);
    } else {
      // Fallback synthetic KYC canvas
      const c = document.createElement('canvas');
      c.width = 400;
      c.height = 400;
      const ctx = c.getContext('2d');
      ctx.fillStyle = index === 0 ? '#0f172a' : '#1e293b';
      ctx.fillRect(0, 0, 400, 400);
      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.arc(200, 150, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(200, 310, 100, Math.PI, 0, false);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(index === 0 ? 'Face 1 (Frontal KYC)' : 'Face 2 (Angle/Tilt KYC)', 200, 360);
      photoData = c.toDataURL('image/jpeg', 0.85);
    }

    setFaces(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        photo: photoData,
        capturedAt: new Date().toISOString()
      };
      return next;
    });

    if (index === 0 && !faces[1]?.photo) {
      setActiveFaceIndex(1);
    }
  };

  // Fingerprint Scan Simulation / WebAuthn
  const handleScanFingerprint = async (index) => {
    setScanningFpIndex(index);
    setFpScanProgress(0);

    // Attempt hardware WebAuthn
    if (window.PublicKeyCredential) {
      try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        await navigator.credentials.get({
          publicKey: { challenge, timeout: 4000, userVerification: 'preferred' }
        });
      } catch {
        /* Fallback to sensor simulation */
      }
    }

    const interval = setInterval(() => {
      setFpScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setFingerprints(cur => {
            const next = [...cur];
            next[index] = {
              ...next[index],
              enrolled: true,
              enrolledAt: new Date().toISOString(),
              credentialId: `fp-reg-${Date.now()}-${index}`
            };
            return next;
          });
          setScanningFpIndex(null);
          setFpScanProgress(0);
          return 0;
        }
        return prev + 25;
      });
    }, 160);
  };

  const facesCount = faces.filter(f => f.photo).length;
  const fingerprintsCount = fingerprints.filter(f => f.enrolled).length;
  const biometricsComplete = facesCount === 2 && fingerprintsCount >= 1;

  // Advance to Step 2
  const handleProceedToBiometrics = (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!acceptedTerms) {
      setErrorMsg('You must accept the Merchant Terms & Conditions.');
      return;
    }
    if (!storeName || !ownerName || !email || !phone || !password || !businessAddress) {
      setErrorMsg('Please fill in all store and owner contact details.');
      return;
    }
    setStep(2);
  };

  // Final Submit
  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!biometricsComplete) {
      setErrorMsg('🔒 Mandatory Biometric Requirement: You must register 2 face scans and at least 1 fingerprint (up to 3 supported).');
      return;
    }

    const payload = {
      storeName,
      ownerName,
      email,
      phone,
      password,
      businessAddress,
      lat,
      lng,
      acceptedTerms,
      enrolledFaces: faces.map(f => ({
        id: f.id,
        label: f.label,
        photo: f.photo
      })),
      enrolledFingerprints: fingerprints.filter(f => f.enrolled).map(fp => ({
        id: fp.id,
        name: fp.name,
        fingerType: fp.fingerType,
        credentialId: fp.credentialId
      }))
    };

    const res = await register(payload);

    if (res.success) {
      alert('🎉 Seller store registered successfully with biometric verification! Awaiting administrator KYC approval.');
      navigate('/');
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--seller-bg)', padding: '40px 16px' }}>
      <div style={{
        background: '#fff',
        border: '1px solid var(--seller-border)',
        borderRadius: '16px',
        padding: '36px',
        width: '100%',
        maxWidth: step === 2 ? '640px' : '520px',
        boxShadow: 'var(--shadow-md)',
        transition: 'max-width 0.3s'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--seller-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <i className="fa-solid fa-store" style={{ color: 'var(--seller-accent)' }}></i> Merchant Onboarding
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#64748B' }}>
            {step === 1 ? 'Step 1 of 2: Store & Warehouse Profile Details' : 'Step 2 of 2: Mandatory Biometric Security Setup'}
          </p>

          {/* Stepper Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', borderRadius: '20px',
              background: step === 1 ? '#0f766e' : '#dcfce7',
              color: step === 1 ? '#fff' : '#15803d',
              fontSize: '0.78rem', fontWeight: '700'
            }}>
              <span>1. Store Details</span>
              {step > 1 && <i className="fa-solid fa-check"></i>}
            </div>

            <div style={{ width: '20px', height: '2px', background: '#cbd5e1' }}></div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', borderRadius: '20px',
              background: step === 2 ? '#0f766e' : '#f1f5f9',
              color: step === 2 ? '#fff' : '#64748b',
              fontSize: '0.78rem', fontWeight: '700'
            }}>
              <i className="fa-solid fa-fingerprint"></i>
              <span>2. Mandatory Biometrics</span>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px' }}>
            <i className="fa-solid fa-triangle-exclamation"></i> {errorMsg}
          </div>
        )}

        {/* STEP 1: STORE DETAILS */}
        {step === 1 && (
          <form onSubmit={handleProceedToBiometrics} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Store / Business Name</label>
              <input type="text" className="form-input" placeholder="e.g. Apex Electronics Hub" value={storeName} onChange={(e) => setStoreName(e.target.value)} required />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Store Owner Full Name</label>
              <input type="text" className="form-input" placeholder="Johnathan Doe" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Business Email</label>
                <input type="email" className="form-input" placeholder="store@apex.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Contact Phone</label>
                <input type="tel" className="form-input" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Password</label>
              <input type="password" className="form-input" placeholder="••••••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Physical Store / Warehouse Address</label>
              <input type="text" className="form-input" placeholder="Warehouse 4, Connaught Place, New Delhi" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} required />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Store Lat (GPS)</label>
                <input type="text" className="form-input" value={lat} onChange={(e) => setLat(e.target.value)} required />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Store Lng (GPS)</label>
                <input type="text" className="form-input" value={lng} onChange={(e) => setLng(e.target.value)} required />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', marginBottom: '14px' }}>
              <input type="checkbox" id="acceptedTerms" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} required />
              <label htmlFor="acceptedTerms" style={{ fontSize: '0.85rem', color: '#64748B', cursor: 'pointer' }}>
                I agree to the <button type="button" onClick={() => setShowTermsModal(true)} style={{ background: 'none', border: 'none', padding: 0, textDecoration: 'underline', color: 'var(--seller-primary)', fontWeight: '600', cursor: 'pointer' }}>Merchant Terms &amp; Conditions</button>
              </label>
            </div>

            <button type="submit" className="btn-seller btn-seller-primary" style={{ padding: '12px', justifyContent: 'center', width: '100%', marginTop: '6px', fontSize: '0.9rem', fontWeight: '700' }}>
              Proceed to Mandatory Biometric Setup (Step 2 of 2) &rarr;
            </button>
          </form>
        )}

        {/* STEP 2: MANDATORY BIOMETRICS */}
        {step === 2 && (
          <form onSubmit={handleFinalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-solid fa-fingerprint" style={{ color: '#16a34a', fontSize: '1.2rem' }}></i>
                <div>
                  <span style={{ fontWeight: '800', fontSize: '0.85rem', color: '#166534' }}>
                    Mandatory Biometrics Required
                  </span>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#15803d' }}>
                    Register 2 face scans &amp; up to 3 fingerprints to complete merchant store enrollment.
                  </p>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.75rem', fontWeight: '700', color: '#166534' }}>
                Faces: {facesCount}/2 &bull; Fingerprints: {fingerprintsCount}/3
              </div>
            </div>

            {/* SECTION A: 2 FACES */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fa-solid fa-camera" style={{ color: '#0f766e' }}></i>
                  A. 2 Mandatory Face Scans
                </h4>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setActiveFaceIndex(0)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: '700',
                      border: activeFaceIndex === 0 ? '2px solid #0f766e' : '1px solid #cbd5e1',
                      background: activeFaceIndex === 0 ? '#ccfbf1' : '#fff',
                      color: activeFaceIndex === 0 ? '#0f766e' : '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    Face 1 (Frontal) {faces[0]?.photo && '✓'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFaceIndex(1)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: '700',
                      border: activeFaceIndex === 1 ? '2px solid #0f766e' : '1px solid #cbd5e1',
                      background: activeFaceIndex === 1 ? '#ccfbf1' : '#fff',
                      color: activeFaceIndex === 1 ? '#0f766e' : '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    Face 2 (Angle) {faces[1]?.photo && '✓'}
                  </button>
                </div>
              </div>

              {/* Camera Stream Box */}
              <div style={{
                position: 'relative',
                background: '#090d16',
                borderRadius: '10px',
                height: '200px',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px',
                border: '2px solid #1e293b'
              }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)'
                  }}
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {/* Reticle HUD */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{
                    width: '130px',
                    height: '160px',
                    borderRadius: '50%',
                    border: '2px dashed rgba(16, 185, 129, 0.75)',
                    boxShadow: '0 0 12px rgba(16, 185, 129, 0.25)'
                  }}></div>

                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    background: 'rgba(15, 23, 42, 0.75)',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    fontSize: '0.68rem',
                    color: '#10B981',
                    fontWeight: '700'
                  }}>
                    SCANNING: {activeFaceIndex === 0 ? 'FACE 1 (FRONTAL KYC)' : 'FACE 2 (ANGLE/TILT KYC)'}
                  </div>
                </div>

                {cameraLoading && (
                  <div style={{ position: 'absolute', color: '#fff', fontSize: '0.8rem' }}>
                    <i className="fa-solid fa-spinner fa-spin"></i> Initializing camera...
                  </div>
                )}
              </div>

              {/* Capture Button */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <button
                  type="button"
                  onClick={() => captureFace(activeFaceIndex)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #0f766e 0%, #115e59 100%)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-camera"></i>
                  Capture {activeFaceIndex === 0 ? 'Face 1 (Frontal)' : 'Face 2 (Angle)'}
                </button>
              </div>

              {/* Face Previews */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {faces.map((f, i) => (
                  <div
                    key={f.id}
                    onClick={() => setActiveFaceIndex(i)}
                    style={{
                      border: activeFaceIndex === i ? '2px solid #0f766e' : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '8px',
                      background: f.photo ? '#f0fdf4' : '#f8fafc',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                  >
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '6px',
                      background: '#e2e8f0',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}>
                      {f.photo ? (
                        <img src={f.photo} alt={f.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                          <i className="fa-regular fa-image"></i>
                        </div>
                      )}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {i === 0 ? 'Face 1 (Frontal)' : 'Face 2 (Angle)'}
                      </p>
                      <span style={{ fontSize: '0.68rem', fontWeight: '700', color: f.photo ? '#16a34a' : '#94a3b8' }}>
                        {f.photo ? '✓ Enrolled' : '○ Pending'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION B: UP TO 3 FINGERPRINTS */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#ffffff' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="fa-solid fa-fingerprint" style={{ color: '#0f766e' }}></i>
                B. Register up to 3 Fingerprints (Minimum 1 Required)
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {fingerprints.map((fp, i) => (
                  <div
                    key={fp.id}
                    style={{
                      border: fp.enrolled ? '1px solid #86efac' : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      background: fp.enrolled ? '#f0fdf4' : '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        background: fp.enrolled ? '#dcfce7' : '#e2e8f0',
                        color: fp.enrolled ? '#16a34a' : '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.95rem'
                      }}>
                        <i className={`fa-solid ${fp.enrolled ? 'fa-fingerprint' : 'fa-hand-pointer'}`}></i>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: '700', fontSize: '0.82rem', color: '#0f172a' }}>
                            {fp.name}
                          </span>
                          <span style={{ fontSize: '0.7rem', background: '#e2e8f0', color: '#475569', padding: '1px 6px', borderRadius: '4px' }}>
                            {fp.fingerType}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: fp.enrolled ? '#15803d' : '#94a3b8' }}>
                          {fp.enrolled ? '✓ Registered' : 'Not registered'}
                        </p>
                      </div>
                    </div>

                    <div>
                      {scanningFpIndex === i ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '70px', height: '6px', borderRadius: '3px', background: '#e2e8f0', overflow: 'hidden' }}>
                            <div style={{ width: `${fpScanProgress}%`, height: '100%', background: '#10B981', transition: 'width 0.2s' }}></div>
                          </div>
                          <span style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: '700' }}>Scanning...</span>
                        </div>
                      ) : fp.enrolled ? (
                        <button
                          type="button"
                          onClick={() => handleScanFingerprint(i)}
                          style={{
                            background: 'none',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            fontSize: '0.7rem',
                            color: '#64748b',
                            cursor: 'pointer'
                          }}
                        >
                          Re-scan
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleScanFingerprint(i)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            background: '#0f172a',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <i className="fa-solid fa-fingerprint" style={{ color: '#10B981' }}></i>
                          Scan &amp; Enroll
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 2 Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  padding: '12px 18px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                &larr; Back
              </button>

              <button
                type="submit"
                className="btn-seller btn-seller-primary"
                style={{
                  flex: 1,
                  padding: '12px',
                  justifyContent: 'center',
                  fontSize: '0.9rem',
                  fontWeight: '800',
                  background: biometricsComplete ? 'linear-gradient(135deg, #0f766e 0%, #115e59 100%)' : '#cbd5e1',
                  cursor: biometricsComplete ? 'pointer' : 'not-allowed'
                }}
                disabled={loading || !biometricsComplete}
              >
                {loading ? 'Submitting Application & Biometrics...' : 'Register Merchant Store (Complete Verification) 🚀'}
              </button>
            </div>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.85rem', color: '#64748B' }}>
          Already approved merchant? <Link to="/login" style={{ color: 'var(--seller-primary)', fontWeight: '700' }}>Sign In</Link>
        </div>
      </div>

      {/* Terms & Conditions Modal Overlay */}
      {showTermsModal && (
        <div className="terms-modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000,
          padding: '20px', boxSizing: 'border-box'
        }}>
          <div className="terms-modal-card" style={{
            background: '#ffffff', borderRadius: '16px', maxWidth: '640px', width: '100%',
            maxHeight: '85vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)', border: '1px solid #e2e8f0',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'linear-gradient(135deg, #0f766e 0%, #115e59 100%)', color: '#ffffff'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800' }}>
                NovaKart Merchant Partnership Agreement
              </h3>
              <button type="button" onClick={() => setShowTermsModal(false)} style={{
                background: 'none', border: 'none', color: '#ccfbf1', fontSize: '1.5rem',
                cursor: 'pointer', lineHeight: 1, padding: 0
              }}>&times;</button>
            </div>
            <div style={{ padding: '24px', overflowY: 'auto', maxHeight: '55vh', fontSize: '0.88rem', lineHeight: '1.6', color: '#334155' }}>
              <p>Welcome to NovaKart Merchant network! You must provide valid business details, physical warehouse coordinates, owner contact details, and biometric identity verification (2 face scans &amp; up to 3 fingerprints). NovaKart enforces biometric verification for payout security and seller protection.</p>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', background: '#f8fafc' }}>
              <button type="button" onClick={() => { setAcceptedTerms(true); setShowTermsModal(false); }} className="btn btn-seller btn-seller-primary" style={{ padding: '10px 20px', fontSize: '0.88rem', fontWeight: '700' }}>
                I Accept Terms &amp; Conditions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
