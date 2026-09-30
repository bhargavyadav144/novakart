import React, { useEffect, useState } from 'react';
import adminApi, { formatINR } from '../services/adminApi';

export default function AdminDeliveryAgents() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = () => {
    adminApi.get('/admin/delivery-agents')
      .then(({ data }) => setAgents(data.agents || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleApprove = async (id) => {
    try {
      await adminApi.put(`/admin/delivery-agents/${id}/approve`);
      alert('🎉 Delivery agent approved! They can now go on duty & receive delivery radar requests.');
      fetchAgents();
    } catch (err) {
      alert('Failed to approve delivery agent');
    }
  };

  const handleReject = async (id) => {
    try {
      await adminApi.put(`/admin/delivery-agents/${id}/reject`);
      alert('Delivery agent rejected.');
      fetchAgents();
    } catch (err) {
      alert('Failed to reject delivery agent');
    }
  };

  const handleToggleBlock = async (id) => {
    try {
      const { data } = await adminApi.put(`/admin/delivery-agents/${id}/block`);
      alert(data.message);
      fetchAgents();
    } catch (err) {
      alert('Failed to toggle block status');
    }
  };

  const handleBankUpdate = async (id, status) => {
    try {
      await adminApi.put(`/admin/delivery-agents/${id}/bank-update`, { status });
      alert(`Bank details request ${status}!`);
      fetchAgents();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update bank details');
    }
  };

  const handleCreditWallet = async (id, name) => {
    const amountStr = window.prompt(`[Payment Dispute Support]\nEnter amount in ₹ to add directly to ${name}'s available wallet balance:`, '150');
    if (!amountStr || isNaN(amountStr) || Number(amountStr) <= 0) return;
    const reason = window.prompt(`Enter reason or support ticket notes:`, 'Payment adjustment / Admin support credit') || 'Admin Support Credit';
    try {
      const { data } = await adminApi.post('/admin/credit-rider-wallet', {
        riderId: id,
        amount: Number(amountStr),
        reason
      });
      alert(`✅ ${data.message}`);
      fetchAgents();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to credit wallet');
    }
  };

  return (
    <div>
      <div className="admin-top-header">
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800' }}>Delivery Fleet &amp; Driver KYC</h1>
          <p style={{ color: '#64748B', fontSize: '0.88rem' }}>Verify vehicle registration, license numbers and manage delivery dispatch permissions</p>
        </div>
      </div>

      {loading ? (
        <p>Loading fleet records...</p>
      ) : agents.length === 0 ? (
        <p>No delivery agents registered yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Agent Name</th>
              <th>Vehicle &amp; License</th>
              <th>Assigned Route Corridor</th>
              <th>Duty &amp; Bank Details</th>
              <th>KYC Status</th>
              <th>Wallet / Earnings</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {agents.map(a => (
              <tr key={a._id}>
                <td>
                  <strong>{a.fullName}</strong><br />
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{a.phone} &bull; {a.email}</span>
                </td>
                <td>
                  <strong>{a.vehicleType || 'Bike'}</strong> ({a.vehicleNumber || 'N/A'})<br />
                  <span style={{ fontSize: '0.75rem', color: '#3B82F6' }}>DL: {a.drivingLicense || 'N/A'}</span>
                </td>
                <td>
                  <div style={{ fontSize: '0.8rem', fontWeight: '800', color: '#0F172A' }}>
                    📍 {a.assignedRoute?.routeName || 'Guntur Corridor'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#059669', marginTop: '2px' }}>
                    PIN: {a.assignedRoute?.startPincode || '522001'} ➔ <strong>{a.assignedRoute?.endPincode || '522201'}</strong> ({a.assignedRoute?.endVillageName || 'Tenali Hub'})
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#64748B' }}>
                    Corridor Radius: {a.assignedRoute?.corridorRadiusKm || 10} km
                  </div>
                </td>
                <td>
                  <span style={{ color: a.isOnline ? '#10B981' : '#64748B', fontWeight: '700', fontSize: '0.8rem' }}>
                    <i className="fa-solid fa-circle" style={{ fontSize: '0.6rem', marginRight: '4px' }}></i>
                    {a.isOnline ? 'ONLINE' : 'OFFLINE'}
                  </span>
                  <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '4px' }}>
                    Bank: <strong>{a.bankDetails?.bankName || 'SBI'}</strong> (A/C: {a.bankDetails?.accountNumber ? '••••' + a.bankDetails.accountNumber.slice(-4) : 'N/A'})
                  </div>
                  {a.pendingBankDetails && (
                    <div style={{ marginTop: '6px', background: '#FEF3C7', border: '1px dashed #F59E0B', padding: '4px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>
                      <strong style={{ color: '#B45309' }}>⚠️ Pending Bank Change:</strong><br />
                      {a.pendingBankDetails.bankName} - {a.pendingBankDetails.accountNumber} ({a.pendingBankDetails.ifscCode})
                      <div style={{ marginTop: '4px', display: 'flex', gap: '4px' }}>
                        <button onClick={() => handleBankUpdate(a._id, 'approved')} style={{ background: '#10B981', color: '#fff', border: 'none', borderRadius: '3px', padding: '2px 6px', fontSize: '0.65rem', cursor: 'pointer' }}>Approve</button>
                        <button onClick={() => handleBankUpdate(a._id, 'rejected')} style={{ background: '#EF4444', color: '#fff', border: 'none', borderRadius: '3px', padding: '2px 6px', fontSize: '0.65rem', cursor: 'pointer' }}>Reject</button>
                      </div>
                    </div>
                  )}
                </td>
                <td>
                  <span style={{
                    background: a.status === 'approved' ? '#e7f4e8' : a.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                    color: a.status === 'approved' ? '#2e7d32' : a.status === 'rejected' ? '#dc2626' : '#d97706',
                    padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase'
                  }}>
                    {a.status}
                  </span>
                </td>
                <td>
                  <div>Wallet: <strong style={{ color: '#10B981' }}>{formatINR(a.availableBalance || 0)}</strong></div>
                  <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Total Earned: {formatINR(a.totalEarnings || 0)}</div>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      className="btn-approve"
                      style={{ background: '#0EA5E9', padding: '5px 10px', fontSize: '0.75rem' }}
                      onClick={async () => {
                        const endPin = window.prompt(`[Warehouse Manager Route Assignment]\nEnter Last Village / Stop Pincode for Rider ${a.fullName}:`, a.assignedRoute?.endPincode || '522201');
                        if (!endPin) return;
                        const endVillage = window.prompt(`Enter Last Village Name / Hub Name for PIN ${endPin}:`, a.assignedRoute?.endVillageName || 'Tenali Branch Hub (Last Stop)');
                        try {
                          await adminApi.put(`/delivery/agents/${a._id}/assign-route`, {
                            startPincode: '522001',
                            endPincode: endPin,
                            endVillageName: endVillage || `Village Stop (PIN: ${endPin})`,
                            corridorRadiusKm: 10,
                            routeName: `Hub Route (522001 ➔ ${endPin})`
                          });
                          alert(`✅ Route corridor updated for ${a.fullName}! Target End Pincode: ${endPin}`);
                          fetchAgents();
                        } catch (err) {
                          alert(err.response?.data?.message || 'Failed to update route corridor');
                        }
                      }}
                      title="Warehouse Manager ONLY: Assign rider route by entering last village pincode"
                    >
                      <i className="fa-solid fa-route"></i> Route PIN
                    </button>
                    <button
                      style={{ background: '#8B5CF6', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '700' }}
                      onClick={() => handleCreditWallet(a._id, a.fullName)}
                      title="Admin Payment Support: Credit funds to rider wallet for payment disputes"
                    >
                      <i className="fa-solid fa-wallet"></i> Credit Wallet
                    </button>
                    {a.status !== 'approved' && (
                      <button className="btn-approve" onClick={() => handleApprove(a._id)}>
                        <i className="fa-solid fa-check"></i> Approve
                      </button>
                    )}
                    {a.status !== 'rejected' && a.status !== 'approved' && (
                      <button className="btn-reject" onClick={() => handleReject(a._id)}>
                        <i className="fa-solid fa-xmark"></i> Reject
                      </button>
                    )}
                    <button className="btn-block" onClick={() => handleToggleBlock(a._id)}>
                      {a.userId?.isBlocked ? 'Unblock' : 'Block'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

