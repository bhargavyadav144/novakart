import React, { useEffect, useState } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { formatINR } from '../services/sellerApi';

export const formatDateTimeWithSeconds = (dateStr) => {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

function numberToWords(num) {
  if (!num || isNaN(num)) return 'Zero Rupees Only';
  const a = ['','One ','Two ','Three ','Four ','Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
  const b = ['', '', 'Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

  const n = Math.round(num);
  if (n === 0) return 'Zero Rupees Only';

  function convertGroup(val) {
    if (val < 20) return a[val];
    const tens = Math.floor(val / 10);
    const ones = val % 10;
    return b[tens] + (ones ? ' ' + a[ones] : ' ');
  }

  let str = '';
  const lakh = Math.floor(n / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const hundred = Math.floor((n % 1000) / 100);
  const remainder = n % 100;

  if (lakh > 0) str += convertGroup(lakh) + 'Lakh ';
  if (thousand > 0) str += convertGroup(thousand) + 'Thousand ';
  if (hundred > 0) str += a[hundred] + 'Hundred ';
  if (remainder > 0) {
    if (str !== '') str += 'and ';
    str += convertGroup(remainder);
  }

  return str.trim() + ' Rupees Only';
}

export default function SellerInvoiceModal({ order, sellerInfo, onClose }) {
  const [activeTab, setActiveTab] = useState('label'); // 'label' | 'tax_invoice' | 'settlement'
  const [barcodeDataUrl, setBarcodeDataUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');

  const orderNum = order?.orderNumber || 'ORD-UNKNOWN';

  useEffect(() => {
    if (!order) return;

    // Generate Code 128 Barcode as high-res PNG Data URL for 100% reliable printing
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
        margin: 4,
        background: '#FFFFFF'
      });
      setBarcodeDataUrl(canvas.toDataURL('image/png'));
    } catch (e) {
      console.warn('JsBarcode canvas error:', e);
    }

    QRCode.toDataURL(orderNum, { width: 110, margin: 1 })
      .then(url => setQrDataUrl(url))
      .catch(() => {});
  }, [order, orderNum, activeTab]);

  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  const invoiceNo = `INV-2026-${order.orderNumber?.replace(/[^0-9]/g, '') || Math.floor(100000 + Math.random() * 900000)}`;
  const orderPlacedWithSeconds = formatDateTimeWithSeconds(order.createdAt);
  const orderAcceptedWithSeconds = formatDateTimeWithSeconds(order.updatedAt || order.createdAt);

  const subtotal = order.subtotal || order.totalAmount || 0;
  const tax = order.tax || 199;
  const shippingFee = order.shippingFee || 50;
  const discount = order.discount || 0;
  const grandTotal = order.totalAmount || (subtotal + tax + shippingFee - discount);

  const platformFee = Math.round(subtotal * 0.10);
  const gatewayFee = Math.round(subtotal * 0.02);
  const totalDeductions = platformFee + gatewayFee;
  const netSellerPayout = Math.max(0, subtotal - totalDeductions);

  const storeName = sellerInfo?.storeName || order.sellerId?.storeName || 'Verified NovaKart Merchant Partner';
  const ownerName = sellerInfo?.ownerName || order.sellerId?.ownerName || 'Authorized Merchant';
  const businessAddress = sellerInfo?.businessAddress || order.sellerId?.businessAddress || 'Plot 12, Industrial Corridor, Guntur, AP';
  const gstin = sellerInfo?.gstin || '37AAAFM1092R1Z8';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
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
          #printable-active-document, #printable-active-document * {
            visibility: visible;
          }
          #printable-active-document {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
            box-shadow: none !important;
          }
          .no-print-tab-bar {
            display: none !important;
          }
        }
      `}</style>

      <div style={{
        background: '#FFFFFF',
        width: '100%',
        maxWidth: '880px',
        maxHeight: '94vh',
        borderRadius: '14px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Top Header Controls & Mode Switcher */}
        <div className="no-print-tab-bar" style={{
          padding: '14px 20px',
          background: '#0F172A',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                background: activeTab === 'label' ? '#10B981' : activeTab === 'tax_invoice' ? '#3B82F6' : '#8B5CF6',
                color: '#090D16',
                padding: '3px 10px',
                borderRadius: '4px',
                fontWeight: '900',
                fontSize: '0.74rem'
              }}>
                {activeTab === 'label'
                  ? '🏷️ OUTSIDE BOX SHIPPING STICKER'
                  : activeTab === 'tax_invoice'
                    ? '📄 INSIDE BOX CUSTOMER TAX INVOICE'
                    : '💰 SELLER BANK PAYOUT STATEMENT'}
              </span>
              <span style={{ fontWeight: '800', fontSize: '1.05rem', color: '#F8FAFC' }}>
                Order #{order.orderNumber}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handlePrint}
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
                  gap: '8px',
                  fontSize: '0.85rem'
                }}
              >
                <i className="fa-solid fa-print"></i> Print {activeTab === 'label' ? 'Outside Shipping Label' : activeTab === 'tax_invoice' ? 'Inside Box Tax Bill' : 'Bank Statement'}
              </button>
              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                <i className="fa-solid fa-xmark"></i> Close
              </button>
            </div>
          </div>

          {/* 3-Tab Document Switcher */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.08)', padding: '4px', borderRadius: '8px', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('label')}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'label' ? '#FFFFFF' : 'transparent',
                color: activeTab === 'label' ? '#0F172A' : '#94A3B8',
                fontWeight: '800',
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <i className="fa-solid fa-box-archive" style={{ color: activeTab === 'label' ? '#10B981' : '#94A3B8' }}></i>
              1. Shipping Label (Stick OUTSIDE Box)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tax_invoice')}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'tax_invoice' ? '#FFFFFF' : 'transparent',
                color: activeTab === 'tax_invoice' ? '#0F172A' : '#94A3B8',
                fontWeight: '800',
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <i className="fa-solid fa-file-invoice-dollar" style={{ color: activeTab === 'tax_invoice' ? '#3B82F6' : '#94A3B8' }}></i>
              2. Full Customer Tax Bill (Enclose INSIDE Box)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settlement')}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'settlement' ? '#FFFFFF' : 'transparent',
                color: activeTab === 'settlement' ? '#0F172A' : '#94A3B8',
                fontWeight: '800',
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <i className="fa-solid fa-building-columns" style={{ color: activeTab === 'settlement' ? '#8B5CF6' : '#94A3B8' }}></i>
              3. Seller Bank Payout Statement
            </button>
          </div>
        </div>

        {/* Printable Document Container */}
        <div id="printable-active-document" style={{ padding: '24px', overflowY: 'auto', color: '#0F172A', fontFamily: 'sans-serif' }}>
          
          {/* ========================================================================= */}
          {/* TAB 1: OUTSIDE BOX SHIPPING LABEL (STICKER FORMAT) */}
          {/* ========================================================================= */}
          {activeTab === 'label' && (
            <div style={{ border: '2px solid #0F172A', borderRadius: '10px', background: '#FFFFFF', overflow: 'hidden' }}>
              
              {/* Header Banner */}
              <div style={{ background: '#0F172A', color: '#FFFFFF', padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <i className="fa-solid fa-truck-fast" style={{ color: '#38BDF8', fontSize: '1.4rem' }}></i>
                  <div>
                    <span style={{ fontSize: '1.15rem', fontWeight: '900', letterSpacing: '0.5px' }}>NOVAKART EXPRESS LOGISTICS</span>
                    <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>HYPERLOCAL PARCEL SHIPPING STICKER &bull; OUTSIDE BOX LABEL</div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    background: order.paymentMethod === 'COD' ? '#F59E0B' : '#10B981',
                    color: '#090D16',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    fontWeight: '900',
                    fontSize: '0.88rem'
                  }}>
                    {order.paymentMethod === 'COD' ? 'CASH ON DELIVERY (COD)' : 'PREPAID (PAID)'}
                  </span>
                  <div style={{ fontSize: '0.78rem', color: '#F1F5F9', marginTop: '3px', fontWeight: '800' }}>
                    Collect: {order.paymentMethod === 'COD' ? formatINR(order.totalAmount) : '₹0 (PAID ONLINE)'}
                  </div>
                </div>
              </div>

              {/* Scannable Barcode & QR Code Section */}
              <div style={{ padding: '14px 18px', borderBottom: '2px solid #0F172A', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', background: '#FAFAFA' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: '2px' }}>
                    Package Tracking Barcode (Code 128)
                  </span>
                  {barcodeDataUrl ? (
                    <img src={barcodeDataUrl} alt={`Barcode ${orderNum}`} style={{ height: '54px', width: 'auto', maxWidth: '100%', display: 'block' }} />
                  ) : (
                    <div style={{ height: '54px', width: '180px', background: '#E2E8F0' }}></div>
                  )}
                  <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>ORDER #{orderNum}</span>
                </div>

                <div style={{ width: '1px', alignSelf: 'stretch', background: '#CBD5E1' }}></div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '110px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Dispatch QR
                  </span>
                  {qrDataUrl && (
                    <img src={qrDataUrl} alt="QR" style={{ width: '84px', height: '84px', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '2px', background: '#fff' }} />
                  )}
                  <span style={{ fontSize: '0.66rem', color: '#10B981', fontWeight: '800', marginTop: '3px' }}>✓ Scan to Verify</span>
                </div>
              </div>

              {/* Ship To & Ship From Address Section */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', borderBottom: '2px solid #0F172A' }}>
                {/* DELIVER TO (BUYER) */}
                <div style={{ padding: '16px 18px', borderRight: '1px solid #0F172A', background: '#FFFFFF' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#DC2626', textTransform: 'uppercase', marginBottom: '6px' }}>
                    <i className="fa-solid fa-location-dot"></i> Deliver To (Customer Destination):
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '900', color: '#0F172A' }}>
                    {order.deliveryAddress?.fullName || 'Customer'}
                  </div>
                  <div style={{ fontSize: '0.88rem', color: '#1E293B', marginTop: '4px', lineHeight: '1.4' }}>
                    <strong>Address:</strong> {order.deliveryAddress?.street}<br />
                    <strong>City / Mandal:</strong> {order.deliveryAddress?.city}, {order.deliveryAddress?.state || 'AP'}<br />
                    <strong>DELIVERY PINCODE:</strong> <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#0F172A', background: '#FEF08A', padding: '1px 6px', borderRadius: '4px' }}>{order.deliveryAddress?.postalCode || order.deliveryAddress?.pincode}</span><br />
                    <strong>Contact Phone:</strong> <span style={{ fontFamily: 'monospace', fontWeight: '800', fontSize: '0.95rem' }}>{order.deliveryAddress?.phone || 'N/A'}</span>
                  </div>
                </div>

                {/* DISPATCH FROM (SELLER) */}
                <div style={{ padding: '16px 18px', background: '#F8FAFC' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#2563EB', textTransform: 'uppercase', marginBottom: '6px' }}>
                    <i className="fa-solid fa-shop"></i> Dispatched From (Seller Store):
                  </div>
                  <div style={{ fontSize: '1.0rem', fontWeight: '900', color: '#0F172A' }}>
                    {storeName}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '4px', lineHeight: '1.4' }}>
                    Proprietor: {ownerName}<br />
                    Facility: {businessAddress}<br />
                    Seller GSTIN: <strong>{gstin}</strong><br />
                    Dispatch Time: <strong>{orderAcceptedWithSeconds}</strong>
                  </div>
                </div>
              </div>

              {/* Logistics Routing Strip */}
              <div style={{ padding: '10px 18px', background: '#F1F5F9', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#334155' }}>
                <div>
                  <strong>Dispatch Dock:</strong> {order.logisticsRoute?.originWarehouse?.name || 'Guntur Hub'}
                </div>
                <div><i className="fa-solid fa-arrow-right" style={{ color: '#94A3B8' }}></i></div>
                <div>
                  <strong>Destination Branch:</strong> {order.logisticsRoute?.destinationBranch?.name || `${order.deliveryAddress?.city || 'Local'} Hub`}
                </div>
                <div><i className="fa-solid fa-arrow-right" style={{ color: '#94A3B8' }}></i></div>
                <div>
                  <strong>Assigned Fleet:</strong> {order.deliveryAgentId?.fullName ? order.deliveryAgentId.fullName : 'Scan to Assign'}
                </div>
              </div>

              {/* Items Table Manifest */}
              <div style={{ padding: '14px 18px' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Package Contents ({order.items?.length || 1} Item(s)):
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                      <th style={{ padding: '6px 8px', color: '#475569' }}>#</th>
                      <th style={{ padding: '6px 8px', color: '#475569' }}>Item Description</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center', color: '#475569' }}>Qty</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', color: '#475569' }}>Item Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(order.items || []).map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px dashed #E2E8F0' }}>
                        <td style={{ padding: '6px 8px' }}>{idx + 1}</td>
                        <td style={{ padding: '6px 8px', fontWeight: '700' }}>{it.name}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '800' }}>{it.quantity}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700' }}>{formatINR(it.price * it.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', color: '#64748B' }}>
                  <div>
                    Instruction: Stick this label OUTSIDE parcel box. Handover to delivery agent upon barcode scan.
                  </div>
                  <div style={{ border: '2px solid #10B981', color: '#047857', padding: '4px 12px', borderRadius: '4px', fontWeight: '900', fontSize: '0.74rem' }}>
                    ✓ OUTSIDE PARCEL STICKER
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: FULL CUSTOMER TAX INVOICE & CASH BILL (ENCLOSE INSIDE BOX SHEET) */}
          {/* ========================================================================= */}
          {activeTab === 'tax_invoice' && (
            <div style={{ border: '2px solid #0F172A', borderRadius: '10px', background: '#FFFFFF', padding: '24px' }}>
              
              {/* Top Banner & Invoice Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0F172A', paddingBottom: '16px', marginBottom: '20px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <h2 style={{ fontSize: '1.6rem', fontWeight: '900', color: '#0F172A', margin: 0 }}>TAX INVOICE &amp; CASH MEMO</h2>
                    <span style={{ fontSize: '0.72rem', background: '#2563EB', color: '#FFF', padding: '2px 8px', borderRadius: '4px', fontWeight: '800' }}>ORIGINAL FOR RECIPIENT</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#334155', margin: 0, lineHeight: '1.4' }}>
                    <strong>Seller / Merchant Trade Name:</strong> {storeName}<br />
                    Proprietor: <strong>{ownerName}</strong><br />
                    Facility Address: {businessAddress}<br />
                    GSTIN: <strong>{gstin}</strong> &bull; State Code: 37 (Andhra Pradesh)
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: '900', color: '#1A237E' }}>INVOICE #{invoiceNo}</div>
                  <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '4px' }}>
                    Order Number: <strong>#{order.orderNumber}</strong>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '2px' }}>
                    Invoice Date: <strong>{orderPlacedWithSeconds}</strong>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#059669', marginTop: '2px', fontWeight: '700' }}>
                    Payment Status: {order.paymentStatus === 'PAID' ? 'PAID ONLINE (PREPAID)' : 'CASH ON DELIVERY (COD)'}
                  </div>
                </div>
              </div>

              {/* Customer Shipping & Billing Address Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px', fontSize: '0.85rem' }}>
                <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '900', color: '#2563EB', textTransform: 'uppercase', marginBottom: '6px' }}>
                    <i className="fa-solid fa-user"></i> Billed To (Customer Details):
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: '900', color: '#0F172A' }}>
                    {order.deliveryAddress?.fullName || 'Customer Name'}
                  </div>
                  <div style={{ color: '#475569', marginTop: '4px', lineHeight: '1.4' }}>
                    Phone: <strong style={{ fontFamily: 'monospace' }}>{order.deliveryAddress?.phone || 'N/A'}</strong><br />
                    Email: {order.customerId?.email || 'Registered Buyer'}
                  </div>
                </div>

                <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '900', color: '#059669', textTransform: 'uppercase', marginBottom: '6px' }}>
                    <i className="fa-solid fa-location-dot"></i> Shipped To (Delivery Address):
                  </div>
                  <div style={{ color: '#0F172A', fontWeight: '700', lineHeight: '1.4' }}>
                    {order.deliveryAddress?.street}<br />
                    {order.deliveryAddress?.city}, {order.deliveryAddress?.state || 'AP'} - <strong>{order.deliveryAddress?.postalCode || order.deliveryAddress?.pincode}</strong>
                  </div>
                </div>
              </div>

              {/* Full Product Line Items & GST Breakdown Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#0F172A', color: '#FFFFFF', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>S.No</th>
                    <th style={{ padding: '10px 12px' }}>Product Description</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>HSN / SAC</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Unit Rate</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Taxable Value</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>CGST (9%)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>SGST (9%)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.items || []).map((it, idx) => {
                    const lineSubtotal = (it.price || 0) * (it.quantity || 1);
                    const lineCgst = Math.round(lineSubtotal * 0.09);
                    const lineSgst = Math.round(lineSubtotal * 0.09);
                    const lineTotal = lineSubtotal + lineCgst + lineSgst;

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <td style={{ padding: '10px 12px' }}>{idx + 1}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <strong style={{ color: '#0F172A' }}>{it.name}</strong>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748B' }}>8517 / 8471</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '900' }}>{it.quantity}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatINR(it.price)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatINR(lineSubtotal)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#0284C7' }}>{formatINR(lineCgst)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#0284C7' }}>{formatINR(lineSgst)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '900', color: '#0F172A' }}>{formatINR(lineTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Financial Calculation Breakdown Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginBottom: '20px', fontSize: '0.85rem' }}>
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Grand Total Amount in Words:
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#1A237E', fontStyle: 'italic', marginBottom: '12px' }}>
                    {numberToWords(grandTotal)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B', lineHeight: '1.5', borderTop: '1px dashed #CBD5E1', paddingTop: '8px' }}>
                    <strong>Terms &amp; Conditions:</strong><br />
                    1. All goods sold are covered under NovaKart 7-day easy replacement guarantee.<br />
                    2. Tax Invoice generated electronically. No physical signature required.<br />
                    3. For returns or support, visit NovaKart Help Center or scan QR on box.
                  </div>
                </div>

                <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span>Items Taxable Subtotal:</span>
                    <strong>{formatINR(subtotal)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#0284C7' }}>
                    <span>Central GST (CGST 9%):</span>
                    <strong>+{formatINR(Math.round(subtotal * 0.09))}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#0284C7' }}>
                    <span>State GST (SGST 9%):</span>
                    <strong>+{formatINR(Math.round(subtotal * 0.09))}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span>Shipping &amp; Logistics Charge:</span>
                    <strong>+{formatINR(shippingFee)}</strong>
                  </div>
                  {discount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#059669' }}>
                      <span>Promotional / Coupon Savings:</span>
                      <strong>&minus;{formatINR(discount)}</strong>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0F172A', paddingTop: '8px', marginTop: '8px', fontSize: '1.15rem', fontWeight: '900', color: '#0F172A' }}>
                    <span>Grand Total (INR):</span>
                    <span style={{ color: '#059669' }}>{formatINR(grandTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Bottom Instruction & Seal Banner */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #0F172A', paddingTop: '14px' }}>
                <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', color: '#92400E', padding: '8px 14px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '800' }}>
                  📌 IMPORTANT: ENCLOSE THIS TAX INVOICE BILL INSIDE THE PARCEL BOX BEFORE SEALING.
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ border: '2px solid #1A237E', color: '#1A237E', padding: '6px 14px', borderRadius: '6px', fontWeight: '900', fontSize: '0.78rem', letterSpacing: '0.5px' }}>
                    ✓ OFFICIAL NOVAKART TAX INVOICE
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: SELLER BANK PAYOUT STATEMENT */}
          {/* ========================================================================= */}
          {activeTab === 'settlement' && (
            <div style={{ border: '1px solid #CBD5E1', borderRadius: '10px', padding: '24px', background: '#FFFFFF' }}>
              
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0F172A', paddingBottom: '16px', marginBottom: '20px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: '900', color: '#0F172A' }}>{storeName}</span>
                    <span style={{ fontSize: '0.72rem', background: '#059669', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontWeight: '800' }}>TREASURY PAYOUT CLEARANCE</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0, lineHeight: '1.4' }}>
                    Proprietor: <strong>{ownerName}</strong><br />
                    Address: {businessAddress}<br />
                    Seller GSTIN: <strong>{gstin}</strong> &bull; State: Andhra Pradesh (37)
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: '900', color: '#0F172A' }}>MERCHANT SETTLEMENT STATEMENT</div>
                  <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '3px' }}>
                    <strong>Invoice #:</strong> {invoiceNo}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                    <strong>Order #:</strong> {order.orderNumber}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#2563EB', marginTop: '3px', lineHeight: '1.3' }}>
                    <div>Order Placed: <strong>{orderPlacedWithSeconds}</strong></div>
                    <div>Payout Cleared: <strong>{orderAcceptedWithSeconds}</strong></div>
                  </div>
                </div>
              </div>

              {/* Line Items Tax Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: '#0F172A', color: '#fff', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>#</th>
                    <th style={{ padding: '10px 12px' }}>Product Description</th>
                    <th style={{ padding: '10px 12px' }}>HSN</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Unit Price</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Taxable Val</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>GST (18%)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Gross Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.items || []).map((it, idx) => {
                    const itemTotal = it.price * it.quantity;
                    const itemTax = Math.round(itemTotal * 0.18);
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <td style={{ padding: '10px 12px' }}>{idx + 1}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <strong>{it.name}</strong>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#64748B' }}>8517.13</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>{it.quantity}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatINR(it.price)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatINR(itemTotal)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#0891B2' }}>{formatINR(itemTax)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700' }}>{formatINR(itemTotal + itemTax)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Bank Account & Commission Breakdown Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginBottom: '20px', fontSize: '0.84rem' }}>
                <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', marginBottom: '8px' }}>
                    <i className="fa-solid fa-building-columns" style={{ color: '#2563EB', marginRight: '6px' }}></i>
                    Merchant Settlement Bank Account:
                  </div>
                  <div style={{ color: '#475569', lineHeight: '1.6' }}>
                    <div>Bank Name: <strong>HDFC Bank / Union Bank</strong></div>
                    <div>Account Number: <strong>50100234891244</strong></div>
                    <div>IFSC Code: <strong>HDFC0001234</strong></div>
                    <div>Payout Mode: <strong>Direct Bank IMPS / NEFT Transfer</strong></div>
                    <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#059669', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="fa-solid fa-circle-check"></i> Treasury Verified &amp; Cleared for Auto-Settlement
                    </div>
                  </div>
                </div>

                <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span>Gross Order Subtotal:</span>
                    <strong>{formatINR(subtotal)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#DC2626' }}>
                    <span>NovaKart Commission (10%):</span>
                    <strong>&minus;{formatINR(platformFee)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#DC2626' }}>
                    <span>Payment Gateway Fee (2%):</span>
                    <strong>&minus;{formatINR(gatewayFee)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#64748B' }}>
                    <span>Logistics &amp; Courier Fee:</span>
                    <span>Customer Paid</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0F172A', paddingTop: '8px', marginTop: '8px', fontSize: '1.15rem', fontWeight: '900', color: '#0F172A' }}>
                    <span>Net Disbursable Payout:</span>
                    <span style={{ color: '#059669' }}>{formatINR(netSellerPayout)}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid #E2E8F0', paddingTop: '16px', fontSize: '0.78rem', color: '#64748B' }}>
                <div>
                  <p style={{ margin: 0, lineHeight: '1.4' }}>
                    Issued for Merchant Payout Settlement on NovaKart Marketplace Platform.<br />
                    Directly deposited to registered bank account within 24 hours of order dispatch.
                  </p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ border: '2px solid #059669', color: '#047857', padding: '6px 14px', borderRadius: '6px', fontWeight: '800', fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                    <i className="fa-solid fa-stamp" style={{ marginRight: '4px' }}></i> TREASURY APPROVED &amp; DISBURSED
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
