import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { formatINR } from '../services/api';
import OrderStepper from '../components/OrderStepper';
import CustomerInvoiceModal, { formatDateTimeWithSeconds } from '../components/CustomerInvoiceModal';
import DeliveredOrderReviewModal from '../components/DeliveredOrderReviewModal';
import ReturnExchangeModal from '../components/ReturnExchangeModal';
import ReturnPolicyModal from '../components/ReturnPolicyModal';
import ReturnTrackingModal from '../components/ReturnTrackingModal';
import CustomerLiveMapTracker from '../components/CustomerLiveMapTracker';
import { useSocket } from '../context/SocketContext';

const RETURN_WINDOW_DAYS = 7;

export default function OrderTrackingPage() {
  const { id } = useParams();
  const { liveAlerts } = useSocket();
  const [order, setOrder] = useState(null);
  const [returnRequest, setReturnRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeOtpNotice, setActiveOtpNotice] = useState(null);

  // Modals state
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [showReturnTrackingModal, setShowReturnTrackingModal] = useState(false);

  const fetchOrderData = () => {
    Promise.allSettled([
      api.get(`/orders/${id}`),
      api.get(`/returns/order/${id}`)
    ]).then(([orderRes, returnRes]) => {
      if (orderRes.status === 'fulfilled') {
        setOrder(orderRes.value.data.order);
      }
      if (returnRes.status === 'fulfilled') {
        setReturnRequest(returnRes.value.data.returnRequest || null);
      }
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrderData();
  }, [id]);

  // Refresh and show high-priority alerts if socket event received for this order
  useEffect(() => {
    const matchingAlert = liveAlerts.find(a => (a.orderId === id || a.orderId === order?._id));
    if (matchingAlert) {
      if (matchingAlert.type === 'DELIVERY_OTP') {
        setActiveOtpNotice({
          type: 'DELIVERY_OTP',
          text: `🔐 Fresh Delivery PIN received: ${matchingAlert.otp}. Please share with your delivery rider.`
        });
      } else if (matchingAlert.type === 'RETURN_OTP') {
        setActiveOtpNotice({
          type: 'RETURN_OTP',
          text: `🔄 Doorstep Return Requested! Your Return PIN is: ${matchingAlert.returnOtp}. Share with rider to authorize product return.`
        });
      } else if (matchingAlert.type === 'DELIVERY_FAILED') {
        setActiveOtpNotice({
          type: 'DELIVERY_FAILED',
          text: `⚠️ Delivery Attempt Missed: The rider attempted to reach you but could not establish contact.`
        });
      }
      fetchOrderData();
    }
  }, [liveAlerts, id]);

  if (loading) return <div className="container section-padding"><p>Connecting to live order tracker...</p></div>;
  if (!order) return <div className="container section-padding"><h3>Order not found.</h3></div>;

  const isDelivered = order.orderStatus === 'DELIVERED' || order.orderStatus === 'COMPLETED';

  // Calculate return window
  const deliveryDate = order.proofOfDelivery?.verifiedAt || order.updatedAt || order.createdAt;
  const diffDays = (Date.now() - new Date(deliveryDate).getTime()) / (1000 * 60 * 60 * 24);
  const isReturnEligible = isDelivered && diffDays <= RETURN_WINDOW_DAYS && (!returnRequest || returnRequest.status === 'CANCELLED');
  const daysRemaining = Math.max(0, Math.ceil(RETURN_WINDOW_DAYS - diffDays));

  const getFormattedExpectedDeliveryDate = (createdAtStr) => {
    const d = new Date(createdAtStr || Date.now());
    d.setDate(d.getDate() + 2);
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }) + ' by 9:00 PM';
  };

  return (
    <main className="container section-padding">
      <div style={{ background: '#fff', border: '1px solid #E7E7E7', borderRadius: '16px', padding: '26px', marginBottom: '30px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
        
        {/* Header Summary */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '16px', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link to="/orders" style={{ fontSize: '0.8rem', color: '#2563EB', textDecoration: 'none', fontWeight: '700' }}>
                &larr; Back to Orders
              </Link>
              <span style={{ color: '#CBD5E1' }}>&bull;</span>
              <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: '800' }}>LIVE TRACKING</span>
            </div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: '900', color: 'var(--primary-color)', margin: '4px 0 6px 0' }}>
              Order #{order.orderNumber}
            </h2>
            <div style={{ fontSize: '0.82rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa-regular fa-clock" style={{ color: '#2563EB' }}></i>
              <span>Placed: <strong>{formatDateTimeWithSeconds(order.createdAt)}</strong></span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{
              background: isDelivered ? '#DCFCE7' : '#e7f4e8',
              color: isDelivered ? '#166534' : '#2e7d32',
              padding: '8px 16px',
              borderRadius: '20px',
              fontWeight: '800',
              fontSize: '0.88rem',
              textTransform: 'uppercase',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <i className={isDelivered ? "fa-solid fa-circle-check" : "fa-solid fa-satellite-dish"} style={{ color: isDelivered ? '#16A34A' : '#FF9900' }}></i>
              {order.orderStatus.replace(/_/g, ' ')}
            </span>

            <button
              onClick={() => setShowInvoiceModal(true)}
              style={{
                background: '#0F172A',
                color: '#FFFFFF',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(15, 23, 42, 0.15)'
              }}
            >
              <i className="fa-solid fa-file-invoice" style={{ color: '#10B981' }}></i> Official Tax Invoice
            </button>
          </div>
        </div>

        {/* Expected Delivery Banner */}
        <div style={{
          marginTop: '16px',
          background: isDelivered ? '#F0FDF4' : '#F0F9FF',
          border: isDelivered ? '1.5px solid #86EFAC' : '1.5px solid #7DD3FC',
          borderRadius: '12px',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: isDelivered ? '#16A34A' : '#0284C7',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              flexShrink: 0
            }}>
              <i className={isDelivered ? "fa-solid fa-calendar-check" : "fa-solid fa-truck-ramp-box"}></i>
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: '800', color: isDelivered ? '#166534' : '#0369A1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {isDelivered ? 'Delivered On' : 'Expected Delivery Date'}
              </span>
              <div style={{ fontSize: '1.05rem', fontWeight: '900', color: isDelivered ? '#14532D' : '#0C4A6E', marginTop: '1px' }}>
                {isDelivered
                  ? formatDateTimeWithSeconds(deliveryDate)
                  : getFormattedExpectedDeliveryDate(order.createdAt)}
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.78rem', color: isDelivered ? '#15803D' : '#0284C7', fontWeight: '800' }}>
            {isDelivered ? '✅ Verified Delivery Completed' : '⚡ Guaranteed On-Time Express Dispatch'}
          </div>
        </div>


        {/* Real-Time Live Notification Flash Alert */}
        {activeOtpNotice && (
          <div style={{
            marginTop: '16px',
            padding: '12px 18px',
            borderRadius: '10px',
            background: activeOtpNotice.type === 'RETURN_OTP'
              ? '#FEF2F2'
              : activeOtpNotice.type === 'DELIVERY_FAILED'
                ? '#FFFBEB'
                : '#EFF6FF',
            border: activeOtpNotice.type === 'RETURN_OTP'
              ? '1.5px solid #F87171'
              : activeOtpNotice.type === 'DELIVERY_FAILED'
                ? '1.5px solid #F59E0B'
                : '1.5px solid #60A5FA',
            color: activeOtpNotice.type === 'RETURN_OTP'
              ? '#991B1B'
              : activeOtpNotice.type === 'DELIVERY_FAILED'
                ? '#92400E'
                : '#1E40AF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 14px rgba(0,0,0,0.06)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem', fontWeight: '800' }}>
              <i className={
                activeOtpNotice.type === 'RETURN_OTP'
                  ? 'fa-solid fa-rotate-left'
                  : activeOtpNotice.type === 'DELIVERY_FAILED'
                    ? 'fa-solid fa-triangle-exclamation'
                    : 'fa-solid fa-key'
              }></i>
              <span>{activeOtpNotice.text}</span>
            </div>
            <button
              onClick={() => setActiveOtpNotice(null)}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.1rem' }}
            >
              &times;
            </button>
          </div>
        )}

        {/* ─── POST-DELIVERY BANNER & ACTIONS (If DELIVERED) ─── */}
        {isDelivered && (
          <div style={{
            background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
            border: '1px solid #86EFAC',
            borderRadius: '12px',
            padding: '16px 20px',
            marginTop: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: '#16A34A',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.3rem',
                flexShrink: 0
              }}>
                <i className="fa-solid fa-box-check"></i>
              </div>
              <div>
                <h4 style={{ margin: '0 0 2px 0', fontSize: '1rem', fontWeight: '900', color: '#14532D' }}>
                  Package Delivered to Recipient
                </h4>
                <div style={{ fontSize: '0.78rem', color: '#166534' }}>
                  Verified delivery &bull; 7-Day Free Return &amp; Exchange guarantee active ({daysRemaining} days left)
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setShowReviewModal(true)}
                style={{
                  background: '#F59E0B',
                  color: '#0F172A',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '0.84rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)'
                }}
              >
                <i className="fa-solid fa-star"></i> Write Product Review
              </button>

              {isReturnEligible && (
                <button
                  type="button"
                  onClick={() => setShowReturnModal(true)}
                  style={{
                    background: '#FFFFFF',
                    color: '#0F172A',
                    border: '1px solid #CBD5E1',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '0.84rem',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-rotate-left" style={{ color: '#EF4444' }}></i> Return / Exchange
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowPolicyModal(true)}
                style={{
                  background: 'rgba(255, 255, 255, 0.7)',
                  color: '#166534',
                  border: '1px solid #86EFAC',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                <i className="fa-solid fa-shield-halved"></i> Policy
              </button>
            </div>
          </div>
        )}

        {/* ─── ACTIVE RETURN/EXCHANGE STATUS CARD (If Requested) ─── */}
        {returnRequest && returnRequest.status !== 'CANCELLED' && (
          <div style={{
            background: '#F8FAFC',
            border: returnRequest.type === 'RETURN' ? '1px solid #FCA5A5' : '1px solid #93C5FD',
            borderRadius: '12px',
            padding: '16px 20px',
            marginTop: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: returnRequest.type === 'RETURN' ? '#EF4444' : '#2563EB',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem'
                }}>
                  <i className={returnRequest.type === 'RETURN' ? "fa-solid fa-rotate-left" : "fa-solid fa-arrows-rotate"}></i>
                </div>
                <div>
                  <h4 style={{ margin: '0 0 2px 0', fontSize: '0.96rem', fontWeight: '800', color: '#0F172A' }}>
                    {returnRequest.type === 'RETURN' ? 'Return & Refund in Progress' : 'Exchange Replacement in Progress'}
                  </h4>
                  <div style={{ fontSize: '0.76rem', color: '#64748B' }}>
                    Status: <b>{returnRequest.status.replace(/_/g, ' ')}</b> &bull; Doorstep Pickup: {returnRequest.scheduledPickupDate ? new Date(returnRequest.scheduledPickupDate).toLocaleDateString('en-IN') : 'Scheduled'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowReturnTrackingModal(true)}
                style={{
                  background: '#0F172A',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Track Return Stepper &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Doorstep Return Authorization PIN Card for Customer */}
        {order.returnOtp && order.orderStatus !== 'DELIVERED' && order.orderStatus !== 'DOORSTEP_RETURNED' && (
          <div style={{
            background: 'linear-gradient(135deg, #7F1D1D 0%, #991B1B 100%)',
            borderRadius: '14px',
            padding: '16px 20px',
            marginTop: '20px',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: '0 10px 25px -5px rgba(185, 28, 28, 0.4)',
            border: '2px solid #F87171'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                color: '#FEF08A'
              }}>
                <i className="fa-solid fa-rotate-left"></i>
              </div>
              <div>
                <div style={{ fontSize: '0.74rem', color: '#FCA5A5', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Doorstep Return Authorization PIN
                </div>
                <h4 style={{ margin: '2px 0 0 0', fontSize: '1.05rem', fontWeight: '900', color: '#FFFFFF' }}>
                  Return Verification OTP
                </h4>
                <div style={{ fontSize: '0.78rem', color: '#FEE2E2', marginTop: '2px' }}>
                  Share this 4-digit PIN with your delivery rider to authorize product return at doorstep
                </div>
                {order.doorstepReturnReason && (
                  <div style={{ fontSize: '0.72rem', color: '#FCA5A5', marginTop: '4px' }}>
                    Reason: <em>{order.doorstepReturnReason}</em>
                  </div>
                )}
              </div>
            </div>

            <div style={{
              background: '#FFFFFF',
              color: '#991B1B',
              padding: '8px 20px',
              borderRadius: '12px',
              textAlign: 'center',
              border: '2px dashed #DC2626',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
            }}>
              <div style={{ fontSize: '0.66rem', fontWeight: '800', color: '#B91C1C', textTransform: 'uppercase' }}>RETURN PIN</div>
              <div style={{ fontSize: '1.8rem', fontWeight: '900', letterSpacing: '4px', fontFamily: 'monospace' }}>
                {order.returnOtp}
              </div>
            </div>
          </div>
        )}

        {/* Doorstep Returned Confirmed Card */}
        {order.orderStatus === 'DOORSTEP_RETURNED' && (
          <div style={{
            background: 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)',
            border: '1.5px solid #F87171',
            borderRadius: '14px',
            padding: '16px 20px',
            marginTop: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: '#EF4444',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.3rem',
              flexShrink: 0
            }}>
              <i className="fa-solid fa-box-open"></i>
            </div>
            <div>
              <h4 style={{ margin: '0 0 2px 0', fontSize: '1rem', fontWeight: '900', color: '#991B1B' }}>
                Product Returned at Doorstep
              </h4>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#7F1D1D' }}>
                Your parcel was returned to the delivery agent via verified Return PIN. It has been staged for return to our fulfillment hub for quality inspection and refund processing.
              </p>
            </div>
          </div>
        )}

        {/* Delivery Attempt Missed (Customer Unreachable) Card */}
        {order.orderStatus === 'UNDELIVERED' && (
          <div style={{
            background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
            border: '1.5px solid #F59E0B',
            borderRadius: '14px',
            padding: '16px 20px',
            marginTop: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: '#F59E0B',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.3rem',
                flexShrink: 0
              }}>
                <i className="fa-solid fa-phone-slash"></i>
              </div>
              <div>
                <h4 style={{ margin: '0 0 2px 0', fontSize: '1rem', fontWeight: '900', color: '#92400E' }}>
                  Delivery Attempt Missed (Customer Unreachable)
                </h4>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#78350F' }}>
                  The delivery agent was unable to contact you at the delivery location. The package is returning to the warehouse hub.
                </p>
                {order.deliveryAttempts && order.deliveryAttempts.length > 0 && (
                  <div style={{ fontSize: '0.72rem', color: '#B45309', marginTop: '4px' }}>
                    Attempt Note: {order.deliveryAttempts[order.deliveryAttempts.length - 1].reason} &bull; {order.deliveryAttempts[order.deliveryAttempts.length - 1].riderNotes}
                  </div>
                )}
              </div>
            </div>

            <a
              href="tel:+919876543210"
              style={{
                background: '#0F172A',
                color: '#FFFFFF',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: '700',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <i className="fa-solid fa-headset"></i> Contact Support
            </a>
          </div>
        )}

        {/* Mandatory Prepaid Delivery OTP (PIN) Card for Customer */}
        {!isDelivered && order.orderStatus !== 'DOORSTEP_RETURNED' && order.orderStatus !== 'UNDELIVERED' && (order.paymentMethod !== 'Cash on Delivery (COD)' && order.paymentMethod !== 'COD') && (
          <div style={{
            background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
            borderRadius: '14px',
            padding: '16px 20px',
            marginTop: '20px',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: '0 10px 25px -5px rgba(49, 46, 129, 0.4)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                color: '#6EE7B7'
              }}>
                <i className="fa-solid fa-key"></i>
              </div>
              <div>
                <div style={{ fontSize: '0.74rem', color: '#A5B4FC', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Mandatory Handover Security
                </div>
                <h4 style={{ margin: '2px 0 0 0', fontSize: '1rem', fontWeight: '900', color: '#FFFFFF' }}>
                  Prepaid Delivery OTP (PIN)
                </h4>
                <div style={{ fontSize: '0.78rem', color: '#C7D2FE', marginTop: '2px' }}>
                  Share this 4-digit PIN with your delivery agent upon parcel arrival
                </div>
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.95)',
              color: '#1E1B4B',
              padding: '8px 18px',
              borderRadius: '12px',
              textAlign: 'center',
              border: '2px dashed #6366F1'
            }}>
              <div style={{ fontSize: '0.66rem', fontWeight: '800', color: '#4338CA', textTransform: 'uppercase' }}>Delivery PIN</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '900', letterSpacing: '4px', fontFamily: 'monospace' }}>
                {order.deliveryOtp || '1234'}
              </div>
            </div>
          </div>
        )}

        {/* Visual 8-Stage Delivery Stepper */}
        <div style={{ marginTop: '20px' }}>
          <OrderStepper currentStatus={order.orderStatus} />
        </div>

        {/* Live Rapido/Google Maps Style Interactive Order Navigation Tracker */}
        <CustomerLiveMapTracker order={order} />

        {/* Delivery Details & Agent Box */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginTop: '30px', background: '#fafafa', padding: '20px', borderRadius: '12px' }}>
          
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '8px', color: 'var(--primary-color)' }}>
              <i className="fa-solid fa-store" style={{ color: 'var(--accent-color)' }}></i> Store &amp; Fulfillment
            </h4>
            <p style={{ fontSize: '0.88rem', fontWeight: '600', margin: '0 0 2px 0' }}>{order.sellerId?.storeName || 'NovaKart Central Store'}</p>
            <p style={{ fontSize: '0.8rem', color: '#666', margin: 0 }}>{order.sellerId?.businessAddress || 'Delhi Fulfillment Center'}</p>
          </div>

          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '8px', color: 'var(--primary-color)' }}>
              <i className="fa-solid fa-location-dot" style={{ color: '#CC0C39' }}></i> Delivery Destination
            </h4>
            <p style={{ fontSize: '0.88rem', fontWeight: '600', margin: '0 0 2px 0' }}>{order.deliveryAddress?.fullName} ({order.deliveryAddress?.phone})</p>
            <p style={{ fontSize: '0.8rem', color: '#666', margin: 0 }}>{order.deliveryAddress?.street}, {order.deliveryAddress?.city}, {order.deliveryAddress?.postalCode}</p>
          </div>

          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '8px', color: 'var(--primary-color)' }}>
              <i className="fa-solid fa-motorcycle" style={{ color: '#2e7d32' }}></i> Assigned Delivery Agent
            </h4>
            {order.deliveryAgentId ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#FFFFFF', padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                {(order.deliveryAgentId.faceVerificationPhoto || order.deliveryAgentId.profileImage) ? (
                  <img
                    src={order.deliveryAgentId.faceVerificationPhoto || order.deliveryAgentId.profileImage}
                    alt={order.deliveryAgentId.fullName}
                    style={{ width: '46px', height: '46px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #10B981' }}
                  />
                ) : (
                  <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: '#2563EB', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '1.2rem' }}>
                    {(order.deliveryAgentId.fullName || 'R').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: '0.92rem', fontWeight: '800', color: '#0F172A' }}>{order.deliveryAgentId.fullName}</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748B', margin: '2px 0 4px 0' }}>
                    🛵 {order.deliveryAgentId.vehicleType || 'Bike'} &bull; <span style={{ fontFamily: 'monospace', fontWeight: '800', color: '#854D0E', background: '#FEF08A', padding: '1px 4px', borderRadius: '3px' }}>{order.deliveryAgentId.vehicleNumber || 'AP 39 BK 8204'}</span>
                  </div>
                  {order.deliveryAgentId.phone && (
                    <a href={`tel:${order.deliveryAgentId.phone}`} style={{ fontSize: '0.75rem', background: '#10B981', color: '#fff', padding: '3px 10px', borderRadius: '6px', textDecoration: 'none', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <i className="fa-solid fa-phone"></i> Call Rider ({order.deliveryAgentId.phone})
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '0.82rem', color: '#D97706', fontStyle: 'italic', margin: 0 }}>
                <i className="fa-solid fa-spinner fa-spin"></i> Nearby delivery agent dispatch in progress...
              </p>
            )}
          </div>
        </div>

        {/* Line Items */}
        <div style={{ marginTop: '30px' }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '14px', borderBottom: '1px solid #eee', paddingBottom: '8px', color: '#0F172A' }}>
            Ordered Items ({order.items?.length})
          </h4>
          {order.items?.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img
                  src={item.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=100&q=80'}
                  alt={item.name}
                  style={{ width: '44px', height: '44px', objectFit: 'contain', borderRadius: '6px', border: '1px solid #E2E8F0' }}
                />
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0F172A' }}>{item.name}</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748B' }}>Qty: {item.quantity} &bull; {formatINR(item.price)} each</div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <strong style={{ fontSize: '1rem', color: '#0F172A' }}>{formatINR(item.price * item.quantity)}</strong>
                {isDelivered && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowReviewModal(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        color: '#D97706',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      Rate &amp; Review
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: '900', marginTop: '20px', color: 'var(--primary-color)' }}>
            <span>Total Amount Paid ({order.paymentMethod}):</span>
            <span style={{ color: '#B12704' }}>{formatINR(order.totalAmount)}</span>
          </div>
        </div>

      </div>

      {/* ─── MODALS ─── */}

      {/* Official Tax Invoice Modal */}
      {showInvoiceModal && (
        <CustomerInvoiceModal
          order={order}
          onClose={() => setShowInvoiceModal(false)}
        />
      )}

      {/* Delivered Order Review Modal */}
      {showReviewModal && (
        <DeliveredOrderReviewModal
          isOpen={showReviewModal}
          order={order}
          onClose={() => setShowReviewModal(false)}
          onReviewSubmitted={() => fetchOrderData()}
        />
      )}

      {/* Return & Exchange Modal */}
      {showReturnModal && (
        <ReturnExchangeModal
          isOpen={showReturnModal}
          order={order}
          onClose={() => setShowReturnModal(false)}
          onReturnCreated={() => fetchOrderData()}
        />
      )}

      {/* 7-Day Return Policy Modal */}
      <ReturnPolicyModal
        isOpen={showPolicyModal}
        onClose={() => setShowPolicyModal(false)}
      />

      {/* Return Tracking Modal */}
      {showReturnTrackingModal && returnRequest && (
        <ReturnTrackingModal
          isOpen={showReturnTrackingModal}
          returnRequest={returnRequest}
          onClose={() => setShowReturnTrackingModal(false)}
          onCancelled={() => fetchOrderData()}
        />
      )}
    </main>
  );
}
