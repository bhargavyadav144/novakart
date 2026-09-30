import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import deliveryApi from '../services/deliveryApi';
import BarcodeVisual from './BarcodeVisual';

const SUPPORTED_BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.ITF
];

export default function DoorstepDeliveryScanModal({ isOpen, onClose, order, onDeliveryCompleted, initialMode = 'HANDOVER' }) {
  const [activeTab, setActiveTab] = useState('camera'); // 'camera' | 'manual'
  const [manualCode, setManualCode] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [verifiedBarcode, setVerifiedBarcode] = useState('');
  const [verificationMethod, setVerificationMethod] = useState('BARCODE_SCAN');
  const [scannedAnim, setScannedAnim] = useState(false);

  // Auto-process state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processSuccess, setProcessSuccess] = useState(false);

  // Doorstep Mode: 'HANDOVER' | 'RETURN' | 'UNREACHABLE'
  const [doorstepMode, setDoorstepMode] = useState('HANDOVER');

  // Resend Prepaid Delivery OTP state
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [resendStatusMsg, setResendStatusMsg] = useState('');

  // Doorstep Customer Return state
  const [returnReason, setReturnReason] = useState('Customer changed mind / does not want product');
  const [customReturnReason, setCustomReturnReason] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnOtpSent, setReturnOtpSent] = useState(false);
  const [generatedReturnOtp, setGeneratedReturnOtp] = useState('');
  const [enteredReturnOtp, setEnteredReturnOtp] = useState('');
  const [isRequestingReturnOtp, setIsRequestingReturnOtp] = useState(false);
  const [isConfirmingReturn, setIsConfirmingReturn] = useState(false);
  const [returnSuccess, setReturnSuccess] = useState(false);

  // Customer Unreachable / Not Lifting Call state
  const [unreachableReason, setUnreachableReason] = useState('Customer not answering phone (3+ calls made)');
  const [callAttemptsCount, setCallAttemptsCount] = useState(3);
  const [unreachableNotes, setUnreachableNotes] = useState('');
  const [isSubmittingUnreachable, setIsSubmittingUnreachable] = useState(false);
  const [unreachableSuccess, setUnreachableSuccess] = useState(false);

  // Handover state
  const [handoverNote, setHandoverNote] = useState('Handed to recipient in person');
  const [customNote, setCustomNote] = useState('');
  const [isCashCollected, setIsCashCollected] = useState(false);
  const [prepaidOtp, setPrepaidOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [requestingPerm, setRequestingPerm] = useState(false);
  const [isSecureCtx, setIsSecureCtx] = useState(true);

  const scannerRef = useRef(null);
  const isStartingRef = useRef(false);

  const isCOD = order?.paymentMethod === 'Cash on Delivery (COD)' || order?.paymentMethod === 'COD';
  const targetOrderNum = (order?.orderNumber || '').toUpperCase();
  const rawDigits = targetOrderNum.replace(/[^0-9]/g, '');
  const last6Digits = rawDigits.slice(-6);

  const playBeep = (isSuccess = true) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isSuccess ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(isSuccess ? 880 : 300, ctx.currentTime);
      if (isSuccess) {
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
      }
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {}
  };

  const switchMode = (mode) => {
    setErrorMsg('');
    setResendStatusMsg('');
    if (mode !== 'HANDOVER') {
      stopCamera();
    } else {
      if (activeTab === 'camera' && !isVerified) {
        setTimeout(() => startCamera(), 100);
      }
    }
    setDoorstepMode(mode);
  };

  // ─── 1. Resend Delivery OTP (Prepaid) ───
  const handleResendDeliveryOtp = async () => {
    setIsResendingOtp(true);
    setResendStatusMsg('');
    setErrorMsg('');
    try {
      const { data } = await deliveryApi.post(`/orders/delivery/${order._id}/resend-otp`);
      if (data.success) {
        setResendStatusMsg(`✅ OTP resent! New 4-digit PIN: ${data.otp} (Sent to customer app & SMS)`);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to resend delivery OTP. Please retry.');
    } finally {
      setIsResendingOtp(false);
    }
  };

  // ─── 2. Request Doorstep Return OTP ───
  const handleRequestReturnOtp = async () => {
    setIsRequestingReturnOtp(true);
    setErrorMsg('');
    try {
      const finalReason = customReturnReason.trim() ? `${returnReason} (${customReturnReason.trim()})` : returnReason;
      const { data } = await deliveryApi.post(`/orders/delivery/${order._id}/request-doorstep-return-otp`, {
        reason: finalReason,
        notes: returnNotes
      });
      if (data.success) {
        setReturnOtpSent(true);
        setGeneratedReturnOtp(data.returnOtp || '');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to generate return OTP. Please retry.');
    } finally {
      setIsRequestingReturnOtp(false);
    }
  };

  // ─── 3. Confirm Doorstep Return with OTP ───
  const handleConfirmDoorstepReturn = async () => {
    if (!enteredReturnOtp.trim()) {
      setErrorMsg('Please enter the 4-digit Return PIN provided by the customer.');
      return;
    }
    setIsConfirmingReturn(true);
    setErrorMsg('');
    try {
      const finalReason = customReturnReason.trim() ? `${returnReason} (${customReturnReason.trim()})` : returnReason;
      const { data } = await deliveryApi.post(`/orders/delivery/${order._id}/confirm-doorstep-return`, {
        returnOtp: enteredReturnOtp.trim(),
        reason: finalReason,
        notes: returnNotes
      });
      if (data.success) {
        setReturnSuccess(true);
        playBeep(true);
        setTimeout(() => {
          if (onDeliveryCompleted) {
            onDeliveryCompleted(data.order, `🔄 Doorstep return authorized with OTP. Staged for warehouse return.`);
          }
          onClose();
        }, 1600);
      }
    } catch (err) {
      playBeep(false);
      setErrorMsg(err.response?.data?.message || '❌ Invalid Return OTP! Please ask customer for their 4-digit PIN (or test PIN 9999).');
    } finally {
      setIsConfirmingReturn(false);
    }
  };

  // ─── 4. Mark Customer Unreachable / Not Lifting Call ───
  const handleMarkCustomerUnreachable = async () => {
    setIsSubmittingUnreachable(true);
    setErrorMsg('');
    try {
      const { data } = await deliveryApi.post(`/orders/delivery/${order._id}/customer-unreachable`, {
        reason: unreachableReason,
        callAttempts: callAttemptsCount,
        notes: unreachableNotes
      });
      if (data.success) {
        setUnreachableSuccess(true);
        playBeep(true);
        setTimeout(() => {
          if (onDeliveryCompleted) {
            onDeliveryCompleted(data.order, `📞 Customer unreachable after ${callAttemptsCount} calls. Staged for RTO to hub.`);
          }
          onClose();
        }, 1600);
      }
    } catch (err) {
      playBeep(false);
      setErrorMsg(err.response?.data?.message || 'Failed to mark order as unreachable. Please retry.');
    } finally {
      setIsSubmittingUnreachable(false);
    }
  };

  // Start in-screen camera directly without opening external apps
  const startCamera = async (overrideCameraId = null) => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setRequestingPerm(true);
    setCameraError('');

    try {
      // Check secure context
      const isSec = typeof window !== 'undefined' && (
        window.isSecureContext ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.protocol === 'https:'
      );
      setIsSecureCtx(isSec);

      if (!isSec) {
        throw new Error('SECURE_CONTEXT_REQUIRED');
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('In-screen camera is not supported in this browser mode.');
      }

      // Stop previous instance if running
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch (e) {}
        scannerRef.current = null;
      }

      const container = document.getElementById('doorstep-barcode-reader');
      if (!container) throw new Error('Camera container element not found.');

      const html5QrCode = new Html5Qrcode('doorstep-barcode-reader', {
        formatsToSupport: SUPPORTED_BARCODE_FORMATS,
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      });
      scannerRef.current = html5QrCode;

      const config = {
        fps: 20,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const width = Math.floor(Math.min(viewfinderWidth * 0.92, 330));
          const height = Math.floor(Math.min(viewfinderHeight * 0.76, 210));
          return { width, height };
        },
        aspectRatio: 1.333
      };

      // Prefer rear / environment camera on mobile phones
      const cameraConstraint = overrideCameraId
        ? overrideCameraId
        : { facingMode: { ideal: 'environment' } };

      try {
        await html5QrCode.start(
          cameraConstraint,
          config,
          (decodedText) => {
            handleBarcodeDetected(decodedText, 'BARCODE_SCAN');
          },
          () => {
            // continuous scan frame without match
          }
        );
      } catch (firstErr) {
        console.warn('Initial camera start constraint failed, trying fallback video constraint:', firstErr);
        // Fallback constraint (useful for some desktops or specific mobile cameras)
        await html5QrCode.start(
          true,
          config,
          (decodedText) => {
            handleBarcodeDetected(decodedText, 'BARCODE_SCAN');
          },
          () => {}
        );
      }

      setCameraActive(true);
      setCameraError('');

      // Enumerate cameras for flip button if available
      try {
        const devs = await Html5Qrcode.getCameras();
        if (devs && devs.length > 0) {
          setAvailableCameras(devs);
        }
      } catch (e) {}
    } catch (err) {
      console.warn('Doorstep scanner camera start error:', err);
      setCameraActive(false);

      if (err.message === 'SECURE_CONTEXT_REQUIRED') {
        setCameraError('🔒 Browser requires HTTPS to stream camera in-screen on mobile.');
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera access blocked. Tap the lock/camera icon in your address bar, allow camera, and retry.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError('Camera is currently in use by another app. Please close other camera apps and retry.');
      } else {
        setCameraError(err.message || 'Camera permission required.');
      }
    } finally {
      setRequestingPerm(false);
      isStartingRef.current = false;
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {}
      scannerRef.current = null;
    }
    setCameraActive(false);
  };

  const switchCamera = async () => {
    if (!availableCameras || availableCameras.length <= 1) return;
    const currentIndex = availableCameras.findIndex(c => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    const nextCam = availableCameras[nextIndex];
    setSelectedCameraId(nextCam.id);
    await stopCamera();
    await startCamera(nextCam.id);
  };

  useEffect(() => {
    if (isOpen) {
      setDoorstepMode(initialMode || 'HANDOVER');
      setErrorMsg('');
      setIsVerified(false);
      setVerifiedBarcode('');
      setManualCode('');
      setIsCashCollected(false);
      setPrepaidOtp('');
      setIsProcessing(false);
      setProcessSuccess(false);
      setResendStatusMsg('');
      setReturnOtpSent(false);
      setGeneratedReturnOtp('');
      setEnteredReturnOtp('');
      setReturnSuccess(false);
      setUnreachableSuccess(false);
      setCallAttemptsCount(3);
      setUnreachableNotes('');
      setCustomReturnReason('');

      if (activeTab === 'camera' && (initialMode || 'HANDOVER') === 'HANDOVER') {
        const timer = setTimeout(() => startCamera(), 120);
        return () => clearTimeout(timer);
      }
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab, initialMode]);

  // Handle Barcode Detection: Verify barcode, then prompt for OTP (Prepaid) or Cash Collection (COD)
  const handleBarcodeDetected = async (code, method = 'BARCODE_SCAN') => {
    if (!code || isVerified || isProcessing) return;

    const cleanScanned = String(code).trim().toUpperCase().replace(/^['"#\s]+|['"#\s]+$/g, '');
    const scannedDigits = cleanScanned.replace(/[^0-9]/g, '');

    const isExact = cleanScanned === targetOrderNum || cleanScanned === (order?._id || '').toUpperCase();
    const isSuffix = targetOrderNum.endsWith(cleanScanned) || (scannedDigits.length >= 4 && rawDigits.endsWith(scannedDigits));

    if (isExact || isSuffix) {
      playBeep(true);
      setScannedAnim(true);
      setIsVerified(true);
      setVerifiedBarcode(cleanScanned);
      setVerificationMethod(method);
      setErrorMsg('');
      await stopCamera();

      if (isCOD) {
        setIsCashCollected(false);
      }
    } else {
      playBeep(false);
      setErrorMsg(`⚠️ Mismatch! Scanned "${code}" does not match Order #${order?.orderNumber}. Please point camera at shipping label for ${order?.deliveryAddress?.fullName || 'this customer'}.`);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) {
      setErrorMsg('Please enter the parcel barcode or last 6 digits.');
      return;
    }
    handleBarcodeDetected(manualCode.trim(), 'MANUAL_CODE_ENTRY');
  };

  const handleConfirmPrepaidAndComplete = async () => {
    if (!prepaidOtp.trim()) {
      setErrorMsg('Please enter the 4-digit Delivery OTP provided by the customer.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    const finalNotes = customNote.trim() ? `${handoverNote} - ${customNote.trim()}` : handoverNote;

    try {
      const { data } = await deliveryApi.put(`/orders/delivery/${order._id}/update-status`, {
        status: 'DELIVERED',
        verificationBarcode: verifiedBarcode || order?.orderNumber,
        podMethod: verificationMethod,
        handoverNotes: finalNotes,
        otp: prepaidOtp.trim(),
        cashCollected: 0
      });

      if (data.success) {
        setProcessSuccess(true);
        setTimeout(() => {
          if (onDeliveryCompleted) {
            onDeliveryCompleted(data.order, finalNotes);
          }
          onClose();
        }, 1200);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || '❌ Invalid OTP! Please ask customer for the correct 4-digit Delivery PIN.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmCODAndComplete = async () => {
    if (!isCashCollected) {
      setErrorMsg(`Please collect cash of ₹${order?.totalAmount} and check the cash received box.`);
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    const finalNotes = customNote.trim() ? `${handoverNote} - ${customNote.trim()}` : handoverNote;

    try {
      const { data } = await deliveryApi.put(`/orders/delivery/${order._id}/update-status`, {
        status: 'DELIVERED',
        verificationBarcode: verifiedBarcode || order?.orderNumber,
        podMethod: verificationMethod,
        handoverNotes: finalNotes,
        cashCollected: order?.totalAmount || 0
      });

      if (data.success) {
        setProcessSuccess(true);
        setTimeout(() => {
          if (onDeliveryCompleted) {
            onDeliveryCompleted(data.order, finalNotes);
          }
          onClose();
        }, 1200);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to complete delivery. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchToHttps = () => {
    try {
      const token = localStorage.getItem('novakart_delivery_token') || '';
      const user = localStorage.getItem('novakart_delivery_user') || '';
      let target = `https://${window.location.hostname}:3002${window.location.pathname}`;
      if (token) {
        target += `?auth_token=${encodeURIComponent(token)}&auth_user=${encodeURIComponent(user)}`;
      }
      window.location.href = target;
    } catch (e) {
      window.location.protocol = 'https:';
    }
  };

  if (!isOpen || !order) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(9, 13, 22, 0.92)',
      backdropFilter: 'blur(8px)',
      color: '#FFFFFF',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '14px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <style>{`
        @keyframes podLaserScan {
          0% { top: 8%; opacity: 0.85; }
          50% { top: 92%; opacity: 1; }
          100% { top: 8%; opacity: 0.85; }
        }
        #doorstep-barcode-reader video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 14px !important;
        }
      `}</style>

      <div style={{
        background: '#0F172A',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '460px',
        maxHeight: '94vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)'
      }}>

        {/* ─── 1. HEADER ─── */}
        <div style={{
          padding: '14px 18px',
          background: '#0B1120',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {doorstepMode !== 'HANDOVER' && (
              <button
                type="button"
                onClick={() => switchMode('HANDOVER')}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  color: '#CBD5E1',
                  cursor: 'pointer',
                  fontSize: '0.76rem',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Back to Delivery Handover"
              >
                <i className="fa-solid fa-chevron-left"></i> Delivery
              </button>
            )}
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: (processSuccess || returnSuccess || unreachableSuccess)
                ? '#10B981'
                : doorstepMode === 'RETURN'
                  ? '#EF4444'
                  : doorstepMode === 'UNREACHABLE'
                    ? '#F59E0B'
                    : isVerified
                      ? '#10B981'
                      : '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontSize: '1rem',
              boxShadow: (processSuccess || returnSuccess || unreachableSuccess) ? '0 0 16px #10B981' : 'none'
            }}>
              <i className={
                processSuccess || returnSuccess || unreachableSuccess || (doorstepMode === 'HANDOVER' && isVerified)
                  ? "fa-solid fa-check"
                  : doorstepMode === 'RETURN'
                    ? "fa-solid fa-rotate-left"
                    : doorstepMode === 'UNREACHABLE'
                      ? "fa-solid fa-phone-slash"
                      : "fa-solid fa-barcode"
              }></i>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '800', color: '#FFFFFF' }}>
                {processSuccess
                  ? 'Delivery Completed! 🎉'
                  : returnSuccess
                    ? 'Return Verified! 🔄'
                    : unreachableSuccess
                      ? 'Marked Undelivered 📋'
                      : doorstepMode === 'RETURN'
                        ? 'Doorstep Customer Return'
                        : doorstepMode === 'UNREACHABLE'
                          ? 'Customer Not Responding'
                          : isVerified
                            ? 'Parcel Verified'
                            : 'Auto Barcode Scanner'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.7rem', color: '#94A3B8' }}>
                Order #{order.orderNumber} &bull; {order.deliveryAddress?.city}
              </p>
            </div>
          </div>

          <button
            onClick={() => { stopCamera(); onClose(); }}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              color: '#94A3B8',
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

        {/* ─── 2. BODY CONTENT ─── */}
        <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1 }}>

          {/* Customer & Stop Info Banner */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '10px 14px',
            marginBottom: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '0.68rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>
                  Customer Recipient
                </div>
                <div style={{ fontSize: '0.94rem', fontWeight: '800', color: '#FFFFFF', marginTop: '2px' }}>
                  👤 {order.deliveryAddress?.fullName}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#CBD5E1', marginTop: '2px' }}>
                  📍 {order.deliveryAddress?.street}, {order.deliveryAddress?.city}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{
                  display: 'inline-block',
                  fontSize: '0.7rem',
                  fontWeight: '800',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: isCOD ? '#FEF3C7' : '#DCFCE7',
                  color: isCOD ? '#92400E' : '#166534'
                }}>
                  {isCOD ? `COD: ₹${order.totalAmount}` : 'PREPAID ONLINE'}
                </span>
                <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: '4px', fontFamily: 'monospace' }}>
                  Last 6: <strong>{last6Digits}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#FCA5A5',
              padding: '10px 12px',
              borderRadius: '10px',
              fontSize: '0.78rem',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ color: '#EF4444' }}></i>
              <div style={{ flex: 1 }}>{errorMsg}</div>
            </div>
          )}

          {/* ─── CASE F: DOORSTEP CUSTOMER RETURN VIEW (OTP AUTHORIZED) ─── */}
          {doorstepMode === 'RETURN' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {returnSuccess ? (
                <div style={{
                  padding: '28px 16px',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.15))',
                  border: '1px solid #10B981',
                  borderRadius: '16px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: '#10B981',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.8rem',
                    boxShadow: '0 0 24px rgba(16, 185, 129, 0.8)'
                  }}>
                    <i className="fa-solid fa-check"></i>
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', fontWeight: '900', color: '#FFFFFF' }}>
                      Return Verified &amp; Accepted!
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#6EE7B7' }}>
                      Package verified with customer Return OTP. Staged for warehouse return.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Security Explainer */}
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px'
                  }}>
                    <i className="fa-solid fa-rotate-left" style={{ color: '#EF4444', fontSize: '1.2rem', marginTop: '2px' }}></i>
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: '800', color: '#FCA5A5' }}>
                        Customer Doorstep Return
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#E2E8F0', marginTop: '2px', lineHeight: '1.4' }}>
                        Customer requested to return or reject this parcel. A 4-digit Return PIN is sent to the customer to authorize this return and prevent unauthorized cancellations.
                      </div>
                    </div>
                  </div>

                  {/* Return Reason Selection */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: '#CBD5E1', marginBottom: '8px' }}>
                      Select Return Reason:
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {[
                        'Customer changed mind / does not want product',
                        'Damaged / broken package seal',
                        'Wrong product or size delivered',
                        'Customer unable to pay (COD rejection)',
                        'Quality not as expected',
                        'Other specific reason'
                      ].map((reason) => (
                        <div
                          key={reason}
                          onClick={() => setReturnReason(reason)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: returnReason === reason ? '1px solid #EF4444' : '1px solid rgba(255, 255, 255, 0.1)',
                            background: returnReason === reason ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                            color: returnReason === reason ? '#FCA5A5' : '#CBD5E1',
                            fontSize: '0.76rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          <i className={returnReason === reason ? "fa-solid fa-circle-dot" : "fa-regular fa-circle"} style={{ color: returnReason === reason ? '#EF4444' : '#64748B' }}></i>
                          <span>{reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Custom specific reason note if selected */}
                  {returnReason === 'Other specific reason' && (
                    <div>
                      <input
                        type="text"
                        value={customReturnReason}
                        onChange={(e) => setCustomReturnReason(e.target.value)}
                        placeholder="Type customer's reason..."
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: '#0B1120',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '8px',
                          color: '#FFFFFF',
                          fontSize: '0.8rem',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  )}

                  {/* Step 1: Request Return OTP Button */}
                  {!returnOtpSent ? (
                    <button
                      type="button"
                      onClick={handleRequestReturnOtp}
                      disabled={isRequestingReturnOtp}
                      style={{
                        background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '14px',
                        fontSize: '0.9rem',
                        fontWeight: '800',
                        cursor: isRequestingReturnOtp ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
                        marginTop: '6px'
                      }}
                    >
                      {isRequestingReturnOtp ? (
                        <>
                          <i className="fa-solid fa-spinner fa-spin"></i> Sending Return OTP to Customer...
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-paper-plane"></i> Send Return OTP to Customer Screen &amp; Phone
                        </>
                      )}
                    </button>
                  ) : (
                    /* Step 2: Return OTP Input */
                    <div style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      borderRadius: '14px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: '800', color: '#FCA5A5' }}>
                          Enter Customer 4-Digit Return OTP:
                        </div>
                        <button
                          type="button"
                          onClick={handleRequestReturnOtp}
                          disabled={isRequestingReturnOtp}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#93C5FD',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            textDecoration: 'underline'
                          }}
                        >
                          {isRequestingReturnOtp ? 'Resending...' : 'Resend OTP'}
                        </button>
                      </div>

                      <input
                        type="text"
                        maxLength={4}
                        value={enteredReturnOtp}
                        onChange={(e) => setEnteredReturnOtp(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="4-Digit PIN"
                        style={{
                          width: '100%',
                          padding: '12px',
                          background: '#0B1120',
                          border: '2px solid #EF4444',
                          borderRadius: '10px',
                          color: '#FFFFFF',
                          fontSize: '1.5rem',
                          fontWeight: '900',
                          textAlign: 'center',
                          letterSpacing: '8px',
                          fontFamily: 'monospace',
                          boxSizing: 'border-box'
                        }}
                        autoFocus
                      />

                      <div style={{ fontSize: '0.72rem', color: '#94A3B8', textAlign: 'center' }}>
                        Ask customer for PIN shown on their screen &bull; Test master PIN: <strong>9999</strong> {generatedReturnOtp && `(Live: ${generatedReturnOtp})`}
                      </div>

                      {/* Optional Notes */}
                      <div>
                        <input
                          type="text"
                          value={returnNotes}
                          onChange={(e) => setReturnNotes(e.target.value)}
                          placeholder="Optional rider notes (e.g. package intact, in box)"
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            background: '#0B1120',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: '8px',
                            color: '#FFFFFF',
                            fontSize: '0.78rem',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      {/* Confirm Return Button */}
                      <button
                        type="button"
                        onClick={handleConfirmDoorstepReturn}
                        disabled={isConfirmingReturn || enteredReturnOtp.length < 4}
                        style={{
                          background: enteredReturnOtp.length === 4
                            ? 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)'
                            : 'rgba(255, 255, 255, 0.1)',
                          color: enteredReturnOtp.length === 4 ? '#FFFFFF' : '#94A3B8',
                          border: 'none',
                          borderRadius: '12px',
                          padding: '14px',
                          fontSize: '0.92rem',
                          fontWeight: '800',
                          cursor: enteredReturnOtp.length === 4 && !isConfirmingReturn ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          boxShadow: enteredReturnOtp.length === 4 ? '0 4px 14px rgba(239, 68, 68, 0.5)' : 'none'
                        }}
                      >
                        {isConfirmingReturn ? (
                          <>
                            <i className="fa-solid fa-spinner fa-spin"></i> Verifying Return OTP...
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-box-open"></i> Authorize Return &amp; Stage for Hub
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Back to Delivery Button */}
                  <button
                    type="button"
                    onClick={() => switchMode('HANDOVER')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#94A3B8',
                      fontSize: '0.76rem',
                      cursor: 'pointer',
                      textAlign: 'center',
                      textDecoration: 'underline',
                      marginTop: '4px'
                    }}
                  >
                    ← Customer changed mind? Return to standard delivery
                  </button>
                </>
              )}
            </div>
          )}

          {/* ─── CASE G: CUSTOMER UNREACHABLE / NOT LIFTING CALL VIEW (NO OTP REQUIRED) ─── */}
          {doorstepMode === 'UNREACHABLE' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {unreachableSuccess ? (
                <div style={{
                  padding: '28px 16px',
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.15))',
                  border: '1px solid #F59E0B',
                  borderRadius: '16px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: '#F59E0B',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.8rem',
                    boxShadow: '0 0 24px rgba(245, 158, 11, 0.8)'
                  }}>
                    <i className="fa-solid fa-check"></i>
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', fontWeight: '900', color: '#FFFFFF' }}>
                      Marked as Undelivered
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#FDE68A' }}>
                      Customer unreachable logged ({callAttemptsCount} calls). Order routed for warehouse return.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Alert Banner */}
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px'
                  }}>
                    <i className="fa-solid fa-phone-slash" style={{ color: '#F59E0B', fontSize: '1.2rem', marginTop: '2px' }}></i>
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: '800', color: '#FCD34D' }}>
                        Customer Not Lifting Call / Unreachable
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#E2E8F0', marginTop: '2px', lineHeight: '1.4' }}>
                        Customer cannot be contacted after multiple attempts. <strong>NO OTP IS REQUIRED</strong>. The delivery attempt will be logged and the package staged for return to the warehouse hub.
                      </div>
                    </div>
                  </div>

                  {/* Reason Selection */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: '#CBD5E1', marginBottom: '8px' }}>
                      Select Unreachable Reason:
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {[
                        'Customer not answering phone (3+ calls made)',
                        'Phone switched off / network unreachable',
                        'Premises locked / door closed / nobody home',
                        'Customer requested delivery at another date/time',
                        'Incorrect address / landmark not found'
                      ].map((reason) => (
                        <div
                          key={reason}
                          onClick={() => setUnreachableReason(reason)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: unreachableReason === reason ? '1px solid #F59E0B' : '1px solid rgba(255, 255, 255, 0.1)',
                            background: unreachableReason === reason ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                            color: unreachableReason === reason ? '#FCD34D' : '#CBD5E1',
                            fontSize: '0.76rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          <i className={unreachableReason === reason ? "fa-solid fa-circle-dot" : "fa-regular fa-circle"} style={{ color: unreachableReason === reason ? '#F59E0B' : '#64748B' }}></i>
                          <span>{reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Call Attempts Count */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: '#CBD5E1', marginBottom: '8px' }}>
                      Phone Calls Attempted:
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {[1, 2, 3, 4].map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setCallAttemptsCount(count)}
                          style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: '8px',
                            border: callAttemptsCount === count ? '1.5px solid #F59E0B' : '1px solid rgba(255, 255, 255, 0.1)',
                            background: callAttemptsCount === count ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                            color: callAttemptsCount === count ? '#FCD34D' : '#CBD5E1',
                            fontSize: '0.76rem',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          {count === 4 ? '4+ Calls' : `${count} ${count === 1 ? 'Call' : 'Calls'}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Rider Observation Notes */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: '#CBD5E1', marginBottom: '6px' }}>
                      Rider Notes:
                    </label>
                    <textarea
                      rows={2}
                      value={unreachableNotes}
                      onChange={(e) => setUnreachableNotes(e.target.value)}
                      placeholder="e.g. Knocked on door, waited 5 mins, called customer 3 times with no answer..."
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: '#0B1120',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        color: '#FFFFFF',
                        fontSize: '0.78rem',
                        boxSizing: 'border-box',
                        resize: 'none'
                      }}
                    />
                  </div>

                  {/* Confirm Unreachable Button */}
                  <button
                    type="button"
                    onClick={handleMarkCustomerUnreachable}
                    disabled={isSubmittingUnreachable}
                    style={{
                      background: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '14px',
                      fontSize: '0.92rem',
                      fontWeight: '800',
                      cursor: isSubmittingUnreachable ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(217, 119, 6, 0.4)',
                      marginTop: '4px'
                    }}
                  >
                    {isSubmittingUnreachable ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin"></i> Submitting Delivery Exception...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-triangle-exclamation"></i> Confirm Customer Unreachable &amp; Return to Hub
                      </>
                    )}
                  </button>

                  {/* Back to Delivery Button */}
                  <button
                    type="button"
                    onClick={() => switchMode('HANDOVER')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#94A3B8',
                      fontSize: '0.76rem',
                      cursor: 'pointer',
                      textAlign: 'center',
                      textDecoration: 'underline',
                      marginTop: '4px'
                    }}
                  >
                    ← Customer answered? Return to standard delivery
                  </button>
                </>
              )}
            </div>
          )}

          {/* ─── CASE: NORMAL DELIVERY HANDOVER FLOW ─── */}
          {doorstepMode === 'HANDOVER' && (
            <>
              {/* ─── CASE A: AUTO-PROCESSING IN PROGRESS (PREPAID) ─── */}
              {isProcessing && (
                <div style={{
                  padding: '24px 16px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '16px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '50%',
                    border: '4px solid rgba(16, 185, 129, 0.25)',
                    borderTopColor: '#10B981',
                    animation: 'spin 0.8s linear infinite',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}></div>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: '800', color: '#6EE7B7' }}>
                      Auto-Processing Delivery...
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#CBD5E1' }}>
                      Barcode matched Order #{order.orderNumber}. Submitting proof of delivery...
                    </p>
                  </div>
                </div>
              )}

          {/* ─── CASE B: PROCESS COMPLETED CELEBRATION ─── */}
          {processSuccess && (
            <div style={{
              padding: '28px 16px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.15))',
              border: '1px solid #10B981',
              borderRadius: '16px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: '#10B981',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.8rem',
                boxShadow: '0 0 24px rgba(16, 185, 129, 0.8)'
              }}>
                <i className="fa-solid fa-check"></i>
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', fontWeight: '900', color: '#FFFFFF' }}>
                  Delivered Successfully!
                </h3>
                <div style={{
                  display: 'inline-block',
                  background: 'rgba(16, 185, 129, 0.3)',
                  border: '1px solid #10B981',
                  borderRadius: '20px',
                  padding: '4px 14px',
                  fontSize: '0.84rem',
                  fontWeight: '800',
                  color: '#6EE7B7',
                  marginTop: '4px'
                }}>
                  💰 +₹140 Credited to Wallet
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '0.74rem', color: '#CBD5E1' }}>
                Updating delivery radar...
              </p>
            </div>
          )}

          {/* ─── CASE C: LIVE AUTO SCANNER VIEW ─── */}
          {!isVerified && !isProcessing && !processSuccess && (
            <>
              {/* Tab Switcher: Camera vs Manual Digits */}
              <div style={{
                display: 'flex',
                background: '#0B1120',
                padding: '4px',
                borderRadius: '10px',
                gap: '4px',
                marginBottom: '12px'
              }}>
                <button
                  onClick={() => setActiveTab('camera')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    border: 'none',
                    background: activeTab === 'camera' ? '#2563EB' : 'transparent',
                    color: activeTab === 'camera' ? '#FFFFFF' : '#94A3B8',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-camera"></i> Live Auto Scanner
                </button>

                <button
                  onClick={() => { stopCamera(); setActiveTab('manual'); }}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    border: 'none',
                    background: activeTab === 'manual' ? '#2563EB' : 'transparent',
                    color: activeTab === 'manual' ? '#FFFFFF' : '#94A3B8',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-keyboard"></i> Type 6 Digits
                </button>
              </div>

              {/* Viewfinder: Camera Mode */}
              {activeTab === 'camera' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    position: 'relative',
                    width: '100%',
                    height: '220px',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    background: '#020617',
                    border: scannedAnim ? '2px solid #10B981' : '1px solid rgba(255, 255, 255, 0.15)',
                    boxShadow: scannedAnim ? '0 0 25px rgba(16, 185, 129, 0.6)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '10px'
                  }}>
                    {/* Native in-screen video element */}
                    <div id="doorstep-barcode-reader" style={{ width: '100%', height: '100%' }}></div>

                    {/* Laser reticle overlay */}
                    <div style={{ position: 'absolute', width: '78%', height: '68%', pointerEvents: 'none', zIndex: 10 }}>
                      <span style={{ position: 'absolute', top: 0, left: 0, width: '22px', height: '22px', borderTop: '3px solid #10B981', borderLeft: '3px solid #10B981', borderTopLeftRadius: '6px' }}></span>
                      <span style={{ position: 'absolute', top: 0, right: 0, width: '22px', height: '22px', borderTop: '3px solid #10B981', borderRight: '3px solid #10B981', borderTopRightRadius: '6px' }}></span>
                      <span style={{ position: 'absolute', bottom: 0, left: 0, width: '22px', height: '22px', borderBottom: '3px solid #10B981', borderLeft: '3px solid #10B981', borderBottomLeftRadius: '6px' }}></span>
                      <span style={{ position: 'absolute', bottom: 0, right: 0, width: '22px', height: '22px', borderBottom: '3px solid #10B981', borderRight: '3px solid #10B981', borderBottomRightRadius: '6px' }}></span>

                      <div style={{
                        position: 'absolute',
                        width: '100%',
                        height: '2px',
                        background: '#10B981',
                        boxShadow: '0 0 12px 2px #10B981',
                        animation: 'podLaserScan 1.5s infinite ease-in-out'
                      }}></div>
                    </div>

                    {/* Camera Starting / Requesting permission indicator */}
                    {requestingPerm && (
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(15, 23, 42, 0.92)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 20
                      }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          border: '3px solid rgba(56, 189, 248, 0.2)',
                          borderTopColor: '#38BDF8',
                          animation: 'spin 0.8s linear infinite',
                          marginBottom: '8px'
                        }}></div>
                        <span style={{ fontSize: '0.8rem', color: '#CBD5E1', fontWeight: '700' }}>
                          Starting in-screen camera...
                        </span>
                      </div>
                    )}

                    {/* Insecure context warning (HTTP instead of HTTPS) */}
                    {!cameraActive && cameraError && (
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(15, 23, 42, 0.96)',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        zIndex: 20
                      }}>
                        <i className="fa-solid fa-lock" style={{ fontSize: '1.6rem', color: '#F59E0B', marginBottom: '8px' }}></i>
                        <p style={{ fontSize: '0.76rem', color: '#E2E8F0', lineHeight: '1.4', margin: '0 0 12px 0', maxWidth: '280px' }}>
                          {cameraError}
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '260px' }}>
                          <button
                            type="button"
                            onClick={handleSwitchToHttps}
                            style={{
                              background: 'linear-gradient(135deg, #10B981, #059669)',
                              color: '#FFFFFF',
                              border: 'none',
                              padding: '10px 14px',
                              borderRadius: '20px',
                              fontSize: '0.82rem',
                              fontWeight: '800',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                            }}
                          >
                            <i className="fa-solid fa-shield-halved"></i> Open Secure HTTPS Camera
                          </button>

                          <button
                            type="button"
                            onClick={() => { stopCamera(); setActiveTab('manual'); }}
                            style={{
                              background: 'rgba(255, 255, 255, 0.08)',
                              color: '#CBD5E1',
                              border: '1px solid rgba(255, 255, 255, 0.15)',
                              padding: '8px 12px',
                              borderRadius: '20px',
                              fontSize: '0.78rem',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}
                          >
                            <i className="fa-solid fa-keyboard"></i> Type Last 6 Digits
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Camera Controls Bar */}
                  <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                      <i className="fa-solid fa-bolt" style={{ color: '#10B981' }}></i> Hold package barcode inside frame to auto-scan
                    </span>

                    {availableCameras.length > 1 && (
                      <button
                        onClick={switchCamera}
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '5px 9px',
                          fontSize: '0.74rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title="Switch Camera (Front/Back)"
                      >
                        <i className="fa-solid fa-camera-rotate"></i> Flip
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Mode 2: Type Last 6 Digits */}
              {activeTab === 'manual' && (
                <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px dashed rgba(255, 255, 255, 0.12)' }}>
                    <div style={{ fontSize: '0.76rem', color: '#94A3B8', marginBottom: '8px' }}>
                      Physical shipping label barcode on package:
                    </div>
                    <BarcodeVisual code={order.orderNumber} width={180} height={36} />
                    <div style={{ fontSize: '0.74rem', color: '#38BDF8', marginTop: '6px', fontFamily: 'monospace' }}>
                      Expected code suffix: <strong>{last6Digits}</strong>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#CBD5E1', marginBottom: '6px' }}>
                      Enter Order Code or Last 6 Digits:
                    </label>
                    <input
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder={`e.g. ${last6Digits} or ${order.orderNumber}`}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        background: '#0B1120',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '10px',
                        color: '#FFFFFF',
                        fontSize: '1rem',
                        fontWeight: '700',
                        fontFamily: 'monospace',
                        letterSpacing: '1px',
                        boxSizing: 'border-box'
                      }}
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    style={{
                      background: '#2563EB',
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '12px',
                      borderRadius: '10px',
                      fontSize: '0.88rem',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <i className="fa-solid fa-check"></i> Verify &amp; Complete Delivery
                  </button>
                </form>
              )}
            </>
          )}

          {/* ─── CASE D: CASH ON DELIVERY (COD) 1-TAP COMPLETION ─── */}
          {isVerified && isCOD && !processSuccess && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Verification Success Box */}
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10B981',
                borderRadius: '14px',
                padding: '14px',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: '#10B981',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                  margin: '0 auto 8px auto',
                  boxShadow: '0 0 16px rgba(16, 185, 129, 0.6)'
                }}>
                  <i className="fa-solid fa-check"></i>
                </div>
                <h4 style={{ margin: '0 0 2px 0', fontSize: '1rem', fontWeight: '800', color: '#6EE7B7' }}>
                  Barcode Verified!
                </h4>
                <div style={{ fontSize: '0.74rem', color: '#CBD5E1', fontFamily: 'monospace' }}>
                  Code: <strong>{verifiedBarcode}</strong> &bull; {verificationMethod === 'BARCODE_SCAN' ? 'Live Camera Scan' : 'Manual Code'}
                </div>
              </div>

              {/* COD Cash Collection Card */}
              <div
                style={{
                  background: isCashCollected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  border: isCashCollected ? '1px solid #10B981' : '1px solid #F59E0B',
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer'
                }}
                onClick={() => setIsCashCollected(!isCashCollected)}
              >
                <input
                  type="checkbox"
                  checked={isCashCollected}
                  onChange={(e) => setIsCashCollected(e.target.checked)}
                  style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: '#10B981' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: '800', color: isCashCollected ? '#6EE7B7' : '#FBBF24' }}>
                    💰 Cash on Delivery (COD) Amount
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: '900', color: '#FFFFFF', marginTop: '2px' }}>
                    ₹{order.totalAmount?.toLocaleString('en-IN') || '0'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#CBD5E1' }}>
                    {isCashCollected ? '✅ Cash confirmed collected from recipient' : 'Tap here to confirm cash collection'}
                  </div>
                </div>
              </div>

              {/* Handover Recipient Chips */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#94A3B8', marginBottom: '6px' }}>
                  Handover Recipient:
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {[
                    'Handed to recipient in person',
                    'Received by family member',
                    'Left with security / reception'
                  ].map((note) => (
                    <button
                      key={note}
                      type="button"
                      onClick={() => setHandoverNote(note)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '20px',
                        border: handoverNote === note ? '1px solid #10B981' : '1px solid rgba(255, 255, 255, 0.1)',
                        background: handoverNote === note ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                        color: handoverNote === note ? '#6EE7B7' : '#CBD5E1',
                        fontSize: '0.72rem',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      {handoverNote === note && '✓ '} {note}
                    </button>
                  ))}
                </div>
              </div>

              {/* 1-Tap Final COD Complete Button */}
              <button
                type="button"
                onClick={handleConfirmCODAndComplete}
                disabled={submitting || !isCashCollected}
                style={{
                  background: isCashCollected
                    ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                    : 'rgba(255, 255, 255, 0.1)',
                  color: isCashCollected ? '#FFFFFF' : '#94A3B8',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '16px',
                  fontSize: '0.96rem',
                  fontWeight: '800',
                  cursor: isCashCollected && !submitting ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: isCashCollected ? '0 4px 18px rgba(16, 185, 129, 0.4)' : 'none',
                  marginTop: '4px'
                }}
              >
                {submitting ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Completing Delivery...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-box-check"></i> Complete Delivery &amp; Collect ₹140 Payout
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setIsVerified(false); startCamera(); }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Rescan barcode
              </button>
            </div>
          )}

          {/* ─── CASE E: PREPAID ONLINE ORDER MANDATORY OTP COMPLETION ─── */}
          {isVerified && !isCOD && !processSuccess && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Verification Success Box */}
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10B981',
                borderRadius: '14px',
                padding: '14px',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: '#10B981',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                  margin: '0 auto 8px auto',
                  boxShadow: '0 0 16px rgba(16, 185, 129, 0.6)'
                }}>
                  <i className="fa-solid fa-check"></i>
                </div>
                <h4 style={{ margin: '0 0 2px 0', fontSize: '1rem', fontWeight: '800', color: '#6EE7B7' }}>
                  Parcel Barcode Verified!
                </h4>
                <div style={{ fontSize: '0.74rem', color: '#CBD5E1', fontFamily: 'monospace' }}>
                  Code: <strong>{verifiedBarcode}</strong> &bull; {verificationMethod === 'BARCODE_SCAN' ? 'Live Camera Scan' : 'Manual Code'}
                </div>
              </div>

              {/* Mandatory Delivery OTP Card */}
              <div style={{
                background: 'rgba(37, 99, 235, 0.12)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                borderRadius: '14px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-key" style={{ color: '#60A5FA', fontSize: '1.1rem' }}></i>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: '800', color: '#93C5FD' }}>
                      Customer Delivery OTP Verification
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                      Ask customer for their 4-digit Delivery PIN (available on customer's Order Tracking screen).
                    </div>
                  </div>
                </div>

                <input
                  type="text"
                  maxLength={4}
                  value={prepaidOtp}
                  onChange={(e) => setPrepaidOtp(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Enter 4-Digit OTP"
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#0B1120',
                    border: '1.5px solid #3B82F6',
                    borderRadius: '10px',
                    color: '#FFFFFF',
                    fontSize: '1.5rem',
                    fontWeight: '900',
                    textAlign: 'center',
                    letterSpacing: '8px',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box'
                  }}
                  autoFocus
                />

                {/* Resend Delivery OTP Button */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
                  <button
                    type="button"
                    onClick={handleResendDeliveryOtp}
                    disabled={isResendingOtp}
                    style={{
                      background: 'rgba(59, 130, 246, 0.15)',
                      border: '1px solid rgba(59, 130, 246, 0.4)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      color: '#93C5FD',
                      fontSize: '0.74rem',
                      fontWeight: '700',
                      cursor: isResendingOtp ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                  >
                    {isResendingOtp ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin"></i> Resending OTP...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-paper-plane"></i> Customer Didn't Receive OTP? Resend Now
                      </>
                    )}
                  </button>
                  {resendStatusMsg && (
                    <div style={{ fontSize: '0.72rem', color: '#6EE7B7', fontWeight: '700', textAlign: 'center' }}>
                      {resendStatusMsg}
                    </div>
                  )}
                </div>
              </div>

              {/* Handover Recipient Chips */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#94A3B8', marginBottom: '6px' }}>
                  Handover Recipient:
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {[
                    'Handed to recipient in person',
                    'Received by family member',
                    'Left with security / reception'
                  ].map((note) => (
                    <button
                      key={note}
                      type="button"
                      onClick={() => setHandoverNote(note)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '20px',
                        border: handoverNote === note ? '1px solid #10B981' : '1px solid rgba(255, 255, 255, 0.1)',
                        background: handoverNote === note ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                        color: handoverNote === note ? '#6EE7B7' : '#CBD5E1',
                        fontSize: '0.72rem',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      {handoverNote === note && '✓ '} {note}
                    </button>
                  ))}
                </div>
              </div>

              {/* Verify OTP & Complete Button */}
              <button
                type="button"
                onClick={handleConfirmPrepaidAndComplete}
                disabled={submitting || prepaidOtp.length < 4}
                style={{
                  background: prepaidOtp.length === 4
                    ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                    : 'rgba(255, 255, 255, 0.1)',
                  color: prepaidOtp.length === 4 ? '#FFFFFF' : '#94A3B8',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '16px',
                  fontSize: '0.96rem',
                  fontWeight: '800',
                  cursor: prepaidOtp.length === 4 && !submitting ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: prepaidOtp.length === 4 ? '0 4px 18px rgba(16, 185, 129, 0.4)' : 'none',
                  marginTop: '4px'
                }}
              >
                {submitting ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Verifying OTP &amp; Completing...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-shield-check"></i> Verify OTP &amp; Complete Delivery (+₹140)
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setIsVerified(false); startCamera(); }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Rescan barcode
              </button>
            </div>
          )}

              {/* ─── DOORSTEP EXCEPTIONS: RETURN PRODUCT OR CUSTOMER UNREACHABLE ─── */}
              {!processSuccess && !isProcessing && (
                <div style={{
                  marginTop: '16px',
                  paddingTop: '14px',
                  borderTop: '1px dashed rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Doorstep Delivery Issues / Return
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {/* 1. Customer Wants to Return Product */}
                    <button
                      type="button"
                      onClick={() => switchMode('RETURN')}
                      style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: '#FCA5A5',
                        borderRadius: '10px',
                        padding: '10px 8px',
                        fontSize: '0.74rem',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        textAlign: 'center'
                      }}
                    >
                      <i className="fa-solid fa-rotate-left" style={{ fontSize: '1.1rem', color: '#EF4444' }}></i>
                      <span>Customer Wants Return</span>
                      <span style={{ fontSize: '0.62rem', color: '#F87171', fontWeight: '500' }}>Requires Return OTP</span>
                    </button>

                    {/* 2. Customer Not Lifting Call / Unreachable */}
                    <button
                      type="button"
                      onClick={() => switchMode('UNREACHABLE')}
                      style={{
                        background: 'rgba(245, 158, 11, 0.15)',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        color: '#FCD34D',
                        borderRadius: '10px',
                        padding: '10px 8px',
                        fontSize: '0.74rem',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        textAlign: 'center'
                      }}
                    >
                      <i className="fa-solid fa-phone-slash" style={{ fontSize: '1.1rem', color: '#F59E0B' }}></i>
                      <span>Not Lifting Call</span>
                      <span style={{ fontSize: '0.62rem', color: '#FBBF24', fontWeight: '500' }}>No OTP Needed &bull; RTO</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
