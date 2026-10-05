import React, { useState, useEffect } from 'react';
import sellerApi from '../services/sellerApi';
import { useSellerAuth } from '../context/SellerAuthContext';
import SellerBiometricEnrollModal from './SellerBiometricEnrollModal';

const AVAILABLE_CATEGORIES = [
  { id: 'Electronics', name: 'Consumer Electronics & Gadgets', icon: 'fa-laptop' },
  { id: 'Groceries', name: 'Groceries, Supermarket & Fresh Food', icon: 'fa-apple-whole' },
  { id: 'Fashion', name: 'Fashion, Apparel & Accessories', icon: 'fa-shirt' },
  { id: 'Home & Kitchen', name: 'Home Living & Kitchenware', icon: 'fa-couch' },
  { id: 'Beauty & Health', name: 'Cosmetics, Skincare & Health', icon: 'fa-spray-can-sparkles' },
  { id: 'Sports & Fitness', name: 'Sports Equipment & Activewear', icon: 'fa-dumbbell' },
  { id: 'Books & Stationery', name: 'Books, Office & Art Supplies', icon: 'fa-book' },
  { id: 'Toys & Baby Care', name: 'Toys, Games & Baby Essentials', icon: 'fa-shapes' }
];

export default function SellerVerificationCenter({ onUpdate, isInline = false }) {
  const { sellerUser, updateSellerUser } = useSellerAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingStage, setSavingStage] = useState('');
  const [msg, setMsg] = useState('');

  // Modals
  const [isBioModalOpen, setIsBioModalOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [dismissedCelebration, setDismissedCelebration] = useState(false);

  // Stage Form States
  // 1. Store Premises
  const [storeType, setStoreType] = useState('retail_store');
  const [storePhoto, setStorePhoto] = useState('');
  const [homeDeclaration, setHomeDeclaration] = useState('');

  // 2. Govt ID
  const [idType, setIdType] = useState('aadhaar');
  const [idNumber, setIdNumber] = useState('');
  const [documentImage, setDocumentImage] = useState('');

  // 3. Tax Details
  const [panNumber, setPanNumber] = useState('');
  const [panCardImage, setPanCardImage] = useState('');
  const [gstin, setGstin] = useState('');

  // 4. Bank Details
  const [accountHolderName, setAccountHolderName] = useState('');
  const [bankName, setBankName] = useState('HDFC Bank');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiId, setUpiId] = useState('');

  // 5. Product Categories
  const [requestedCategories, setRequestedCategories] = useState([]);

  // Fetch Full Profile
  const fetchProfile = async () => {
    try {
      const { data } = await sellerApi.get('/sellers/profile');
      if (data.success && data.seller) {
        const s = data.seller;
        setProfileData(data);
        setStoreType(s.storeType || 'retail_store');
        setStorePhoto(s.storePhoto || '');
        setHomeDeclaration(s.homeBusinessDeclaration || '');

        if (s.governmentId) {
          setIdType(s.governmentId.idType || 'aadhaar');
          setIdNumber(s.governmentId.idNumber || '');
          setDocumentImage(s.governmentId.documentImage || '');
        }

        if (s.taxDetails) {
          setPanNumber(s.taxDetails.panNumber || '');
          setPanCardImage(s.taxDetails.panCardImage || '');
          setGstin(s.taxDetails.gstin || '');
        }

        if (s.bankDetails) {
          setAccountHolderName(s.bankDetails.accountHolderName || '');
          setBankName(s.bankDetails.bankName || 'HDFC Bank');
          setAccountNumber(s.bankDetails.accountNumber || '');
          setIfscCode(s.bankDetails.ifscCode || '');
          setUpiId(s.bankDetails.upiId || '');
        }

        setRequestedCategories(s.requestedProductCategories || []);

        if (data.verificationProgress === 100 && !s.isVerificationCelebrated && !dismissedCelebration) {
          setShowCelebration(true);
        }

        if (updateSellerUser) updateSellerUser(data);
        if (onUpdate) onUpdate(data);
      }
    } catch (err) {
      console.error('Error fetching verification status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const progress = profileData?.verificationProgress || 0;
  const stages = profileData?.verificationStages || {};
  const isComplete = progress === 100;

  // Submit Stage
  const handleSaveStage = async (stageKey, payload) => {
    setSavingStage(stageKey);
    setMsg('');
    try {
      const { data } = await sellerApi.post('/sellers/update-verification-stage', {
        stage: stageKey,
        data: payload
      });

      if (data.success) {
        setMsg(`✅ ${stageKey.replace('_', ' ').toUpperCase()} verification updated successfully!`);
        fetchProfile();
        if (data.isComplete && !dismissedCelebration) {
          setShowCelebration(true);
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update verification stage.');
    } finally {
      setSavingStage('');
    }
  };

  const handleToggleCategory = (catId) => {
    setRequestedCategories(prev => {
      if (prev.includes(catId)) return prev.filter(c => c !== catId);
      return [...prev, catId];
    });
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.5rem', marginBottom: '8px', display: 'block' }}></i>
        Loading verification milestones...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 1. DYNAMIC PROGRESS TRACKER BAR (Displayed until 100% is completed) */}
      {!isComplete ? (
        <div style={{
          background: '#ffffff',
          border: '1.5px solid #1A237E',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 16px rgba(26, 35, 126, 0.08)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{
                  background: '#fef3c7',
                  color: '#b45309',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: '800'
                }}>
                  ⏳ {progress}% Completed • Action Required
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>
                  Status: {profileData?.seller?.isApproved ? 'Approved by Admin' : 'Under Admin Verification'}
                </span>
              </div>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800', color: '#0f172a' }}>
                Merchant Verification Progress ({progress}%)
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                Complete all verification milestones below to reach 100% profile clearance. Admin reviews store premises, biometrics, tax documents, and approved product categories.
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '2rem', fontWeight: '900', color: '#1A237E' }}>
                {progress}%
              </span>
            </div>
          </div>

          {/* Visual Progress Bar */}
          <div style={{
            width: '100%',
            height: '14px',
            background: '#f1f5f9',
            borderRadius: '7px',
            overflow: 'hidden',
            marginBottom: '10px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #1A237E 0%, #2563EB 100%)',
              transition: 'width 0.4s ease-out'
            }}></div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', fontWeight: '600', flexWrap: 'wrap', gap: '4px' }}>
            <span>Store Details (15%)</span>
            <span>Premises Proof (15%)</span>
            <span>Biometrics (20%)</span>
            <span>Govt ID (15%)</span>
            <span>Tax &amp; PAN (15%)</span>
            <span>Bank &amp; Categories (20%)</span>
          </div>
        </div>
      ) : (
        /* Disabled / Hidden Progress Bar when 100% is reached */
        <div style={{
          background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
          border: '1.5px solid #86efac',
          borderRadius: '16px',
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.08)',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: '#10B981',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.3rem',
              boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)'
            }}>
              <i className="fa-solid fa-circle-check"></i>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: '#065f46' }}>
                  Merchant Profile 100% Fully Verified
                </h3>
                <span style={{ background: '#10b981', color: '#fff', fontSize: '0.72rem', fontWeight: '800', padding: '2px 8px', borderRadius: '12px' }}>
                  VERIFIED 100%
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#047857' }}>
                {profileData?.seller?.isApproved
                  ? 'All verification criteria met and cleared by Admin. Progress bar disabled.'
                  : 'All verification milestones submitted. Awaiting Admin clearance of store credentials & product categories.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowCelebration(true)}
            style={{
              background: '#ffffff',
              border: '1px solid #1A237E',
              color: '#1A237E',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className="fa-solid fa-trophy" style={{ color: '#10B981' }}></i> View 100% Certificate
          </button>
        </div>
      )}

      {msg && (
        <div style={{ background: '#ecfdf5', color: '#047857', padding: '12px 16px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '700', border: '1px solid #a7f3d0' }}>
          {msg}
        </div>
      )}

      {/* 2. VERIFICATION STAGE CARDS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* STAGE A: STORE TYPE & PREMISES PHOTO */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                <i className="fa-solid fa-store"></i>
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: '#0f172a' }}>
                  1. Store Type &amp; Physical Premises Proof
                </h4>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                  Select if you operate a retail showroom or home business, and provide storefront verification
                </p>
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', padding: '4px 10px', borderRadius: '12px', background: stages.storePremises?.completed ? '#dcfce7' : '#fee2e2', color: stages.storePremises?.completed ? '#15803d' : '#dc2626' }}>
              {stages.storePremises?.completed ? 'Verified ✓ (15%)' : 'Action Required (15%)'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Business Facility Type *
              </label>
              <select
                value={storeType}
                onChange={(e) => setStoreType(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem' }}
              >
                <option value="retail_store">🏬 Physical Retail Shop / Commercial Showroom</option>
                <option value="home_business">🏡 Home-based Business / Micro-Enterprise</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                {storeType === 'home_business' ? 'Home Business Workspace / Storage Photo URL *' : 'Store Facade / Signboard Photo URL *'}
              </label>
              <input
                type="text"
                placeholder={storeType === 'home_business' ? 'https://images.unsplash.com/... or storage setup photo' : 'https://images.unsplash.com/... or storefront photo'}
                value={storePhoto}
                onChange={(e) => setStorePhoto(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          <div style={{ textAlign: 'right', marginTop: '14px' }}>
            <button
              type="button"
              onClick={() => handleSaveStage('store_premises', { storeType, storePhoto, homeBusinessDeclaration: homeDeclaration })}
              disabled={savingStage === 'store_premises' || !storePhoto}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                background: '#0f172a',
                color: '#fff',
                border: 'none',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: storePhoto ? 'pointer' : 'not-allowed'
              }}
            >
              {savingStage === 'store_premises' ? 'Saving...' : 'Save Premises Verification'}
            </button>
          </div>
        </div>

        {/* STAGE B: BIOMETRIC KYC (2 FACES & UP TO 3 FINGERPRINTS) */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                <i className="fa-solid fa-fingerprint"></i>
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: '#0f172a' }}>
                  2. Biometric Security KYC (2 Faces &amp; up to 3 Fingerprints)
                </h4>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                  Register 2 face scans (Frontal KYC &amp; Angle KYC) and up to 3 fingerprints for payout clearance
                </p>
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', padding: '4px 10px', borderRadius: '12px', background: stages.biometrics?.completed ? '#dcfce7' : '#fee2e2', color: stages.biometrics?.completed ? '#15803d' : '#dc2626' }}>
              {stages.biometrics?.completed ? 'Verified ✓ (20%)' : 'Action Required (20%)'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '14px 18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div>
              <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#0f172a' }}>
                Enrolled Biometrics: {profileData?.enrolledFacesCount || 0}/2 Faces &bull; {profileData?.enrolledFingerprintsCount || 0}/3 Fingerprints
              </span>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                Used to authorize payout disbursals and prevent fraudulent account withdrawals
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsBioModalOpen(true)}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #1A237E 0%, #1E40AF 100%)',
                color: '#fff',
                border: 'none',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              <i className="fa-solid fa-shield-halved" style={{ marginRight: '6px' }}></i>
              {stages.biometrics?.completed ? 'Update Biometrics' : 'Enroll 2 Faces & 3 Fingerprints'}
            </button>
          </div>
        </div>

        {/* STAGE C: GOVERNMENT IDENTITY (AADHAAR / VOTER / PASSPORT) */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#fdf4ff', color: '#c026d3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                <i className="fa-solid fa-id-card"></i>
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: '#0f172a' }}>
                  3. Government Identity Proof (KYC ID)
                </h4>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                  Provide Aadhaar Card, Voter ID, or Passport details and document proof
                </p>
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', padding: '4px 10px', borderRadius: '12px', background: stages.governmentId?.completed ? '#dcfce7' : '#fee2e2', color: stages.governmentId?.completed ? '#15803d' : '#dc2626' }}>
              {stages.governmentId?.completed ? 'Verified ✓ (15%)' : 'Action Required (15%)'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Identity Document Type *
              </label>
              <select
                value={idType}
                onChange={(e) => setIdType(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem' }}
              >
                <option value="aadhaar">Aadhaar Card (12 Digits)</option>
                <option value="voter_id">Voter Identity Card</option>
                <option value="passport">Indian Passport</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Identity Document Number *
              </label>
              <input
                type="text"
                placeholder={idType === 'aadhaar' ? '1234 5678 9012' : 'ID Number'}
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Document Photo / Scan URL *
              </label>
              <input
                type="text"
                placeholder="https://... or document scan image"
                value={documentImage}
                onChange={(e) => setDocumentImage(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem' }}
              />
            </div>
          </div>

          <div style={{ textAlign: 'right', marginTop: '14px' }}>
            <button
              type="button"
              onClick={() => handleSaveStage('government_id', { idType, idNumber, documentImage })}
              disabled={savingStage === 'government_id' || !idNumber}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                background: '#0f172a',
                color: '#fff',
                border: 'none',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: idNumber ? 'pointer' : 'not-allowed'
              }}
            >
              {savingStage === 'government_id' ? 'Saving...' : 'Save Government ID'}
            </button>
          </div>
        </div>

        {/* STAGE D: TAX & BUSINESS COMPLIANCE (PAN & GST) */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                <i className="fa-solid fa-file-invoice-dollar"></i>
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: '#0f172a' }}>
                  4. Tax Compliance &amp; Business Registration (PAN / GSTIN)
                </h4>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                  Required for invoice generation, tax deductions at source, and payout processing
                </p>
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', padding: '4px 10px', borderRadius: '12px', background: stages.taxDetails?.completed ? '#dcfce7' : '#fee2e2', color: stages.taxDetails?.completed ? '#15803d' : '#dc2626' }}>
              {stages.taxDetails?.completed ? 'Verified ✓ (15%)' : 'Action Required (15%)'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Permanent Account Number (PAN) *
              </label>
              <input
                type="text"
                placeholder="ABCDE1234F"
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                GSTIN Number (Optional for micro-sellers)
              </label>
              <input
                type="text"
                placeholder="07AAAAA0000A1Z5"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                PAN Card Proof Photo URL
              </label>
              <input
                type="text"
                placeholder="https://... or photo URL"
                value={panCardImage}
                onChange={(e) => setPanCardImage(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem' }}
              />
            </div>
          </div>

          <div style={{ textAlign: 'right', marginTop: '14px' }}>
            <button
              type="button"
              onClick={() => handleSaveStage('tax_details', { panNumber, gstin, panCardImage })}
              disabled={savingStage === 'tax_details' || !panNumber}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                background: '#0f172a',
                color: '#fff',
                border: 'none',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: panNumber ? 'pointer' : 'not-allowed'
              }}
            >
              {savingStage === 'tax_details' ? 'Saving...' : 'Save Tax Compliance'}
            </button>
          </div>
        </div>

        {/* STAGE E: BANK ACCOUNT FOR DISBURSALS */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                <i className="fa-solid fa-building-columns"></i>
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: '#0f172a' }}>
                  5. Bank Settlement Account
                </h4>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                  Destination bank account for weekly sales payouts and IMPS transfers
                </p>
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', padding: '4px 10px', borderRadius: '12px', background: stages.bankAccount?.completed ? '#dcfce7' : '#fee2e2', color: stages.bankAccount?.completed ? '#15803d' : '#dc2626' }}>
              {stages.bankAccount?.completed ? 'Verified ✓ (10%)' : 'Action Required (10%)'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Account Holder Name *
              </label>
              <input
                type="text"
                placeholder="Proprietor / Firm Name"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Bank Name *
              </label>
              <input
                type="text"
                placeholder="HDFC / SBI / ICICI"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Account Number *
              </label>
              <input
                type="text"
                placeholder="50100234891244"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                IFSC Code *
              </label>
              <input
                type="text"
                placeholder="HDFC0001234"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem' }}
              />
            </div>
          </div>

          <div style={{ textAlign: 'right', marginTop: '14px' }}>
            <button
              type="button"
              onClick={() => handleSaveStage('bank_account', { accountHolderName, bankName, accountNumber, ifscCode, upiId })}
              disabled={savingStage === 'bank_account' || !accountNumber || !ifscCode}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                background: '#0f172a',
                color: '#fff',
                border: 'none',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: (accountNumber && ifscCode) ? 'pointer' : 'not-allowed'
              }}
            >
              {savingStage === 'bank_account' ? 'Saving...' : 'Save Bank Account'}
            </button>
          </div>
        </div>

        {/* STAGE F: PRODUCT CATEGORIES CLEARANCE */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                <i className="fa-solid fa-boxes-stacked"></i>
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: '#0f172a' }}>
                  6. Product Categories Declaration &amp; Admin Clearance
                </h4>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                  Declare the product categories your store will sell. Admin grants clearance before products appear to customers.
                </p>
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', padding: '4px 10px', borderRadius: '12px', background: stages.productCategories?.completed ? '#dcfce7' : '#fee2e2', color: stages.productCategories?.completed ? '#15803d' : '#dc2626' }}>
              {stages.productCategories?.completed ? 'Declared ✓ (10%)' : 'Action Required (10%)'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            {AVAILABLE_CATEGORIES.map(cat => {
              const isSelected = requestedCategories.includes(cat.id);
              const isApproved = (profileData?.seller?.approvedProductCategories || []).includes(cat.id);
              return (
                <div
                  key={cat.id}
                  onClick={() => handleToggleCategory(cat.id)}
                  style={{
                    border: isSelected ? '2px solid #1A237E' : '1px solid #e2e8f0',
                    background: isSelected ? '#EEF2FF' : '#ffffff',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <i className={`fa-solid ${cat.icon}`} style={{ color: isSelected ? '#1A237E' : '#94a3b8', fontSize: '1.1rem' }}></i>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0f172a' }}>
                        {cat.name}
                      </div>
                      {isApproved && (
                        <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: '700' }}>
                          ✓ Admin Approved
                        </span>
                      )}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    style={{ cursor: 'pointer' }}
                  />
                </div>
              );
            })}
          </div>

          <div style={{ textAlign: 'right' }}>
            <button
              type="button"
              onClick={() => handleSaveStage('product_categories', { requestedProductCategories: requestedCategories })}
              disabled={savingStage === 'product_categories' || requestedCategories.length === 0}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                background: '#0f172a',
                color: '#fff',
                border: 'none',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: requestedCategories.length > 0 ? 'pointer' : 'not-allowed'
              }}
            >
              {savingStage === 'product_categories' ? 'Saving...' : 'Submit Categories for Clearance'}
            </button>
          </div>
        </div>

      </div>

      {/* 3. 100% COMPLETION CELEBRATION MODAL */}
      {showCelebration && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '24px',
            maxWidth: '560px',
            width: '100%',
            padding: '40px 32px',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            border: '2px solid #86efac',
            animation: 'fadeIn 0.3s ease-out',
            position: 'relative'
          }}>
            <div style={{
              width: '84px',
              height: '84px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.5rem',
              margin: '0 auto 20px auto',
              boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)'
            }}>
              <i className="fa-solid fa-trophy"></i>
            </div>

            <span style={{
              background: '#dcfce7',
              color: '#15803d',
              padding: '6px 16px',
              borderRadius: '20px',
              fontSize: '0.82rem',
              fontWeight: '800',
              display: 'inline-block',
              marginBottom: '12px'
            }}>
              ✨ 100% VERIFICATION MILESTONE ACHIEVED ✨
            </span>

            <h2 style={{ fontSize: '1.6rem', fontWeight: '900', color: '#0f172a', margin: '0 0 12px 0' }}>
              Congratulations, {sellerUser?.name || 'Merchant'}!
            </h2>

            <p style={{ fontSize: '0.92rem', color: '#475569', lineHeight: '1.6', margin: '0 0 24px 0' }}>
              You have completed <strong>100% of your merchant verification</strong> profile! Your store premises, dual face &amp; touch biometric authentication, government ID, tax compliance, bank payout details, and requested product categories have all been successfully submitted.
            </p>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '16px',
              marginBottom: '26px',
              textAlign: 'left',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              fontSize: '0.8rem',
              color: '#334155'
            }}>
              <div>✓ Store Premises Proof</div>
              <div>✓ 2 Face Scans &amp; Fingerprints</div>
              <div>✓ Government KYC ID</div>
              <div>✓ PAN &amp; GST Compliance</div>
              <div>✓ IMPS Bank Settlement</div>
              <div>✓ Product Categories Declared</div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowCelebration(false);
                setDismissedCelebration(true);
              }}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #1A237E 0%, #1E40AF 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: '800',
                fontSize: '1rem',
                cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(26, 35, 126, 0.35)'
              }}
            >
              Continue to Merchant Dashboard 🚀
            </button>
          </div>
        </div>
      )}

      {/* BIOMETRIC ENROLLMENT MODAL */}
      <SellerBiometricEnrollModal
        isOpen={isBioModalOpen}
        onClose={() => setIsBioModalOpen(false)}
        isStandalone={true}
        onSuccess={() => {
          setIsBioModalOpen(false);
          fetchProfile();
        }}
      />
    </div>
  );
}
