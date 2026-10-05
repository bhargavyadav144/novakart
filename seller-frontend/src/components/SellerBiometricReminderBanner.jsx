import React, { useState, useEffect } from 'react';
import { useSellerAuth } from '../context/SellerAuthContext';
import sellerApi from '../services/sellerApi';
import SellerBiometricEnrollModal from './SellerBiometricEnrollModal';

export default function SellerBiometricReminderBanner() {
  const { sellerUser, token, updateSellerUser } = useSellerAuth();
  const [showModal, setShowModal] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    let isMounted = true;
    const checkBiometricStatus = async () => {
      try {
        const { data } = await sellerApi.get('/sellers/profile');
        if (isMounted && data.success) {
          setProfileData(data);
          if (data.isBiometricEnrolled !== undefined && updateSellerUser) {
            updateSellerUser({
              isBiometricEnrolled: data.isBiometricEnrolled,
              biometricSetupRequired: data.biometricSetupRequired,
              enrolledFacesCount: data.enrolledFacesCount,
              enrolledFingerprintsCount: data.enrolledFingerprintsCount
            });
          }
        }
      } catch {
        /* silent */
      }
    };

    checkBiometricStatus();
    return () => { isMounted = false; };
  }, [token, updateSellerUser]);

  // Determine if biometric setup is required
  const isRequired = profileData
    ? profileData.biometricSetupRequired
    : (sellerUser?.biometricSetupRequired || !sellerUser?.isBiometricEnrolled);

  if (!isRequired) return null;

  const facesCount = profileData?.enrolledFacesCount ?? sellerUser?.enrolledFacesCount ?? 0;
  const fpsCount = profileData?.enrolledFingerprintsCount ?? sellerUser?.enrolledFingerprintsCount ?? 0;

  return (
    <>
      <div style={{
        background: 'linear-gradient(90deg, #7f1d1d 0%, #991b1b 50%, #b91c1c 100%)',
        color: '#ffffff',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: '0 4px 12px rgba(185, 28, 28, 0.25)',
        borderBottom: '2px solid #ef4444',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.1rem',
            color: '#fef08a',
            flexShrink: 0
          }}>
            <i className="fa-solid fa-fingerprint"></i>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: '800', fontSize: '0.92rem', letterSpacing: '0.2px' }}>
                🚨 Action Required: Mandatory Biometric Security Incomplete
              </span>
              <span style={{
                background: '#fef08a',
                color: '#854d0e',
                fontSize: '0.7rem',
                fontWeight: '800',
                padding: '2px 8px',
                borderRadius: '12px'
              }}>
                {facesCount}/2 Faces &bull; {fpsCount}/3 Fingerprints
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#fecaca', lineHeight: '1.4' }}>
              NovaKart security mandates all merchants register <strong>2 face scans</strong> and <strong>up to 3 fingerprints</strong> to enable earnings withdrawal &amp; prevent store hijacking.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              background: '#ffffff',
              color: '#991b1b',
              border: 'none',
              fontWeight: '800',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
            }}
          >
            <i className="fa-solid fa-shield-halved" style={{ color: '#dc2626' }}></i>
            Complete Biometric Setup (3 Fingerprints &amp; 2 Faces)
          </button>
        </div>
      </div>

      <SellerBiometricEnrollModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        isStandalone={true}
        onSuccess={() => {
          setShowModal(false);
          // Refetch profile data to hide banner
          sellerApi.get('/sellers/profile').then(({ data }) => {
            if (data.success) {
              setProfileData(data);
              if (updateSellerUser) updateSellerUser(data);
            }
          });
        }}
      />
    </>
  );
}
