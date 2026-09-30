import React, { useEffect, useState } from 'react';
import deliveryApi, { formatINR } from '../services/deliveryApi';
import { useNavigate, Link } from 'react-router-dom';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import BarcodeVisual from '../components/BarcodeVisual';
import CustomerCallModal from '../components/CustomerCallModal';
import DoorstepDeliveryScanModal from '../components/DoorstepDeliveryScanModal';
import FaceVerificationModal from '../components/FaceVerificationModal';
import { useDeliveryAuth } from '../context/DeliveryAuthContext';

export const formatDateTimeWithSeconds = (dateStr) => {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

export default function DeliveryOrdersListPage() {
  const { agentUser, socket, updateAgentUser } = useDeliveryAuth() || {};
  const [activeOrders, setActiveOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('DELIVERIES'); // 'DELIVERIES' | 'RETURNS'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderForAction, setSelectedOrderForAction] = useState(null);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isDoorstepScanModalOpen, setIsDoorstepScanModalOpen] = useState(false);
  const [doorstepModalMode, setDoorstepModalMode] = useState('HANDOVER');
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [customerContactedMap, setCustomerContactedMap] = useState({});
  const [returnPickups, setReturnPickups] = useState([]);
  const [loadingReturns, setLoadingReturns] = useState(false);
  const [deliveryNote, setDeliveryNote] = useState('');
  const [isOnline, setIsOnline] = useState(agentUser?.isOnline ?? true);
  const [agentProfile, setAgentProfile] = useState(null);
  const navigate = useNavigate();

  const fetchActiveOrders = () => {
    setLoading(true);
    deliveryApi.get('/delivery/dashboard-stats')
      .then(({ data }) => {
        const orders = data.activeOrders || (data.activeOrder ? [data.activeOrder] : []);
        setActiveOrders(orders);
        setAgentProfile(data.stats);
        if (data.stats?.isOnline !== undefined) {
          setIsOnline(data.stats.isOnline);
          if (updateAgentUser) {
            updateAgentUser({
              isOnline: data.stats.isOnline,
              isFaceVerified: !!data.stats.isFaceVerified,
              profileImage: data.stats.profileImage,
              faceVerificationPhoto: data.stats.faceVerificationPhoto
            });
          }
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  const fetchReturnPickups = () => {
    setLoadingReturns(true);
    deliveryApi.get('/returns/delivery/pickups')
      .then(({ data }) => {
        if (data.success) {
          setReturnPickups(data.returns || []);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoadingReturns(false));
  };

  useEffect(() => {
    fetchActiveOrders();
    fetchReturnPickups();
  }, []);

  // Real-time synchronization with Warehouse Manager route & territory updates
  useEffect(() => {
    if (!socket) return;

    const handleZoneAssigned = (data) => {
      setDeliveryNote(`🗺️ Territory updated to ${data.zoneName || data.mandal || 'New Zone'}. Refreshing delivery queue...`);
      fetchActiveOrders();
    };

    const handleRouteUpdated = () => {
      setDeliveryNote(`📍 Route Deliveries queue refreshed with latest sequenced territory stops.`);
      fetchActiveOrders();
    };

    const handleOrderStatusUpdate = () => {
      fetchActiveOrders();
    };

    socket.on('agent_zone_assigned', handleZoneAssigned);
    socket.on('route_updated', handleRouteUpdated);
    socket.on('order_status_update', handleOrderStatusUpdate);
    socket.on('warehouse_zone_updated', handleRouteUpdated);

    return () => {
      socket.off('agent_zone_assigned', handleZoneAssigned);
      socket.off('route_updated', handleRouteUpdated);
      socket.off('order_status_update', handleOrderStatusUpdate);
      socket.off('warehouse_zone_updated', handleRouteUpdated);
    };
  }, [socket]);

  const handleToggleDuty = async () => {
    try {
      const { data } = await deliveryApi.put('/delivery/toggle-duty');
      const nextState = data.isOnline !== undefined ? data.isOnline : !isOnline;
      setIsOnline(nextState);
      if (updateAgentUser) {
        updateAgentUser({ isOnline: nextState });
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update duty state');
    }
  };

  const handleUpdateStatus = async (order, nextStatus) => {
    try {
      await deliveryApi.put(`/orders/delivery/${order._id}/update-status`, { status: nextStatus });
      setDeliveryNote(`✅ Order #${order.orderNumber} status updated to: ${nextStatus.replace(/_/g, ' ')}`);
      fetchActiveOrders();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update delivery status');
    }
  };

  const handleCallCompleted = (outcome) => {
    if (!selectedOrderForAction) return;
    setCustomerContactedMap(prev => ({
      ...prev,
      [selectedOrderForAction._id]: outcome
    }));
    if (outcome === 'CUSTOMER_UNREACHABLE') {
      setDeliveryNote(`⚠️ Customer unreachable! Opening exception handler to log attempts and stage for hub RTO.`);
      setDoorstepModalMode('UNREACHABLE');
      setIsDoorstepScanModalOpen(true);
    } else {
      setDeliveryNote(`📞 Customer contacted (${outcome.replace(/_/g, ' ')}). Ready for delivery handover!`);
    }
  };

  const handleConfirmReturnPickup = async (ret) => {
    const defaultBarcode = `RET-${(ret._id || '').slice(-6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const barcode = prompt('Enter or scan returned package barcode:', defaultBarcode);
    if (!barcode) return;

    try {
      const res = await deliveryApi.put(`/returns/delivery/${ret._id}/pickup-confirm`, {
        barcodeScanned: barcode,
        pickupProofNotes: 'Package collected from customer doorstep with original tags & condition verified.'
      });
      if (res.data.success) {
        alert(`🎉 Doorstep Return Parcel (#${ret.orderNumber || ret.orderId?.orderNumber}) collected successfully!\n\n📍 Deliver to ${ret.destinationWarehouseId?.name || 'Warehouse Hub'}.`);
        fetchReturnPickups();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to confirm return pickup');
    }
  };

  // Filter orders by search query
  const filteredOrders = activeOrders.filter(ord => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const orderNum = (ord.orderNumber || '').toLowerCase();
    const customer = (ord.deliveryAddress?.fullName || '').toLowerCase();
    const city = (ord.deliveryAddress?.city || '').toLowerCase();
    const area = (ord.routeSequence?.areaName || '').toLowerCase();
    return orderNum.includes(q) || customer.includes(q) || city.includes(q) || area.includes(q);
  });

  return (
    <main className="delivery-container">
      {/* Top Bar Duty & Refresh */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '14px',
        gap: '8px'
      }}>
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: '900', color: '#0F172A', margin: 0, letterSpacing: '-0.3px' }}>
            Route Deliveries Queue
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.78rem', margin: '2px 0 0 0' }}>
            Area-sequenced route &bull; {activeOrders.length} active stops assigned
          </p>
        </div>

        <button
          onClick={handleToggleDuty}
          className={`duty-toggle-btn ${isOnline ? 'duty-online' : 'duty-offline'}`}
          style={{ padding: '6px 12px', fontSize: '0.74rem', flexShrink: 0 }}
          title="Toggle Duty Availability"
        >
          <i className="fa-solid fa-power-off"></i> {isOnline ? 'ONLINE' : 'OFFLINE'}
        </button>
      </div>

      {/* Mandatory Live Face Verification Alert Banner */}
      {!agentUser?.isFaceVerified && (
        <div style={{
          background: 'linear-gradient(135deg, #7C2D12 0%, #991B1B 100%)',
          color: '#FFF',
          padding: '12px 16px',
          borderRadius: '14px',
          marginBottom: '14px',
          border: '1.5px solid #EF4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          boxShadow: '0 4px 16px rgba(239, 68, 68, 0.35)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#EF4444', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: '900', flexShrink: 0 }}>
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div>
              <div style={{ fontWeight: '900', fontSize: '0.86rem', color: '#FFF' }}>
                Verify Your Face Now (Mandatory System KYC)
              </div>
              <div style={{ fontSize: '0.74rem', color: '#FCA5A5', marginTop: '1px' }}>
                Live camera biometric verification is required before accepting route dispatches.
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsFaceModalOpen(true)}
            style={{
              background: '#EF4444',
              color: '#FFF',
              border: 'none',
              borderRadius: '10px',
              padding: '8px 14px',
              fontSize: '0.78rem',
              fontWeight: '900',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}
          >
            <i className="fa-solid fa-camera"></i> Verify Face Now &rarr;
          </button>
        </div>
      )}

      {/* Success / Status Note Banner */}
      {deliveryNote && (
        <div style={{
          background: '#ECFDF5',
          border: '1px solid #A7F3D0',
          color: '#065F46',
          padding: '10px 14px',
          borderRadius: '10px',
          fontSize: '0.82rem',
          fontWeight: '600',
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-circle-check" style={{ color: '#10B981', fontSize: '1rem' }}></i>
            <span>{deliveryNote}</span>
          </div>
          <button
            onClick={() => setDeliveryNote('')}
            style={{ background: 'none', border: 'none', color: '#065F46', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Assigned Territory Zone Banner */}
      {agentProfile?.assignedZone && (
        <div style={{
          background: '#FFFFFF',
          border: `1.5px solid ${agentProfile.assignedZone.color || '#10B981'}`,
          borderRadius: '12px',
          padding: '10px 14px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: agentProfile.assignedZone.color || '#10B981',
              boxShadow: `0 0 8px ${agentProfile.assignedZone.color || '#10B981'}`
            }}></div>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span>Territory: <strong style={{ color: agentProfile.assignedZone.color || '#10B981' }}>{agentProfile.assignedZone.zoneName || 'Assigned Area'}</strong></span>
                {agentProfile.assignedZone.mandal && (
                  <span style={{
                    background: '#F0F9FF',
                    color: '#0369A1',
                    border: '1px solid #BAE6FD',
                    fontSize: '0.66rem',
                    fontWeight: '800',
                    padding: '1px 6px',
                    borderRadius: '4px'
                  }}>
                    🏛️ Mandal: {agentProfile.assignedZone.mandal}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '2px' }}>
                Pincodes ({(agentProfile.assignedZone.pincodes || []).length}): <b style={{ color: '#2563EB', fontFamily: 'monospace' }}>{(agentProfile.assignedZone.pincodes || []).join(', ') || 'Facility Default'}</b> &bull; Radius: {agentProfile.assignedZone.radiusKm || 5} km
              </div>
            </div>
          </div>
          <span style={{ fontSize: '0.66rem', background: '#F1F5F9', color: '#334155', padding: '3px 8px', borderRadius: '6px', fontWeight: '700', flexShrink: 0 }}>
            Exclusive Multi-PIN Zone
          </span>
        </div>
      )}

      {/* Corridor Area Progression Stepper */}
      <div style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        color: '#FFFFFF',
        borderRadius: '12px',
        padding: '12px 14px',
        marginBottom: '14px',
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.12)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#38BDF8', letterSpacing: '0.5px' }}>
            <i className="fa-solid fa-route" style={{ marginRight: '4px' }}></i> AUTO-SEQUENCED ROUTE
          </span>
          <span style={{ fontSize: '0.68rem', background: 'rgba(16, 185, 129, 0.25)', color: '#34D399', padding: '2px 8px', borderRadius: '10px', fontWeight: '800' }}>
            {agentProfile?.assignedRoute?.routeTitle || (agentProfile?.assignedZone?.mandal ? `${agentProfile.assignedZone.mandal} Priority` : 'Priority Area First')}
          </span>
        </div>

        {/* Horizontal Dynamic Route Waypoints */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
          <span style={{ fontSize: '0.74rem', background: '#334155', padding: '3px 8px', borderRadius: '6px', whiteSpace: 'nowrap', fontWeight: '700' }}>
            🏢 Hub Origin
          </span>

          {agentProfile?.assignedRoute?.stops && agentProfile.assignedRoute.stops.length > 0 ? (
            agentProfile.assignedRoute.stops.map((st, idx) => (
              <React.Fragment key={st.stopNumber || idx}>
                <i className="fa-solid fa-chevron-right" style={{ fontSize: '0.65rem', color: '#64748B' }}></i>
                <span style={{
                  fontSize: '0.74rem',
                  background: idx === 0 ? '#047857' : '#1E3A8A',
                  color: idx === 0 ? '#D1FAE5' : '#BFDBFE',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  whiteSpace: 'nowrap',
                  fontWeight: idx === 0 ? '800' : '700'
                }}>
                  📍 {st.areaName || st.mandal || `Stop ${idx + 1}`} {st.pincode ? `(${st.pincode})` : ''}
                </span>
              </React.Fragment>
            ))
          ) : activeOrders.length > 0 ? (
            activeOrders.map((ord, idx) => (
              <React.Fragment key={ord._id || idx}>
                <i className="fa-solid fa-chevron-right" style={{ fontSize: '0.65rem', color: '#64748B' }}></i>
                <span style={{
                  fontSize: '0.74rem',
                  background: idx === 0 ? '#047857' : '#1E3A8A',
                  color: idx === 0 ? '#D1FAE5' : '#BFDBFE',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  whiteSpace: 'nowrap',
                  fontWeight: idx === 0 ? '800' : '700'
                }}>
                  📍 {ord.routeSequence?.areaName || ord.deliveryAddress?.city || `Stop ${idx + 1}`}
                </span>
              </React.Fragment>
            ))
          ) : (
            <>
              <i className="fa-solid fa-chevron-right" style={{ fontSize: '0.65rem', color: '#64748B' }}></i>
              <span style={{ fontSize: '0.74rem', background: '#047857', color: '#D1FAE5', padding: '3px 8px', borderRadius: '6px', whiteSpace: 'nowrap', fontWeight: '800' }}>
                📍 {agentProfile?.assignedZone?.mandal || 'Assigned Territory'}
              </span>
            </>
          )}

          <i className="fa-solid fa-chevron-right" style={{ fontSize: '0.65rem', color: '#64748B' }}></i>
          <span style={{ fontSize: '0.74rem', background: '#334155', padding: '3px 8px', borderRadius: '6px', whiteSpace: 'nowrap', fontWeight: '700' }}>
            🏁 Hub Return
          </span>
        </div>
      </div>

      {/* Tabs: Deliveries vs Returns */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('DELIVERIES')}
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: '10px',
            border: 'none',
            background: activeTab === 'DELIVERIES' ? '#2563EB' : '#FFFFFF',
            color: activeTab === 'DELIVERIES' ? '#FFFFFF' : '#475569',
            fontWeight: '800',
            fontSize: '0.82rem',
            cursor: 'pointer',
            boxShadow: activeTab === 'DELIVERIES' ? '0 2px 10px rgba(37, 99, 235, 0.35)' : '0 1px 3px rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <i className="fa-solid fa-truck-fast"></i>
          Deliveries ({activeOrders.length})
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('RETURNS');
            fetchReturnPickups();
          }}
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: '10px',
            border: 'none',
            background: activeTab === 'RETURNS' ? '#F59E0B' : '#FFFFFF',
            color: activeTab === 'RETURNS' ? '#131921' : '#475569',
            fontWeight: '800',
            fontSize: '0.82rem',
            cursor: 'pointer',
            boxShadow: activeTab === 'RETURNS' ? '0 2px 10px rgba(245, 158, 11, 0.35)' : '0 1px 3px rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <i className="fa-solid fa-rotate-left"></i>
          Doorstep Returns ({returnPickups.length})
        </button>
      </div>

      {/* Action Bar: Warehouse Barcode Scan & Search */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: '0.85rem' }}></i>
          <input
            type="text"
            placeholder="Search order #, customer, area..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '9px 12px 9px 34px',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              fontSize: '0.82rem',
              outline: 'none'
            }}
          />
        </div>

        <button
          onClick={() => setIsScanModalOpen(true)}
          style={{
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            color: '#090D16',
            border: 'none',
            borderRadius: '10px',
            padding: '8px 14px',
            fontWeight: '800',
            fontSize: '0.8rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
            flexShrink: 0
          }}
          title="Scan package barcode at dock"
        >
          <i className="fa-solid fa-barcode"></i> Scan Dock Package
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 10px', color: '#64748B' }}>
          <i className="fa-solid fa-circle-notch fa-spin fa-2x" style={{ color: '#2563EB', marginBottom: '10px' }}></i>
          <div style={{ fontSize: '0.86rem' }}>Loading route orders sequence...</div>
        </div>
      )}

      {/* FORWARD DELIVERIES TAB */}
      {!loading && activeTab === 'DELIVERIES' && (
        <>
          {filteredOrders.length === 0 ? (
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '14px',
              padding: '36px 16px',
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: '#EFF6FF',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.6rem',
                margin: '0 auto 14px auto'
              }}>
                <i className="fa-solid fa-boxes-stacked"></i>
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0F172A', margin: '0 0 6px 0' }}>
                No Active Orders in Queue
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#64748B', maxWidth: '320px', margin: '0 auto 18px auto', lineHeight: '1.5' }}>
                Scan warehouse package barcodes or enter the last 6 digits of an Order ID to claim packages for your delivery corridor.
              </p>
              <button
                onClick={() => setIsScanModalOpen(true)}
                style={{
                  background: '#2563EB',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 20px',
                  fontWeight: '800',
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)'
                }}
              >
                <i className="fa-solid fa-barcode"></i> Scan Packages at Dock
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredOrders.map((ord, idx) => {
                const rawNum = ord.orderNumber || '';
                const parts = rawNum.split('-');
                const last6 = parts.length > 1 ? parts[parts.length - 1] : rawNum.slice(-6);
                const area = ord.routeSequence?.areaName || ord.deliveryAddress?.city || 'Local Area';
                const isEtukuru = area.toLowerCase().includes('etukuru');
                const isContacted = customerContactedMap[ord._id];

                return (
                  <div
                    key={ord._id}
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '14px',
                      border: '1px solid #E2E8F0',
                      padding: '14px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                      position: 'relative'
                    }}
                  >
                    {/* Top Row: Stop Badge & Order Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: '900',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: isEtukuru ? '#DCFCE7' : '#EFF6FF',
                          color: isEtukuru ? '#166534' : '#1E40AF'
                        }}>
                          STOP #{idx + 1} {isEtukuru && idx === 0 ? '• TOP ETUKURU' : ''}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                          <i className="fa-solid fa-location-dot" style={{ color: isEtukuru ? '#16A34A' : '#2563EB', marginRight: '3px' }}></i>
                          <b>{area}</b>
                        </span>
                      </div>

                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: '800',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: ord.orderStatus === 'OUT_FOR_DELIVERY' ? '#FEF3C7' : ord.orderStatus === 'PICKED_UP' ? '#E0E7FF' : '#F1F5F9',
                        color: ord.orderStatus === 'OUT_FOR_DELIVERY' ? '#92400E' : ord.orderStatus === 'PICKED_UP' ? '#3730A3' : '#475569'
                      }}>
                        {ord.orderStatus === 'AGENT_ASSIGNED' ? 'To Pickup' : ord.orderStatus === 'PICKED_UP' ? 'Picked Up' : 'On The Way'}
                      </span>
                    </div>

                    {/* Order Number & Barcode Tag */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontFamily: 'monospace', fontWeight: '900', fontSize: '0.92rem', color: '#0F172A' }}>
                          #{rawNum.replace(last6, '')}
                          <span style={{ background: '#FEF08A', color: '#854D0E', padding: '1px 5px', borderRadius: '4px', marginLeft: '2px' }}>
                            {last6}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>
                          Payout: <strong style={{ color: '#10B981' }}>₹140.00</strong> &bull; {ord.items?.length || 1} package item(s)
                        </div>
                      </div>

                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: '800',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: ord.paymentMethod === 'Cash on Delivery (COD)' ? '#FEF3C7' : '#F0FDF4',
                        color: ord.paymentMethod === 'Cash on Delivery (COD)' ? '#92400E' : '#166534'
                      }}>
                        {ord.paymentMethod === 'Cash on Delivery (COD)' ? `COD ${formatINR(ord.totalAmount)}` : '🔒 Prepaid OTP'}
                      </span>
                    </div>

                    {/* Customer & Address Details */}
                    <div style={{ background: '#F8FAFC', padding: '10px', borderRadius: '8px', marginBottom: '10px' }}>
                      <div style={{ fontSize: '0.84rem', fontWeight: '800', color: '#0F172A' }}>
                        👤 {ord.deliveryAddress?.fullName || 'Customer'}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px', lineHeight: '1.4' }}>
                        📍 {ord.deliveryAddress?.street}, {ord.deliveryAddress?.city} - {ord.deliveryAddress?.postalCode}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                        <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                          📞 {ord.deliveryAddress?.phone || '+91 98765 43210'}
                        </span>
                        {isContacted && (
                          <span style={{ fontSize: '0.7rem', color: '#166534', fontWeight: '800' }}>
                            ✓ Contacted ({isContacted})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {/* BUTTON 1: Open on Live Map */}
                      <button
                        type="button"
                        onClick={() => navigate(`/map?stop=${idx}`)}
                        style={{
                          background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '9px 10px',
                          fontSize: '0.78rem',
                          fontWeight: '800',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)'
                        }}
                      >
                        <i className="fa-solid fa-map-location-dot"></i> Live Map &rarr;
                      </button>

                      {/* BUTTON 2: Call Customer */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOrderForAction(ord);
                          setIsCallModalOpen(true);
                        }}
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          color: '#0F172A',
                          borderRadius: '8px',
                          padding: '9px 10px',
                          fontSize: '0.78rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <i className="fa-solid fa-phone" style={{ color: '#10B981' }}></i> Call Customer
                      </button>
                    </div>

                    {/* Status Advance Action Button */}
                    <div style={{ marginTop: '8px' }}>
                      {ord.orderStatus === 'AGENT_ASSIGNED' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(ord, 'PICKED_UP')}
                          style={{
                            width: '100%',
                            background: '#10B981',
                            color: '#090D16',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '9px',
                            fontSize: '0.8rem',
                            fontWeight: '800',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          <i className="fa-solid fa-box-check"></i> Mark Picked Up from Warehouse
                        </button>
                      )}

                      {ord.orderStatus === 'PICKED_UP' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(ord, 'OUT_FOR_DELIVERY')}
                          style={{
                            width: '100%',
                            background: '#F59E0B',
                            color: '#090D16',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '9px',
                            fontSize: '0.8rem',
                            fontWeight: '800',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          <i className="fa-solid fa-motorcycle"></i> Start Journey (Heading to Stop #{idx + 1})
                        </button>
                      )}

                      {ord.orderStatus === 'OUT_FOR_DELIVERY' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrderForAction(ord);
                              setDoorstepModalMode('HANDOVER');
                              setIsDoorstepScanModalOpen(true);
                            }}
                            style={{
                              width: '100%',
                              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '9px',
                              fontSize: '0.82rem',
                              fontWeight: '900',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)'
                            }}
                          >
                            <i className="fa-solid fa-barcode"></i> Doorstep Deliver &amp; Verify
                          </button>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedOrderForAction(ord);
                                setDoorstepModalMode('RETURN');
                                setIsDoorstepScanModalOpen(true);
                              }}
                              style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#DC2626',
                                borderRadius: '6px',
                                padding: '6px 4px',
                                fontSize: '0.72rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px'
                              }}
                            >
                              <i className="fa-solid fa-rotate-left"></i> Customer Return
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedOrderForAction(ord);
                                setDoorstepModalMode('UNREACHABLE');
                                setIsDoorstepScanModalOpen(true);
                              }}
                              style={{
                                background: 'rgba(245, 158, 11, 0.1)',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                color: '#B45309',
                                borderRadius: '6px',
                                padding: '6px 4px',
                                fontSize: '0.72rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px'
                              }}
                            >
                              <i className="fa-solid fa-phone-slash"></i> Not Lifting Call
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* DOORSTEP RETURNS TAB */}
      {!loading && activeTab === 'RETURNS' && (
        <div>
          {loadingReturns ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
              <i className="fa-solid fa-spinner fa-spin fa-2x" style={{ color: '#F59E0B', marginBottom: '8px' }}></i>
              <div>Loading return pickups...</div>
            </div>
          ) : returnPickups.length === 0 ? (
            <div style={{ background: '#FFFFFF', padding: '36px 16px', textAlign: 'center', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
              <i className="fa-solid fa-box-open fa-2x" style={{ color: '#CBD5E1', marginBottom: '10px' }}></i>
              <h4 style={{ color: '#0F172A', margin: '0 0 4px 0' }}>No Return Pickups Assigned</h4>
              <p style={{ color: '#64748B', fontSize: '0.8rem', margin: 0 }}>
                When customers request returns in your corridor, they will appear here for doorstep collection.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {returnPickups.map(ret => (
                <div key={ret._id} style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: '800', color: '#F59E0B' }}>
                      DOORSTEP RETURN
                    </span>
                    <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '10px', background: ret.status === 'PICKED_UP' ? '#DCFCE7' : '#FEF3C7', color: ret.status === 'PICKED_UP' ? '#166534' : '#B45309', fontWeight: '800' }}>
                      {ret.status === 'PICKED_UP' ? '✓ COLLECTED' : 'SCHEDULED'}
                    </span>
                  </div>

                  <h4 style={{ margin: '0 0 6px 0', fontSize: '0.96rem', fontWeight: '800', color: '#0F172A' }}>
                    Order #{ret.orderNumber || ret.orderId?.orderNumber}
                  </h4>

                  <div style={{ fontSize: '0.82rem', color: '#334155', marginBottom: '8px' }}>
                    📍 {ret.pickupAddress?.street}, {ret.pickupAddress?.city}
                  </div>

                  {ret.status !== 'PICKED_UP' ? (
                    <button
                      type="button"
                      onClick={() => handleConfirmReturnPickup(ret)}
                      style={{
                        width: '100%',
                        background: '#16A34A',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '9px',
                        fontSize: '0.8rem',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <i className="fa-solid fa-barcode"></i> Confirm Return Pickup &amp; Scan
                    </button>
                  ) : (
                    <div style={{ fontSize: '0.78rem', color: '#059669', fontWeight: '700' }}>
                      ✓ Hand over to {ret.destinationWarehouseId?.name || 'Warehouse Hub'} QC dock.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Warehouse Package Scan Modal */}
      <BarcodeScannerModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        onOrderClaimed={(claimed) => {
          setIsScanModalOpen(false);
          setDeliveryNote(`🎉 Package claimed & added to route queue!`);
          fetchActiveOrders();
        }}
      />

      {/* Doorstep Proof-of-Delivery Barcode Scan Modal */}
      {isDoorstepScanModalOpen && selectedOrderForAction && (
        <DoorstepDeliveryScanModal
          isOpen={isDoorstepScanModalOpen}
          initialMode={doorstepModalMode}
          onClose={() => {
            setIsDoorstepScanModalOpen(false);
            setSelectedOrderForAction(null);
            setDoorstepModalMode('HANDOVER');
          }}
          order={selectedOrderForAction}
          onDeliveryCompleted={(deliveredOrder, note) => {
            setIsDoorstepScanModalOpen(false);
            setSelectedOrderForAction(null);
            setDoorstepModalMode('HANDOVER');
            setDeliveryNote(note || `🎉 Order #${deliveredOrder.orderNumber || selectedOrderForAction.orderNumber} updated successfully!`);
            fetchActiveOrders();
          }}
        />
      )}

      {/* Customer Call Modal */}
      {isCallModalOpen && selectedOrderForAction && (
        <CustomerCallModal
          order={selectedOrderForAction}
          onClose={() => {
            setIsCallModalOpen(false);
            setSelectedOrderForAction(null);
          }}
          onCallCompleted={handleCallCompleted}
        />
      )}

      {/* Mandatory Face Verification Modal */}
      {isFaceModalOpen && (
        <FaceVerificationModal
          isOpen={isFaceModalOpen}
          onClose={() => setIsFaceModalOpen(false)}
          onVerifiedSuccess={() => fetchActiveOrders()}
        />
      )}
    </main>
  );
}
