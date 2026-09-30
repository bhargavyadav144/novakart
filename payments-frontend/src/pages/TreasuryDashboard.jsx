import React, { useEffect, useState, useMemo } from 'react';
import paymentApi, { formatINR } from '../services/paymentApi';
import { usePaymentAuth } from '../context/PaymentAuthContext';
import TreasuryVoucherModal, { formatDateTimeWithSeconds } from '../components/TreasuryVoucherModal';
import TransactionDetailsModal from '../components/TransactionDetailsModal';

export default function TreasuryDashboard() {
  const { user, logout, livePayments } = usePaymentAuth();
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'sellers', 'riders', 'warehouse', 'pending', 'returns'
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [datePeriodFilter, setDatePeriodFilter] = useState('all'); // 'all', 'today', 'yesterday', 'week', 'month'
  const [pageSize, setPageSize] = useState(25); // 25, 50, 75, 100, 99999
  const [currentPage, setCurrentPage] = useState(1);
  const [processingId, setProcessingId] = useState(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [selectedVoucherTx, setSelectedVoucherTx] = useState(null);
  const [selectedDetailTx, setSelectedDetailTx] = useState(null);
  const [returnRefunds, setReturnRefunds] = useState([]);
  const [loadingReturns, setLoadingReturns] = useState(false);

  const fetchReturnRefunds = async () => {
    setLoadingReturns(true);
    try {
      const { data } = await paymentApi.get('/returns/payments/pending-refunds');
      if (data.success) {
        setReturnRefunds(data.returns || []);
      }
    } catch (err) {
      console.error('Error loading return refunds:', err);
    } finally {
      setLoadingReturns(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, txRes, retRes] = await Promise.allSettled([
        paymentApi.get('/payments/treasury-stats'),
        paymentApi.get('/payments/transactions?limit=250'),
        paymentApi.get('/returns/payments/pending-refunds')
      ]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data.stats);
      if (txRes.status === 'fulfilled') setTransactions(txRes.value.data.transactions);
      if (retRes.status === 'fulfilled' && retRes.value.data.success) {
        setReturnRefunds(retRes.value.data.returns || []);
      }
    } catch (err) {
      console.error('Error loading treasury data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, search, typeFilter, datePeriodFilter, pageSize]);

  const handleDisburseReturnRefund = async (ret) => {
    const refundAmount = ret.estimatedRefundAmount || ret.orderId?.totalAmount || 0;
    const dest = window.prompt(
      `Confirm refund disbursal of ${formatINR(refundAmount)} to customer ${ret.pickupAddress?.fullName || ret.customerId?.name}?\n\nChoose destination ('WALLET' or 'ORIGINAL_PAYMENT'):`,
      ret.refundPreference || 'WALLET'
    );
    if (!dest) return;

    setProcessingId(ret._id);
    setActionSuccessMsg('');
    try {
      const res = await paymentApi.put(`/returns/payments/${ret._id}/disburse-refund`, {
        payoutDestination: dest.toUpperCase(),
        amountDisbursed: refundAmount,
        paymentAdminNotes: `Refund verified & released by Treasury Officer (${user?.name || 'Payment Admin'}).`
      });

      if (res.data.success) {
        setActionSuccessMsg(`✅ ${res.data.message}`);
        fetchData();
        fetchReturnRefunds();
      }
    } catch (err) {
      alert(`Error disbursing refund: ${err.response?.data?.message || err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDisburse = async (txId, recipientName, amount) => {
    if (!window.confirm(`Confirm IMPS/NEFT disbursal of ${formatINR(amount)} to ${recipientName}?`)) return;
    setProcessingId(txId);
    setActionSuccessMsg('');

    try {
      const { data } = await paymentApi.post(`/payments/disburse/${txId}`, {
        notes: 'Approved & verified by Treasury. IMPS payment settled.'
      });
      setActionSuccessMsg(`✅ ${data.message}`);
      fetchData();
    } catch (err) {
      alert(`Error executing disbursal: ${err.response?.data?.message || err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleHold = async (txId, recipientName) => {
    const reason = window.prompt(`Enter compliance reason to place payout to ${recipientName} on hold:`, 'Additional return window verification required');
    if (!reason) return;
    setProcessingId(txId);

    try {
      const { data } = await paymentApi.post(`/payments/hold/${txId}`, { reason });
      setActionSuccessMsg(`⚠️ ${data.message}`);
      fetchData();
    } catch (err) {
      alert(`Error holding transaction: ${err.response?.data?.message || err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReleaseHold = async (txId) => {
    setProcessingId(txId);
    try {
      const { data } = await paymentApi.post(`/payments/release-hold/${txId}`);
      setActionSuccessMsg(`✅ ${data.message}`);
      fetchData();
    } catch (err) {
      alert(`Error releasing hold: ${err.response?.data?.message || err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  // Date period helper
  const isWithinPeriod = (dateStr, period) => {
    if (period === 'all') return true;
    if (!dateStr) return true;
    const d = new Date(dateStr);
    const now = new Date();

    if (period === 'today') {
      return d.toDateString() === now.toDateString();
    }
    if (period === 'yesterday') {
      const y = new Date();
      y.setDate(now.getDate() - 1);
      return d.toDateString() === y.toDateString();
    }
    if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      return d >= weekAgo;
    }
    if (period === 'month') {
      const monthAgo = new Date();
      monthAgo.setDate(now.getDate() - 30);
      return d >= monthAgo;
    }
    return true;
  };

  // Filtered transactions list
  const filteredList = useMemo(() => {
    return transactions.filter(t => {
      // Tab specific filter
      if (activeTab === 'sellers' && t.type !== 'SELLER_SETTLEMENT') return false;
      if (activeTab === 'riders' && t.type !== 'RIDER_PAYOUT') return false;
      if (activeTab === 'warehouse' && t.type !== 'WAREHOUSE_SALARY') return false;
      if (activeTab === 'pending' && t.status !== 'PENDING_VERIFICATION' && t.status !== 'ON_HOLD') return false;

      // Dropdown type filter
      if (typeFilter !== 'ALL' && t.type !== typeFilter) return false;

      // Period filter
      if (!isWithinPeriod(t.createdAt || t.receivedAt, datePeriodFilter)) return false;

      // Search filter
      if (search) {
        const q = search.toLowerCase();
        const matchesTx = t.transactionId?.toLowerCase().includes(q);
        const matchesUtr = t.utrNumber?.toLowerCase().includes(q);
        const matchesOrd = t.orderNumber?.toLowerCase().includes(q);
        const matchesRecipient = t.recipient?.name?.toLowerCase().includes(q) || t.recipient?.storeOrHubName?.toLowerCase().includes(q);
        const matchesSender = t.sender?.name?.toLowerCase().includes(q);
        const matchesProduct = (t.orderId?.items || []).some(item => item.name?.toLowerCase().includes(q));
        return matchesTx || matchesUtr || matchesOrd || matchesRecipient || matchesSender || matchesProduct;
      }

      return true;
    });
  }, [transactions, activeTab, typeFilter, datePeriodFilter, search]);

  // Period Financial Statistics Calculation
  const periodStats = useMemo(() => {
    let inboundSum = 0;
    let outboundSum = 0;
    let pendingSum = 0;

    filteredList.forEach(t => {
      if (t.type === 'INBOUND_CUSTOMER_PAYMENT' && t.status === 'SUCCESS') {
        inboundSum += t.amount || 0;
      } else if (t.status === 'DISBURSED') {
        outboundSum += t.netDisbursedAmount || t.amount || 0;
      } else if (t.status === 'PENDING_VERIFICATION' || t.status === 'ON_HOLD') {
        pendingSum += t.netDisbursedAmount || t.amount || 0;
      }
    });

    return {
      inbound: inboundSum,
      outbound: outboundSum,
      pending: pendingSum,
      count: filteredList.length,
      netBalance: inboundSum - outboundSum
    };
  }, [filteredList]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredList.length / pageSize) || 1;
  const paginatedList = useMemo(() => {
    if (pageSize >= 99999) return filteredList;
    const start = (currentPage - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, currentPage, pageSize]);

  // Export Excel / CSV Function
  const handleExportCSV = () => {
    const headers = [
      "Transaction ID",
      "UTR Number",
      "Order Number",
      "Product Items",
      "Flow",
      "Type",
      "Status",
      "Gross Amount (INR)",
      "Deductions (INR)",
      "Net Amount (INR)",
      "Sender Name",
      "Sender Role",
      "Recipient Name",
      "Recipient Role",
      "Store or Hub Name",
      "Bank Name",
      "Account Number",
      "IFSC Code",
      "Payment Method",
      "Received Date",
      "Disbursed Date"
    ];

    const csvRows = filteredList.map(t => {
      const itemsList = (t.orderId?.items || []).map(i => `${i.name} (x${i.quantity})`).join('; ') || 'N/A';
      return [
        `"${t.transactionId || ''}"`,
        `"${t.utrNumber || 'PENDING'}"`,
        `"${t.orderNumber || ''}"`,
        `"${itemsList.replace(/"/g, '""')}"`,
        `"${t.type === 'INBOUND_CUSTOMER_PAYMENT' ? 'INBOUND' : 'OUTBOUND'}"`,
        `"${t.type || ''}"`,
        `"${t.status || ''}"`,
        t.amount || 0,
        t.totalDeductions || 0,
        t.netDisbursedAmount || t.amount || 0,
        `"${(t.sender?.name || '').replace(/"/g, '""')}"`,
        `"${t.sender?.role || ''}"`,
        `"${(t.recipient?.name || '').replace(/"/g, '""')}"`,
        `"${t.recipient?.role || ''}"`,
        `"${(t.recipient?.storeOrHubName || '').replace(/"/g, '""')}"`,
        `"${(t.recipient?.bankName || '').replace(/"/g, '""')}"`,
        `"${(t.recipient?.accountNumber || '').replace(/"/g, '""')}"`,
        `"${(t.recipient?.ifscCode || '').replace(/"/g, '""')}"`,
        `"${t.paymentMethod || ''}"`,
        `"${new Date(t.receivedAt || t.createdAt).toLocaleString()}"`,
        `"${t.disbursedAt ? new Date(t.disbursedAt).toLocaleString() : ''}"`
      ].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...csvRows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `NovaKart_Treasury_${datePeriodFilter.toUpperCase()}_Ledger_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sellerPendingCount = transactions.filter(t => t.type === 'SELLER_SETTLEMENT' && t.status === 'PENDING_VERIFICATION').length;
  const riderPendingCount = transactions.filter(t => t.type === 'RIDER_PAYOUT' && t.status === 'PENDING_VERIFICATION').length;
  const whPendingCount = transactions.filter(t => t.type === 'WAREHOUSE_SALARY' && t.status === 'PENDING_VERIFICATION').length;

  return (
    <div className="pay-layout">
      {/* Sidebar */}
      <aside className="pay-sidebar">
        <div className="pay-brand">
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#10B981', color: '#090D16', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
            <i className="fa-solid fa-vault"></i>
          </div>
          <div>
            <div>NovaKart Treasury</div>
            <div className="pay-brand-sub">Digital Payments &amp; Audits</div>
          </div>
        </div>

        <nav className="pay-nav">
          <button 
            className={`pay-nav-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <i className="fa-solid fa-arrows-split-up-and-left"></i>
            <span>All Transactions ({transactions.length})</span>
          </button>

          <button 
            className={`pay-nav-btn ${activeTab === 'sellers' ? 'active' : ''}`}
            onClick={() => setActiveTab('sellers')}
          >
            <i className="fa-solid fa-store"></i>
            <span>Seller Settlements</span>
            {sellerPendingCount > 0 && (
              <span style={{ marginLeft: 'auto', background: '#F59E0B', color: '#090D16', padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: '800' }}>
                {sellerPendingCount}
              </span>
            )}
          </button>

          <button 
            className={`pay-nav-btn ${activeTab === 'riders' ? 'active' : ''}`}
            onClick={() => setActiveTab('riders')}
          >
            <i className="fa-solid fa-motorcycle"></i>
            <span>Rider Fleet Payouts</span>
            {riderPendingCount > 0 && (
              <span style={{ marginLeft: 'auto', background: '#F59E0B', color: '#090D16', padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: '800' }}>
                {riderPendingCount}
              </span>
            )}
          </button>

          <button 
            className={`pay-nav-btn ${activeTab === 'warehouse' ? 'active' : ''}`}
            onClick={() => setActiveTab('warehouse')}
          >
            <i className="fa-solid fa-warehouse"></i>
            <span>Warehouse Salaries</span>
            {whPendingCount > 0 && (
              <span style={{ marginLeft: 'auto', background: '#F59E0B', color: '#090D16', padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: '800' }}>
                {whPendingCount}
              </span>
            )}
          </button>

          <button 
            className={`pay-nav-btn ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            <i className="fa-solid fa-clock-rotate-left"></i>
            <span>Pending Approvals</span>
            <span style={{ marginLeft: 'auto', background: '#EF4444', color: '#fff', padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: '800' }}>
              {stats?.pendingVerificationCount || 0}
            </span>
          </button>

          <button 
            className={`pay-nav-btn ${activeTab === 'returns' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('returns');
              fetchReturnRefunds();
            }}
          >
            <i className="fa-solid fa-rotate-left"></i>
            <span>QC Return Refunds</span>
            {returnRefunds.length > 0 && (
              <span style={{ marginLeft: 'auto', background: '#3B82F6', color: '#fff', padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: '800' }}>
                {returnRefunds.length}
              </span>
            )}
          </button>
        </nav>

        <div style={{ padding: '20px 18px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <img src={user?.avatar || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=100&q=80'} alt="Avatar" style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }} />
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{user?.name || 'Treasury Officer'}</div>
              <div style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: '600' }}>Disbursal Authority</div>
            </div>
          </div>
          <button 
            onClick={logout}
            style={{ width: '100%', padding: '8px', background: 'rgba(239, 68, 68, 0.15)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <i className="fa-solid fa-arrow-right-from-bracket"></i> Exit Treasury
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="pay-content">
        {/* Top Header */}
        <div className="pay-top-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="badge badge-success">
                <i className="fa-solid fa-shield-check"></i> RBI Compliant Nodal Escrow
              </span>
              <span className="badge badge-blue">
                <i className="fa-solid fa-bolt"></i> IMPS / NEFT 24x7 Settlement
              </span>
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0F172A' }}>
              Digital Payments &amp; Disbursals Command
            </h1>
            <p style={{ color: '#64748B', fontSize: '0.88rem' }}>
              Monitoring inbound order payments, 10% platform cuts, vendor settlements, and staff salaries
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={fetchData}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid var(--pay-border)', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#334155', fontSize: '0.85rem' }}
            >
              <i className={`fa-solid fa-rotate ${loading ? 'fa-spin' : ''}`}></i> Sync Gateway
            </button>

            <button 
              onClick={handleExportCSV}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#090D16', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem' }}
            >
              <i className="fa-solid fa-file-excel" style={{ color: '#10B981' }}></i> Export Excel / CSV Sheet
            </button>
          </div>
        </div>

        {/* Action Success Alert */}
        {actionSuccessMsg && (
          <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#047857', padding: '12px 18px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa-solid fa-circle-check" style={{ fontSize: '1.1rem' }}></i>
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {/* Master Liquidity & Period Summary Ribbon */}
        <div style={{ background: '#090D16', borderRadius: '14px', padding: '20px', marginBottom: '24px', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fa-solid fa-chart-line" style={{ color: '#10B981', fontSize: '1.2rem' }}></i>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0 }}>
                Period Financial Gettings &amp; Sendings Summary
              </h2>
            </div>

            {/* Time Period Filter Tabs */}
            <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.08)', padding: '4px', borderRadius: '8px' }}>
              {[
                { id: 'all', label: 'All Time' },
                { id: 'today', label: '📅 Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'week', label: 'This Week (7D)' },
                { id: 'month', label: 'This Month (30D)' }
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setDatePeriodFilter(p.id)}
                  style={{
                    background: datePeriodFilter === p.id ? '#10B981' : 'transparent',
                    color: datePeriodFilter === p.id ? '#090D16' : '#94A3B8',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: '800',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            {/* Period Inbound Gettings */}
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '16px', borderLeft: '4px solid #10B981' }}>
              <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' }}>
                Period Inbound Gettings (Received)
              </span>
              <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#34D399', marginTop: '4px' }}>
                {formatINR(periodStats.inbound)}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '4px' }}>
                Customer payments captured ({datePeriodFilter})
              </div>
            </div>

            {/* Period Outbound Sendings */}
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '16px', borderLeft: '4px solid #60A5FA' }}>
              <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' }}>
                Period Outbound Sendings (Disbursed)
              </span>
              <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#60A5FA', marginTop: '4px' }}>
                {formatINR(periodStats.outbound)}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '4px' }}>
                Vendor settlements &amp; salaries paid
              </div>
            </div>

            {/* Period Net Balance */}
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '16px', borderLeft: '4px solid #A78BFA' }}>
              <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' }}>
                Period Net Cash Surplus
              </span>
              <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#C084FC', marginTop: '4px' }}>
                {formatINR(periodStats.netBalance)}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '4px' }}>
                Gettings minus sendings balance
              </div>
            </div>

            {/* Pending Approvals Count */}
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '16px', borderLeft: '4px solid #F59E0B' }}>
              <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' }}>
                Pending Verification Claims
              </span>
              <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#FBBF24', marginTop: '4px' }}>
                {formatINR(periodStats.pending)}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '4px' }}>
                <strong>{periodStats.count} records</strong> in active view
              </div>
            </div>
          </div>
        </div>

        {/* Filters, Search & Controls Bar */}
        <div style={{ background: '#fff', border: '1px solid var(--pay-border)', borderRadius: '12px', padding: '20px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0F172A' }}>
                {activeTab === 'all' && 'All Inbound & Outbound Treasury Transactions'}
                {activeTab === 'sellers' && 'Seller Settlements & Escrow Deductions'}
                {activeTab === 'riders' && 'Delivery Courier Fleet Compensation Ledger'}
                {activeTab === 'warehouse' && 'Warehouse Logistics Staff & Manager Payroll'}
                {activeTab === 'pending' && 'Pending Verification & Compliance Release Queue'}
                {activeTab === 'returns' && 'Customer Return Refunds (Warehouse QC Verified)'}
              </h2>
              <span className="badge badge-blue">
                {activeTab === 'returns' ? `${returnRefunds.length} Refunds` : `${filteredList.length} Total Records`}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '12px', color: '#94A3B8', fontSize: '0.85rem' }}></i>
                <input 
                  type="text" 
                  placeholder="Search Product, TXN #, UTR, Name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ padding: '9px 12px 9px 34px', border: '1px solid var(--pay-border)', borderRadius: '6px', fontSize: '0.85rem', width: '250px' }}
                />
              </div>

              <select 
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{ padding: '9px 14px', border: '1px solid var(--pay-border)', borderRadius: '6px', fontSize: '0.85rem', color: '#334155' }}
              >
                <option value="ALL">All Transaction Types</option>
                <option value="INBOUND_CUSTOMER_PAYMENT">Customer Payments Inbound</option>
                <option value="SELLER_SETTLEMENT">Seller Settlements Outbound</option>
                <option value="RIDER_PAYOUT">Delivery Rider Payouts</option>
                <option value="WAREHOUSE_SALARY">Warehouse Manager Payroll</option>
              </select>

              {/* Page Size Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: '700' }}>Show:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  style={{ padding: '9px 12px', border: '1px solid var(--pay-border)', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '800', color: '#0F172A', background: '#F8FAFC' }}
                >
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={75}>75 per page</option>
                  <option value={100}>100 per page</option>
                  <option value={99999}>All Records</option>
                </select>
              </div>
            </div>
          </div>

          {activeTab === 'returns' ? (
            <div style={{ overflowX: 'auto' }}>
              <div style={{
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
                borderRadius: '8px',
                padding: '12px 18px',
                marginBottom: '16px',
                fontSize: '0.86rem',
                color: '#065F46',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <i className="fa-solid fa-circle-check" style={{ fontSize: '1.2rem', color: '#059669' }}></i>
                <div>
                  <strong>STRICT RETURN REIMBURSEMENT PROTOCOL:</strong> All returns listed below have passed physical Quality Control (QC) inspection at the destination Warehouse Hub.
                </div>
              </div>

              {loadingReturns ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>
                  <i className="fa-solid fa-spinner fa-spin fa-2x" style={{ color: '#059669', marginBottom: '10px' }}></i>
                  <div>Loading QC-verified return claims...</div>
                </div>
              ) : returnRefunds.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>
                  <i className="fa-solid fa-box-check fa-3x" style={{ color: '#A7F3D0', marginBottom: '12px' }}></i>
                  <h4 style={{ color: '#0F172A', marginBottom: '4px' }}>No Pending Customer Return Refunds</h4>
                  <p style={{ fontSize: '0.85rem' }}>When warehouse teams inspect return packages and request refund disbursal, they will appear here.</p>
                </div>
              ) : (
                <div className="pay-table-wrapper">
                  <table className="pay-table">
                    <thead>
                      <tr>
                        <th>Return &amp; Order #</th>
                        <th>Customer Profile</th>
                        <th>Returned Product</th>
                        <th>Warehouse QC Verification</th>
                        <th>Refund Preference</th>
                        <th style={{ textAlign: 'right' }}>Refund Amount</th>
                        <th style={{ textAlign: 'center' }}>Status &amp; Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnRefunds.map(ret => (
                        <tr key={ret._id}>
                          <td>
                            <div style={{ fontWeight: '800', color: '#0F172A', fontSize: '0.9rem' }}>
                              {ret.orderNumber || ret.orderId?.orderNumber}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                              ID: {ret._id.slice(-6).toUpperCase()}
                            </div>
                          </td>

                          <td>
                            <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '0.86rem' }}>
                              {ret.customerId?.name || ret.pickupAddress?.fullName}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
                              {ret.customerId?.email} &bull; {ret.pickupAddress?.phone}
                            </div>
                          </td>

                          <td>
                            {ret.items && ret.items[0] && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <img 
                                  src={ret.items[0].image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=100&q=80'} 
                                  alt="Product" 
                                  style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover' }}
                                />
                                <div>
                                  <div style={{ fontSize: '0.84rem', fontWeight: '700', color: '#0F172A' }}>
                                    {ret.items[0].name} (x{ret.items[0].quantity})
                                  </div>
                                  <div style={{ fontSize: '0.74rem', color: '#DC2626' }}>
                                    Reason: {ret.reasonCategory?.replace(/_/g, ' ')}
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>

                          <td>
                            <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#059669' }}>
                              🏢 {ret.destinationWarehouseId?.name || 'Warehouse Hub'}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: '2px' }}>
                              Inspector: <strong>{ret.warehouseQC?.inspectedBy}</strong>
                            </div>
                          </td>

                          <td>
                            <span className="method-chip">
                              <i className="fa-solid fa-wallet" style={{ fontSize: '0.7rem' }}></i>
                              {ret.refundPreference || 'WALLET'}
                            </span>
                          </td>

                          <td style={{ textAlign: 'right', fontWeight: '800', color: '#047857', fontSize: '0.98rem' }}>
                            {formatINR(ret.estimatedRefundAmount || ret.orderId?.totalAmount || 0)}
                          </td>

                          <td style={{ textAlign: 'center' }}>
                            {(ret.status === 'REFUND_DISBURSED' || ret.paymentApproval?.isDisbursed) ? (
                              <span className="badge badge-success">
                                <i className="fa-solid fa-circle-check"></i> Disbursed
                              </span>
                            ) : (
                              <button
                                className="btn-disburse"
                                disabled={processingId === ret._id}
                                onClick={() => handleDisburseReturnRefund(ret)}
                                style={{ padding: '8px 14px', fontSize: '0.8rem', fontWeight: '800' }}
                              >
                                <i className="fa-solid fa-money-bill-transfer"></i> {processingId === ret._id ? 'Disbursing...' : 'Disburse Refund'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* Streamlined Transactions Table */
            <div>
              {/* Top Pagination Navigation Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#F8FAFC', borderRadius: '8px', marginBottom: '14px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: '600' }}>
                  Showing <strong>{filteredList.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> – <strong>{Math.min(currentPage * pageSize, filteredList.length)}</strong> of <strong>{filteredList.length}</strong> transactions
                </div>

                {pageSize < 99999 && totalPages > 1 && (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      style={{
                        padding: '5px 12px',
                        background: currentPage === 1 ? '#E2E8F0' : '#0F172A',
                        color: currentPage === 1 ? '#94A3B8' : '#FFF',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <i className="fa-solid fa-chevron-left" style={{ marginRight: '4px' }}></i> Prev
                    </button>

                    <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#0F172A', padding: '0 8px' }}>
                      Page {currentPage} of {totalPages}
                    </span>

                    <button
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      style={{
                        padding: '5px 12px',
                        background: currentPage >= totalPages ? '#E2E8F0' : '#0F172A',
                        color: currentPage >= totalPages ? '#94A3B8' : '#FFF',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Next <i className="fa-solid fa-chevron-right" style={{ marginLeft: '4px' }}></i>
                    </button>
                  </div>
                )}
              </div>

              <div className="pay-table-wrapper">
                <table className="pay-table">
                  <thead>
                    <tr>
                      <th>Product &amp; Transaction ID</th>
                      <th>Flow &amp; Type</th>
                      <th>Received Date</th>
                      <th>Counterparty (Sender ➔ Recipient)</th>
                      <th>Payment Method</th>
                      <th style={{ textAlign: 'right' }}>Gross Amount</th>
                      <th style={{ textAlign: 'right' }}>Deductions</th>
                      <th style={{ textAlign: 'right' }}>Net Disbursed</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                      <th style={{ textAlign: 'center', minWidth: '180px' }}>Full Details &amp; Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedList.length === 0 ? (
                      <tr>
                        <td colSpan="10" style={{ textAlign: 'center', padding: '36px', color: '#94A3B8' }}>
                          No financial transactions matching the selected criteria.
                        </td>
                      </tr>
                    ) : (
                      paginatedList.map((tx) => {
                        const isInbound = tx.type === 'INBOUND_CUSTOMER_PAYMENT';
                        const isDisbursed = tx.status === 'DISBURSED' || tx.status === 'SUCCESS';
                        const isOnHold = tx.status === 'ON_HOLD';
                        const isPending = tx.status === 'PENDING_VERIFICATION';
                        const { date: rxDate, time: rxTime } = formatStackedDateTime(tx.receivedAt || tx.createdAt);
                        const firstItem = tx.orderId?.items?.[0];
                        const productImage = firstItem?.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=100&q=80';

                        return (
                          <tr key={tx._id}>
                            {/* Product Thumbnail & Txn ID - Clickable */}
                            <td>
                              <div 
                                onClick={() => setSelectedDetailTx(tx)}
                                style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                                title="Click to view full transaction details and actions"
                              >
                                <img 
                                  src={productImage} 
                                  alt="Product"
                                  style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '8px',
                                    objectFit: 'cover',
                                    border: '2px solid #3B82F6',
                                    flexShrink: 0
                                  }}
                                  onError={(e) => {
                                    e.target.src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=100&q=80';
                                  }}
                                />
                                <div>
                                  <strong style={{ color: '#2563EB', fontFamily: 'monospace', fontSize: '0.85rem' }}>{tx.transactionId}</strong>
                                  {tx.orderNumber && (
                                    <div style={{ fontSize: '0.72rem', color: '#2563EB', fontWeight: '700' }}>
                                      Order: #{tx.orderNumber}
                                    </div>
                                  )}
                                  {firstItem?.name && (
                                    <div style={{ fontSize: '0.74rem', color: '#0F172A', fontWeight: '700', maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {firstItem.name}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Flow & Type */}
                            <td>
                              {isInbound ? (
                                <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                                  <i className="fa-solid fa-arrow-down-left"></i> INBOUND
                                </span>
                              ) : (
                                <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>
                                  <i className="fa-solid fa-arrow-up-right"></i> OUTBOUND
                                </span>
                              )}
                              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#334155', marginTop: '4px' }}>
                                {tx.type === 'INBOUND_CUSTOMER_PAYMENT' && 'Customer Order Pay'}
                                {tx.type === 'SELLER_SETTLEMENT' && 'Seller Settlement'}
                                {tx.type === 'RIDER_PAYOUT' && 'Rider Trip Compensation'}
                                {tx.type === 'WAREHOUSE_SALARY' && 'Warehouse Manager Salary'}
                              </div>
                            </td>

                            {/* Received Date & Time Stacked */}
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <div style={{ fontWeight: '700', fontSize: '0.8rem', color: '#0F172A' }}>
                                <i className="fa-regular fa-calendar" style={{ color: '#2563EB', marginRight: '5px' }}></i>
                                {rxDate}
                              </div>
                              <div style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: '#64748B', marginTop: '2px' }}>
                                <i className="fa-regular fa-clock" style={{ color: '#10B981', marginRight: '5px' }}></i>
                                {rxTime}
                              </div>
                            </td>

                            {/* Counterparty */}
                            <td>
                              <div>
                                <span style={{ fontSize: '0.72rem', color: '#64748B' }}>From: </span>
                                <strong style={{ fontSize: '0.82rem' }}>{tx.sender?.name}</strong>
                              </div>
                              <div style={{ marginTop: '2px' }}>
                                <span style={{ fontSize: '0.72rem', color: '#64748B' }}>To: </span>
                                <strong style={{ color: '#0F172A', fontSize: '0.84rem' }}>{tx.recipient?.name}</strong>
                                {tx.recipient?.storeOrHubName && (
                                  <span style={{ fontSize: '0.74rem', color: '#2563EB', marginLeft: '4px' }}>
                                    ({tx.recipient.storeOrHubName})
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Payment Method */}
                            <td>
                              <span className="method-chip">
                                <i className="fa-solid fa-credit-card" style={{ fontSize: '0.7rem' }}></i>
                                {tx.paymentMethod}
                              </span>
                            </td>

                            {/* Gross Amount */}
                            <td style={{ textAlign: 'right', fontWeight: '800', color: isInbound ? '#047857' : '#0F172A' }}>
                              {formatINR(tx.amount)}
                            </td>

                            {/* Deductions */}
                            <td style={{ textAlign: 'right', color: '#DC2626', fontWeight: '600' }}>
                              {tx.totalDeductions > 0 ? `-${formatINR(tx.totalDeductions)}` : '₹0'}
                            </td>

                            {/* Net Disbursed */}
                            <td style={{ textAlign: 'right', fontWeight: '800', color: isInbound ? '#047857' : '#15803D' }}>
                              {formatINR(tx.netDisbursedAmount || tx.amount)}
                            </td>

                            {/* Verification Status */}
                            <td style={{ textAlign: 'center' }}>
                              {isDisbursed && (
                                <span className="badge badge-success">
                                  <i className="fa-solid fa-circle-check"></i> Settled
                                </span>
                              )}
                              {isPending && (
                                <span className="badge badge-pending">
                                  <i className="fa-solid fa-clock"></i> Verification Hold
                                </span>
                              )}
                              {isOnHold && (
                                <span className="badge badge-hold">
                                  <i className="fa-solid fa-hand"></i> Audit Hold
                                </span>
                              )}
                            </td>

                            {/* Full Details & Actions Button */}
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                                {/* Prominent See All Details Button */}
                                <button
                                  onClick={() => setSelectedDetailTx(tx)}
                                  style={{
                                    background: '#2563EB',
                                    color: '#FFFFFF',
                                    border: 'none',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '0.76rem',
                                    fontWeight: '800',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    width: '100%',
                                    justifyContent: 'center',
                                    boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)'
                                  }}
                                >
                                  <i className="fa-solid fa-eye"></i>
                                  See All Details
                                </button>

                                <button
                                  onClick={() => setSelectedVoucherTx(tx)}
                                  style={{
                                    background: '#0F172A',
                                    color: '#FFFFFF',
                                    border: 'none',
                                    padding: '5px 12px',
                                    borderRadius: '6px',
                                    fontSize: '0.74rem',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    width: '100%',
                                    justifyContent: 'center'
                                  }}
                                >
                                  <i className="fa-solid fa-file-invoice-dollar" style={{ color: '#10B981' }}></i>
                                  Voucher
                                </button>

                                {isPending && (
                                  <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                                    <button
                                      className="btn-disburse"
                                      disabled={processingId === tx._id}
                                      onClick={() => handleDisburse(tx._id, tx.recipient?.name, tx.netDisbursedAmount || tx.amount)}
                                      style={{ flex: 1, padding: '5px 8px', fontSize: '0.72rem' }}
                                      title="Verify bank account and execute instant IMPS/NEFT payout"
                                    >
                                      <i className="fa-solid fa-paper-plane"></i> Pay
                                    </button>
                                    <button
                                      className="btn-hold"
                                      disabled={processingId === tx._id}
                                      onClick={() => handleHold(tx._id, tx.recipient?.name)}
                                      style={{ padding: '5px 8px', fontSize: '0.72rem' }}
                                      title="Hold payout for compliance check"
                                    >
                                      <i className="fa-solid fa-pause"></i>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Bottom Pagination Bar */}
              {pageSize < 99999 && totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#F8FAFC', borderRadius: '8px', marginTop: '14px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                    Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({filteredList.length} total entries)
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      style={{
                        padding: '6px 14px',
                        background: currentPage === 1 ? '#E2E8F0' : '#0F172A',
                        color: currentPage === 1 ? '#94A3B8' : '#FFF',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.82rem',
                        fontWeight: '700',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <i className="fa-solid fa-chevron-left" style={{ marginRight: '4px' }}></i> Previous
                    </button>

                    <button
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      style={{
                        padding: '6px 14px',
                        background: currentPage >= totalPages ? '#E2E8F0' : '#0F172A',
                        color: currentPage >= totalPages ? '#94A3B8' : '#FFF',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.82rem',
                        fontWeight: '700',
                        cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Next <i className="fa-solid fa-chevron-right" style={{ marginLeft: '4px' }}></i>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live Gateway Webhook Stream */}
        <div style={{ background: '#fff', border: '1px solid var(--pay-border)', borderRadius: '12px', padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-satellite-dish" style={{ color: '#10B981' }}></i> Real-Time Gateway Event Stream ({livePayments.length})
            </h3>
            <span className="badge badge-success">
              <i className="fa-solid fa-wifi"></i> Gateway Webhook Active
            </span>
          </div>

          {livePayments.length === 0 ? (
            <p style={{ color: '#94A3B8', fontStyle: 'italic', fontSize: '0.85rem' }}>
              Listening for live customer checkout payments, gateway captures, and instant disbursal webhooks...
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {livePayments.slice(0, 5).map((ev, idx) => (
                <div key={idx} style={{ background: '#F8FAFC', padding: '10px 14px', borderRadius: '6px', fontSize: '0.85rem', borderLeft: '4px solid #10B981', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <strong>{ev.event || 'PAYMENT_EVENT'}</strong> &bull; TXN #{ev.transactionId || ev.orderNumber}
                  </div>
                  <div style={{ fontWeight: '800', color: '#047857' }}>
                    {formatINR(ev.amount || 0)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Full Transaction Details Modal */}
      {selectedDetailTx && (
        <TransactionDetailsModal
          transaction={selectedDetailTx}
          onClose={() => setSelectedDetailTx(null)}
          onDisburse={handleDisburse}
          onHold={handleHold}
          onReleaseHold={handleReleaseHold}
          onOpenVoucher={(tx) => setSelectedVoucherTx(tx)}
          processingId={processingId}
        />
      )}

      {/* Official Treasury Bank Disbursal Voucher Modal */}
      {selectedVoucherTx && (
        <TreasuryVoucherModal
          transaction={selectedVoucherTx}
          onClose={() => setSelectedVoucherTx(null)}
        />
      )}
    </div>
  );
}
