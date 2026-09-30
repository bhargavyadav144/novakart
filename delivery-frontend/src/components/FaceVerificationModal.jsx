import React, { useEffect, useRef, useState } from 'react';
import deliveryApi from '../services/deliveryApi';
import { useDeliveryAuth } from '../context/DeliveryAuthContext';

export default function FaceVerificationModal({ isOpen, onClose, onVerifiedSuccess }) {
  const { agentUser, updateAgentUser } = useDeliveryAuth() || {};
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const nativeCameraInputRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [cameraError, setCameraError] = useState(''); // '' | 'MOBILE_HTTP' | 'PERMISSION_DENIED' | 'CAMERA_IN_USE' | 'UNSUPPORTED'
  const [facingMode, setFacingMode] = useState('user'); // 'user' | 'environment'
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const [capturedPhotos, setCapturedPhotos] = useState([]); // [{ angle, dataUrl, trackingId, capturedAt, coords, source }]
  const [activeAngle, setActiveAngle] = useState('FRONT'); // 'FRONT' | 'LEFT' | 'RIGHT'
  const [submitting, setSubmitting] = useState(false);
  const [shutterFlash, setShutterFlash] = useState(false);
  const [verifiedResult, setVerifiedResult] = useState(null);
  const [currentCoords, setCurrentCoords] = useState({ lat: 16.3067, lng: 80.4365 });

  // Get agent geolocation for biometric tracking
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCurrentCoords({
            lat: Number(pos.coords.latitude.toFixed(5)),
            lng: Number(pos.coords.longitude.toFixed(5))
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  // Check for multiple video input devices (front/back camera flip)
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        if (videoInputs.length > 1) {
          setHasMultipleCameras(true);
        }
      }).catch(() => {});
    }
  }, []);

  // Web Audio camera shutter sound synthesizer
  const playShutterSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.08);
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.09);
    } catch {
      // AudioContext unavailable
    }
  };

  // Start Live WebCam / Video Stream
  const startLiveCamera = async (mode = facingMode) => {
    setCameraError('');
    stopLiveCameraStream();

    const isSecure = typeof window !== 'undefined' && (
      window.isSecureContext ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.protocol === 'https:'
    );

    if (!isSecure) {
      // Over plain HTTP LAN (e.g. mobile accessing 172.16.x.x:3002), browsers block WebRTC getUserMedia
      setCameraError('MOBILE_HTTP');
      setIsStreaming(false);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('UNSUPPORTED');
      setIsStreaming(false);
      return;
    }

    try {
      let mediaStream = null;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: mode,
            width: { ideal: 720 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (e1) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: mode },
            audio: false
          });
        } catch (e2) {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        }
      }

      if (mediaStream) {
        setStream(mediaStream);
        setIsStreaming(true);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Camera stream error:', err);
      setIsStreaming(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('PERMISSION_DENIED');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError('CAMERA_IN_USE');
      } else {
        setCameraError(err.message || 'UNSUPPORTED');
      }
    }
  };

  const stopLiveCameraStream = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  };

  // Toggle Front / Back camera
  const toggleFacingMode = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    startLiveCamera(nextMode);
  };

  // Start stream when modal opens
  useEffect(() => {
    if (isOpen) {
      startLiveCamera();
    } else {
      stopLiveCameraStream();
    }
    return () => {
      stopLiveCameraStream();
    };
  }, [isOpen]);

  // Stamp Biometric Watermark on Canvas
  const stampBiometricWatermark = (ctx, w, h, trackingId) => {
    const barH = 75;
    const barY = h - barH;

    // Bottom dark gradient strip
    const grad = ctx.createLinearGradient(0, barY, 0, h);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.88)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0.98)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, barY, w, barH);

    // Top-left live badge
    ctx.fillStyle = 'rgba(16, 185, 129, 0.92)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(16, 16, 175, 28, 6) : ctx.rect(16, 16, 175, 28);
    ctx.fill();
    ctx.fillStyle = '#064E3B';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('● KYC LIVE BIOMETRIC', 26, 35);

    // Bottom tracking details
    ctx.fillStyle = '#34D399';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`NOVAKART FLEET KYC • GPS: ${currentCoords.lat}, ${currentCoords.lng}`, 18, barY + 26);

    ctx.fillStyle = '#E2E8F0';
    ctx.font = '11px monospace';
    ctx.fillText(`TRACK-ID: BIO-${trackingId}`, 18, barY + 46);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '11px monospace';
    ctx.fillText(`TIMESTAMP: ${new Date().toLocaleString('en-IN')}`, 18, barY + 64);
  };

  // Add captured photo to state
  const commitPhoto = (dataUrl, source) => {
    const trackingId = `${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const newPhoto = {
      angle: activeAngle,
      dataUrl,
      trackingId: `BIO-${trackingId}`,
      capturedAt: new Date().toISOString(),
      coords: currentCoords,
      source
    };

    setCapturedPhotos((prev) => [...prev, newPhoto]);
    playShutterSound();
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 200);

    // Advance angle guide
    if (activeAngle === 'FRONT') setActiveAngle('LEFT');
    else if (activeAngle === 'LEFT') setActiveAngle('RIGHT');
  };

  // Capture photo from Live In-Browser Video Stream
  const handleCaptureLiveStream = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = 720;
    const height = 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const minDim = Math.min(vw, vh);
    const sx = (vw - minDim) / 2;
    const sy = (vh - minDim) / 2;

    if (facingMode === 'user') {
      ctx.save();
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, sx, sy, minDim, minDim, 0, 0, width, height);
      ctx.restore();
    } else {
      ctx.drawImage(video, sx, sy, minDim, minDim, 0, 0, width, height);
    }

    const trackingId = `${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    stampBiometricWatermark(ctx, width, height, trackingId);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    commitPhoto(dataUrl, 'live_webcam');
  };

  // Trigger Native Device Camera Hardware (Mobile or Desktop Native Camera)
  const triggerNativeCamera = () => {
    if (nativeCameraInputRef.current) {
      nativeCameraInputRef.current.click();
    }
  };

  // Handle Real Photo captured from Device Native Camera
  const handleNativeCameraFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        const width = 720;
        const height = 720;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        const minDim = Math.min(iw, ih);
        const sx = (iw - minDim) / 2;
        const sy = (ih - minDim) / 2;

        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, width, height);

        const trackingId = `${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;
        stampBiometricWatermark(ctx, width, height, trackingId);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        commitPhoto(dataUrl, 'device_hardware_camera');

        // Reset file input so user can snap another photo
        if (nativeCameraInputRef.current) {
          nativeCameraInputRef.current.value = '';
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = (index) => {
    setCapturedPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Verified Real Photos to Backend
  const handleSubmitVerification = async () => {
    if (capturedPhotos.length === 0) {
      alert('Please capture at least 1 real face photo before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const primaryPhoto = capturedPhotos[0].dataUrl;
      const additionalPhotos = capturedPhotos.slice(1).map((p) => p.dataUrl);
      const trackingMeta = {
        trackingId: capturedPhotos[0].trackingId,
        capturedAt: capturedPhotos[0].capturedAt,
        coordinates: capturedPhotos[0].coords,
        totalAnglesCaptured: capturedPhotos.length,
        deviceUserAgent: navigator.userAgent,
        captureSource: capturedPhotos[0].source
      };

      const res = await deliveryApi.post('/delivery/verify-face', {
        facePhoto: primaryPhoto,
        additionalPhotos,
        trackingMeta,
        forceUpdate: true
      });

      if (res.data.success) {
        setVerifiedResult({
          photo: primaryPhoto,
          trackingId: trackingMeta.trackingId,
          verifiedAt: res.data.faceVerifiedAt || new Date().toISOString(),
          coords: trackingMeta.coordinates
        });

        if (updateAgentUser) {
          updateAgentUser({
            isFaceVerified: true,
            faceVerificationPhoto: primaryPhoto,
            faceVerifiedAt: res.data.faceVerifiedAt || new Date().toISOString()
          });
        }
        stopLiveCameraStream();
        if (onVerifiedSuccess) onVerifiedSuccess(res.data);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Face verification submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.94)',
      backdropFilter: 'blur(12px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      {/* Hidden real camera file input for native mobile/desktop hardware camera capture */}
      <input
        ref={nativeCameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleNativeCameraFile}
        style={{ display: 'none' }}
      />

      <div style={{
        background: '#0F172A',
        border: '1px solid #334155',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '460px',
        color: '#FFF',
        overflow: 'hidden',
        boxShadow: '0 25px 50px rgba(0,0,0,0.7)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        {/* Shutter flash animation overlay */}
        {shutterFlash && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: '#FFFFFF',
            zIndex: 100,
            pointerEvents: 'none',
            opacity: 0.85,
            transition: 'opacity 0.2s'
          }} />
        )}

        {/* Header */}
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
          borderBottom: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: '#10B981',
              color: '#090D16',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              fontWeight: '900'
            }}>
              <i className="fa-solid fa-camera"></i>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '900', color: '#FFF' }}>
                Real Camera Verification
              </h3>
              <p style={{ margin: 0, fontSize: '0.7rem', color: '#94A3B8' }}>
                Live Biometric Capture &bull; Photo Audit Tracking
              </p>
            </div>
          </div>
          <button
            onClick={() => { stopLiveCameraStream(); onClose(); }}
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: '#94A3B8',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              fontSize: '1.2rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            &times;
          </button>
        </div>

        {/* Verification Success View with Photo Audit */}
        {verifiedResult ? (
          <div style={{ padding: '28px 24px', textAlign: 'center' }}>
            <div style={{
              width: '70px',
              height: '70px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10B981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.4rem',
              margin: '0 auto 16px auto',
              border: '2px solid #10B981',
              boxShadow: '0 0 25px rgba(16, 185, 129, 0.35)'
            }}>
              <i className="fa-solid fa-circle-check"></i>
            </div>

            <h2 style={{ fontSize: '1.3rem', fontWeight: '900', color: '#FFF', margin: '0 0 6px 0' }}>
              Real Face Verified &amp; Tracked!
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#94A3B8', margin: '0 0 20px 0' }}>
              Your real biometric camera photo has been permanently verified and recorded into your delivery profile.
            </p>

            {/* Tracked Photo Card */}
            <div style={{
              background: '#1E293B',
              border: '1px solid #10B981',
              borderRadius: '16px',
              padding: '16px',
              textAlign: 'left',
              marginBottom: '20px',
              display: 'flex',
              gap: '16px',
              alignItems: 'center'
            }}>
              <img
                src={verifiedResult.photo}
                alt="Verified Biometric Face"
                style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '12px',
                  objectFit: 'cover',
                  border: '2px solid #10B981',
                  flexShrink: 0
                }}
              />
              <div style={{ overflow: 'hidden' }}>
                <div style={{ display: 'inline-block', background: '#064E3B', color: '#34D399', fontSize: '0.65rem', fontWeight: '800', padding: '2px 8px', borderRadius: '4px', marginBottom: '6px' }}>
                  <i className="fa-solid fa-lock"></i> AUDIT SEALED
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: '600' }}>
                  Track ID: <span style={{ color: '#FFF', fontFamily: 'monospace' }}>{verifiedResult.trackingId}</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '2px' }}>
                  Time: <span style={{ color: '#FFF' }}>{new Date(verifiedResult.verifiedAt).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '2px' }}>
                  GPS: <span style={{ color: '#34D399', fontFamily: 'monospace' }}>{verifiedResult.coords.lat}, {verifiedResult.coords.lng}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => { onClose(); }}
              style={{
                width: '100%',
                padding: '14px',
                background: '#10B981',
                color: '#090D16',
                border: 'none',
                borderRadius: '12px',
                fontWeight: '900',
                fontSize: '0.95rem',
                cursor: 'pointer'
              }}
            >
              Continue to Delivery Fleet
            </button>
          </div>
        ) : (
          /* Camera View & Capture Screen */
          <div style={{ padding: '20px', textAlign: 'center' }}>
            {/* Live Video Viewfinder when stream is active */}
            {isStreaming ? (
              <div style={{
                position: 'relative',
                width: '270px',
                height: '270px',
                margin: '0 auto',
                borderRadius: '50%',
                overflow: 'hidden',
                border: '4px solid #10B981',
                boxShadow: '0 0 30px rgba(16, 185, 129, 0.45)',
                background: '#090D16'
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
                    transform: facingMode === 'user' ? 'scaleX(-1)' : 'none'
                  }}
                />

                {/* Oval Face Guide Overlay */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{
                    width: '180px',
                    height: '220px',
                    borderRadius: '50%',
                    border: '2px dashed #10B981',
                    boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative'
                  }}>
                    {/* Animated scanning laser line */}
                    <div style={{
                      position: 'absolute',
                      top: '15%',
                      left: '5%',
                      right: '5%',
                      height: '2px',
                      background: 'linear-gradient(90deg, transparent, #34D399, transparent)',
                      boxShadow: '0 0 10px #34D399',
                      animation: 'scanBeam 2s infinite ease-in-out'
                    }} />

                    <span style={{
                      fontSize: '0.62rem',
                      fontWeight: '800',
                      color: '#10B981',
                      background: 'rgba(15, 23, 42, 0.9)',
                      padding: '3px 8px',
                      borderRadius: '10px',
                      textTransform: 'uppercase',
                      border: '1px solid #10B981'
                    }}>
                      Align Face Here
                    </span>
                  </div>
                </div>

                {/* Live Tracking HUD Pill */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid #10B981',
                  borderRadius: '20px',
                  padding: '3px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.62rem',
                  fontWeight: '800',
                  color: '#34D399',
                  whiteSpace: 'nowrap'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px #10B981' }}></span>
                  REAL WEBCAM ACTIVE
                </div>

                {/* Flip camera button if multiple cameras detected */}
                {hasMultipleCameras && (
                  <button
                    type="button"
                    onClick={toggleFacingMode}
                    style={{
                      position: 'absolute',
                      bottom: '12px',
                      right: '12px',
                      background: 'rgba(15, 23, 42, 0.85)',
                      border: '1px solid #334155',
                      color: '#FFF',
                      borderRadius: '50%',
                      width: '36px',
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                    title="Flip Camera"
                  >
                    <i className="fa-solid fa-camera-rotate"></i>
                  </button>
                )}
              </div>
            ) : (
              /* Real Device Camera Card (Always working on mobile HTTP LAN & desktop) */
              <div style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)',
                border: '1px solid #334155',
                borderRadius: '20px',
                padding: '24px 20px',
                color: '#FFF',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10B981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2.5rem',
                  margin: '0 auto 16px auto',
                  border: '2px solid #10B981',
                  boxShadow: '0 0 25px rgba(16, 185, 129, 0.3)'
                }}>
                  <i className="fa-solid fa-camera"></i>
                </div>

                <div style={{ display: 'inline-block', background: '#064E3B', color: '#34D399', fontSize: '0.72rem', fontWeight: '800', padding: '4px 10px', borderRadius: '20px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-shield-halved"></i> REAL CAMERA HARDWARE READY
                </div>

                <h4 style={{ fontSize: '1.05rem', fontWeight: '800', margin: '0 0 8px 0', color: '#FFF' }}>
                  Capture Real Face Photo
                </h4>

                <p style={{ fontSize: '0.78rem', color: '#94A3B8', margin: '0 0 20px 0', lineHeight: '1.5' }}>
                  {cameraError === 'MOBILE_HTTP'
                    ? 'Mobile local network mode active. Tap the button below to launch your phone camera and capture your live KYC face photo.'
                    : 'Your device camera is ready. Tap below to launch your camera hardware and take your live biometric photo.'}
                </p>

                <button
                  type="button"
                  onClick={triggerNativeCamera}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    color: '#090D16',
                    border: 'none',
                    borderRadius: '14px',
                    fontWeight: '900',
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
                  }}
                >
                  <i className="fa-solid fa-camera" style={{ fontSize: '1.1rem' }}></i>
                  Open Camera &amp; Take Photo
                </button>

                {cameraError !== 'MOBILE_HTTP' && (
                  <button
                    type="button"
                    onClick={() => startLiveCamera()}
                    style={{
                      marginTop: '12px',
                      background: 'transparent',
                      color: '#94A3B8',
                      border: 'none',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    <i className="fa-solid fa-rotate-right"></i> Retry In-Screen Live Video Stream
                  </button>
                )}
              </div>
            )}

            {/* Hidden canvas for processing */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Position Angle Strip */}
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '0.84rem', fontWeight: '800', color: '#F1F5F9' }}>
                Position: <span style={{ color: '#10B981' }}>{activeAngle} ANGLE</span>
              </div>
              <p style={{ fontSize: '0.72rem', color: '#94A3B8', margin: '4px 0 0 0' }}>
                {capturedPhotos.length === 0
                  ? 'Keep your head steady facing forward & take your real face photo.'
                  : `Angle ${capturedPhotos.length}/3 captured. Take another angle or submit now.`}
              </p>
            </div>

            {/* Captured Real Photos Strip */}
            {capturedPhotos.length > 0 && (
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center', gap: '12px', alignItems: 'center' }}>
                {capturedPhotos.map((photo, idx) => (
                  <div key={idx} style={{ position: 'relative' }}>
                    <img
                      src={photo.dataUrl}
                      alt={`Real Biometric Capture ${idx + 1}`}
                      style={{
                        width: '58px',
                        height: '58px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid #10B981',
                        boxShadow: '0 2px 10px rgba(16,185,129,0.35)'
                      }}
                    />
                    <span style={{
                      position: 'absolute',
                      bottom: '-4px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#0F172A',
                      color: '#34D399',
                      fontSize: '0.55rem',
                      fontWeight: '800',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      border: '1px solid #10B981',
                      whiteSpace: 'nowrap'
                    }}>
                      {photo.angle}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        background: '#EF4444',
                        color: '#FFF',
                        border: 'none',
                        borderRadius: '50%',
                        width: '18px',
                        height: '18px',
                        fontSize: '0.65rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Remove photo"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid #334155',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              {/* Primary Capture Buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={handleCaptureLiveStream}
                    disabled={capturedPhotos.length >= 3}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: capturedPhotos.length >= 3 ? '#334155' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      color: '#090D16',
                      border: 'none',
                      borderRadius: '12px',
                      fontWeight: '900',
                      fontSize: '0.88rem',
                      cursor: capturedPhotos.length >= 3 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    <i className="fa-solid fa-camera"></i> Capture Live Frame ({capturedPhotos.length}/3)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={triggerNativeCamera}
                    disabled={capturedPhotos.length >= 3}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: capturedPhotos.length >= 3 ? '#334155' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      color: '#090D16',
                      border: 'none',
                      borderRadius: '12px',
                      fontWeight: '900',
                      fontSize: '0.88rem',
                      cursor: capturedPhotos.length >= 3 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    <i className="fa-solid fa-camera"></i> Snap Photo with Camera ({capturedPhotos.length}/3)
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSubmitVerification}
                  disabled={capturedPhotos.length === 0 || submitting}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: capturedPhotos.length === 0 ? '#1E293B' : '#2563EB',
                    color: capturedPhotos.length === 0 ? '#64748B' : '#FFF',
                    border: 'none',
                    borderRadius: '12px',
                    fontWeight: '900',
                    fontSize: '0.88rem',
                    cursor: capturedPhotos.length === 0 || submitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: capturedPhotos.length > 0 ? '0 4px 12px rgba(37,99,235,0.4)' : 'none'
                  }}
                >
                  {submitting ? (
                    <><i className="fa-solid fa-circle-notch fa-spin"></i> Verifying KYC...</>
                  ) : (
                    <><i className="fa-solid fa-shield-check"></i> Submit &amp; Verify</>
                  )}
                </button>
              </div>

              {/* Extra button to launch native hardware camera app even if streaming */}
              {isStreaming && (
                <button
                  type="button"
                  onClick={triggerNativeCamera}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    color: '#94A3B8',
                    border: '1px dashed #475569',
                    borderRadius: '8px',
                    padding: '8px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-mobile-screen"></i> Or Snap with Phone Hardware Camera App
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes scanBeam {
          0% { top: 20%; opacity: 0.8; }
          50% { top: 75%; opacity: 1; }
          100% { top: 20%; opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
