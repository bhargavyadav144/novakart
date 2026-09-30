import React, { useEffect, useState } from 'react';
import sellerApi, { formatINR } from '../services/sellerApi';
import StatsMetricCard from '../components/StatsMetricCard';
import PackageShippingLabelModal from '../components/PackageShippingLabelModal';
import SellerInvoiceModal from '../components/SellerInvoiceModal';
import SellerOrderDetailsModal from '../components/SellerOrderDetailsModal';
import { useSellerAuth } from '../context/SellerAuthContext';
import { Link } from 'react-router-dom';

export default function SellerDashboard() {
  const { sellerUser } = useSellerAuth();
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLabelOrder, setSelectedLabelOrder] = useState(null);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState(null);
  const [selectedDetailOrder, setSelectedDetailOrder] = useState(null);

  const fetchDashboard = () => {
    sellerApi.get('/sellers/dashboard-stats')
      .then(({ data }) => {
        setStats(data.stats);
        setOrders(data.recentOrders || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleAcceptOrder = async (order) => {
    try {
      const { data } = await sellerApi.put(`/orders/seller/${order._id}/accept`);
      setSelectedLabelOrder(order);
      fetchDashboard();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to accept order.');
    }
  };

  if (loading) return <p style={{ padding: '30px', textAlign: 'center' }}>Loading merchant analytics...</p>;

  return (
    <div>
      <div className="seller-top-header">
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800' }}>Store Dashboard</h1>
          <p style={{ color: '#64748B', fontSize: '0.88rem' }}>Overview of revenue, stock levels and incoming customer orders</p>
        </div>
        <Link to="/products/new" className="btn-seller btn-seller-accent">
          <i className="fa-solid fa-plus"></i> Add Product to Customer Store
        </Link>
      </div>

      {/* METRIC CARDS */}
      <div className="stats-grid">
        <StatsMetricCard title="Total Revenue" value={formatINR(stats?.revenue || 0)} icon="fa-indian-rupee-sign" color="#10B981" />
        <StatsMetricCard title="Total Orders" value={stats?.totalOrders || 0} icon="fa-receipt" color="#1A237E" />
        <StatsMetricCard title="Pending Fulfillment" value={stats?.pendingOrders || 0} icon="fa-clock" color="#F59E0B" />
        <StatsMetricCard title="Active Listed Products" value={stats?.totalProducts || 0} icon="fa-boxes-stacked" color="#6366F1" />
      </div>

      {/* RECENT ORDERS */}
      <div style={{ background: '#fff', border: '1px solid var(--seller-border)', borderRadius: '10px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>Recent Incoming Orders</h3>
          <Link to="/orders" style={{ fontSize: '0.85rem', color: 'var(--seller-primary)', fontWeight: '600' }}>View All Orders &rarr;</Link>
        </div>

        {orders.length === 0 ? (
          <p style={{ color: '#888', fontStyle: 'italic', padding: '20px 0' }}>No incoming orders yet. Listed products are active on the customer store!</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total (₹)</th>
                <th>Status</th>
                <th>Fulfillment Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order._id}>
                  <td>
                    <strong 
                      style={{ color: '#1A237E', cursor: 'pointer' }}
                      onClick={() => setSelectedDetailOrder(order)}
                      title="Click to view full order details"
                    >
                      #{order.orderNumber}
                    </strong>
                  </td>
                  <td>{order.deliveryAddress?.fullName || 'Customer'}</td>
                  <td>{order.items?.length} items</td>
                  <td><strong>{formatINR(order.totalAmount)}</strong></td>
                  <td>
                    <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700' }}>
                      {order.orderStatus?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {order.orderStatus === 'PENDING' ? (
                        <button className="btn-accept" onClick={() => handleAcceptOrder(order)}>
                          <i className="fa-solid fa-check"></i> Accept &amp; Print Label
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedLabelOrder(order)}
                          style={{
                            background: '#10B981',
                            color: '#090D16',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontWeight: '800',
                            fontSize: '0.76rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Reprint package shipping label if lost or misplaced"
                        >
                          <i className="fa-solid fa-print"></i> Reprint Label
                        </button>
                      )}

                      <button
                        onClick={() => setSelectedInvoiceOrder(order)}
                        style={{
                          background: '#1A237E',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontSize: '0.76rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <i className="fa-solid fa-file-invoice"></i> Voucher
                      </button>

                      <button
                        onClick={() => setSelectedDetailOrder(order)}
                        style={{
                          background: '#F1F5F9',
                          color: '#334155',
                          border: '1px solid #CBD5E1',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontSize: '0.76rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <i className="fa-solid fa-eye"></i> Details
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedDetailOrder && (
        <SellerOrderDetailsModal
          order={selectedDetailOrder}
          onClose={() => setSelectedDetailOrder(null)}
          onAccept={handleAcceptOrder}
          onOpenInvoice={(ord) => setSelectedInvoiceOrder(ord)}
          onOpenLabel={(ord) => setSelectedLabelOrder(ord)}
        />
      )}

      {/* Package Shipping Label Modal */}
      {selectedLabelOrder && (
        <PackageShippingLabelModal
          order={selectedLabelOrder}
          onClose={() => setSelectedLabelOrder(null)}
        />
      )}

      {/* Merchant Invoice / Voucher Modal */}
      {selectedInvoiceOrder && (
        <SellerInvoiceModal
          order={selectedInvoiceOrder}
          onClose={() => setSelectedInvoiceOrder(null)}
        />
      )}
    </div>
  );
}
