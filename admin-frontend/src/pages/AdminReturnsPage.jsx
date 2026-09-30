import React, { useEffect, useState } from 'react';
import adminApi, { formatINR } from '../services/adminApi';

export default function AdminReturnsPage() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown options
  const [warehouses, setWarehouses] = useState([]);
  const [agents, setAgents] = useState([]);

  // Dispatch Modal State
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [submittingDispatch, setSubmittingDispatch] = useState(false);

  useEffect(() => {
    fetchReturns();
    fetchOptions();
  }, [statusFilter]);

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.get('/returns/admin/all', {
        params: { status: statusFilter, search: searchQuery || undefined }
      });
      if (data.success) {
        setReturns(data.returns || []);
      }
    } catch (err) {
      console.error('Error fetching admin returns:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const [whRes, agentRes] = await Promise.allSettled([
        adminApi.get('/warehouses'),
        adminApi.get('/admin/delivery-agents')
      ]);

      if (whRes.status === 'fulfilled' && whRes.value.data.warehouses) {
        setWarehouses(whRes.value.data.warehouses);
      }
      if (agentRes.status === 'fulfilled' && agentRes.value.data.agents) {
        // Only active/approved agents
        setAgents(agentRes.value.data.agents.filter(a => a.isApproved !== false));
      }
    } catch (err) {
      console.error('Error fetching options:', err);
    }
  };

  const handleOpenDispatchModal = (ret) => {
    setSelectedReturn(ret);
    setSelectedWarehouseId(ret.destinationWarehouseId?._id || (warehouses[0]?._id || ''));
    setSelectedAgentId(ret.assignedDeliveryAgentId?._id || (agents[0]?._id || ''));
    setAdminNotes(`Return request approved by Central Admin. Scheduled for doorstep courier collection and routed to ${ret.destinationWarehouseId?.name || 'regional hub'} for QC verification.`);
  };

  const handleConfirmDispatch = async (e) => {
    e.preventDefault();
    if (!selectedReturn) return;

    setSubmittingDispatch(true);
    try {
      const res = await adminApi.put(`/returns/admin/${selectedReturn._id}/approve-and-dispatch`, {
        destinationWarehouseId: selectedWarehouseId,
        assignedDeliveryAgentId: selectedAgentId,
        adminNotes
      });

      if (res.data.success) {
        alert(`🎉 Return #${selectedReturn._id} accepted! Courier agent and Warehouse hub have been notified.`);
        setSelectedReturn(null);
        fetchReturns();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to dispatch return');
    } finally {
      setSubmittingDispatch(false);
    }
  };

  const handleRejectReturn = async (ret) => {
    const reason = prompt(`Provide reason for rejecting Return #${ret._id}:`, 'Item outside 7-day return policy or non-returnable category');
    if (!reason) return;

    try {
      const res = await adminApi.put(`/returns/admin/${ret._id}/reject`, { reason });
      if (res.data.success) {
        alert('Return request rejected.');
        fetchReturns();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject return');
    }
  };

  // Metrics
  const totalReturns = returns.length;
  const pendingAdminApproval = returns.filter(r => r.status === 'REQUESTED').length;
  const inTransitOrPickup = returns.filter(r => ['ADMIN_APPROVED', 'PICKUP_ASSIGNED', 'PICKED_UP'].includes(r.status)).length;
  const inWarehouseQC = returns.filter(r => ['WAREHOUSE_RECEIVED', 'REFUND_PENDING_APPROVAL'].includes(r.status)).length;
  const refundedCount = returns.filter(r => ['REFUND_DISBURSED', 'COMPLETED'].includes(r.status)).length;

  const getStageBadge = (status) => {
    switch (status) {
      case 'REQUESTED':
        return <span style={{ background: '#FEF3C7', color: '#B45309', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '800' }}>1. AWAITING ADMIN</span>;
      case 'ADMIN_APPROVED':
      case 'PICKUP_ASSIGNED':
        return <span style={{ background: '#DBEAFE', color: '#1E40AF', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '800' }}>2. DISPATCHED (HUB+AGENT)</span>;
      case 'PICKED_UP':
        return <span style={{ background: '#E0E7FF', color: '#4338CA', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '800' }}>3. PICKED UP (EN ROUTE)</span>;
      case 'REFUND_PENDING_APPROVAL':
        return <span style={{ background: '#FCE7F3', color: '#9D174D', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '800' }}>4. QC PASSED (TREASURY AWAITING)</span>;
      case 'REFUND_DISBURSED':
      case 'COMPLETED':
        return <span style={{ background: '#D1FAE5', color: '#065F46', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '800' }}>5. REFUND DISBURSED</span>;
      case 'QC_FAILED':
      case 'REJECTED':
        return <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '800' }}>✕ REJECTED</span>;
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div>
      {/* Top Header */}
      <div className="admin-top-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: '800', color: '#0F172A', margin: 0 }}>
            Return &amp; Refund Command Pipeline
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.88rem', margin: '4px 0 0' }}>
            5-Stage Verification: Customer Request ➔ Admin Dispatch ➔ Courier Pickup ➔ Warehouse QC ➔ Payment Release
          </p>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', borderLeft: '4px solid #3B82F6' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748B' }}>TOTAL RETURNS</div>
          <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0F172A' }}>{totalReturns}</div>
        </div>
        <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', borderLeft: '4px solid #F59E0B' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#D97706' }}>1. PENDING DISPATCH</div>
          <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#B45309' }}>{pendingAdminApproval}</div>
        </div>
        <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', borderLeft: '4px solid #6366F1' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#4F46E5' }}>2 &amp; 3. COURIER TRANSIT</div>
          <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#4338CA' }}>{inTransitOrPickup}</div>
        </div>
        <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', borderLeft: '4px solid #EC4899' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#DB2777' }}>4. WAREHOUSE QC CHECK</div>
          <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#9D174D' }}>{inWarehouseQC}</div>
        </div>
        <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', borderLeft: '4px solid #10B981' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#059669' }}>5. REFUND DISBURSED</div>
          <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#065F46' }}>{refundedCount}</div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        padding: '16px 20px',
        border: '1px solid #E2E8F0',
        marginBottom: '20px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { key: 'ALL', label: 'All Returns' },
            { key: 'REQUESTED', label: '⚠️ Needs Admin Approval' },
            { key: 'ADMIN_APPROVED', label: 'Dispatched to Courier' },
            { key: 'PICKED_UP', label: 'Picked Up (Doorstep)' },
            { key: 'REFUND_PENDING_APPROVAL', label: 'QC Passed (Awaiting Refund)' },
            { key: 'REFUND_DISBURSED', label: 'Refund Disbursed' }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              style={{
                background: statusFilter === f.key ? '#0071E3' : '#F1F5F9',
                color: statusFilter === f.key ? '#FFFFFF' : '#475569',
                border: 'none',
                borderRadius: '6px',
                padding: '7px 14px',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search Order # or Customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchReturns()}
            style={{
              padding: '7px 12px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '0.85rem',
              width: '240px'
            }}
          />
          <button
            onClick={fetchReturns}
            style={{
              background: '#0F172A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              padding: '7px 14px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Search
          </button>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>
          <i className="fa-solid fa-spinner fa-spin fa-2x" style={{ color: '#0071E3', marginBottom: '12px' }}></i>
          <div>Loading platform return requests...</div>
        </div>
      ) : returns.length === 0 ? (
        <div style={{ background: '#FFFFFF', padding: '60px', textAlign: 'center', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <i className="fa-solid fa-box-open fa-3x" style={{ color: '#94A3B8', marginBottom: '12px' }}></i>
          <h3 style={{ color: '#1E293B' }}>No return requests found</h3>
          <p style={{ color: '#64748B', fontSize: '0.88rem' }}>Try clearing your filters or check back when customers request returns.</p>
        </div>
      ) : (
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', color: '#475569' }}>Order &amp; Type</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', color: '#475569' }}>Customer &amp; Address</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', color: '#475569' }}>Product &amp; Reason</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', color: '#475569' }}>Hub &amp; Courier Assignment</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', color: '#475569' }}>Estimated Refund</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', color: '#475569' }}>Pipeline Stage</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.8rem', color: '#475569' }}>Admin Actions</th>
              </tr>
            </thead>
            <tbody>
              {returns.map(ret => (
                <tr key={ret._id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: '800', color: '#0F172A', fontSize: '0.9rem' }}>
                      {ret.orderNumber || ret.orderId?.orderNumber}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                      ID: {ret._id.slice(-6).toUpperCase()}
                    </div>
                    <span style={{
                      display: 'inline-block',
                      marginTop: '4px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: '800',
                      background: ret.type === 'EXCHANGE' ? '#FEF3C7' : '#EFF6FF',
                      color: ret.type === 'EXCHANGE' ? '#B45309' : '#1E40AF'
                    }}>
                      {ret.type}
                    </span>
                  </td>

                  <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '0.88rem' }}>
                      {ret.pickupAddress?.fullName || ret.customerId?.name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                      📞 {ret.pickupAddress?.phone || ret.customerId?.phone}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      📍 {ret.pickupAddress?.street}, {ret.pickupAddress?.city}
                    </div>
                  </td>

                  <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                    {ret.items && ret.items[0] && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {ret.items[0].image && (
                          <img
                            src={ret.items[0].image}
                            alt=""
                            style={{ width: '36px', height: '36px', borderRadius: '4px', objectFit: 'cover' }}
                          />
                        )}
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0F172A' }}>
                            {ret.items[0].name} (x{ret.items[0].quantity})
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: '600' }}>
                            {ret.reasonCategory?.replace(/_/g, ' ')}
                          </div>
                        </div>
                      </div>
                    )}
                  </td>

                  <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                    {ret.destinationWarehouseId ? (
                      <div style={{ fontSize: '0.82rem', color: '#0F172A' }}>
                        🏢 <strong>{ret.destinationWarehouseId.name}</strong>
                        <div style={{ fontSize: '0.72rem', color: '#64748B' }}>({ret.destinationWarehouseId.city})</div>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontStyle: 'italic' }}>Warehouse not assigned</span>
                    )}

                    {ret.assignedDeliveryAgentId ? (
                      <div style={{ fontSize: '0.82rem', color: '#16A34A', marginTop: '4px' }}>
                        🛵 <strong>{ret.assignedDeliveryAgentId.fullName}</strong>
                        <span style={{ fontSize: '0.72rem', color: '#64748B' }}> ({ret.assignedDeliveryAgentId.vehicleNumber})</span>
                      </div>
                    ) : (
                      <span style={{ display: 'block', fontSize: '0.75rem', color: '#94A3B8', fontStyle: 'italic' }}>Courier not assigned</span>
                    )}
                  </td>

                  <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: '800', color: '#0F172A', fontSize: '0.92rem' }}>
                      {formatINR(ret.estimatedRefundAmount || ret.orderId?.totalAmount || 0)}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                      via {ret.refundPreference}
                    </div>
                  </td>

                  <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                    {getStageBadge(ret.status)}
                    {ret.warehouseQC?.isInspected && (
                      <div style={{ fontSize: '0.72rem', color: ret.warehouseQC.passed ? '#059669' : '#DC2626', marginTop: '4px', fontWeight: '700' }}>
                        QC: {ret.warehouseQC.conditionRating}
                      </div>
                    )}
                  </td>

                  <td style={{ padding: '14px 16px', textAlign: 'right', verticalAlign: 'top' }}>
                    {ret.status === 'REQUESTED' ? (
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleOpenDispatchModal(ret)}
                          style={{
                            background: '#0071E3',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          Approve &amp; Dispatch
                        </button>
                        <button
                          onClick={() => handleRejectReturn(ret)}
                          style={{
                            background: '#FEE2E2',
                            color: '#DC2626',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                        Approved by {ret.adminApproval?.approvedBy || 'Admin'}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* APPROVE & DISPATCH MODAL */}
      {selectedReturn && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '560px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#F8FAFC'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: '#0F172A' }}>
                  Admin Return Acceptance &amp; Hub Dispatch
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                  Order: {selectedReturn.orderNumber} | Customer: {selectedReturn.pickupAddress?.fullName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReturn(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#94A3B8' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleConfirmDispatch} style={{ padding: '24px' }}>
              <div style={{
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '18px',
                fontSize: '0.85rem',
                color: '#1E40AF'
              }}>
                <strong>Verification Workflow:</strong> Approving this return will send a doorstep pickup order to the assigned Delivery Agent. Once picked up, it is transported to the selected Warehouse Hub for Quality Control (QC). Only after QC passes will the Payment Admin receive the refund release request.
              </div>

              {/* Warehouse Destination */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Select Destination Warehouse Hub (QC Inspection Facility) *
                </label>
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.88rem',
                    background: '#FFFFFF'
                  }}
                >
                  {warehouses.map(wh => (
                    <option key={wh._id} value={wh._id}>
                      {wh.name} - {wh.city}, {wh.state} ({wh.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Delivery Agent Assignment */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Assign Doorstep Pickup Courier / Delivery Agent *
                </label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.88rem',
                    background: '#FFFFFF'
                  }}
                >
                  {agents.map(ag => (
                    <option key={ag._id} value={ag._id}>
                      {ag.fullName} - {ag.vehicleType} ({ag.vehicleNumber}) [Phone: {ag.phone}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Admin Notes */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Admin Operational Notes
                </label>
                <textarea
                  rows={3}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedReturn(null)}
                  style={{
                    background: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '10px 18px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDispatch}
                  style={{
                    background: '#0071E3',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 24px',
                    fontWeight: '700',
                    cursor: submittingDispatch ? 'not-allowed' : 'pointer'
                  }}
                >
                  {submittingDispatch ? 'Dispatching...' : 'Approve & Dispatch Courier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
