import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDeviceMode } from '../context/DeviceModeContext';
import { Link } from 'react-router-dom';
import api, { formatINR } from '../services/api';

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';

export default function ProfilePage() {
  const { user, logout, updateProfile } = useAuth();
  const { isPhone } = useDeviceMode();
  const searchParams = new URLSearchParams(window.location.search);
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    tabParam === 'rewards' || tabParam === 'giftcards' ? 'rewards' : 'personal'
  );
  
  // Edit Form Fields (Personal settings)
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatar, setAvatar] = useState(user?.avatar || DEFAULT_AVATAR);
  const [gender, setGender] = useState(user?.gender || '');
  const [dob, setDob] = useState(user?.dob || '');

  // Multi-address book states
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [editIndex, setEditIndex] = useState(null); // null = new, number = edit index

  // Active address input fields
  const [recName, setRecName] = useState('');
  const [recPhone, setRecPhone] = useState('');
  const [houseNo, setHouseNo] = useState('');
  const [street, setStreet] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');

  // Gift Card reward states
  const [giftCards, setGiftCards] = useState([]);
  const [copiedCardId, setCopiedCardId] = useState(null);
  const [scratchedCards, setScratchedCards] = useState({});

  const handleCopyCardCode = (e, code, id) => {
    e.stopPropagation();
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCardId(id);
    setTimeout(() => setCopiedCardId(null), 2500);
  };


  // Geolocation and map UI states
  const [locating, setLocating] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [pinnedCoords, setPinnedCoords] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [reverseGeocoding, setReverseGeocoding] = useState(false);
  const [mapSelectedAddress, setMapSelectedAddress] = useState('');
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [updating, setUpdating] = useState(false);

  // Address parser (loads array of saved addresses)
  useEffect(() => {
    if (user?.address) {
      try {
        const parsed = JSON.parse(user.address);
        if (Array.isArray(parsed)) {
          setSavedAddresses(parsed);
          setIsEditingAddress(parsed.length === 0);
        } else if (parsed && typeof parsed === 'object') {
          setSavedAddresses([parsed]);
          setIsEditingAddress(false);
        } else {
          setSavedAddresses([]);
          setIsEditingAddress(true);
        }
      } catch {
        // Fallback for raw text address
        const fallback = {
          recipientName: user.name || '',
          recipientPhone: user.phone || '',
          houseNo: '',
          street: user.address,
          landmark: '',
          city: '',
          state: '',
          pincode: ''
        };
        setSavedAddresses([fallback]);
        setIsEditingAddress(false);
      }
    } else {
      setSavedAddresses([]);
      setIsEditingAddress(true);
    }
  }, [user?.address]);

  // Fetch gift cards on tab change
  useEffect(() => {
    if (activeTab === 'rewards') {
      api.get('/gift-cards/my-cards')
        .then(res => {
          if (res.data && res.data.cards) {
            setGiftCards(res.data.cards);
          }
        })
        .catch(err => {
          console.error('Failed to fetch rewards:', err);
        });
    }
  }, [activeTab]);

  // Inject Leaflet CSS & JS dynamically
  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => setMapLoaded(true);
      document.head.appendChild(script);
    } else {
      setMapLoaded(true);
    }
  }, []);

  // Map Canvas Instantiation Hooks
  const mapRef = useRef(null);
  const leafletMapInstance = useRef(null);
  const markerInstance = useRef(null);

  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [searchingLocation, setSearchingLocation] = useState(false);

  useEffect(() => {
    if (showMapModal && mapLoaded && mapRef.current) {
      const timer = setTimeout(() => {
        const defaultCoords = [16.3067, 80.4365]; // Local AP / Guntur region default
        const initialCoords = pinnedCoords || defaultCoords;

        if (leafletMapInstance.current) {
          leafletMapInstance.current.remove();
        }

        const L = window.L;
        if (!L) return;

        const DefaultIcon = L.icon({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41]
        });
        L.Marker.prototype.options.icon = DefaultIcon;

        const map = L.map(mapRef.current).setView(initialCoords, 14);
        leafletMapInstance.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        const marker = L.marker(initialCoords, { draggable: true }).addTo(map);
        markerInstance.current = marker;

        const performReverseGeocode = async (coords) => {
          setReverseGeocoding(true);
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&addressdetails=1`);
            const data = await res.json();
            if (data) {
              setMapSelectedAddress(data.display_name);
            }
          } catch (e) {
            console.error(e);
          } finally {
            setReverseGeocoding(false);
          }
        };

        performReverseGeocode({ lat: initialCoords[0], lng: initialCoords[1] });

        // Auto-locate GPS on map open if pinnedCoords was not previously set
        if (!pinnedCoords && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const deviceLat = pos.coords.latitude;
              const deviceLng = pos.coords.longitude;
              map.setView([deviceLat, deviceLng], 15);
              marker.setLatLng([deviceLat, deviceLng]);
              setPinnedCoords([deviceLat, deviceLng]);
              performReverseGeocode({ lat: deviceLat, lng: deviceLng });
            },
            () => {},
            { enableHighAccuracy: true, timeout: 6000 }
          );
        }

        marker.on('dragend', () => {
          const latLng = marker.getLatLng();
          setPinnedCoords([latLng.lat, latLng.lng]);
          performReverseGeocode(latLng);
        });

        map.on('click', (e) => {
          const { lat, lng } = e.latlng;
          marker.setLatLng([lat, lng]);
          setPinnedCoords([lat, lng]);
          performReverseGeocode({ lat, lng });
        });
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [showMapModal, mapLoaded]);

  const handleSearchLocationOnMap = async () => {
    if (!mapSearchQuery.trim()) return;
    setSearchingLocation(true);
    try {
      const q = mapSearchQuery.trim();
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q + ', Andhra Pradesh, India')}&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        const targetLat = parseFloat(data[0].lat);
        const targetLng = parseFloat(data[0].lon);
        setPinnedCoords([targetLat, targetLng]);
        setMapSelectedAddress(data[0].display_name);
        if (leafletMapInstance.current) {
          leafletMapInstance.current.setView([targetLat, targetLng], 15);
        }
        if (markerInstance.current) {
          markerInstance.current.setLatLng([targetLat, targetLng]);
        }
      } else {
        alert(`Location "${mapSearchQuery}" not found. Try searching with Pincode or Village name.`);
      }
    } catch (e) {
      console.error(e);
      alert('Error searching location');
    } finally {
      setSearchingLocation(false);
    }
  };


  const handleConfirmMapLocation = () => {
    if (!pinnedCoords) return;
    setReverseGeocoding(true);
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pinnedCoords[0]}&lon=${pinnedCoords[1]}&addressdetails=1`)
      .then(res => res.json())
      .then(data => {
        if (data && data.address) {
          const addr = data.address;
          setPincode(addr.postcode || '');
          setCity(addr.city || addr.town || addr.village || addr.suburb || '');
          setState(addr.state || '');
          setStreet(addr.road || addr.suburb || addr.neighbourhood || addr.amenity || '');
        }
        setShowMapModal(false);
      })
      .catch(err => {
        console.error(err);
        setShowMapModal(false);
      })
      .finally(() => {
        setReverseGeocoding(false);
      });
  };

  const handleUseLiveLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setPinnedCoords([latitude, longitude]);
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`);
          const data = await res.json();
          if (data && data.address) {
            const addr = data.address;
            setPincode(addr.postcode || '');
            setCity(addr.city || addr.town || addr.village || addr.suburb || '');
            setState(addr.state || '');
            setStreet(addr.road || addr.suburb || addr.neighbourhood || addr.amenity || '');
            setSuccessMsg('🎯 Live location coordinates parsed and filled below!');
          }
        } catch (e) {
          setErrorMsg('Failed to reverse-geocode coordinates.');
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        console.error(err);
        setErrorMsg('Access to GPS coordinates denied. Please enter manually or select on Map.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handlePincodeChange = async (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPincode(val);
    if (val.length === 6) {
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${val}`);
        const data = await res.json();
        if (data && data[0] && data[0].Status === 'Success') {
          const postOffice = data[0].PostOffice[0];
          setCity(postOffice.District || postOffice.District || '');
          setState(postOffice.State || '');
        }
      } catch (err) {
        console.error('Pincode lookup error:', err);
      }
    }
  };

  const handleAddNewAddressClick = () => {
    setEditIndex(null);
    setRecName('');
    setRecPhone('');
    setHouseNo('');
    setStreet('');
    setLandmark('');
    setCity('');
    setState('');
    setPincode('');
    setPinnedCoords(null);
    setIsEditingAddress(true);
  };

  const handleEditAddressClick = (index, e) => {
    e.stopPropagation();
    setEditIndex(index);
    const addr = savedAddresses[index];
    setRecName(addr.recipientName || '');
    setRecPhone(addr.recipientPhone || '');
    setHouseNo(addr.houseNo || '');
    setStreet(addr.street || '');
    setLandmark(addr.landmark || '');
    setCity(addr.city || '');
    setState(addr.state || '');
    setPincode(addr.pincode || addr.postalCode || '');
    setIsEditingAddress(true);
  };

  const handleDeleteAddress = async (index, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this address?')) return;
    const updated = savedAddresses.filter((_, i) => i !== index);
    setSavedAddresses(updated);

    try {
      await api.put('/auth/profile', {
        name: user.name,
        phone: user.phone,
        avatar: user.avatar,
        address: JSON.stringify(updated)
      });
      setSuccessMsg('✅ Address removed successfully.');
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to update address list.');
    }
  };

  const handleSaveAddressToList = async (e) => {
    e.preventDefault();
    if (!recName.trim() || !recPhone.trim() || !houseNo.trim() || !street.trim() || !city.trim() || !state.trim() || !pincode.trim()) {
      setErrorMsg('Please fill in all required delivery details.');
      return;
    }

    const newAddr = {
      recipientName: recName,
      recipientPhone: recPhone,
      houseNo,
      street,
      landmark,
      city,
      state,
      pincode,
      coordinates: pinnedCoords ? { lat: pinnedCoords[0], lng: pinnedCoords[1] } : undefined
    };

    let updatedList = [];
    if (editIndex !== null) {
      updatedList = savedAddresses.map((addr, idx) => idx === editIndex ? newAddr : addr);
    } else {
      updatedList = [...savedAddresses, newAddr];
    }

    setSavedAddresses(updatedList);
    setIsEditingAddress(false);
    setEditIndex(null);

    // Save array to MongoDB
    setUpdating(true);
    try {
      const res = await updateProfile({
        name,
        phone,
        avatar,
        gender,
        dob,
        address: JSON.stringify(updatedList)
      });
      if (res.success) {
        setSuccessMsg('✅ Address book saved successfully!');
      } else {
        setErrorMsg(res.message);
      }
    } catch {
      setErrorMsg('Failed to sync address details.');
    } finally {
      setUpdating(false);
    }
  };

  if (!user) {
    return (
      <div className="container section-padding" style={{ textAlign: 'center', minHeight: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ background: '#fff', padding: '40px', borderRadius: '16px', boxShadow: '0 8px 30px rgba(0,0,0,0.06)', border: '1px solid #eee', maxWidth: '400px' }}>
          <i className="fa-solid fa-lock" style={{ fontSize: '3rem', color: '#ccc', marginBottom: '20px' }}></i>
          <h3 style={{ fontWeight: '800', color: 'var(--primary-color)' }}>Access Restricted</h3>
          <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '8px' }}>Please sign in to access your personal dashboard and order logs.</p>
          <Link to="/login" className="btn btn-primary" style={{ marginTop: '24px', width: '100%', display: 'inline-block' }}>Sign In Now</Link>
        </div>
      </div>
    );
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    
    if (!name.trim()) {
      setErrorMsg('Full Name is required.');
      return;
    }

    setUpdating(true);
    try {
      const res = await updateProfile({
        name,
        email,
        phone,
        avatar,
        gender,
        dob,
        address: JSON.stringify(savedAddresses)
      });
      if (res.success) {
        setSuccessMsg('✅ Profile & Email updated successfully!');
      } else {
        setErrorMsg(res.message);
      }
    } catch {
      setErrorMsg('An unexpected error occurred while saving profile.');
    } finally {
      setUpdating(false);
    }
  };



  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG/JPG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        try {
          // Client-side auto-resizing to max 400x400 to optimize performance & storage
          const canvas = document.createElement('canvas');
          const MAX_DIM = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_DIM) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Compress to clean JPEG
          const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.88);

          setAvatar(optimizedBase64);
          setSuccessMsg('');
          setErrorMsg('');
          setUpdating(true);

          const res = await updateProfile({
            name,
            phone,
            avatar: optimizedBase64,
            gender,
            dob,
            address: JSON.stringify(savedAddresses)
          });

          if (res && res.success) {
            setSuccessMsg('✅ Custom profile avatar uploaded and saved!');
          } else {
            setErrorMsg(res?.message || 'Failed to update avatar.');
          }
        } catch (err) {
          setErrorMsg(err?.response?.data?.message || err.message || 'Error processing and uploading avatar image.');
        } finally {
          setUpdating(false);
        }
      };

      img.onerror = () => {
        setErrorMsg('Failed to read image content. Please choose another image.');
      };

      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  if (!user) {
    return (
      <main 
        className="container section-padding" 
        style={{ 
          maxWidth: '560px', 
          margin: '40px auto', 
          textAlign: 'center',
          padding: isPhone ? '24px 16px' : '40px 20px'
        }}
      >
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '40px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
          <div style={{ width: '68px', height: '68px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', fontSize: '1.8rem', color: '#3B82F6' }}>
            <i className="fa-solid fa-user-lock"></i>
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0F172A', marginBottom: '8px' }}>User Account &amp; Profile</h2>
          <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '24px', lineHeight: '1.5' }}>
            Please log in or create an account to view and update your user profile, delivery addresses, and rewards.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link to="/login" className="btn-primary" style={{ padding: '10px 24px', textDecoration: 'none', borderRadius: '8px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa-solid fa-arrow-right-to-bracket"></i> Login Now
            </Link>
            <Link to="/register" style={{ padding: '10px 24px', textDecoration: 'none', borderRadius: '8px', fontWeight: '700', border: '1px solid #CBD5E1', color: '#334155', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              Create Account
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main 
      className="container section-padding"
      style={{
        padding: isPhone ? '12px 10px 85px 10px' : undefined,
        maxWidth: isPhone ? '100%' : 'var(--container-max)'
      }}
    >
      <div 
        className="profile-layout"
        style={{ 
          display: 'grid', 
          gridTemplateColumns: isPhone ? '1fr' : '320px 1fr', 
          gap: isPhone ? '16px' : '32px', 
          alignItems: 'start' 
        }}
      >
        
        {/* Left Side: Avatar and Tab Navigation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? '14px' : '24px' }}>
          <div style={{ background: '#fff', border: '1px solid #EAEAEA', borderRadius: '16px', padding: isPhone ? '24px 14px' : '40px 24px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
            <div style={{ position: 'relative', width: isPhone ? '100px' : '130px', height: isPhone ? '100px' : '130px', margin: '0 auto 16px auto', borderRadius: '50%', border: '4px solid #EAEAEA', overflow: 'hidden' }}>
              <img src={avatar} alt="Profile Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <label htmlFor="custom-avatar" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', padding: '6px 0', fontSize: '0.65rem', color: '#fff', cursor: 'pointer', fontWeight: 'bold', textTransform: 'uppercase', transition: 'all 0.2s' }}>
                Upload File
              </label>
              <input type="file" id="custom-avatar" style={{ display: 'none' }} accept="image/*" onChange={handleImageUpload} />
            </div>

            <h3 style={{ fontSize: isPhone ? '1.15rem' : '1.25rem', fontWeight: '800', color: 'var(--primary-color)', margin: '12px 0 4px 0', wordBreak: 'break-word' }}>
              {name || 'Registered Customer'}
            </h3>
            
            <span style={{ fontSize: '0.76rem', color: '#2e7d32', background: '#e8f5e9', padding: '4px 10px', borderRadius: '20px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: isPhone ? '16px' : '24px' }}>
              <i className="fa-solid fa-circle-check"></i> Verified Customer
            </span>

            <div style={{ 
              borderTop: '1px solid #f0f0f0', 
              paddingTop: '16px', 
              display: isPhone ? 'grid' : 'flex', 
              gridTemplateColumns: isPhone ? '1fr 1fr' : undefined,
              flexDirection: isPhone ? undefined : 'column', 
              gap: '8px' 
            }}>
              <button onClick={() => setActiveTab('personal')} style={{ width: '100%', textAlign: 'left', background: activeTab === 'personal' ? 'var(--secondary-color)' : '#f8fafc', color: activeTab === 'personal' ? '#fff' : '#444', border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: isPhone ? '0.78rem' : '0.88rem', transition: 'all 0.2s' }}>
                <i className="fa-solid fa-user"></i> Personal Settings
              </button>
              <button onClick={() => setActiveTab('rewards')} style={{ width: '100%', textAlign: 'left', background: activeTab === 'rewards' ? 'var(--secondary-color)' : '#f8fafc', color: activeTab === 'rewards' ? '#fff' : '#444', border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: isPhone ? '0.78rem' : '0.88rem', transition: 'all 0.2s' }}>
                <i className="fa-solid fa-gift"></i> Rewards &amp; Offers
              </button>
              <button onClick={() => setActiveTab('security')} style={{ width: '100%', textAlign: 'left', background: activeTab === 'security' ? 'var(--secondary-color)' : '#f8fafc', color: activeTab === 'security' ? '#fff' : '#444', border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: isPhone ? '0.78rem' : '0.88rem', transition: 'all 0.2s' }}>
                <i className="fa-solid fa-shield-halved"></i> Access &amp; Security
              </button>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #EAEAEA', borderRadius: '16px', padding: isPhone ? '16px 14px' : '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
            <h4 style={{ fontWeight: '800', color: 'var(--primary-color)', marginBottom: '12px', fontSize: '0.88rem' }}>Quick Actions</h4>
            <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr 1fr' : '1fr', gap: '10px' }}>
              <Link to="/orders" className="btn btn-primary" style={{ textAlign: 'center', padding: '10px', fontSize: '0.85rem' }}>
                <i className="fa-solid fa-box-open"></i> My Orders
              </Link>
              <button onClick={logout} style={{ width: '100%', background: '#fff', border: '1px solid #dcdcdc', padding: '10px', borderRadius: '6px', fontWeight: '600', color: '#d32f2f', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.85rem' }}>
                <i className="fa-solid fa-right-from-bracket"></i> Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Tab Details Card */}
        <div style={{ background: '#fff', border: '1px solid #EAEAEA', borderRadius: '16px', padding: isPhone ? '20px 14px' : '40px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            {/* Status Banners */}
            {errorMsg && (
              <div style={{ background: '#ffebee', color: '#c62828', padding: '12px 16px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
                <i className="fa-solid fa-triangle-exclamation"></i> {errorMsg}
              </div>
            )}
            {successMsg && (
              <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '12px 16px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
                <i className="fa-solid fa-circle-check"></i> {successMsg}
              </div>
            )}

            {/* TAB 1: Personal Settings */}
            {activeTab === 'personal' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Account Credentials Form */}
                <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--primary-color)', marginBottom: '4px' }}>Personal Settings</h3>
                    <p style={{ fontSize: '0.8rem', color: '#777' }}>Update your primary account credential profile details below.</p>
                  </div>
                  
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#555', margin: 0 }}>Primary Email Address (Real Mail Sync)</label>
                      <span style={{ fontSize: '0.72rem', color: '#059669', background: '#D1FAE5', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                        <i className="fa-solid fa-circle-check"></i> Verified Real Mail
                      </span>
                    </div>
                    <input
                      type="email"
                      className="form-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. yourname@gmail.com"
                      required
                    />
                    <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                      Updating your email address will immediately send a verification notification to your new inbox.
                    </small>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#555', display: 'block', marginBottom: '6px' }}>Account Holder Full Name</label>
                    <input type="text" className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Your Full Name" required />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#555', display: 'block', marginBottom: '6px' }}>Account Mobile Phone Number</label>
                    <input type="tel" className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +91 91778 50108" />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#555', display: 'block', marginBottom: '6px' }}>Gender</label>
                    <select className="form-input" value={gender} onChange={(e) => setGender(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}>
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#555', display: 'block', marginBottom: '6px' }}>Date of Birth</label>
                    <input type="date" className="form-input" value={dob} onChange={(e) => setDob(e.target.value)} />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px', alignSelf: 'flex-start' }} disabled={updating}>
                    Save Profile Settings
                  </button>
                </form>

                {/* Saved Delivery Addresses Book */}
                <div style={{ borderTop: '1px solid #eee', paddingTop: '24px' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--primary-color)', marginBottom: '6px' }}>
                    <i className="fa-solid fa-map-location-dot" style={{ color: 'var(--secondary-color)', marginRight: '6px' }}></i>
                    Saved Delivery Addresses ({savedAddresses.length})
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: '#777', marginBottom: '14px' }}>Manage your delivery address book cards (family, friends, or office).</p>

                  {!isEditingAddress ? (
                    // Addresses List Cards
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {savedAddresses.map((addr, idx) => (
                        <div 
                          key={idx}
                          style={{ 
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            padding: '16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <strong style={{ fontSize: '0.92rem', color: '#1e293b', display: 'block', marginBottom: '4px' }}>
                              {addr.recipientName || 'No Name'} ({addr.recipientPhone || 'No Phone'})
                            </strong>
                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                              {addr.houseNo}, {addr.street}{addr.landmark ? ', ' + addr.landmark : ''}, {addr.city}, {addr.state} - {addr.pincode}
                            </span>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <button 
                              type="button" 
                              onClick={(e) => handleEditAddressClick(idx, e)}
                              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.95rem' }}
                              title="Edit address"
                            >
                              <i className="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button 
                              type="button" 
                              onClick={(e) => handleDeleteAddress(idx, e)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.95rem' }}
                              title="Delete address"
                            >
                              <i className="fa-solid fa-trash"></i>
                            </button>
                          </div>
                        </div>
                      ))}

                      <button 
                        type="button" 
                        onClick={handleAddNewAddressClick} 
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'none', border: '1px dashed #cbd5e1', padding: '14px', borderRadius: '12px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', color: 'var(--secondary-color)', width: '100%', transition: 'all 0.2s', marginTop: '10px' }}
                      >
                        <i className="fa-solid fa-plus"></i> Add New Address
                      </button>
                    </div>
                  ) : (
                    // Address Entry Form
                    <form onSubmit={handleSaveAddressToList} style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '20px', marginTop: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--primary-color)' }}>
                          {editIndex !== null ? '✏️ Edit Saved Address details' : '➕ Add New Address Details'}
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button type="button" onClick={handleUseLiveLocation} disabled={locating} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--secondary-color)', border: 'none', color: '#fff', fontSize: '0.78rem', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
                            {locating ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-crosshairs"></i>}
                            Live GPS
                          </button>
                          <button type="button" onClick={() => { setShowMapModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#3b82f6', border: 'none', color: '#fff', fontSize: '0.78rem', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
                            <i className="fa-solid fa-map"></i> Pin on Map
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr' : '1fr 1fr', gap: isPhone ? '10px' : '12px' }}>
                          <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>Name *</label>
                            <input type="text" className="form-input" value={recName} onChange={(e) => setRecName(e.target.value)} placeholder="Enter Name" required />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>Phone Number *</label>
                            <input type="tel" className="form-input" value={recPhone} onChange={(e) => setRecPhone(e.target.value)} placeholder="Enter Phone Number" required />
                          </div>
                        </div>

                        <div>
                          <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>House / Flat / Block No, Building Name *</label>
                          <input type="text" className="form-input" value={houseNo} onChange={(e) => setHouseNo(e.target.value)} placeholder="e.g. Flat 402, Block-B, Royal Residency" required />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>Road Name, Area, Colony *</label>
                          <input type="text" className="form-input" value={street} onChange={(e) => setStreet(e.target.value)} placeholder="e.g. University Campus Road, Sector 12" required />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>Landmark (Optional)</label>
                          <input type="text" className="form-input" value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="e.g. Near Metro Station / Opp Supermarket" />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr' : '1fr 1fr 1fr', gap: isPhone ? '10px' : '10px' }}>
                          <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>Pincode *</label>
                            <input type="text" className="form-input" value={pincode} onChange={handlePincodeChange} placeholder="e.g. 500001" required />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>City *</label>
                            <input type="text" className="form-input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" required />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>State *</label>
                            <input type="text" className="form-input" value={state} onChange={(e) => setState(e.target.value)} placeholder="State" required />
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                          <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.78rem' }}>
                            Save Address Details
                          </button>
                          {savedAddresses.length > 0 && (
                            <button 
                              type="button" 
                              onClick={() => { setIsEditingAddress(false); setEditIndex(null); }} 
                              style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', color: '#64748b' }}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </form>
                  )}
                </div>

              </div>
            )}

            {/* TAB: Rewards & Offers */}
            {activeTab === 'rewards' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--primary-color)', marginBottom: '4px' }}>My Rewards &amp; Offers</h3>
                  <p style={{ fontSize: '0.8rem', color: '#777' }}>View your earned promotional gift cards and active savings timelines.</p>
                </div>

                {giftCards.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    <i className="fa-solid fa-ticket-simple" style={{ fontSize: '2.5rem', color: '#94a3b8', marginBottom: '10px' }}></i>
                    <h5 style={{ fontWeight: '800', color: '#475569', margin: '0 0 4px 0' }}>No Active Rewards</h5>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Place an order above ₹1,000 to earn an instant ₹50 gift card!</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                    {giftCards.map((card) => {
                      const isExpired = new Date() > new Date(card.expiryDate);
                      const isExpiredSoon = !card.isUsed && !isExpired && (new Date(card.expiryDate) - new Date() < 5 * 24 * 60 * 60 * 1000);
                      
                      let statusText = 'AVAILABLE';
                      let statusColor = '#10B981'; // emerald
                      let statusBg = 'rgba(16, 185, 129, 0.15)';
                      let borderStyle = '1px solid #10B981';

                      if (card.isUsed) {
                        statusText = 'USED';
                        statusColor = '#94A3B8';
                        statusBg = 'rgba(148, 163, 184, 0.15)';
                        borderStyle = '1px solid #475569';
                      } else if (isExpired) {
                        statusText = 'EXPIRED';
                        statusColor = '#EF4444';
                        statusBg = 'rgba(239, 68, 68, 0.15)';
                        borderStyle = '1px solid #EF4444';
                      } else if (isExpiredSoon) {
                        statusText = 'EXPIRING SOON';
                        statusColor = '#F59E0B';
                        statusBg = 'rgba(245, 158, 11, 0.15)';
                        borderStyle = '1px solid #F59E0B';
                      }

                      const isScratched = scratchedCards[card._id] || card.isUsed;

                      // UNSCRATCHED CARD STATE (Scratch Foil View)
                      if (!isScratched && !card.isUsed && !isExpired) {
                        return (
                          <div 
                            key={card._id}
                            onClick={() => setScratchedCards(prev => ({ ...prev, [card._id]: true }))}
                            style={{
                              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                              border: '2px dashed #f59e0b',
                              borderRadius: '16px',
                              padding: '24px',
                              textAlign: 'center',
                              position: 'relative',
                              overflow: 'hidden',
                              boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                              color: '#FFFFFF',
                              cursor: 'pointer',
                              transition: 'transform 0.2s'
                            }}
                          >
                            <div style={{
                              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)',
                              borderRadius: '12px',
                              padding: '20px 16px',
                              boxShadow: 'inset 0 0 20px rgba(255,255,255,0.3)'
                            }}>
                              <div style={{ fontSize: '2.2rem', marginBottom: '4px' }}>🎁 ✨</div>
                              <h3 style={{ margin: '0 0 4px', fontSize: '1.2rem', fontWeight: '900', color: '#FFFFFF' }}>
                                ₹{card.amount} Off Reward Scratch Card
                              </h3>
                              <p style={{ margin: '0 0 12px', fontSize: '0.84rem', color: '#FEF3C7', fontWeight: '700' }}>
                                ✨ Tap / Scratch Here to Reveal Your Unique Code
                              </p>
                              <button
                                type="button"
                                style={{
                                  background: '#0F172A',
                                  color: '#F59E0B',
                                  border: '2px solid #FCD34D',
                                  padding: '8px 22px',
                                  borderRadius: '20px',
                                  fontWeight: '900',
                                  fontSize: '0.86rem',
                                  cursor: 'pointer'
                                }}
                              >
                                <i className="fa-solid fa-hand-pointer" style={{ marginRight: '6px' }}></i> TAP TO SCRATCH
                              </button>
                            </div>
                          </div>
                        );
                      }

                      // REVEALED CARD STATE
                      return (
                        <div 
                          key={card._id}
                          style={{
                            background: '#0F172A',
                            border: borderStyle,
                            borderRadius: '14px',
                            padding: isPhone ? '16px 12px' : '20px',
                            display: 'grid',
                            gridTemplateColumns: isPhone ? '1fr' : '140px 1fr auto',
                            alignItems: 'center',
                            gap: isPhone ? '12px' : '20px',
                            position: 'relative',
                            color: '#FFFFFF',
                            boxShadow: card.isUsed || isExpired ? 'none' : '0 8px 24px rgba(0,0,0,0.3)',
                            opacity: card.isUsed || isExpired ? 0.75 : 1
                          }}
                        >
                          {/* Left: Gift Value Card Badge */}
                          <div style={{
                            background: card.isUsed || isExpired ? '#1E293B' : 'linear-gradient(135deg, #10B981, #059669)',
                            color: '#FFFFFF',
                            borderRadius: '10px',
                            padding: '14px 10px',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            border: card.isUsed || isExpired ? '1px solid #475569' : '1px solid #A7F3D0'
                          }}>
                            <span style={{ fontSize: '0.65rem', display: 'block', color: 'rgba(255,255,255,0.85)', letterSpacing: '1px' }}>REWARD VALUE</span>
                            <span style={{ fontSize: '1.5rem', display: 'block', color: '#FFFFFF', margin: '4px 0', fontWeight: '900' }}>₹{card.amount}</span>
                            <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.2)', color: '#FFFFFF', padding: '2px 8px', borderRadius: '12px' }}>
                              {card.isUsed ? 'REDEEMED' : 'SINGLE USE'}
                            </span>
                          </div>

                          {/* Center: Info & Copy Button */}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                              <span style={{ fontSize: '1.05rem', color: '#10B981', fontWeight: '900', fontFamily: 'monospace', letterSpacing: '1.5px', background: 'rgba(16, 185, 129, 0.15)', padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                                {card.code}
                              </span>
                              {!card.isUsed && (
                                <button
                                  type="button"
                                  onClick={(e) => handleCopyCardCode(e, card.code, card._id)}
                                  style={{
                                    background: copiedCardId === card._id ? '#10B981' : '#38BDF8',
                                    color: '#0F172A',
                                    border: 'none',
                                    padding: '6px 14px',
                                    borderRadius: '6px',
                                    fontSize: '0.8rem',
                                    fontWeight: '800',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}
                                >
                                  <i className={`fa-solid ${copiedCardId === card._id ? 'fa-check' : 'fa-copy'}`}></i>
                                  {copiedCardId === card._id ? '✓ Copied!' : '📋 Copy Code'}
                                </button>
                              )}
                            </div>

                            <h4 style={{ fontSize: '1.05rem', margin: '4px 0 6px 0', color: '#FFFFFF', fontWeight: '800' }}>
                              ₹{card.amount} Off Gift Card Code
                            </h4>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#94A3B8' }}>
                              {card.isUsed ? (
                                <span style={{ color: '#94A3B8' }}>Used on Order #{card.orderId?.orderNumber || 'N/A'}</span>
                              ) : (
                                <span>Expires: <strong style={{ color: isExpired ? '#F87171' : isExpiredSoon ? '#FBBF24' : '#6EE7B7' }}>{new Date(card.expiryDate).toLocaleDateString()}</strong> &bull; ⚡ Single-use per account</span>
                              )}
                            </p>
                          </div>

                          {/* Right: Badge Status */}
                          <div style={{ textAlign: isPhone ? 'left' : 'right' }}>
                            <span style={{
                              display: 'inline-block',
                              color: statusColor,
                              background: statusBg,
                              border: borderStyle,
                              fontSize: '0.72rem',
                              fontWeight: '800',
                              padding: '6px 14px',
                              borderRadius: '20px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              {statusText}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Access & Security */}
            {activeTab === 'security' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--primary-color)', marginBottom: '4px' }}>Access &amp; Security</h3>
                  <p style={{ fontSize: '0.8rem', color: '#777' }}>Review your account status and credentials clearance roles in NovaKart.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr' : '1fr 1fr', gap: isPhone ? '10px' : '16px', marginTop: '10px' }}>
                  <div style={{ border: '1px solid #eee', padding: '16px', borderRadius: '10px', background: '#fcfcfc' }}>
                    <span style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>SYSTEM ROLE</span>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--accent-color)', textTransform: 'capitalize' }}>{user.role}</strong>
                  </div>
                  <div style={{ border: '1px solid #eee', padding: '16px', borderRadius: '10px', background: '#fcfcfc' }}>
                    <span style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>ACCOUNT STATUS</span>
                    <strong style={{ fontSize: '1.1rem', color: '#2e7d32' }}>Active / Verified</strong>
                  </div>
                </div>

                <div style={{ background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: '12px', padding: '18px', marginTop: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#1877F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.2rem' }}>
                        <i className="fa-brands fa-facebook-f"></i>
                      </div>
                      <div>
                        <strong style={{ fontSize: '0.92rem', color: '#1E3A8A', display: 'block' }}>Facebook Authentication System</strong>
                        <span style={{ fontSize: '0.78rem', color: '#3B82F6' }}>Single Sign-On (SSO) Identity Provider</span>
                      </div>
                    </div>
                    <span style={{ background: '#1877F2', color: '#fff', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '800' }}>
                      ✓ Active System
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#1E40AF', lineHeight: '1.45' }}>
                    Your account is enabled for instant 1-click login using Facebook Single Sign-On. When logging in via Facebook, your profile picture and verified email address automatically sync across all NovaKart portals.
                  </p>
                </div>

                <div style={{ background: '#fff8e1', border: '1px solid #ffd54f', borderRadius: '10px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <i className="fa-solid fa-circle-info" style={{ color: '#f59e0b', fontSize: '1.2rem', marginTop: '2px' }}></i>
                  <div>
                    <h5 style={{ fontWeight: '800', color: '#5d4037', margin: '0 0 4px 0' }}>Single Sign-On (SSO) Managed</h5>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#795548', lineHeight: '1.4' }}>
                      Your credentials are bound to your verified Google/Facebook or Phone Authentication records. To reset passwordless settings or change main secure triggers, check your identity providers.
                    </p>
                  </div>
                </div>
              </div>
            )}


          </div>

          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '20px', marginTop: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#999' }}>
            <span>NovaKart Multi-Vendor Secure Account Portal</span>
            <span>v1.0.4 (2026)</span>
          </div>
        </div>

      </div>

      {/* Interactive Map Modal (Rapido-style Pinning) */}
      {showMapModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
          <div style={{ background: '#fff', width: '90%', maxWidth: '500px', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', position: 'relative' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--primary-color)', margin: 0 }}>🎯 Pin Delivery Location</h3>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0 0' }}>Drag the marker or click map to pinpoint your location.</p>
              </div>
              <button onClick={() => setShowMapModal(false)} style={{ border: 'none', background: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8' }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Village / Pincode Location Search Bar */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>

              <input
                type="text"
                placeholder="Search Village, Mandal or Pincode (e.g. Narakoduru, 522213)"
                value={mapSearchQuery}
                onChange={(e) => setMapSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchLocationOnMap(); } }}
                style={{ flex: 1, padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.82rem', background: '#F8FAFC' }}
              />
              <button
                type="button"
                onClick={handleSearchLocationOnMap}
                disabled={searchingLocation}
                style={{ background: '#2563EB', color: '#FFF', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <i className={searchingLocation ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-magnifying-glass"}></i> Search
              </button>
            </div>

            {/* Map Canvas */}
            <div 
              ref={mapRef} 
              id="profile-map" 
              style={{ width: '100%', height: '300px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', position: 'relative' }}
            >

              {!mapLoaded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.5rem', color: 'var(--secondary-color)' }}></i>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Loading map system...</span>
                </div>
              )}
            </div>

            {/* Address Preview Bar */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', margin: '14px 0', minHeight: '50px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: '700', color: 'var(--secondary-color)', marginBottom: '4px' }}>
                <i className="fa-solid fa-location-dot"></i> Pinned Coordinates Address
              </div>
              <p style={{ fontSize: '0.8rem', color: '#334155', margin: 0, lineHeight: '1.35' }}>
                {reverseGeocoding ? (
                  <span style={{ color: '#94a3b8' }}><i className="fa-solid fa-spinner fa-spin"></i> Resolving pinned location details...</span>
                ) : (
                  mapSelectedAddress || 'Locating pinned coordinates...'
                )}
              </p>
            </div>

            {/* Confirm Button */}
            <button 
              type="button" 
              onClick={handleConfirmMapLocation}
              disabled={reverseGeocoding}
              style={{ width: '100%', background: 'var(--secondary-color)', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <i className="fa-solid fa-circle-check"></i> Confirm Pinned Address
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
