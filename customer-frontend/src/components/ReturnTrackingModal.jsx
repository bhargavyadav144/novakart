import React, { useState } from 'react';
import api, { formatINR } from '../services/api';

const RETURN_STAGES = [
  { key: 'REQUESTED', label: 'Return Requested', icon: 'fa-file-invoice' },
  { key: 'APPROVED', label: 'Approved by Seller', icon: 'fa-check' },
  { key: 'PICKUP_SCHEDULED', label: 'Pickup Scheduled', icon: 'fa-truck-clock' },
  { key: 'PICKED_UP', label: 'Parcel Picked Up', icon: 'fa-truck-pickup' },
  { key: 'COMPLETED', label: 'Refund / Replacement Done', icon: 'fa-circle-check' }
];

export default function ReturnTrackingModal({ isOpen, onClose, returnRequest, onCancelled }) {
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  if (!isOpen || !returnRequest) return null;

  const currentStatus = returnRequest.status;
  const isCancelled = currentStatus === 'CANCELLED';
  const isRejected = currentStatus === 'REJECTED';

  const getStageIndex = (status) => {
    switch (status) {
      case 'REQUESTED': return 0;
      case 'APPROVED': return 1;
      case 'PICKUP_SCHEDULED': return 2;
      case 'PICKED_UP':
      case 'INSPECTION_PASSED': return 3;
      case 'REFUNDED':
      case 'EXCHANGED_DISPATCHED':
      case 'COMPLETED': return 4;
      default: return 0;
    }
  };

  const activeIndex = getStageIndex(currentStatus);

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this return/exchange request? You will retain the items.')) {
      return;
    }

    setCancelling(true);
    setCancelError('');

    try {
      const { data } = await api.put(`/returns/${returnRequest._id}/cancel`);
      if (data.success) {
        if (onCancelled) {
          onCancelled(data.returnRequest);
        }
        onClose();
      }
    } catch (err) {
      setCancelError(err.response?.data?.message || 'Failed to cancel return request.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.78)',
      backdropFilter: 'blur(6px)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '18px',
        width: '100%',
        maxWidth: '540px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.3)',
        border: '1px solid #E2E8F0'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                background: returnRequest.type === 'RETURN' ? '#EF4444' : '#2563EB',
                color: '#fff',
                fontSize: '0.68rem',
                fontWeight: '900',
                padding: '2px 8px',
                borderRadius: '12px'
              }}>
                {returnRequest.type}
              </span>
              <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: '800', color: '#FFFFFF' }}>
                Return Tracking &bull; Order #{returnRequest.orderNumber}
              </h3>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
              Request ID: {returnRequest._id}
            </span>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              fontSize: '1.5rem',
              cursor: 'pointer',
              lineHeight: 1
            }}
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {cancelError && (
            <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '10px 14px', borderRadius: '8px', fontSize: '0.8rem' }}>
              {cancelError}
            </div>
          )}

          {/* Stepper */}
          {!isCancelled && !isRejected ? (
            <div style={{ padding: '10px 4px 16px 4px', borderBottom: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                {RETURN_STAGES.map((st, i) => {
                  const isDone = activeIndex >= i;
                  const isCurrent = activeIndex === i;
                  return (
                    <div key={st.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, zIndex: 2 }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: isDone ? '#10B981' : '#F1F5F9',
                        color: isDone ? '#FFFFFF' : '#94A3B8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.85rem',
                        boxShadow: isCurrent ? '0 0 10px #10B981' : 'none',
                        transition: 'all 0.2s'
                      }}>
                        <i className={`fa-solid ${st.icon}`}></i>
                      </div>
                      <span style={{
                        fontSize: '0.66rem',
                        fontWeight: isCurrent ? '800' : '600',
                        color: isCurrent ? '#0F172A' : '#64748B',
                        textAlign: 'center',
                        marginTop: '6px',
                        maxWidth: '80px',
                        lineHeight: '1.2'
                      }}>
                        {st.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{
              background: '#FEE2E2',
              border: '1px solid #FCA5A5',
              borderRadius: '10px',
              padding: '14px',
              textAlign: 'center'
            }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '0.96rem', fontWeight: '800', color: '#991B1B' }}>
                {isCancelled ? 'Return Request Cancelled' : 'Return Request Rejected'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.76rem', color: '#7F1D1D' }}>
                {isCancelled
                  ? 'You cancelled this return request. You can continue keeping and enjoying your items.'
                  : 'This return request was reviewed and could not be approved based on return criteria.'}
              </p>
            </div>
          )}

          {/* Details Card */}
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748B', textTransform: 'uppercase', fontWeight: '700' }}>
                  {returnRequest.type === 'RETURN' ? 'Estimated Refund' : 'Exchange Action'}
                </span>
                <div style={{ fontSize: '1.05rem', fontWeight: '900', color: '#0F172A', marginTop: '2px' }}>
                  {returnRequest.type === 'RETURN'
                    ? formatINR(returnRequest.estimatedRefundAmount)
                    : 'Replacement Piece'}
                </div>
                <span style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: '700' }}>
                  {returnRequest.refundPreference === 'WALLET' ? '⚡ Instant Wallet Credit' : '🏦 Bank Transfer'}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748B', textTransform: 'uppercase', fontWeight: '700' }}>
                  Doorstep Courier Pickup
                </span>
                <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>
                  {returnRequest.scheduledPickupDate
                    ? new Date(returnRequest.scheduledPickupDate).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })
                    : 'Within 48 hours'}
                </div>
                <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                  Agent will call before visiting
                </span>
              </div>
            </div>

            {/* Items */}
            <div style={{ marginTop: '14px', borderTop: '1px solid #E2E8F0', paddingTop: '10px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>
                Items ({returnRequest.items?.length}):
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                {returnRequest.items?.map((it, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                    <span style={{ color: '#0F172A', fontWeight: '600' }}>
                      &bull; {it.name} (Qty: {it.quantity})
                    </span>
                    <span style={{ fontWeight: '700', color: '#475569' }}>
                      {formatINR(it.price * it.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reason */}
            <div style={{ marginTop: '10px', fontSize: '0.76rem', color: '#475569' }}>
              <b>Reason:</b> {returnRequest.reasonCategory?.replace(/_/g, ' ')}
              {returnRequest.reasonDetails && ` - "${returnRequest.reasonDetails}"`}
            </div>
          </div>

          {/* Timeline */}
          <div>
            <h5 style={{ fontSize: '0.8rem', fontWeight: '800', color: '#0F172A', margin: '0 0 8px 0' }}>
              Tracking Timeline
            </h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {returnRequest.timeline?.map((t, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.76rem' }}>
                  <i className="fa-solid fa-circle-dot" style={{ color: '#2563EB', marginTop: '3px' }}></i>
                  <div>
                    <span style={{ fontWeight: '700', color: '#0F172A' }}>{t.note}</span>
                    <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                      {new Date(t.timestamp).toLocaleString('en-IN')} &bull; {t.updatedBy}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cancel Request Button if in initial stages */}
          {['REQUESTED', 'APPROVED', 'PICKUP_SCHEDULED'].includes(currentStatus) && (
            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                Changed your mind? You can cancel the return request.
              </span>
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                style={{
                  background: 'none',
                  border: '1px solid #EF4444',
                  color: '#EF4444',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  cursor: cancelling ? 'not-allowed' : 'pointer'
                }}
              >
                {cancelling ? 'Cancelling...' : 'Cancel Return Request'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
