import React, { useEffect, useState, useCallback, useMemo } from 'react';
import sellerApi, { formatINR, SOCKET_BASE_URL } from '../services/sellerApi';
import { useSellerAuth } from '../context/SellerAuthContext';
import { io } from 'socket.io-client';
import SellerInvoiceModal from '../components/SellerInvoiceModal';
import PackageShippingLabelModal from '../components/PackageShippingLabelModal';
import BulkShippingLabelsModal from '../components/BulkShippingLabelsModal';
import SellerOrderDetailsModal from '../components/SellerOrderDetailsModal';
import OrderChatModal from '../components/OrderChatModal';
import SellerBiometricModal from '../components/SellerBiometricModal';

const FALLBACK_PRODUCT_IMG = 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=400&q=80';

export default function SellerOrders() {
  const { sellerUser } = useSellerAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [datePeriodFilter, setDatePeriodFilter] = useState('all'); // 'all', 'today', 'yesterday', 'week', 'month'
  const [pageSize, setPageSize] = useState(25); // 25, 50, 75, 100, 99999
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState(null);
  const [selectedLabelOrder, setSelectedLabelOrder] = useState(null);
  const [showBulkLabelsModal, setShowBulkLabelsModal] = useState(false);
  const [selectedDetailOrder, setSelectedDetailOrder] = useState(null);

  // Customer Order Chat & Biometric Security Gate
  const [selectedChatOrder, setSelectedChatOrder] = useState(null);
  const [isBioModalOpen, setIsBioModalOpen] = useState(false);
  const [isChatBioVerified, setIsChatBioVerified] = useState(false);
  const [pendingChatOrder, setPendingChatOrder] = useState(null);

  const handleOpenChat = (order) => {
    if (isChatBioVerified) {
      setSelectedChatOrder(order);
    } else {
      setPendingChatOrder(order);
      setIsBioModalOpen(true);
    }
  };

  const handleBioVerifiedSuccess = () => {
    setIsChatBioVerified(true);
    setIsBioModalOpen(false);
    if (pendingChatOrder) {
      setSelectedChatOrder(pendingChatOrder);
      setPendingChatOrder(null);
    }
  };


  const fetchOrders = useCallback((isManual = false) => {
    if (isManual) setRefreshing(true);
    sellerApi.get('/orders/seller/incoming')
      .then(({ data }) => setOrders(data.orders || []))
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        if (isManual) setTimeout(() => setRefreshing(false), 500);
      });
  }, []);

  useEffect(() => {
    fetchOrders();

    const interval = setInterval(() => {
      fetchOrders();
    }, 6000);

    const socket = io(SOCKET_BASE_URL);
    if (sellerUser?.sellerId) {
      socket.emit('join_seller_room', sellerUser.sellerId);
    }
    if (sellerUser?.id) {
      socket.emit('join_user_room', sellerUser.id);
    }

    socket.on('new_incoming_order', () => {
      fetchOrders();
    });

    socket.on('order_status_update', () => {
      fetchOrders();
    });

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, [fetchOrders, sellerUser]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, datePeriodFilter, pageSize]);

  const handleAccept = async (order) => {
    try {
      const orderId = typeof order === 'object' ? order._id : order;
      await sellerApi.put(`/orders/seller/${orderId}/accept`);
      if (typeof order === 'object') {
        setSelectedLabelOrder(order);
      }
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.message || 'Error accepting order');
    }
  };

  const handleReject = async (orderId) => {
    const reason = prompt('Please enter cancellation / rejection reason:');
    if (reason === null) return;
    try {
      await sellerApi.put(`/orders/seller/${orderId}/reject`, { reason });
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.message || 'Error rejecting order');
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

  // Filtered & Sorted orders list (Newest first)
  const filteredOrders = useMemo(() => {
    const list = orders.filter(o => {
      // Fulfillment Status Filter
      if (statusFilter === 'PENDING' && o.orderStatus !== 'PENDING') return false;
      if (statusFilter === 'LABEL_PRINTED' && !['SELLER_ACCEPTED', 'ACCEPTED', 'AGENT_ASSIGNED'].includes(o.orderStatus)) return false;
      if (statusFilter === 'DISPATCHED' && !['DISPATCHED_TO_HUB', 'IN_REGIONAL_HUB', 'IN_TRANSIT_TO_BRANCH', 'AT_DELIVERY_BRANCH', 'OUT_FOR_DELIVERY'].includes(o.orderStatus)) return false;
      if (statusFilter === 'DELIVERED' && !['DELIVERED', 'COMPLETED'].includes(o.orderStatus)) return false;
      if (statusFilter === 'RETURNS' && !['CANCELLED', 'REJECTED', 'DOORSTEP_RETURNED', 'RTO_INITIATED', 'DOORSTEP_REJECTED'].includes(o.orderStatus)) return false;
      if (statusFilter !== 'ALL' && !['PENDING', 'LABEL_PRINTED', 'DISPATCHED', 'DELIVERED', 'RETURNS'].includes(statusFilter) && o.orderStatus !== statusFilter) return false;

      if (!isWithinPeriod(o.createdAt, datePeriodFilter)) return false;

      if (search) {
        const q = search.toLowerCase();
        const matchNumber = o.orderNumber?.toLowerCase().includes(q);
        const matchCustomer = o.deliveryAddress?.fullName?.toLowerCase().includes(q);
        const matchPhone = o.deliveryAddress?.phone?.includes(q);
        const matchItem = (o.items || []).some(i => i.name?.toLowerCase().includes(q));
        return matchNumber || matchCustomer || matchPhone || matchItem;
      }

      return true;
    });

    // Sort newest first
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [orders, statusFilter, datePeriodFilter, search]);

  // Summary stats
  const periodStats = useMemo(() => {
    let revenue = 0;
    let pendingCount = 0;
    filteredOrders.forEach(o => {
      revenue += o.totalAmount || 0;
      if (o.orderStatus === 'PENDING') pendingCount++;
    });

    return {
      count: filteredOrders.length,
      revenue,
      pendingCount
    };
  }, [filteredOrders]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;
  const paginatedOrders = useMemo(() => {
    if (pageSize >= 99999) return filteredOrders;
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      "Order Number",
      "Date & Time",
      "Customer Name",
      "Customer Phone",
      "Product Items",
      "Total Amount (INR)",
      "Payment Status",
      "Order Status"
    ];

    const rows = filteredOrders.map(o => {
      const itemNames = (o.items || []).map(i => `${i.name} (x${i.quantity})`).join('; ');
      return [
        `"${o.orderNumber || ''}"`,
        `"${new Date(o.createdAt).toLocaleString('en-IN')}"`,
        `"${(o.deliveryAddress?.fullName || '').replace(/"/g, '""')}"`,
        `"${o.deliveryAddress?.phone || ''}"`,
        `"${itemNames.replace(/"/g, '""')}"`,
        o.totalAmount || 0,
        `"${o.paymentStatus || ''}"`,
        `"${o.orderStatus || ''}"`
      ].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Seller_Store_Orders_${datePeriodFilter.toUpperCase()}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
            Store Orders &amp; Fulfillment
          </h2>
          <p style={{ color: '#64748B', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
            Multi-stage logistics tracking: Store &rarr; Mother Hub &rarr; Delivery Branch &rarr; Customer (Newest Orders at Top)
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => fetchOrders(true)}
            disabled={refreshing}
            className="btn-seller"
            style={{
              background: refreshing ? '#F1F5F9' : '#FFFFFF',
              border: '1px solid #CBD5E1',
              color: '#334155',
              fontWeight: '600',
              fontSize: '0.85rem',
              padding: '9px 16px',
              borderRadius: '8px',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <i className={`fa-solid fa-rotate ${refreshing ? 'fa-spin' : ''}`}></i>
            {refreshing ? 'Refreshing...' : 'Refresh Orders'}
          </button>

          <button
            onClick={() => setShowBulkLabelsModal(true)}
            style={{
              padding: '9px 18px',
              background: '#10B981',
              color: '#090D16',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '800',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.2)'
            }}
            title="Print only product package shipping labels for all orders in current filter"
          >
            <i className="fa-solid fa-tags"></i> Print All Labels ({filteredOrders.length})
          </button>

          <button
            onClick={handleExportCSV}
            style={{
              padding: '9px 18px',
              background: '#1A237E',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <i className="fa-solid fa-file-excel" style={{ color: '#10B981' }}></i> Export Excel / CSV
          </button>
        </div>
      </div>

      {/* Period Summary Ribbon */}
      <div style={{ background: '#1A237E', borderRadius: '12px', padding: '18px 20px', color: '#FFF', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-chart-line" style={{ color: '#818CF8', fontSize: '1.1rem' }}></i>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0 }}>Period Orders Summary</h3>
          </div>

          <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.12)', padding: '4px', borderRadius: '8px' }}>
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
                  background: datePeriodFilter === p.id ? '#818CF8' : 'transparent',
                  color: datePeriodFilter === p.id ? '#0F172A' : '#E0E7FF',
                  border: 'none',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '10px', padding: '14px', borderLeft: '4px solid #818CF8' }}>
            <div style={{ fontSize: '0.75rem', color: '#C5CAE9', fontWeight: '700', textTransform: 'uppercase' }}>Orders Total</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#818CF8', marginTop: '2px' }}>{periodStats.count}</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '10px', padding: '14px', borderLeft: '4px solid #34D399' }}>
            <div style={{ fontSize: '0.75rem', color: '#C5CAE9', fontWeight: '700', textTransform: 'uppercase' }}>Period Revenue</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#34D399', marginTop: '2px' }}>{formatINR(periodStats.revenue)}</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '10px', padding: '14px', borderLeft: '4px solid #FBBF24' }}>
            <div style={{ fontSize: '0.75rem', color: '#C5CAE9', fontWeight: '700', textTransform: 'uppercase' }}>New Pending Approval</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#FBBF24', marginTop: '2px' }}>{periodStats.pendingCount}</div>
          </div>
        </div>
      </div>

      {/* Fulfillment Status Tabs (Daily, New Orders, Label Printed, Dispatched, Delivered, Returns) */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[
          { id: 'ALL', label: '🌐 All Orders', color: '#64748B' },
          { id: 'PENDING', label: '🆕 New Orders (Need Label)', color: '#F59E0B' },
          { id: 'LABEL_PRINTED', label: '🏷️ Label Printed (Ready)', color: '#10B981' },
          { id: 'DISPATCHED', label: '🚚 Dispatched / In Transit', color: '#2563EB' },
          { id: 'DELIVERED', label: '✅ Delivered', color: '#059669' },
          { id: 'RETURNS', label: '↩️ Returns & Cancellations', color: '#EF4444' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            style={{
              padding: '10px 16px',
              background: statusFilter === tab.id ? tab.color : '#FFFFFF',
              color: statusFilter === tab.id ? '#FFFFFF' : '#334155',
              border: statusFilter === tab.id ? `1px solid ${tab.color}` : '1px solid #CBD5E1',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: '800',
              cursor: 'pointer',
              boxShadow: statusFilter === tab.id ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search & Control Bar */}
      <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '18px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1, minWidth: '260px' }}>
            <input
              type="text"
              placeholder="Search Order #, Customer, Phone, Product Item..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '9px 14px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.85rem', width: '100%', maxWidth: '360px' }}
            />
          </div>

          {/* Page Size Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: '700' }}>Show:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              style={{ padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '800', background: '#F8FAFC' }}
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

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#1A237E' }}></i>
          <p style={{ marginTop: '12px', color: '#64748B' }}>Loading store incoming orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div style={{ background: '#fff', padding: '60px 20px', textAlign: 'center', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <i className="fa-solid fa-box-open" style={{ fontSize: '3rem', color: '#94A3B8', marginBottom: '16px' }}></i>
          <h3 style={{ fontSize: '1.25rem', color: '#1E293B', marginBottom: '8px' }}>No orders found</h3>
          <p style={{ color: '#64748B', maxWidth: '450px', margin: '0 auto' }}>No orders match your selected filters.</p>
        </div>
      ) : (
        <div>
          {/* Top Pagination Navigation Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#F8FAFC', borderRadius: '8px', marginBottom: '12px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: '600' }}>
              Showing <strong>{(currentPage - 1) * pageSize + 1}</strong> – <strong>{Math.min(currentPage * pageSize, filteredOrders.length)}</strong> of <strong>{filteredOrders.length}</strong> orders (Newest first)
            </div>

            {pageSize < 99999 && totalPages > 1 && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  style={{
                    padding: '5px 12px',
                    background: currentPage === 1 ? '#E2E8F0' : '#1A237E',
                    color: currentPage === 1 ? '#94A3B8' : '#FFF',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  <i className="fa-solid fa-chevron-left"></i> Prev
                </button>

                <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#0F172A', padding: '0 8px' }}>
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  style={{
                    padding: '5px 12px',
                    background: currentPage >= totalPages ? '#E2E8F0' : '#1A237E',
                    color: currentPage >= totalPages ? '#94A3B8' : '#FFF',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
                  }}
                >
                  Next <i className="fa-solid fa-chevron-right"></i>
                </button>
              </div>
            )}
          </div>

          <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                  <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: '700', color: '#475569' }}>Product &amp; Order ID</th>
                  <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: '700', color: '#475569' }}>Customer Profile</th>
                  <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: '700', color: '#475569' }}>Total (₹)</th>
                  <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: '700', color: '#475569' }}>Status</th>
                  <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: '700', color: '#475569', textAlign: 'center' }}>Label &amp; Voucher Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map(o => {
                  const firstItem = o.items?.[0];
                  const itemImg = firstItem?.image || FALLBACK_PRODUCT_IMG;

                  return (
                    <tr key={o._id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      {/* Product Thumbnail & Order ID - Clickable */}
                      <td style={{ padding: '14px 16px' }}>
                        <div 
                          onClick={() => setSelectedDetailOrder(o)}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                          title="Click to view full order details"
                        >
                          <img
                            src={itemImg}
                            alt="Product"
                            style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '8px',
                              objectFit: 'cover',
                              border: '2px solid #1A237E',
                              flexShrink: 0
                            }}
                            onError={(e) => {
                              e.target.src = FALLBACK_PRODUCT_IMG;
                            }}
                          />
                          <div>
                            <strong style={{ color: '#1A237E', fontSize: '0.9rem' }}>#{o.orderNumber}</strong>
                            {firstItem?.name && (
                              <div style={{ fontSize: '0.74rem', color: '#0F172A', fontWeight: '700', maxWidth: '160px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {firstItem.name}
                              </div>
                            )}
                            <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                              {new Date(o.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Customer Profile */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '0.86rem' }}>
                          {o.deliveryAddress?.fullName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                          📞 {o.deliveryAddress?.phone}
                        </div>
                      </td>

                      {/* Total Amount */}
                      <td style={{ padding: '14px 16px', fontWeight: '800', color: '#0F172A', fontSize: '0.95rem' }}>
                        {formatINR(o.totalAmount)}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          background: o.orderStatus === 'PENDING' ? '#FEF3C7' : '#E8EAF6',
                          color: o.orderStatus === 'PENDING' ? '#D97706' : '#1A237E',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: '800'
                        }}>
                          {o.orderStatus?.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Label & Voucher Actions */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                          {o.orderStatus === 'PENDING' ? (
                            <button
                              onClick={() => handleAccept(o)}
                              style={{
                                background: '#10B981',
                                color: '#090D16',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '0.76rem',
                                fontWeight: '800',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
                              }}
                            >
                              <i className="fa-solid fa-print"></i> Accept &amp; Print Label
                            </button>
                          ) : (
                            <button
                              onClick={() => setSelectedLabelOrder(o)}
                              style={{
                                background: '#10B981',
                                color: '#090D16',
                                border: 'none',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: '800',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="Reprint shipping label if lost or misplaced"
                            >
                              <i className="fa-solid fa-print"></i> Reprint Label
                            </button>
                          )}

                          <button
                            onClick={() => setSelectedInvoiceOrder(o)}
                            style={{
                              background: '#1A237E',
                              color: '#FFFFFF',
                              border: 'none',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: '800',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <i className="fa-solid fa-file-invoice"></i> Voucher
                          </button>

                          <button
                            onClick={() => setSelectedDetailOrder(o)}
                            style={{
                              background: '#F1F5F9',
                              color: '#334155',
                              border: '1px solid #CBD5E1',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <i className="fa-solid fa-eye"></i> Details
                          </button>

                          <button
                            onClick={() => handleOpenChat(o)}
                            style={{
                              background: '#0F766E',
                              color: '#FFFFFF',
                              border: 'none',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: '800',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            title="Customer Support Chat (7-day return delivery window)"
                          >
                            <i className="fa-solid fa-comments"></i> Chat
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Seller Order Details Modal */}
      {selectedDetailOrder && (
        <SellerOrderDetailsModal
          order={selectedDetailOrder}
          onClose={() => setSelectedDetailOrder(null)}
          onAccept={handleAccept}
          onReject={handleReject}
          onOpenInvoice={(ord) => setSelectedInvoiceOrder(ord)}
          onOpenLabel={(ord) => setSelectedLabelOrder(ord)}
        />
      )}

      {/* Invoice Modal */}
      {selectedInvoiceOrder && (
        <SellerInvoiceModal
          order={selectedInvoiceOrder}
          onClose={() => setSelectedInvoiceOrder(null)}
        />
      )}

      {/* Shipping Label Modal */}
      {selectedLabelOrder && (
        <PackageShippingLabelModal
          order={selectedLabelOrder}
          onClose={() => setSelectedLabelOrder(null)}
        />
      )}

      {/* Bulk Shipping Labels Modal for All New/Filtered Orders */}
      {showBulkLabelsModal && (
        <BulkShippingLabelsModal
          orders={filteredOrders}
          onClose={() => setShowBulkLabelsModal(false)}
        />
      )}

      {/* Customer Order Chat Modal */}
      {selectedChatOrder && (
        <OrderChatModal
          orderId={selectedChatOrder._id}
          isOpen={Boolean(selectedChatOrder)}
          onClose={() => setSelectedChatOrder(null)}
        />
      )}

      {/* Biometric Verification Gate before Chat */}
      {isBioModalOpen && (
        <SellerBiometricModal
          isOpen={isBioModalOpen}
          onClose={() => { setIsBioModalOpen(false); setPendingChatOrder(null); }}
          onVerifiedSuccess={handleBioVerifiedSuccess}
          mode="VERIFY"
          actionContext="ORDER_CHAT"
          actionLabel="Proprietor Identity Authentication to Open Customer Support Chat"
        />
      )}
    </div>
  );
}

