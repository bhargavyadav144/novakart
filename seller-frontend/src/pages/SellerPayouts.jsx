import React, { useEffect, useState } from 'react';
import sellerApi, { formatINR } from '../services/sellerApi';
import SellerBiometricModal from '../components/SellerBiometricModal';

export default function SellerPayouts() {
  const [walletData, setWalletData] = useState(null);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [bankForm, setBankForm] = useState({
    accountHolderName: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    upiId: ''
  });
  const [msg, setMsg] = useState('');

  // Payout Request States
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState(false);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [payoutSuccessData, setPayoutSuccessData] = useState(null);

  const fetchWallet = async () => {
    setLoading(true);
    try {
      const { data } = await sellerApi.get('/payments/seller-wallet');
      setWalletData(data.wallet);
      setSettlements(data.settlements || []);
      if (data.wallet?.bankDetails) {
        setBankForm({
          accountHolderName: data.wallet.bankDetails.accountHolderName || '',
          bankName: data.wallet.bankDetails.bankName || 'HDFC Bank',
          accountNumber: data.wallet.bankDetails.accountNumber || '',
          ifscCode: data.wallet.bankDetails.ifscCode || '',
          upiId: data.wallet.bankDetails.upiId || ''
        });
      }
    } catch (err) {
      console.error('Error fetching seller wallet:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  const handleUpdateBank = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      await sellerApi.put('/payments/seller-bank-details', bankForm);
      setMsg('✅ Bank payout details updated successfully!');
      setIsEditingBank(false);
      fetchWallet();
    } catch (err) {
      alert(`Error: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleOpenPayoutDialog = () => {
    const available = walletData?.availableForWithdrawal || 0;
    if (available <= 0) {
      alert('⚠️ No funds currently available for disbursal. As customer orders are confirmed delivered, funds clear automatically into your disbursal balance.');
      return;
    }
    setPayoutAmount(String(available));
    setPayoutNotes('Merchant Requested Bank Payout');
    setIsPayoutModalOpen(true);
  };

  const handleProceedToBiometrics = (e) => {
    e.preventDefault();
    const amt = Number(payoutAmount);
    const available = walletData?.availableForWithdrawal || 0;

    if (isNaN(amt) || amt < 100) {
      alert('⚠️ Minimum disbursal amount is ₹100.');
      return;
    }
    if (amt > available) {
      alert(`⚠️ Cannot withdraw more than available balance of ${formatINR(available)}.`);
      return;
    }

    setIsPayoutModalOpen(false);
    setIsBiometricModalOpen(true);
  };

  const handleBiometricSuccess = async (biometricResult) => {
    setRequestingPayout(true);
    setMsg('');
    try {
      const { data } = await sellerApi.post('/sellers/request-payout', {
        amount: Number(payoutAmount),
        biometricToken: biometricResult.biometricToken,
        notes: payoutNotes
      });

      if (data.success) {
        setPayoutSuccessData({
          amount: data.withdrawnAmount,
          utr: data.utrNumber,
          bankName: walletData?.bankDetails?.bankName || 'HDFC Bank',
          accountNumber: walletData?.bankDetails?.accountNumber || '44',
          biometricType: biometricResult.biometricType
        });
        setMsg(`🎉 Payout of ${formatINR(data.withdrawnAmount)} successfully authorized via ${biometricResult.biometricType === 'FINGERPRINT' ? 'Fingerprint Biometric' : 'Face Recognition'}! UTR: ${data.utrNumber}`);
        setIsBiometricModalOpen(false);
        fetchWallet();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit payout claim. Please try again.');
    } finally {
      setRequestingPayout(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '10px 0 40px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ background: '#ECFDF5', color: '#047857', padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700' }}>
              <i className="fa-solid fa-shield-halved"></i> Escrow Verification Active
            </span>
            <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700' }}>
              <i className="fa-solid fa-fingerprint"></i> Biometric Auth: Fingerprint &amp; Face
            </span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0F172A' }}>
            Settlements &amp; Merchant Bank Payouts
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.88rem' }}>
            Track product turnover, 10% platform cuts, return-window escrow, and fingerprint/face-protected bank disbursals
          </p>
        </div>

        <button 
          onClick={handleOpenPayoutDialog}
          style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: '#FFFFFF', border: 'none', padding: '12px 20px', borderRadius: '8px', fontWeight: '800', fontSize: '0.92rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(16,185,129,0.3)' }}
        >
          <i className="fa-solid fa-fingerprint"></i> Request Disbursal
        </button>
      </div>

      {payoutSuccessData && (
        <div style={{
          background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
          border: '1.5px solid #10B981',
          borderRadius: '12px',
          padding: '18px 22px',
          marginBottom: '22px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#10B981',
              color: '#090D16',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              fontWeight: '900',
              boxShadow: '0 0 16px rgba(16, 185, 129, 0.5)'
            }}>
              ✓
            </div>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#065F46' }}>
                🎉 Disbursal of {formatINR(payoutSuccessData.amount)} Successfully Authorized!
              </div>
              <div style={{ fontSize: '0.82rem', color: '#047857', marginTop: '2px' }}>
                Verified via {payoutSuccessData.biometricType === 'FINGERPRINT' ? '👆 Touch Fingerprint Sensor' : '📷 Face Recognition'}. Funds routed to {payoutSuccessData.bankName} (A/C: ••••{String(payoutSuccessData.accountNumber).slice(-4)}).
              </div>
              <div style={{ fontSize: '0.78rem', color: '#047857', fontFamily: 'monospace', fontWeight: '700', marginTop: '4px' }}>
                IMPS UTR: {payoutSuccessData.utr} &bull; Status: Released for Treasury Credit
              </div>
            </div>
          </div>
          <button
            onClick={() => setPayoutSuccessData(null)}
            style={{ background: 'none', border: 'none', color: '#047857', fontSize: '1.4rem', cursor: 'pointer' }}
          >
            &times;
          </button>
        </div>
      )}

      {msg && !payoutSuccessData && (
        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#047857', padding: '12px 18px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem', fontWeight: '600' }}>
          {msg}
        </div>
      )}

      {/* Wallet Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px', marginBottom: '28px' }}>
        <div style={{ background: '#fff', border: '1px solid var(--seller-border)', borderRadius: '12px', padding: '22px', borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Available for Disbursal</span>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#047857', marginTop: '4px' }}>
            {formatINR(walletData?.availableForWithdrawal || 0)}
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>
            Orders cleared past return window
          </p>
        </div>

        <div style={{ background: '#fff', border: '1px solid var(--seller-border)', borderRadius: '12px', padding: '22px', borderLeft: '4px solid #F59E0B' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Under Escrow Verification</span>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#B45309', marginTop: '4px' }}>
            {formatINR(walletData?.pendingVerification || 0)}
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>
            7-day customer return period verification
          </p>
        </div>

        <div style={{ background: '#fff', border: '1px solid var(--seller-border)', borderRadius: '12px', padding: '22px', borderLeft: '4px solid #3B82F6' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Total Disbursed to Bank</span>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#1D4ED8', marginTop: '4px' }}>
            {formatINR(walletData?.totalDisbursed || 0)}
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>
            Cleared via IMPS / NEFT with Bank UTR
          </p>
        </div>

        <div style={{ background: '#fff', border: '1px solid var(--seller-border)', borderRadius: '12px', padding: '22px', borderLeft: '4px solid #EF4444' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Platform Deductions (10% + 2%)</span>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#DC2626', marginTop: '4px' }}>
            &minus;{formatINR(walletData?.totalDeductions || 0)}
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>
            Marketplace commission & PG surcharge
          </p>
        </div>
      </div>

      {/* Bank Account Details Card */}
      <div style={{ background: '#fff', border: '1px solid var(--seller-border)', borderRadius: '12px', padding: '24px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-building-columns" style={{ color: '#2563EB' }}></i> Registered Bank Payout Routing Account
          </h3>
          <button 
            onClick={() => setIsEditingBank(!isEditingBank)}
            style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', padding: '6px 14px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', color: '#334155' }}
          >
            <i className="fa-solid fa-pen-to-square"></i> {isEditingBank ? 'Cancel' : 'Edit Bank Details'}
          </button>
        </div>

        {isEditingBank ? (
          <form onSubmit={handleUpdateBank} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', background: '#F8FAFC', padding: '20px', borderRadius: '8px', border: '1px solid var(--seller-border)' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569' }}>Account Holder Name</label>
              <input 
                type="text"
                required
                value={bankForm.accountHolderName}
                onChange={(e) => setBankForm({ ...bankForm, accountHolderName: e.target.value })}
                className="seller-form-input"
                style={{ padding: '8px 12px', width: '100%', marginTop: '4px', borderRadius: '6px', border: '1px solid #CBD5E1' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569' }}>Bank Name</label>
              <input 
                type="text"
                required
                value={bankForm.bankName}
                onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                style={{ padding: '8px 12px', width: '100%', marginTop: '4px', borderRadius: '6px', border: '1px solid #CBD5E1' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569' }}>Account Number</label>
              <input 
                type="text"
                required
                value={bankForm.accountNumber}
                onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                style={{ padding: '8px 12px', width: '100%', marginTop: '4px', borderRadius: '6px', border: '1px solid #CBD5E1' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569' }}>IFSC Code</label>
              <input 
                type="text"
                required
                value={bankForm.ifscCode}
                onChange={(e) => setBankForm({ ...bankForm, ifscCode: e.target.value })}
                style={{ padding: '8px 12px', width: '100%', marginTop: '4px', borderRadius: '6px', border: '1px solid #CBD5E1' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569' }}>UPI ID (Optional)</label>
              <input 
                type="text"
                value={bankForm.upiId}
                onChange={(e) => setBankForm({ ...bankForm, upiId: e.target.value })}
                placeholder="store@upi"
                style={{ padding: '8px 12px', width: '100%', marginTop: '4px', borderRadius: '6px', border: '1px solid #CBD5E1' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button 
                type="submit" 
                style={{ padding: '10px 20px', background: '#0F172A', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}
              >
                Save Bank Details
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', background: '#F8FAFC', padding: '18px', borderRadius: '8px', border: '1px solid var(--seller-border)' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748B', textTransform: 'uppercase', fontWeight: '700' }}>Bank Institution</div>
              <div style={{ fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>{walletData?.bankDetails?.bankName || 'HDFC Bank'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748B', textTransform: 'uppercase', fontWeight: '700' }}>Account Number</div>
              <div style={{ fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>
                {walletData?.bankDetails?.accountNumber ? `•••• •••• ${walletData.bankDetails.accountNumber.slice(-4)}` : '5010 •••• 1244'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748B', textTransform: 'uppercase', fontWeight: '700' }}>IFSC Code</div>
              <div style={{ fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>{walletData?.bankDetails?.ifscCode || 'HDFC0001234'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748B', textTransform: 'uppercase', fontWeight: '700' }}>Disbursal Method</div>
              <div style={{ fontWeight: '800', color: '#047857', marginTop: '2px' }}>
                <i className="fa-solid fa-bolt"></i> IMPS Direct Credit
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Settlement Disbursals Table */}
      <div style={{ background: '#fff', border: '1px solid var(--seller-border)', borderRadius: '12px', padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0F172A', marginBottom: '16px' }}>
          Settlement Statement & Payout Disbursals Ledger
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--seller-border)', textAlign: 'left', color: '#64748B', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Statement ID & Date</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Gross Subtotal</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: '#DC2626' }}>Platform Cut (10% + 2%)</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: '#047857' }}>Net Seller Payout</th>
                <th style={{ padding: '12px 16px' }}>Bank Reference / UTR</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {settlements.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#94A3B8' }}>
                    No settlement records found.
                  </td>
                </tr>
              ) : (
                settlements.map((s) => (
                  <tr key={s._id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <strong style={{ color: '#0F172A' }}>{s.transactionId}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                        {new Date(s.createdAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '700' }}>
                      {formatINR(s.subtotal)}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#DC2626', fontWeight: '700' }}>
                      &minus;{formatINR(s.totalDeductions)}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '800', color: '#15803D' }}>
                      {formatINR(s.netDisbursedAmount)}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {s.utrNumber ? (
                        <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#047857', fontSize: '0.82rem' }}>
                          {s.utrNumber}
                        </span>
                      ) : (
                        <span style={{ color: '#94A3B8', fontSize: '0.78rem', fontStyle: 'italic' }}>
                          Pending Treasury Approval
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {s.status === 'DISBURSED' && (
                        <span style={{ background: '#ECFDF5', color: '#047857', padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700' }}>
                          <i className="fa-solid fa-circle-check"></i> Disbursed
                        </span>
                      )}
                      {s.status === 'PENDING_VERIFICATION' && (
                        <span style={{ background: '#FFFBEB', color: '#B45309', padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700' }}>
                          <i className="fa-solid fa-clock"></i> In Verification
                        </span>
                      )}
                      {s.status === 'ON_HOLD' && (
                        <span style={{ background: '#FEF2F2', color: '#DC2626', padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700' }}>
                          <i className="fa-solid fa-hand"></i> On Hold
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAYOUT REQUEST DIALOG MODAL */}
      {isPayoutModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            maxWidth: '460px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            position: 'relative'
          }}>
            <button
              onClick={() => setIsPayoutModalOpen(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: '#F1F5F9',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                color: '#64748B',
                fontSize: '1.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              &times;
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#ECFDF5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                <i className="fa-solid fa-paper-plane"></i>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: '#0F172A' }}>
                  Request Bank Payout
                </h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B' }}>
                  NovaKart IMPS Direct Treasury Disbursal
                </p>
              </div>
            </div>

            <form onSubmit={handleProceedToBiometrics} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Balance card */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Available for Disbursal</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#047857' }}>
                    {formatINR(walletData?.availableForWithdrawal || 0)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPayoutAmount(String(walletData?.availableForWithdrawal || 0))}
                  style={{
                    background: '#ECFDF5',
                    color: '#047857',
                    border: '1px solid #A7F3D0',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '0.78rem',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  ⚡ Full Balance
                </button>
              </div>

              {/* Amount input */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Payout Amount to Withdraw (₹)
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '1.2rem', fontWeight: '800', color: '#64748B' }}>
                    ₹
                  </span>
                  <input
                    type="number"
                    min="100"
                    max={walletData?.availableForWithdrawal || 0}
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    placeholder="Enter amount (min ₹100)"
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 34px',
                      fontSize: '1.15rem',
                      fontWeight: '800',
                      border: '1.5px solid #CBD5E1',
                      borderRadius: '10px',
                      boxSizing: 'border-box',
                      color: '#0F172A'
                    }}
                    required
                  />
                </div>
              </div>

              {/* Destination Bank Account */}
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ fontSize: '0.74rem', color: '#1E40AF', fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Receiving Bank Account
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#1E3A8A' }}>
                  🏦 {walletData?.bankDetails?.bankName || 'HDFC Bank'} &bull; A/C: {walletData?.bankDetails?.accountNumber || '50100234891244'}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#3B82F6', marginTop: '2px' }}>
                  IFSC: {walletData?.bankDetails?.ifscCode || 'HDFC0001234'} &bull; Holder: {walletData?.bankDetails?.accountHolderName || walletData?.storeName}
                </div>
              </div>

              {/* Biometric Security Protocol Warning */}
              <div style={{
                background: '#FEF3C7',
                border: '1px solid #FCD34D',
                borderRadius: '10px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <i className="fa-solid fa-fingerprint" style={{ color: '#D97706', fontSize: '1.2rem' }}></i>
                <div style={{ fontSize: '0.78rem', color: '#92400E', lineHeight: '1.4' }}>
                  <strong>Biometric Verification Required:</strong> You will be prompted to authenticate with your <strong>matching fingerprint</strong> or <strong>matching face</strong> before payout is released.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setIsPayoutModalOpen(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#64748B',
                    fontWeight: '700',
                    fontSize: '0.88rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 2,
                    padding: '12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10B981, #059669)',
                    color: '#FFFFFF',
                    fontWeight: '800',
                    fontSize: '0.92rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)'
                  }}
                >
                  <i className="fa-solid fa-shield-check"></i> Verify Biometrics &amp; Withdraw
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SELLER BIOMETRIC VERIFICATION MODAL */}
      <SellerBiometricModal
        isOpen={isBiometricModalOpen}
        onClose={() => setIsBiometricModalOpen(false)}
        onVerifiedSuccess={handleBiometricSuccess}
        amount={payoutAmount}
        bankDetails={walletData?.bankDetails}
        actionContext="CASHOUT_WITHDRAWAL"
        actionLabel="Merchant Payout Biometric Authorization"
      />
    </div>
  );
}
