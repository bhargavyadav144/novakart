import React, { useState, useEffect } from 'react';
import adminApi from '../services/adminApi';

export default function AdminTerms() {
  const [selectedRole, setSelectedRole] = useState('seller'); // 'seller' | 'customer' | 'delivery'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form Fields
  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('2.1');
  const [summary, setSummary] = useState('');
  const [fullText, setFullText] = useState('');
  const [sections, setSections] = useState([]);

  const fetchTerms = (role) => {
    setLoading(true);
    setErrorMsg('');
    adminApi.get(`/terms/${role}`)
      .then(({ data }) => {
        if (data.terms) {
          const t = data.terms;
          setTitle(t.title || '');
          setVersion(t.version || '2.0');
          setSummary(t.summary || '');
          setFullText(t.fullText || '');
          setSections(t.sections || []);
        }
      })
      .catch((err) => {
        setErrorMsg('Failed to load terms from server.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTerms(selectedRole);
  }, [selectedRole]);

  const handleAddSection = () => {
    setSections(prev => [
      ...prev,
      { title: `Section ${prev.length + 1}: New Policy Clause`, content: 'Enter the policy clause details here...' }
    ]);
  };

  const handleRemoveSection = (idx) => {
    setSections(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSectionChange = (idx, field, value) => {
    setSections(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const { data } = await adminApi.post('/terms/update', {
        role: selectedRole,
        title: title.trim(),
        version: version.trim(),
        summary: summary.trim(),
        fullText: fullText.trim(),
        sections
      });

      setSuccessMsg(`🎉 Success! Updated ${selectedRole.toUpperCase()} Terms & Conditions published. All ${data.notifiedCount} active ${selectedRole}s received in-app notifications.`);
      fetchTerms(selectedRole);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to publish terms.');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    border: '1.5px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '0.88rem',
    outline: 'none',
    boxSizing: 'border-box'
  };

  const roleLabels = {
    seller: 'Merchants & Store Owners',
    customer: 'Customers & Shoppers',
    delivery: 'Delivery Fleet Partners'
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      
      {/* Header */}
      <div className="admin-top-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa-solid fa-file-contract" style={{ color: '#0f766e' }}></i> Terms &amp; Conditions Governance
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.88rem', margin: '4px 0 0' }}>
            Author, edit, and publish platform Terms &amp; Conditions for Users, Sellers, and Delivery Agents. Updating a policy automatically notifies all active accounts in real-time.
          </p>
        </div>
      </div>

      {/* Target Audience Selector */}
      <div style={{
        display: 'flex',
        gap: '10px',
        background: '#ffffff',
        padding: '8px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        marginBottom: '24px'
      }}>
        {[
          { id: 'seller', label: '🏪 Merchant Terms & Policy', countRole: 'Sellers' },
          { id: 'customer', label: '🛒 Customer Terms of Service', countRole: 'Users' },
          { id: 'delivery', label: '🚴 Delivery Fleet Agreement', countRole: 'Riders' }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSelectedRole(tab.id)}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '8px',
              border: 'none',
              background: selectedRole === tab.id ? '#0f766e' : 'transparent',
              color: selectedRole === tab.id ? '#ffffff' : '#64748b',
              fontWeight: selectedRole === tab.id ? '800' : '600',
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Status Notifications */}
      {successMsg && (
        <div style={{ background: '#ecfdf5', color: '#047857', padding: '14px 18px', borderRadius: '10px', fontWeight: '700', marginBottom: '20px', border: '1px solid #a7f3d0' }}>
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div style={{ background: '#fee2e2', color: '#dc2626', padding: '14px 18px', borderRadius: '10px', fontWeight: '700', marginBottom: '20px', border: '1px solid #fca5a5' }}>
          {errorMsg}
        </div>
      )}

      {loading ? (
        <p style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Loading policy document...</p>
      ) : (
        <form onSubmit={handlePublish} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Main Card */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: '800', color: '#0f172a' }}>
              Policy Metadata &amp; Versioning
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Policy Document Title *
                </label>
                <input
                  type="text"
                  style={inputStyle}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Version Code *
                </label>
                <input
                  type="text"
                  style={inputStyle}
                  placeholder="e.g. 2.1"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Summary of Changes / What's New * (Shown in In-App Notification)
              </label>
              <input
                type="text"
                style={inputStyle}
                placeholder="e.g. Updated biometric withdrawal authentication and category clearance requirements"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Introductory Overview Statement *
              </label>
              <textarea
                style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }}
                value={fullText}
                onChange={(e) => setFullText(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Policy Clauses & Sections */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#0f172a' }}>
                  Clauses &amp; Policy Sections ({sections.length})
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Add or edit individual clauses for {roleLabels[selectedRole]}
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddSection}
                style={{
                  background: '#f1f5f9',
                  color: '#0f766e',
                  border: '1px solid #cbd5e1',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <i className="fa-solid fa-plus"></i> Add Clause Section
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {sections.map((sec, idx) => (
                <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#0f766e' }}>
                      Clause #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSection(idx)}
                      style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700' }}
                    >
                      <i className="fa-solid fa-trash-can"></i> Remove
                    </button>
                  </div>

                  <input
                    type="text"
                    style={{ ...inputStyle, marginBottom: '8px', fontWeight: '700', background: '#ffffff' }}
                    value={sec.title}
                    onChange={(e) => handleSectionChange(idx, 'title', e.target.value)}
                    placeholder="Clause Title (e.g. 1. Biometric Authentication Policy)"
                    required
                  />

                  <textarea
                    style={{ ...inputStyle, minHeight: '64px', background: '#ffffff', resize: 'vertical' }}
                    value={sec.content}
                    onChange={(e) => handleSectionChange(idx, 'content', e.target.value)}
                    placeholder="Clause Description and Terms..."
                    required
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Broadcast & Save Action Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#ffffff',
            borderRadius: '14px',
            padding: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.15)',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ background: '#10b981', color: '#ffffff', fontSize: '0.72rem', fontWeight: '800', padding: '2px 8px', borderRadius: '12px' }}>
                  AUTOMATED IN-APP BROADCAST
                </span>
              </div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: '800' }}>
                Ready to Publish {selectedRole.toUpperCase()} Terms &amp; Conditions (v{version})?
              </h4>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#cbd5e1' }}>
                Publishing will update the live policy on the dedicated terms page and send instant in-app notifications to all registered {roleLabels[selectedRole]}.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                background: '#10b981',
                color: '#ffffff',
                border: 'none',
                padding: '14px 28px',
                borderRadius: '10px',
                fontWeight: '800',
                fontSize: '0.95rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {saving ? <><i className="fa-solid fa-spinner fa-spin"></i> Broadcasting Updates...</> : <><i className="fa-solid fa-bullhorn"></i> Publish &amp; Notify All {selectedRole.toUpperCase()}s 🚀</>}
            </button>
          </div>

        </form>
      )}

    </div>
  );
}
