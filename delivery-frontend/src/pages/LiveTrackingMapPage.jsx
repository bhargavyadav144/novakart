import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import deliveryApi, { formatINR } from '../services/deliveryApi';
import CustomerCallModal from '../components/CustomerCallModal';
import DoorstepDeliveryScanModal from '../components/DoorstepDeliveryScanModal';
import { useDeliveryAuth } from '../context/DeliveryAuthContext';
import { TILE_LAYERS, REGIONAL_MANDALS } from '../utils/regionalTerritoryData';

function getDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos((lat1*Math.PI)/180)*Math.cos((lat2*Math.PI)/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function getBearing(sLat, sLng, dLat, dLng) {
  const y = Math.sin(((dLng-sLng)*Math.PI)/180)*Math.cos((dLat*Math.PI)/180);
  const x = Math.cos((sLat*Math.PI)/180)*Math.sin((dLat*Math.PI)/180)-Math.sin((sLat*Math.PI)/180)*Math.cos((dLat*Math.PI)/180)*Math.cos(((dLng-sLng)*Math.PI)/180);
  return ((Math.atan2(y,x)*180)/Math.PI+360)%360;
}

async function fetchOSRMRoute(oLat, oLng, dLat, dLng) {
  const url = `https://router.project-osrm.org/route/v1/driving/${oLng},${oLat};${dLng},${dLat}?overview=full&geometries=geojson&alternatives=true&steps=true`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const json = await res.json();
    if (json.code !== 'Ok' || !json.routes?.length) return null;
    return json.routes;
  } catch(e) { console.warn('OSRM failed:', e.message); return null; }
}

async function geocodeAddress(street, city, postalCode, state) {
  const q = [street, city, postalCode, state || 'Andhra Pradesh', 'India'].filter(Boolean).join(', ');
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`, {
      headers: {'Accept-Language':'en','User-Agent':'SmartCart/1.0'},
      signal: AbortSignal.timeout(6000)
    });
    const r = await res.json();
    if (r?.length > 0) return { lat: parseFloat(r[0].lat), lng: parseFloat(r[0].lon) };
  } catch(e) {}
  return null;
}

function getPincodeCoords(pin, city) {
  const pm = {
    '522019':{lat:16.18,lng:80.39},'522017':{lat:16.165,lng:80.35},'522018':{lat:16.155,lng:80.425},
    '522014':{lat:16.12,lng:80.39},'522015':{lat:16.195,lng:80.45},'522016':{lat:16.182,lng:80.44},
    '522001':{lat:16.3067,lng:80.4365},'522002':{lat:16.31,lng:80.44},'522003':{lat:16.315,lng:80.432},
    '522004':{lat:16.28,lng:80.47},'522005':{lat:16.24,lng:80.49},'522006':{lat:16.298,lng:80.42},
    '522201':{lat:16.2437,lng:80.64},'522503':{lat:16.435,lng:80.56},'522237':{lat:16.54,lng:80.48},
    '522438':{lat:16.3330,lng:80.3280},'522009':{lat:16.315,lng:80.335},'522529':{lat:16.340,lng:80.310}
  };
  if (pin && pm[pin]) return pm[pin];
  const cm = {medikonduru:{lat:16.3330,lng:80.3280},perecherla:{lat:16.315,lng:80.335},prathipadu:{lat:16.18,lng:80.39},guntur:{lat:16.3067,lng:80.4365},tenali:{lat:16.2437,lng:80.64},mangalagiri:{lat:16.435,lng:80.56},tadepalle:{lat:16.48,lng:80.6},etukuru:{lat:16.28,lng:80.47},budampadu:{lat:16.24,lng:80.49}};
  const k = (city||'').toLowerCase();
  for (const [n,v] of Object.entries(cm)) { if (k.includes(n)) return v; }
  return {lat:16.3330,lng:80.3280};
}

function geoToLL(coords) { return coords.map(([lng,lat]) => [lat,lng]); }

export default function LiveTrackingMapPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { socket, agentUser } = useDeliveryAuth() || {};

  const [activeOrders, setActiveOrders] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [agentProfile, setAgentProfile] = useState(null);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const riderMarkerRef = useRef(null);
  const routeLayersRef = useRef([]);
  const altLayersRef = useRef([]);
  const zoneCircleRef = useRef(null);
  const polygonLayerRef = useRef(null);
  const villageMarkersRef = useRef([]);
  const destMarkerRef = useRef(null);
  const hubMarkerRef = useRef(null);
  const routeCoordsRef = useRef(null);
  const stepIdxRef = useRef(0);

  const [mapLayerType, setMapLayerType] = useState('satellite');
  const [mapReady, setMapReady] = useState(false);
  const [followMode, setFollowMode] = useState(true);
  const [riderCoord, setRiderCoord] = useState([16.3067, 80.4365]);
  const [riderHeading, setRiderHeading] = useState(45);
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [speedKmH, setSpeedKmH] = useState(0);

  const [destCoord, setDestCoord] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [activeRouteIdx, setActiveRouteIdx] = useState(0);
  const [routeAlts, setRouteAlts] = useState([]);
  const [showRoutePanel, setShowRoutePanel] = useState(false);

  const [turnInstruction, setTurnInstruction] = useState('En Route to Customer');
  const [turnIcon, setTurnIcon] = useState('fa-location-arrow');
  const [distKm, setDistKm] = useState(0);
  const [etaMin, setEtaMin] = useState(0);

  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [isDoorScanOpen, setIsDoorScanOpen] = useState(false);
  const [successNote, setSuccessNote] = useState('');

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const s = p.get('stop');
    if (s !== null) { const n = parseInt(s,10); if (!isNaN(n) && n>=0) setSelectedIndex(n); }
  }, [location.search]);

  useEffect(() => {
    const el = document.querySelector('.delivery-screen-body');
    if (el) el.classList.add('map-mode');
    return () => { if (el) el.classList.remove('map-mode'); };
  }, []);

  const fetchData = useCallback(() => {
    setLoading(true);
    deliveryApi.get('/delivery/dashboard-stats')
      .then(({data}) => {
        const orders = data.activeOrders || (data.activeOrder ? [data.activeOrder] : []);
        setActiveOrders(orders);
        setAgentProfile(data.stats);
        if (data.stats?.currentLocation?.lat && data.stats?.currentLocation?.lng) {
          setRiderCoord([data.stats.currentLocation.lat, data.stats.currentLocation.lng]);
        }
      })
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!socket) return;
    const h = () => fetchData();
    socket.on('agent_zone_assigned', h); socket.on('route_updated', h);
    socket.on('order_status_update', h); socket.on('warehouse_zone_updated', h);
    return () => {
      socket.off('agent_zone_assigned', h); socket.off('route_updated', h);
      socket.off('order_status_update', h); socket.off('warehouse_zone_updated', h);
    };
  }, [socket, fetchData]);

  const currentOrder = activeOrders[selectedIndex] || activeOrders[0] || null;
  const assignedZone = agentProfile?.assignedZone || null;

  const switchTile = useCallback((map, type) => {
    if (!map || !window.L) return;
    const L = window.L;
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    const cfg = TILE_LAYERS[type] || TILE_LAYERS.satellite;
    tileLayerRef.current = L.tileLayer(cfg.url, { maxZoom: cfg.maxZoom||19, attribution: cfg.attribution }).addTo(map);
  }, []);

  useEffect(() => {
    if (!window.L || !mapContainerRef.current || mapInstanceRef.current) return;
    const L = window.L;
    const map = L.map(mapContainerRef.current, { zoomControl: false, attributionControl: false }).setView(riderCoord, 14);
    L.control.zoom({ position: 'topright' }).addTo(map);
    switchTile(map, mapLayerType);
    mapInstanceRef.current = map;
    setMapReady(true);
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, []); // eslint-disable-line

  useEffect(() => { if (mapInstanceRef.current) switchTile(mapInstanceRef.current, mapLayerType); }, [mapLayerType, switchTile]);

  useEffect(() => {
    if (!mapReady || !currentOrder) return;
    const addr = currentOrder.deliveryAddress || {};
    const rSeq = currentOrder.routeSequence || {};
    const origin = riderCoord;
    async function load() {
      setRouteLoading(true);
      let dest = null;
      if (rSeq.lat && rSeq.lng) dest = { lat: parseFloat(rSeq.lat), lng: parseFloat(rSeq.lng) };
      else if (addr.lat && addr.lng) dest = { lat: parseFloat(addr.lat), lng: parseFloat(addr.lng) };
      if (!dest) dest = await geocodeAddress(addr.street, addr.city, addr.postalCode, addr.state);
      if (!dest) dest = getPincodeCoords(addr.postalCode, addr.city || rSeq.areaName);
      setDestCoord(dest);
      const routes = await fetchOSRMRoute(origin[0], origin[1], dest.lat, dest.lng);
      if (routes && routes.length > 0) {
        setRouteAlts(routes);
        setActiveRouteIdx(0);
        setDistKm(parseFloat((routes[0].distance/1000).toFixed(1)));
        setEtaMin(Math.ceil(routes[0].duration/60));
        const step = routes[0].legs?.[0]?.steps?.[0];
        if (step?.name) setTurnInstruction('Continue on ' + step.name);
      } else {
        setRouteAlts([]);
        const d = getDistanceKm(origin[0], origin[1], dest.lat, dest.lng);
        setDistKm(parseFloat(d.toFixed(1)));
        setEtaMin(Math.max(1, Math.round((d/30)*60)));
      }
      setRouteLoading(false);
    }
    load();
  }, [mapReady, currentOrder, selectedIndex]); // eslint-disable-line

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !window.L || !destCoord) return;
    const L = window.L;
    const map = mapInstanceRef.current;

    routeLayersRef.current.forEach(l => { try { map.removeLayer(l); } catch(e) {} });
    routeLayersRef.current = [];
    altLayersRef.current.forEach(l => { try { map.removeLayer(l); } catch(e) {} });
    altLayersRef.current = [];
    if (zoneCircleRef.current) { try { map.removeLayer(zoneCircleRef.current); } catch(e) {} }
    if (polygonLayerRef.current) { try { map.removeLayer(polygonLayerRef.current); polygonLayerRef.current = null; } catch(e) {} }
    villageMarkersRef.current.forEach(m => { try { map.removeLayer(m); } catch(e) {} });
    villageMarkersRef.current = [];
    if (destMarkerRef.current) { try { map.removeLayer(destMarkerRef.current); } catch(e) {} }
    if (hubMarkerRef.current) { try { map.removeLayer(hubMarkerRef.current); } catch(e) {} }

    if (assignedZone || currentOrder) {
      const targetSearch = (assignedZone?.mandal || assignedZone?.zoneName || currentOrder?.deliveryAddress?.city || '').toLowerCase();
      const currentPin = currentOrder?.deliveryAddress?.postalCode || '';
      
      const mm = REGIONAL_MANDALS.find(m => 
        m.mandal.toLowerCase() === targetSearch || 
        targetSearch.includes(m.mandal.toLowerCase()) || 
        (currentPin && m.pincodes.includes(currentPin))
      ) || REGIONAL_MANDALS.find(m => m.mandal === 'Medikonduru') || REGIONAL_MANDALS[0];

      const zc = assignedZone?.color || mm?.color || '#F59E0B';

      if (mm?.polygon?.length > 0) {
        polygonLayerRef.current = L.polygon(mm.polygon, { color: zc, weight: 3.5, dashArray: '6,6', fillColor: zc, fillOpacity: 0.18 }).addTo(map);
        const ci = L.divIcon({ className: 'rz-badge', html: `<div style="background:rgba(15,23,42,0.9);border:2px solid ${zc};color:#FFF;font-size:0.72rem;font-weight:800;padding:3px 8px;border-radius:12px;white-space:nowrap;transform:translate(-50%,-50%);pointer-events:none;"><div>${mm.mandal}</div><div style="font-size:0.62rem;color:#FCA5A5;">${mm.mandalTelugu || ''}</div></div>`, iconSize: [100, 28], iconAnchor: [50, 14] });
        villageMarkersRef.current.push(L.marker([mm.center.lat, mm.center.lng], { icon: ci }).addTo(map));
        (mm.villages || []).forEach(v => {
          if (v.lat && v.lng && !v.isCenter) {
            const vi = L.divIcon({ className: 'vl', html: `<div style="color:#FFF;text-shadow:0 1px 3px rgba(0,0,0,.95);font-size:0.68rem;font-weight:700;white-space:nowrap;transform:translate(-50%,-50%);pointer-events:none;"><div>${v.name}</div><div style="font-size:0.58rem;color:#CBD5E1;">${v.telugu || ''}</div></div>`, iconSize: [70, 20], iconAnchor: [35, 10] });
            villageMarkersRef.current.push(L.marker([v.lat, v.lng], { icon: vi }).addTo(map));
          }
        });
        const centerPos = assignedZone?.center || mm.center;
        if (centerPos) zoneCircleRef.current = L.circle([centerPos.lat, centerPos.lng], { radius: (assignedZone?.radiusKm || mm.radiusKm || 7.5) * 1000, color: zc, fillColor: zc, fillOpacity: 0.08, weight: 1.5, dashArray: '4,4' }).addTo(map);
      }
    }

    if (routeAlts.length > 1) {
      for (let i=1; i<routeAlts.length; i++) {
        const coords = geoToLL(routeAlts[i].geometry.coordinates);
        const ap = L.polyline(coords, { color:'#64748B', weight:5, opacity:0.55, dashArray:'4,4' }).addTo(map);
        ap.bindTooltip(`Alt Route ${i}: ${(routeAlts[i].distance/1000).toFixed(1)}km`, {sticky:true});
        ap.on('click', () => { setActiveRouteIdx(i); setDistKm(parseFloat((routeAlts[i].distance/1000).toFixed(1))); setEtaMin(Math.ceil(routeAlts[i].duration/60)); });
        altLayersRef.current.push(ap);
      }
    }

    let pCoords;
    if (routeAlts.length > 0) {
      const chosen = routeAlts[activeRouteIdx] || routeAlts[0];
      pCoords = geoToLL(chosen.geometry.coordinates);
      routeCoordsRef.current = pCoords;
      const glow = L.polyline(pCoords, { color:'#93C5FD', weight:10, opacity:0.3, lineJoin:'round' }).addTo(map);
      const main = L.polyline(pCoords, { color:'#2563EB', weight:6, opacity:0.92, lineJoin:'round', lineCap:'round' }).addTo(map);
      main.bindTooltip(`Best: ${distKm}km ~${etaMin}min`, {sticky:true});
      routeLayersRef.current.push(glow, main);
    } else {
      pCoords = [riderCoord, [destCoord.lat, destCoord.lng]];
      routeCoordsRef.current = pCoords;
      const fb = L.polyline(pCoords, { color:'#2563EB', weight:5, opacity:0.8, dashArray:'8,6' }).addTo(map);
      routeLayersRef.current.push(fb);
    }

    const hubI = L.divIcon({ html:`<div style="background:#0F172A;color:#fff;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;border:2px solid #38BDF8;font-size:13px;transform:translate(-50%,-50%)"><i class="fa-solid fa-warehouse"></i></div>`, className:'hub-pin', iconSize:[32,32], iconAnchor:[16,16] });
    hubMarkerRef.current = L.marker(riderCoord, {icon:hubI}).addTo(map).bindPopup('<b>Dispatch Hub</b><br>Pickup Origin');

    const addr = currentOrder?.deliveryAddress || {};
    const rName = addr.fullName || 'Customer';
    const aLine = [addr.street, addr.city, addr.postalCode].filter(Boolean).join(', ');
    const pm = (currentOrder?.paymentMethod||'').toLowerCase();
    const isCOD = pm.includes('cod') || pm.includes('cash');
    const dI = L.divIcon({
      html: `<div style="position:relative;transform:translate(-50%,-100%)"><span style="position:absolute;top:-8px;left:-8px;right:-8px;bottom:-8px;border-radius:50%;background:#EF4444;opacity:0.35;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite"></span><div style="width:40px;height:40px;background:#EF4444;border:3px solid #FFF;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#FFF;font-size:1.1rem;position:relative;z-index:2"><i class="fa-solid fa-house-user"></i></div><div style="position:absolute;top:44px;left:50%;transform:translateX(-50%);background:#0F172A;color:#FFF;padding:3px 8px;border-radius:6px;font-size:0.65rem;font-weight:800;white-space:nowrap;border-left:3px solid #EF4444;z-index:3">${rName}</div></div>`,
      className:'dest-pin', iconSize:[40,40], iconAnchor:[20,40]
    });
    destMarkerRef.current = L.marker([destCoord.lat, destCoord.lng], {icon:dI}).addTo(map)
      .bindPopup(`<div style="min-width:190px"><div style="font-weight:800;color:#DC2626">🏠 Delivery Destination</div><div style="font-weight:700;margin:4px 0">${rName}</div><div style="font-size:0.78rem;color:#475569">${aLine}</div>${addr.phone?`<div style="color:#2563EB;font-size:0.74rem;margin-top:3px">📞 ${addr.phone}</div>`:''}<div style="margin-top:6px;font-size:0.72rem;font-weight:800;color:${isCOD?'#B45309':'#15803D'}">${isCOD?`💵 COD: ${formatINR(currentOrder?.totalAmount)}`:'🔒 Prepaid – OTP Required'}</div></div>`);

    const zc = assignedZone?.color || '#10B981';
    if (!riderMarkerRef.current) {
      const rH = `<div class="rider-marker-ring" id="live-rider-marker"><div class="rider-marker-pulse" style="background:${zc}55"></div><div class="rider-marker-core" style="background:${zc};transform:rotate(${riderHeading}deg);transition:transform 0.3s ease"><i class="fa-solid fa-motorcycle"></i></div></div>`;
      const rI = L.divIcon({ html:rH, className:'animated-rider-icon', iconSize:[44,44], iconAnchor:[22,22] });
      riderMarkerRef.current = L.marker(riderCoord, {icon:rI, zIndexOffset:1000}).addTo(map);
    } else {
      riderMarkerRef.current.setLatLng(riderCoord);
    }

    if (pCoords && pCoords.length > 1) {
      const bounds = L.latLngBounds([...pCoords, [destCoord.lat, destCoord.lng], riderCoord]);
      map.fitBounds(bounds, { padding:[60,60], maxZoom:16, animate:true });
    }
  }, [mapReady, destCoord, routeAlts, activeRouteIdx, assignedZone]); // eslint-disable-line

  const syncToServer = useCallback((lat, lng, heading=0, speed=25) => {
    deliveryApi.put('/delivery/location', { lat, lng, address:`En route - ${currentOrder?.deliveryAddress?.city||''}` }).catch(()=>{});
    if (socket && agentUser) socket.emit('update_agent_location', { agentId: agentUser.agentId||agentUser.id, lat, lng, heading, speed, orderId: currentOrder?._id });
  }, [socket, agentUser, currentOrder]);

  const updateHUD = useCallback((lat, lng) => {
    if (!destCoord) return;
    const d = getDistanceKm(lat, lng, destCoord.lat, destCoord.lng);
    setDistKm(parseFloat(d.toFixed(1)));
    setEtaMin(Math.max(1, Math.round((d/30)*60)));
    if (d < 0.1) { setTurnInstruction('Arrived! Prepare package.'); setTurnIcon('fa-flag-checkered'); }
    else if (d < 0.4) { setTurnInstruction(`${(d*1000).toFixed(0)}m – destination ahead right`); setTurnIcon('fa-arrow-turn-right'); }
    else if (d < 1.0) { setTurnInstruction(`Continue towards ${currentOrder?.deliveryAddress?.city||'destination'}`); setTurnIcon('fa-arrow-up'); }
    else { setTurnInstruction(`Navigate to ${currentOrder?.deliveryAddress?.fullName||'Customer'} • ${currentOrder?.deliveryAddress?.city||''}`); setTurnIcon('fa-location-arrow'); }
  }, [destCoord, currentOrder]);

  useEffect(() => {
    if (!navigator.geolocation) { setGpsActive(false); return; }
    const id = navigator.geolocation.watchPosition(pos => {
      const { latitude:lat, longitude:lng, heading, speed, accuracy } = pos.coords;
      const nc = [lat, lng];
      setRiderCoord(nc); setGpsActive(true); setGpsAccuracy(Math.round(accuracy));
      if (speed != null) setSpeedKmH(Math.round(speed*3.6));
      if (riderMarkerRef.current) {
        riderMarkerRef.current.setLatLng(nc);
        if (heading != null) { setRiderHeading(heading); const ce = document.querySelector('#live-rider-marker .rider-marker-core'); if (ce) ce.style.transform=`rotate(${heading}deg)`; }
      }
      if (followMode && mapInstanceRef.current) mapInstanceRef.current.panTo(nc, {animate:true, duration:0.5});
      updateHUD(lat, lng);
      syncToServer(lat, lng, heading||0, Math.round((speed||8)*3.6));
    }, err => { console.warn('GPS:', err.message); setGpsActive(false); }, { enableHighAccuracy:true, maximumAge:2000, timeout:10000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [followMode, updateHUD, syncToServer]);

  const handleStepDrive = () => {
    const c = routeCoordsRef.current;
    if (!c || !c.length) return;
    const ni = (stepIdxRef.current+1) % c.length;
    stepIdxRef.current = ni;
    const prev = c[Math.max(0,ni-1)];
    const cur = c[ni];
    const brng = getBearing(prev[0], prev[1], cur[0], cur[1]);
    setRiderCoord(cur); setRiderHeading(brng);
    if (riderMarkerRef.current) { riderMarkerRef.current.setLatLng(cur); const ce = document.querySelector('#live-rider-marker .rider-marker-core'); if (ce) ce.style.transform=`rotate(${brng}deg)`; }
    if (followMode && mapInstanceRef.current) mapInstanceRef.current.panTo(cur, {animate:true});
    updateHUD(cur[0], cur[1]);
    syncToServer(cur[0], cur[1], brng, 36);
  };

  const handleRecenter = () => { if (mapInstanceRef.current && riderCoord) mapInstanceRef.current.flyTo(riderCoord, 17, {animate:true, duration:0.8}); };
  const handleFitRoute = () => { if (!mapInstanceRef.current || !destCoord) return; const b = window.L.latLngBounds([riderCoord, [destCoord.lat, destCoord.lng]]); mapInstanceRef.current.fitBounds(b, {padding:[60,60], animate:true}); };
  const handleGoogleMaps = () => { if (!destCoord) return; window.open(`https://www.google.com/maps/dir/?api=1&destination=${destCoord.lat},${destCoord.lng}&travelmode=driving`,'_blank'); };

  const handleUpdateStatus = async (status) => {
    if (!currentOrder) return;
    try { await deliveryApi.put(`/orders/delivery/${currentOrder._id}/update-status`, {status}); setSuccessNote('Status: '+status.replace(/_/g,' ')); fetchData(); }
    catch(e) { alert(e.response?.data?.message || 'Failed'); }
  };

  const handleDeliveryDone = () => {
    setIsDoorScanOpen(false);
    setSuccessNote(`Stop #${selectedIndex+1} Delivered!`);
    if (activeOrders.length > 1) { alert('Delivered! Next stop...'); fetchData(); setSelectedIndex(0); }
    else { alert('All done!'); navigate('/earnings'); }
  };

  const rawNum = currentOrder?.orderNumber || '';
  const parts = rawNum.split('-');
  const last6 = parts.length > 1 ? parts[parts.length-1] : rawNum.slice(-6);
  const destCity = currentOrder?.deliveryAddress?.city || 'Destination';
  const destStreet = currentOrder?.deliveryAddress?.street || '';
  const rName = currentOrder?.deliveryAddress?.fullName || 'Customer';
  const pm = (currentOrder?.paymentMethod||'').toLowerCase();
  const isCOD = pm.includes('cod') || pm.includes('cash');

  return (
    <div className="rapido-nav-wrapper">
      <div ref={mapContainerRef} className="rapido-map-viewport" />

      {routeLoading && (
        <div style={{position:'absolute',top:0,left:0,right:0,background:'rgba(37,99,235,0.95)',color:'#FFF',padding:'8px 16px',zIndex:200,display:'flex',alignItems:'center',gap:'10px',fontSize:'0.8rem',fontWeight:'700'}}>
          <i className="fa-solid fa-route fa-spin" />
          <span>Fetching real road route via OSRM...</span>
        </div>
      )}

      <div className="gmaps-top-banner">
        <div className="gmaps-turn-icon"><i className={`fa-solid ${turnIcon}`} /></div>
        <div className="gmaps-instruction">
          <h4 className="gmaps-instruction-title">{turnInstruction}</h4>
          <p className="gmaps-instruction-sub">
            <span>📍 <b>{destCity}</b></span><span>•</span>
            <span>{speedKmH > 0 ? `${speedKmH} km/h` : 'GPS Ready'}</span>
            {routeAlts.length > 1 && <span style={{color:'#FCD34D',fontWeight:'800'}}>• {routeAlts.length} routes</span>}
          </p>
        </div>
        <div className="gmaps-eta-badge">
          <div className="gmaps-eta-time">{etaMin} MIN</div>
          <div className="gmaps-eta-dist">{distKm} KM</div>
        </div>
      </div>

      <div style={{position:'absolute',top:'84px',left:'12px',zIndex:100,display:'flex',flexDirection:'column',gap:'4px'}}>
        <div style={{background:gpsActive?'rgba(6,78,59,0.92)':'rgba(120,53,15,0.92)',color:'#FFF',borderRadius:'20px',padding:'5px 12px',fontSize:'0.72rem',fontWeight:'800',display:'flex',alignItems:'center',gap:'6px',border:'1px solid rgba(255,255,255,0.2)'}}>
          <span style={{width:'8px',height:'8px',borderRadius:'50%',background:gpsActive?'#10B981':'#F59E0B',boxShadow:`0 0 8px ${gpsActive?'#10B981':'#F59E0B'}`}} />
          <span>{gpsActive ? `🟢 GPS ACTIVE${gpsAccuracy?` ±${gpsAccuracy}m`:''}` : '🟡 GPS CONNECTING'}</span>
        </div>
        {assignedZone && (
          <div style={{background:'rgba(15,23,42,0.88)',color:'#FFF',borderRadius:'20px',padding:'4px 10px',fontSize:'0.68rem',fontWeight:'700',display:'inline-flex',alignItems:'center',gap:'6px',border:`1.5px solid ${assignedZone.color||'#10B981'}`}}>
            <span style={{width:'8px',height:'8px',borderRadius:'50%',background:assignedZone.color||'#10B981'}} />
            Territory: <b>{assignedZone.zoneName}</b>
          </div>
        )}
        {currentOrder && destCoord && (
          <div style={{background:'rgba(15,23,42,0.88)',color:'#FFF',borderRadius:'8px',padding:'5px 10px',fontSize:'0.68rem',fontWeight:'600',border:'1px solid rgba(239,68,68,0.5)',maxWidth:'230px'}}>
            <div style={{color:'#FCA5A5',fontWeight:'800',fontSize:'0.65rem'}}>DELIVERING TO:</div>
            <div style={{fontWeight:'800',fontSize:'0.75rem',marginTop:'1px'}}>{rName}</div>
            <div style={{color:'#94A3B8',fontSize:'0.62rem',marginTop:'1px'}}>{destStreet && `${destStreet}, `}{destCity}{currentOrder.deliveryAddress?.postalCode && ` - ${currentOrder.deliveryAddress.postalCode}`}</div>
            <div style={{color:'#A78BFA',fontSize:'0.62rem',fontFamily:'monospace',marginTop:'2px'}}>📌 {destCoord.lat.toFixed(4)}, {destCoord.lng.toFixed(4)}</div>
          </div>
        )}
      </div>

      <div className="map-floating-controls">
        <button className="map-control-btn" onClick={() => setMapLayerType(p => p==='satellite'?'plain':'satellite')} style={{fontSize:'1rem',border:'2px solid #38BDF8'}}>
          {mapLayerType==='satellite'?'🗺️':'🛰️'}
        </button>
        <button className="map-control-btn" onClick={() => setFollowMode(p=>!p)} style={{border:followMode?'2px solid #10B981':'2px solid #94A3B8',background:followMode?'rgba(16,185,129,0.15)':undefined}}>
          <i className={`fa-solid ${followMode?'fa-lock':'fa-unlock'}`} style={{color:followMode?'#10B981':'#94A3B8'}} />
        </button>
        <button className="map-control-btn" onClick={handleRecenter}>
          <i className="fa-solid fa-location-crosshairs" style={{color:'#2563EB'}} />
        </button>
        <button className="map-control-btn" onClick={handleFitRoute}>
          <i className="fa-solid fa-expand" style={{color:'#8B5CF6'}} />
        </button>
        {routeAlts.length > 1 && (
          <button className="map-control-btn" onClick={() => setShowRoutePanel(p=>!p)} style={{fontSize:'0.72rem',fontWeight:'800',color:'#F59E0B',border:'2px solid #F59E0B'}}>
            {routeAlts.length} 🛣️
          </button>
        )}
        <button className="map-control-btn" onClick={handleGoogleMaps} style={{color:'#16A34A'}}>
          <i className="fa-solid fa-diamond-turn-right" />
        </button>
        <button className="map-control-btn" onClick={handleStepDrive} style={{fontSize:'0.76rem',fontWeight:'800',color:'#B45309'}}>
          <i className="fa-solid fa-forward-step" />
        </button>
      </div>

      {showRoutePanel && routeAlts.length > 1 && (
        <div style={{position:'absolute',top:'84px',right:'72px',zIndex:110,background:'rgba(15,23,42,0.96)',backdropFilter:'blur(10px)',borderRadius:'12px',padding:'12px',border:'1px solid rgba(255,255,255,0.15)',minWidth:'220px'}}>
          <div style={{color:'#94A3B8',fontSize:'0.7rem',fontWeight:'800',marginBottom:'8px',textTransform:'uppercase'}}>Route Options</div>
          {routeAlts.map((r,i) => (
            <button key={i} onClick={() => { setActiveRouteIdx(i); setDistKm(parseFloat((r.distance/1000).toFixed(1))); setEtaMin(Math.ceil(r.duration/60)); setShowRoutePanel(false); }}
              style={{display:'flex',width:'100%',alignItems:'center',justifyContent:'space-between',padding:'8px 10px',borderRadius:'8px',border:activeRouteIdx===i?'2px solid #2563EB':'1px solid rgba(255,255,255,0.1)',background:activeRouteIdx===i?'rgba(37,99,235,0.2)':'rgba(255,255,255,0.05)',color:'#FFF',cursor:'pointer',marginBottom:'4px',fontSize:'0.78rem',fontWeight:'700'}}>
              <span>{i===0?'🏆 Best':`Route ${i+1}`}</span>
              <span style={{color:'#38BDF8'}}>{(r.distance/1000).toFixed(1)}km • {Math.ceil(r.duration/60)}min</span>
            </button>
          ))}
        </div>
      )}

      {successNote && (
        <div style={{position:'absolute',top:'78px',left:'12px',right:'12px',zIndex:105,background:'#065F46',color:'#FFF',padding:'8px 12px',borderRadius:'8px',fontSize:'0.78rem',fontWeight:'700',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span>{successNote}</span>
          <button onClick={() => setSuccessNote('')} style={{background:'none',border:'none',color:'#fff',cursor:'pointer'}}>&times;</button>
        </div>
      )}

      <div className="rapido-bottom-card">
        <div className="rapido-stop-selector">
          <span style={{fontSize:'0.68rem',fontWeight:'800',color:'#64748B',textTransform:'uppercase'}}>Stops:</span>
          {activeOrders.map((ord,idx) => {
            const area = ord.routeSequence?.areaName || ord.deliveryAddress?.city || `Stop #${idx+1}`;
            return <button key={ord._id||idx} onClick={() => setSelectedIndex(idx)} className={`rapido-stop-pill ${idx===selectedIndex?'active':'inactive'}`}>#{idx+1} {area}</button>;
          })}
        </div>

        {currentOrder ? (
          <div className="rapido-card-content">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                  <span style={{fontSize:'0.7rem',fontWeight:'900',background:'#DBEAFE',color:'#1E40AF',padding:'2px 6px',borderRadius:'4px'}}>STOP #{selectedIndex+1} OF {activeOrders.length}</span>
                  <span style={{fontSize:'0.72rem',fontWeight:'800',color:isCOD?'#B45309':'#047857',background:isCOD?'#FEF3C7':'#D1FAE5',padding:'2px 6px',borderRadius:'4px'}}>{isCOD?`💵 COD ${formatINR(currentOrder.totalAmount)}`:'🔒 Prepaid'}</span>
                </div>
                <h3 style={{margin:'4px 0 0 0',fontSize:'1.05rem',fontWeight:'900',color:'#0F172A'}}>{rName}</h3>
              </div>
              <button type="button" onClick={() => setIsCallModalOpen(true)} style={{background:'#10B981',color:'#FFF',border:'none',borderRadius:'50%',width:'36px',height:'36px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',cursor:'pointer',flexShrink:0}}>
                <i className="fa-solid fa-phone" />
              </button>
            </div>

            <div style={{fontSize:'0.78rem',color:'#475569',lineHeight:'1.4',marginBottom:'8px',background:'#F8FAFC',padding:'8px 10px',borderRadius:'8px',border:'1px solid #E2E8F0'}}>
              <div style={{fontWeight:'700',color:'#0F172A',marginBottom:'2px'}}>📍 Delivery Address:</div>
              <div>{destStreet && `${destStreet}, `}<b>{destCity}</b></div>
              {currentOrder.deliveryAddress?.postalCode && <div style={{fontFamily:'monospace',color:'#2563EB',fontSize:'0.72rem'}}>PIN: {currentOrder.deliveryAddress.postalCode}</div>}
              {currentOrder.deliveryAddress?.state && <div style={{color:'#64748B',fontSize:'0.7rem'}}>{currentOrder.deliveryAddress.state}</div>}
              {destCoord && <div style={{color:'#8B5CF6',fontSize:'0.62rem',fontFamily:'monospace',marginTop:'2px'}}>GPS: {destCoord.lat.toFixed(5)}, {destCoord.lng.toFixed(5)}</div>}
            </div>

            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#F8FAFC',padding:'6px 10px',borderRadius:'8px',marginBottom:'10px',fontSize:'0.74rem'}}>
              <div>
                <span style={{color:'#64748B'}}>Order: </span>
                <span style={{fontFamily:'monospace',fontWeight:'800'}}>#{rawNum.replace(last6,'')}<span style={{background:'#FEF08A',color:'#854D0E',padding:'1px 4px',borderRadius:'3px'}}>{last6}</span></span>
              </div>
              <div style={{fontWeight:'800',color:'#2563EB'}}>📍 {distKm}km • ~{etaMin}min</div>
            </div>

            <div>
              {currentOrder.orderStatus === 'AGENT_ASSIGNED' && (
                <button type="button" onClick={() => handleUpdateStatus('PICKED_UP')} style={{width:'100%',background:'#10B981',color:'#090D16',border:'none',borderRadius:'10px',padding:'11px',fontSize:'0.86rem',fontWeight:'900',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
                  <i className="fa-solid fa-box-check" /> Mark Picked Up
                </button>
              )}
              {currentOrder.orderStatus === 'PICKED_UP' && (
                <button type="button" onClick={() => handleUpdateStatus('OUT_FOR_DELIVERY')} style={{width:'100%',background:'#F59E0B',color:'#090D16',border:'none',borderRadius:'10px',padding:'11px',fontSize:'0.86rem',fontWeight:'900',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
                  <i className="fa-solid fa-motorcycle" /> Start Journey &#8594; {destCity}
                </button>
              )}
              {currentOrder.orderStatus === 'OUT_FOR_DELIVERY' && (
                <button type="button" onClick={() => setIsDoorScanOpen(true)} style={{width:'100%',background:'linear-gradient(135deg,#10B981 0%,#059669 100%)',color:'#FFF',border:'none',borderRadius:'10px',padding:'12px',fontSize:'0.92rem',fontWeight:'900',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',boxShadow:'0 4px 16px rgba(16,185,129,0.45)'}}>
                  <i className="fa-solid fa-barcode" /> SUBMIT ORDER • DELIVER & VERIFY
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{padding:'24px 16px',textAlign:'center'}}>
            <h4 style={{margin:'0 0 6px 0',color:'#0F172A'}}>No Active Deliveries</h4>
            <p style={{margin:0,fontSize:'0.82rem',color:'#64748B'}}>Go to <b>Orders</b> tab to scan packages.</p>
            <button onClick={() => navigate('/orders')} style={{marginTop:'12px',background:'#2563EB',color:'#fff',border:'none',borderRadius:'8px',padding:'8px 16px',fontSize:'0.82rem',fontWeight:'800',cursor:'pointer'}}>Go to Orders &rarr;</button>
          </div>
        )}
      </div>

      {isDoorScanOpen && currentOrder && (
        <DoorstepDeliveryScanModal isOpen={isDoorScanOpen} onClose={() => setIsDoorScanOpen(false)} order={currentOrder} onDeliveryCompleted={handleDeliveryDone} />
      )}
      {isCallModalOpen && currentOrder && (
        <CustomerCallModal order={currentOrder} onClose={() => setIsCallModalOpen(false)} onCallCompleted={o => setSuccessNote(`Customer Contacted: ${o.replace(/_/g,' ')}`)} />
      )}
    </div>
  );
}
