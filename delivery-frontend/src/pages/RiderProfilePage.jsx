import React, { useState, useEffect } from 'react';
import deliveryApi from '../services/deliveryApi';
import { useDeliveryAuth } from '../context/DeliveryAuthContext';
import FaceVerificationModal from '../components/FaceVerificationModal';
import TrackedPhotoModal from '../components/TrackedPhotoModal';
import MobileConnectModal from '../components/MobileConnectModal';

export default function RiderProfilePage() {
  const { agentUser, updateAgentUser } = useDeliveryAuth() || {};
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'security' | 'fleet'
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [isTrackedPhotoOpen, setIsTrackedPhotoOpen] = useState(false);
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);

  // Profile Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('Motorcycle');
  const [drivingLicense, setDrivingLicense] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');
  const [preferredPincodesInput, setPreferredPincodesInput] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });

  // Collapsible Accordion States (Closed by default)
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [isEditingBike, setIsEditingBike] = useState(false);
  const [isEditingEmergency, setIsEditingEmergency] = useState(false);
  const [isEditingPincodes, setIsEditingPincodes] = useState(false);

  // Password Verification Option Selection ('password' | 'otp')
  const [secVerificationOption, setSecVerificationOption] = useState('password'); // Default Option 1

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data } = await deliveryApi.get('/delivery/profile');
      if (data.profile) {
        setProfile(data.profile);
        setFullName(data.profile.fullName || '');
        setPhone(data.profile.phone || '');
        setAddress(data.profile.address || '');
        setProfileImage(data.profile.profileImage || '');
        setVehicleNumber(data.profile.vehicleNumber || '');
        setVehicleType(data.profile.vehicleType || 'Motorcycle');
        setDrivingLicense(data.profile.drivingLicense || '');
        setEmergencyName(data.profile.emergencyContact?.name || '');
        setEmergencyPhone(data.profile.emergencyContact?.phone || '');
        setEmergencyRelation(data.profile.emergencyContact?.relation || '');
        setPreferredPincodesInput(data.profile.preferredPincodes?.join(', ') || '');
      }
    } catch (err) {
      console.error('Failed to load profile', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleUpdateProfile = async (e) => {
    if (e) e.preventDefault();
    setProfileMsg({ type: '', text: '' });
    setUpdatingProfile(true);

    try {
      const { data } = await deliveryApi.put('/delivery/profile', {
        fullName,
        phone,
        address,
        profileImage,
        vehicleNumber,
        vehicleType,
        emergencyContact: {
          name: emergencyName,
          phone: emergencyPhone,
          relation: emergencyRelation
        },
        preferredPincodes: preferredPincodesInput.split(',').map((s) => s.trim()).filter(Boolean)
      });
      setProfileMsg({ type: 'success', text: data.message || 'Profile updated successfully!' });
      if (updateAgentUser) {
        updateAgentUser({ phone, profileImage, vehicleNumber, vehicleType });
      }
      // Close all edit accordions upon success
      setIsEditingPhoto(false);
      setIsEditingPersonal(false);
      setIsEditingBike(false);
      setIsEditingEmergency(false);
      setIsEditingPincodes(false);
      fetchProfile();
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update profile.' });
    } finally {
      setUpdatingProfile(false);
    }
  };

  // Send Email OTP for Password Reset (Option 2)
  const handleSendOtp = async () => {
    setPasswordMsg({ type: '', text: '' });
    setSendingOtp(true);
    try {
      const { data } = await deliveryApi.post('/delivery/send-password-otp');
      setPasswordMsg({ type: 'success', text: data.message });
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.response?.data?.message || 'Failed to send Email Security OTP.' });
    } finally {
      setSendingOtp(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg({ type: '', text: '' });

    if (secVerificationOption === 'password' && !currentPassword) {
      setPasswordMsg({ type: 'error', text: 'Option 1: Please enter your current account password.' });
      return;
    }

    if (secVerificationOption === 'otp' && !otp.trim()) {
      setPasswordMsg({ type: 'error', text: 'Option 2: Please enter the 6-digit OTP code sent to your email.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match. Please re-type correctly.' });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 6 characters long.' });
      return;
    }

    setUpdatingPassword(true);
    try {
      const payload = { newPassword };
      if (secVerificationOption === 'password') {
        payload.currentPassword = currentPassword;
      } else {
        payload.otp = otp;
      }

      const { data } = await deliveryApi.put('/delivery/change-password', payload);
      setPasswordMsg({ type: 'success', text: data.message || '🔒 Password updated successfully!' });
      setCurrentPassword('');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
      fetchProfile();
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.response?.data?.message || 'Failed to change password.' });
    } finally {
      setUpdatingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="delivery-container" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: 'var(--agent-primary)' }}></i>
        <p style={{ marginTop: '12px', color: '#64748B' }}>Loading courier profile &amp; security data...</p>
      </div>
    );
  }

  return (
    <main className="delivery-container" style={{ padding: '12px 10px 28px 10px' }}>
      <div>
        
        {/* Profile Identity Header Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          borderRadius: '16px',
          padding: '18px 16px',
          color: '#FFFFFF',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {profile?.profileImage || profile?.faceVerificationPhoto ? (
              <img
                src={profile.profileImage || profile.faceVerificationPhoto}
                alt={profile?.fullName}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid #10B981',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                }}
              />
            ) : (
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '900',
                fontSize: '1.8rem',
                border: '3px solid #3B82F6',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)'
              }}>
                {(profile?.fullName || 'A').charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.3rem', fontWeight: '900', margin: 0 }}>
                  {profile?.fullName || 'Courier Agent'}
                </h1>
                <span style={{
                  background: '#10B981',
                  color: '#FFFFFF',
                  fontSize: '0.66rem',
                  fontWeight: '900',
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  VERIFIED FLEET
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span><i className="fa-solid fa-envelope"></i> {profile?.email}</span>
                <span><i className="fa-solid fa-phone"></i> {profile?.phone}</span>
                <span><i className="fa-solid fa-motorcycle"></i> {profile?.vehicleNumber}</span>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.74rem',
              color: '#93C5FD',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <i className="fa-solid fa-warehouse"></i>
              <span>Hub: <strong>{profile?.assignedWarehouse?.name || 'Guntur Hub'}</strong></span>
            </div>
          </div>
        </div>

        {/* Biometric Face Authentication & KYC Status Bar */}
        <div style={{
          background: profile?.isFaceVerified ? '#F0FDF4' : '#FFFBEB',
          border: `1px solid ${profile?.isFaceVerified ? '#86EFAC' : '#FDE68A'}`,
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {profile?.faceVerificationPhoto ? (
              <img
                src={profile.faceVerificationPhoto}
                alt="Tracked Biometric Face"
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid #10B981',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                }}
              />
            ) : (
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: profile?.isFaceVerified ? '#DCFCE7' : '#FEF3C7',
                color: profile?.isFaceVerified ? '#166534' : '#92400E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem'
              }}>
                <i className={`fa-solid ${profile?.isFaceVerified ? 'fa-user-check' : 'fa-camera'}`}></i>
              </div>
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: profile?.isFaceVerified ? '#166534' : '#92400E' }}>
                  {profile?.isFaceVerified ? 'Biometric Face Authentication: VERIFIED' : 'Mandatory Live Face Authentication Required'}
                </h4>
                <span style={{
                  background: profile?.isFaceVerified ? '#166534' : '#D97706',
                  color: '#FFFFFF',
                  fontSize: '0.62rem',
                  fontWeight: '900',
                  padding: '2px 6px',
                  borderRadius: '6px'
                }}>
                  {profile?.isFaceVerified ? 'SEALED & TRACKED' : 'PENDING CAMERA'}
                </span>
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.74rem', color: profile?.isFaceVerified ? '#15803D' : '#78350F' }}>
                {profile?.isFaceVerified
                  ? `Biometric photo locked & audited on ${profile.faceVerifiedAt ? new Date(profile.faceVerifiedAt).toLocaleDateString('en-IN') : 'Record'}.`
                  : 'Capture your live frontal face photo using device camera to activate dispatch privileges.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {profile?.isFaceVerified && (
              <button
                type="button"
                onClick={() => setIsTrackedPhotoOpen(true)}
                style={{
                  background: '#166534',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <i className="fa-solid fa-id-card-clip"></i>
                <span>📸 View Tracked Face Photo</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsFaceModalOpen(true)}
              style={{
                background: profile?.isFaceVerified ? '#EFF6FF' : '#D97706',
                color: profile?.isFaceVerified ? '#1D4ED8' : '#FFFFFF',
                border: profile?.isFaceVerified ? '1px solid #BFDBFE' : 'none',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <i className="fa-solid fa-camera"></i>
              <span>{profile?.isFaceVerified ? 'Re-verify Camera Photo' : 'Open Camera & Verify Face'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMobileModalOpen(true)}
              style={{
                background: '#FFFFFF',
                color: '#0F172A',
                border: '1px solid #CBD5E1',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <i className="fa-solid fa-mobile-screen" style={{ color: '#10B981' }}></i>
              <span>📱 Mobile Phone URL</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation (Responsive Mobile Grid) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          background: '#F1F5F9',
          padding: '4px',
          borderRadius: '12px',
          marginBottom: '16px',
          gap: '4px'
        }}>
          <button
            onClick={() => setActiveTab('profile')}
            style={{
              padding: '10px 4px',
              border: 'none',
              borderRadius: '8px',
              background: activeTab === 'profile' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'profile' ? '#0F172A' : '#64748B',
              fontWeight: activeTab === 'profile' ? '800' : '700',
              cursor: 'pointer',
              fontSize: '0.76rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: activeTab === 'profile' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            <i className="fa-solid fa-id-card"></i> Profile Details
          </button>

          <button
            onClick={() => setActiveTab('security')}
            style={{
              padding: '10px 4px',
              border: 'none',
              borderRadius: '8px',
              background: activeTab === 'security' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'security' ? '#0F172A' : '#64748B',
              fontWeight: activeTab === 'security' ? '800' : '700',
              cursor: 'pointer',
              fontSize: '0.76rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: activeTab === 'security' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            <i className="fa-solid fa-lock"></i> Password &amp; OTP
          </button>

          <button
            onClick={() => setActiveTab('fleet')}
            style={{
              padding: '10px 4px',
              border: 'none',
              borderRadius: '8px',
              background: activeTab === 'fleet' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'fleet' ? '#0F172A' : '#64748B',
              fontWeight: activeTab === 'fleet' ? '800' : '700',
              cursor: 'pointer',
              fontSize: '0.76rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: activeTab === 'fleet' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            <i className="fa-solid fa-truck-fast"></i> Fleet &amp; Territory
          </button>
        </div>

        {/* TAB 1: PROFILE INFORMATION (COLLAPSIBLE SECTIONS) */}
        {activeTab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {profileMsg.text && (
              <div style={{
                background: profileMsg.type === 'success' ? '#F0FDF4' : '#FEF2F2',
                border: `1px solid ${profileMsg.type === 'success' ? '#86EFAC' : '#FECACA'}`,
                color: profileMsg.type === 'success' ? '#166534' : '#DC2626',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <i className={`fa-solid ${profileMsg.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
                <span>{profileMsg.text}</span>
              </div>
            )}

            {/* SECTION 1: PERSONAL DETAILS & PROFILE PHOTO (COLLAPSIBLE) */}
            <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <i className="fa-solid fa-user-gear" style={{ fontSize: '1.2rem', color: '#2563EB' }}></i>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: '800', color: '#1E293B' }}>Personal Details &amp; Profile Photo</h3>
                    <div style={{ fontSize: '0.74rem', color: '#64748B' }}>Legal Name: <strong>{fullName}</strong> &bull; Phone: <strong>{phone}</strong></div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingPersonal(!isEditingPersonal)}
                  style={{
                    background: isEditingPersonal ? '#F1F5F9' : '#EFF6FF',
                    color: isEditingPersonal ? '#475569' : '#2563EB',
                    border: '1px solid #BFDBFE',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.76rem',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className={`fa-solid ${isEditingPersonal ? 'fa-xmark' : 'fa-pen-to-square'}`}></i>
                  {isEditingPersonal ? 'Cancel / Close' : '✏️ Edit Profile Details'}
                </button>
              </div>

              {isEditingPersonal && (
                <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  
                  {/* Photo Upload Box */}
                  <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '800', color: '#334155', marginBottom: '6px' }}>
                      📸 Profile Photo Upload
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      {profileImage ? (
                        <img src={profileImage} alt="Preview" style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #10B981' }} />
                      ) : (
                        <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#2563EB', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '1.4rem' }}>
                          {(fullName || 'A').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <input
                        type="file"
                        id="rider-photo-input-col"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (evt) => setProfileImage(evt.target.result);
                          reader.readAsDataURL(file);
                        }}
                      />
                      <label htmlFor="rider-photo-input-col" style={{ background: '#2563EB', color: '#FFF', padding: '6px 12px', borderRadius: '6px', fontSize: '0.76rem', fontWeight: '800', cursor: 'pointer' }}>
                        <i className="fa-solid fa-cloud-arrow-up"></i> Choose File
                      </label>
                      {profileImage && (
                        <button type="button" onClick={() => setProfileImage('')} style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #CBD5E1', padding: '6px 10px', borderRadius: '6px', fontSize: '0.74rem', cursor: 'pointer' }}>
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>Full Legal Name *</label>
                      <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.84rem', fontWeight: '700', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>Mobile Phone *</label>
                      <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.84rem', fontWeight: '700', boxSizing: 'border-box' }} />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleUpdateProfile}
                    disabled={updatingProfile}
                    style={{ background: '#10B981', color: '#FFF', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '800', fontSize: '0.84rem', cursor: 'pointer' }}
                  >
                    {updatingProfile ? 'Saving...' : '💾 Save Personal Profile Updates'}
                  </button>
                </div>
              )}
            </div>

            {/* SECTION 2: BIKE & VEHICLE INFORMATION (COLLAPSIBLE) */}
            <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <i className="fa-solid fa-motorcycle" style={{ fontSize: '1.2rem', color: '#10B981' }}></i>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: '800', color: '#1E293B' }}>Bike &amp; Vehicle Registration</h3>
                    <div style={{ fontSize: '0.74rem', color: '#64748B' }}>Plate: <strong>{vehicleNumber || 'Not Set'}</strong> &bull; Type: <strong>{vehicleType}</strong></div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingBike(!isEditingBike)}
                  style={{
                    background: isEditingBike ? '#F1F5F9' : '#ECFDF5',
                    color: isEditingBike ? '#475569' : '#047857',
                    border: '1px solid #A7F3D0',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.76rem',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className={`fa-solid ${isEditingBike ? 'fa-xmark' : 'fa-pen-to-square'}`}></i>
                  {isEditingBike ? 'Cancel / Close' : '✏️ Edit Bike Info'}
                </button>
              </div>

              {isEditingBike && (
                <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Bike / Vehicle Plate Number *</label>
                      <input type="text" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="e.g. AP 39 BK 8204" style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.84rem', fontWeight: '800', textTransform: 'uppercase', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Vehicle Class</label>
                      <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.84rem', fontWeight: '700', boxSizing: 'border-box', background: '#fff' }}>
                        <option value="Motorcycle">Motorcycle / Petrol Bike</option>
                        <option value="Electric Scooter">Electric Scooter (EV)</option>
                        <option value="EV Bike">EV Delivery Bike</option>
                        <option value="Auto / Three Wheeler">Auto / Three Wheeler</option>
                      </select>
                    </div>
                  </div>

                  {/* Driving License Locked Box */}
                  <div style={{ background: '#F8FAFC', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: '800' }}>🔒 DRIVING LICENSE (DL) - LOCKED</div>
                      <div style={{ fontSize: '0.86rem', fontWeight: '900', color: '#0F172A', fontFamily: 'monospace' }}>{drivingLicense || 'AP07 20210087654'}</div>
                    </div>
                    <span style={{ fontSize: '0.68rem', background: '#E2E8F0', padding: '3px 8px', borderRadius: '4px', fontWeight: '800', color: '#475569' }}>LOCKED KYC</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleUpdateProfile}
                    disabled={updatingProfile}
                    style={{ background: '#10B981', color: '#FFF', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '800', fontSize: '0.84rem', cursor: 'pointer' }}
                  >
                    {updatingProfile ? 'Saving...' : '💾 Save Bike Details'}
                  </button>
                </div>
              )}
            </div>

            {/* MANDATORY LIVE FACE VERIFICATION BOX */}
            <div style={{
              background: profile?.isFaceVerified ? 'linear-gradient(135deg, #064E3B 0%, #065F46 100%)' : 'linear-gradient(135deg, #7C2D12 0%, #991B1B 100%)',
              borderRadius: '14px',
              padding: '14px 16px',
              color: '#FFF',
              border: `1.5px solid ${profile?.isFaceVerified ? '#10B981' : '#EF4444'}`,
              boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: profile?.isFaceVerified ? '#10B981' : '#EF4444',
                    color: '#FFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.1rem',
                    fontWeight: '900',
                    flexShrink: 0
                  }}>
                    <i className={`fa-solid ${profile?.isFaceVerified ? 'fa-user-check' : 'fa-camera'}`}></i>
                  </div>
                  <div>
                    <div style={{ fontWeight: '900', fontSize: '0.88rem' }}>
                      {profile?.isFaceVerified ? '🔒 Mandatory Face Verification Complete' : '⚠️ Live Face Verification (Mandatory)'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: profile?.isFaceVerified ? '#D1FAE5' : '#FCA5A5', marginTop: '1px' }}>
                      {profile?.isFaceVerified
                        ? 'Biometric identity recorded & locked in system KYC.'
                        : 'Live camera facial capture is mandatory for order dispatch.'}
                    </div>
                  </div>
                </div>

                {profile?.isFaceVerified ? (
                  <div style={{ background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: '14px', fontSize: '0.7rem', fontWeight: '800', color: '#A7F3D0', border: '1px solid #10B981' }}>
                    <i className="fa-solid fa-lock"></i> LOCKED KYC RECORD
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsFaceModalOpen(true)}
                    style={{
                      background: '#EF4444',
                      color: '#FFF',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '0.78rem',
                      fontWeight: '900',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <i className="fa-solid fa-camera"></i> Verify Face Now
                  </button>
                )}
              </div>
            </div>

            {/* SECTION 3: EMERGENCY CONTACT DETAILS (COLLAPSIBLE) */}
            <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <i className="fa-solid fa-phone-volume" style={{ fontSize: '1.2rem', color: '#EF4444' }}></i>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: '800', color: '#1E293B' }}>Emergency Contact Details</h3>
                    <div style={{ fontSize: '0.74rem', color: '#64748B' }}>Contact: <strong>{emergencyName || 'Not Set'}</strong> ({emergencyRelation || 'Family'}) &bull; <strong>{emergencyPhone || 'Not Set'}</strong></div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingEmergency(!isEditingEmergency)}
                  style={{
                    background: isEditingEmergency ? '#F1F5F9' : '#FEF2F2',
                    color: isEditingEmergency ? '#475569' : '#DC2626',
                    border: '1px solid #FECACA',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.76rem',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className={`fa-solid ${isEditingEmergency ? 'fa-xmark' : 'fa-pen-to-square'}`}></i>
                  {isEditingEmergency ? 'Cancel / Close' : '✏️ Edit Emergency Contact'}
                </button>
              </div>

              {isEditingEmergency && (
                <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: '#64748B', marginBottom: '3px' }}>Contact Name</label>
                      <input type="text" placeholder="e.g. Ramesh" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8rem', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: '#64748B', marginBottom: '3px' }}>Contact Phone</label>
                      <input type="text" placeholder="+91 98481 00000" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8rem', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: '#64748B', marginBottom: '3px' }}>Relationship</label>
                      <input type="text" placeholder="e.g. Brother" value={emergencyRelation} onChange={(e) => setEmergencyRelation(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8rem', boxSizing: 'border-box' }} />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleUpdateProfile}
                    disabled={updatingProfile}
                    style={{ background: '#10B981', color: '#FFF', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '800', fontSize: '0.84rem', cursor: 'pointer' }}
                  >
                    {updatingProfile ? 'Saving...' : '💾 Save Emergency Contact'}
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 2: SECURITY & PASSWORD UPDATE (OPTION 1: CURRENT PASSWORD vs OPTION 2: EMAIL OTP) */}
        {activeTab === 'security' && (
          <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '18px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            
            <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1E293B', margin: '0 0 4px 0' }}>
              Account Password &amp; Verification Options
            </h2>
            <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0 0 14px 0' }}>
              Choose your preferred verification option below to update your password securely.
            </p>

            {/* Option Selection Switcher */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => {
                  setSecVerificationOption('password');
                  setPasswordMsg({ type: '', text: '' });
                }}
                style={{
                  padding: '12px 10px',
                  borderRadius: '10px',
                  border: `2px solid ${secVerificationOption === 'password' ? '#2563EB' : '#E2E8F0'}`,
                  background: secVerificationOption === 'password' ? '#EFF6FF' : '#F8FAFC',
                  color: secVerificationOption === 'password' ? '#1E40AF' : '#64748B',
                  fontWeight: '800',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <i className="fa-solid fa-key" style={{ color: secVerificationOption === 'password' ? '#2563EB' : '#94A3B8' }}></i>
                <div>
                  <div>Option 1: Current Password</div>
                  <div style={{ fontSize: '0.68rem', fontWeight: '600', color: '#64748B' }}>Verify using existing password</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSecVerificationOption('otp');
                  setPasswordMsg({ type: '', text: '' });
                }}
                style={{
                  padding: '12px 10px',
                  borderRadius: '10px',
                  border: `2px solid ${secVerificationOption === 'otp' ? '#10B981' : '#E2E8F0'}`,
                  background: secVerificationOption === 'otp' ? '#ECFDF5' : '#F8FAFC',
                  color: secVerificationOption === 'otp' ? '#065F46' : '#64748B',
                  fontWeight: '800',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <i className="fa-solid fa-envelope-circle-check" style={{ color: secVerificationOption === 'otp' ? '#10B981' : '#94A3B8' }}></i>
                <div>
                  <div>Option 2: Email OTP</div>
                  <div style={{ fontSize: '0.68rem', fontWeight: '600', color: '#64748B' }}>Verify via 6-digit Email code</div>
                </div>
              </button>
            </div>

            {passwordMsg.text && (
              <div style={{
                background: passwordMsg.type === 'success' ? '#F0FDF4' : '#FEF2F2',
                border: `1px solid ${passwordMsg.type === 'success' ? '#86EFAC' : '#FECACA'}`,
                color: passwordMsg.type === 'success' ? '#166534' : '#DC2626',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <i className={`fa-solid ${passwordMsg.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
                <span>{passwordMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* OPTION 1: CURRENT PASSWORD FIELD */}
              {secVerificationOption === 'password' && (
                <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#334155', marginBottom: '6px' }}>
                    Option 1: Enter Current Account Password *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      required
                      placeholder="Enter existing password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      style={{ width: '100%', padding: '10px 42px 10px 14px', borderRadius: '8px', border: '1.5px solid #2563EB', fontSize: '0.9rem', boxSizing: 'border-box' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                    >
                      <i className={`fa-solid ${showCurrent ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>
              )}

              {/* OPTION 2: EMAIL OTP FIELDS */}
              {secVerificationOption === 'otp' && (
                <div style={{ background: '#ECFDF5', padding: '14px', borderRadius: '10px', border: '1px solid #A7F3D0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: '800', color: '#065F46' }}>
                      Option 2: 6-Digit Email Verification Code *
                    </label>
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={sendingOtp}
                      style={{
                        background: '#10B981',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontWeight: '800',
                        fontSize: '0.76rem',
                        cursor: sendingOtp ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {sendingOtp ? 'Sending...' : `Send OTP to ${profile?.email}`}
                    </button>
                  </div>

                  <input
                    type="text"
                    required
                    placeholder="e.g. 849201"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #10B981', fontSize: '1rem', fontWeight: '800', letterSpacing: '2px', boxSizing: 'border-box', background: '#FFF' }}
                  />
                </div>
              )}

              {/* NEW PASSWORD & CONFIRM PASSWORD */}
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                  New Secure Password * (min 6 characters)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNew ? 'text' : 'password'}
                    required
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{ width: '100%', padding: '10px 42px 10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                  >
                    <i className={`fa-solid ${showNew ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Re-type new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>

              <button
                type="submit"
                disabled={updatingPassword}
                style={{
                  background: secVerificationOption === 'password' ? '#2563EB' : '#10B981',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '12px',
                  borderRadius: '10px',
                  fontWeight: '800',
                  fontSize: '0.88rem',
                  cursor: updatingPassword ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  marginTop: '4px'
                }}
              >
                {updatingPassword
                  ? 'Updating Password...'
                  : secVerificationOption === 'password'
                    ? '🔒 Update Password using Current Password'
                    : '🔒 Confirm Password Reset with Email OTP'}
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: FLEET & LICENSE DETAILS */}
        {activeTab === 'fleet' && (
          <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1E293B', marginBottom: '4px' }}>
              Fleet Assignment &amp; Regulatory Verification
            </h2>
            <p style={{ fontSize: '0.84rem', color: '#64748B', margin: '0 0 20px 0' }}>
              These records were verified by your Warehouse Facility Manager during onboarding.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '16px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Assigned Warehouse Hub</div>
                <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#0F172A', marginTop: '4px' }}>
                  {profile?.assignedWarehouse?.name || 'Guntur Regional Hub'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#2563EB', fontWeight: '700', marginTop: '2px' }}>
                  Code: [{profile?.assignedWarehouse?.code || 'WH-AP-GNT01'}]
                </div>
              </div>

              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '16px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Assigned Vehicle</div>
                <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#0F172A', marginTop: '4px' }}>
                  {profile?.vehicleNumber || 'AP 07 BK 9021'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px' }}>
                  Vehicle Class: <strong>{profile?.vehicleType || 'Motorcycle'}</strong>
                </div>
              </div>

              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '16px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Driving License (DL)</div>
                <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#0F172A', marginTop: '4px' }}>
                  {profile?.drivingLicense || 'AP07 20210087654'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#16A34A', fontWeight: '700', marginTop: '2px' }}>
                  ✓ In-Person Verified by Manager
                </div>
              </div>

              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '16px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Route Delivery Capacity</div>
                <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#0F172A', marginTop: '4px' }}>
                  Up to 10 Multi-Stop Orders
                </div>
                <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px' }}>
                  Nearest-Neighbor Area-Wise Sequencing
                </div>
              </div>

              {/* Manager Assigned Delivery Territory Zone */}
              <div style={{
                gridColumn: '1 / -1',
                background: '#F8FAFC',
                border: `2px solid ${profile?.assignedZone?.color || '#10B981'}`,
                padding: '20px',
                borderRadius: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      background: profile?.assignedZone?.color || '#10B981',
                      display: 'inline-block',
                      boxShadow: `0 0 10px ${profile?.assignedZone?.color || '#10B981'}`
                    }}></span>
                    <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>
                      Warehouse Manager Assigned Territory Zone
                    </span>
                  </div>
                  <span style={{
                    background: `${profile?.assignedZone?.color || '#10B981'}1A`,
                    color: profile?.assignedZone?.color || '#10B981',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    padding: '3px 10px',
                    borderRadius: '20px',
                    border: `1px solid ${profile?.assignedZone?.color || '#10B981'}`
                  }}>
                    {profile?.assignedZone?.zoneName || 'Assigned Delivery Territory'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '14px' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: '700' }}>Assigned Mandal</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#0369A1' }}>
                      🏛️ {profile?.assignedZone?.mandal || 'Regional Sector'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: '700' }}>Coverage Radius</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#0F172A' }}>
                      {profile?.assignedZone?.radiusKm || 5} KM from Hub
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: '700' }}>
                      Authorized Multi-PIN Cluster ({profile?.assignedZone?.pincodes?.length || 0} PINs)
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                      {profile?.assignedZone?.pincodes?.length > 0 ? (
                        profile.assignedZone.pincodes.map((pin) => (
                          <span
                            key={pin}
                            style={{
                              background: '#EFF6FF',
                              color: '#1D4ED8',
                              border: '1px solid #BFDBFE',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              fontFamily: 'monospace'
                            }}
                          >
                            📌 {pin}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: '0.85rem', color: '#64748B' }}>All Hub Pincodes</span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{
                  marginTop: '14px',
                  padding: '10px 14px',
                  background: '#FFFFFF',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  fontSize: '0.76rem',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <i className="fa-solid fa-shield-halved" style={{ color: '#10B981', fontSize: '0.95rem' }}></i>
                  <span>
                    <strong>Exclusive Territory Dispatch:</strong> Orders destined for these pincodes are strictly reserved for agents assigned to this territory. Warehouse pickup scanning automatically validates your zone.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {isFaceModalOpen && (
        <FaceVerificationModal
          isOpen={isFaceModalOpen}
          onClose={() => setIsFaceModalOpen(false)}
          onVerifiedSuccess={() => fetchProfile()}
          mode={profile?.isFaceVerified ? 'RECAPTURE' : 'ENROLL'}
          enrolledPhotoUrl={profile?.faceVerificationPhoto}
        />
      )}

      {isTrackedPhotoOpen && (
        <TrackedPhotoModal
          isOpen={isTrackedPhotoOpen}
          onClose={() => setIsTrackedPhotoOpen(false)}
          photoUrl={profile?.faceVerificationPhoto}
          verifiedAt={profile?.faceVerifiedAt}
          agentName={profile?.fullName}
        />
      )}

      {isMobileModalOpen && (
        <MobileConnectModal
          isOpen={isMobileModalOpen}
          onClose={() => setIsMobileModalOpen(false)}
        />
      )}
    </main>
  );
}
