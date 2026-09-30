import React, { useEffect, useState, useMemo } from 'react';
import adminApi, { formatINR } from '../services/adminApi';
import AdminOrderDetailsModal from '../components/AdminOrderDetailsModal';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [datePeriodFilter, setDatePeriodFilter] = useState('all'); // 'all', 'today', 'yesterday', 'week', 'month'
  const [pageSize, setPageSize] = useState(25); // 25, 50, 75, 100, 99999
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchOrders = () => {
    setLoading(true);
    adminApi.get('/orders/admin/all')
      .then(({ data }) => setOrders(data.orders || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, datePeriodFilter, pageSize]);

  // Date period filtering
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
      // Status filter
      if (statusFilter !== 'ALL' && o.orderStatus !== statusFilter) return false;

      // Period filter
      if (!isWithinPeriod(o.createdAt, datePeriodFilter)) return false;

      // Search filter
      if (search) {
        const q = search.toLowerCase();
        const matchNumber = o.orderNumber?.toLowerCase().includes(q);
        const matchCustomer = o.deliveryAddress?.fullName?.toLowerCase().includes(q);
        const matchPhone = o.deliveryAddress?.phone?.includes(q);
        const matchSeller = o.sellerId?.storeName?.toLowerCase().includes(q);
        const matchItem = (o.items || []).some(i => i.name?.toLowerCase().includes(q));
        return matchNumber || matchCustomer || matchPhone || matchSeller || matchItem;
      }

      return true;
    });

    // Ensure newest orders are at the top
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [orders, statusFilter, datePeriodFilter, search]);

  // Period Summary Statistics
  const periodStats = useMemo(() => {
    let totalRevenue = 0;
    let deliveredCount = 0;
    let pendingCount = 0;

    filteredOrders.forEach(o => {
      totalRevenue += o.totalAmount || 0;
      if (o.orderStatus === 'DELIVERED') deliveredCount++;
      else if (o.orderStatus === 'PENDING' || o.orderStatus === 'OUT_FOR_DELIVERY') pendingCount++;
    });

    return {
      count: filteredOrders.length,
      totalRevenue,
      deliveredCount,
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

  // Export CSV Handler
  const handleExportCSV = () => {
    const headers = [
      "Order Number",
      "Date & Time",
      "Customer Name",
      "Customer Phone",
      "Seller Store",
      "Product Items",
      "Total Amount (INR)",
      "Payment Status",
      "Payment Method",
      "Order Status",
      "Delivery Agent"
    ];

    const rows = filteredOrders.map(o => {
      const itemNames = (o.items || []).map(i => `${i.name} (x${i.quantity})`).join('; ');
      return [
        `"${o.orderNumber || ''}"`,
        `"${new Date(o.createdAt).toLocaleString('en-IN')}"`,
        `"${(o.deliveryAddress?.fullName || '').replace(/"/g, '""')}"`,
        `"${o.deliveryAddress?.phone || ''}"`,
        `"${(o.sellerId?.storeName || '').replace(/"/g, '""')}"`,
        `"${itemNames.replace(/"/g, '""')}"`,
        o.totalAmount || 0,
        `"${o.paymentStatus || ''}"`,
        `"${o.paymentMethod || ''}"`,
        `"${o.orderStatus || ''}"`,
        `"${(o.deliveryAgentId?.fullName || 'Unassigned').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `NovaKart_Admin_Orders_${datePeriodFilter.toUpperCase()}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      {/* Top Header */}
      <div className="admin-top-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800', margin: 0 }}>Global Orders Command Monitor</h1>
          <p style={{ color: '#64748B', fontSize: '0.88rem', margin: '4px 0 0 0' }}>Live tracking across customers, merchant stores, and delivery agents (Newest Orders at Top)</p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={fetchOrders}
            style={{
              padding: '9px 16px',
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '0.85rem',
              color: '#334155',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className={`fa-solid fa-rotate ${loading ? 'fa-spin' : ''}`}></i> Refresh
          </button>

          <button
            onClick={handleExportCSV}
            style={{
              padding: '9px 18px',
              background: '#0F172A',
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

      {/* Period Statistics Card Ribbon */}
      <div style={{ background: '#0F172A', borderRadius: '12px', padding: '18px 20px', color: '#FFF', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-chart-pie" style={{ color: '#38BDF8', fontSize: '1.1rem' }}></i>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0 }}>Period Order Summary Stats</h3>
          </div>

          {/* Time Period Filter Selector */}
          <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.1)', padding: '4px', borderRadius: '8px' }}>
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
                  background: datePeriodFilter === p.id ? '#38BDF8' : 'transparent',
                  color: datePeriodFilter === p.id ? '#0F172A' : '#94A3B8',
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
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px', borderLeft: '4px solid #38BDF8' }}>
            <div style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' }}>Orders Count</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#38BDF8', marginTop: '2px' }}>{periodStats.count}</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px', borderLeft: '4px solid #34D399' }}>
            <div style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' }}>Total Revenue</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#34D399', marginTop: '2px' }}>{formatINR(periodStats.totalRevenue)}</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px', borderLeft: '4px solid #FBBF24' }}>
            <div style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' }}>In Transit / Pending</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#FBBF24', marginTop: '2px' }}>{periodStats.pendingCount}</div>
          </div>
        </div>
      </div>

      {/* Filters & Search Control Bar */}
      <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '18px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search Order #, Customer, Phone, Item..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '9px 14px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.85rem', width: '280px' }}
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '9px 14px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.85rem', color: '#334155' }}
            >
              <option value="ALL">All Order Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="ACCEPTED">Accepted by Store</option>
              <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Page Size Selector */}
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
        <p style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>Loading global order logs...</p>
      ) : filteredOrders.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>No orders match the selected filters.</p>
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
                    background: currentPage === 1 ? '#E2E8F0' : '#0F172A',
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
                    background: currentPage >= totalPages ? '#E2E8F0' : '#0F172A',
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

          <div style={{ background: '#FFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th>Product &amp; Order #</th>
                  <th>Customer Profile</th>
                  <th>Seller Store</th>
                  <th>Assigned Agent</th>
                  <th style={{ textAlign: 'right' }}>Total Amount</th>
                  <th>Payment</th>
                  <th>Order Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map(o => {
                  const firstItem = o.items?.[0];
                  const itemImg = firstItem?.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=100&q=80';

                  return (
                    <tr key={o._id}>
                      {/* Product Thumbnail & Order # - Clickable */}
                      <td>
                        <div 
                          onClick={() => setSelectedOrder(o)}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                          title="Click to view full order details"
                        >
                          <img
                            src={itemImg}
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
                            <strong style={{ color: '#2563EB', fontSize: '0.88rem' }}>#{o.orderNumber}</strong>
                            {firstItem?.name && (
                              <div style={{ fontSize: '0.74rem', color: '#0F172A', fontWeight: '700', maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                      <td>
                        <strong style={{ color: '#0F172A', fontSize: '0.86rem' }}>{o.deliveryAddress?.fullName}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{o.deliveryAddress?.phone}</div>
                      </td>

                      {/* Seller Store */}
                      <td>
                        <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '0.85rem' }}>{o.sellerId?.storeName || 'Merchant'}</div>
                      </td>

                      {/* Assigned Delivery Agent */}
                      <td>
                        {o.deliveryAgentId ? (
                          <span style={{ color: '#10B981', fontWeight: '600', fontSize: '0.82rem' }}>
                            <i className="fa-solid fa-motorcycle"></i> {o.deliveryAgentId.fullName} ({o.deliveryAgentId.vehicleNumber})
                          </span>
                        ) : (
                          <span style={{ color: '#F59E0B', fontStyle: 'italic', fontSize: '0.78rem' }}>Awaiting Dispatch</span>
                        )}
                      </td>

                      {/* Total Amount */}
                      <td style={{ textAlign: 'right', fontWeight: '800', color: '#0F172A', fontSize: '0.92rem' }}>
                        {formatINR(o.totalAmount)}
                      </td>

                      {/* Payment Status */}
                      <td>
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: o.paymentStatus === 'PAID' ? '#10B981' : '#F59E0B' }}>
                          {o.paymentStatus}
                        </span>
                      </td>

                      {/* Order Status */}
                      <td>
                        <span style={{
                          background: '#e0f2fe',
                          color: '#0369a1',
                          padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700'
                        }}>
                          {o.orderStatus?.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* See All Details Button */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => setSelectedOrder(o)}
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
                            gap: '6px'
                          }}
                        >
                          <i className="fa-solid fa-eye"></i> See All Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Admin Order Details Modal */}
      {selectedOrder && (
        <AdminOrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}
