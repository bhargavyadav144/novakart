import React, { useState, useEffect, useRef, useCallback } from 'react';
import warehouseApi, { SOCKET_BASE_URL } from '../services/warehouseApi';
import { useWarehouseAuth } from '../context/WarehouseAuthContext';
import { io } from 'socket.io-client';
import {
  TILE_LAYERS,
  REGIONAL_MANDALS,
  getLocalMandalDetection,
  haversineDistance,
  findMatchingMandal,
  GUNTUR_DISTRICT_OUTER_POLYGON
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

export default function WarehouseFleetMap({ warehouse }) {
  const { managerUser } = useWarehouseAuth();
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const mainTileLayerRef = useRef(null);
  const riderMarkersRef = useRef({});
  const zoneLayersRef = useRef([]);
  const polygonLayersRef = useRef([]);
  const serviceAreaLayerRef = useRef(null);
  const previewCircleRef = useRef(null);
  const previewPenPolyRef = useRef(null);  // live freehand polygon preview
  const destinationMarkerRef = useRef(null);
  const routePolylineRef = useRef(null);
  const isDrawModeRef = useRef(false);
  const isPenDrawModeRef = useRef(false);
  const drawingStateRef = useRef({ isDrawing: false, startLatLng: null });
  const penPointsRef = useRef([]); // collected freehand polygon points

  const [loading, setLoading] = useState(true);
  const [zones, setZones] = useState([]);
  const [riders, setRiders] = useState([]);
  const [whData, setWhData] = useState(warehouse || null);

  // Map Layer: Satellite (Coloured) vs Plain Map
  const [mapLayerType, setMapLayerType] = useState('satellite'); // 'satellite' | 'plain'
  const [isDrawMode, setIsDrawMode] = useState(false);    // circle draw
  const [isPenDrawMode, setIsPenDrawMode] = useState(false); // freehand pen draw
  const [detectingArea, setDetectingArea] = useState(false);
  const [autoVerifiedInfo, setAutoVerifiedInfo] = useState(null);
  const [drawnPolygonCoords, setDrawnPolygonCoords] = useState(null); // custom pen polygon

  // Active Map Mode & Modals
  const [selectedRider, setSelectedRider] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [isEditingZone, setIsEditingZone] = useState(false);
  // Rider-first zone assignment: the rider we are assigning a zone TO
  const [focusedRiderId, setFocusedRiderId] = useState(null);
  const riderZoneHighlightRef = useRef(null);

  // Zone Form State
  const [zoneFormData, setZoneFormData] = useState({
    zoneId: '',
    zoneName: '',
    mandal: 'Prathipadu',
    pincodes: '',
    lat: 16.1800,
    lng: 80.3900,
    radiusKm: 7.0,
    color: '#EF4444',
    assignedAgentIds: []
  });

  const [savingZone, setSavingZone] = useState(false);
  const [zoneMsg, setZoneMsg] = useState({ type: '', text: '' });
  const [liveEventLog, setLiveEventLog] = useState([]);

  // Fetch Zones and Fleet Riders for this Warehouse
  const fetchFleetAndZones = useCallback(async () => {
    try {
      const { data } = await warehouseApi.get('/warehouses/my-warehouse/zones');
      if (data.warehouse) setWhData(data.warehouse);
      setZones(data.zones || []);
      setRiders(data.riders || []);
    } catch (err) {
      console.error('Failed to load fleet and zones:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFleetAndZones();
  }, [fetchFleetAndZones]);


  // Helper to switch map layer between Plain Map and Coloured Satellite
  const updateTileLayer = (map, type) => {
    if (!map || !window.L) return;
    const L = window.L;
    if (mainTileLayerRef.current) {
      map.removeLayer(mainTileLayerRef.current);
    }
    const layerConfig = TILE_LAYERS[type] || TILE_LAYERS.satellite;
    const layer = L.tileLayer(layerConfig.url, {
      maxZoom: layerConfig.maxZoom || 19,
      attribution: layerConfig.attribution
    }).addTo(map);
    mainTileLayerRef.current = layer;
  };

  // Backend Spatial Auto-Verification: Detects Mandal, Pincodes & Boundary from drawn circle
  const detectAreaPincodesAndOpenModal = async (lat, lng, radiusKm) => {
    setDetectingArea(true);
    const safeRadiusKm = Math.min(Math.max(1, radiusKm || 5), 100);
    try {
      const { data } = await warehouseApi.post('/warehouses/my-warehouse/detect-area-pincodes', {
        lat,
        lng,
        radiusKm: safeRadiusKm
      });

      if (data.success) {
        setZoneFormData({
          zoneId: `ZONE-${Date.now().toString().slice(-6)}`,
          zoneName: data.zoneName || `${data.primaryMandal} Mandal Sector`,
          mandal: data.primaryMandal,
          pincodes: (data.autoVerifiedPincodes || []).join(', '),
          lat,
          lng,
          radiusKm: safeRadiusKm,
          color: data.color || '#EF4444',
          assignedAgentIds: []
        });

        setAutoVerifiedInfo({
          mandal: data.primaryMandal,
          telugu: data.primaryMandalTelugu,
          pincodes: data.autoVerifiedPincodes,
          villages: data.enclosedVillages || []
        });

        setIsEditingZone(false);
        setShowZoneModal(true);
      }
    } catch (err) {
      console.error('Failed to auto-verify area via backend:', err);
      const local = getLocalMandalDetection(lat, lng, radiusKm);
      if (local) {
        setZoneFormData({
          zoneId: `ZONE-${Date.now().toString().slice(-6)}`,
          zoneName: local.zoneName,
          mandal: local.mandal,
          pincodes: local.pincodes.join(', '),
          lat,
          lng,
          radiusKm,
          color: local.color,
          assignedAgentIds: []
        });
        setAutoVerifiedInfo({
          mandal: local.mandal,
          telugu: local.mandalTelugu,
          pincodes: local.pincodes,
          villages: (local.villages || []).map((v) => (typeof v === 'string' ? v : v.name))
        });
        setIsEditingZone(false);
        setShowZoneModal(true);
      }
    } finally {
      setDetectingArea(false);
    }
  };

  // Sync ref with circle & pen drawing mode state & ensure map dragging stays enabled when not drawing
  useEffect(() => {
    isDrawModeRef.current = isDrawMode;
    isPenDrawModeRef.current = isPenDrawMode;
    const map = mapInstanceRef.current;
    if (map) {
      if (isDrawMode || isPenDrawMode) {
        map.dragging.disable();
      } else {
        map.dragging.enable();
        if (map.touchZoom) map.touchZoom.enable();
        if (map.doubleClickZoom) map.doubleClickZoom.enable();
        if (map.scrollWheelZoom) map.scrollWheelZoom.enable();
      }
    }
    if (mapContainerRef.current) {
      mapContainerRef.current.style.cursor = isDrawMode ? 'crosshair' : (isPenDrawMode ? 'crosshair' : 'default');
    }
  }, [isDrawMode, isPenDrawMode]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const L = window.L;
    if (!L) return;

    const defaultLat = whData?.location?.lat || 16.3067;
    const defaultLng = whData?.location?.lng || 80.4365;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      tap: true,
      touchZoom: true,
      doubleClickZoom: true,
      scrollWheelZoom: true,
      boxZoom: true
    }).setView([defaultLat, defaultLng], 12);

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Initial tile layer (Coloured Satellite by default for vivid satellite imagery)
    updateTileLayer(map, mapLayerType);

    // Mouse Circle Drawing Listeners
    map.on('mousedown', (e) => {
      if (isPenDrawModeRef.current) {
        // Pen / Freehand polygon mode
        L.DomEvent.stopPropagation(e);
        map.dragging.disable();
        penPointsRef.current = [e.latlng];
        if (previewPenPolyRef.current) { map.removeLayer(previewPenPolyRef.current); previewPenPolyRef.current = null; }
        return;
      }
      if (!isDrawModeRef.current) return;
      // Circle draw mode
      L.DomEvent.stopPropagation(e);
      map.dragging.disable();
      drawingStateRef.current = { isDrawing: true, startLatLng: e.latlng };
    });

    map.on('mousemove', (e) => {
      if (isPenDrawModeRef.current && penPointsRef.current.length > 0) {
        // Add point to pen trail
        penPointsRef.current.push(e.latlng);
        if (previewPenPolyRef.current) map.removeLayer(previewPenPolyRef.current);
        previewPenPolyRef.current = L.polygon(penPointsRef.current, {
          color: '#DC2626', weight: 2.5, dashArray: '5,4', fillColor: '#DC2626', fillOpacity: 0.18
        }).addTo(map);
        return;
      }
      if (!drawingStateRef.current.isDrawing) return;
      const start = drawingStateRef.current.startLatLng;
      if (!start) return;
      const distM = start.distanceTo(e.latlng);
      const radKm = Math.max(0.5, Math.round((distM / 1000) * 10) / 10);
      if (previewCircleRef.current) map.removeLayer(previewCircleRef.current);
      previewCircleRef.current = L.circle(start, {
        radius: radKm * 1000, color: '#EF4444', weight: 3, dashArray: '6, 6', fillColor: '#EF4444', fillOpacity: 0.25
      }).addTo(map);
    });

    map.on('mouseup', (e) => {
      // ─── PEN mode finish ───
      if (isPenDrawModeRef.current && penPointsRef.current.length > 3) {
        map.dragging.enable();
        const pts = penPointsRef.current;
        penPointsRef.current = [];
        setIsPenDrawMode(false);
        isPenDrawModeRef.current = false;

        // Compute centroid
        let sumLat = 0, sumLng = 0;
        pts.forEach(p => { sumLat += p.lat; sumLng += p.lng; });
        const cLat = parseFloat((sumLat / pts.length).toFixed(5));
        const cLng = parseFloat((sumLng / pts.length).toFixed(5));

        // Compute max distance from centroid = bounding radius
        let maxDist = 0;
        pts.forEach(p => {
          const d = Math.sqrt(Math.pow(p.lat - cLat, 2) * 111 * 111 + Math.pow(p.lng - cLng, 2) * 100 * 100);
          if (d > maxDist) maxDist = d;
        });
        const radKm = Math.max(1.0, parseFloat(Math.min(maxDist, 20).toFixed(1)));

        // Store drawn polygon in state
        setDrawnPolygonCoords(pts.map(p => [p.lat, p.lng]));

        detectAreaPincodesAndOpenModal(cLat, cLng, radKm);
        return;
      }

      // ─── CIRCLE mode finish ───
      if (!drawingStateRef.current.isDrawing) return;
      const start = drawingStateRef.current.startLatLng;
      drawingStateRef.current.isDrawing = false;
      map.dragging.enable();
      setIsDrawMode(false);
      isDrawModeRef.current = false;

      if (start) {
        const distM = start.distanceTo(e.latlng);
        const radKm = Math.min(Math.max(1.0, Math.round((distM / 1000) * 10) / 10), 100);
        const fLat = parseFloat(start.lat.toFixed(5));
        const fLng = parseFloat(start.lng.toFixed(5));
        detectAreaPincodesAndOpenModal(fLat, fLng, radKm);
      }
    });

    // Regular Map Click for zone coordinate placement
    map.on('click', (e) => {
      if (isDrawModeRef.current) return;
      const { lat, lng } = e.latlng;
      setZoneFormData((prev) => ({
        ...prev,
        lat: parseFloat(lat.toFixed(5)),
        lng: parseFloat(lng.toFixed(5))
      }));
    });

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Main Map Tile Layer on Switch
  useEffect(() => {
    if (mapInstanceRef.current) {
      updateTileLayer(mapInstanceRef.current, mapLayerType);
    }
  }, [mapLayerType]);

  // Update Warehouse Hub Pin
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = window.L;
    if (!map || !L || !whData) return;

    const lat = whData.location?.lat || 16.3067;
    const lng = whData.location?.lng || 80.4365;

    // Warehouse Hub Custom Icon
    const hubIcon = L.divIcon({
      className: 'wh-hub-pin-icon',
      html: `
        <div style="
          width: 44px;
          height: 44px;
          background: #0F172A;
          border: 3px solid #38BDF8;
          border-radius: 12px;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #38BDF8;
          font-size: 1.25rem;
          transform: translate(-50%, -50%);
        ">
          <i class="fa-solid fa-warehouse"></i>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });

    L.marker([lat, lng], { icon: hubIcon })
      .bindPopup(`
        <div style="font-family: inherit; padding: 4px;">
          <strong style="color: #0F172A; font-size: 1rem;">🏢 ${whData.name || 'Warehouse Hub'}</strong><br/>
          <span style="color: #2563EB; font-weight: 700; font-family: monospace;">[${whData.code || 'HUB'}]</span><br/>
          <div style="font-size: 0.8rem; color: #475569; margin-top: 4px;">
            ${whData.city || ''}, ${whData.state || ''}
          </div>
        </div>
      `)
      .addTo(map);

  }, [whData]);

  // Render Territory Delivery Zones with Authentic Boundary Polygons (Image 2 style)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = window.L;
    if (!map || !L) return;

    // Clear old zone layers
    zoneLayersRef.current.forEach((layer) => map.removeLayer(layer));
    zoneLayersRef.current = [];
    if (polygonLayersRef.current) {
      polygonLayersRef.current.forEach((layer) => map.removeLayer(layer));
      polygonLayersRef.current = [];
    }

    zones.forEach((zone) => {
      const zLat = zone.center?.lat || whData?.location?.lat || 16.3067;
      const zLng = zone.center?.lng || whData?.location?.lng || 80.4365;
      const zColor = zone.color || '#EF4444';

      // 1. Match Mandal using Robust Lookup (e.g., medikondoru -> Medikonduru)
      const matchedMandal = findMatchingMandal(zone.mandal);

      let poly = null;
      if (matchedMandal && matchedMandal.polygon && matchedMandal.polygon.length > 0) {
        // Authentic Boundary Polygon with Crisp Dashed Perimeter Line ONLY
        poly = L.polygon(matchedMandal.polygon, {
          color: zColor,
          weight: 3.5,
          dashArray: '6, 6',
          fillColor: zColor,
          fillOpacity: 0.16
        }).addTo(map);

        poly.bindTooltip(`📍 ${zone.zoneName} (${matchedMandal.mandalTelugu || ''})`, { permanent: false });
        polygonLayersRef.current.push(poly);

        // Render Village label pins inside this territory boundary
        if (matchedMandal.villages && matchedMandal.villages.length > 0) {
          matchedMandal.villages.forEach((v) => {
            if (v.lat && v.lng && !v.isCenter) {
              const vIcon = L.divIcon({
                className: 'village-map-pin',
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
                    <div>${v.name}</div>
                    <div style="font-size: 0.62rem; color: #CBD5E1;">${v.telugu || ''}</div>
                  </div>
                `,
                iconSize: [80, 22],
                iconAnchor: [40, 11]
              });
              const vMarker = L.marker([v.lat, v.lng], { icon: vIcon }).addTo(map);
              polygonLayersRef.current.push(vMarker);
            }
          });
        }
      }

      // Find fleet riders assigned to this zone
      const assignedRiders = riders.filter(r => {
        if (!r.assignedZone) return false;
        return r.assignedZone._id === zone._id || r.assignedZone.zoneId === zone.zoneId;
      });

      // 3. Zone Center Marker Badge (Crisp & Uncluttered)
      const zoneCenterIcon = L.divIcon({
        className: 'zone-center-badge',
        html: `
          <div style="
            background: rgba(15, 23, 42, 0.92);
            border: 2px solid ${zColor};
            color: #FFFFFF;
            font-size: 0.76rem;
            font-weight: 800;
            padding: 4px 10px;
            border-radius: 20px;
            white-space: nowrap;
            box-shadow: 0 4px 12px rgba(0,0,0,0.35);
            transform: translate(-50%, -50%);
            display: inline-flex;
            align-items: center;
            gap: 6px;
          ">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${zColor};"></span>
            <span>${zone.zoneName}</span>
            ${matchedMandal?.mandalTelugu ? `<span style="font-size: 0.68rem; color: #FCA5A5;">(${matchedMandal.mandalTelugu})</span>` : ''}
            ${assignedRiders.length > 0 ? `<span style="color: #6EE7B7; font-size: 0.72rem; font-weight: 700;">• 👤 ${assignedRiders[0].fullName?.split(' ')[0]}</span>` : ''}
          </div>
        `,
        iconSize: [180, 26],
        iconAnchor: [90, 13]
      });

      const centerMarker = L.marker([zLat, zLng], { icon: zoneCenterIcon });

      const assignedCount = assignedRiders.length;
      const pincodeText = zone.pincodes?.length > 0 ? zone.pincodes.join(', ') : 'All Hub Pincodes';
      const mandalLabel = zone.mandal ? `<div style="font-size: 0.78rem; color: #475569; margin-bottom: 4px;"><strong>Mandal:</strong> <span style="font-weight: 800; color: #0284C7;">${zone.mandal} ${matchedMandal?.mandalTelugu ? `(${matchedMandal.mandalTelugu})` : ''}</span></div>` : '';

      const popupHtml = `
        <div style="font-family: inherit; min-width: 240px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
            <span style="width: 12px; height: 12px; border-radius: 50%; background: ${zColor};"></span>
            <strong style="color: #0F172A; font-size: 0.95rem;">${zone.zoneName}</strong>
          </div>
          ${mandalLabel}
          <div style="font-size: 0.78rem; color: #475569; margin-bottom: 4px;">
            <strong>District / State:</strong> ${matchedMandal?.district || 'Guntur'}, ${matchedMandal?.state || 'Andhra Pradesh'}
          </div>
          <div style="font-size: 0.78rem; color: #475569; margin-bottom: 4px;">
            <strong>Radius:</strong> ${zone.radiusKm || 5} KM
          </div>
          <div style="font-size: 0.78rem; color: #475569; margin-bottom: 4px;">
            <strong>Pincodes (${zone.pincodes?.length || 0}):</strong> <span style="font-family: monospace; color: #2563EB;">${pincodeText}</span>
          </div>
          <div style="font-size: 0.78rem; color: #475569; margin-bottom: 8px;">
            <strong>Assigned Rider(s):</strong> <span style="font-weight: 700; color: #059669;">${assignedCount > 0 ? assignedRiders.map(r => r.fullName).join(', ') : 'No Rider Assigned'}</span>
          </div>
        </div>
      `;

      if (poly) {
        poly.bindPopup(popupHtml);
        poly.on('click', () => {
          setSelectedZone(zone);
        });
      }

      centerMarker.bindPopup(popupHtml);
      centerMarker.on('click', () => {
        setSelectedZone(zone);
      });
      centerMarker.addTo(map);
      zoneLayersRef.current.push(centerMarker);
    });

  }, [zones, whData]);

  // Dynamic Preview Circle when creating/editing Zone
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = window.L;
    if (!map || !L) return;

    if (showZoneModal) {
      if (previewCircleRef.current) {
        map.removeLayer(previewCircleRef.current);
      }

      previewCircleRef.current = L.circle([zoneFormData.lat, zoneFormData.lng], {
        radius: (zoneFormData.radiusKm || 5) * 1000,
        color: zoneFormData.color,
        dashArray: '4, 4',
        weight: 3,
        fillColor: zoneFormData.color,
        fillOpacity: 0.28
      }).addTo(map);

      map.panTo([zoneFormData.lat, zoneFormData.lng], { animate: true });
    } else {
      if (previewCircleRef.current) {
        map.removeLayer(previewCircleRef.current);
        previewCircleRef.current = null;
      }
    }
  }, [showZoneModal, zoneFormData.lat, zoneFormData.lng, zoneFormData.radiusKm, zoneFormData.color]);

  // Render and Update Live Rider Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = window.L;
    if (!map || !L) return;

    riders.forEach((rider) => {
      const rId = rider._id;
      const lat = rider.currentLocation?.lat || whData?.location?.lat || 16.3067;
      const lng = rider.currentLocation?.lng || whData?.location?.lng || 80.4365;
      const isOnline = rider.isOnline;
      const zoneColor = rider.assignedZone?.color || '#3B82F6';
      const zoneName = rider.assignedZone?.zoneName || 'General Hub';

      const riderPhotoUrl = rider.userId?.avatar || rider.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(rider.fullName)}&background=0F172A&color=FFFFFF&bold=true`;

      // Rider Photo Avatar Icon with Zone Color Accent Ring and Radar Pulse
      const riderHtml = `
        <div style="position: relative; transform: translate(-50%, -50%); cursor: pointer;">
          ${isOnline ? `
            <span style="
              position: absolute;
              top: -4px;
              left: -4px;
              right: -4px;
              bottom: -4px;
              border-radius: 50%;
              background: ${zoneColor};
              opacity: 0.4;
              animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
            "></span>
          ` : ''}
          <div style="
            width: 42px;
            height: 42px;
            background: #FFFFFF;
            border: 3px solid ${zoneColor};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.35);
            position: relative;
            z-index: 2;
            overflow: hidden;
          ">
            <img src="${riderPhotoUrl}" alt="${rider.fullName}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(rider.fullName)}&background=0F172A&color=FFFFFF&bold=true'" />
          </div>
          <span style="
            position: absolute;
            top: 0;
            right: 0;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: ${isOnline ? '#10B981' : '#94A3B8'};
            border: 2px solid #FFFFFF;
            z-index: 4;
          "></span>
          <div style="
            position: absolute;
            top: 44px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(15, 23, 42, 0.92);
            color: #FFFFFF;
            padding: 2px 7px;
            border-radius: 12px;
            font-size: 0.68rem;
            font-weight: 800;
            white-space: nowrap;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            border: 1px solid ${zoneColor};
            z-index: 3;
            display: flex;
            align-items: center;
            gap: 4px;
          ">
            <i class="fa-solid fa-motorcycle" style="color: ${zoneColor}; font-size: 0.62rem;"></i>
            <span>${rider.fullName?.split(' ')[0] || 'Rider'}</span>
          </div>
        </div>
      `;

      const riderIcon = L.divIcon({
        className: `rider-marker-${rId}`,
        html: riderHtml,
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      });

      if (riderMarkersRef.current[rId]) {
        // Move existing marker smoothly
        riderMarkersRef.current[rId].setLatLng([lat, lng]);
        riderMarkersRef.current[rId].setIcon(riderIcon);
      } else {
        // Create new marker
        const marker = L.marker([lat, lng], { icon: riderIcon });
        marker.bindPopup(`
          <div style="font-family: inherit; min-width: 190px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <strong style="font-size: 0.95rem; color: #0F172A;">🏍️ ${rider.fullName}</strong>
              <span style="
                background: ${isOnline ? '#DCFCE7' : '#F1F5F9'};
                color: ${isOnline ? '#15803D' : '#64748B'};
                font-size: 0.65rem;
                padding: 1px 6px;
                border-radius: 10px;
                font-weight: 800;
              ">
                ${isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
            <div style="font-size: 0.78rem; color: #475569; margin-bottom: 4px;">
              <strong>Territory Zone:</strong> <span style="color: ${zoneColor}; font-weight: 700;">${zoneName}</span>
            </div>
            <div style="font-size: 0.78rem; color: #475569; margin-bottom: 4px;">
              <strong>Vehicle:</strong> ${rider.vehicleType || 'Motorcycle'} (${rider.vehicleNumber || 'N/A'})
            </div>
            <div style="font-size: 0.78rem; color: #475569; margin-bottom: 4px;">
              <strong>Active Orders:</strong> <span style="font-weight: 700; color: #2563EB;">${rider.activeOrdersCount || 0}</span>
            </div>
            <div style="font-size: 0.78rem; color: #475569;">
              <strong>Phone:</strong> ${rider.phone || 'N/A'}
            </div>
          </div>
        `);

        marker.on('click', () => {
          setSelectedRider(rider);
        });

        marker.addTo(map);
        riderMarkersRef.current[rId] = marker;
      }
    });

    // Cleanup markers of removed riders
    Object.keys(riderMarkersRef.current).forEach((existingId) => {
      if (!riders.some((r) => r._id === existingId)) {
        map.removeLayer(riderMarkersRef.current[existingId]);
        delete riderMarkersRef.current[existingId];
      }
    });

  }, [riders, whData]);

  // Connect to Socket.io for Real-Time Live Fleet GPS Tracking
  useEffect(() => {
    if (!whData?._id) return;

    const socket = io(SOCKET_BASE_URL);

    socket.emit('join_warehouse_fleet', whData._id);
    socket.emit('join_warehouse_room', whData._id);

    // Live coordinate broadcast from riders
    socket.on('agent_location_update', (data) => {
      const { agentId, location, heading, speed, agentName } = data;
      if (!agentId || !location) return;

      const newLat = location.lat;
      const newLng = location.lng;

      // Update state
      setRiders((prev) =>
        prev.map((r) => {
          if (r._id === agentId) {
            return {
              ...r,
              isOnline: true,
              currentLocation: { lat: newLat, lng: newLng }
            };
          }
          return r;
        })
      );

      // Move marker on map immediately
      if (riderMarkersRef.current[agentId]) {
        riderMarkersRef.current[agentId].setLatLng([newLat, newLng]);
      }

      // Add to event ticker
      setLiveEventLog((prev) => [
        {
          id: Date.now(),
          text: `📍 ${agentName || 'Rider'} moved to [${newLat.toFixed(4)}, ${newLng.toFixed(4)}] • ${speed ? Math.round(speed) : 28} km/h`,
          time: new Date().toLocaleTimeString()
        },
        ...prev.slice(0, 9)
      ]);
    });

    // Also listen to agent_live_location emitted by delivery controller
    socket.on('agent_live_location', (data) => {
      const { agentId, lat, lng, address, agentName } = data;
      if (!agentId || !lat || !lng) return;

      setRiders((prev) =>
        prev.map((r) => {
          if (r._id === agentId) {
            return {
              ...r,
              isOnline: true,
              currentLocation: { lat, lng, address: address || r.currentLocation?.address }
            };
          }
          return r;
        })
      );

      if (riderMarkersRef.current[agentId]) {
        riderMarkersRef.current[agentId].setLatLng([lat, lng]);
      }

      setLiveEventLog((prev) => [
        {
          id: Date.now(),
          text: `📍 ${agentName || 'Rider'} moving at [${lat.toFixed(4)}, ${lng.toFixed(4)}] • Live On-Duty Radar`,
          time: new Date().toLocaleTimeString()
        },
        ...prev.slice(0, 9)
      ]);
    });

    // Agent status change (Online / Offline / Shift started)
    socket.on('agent_status_change', (data) => {
      const { agentId, isOnline, status } = data;
      setRiders((prev) =>
        prev.map((r) => (r._id === agentId ? { ...r, isOnline, status: status || r.status } : r))
      );
    });

    // Territory reassignments
    socket.on('warehouse_zone_updated', () => {
      fetchFleetAndZones();
    });

    return () => {
      socket.disconnect();
    };
  }, [whData?._id, fetchFleetAndZones]);

  // Render on-duty destination marker and road polyline route when rider is selected
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = window.L;
    if (!map || !L) return;

    // Clear previous destination & route layers
    if (destinationMarkerRef.current) {
      map.removeLayer(destinationMarkerRef.current);
      destinationMarkerRef.current = null;
    }
    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }

    if (!selectedRider) return;

    const dest = selectedRider.activeDelivery?.destination;
    const riderLat = selectedRider.currentLocation?.lat || whData?.location?.lat || 16.3067;
    const riderLng = selectedRider.currentLocation?.lng || whData?.location?.lng || 80.4365;

    if (dest?.lat && dest?.lng) {
      const destIcon = L.divIcon({
        className: 'fleet-map-dest-pin',
        html: `
          <div style="position: relative; transform: translate(-50%, -50%);">
            <span style="position: absolute; top: -6px; left: -6px; right: -6px; bottom: -6px; border-radius: 50%; background: #EF4444; opacity: 0.4; animation: ping 1.5s infinite;"></span>
            <div style="width: 38px; height: 38px; background: #EF4444; border: 3px solid #FFF; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #FFF; font-size: 1.1rem; box-shadow: 0 4px 12px rgba(239,68,68,0.5);">
              <i class="fa-solid fa-house-chimney-user"></i>
            </div>
            <div style="position: absolute; top: 40px; left: 50%; transform: translateX(-50%); background: #0F172A; color: #FFF; padding: 2px 8px; border-radius: 4px; font-size: 0.68rem; font-weight: 800; white-space: nowrap; border-left: 3px solid #EF4444; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
              DESTINATION: ${dest.recipientName || 'Customer'}
            </div>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      });

      const destMarker = L.marker([dest.lat, dest.lng], { icon: destIcon }).addTo(map);
      destMarker.bindPopup(`
        <div style="font-family: inherit; min-width: 200px;">
          <div style="font-weight: 800; color: #DC2626; font-size: 0.9rem;">🏁 Active Customer Destination</div>
          <div style="font-weight: 700; color: #0F172A; margin: 3px 0;">${dest.recipientName}</div>
          <div style="font-size: 0.76rem; color: #475569;">${dest.street}, ${dest.city} - ${dest.postalCode}</div>
          ${dest.phone ? `<div style="font-size: 0.74rem; color: #2563EB; margin-top: 2px;">📞 ${dest.phone}</div>` : ''}
        </div>
      `);
      destinationMarkerRef.current = destMarker;

      const polyline = L.polyline([
        [riderLat, riderLng],
        [(riderLat + dest.lat) / 2 + 0.002, (riderLng + dest.lng) / 2 - 0.001],
        [dest.lat, dest.lng]
      ], {
        color: '#2563EB',
        weight: 4,
        dashArray: '8, 8',
        opacity: 0.85
      }).addTo(map);

      routePolylineRef.current = polyline;

      // Fit map bounds to show both rider and customer destination
      const bounds = L.latLngBounds([[riderLat, riderLng], [dest.lat, dest.lng]]);
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 15 });
    }
  }, [selectedRider]);

  // Handle Open Create Zone Modal (optionally pre-assign a specific rider)
  const openCreateZoneModal = (preAssignRiderId = null) => {
    const defaultCenterLat = whData?.location?.lat || 16.3067;
    const defaultCenterLng = whData?.location?.lng || 80.4365;

    setIsEditingZone(false);
    setFocusedRiderId(preAssignRiderId);
    setZoneFormData({
      zoneId: `ZONE-${Date.now().toString().slice(-6)}`,
      zoneName: `Mandal Zone ${zones.length + 1}`,
      mandal: '',
      pincodes: '',
      lat: defaultCenterLat,
      lng: defaultCenterLng,
      radiusKm: 5.5,
      color: COLOR_PRESETS[zones.length % COLOR_PRESETS.length].hex,
      assignedAgentIds: preAssignRiderId ? [preAssignRiderId] : []
    });
    setZoneMsg({ type: '', text: '' });
    setAutoVerifiedInfo(null);
    setShowZoneModal(true);
  };

  // Quick assign zone directly from rider card
  const openAssignZoneForRider = (rider) => {
    setSelectedRider(rider);
    // If rider already has a zone, open edit for that zone
    const existingZone = zones.find(
      z => z.assignedAgentIds?.includes(rider._id) || rider.assignedZone?.zoneId === z.zoneId
    );
    if (existingZone) {
      setFocusedRiderId(rider._id);
      setIsEditingZone(true);
      setZoneFormData({
        zoneId: existingZone.zoneId,
        zoneName: existingZone.zoneName,
        mandal: existingZone.mandal || '',
        pincodes: existingZone.pincodes?.join(', ') || '',
        lat: existingZone.center?.lat || whData?.location?.lat || 16.3067,
        lng: existingZone.center?.lng || whData?.location?.lng || 80.4365,
        radiusKm: existingZone.radiusKm || 5,
        color: existingZone.color || '#10B981',
        assignedAgentIds: existingZone.assignedAgentIds || [rider._id]
      });
      setZoneMsg({ type: '', text: '' });
      setAutoVerifiedInfo(null);
      setShowZoneModal(true);
    } else {
      openCreateZoneModal(rider._id);
    }
    // Fly to rider location
    if (rider.currentLocation?.lat && rider.currentLocation?.lng) {
      flyToCoords(rider.currentLocation.lat, rider.currentLocation.lng, 14);
    }
  };

  // Handle Edit Existing Zone
  const openEditZoneModal = (zone) => {
    setIsEditingZone(true);
    setZoneFormData({
      zoneId: zone.zoneId,
      zoneName: zone.zoneName,
      mandal: zone.mandal || '',
      pincodes: zone.pincodes?.join(', ') || '',
      lat: zone.center?.lat || whData?.location?.lat || 16.3067,
      lng: zone.center?.lng || whData?.location?.lng || 80.4365,
      radiusKm: zone.radiusKm || 5,
      color: zone.color || '#10B981',
      assignedAgentIds: zone.assignedAgentIds || []
    });
    setZoneMsg({ type: '', text: '' });
    setShowZoneModal(true);
  };

  // Handle Save Zone Form
  const handleSaveZone = async (e) => {
    e.preventDefault();
    if (!zoneFormData.zoneName.trim()) {
      setZoneMsg({ type: 'error', text: 'Zone Name is required.' });
      return;
    }

    setSavingZone(true);
    setZoneMsg({ type: '', text: '' });

    try {
      const payload = {
        zoneId: zoneFormData.zoneId,
        zoneName: zoneFormData.zoneName.trim(),
        mandal: zoneFormData.mandal?.trim() || '',
        pincodes: zoneFormData.pincodes
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean),
        center: {
          lat: parseFloat(zoneFormData.lat),
          lng: parseFloat(zoneFormData.lng)
        },
        radiusKm: parseFloat(zoneFormData.radiusKm),
        color: zoneFormData.color,
        assignedAgentIds: zoneFormData.assignedAgentIds
      };

      const { data } = await warehouseApi.post('/warehouses/my-warehouse/zones', payload);

      setZoneMsg({
        type: 'success',
        text: data.message || 'Territory Zone successfully configured and saved!'
      });

      await fetchFleetAndZones();
      setTimeout(() => {
        setShowZoneModal(false);
      }, 1200);
    } catch (err) {
      setZoneMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to save territory zone.'
      });
    } finally {
      setSavingZone(false);
    }
  };

  const handleDeleteZone = async (zone, e) => {
    if (e) e.stopPropagation();
    const targetId = zone.zoneId || zone._id;
    if (!targetId) return;
    if (!window.confirm(`Are you sure you want to delete Territory Zone "${zone.zoneName}"?`)) return;
    try {
      await warehouseApi.delete(`/warehouses/my-warehouse/zones/${targetId}`);
      if (selectedZone?.zoneId === targetId || selectedZone?._id === targetId) setSelectedZone(null);
      await fetchFleetAndZones();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete zone');
    }
  };


  // Fly to Location on Map
  const flyToCoords = (lat, lng, zoom = 14) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], zoom, { duration: 1.2 });
    }
  };


  const onlineRidersCount = riders.filter((r) => r.isOnline).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#F8FAFC', overflow: 'hidden' }}>
      {/* Top Facility Live Fleet HUD Header */}
      <header style={{
        background: '#0F172A',
        color: '#FFFFFF',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        zIndex: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #10B981, #059669)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem',
            color: '#FFFFFF',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
          }}>
            <i className="fa-solid fa-map-location-dot"></i>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, color: '#FFFFFF' }}>
                Live Fleet Tracking &amp; Territory Dispatch Map
              </h1>
              <span style={{
                background: '#065F46',
                color: '#34D399',
                fontSize: '0.68rem',
                fontWeight: '800',
                padding: '2px 8px',
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34D399', animation: 'ping 1.5s infinite' }}></span>
                REAL GPS ACTIVE
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: '2px' }}>
              Hub: <strong style={{ color: '#F1F5F9' }}>{whData?.name || 'Regional Logistics Facility'}</strong> ({whData?.code}) •
              Admin Coverage: <span style={{ color: '#38BDF8', fontWeight: '700' }}>{whData?.serviceArea?.radiusKm || 15} KM</span>
            </div>
          </div>
        </div>

        {/* Live Metrics & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '6px 14px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: '700' }}>Online Riders</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#10B981' }}>
                {onlineRidersCount} / {riders.length}
              </div>
            </div>
            <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }}></div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: '700' }}>Defined Zones</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#38BDF8' }}>
                {zones.length}
              </div>
            </div>
          </div>

          {/* Map Layer Switcher: Coloured Satellite vs Plain Map */}
          <div style={{
            display: 'inline-flex',
            background: 'rgba(255, 255, 255, 0.08)',
            padding: '3px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.15)'
          }}>
            <button
              type="button"
              onClick={() => setMapLayerType('satellite')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: mapLayerType === 'satellite' ? '#2563EB' : 'transparent',
                color: '#FFFFFF',
                fontSize: '0.78rem',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              🛰️ Coloured Satellite
            </button>
            <button
              type="button"
              onClick={() => setMapLayerType('plain')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: mapLayerType === 'plain' ? '#2563EB' : 'transparent',
                color: '#FFFFFF',
                fontSize: '0.78rem',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              🗺️ Plain Map
            </button>
          </div>

          <button
            onClick={() => flyToCoords(whData?.location?.lat || 16.3067, whData?.location?.lng || 80.4365, 12)}
            title="Recenter on Warehouse Hub"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#FFFFFF',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className="fa-solid fa-crosshairs"></i> Recenter Hub
          </button>

          {/* Circle Drawing Mode Toggle */}
          <button
            onClick={() => { setIsDrawMode(!isDrawMode); if (isPenDrawMode) setIsPenDrawMode(false); }}
            style={{
              background: isDrawMode ? 'linear-gradient(135deg, #DC2626, #B91C1C)' : 'rgba(255, 255, 255, 0.08)',
              border: isDrawMode ? '2px solid #FCA5A5' : '1px solid rgba(255, 255, 255, 0.15)',
              color: '#FFFFFF',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: isDrawMode ? '0 0 14px rgba(239, 68, 68, 0.6)' : 'none'
            }}
          >
            <i className={`fa-solid ${isDrawMode ? 'fa-xmark' : 'fa-circle-dot'}`}></i>
            {isDrawMode ? 'Cancel Circle' : '⭕ Draw Circle'}
          </button>

          {/* Freehand Pen Drawing Mode Toggle */}
          <button
            onClick={() => { setIsPenDrawMode(!isPenDrawMode); if (isDrawMode) setIsDrawMode(false); }}
            style={{
              background: isPenDrawMode ? 'linear-gradient(135deg, #7C3AED, #5B21B6)' : 'rgba(255, 255, 255, 0.08)',
              border: isPenDrawMode ? '2px solid #C4B5FD' : '1px solid rgba(255, 255, 255, 0.15)',
              color: '#FFFFFF',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: isPenDrawMode ? '0 0 14px rgba(124, 58, 237, 0.6)' : 'none'
            }}
          >
            <i className={`fa-solid ${isPenDrawMode ? 'fa-xmark' : 'fa-pen-nib'}`}></i>
            {isPenDrawMode ? 'Cancel Pen' : '✏️ Draw with Pen'}
          </button>

          <button
            onClick={openCreateZoneModal}
            style={{
              background: 'linear-gradient(135deg, #10B981, #059669)',
              border: 'none',
              color: '#FFFFFF',
              padding: '9px 18px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)'
            }}
          >
            <i className="fa-solid fa-circle-plus"></i> Define Territory Zone
          </button>
        </div>
      </header>

      {/* Main Container: Map + Territory Zones Sidebar */}
      <div style={{ display: 'flex', flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Leaflet Map Stage */}
        <div style={{ flex: 1, position: 'relative', height: '100%' }}>
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%', background: '#0F172A' }} />

          {/* Floating HUD: Mouse Circle Drawing Mode Active */}
          {isDrawMode && (
            <div style={{
              position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(254, 242, 242, 0.96)', border: '2px solid #EF4444', color: '#991B1B',
              padding: '10px 22px', borderRadius: '12px', boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
              zIndex: 1000, fontSize: '0.86rem', fontWeight: '800',
              display: 'flex', alignItems: 'center', gap: '12px', backdropFilter: 'blur(6px)'
            }}>
              <i className="fa-solid fa-circle-dot fa-bounce" style={{ color: '#DC2626', fontSize: '1.1rem' }}></i>
              <span>
                <strong>⭕ Circle Mode:</strong> Click &amp; drag mouse to draw a circle. Release to auto-verify pincodes!
              </span>
              <button type="button" onClick={() => setIsDrawMode(false)}
                style={{ background: '#B91C1C', color: '#FFFFFF', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '0.78rem', fontWeight: '800', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          )}

          {/* Floating HUD: Freehand Pen Drawing Mode Active */}
          {isPenDrawMode && (
            <div style={{
              position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(245, 243, 255, 0.97)', border: '2px solid #7C3AED', color: '#4C1D95',
              padding: '10px 22px', borderRadius: '12px', boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
              zIndex: 1000, fontSize: '0.86rem', fontWeight: '800',
              display: 'flex', alignItems: 'center', gap: '12px', backdropFilter: 'blur(6px)'
            }}>
              <i className="fa-solid fa-pen-nib fa-bounce" style={{ color: '#7C3AED', fontSize: '1.1rem' }}></i>
              <span>
                <strong>✏️ Pen Mode:</strong> Hold &amp; drag to draw any shape freely. Release to auto-verify pincodes!
              </span>
              <button type="button" onClick={() => { setIsPenDrawMode(false); if (previewPenPolyRef.current && mapInstanceRef.current) { mapInstanceRef.current.removeLayer(previewPenPolyRef.current); previewPenPolyRef.current = null; } penPointsRef.current = []; }}
                style={{ background: '#5B21B6', color: '#FFFFFF', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '0.78rem', fontWeight: '800', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          )}

          {isDrawMode && (
            <div style={{
              position: 'absolute',
              top: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(254, 242, 242, 0.96)',
              border: '2px solid #EF4444',
              color: '#991B1B',
              padding: '10px 22px',
              borderRadius: '12px',
              boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
              zIndex: 1000,
              fontSize: '0.86rem',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backdropFilter: 'blur(6px)'
            }}>
              <i className="fa-solid fa-arrow-pointer fa-bounce" style={{ color: '#DC2626', fontSize: '1.1rem' }}></i>
              <span>
                <strong>Mouse Circle Drawing Active:</strong> Click &amp; drag mouse across map to round an area. Pincodes &amp; Mandal will auto-verify by backend!
              </span>
              <button
                type="button"
                onClick={() => setIsDrawMode(false)}
                style={{
                  background: '#B91C1C',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                  fontWeight: '700'
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Floating HUD: Spatial Auto-Verification In Progress */}
          {detectingArea && (
            <div style={{
              position: 'absolute',
              top: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(254, 243, 199, 0.96)',
              border: '2px solid #F59E0B',
              color: '#92400E',
              padding: '10px 22px',
              borderRadius: '12px',
              boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
              zIndex: 1000,
              fontSize: '0.86rem',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backdropFilter: 'blur(6px)'
            }}>
              <i className="fa-solid fa-satellite fa-spin" style={{ color: '#D97706', fontSize: '1.1rem' }}></i>
              <span>Spatial Engine: Detecting Mandal boundaries &amp; auto-verifying pincodes cluster...</span>
            </div>
          )}

          {/* Map Legend Overlay */}
          <div style={{
            position: 'absolute',
            bottom: '24px',
            left: '24px',
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(8px)',
            color: '#FFFFFF',
            padding: '14px 18px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
            zIndex: 10,
            maxWidth: '320px',
            fontSize: '0.78rem'
          }}>
            <div style={{ fontWeight: '800', fontSize: '0.82rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa-solid fa-layer-group" style={{ color: '#38BDF8' }}></i> Map Territory Legend
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '14px', height: '14px', borderRadius: '4px', background: '#0F172A', border: '2px solid #38BDF8', display: 'inline-block' }}></span>
                <span>Facility Hub Pin</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '16px', height: '0px', borderTop: '2px dashed #2563EB', display: 'inline-block' }}></span>
                <span>Admin Warehouse Perimeter ({whData?.serviceArea?.radiusKm || 15}km)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#10B981', opacity: 0.7, display: 'inline-block' }}></span>
                <span>Manager-Assigned Delivery Zone</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid #10B981', background: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem', color: '#10B981' }}>
                  <i className="fa-solid fa-motorcycle"></i>
                </span>
                <span>Live Rider GPS Marker</span>
              </div>
            </div>
          </div>

          {/* Real-Time GPS Activity Ticker */}
          {liveEventLog.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '20px',
              left: '20px',
              background: 'rgba(15, 23, 42, 0.9)',
              backdropFilter: 'blur(6px)',
              color: '#FFFFFF',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              zIndex: 10,
              maxWidth: '340px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
              fontSize: '0.74rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38BDF8', fontWeight: '800', marginBottom: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }}></span>
                Real-Time Location Stream
              </div>
              <div style={{ color: '#E2E8F0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {liveEventLog[0].text}
              </div>
            </div>
          )}

          {/* On-Duty Live Route & Destination Floating HUD */}
          {selectedRider?.activeDelivery?.destination && (
            <div style={{
              position: 'absolute',
              bottom: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(15, 23, 42, 0.94)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '14px',
              padding: '12px 20px',
              color: '#FFFFFF',
              zIndex: 25,
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: '18px',
              maxWidth: '750px',
              width: '88%'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#10B981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontSize: '1rem',
                  flexShrink: 0
                }}>
                  <i className="fa-solid fa-motorcycle"></i>
                </div>
                <div>
                  <div style={{ fontWeight: '800', fontSize: '0.88rem', color: '#FFFFFF' }}>
                    {selectedRider.fullName} &bull; <span style={{ color: '#34D399' }}>On Active Route</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '1px' }}>
                    Heading to: <strong style={{ color: '#F8FAFC' }}>{selectedRider.activeDelivery.destination.recipientName}</strong> &bull; {selectedRider.activeDelivery.destination.street}, {selectedRider.activeDelivery.destination.city}
                  </div>
                </div>
              </div>

              <div style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.15)' }}></div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div>
                  <div style={{ fontSize: '0.66rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: '700' }}>Distance</div>
                  <div style={{ fontSize: '1rem', fontWeight: '800', color: '#38BDF8' }}>
                    {selectedRider.activeDelivery.distanceKm || 2.4} KM
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.66rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: '700' }}>ETA</div>
                  <div style={{ fontSize: '1rem', fontWeight: '800', color: '#10B981' }}>
                    ~{selectedRider.activeDelivery.etaMinutes || 7} mins
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedRider(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  color: '#FFFFFF',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Close Route HUD"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          )}
        </div>

        {/* Right Drawer: Territory Zones & Rider Dispatch Directory */}
        <aside style={{
          width: '380px',
          background: '#FFFFFF',
          borderLeft: '1px solid #E2E8F0',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          zIndex: 15
        }}>
          {/* Tabs: Zones vs Fleet */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            background: '#F8FAFC'
          }}>
            <h2 style={{ fontSize: '1rem', fontWeight: '800', color: '#0F172A', margin: 0 }}>
              Territory Dispatch Control
            </h2>
            <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '4px 0 0 0' }}>
              Round custom zones on map. Orders in an area are only dispatched to that area's assigned riders.
            </p>
          </div>

          {/* Zones & Fleet Lists */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {/* Territory Zones Section */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Delivery Zones ({zones.length})
                </span>
                <button
                  onClick={openCreateZoneModal}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563EB',
                    fontSize: '0.78rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <i className="fa-solid fa-plus"></i> New Zone
                </button>
              </div>

              {zones.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', background: '#F8FAFC', borderRadius: '10px', border: '1px dashed #CBD5E1' }}>
                  <div style={{ color: '#94A3B8', fontSize: '1.5rem', marginBottom: '8px' }}>
                    <i className="fa-solid fa-draw-polygon"></i>
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155' }}>No territory zones configured</div>
                  <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '4px' }}>
                    Click "Round &amp; Define Territory Zone" to establish your first delivery sector.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {zones.map((zone) => {
                    const zColor = zone.color || '#10B981';
                    const assignedRiders = riders.filter((r) =>
                      zone.assignedAgentIds?.includes(r._id) || r.assignedZone?.zoneId === zone.zoneId
                    );

                    return (
                      <div
                        key={zone.zoneId || zone._id}
                        style={{
                          border: `1px solid ${selectedZone?.zoneId === zone.zoneId ? zColor : '#E2E8F0'}`,
                          borderLeft: `4px solid ${zColor}`,
                          borderRadius: '8px',
                          padding: '12px 14px',
                          background: selectedZone?.zoneId === zone.zoneId ? `${zColor}08` : '#FFFFFF',
                          transition: 'all 0.2s',
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          setSelectedZone(zone);
                          if (zone.center?.lat && zone.center?.lng) {
                            flyToCoords(zone.center.lat, zone.center.lng, 13);
                          }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: zColor }}></span>
                            <span style={{ fontWeight: '800', fontSize: '0.88rem', color: '#0F172A' }}>{zone.zoneName}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditZoneModal(zone);
                              }}
                              title="Edit Zone Radius & Riders"
                              style={{
                                background: '#F1F5F9',
                                border: '1px solid #CBD5E1',
                                color: '#334155',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: '700',
                                cursor: 'pointer'
                              }}
                            >
                              <i className="fa-solid fa-pen"></i> Edit
                            </button>
                            <button
                              onClick={(e) => handleDeleteZone(zone, e)}
                              title="Delete Territory Zone"
                              style={{
                                background: '#FEE2E2',
                                border: '1px solid #FCA5A5',
                                color: '#DC2626',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: '700',
                                cursor: 'pointer'
                              }}
                            >
                              <i className="fa-solid fa-trash"></i> Delete
                            </button>
                          </div>
                        </div>


                        {zone.mandal && (
                          <div style={{ marginBottom: '6px' }}>
                            <span style={{
                              background: '#F0F9FF',
                              color: '#0369A1',
                              border: '1px solid #BAE6FD',
                              fontSize: '0.68rem',
                              fontWeight: '800',
                              padding: '1px 6px',
                              borderRadius: '4px'
                            }}>
                              🏛️ Mandal: {zone.mandal}
                            </span>
                          </div>
                        )}

                        <div style={{ fontSize: '0.75rem', color: '#64748B', display: 'flex', gap: '12px', marginBottom: '6px' }}>
                          <span><i className="fa-solid fa-arrows-to-circle" style={{ color: zColor }}></i> {zone.radiusKm || 5} km radius</span>
                          <span><i className="fa-solid fa-users" style={{ color: '#2563EB' }}></i> {assignedRiders.length} rider(s)</span>
                        </div>

                        <div style={{ fontSize: '0.72rem', color: '#475569' }}>
                          <strong>Pincodes ({zone.pincodes?.length || 0}): </strong>
                          <span style={{ fontFamily: 'monospace', color: '#2563EB' }}>
                            {zone.pincodes?.length > 0 ? zone.pincodes.join(', ') : 'All Sub-areas'}
                          </span>
                        </div>

                        {/* Assigned Rider Avatars */}
                        {assignedRiders.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                            {assignedRiders.map((r) => (
                              <span
                                key={r._id}
                                style={{
                                  background: '#F8FAFC',
                                  border: '1px solid #E2E8F0',
                                  color: '#1E293B',
                                  fontSize: '0.68rem',
                                  fontWeight: '700',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: r.isOnline ? '#10B981' : '#94A3B8' }}></span>
                                {r.fullName}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Fleet Riders Section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Delivery Fleet ({riders.length})
                </span>
                <span style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: '700' }}>
                  ● {onlineRidersCount} Active Now
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {riders.map((rider) => {
                  const isOnline = rider.isOnline;
                  const zoneColor = rider.assignedZone?.color || '#94A3B8';
                  const zoneName = rider.assignedZone?.zoneName || 'No Zone Assigned';
                  const hasZone = !!rider.assignedZone?.zoneId;
                  const isSelected = selectedRider?._id === rider._id;

                  return (
                    <div
                      key={rider._id}
                      style={{
                        padding: '10px 12px',
                        background: isSelected ? `${zoneColor}10` : '#FFFFFF',
                        border: `1px solid ${isSelected ? zoneColor : '#E2E8F0'}`,
                        borderLeft: `4px solid ${isSelected ? zoneColor : '#E2E8F0'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onClick={() => {
                        setSelectedRider(rider);
                        if (rider.currentLocation?.lat && rider.currentLocation?.lng) {
                          flyToCoords(rider.currentLocation.lat, rider.currentLocation.lng, 15);
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            background: isOnline ? '#DCFCE7' : '#F1F5F9',
                            color: isOnline ? '#15803D' : '#64748B',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.9rem',
                            position: 'relative',
                            flexShrink: 0
                          }}>
                            <i className="fa-solid fa-motorcycle"></i>
                            <span style={{ position: 'absolute', bottom: 0, right: 0, width: '8px', height: '8px', borderRadius: '50%', background: isOnline ? '#10B981' : '#CBD5E1', border: '1.5px solid #FFFFFF' }}></span>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.84rem', fontWeight: '800', color: '#0F172A' }}>{rider.fullName}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', flexWrap: 'wrap' }}>
                              <span style={{ background: `${zoneColor}18`, color: zoneColor, fontSize: '0.63rem', fontWeight: '800', padding: '1px 5px', borderRadius: '4px' }}>
                                {zoneName}
                              </span>
                              <span style={{ fontSize: '0.66rem', color: '#64748B' }}>{rider.activeOrdersCount || 0} pkgs</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          <button
                            title={hasZone ? 'Edit / Reassign Zone' : 'Assign Territory Zone'}
                            onClick={(e) => { e.stopPropagation(); openAssignZoneForRider(rider); }}
                            style={{
                              background: hasZone ? `${zoneColor}18` : '#EFF6FF',
                              border: `1px solid ${hasZone ? zoneColor : '#93C5FD'}`,
                              color: hasZone ? zoneColor : '#2563EB',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '0.68rem',
                              fontWeight: '800',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <i className={`fa-solid ${hasZone ? 'fa-pen' : 'fa-map-pin'}`}></i>
                            {hasZone ? 'Zone' : 'Assign'}
                          </button>
                          <button
                            title="Fly to Rider"
                            onClick={(e) => { e.stopPropagation(); if (rider.currentLocation?.lat) flyToCoords(rider.currentLocation.lat, rider.currentLocation.lng, 16); }}
                            style={{ background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer', padding: '6px', fontSize: '0.85rem' }}
                          >
                            <i className="fa-solid fa-location-crosshairs"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* MODAL: Round & Configure Delivery Zone */}
      {showZoneModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              background: '#0F172A',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-draw-polygon" style={{ color: zoneFormData.color }}></i>
                  {isEditingZone ? 'Edit Territory Delivery Zone' : focusedRiderId ? `Assign Zone to Rider` : 'Round & Create Delivery Zone'}
                </h3>
                {focusedRiderId && (() => { const fr = riders.find(r => r._id === focusedRiderId); return fr ? (
                  <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.72rem', background: '#DBEAFE', color: '#1D4ED8', padding: '2px 8px', borderRadius: '20px', fontWeight: '800' }}>🏍️ {fr.fullName}</span>
                    <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>will be assigned to this territory</span>
                  </div>
                ) : null; })()}
                <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#94A3B8' }}>
                  {focusedRiderId ? 'Select or draw a zone area — then save to assign this rider.' : 'Click on the map to adjust center, or tune radius and assign riders.'}
                </p>
              </div>
              <button
                onClick={() => setShowZoneModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  color: '#FFFFFF',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveZone} style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {zoneMsg.text && (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '0.84rem',
                  fontWeight: '700',
                  background: zoneMsg.type === 'success' ? '#DCFCE7' : '#FEE2E2',
                  color: zoneMsg.type === 'success' ? '#15803D' : '#B91C1C'
                }}>
                  {zoneMsg.text}
                </div>
              )}

              {/* Auto-Verification Feedback Banner */}
              {autoVerifiedInfo && (
                <div style={{
                  background: '#ECFDF5',
                  border: '1.5px solid #6EE7B7',
                  color: '#065F46',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  marginBottom: '14px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-circle-check" style={{ color: '#10B981', fontSize: '1.1rem' }}></i>
                    <div>
                      <div>
                        <strong>✅ Auto-Verified by Backend:</strong> {autoVerifiedInfo.mandal} ({autoVerifiedInfo.telugu})
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#047857', marginTop: '2px' }}>
                        Auto-linked {autoVerifiedInfo.pincodes?.length || 5} Pincodes: {(autoVerifiedInfo.pincodes || []).join(', ')}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.68rem', background: '#D1FAE5', color: '#047857', padding: '3px 8px', borderRadius: '4px', fontWeight: '800', flexShrink: 0 }}>
                    Boundary Polygon Active
                  </span>
                </div>
              )}

              {/* Mandal & Territory Zone Details */}
              <div style={{ marginBottom: '16px', background: '#F8FAFC', padding: '14px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '800', color: '#1E293B', marginBottom: '4px' }}>
                      Select Area / Mandal (City & Outskirts)
                    </label>
                    <select
                      value={zoneFormData.mandal}
                      onChange={(e) => {
                        const selectedVal = e.target.value;
                        const matched = findMatchingMandal(selectedVal);
                        setZoneFormData({
                          ...zoneFormData,
                          mandal: matched.mandal,
                          zoneName: zoneFormData.zoneName || `${matched.mandal} Sector`,
                          pincodes: matched.pincodes ? matched.pincodes.join(', ') : zoneFormData.pincodes,
                          lat: matched.center?.lat || zoneFormData.lat,
                          lng: matched.center?.lng || zoneFormData.lng
                        });
                        setAutoVerifiedInfo({
                          mandal: matched.mandal,
                          telugu: matched.mandalTelugu,
                          pincodes: matched.pincodes,
                          villages: matched.villages || []
                        });
                      }}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #94A3B8', fontSize: '0.82rem', background: '#FFFFFF', fontWeight: '800', color: '#0F172A' }}
                    >
                      <optgroup label="🏙️ GUNTUR CITY CENTRAL SECTORS">
                        <option value="Guntur Urban">Guntur Urban (గుంటూరు అర్బన్ - Brodipet / Arundelpet)</option>
                      </optgroup>
                      <optgroup label="🏡 GUNTUR OUTSKIRTS & REGIONAL MANDALS">
                        <option value="Medikonduru">Medikonduru & Perecherla (మేడికొండూరు / పేరేచర్ల)</option>
                        <option value="Phirangipuram">Phirangipuram (ఫిరంగిపురం)</option>
                        <option value="Prathipadu">Prathipadu (ప్రతిపాడు)</option>
                        <option value="Pedakakani">Pedakakani (పెదకాకాని)</option>
                        <option value="Chebrolu">Chebrolu (చేబ్రోలు)</option>
                        <option value="Mangalagiri">Mangalagiri (మంగళగిరి)</option>
                        <option value="Tenali">Tenali (తెనాలి)</option>
                        <option value="Tadepalle">Tadepalle (తాడేపల్లి)</option>
                        <option value="Thullur">Thullur / Amaravathi (తుళ్ళూరు / అమరావతి)</option>
                      </optgroup>
                      <optgroup label="🏢 OTHER AP & TELANGANA HUBS">
                        <option value="Medchal">Medchal-Malkajgiri (మేడ్చల్)</option>
                        <option value="Serilingampally">Serilingampally / Cyberabad (శేరిలింగంపల్లి)</option>
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '800', color: '#1E293B', marginBottom: '4px' }}>
                      Territory Zone Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={zoneFormData.zoneName}
                      onChange={(e) => setZoneFormData({ ...zoneFormData, zoneName: e.target.value })}
                      placeholder="e.g. Mangalagiri Sector"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem', background: '#FFFFFF' }}
                    />
                  </div>
                </div>
              </div>

              {/* Serviced Pincodes (Auto-Detected for Selected Area) */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#1E293B' }}>
                    Serviced Delivery Pincodes (Auto-Detected for Selected Area)
                  </label>
                  <span style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: '700' }}>
                    {zoneFormData.pincodes ? zoneFormData.pincodes.split(',').filter(Boolean).length : 0} PINs Assigned
                  </span>
                </div>
                <input
                  type="text"
                  value={zoneFormData.pincodes}
                  onChange={(e) => setZoneFormData({ ...zoneFormData, pincodes: e.target.value })}
                  placeholder="522001, 522002, 522003, 522004, 522005"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.88rem',
                    fontFamily: 'monospace'
                  }}
                />
                {zoneFormData.pincodes && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '8px' }}>
                    {zoneFormData.pincodes.split(',').map(p => p.trim()).filter(Boolean).map((pin) => (
                      <span
                        key={pin}
                        style={{
                          background: '#EFF6FF',
                          color: '#1D4ED8',
                          border: '1px solid #BFDBFE',
                          borderRadius: '4px',
                          padding: '2px 7px',
                          fontSize: '0.72rem',
                          fontWeight: '700',
                          fontFamily: 'monospace'
                        }}
                      >
                        📌 {pin}
                      </span>
                    ))}
                  </div>
                )}
                <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block', marginTop: '4px' }}>
                  All orders in this touched/selected territory area will be automatically assigned to riders configured for this zone.
                </span>
              </div>

              {/* Coverage Radius & Center Lat/Lng (Max 100 KM limit enforced) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', color: '#1E293B', marginBottom: '6px' }}>
                    Radius: <span style={{ color: '#2563EB' }}>{zoneFormData.radiusKm} KM</span> (Max 100 KM)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    value={zoneFormData.radiusKm}
                    onChange={(e) => setZoneFormData({ ...zoneFormData, radiusKm: Math.min(Math.max(1, parseFloat(e.target.value) || 1), 100) })}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', color: '#1E293B', marginBottom: '6px' }}>
                    Center Pin (Lat, Lng)
                  </label>
                  <div style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#475569', padding: '8px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    {zoneFormData.lat}, {zoneFormData.lng}
                  </div>
                </div>
              </div>

              {/* Highlight Color Palette */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', color: '#1E293B', marginBottom: '6px' }}>
                  Zone Highlight Color on Map
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {COLOR_PRESETS.map((p) => (
                    <button
                      key={p.hex}
                      type="button"
                      onClick={() => setZoneFormData({ ...zoneFormData, color: p.hex })}
                      title={p.name}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: p.hex,
                        border: zoneFormData.color === p.hex ? '3px solid #0F172A' : '2px solid #FFFFFF',
                        boxShadow: zoneFormData.color === p.hex ? '0 0 0 2px #3B82F6' : '0 2px 5px rgba(0,0,0,0.15)',
                        cursor: 'pointer'
                      }}
                    />
                  ))}
                  <input
                    type="color"
                    value={zoneFormData.color}
                    onChange={(e) => setZoneFormData({ ...zoneFormData, color: e.target.value })}
                    style={{ width: '32px', height: '32px', border: 'none', background: 'none', cursor: 'pointer' }}
                  />
                </div>
              </div>

              {/* Assign Riders (Multi-Agent Selection) */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: '800', color: '#1E293B', margin: 0 }}>
                    Assign Fleet Riders to this Territory
                  </label>
                  <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: '700' }}>
                    Multiple riders allowed per area
                  </span>
                </div>

                <div style={{
                  maxHeight: '160px',
                  overflowY: 'auto',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '8px',
                  background: '#F8FAFC',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  {riders.map((r) => {
                    const isChecked = zoneFormData.assignedAgentIds.includes(r._id);
                    return (
                      <label
                        key={r._id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '6px 10px',
                          background: isChecked ? '#EFF6FF' : '#FFFFFF',
                          border: `1px solid ${isChecked ? '#93C5FD' : '#E2E8F0'}`,
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.82rem'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setZoneFormData({
                                ...zoneFormData,
                                assignedAgentIds: [...zoneFormData.assignedAgentIds, r._id]
                              });
                            } else {
                              setZoneFormData({
                                ...zoneFormData,
                                assignedAgentIds: zoneFormData.assignedAgentIds.filter((id) => id !== r._id)
                              });
                            }
                          }}
                        />
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: '700', color: '#0F172A' }}>{r.fullName}</span>
                          <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                            {r.vehicleType || 'Motorcycle'} • {r.isOnline ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid #E2E8F0' }}>
                <button
                  type="button"
                  onClick={() => setShowZoneModal(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#475569',
                    fontSize: '0.85rem',
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
                    padding: '10px 22px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10B981, #059669)',
                    color: '#FFFFFF',
                    fontSize: '0.85rem',
                    fontWeight: '800',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)'
                  }}
                >
                  {savingZone ? 'Saving Territory...' : 'Save & Highlight Territory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
