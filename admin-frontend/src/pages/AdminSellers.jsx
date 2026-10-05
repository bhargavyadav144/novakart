import React, { useEffect, useState } from 'react';
import adminApi, { formatINR } from '../services/adminApi';

const AVAILABLE_CATEGORIES = [
  'Electronics',
  'Groceries',
  'Fashion',
  'Home & Kitchen',
  'Beauty & Health',
  'Sports & Fitness',
  'Books & Stationery',
  'Toys & Baby Care'
];

export default function AdminSellers() {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [modalCategories, setModalCategories] = useState([]);
  const [submittingAction, setSubmittingAction] = useState(false);

  const fetchSellers = () => {
    adminApi.get('/admin/sellers')
      .then(({ data }) => setSellers(data.sellers || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSellers();
  }, []);

  const openDossier = (seller) => {
    setSelectedSeller(seller);
    // Initialize approved categories with currently approved, or fallback to requested
    const initialCats = (seller.approvedProductCategories && seller.approvedProductCategories.length > 0)
      ? seller.approvedProductCategories
      : (seller.requestedProductCategories || []);
    setModalCategories(initialCats);
  };

  const handleToggleModalCategory = (cat) => {
    setModalCategories(prev => {
      if (prev.includes(cat)) return prev.filter(c => c !== cat);
      return [...prev, cat];
    });
  };

  const handleApproveWithCategories = async (sellerId) => {
    setSubmittingAction(true);
    try {
      await adminApi.put(`/admin/sellers/${sellerId}/approve`, {
        approvedCategories: modalCategories
      });
      alert('🎉 Seller store & product categories approved successfully!');
      setSelectedSeller(null);
      fetchSellers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve seller');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleUpdateCategoriesOnly = async (sellerId) => {
    setSubmittingAction(true);
    try {
      await adminApi.put(`/admin/sellers/${sellerId}/categories`, {
        approvedCategories: modalCategories
      });
      alert('Approved product categories updated successfully!');
      fetchSellers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update categories');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm('Are you sure you want to reject this merchant store application?')) return;
    try {
      await adminApi.put(`/admin/sellers/${id}/reject`);
      alert('Seller store rejected.');
      setSelectedSeller(null);
      fetchSellers();
    } catch (err) {
      alert('Failed to reject seller');
    }
  };

  const handleToggleBlock = async (id) => {
    try {
      const { data } = await adminApi.put(`/admin/sellers/${id}/block`);
      alert(data.message);
      fetchSellers();
    } catch (err) {
      alert('Failed to toggle block status');
    }
  };

  return (
    <div>
      <div className="admin-top-header">
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800' }}>Seller Stores &amp; KYC Verification Dossier</h1>
          <p style={{ color: '#64748B', fontSize: '0.88rem' }}>
            Review merchant premises, 2-face &amp; touch biometrics, government ID, PAN &amp; tax compliance, and approve product categories before products go live.
          </p>
        </div>
      </div>

      {loading ? (
        <p style={{ padding: '30px', textAlign: 'center' }}>Loading seller verification records...</p>
      ) : sellers.length === 0 ? (
        <p style={{ padding: '30px', textAlign: 'center' }}>No seller stores registered yet.</p>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Store &amp; Facility</th>
                <th>Owner &amp; Email</th>
                <th>Verification Progress</th>
                <th>Status</th>
                <th>Approved Categories</th>
                <th>Revenue</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sellers.map(s => {
                const progress = s.verificationProgress || 0;
                const is100 = progress === 100;
                return (
                  <tr key={s._id}>
                    <td>
                      <strong>{s.storeName}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <i className={`fa-solid ${s.storeType === 'home_business' ? 'fa-house' : 'fa-store'}`}></i>
                        {s.storeType === 'home_business' ? 'Home Business' : 'Physical Retail Store'}
                      </div>
                    </td>
                    <td>
                      {s.ownerName}<br />
                      <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{s.email}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          background: is100 ? '#dcfce7' : '#fef3c7',
                          color: is100 ? '#15803d' : '#b45309',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '800'
                        }}>
                          {is100 ? '100% Complete' : `${progress}% Incomplete`}
                        </span>
                      </div>
                      <div style={{ width: '80px', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden', marginTop: '4px' }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: is100 ? '#10b981' : '#f59e0b' }}></div>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        background: s.status === 'approved' ? '#e7f4e8' : s.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                        color: s.status === 'approved' ? '#2e7d32' : s.status === 'rejected' ? '#dc2626' : '#d97706',
                        padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase'
                      }}>
                        {s.status}
                      </span>
                    </td>
                    <td>
                      {s.approvedProductCategories?.length > 0 ? (
                        <span style={{ fontSize: '0.75rem', color: '#0f766e', fontWeight: '700' }}>
                          {s.approvedProductCategories.length} Categories Cleared
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#d97706', fontStyle: 'italic' }}>
                          Pending Clearance
                        </span>
                      )}
                    </td>
                    <td><strong>{formatINR(s.revenue)}</strong></td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => openDossier(s)}
                          style={{
                            background: '#0f766e',
                            color: '#ffffff',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <i className="fa-solid fa-file-shield"></i> Review KYC
                        </button>
                        <button className="btn-block" onClick={() => handleToggleBlock(s._id)} style={{ fontSize: '0.78rem', padding: '6px 10px' }}>
                          {s.userId?.isBlocked ? 'Unblock' : 'Block'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* KYC DOSSIER & CATEGORY APPROVAL MODAL */}
      {selectedSeller && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '820px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            border: '1px solid #cbd5e1'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <span style={{
                  background: selectedSeller.verificationProgress === 100 ? '#dcfce7' : '#fef3c7',
                  color: selectedSeller.verificationProgress === 100 ? '#15803d' : '#b45309',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: '800'
                }}>
                  {selectedSeller.verificationProgress}% KYC Completion
                </span>
                <h2 style={{ fontSize: '1.35rem', fontWeight: '800', color: '#0f172a', margin: '6px 0 0 0' }}>
                  {selectedSeller.storeName} &bull; KYC Verification Dossier
                </h2>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                  Proprietor: {selectedSeller.ownerName} &bull; {selectedSeller.email} &bull; {selectedSeller.phone}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSeller(null)}
                style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '1rem', color: '#64748b' }}
              >
                &times;
              </button>
            </div>

            {/* Dossier Sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* 1. Store Type & Premises Verification */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-store" style={{ color: '#0f766e' }}></i> 1. Store Facility &amp; Premises Proof
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.82rem' }}>
                  <div>
                    <p style={{ margin: '0 0 4px 0', color: '#64748b' }}>Facility Type:</p>
                    <strong style={{ color: '#0f172a' }}>
                      {selectedSeller.storeType === 'home_business' ? 'Home-based Business (Residential/Kitchen)' : 'Physical Retail Store / Showroom'}
                    </strong>
                    <p style={{ margin: '8px 0 4px 0', color: '#64748b' }}>Business Address:</p>
                    <strong style={{ color: '#0f172a' }}>{selectedSeller.businessAddress || 'Not Provided'}</strong>
                  </div>

                  <div>
                    <p style={{ margin: '0 0 4px 0', color: '#64748b' }}>Storefront / Workplace Image:</p>
                    {selectedSeller.storePhoto ? (
                      <img
                        src={selectedSeller.storePhoto}
                        alt="Store Premises"
                        style={{ width: '100%', maxHeight: '140px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    ) : selectedSeller.homeBusinessDeclaration ? (
                      <div style={{ background: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontStyle: 'italic', color: '#334155' }}>
                        "{selectedSeller.homeBusinessDeclaration}"
                      </div>
                    ) : (
                      <span style={{ color: '#dc2626', fontWeight: '700' }}>⚠️ No premises photo uploaded yet</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Biometric Verification */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-fingerprint" style={{ color: '#0f766e' }}></i> 2. Biometric Security Enrollment
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', fontSize: '0.82rem' }}>
                  <div>
                    <p style={{ margin: '0 0 4px 0', color: '#64748b' }}>Faces Enrolled:</p>
                    <strong style={{ color: selectedSeller.enrolledFaces?.length >= 2 ? '#15803d' : '#d97706' }}>
                      {selectedSeller.enrolledFaces?.length || 0} of 2 Faces (Frontal + Angle)
                    </strong>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      {selectedSeller.enrolledFaces?.map((f, i) => (
                        <img
                          key={f.id || i}
                          src={f.photo}
                          alt={`Face ${i + 1}`}
                          style={{ width: '50px', height: '50px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #10b981' }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <p style={{ margin: '0 0 4px 0', color: '#64748b' }}>Fingerprints Enrolled:</p>
                    <strong style={{ color: selectedSeller.enrolledFingerprints?.length >= 1 ? '#15803d' : '#d97706' }}>
                      {selectedSeller.enrolledFingerprints?.length || 0} of 3 Touch Fingerprints
                    </strong>
                    <ul style={{ margin: '6px 0 0 16px', padding: 0, color: '#475569' }}>
                      {selectedSeller.enrolledFingerprints?.map((fp, i) => (
                        <li key={fp.id || i}>{fp.name} ({fp.fingerType})</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* 3. Government ID & Tax Compliance */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-id-card" style={{ color: '#0f766e' }}></i> 3. Government Identity &amp; Tax Compliance
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.82rem' }}>
                  <div>
                    <strong style={{ display: 'block', color: '#0f172a' }}>Govt KYC Document:</strong>
                    <p style={{ margin: '4px 0', color: '#475569' }}>
                      Type: <strong>{selectedSeller.governmentId?.idType?.toUpperCase() || 'AADHAAR'}</strong><br />
                      ID Number: <strong>{selectedSeller.governmentId?.idNumber || 'Not Provided'}</strong>
                    </p>
                    {selectedSeller.governmentId?.documentImage && (
                      <img
                        src={selectedSeller.governmentId.documentImage}
                        alt="Govt ID Document"
                        style={{ width: '100%', maxHeight: '110px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '6px' }}
                      />
                    )}
                  </div>

                  <div>
                    <strong style={{ display: 'block', color: '#0f172a' }}>Tax Details (PAN &amp; GSTIN):</strong>
                    <p style={{ margin: '4px 0', color: '#475569' }}>
                      PAN: <strong>{selectedSeller.taxDetails?.panNumber || 'Not Provided'}</strong><br />
                      GSTIN: <strong>{selectedSeller.taxDetails?.gstin || 'Unregistered / Exempt'}</strong>
                    </p>
                    {selectedSeller.taxDetails?.panCardImage && (
                      <img
                        src={selectedSeller.taxDetails.panCardImage}
                        alt="PAN Card"
                        style={{ width: '100%', maxHeight: '110px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '6px' }}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* 4. Bank Settlement Account */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-building-columns" style={{ color: '#0f766e' }}></i> 4. Bank Settlement Account
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', fontSize: '0.82rem' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Account Holder:</span><br />
                    <strong>{selectedSeller.bankDetails?.accountHolderName || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Bank Name:</span><br />
                    <strong>{selectedSeller.bankDetails?.bankName || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Account Number:</span><br />
                    <strong>{selectedSeller.bankDetails?.accountNumber || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>IFSC Code:</span><br />
                    <strong>{selectedSeller.bankDetails?.ifscCode || 'N/A'}</strong>
                  </div>
                </div>
              </div>

              {/* 5. Product Categories Clearance (Requested vs Approved) */}
              <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '12px', padding: '18px' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', fontWeight: '800', color: '#065f46', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-boxes-stacked" style={{ color: '#10b981' }}></i> 5. Product Categories Clearance
                </h4>
                <p style={{ margin: '0 0 14px 0', fontSize: '0.8rem', color: '#047857' }}>
                  Select which product categories this merchant is permitted to list. Products in unchecked categories will NOT be publishable to the customer storefront.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '10px' }}>
                  {AVAILABLE_CATEGORIES.map(cat => {
                    const isRequested = selectedSeller.requestedProductCategories?.includes(cat);
                    const isApproved = modalCategories.includes(cat);
                    return (
                      <label
                        key={cat}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          background: isApproved ? '#dcfce7' : '#ffffff',
                          border: isApproved ? '1.5px solid #10b981' : '1px solid #cbd5e1',
                          borderRadius: '8px',
                          padding: '10px',
                          cursor: 'pointer',
                          fontSize: '0.82rem'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isApproved}
                          onChange={() => handleToggleModalCategory(cat)}
                        />
                        <div>
                          <strong style={{ color: '#0f172a', display: 'block' }}>{cat}</strong>
                          {isRequested && (
                            <span style={{ fontSize: '0.68rem', color: '#0f766e', fontWeight: '700' }}>
                              Requested by Merchant
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '10px' }}>
              <button
                type="button"
                onClick={() => handleReject(selectedSeller._id)}
                style={{
                  background: '#fee2e2',
                  color: '#dc2626',
                  border: '1px solid #fca5a5',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                <i className="fa-solid fa-xmark" style={{ marginRight: '6px' }}></i> Reject Application
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleUpdateCategoriesOnly(selectedSeller._id)}
                  disabled={submittingAction}
                  style={{
                    background: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  Save Categories Clearance Only
                </button>

                <button
                  type="button"
                  onClick={() => handleApproveWithCategories(selectedSeller._id)}
                  disabled={submittingAction}
                  style={{
                    background: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    fontWeight: '800',
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)'
                  }}
                >
                  {submittingAction ? 'Processing...' : '🎉 Approve Store & Selected Categories'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
