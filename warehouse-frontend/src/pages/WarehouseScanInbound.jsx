import React, { useState, useEffect, useCallback } from 'react';
import warehouseApi, { formatINR, SOCKET_BASE_URL } from '../services/warehouseApi';
import { useWarehouseAuth } from '../context/WarehouseAuthContext';
import { io } from 'socket.io-client';
import BarcodeVisual from '../components/BarcodeVisual';

const FALLBACK_PRODUCT_IMG = 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=400&q=80';

export default function WarehouseScanInbound({ warehouse }) {
  const { managerUser } = useWarehouseAuth();
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scannedInput, setScannedInput] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  const fetchShipments = useCallback(() => {
    warehouseApi.get('/warehouses/my-warehouse/shipments')
      .then(({ data }) => setShipments(data.orders || []))
      .catch((err) => console.error('Error fetching shipments:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchShipments();

    const interval = setInterval(fetchShipments, 6000);
    const socket = io(SOCKET_BASE_URL);
    if (warehouse?._id) socket.emit('join_warehouse_room', warehouse._id);
    socket.on('order_status_update', () => fetchShipments());
    socket.on('new_incoming_order', () => fetchShipments());

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, [fetchShipments, warehouse]);

  // Execute scan & receipt confirmation
  const handleConfirmReceipt = async (order) => {
    if (!order) return;
    setProcessingId(order._id);
    setScanResult(null);

    const currentStage = order.logisticsRoute?.transitStage || 'AT_STORE';
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
      const { data } = await warehouseApi.put(`/warehouses/my-warehouse/shipments/${order._id}/stage`, {
        stage: nextStage,
        notes: note
      });

      const schedText = data.deliverySchedule?.noticeText || '';

      setScanResult({
        type: 'success',
        title: `Product #${order.orderNumber} Confirmed Received!`,
        message: `Status updated to '${nextStage.replace(/_/g, ' ')}'. ${schedText}`,
        order: data.order || order
      });

      setScannedInput('');
      fetchShipments();
    } catch (err) {
      setScanResult({
        type: 'error',
        title: 'Scan Confirmation Failed',
        message: err.response?.data?.message || err.message
      });
    } finally {
      setProcessingId(null);
    }
  };

  // Form submit scan handler
  const handleScanFormSubmit = async (e) => {
    e.preventDefault();
    if (!scannedInput.trim()) return;

    const rawInput = scannedInput.trim();
    const cleanTerm = rawInput.replace(/^#/, '').trim();

    // 1. Match shipment in local state first
    let matched = shipments.find(s => {
      const orderNum = (s.orderNumber || '').toLowerCase();
      const cleanOrderNum = orderNum.replace(/^#/, '');
      const id = (s._id || '').toLowerCase();
      const termLower = cleanTerm.toLowerCase();
      return (
        cleanOrderNum === termLower ||
        orderNum === termLower ||
        id === termLower ||
        cleanOrderNum.includes(termLower) ||
        termLower.includes(cleanOrderNum.split('-').pop() || '')
      );
    });

    if (matched) {
      handleConfirmReceipt(matched);
    } else {
      // 2. Direct backend scan confirmation for any order ID in MongoDB
      setProcessingId('SCANNING');
      setScanResult(null);

      try {
        const { data } = await warehouseApi.put(`/warehouses/my-warehouse/shipments/${encodeURIComponent(cleanTerm)}/stage`, {
          stage: 'IN_REGIONAL_HUB',
          notes: `Inbound package barcode '${rawInput}' scanned & received at facility dock.`
        });

        const schedText = data.deliverySchedule?.noticeText || '';
        setScanResult({
          type: 'success',
          title: `Package #${data.order?.orderNumber || rawInput} Confirmed Received!`,
          message: `Product checked into ${warehouse?.name || 'Warehouse'}. ${schedText}`,
          order: data.order
        });

        setScannedInput('');
        fetchShipments();
      } catch (err) {
        setScanResult({
          type: 'error',
          title: 'Package Not Found',
          message: err.response?.data?.message || `No active shipment matching barcode '${rawInput}' found in database.`
        });
      } finally {
        setProcessingId(null);
      }
    }
  };

  const pendingInbound = shipments.filter(s => 
    !['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(s.orderStatus)
  );

  const nowHour = new Date().getHours();
  const isBefore9AM = nowHour < 9;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Top Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fa-solid fa-barcode" style={{ color: '#3B82F6' }}></i>
          Inbound Barcode Scanner &amp; Product Receipt Center
        </h1>
        <p style={{ color: '#64748B', fontSize: '0.88rem', margin: '4px 0 0' }}>
          Scan package barcodes or type Order IDs to verify product arrival at <strong>{warehouse?.name}</strong> and grant fleet riders pickup access.
        </p>
      </div>

      {/* 1. Primary Scanner Control Bar */}
      <div style={{
        background: 'linear-gradient(135deg, #0F172A, #1E293B)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '28px',
        border: '1px solid #3B82F6',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.2)',
        color: '#FFFFFF'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#60A5FA', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ⚡ LIVE BARCODE / PARCEL RECEIVER DOCK
            </span>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: '2px 0 0' }}>
              Scan Code 128 Barcode or Enter Package ID
            </h2>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{
              background: isBefore9AM ? '#065F46' : '#92400E',
              color: isBefore9AM ? '#A7F3D0' : '#FDE68A',
              fontSize: '0.75rem',
              fontWeight: '800',
              padding: '4px 12px',
              borderRadius: '20px',
              border: `1px solid ${isBefore9AM ? '#34D399' : '#F59E0B'}`
            }}>
              ⏰ {isBefore9AM ? '9:00 AM Cutoff: ACTIVE (Same-Day Delivery Today)' : '9:00 AM Cutoff: PASSED (Tomorrow 9 AM Batch)'}
            </span>
          </div>
        </div>

        <form onSubmit={handleScanFormSubmit} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
            <i className="fa-solid fa-barcode" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#60A5FA', fontSize: '1.2rem' }}></i>
            <input
              type="text"
              placeholder="Scan Barcode or Type Order ID e.g. #ORD-130626-3930, 3930..."
              value={scannedInput}
              onChange={(e) => setScannedInput(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                padding: '14px 16px 14px 48px',
                borderRadius: '10px',
                border: '2px solid #3B82F6',
                background: '#0F172A',
                color: '#FFFFFF',
                fontSize: '1rem',
                fontFamily: 'monospace',
                fontWeight: '700',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={processingId !== null}
            style={{
              background: '#10B981',
              color: '#090D16',
              border: 'none',
              padding: '14px 24px',
              borderRadius: '10px',
              fontSize: '0.95rem',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
            }}
          >
            <i className="fa-solid fa-box-archive"></i> Confirm Product Received
          </button>
        </form>

        {/* Quick Sample Click Buttons for Expected Inbound Parcels */}
        {shipments.length > 0 && (
          <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontSize: '0.76rem', color: '#94A3B8', fontWeight: '700', display: 'block', marginBottom: '8px' }}>
              👇 Quick Tap to Scan &amp; Confirm Expected Inbound Shipment:
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {shipments.slice(0, 5).map(s => (
                <button
                  key={s._id}
                  type="button"
                  onClick={() => handleConfirmReceipt(s)}
                  disabled={processingId === s._id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#FFFFFF',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontFamily: 'monospace',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-qrcode" style={{ color: '#60A5FA' }}></i>
                  #{s.orderNumber} ({s.items?.[0]?.name?.slice(0, 15) || 'Product'})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Scan Results Display Banner */}
        {scanResult && (
          <div style={{
            marginTop: '16px',
            padding: '16px 20px',
            borderRadius: '10px',
            background: scanResult.type === 'success' ? '#065F46' : '#991B1B',
            color: scanResult.type === 'success' ? '#A7F3D0' : '#FECACA',
            border: `1px solid ${scanResult.type === 'success' ? '#34D399' : '#FCA5A5'}`
          }}>
            <strong style={{ fontSize: '0.95rem', display: 'block', marginBottom: '4px' }}>{scanResult.title}</strong>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>{scanResult.message}</p>
          </div>
        )}
      </div>

      {/* 2. Expected Inbound Products Manifest Feed */}
      <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-boxes-packing" style={{ color: '#10B981' }}></i>
              Facility Inbound Products Manifest ({pendingInbound.length})
            </h2>
            <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '2px 0 0' }}>
              Products arriving from sellers or regional hubs requiring manager scanning &amp; stock entry.
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#3B82F6' }}></i>
          </div>
        ) : pendingInbound.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8' }}>
            <i className="fa-solid fa-circle-check" style={{ fontSize: '2.5rem', color: '#10B981', marginBottom: '10px' }}></i>
            <h3 style={{ margin: 0, color: '#334155' }}>All expected inbound parcels scanned &amp; received!</h3>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {pendingInbound.map(ord => {
              const firstItem = ord.items?.[0];
              const imgSrc = firstItem?.image || firstItem?.productId?.images?.[0] || FALLBACK_PRODUCT_IMG;
              const stage = ord.logisticsRoute?.transitStage || 'AT_STORE';

              return (
                <div key={ord._id} style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justify: 'space-between',
                  gap: '12px'
                }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <strong style={{ fontFamily: 'monospace', color: '#1A237E', fontSize: '0.95rem' }}>
                        #{ord.orderNumber}
                      </strong>
                      <span className="wh-badge wh-badge-emerald" style={{ fontSize: '0.7rem' }}>
                        {stage.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <img
                        src={imgSrc}
                        alt={firstItem?.name}
                        onError={(e) => { e.currentTarget.src = FALLBACK_PRODUCT_IMG; }}
                        style={{ width: '56px', height: '56px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #CBD5E1' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {firstItem?.name || 'Product Item'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
                          Qty: <strong>{firstItem?.quantity || 1}</strong> &bull; Value: {formatINR(ord.totalAmount)}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#334155', marginTop: '2px' }}>
                          Customer: <strong>{ord.deliveryAddress?.fullName}</strong> ({ord.deliveryAddress?.city})
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '10px' }}>
                      <BarcodeVisual code={ord.orderNumber} width={130} height={26} />
                    </div>
                  </div>

                  <button
                    onClick={() => handleConfirmReceipt(ord)}
                    disabled={processingId === ord._id}
                    style={{
                      background: '#10B981',
                      color: '#090D16',
                      border: 'none',
                      padding: '10px',
                      borderRadius: '8px',
                      fontWeight: '800',
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justify: 'center',
                      gap: '6px',
                      width: '100%',
                      boxShadow: '0 2px 6px rgba(16, 185, 129, 0.2)'
                    }}
                  >
                    {processingId === ord._id ? (
                      <i className="fa-solid fa-spinner fa-spin"></i>
                    ) : (
                      <>
                        <i className="fa-solid fa-check"></i> Scan &amp; Confirm Product Received
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
