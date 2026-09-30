import React, { useEffect, useRef, useState } from 'react';

// Interpolate smooth road coordinates
function interpolatePoints(start, end, steps = 25) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const curve = Math.sin(f * Math.PI) * 0.003;
    pts.push([
      start[0] + (end[0] - start[0]) * f + curve,
      start[1] + (end[1] - start[1]) * f - curve * 0.7
    ]);
  }
  return pts;
}

export default function CustomerLiveMapTracker({ order }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const riderMarkerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [etaMinutes, setEtaMinutes] = useState(9);
  const [distKm, setDistKm] = useState(2.8);

  const isOutForDelivery = order.orderStatus === 'OUT_FOR_DELIVERY' || order.orderStatus === 'PICKED_UP';
  const isDelivered = order.orderStatus === 'DELIVERED' || order.orderStatus === 'COMPLETED';
  const hasAgentTakenDelivery = isOutForDelivery || isDelivered;

  // Origin (Hub) and Destination (Customer) coordinates
  const origin = [16.3067, 80.4365]; // Guntur Hub
  const destination = [16.2800, 80.4700]; // Customer area (e.g. Etukuru / City)

  const routePoints = useRef(interpolatePoints(origin, destination, 30)).current;

  // Initialize Map only if agent has taken delivery
  useEffect(() => {
    if (!hasAgentTakenDelivery || !window.L || !mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const L = window.L;
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false
    }).setView(origin, 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    // 1. Draw Route Polyline
    const poly = L.polyline(routePoints, {
      color: '#2563EB',
      weight: 5,
      opacity: 0.85,
      lineJoin: 'round'
    }).addTo(map);

    // 2. Hub Pin
    const hubIcon = L.divIcon({
      html: `<div style="background:#0F172A;color:#38BDF8;width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid #fff;font-size:12px;"><i class="fa-solid fa-warehouse"></i></div>`,
      className: 'hub-pin',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
    L.marker(origin, { icon: hubIcon }).addTo(map).bindPopup('<b>Fulfillment Hub</b>');

    // 3. Customer Home Pin
    const destIcon = L.divIcon({
      html: `<div style="background:#EF4444;color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(239,68,68,0.4);border:2px solid #fff;font-size:14px;"><i class="fa-solid fa-house-chimney"></i></div>`,
      className: 'dest-pin',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    L.marker(destination, { icon: destIcon }).addTo(map).bindPopup(`<b>Your Delivery Address</b><br>${order.deliveryAddress?.street || ''}`);

    // 4. Rider Marker
    const riderIcon = L.divIcon({
      html: `
        <div style="position:relative;width:40px;height:40px;">
          <div style="position:absolute;top:0;left:0;width:40px;height:40px;border-radius:50%;background:rgba(16,185,129,0.35);animation:pulse 1.5s infinite;"></div>
          <div style="position:absolute;top:5px;left:5px;width:30px;height:30px;border-radius:50%;background:#10B981;border:2px solid #fff;color:#090D16;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.25);">
            <i class="fa-solid fa-motorcycle"></i>
          </div>
        </div>
      `,
      className: 'cust-rider-pin',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    const startPos = isOutForDelivery ? routePoints[Math.floor(routePoints.length * 0.4)] : routePoints[routePoints.length - 1];
    const marker = L.marker(startPos, { icon: riderIcon, zIndexOffset: 1000 }).addTo(map);
    riderMarkerRef.current = marker;

    map.fitBounds(poly.getBounds(), { padding: [40, 40] });
    mapInstanceRef.current = map;
    setMapReady(true);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [order.orderStatus, hasAgentTakenDelivery]);

  // Animate Rider if Out for Delivery
  useEffect(() => {
    if (!mapReady || !isOutForDelivery) return;

    let index = Math.floor(routePoints.length * 0.4);
    const interval = setInterval(() => {
      index = (index + 1) % routePoints.length;
      const pt = routePoints[index];
      if (riderMarkerRef.current) {
        riderMarkerRef.current.setLatLng(pt);
      }
      const remainingFrac = 1 - index / routePoints.length;
      setDistKm(parseFloat((remainingFrac * 3.5).toFixed(1)));
      setEtaMinutes(Math.max(1, Math.round(remainingFrac * 12)));
    }, 1200);

    return () => clearInterval(interval);
  }, [mapReady, isOutForDelivery]);

  // Helper for current pre-delivery stage text
  const getPreDeliveryStatusText = () => {
    const s = order.orderStatus;
    if (s === 'PENDING') {
      return {
        title: '🛒 1. Order Placed & Confirmed',
        desc: 'Your order is confirmed and sent to the seller for packing & dispatch.',
        step: 1
      };
    }
    if (s === 'SELLER_ACCEPTED' || s === 'SELLER_DISPATCHED') {
      return {
        title: '📦 2. Seller Dispatched Product',
        desc: 'The seller has dispatched your product into express logistics transit.',
        step: 2
      };
    }
    if (s === 'SHIPPED' || s === 'IN_TRANSIT_TO_WAREHOUSE') {
      return {
        title: '🚚 3. Shipped in Transit to Warehouse',
        desc: 'Your package is on its way to the regional warehouse fulfillment hub.',
        step: 3
      };
    }
    return {
      title: '🏭 4. Received at Regional Warehouse Hub',
      desc: 'Your package arrived at the local warehouse hub and is staged for rider pickup.',
      step: 4
    };
  };

  const statusInfo = getPreDeliveryStatusText();


  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E2E8F0',
      borderRadius: '16px',
      overflow: 'hidden',
      marginTop: '24px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
    }}>
      {/* Header Banner */}
      <div style={{
        background: hasAgentTakenDelivery
          ? 'linear-gradient(135deg, #064E3B 0%, #065F46 100%)'
          : 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
        color: '#FFFFFF',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.1rem'
          }}>
            <i className={hasAgentTakenDelivery ? "fa-solid fa-location-crosshairs" : "fa-solid fa-boxes-packing"}></i>
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800' }}>
              {hasAgentTakenDelivery ? 'Live Delivery Agent Navigation' : 'Order Processing Status'}
            </h4>
            <div style={{ fontSize: '0.74rem', color: hasAgentTakenDelivery ? '#A7F3D0' : '#C7D2FE', marginTop: '2px' }}>
              {hasAgentTakenDelivery
                ? (isDelivered ? 'Package successfully delivered' : 'Delivery agent is on the way to your address')
                : statusInfo.title}
            </div>
          </div>
        </div>

        {isOutForDelivery && (
          <div style={{
            background: 'rgba(0, 0, 0, 0.25)',
            padding: '6px 12px',
            borderRadius: '8px',
            textAlign: 'right'
          }}>
            <div style={{ fontSize: '1rem', fontWeight: '900', color: '#34D399' }}>
              ~{etaMinutes} MINS
            </div>
            <div style={{ fontSize: '0.68rem', color: '#D1FAE5' }}>
              {distKm} km away
            </div>
          </div>
        )}
      </div>

      {/* Pre-Delivery Status Notice Card (If Agent has not taken delivery yet) */}
      {!hasAgentTakenDelivery ? (
        <div style={{ padding: '24px', background: '#F8FAFC', textAlign: 'center' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: '#EEF2FF',
            color: '#4F46E5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px auto',
            fontSize: '1.6rem',
            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.15)'
          }}>
            <i className="fa-solid fa-truck-ramp-box"></i>
          </div>

          <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: '800', color: '#0F172A' }}>
            {statusInfo.title}
          </h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '0.86rem', color: '#475569', maxWidth: '480px', marginInline: 'auto' }}>
            {statusInfo.desc}
          </p>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: '#FEF3C7',
            border: '1px solid #F59E0B',
            color: '#92400E',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '0.78rem',
            fontWeight: '700'
          }}>
            <i className="fa-solid fa-map-location-dot" style={{ color: '#D97706' }}></i>
            <span>📍 Live map tracking will open automatically once your delivery agent picks up the parcel!</span>
          </div>
        </div>
      ) : (
        /* Embedded Map (Revealed when Agent picks up order) */
        <div ref={mapContainerRef} style={{ width: '100%', height: '260px', position: 'relative' }} />
      )}

      {/* Rich Driver Info & Vehicle Badge Footer */}
      {order.deliveryAgentId && (
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)',
          borderTop: '2px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            
            {/* Agent Profile Photo or Initial Avatar */}
            <div style={{ position: 'relative' }}>
              {(order.deliveryAgentId.faceVerificationPhoto || order.deliveryAgentId.profileImage) ? (
                <img
                  src={order.deliveryAgentId.faceVerificationPhoto || order.deliveryAgentId.profileImage}
                  alt={order.deliveryAgentId.fullName || 'Rider'}
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2.5px solid #10B981',
                    boxShadow: '0 3px 10px rgba(16,185,129,0.3)'
                  }}
                />
              ) : (
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem',
                  fontWeight: '900',
                  border: '2.5px solid #3B82F6',
                  boxShadow: '0 3px 10px rgba(37,99,235,0.3)'
                }}>
                  {(order.deliveryAgentId.fullName || 'R').charAt(0).toUpperCase()}
                </div>
              )}

              {/* Verified Badge */}
              <div style={{
                position: 'absolute',
                bottom: '-2px',
                right: '-2px',
                background: '#10B981',
                color: '#FFF',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.62rem',
                border: '1.5px solid #FFF'
              }} title="KYC Face Verified Rider">
                <i className="fa-solid fa-check"></i>
              </div>
            </div>

            {/* Rider & Bike Info */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.05rem', fontWeight: '900', color: '#0F172A' }}>
                  {order.deliveryAgentId.fullName || 'Assigned Courier Agent'}
                </span>
                <span style={{ background: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: '10px', fontSize: '0.68rem', fontWeight: '800' }}>
                  <i className="fa-solid fa-shield-halved"></i> VERIFIED RIDER
                </span>
              </div>

              <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '700', color: '#1E293B' }}>
                  <i className="fa-solid fa-motorcycle" style={{ color: '#2563EB' }}></i>
                  {order.deliveryAgentId.vehicleType || 'Motorcycle'}
                </span>
                <span style={{ color: '#CBD5E1' }}>&bull;</span>
                <span style={{ fontFamily: 'monospace', fontWeight: '900', background: '#FEF08A', color: '#854D0E', padding: '1px 6px', borderRadius: '4px', border: '1px solid #FDE047', fontSize: '0.8rem' }}>
                  {order.deliveryAgentId.vehicleNumber || 'AP 39 BK 8204'}
                </span>
                {order.deliveryAgentId.drivingLicense && (
                  <>
                    <span style={{ color: '#CBD5E1' }}>&bull;</span>
                    <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                      DL: {order.deliveryAgentId.drivingLicense}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Call Agent Button */}
          {order.deliveryAgentId.phone && (
            <a
              href={`tel:${order.deliveryAgentId.phone}`}
              style={{
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                color: '#FFFFFF',
                padding: '10px 18px',
                borderRadius: '10px',
                fontSize: '0.88rem',
                fontWeight: '900',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                transition: 'all 0.2s ease'
              }}
            >
              <i className="fa-solid fa-phone-volume" style={{ fontSize: '1rem' }}></i>
              Call Rider ({order.deliveryAgentId.phone})
            </a>
          )}
        </div>
      )}
    </div>
  );
}

