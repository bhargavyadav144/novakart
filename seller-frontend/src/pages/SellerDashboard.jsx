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
  const [verificationProgress, setVerificationProgress] = useState(100);
  const [loading, setLoading] = useState(true);
  const [selectedLabelOrder, setSelectedLabelOrder] = useState(null);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState(null);
  const [selectedDetailOrder, setSelectedDetailOrder] = useState(null);

  const fetchDashboard = () => {
    Promise.all([
      sellerApi.get('/sellers/dashboard-stats'),
      sellerApi.get('/sellers/profile').catch(() => ({ data: {} }))
    ])
      .then(([statsRes, profileRes]) => {
        setStats(statsRes.data.stats);
        setOrders(statsRes.data.recentOrders || []);
        if (profileRes.data?.verificationProgress !== undefined) {
          setVerificationProgress(profileRes.data.verificationProgress);
        }
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
      {/* DYNAMIC PROGRESS TRACKING BANNER (Only displayed until 100% complete) */}
      {verificationProgress < 100 && (
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          borderRadius: '14px',
          padding: '20px 24px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.15)',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{
                background: '#f59e0b',
                color: '#000',
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '0.72rem',
                fontWeight: '800'
              }}>
                KYC INCOMPLETE: {verificationProgress}%
              </span>
              <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                Admin clearance requires 100% completion
              </span>
            </div>

            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', fontWeight: '800' }}>
              Action Required: Complete Merchant Verification ({verificationProgress}%)
            </h3>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#cbd5e1' }}>
              Submit your store premises photo, dual face &amp; fingerprint biometrics, government ID, and product categories to activate customer storefront visibility.
            </p>

            {/* Dynamic Progress Bar */}
            <div style={{
              width: '100%',
              maxWidth: '480px',
              height: '8px',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '4px',
              overflow: 'hidden',
              marginTop: '12px'
            }}>
              <div style={{
                width: `${verificationProgress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #10B981 0%, #34D399 100%)',
                transition: 'width 0.4s ease'
              }}></div>
            </div>
          </div>

          <div>
            <Link
              to="/verification"
              style={{
                background: '#10B981',
                color: '#ffffff',
                padding: '12px 20px',
                borderRadius: '10px',
                fontWeight: '800',
                fontSize: '0.88rem',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
              }}
            >
              <i className="fa-solid fa-shield-halved"></i> Complete Verification ({verificationProgress}%) &rarr;
            </Link>
          </div>
        </div>
      )}

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
