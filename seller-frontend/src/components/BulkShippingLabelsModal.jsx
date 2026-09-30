import React, { useEffect, useState } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { formatINR } from '../services/sellerApi';
import { formatDateTimeWithSeconds } from './SellerInvoiceModal';

// Individual Label item rendering component
function SingleBulkLabelItem({ order, sellerInfo }) {
  const [barcodeDataUrl, setBarcodeDataUrl] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const orderNum = order?.orderNumber || 'ORD-UNKNOWN';

  const storeName = sellerInfo?.storeName || order.sellerId?.storeName || 'Verified Merchant Store';
  const ownerName = sellerInfo?.ownerName || order.sellerId?.ownerName || 'Merchant Partner';
  const businessAddress = sellerInfo?.businessAddress || order.sellerId?.businessAddress || 'Industrial Hub';
  const gstin = sellerInfo?.gstin || '37AAAFM1092R1Z8';

  useEffect(() => {
    if (!order) return;
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, orderNum, {
        format: 'CODE128',
        lineColor: '#000000',
        width: 2.2,
        height: 52,
        displayValue: true,
        font: 'monospace',
        fontSize: 13,
        textMargin: 4,
        margin: 4,
        background: '#FFFFFF'
      });
      setBarcodeDataUrl(canvas.toDataURL('image/png'));
    } catch (err) {
      console.warn('Barcode canvas error:', err);
    }

    // Generate 2D QR Code
    QRCode.toDataURL(orderNum, {
      width: 110,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' }
    })
      .then(url => setQrCodeDataUrl(url))
      .catch(err => console.warn('QR error:', err));
  }, [order, orderNum]);

  return (
    <div className="printable-single-label" style={{
      border: '2px solid #0F172A',
      borderRadius: '8px',
      overflow: 'hidden',
      background: '#FFFFFF',
      marginBottom: '28px',
      pageBreakAfter: 'always',
      breakAfter: 'page'
    }}>
      {/* Header */}
      <div style={{
        background: '#0F172A',
        color: '#FFFFFF',
        padding: '10px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa-solid fa-truck-fast" style={{ color: '#38BDF8', fontSize: '1.2rem' }}></i>
          <div>
            <span style={{ fontSize: '1.05rem', fontWeight: '900', letterSpacing: '0.5px' }}>
              NOVAKART EXPRESS LOGISTICS
            </span>
            <div style={{ fontSize: '0.66rem', color: '#94A3B8' }}>
              PRIORITY SURFACE PARCEL &bull; BULK BATCH DISPATCH
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{
            background: order.paymentMethod === 'COD' ? '#F59E0B' : '#10B981',
            color: '#090D16',
            padding: '3px 10px',
            borderRadius: '4px',
            fontWeight: '900',
            fontSize: '0.82rem',
            letterSpacing: '0.5px'
          }}>
            {order.paymentMethod === 'COD' ? 'CASH ON DELIVERY (COD)' : 'PREPAID'}
          </span>
          <div style={{ fontSize: '0.74rem', color: '#E2E8F0', marginTop: '3px', fontWeight: '800' }}>
            Collect: {order.paymentMethod === 'COD' ? formatINR(order.totalAmount) : '₹0 (PAID)'}
          </div>
        </div>
      </div>

      {/* Barcodes section */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '2px solid #0F172A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        background: '#FAFAFA'
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: '2px' }}>
            Linear Package Barcode (Code 128)
          </span>
          {barcodeDataUrl ? (
            <img src={barcodeDataUrl} alt={`Barcode ${orderNum}`} style={{ height: '52px', width: 'auto', maxWidth: '100%', display: 'block' }} />
          ) : (
            <div style={{ height: '52px', width: '160px', background: '#E2E8F0' }}></div>
          )}
        </div>

        <div style={{ width: '1px', alignSelf: 'stretch', background: '#CBD5E1' }}></div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '110px' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
            2D QR Code
          </span>
          {qrCodeDataUrl ? (
            <img src={qrCodeDataUrl} alt="QR" style={{ width: '90px', height: '90px', border: '1px solid #E2E8F0', borderRadius: '4px', padding: '2px', background: '#FFF' }} />
          ) : (
            <div style={{ width: '90px', height: '90px', background: '#E2E8F0' }}></div>
          )}
        </div>
      </div>

      {/* Destination & Source */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '2px solid #0F172A' }}>
        <div style={{ padding: '12px 16px', borderRight: '1px solid #0F172A', background: '#FFF' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#DC2626', textTransform: 'uppercase', marginBottom: '4px' }}>
            <i className="fa-solid fa-location-dot"></i> Deliver To (Customer):
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: '900', color: '#0F172A' }}>
            {order.deliveryAddress?.fullName || 'Customer'}
          </div>
          <div style={{ fontSize: '0.84rem', color: '#1E293B', marginTop: '4px', lineHeight: '1.4' }}>
            <strong>Address:</strong> {order.deliveryAddress?.street}<br />
            <strong>City/District:</strong> {order.deliveryAddress?.city}, {order.deliveryAddress?.state || 'AP'}<br />
            <strong>PINCODE:</strong> <span style={{ fontSize: '1rem', fontWeight: '900', color: '#0F172A' }}>{order.deliveryAddress?.postalCode || order.deliveryAddress?.pincode}</span><br />
            <strong>Phone:</strong> <span style={{ fontFamily: 'monospace', fontWeight: '800' }}>{order.deliveryAddress?.phone || 'N/A'}</span>
          </div>
        </div>

        <div style={{ padding: '12px 16px', background: '#F8FAFC' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#2563EB', textTransform: 'uppercase', marginBottom: '4px' }}>
            <i className="fa-solid fa-shop"></i> Dispatched From:
          </div>
          <div style={{ fontSize: '0.96rem', fontWeight: '900', color: '#0F172A' }}>
            {storeName}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '4px', lineHeight: '1.4' }}>
            Proprietor: {ownerName}<br />
            Facility: {businessAddress}<br />
            GSTIN: <strong>{gstin}</strong><br />
            Dispatch Date: <strong style={{ color: '#0F172A' }}>{formatDateTimeWithSeconds(order.createdAt)}</strong>
          </div>
        </div>
      </div>

      {/* Manifest Items */}
      <div style={{ padding: '10px 16px' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
          Package Manifest ({order.items?.length || 1} item(s)):
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
              <th style={{ padding: '4px 6px', color: '#475569' }}>Item</th>
              <th style={{ padding: '4px 6px', textAlign: 'center', color: '#475569' }}>Qty</th>
              <th style={{ padding: '4px 6px', textAlign: 'right', color: '#475569' }}>Price</th>
            </tr>
          </thead>
          <tbody>
            {(order.items || []).map((it, idx) => (
              <tr key={idx} style={{ borderBottom: '1px dashed #E2E8F0' }}>
                <td style={{ padding: '4px 6px', fontWeight: '700' }}>{it.name}</td>
                <td style={{ padding: '4px 6px', textAlign: 'center' }}>{it.quantity}</td>
                <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: '700' }}>{formatINR(it.price * it.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', marginTop: '8px', color: '#64748B' }}>
          <span>Hand over to authorized NovaKart delivery agent upon scan.</span>
          <strong style={{ color: '#0F172A' }}>ORDER #{orderNum}</strong>
        </div>
      </div>
    </div>
  );
}

export default function BulkShippingLabelsModal({ orders, sellerInfo, onClose }) {
  if (!orders || orders.length === 0) return null;

  const handlePrintAll = () => {
    window.print();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px',
      overflowY: 'auto'
    }}>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #bulk-printable-area, #bulk-printable-area * {
            visibility: visible;
          }
          #bulk-printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 10px !important;
            box-shadow: none !important;
          }
          .no-print-bulk-ctrl {
            display: none !important;
          }
          .printable-single-label {
            page-break-after: always !important;
            break-after: page !important;
            margin-bottom: 0 !important;
          }
        }
      `}</style>

      <div style={{
        background: '#FFFFFF',
        width: '100%',
        maxWidth: '820px',
        maxHeight: '94vh',
        borderRadius: '14px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Top bar */}
        <div className="no-print-bulk-ctrl" style={{
          padding: '14px 20px',
          background: '#0F172A',
          color: '#FFFFFF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ background: '#10B981', color: '#090D16', padding: '3px 8px', borderRadius: '4px', fontWeight: '900', fontSize: '0.74rem' }}>
              BATCH DISPATCH
            </span>
            <span style={{ fontWeight: '800', fontSize: '1rem', marginLeft: '10px' }}>
              Bulk Shipping Labels ({orders.length} Package Labels)
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handlePrintAll}
              style={{
                background: '#10B981',
                color: '#090D16',
                border: 'none',
                padding: '8px 18px',
                borderRadius: '6px',
                fontWeight: '900',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem'
              }}
            >
              <i className="fa-solid fa-print"></i> Print All {orders.length} Labels at Once
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: '#FFFFFF',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '6px',
                fontWeight: '700',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Bulk Printable Scroll Container */}
        <div id="bulk-printable-area" style={{ padding: '24px', overflowY: 'auto' }}>
          {orders.map((ord, i) => (
            <SingleBulkLabelItem key={ord._id || i} order={ord} sellerInfo={sellerInfo} />
          ))}
        </div>
      </div>
    </div>
  );
}
