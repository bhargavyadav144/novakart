import React from 'react';
import { formatINR } from '../services/sellerApi';

export default function SellerOrderDetailsModal({ order, onClose, onAccept, onReject, onOpenInvoice, onOpenLabel }) {
  if (!order) return null;

  const items = order.items || [];
  const primaryImg = items[0]?.image || 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=400&q=80';

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
          background: '#1A237E',
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
              <span className="badge badge-blue" style={{ fontSize: '0.78rem', background: '#3949AB', color: '#FFF' }}>
                <i className="fa-solid fa-store"></i> ORDER #{order.orderNumber}
              </span>
              <span style={{ fontSize: '0.82rem', color: '#E8EAF6' }}>
                {new Date(order.createdAt).toLocaleString('en-IN')}
              </span>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#C5CAE9', marginTop: '4px' }}>
              Customer: <strong>{order.deliveryAddress?.fullName || order.customerId?.name}</strong>
            </div>
          </div>

          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.15)',
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
          
          {/* Status & Quick Summary Ribbon */}
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
                Total Payable Amount
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#1A237E' }}>
                {formatINR(order.totalAmount)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>
                Store Status
              </div>
              <span style={{
                background: '#E8EAF6',
                color: '#1A237E',
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
                Payment Method
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
              <i className="fa-solid fa-boxes-stacked" style={{ color: '#1A237E' }}></i>
              Ordered Products ({items.length})
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
                      e.target.src = 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=400&q=80';
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '0.9rem' }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
                      Qty: <strong>{item.quantity}</strong> &bull; Price: {formatINR(item.price)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: '800', color: '#0F172A', fontSize: '0.95rem' }}>
                    {formatINR(item.price * item.quantity)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping & Delivery Address */}
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', marginBottom: '6px' }}>
              Customer Delivery Destination
            </div>
            <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '0.9rem' }}>
              {order.deliveryAddress?.fullName}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#2563EB', fontWeight: '700', marginTop: '2px' }}>
              📞 {order.deliveryAddress?.phone}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '4px' }}>
              {order.deliveryAddress?.street}, {order.deliveryAddress?.city}, {order.deliveryAddress?.state} - {order.deliveryAddress?.postalCode}
            </div>
          </div>

          {/* Assigned Regional Logistics Hub Routing */}
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px', padding: '14px', marginBottom: '24px' }}>
            <div style={{ fontSize: '0.75rem', color: '#1D4ED8', fontWeight: '800', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa-solid fa-truck-fast"></i> Assigned Regional Logistics Route &amp; Facility Dock
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.82rem', fontWeight: '800', color: '#0F172A' }}>
              <span style={{ background: '#3B82F6', color: '#FFF', padding: '3px 8px', borderRadius: '5px' }}>
                <i className="fa-solid fa-warehouse" style={{ marginRight: '4px' }}></i>
                Origin: {order.logisticsRoute?.originWarehouse?.name || 'Guntur Regional Hub'} ({order.logisticsRoute?.originWarehouse?.code || 'WH-AP-GNT01'})
              </span>
              <i className="fa-solid fa-arrow-right" style={{ color: '#2563EB', fontSize: '0.78rem' }}></i>
              <span style={{ background: '#059669', color: '#FFF', padding: '3px 8px', borderRadius: '5px' }}>
                <i className="fa-solid fa-location-dot" style={{ marginRight: '4px' }}></i>
                Destination: {order.logisticsRoute?.destinationBranch?.name || 'Tenali Delivery Branch'} ({order.logisticsRoute?.destinationBranch?.code || 'WH-AP-TEN01'})
              </span>
            </div>
          </div>

          {/* Action Toolbar */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {onOpenLabel && (
              <button
                onClick={() => {
                  onOpenLabel(order);
                  onClose();
                }}
                style={{
                  background: '#10B981',
                  color: '#090D16',
                  border: 'none',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                title="Print or reprint official package shipping label with barcodes"
              >
                <i className="fa-solid fa-print"></i> Print / Reprint Shipping Label
              </button>
            )}

            {onOpenInvoice && (
              <button
                onClick={() => {
                  onOpenInvoice(order);
                  onClose();
                }}
                style={{
                  background: '#1A237E',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <i className="fa-solid fa-file-invoice"></i> Merchant Payout Voucher
              </button>
            )}

            {order.orderStatus === 'PENDING' && onAccept && (
              <button
                onClick={() => {
                  onAccept(order._id);
                  onClose();
                }}
                style={{
                  background: '#10B981',
                  color: '#090D16',
                  border: 'none',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                <i className="fa-solid fa-check"></i> Accept Order
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                background: '#F1F5F9',
                color: '#475569',
                border: '1px solid #CBD5E1',
                padding: '9px 16px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
