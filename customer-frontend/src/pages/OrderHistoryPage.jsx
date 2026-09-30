import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { formatINR } from '../services/api';
import CustomerInvoiceModal, { formatDateTimeWithSeconds } from '../components/CustomerInvoiceModal';
import DeliveredOrderReviewModal from '../components/DeliveredOrderReviewModal';
import ReturnExchangeModal from '../components/ReturnExchangeModal';
import ReturnPolicyModal from '../components/ReturnPolicyModal';
import ReturnTrackingModal from '../components/ReturnTrackingModal';

const RETURN_WINDOW_DAYS = 7;

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState([]);
  const [myReviews, setMyReviews] = useState([]);
  const [myReturns, setMyReturns] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState(null);
  const [selectedReviewOrder, setSelectedReviewOrder] = useState(null);
  const [selectedReviewItemIndex, setSelectedReviewItemIndex] = useState(0);
  const [selectedReturnOrder, setSelectedReturnOrder] = useState(null);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [selectedTrackingReturn, setSelectedTrackingReturn] = useState(null);

  const fetchHistoryData = () => {
    setLoading(true);
    Promise.allSettled([
      api.get('/orders/my-orders'),
      api.get('/reviews/my-reviews'),
      api.get('/returns/my-returns')
    ]).then(([ordersRes, reviewsRes, returnsRes]) => {
      if (ordersRes.status === 'fulfilled') {
        setOrders(ordersRes.value.data.orders || []);
      }
      if (reviewsRes.status === 'fulfilled') {
        setMyReviews(reviewsRes.value.data.reviews || []);
      }
      if (returnsRes.status === 'fulfilled') {
        setMyReturns(returnsRes.value.data.returns || []);
      }
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHistoryData();
  }, []);

  // Helper to check if an order is within the 7-day return window
  const getReturnWindowInfo = (order) => {
    if (order.orderStatus !== 'DELIVERED' && order.orderStatus !== 'COMPLETED') {
      return { isEligible: false, daysRemaining: 0 };
    }
    const deliveryDate = order.proofOfDelivery?.verifiedAt || order.updatedAt || order.createdAt;
    const diffMs = Date.now() - new Date(deliveryDate).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const daysRemaining = Math.max(0, Math.ceil(RETURN_WINDOW_DAYS - diffDays));
    return {
      isEligible: diffDays <= RETURN_WINDOW_DAYS,
      daysRemaining,
      deliveryDate: new Date(deliveryDate)
    };
  };

  // Helper to find return for an order
  const getOrderReturn = (orderId) => {
    return myReturns.find(r => (r.orderId?._id || r.orderId) === orderId && r.status !== 'CANCELLED');
  };

  // Helper to check if order has reviews
  const getOrderReviews = (orderId) => {
    return myReviews.filter(r => (r.orderId?._id || r.orderId) === orderId);
  };

  return (
    <main className="container section-padding">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--primary-color)', margin: '0 0 4px 0' }}>
            <i className="fa-solid fa-clock-rotate-left" style={{ color: 'var(--accent-color)' }}></i> My Order History
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748B' }}>
            Track parcels, rate delivered items, and manage 7-day returns &amp; exchanges.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowPolicyModal(true)}
            style={{
              background: '#F1F5F9',
              color: '#0F172A',
              border: '1px solid #CBD5E1',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className="fa-solid fa-shield-halved" style={{ color: '#10B981' }}></i> 7-Day Return Policy
          </button>

          <Link to="/products" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
            Browse Catalog
          </Link>
        </div>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: '40px' }}>Loading order history and delivery statuses...</p>
      ) : orders.length === 0 ? (
        <div style={{ background: '#fff', padding: '50px 20px', textAlign: 'center', borderRadius: '12px', border: '1px solid #eee' }}>
          <i className="fa-solid fa-box-open" style={{ fontSize: '3.2rem', color: '#ccc', marginBottom: '14px' }}></i>
          <h3>No Orders Placed Yet</h3>
          <p style={{ color: '#777', marginBottom: '20px' }}>Shop top products from verified local sellers with fast nearby delivery.</p>
          <Link to="/products" className="btn btn-primary">Start Shopping</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {orders.map(order => {
            const isDelivered = order.orderStatus === 'DELIVERED' || order.orderStatus === 'COMPLETED';
            const { isEligible, daysRemaining } = getReturnWindowInfo(order);
            const activeReturn = getOrderReturn(order._id);
            const orderReviews = getOrderReviews(order._id);

            return (
              <div
                key={order._id}
                style={{
                  background: '#FFFFFF',
                  border: isDelivered ? '1px solid #CBD5E1' : '1px solid #E7E7E7',
                  borderRadius: '12px',
                  padding: '20px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                  transition: 'box-shadow 0.2s'
                }}
              >
                {/* 1. Header Information Row */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid #eee',
                  paddingBottom: '14px',
                  marginBottom: '14px',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div>
                    <span style={{ fontSize: '0.74rem', color: '#64748B', textTransform: 'uppercase', fontWeight: '800' }}>
                      ORDER NUMBER
                    </span>
                    <p style={{ fontWeight: '900', fontSize: '1.02rem', color: 'var(--primary-color)', fontFamily: 'monospace', margin: '2px 0 0 0' }}>
                      #{order.orderNumber}
                    </p>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.74rem', color: '#64748B', textTransform: 'uppercase', fontWeight: '800' }}>
                      DATE &amp; TIME
                    </span>
                    <p style={{ fontSize: '0.84rem', fontWeight: '700', color: '#0F172A', margin: '2px 0 0 0', fontFamily: 'monospace' }}>
                      <i className="fa-regular fa-clock" style={{ color: '#2563EB', marginRight: '5px' }}></i>
                      {formatDateTimeWithSeconds(order.createdAt)}
                    </p>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.74rem', color: '#64748B', textTransform: 'uppercase', fontWeight: '800' }}>
                      TOTAL AMOUNT
                    </span>
                    <p style={{ fontSize: '1.1rem', fontWeight: '900', color: '#B12704', margin: '2px 0 0 0' }}>
                      {formatINR(order.totalAmount)}
                    </p>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.74rem', color: '#64748B', textTransform: 'uppercase', fontWeight: '800' }}>
                      STATUS
                    </span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                      <span style={{
                        background: isDelivered ? '#DCFCE7' : '#EFF6FF',
                        color: isDelivered ? '#166534' : '#1E40AF',
                        padding: '3px 10px',
                        borderRadius: '20px',
                        fontWeight: '800',
                        fontSize: '0.74rem',
                        textTransform: 'uppercase',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {isDelivered && <i className="fa-solid fa-circle-check" style={{ color: '#16A34A' }}></i>}
                        {order.orderStatus.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Top Action Buttons: Invoice & Tracking */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setSelectedInvoiceOrder(order)}
                      style={{
                        background: '#0F172A',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontWeight: '700',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      title="View Official GST Invoice"
                    >
                      <i className="fa-solid fa-file-invoice" style={{ color: '#10B981' }}></i> Tax Invoice
                    </button>

                    <Link
                      to={`/orders/${order._id}/track`}
                      className="btn btn-primary"
                      style={{ padding: '8px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <i className="fa-solid fa-location-crosshairs"></i> Track Order
                    </Link>
                  </div>
                </div>

                {/* 2. Items List */}
                <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
                  {order.items.map((item, idx) => {
                    const reviewed = orderReviews.find(r => r.productId === item.productId || r.productId?._id === item.productId);
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          minWidth: '260px',
                          background: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          padding: '10px 14px',
                          borderRadius: '8px'
                        }}
                      >
                        <img
                          src={item.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=150&q=80'}
                          alt={item.name}
                          style={{ width: '46px', height: '46px', objectFit: 'contain', background: '#FFFFFF', borderRadius: '6px', padding: '2px' }}
                        />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0F172A', margin: 0 }}>
                            {item.name}
                          </p>
                          <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                            Qty: {item.quantity} &bull; {formatINR(item.price)}
                          </span>

                          {/* Quick review indicator per item if delivered */}
                          {isDelivered && (
                            <div style={{ marginTop: '4px' }}>
                              {reviewed ? (
                                <span style={{ fontSize: '0.7rem', color: '#D97706', fontWeight: '800' }}>
                                  ★ {reviewed.rating}/5 Reviewed
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedReviewOrder(order);
                                    setSelectedReviewItemIndex(idx);
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    fontSize: '0.72rem',
                                    fontWeight: '800',
                                    color: '#2563EB',
                                    cursor: 'pointer',
                                    textDecoration: 'underline'
                                  }}
                                >
                                  + Rate this item
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 3. POST-DELIVERY ACTIONS BAR (Only for DELIVERED / COMPLETED Orders) */}
                {isDelivered && (
                  <div style={{
                    marginTop: '14px',
                    paddingTop: '12px',
                    borderTop: '1px dashed #E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}>
                    {/* Left: Active Return/Exchange Badge or 7-Day Window indicator */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {activeReturn ? (
                        <button
                          type="button"
                          onClick={() => setSelectedTrackingReturn(activeReturn)}
                          style={{
                            background: activeReturn.type === 'RETURN' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                            border: activeReturn.type === 'RETURN' ? '1px solid #EF4444' : '1px solid #2563EB',
                            color: activeReturn.type === 'RETURN' ? '#DC2626' : '#1D4ED8',
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '0.78rem',
                            fontWeight: '800',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                          title="Click to track return status and courier pickup"
                        >
                          <i className={activeReturn.type === 'RETURN' ? "fa-solid fa-rotate-left" : "fa-solid fa-arrows-rotate"}></i>
                          {activeReturn.type}: {activeReturn.status.replace(/_/g, ' ')} &bull; View Status
                        </button>
                      ) : isEligible ? (
                        <span style={{ fontSize: '0.76rem', color: '#166534', background: '#DCFCE7', padding: '4px 10px', borderRadius: '20px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <i className="fa-solid fa-shield-halved" style={{ color: '#16A34A' }}></i>
                          7-Day Return / Exchange Window: {daysRemaining} days remaining
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.74rem', color: '#94A3B8' }}>
                          7-day return window closed
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => setShowPolicyModal(true)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#64748B',
                          fontSize: '0.74rem',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        Policy details
                      </button>
                    </div>

                    {/* Right: Review & Return Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* Product Review Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedReviewOrder(order);
                          setSelectedReviewItemIndex(0);
                        }}
                        style={{
                          background: orderReviews.length > 0 ? '#FEF3C7' : '#FFFFFF',
                          color: orderReviews.length > 0 ? '#B45309' : '#D97706',
                          border: '1px solid #FCD34D',
                          padding: '7px 12px',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: '800',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <i className="fa-solid fa-star" style={{ color: '#F59E0B' }}></i>
                        {orderReviews.length > 0 ? `Reviewed (${orderReviews.length})` : 'Rate & Review Products'}
                      </button>

                      {/* Return / Exchange Button (if eligible and not already returned) */}
                      {!activeReturn && isEligible && (
                        <button
                          type="button"
                          onClick={() => setSelectedReturnOrder(order)}
                          style={{
                            background: '#FFFFFF',
                            color: '#1E293B',
                            border: '1px solid #CBD5E1',
                            padding: '7px 12px',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <i className="fa-solid fa-rotate-left" style={{ color: '#EF4444' }}></i>
                          Return / Exchange
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── MODALS ─── */}

      {/* Tax Invoice Modal */}
      {selectedInvoiceOrder && (
        <CustomerInvoiceModal
          order={selectedInvoiceOrder}
          onClose={() => setSelectedInvoiceOrder(null)}
        />
      )}

      {/* Delivered Order Review Modal */}
      {selectedReviewOrder && (
        <DeliveredOrderReviewModal
          isOpen={!!selectedReviewOrder}
          order={selectedReviewOrder}
          initialItemIndex={selectedReviewItemIndex}
          onClose={() => setSelectedReviewOrder(null)}
          onReviewSubmitted={() => fetchHistoryData()}
        />
      )}

      {/* Return & Exchange Modal */}
      {selectedReturnOrder && (
        <ReturnExchangeModal
          isOpen={!!selectedReturnOrder}
          order={selectedReturnOrder}
          onClose={() => setSelectedReturnOrder(null)}
          onReturnCreated={() => fetchHistoryData()}
        />
      )}

      {/* 7-Day Return Policy Information Modal */}
      <ReturnPolicyModal
        isOpen={showPolicyModal}
        onClose={() => setShowPolicyModal(false)}
      />

      {/* Return Tracking Stepper Modal */}
      {selectedTrackingReturn && (
        <ReturnTrackingModal
          isOpen={!!selectedTrackingReturn}
          returnRequest={selectedTrackingReturn}
          onClose={() => setSelectedTrackingReturn(null)}
          onCancelled={() => fetchHistoryData()}
        />
      )}
    </main>
  );
}
