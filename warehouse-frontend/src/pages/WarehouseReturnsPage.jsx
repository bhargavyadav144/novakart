import React, { useEffect, useState, useMemo } from 'react';
import warehouseApi from '../services/warehouseApi';

export default function WarehouseReturnsPage({ warehouse }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [search, setSearch] = useState('');
  const [datePeriodFilter, setDatePeriodFilter] = useState('all'); // 'all', 'today', 'yesterday', 'week', 'month'
  const [pageSize, setPageSize] = useState(25); // 25, 50, 75, 100, 99999
  const [currentPage, setCurrentPage] = useState(1);

  // QC Form State
  const [conditionRating, setConditionRating] = useState('PRISTINE_TAGS_INTACT');
  const [qcNotes, setQcNotes] = useState('');
  const [tagsIntact, setTagsIntact] = useState(true);
  const [originalBox, setOriginalBox] = useState(true);
  const [unwornCondition, setUnwornCondition] = useState(true);
  const [submittingQC, setSubmittingQC] = useState(false);

  useEffect(() => {
    fetchReturnPackages();
  }, [warehouse]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, datePeriodFilter, pageSize]);

  const fetchReturnPackages = async () => {
    setLoading(true);
    try {
      const { data } = await warehouseApi.get('/returns/warehouse/pending-qc');
      if (data.success) {
        setPackages(data.packages || []);
      }
    } catch (err) {
      console.error('Error fetching warehouse returns:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenQCModal = (ret) => {
    setSelectedReturn(ret);
    setConditionRating('PRISTINE_TAGS_INTACT');
    setTagsIntact(true);
    setOriginalBox(true);
    setUnwornCondition(true);
    setQcNotes(`Physical item unboxed at ${warehouse?.name || 'Warehouse Hub'}. Tags intact, original accessories present, condition verified.`);
  };

  const handlePerformQC = async (passed) => {
    if (!selectedReturn) return;

    setSubmittingQC(true);
    try {
      const res = await warehouseApi.put(`/returns/warehouse/${selectedReturn._id}/qc-verify`, {
        passed,
        conditionRating: passed ? conditionRating : 'DAMAGED_REJECTED',
        qcNotes: qcNotes || (passed ? 'Product passed warehouse QC verification.' : 'Item failed inspection.')
      });

      if (res.data.success) {
        alert(passed
          ? '🎉 Quality Control PASSED! Payment Release Request has been formally forwarded to Payment Admin.'
          : 'QC Inspection Rejected. Return marked as QC_FAILED.');
        setSelectedReturn(null);
        fetchReturnPackages();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit QC inspection');
    } finally {
      setSubmittingQC(false);
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

  // Filtered & Sorted (Newest at top)
  const filteredPackages = useMemo(() => {
    const list = packages.filter(p => {
      if (!isWithinPeriod(p.createdAt, datePeriodFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchOrd = p.orderNumber?.toLowerCase().includes(q) || p.orderId?.orderNumber?.toLowerCase().includes(q);
        const matchCust = p.pickupAddress?.fullName?.toLowerCase().includes(q) || p.customerId?.name?.toLowerCase().includes(q);
        const matchItem = (p.items || []).some(i => i.name?.toLowerCase().includes(q));
        return matchOrd || matchCust || matchItem;
      }
      return true;
    });

    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [packages, datePeriodFilter, search]);

  // Metrics
  const totalPackages = filteredPackages.length;
  const pendingQC = filteredPackages.filter(p => ['PICKED_UP', 'WAREHOUSE_RECEIVED'].includes(p.status)).length;
  const qcApproved = filteredPackages.filter(p => p.status === 'REFUND_PENDING_APPROVAL').length;
  const paymentReleased = filteredPackages.filter(p => ['REFUND_DISBURSED', 'COMPLETED'].includes(p.status)).length;

  // Pagination calculation
  const totalPages = Math.ceil(filteredPackages.length / pageSize) || 1;
  const paginatedPackages = useMemo(() => {
    if (pageSize >= 99999) return filteredPackages;
    const start = (currentPage - 1) * pageSize;
    return filteredPackages.slice(start, start + pageSize);
  }, [filteredPackages, currentPage, pageSize]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      "Return Order Number",
      "Date Received",
      "Type",
      "Returned Product",
      "Customer Name",
      "Delivery Agent",
      "QC Rating",
      "QC Status"
    ];

    const rows = filteredPackages.map(p => {
      const itemNames = (p.items || []).map(i => `${i.name} (x${i.quantity})`).join('; ');
      return [
        `"${p.orderNumber || p.orderId?.orderNumber || ''}"`,
        `"${new Date(p.createdAt).toLocaleString('en-IN')}"`,
        `"${p.type || ''}"`,
        `"${itemNames.replace(/"/g, '""')}"`,
        `"${(p.pickupAddress?.fullName || p.customerId?.name || '').replace(/"/g, '""')}"`,
        `"${(p.assignedDeliveryAgentId?.fullName || '').replace(/"/g, '""')}"`,
        `"${p.warehouseQC?.conditionRating || 'N/A'}"`,
        `"${p.warehouseQC?.passed ? 'QC_PASSED' : 'PENDING_QC'}"`
      ].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Warehouse_QC_Returns_${datePeriodFilter.toUpperCase()}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Top Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
        borderRadius: '16px',
        padding: '24px 28px',
        color: '#FFFFFF',
        marginBottom: '24px',
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(59, 130, 246, 0.2)',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '0.78rem',
            color: '#93C5FD',
            marginBottom: '8px',
            fontWeight: '700'
          }}>
            <i className="fa-solid fa-microscope"></i> QUALITY CONTROL &amp; REFUND DISPATCH
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', margin: 0 }}>
            Warehouse Return Packages &amp; QC Verification
          </h1>
          <p style={{ margin: '6px 0 0 0', color: '#94A3B8', fontSize: '0.9rem' }}>
            Facility: <strong>{warehouse?.name || 'Central Warehouse'}</strong> &bull; Newest packages shown at top!
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={fetchReturnPackages}
            style={{
              background: '#0071E3',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 18px',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <i className="fa-solid fa-rotate"></i> Refresh Incoming
          </button>

          <button
            onClick={handleExportCSV}
            style={{
              background: '#090D16',
              color: '#FFFFFF',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              padding: '10px 18px',
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

      {/* KPI Cards & Period Selector */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '18px 20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div style={{ fontWeight: '800', color: '#0F172A', fontSize: '1rem' }}>
            Period Returns Performance Metrics
          </div>

          <div style={{ display: 'flex', gap: '6px', background: '#F1F5F9', padding: '4px', borderRadius: '8px' }}>
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
                  background: datePeriodFilter === p.id ? '#0071E3' : 'transparent',
                  color: datePeriodFilter === p.id ? '#FFFFFF' : '#475569',
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '10px', borderLeft: '4px solid #3B82F6' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#64748B' }}>TOTAL RETURN PACKAGES</div>
            <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>{totalPackages}</div>
          </div>

          <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '10px', borderLeft: '4px solid #F59E0B' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#D97706' }}>AWAITING QC INSPECTION</div>
            <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#B45309', marginTop: '2px' }}>{pendingQC}</div>
          </div>

          <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '10px', borderLeft: '4px solid #8B5CF6' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#7C3AED' }}>QC PASSED (FORWARDED TO FINANCE)</div>
            <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#6D28D9', marginTop: '2px' }}>{qcApproved}</div>
          </div>

          <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '10px', borderLeft: '4px solid #10B981' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#059669' }}>REFUND DISBURSED</div>
            <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#065F46', marginTop: '2px' }}>{paymentReleased}</div>
          </div>
        </div>
      </div>

      {/* Filter & Page Size Selector Bar */}
      <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <input
            type="text"
            placeholder="Search Order #, Customer, Product Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '9px 14px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.85rem', width: '280px' }}
          />

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

      {/* Packages Table */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>
          <i className="fa-solid fa-spinner fa-spin fa-2x" style={{ color: '#0071E3', marginBottom: '12px' }}></i>
          <div>Loading incoming return packages...</div>
        </div>
      ) : filteredPackages.length === 0 ? (
        <div style={{ background: '#FFFFFF', padding: '60px', textAlign: 'center', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <i className="fa-solid fa-boxes-packing fa-3x" style={{ color: '#94A3B8', marginBottom: '12px' }}></i>
          <h3 style={{ color: '#1E293B', marginBottom: '6px' }}>No Return Parcels for this Facility</h3>
          <p style={{ color: '#64748B', fontSize: '0.88rem' }}>When delivery agents collect returns and bring them to your hub, they will show up here.</p>
        </div>
      ) : (
        <div>
          {/* Top Pagination Navigation Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#F8FAFC', borderRadius: '8px', marginBottom: '12px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: '600' }}>
              Showing <strong>{(currentPage - 1) * pageSize + 1}</strong> – <strong>{Math.min(currentPage * pageSize, filteredPackages.length)}</strong> of <strong>{filteredPackages.length}</strong> return parcels (Newest first)
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

          <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '12px 18px', textAlign: 'left', fontSize: '0.8rem', color: '#475569' }}>Order / Request</th>
                  <th style={{ padding: '12px 18px', textAlign: 'left', fontSize: '0.8rem', color: '#475569' }}>Returned Product</th>
                  <th style={{ padding: '12px 18px', textAlign: 'left', fontSize: '0.8rem', color: '#475569' }}>Customer &amp; Courier Intake</th>
                  <th style={{ padding: '12px 18px', textAlign: 'left', fontSize: '0.8rem', color: '#475569' }}>QC Status &amp; Rating</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right', fontSize: '0.8rem', color: '#475569' }}>Warehouse Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPackages.map(p => (
                  <tr key={p._id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td 
                      onClick={() => handleOpenQCModal(p)}
                      style={{ padding: '14px 18px', verticalAlign: 'top', cursor: 'pointer' }}
                      title="Click to perform QC Inspection or view details"
                    >
                      <div style={{ fontWeight: '800', color: '#0071E3', fontSize: '0.9rem' }}>
                        #{p.orderNumber || p.orderId?.orderNumber}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                        Ref: {p._id.slice(-6).toUpperCase()}
                      </div>
                      <span style={{
                        display: 'inline-block',
                        marginTop: '4px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: '800',
                        background: p.type === 'EXCHANGE' ? '#FEF3C7' : '#EFF6FF',
                        color: p.type === 'EXCHANGE' ? '#B45309' : '#1E40AF'
                      }}>
                        {p.type}
                      </span>
                    </td>

                    <td 
                      onClick={() => handleOpenQCModal(p)}
                      style={{ padding: '14px 18px', verticalAlign: 'top', cursor: 'pointer' }}
                      title="Click to inspect returned product"
                    >
                      {p.items && p.items[0] && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img
                            src={p.items[0].image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=100&q=80'}
                            alt=""
                            style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover', border: '2px solid #0071E3' }}
                            onError={(e) => {
                              e.target.src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=100&q=80';
                            }}
                          />
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0071E3' }}>
                              {p.items[0].name} (x{p.items[0].quantity})
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: '600' }}>
                              Reason: {p.reasonCategory?.replace(/_/g, ' ')}
                            </div>
                          </div>
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '14px 18px', verticalAlign: 'top' }}>
                      <div style={{ fontSize: '0.84rem', fontWeight: '700', color: '#0F172A' }}>
                        Customer: {p.pickupAddress?.fullName || p.customerId?.name}
                      </div>
                      {p.assignedDeliveryAgentId && (
                        <div style={{ fontSize: '0.78rem', color: '#16A34A', marginTop: '3px' }}>
                          🛵 Picked up by: <strong>{p.assignedDeliveryAgentId.fullName}</strong>
                        </div>
                      )}
                      {p.agentPickup?.barcodeScanned && (
                        <div style={{ fontSize: '0.74rem', color: '#64748B', fontFamily: 'monospace', marginTop: '2px' }}>
                          Barcode: [{p.agentPickup.barcodeScanned}]
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '14px 18px', verticalAlign: 'top' }}>
                      {p.warehouseQC?.isInspected ? (
                        <div>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.74rem',
                            fontWeight: '800',
                            background: p.warehouseQC.passed ? '#D1FAE5' : '#FEE2E2',
                            color: p.warehouseQC.passed ? '#065F46' : '#991B1B'
                          }}>
                            {p.warehouseQC.passed ? '✓ QC PASSED' : '✕ QC FAILED'}
                          </span>
                          <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '4px' }}>
                            Rating: <strong>{p.warehouseQC.conditionRating}</strong>
                          </div>
                          {p.status === 'REFUND_PENDING_APPROVAL' && (
                            <div style={{ fontSize: '0.72rem', color: '#7C3AED', fontWeight: '700', marginTop: '2px' }}>
                              ⚡ Payment Request Sent to Finance
                            </div>
                          )}
                          {p.status === 'REFUND_DISBURSED' && (
                            <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: '700', marginTop: '2px' }}>
                              💰 Refund Disbursed by Payment Admin
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.74rem',
                          fontWeight: '800',
                          background: '#FEF3C7',
                          color: '#B45309'
                        }}>
                          ● AWAITING QC INSPECTION
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '14px 18px', textAlign: 'right', verticalAlign: 'top' }}>
                      {!p.warehouseQC?.isInspected ? (
                        <button
                          onClick={() => handleOpenQCModal(p)}
                          style={{
                            background: '#0071E3',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '8px 14px',
                            fontSize: '0.82rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <i className="fa-solid fa-microscope"></i> Perform QC Check
                        </button>
                      ) : (
                        <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                          Inspected by {p.warehouseQC.inspectedBy}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* QC INSPECTION MODAL */}
      {selectedReturn && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justify: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '560px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid #E2E8F0',
              background: '#0F172A',
              color: '#FFFFFF',
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '0.78rem', color: '#93C5FD', fontWeight: '700' }}>PHYSICAL RETURN INSPECTION</div>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>QC Check &bull; Order #{selectedReturn.orderNumber || selectedReturn.orderId?.orderNumber}</h3>
              </div>
              <button
                onClick={() => setSelectedReturn(null)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '24px' }}>
              <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '8px', marginBottom: '18px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '0.9rem' }}>
                  Item: {selectedReturn.items?.[0]?.name} (x{selectedReturn.items?.[0]?.quantity})
                </div>
                <div style={{ fontSize: '0.8rem', color: '#DC2626', marginTop: '4px' }}>
                  Customer Reason: {selectedReturn.reasonCategory?.replace(/_/g, ' ')}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontWeight: '700', fontSize: '0.85rem', marginBottom: '6px', color: '#334155' }}>
                  Condition Assessment Rating
                </label>
                <select
                  value={conditionRating}
                  onChange={(e) => setConditionRating(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.88rem' }}
                >
                  <option value="PRISTINE_TAGS_INTACT">Pristine - Unopened / Brand New with Tags</option>
                  <option value="GOOD_OPEN_BOX">Good - Open Box / Packaging Opened but Intact</option>
                  <option value="MINOR_DEFECT_RESTOCKABLE">Minor Cosmetic Flaw - Restockable as B-Grade</option>
                  <option value="DAMAGED_REJECTED">Damaged / Missing Accessories - Reject Return</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#334155', cursor: 'pointer' }}>
                  <input type="checkbox" checked={tagsIntact} onChange={(e) => setTagsIntact(e.target.checked)} />
                  Original Brand Tags &amp; Barcode Intact
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#334155', cursor: 'pointer' }}>
                  <input type="checkbox" checked={originalBox} onChange={(e) => setOriginalBox(e.target.checked)} />
                  Original Product Packaging Box Included
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#334155', cursor: 'pointer' }}>
                  <input type="checkbox" checked={unwornCondition} onChange={(e) => setUnwornCondition(e.target.checked)} />
                  No Signs of Physical Wear / Usage Stains
                </label>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: '700', fontSize: '0.85rem', marginBottom: '6px', color: '#334155' }}>
                  QC Inspector Log Notes
                </label>
                <textarea
                  value={qcNotes}
                  onChange={(e) => setQcNotes(e.target.value)}
                  rows="3"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  placeholder="Enter detailed physical inspection remarks..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button
                  disabled={submittingQC}
                  onClick={() => handlePerformQC(false)}
                  style={{
                    background: '#EF4444',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px',
                    fontWeight: '800',
                    fontSize: '0.88rem',
                    cursor: submittingQC ? 'not-allowed' : 'pointer'
                  }}
                >
                  ✕ Reject Return (QC Failed)
                </button>

                <button
                  disabled={submittingQC}
                  onClick={() => handlePerformQC(true)}
                  style={{
                    background: '#10B981',
                    color: '#090D16',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px',
                    fontWeight: '800',
                    fontSize: '0.88rem',
                    cursor: submittingQC ? 'not-allowed' : 'pointer'
                  }}
                >
                  ✓ Approve &amp; Request Refund Release
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
