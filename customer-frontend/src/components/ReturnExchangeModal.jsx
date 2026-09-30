import React, { useState } from 'react';
import api, { formatINR } from '../services/api';

const REASONS = [
  { value: 'DEFECTIVE_DAMAGED', label: 'Defective or Damaged Product' },
  { value: 'WRONG_ITEM_OR_SIZE', label: 'Wrong Item or Size Received' },
  { value: 'SIZE_FIT_ISSUE', label: 'Size / Fit Issue (Too small / Too big)' },
  { value: 'NOT_AS_DESCRIBED', label: 'Item Not as Pictured or Described' },
  { value: 'QUALITY_NOT_EXPECTED', label: 'Quality Below Expectation' },
  { value: 'ARRIVED_LATE', label: 'Item Arrived Too Late' },
  { value: 'OTHER', label: 'Other Reason' }
];

export default function ReturnExchangeModal({ isOpen, onClose, order, onReturnCreated }) {
  const [requestType, setRequestType] = useState('RETURN'); // 'RETURN' | 'EXCHANGE'
  
  // Selected item IDs mapped to { selected: boolean, quantity: number }
  const [selectedItems, setSelectedItems] = useState(() => {
    const initial = {};
    if (order?.items) {
      order.items.forEach((it, idx) => {
        initial[idx] = {
          selected: true,
          quantity: it.quantity || 1,
          productId: it.productId,
          name: it.name,
          image: it.image,
          price: it.price
        };
      });
    }
    return initial;
  });

  const [reasonCategory, setReasonCategory] = useState('DEFECTIVE_DAMAGED');
  const [reasonDetails, setReasonDetails] = useState('');
  
  // Exchange preference
  const [exchangeType, setExchangeType] = useState('REPLACEMENT_PIECE');
  const [desiredSize, setDesiredSize] = useState('');
  const [desiredColor, setDesiredColor] = useState('');
  const [exchangeNotes, setExchangeNotes] = useState('');

  // Refund preference
  const [refundPreference, setRefundPreference] = useState('WALLET');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen || !order || !order.items || order.items.length === 0) return null;

  const toggleItem = (idx) => {
    setSelectedItems(prev => ({
      ...prev,
      [idx]: {
        ...prev[idx],
        selected: !prev[idx]?.selected
      }
    }));
  };

  const updateQuantity = (idx, newQty) => {
    const max = order.items[idx]?.quantity || 1;
    const clamped = Math.max(1, Math.min(newQty, max));
    setSelectedItems(prev => ({
      ...prev,
      [idx]: {
        ...prev[idx],
        quantity: clamped
      }
    }));
  };

  // Calculate items and total refund
  const activeItems = Object.keys(selectedItems)
    .filter(k => selectedItems[k]?.selected)
    .map(k => ({
      productId: selectedItems[k].productId,
      name: selectedItems[k].name,
      image: selectedItems[k].image,
      quantity: selectedItems[k].quantity,
      price: selectedItems[k].price,
      reason: reasonCategory
    }));

  const estimatedRefund = activeItems.reduce((acc, it) => acc + (it.price * it.quantity), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (activeItems.length === 0) {
      setErrorMsg('Please select at least one item to return or exchange.');
      return;
    }

    if (requestType === 'EXCHANGE' && exchangeType === 'DIFFERENT_SIZE' && !desiredSize.trim()) {
      setErrorMsg('Please specify your desired replacement size.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload = {
        orderId: order._id,
        type: requestType,
        items: activeItems,
        reasonCategory,
        reasonDetails: reasonDetails.trim(),
        exchangePreference: requestType === 'EXCHANGE' ? {
          exchangeType,
          desiredSize: desiredSize.trim(),
          desiredColor: desiredColor.trim(),
          notes: exchangeNotes.trim()
        } : {},
        refundPreference,
        pickupAddress: {
          fullName: order.deliveryAddress?.fullName || 'Customer',
          phone: order.deliveryAddress?.phone || '',
          street: order.deliveryAddress?.street || '',
          city: order.deliveryAddress?.city || '',
          state: order.deliveryAddress?.state || '',
          postalCode: order.deliveryAddress?.postalCode || ''
        }
      };

      const { data } = await api.post('/returns/request', payload);

      if (data.success) {
        setSuccessMsg(data.message || 'Return request submitted successfully!');
        setTimeout(() => {
          if (onReturnCreated) {
            onReturnCreated(data.returnRequest);
          }
          onClose();
        }, 1600);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to submit return request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.78)',
      backdropFilter: 'blur(6px)',
      zIndex: 9999,
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
        maxWidth: '560px',
        maxHeight: '92vh',
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
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: requestType === 'RETURN' ? '#EF4444' : '#3B82F6',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem'
            }}>
              <i className={requestType === 'RETURN' ? "fa-solid fa-rotate-left" : "fa-solid fa-arrows-rotate"}></i>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: '800', color: '#FFFFFF' }}>
                {requestType === 'RETURN' ? 'Return Item for Refund' : 'Exchange Item for Replacement'}
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                Order #{order.orderNumber} &bull; 7-Day Window Active
              </span>
            </div>
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

        {/* Tab Switcher: Return vs Exchange */}
        <div style={{
          display: 'flex',
          background: '#F1F5F9',
          padding: '6px',
          borderBottom: '1px solid #E2E8F0',
          gap: '6px',
          flexShrink: 0
        }}>
          <button
            type="button"
            onClick={() => { setRequestType('RETURN'); setErrorMsg(''); }}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              background: requestType === 'RETURN' ? '#FFFFFF' : 'transparent',
              color: requestType === 'RETURN' ? '#0F172A' : '#64748B',
              fontWeight: requestType === 'RETURN' ? '800' : '600',
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: requestType === 'RETURN' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            <i className="fa-solid fa-rotate-left" style={{ color: requestType === 'RETURN' ? '#EF4444' : 'inherit' }}></i>
            Return for 100% Refund
          </button>

          <button
            type="button"
            onClick={() => { setRequestType('EXCHANGE'); setErrorMsg(''); }}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              background: requestType === 'EXCHANGE' ? '#FFFFFF' : 'transparent',
              color: requestType === 'EXCHANGE' ? '#0F172A' : '#64748B',
              fontWeight: requestType === 'EXCHANGE' ? '800' : '600',
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: requestType === 'EXCHANGE' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            <i className="fa-solid fa-arrows-rotate" style={{ color: requestType === 'EXCHANGE' ? '#2563EB' : 'inherit' }}></i>
            Exchange for Replacement
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1 }}>

          {/* Alerts */}
          {errorMsg && (
            <div style={{
              background: '#FEE2E2',
              color: '#991B1B',
              border: '1px solid #F87171',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <i className="fa-solid fa-triangle-exclamation"></i>
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div style={{
              background: '#DCFCE7',
              color: '#166534',
              border: '1px solid #86EFAC',
              padding: '14px',
              borderRadius: '10px',
              fontSize: '0.88rem',
              fontWeight: '700',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}>
              <i className="fa-solid fa-circle-check" style={{ color: '#16A34A', fontSize: '1.2rem', marginTop: '2px' }}></i>
              <div>{successMsg}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Step 1: Select Items */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#0F172A', marginBottom: '8px' }}>
                1. Select Item(s) to {requestType === 'RETURN' ? 'Return' : 'Exchange'}:
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {order.items.map((it, idx) => {
                  const state = selectedItems[idx] || {};
                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: state.selected ? '1.5px solid #2563EB' : '1px solid #E2E8F0',
                        background: state.selected ? '#F8FAFC' : '#FFFFFF',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div
                        onClick={() => toggleItem(idx)}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, cursor: 'pointer' }}
                      >
                        <input
                          type="checkbox"
                          checked={!!state.selected}
                          onChange={() => toggleItem(idx)}
                          style={{ width: '18px', height: '18px', accentColor: '#2563EB', cursor: 'pointer' }}
                        />
                        <img
                          src={it.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=100&q=80'}
                          alt={it.name}
                          style={{ width: '42px', height: '42px', objectFit: 'contain', borderRadius: '6px', border: '1px solid #E2E8F0' }}
                        />
                        <div>
                          <div style={{ fontSize: '0.84rem', fontWeight: '700', color: '#0F172A' }}>{it.name}</div>
                          <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
                            Unit Price: <b>{formatINR(it.price)}</b> &bull; Ordered: {it.quantity}
                          </div>
                        </div>
                      </div>

                      {state.selected && it.quantity > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Qty:</span>
                          <select
                            value={state.quantity}
                            onChange={(e) => updateQuantity(idx, Number(e.target.value))}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              fontSize: '0.8rem',
                              fontWeight: '700'
                            }}
                          >
                            {Array.from({ length: it.quantity }, (_, i) => i + 1).map(q => (
                              <option key={q} value={q}>{q}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Reason for Return/Exchange */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#0F172A', marginBottom: '6px' }}>
                2. Reason for {requestType === 'RETURN' ? 'Return' : 'Exchange'}:
              </label>
              <select
                value={reasonCategory}
                onChange={(e) => setReasonCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.88rem',
                  fontWeight: '600',
                  color: '#0F172A',
                  background: '#FFFFFF',
                  marginBottom: '8px'
                }}
              >
                {REASONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>

              <textarea
                rows={2}
                value={reasonDetails}
                onChange={(e) => setReasonDetails(e.target.value)}
                placeholder="Additional details (e.g. Left shoe sole stitch damaged, color shade mismatch)"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.82rem',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Step 3: Specific Configuration: Exchange vs Return */}
            {requestType === 'EXCHANGE' ? (
              <div style={{
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: '12px',
                padding: '14px'
              }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#1E3A8A', marginBottom: '8px' }}>
                  3. Exchange Preference:
                </label>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'REPLACEMENT_PIECE', label: 'Exact Replacement Piece' },
                    { id: 'DIFFERENT_SIZE', label: 'Different Size' },
                    { id: 'DIFFERENT_COLOR', label: 'Different Color' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setExchangeType(opt.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        border: exchangeType === opt.id ? '2px solid #2563EB' : '1px solid #CBD5E1',
                        background: exchangeType === opt.id ? '#2563EB' : '#FFFFFF',
                        color: exchangeType === opt.id ? '#FFFFFF' : '#1E293B',
                        fontSize: '0.78rem',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {exchangeType === 'DIFFERENT_SIZE' && (
                  <div style={{ marginTop: '8px' }}>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: '#1E3A8A', marginBottom: '4px' }}>
                      Desired Replacement Size: <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={desiredSize}
                      onChange={(e) => setDesiredSize(e.target.value)}
                      placeholder="e.g. XL, 42, UK 9, 34W"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.84rem',
                        background: '#FFFFFF',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                )}

                {exchangeType === 'DIFFERENT_COLOR' && (
                  <div style={{ marginTop: '8px' }}>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: '#1E3A8A', marginBottom: '4px' }}>
                      Desired Color Preference:
                    </label>
                    <input
                      type="text"
                      value={desiredColor}
                      onChange={(e) => setDesiredColor(e.target.value)}
                      placeholder="e.g. Navy Blue, Matte Black"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.84rem',
                        background: '#FFFFFF',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '12px',
                padding: '14px'
              }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#991B1B', marginBottom: '8px' }}>
                  3. Refund Destination:
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: refundPreference === 'WALLET' ? '#FFFFFF' : 'transparent',
                    border: refundPreference === 'WALLET' ? '2px solid #DC2626' : '1px solid transparent',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="refundDest"
                      value="WALLET"
                      checked={refundPreference === 'WALLET'}
                      onChange={() => setRefundPreference('WALLET')}
                      style={{ accentColor: '#DC2626' }}
                    />
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: '800', color: '#0F172A' }}>
                        ⚡ NovaKart Store Wallet (Instant Credit)
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                        Refund credited immediately upon doorstep parcel pickup. Ready to use on your next order!
                      </div>
                    </div>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: refundPreference === 'ORIGINAL_PAYMENT' ? '#FFFFFF' : 'transparent',
                    border: refundPreference === 'ORIGINAL_PAYMENT' ? '2px solid #DC2626' : '1px solid transparent',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="refundDest"
                      value="ORIGINAL_PAYMENT"
                      checked={refundPreference === 'ORIGINAL_PAYMENT'}
                      onChange={() => setRefundPreference('ORIGINAL_PAYMENT')}
                      style={{ accentColor: '#DC2626' }}
                    />
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: '800', color: '#0F172A' }}>
                        🏦 Original Payment Method ({order.paymentMethod || 'UPI/Card'})
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                        Processed within 3-5 business days after pickup inspection.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Step 4: Doorstep Pickup Verification */}
            <div style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '12px 14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#0F172A' }}>
                  <i className="fa-solid fa-truck-pickup" style={{ color: '#10B981', marginRight: '6px' }}></i>
                  Free Doorstep Courier Pickup Address:
                </span>
                <span style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: '800' }}>
                  FREE PICKUP
                </span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#334155' }}>
                👤 {order.deliveryAddress?.fullName} ({order.deliveryAddress?.phone})<br />
                📍 {order.deliveryAddress?.street}, {order.deliveryAddress?.city}, {order.deliveryAddress?.postalCode}
              </div>
            </div>

            {/* Estimated Total / Summary */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 14px',
              background: '#0F172A',
              color: '#FFFFFF',
              borderRadius: '10px'
            }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: '700' }}>
                  {requestType === 'RETURN' ? 'Estimated Total Refund' : 'Exchange Fee'}
                </span>
                <div style={{ fontSize: '1.15rem', fontWeight: '900', color: requestType === 'RETURN' ? '#6EE7B7' : '#FFFFFF' }}>
                  {requestType === 'RETURN' ? formatINR(estimatedRefund) : '₹0 (Free Swap)'}
                </div>
              </div>

              <div style={{ textAlign: 'right', fontSize: '0.74rem', color: '#94A3B8' }}>
                {activeItems.length} Item(s) Selected
              </div>
            </div>

            {/* Submit Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#475569',
                  fontWeight: '700',
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting || activeItems.length === 0}
                style={{
                  flex: 2,
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: requestType === 'RETURN'
                    ? 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)'
                    : 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                  color: '#FFFFFF',
                  fontWeight: '900',
                  fontSize: '0.92rem',
                  cursor: submitting || activeItems.length === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)'
                }}
              >
                {submitting ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Submitting...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane"></i> Submit {requestType === 'RETURN' ? 'Return' : 'Exchange'} Request
                  </>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
