import React, { useState } from 'react';
import api from '../services/api';

const RATING_DESCRIPTIONS = {
  1: 'Disappointing / Poor',
  2: 'Below Average / Fair',
  3: 'Good / Met Expectations',
  4: 'Very Good / Satisfied',
  5: 'Outstanding / Loved it!'
};

export default function DeliveredOrderReviewModal({ isOpen, onClose, order, onReviewSubmitted, initialItemIndex = 0 }) {
  const [selectedItemIndex, setSelectedItemIndex] = useState(initialItemIndex || 0);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen || !order || !order.items || order.items.length === 0) return null;

  const currentItem = order.items[selectedItemIndex] || order.items[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!comment.trim()) {
      setErrorMsg('Please write a few words about your experience with this product.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { data } = await api.post('/reviews', {
        orderId: order._id,
        productId: currentItem.productId,
        rating: Number(rating),
        title: title.trim() || `${RATING_DESCRIPTIONS[rating]} - Verified Purchase`,
        comment: comment.trim()
      });

      if (data.success) {
        setSuccessMsg('🎉 Review submitted successfully! Thank you for helping other buyers.');
        setTimeout(() => {
          if (onReviewSubmitted) {
            onReviewSubmitted(data.review);
          }
          onClose();
        }, 1200);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.75)',
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
        borderRadius: '16px',
        width: '100%',
        maxWidth: '520px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: '#F59E0B',
              color: '#0F172A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem'
            }}>
              <i className="fa-solid fa-star"></i>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: '#FFFFFF' }}>
                Rate &amp; Review Delivered Item
              </h3>
              <span style={{ fontSize: '0.74rem', color: '#94A3B8' }}>
                Order #{order.orderNumber} &bull; Verified Purchase
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

        {/* Content Body */}
        <div style={{ padding: '20px', overflowY: 'auto' }}>
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
              <i className="fa-solid fa-circle-exclamation"></i>
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div style={{
              background: '#DCFCE7',
              color: '#166534',
              border: '1px solid #86EFAC',
              padding: '12px 14px',
              borderRadius: '8px',
              fontSize: '0.86rem',
              fontWeight: '700',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <i className="fa-solid fa-circle-check" style={{ color: '#16A34A', fontSize: '1.1rem' }}></i>
              <span>{successMsg}</span>
            </div>
          )}

          {/* Multiple Item Switcher if order has > 1 item */}
          {order.items.length > 1 && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: '#64748B', marginBottom: '6px' }}>
                Select item to review:
              </label>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                {order.items.map((it, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => { setSelectedItemIndex(idx); setErrorMsg(''); setSuccessMsg(''); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: selectedItemIndex === idx ? '2px solid #2563EB' : '1px solid #E2E8F0',
                      background: selectedItemIndex === idx ? '#EFF6FF' : '#F8FAFC',
                      cursor: 'pointer',
                      textAlign: 'left',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <img
                      src={it.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=80&q=80'}
                      alt={it.name}
                      style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: '4px' }}
                    />
                    <span style={{ fontSize: '0.78rem', fontWeight: selectedItemIndex === idx ? '800' : '600', color: '#1E293B' }}>
                      {it.name.length > 20 ? it.name.substring(0, 20) + '...' : it.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selected Product Banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '20px'
          }}>
            <img
              src={currentItem.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=150&q=80'}
              alt={currentItem.name}
              style={{ width: '56px', height: '56px', objectFit: 'contain', background: '#FFFFFF', borderRadius: '8px', padding: '4px' }}
            />
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: 0, fontSize: '0.94rem', fontWeight: '800', color: '#0F172A' }}>
                {currentItem.name}
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: '800',
                  color: '#16A34A',
                  background: '#DCFCE7',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <i className="fa-solid fa-badge-check"></i> Verified Purchase
                </span>
                <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                  Delivered Order #{order.orderNumber}
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Star Rating Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '800', color: '#1E293B', marginBottom: '8px' }}>
                Overall Rating <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = (hoverRating || rating) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '1.9rem',
                        color: active ? '#F59E0B' : '#CBD5E1',
                        transition: 'transform 0.15s, color 0.15s',
                        transform: active ? 'scale(1.15)' : 'scale(1)',
                        padding: '2px'
                      }}
                      title={`${star} Star`}
                    >
                      ★
                    </button>
                  );
                })}
                <span style={{
                  marginLeft: '10px',
                  fontSize: '0.88rem',
                  fontWeight: '800',
                  color: (hoverRating || rating) >= 4 ? '#16A34A' : (hoverRating || rating) === 3 ? '#D97706' : '#DC2626'
                }}>
                  {RATING_DESCRIPTIONS[hoverRating || rating]}
                </span>
              </div>
            </div>

            {/* Headline / Title */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1E293B', marginBottom: '6px' }}>
                Review Title (Optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Excellent build quality, prompt delivery!"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.88rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Detailed Comment */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1E293B', marginBottom: '6px' }}>
                Your Detailed Feedback <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <textarea
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What did you like or dislike about this product? How was the sizing, packaging, and performance?"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.88rem',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
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
                disabled={submitting}
                style={{
                  flex: 2,
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                  color: '#0F172A',
                  fontWeight: '900',
                  fontSize: '0.92rem',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.35)'
                }}
              >
                {submitting ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Submitting...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane"></i> Publish Customer Review
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
