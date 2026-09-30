import React from 'react';
import { formatINR } from '../services/adminApi';

export default function AdminOrderDetailsModal({ order, onClose }) {
  if (!order) return null;

  const items = order.items || [];
  const primaryImg = items[0]?.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80';

  return (
    <div className="modal-backdrop" onClick={onClose} style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(9, 13, 22, 0.75)',
      backdropFilter: 'blur(6px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justify: 'center',
      padding: '20px'
    }}>
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          maxWidth: '750px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1px solid #E2E8F0',
          position: 'relative'
        }}
      >
        {/* Modal Header */}
        <div style={{
          background: '#0F172A',
          color: '#FFFFFF',
          padding: '20px 24px',
          borderTopLeftRadius: '15px',
          borderTopRightRadius: '15px',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="badge badge-blue" style={{ fontSize: '0.78rem' }}>
                <i className="fa-solid fa-receipt"></i> ORDER #{order.orderNumber}
              </span>
              <span style={{ fontSize: '0.82rem', color: '#94A3B8' }}>
                {new Date(order.createdAt).toLocaleString('en-IN')}
              </span>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#CBD5E1', marginTop: '4px' }}>
              Customer: <strong>{order.deliveryAddress?.fullName || order.customerId?.name}</strong>
            </div>
          </div>

          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#FFFFFF',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              fontSize: '1rem'
            }}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px' }}>
          
          {/* Status & Total Ribbon */}
          <div style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex',
            justify: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>
                Total Order Amount
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#0F172A' }}>
                {formatINR(order.totalAmount)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>
                Fulfillment Status
              </div>
              <span style={{
                background: '#DBEAFE',
                color: '#1E40AF',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: '800',
                display: 'inline-block'
              }}>
                {order.orderStatus?.replace(/_/g, ' ')}
              </span>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>
                Payment Status
              </div>
              <span style={{
                background: order.paymentStatus === 'PAID' ? '#DCFCE7' : '#FEF3C7',
                color: order.paymentStatus === 'PAID' ? '#15803D' : '#B45309',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: '800',
                display: 'inline-block'
              }}>
                {order.paymentStatus} ({order.paymentMethod || 'COD'})
              </span>
            </div>
          </div>

          {/* Product Items Breakdown */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#0F172A', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-boxes-stacked" style={{ color: '#2563EB' }}></i>
              Product Items Gallery ({items.length})
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {items.map((item, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '12px',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px'
                }}>
                  <img 
                    src={item.image || primaryImg} 
                    alt={item.name} 
                    style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '8px',
                      objectFit: 'cover',
                      border: '1px solid #CBD5E1'
                    }}
                    onError={(e) => {
                      e.target.src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80';
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '0.9rem' }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
                      Quantity: <strong>{item.quantity}</strong> &bull; Unit Price: {formatINR(item.price)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: '800', color: '#0F172A', fontSize: '0.95rem' }}>
                    {formatINR(item.price * item.quantity)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Customer Delivery Address & Merchant Info */}
          <div style={{ gridTemplateColumns: '1fr 1fr', display: 'grid', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', marginBottom: '6px' }}>
                Customer &amp; Delivery Address
              </div>
              <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '0.9rem' }}>
                {order.deliveryAddress?.fullName || 'Customer'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#2563EB', fontWeight: '700', marginTop: '2px' }}>
                📞 {order.deliveryAddress?.phone}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '4px' }}>
                {order.deliveryAddress?.street}, {order.deliveryAddress?.city}, {order.deliveryAddress?.state} - {order.deliveryAddress?.postalCode}
              </div>
            </div>

            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', marginBottom: '6px' }}>
                Seller Store &amp; Delivery Agent
              </div>
              <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '0.9rem' }}>
                🏬 {order.sellerId?.storeName || 'Merchant Store'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
                {order.sellerId?.businessAddress || 'Hub Registered Store'}
              </div>
              <div style={{ borderTop: '1px solid #E2E8F0', marginTop: '8px', paddingTop: '6px', fontSize: '0.78rem', color: '#059669', fontWeight: '700' }}>
                {order.deliveryAgentId ? (
                  <span><i className="fa-solid fa-motorcycle"></i> Agent: {order.deliveryAgentId.fullName} ({order.deliveryAgentId.vehicleNumber})</span>
                ) : (
                  <span style={{ color: '#D97706' }}>Awaiting Courier Agent Dispatch</span>
                )}
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{
                background: '#0F172A',
                color: '#FFFFFF',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Close Details View
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
