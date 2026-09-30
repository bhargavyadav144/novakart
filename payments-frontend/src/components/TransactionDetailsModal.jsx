import React from 'react';
import { formatINR } from '../services/paymentApi';
import { formatDateTimeWithSeconds } from './TreasuryVoucherModal';

export default function TransactionDetailsModal({
  transaction,
  onClose,
  onDisburse,
  onHold,
  onReleaseHold,
  onOpenVoucher,
  processingId
}) {
  if (!transaction) return null;

  const tx = transaction;
  const isInbound = tx.type === 'INBOUND_CUSTOMER_PAYMENT';
  const isDisbursed = tx.status === 'DISBURSED' || tx.status === 'SUCCESS';
  const isOnHold = tx.status === 'ON_HOLD';
  const isPending = tx.status === 'PENDING_VERIFICATION';

  const items = tx.orderId?.items || [];
  const primaryImage = items[0]?.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80';

  return (
    <div className="pay-modal-backdrop" onClick={onClose} style={{
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
        className="pay-modal-content"
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
          position: 'relative',
          padding: '0'
        }}
      >
        {/* Modal Header */}
        <div style={{
          background: '#090D16',
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
              <span className={`badge ${isInbound ? 'badge-success' : 'badge-purple'}`} style={{ fontSize: '0.75rem' }}>
                <i className={`fa-solid ${isInbound ? 'fa-arrow-down-left' : 'fa-arrow-up-right'}`}></i>
                {isInbound ? ' INBOUND' : ' OUTBOUND'}
              </span>
              <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>TXN ID:</span>
              <strong style={{ fontFamily: 'monospace', color: '#10B981', fontSize: '1rem' }}>{tx.transactionId}</strong>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#CBD5E1', marginTop: '4px' }}>
              {tx.orderNumber ? `Linked Order #${tx.orderNumber}` : 'Treasury Direct Transaction'}
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
                Net Disbursed Amount
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: '900', color: isInbound ? '#047857' : '#0F172A' }}>
                {formatINR(tx.netDisbursedAmount || tx.amount)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>
                Verification Status
              </div>
              {isDisbursed && (
                <span className="badge badge-success" style={{ fontSize: '0.85rem', padding: '6px 12px' }}>
                  <i className="fa-solid fa-circle-check"></i> Settled to Beneficiary
                </span>
              )}
              {isPending && (
                <span className="badge badge-pending" style={{ fontSize: '0.85rem', padding: '6px 12px' }}>
                  <i className="fa-solid fa-clock"></i> Pending Compliance Verification
                </span>
              )}
              {isOnHold && (
                <span className="badge badge-hold" style={{ fontSize: '0.85rem', padding: '6px 12px' }}>
                  <i className="fa-solid fa-hand"></i> Audit Hold Active
                </span>
              )}
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>
                Payment Method
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <i className="fa-solid fa-credit-card" style={{ color: '#2563EB' }}></i>
                {tx.paymentMethod || 'Razorpay / UPI Gateway'}
              </div>
            </div>
          </div>

          {/* Product Items Breakdown Section */}
          {items.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#0F172A', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-box-open" style={{ color: '#10B981' }}></i>
                Associated Product Items ({items.length})
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
                      src={item.image || primaryImage} 
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
                        Qty: <strong>{item.quantity}</strong> &bull; Unit Price: {formatINR(item.price)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: '800', color: '#0F172A', fontSize: '0.95rem' }}>
                      {formatINR(item.price * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Complete Financial Breakdown Table */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#0F172A', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-calculator" style={{ color: '#2563EB' }}></i>
              Financial Deductions & Nodal Split
            </h3>

            <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px 14px', color: '#64748B' }}>Gross Order / Claim Amount</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: '#0F172A' }}>{formatINR(tx.amount)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px 14px', color: '#64748B' }}>Platform Commission Cut (10%)</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: '#DC2626' }}>
                      {tx.platformCommissionCut > 0 ? `-${formatINR(tx.platformCommissionCut)}` : '₹0'}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px 14px', color: '#64748B' }}>Gateway & Processing Fee</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: '#DC2626' }}>
                      {tx.gatewayFee > 0 ? `-${formatINR(tx.gatewayFee)}` : '₹0'}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px 14px', color: '#64748B' }}>TDS / TCS Tax Withholding</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: '#DC2626' }}>
                      {tx.tax > 0 ? `-${formatINR(tx.tax)}` : '₹0'}
                    </td>
                  </tr>
                  <tr style={{ background: '#F8FAFC' }}>
                    <td style={{ padding: '12px 14px', fontWeight: '800', color: '#0F172A' }}>Net Payable / Settled Amount</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '900', color: '#047857', fontSize: '1rem' }}>
                      {formatINR(tx.netDisbursedAmount || tx.amount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Counterparty & Bank Reference Section */}
          <div style={{ gridTemplateColumns: '1fr 1fr', display: 'grid', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', marginBottom: '6px' }}>
                Sender Entity
              </div>
              <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '0.9rem' }}>{tx.sender?.name || 'Customer'}</div>
              <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>Role: {tx.sender?.role || 'buyer'}</div>
              <div style={{ fontSize: '0.78rem', color: '#2563EB', marginTop: '2px' }}>{tx.sender?.accountOrVpa || 'UPI / Gateway'}</div>
            </div>

            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', marginBottom: '6px' }}>
                Recipient Beneficiary
              </div>
              <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '0.9rem' }}>{tx.recipient?.name}</div>
              {tx.recipient?.storeOrHubName && (
                <div style={{ fontSize: '0.78rem', color: '#2563EB', fontWeight: '700' }}>Store/Hub: {tx.recipient.storeOrHubName}</div>
              )}
              {tx.recipient?.bankName && (
                <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '4px' }}>
                  Bank: <strong>{tx.recipient.bankName}</strong> &bull; A/C: <strong>****{tx.recipient.accountNumber?.slice(-4)}</strong>
                </div>
              )}
              {tx.recipient?.ifscCode && (
                <div style={{ fontSize: '0.78rem', color: '#64748B' }}>IFSC: {tx.recipient.ifscCode}</div>
              )}
            </div>
          </div>

          {/* Timestamps & Audit Notes */}
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px', padding: '14px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', fontSize: '0.82rem' }}>
              <div>
                <span style={{ color: '#1E40AF', fontWeight: '700' }}>Received Timestamp: </span>
                <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#0F172A' }}>
                  {formatDateTimeWithSeconds(tx.receivedAt || tx.createdAt)}
                </span>
              </div>
              {tx.disbursedAt && (
                <div>
                  <span style={{ color: '#047857', fontWeight: '700' }}>Disbursed Timestamp: </span>
                  <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#047857' }}>
                    {formatDateTimeWithSeconds(tx.disbursedAt)}
                  </span>
                </div>
              )}
            </div>

            {tx.utrNumber && (
              <div style={{ marginTop: '8px', fontSize: '0.82rem' }}>
                <span style={{ color: '#1E40AF', fontWeight: '700' }}>Bank UTR Reference: </span>
                <span style={{ fontFamily: 'monospace', fontWeight: '800', color: '#047857' }}>{tx.utrNumber}</span>
              </div>
            )}

            {tx.verificationNotes && (
              <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#475569', borderTop: '1px border #DBEAFE', paddingTop: '6px' }}>
                <strong>Audit Notes:</strong> {tx.verificationNotes}
              </div>
            )}
          </div>

          {/* Action Buttons Toolbar */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                onOpenVoucher(tx);
                onClose();
              }}
              style={{
                background: '#0F172A',
                color: '#FFFFFF',
                border: 'none',
                padding: '10px 18px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <i className="fa-solid fa-file-invoice-dollar" style={{ color: '#10B981' }}></i>
              View Bank Voucher
            </button>

            {isPending && onDisburse && (
              <button
                disabled={processingId === tx._id}
                onClick={() => {
                  onDisburse(tx._id, tx.recipient?.name, tx.netDisbursedAmount || tx.amount);
                  onClose();
                }}
                style={{
                  background: '#10B981',
                  color: '#090D16',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <i className="fa-solid fa-paper-plane"></i>
                {processingId === tx._id ? 'Disbursing...' : 'Execute Instant IMPS Pay'}
              </button>
            )}

            {isPending && onHold && (
              <button
                disabled={processingId === tx._id}
                onClick={() => {
                  onHold(tx._id, tx.recipient?.name);
                  onClose();
                }}
                style={{
                  background: '#F59E0B',
                  color: '#090D16',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <i className="fa-solid fa-pause"></i> Place Audit Hold
              </button>
            )}

            {isOnHold && onReleaseHold && (
              <button
                disabled={processingId === tx._id}
                onClick={() => {
                  onReleaseHold(tx._id);
                  onClose();
                }}
                style={{
                  background: '#3B82F6',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <i className="fa-solid fa-play"></i> Release Hold
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                background: '#F1F5F9',
                color: '#475569',
                border: '1px solid #CBD5E1',
                padding: '10px 18px',
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
