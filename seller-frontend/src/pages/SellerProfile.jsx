import React, { useState, useEffect } from 'react';
import { useSellerAuth } from '../context/SellerAuthContext';
import sellerApi from '../services/sellerApi';
import SellerBiometricModal from '../components/SellerBiometricModal';
import SellerBiometricEnrollModal from '../components/SellerBiometricEnrollModal';

const DEFAULT_OWNER_PHOTO = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80';
const DEFAULT_STORE_BANNER = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80';

// Regional AP & TS Hub Presets
const LOCATION_PRESETS = [
  { name: '📍 Guntur Hub', city: 'Guntur', state: 'Andhra Pradesh', pincode: '522002', lat: '16.3067', lng: '80.4365', address: 'Guntur Industrial Corridor Hub, Near AP Highway' },
  { name: '📍 Vijayawada Hub', city: 'Vijayawada', state: 'Andhra Pradesh', pincode: '520001', lat: '16.5062', lng: '80.6480', address: 'Bunder Road, Vijayawada Central Logistics Dock' },
  { name: '📍 Medikonduru Station', city: 'Medikonduru', state: 'Andhra Pradesh', pincode: '522438', lat: '16.3020', lng: '80.2980', address: 'Main Road, Beside Post Office, Medikonduru' },
  { name: '📍 Tenali Branch Hub', city: 'Tenali', state: 'Andhra Pradesh', pincode: '522201', lat: '16.2430', lng: '80.6400', address: 'Guntur Road, Tenali Express Delivery Dock' },
  { name: '📍 Hyderabad Central', city: 'Hyderabad', state: 'Telangana', pincode: '500001', lat: '17.3850', lng: '78.4867', address: 'Abids Road, Hyderabad Mother Hub, Telangana' }
];

export default function SellerProfile() {
  const { sellerUser, updateSellerUser } = useSellerAuth();
  
  // Biometric Test & Enrollment States
  const [isBioTestModalOpen, setIsBioTestModalOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [bioModalMode, setBioModalMode] = useState('VERIFY');
  const [enrolledFaces, setEnrolledFaces] = useState([]);
  const [enrolledFingerprints, setEnrolledFingerprints] = useState([]);
  const [isBiometricEnrolled, setIsBiometricEnrolled] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  
  // Photos State
  const [logo, setLogo] = useState(DEFAULT_OWNER_PHOTO);
  const [banner, setBanner] = useState(DEFAULT_STORE_BANNER);
  
  // Location & GPS State
  const [businessAddress, setBusinessAddress] = useState('');
  const [city, setCity] = useState('Guntur');
  const [state, setState] = useState('Andhra Pradesh');
  const [postalCode, setPostalCode] = useState('522002');
  const [lat, setLat] = useState('16.3067');
  const [lng, setLng] = useState('80.4365');

  // Bank & Treasury State
  const [accountHolderName, setAccountHolderName] = useState('');
  const [bankName, setBankName] = useState('HDFC Bank');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiId, setUpiId] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch full seller profile on load
  useEffect(() => {
    sellerApi.get('/sellers/profile')
      .then(({ data }) => {
        const s = data.seller || {};
        setStoreName(s.storeName || sellerUser?.storeName || 'Verified NovaKart Merchant');
        setOwnerName(s.ownerName || sellerUser?.name || 'Verified Merchant Partner');
        setEmail(s.email || sellerUser?.email || '');
        setPhone(s.phone || sellerUser?.phone || '');
        setBusinessAddress(s.businessAddress || 'Guntur Industrial Hub, AP Corridor');
        setLogo(s.logo || DEFAULT_OWNER_PHOTO);
        setBanner(s.banner || DEFAULT_STORE_BANNER);

        if (s.location) {
          if (s.location.city) setCity(s.location.city);
          if (s.location.state) setState(s.location.state);
          if (s.location.postalCode) setPostalCode(s.location.postalCode);
          if (s.location.lat) setLat(String(s.location.lat));
          if (s.location.lng) setLng(String(s.location.lng));
        }

        if (s.bankDetails) {
          setAccountHolderName(s.bankDetails.accountHolderName || s.ownerName || '');
          setBankName(s.bankDetails.bankName || 'HDFC Bank');
          setAccountNumber(s.bankDetails.accountNumber || '');
          setIfscCode(s.bankDetails.ifscCode || '');
          setUpiId(s.bankDetails.upiId || '');
        }
      })
      .catch(() => {
        // Fallback to sellerUser context defaults
        if (sellerUser) {
          setStoreName(sellerUser.storeName || 'Verified NovaKart Merchant');
          setOwnerName(sellerUser.name || 'Store Owner');
          setEmail(sellerUser.email || '');
          setPhone(sellerUser.phone || '');
        }
      })
      .finally(() => setLoading(false));
  }, [sellerUser]);

  // Handle Photo File Upload
  const handlePhotoUpload = (e, setTargetState) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Photo file size must be less than 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setTargetState(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Detect Live GPS Location
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(4));
        setLng(pos.coords.longitude.toFixed(4));
        setSuccessMsg(`📍 Live GPS detected: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        setTimeout(() => setSuccessMsg(''), 4000);
      },
      (err) => {
        alert(`Failed to detect GPS: ${err.message}. Please select a regional hub preset below.`);
      }
    );
  };

  // Apply Location Preset
  const applyPreset = (preset) => {
    setCity(preset.city);
    setState(preset.state);
    setPostalCode(preset.pincode);
    setLat(preset.lat);
    setLng(preset.lng);
    setBusinessAddress(preset.address);
    setSuccessMsg(`Applied preset location: ${preset.name}`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Save Store Profile
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const payload = {
        storeName,
        ownerName,
        email,
        phone,
        businessAddress,
        city,
        state,
        postalCode,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        logo,
        banner,
        bankDetails: {
          accountHolderName,
          bankName,
          accountNumber,
          ifscCode,
          upiId
        }
      };

      const { data } = await sellerApi.put('/sellers/profile', payload);
      setSuccessMsg('✅ Store profile, location & owner photos updated successfully!');
      if (updateSellerUser) {
        updateSellerUser({ storeName, phone });
      }
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to save store profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#1A237E' }}></i>
        <p style={{ marginTop: '12px', color: '#64748B' }}>Loading store settings &amp; location profile...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Header */}
      <div className="seller-top-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0F172A' }}>
            Store Profile &amp; Location Settings
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.88rem', margin: '4px 0 0' }}>
            Manage merchant identity, store owner photo, storefront banner, GPS pickup coordinates, and payout bank details.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div style={{ background: '#DCFCE7', color: '#15803D', padding: '14px 18px', borderRadius: '10px', fontWeight: '700', marginBottom: '20px', border: '1px solid #86EFAC' }}>
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '14px 18px', borderRadius: '10px', fontWeight: '700', marginBottom: '20px', border: '1px solid #FCA5A5' }}>
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* 1. Storefront & Owner Media Banner Card */}
        <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
          {/* Storefront Banner Preview */}
          <div style={{ position: 'relative', height: '180px', background: '#0F172A' }}>
            <img
              src={banner}
              alt="Store Banner"
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
              onError={(e) => { e.target.src = DEFAULT_STORE_BANNER; }}
            />
            <label style={{
              position: 'absolute', top: '14px', right: '14px',
              background: 'rgba(15, 23, 42, 0.85)', color: '#FFFFFF',
              padding: '8px 14px', borderRadius: '8px', fontSize: '0.78rem',
              fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              <i className="fa-solid fa-camera"></i> Change Store Photo
              <input type="file" accept="image/*" onChange={(e) => handlePhotoUpload(e, setBanner)} style={{ display: 'none' }} />
            </label>
          </div>

          {/* Owner Avatar & Identity Section */}
          <div style={{ padding: '24px', display: 'flex', alignItems: 'flex-start', gap: '20px', marginTop: '-45px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <img
                src={logo}
                alt="Owner Photo"
                style={{
                  width: '100px', height: '100px', borderRadius: '50%',
                  objectFit: 'cover', border: '4px solid #FFFFFF',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.15)', background: '#FFF'
                }}
                onError={(e) => { e.target.src = DEFAULT_OWNER_PHOTO; }}
              />
              <label style={{
                position: 'absolute', bottom: '0', right: '0',
                background: '#1A237E', color: '#FFF', width: '32px', height: '32px',
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
              }} title="Change Owner Photo">
                <i className="fa-solid fa-camera" style={{ fontSize: '0.85rem' }}></i>
                <input type="file" accept="image/*" onChange={(e) => handlePhotoUpload(e, setLogo)} style={{ display: 'none' }} />
              </label>
            </div>

            <div style={{ flex: 1, minWidth: '240px', paddingTop: '40px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                {storeName || 'Verified NovaKart Merchant'}
              </h2>
              <p style={{ color: '#64748B', fontSize: '0.84rem', margin: '4px 0 0' }}>
                Owner / Proprietor: <strong>{ownerName || 'Merchant Partner'}</strong> &bull; <span style={{ color: '#10B981', fontWeight: '700' }}>✓ Approved Merchant</span>
              </p>
            </div>
          </div>
        </div>

        {/* 2. Merchant & Proprietor Information */}
        <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#0F172A', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-store" style={{ color: '#1A237E' }}></i>
            Store &amp; Proprietor Identity Details
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Store / Merchant Business Name *
              </label>
              <input
                type="text"
                className="form-input"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                required
                placeholder="e.g. FreshMart Organic Groceries"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #CBD5E1', borderRadius: '8px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Owner / Proprietor Full Name *
              </label>
              <input
                type="text"
                className="form-input"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                required
                placeholder="Proprietor Name"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #CBD5E1', borderRadius: '8px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Contact Phone *
              </label>
              <input
                type="tel"
                className="form-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="+91 98223 45678"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #CBD5E1', borderRadius: '8px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Official Business Email *
              </label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="seller@merchant.com"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #CBD5E1', borderRadius: '8px' }}
              />
            </div>
          </div>
        </div>

        {/* 3. Store Pickup Location & Regional GPS Coordinates */}
        <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-location-dot" style={{ color: '#EF4444' }}></i>
                Store Pickup Location &amp; Haversine GPS Coordinates
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '2px 0 0' }}>
                Used by nearby delivery riders to compute pickup route distances &amp; dispatch notifications.
              </p>
            </div>

            <button
              type="button"
              onClick={handleDetectGPS}
              style={{
                background: '#EF4444', color: '#FFFFFF', border: 'none',
                padding: '8px 14px', borderRadius: '8px', fontSize: '0.8rem',
                fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <i className="fa-solid fa-crosshairs"></i> Detect My Live GPS
            </button>
          </div>

          {/* Location Presets Toolbar */}
          <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '8px' }}>
              ⚡ AP &amp; TS Regional Hub Quick Location Presets:
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {LOCATION_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applyPreset(p)}
                  style={{
                    background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#1A237E',
                    padding: '6px 12px', borderRadius: '6px', fontSize: '0.76rem',
                    fontWeight: '700', cursor: 'pointer', transition: 'all 0.15s'
                  }}
                >
                  {p.name} ({p.pincode})
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Store Pickup Street Address *
              </label>
              <input
                type="text"
                className="form-input"
                value={businessAddress}
                onChange={(e) => setBusinessAddress(e.target.value)}
                required
                placeholder="Full Street, Building, Facility / Hub Address"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #CBD5E1', borderRadius: '8px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  City / Station *
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #CBD5E1', borderRadius: '8px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  State / Territory *
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #CBD5E1', borderRadius: '8px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Postal Pincode *
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #CBD5E1', borderRadius: '8px' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Latitude (GPS) *
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #CBD5E1', borderRadius: '8px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Longitude (GPS) *
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #CBD5E1', borderRadius: '8px' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 4. Bank Account & Settlement Payout Details */}
        <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#0F172A', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-building-columns" style={{ color: '#10B981' }}></i>
            Bank Payout Account &amp; Treasury Details
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Account Holder Name
              </label>
              <input
                type="text"
                className="form-input"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                placeholder="Proprietor / Firm Name"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #CBD5E1', borderRadius: '8px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Bank Name
              </label>
              <input
                type="text"
                className="form-input"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="HDFC / SBI / ICICI Bank"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #CBD5E1', borderRadius: '8px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Account Number
              </label>
              <input
                type="text"
                className="form-input"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="50100234891244"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #CBD5E1', borderRadius: '8px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                IFSC Code
              </label>
              <input
                type="text"
                className="form-input"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value)}
                placeholder="HDFC0001234"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #CBD5E1', borderRadius: '8px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                UPI ID (Optional)
              </label>
              <input
                type="text"
                className="form-input"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="merchant@upi"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #CBD5E1', borderRadius: '8px' }}
              />
            </div>
          </div>
        </div>

        {/* 5. Merchant Biometric Security & KYC Identity (3 Fingerprints & 2 Faces) */}
        <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#0F172A', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-fingerprint" style={{ color: '#10B981' }}></i>
                Merchant Biometric Security &amp; Payout Protection
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B' }}>
                Mandatory multi-biometric setup: <strong>2 face scans</strong> and <strong>up to 3 fingerprints</strong> required for payout disbursals
              </p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                background: isBiometricEnrolled ? '#ECFDF5' : '#FEF2F2',
                color: isBiometricEnrolled ? '#047857' : '#DC2626',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '0.78rem',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <i className={`fa-solid ${isBiometricEnrolled ? 'fa-circle-check' : 'fa-triangle-exclamation'}`}></i>
                {isBiometricEnrolled ? 'Biometrics Fully Configured' : 'Setup Required'}
              </span>

              <button
                type="button"
                onClick={() => setIsEnrollModalOpen(true)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #0f766e 0%, #115e59 100%)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <i className="fa-solid fa-shield-halved"></i>
                {isBiometricEnrolled ? 'Manage Biometrics' : 'Enroll 3 Fingerprints & 2 Faces'}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginTop: '12px' }}>
            {/* Method 1: Fingerprint Sensor */}
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#ECFDF5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                  <i className="fa-solid fa-fingerprint"></i>
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#0F172A' }}>
                    👆 Registered Fingerprints ({enrolledFingerprints.length}/3)
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#047857', fontWeight: '700' }}>
                    {enrolledFingerprints.length > 0 ? `${enrolledFingerprints.length} Hardware Sensor Slots Active` : 'No Fingerprints Registered'}
                  </div>
                </div>
              </div>
              <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '0 0 12px 0', lineHeight: '1.4' }}>
                Authenticate instant payout claims with registered thumbs or index fingers on device scanner.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => { setBioModalMode('VERIFY'); setIsBioTestModalOpen(true); }}
                  style={{
                    flex: 1,
                    background: '#FFFFFF',
                    border: '1px solid #A7F3D0',
                    color: '#047857',
                    borderRadius: '8px',
                    padding: '8px',
                    fontSize: '0.8rem',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  <i className="fa-solid fa-fingerprint"></i> Test Sensor
                </button>
                <button
                  type="button"
                  onClick={() => setIsEnrollModalOpen(true)}
                  style={{
                    padding: '8px 12px',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Edit Slots
                </button>
              </div>
            </div>

            {/* Method 2: Live Face Recognition */}
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#EFF6FF', color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                  <i className="fa-solid fa-camera"></i>
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#0F172A' }}>
                    📷 Enrolled Face Scans ({enrolledFaces.length}/2)
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#1D4ED8', fontWeight: '700' }}>
                    {enrolledFaces.length >= 2 ? 'Frontal & Angle Faces Active' : 'Pending Dual Face Registration'}
                  </div>
                </div>
              </div>
              <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '0 0 12px 0', lineHeight: '1.4' }}>
                Webcam vector matching checked against both Face 1 (Frontal) and Face 2 (Angle).
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => { setBioModalMode('RECAPTURE'); setIsBioTestModalOpen(true); }}
                  style={{
                    flex: 1,
                    background: '#FFFFFF',
                    border: '1px solid #BFDBFE',
                    color: '#1D4ED8',
                    borderRadius: '8px',
                    padding: '8px',
                    fontSize: '0.8rem',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  <i className="fa-solid fa-camera"></i> Re-capture Face
                </button>
                <button
                  type="button"
                  onClick={() => setIsEnrollModalOpen(true)}
                  style={{
                    padding: '8px 12px',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Manage 2 Faces
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={saving}
          style={{
            background: saving ? '#94A3B8' : '#1A237E',
            color: '#FFFFFF',
            border: 'none',
            padding: '16px',
            borderRadius: '12px',
            fontSize: '1rem',
            fontWeight: '800',
            cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 14px rgba(26, 35, 126, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            transition: 'background 0.2s'
          }}
        >
          {saving ? (
            <>
              <i className="fa-solid fa-spinner fa-spin"></i> Saving Settings...
            </>
          ) : (
            <>
              <i className="fa-solid fa-floppy-disk"></i> Save Store Profile, Photos &amp; Coordinates
            </>
          )}
        </button>

      </form>

      {/* SELLER BIOMETRIC VERIFICATION MODAL */}
      <SellerBiometricModal
        isOpen={isBioTestModalOpen}
        onClose={() => setIsBioTestModalOpen(false)}
        mode={bioModalMode}
        onVerifiedSuccess={(res) => {
          setSuccessMsg(`✅ Biometric authentication successful (${res.biometricType === 'FINGERPRINT' ? 'Fingerprint 99% Match' : 'Face Vector Match'})!`);
          setTimeout(() => setSuccessMsg(''), 4000);
          setIsBioTestModalOpen(false);
        }}
        actionContext="SECURITY_VERIFICATION"
        actionLabel={bioModalMode === 'RECAPTURE' ? 'Store Owner Face Re-Capture' : 'Biometric Sensor Test'}
        enrolledPhotoUrl={logo}
      />

      {/* SELLER BIOMETRIC ENROLLMENT MODAL (3 FINGERPRINTS & 2 FACES) */}
      <SellerBiometricEnrollModal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        isStandalone={true}
        initialFaces={enrolledFaces}
        initialFingerprints={enrolledFingerprints}
        onSuccess={() => {
          setIsEnrollModalOpen(false);
          setSuccessMsg('✅ Multi-biometric security settings successfully saved!');
          setTimeout(() => setSuccessMsg(''), 4000);
          sellerApi.get('/sellers/profile').then(({ data }) => {
            const s = data.seller || {};
            setEnrolledFaces(s.enrolledFaces || []);
            setEnrolledFingerprints(s.enrolledFingerprints || []);
            setIsBiometricEnrolled(Boolean(data.isBiometricEnrolled || s.isBiometricEnrolled));
            if (updateSellerUser) updateSellerUser(data);
          });
        }}
      />
    </div>
  );
}
