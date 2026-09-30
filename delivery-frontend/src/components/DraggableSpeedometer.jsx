import React, { useState, useEffect, useRef } from 'react';

export default function DraggableSpeedometer() {
  const [speed, setSpeed] = useState(0);
  const [isSpeeding, setIsSpeeding] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('GPS Active');

  // Compact positioning (default top-right corner of screen)
  const [position, setPosition] = useState(() => {
    const defaultX = typeof window !== 'undefined' ? Math.min(window.innerWidth - 65, 360) : 20;
    return { x: defaultX > 0 ? defaultX : 20, y: 70 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);
  const offsetRef = useRef({ x: 0, y: 0 });

  // 1. Real Hardware Geolocation Speedometer (navigator.geolocation.watchPosition)
  useEffect(() => {
    let watchId = null;

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      try {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const rawSpeed = pos.coords?.speed; // Speed in meters per second (m/s)
            if (rawSpeed !== null && rawSpeed !== undefined && !isNaN(rawSpeed) && rawSpeed >= 0) {
              const kmh = Math.round(rawSpeed * 3.6); // Convert m/s to KM/H
              setSpeed(kmh);
              setIsSpeeding(kmh > 50);
              setGpsStatus('GPS Active');
            } else {
              setSpeed(0);
              setIsSpeeding(false);
              setGpsStatus('0 KM/H (Stopped)');
            }
          },
          (err) => {
            console.warn('GPS Speedometer Notice:', err.message);
            setGpsStatus('GPS Signal Low');
            setSpeed(0);
          },
          {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 5000
          }
        );
      } catch (e) {
        setGpsStatus('No GPS');
        setSpeed(0);
      }
    } else {
      setGpsStatus('No GPS');
      setSpeed(0);
    }

    return () => {
      if (watchId !== null && navigator.geolocation?.clearWatch) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  // Mouse Drag Handlers
  const handleMouseDown = (e) => {
    setIsDragging(true);
    offsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const newX = Math.max(5, Math.min(window.innerWidth - 55, e.clientX - offsetRef.current.x));
    const newY = Math.max(5, Math.min(window.innerHeight - 55, e.clientY - offsetRef.current.y));
    setPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch Drag Handlers for Mobile Phones
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    setIsDragging(true);
    offsetRef.current = {
      x: touch.clientX - position.x,
      y: touch.clientY - position.y
    };
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const newX = Math.max(5, Math.min(window.innerWidth - 55, touch.clientX - offsetRef.current.x));
    const newY = Math.max(5, Math.min(window.innerHeight - 55, touch.clientY - offsetRef.current.y));
    setPosition({ x: newX, y: newY });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleTouchEnd);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging]);

  const speedColor = isSpeeding ? '#EF4444' : speed > 40 ? '#F59E0B' : '#10B981';

  return (
    <div
      ref={dragRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 9999,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        touchAction: 'none',
        transition: isDragging ? 'none' : 'box-shadow 0.2s ease'
      }}
      title={`Real GPS Speedometer: ${speed} KM/H (${gpsStatus}) - Touch & Drag anywhere!`}
    >
      <div
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          border: `2px solid ${speedColor}`,
          boxShadow: isSpeeding ? '0 0 16px rgba(239, 68, 68, 0.8)' : '0 4px 12px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          position: 'relative'
        }}
      >
        {/* Speed Limit Ring Header */}
        <div style={{ fontSize: '0.48rem', fontWeight: '900', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.3px', marginTop: '1px' }}>
          LIMIT 50
        </div>

        {/* Live Hardware GPS Speed Value */}
        <div style={{ fontSize: '0.96rem', fontWeight: '900', color: speedColor, lineHeight: '1', fontFamily: 'monospace' }}>
          {speed}
        </div>

        <div style={{ fontSize: '0.48rem', fontWeight: '800', color: '#CBD5E1', textTransform: 'uppercase' }}>
          KM/H
        </div>

        {/* Drag Move Handle Icon */}
        <div style={{ position: 'absolute', top: '2px', right: '3px', fontSize: '0.45rem', color: '#64748B' }}>
          <i className="fa-solid fa-arrows-up-down-left-right"></i>
        </div>
      </div>

      {/* Speed Warning Popup Badge */}
      {isSpeeding && (
        <div style={{
          position: 'absolute',
          bottom: '-18px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#DC2626',
          color: '#FFFFFF',
          padding: '2px 5px',
          borderRadius: '4px',
          fontSize: '0.54rem',
          fontWeight: '900',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
        }}>
          ⚠️ SLOW DOWN!
        </div>
      )}
    </div>
  );
}
