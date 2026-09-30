import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import warehouseApi, { SOCKET_BASE_URL } from '../services/warehouseApi';
import { io } from 'socket.io-client';
import {
  TILE_LAYERS,
  REGIONAL_MANDALS,
  getLocalMandalDetection,
  haversineDistance,
  findMatchingMandal
} from '../utils/regionalTerritoryData';

const COLOR_PRESETS = [
  { name: 'Crimson Red', hex: '#EF4444' },
  { name: 'Emerald Green', hex: '#10B981' },
  { name: 'Royal Blue', hex: '#3B82F6' },
  { name: 'Vibrant Purple', hex: '#8B5CF6' },
  { name: 'Amber Orange', hex: '#F59E0B' },
  { name: 'Teal Cyan', hex: '#06B6D4' },
  { name: 'Hot Pink', hex: '#EC4899' },
  { name: 'Indigo Night', hex: '#6366F1' }
];

const MANDAL_PRESETS = REGIONAL_MANDALS.map((m) => ({
  name: m.zoneName,
  mandal: m.mandal,
  mandalTelugu: m.mandalTelugu,
  pincodes: m.pincodes,
  color: m.color,
  radiusKm: m.radiusKm,
  polygon: m.polygon
}));

export default function WarehouseRiders({ warehouse }) {
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedRider, setSelectedRider] = useState(null);
  const [newTempPassword, setNewTempPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Zone Map Editor Modal State
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [selectedRiderForZone, setSelectedRiderForZone] = useState(null);
  const [zoneFormData, setZoneFormData] = useState({
    zoneId: '',
    zoneName: '',
    mandal: '',
    pincodes: '',
    lat: 16.1800,
    lng: 80.3900,
    radiusKm: 7.0,
    color: '#EF4444'
  });
  const [savingZone, setSavingZone] = useState(false);
  const [zoneMsg, setZoneMsg] = useState({ type: '', text: '' });
  const [selectedMandals, setSelectedMandals] = useState([]);
  const [customBesidePin, setCustomBesidePin] = useState('');
  const [autoExpandingDemand, setAutoExpandingDemand] = useState(false);
  const [mapLayerType, setMapLayerType] = useState('satellite'); // 'satellite' | 'plain'
  const [isDrawingCircleMode, setIsDrawingCircleMode] = useState(false);
  const [detectingArea, setDetectingArea] = useState(false);
  const [autoVerifiedInfo, setAutoVerifiedInfo] = useState(null);

  // Mini-map ref for Zone Modal
  const miniMapContainerRef = useRef(null);
  const miniMapInstanceRef = useRef(null);
  const miniMapTileLayerRef = useRef(null);
  const miniMapCircleRef = useRef(null);
  const miniMapMarkerRef = useRef(null);
  const miniMapPolygonRef = useRef(null);
  const miniMapVillageMarkersRef = useRef([]);
  const isDrawingCircleModeRef = useRef(false);
  const drawingCircleStateRef = useRef({ isDrawing: false, startLatLng: null });

  // Live On-Duty Route Tracker Modal State ("Where is Rider Going")
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [trackingRider, setTrackingRider] = useState(null);
  const trackingMapContainerRef = useRef(null);
  const trackingMapInstanceRef = useRef(null);
  const trackingRiderMarkerRef = useRef(null);
  const trackingRoutePolylineRef = useRef(null);
  const trackingSocketRef = useRef(null);

  // Onboard Form State
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: 'RiderSecure123!',
    vehicleType: 'Motorcycle',
    vehicleNumber: '',
    drivingLicense: '',
    address: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelation: 'Spouse'
  });

  const fetchRiders = async () => {
    setLoading(true);
    try {
      const { data } = await warehouseApi.get('/warehouses/my-warehouse/riders');
      setRiders(data.riders || []);
    } catch (err) {
      console.error('Failed to load fleet riders', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiders();
  }, []);

  // Socket listener for live rider position updates on the table
  useEffect(() => {
    const socket = io(SOCKET_BASE_URL);
    if (warehouse?._id) {
      socket.emit('join_warehouse_fleet', warehouse._id);
      socket.emit('join_warehouse_room', warehouse._id);
    }

    socket.on('agent_live_location', (data) => {
      setRiders((prev) =>
        prev.map((r) => {
          if (r._id === data.agentId) {
            return {
              ...r,
              isOnline: true,
              currentLocation: {
                lat: data.lat,
                lng: data.lng,
                address: data.address || r.currentLocation?.address
              }
            };
          }
          return r;
        })
      );
    });

    socket.on('agent_status_change', (data) => {
      setRiders((prev) =>
        prev.map((r) => (r._id === data.agentId ? { ...r, isOnline: data.isOnline } : r))
      );
    });

    socket.on('warehouse_zone_updated', () => {
      fetchRiders();
    });

    return () => {
      socket.disconnect();
    };
  }, [warehouse?._id]);

  // Helper to render authentic administrative boundary polygon with dashed perimeter line matching Google Maps (Image 2)
  const renderBoundaryPolygonAndLabels = (map, mandalName, color) => {
    if (!map || !window.L) return;
    const L = window.L;

    if (miniMapPolygonRef.current) {
      map.removeLayer(miniMapPolygonRef.current);
      miniMapPolygonRef.current = null;
    }
    if (miniMapVillageMarkersRef.current && miniMapVillageMarkersRef.current.length > 0) {
      miniMapVillageMarkersRef.current.forEach((m) => map.removeLayer(m));
      miniMapVillageMarkersRef.current = [];
    }

    const matched = findMatchingMandal(mandalName);

    if (matched && matched.polygon && matched.polygon.length > 0) {
      // 1. Boundary Polygon with distinctive dashed perimeter line and translucent fill matching Image 2!
      const strokeColor = color || matched.color || '#EF4444';
      const poly = L.polygon(matched.polygon, {
        color: strokeColor,
        weight: 3.5,
        dashArray: '6, 6', // Distinct red & white dashed outline matching Google Maps
        fillColor: strokeColor,
        fillOpacity: 0.22
      }).addTo(map);
      miniMapPolygonRef.current = poly;

      // 2. Mandal Center Title Badge (English + Telugu)
      const centerLat = matched.center.lat;
      const centerLng = matched.center.lng;
      const labelIcon = L.divIcon({
        className: 'mandal-title-label',
        html: `
          <div style="
            background: rgba(15, 23, 42, 0.88);
            border: 2px solid ${strokeColor};
            color: #FFFFFF;
            border-radius: 8px;
            padding: 3px 8px;
            font-size: 0.8rem;
            font-weight: 800;
            white-space: nowrap;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.45);
            transform: translate(-50%, -50%);
            pointer-events: none;
          ">
            <div style="font-size: 0.82rem; font-weight: 900; letter-spacing: 0.3px;">${matched.mandal}</div>
            <div style="font-size: 0.7rem; color: #FCA5A5; font-weight: 700;">${matched.mandalTelugu || ''}</div>
          </div>
        `,
        iconSize: [110, 32],
        iconAnchor: [55, 16]
      });
      const titleMarker = L.marker([centerLat, centerLng], { icon: labelIcon }).addTo(map);
      miniMapVillageMarkersRef.current.push(titleMarker);

      // 3. Enclosed Village labels (e.g. Gottipadu, Mallayapalem, Ravipadu, Yamarru, Katrapadu)
      if (matched.villages && matched.villages.length > 0) {
        matched.villages.forEach((v) => {
          if (v.lat && v.lng && !v.isCenter) {
            const vIcon = L.divIcon({
              className: 'village-sub-pin',
              html: `
                <div style="
                  color: #FFFFFF;
                  text-shadow: 0 1px 3px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.95);
                  font-size: 0.72rem;
                  font-weight: 700;
                  white-space: nowrap;
                  transform: translate(-50%, -50%);
                  pointer-events: none;
                ">
                  <div style="line-height: 1;">${v.name}</div>
                  <div style="font-size: 0.62rem; color: #CBD5E1;">${v.telugu || ''}</div>
                </div>
              `,
              iconSize: [80, 22],
              iconAnchor: [40, 11]
            });
            const vMarker = L.marker([v.lat, v.lng], { icon: vIcon }).addTo(map);
            miniMapVillageMarkersRef.current.push(vMarker);
          }
        });
      }
    }
  };

  // Helper to switch map layer between Plain Map and Coloured Satellite
  const updateMapTileLayer = (map, type) => {
    if (!map || !window.L) return;
    const L = window.L;
    if (miniMapTileLayerRef.current) {
      map.removeLayer(miniMapTileLayerRef.current);
    }
    const layerConfig = TILE_LAYERS[type] || TILE_LAYERS.satellite;
    const layer = L.tileLayer(layerConfig.url, {
      maxZoom: layerConfig.maxZoom || 19,
      attribution: layerConfig.attribution
    }).addTo(map);
    miniMapTileLayerRef.current = layer;
  };

  // Backend Spatial Auto-Verification: Detects Mandal, Pincodes & Boundary from mouse circle
  const detectAndApplyAreaPincodes = async (lat, lng, radiusKm) => {
    setDetectingArea(true);
    try {
      const { data } = await warehouseApi.post('/warehouses/my-warehouse/detect-area-pincodes', {
        lat,
        lng,
        radiusKm
      });

      if (data.success) {
        setZoneFormData((prev) => ({
          ...prev,
          mandal: data.primaryMandal,
          zoneName: data.zoneName || `${data.primaryMandal} Mandal Sector`,
          pincodes: (data.autoVerifiedPincodes || []).join(', '),
          lat,
          lng,
          radiusKm,
          color: data.color || '#EF4444'
        }));

        setAutoVerifiedInfo({
          mandal: data.primaryMandal,
          telugu: data.primaryMandalTelugu,
          pincodes: data.autoVerifiedPincodes,
          villages: data.enclosedVillages || []
        });

        if (miniMapInstanceRef.current) {
          renderBoundaryPolygonAndLabels(miniMapInstanceRef.current, data.primaryMandal, data.color || '#EF4444');
        }
      }
    } catch (err) {
      console.error('Failed to auto-verify area via backend:', err);
      // Client-side fallback
      const local = getLocalMandalDetection(lat, lng, radiusKm);
      if (local) {
        setZoneFormData((prev) => ({
          ...prev,
          mandal: local.mandal,
          zoneName: local.zoneName,
          pincodes: local.pincodes.join(', '),
          lat,
          lng,
          radiusKm,
          color: local.color
        }));
        setAutoVerifiedInfo({
          mandal: local.mandal,
          telugu: local.mandalTelugu,
          pincodes: local.pincodes,
          villages: (local.villages || []).map((v) => (typeof v === 'string' ? v : v.name))
        });
        if (miniMapInstanceRef.current) {
          renderBoundaryPolygonAndLabels(miniMapInstanceRef.current, local.mandal, local.color);
        }
      }
    } finally {
      setDetectingArea(false);
    }
  };

  // Open Zone Setup Modal for a specific rider
  const openZoneModal = (rider) => {
    setSelectedRiderForZone(rider);
    const existingZone = rider.assignedZone;
    const existingZones = rider.assignedZones || [];

    let initialMandals = [];
    if (existingZones.length > 0) {
      initialMandals = existingZones.map(z => z.mandal).filter(Boolean);
    } else if (existingZone?.mandal) {
      initialMandals = [existingZone.mandal];
    } else {
      initialMandals = ['Prathipadu'];
    }
    setSelectedMandals(initialMandals);

    const defaultMandal = initialMandals[0] || 'Prathipadu';
    const defaultColor = existingZone?.color || '#EF4444';
    const matchedPreset = findMatchingMandal(defaultMandal);

    const defaultLat = existingZone?.center?.lat || matchedPreset.center.lat || 16.1800;
    const defaultLng = existingZone?.center?.lng || matchedPreset.center.lng || 80.3900;
    const defaultRadius = existingZone?.radiusKm || matchedPreset.radiusKm || 7.0;

    setZoneFormData({
      zoneId: existingZone?.zoneId || `ZONE-${Date.now().toString().slice(-6)}`,
      zoneName: existingZone?.zoneName || `${defaultMandal} Mandal Sector`,
      mandal: defaultMandal,
      pincodes: existingZone?.pincodes?.length > 0
        ? existingZone.pincodes.join(', ')
        : (matchedPreset.pincodes || []).join(', '),
      lat: defaultLat,
      lng: defaultLng,
      radiusKm: defaultRadius,
      color: defaultColor
    });

    setAutoVerifiedInfo({
      mandal: matchedPreset.mandal,
      telugu: matchedPreset.mandalTelugu,
      pincodes: matchedPreset.pincodes,
      villages: (matchedPreset.villages || []).map((v) => (typeof v === 'string' ? v : v.name))
    });

    setIsDrawingCircleMode(false);
    isDrawingCircleModeRef.current = false;
    setZoneMsg({ type: '', text: '' });
    setShowZoneModal(true);
  };

  // Sync ref with drawing mode state
  useEffect(() => {
    isDrawingCircleModeRef.current = isDrawingCircleMode;
    if (miniMapContainerRef.current) {
      miniMapContainerRef.current.style.cursor = isDrawingCircleMode ? 'crosshair' : 'default';
    }
  }, [isDrawingCircleMode]);

  // Initialize and update Mini Leaflet Map inside Zone Modal
  useEffect(() => {
    if (!showZoneModal) {
      if (miniMapInstanceRef.current) {
        miniMapInstanceRef.current.remove();
        miniMapInstanceRef.current = null;
      }
      return;
    }

    const L = window.L;
    if (!L) return;

    const timer = setTimeout(() => {
      if (!miniMapContainerRef.current) return;
      if (miniMapInstanceRef.current) {
        miniMapInstanceRef.current.remove();
      }

      const map = L.map(miniMapContainerRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView([zoneFormData.lat, zoneFormData.lng], 12);

      // Add Tile Layer (Satellite by default for vivid imagery)
      updateMapTileLayer(map, mapLayerType);

      // Warehouse Hub Marker
      if (warehouse?.location?.lat && warehouse?.location?.lng) {
        const whIcon = L.divIcon({
          className: 'mini-wh-pin',
          html: `<div style="background: #0F172A; color: #38BDF8; width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 2px solid #38BDF8; font-size: 0.8rem;"><i class="fa-solid fa-warehouse"></i></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });
        L.marker([warehouse.location.lat, warehouse.location.lng], { icon: whIcon })
          .bindTooltip(`🏢 Hub: ${warehouse.name}`, { permanent: false })
          .addTo(map);
      }

      // Zone Boundary Circle
      const circle = L.circle([zoneFormData.lat, zoneFormData.lng], {
        radius: zoneFormData.radiusKm * 1000,
        color: zoneFormData.color,
        fillColor: zoneFormData.color,
        fillOpacity: 0.16,
        weight: 2.5
      }).addTo(map);
      miniMapCircleRef.current = circle;

      // Zone Center Marker
      const centerMarker = L.marker([zoneFormData.lat, zoneFormData.lng], {
        draggable: true
      }).addTo(map);

      centerMarker.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        const fLat = parseFloat(lat.toFixed(5));
        const fLng = parseFloat(lng.toFixed(5));
        setZoneFormData((prev) => ({ ...prev, lat: fLat, lng: fLng }));
        detectAndApplyAreaPincodes(fLat, fLng, zoneFormData.radiusKm);
      });
      miniMapMarkerRef.current = centerMarker;

      // Render Initial Administrative Boundary Polygon (matching Image 2)
      renderBoundaryPolygonAndLabels(map, zoneFormData.mandal, zoneFormData.color);

      // Interactive Mouse Circle Drawing & Area Selection
      map.on('mousedown', (e) => {
        if (!isDrawingCircleModeRef.current) return;
        L.DomEvent.stopPropagation(e);
        map.dragging.disable();
        drawingCircleStateRef.current = {
          isDrawing: true,
          startLatLng: e.latlng
        };
      });

      map.on('mousemove', (e) => {
        if (!drawingCircleStateRef.current.isDrawing) return;
        const start = drawingCircleStateRef.current.startLatLng;
        if (!start) return;

        const distMeters = start.distanceTo(e.latlng);
        const radiusKm = Math.max(0.5, Math.round((distMeters / 1000) * 10) / 10);

        if (miniMapCircleRef.current) {
          miniMapCircleRef.current.setLatLng(start);
          miniMapCircleRef.current.setRadius(radiusKm * 1000);
        }
      });

      map.on('mouseup', (e) => {
        if (!drawingCircleStateRef.current.isDrawing) return;
        const start = drawingCircleStateRef.current.startLatLng;
        drawingCircleStateRef.current.isDrawing = false;
        map.dragging.enable();
        setIsDrawingCircleMode(false);
        isDrawingCircleModeRef.current = false;

        if (start) {
          const distMeters = start.distanceTo(e.latlng);
          const radiusKm = Math.max(1.0, Math.round((distMeters / 1000) * 10) / 10);
          const fLat = parseFloat(start.lat.toFixed(5));
          const fLng = parseFloat(start.lng.toFixed(5));

          if (miniMapMarkerRef.current) {
            miniMapMarkerRef.current.setLatLng([fLat, fLng]);
          }

          // Trigger Backend Spatial Auto-Verification
          detectAndApplyAreaPincodes(fLat, fLng, radiusKm);
        }
      });

      // Regular Map Click: Reposition and Auto-Detect
      map.on('click', (e) => {
        if (isDrawingCircleModeRef.current) return;
        const { lat, lng } = e.latlng;
        const fLat = parseFloat(lat.toFixed(5));
        const fLng = parseFloat(lng.toFixed(5));
        setZoneFormData((prev) => ({ ...prev, lat: fLat, lng: fLng }));
        detectAndApplyAreaPincodes(fLat, fLng, zoneFormData.radiusKm);
      });

      miniMapInstanceRef.current = map;
    }, 150);

    return () => clearTimeout(timer);
  }, [showZoneModal]);

  // Update Mini Map Tile Layer on Switch
  useEffect(() => {
    if (miniMapInstanceRef.current) {
      updateMapTileLayer(miniMapInstanceRef.current, mapLayerType);
    }
  }, [mapLayerType]);

  // Update Mini Map dynamically when form coordinates, radius, or color changes
  useEffect(() => {
    if (!miniMapInstanceRef.current) return;
    const L = window.L;
    if (!L) return;

    if (miniMapMarkerRef.current) {
      miniMapMarkerRef.current.setLatLng([zoneFormData.lat, zoneFormData.lng]);
    }

    if (miniMapCircleRef.current) {
      miniMapCircleRef.current.setLatLng([zoneFormData.lat, zoneFormData.lng]);
      miniMapCircleRef.current.setRadius(zoneFormData.radiusKm * 1000);
      miniMapCircleRef.current.setStyle({
        color: zoneFormData.color,
        fillColor: zoneFormData.color
      });
    }

    renderBoundaryPolygonAndLabels(miniMapInstanceRef.current, zoneFormData.mandal, zoneFormData.color);
    miniMapInstanceRef.current.panTo([zoneFormData.lat, zoneFormData.lng], { animate: true });
  }, [zoneFormData.lat, zoneFormData.lng, zoneFormData.radiusKm, zoneFormData.color, zoneFormData.mandal]);

  // 1-Click Auto-Assign Beside Mandals based on Order Demand / Load
  const handleAutoExpandByDemand = async () => {
    setAutoExpandingDemand(true);
    try {
      const { data } = await warehouseApi.get('/warehouses/my-warehouse/mandal-demand');
      if (data.mandalDemand && data.mandalDemand.length > 0) {
        const topMandals = data.mandalDemand.map(d => d.mandal).filter(Boolean);
        // Match top mandal presets
        const matchedNames = REGIONAL_MANDALS.filter(m => topMandals.some(tm => tm.toLowerCase().includes(m.mandal.toLowerCase()) || m.mandal.toLowerCase().includes(tm.toLowerCase()))).map(m => m.mandal);
        const finalMandalsToAssign = Array.from(new Set([...selectedMandals, ...matchedNames, ...topMandals])).slice(0, 5);

        setSelectedMandals(finalMandalsToAssign);
        setZoneMsg({
          type: 'success',
          text: `⚡ High Demand Engine: Auto-assigned ${finalMandalsToAssign.length} high-order mandals based on active order load!`
        });
      } else {
        // Fallback: pick 2 nearest mandals
        const hubLat = warehouse?.location?.lat || 16.3067;
        const hubLng = warehouse?.location?.lng || 80.4365;
        const nearest = [...MANDAL_PRESETS].sort((a, b) => {
          const dA = haversineDistance(hubLat, hubLng, a.polygon?.[0]?.[0] || 16.3, a.polygon?.[0]?.[1] || 80.4);
          const dB = haversineDistance(hubLat, hubLng, b.polygon?.[0]?.[0] || 16.3, b.polygon?.[0]?.[1] || 80.4);
          return dA - dB;
        }).slice(0, 3).map(m => m.mandal);

        setSelectedMandals(Array.from(new Set([...selectedMandals, ...nearest])));
        setZoneMsg({
          type: 'success',
          text: `⚡ Order Demand Verified: Auto-assigned 3 nearest high-capacity mandals!`
        });
      }
    } catch (err) {
      console.error('Failed to auto-expand by demand:', err);
    } finally {
      setAutoExpandingDemand(false);
    }
  };

  // Add Custom Beside Village Pincode manually by typing any 6-digit PIN
  const handleAddCustomBesidePincode = () => {
    if (!customBesidePin || customBesidePin.trim().length !== 6) return;
    const pin = customBesidePin.trim();
    const currentPins = zoneFormData.pincodes ? zoneFormData.pincodes.split(',').map(p => p.trim()).filter(Boolean) : [];

    if (!currentPins.includes(pin)) {
      const updatedPins = [...currentPins, pin].join(', ');
      setZoneFormData(prev => ({ ...prev, pincodes: updatedPins }));

      const presetMatch = REGIONAL_MANDALS.find(m => m.pincodes.includes(pin));
      if (presetMatch && !selectedMandals.includes(presetMatch.mandal)) {
        setSelectedMandals(prev => [...prev, presetMatch.mandal]);
      }

      setZoneMsg({
        type: 'success',
        text: `📍 Beside Village (PIN: ${pin}) successfully attached to Rider Territory!`
      });
      setCustomBesidePin('');
    }
  };

  // Handle Save Territory Zone for Rider (Single or N Mandals)
  const handleSaveZone = async (e) => {
    e.preventDefault();
    if (!selectedRiderForZone) return;

    setSavingZone(true);
    setZoneMsg({ type: '', text: '' });

    try {
      const activeMandals = selectedMandals.length > 0 ? selectedMandals : [zoneFormData.mandal || 'Prathipadu'];
      const zonesPayload = activeMandals.map((mName, idx) => {
        const matched = findMatchingMandal(mName);
        return {
          zoneId: `ZONE-${mName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}-${idx}`,
          zoneName: `${matched.mandal} Mandal Sector`,
          mandal: matched.mandal,
          pincodes: matched.pincodes,
          center: matched.center,
          radiusKm: matched.radiusKm,
          color: matched.color
        };
      });

      const { data } = await warehouseApi.put(
        `/warehouses/my-warehouse/riders/${selectedRiderForZone._id}/assign-zone`,
        { zones: zonesPayload }
      );

      setZoneMsg({
        type: 'success',
        text: data.message || `✅ Successfully assigned ${zonesPayload.length} Mandal(s) to rider ${selectedRiderForZone.fullName}!`
      });

      await fetchRiders();
      setTimeout(() => {
        setShowZoneModal(false);
      }, 1200);
    } catch (err) {
      setZoneMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update territory zone.'
      });
    } finally {
      setSavingZone(false);
    }
  };

  // Open Live On-Duty Route Tracker Modal ("Where is Rider Going?")
  const openTrackingModal = (rider) => {
    setTrackingRider(rider);
    setShowTrackingModal(true);
  };

  // Initialize and Render Live Route Map in On-Duty Tracking Modal
  useEffect(() => {
    if (!showTrackingModal || !trackingRider) {
      if (trackingMapInstanceRef.current) {
        trackingMapInstanceRef.current.remove();
        trackingMapInstanceRef.current = null;
      }
      if (trackingSocketRef.current) {
        trackingSocketRef.current.disconnect();
        trackingSocketRef.current = null;
      }
      return;
    }

    const L = window.L;
    if (!L) return;

    const timer = setTimeout(() => {
      if (!trackingMapContainerRef.current) return;
      if (trackingMapInstanceRef.current) {
        trackingMapInstanceRef.current.remove();
      }

      const riderLat = trackingRider.currentLocation?.lat || warehouse?.location?.lat || 16.3067;
      const riderLng = trackingRider.currentLocation?.lng || warehouse?.location?.lng || 80.4365;

      const dest = trackingRider.activeDelivery?.destination;
      const destLat = dest?.lat || riderLat + 0.012;
      const destLng = dest?.lng || riderLng + 0.018;

      const map = L.map(trackingMapContainerRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView([riderLat, riderLng], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

      // 1. Warehouse Hub Marker
      if (warehouse?.location?.lat && warehouse?.location?.lng) {
        const whIcon = L.divIcon({
          className: 'wh-hub-small-pin',
          html: `
            <div style="
              width: 32px;
              height: 32px;
              background: #0F172A;
              border: 2px solid #38BDF8;
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #38BDF8;
              font-size: 0.9rem;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            ">
              <i class="fa-solid fa-warehouse"></i>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });
        L.marker([warehouse.location.lat, warehouse.location.lng], { icon: whIcon })
          .bindTooltip(`🏢 Regional Hub: ${warehouse.name}`, { permanent: false })
          .addTo(map);
      }

      // 2. Rider Territory Boundary Circle
      const zColor = trackingRider.assignedZone?.color || '#10B981';
      const zRadiusKm = trackingRider.assignedZone?.radiusKm || 5.5;
      const zCenterLat = trackingRider.assignedZone?.center?.lat || riderLat;
      const zCenterLng = trackingRider.assignedZone?.center?.lng || riderLng;

      L.circle([zCenterLat, zCenterLng], {
        radius: zRadiusKm * 1000,
        color: zColor,
        dashArray: '5, 5',
        weight: 2,
        fillColor: zColor,
        fillOpacity: 0.1
      }).bindTooltip(`Mandal Zone: ${trackingRider.assignedZone?.mandal || 'Assigned Territory'} (${zRadiusKm} km coverage)`, { permanent: false }).addTo(map);

      // 3. Customer Destination Pin (🏁 / 🏠)
      const destIcon = L.divIcon({
        className: 'destination-delivery-pin',
        html: `
          <div style="
            position: relative;
            transform: translate(-50%, -50%);
          ">
            <span style="
              position: absolute;
              top: -6px;
              left: -6px;
              right: -6px;
              bottom: -6px;
              border-radius: 50%;
              background: #EF4444;
              opacity: 0.35;
              animation: ping 1.5s cubic-bezier(0,0,0.2,1) infinite;
            "></span>
            <div style="
              width: 42px;
              height: 42px;
              background: #EF4444;
              border: 3px solid #FFFFFF;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #FFFFFF;
              font-size: 1.15rem;
              box-shadow: 0 4px 14px rgba(239, 68, 68, 0.5);
              position: relative;
              z-index: 2;
            ">
              <i class="fa-solid fa-house-chimney-user"></i>
            </div>
            <div style="
              position: absolute;
              top: 44px;
              left: 50%;
              transform: translateX(-50%);
              background: #0F172A;
              color: #FFFFFF;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 0.72rem;
              font-weight: 800;
              white-space: nowrap;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              border-left: 3px solid #EF4444;
              z-index: 3;
            ">
              DESTINATION: ${dest?.recipientName || 'Customer'}
            </div>
          </div>
        `,
        iconSize: [42, 42],
        iconAnchor: [21, 21]
      });

      const destMarker = L.marker([destLat, destLng], { icon: destIcon }).addTo(map);
      destMarker.bindPopup(`
        <div style="font-family: inherit; min-width: 220px;">
          <div style="font-weight: 800; color: #DC2626; font-size: 0.95rem; margin-bottom: 4px;">
            🏁 Delivery Destination Stop
          </div>
          <div style="font-size: 0.85rem; font-weight: 700; color: #0F172A;">
            ${dest?.recipientName || 'Customer Doorstep'}
          </div>
          <div style="font-size: 0.78rem; color: #475569; margin: 4px 0;">
            ${dest?.street || 'Local Area Street'}, ${dest?.city || 'Guntur'}, ${dest?.postalCode || '522002'}
          </div>
          ${dest?.phone ? `<div style="font-size: 0.76rem; color: #2563EB;">📞 ${dest.phone}</div>` : ''}
        </div>
      `);

      // 4. Live Rider Moving Motorcycle Pin
      const riderIcon = L.divIcon({
        className: 'active-rider-live-pin',
        html: `
          <div style="
            position: relative;
            transform: translate(-50%, -50%);
          ">
            <span style="
              position: absolute;
              top: -6px;
              left: -6px;
              right: -6px;
              bottom: -6px;
              border-radius: 50%;
              background: ${zColor};
              opacity: 0.45;
              animation: ping 1.2s cubic-bezier(0,0,0.2,1) infinite;
            "></span>
            <div style="
              width: 44px;
              height: 44px;
              background: #0F172A;
              border: 3px solid ${zColor};
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              color: ${zColor};
              font-size: 1.2rem;
              box-shadow: 0 4px 14px rgba(0,0,0,0.4);
              position: relative;
              z-index: 2;
            ">
              <i class="fa-solid fa-motorcycle"></i>
            </div>
            <div style="
              position: absolute;
              top: 46px;
              left: 50%;
              transform: translateX(-50%);
              background: #0F172A;
              color: #FFFFFF;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 0.72rem;
              font-weight: 800;
              white-space: nowrap;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              border-left: 3px solid ${zColor};
              z-index: 3;
            ">
              ${trackingRider.fullName} (On Duty)
            </div>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });

      const riderMarker = L.marker([riderLat, riderLng], { icon: riderIcon }).addTo(map);
      riderMarker.bindPopup(`
        <div style="font-family: inherit; min-width: 200px;">
          <div style="font-weight: 800; color: #0F172A; font-size: 0.95rem;">
            🏍️ ${trackingRider.fullName}
          </div>
          <div style="font-size: 0.76rem; color: #16A34A; font-weight: 800; margin: 3px 0;">
            ● ON ACTIVE DELIVERY ROUTE
          </div>
          <div style="font-size: 0.78rem; color: #475569;">
            Vehicle: ${trackingRider.vehicleNumber} (${trackingRider.vehicleType})
          </div>
          <div style="font-size: 0.78rem; color: #475569;">
            Phone: ${trackingRider.phone}
          </div>
        </div>
      `);
      trackingRiderMarkerRef.current = riderMarker;

      // 5. Connecting Route Polyline (Rider to Destination)
      const routePoints = [
        [riderLat, riderLng],
        [(riderLat + destLat) / 2 + 0.002, (riderLng + destLng) / 2 - 0.001],
        [destLat, destLng]
      ];

      const polyline = L.polyline(routePoints, {
        color: '#2563EB',
        weight: 5,
        opacity: 0.85,
        dashArray: '8, 8'
      }).addTo(map);
      trackingRoutePolylineRef.current = polyline;

      // Fit map bounds to show both Rider and Destination comfortably
      const bounds = L.latLngBounds([[riderLat, riderLng], [destLat, destLng]]);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });

      trackingMapInstanceRef.current = map;

      // 6. Connect live socket to stream real-time coordinate updates
      const socket = io(SOCKET_BASE_URL);
      trackingSocketRef.current = socket;

      if (warehouse?._id) {
        socket.emit('join_warehouse_fleet', warehouse._id);
      }

      const handleLiveMove = (data) => {
        if (data.agentId === trackingRider._id) {
          const newLat = data.lat;
          const newLng = data.lng;

          if (trackingRiderMarkerRef.current) {
            trackingRiderMarkerRef.current.setLatLng([newLat, newLng]);
          }

          if (trackingRoutePolylineRef.current) {
            trackingRoutePolylineRef.current.setLatLngs([
              [newLat, newLng],
              [(newLat + destLat) / 2 + 0.002, (newLng + destLng) / 2 - 0.001],
              [destLat, destLng]
            ]);
          }

          setTrackingRider((prev) => ({
            ...prev,
            currentLocation: {
              ...prev.currentLocation,
              lat: newLat,
              lng: newLng,
              address: data.address || prev.currentLocation?.address
            }
          }));
        }
      };

      socket.on('agent_live_location', handleLiveMove);
      socket.on('rider_live_location', handleLiveMove);

    }, 150);

    return () => {
      clearTimeout(timer);
      if (trackingSocketRef.current) {
        trackingSocketRef.current.disconnect();
        trackingSocketRef.current = null;
      }
    };
  }, [showTrackingModal, trackingRider?._id]);

  const handleOnboardSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const payload = {
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        vehicleType: formData.vehicleType,
        vehicleNumber: formData.vehicleNumber,
        drivingLicense: formData.drivingLicense,
        address: formData.address || `${warehouse?.city || 'Local Area'}, ${warehouse?.state || 'AP'}`,
        emergencyContact: {
          name: formData.emergencyName,
          phone: formData.emergencyPhone,
          relation: formData.emergencyRelation
        }
      };

      const { data } = await warehouseApi.post('/warehouses/my-warehouse/riders', payload);
      setSuccessMsg(data.message || 'Delivery rider onboarded successfully!');
      setShowOnboardModal(false);
      setFormData({
        fullName: '',
        email: '',
        phone: '',
        password: 'RiderSecure123!',
        vehicleType: 'Motorcycle',
        vehicleNumber: '',
        drivingLicense: '',
        address: '',
        emergencyName: '',
        emergencyPhone: '',
        emergencyRelation: 'Spouse'
      });
      fetchRiders();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to onboard delivery rider');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!selectedRider || !newTempPassword) return;

    setSubmitting(true);
    setErrorMsg('');
    try {
      const { data } = await warehouseApi.put(
        `/warehouses/my-warehouse/riders/${selectedRider._id}/reset-temp-password`,
        { newTempPassword }
      );
      alert(data.message || 'Temporary password issued successfully!');
      setShowResetModal(false);
      setSelectedRider(null);
      setNewTempPassword('');
      fetchRiders();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  const onlineCount = riders.filter((r) => r.isOnline || r.isOnDuty).length;
  const withZoneCount = riders.filter((r) => r.assignedZone?.mandal || r.assignedZone?.zoneName).length;

  return (
    <div>
      {/* Top Banner with Direct Map Navigation & Real-time Metrics */}
      <div style={{
        background: '#0F172A',
        color: '#FFFFFF',
        borderRadius: '16px',
        padding: '24px 28px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.12)'
      }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#3B82F6', padding: '3px 10px', borderRadius: '20px', fontSize: '0.74rem', fontWeight: '800', marginBottom: '8px' }}>
            <i className="fa-solid fa-motorcycle"></i> FLEET OPERATIONS &amp; ONBOARDING
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800', margin: 0 }}>
            {warehouse?.name || 'Warehouse'} Courier Fleet
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#94A3B8' }}>
            In-person rider onboarding, fleet credential issuance, and territory dispatch &bull;{' '}
            <strong style={{ color: '#F1F5F9' }}>{riders.length} Registered Couriers</strong> &bull;{' '}
            <span style={{ color: '#10B981', fontWeight: '700' }}>● {onlineCount} On Duty Now</span> &bull;{' '}
            <span style={{ color: '#38BDF8', fontWeight: '700' }}>🗺️ {withZoneCount} Territory Zones Configured</span>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Direct Link to Live Fleet Command Map */}
          <Link
            to="/fleet-map"
            style={{
              background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
              color: '#FFFFFF',
              textDecoration: 'none',
              padding: '12px 20px',
              borderRadius: '10px',
              fontSize: '0.88rem',
              fontWeight: '700',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)',
              transition: 'all 0.2s'
            }}
          >
            <i className="fa-solid fa-map-location-dot" style={{ color: '#93C5FD' }}></i>
            View All Agents on Live Map
          </Link>

          <button
            onClick={() => { setShowOnboardModal(true); setErrorMsg(''); setSuccessMsg(''); }}
            style={{
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: '#FFFFFF',
              border: 'none',
              padding: '12px 22px',
              borderRadius: '10px',
              fontSize: '0.88rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
            }}
          >
            <i className="fa-solid fa-user-plus"></i> Onboard New Delivery Rider
          </button>
        </div>
      </div>

      {/* Strict Privacy Notice */}
      <div style={{
        background: '#EFF6FF',
        border: '1px solid #BFDBFE',
        borderRadius: '12px',
        padding: '14px 20px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '14px'
      }}>
        <i className="fa-solid fa-shield-halved" style={{ fontSize: '1.4rem', color: '#2563EB', marginTop: '2px' }}></i>
        <div>
          <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '800', color: '#1E3A8A' }}>
            End-to-End Courier Password Privacy &amp; Territory Dispatch Policy
          </h4>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#1E40AF', lineHeight: '1.5' }}>
            Delivery agents cannot register online; they must visit this warehouse in-person. The manager issues their <strong>initial temporary credentials</strong> and <strong>configures their designated Mandal/pincode delivery territory</strong> on the map.
            Once on duty, warehouse managers can monitor where each rider is actively heading with doorstep packages in real time.
          </p>
        </div>
      </div>

      {successMsg && (
        <div style={{
          background: '#F0FDF4',
          border: '1px solid #86EFAC',
          color: '#166534',
          padding: '14px 18px',
          borderRadius: '10px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.88rem'
        }}>
          <i className="fa-solid fa-circle-check" style={{ fontSize: '1.1rem' }}></i>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Fleet Roster Table with Territory & Destination Tracking */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '14px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ fontWeight: '800', color: '#0F172A', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-users" style={{ color: '#3B82F6' }}></i>
            Registered Hub Delivery Agents ({riders.length})
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link
              to="/fleet-map"
              style={{
                fontSize: '0.82rem',
                color: '#2563EB',
                fontWeight: '700',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <i className="fa-solid fa-satellite-dish"></i> Full Screen Radar
            </Link>
            <button
              onClick={fetchRiders}
              style={{
                background: 'none',
                border: 'none',
                color: '#475569',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <i className="fa-solid fa-arrows-rotate"></i> Refresh Roster
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#3B82F6' }}></i>
            <p style={{ marginTop: '12px', color: '#64748B' }}>Loading fleet couriers and territory maps...</p>
          </div>
        ) : riders.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <i className="fa-solid fa-motorcycle" style={{ fontSize: '3rem', color: '#CBD5E1', marginBottom: '14px' }}></i>
            <h3 style={{ margin: 0, color: '#334155' }}>No couriers onboarded yet</h3>
            <p style={{ color: '#94A3B8', fontSize: '0.86rem', marginTop: '6px' }}>
              Click "+ Onboard New Delivery Rider" above to register riders arriving at the hub.
            </p>
          </div>
        ) : (
          <table className="wh-table">
            <thead>
              <tr>
                <th>Rider Profile</th>
                <th>Assigned Territory / Mandal</th>
                <th>Contact Details</th>
                <th>Vehicle &amp; License</th>
                <th>Duty Status</th>
                <th>Password Security</th>
                <th>Manager Action</th>
              </tr>
            </thead>
            <tbody>
              {riders.map((r) => {
                const zoneColor = r.assignedZone?.color || '#3B82F6';
                const hasZone = r.assignedZone?.mandal || r.assignedZone?.zoneName;
                const mandalName = r.assignedZone?.mandal || r.assignedZone?.zoneName;
                const pincodes = r.assignedZone?.pincodes || [];
                const isOnDuty = r.isOnline || r.isOnDuty;
                const activeDelivery = r.activeDelivery;

                return (
                  <tr key={r._id} style={{ background: isOnDuty ? 'rgba(240, 253, 244, 0.4)' : 'inherit' }}>
                    {/* 1. Rider Profile */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ position: 'relative' }}>
                          {r.profileImage || r.faceVerificationPhoto ? (
                            <img
                              src={r.profileImage || r.faceVerificationPhoto}
                              alt={r.fullName}
                              style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: `2px solid ${hasZone ? zoneColor : '#CBD5E1'}`
                              }}
                            />
                          ) : (
                            <div style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                              color: '#FFFFFF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: '900',
                              fontSize: '1.2rem',
                              border: `2px solid ${hasZone ? zoneColor : '#3B82F6'}`
                            }}>
                              {(r.fullName || 'A').charAt(0).toUpperCase()}
                            </div>
                          )}
                          {r.isFaceVerified && (
                            <span
                              title="Live Face Verified (Biometric KYC Passed)"
                              style={{
                                position: 'absolute',
                                top: '-3px',
                                right: '-3px',
                                background: '#10B981',
                                color: '#FFF',
                                borderRadius: '50%',
                                width: '16px',
                                height: '16px',
                                fontSize: '0.58rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1.5px solid #FFF'
                              }}
                            >
                              <i className="fa-solid fa-lock"></i>
                            </span>
                          )}
                          {isOnDuty && (
                            <span
                              title="Rider is On Duty"
                              style={{
                                position: 'absolute',
                                bottom: 0,
                                right: 0,
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                background: '#10B981',
                                border: '2px solid #FFFFFF'
                              }}
                            />
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: '800', color: '#0F172A', fontSize: '0.92rem' }}>
                            {r.fullName}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
                            Onboarded: {new Date(r.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                          {r.completedDeliveries !== undefined && (
                            <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: '700' }}>
                              ✓ {r.completedDeliveries || 0} Total Deliveries Done
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 2. Assigned Territory / Mandal (NEW) */}
                    <td>
                      {hasZone ? (
                        <div style={{ minWidth: '170px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: zoneColor, display: 'inline-block' }}></span>
                            <span style={{ fontWeight: '800', fontSize: '0.85rem', color: '#0F172A' }}>
                              {mandalName}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.72rem', color: '#64748B', marginBottom: '4px' }}>
                            {r.assignedZone.radiusKm || 5} km radius sector
                          </div>

                          {/* 5-6 Pincodes Cluster Badges */}
                          {pincodes.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '6px' }}>
                              {pincodes.slice(0, 4).map((pin) => (
                                <span
                                  key={pin}
                                  style={{
                                    background: '#F1F5F9',
                                    color: '#1E293B',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    fontSize: '0.68rem',
                                    fontWeight: '700',
                                    fontFamily: 'monospace'
                                  }}
                                >
                                  {pin}
                                </span>
                              ))}
                              {pincodes.length > 4 && (
                                <span style={{ fontSize: '0.66rem', color: '#2563EB', fontWeight: '700', alignSelf: 'center' }}>
                                  +{pincodes.length - 4} more
                                </span>
                              )}
                            </div>
                          )}

                          <button
                            onClick={() => openZoneModal(r)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#2563EB',
                              fontSize: '0.72rem',
                              fontWeight: '700',
                              cursor: 'pointer',
                              padding: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <i className="fa-solid fa-pen-to-square"></i> Edit Territory
                          </button>
                        </div>
                      ) : (
                        <div>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#FFFBEB',
                            color: '#B45309',
                            border: '1px dashed #FCD34D',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            marginBottom: '4px'
                          }}>
                            <i className="fa-solid fa-triangle-exclamation"></i> No Zone Set
                          </span>
                          <br />
                          <button
                            onClick={() => openZoneModal(r)}
                            style={{
                              background: '#F0F9FF',
                              border: '1px solid #BAE6FD',
                              color: '#0284C7',
                              fontSize: '0.72rem',
                              fontWeight: '800',
                              cursor: 'pointer',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              marginTop: '2px'
                            }}
                          >
                            <i className="fa-solid fa-map-pin"></i> Assign Map Zone
                          </button>
                        </div>
                      )}
                    </td>

                    {/* 3. Contact Details */}
                    <td>
                      <div style={{ fontSize: '0.84rem', fontWeight: '700', color: '#1E293B' }}>
                        <i className="fa-solid fa-phone" style={{ color: '#3B82F6', marginRight: '6px', fontSize: '0.78rem' }}></i>
                        {r.phone}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
                        <i className="fa-solid fa-envelope" style={{ color: '#94A3B8', marginRight: '6px', fontSize: '0.75rem' }}></i>
                        {r.email}
                      </div>
                      {r.emergencyContact?.name && (
                        <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '3px' }}>
                          Emergency: {r.emergencyContact.name} ({r.emergencyContact.phone})
                        </div>
                      )}
                    </td>

                    {/* 4. Vehicle & License */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          background: '#F1F5F9',
                          color: '#0F172A',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: '800',
                          fontSize: '0.78rem',
                          fontFamily: 'monospace'
                        }}>
                          {r.vehicleNumber}
                        </span>
                        <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                          ({r.vehicleType})
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '4px' }}>
                        DL: <strong>{r.drivingLicense}</strong>
                      </div>
                    </td>

                    {/* 5. Duty Status & Where Rider is Going */}
                    <td>
                      <div>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          background: isOnDuty ? '#DCFCE7' : '#F1F5F9',
                          color: isOnDuty ? '#166534' : '#64748B'
                        }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: isOnDuty ? '#16A34A' : '#94A3B8',
                            animation: isOnDuty ? 'ping 1.5s infinite' : 'none'
                          }}></span>
                          {isOnDuty ? 'On Active Duty' : 'Offline / Standby'}
                        </span>

                        {/* If on duty, show active destination status */}
                        {isOnDuty && (
                          <div style={{ marginTop: '5px' }}>
                            {activeDelivery?.orderNumber ? (
                              <div style={{
                                fontSize: '0.72rem',
                                color: '#1D4ED8',
                                fontWeight: '700',
                                background: '#EFF6FF',
                                padding: '3px 7px',
                                borderRadius: '4px',
                                border: '1px solid #BFDBFE',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <i className="fa-solid fa-box"></i> Order #{activeDelivery.orderNumber}
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: '700' }}>
                                🛵 Patrolling Territory
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 6. Password Security Status */}
                    <td>
                      {r.mustChangePassword ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: '700',
                          background: '#FEF3C7',
                          color: '#92400E',
                          border: '1px solid #FDE68A'
                        }}>
                          <i className="fa-solid fa-clock"></i> Temp Password Active
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: '700',
                          background: '#F0FDF4',
                          color: '#166534',
                          border: '1px solid #BBF7D0'
                        }}>
                          <i className="fa-solid fa-lock"></i> Secured by Rider
                        </span>
                      )}
                      <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: '3px' }}>
                        Password is encrypted
                      </div>
                    </td>

                    {/* 7. Manager Actions */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '160px' }}>
                        {/* On-Duty Route Tracker Button ("Where is the rider going?") */}
                        {isOnDuty && (
                          <button
                            onClick={() => openTrackingModal(r)}
                            title="See live location and customer destination stop"
                            style={{
                              background: 'linear-gradient(135deg, #10B981, #059669)',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '6px 12px',
                              fontSize: '0.76rem',
                              fontWeight: '800',
                              color: '#FFFFFF',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)'
                            }}
                          >
                            <i className="fa-solid fa-location-arrow"></i> Where is Rider Going?
                          </button>
                        )}

                        {/* Update Map Territory Zone */}
                        <button
                          onClick={() => openZoneModal(r)}
                          style={{
                            background: '#F0F9FF',
                            border: '1px solid #BAE6FD',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '0.76rem',
                            fontWeight: '700',
                            color: '#0369A1',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <i className="fa-solid fa-draw-polygon" style={{ color: '#0284C7' }}></i> Update Territory Map
                        </button>

                        {/* Issue Temp Password */}
                        <button
                          onClick={() => {
                            setSelectedRider(r);
                            setNewTempPassword('TempPass' + Math.floor(1000 + Math.random() * 9000) + '!');
                            setShowResetModal(true);
                          }}
                          style={{
                            background: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            borderRadius: '6px',
                            padding: '5px 12px',
                            fontSize: '0.74rem',
                            fontWeight: '700',
                            color: '#475569',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <i className="fa-solid fa-key" style={{ color: '#F59E0B' }}></i> Issue Temp Password
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL: UPDATE RIDER MAP TERRITORY ZONE */}
      {showZoneModal && selectedRiderForZone && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            width: '100%',
            maxWidth: '620px',
            maxHeight: '92vh',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              background: '#0F172A',
              padding: '18px 24px',
              color: '#FFFFFF',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-draw-polygon" style={{ color: zoneFormData.color }}></i>
                  Update Delivery Territory Map Zone
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.76rem', color: '#94A3B8' }}>
                  Assign Mandal, 5-6 pincodes, and territory boundary for <strong>{selectedRiderForZone.fullName}</strong>
                </p>
              </div>
              <button
                onClick={() => setShowZoneModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveZone} style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              {zoneMsg.text && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  marginBottom: '14px',
                  fontSize: '0.84rem',
                  fontWeight: '700',
                  background: zoneMsg.type === 'success' ? '#DCFCE7' : '#FEE2E2',
                  color: zoneMsg.type === 'success' ? '#15803D' : '#B91C1C'
                }}>
                  {zoneMsg.text}
                </div>
              )}

              {/* Auto-Verification Feedback Banner */}
              {detectingArea && (
                <div style={{
                  background: '#FEF3C7',
                  border: '1px solid #FCD34D',
                  color: '#92400E',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  marginBottom: '12px',
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <i className="fa-solid fa-satellite fa-spin" style={{ color: '#D97706' }}></i>
                  <span>Spatial Engine: Auto-verifying mandal boundary and 5-6 pincodes cluster...</span>
                </div>
              )}

              {autoVerifiedInfo && !detectingArea && (
                <div style={{
                  background: '#ECFDF5',
                  border: '1.5px solid #6EE7B7',
                  color: '#065F46',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  marginBottom: '12px',
                  fontSize: '0.76rem',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-circle-check" style={{ color: '#10B981', fontSize: '1rem' }}></i>
                    <div>
                      <div>
                        <strong>✅ Auto-Verified by Backend:</strong> {autoVerifiedInfo.mandal} ({autoVerifiedInfo.telugu})
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#047857', marginTop: '1px' }}>
                        Cluster of {autoVerifiedInfo.pincodes?.length || 5} PINs: {(autoVerifiedInfo.pincodes || []).join(', ')}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.66rem', background: '#D1FAE5', color: '#047857', padding: '2px 8px', borderRadius: '4px', fontWeight: '800', flexShrink: 0 }}>
                    Boundary Dashed Polygon Ready
                  </span>
                </div>
              )}

              {/* Multi-Mandal Assignment Picker (Assign N Mandals based on distance & size) */}
              <div style={{ marginBottom: '16px', background: '#F8FAFC', padding: '14px', borderRadius: '12px', border: '1.5px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-layer-group" style={{ color: '#2563EB' }}></i> Select N Mandals for Rider (Multi-Mandal Assignment)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={handleAutoExpandByDemand}
                      disabled={autoExpandingDemand}
                      title="Auto-detect high demand mandals with active unassigned orders and assign them to rider"
                      style={{
                        background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '4px 10px',
                        fontSize: '0.72rem',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: '0 2px 6px rgba(245, 158, 11, 0.3)'
                      }}
                    >
                      <i className={`fa-solid ${autoExpandingDemand ? 'fa-spinner fa-spin' : 'fa-bolt'}`}></i>
                      {autoExpandingDemand ? 'Scanning Demand...' : '⚡ Auto-Assign by Order Load'}
                    </button>
                    <span style={{ fontSize: '0.72rem', background: '#DBEAFE', color: '#1E40AF', padding: '2px 8px', borderRadius: '10px', fontWeight: '800' }}>
                      {selectedMandals.length} Mandal(s) Selected
                    </span>
                  </div>
                </div>
                <p style={{ margin: '0 0 10px 0', fontSize: '0.72rem', color: '#64748B' }}>
                  Toggle mandals below based on geographic distance from hub and mandal size. Orders in all selected mandals will route to this rider.
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                  {MANDAL_PRESETS.map((mp) => {
                    const isSelected = selectedMandals.includes(mp.mandal);
                    const hubLat = warehouse?.location?.lat || 16.3067;
                    const hubLng = warehouse?.location?.lng || 80.4365;
                    const distFromHub = Math.round(haversineDistance(hubLat, hubLng, mp.polygon?.[0]?.[0] || 16.3, mp.polygon?.[0]?.[1] || 80.4) * 10) / 10;

                    return (
                      <button
                        key={mp.mandal}
                        type="button"
                        onClick={() => {
                          const matched = REGIONAL_MANDALS.find((r) => r.mandal === mp.mandal);
                          setSelectedMandals((prev) => {
                            if (prev.includes(mp.mandal)) {
                              if (prev.length <= 1) return prev; // Keep at least 1
                              return prev.filter((m) => m !== mp.mandal);
                            } else {
                              return [...prev, mp.mandal];
                            }
                          });

                          setZoneFormData({
                            ...zoneFormData,
                            zoneName: `${mp.mandal} Sector`,
                            mandal: mp.mandal,
                            pincodes: mp.pincodes.join(', '),
                            color: mp.color,
                            radiusKm: mp.radiusKm,
                            lat: matched ? matched.center.lat : zoneFormData.lat,
                            lng: matched ? matched.center.lng : zoneFormData.lng
                          });

                          if (miniMapInstanceRef.current && matched) {
                            miniMapInstanceRef.current.setView([matched.center.lat, matched.center.lng], 12);
                            renderBoundaryPolygonAndLabels(miniMapInstanceRef.current, mp.mandal, mp.color);
                          }
                        }}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '16px',
                          border: isSelected ? `2px solid ${mp.color}` : '1px solid #CBD5E1',
                          background: isSelected ? '#0F172A' : '#FFFFFF',
                          color: isSelected ? '#FFFFFF' : '#334155',
                          fontSize: '0.74rem',
                          fontWeight: '800',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: isSelected ? `0 2px 8px ${mp.color}40` : 'none'
                        }}
                      >
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: mp.color }}></span>
                        {isSelected && <i className="fa-solid fa-check" style={{ color: '#10B981', fontSize: '0.7rem' }}></i>}
                        <span>{mp.mandal}</span>
                        {mp.mandalTelugu && <span style={{ fontSize: '0.68rem', color: isSelected ? '#93C5FD' : '#64748B' }}>({mp.mandalTelugu})</span>}
                        <span style={{ fontSize: '0.65rem', background: isSelected ? 'rgba(255,255,255,0.15)' : '#F1F5F9', padding: '1px 5px', borderRadius: '8px' }}>
                          ~{distFromHub} km • {mp.radiusKm} km rad
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Multi-Mandal Summary Banner */}
                {selectedMandals.length > 0 && (
                  <div style={{
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '0.74rem',
                    color: '#0F172A',
                    fontWeight: '700'
                  }}>
                    <div style={{ color: '#0369A1', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="fa-solid fa-route"></i>
                      <span>Assigned Territory Summary ({selectedMandals.length} Mandals):</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {selectedMandals.map(mName => {
                        const match = findMatchingMandal(mName);
                        return (
                          <span key={mName} style={{
                            background: '#0F172A',
                            color: '#FFFFFF',
                            border: `1px solid ${match.color}`,
                            padding: '1px 7px',
                            borderRadius: '10px',
                            fontSize: '0.7rem',
                            fontWeight: '800'
                          }}>
                            {match.mandal} {match.mandalTelugu ? `(${match.mandalTelugu})` : ''} ({match.pincodes?.length || 0} PINs)
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Mandal Name & Territory Zone Title */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Mandal Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={zoneFormData.mandal}
                    onChange={(e) => setZoneFormData({ ...zoneFormData, mandal: e.target.value })}
                    placeholder="e.g. Prathipadu / Guntur Urban"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.84rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Territory Zone Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={zoneFormData.zoneName}
                    onChange={(e) => setZoneFormData({ ...zoneFormData, zoneName: e.target.value })}
                    placeholder="e.g. Prathipadu Mandal Sector"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.84rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Serviced Delivery Pincodes (5 to 6 or more) */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: '800', color: '#1E293B' }}>
                    Serviced Pincodes (5 to 6 Pincodes Cluster) *
                  </label>
                  <span style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: '700' }}>
                    {zoneFormData.pincodes ? zoneFormData.pincodes.split(',').filter(Boolean).length : 0} PINs Selected
                  </span>
                </div>
                <input
                  type="text"
                  required
                  value={zoneFormData.pincodes}
                  onChange={(e) => setZoneFormData({ ...zoneFormData, pincodes: e.target.value })}
                  placeholder="522019, 522017, 522018, 522014, 522015, 522016"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.86rem', fontFamily: 'monospace', boxSizing: 'border-box' }}
                />
                {zoneFormData.pincodes && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                    {zoneFormData.pincodes.split(',').map((p) => p.trim()).filter(Boolean).map((pin) => (
                      <span
                        key={pin}
                        style={{
                          background: '#EFF6FF',
                          color: '#1D4ED8',
                          border: '1px solid #BFDBFE',
                          borderRadius: '4px',
                          padding: '1px 6px',
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          fontFamily: 'monospace'
                        }}
                      >
                        📌 {pin}
                      </span>
                    ))}
                  </div>
                )}

                {/* Attach Beside Village Pincode input */}
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', background: '#F8FAFC', padding: '8px 10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <i className="fa-solid fa-map-pin" style={{ color: '#EF4444' }}></i> Attach Beside Village PIN:
                  </span>
                  <input
                    type="text"
                    maxLength={6}
                    value={customBesidePin}
                    onChange={(e) => setCustomBesidePin(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="e.g. 522438 / 522529"
                    style={{
                      flex: 1,
                      padding: '5px 9px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.8rem',
                      fontFamily: 'monospace'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomBesidePincode}
                    disabled={!customBesidePin || customBesidePin.length !== 6}
                    style={{
                      background: customBesidePin && customBesidePin.length === 6 ? '#0F172A' : '#94A3B8',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '5px 12px',
                      fontSize: '0.74rem',
                      fontWeight: '800',
                      cursor: customBesidePin && customBesidePin.length === 6 ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <i className="fa-solid fa-plus"></i> Attach Village
                  </button>
                </div>
              </div>

              {/* Interactive Mini Map Preview with Layer Switcher & Mouse Drawing Mode */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: '800', color: '#1E293B', display: 'block' }}>
                      Interactive Territory Map & Boundary
                    </label>
                    <span style={{ fontSize: '0.7rem', color: '#64748B' }}>
                      Red dashed perimeter shows administrative boundary (Image 2 style)
                    </span>
                  </div>

                  {/* Layer Switcher and Draw Circle with Mouse Tool */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ display: 'inline-flex', background: '#F1F5F9', padding: '2px', borderRadius: '6px', border: '1px solid #CBD5E1' }}>
                      <button
                        type="button"
                        onClick={() => setMapLayerType('satellite')}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          border: 'none',
                          background: mapLayerType === 'satellite' ? '#0F172A' : 'transparent',
                          color: mapLayerType === 'satellite' ? '#FFFFFF' : '#475569',
                          fontSize: '0.68rem',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        🛰️ Coloured Satellite
                      </button>
                      <button
                        type="button"
                        onClick={() => setMapLayerType('plain')}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          border: 'none',
                          background: mapLayerType === 'plain' ? '#0F172A' : 'transparent',
                          color: mapLayerType === 'plain' ? '#FFFFFF' : '#475569',
                          fontSize: '0.68rem',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        🗺️ Plain Map
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsDrawingCircleMode(!isDrawingCircleMode)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: isDrawingCircleMode ? '2px solid #EF4444' : '1px solid #2563EB',
                        background: isDrawingCircleMode ? '#FEF2F2' : '#EFF6FF',
                        color: isDrawingCircleMode ? '#B91C1C' : '#1D4ED8',
                        fontSize: '0.7rem',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <i className={`fa-solid ${isDrawingCircleMode ? 'fa-xmark' : 'fa-circle-dot'}`}></i>
                      {isDrawingCircleMode ? 'Cancel Drawing' : '✏️ Draw Circle with Mouse'}
                    </button>
                  </div>
                </div>

                {isDrawingCircleMode && (
                  <div style={{
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    color: '#B91C1C',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    marginBottom: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <i className="fa-solid fa-arrow-pointer"></i>
                    <span><strong>Mouse Drawing Active:</strong> Click on the map and drag to round the delivery territory circle! Mandal & PINs will auto-verify.</span>
                  </div>
                )}

                <div
                  ref={miniMapContainerRef}
                  style={{
                    width: '100%',
                    height: '240px',
                    borderRadius: '8px',
                    border: '1.5px solid #CBD5E1',
                    overflow: 'hidden',
                    background: '#0F172A'
                  }}
                />
              </div>

              {/* Radius & Highlight Color */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#1E293B', marginBottom: '4px' }}>
                    Coverage Radius: <span style={{ color: '#2563EB' }}>{zoneFormData.radiusKm} KM</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="0.5"
                    value={zoneFormData.radiusKm}
                    onChange={(e) => setZoneFormData({ ...zoneFormData, radiusKm: parseFloat(e.target.value) })}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#1E293B', marginBottom: '4px' }}>
                    Highlight Color
                  </label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {COLOR_PRESETS.slice(0, 5).map((p) => (
                      <button
                        key={p.hex}
                        type="button"
                        onClick={() => setZoneFormData({ ...zoneFormData, color: p.hex })}
                        title={p.name}
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          background: p.hex,
                          border: zoneFormData.color === p.hex ? '2px solid #0F172A' : '2px solid #FFFFFF',
                          boxShadow: zoneFormData.color === p.hex ? '0 0 0 2px #3B82F6' : '0 1px 3px rgba(0,0,0,0.2)',
                          cursor: 'pointer'
                        }}
                      />
                    ))}
                    <input
                      type="color"
                      value={zoneFormData.color}
                      onChange={(e) => setZoneFormData({ ...zoneFormData, color: e.target.value })}
                      style={{ width: '28px', height: '28px', border: 'none', background: 'none', cursor: 'pointer' }}
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid #E2E8F0' }}>
                <button
                  type="button"
                  onClick={() => setShowZoneModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#475569',
                    fontSize: '0.84rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingZone}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10B981, #059669)',
                    color: '#FFFFFF',
                    fontSize: '0.84rem',
                    fontWeight: '800',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)'
                  }}
                >
                  {savingZone ? 'Saving Map Territory...' : 'Save & Highlight on Map'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LIVE ON-DUTY ROUTE TRACKER ("Where is the Rider Going?") */}
      {showTrackingModal && trackingRider && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            width: '100%',
            maxWidth: '820px',
            maxHeight: '94vh',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Tracker Header */}
            <div style={{
              background: '#0F172A',
              padding: '16px 24px',
              color: '#FFFFFF',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10B981, #059669)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1rem',
                  color: '#FFFFFF'
                }}>
                  <i className="fa-solid fa-location-crosshairs"></i>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: '#FFFFFF' }}>
                      {trackingRider.fullName} &bull; Live On-Duty Route Tracker
                    </h3>
                    <span style={{
                      background: '#065F46',
                      color: '#34D399',
                      fontSize: '0.66rem',
                      fontWeight: '800',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34D399', animation: 'ping 1.5s infinite' }}></span>
                      GPS ACTIVE
                    </span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#94A3B8', marginTop: '2px' }}>
                    Vehicle: <strong>{trackingRider.vehicleNumber}</strong> ({trackingRider.vehicleType}) &bull; Phone: {trackingRider.phone} &bull; Zone: <span style={{ color: '#38BDF8', fontWeight: '700' }}>{trackingRider.assignedZone?.mandal || 'Hub Sector'}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowTrackingModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '1.3rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {/* Destination & Navigation Telemetry HUD */}
            <div style={{
              background: '#F8FAFC',
              borderBottom: '1px solid #E2E8F0',
              padding: '14px 24px',
              display: 'grid',
              gridTemplateColumns: '1.4fr 1fr',
              gap: '16px'
            }}>
              {/* Destination Card */}
              <div style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '12px 14px',
                borderLeft: '4px solid #EF4444'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <i className="fa-solid fa-flag-checkered"></i> Active Customer Destination
                  </span>
                  {trackingRider.activeDelivery?.orderNumber && (
                    <span style={{ background: '#EFF6FF', color: '#2563EB', fontWeight: '800', fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px' }}>
                      Order #{trackingRider.activeDelivery.orderNumber}
                    </span>
                  )}
                </div>

                <div style={{ fontWeight: '800', fontSize: '0.94rem', color: '#0F172A' }}>
                  {trackingRider.activeDelivery?.destination?.recipientName || 'Customer Recipient'}
                </div>

                <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px', lineHeight: '1.4' }}>
                  📍 {trackingRider.activeDelivery?.destination?.street || 'Local Doorstep'}, {trackingRider.activeDelivery?.destination?.city || warehouse?.city}, {trackingRider.activeDelivery?.destination?.postalCode || '522002'}
                </div>

                {trackingRider.activeDelivery?.destination?.phone && (
                  <div style={{ fontSize: '0.74rem', color: '#2563EB', fontWeight: '700', marginTop: '3px' }}>
                    📞 Recipient Phone: {trackingRider.activeDelivery.destination.phone}
                  </div>
                )}
              </div>

              {/* Navigation Telemetry Metric Pills */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>
                      Distance to Doorstep
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0F172A' }}>
                      {trackingRider.activeDelivery?.distanceKm || 2.4} KM
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>
                      Estimated Arrival (ETA)
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#10B981' }}>
                      ~{trackingRider.activeDelivery?.etaMinutes || 7} mins
                    </div>
                  </div>
                </div>

                <div style={{
                  fontSize: '0.74rem',
                  color: '#475569',
                  background: '#F1F5F9',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <i className="fa-solid fa-compass" style={{ color: '#3B82F6' }}></i>
                  <span>Status: <strong>{trackingRider.activeDelivery?.statusText || 'En Route to Doorstep Delivery'}</strong></span>
                </div>
              </div>
            </div>

            {/* Interactive Leaflet Route Map */}
            <div style={{ flex: 1, position: 'relative', minHeight: '340px' }}>
              <div
                ref={trackingMapContainerRef}
                style={{ width: '100%', height: '100%', background: '#E2E8F0' }}
              />

              {/* Floating Map Route Overlay Legend */}
              <div style={{
                position: 'absolute',
                bottom: '16px',
                left: '16px',
                background: 'rgba(15, 23, 42, 0.88)',
                backdropFilter: 'blur(6px)',
                color: '#FFFFFF',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.72rem',
                zIndex: 400,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: trackingRider.assignedZone?.color || '#10B981', display: 'inline-block' }}></span>
                  <span>Rider Live Position: {trackingRider.fullName}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#EF4444', display: 'inline-block' }}></span>
                  <span>Customer Destination: {trackingRider.activeDelivery?.destination?.recipientName || 'Customer'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '16px', height: '0px', borderTop: '2px dashed #2563EB', display: 'inline-block' }}></span>
                  <span>Active Road Polyline Route</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '12px 24px',
              background: '#FFFFFF',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <Link
                to="/fleet-map"
                style={{
                  color: '#2563EB',
                  fontSize: '0.82rem',
                  fontWeight: '700',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <i className="fa-solid fa-expand"></i> Open in Full Screen Fleet Radar Map
              </Link>

              <button
                onClick={() => setShowTrackingModal(false)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  background: '#0F172A',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '0.84rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Close Live Tracker
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ONBOARD NEW RIDER */}
      {showOnboardModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '90vh',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#0F172A',
              padding: '20px 24px',
              color: '#FFFFFF',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-solid fa-user-plus" style={{ color: '#10B981', fontSize: '1.2rem' }}></i>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800' }}>
                    In-Person Rider Fleet Onboarding
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: '#94A3B8' }}>
                    Register courier &bull; Issue initial temporary credentials
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowOnboardModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleOnboardSubmit} style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {errorMsg && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem' }}>
                  {errorMsg}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Rider Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Praveen Kumar"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+91 98481 00000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  Email Address (Login Username) *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. praveen.courier@speedy.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  Initial Temporary Password * (Rider must change upon login)
                </label>
                <input
                  type="text"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.86rem', boxSizing: 'border-box', fontFamily: 'monospace', fontWeight: '700' }}
                />
                <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                  The rider will use this password for their first sign-in and will be prompted to set their private password.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Vehicle Type *
                  </label>
                  <select
                    value={formData.vehicleType}
                    onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                  >
                    <option value="Motorcycle">Motorcycle / Bike</option>
                    <option value="Scooter">Scooter / Moped</option>
                    <option value="Electric Bike">Electric Bike (EV)</option>
                    <option value="Delivery Van">Delivery Van</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Vehicle Registration Plate *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AP 07 BK 9021"
                    value={formData.vehicleNumber}
                    onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.86rem', boxSizing: 'border-box', textTransform: 'uppercase' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  Driving License Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AP07 20210087654"
                  value={formData.drivingLicense}
                  onChange={(e) => setFormData({ ...formData, drivingLicense: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.86rem', boxSizing: 'border-box', textTransform: 'uppercase' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Emergency Contact Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh (Father)"
                    value={formData.emergencyName}
                    onChange={(e) => setFormData({ ...formData, emergencyName: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Emergency Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="+91 98481 11111"
                    value={formData.emergencyPhone}
                    onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '0.76rem',
                color: '#64748B'
              }}>
                <i className="fa-solid fa-lock" style={{ color: '#10B981', marginRight: '6px' }}></i>
                Assigned Warehouse: <strong>{warehouse?.name}</strong> [{warehouse?.code}]. The rider will be granted immediate access to the Delivery Portal upon creation.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowOnboardModal(false)}
                  style={{
                    background: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    color: '#475569',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    background: '#10B981',
                    border: 'none',
                    color: '#FFFFFF',
                    padding: '10px 22px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    cursor: submitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {submitting ? 'Onboarding Rider...' : 'Complete Onboarding & Issue Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ISSUE NEW TEMPORARY PASSWORD */}
      {showResetModal && selectedRider && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            width: '100%',
            maxWidth: '460px',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#0F172A',
              padding: '18px 22px',
              color: '#FFFFFF',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800' }}>
                Issue New Temporary Password
              </h3>
              <button onClick={() => setShowResetModal(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '1.2rem', cursor: 'pointer' }}>
                &times;
              </button>
            </div>

            <form onSubmit={handleResetPassword} style={{ padding: '22px' }}>
              <p style={{ fontSize: '0.84rem', color: '#475569', marginTop: 0 }}>
                Resetting password for: <strong>{selectedRider.fullName}</strong> ({selectedRider.email})
              </p>

              <div style={{
                background: '#FEF3C7',
                border: '1px solid #FDE68A',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '0.78rem',
                color: '#92400E',
                marginBottom: '16px'
              }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px' }}></i>
                You cannot view the rider's current password. Entering a new temporary password will overwrite it and require the rider to change it on their next login.
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  New Temporary Password (min 6 chars)
                </label>
                <input
                  type="text"
                  required
                  value={newTempPassword}
                  onChange={(e) => setNewTempPassword(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.9rem', fontFamily: 'monospace', fontWeight: '700', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#475569', padding: '8px 16px', borderRadius: '6px', fontSize: '0.84rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ background: '#2563EB', border: 'none', color: '#FFFFFF', padding: '8px 18px', borderRadius: '6px', fontSize: '0.84rem', fontWeight: '700', cursor: 'pointer' }}
                >
                  {submitting ? 'Updating...' : 'Issue Temporary Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
