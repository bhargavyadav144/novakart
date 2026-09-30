import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function TelephonyCallOverlay() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeCall, setActiveCall] = useState(null);
  const [ringingTicket, setRingingTicket] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showKeypad, setShowKeypad] = useState(true);
  const [showSpeechFeed, setShowSpeechFeed] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [callTimer, setCallTimer] = useState(0);

  const [customerSpeechInput, setCustomerSpeechInput] = useState('');
  const [sendingSpeech, setSendingSpeech] = useState(false);
  const speechFeedEndRef = useRef(null);

  // Post-Call Review & Star Rating Modal State
  const [completedCallForFeedback, setCompletedCallForFeedback] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackText, setFeedbackText] = useState('');
  const [selectedFeedbackTags, setSelectedFeedbackTags] = useState([]);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Track active call reference for completion detection & initial minimize state
  const activeCallRef = useRef(null);
  const currentCallIdRef = useRef(null);

  // Poll for active calls & ringing tickets every 3 seconds
  useEffect(() => {
    if (!user) return;
    fetchActiveCallData();
    const interval = setInterval(fetchActiveCallData, 3000);
    return () => clearInterval(interval);
  }, [user]);

  // Live timer for connected calls
  useEffect(() => {
    let timerInterval = null;
    if (activeCall && activeCall.queueStatus === 'CONNECTED') {
      timerInterval = setInterval(() => {
        setCallTimer(prev => prev + 1);
      }, 1000);
    } else {
      setCallTimer(0);
    }
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [activeCall?.queueStatus]);

  // Auto-scroll speech feed to bottom
  useEffect(() => {
    if (speechFeedEndRef.current) {
      speechFeedEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeCall?.callTranscript, showSpeechFeed]);

  const fetchActiveCallData = async () => {
    try {
      const [callsRes, ticketsRes] = await Promise.allSettled([
        api.get('/call-queue/my-calls'),
        api.get('/support/my-tickets')
      ]);

      let foundCall = null;
      if (callsRes.status === 'fulfilled' && callsRes.value.data.success) {
        const calls = callsRes.value.data.calls || [];
        foundCall = calls.find(c => !['COMPLETED', 'CANCELLED', 'ABANDONED', 'MISSED'].includes(c.queueStatus));
      }

      let foundRingingTicket = null;
      if (ticketsRes.status === 'fulfilled' && ticketsRes.value.data.success) {
        const tickets = ticketsRes.value.data.tickets || [];
        foundRingingTicket = tickets.find(t => t.callBackDetails && ['CALLING', 'RINGING'].includes(t.callBackDetails.status));
      }

      const newCallId = foundCall?._id || foundCall?.callId || foundRingingTicket?._id;

      // Detect if call just ended from CONNECTED or QUEUED state
      if (activeCallRef.current && !foundCall && activeCallRef.current.queueStatus === 'CONNECTED') {
        setCompletedCallForFeedback(activeCallRef.current);
      }
      activeCallRef.current = foundCall;

      // Only force Full Screen (isMinimized = false) ONCE when a brand-new call session starts!
      if (newCallId && currentCallIdRef.current !== String(newCallId)) {
        currentCallIdRef.current = String(newCallId);
        setIsMinimized(false);
      } else if (!newCallId) {
        currentCallIdRef.current = null;
      }

      setActiveCall(foundCall);
      setRingingTicket(foundRingingTicket);
    } catch (err) {
      /* silent */
    }
  };

  const handleAcceptIncomingCall = async (ticketId, callId) => {
    try {
      if (ticketId) {
        await api.put(`/support/tickets/${ticketId}/accept-call`);
      }
      if (callId) {
        await api.put(`/call-queue/${callId}/accept-call`);
      }
      fetchActiveCallData();
    } catch (err) {
      console.error('Failed to accept call:', err);
    }
  };

  const handleDeclineIncomingCall = async (ticketId, callId) => {
    try {
      if (ticketId) {
        await api.put(`/support/tickets/${ticketId}/decline-call`);
      }
      if (callId) {
        await api.put(`/call-queue/${callId}/cancel`);
      }
      if (activeCall) {
        setCompletedCallForFeedback(activeCall);
      }
      setActiveCall(null);
      fetchActiveCallData();
    } catch (err) {
      console.error('Failed to decline call:', err);
    }
  };

  const handleSubmitFeedback = async (e) => {
    if (e) e.preventDefault();
    if (!completedCallForFeedback?._id) return;
    setSubmittingFeedback(true);
    try {
      await api.post(`/call-queue/${completedCallForFeedback._id}/feedback`, {
        rating: feedbackRating,
        reviewText: feedbackText,
        tags: selectedFeedbackTags
      });
      setFeedbackSubmitted(true);
      setTimeout(() => {
        setCompletedCallForFeedback(null);
        setFeedbackSubmitted(false);
        setFeedbackRating(5);
        setFeedbackText('');
        setSelectedFeedbackTags([]);
      }, 1400);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      setCompletedCallForFeedback(null);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // Auto-repeat spoken prompt timer (8 seconds inactivity during IVR)
  const lastKeyTimeRef = useRef(Date.now());
  const repeatIntervalRef = useRef(null);

  // Immediately stop all pre-recorded IVR audio / TTS when call is connected with helper
  useEffect(() => {
    if (activeCall && activeCall.queueStatus === 'CONNECTED') {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    }
  }, [activeCall?.queueStatus]);

  // Initial welcome voice prompt spoken in selected language upon call start
  const hasSpokenWelcomeRef = useRef(null);
  useEffect(() => {
    if (activeCall && activeCall.queueStatus === 'IVR_IN_PROGRESS' && activeCall._id !== hasSpokenWelcomeRef.current) {
      hasSpokenWelcomeRef.current = activeCall._id;
      const botMsgs = activeCall.callTranscript?.filter(t => t.sender === 'BOT');
      if (botMsgs && botMsgs.length > 0 && window.speechSynthesis) {
        const welcomeText = botMsgs[0].message;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(welcomeText);
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [activeCall?._id, activeCall?.queueStatus]);

  useEffect(() => {
    if (activeCall && activeCall.queueStatus === 'IVR_IN_PROGRESS') {
      repeatIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - lastKeyTimeRef.current) / 1000;
        if (elapsed >= 8 && window.speechSynthesis) {
          const lang = activeCall.ivr?.language || 'ENGLISH';
          let repeatPrompt = 'I am repeating once again. ';
          if (lang === 'TELUGU') {
            repeatPrompt = 'నేను మరొకసారి రిపీట్ చేస్తున్నాను. నోవాకార్ట్ కస్టమర్ కేర్‌కు స్వాగతం! మీ ఆర్డర్ స్థితి కొరకు 1 నొక్కండి, రీఫండ్ స్థితి కొరకు 2 నొక్కండి, ఇతర వివరాల కొరకు 3 నొక్కండి, కస్టమర్ కేర్ ప్రతినిధితో మాట్లాడటానికి 9 నొక్కండి.';
          } else if (lang === 'HINDI') {
            repeatPrompt = 'मैं एक बार फिर दोहरा रहा हूं। नोवाकार्ट ग्राहक सेवा में आपका स्वागत है! अपने ऑर्डर की स्थिति जांचने के लिए 1 दबाएं, रिफंड स्थिति के लिए 2 दबाएं, अन्य विवरण के लिए 3 दबाएं, ग्राहक सेवा प्रतिनिधि से बात करने के लिए 9 दबाएं।';
          } else if (lang === 'TAMIL') {
            repeatPrompt = 'நான் மீண்டும் ஒருமுறை கூறுகிறேன். நோவாகார்ட் வாடிக்கையாளர் சேவைக்கு நல்வரவு! உங்கள் ஆர்டர் நிலைக்கு 1, ரீஃபண்ட் நிலைக்கு 2, பிற விவரங்களுக்கு 3, வாடிக்கையாளர் சேவையுடன் பேச 9 அழுத்துங்கள்.';
          } else {
            repeatPrompt += 'Welcome to NovaKart Customer Care! To check order status press 1, refund status press 2, other details press 3, to speak with our customer care representative press 9.';
          }
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(repeatPrompt);
          window.speechSynthesis.speak(utterance);
          lastKeyTimeRef.current = Date.now();
        }
      }, 4000);
    } else {
      if (repeatIntervalRef.current) clearInterval(repeatIntervalRef.current);
    }
    return () => {
      if (repeatIntervalRef.current) clearInterval(repeatIntervalRef.current);
    };
  }, [activeCall?.queueStatus, activeCall?.ivr?.step, activeCall?.ivr?.language]);

  const handleIVRKeyPress = async (callId, digit) => {
    try {
      lastKeyTimeRef.current = Date.now();
      playKeyTone();
      const res = await api.put(`/call-queue/${callId}/ivr-key`, { digit });
      if (res.data.success) {
        fetchActiveCallData();
        const botMsgs = res.data.call?.callTranscript?.filter(t => t.sender === 'BOT');
        if (botMsgs && botMsgs.length > 0 && window.speechSynthesis) {
          const lastMsg = botMsgs[botMsgs.length - 1].message;
          const utterance = new SpeechSynthesisUtterance(lastMsg);
          window.speechSynthesis.speak(utterance);
        }
      }
    } catch (err) {
      console.error('IVR keypress error:', err);
    }
  };

  const playKeyTone = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(697, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) { /* silent */ }
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // ═════════════════════════════════════════════════════════════════
  // POST-CALL CUSTOMER RATING & REVIEW MODAL
  // ═════════════════════════════════════════════════════════════════
  if (completedCallForFeedback && !activeCall && !ringingTicket) {
    const agentName = completedCallForFeedback.assignedAgent?.name || 'NovaKart Support Team';

    const feedbackTagsList = [
      '⚡ Fast Resolution',
      '😊 Polite & Helpful',
      '💰 Refund Processed',
      '🗣️ Clear Communication',
      '📦 Order Solved'
    ];

    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%)',
          border: '2px solid #10B981',
          borderRadius: '24px',
          maxWidth: '480px',
          width: '100%',
          padding: '32px 24px',
          color: '#FFFFFF',
          boxShadow: '0 25px 50px -12px rgba(16, 185, 129, 0.3)',
          textAlign: 'center'
        }}>
          {feedbackSubmitted ? (
            <div style={{ padding: '20px 0' }}>
              <div style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                margin: '0 auto 16px',
                boxShadow: '0 0 25px rgba(16, 185, 129, 0.6)'
              }}>
                <i className="fa-solid fa-check"></i>
              </div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: '800', margin: '0 0 8px', color: '#34D399' }}>
                Review Submitted!
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#94A3B8', margin: 0 }}>
                Thank you for rating your support call experience.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmitFeedback}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#34D399',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.8rem',
                margin: '0 auto 16px'
              }}>
                <i className="fa-solid fa-star"></i>
              </div>

              <h3 style={{ fontSize: '1.35rem', fontWeight: '800', margin: '0 0 6px', letterSpacing: '-0.3px' }}>
                How was your Support Call?
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#94A3B8', margin: '0 0 20px' }}>
                Please rate your experience with <strong>{agentName}</strong>
              </p>

              {/* Star Rating Buttons */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '20px' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFeedbackRating(star)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      fontSize: '2rem',
                      color: star <= feedbackRating ? '#FBBF24' : '#334155',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease'
                    }}
                  >
                    ★
                  </button>
                ))}
              </div>

              {/* Quick Feedback Tag Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
                {feedbackTagsList.map((tag) => {
                  const isSelected = selectedFeedbackTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setSelectedFeedbackTags(prev =>
                          isSelected ? prev.filter(t => t !== tag) : [...prev, tag]
                        );
                      }}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '0.78rem',
                        fontWeight: '700',
                        border: isSelected ? '1px solid #10B981' : '1px solid rgba(255, 255, 255, 0.15)',
                        background: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        color: isSelected ? '#34D399' : '#CBD5E1',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

              {/* Text Review Comment */}
              <textarea
                rows={3}
                placeholder="Write optional review details about your support experience..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '12px',
                  padding: '12px',
                  color: '#FFFFFF',
                  fontSize: '0.84rem',
                  outline: 'none',
                  resize: 'none',
                  marginBottom: '20px',
                  boxSizing: 'border-box'
                }}
              />

              {/* Modal Buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setCompletedCallForFeedback(null)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '14px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: '#94A3B8',
                    fontSize: '0.88rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Skip
                </button>

                <button
                  type="submit"
                  disabled={submittingFeedback}
                  style={{
                    flex: 2,
                    padding: '12px',
                    borderRadius: '14px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    color: '#FFFFFF',
                    fontSize: '0.88rem',
                    fontWeight: '800',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                  }}
                >
                  {submittingFeedback ? 'Submitting...' : 'Submit Support Review'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // If no active call or ringing ticket, do not render overlay
  if (!activeCall && !ringingTicket) return null;

  const isIncomingRinging = ringingTicket || (activeCall && ['CONNECTING', 'RINGING'].includes(activeCall.queueStatus));
  const isIvrActive = activeCall?.queueStatus === 'IVR_IN_PROGRESS';
  const isConnected = activeCall?.queueStatus === 'CONNECTED';
  const isQueued = activeCall?.queueStatus === 'QUEUED';

  const officerName = ringingTicket?.assignedWorker?.name || activeCall?.assignedAgent?.name || 'NovaKart Support Representative';
  const callerTitle = isIvrActive ? 'NovaKart Customer Care' : officerName;
  const callerSub = activeCall?.customerPhone || user?.phone || '+91 91977 850108';

  const ticketId = ringingTicket?._id;
  const callId = activeCall?._id || activeCall?.callId;

  // ═════════════════════════════════════════════════════════════════
  // 1. SLEEK TOP FLOATING DYNAMIC CALL PILL (MINIMIZED ISLAND MODE)
  // ═════════════════════════════════════════════════════════════════
  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        style={{
          position: 'fixed',
          top: '14px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 999999,
          background: 'rgba(15, 23, 42, 0.96)',
          backdropFilter: 'blur(16px)',
          border: `1.5px solid ${isConnected ? '#10B981' : isIvrActive ? '#3B82F6' : '#F59E0B'}`,
          borderRadius: '32px',
          padding: '8px 20px',
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer',
          color: '#FFFFFF',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          maxWidth: '90vw'
        }}
      >
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%',
          background: isConnected ? '#10B981' : isIvrActive ? '#2563EB' : '#F59E0B',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.85rem', color: '#FFF',
          boxShadow: `0 0 12px ${isConnected ? '#10B981' : isIvrActive ? '#2563EB' : '#F59E0B'}`
        }}>
          <i className="fa-solid fa-phone-volume fa-shake"></i>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>{callerTitle}</span>
            <span style={{ fontSize: '0.68rem', color: isConnected ? '#6EE7B7' : '#93C5FD', background: 'rgba(255,255,255,0.1)', padding: '1px 6px', borderRadius: '10px' }}>
              {isConnected ? formatTimer(callTimer) : isIvrActive ? 'IVR Spoken' : isIncomingRinging ? 'Ringing...' : 'Queued'}
            </span>
          </div>
          <div style={{ fontSize: '0.68rem', opacity: 0.7 }}>
            Tap to return to Call Screen ↗
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isIncomingRinging) handleDeclineIncomingCall(ticketId, callId);
            else handleDeclineIncomingCall(null, callId);
          }}
          style={{
            background: 'rgba(239, 68, 68, 0.25)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            color: '#FCA5A5',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            cursor: 'pointer',
            marginLeft: '4px'
          }}
          title="End Call"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>
    );
  }

  // Determine IVR Keypad Sub-Labels based on Step & Language
  const currentStep = activeCall?.ivr?.step || 'WELCOME_LANG';
  const currentLang = activeCall?.ivr?.language || 'ENGLISH';

  const getKeypadKeys = () => {
    if (currentStep === 'WELCOME_LANG') {
      return [
        { digit: '1', sub: 'English 🇬🇧' },
        { digit: '2', sub: 'Change Lang' },
        { digit: '3', sub: 'DEF' },
        { digit: '4', sub: 'GHI' },
        { digit: '5', sub: 'JKL' },
        { digit: '6', sub: 'MNO' },
        { digit: '7', sub: 'PQRS' },
        { digit: '8', sub: 'TUV' },
        { digit: '9', sub: 'WXYZ' },
        { digit: '*', sub: 'Option' },
        { digit: '0', sub: '+' },
        { digit: '#', sub: 'Confirm' }
      ];
    }
    if (currentStep === 'SUB_LANG') {
      return [
        { digit: '1', sub: 'Telugu 🇮🇳' },
        { digit: '2', sub: 'Hindi 🇮🇳' },
        { digit: '3', sub: 'Tamil 🇮🇳' },
        { digit: '4', sub: 'GHI' },
        { digit: '5', sub: 'JKL' },
        { digit: '6', sub: 'MNO' },
        { digit: '7', sub: 'PQRS' },
        { digit: '8', sub: 'TUV' },
        { digit: '9', sub: 'WXYZ' },
        { digit: '*', sub: 'Option' },
        { digit: '0', sub: '+' },
        { digit: '#', sub: 'Confirm' }
      ];
    }
    // ISSUE_SELECT
    return [
      { digit: '1', sub: 'Order Status 📦' },
      { digit: '2', sub: 'Refund Status 💰' },
      { digit: '3', sub: 'Other Details 📋' },
      { digit: '4', sub: 'GHI' },
      { digit: '5', sub: 'JKL' },
      { digit: '6', sub: 'MNO' },
      { digit: '7', sub: 'PQRS' },
      { digit: '8', sub: 'TUV' },
      { digit: '9', sub: 'Support Agent 🎧' },
      { digit: '*', sub: 'Option' },
      { digit: '0', sub: '+' },
      { digit: '#', sub: 'Confirm' }
    ];
  };

  // ═════════════════════════════════════════════════════════════════
  // 2. FULL-SCREEN NATIVE TELEPHONY INTERFACE (FULL SCREEN MODE)
  // ═════════════════════════════════════════════════════════════════
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 999999,
      background: 'linear-gradient(180deg, #090D16 0%, #0F172A 45%, #030712 100%)',
      backdropFilter: 'blur(20px)',
      color: '#FFFFFF',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '32px 20px',
      overflowY: 'auto',
      boxSizing: 'border-box'
    }}>
      {/* Top Controls Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={() => setIsMinimized(true)}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#FFFFFF',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '0.82rem',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <i className="fa-solid fa-chevron-down"></i>
          <span>Minimize Call</span>
        </button>

        <div style={{
          fontSize: '0.75rem',
          background: 'rgba(16, 185, 129, 0.15)',
          color: '#6EE7B7',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          padding: '4px 12px',
          borderRadius: '16px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <i className="fa-solid fa-shield-halved"></i>
          <span>NovaKart Encrypted Line</span>
        </div>
      </div>

      {/* Main Caller Avatar & Header */}
      <div style={{ textAlign: 'center', margin: '20px 0' }}>
        <div style={{
          width: '104px',
          height: '104px',
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${isConnected ? '#10B981' : isIvrActive ? '#2563EB' : '#F59E0B'} 0%, #0F172A 100%)`,
          border: `3px solid ${isConnected ? '#34D399' : isIvrActive ? '#60A5FA' : '#FBBF24'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '3rem',
          margin: '0 auto 16px',
          boxShadow: `0 0 40px ${isConnected ? 'rgba(16, 185, 129, 0.4)' : isIvrActive ? 'rgba(37, 99, 235, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
          animation: isIncomingRinging ? 'pulse 1.2s infinite' : 'none'
        }}>
          <i className={isConnected ? 'fa-solid fa-headset' : isIvrActive ? 'fa-solid fa-robot' : 'fa-solid fa-phone-volume fa-shake'}></i>
        </div>

        <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '4px', letterSpacing: '-0.5px' }}>
          {callerTitle}
        </h2>

        <div style={{ fontSize: '0.92rem', color: '#94A3B8', marginBottom: '8px' }}>
          {callerSub}
        </div>

        {/* Live Call Status Tag */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          borderRadius: '20px',
          fontSize: '0.85rem',
          fontWeight: '800',
          background: isConnected ? 'rgba(16, 185, 129, 0.2)' : isIvrActive ? 'rgba(37, 99, 235, 0.2)' : 'rgba(245, 158, 11, 0.2)',
          color: isConnected ? '#6EE7B7' : isIvrActive ? '#93C5FD' : '#FDE68A',
          border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.4)' : isIvrActive ? 'rgba(37, 99, 235, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`
        }}>
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: isConnected ? '#10B981' : isIvrActive ? '#3B82F6' : '#F59E0B',
            boxShadow: `0 0 8px ${isConnected ? '#10B981' : isIvrActive ? '#3B82F6' : '#F59E0B'}`
          }}></span>
          <span>
            {isConnected ? `CONNECTED • ${formatTimer(callTimer)}` : isIvrActive ? `IVR SPOKEN INTAKE (${currentLang})` : isQueued ? `QUEUED FOR ${currentLang} HELPER` : 'INCOMING RINGING CALL...'}
          </span>
        </div>
      </div>

      {/* 3x4 IVR KEYPAD DIALPAD */}
      {showKeypad && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '24px',
          padding: '20px',
          margin: '0 auto 16px',
          maxWidth: '380px',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <div style={{ fontSize: '0.78rem', fontWeight: '800', textTransform: 'uppercase', color: '#93C5FD', textAlign: 'center', marginBottom: '14px', letterSpacing: '0.5px' }}>
            {isIvrActive ? `IVR Step: ${currentStep === 'WELCOME_LANG' ? 'Press 1 (English) or 2 (Change Lang)' : currentStep === 'SUB_LANG' ? 'Select Language (1:Telugu, 2:Hindi, 3:Tamil)' : 'Select Category (1:Status, 2:Refund, 3:Other, 9:Agent)'}` : 'Interactive Phone Keypad'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {getKeypadKeys().map(k => (
              <button
                key={k.digit}
                onClick={() => {
                  if (activeCall?._id) handleIVRKeyPress(activeCall._id, k.digit);
                  else playKeyTone();
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '16px',
                  padding: '12px 6px',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                  userSelect: 'none'
                }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.92)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div style={{ fontSize: '1.4rem', fontWeight: '800', lineHeight: 1 }}>{k.digit}</div>
                <div style={{ fontSize: '0.62rem', opacity: 0.7, marginTop: '2px', color: '#6EE7B7' }}>{k.sub}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action Control Icons Bar (Native Dialer Buttons Grid) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px',
        maxWidth: '380px',
        margin: '0 auto 16px',
        width: '100%'
      }}>
        <button
          onClick={() => setShowKeypad(!showKeypad)}
          style={{
            background: showKeypad ? '#2563EB' : 'rgba(255, 255, 255, 0.1)',
            border: 'none', borderRadius: '16px', padding: '12px 4px', color: '#FFF', cursor: 'pointer', textAlign: 'center'
          }}
        >
          <i className="fa-solid fa-calculator" style={{ fontSize: '1.2rem', display: 'block', marginBottom: '4px' }}></i>
          <span style={{ fontSize: '0.68rem', fontWeight: '700' }}>Keypad</span>
        </button>

        <button
          onClick={() => setIsMuted(!isMuted)}
          style={{
            background: isMuted ? '#EF4444' : 'rgba(255, 255, 255, 0.1)',
            border: 'none', borderRadius: '16px', padding: '12px 4px', color: '#FFF', cursor: 'pointer', textAlign: 'center'
          }}
        >
          <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`} style={{ fontSize: '1.2rem', display: 'block', marginBottom: '4px' }}></i>
          <span style={{ fontSize: '0.68rem', fontWeight: '700' }}>{isMuted ? 'Muted' : 'Mute'}</span>
        </button>

        <button
          onClick={() => setIsSpeaker(!isSpeaker)}
          style={{
            background: isSpeaker ? '#10B981' : 'rgba(255, 255, 255, 0.1)',
            border: 'none', borderRadius: '16px', padding: '12px 4px', color: '#FFF', cursor: 'pointer', textAlign: 'center'
          }}
        >
          <i className={`fa-solid ${isSpeaker ? 'fa-volume-high' : 'fa-volume-low'}`} style={{ fontSize: '1.2rem', display: 'block', marginBottom: '4px' }}></i>
          <span style={{ fontSize: '0.68rem', fontWeight: '700' }}>Speaker</span>
        </button>

        <button
          onClick={() => {
            setIsMinimized(true);
            navigate('/orders');
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none', borderRadius: '16px', padding: '12px 4px', color: '#FFF', cursor: 'pointer', textAlign: 'center'
          }}
        >
          <i className="fa-solid fa-box-archive" style={{ fontSize: '1.2rem', display: 'block', marginBottom: '4px' }}></i>
          <span style={{ fontSize: '0.68rem', fontWeight: '700' }}>Check Orders</span>
        </button>
      </div>

      {/* Bottom Accept / Decline / End Call Actions */}
      <div style={{ maxWidth: '380px', margin: '0 auto', width: '100%' }}>
        {isIncomingRinging ? (
          <div style={{ display: 'flex', gap: '16px' }}>
            <button
              onClick={() => handleDeclineIncomingCall(ticketId, callId)}
              style={{
                flex: 1, padding: '16px', borderRadius: '28px', border: 'none',
                background: '#EF4444', color: '#FFF', fontSize: '1.05rem', fontWeight: '800',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                boxShadow: '0 8px 24px rgba(239, 68, 68, 0.4)'
              }}
            >
              <i className="fa-solid fa-phone-slash"></i> Decline
            </button>

            <button
              onClick={() => handleAcceptIncomingCall(ticketId, callId)}
              style={{
                flex: 1, padding: '16px', borderRadius: '28px', border: 'none',
                background: '#10B981', color: '#FFF', fontSize: '1.05rem', fontWeight: '800',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)'
              }}
            >
              <i className="fa-solid fa-phone"></i> Accept Call
            </button>
          </div>
        ) : (
          <button
            onClick={() => handleDeclineIncomingCall(null, callId)}
            style={{
              width: '100%', padding: '16px', borderRadius: '28px', border: 'none',
              background: '#EF4444', color: '#FFF', fontSize: '1.05rem', fontWeight: '800',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              boxShadow: '0 8px 24px rgba(239, 68, 68, 0.4)'
            }}
          >
            <i className="fa-solid fa-phone-slash"></i> End Call
          </button>
        )}
      </div>
    </div>
  );
}
