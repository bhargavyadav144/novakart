import React, { useEffect, useState, useCallback } from 'react';
import warehouseApi, { formatINR, SOCKET_BASE_URL } from '../services/warehouseApi';
import { useWarehouseAuth } from '../context/WarehouseAuthContext';
import { io } from 'socket.io-client';
import BarcodeVisual from '../components/BarcodeVisual';

const FALLBACK_PRODUCT_IMG = 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=400&q=80';

export default function WarehouseDashboard({ warehouse, onWarehouseUpdate }) {
  const { managerUser } = useWarehouseAuth();
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStage, setFilterStage] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingStageId, setUpdatingStageId] = useState(null);
  const [updatingLoad, setUpdatingLoad] = useState(false);
  const [newLoadInput, setNewLoadInput] = useState('');

  // Barcode Scanner State
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [scanMessage, setScanMessage] = useState(null);
  const [scanning, setScanning] = useState(false);

  const fetchShipments = useCallback(() => {
    warehouseApi.get('/warehouses/my-warehouse/shipments')
      .then(({ data }) => setShipments(data.orders || []))
      .catch((err) => console.error('Error fetching shipments:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchShipments();

    // Auto-polling every 6 seconds
    const interval = setInterval(fetchShipments, 6000);

    // Socket.io real-time notifications
    const socket = io(SOCKET_BASE_URL);
    if (warehouse?._id) {
      socket.emit('join_warehouse_room', warehouse._id);
    }
    socket.on('order_status_update', () => fetchShipments());
    socket.on('new_incoming_order', () => fetchShipments());

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, [fetchShipments, warehouse]);

  // Stage Advancement / Inbound Receipt Action
  const handleAdvanceStage = async (orderId, nextStage, defaultNotes) => {
    setUpdatingStageId(orderId);
    try {
      const { data } = await warehouseApi.put(`/warehouses/my-warehouse/shipments/${orderId}/stage`, {
        stage: nextStage,
        notes: defaultNotes
      });
      
      const scheduleNote = data.deliverySchedule?.noticeText || '';
      setScanMessage({
        type: 'success',
        text: `✅ Shipment updated to '${nextStage.replace(/_/g, ' ')}'! ${scheduleNote}`
      });

      fetchShipments();
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating stage');
    } finally {
      setUpdatingStageId(null);
    }
  };

  // Barcode Scan & Confirm Product Received Workflow with 9:00 AM Cutoff
  const handleScanSubmit = async (e) => {
    e.preventDefault();
    if (!scannedBarcode.trim()) return;

    setScanning(true);
    setScanMessage(null);

    // Sanitize input: Strip leading # or symbols e.g. #ORD-130626-3930 -> ord-130626-3930
    const rawInput = scannedBarcode.trim();
    const cleanTerm = rawInput.replace(/^#/, '').trim().toLowerCase();
    
    // 1. Search in local shipments state first
    let matched = shipments.find(s => {
      const orderNum = (s.orderNumber || '').toLowerCase();
      const cleanOrderNum = orderNum.replace(/^#/, '');
      const id = (s._id || '').toLowerCase();
      return (
        cleanOrderNum === cleanTerm ||
        orderNum === cleanTerm ||
        id === cleanTerm ||
        cleanOrderNum.includes(cleanTerm) ||
        cleanTerm.includes(cleanOrderNum.split('-').pop() || '')
      );
    });

    // 2. If not found in local state, fetch live from backend search API
    if (!matched) {
      try {
        const { data } = await warehouseApi.get(`/warehouses/my-warehouse/shipments?search=${encodeURIComponent(cleanTerm)}`);
        if (data.orders && data.orders.length > 0) {
          matched = data.orders[0];
          setShipments(data.orders);
        }
      } catch (err) {
        console.warn('Search API fallback failed:', err);
      }
    }

    if (!matched) {
      try {
        const { data } = await warehouseApi.put(`/warehouses/my-warehouse/shipments/${encodeURIComponent(cleanTerm)}/stage`, {
          stage: 'IN_REGIONAL_HUB',
          notes: `Inbound package barcode '${rawInput}' scanned & received at facility dock.`
        });

        const schedText = data.deliverySchedule?.noticeText || '';
        setScanMessage({
          type: 'success',
          text: `✅ Product #${data.order?.orderNumber || rawInput} Scanned & Confirmed Received at ${warehouse?.name || 'Warehouse'}! ${schedText}`
        });
        setScannedBarcode('');
        fetchShipments();
        setScanning(false);
        return;
      } catch (err) {
        setScanMessage({
          type: 'error',
          text: err.response?.data?.message || `❌ Package barcode '${rawInput}' not found in database. Verify shipment number.`
        });
        setScanning(false);
        return;
      }
    }

    const currentStage = matched.logisticsRoute?.transitStage || 'AT_STORE';
    let nextStage = 'AT_DELIVERY_BRANCH';
    let note = `Product scanned & received at ${warehouse?.name || 'Warehouse'}. Local rider pickup access granted.`;

    if (currentStage === 'AT_STORE' || currentStage === 'DISPATCHED_TO_HUB') {
      nextStage = 'IN_REGIONAL_HUB';
      note = `Inbound parcel scanned & checked into ${warehouse?.name || 'Regional Sorting Hub'}.`;
    } else if (currentStage === 'IN_REGIONAL_HUB') {
      nextStage = 'IN_TRANSIT_TO_BRANCH';
      note = `Parcel scanned & dispatched to destination branch.`;
    } else if (currentStage === 'IN_TRANSIT_TO_BRANCH') {
      nextStage = 'AT_DELIVERY_BRANCH';
      note = `Product received at delivery branch. Fleet rider access enabled.`;
    } else if (currentStage === 'AT_DELIVERY_BRANCH') {
      nextStage = 'OUT_FOR_DELIVERY';
      note = `Product scanned & handed over to delivery rider for doorstep delivery.`;
    }

    try {
      const { data } = await warehouseApi.put(`/warehouses/my-warehouse/shipments/${matched._id}/stage`, {
        stage: nextStage,
        notes: note
      });

      const schedText = data.deliverySchedule?.noticeText || '';

      setScanMessage({
        type: 'success',
        text: `✅ Product #${matched.orderNumber} Scanned & Confirmed Received at ${warehouse?.name || 'Warehouse'}! Stage: '${nextStage.replace(/_/g, ' ')}'. ${schedText}`
      });
      setScannedBarcode('');
      fetchShipments();
    } catch (err) {
      setScanMessage({
        type: 'error',
        text: `Failed to confirm scan: ${err.response?.data?.message || err.message}`
      });
    } finally {
      setScanning(false);
    }
  };

  const handleUpdateLoad = async () => {
    const val = parseInt(newLoadInput, 10);
    if (isNaN(val) || val < 0) {
      alert('Please enter a valid load number');
      return;
    }
    setUpdatingLoad(true);
    try {
      const { data } = await warehouseApi.put('/warehouses/my-warehouse', {
        currentLoad: val
      });
      if (onWarehouseUpdate) onWarehouseUpdate(data.warehouse);
      setNewLoadInput('');
      alert('Facility storage load updated successfully!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update load');
    } finally {
      setUpdatingLoad(false);
    }
  };

  const handleToggleStatus = async () => {
    const nextStatus = warehouse?.status === 'active' ? 'maintenance' : 'active';
    try {
      const { data } = await warehouseApi.put('/warehouses/my-warehouse', {
        status: nextStatus
      });
      if (onWarehouseUpdate) onWarehouseUpdate(data.warehouse);
    } catch (err) {
      alert('Failed to toggle operational status');
    }
  };

  // Filtered shipments
  const filteredShipments = shipments.filter(s => {
    const currentStage = s.logisticsRoute?.transitStage || 'AT_STORE';
    if (filterStage !== 'ALL' && currentStage !== filterStage) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase().replace(/^#/, '');
      const matchNum = s.orderNumber?.toLowerCase().includes(q);
      const matchCust = s.deliveryAddress?.fullName?.toLowerCase().includes(q);
      const matchCity = s.deliveryAddress?.city?.toLowerCase().includes(q);
      const matchItem = s.items?.some(it => it.name?.toLowerCase().includes(q));
      if (!matchNum && !matchCust && !matchCity && !matchItem) return false;
    }
    return true;
  });

  const capacity = warehouse?.capacity || 45000;
  const currentLoad = warehouse?.currentLoad || 24800;
  const loadPercentage = capacity ? Math.min(100, Math.round((currentLoad / capacity) * 100)) : 0;

  const stageCounts = {
    all: shipments.length,
    inbound: shipments.filter(s => ['AT_STORE', 'DISPATCHED_TO_HUB'].includes(s.logisticsRoute?.transitStage)).length,
    inHub: shipments.filter(s => s.logisticsRoute?.transitStage === 'IN_REGIONAL_HUB').length,
    inTransit: shipments.filter(s => s.logisticsRoute?.transitStage === 'IN_TRANSIT_TO_BRANCH').length,
    atBranch: shipments.filter(s => s.logisticsRoute?.transitStage === 'AT_DELIVERY_BRANCH').length,
    outForDelivery: shipments.filter(s => ['OUT_FOR_DELIVERY', 'DELIVERED'].includes(s.logisticsRoute?.transitStage)).length
  };

  const nowHour = new Date().getHours();
  const isBefore9AMCurrent = nowHour < 9;

  return (
    <div>
      {/* Top Facility Control Center Header */}
      <div style={{
        background: '#0F172A',
        color: '#FFFFFF',
        borderRadius: '16px',
        padding: '24px 28px',
        marginBottom: '24px',
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.12)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                background: '#3B82F6',
                color: '#FFFFFF',
                fontSize: '0.75rem',
                fontWeight: '800',
                padding: '3px 8px',
                borderRadius: '6px',
                fontFamily: 'monospace'
              }}>
                {warehouse?.code || 'WH-AP-GNT01'}
              </span>
              <span style={{
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#E2E8F0',
                fontSize: '0.72rem',
                fontWeight: '700',
                padding: '3px 8px',
                borderRadius: '6px'
              }}>
                {warehouse?.type || 'Regional Sorting Hub'}
              </span>
              <span style={{
                background: warehouse?.state === 'Andhra Pradesh' ? '#059669' : '#D97706',
                color: '#FFFFFF',
                fontSize: '0.72rem',
                fontWeight: '700',
                padding: '3px 8px',
                borderRadius: '6px'
              }}>
                {warehouse?.state || 'Andhra Pradesh'}
              </span>
            </div>

            <h1 style={{ fontSize: '1.75rem', fontWeight: '800', margin: '8px 0 4px 0', letterSpacing: '-0.02em' }}>
              {warehouse?.name || 'Guntur Regional Hub'}
            </h1>
            <p style={{ color: '#94A3B8', fontSize: '0.85rem', margin: 0, display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span><i className="fa-solid fa-location-dot" style={{ color: '#F87171' }}></i> {warehouse?.address || 'Nallapadu Industrial Estate'}, {warehouse?.city || 'Guntur'} - {warehouse?.pincode || '522005'}</span>
              <span>&bull;</span>
              <span style={{ fontFamily: 'monospace' }}><i className="fa-solid fa-crosshairs" style={{ color: '#60A5FA' }}></i> {warehouse?.location?.lat || '16.3067'}° N, {warehouse?.location?.lng || '80.4365'}° E</span>
            </p>
          </div>

          {/* Operational Controls & Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={handleToggleStatus}
              style={{
                background: warehouse?.status === 'active' ? '#064E3B' : '#7F1D1D',
                border: `1px solid ${warehouse?.status === 'active' ? '#059669' : '#DC2626'}`,
                color: '#FFFFFF',
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: warehouse?.status === 'active' ? '#10B981' : '#EF4444' }}></span>
              {warehouse?.status === 'active' ? 'STATUS: OPERATIONAL' : 'STATUS: MAINTENANCE'}
            </button>
          </div>
        </div>

        {/* Live Capacity Bar inside Hero */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #1E293B', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ flex: 1, minWidth: '260px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '6px' }}>
              <span style={{ color: '#94A3B8', fontWeight: '600' }}>Live Storage Utilization</span>
              <strong style={{ color: '#FFFFFF' }}>{currentLoad.toLocaleString('en-IN')} / {capacity.toLocaleString('en-IN')} units ({loadPercentage}%)</strong>
            </div>
            <div style={{ height: '8px', background: '#334155', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                width: `${loadPercentage}%`,
                height: '100%',
                background: loadPercentage > 80 ? '#EF4444' : loadPercentage > 50 ? '#F59E0B' : '#10B981',
                borderRadius: '4px',
                transition: 'width 0.3s'
              }}></div>
            </div>
          </div>

          {/* Quick Load Update Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="number"
              placeholder="Update load..."
              value={newLoadInput}
              onChange={(e) => setNewLoadInput(e.target.value)}
              style={{
                background: '#1E293B',
                border: '1px solid #334155',
                color: '#FFFFFF',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                width: '130px',
                outline: 'none'
              }}
            />
            <button
              onClick={handleUpdateLoad}
              disabled={updatingLoad}
              style={{
                background: '#3B82F6',
                color: '#FFFFFF',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              {updatingLoad ? 'Saving...' : 'Set Load'}
            </button>
          </div>
        </div>
      </div>

      {/* 📦 INBOUND BARCODE SCANNER & CONFIRM PRODUCT RECEIPT WIDGET */}
      <div style={{
        background: 'linear-gradient(135deg, #1E293B, #0F172A)',
        borderRadius: '14px',
        padding: '20px 24px',
        marginBottom: '24px',
        border: '1px solid #3B82F6',
        boxShadow: '0 6px 20px rgba(59, 130, 246, 0.15)',
        color: '#FFFFFF'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#60A5FA' }}>
              <i className="fa-solid fa-barcode"></i> Inbound Package Barcode Scanner &amp; Product Receipt
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#94A3B8', margin: '2px 0 0' }}>
              Scan Code 128 package barcodes arriving at {warehouse?.name || 'this facility'} to confirm stock receipt and grant fleet rider pickup access.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{
              background: isBefore9AMCurrent ? '#065F46' : '#92400E',
              color: isBefore9AMCurrent ? '#A7F3D0' : '#FDE68A',
              fontSize: '0.72rem',
              fontWeight: '800',
              padding: '3px 10px',
              borderRadius: '20px',
              border: `1px solid ${isBefore9AMCurrent ? '#34D399' : '#F59E0B'}`
            }}>
              ⏰ {isBefore9AMCurrent ? '9:00 AM Cutoff: ACTIVE (Same-Day Delivery Today)' : '9:00 AM Cutoff: PASSED (Scheduled for Tomorrow 9 AM)'}
            </span>
            <span style={{ background: '#059669', color: '#FFFFFF', fontSize: '0.72rem', fontWeight: '800', padding: '3px 10px', borderRadius: '20px', border: '1px solid #34D399' }}>
              ✓ Scanner Active
            </span>
          </div>
        </div>

        <form onSubmit={handleScanSubmit} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
            <i className="fa-solid fa-barcode" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#60A5FA', fontSize: '1rem' }}></i>
            <input
              type="text"
              placeholder="Scan or Enter Barcode / Order ID (e.g., #ORD-130626-3930, 3930)..."
              value={scannedBarcode}
              onChange={(e) => setScannedBarcode(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px 12px 42px',
                borderRadius: '8px',
                border: '1.5px solid #3B82F6',
                background: '#0F172A',
                color: '#FFFFFF',
                fontSize: '0.9rem',
                fontFamily: 'monospace',
                fontWeight: '700',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={scanning}
            style={{
              background: '#10B981',
              color: '#090D16',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '8px',
              fontSize: '0.88rem',
              fontWeight: '800',
              cursor: scanning ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
            }}
          >
            {scanning ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-box-archive"></i>}
            Scan &amp; Confirm Product Received
          </button>
        </form>

        {scanMessage && (
          <div style={{
            marginTop: '12px',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '0.84rem',
            fontWeight: '700',
            background: scanMessage.type === 'success' ? '#065F46' : '#991B1B',
            color: scanMessage.type === 'success' ? '#A7F3D0' : '#FECACA',
            border: `1px solid ${scanMessage.type === 'success' ? '#34D399' : '#FCA5A5'}`
          }}>
            {scanMessage.text}
          </div>
        )}
      </div>

      {/* Metric Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ color: '#64748B', fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase' }}>All Shipments</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#0F172A', marginTop: '4px' }}>{stageCounts.all}</div>
          <div style={{ fontSize: '0.72rem', color: '#4F46E5', marginTop: '2px', fontWeight: '600' }}>Active in this facility</div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ color: '#64748B', fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase' }}>Inbound / Dispatched</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#D97706', marginTop: '4px' }}>{stageCounts.inbound}</div>
          <div style={{ fontSize: '0.72rem', color: '#92400E', marginTop: '2px', fontWeight: '600' }}>En route from sellers</div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ color: '#64748B', fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase' }}>At Sorting Center</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#2563EB', marginTop: '4px' }}>{stageCounts.inHub}</div>
          <div style={{ fontSize: '0.72rem', color: '#1D4ED8', marginTop: '2px', fontWeight: '600' }}>Ready for branch transfer</div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ color: '#64748B', fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase' }}>At Delivery Branch</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#059669', marginTop: '4px' }}>{stageCounts.atBranch}</div>
          <div style={{ fontSize: '0.72rem', color: '#047857', marginTop: '2px', fontWeight: '600' }}>Ready for Rider Pickup</div>
        </div>
      </div>

      {/* Manager Payroll & Bank Details Card */}
      <div style={{ background: '#FFFFFF', padding: '18px 24px', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
              <i className="fa-solid fa-money-check-dollar"></i>
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                Manager Payroll, Bank Routing &amp; Biometric Security
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '2px 0 0' }}>
                Direct corporate salary disbursals managed by Central Treasury via NEFT
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ background: '#ECFDF5', color: '#047857', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', border: '1px solid #A7F3D0', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa-solid fa-fingerprint"></i> Biometric Face/Fingerprint: Enrolled
            </span>
            <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', border: '1px solid #BFDBFE', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa-solid fa-building-columns"></i> Bank Account Verified
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', background: '#F8FAFC', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748B', textTransform: 'uppercase', fontWeight: '700' }}>Manager &amp; Emp ID</div>
            <div style={{ fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>{warehouse?.manager?.name || managerUser?.name || 'Venkat Rao'} ({warehouse?.manager?.employeeId || managerUser?.employeeId || 'MGR-AP-15'})</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748B', textTransform: 'uppercase', fontWeight: '700' }}>Monthly Salary</div>
            <div style={{ fontWeight: '800', color: '#059669', marginTop: '2px', fontSize: '1.05rem' }}>₹45,000 / month</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748B', textTransform: 'uppercase', fontWeight: '700' }}>Bank Account Number</div>
            <div style={{ fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>•••• •••• {warehouse?.manager?.bankDetails?.accountNumber ? warehouse.manager.bankDetails.accountNumber.slice(-4) : '4729'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748B', textTransform: 'uppercase', fontWeight: '700' }}>Bank IFSC &amp; Branch</div>
            <div style={{ fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>{warehouse?.manager?.bankDetails?.ifscCode || 'UBIN0801291'} ({warehouse?.manager?.bankDetails?.bankName || 'Andhra Bank / Union Bank of India'})</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Stage Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: `All (${stageCounts.all})` },
            { id: 'IN_REGIONAL_HUB', label: `In Regional Hub (${stageCounts.inHub})` },
            { id: 'IN_TRANSIT_TO_BRANCH', label: `In Transit (${stageCounts.inTransit})` },
            { id: 'AT_DELIVERY_BRANCH', label: `At Delivery Branch (${stageCounts.atBranch})` },
            { id: 'OUT_FOR_DELIVERY', label: `Out for Delivery (${stageCounts.outForDelivery})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterStage(tab.id)}
              style={{
                padding: '7px 14px',
                borderRadius: '6px',
                fontWeight: '700',
                fontSize: '0.8rem',
                cursor: 'pointer',
                border: 'none',
                background: filterStage === tab.id ? '#0F172A' : '#F1F5F9',
                color: filterStage === tab.id ? '#FFFFFF' : '#475569',
                transition: 'all 0.15s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ minWidth: '240px', position: 'relative' }}>
          <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: '0.8rem' }}></i>
          <input
            type="text"
            placeholder="Search order, customer, product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '0.82rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* Shipments Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#3B82F6' }}></i>
          <p style={{ marginTop: '12px', color: '#64748B' }}>Loading facility routed shipments...</p>
        </div>
      ) : filteredShipments.length === 0 ? (
        <div style={{ background: '#FFFFFF', padding: '60px 20px', textAlign: 'center', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <i className="fa-solid fa-dolly" style={{ fontSize: '3rem', color: '#CBD5E1', marginBottom: '14px' }}></i>
          <h3 style={{ margin: 0, color: '#334155' }}>No shipments currently in this category</h3>
          <p style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Shipments routed through this facility will appear here in real-time.</p>
        </div>
      ) : (
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <table className="wh-table">
            <thead>
              <tr>
                <th>Order &amp; Time</th>
                <th>Destination Customer</th>
                <th>Freight Items</th>
                <th>Logistics Chain</th>
                <th>Transit Stage &amp; 9 AM Schedule</th>
                <th>Manager Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredShipments.map(s => {
                const stage = s.logisticsRoute?.transitStage || 'AT_STORE';
                const originWh = s.logisticsRoute?.originWarehouse;
                const destWh = s.logisticsRoute?.destinationBranch;
                const isOrigin = originWh?._id === warehouse?._id || originWh?.code === warehouse?.code;
                const isDest = destWh?._id === warehouse?._id || destWh?.code === warehouse?.code;

                const sched = s.logisticsRoute?.deliverySchedule;

                return (
                  <tr key={s._id}>
                    {/* Order ID, Barcode & Time */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <strong style={{ fontFamily: 'monospace', color: '#0F172A', fontSize: '0.92rem' }}>
                          {s.orderNumber}
                        </strong>
                        <BarcodeVisual code={s.orderNumber} width={130} height={26} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{
                            fontFamily: 'monospace',
                            fontSize: '0.72rem',
                            fontWeight: '800',
                            background: '#FEF3C7',
                            color: '#92400E',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            border: '1px solid #FDE68A'
                          }}>
                            CODE: {s.orderNumber?.split('-').pop() || s.orderNumber?.slice(-6)}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                            {new Date(s.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#1E293B', fontWeight: '700' }}>
                          {formatINR(s.totalAmount)}
                        </div>
                      </div>
                    </td>

                    {/* Customer */}
                    <td style={{ maxWidth: '220px' }}>
                      <div style={{ fontWeight: '700', color: '#1E293B' }}>{s.deliveryAddress?.fullName}</div>
                      <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: '2px' }}>
                        <i className="fa-solid fa-phone" style={{ fontSize: '0.68rem', marginRight: '4px' }}></i>
                        {s.deliveryAddress?.phone}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '2px', lineHeight: '1.3' }}>
                        {s.deliveryAddress?.street}, {s.deliveryAddress?.city}, {s.deliveryAddress?.state} - {s.deliveryAddress?.postalCode}
                      </div>
                    </td>

                    {/* Items */}
                    <td>
                      {s.items?.map((it, idx) => {
                        const imgSrc = it.image || it.productId?.images?.[0] || FALLBACK_PRODUCT_IMG;
                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: idx < s.items.length - 1 ? '8px' : 0 }}>
                            <img
                              src={imgSrc}
                              alt={it.name}
                              onError={(e) => { e.currentTarget.src = FALLBACK_PRODUCT_IMG; }}
                              style={{
                                width: '42px',
                                height: '42px',
                                objectFit: 'cover',
                                borderRadius: '6px',
                                border: '1px solid #E2E8F0',
                                background: '#F8FAFC'
                              }}
                            />
                            <div>
                              <div style={{ fontWeight: '700', fontSize: '0.84rem', color: '#1E293B', textTransform: 'capitalize' }}>
                                {it.name}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
                                Qty: <strong style={{ color: '#0F172A' }}>{it.quantity}</strong> &times; {formatINR(it.price)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </td>

                    {/* Logistics Chain */}
                    <td style={{ minWidth: '220px' }}>
                      <div style={{ fontSize: '0.74rem', color: '#475569' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: isOrigin ? '800' : '500', color: isOrigin ? '#2563EB' : '#64748B' }}>
                            <i className="fa-solid fa-warehouse" style={{ marginRight: '3px' }}></i>
                            {originWh?.city || 'Regional Hub'}
                          </span>
                          <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.62rem', color: '#94A3B8' }}></i>
                          <span style={{ fontWeight: isDest ? '800' : '500', color: isDest ? '#059669' : '#64748B' }}>
                            <i className="fa-solid fa-location-dot" style={{ marginRight: '3px' }}></i>
                            {destWh?.city || 'Branch'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
                          Branch: <strong style={{ color: '#334155' }}>{destWh?.name || 'Tenali Branch'}</strong>
                        </div>
                      </div>
                    </td>

                    {/* Transit Stage Badge & 9:00 AM Delivery Batch */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className={`wh-badge ${
                          stage === 'IN_REGIONAL_HUB' ? 'wh-badge-primary' :
                          stage === 'AT_DELIVERY_BRANCH' ? 'wh-badge-emerald' :
                          stage === 'OUT_FOR_DELIVERY' || stage === 'DELIVERED' ? 'wh-badge-emerald' :
                          'wh-badge-amber'
                        }`}>
                          <i className="fa-solid fa-circle" style={{ fontSize: '0.45rem' }}></i>
                          {stage.replace(/_/g, ' ')}
                        </span>

                        {sched && (
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: '800',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: sched.isBefore9AM ? '#ECFDF5' : '#FEF3C7',
                            color: sched.isBefore9AM ? '#047857' : '#B45309',
                            border: `1px solid ${sched.isBefore9AM ? '#A7F3D0' : '#FDE68A'}`
                          }}>
                            ⏰ {sched.dispatchBatchTime} Batch
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Manager Action Buttons & Inbound Confirmation */}
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {stage === 'AT_STORE' || stage === 'DISPATCHED_TO_HUB' ? (
                        <button
                          className="wh-btn wh-btn-primary"
                          disabled={updatingStageId === s._id}
                          onClick={() => handleAdvanceStage(s._id, 'IN_REGIONAL_HUB', `Shipment received & scanned into ${warehouse?.name}`)}
                          style={{ background: '#10B981', color: '#090D16', border: 'none', fontWeight: '800' }}
                        >
                          <i className="fa-solid fa-box-archive"></i> Confirm Product Received
                        </button>
                      ) : stage === 'IN_REGIONAL_HUB' ? (
                        <button
                          className="wh-btn wh-btn-primary"
                          disabled={updatingStageId === s._id}
                          onClick={() => handleAdvanceStage(s._id, 'IN_TRANSIT_TO_BRANCH', `Dispatched from ${warehouse?.name} to destination branch`)}
                        >
                          <i className="fa-solid fa-truck-arrow-right"></i> Dispatch to Branch
                        </button>
                      ) : stage === 'IN_TRANSIT_TO_BRANCH' ? (
                        <button
                          className="wh-btn wh-btn-emerald"
                          disabled={updatingStageId === s._id}
                          onClick={() => handleAdvanceStage(s._id, 'AT_DELIVERY_BRANCH', `Freight arrived at ${warehouse?.name}, ready for rider handover`)}
                          style={{ background: '#10B981', color: '#090D16', border: 'none', fontWeight: '800' }}
                        >
                          <i className="fa-solid fa-clipboard-check"></i> Receive &amp; Grant Rider Access
                        </button>
                      ) : stage === 'AT_DELIVERY_BRANCH' ? (
                        <button
                          className="wh-btn wh-btn-emerald"
                          disabled={updatingStageId === s._id}
                          onClick={() => handleAdvanceStage(s._id, 'OUT_FOR_DELIVERY', `Handed over to delivery agent for last-mile delivery`)}
                        >
                          <i className="fa-solid fa-motorcycle"></i> Handover to Rider
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <i className="fa-solid fa-circle-check"></i> Dispatched / Delivered
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
