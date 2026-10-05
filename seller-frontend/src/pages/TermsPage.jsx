import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import sellerApi from '../services/sellerApi';

const DEFAULT_SELLER_TERMS = {
  role: 'seller',
  title: 'NovaKart Official Merchant Agreement, Store Governance & Operational Policy',
  version: '3.0',
  effectiveDate: '2026-10-05',
  summary: 'Comprehensive legal and operational terms governing merchant onboarding, mandatory 2-face & 3-fingerprint biometric KYC, physical/home premises verification, admin category clearance, 7-day post-delivery chat rules, zero tolerance on off-platform links, and financial escrow settlements.',
  fullText: 'Welcome to the NovaKart Merchant Portal. By registering and operating a store on NovaKart, you agree to comply with our store governance, biometric security, product category clearance, customer communication rules, return SLAs, and financial settlement standards. These terms form a legally binding contract between your registered store enterprise and NovaKart Inc.',
  sections: [
    {
      id: 'biometrics',
      title: '1. Merchant Eligibility & Mandatory Biometric KYC Enrollment',
      tag: 'Security & Identity',
      content: 'To establish and maintain an active merchant storefront on NovaKart, all store owners must undergo strict identity verification. This includes mandatory enrollment of two (2) distinct facial angles (Frontal View and Ergonomic Side Angle) and three (3) unique touch fingerprints. Biometric identifiers are encrypted and securely utilized to authorize critical account events including bank account modifications, UPI credentials, and financial payout withdrawals.',
      highlights: [
        'Mandatory capture of 2 distinct face angles (Frontal & Ergonomic Side Angle).',
        'Enrollment of up to 3 individual touch fingerprints for two-factor account security.',
        'Withdrawal transfers and bank modification requests strictly demand matching biometric verification alongside your password.'
      ]
    },
    {
      id: 'premises',
      title: '2. Premises Classification & Physical Verification',
      tag: 'Store Identity',
      content: 'Merchants must declare and verify their operating facility type: Physical Commercial Store or Registered Home Business. Physical stores must submit storefront signage imagery, interior inventory proof, and GPS geofence coordinates. Home businesses must supply utility bills (under 60 days old) and local municipal trading permits. All premises documentation undergoes manual inspection and approval by the NovaKart Platform Administrator prior to storefront listing.',
      highlights: [
        'Physical Storefronts: Exterior signage, interior stock shelves, and verified geolocation coordinates.',
        'Home Businesses: Official residential address proof, utility bill within 60 days, and local municipal registration.',
        '100% Admin profile verification required before products can be visible to customers.'
      ]
    },
    {
      id: 'categories',
      title: '3. Product Category Clearance & Anti-Counterfeit Mandate',
      tag: 'Catalog Governance',
      content: 'Merchants are strictly prohibited from publishing listings in product categories without prior explicit clearance from Platform Administration. Every new product category requested must be vetted and authorized by Admin before items become visible to customers. NovaKart maintains a zero-tolerance policy against counterfeit, expired, adulterated, or hazardous merchandise. Violation results in instant product takedown and potential permanent platform de-registration.',
      highlights: [
        'Zero unapproved product publishing: Only cleared categories may accept active product listings.',
        'Immediate termination and forfeiture of account for counterfeit, replicated, or non-certified goods.',
        'Sellers may request additional category clearances anytime via the Seller Verification Hub.'
      ]
    },
    {
      id: 'chat-policy',
      title: '4. Customer Order Communication & Strict 7-Day Window Policy',
      tag: 'Customer Support',
      content: 'NovaKart provides an integrated in-app order chat service to facilitate smooth delivery coordination, address verification, and customer assistance. The communication channel activates upon order confirmation and remains functional during transit and for exactly seven (7) calendar days following confirmed delivery. Upon the expiration of seven (7) days post-delivery, the customer-merchant chat channel automatically disables and locks permanently to preserve operational closure and prevent post-cycle disputes.',
      highlights: [
        'Chat is active from order placement through transit and for exactly 7 days post-delivery.',
        'Automatic channel lockout occurs on the 7th calendar day after delivery confirmation.',
        'Matches the customer return and replacement statutory eligibility cycle.'
      ]
    },
    {
      id: 'no-links',
      title: '5. Zero-Tolerance Prohibition on External Links & Off-Platform Contacts',
      tag: 'Platform Integrity',
      content: 'To prevent fraud, protect consumer privacy, and ensure transaction integrity, merchants are strictly forbidden from transmitting external hyperlinks (HTTP/HTTPS URLs), personal telephone numbers, WhatsApp contact cards, UPI handles, or requests for direct payment in customer chats or platform helpline tickets. Automated deep-inspection filters intercept and block unauthorized links. Repeated transmission of external links triggers instant account review and administrative penalties.',
      highlights: [
        'Strict prohibition against sharing external URLs, websites, and hyperlink redirects.',
        'No direct phone numbers, WhatsApp links, or off-platform payment handles permitted.',
        'Automated real-time link scanners block non-compliant messages and notify Platform Security.'
      ]
    },
    {
      id: 'returns',
      title: '6. 7-Day Post-Delivery Return & Exchange Fulfillment SLA',
      tag: 'Returns & Exchanges',
      content: 'Customers are entitled to request returns or product replacements within seven (7) calendar days post physical delivery. When a merchant accepts an exchange request, the platform automatically grants an additional seven (7) day fulfillment extension window for product exchange transit, reverse logistics pickup, and replacement dispatch. Once the return/exchange window concludes, the transaction is finalized.',
      highlights: [
        '7-day standard return window granted to all customers from delivery timestamp.',
        'Exchange Extension: Approving an exchange request automatically awards +7 extra days to complete the replacement.',
        'All return shipping or replacement coordination must be recorded within the merchant order console.'
      ]
    },
    {
      id: 'escrow',
      title: '7. Financial Escrow, Platform Commission & Biometric Payout Authorization',
      tag: 'Settlements & Escrow',
      content: 'All customer payments remain held in secure NovaKart escrow until successful order delivery and lapse of the return dispute window. Applicable platform commission fees are deducted per order ledger. Withdrawal requests or modifications to linked bank account credentials (IFSC, Account Number) strictly require matching biometric verification (Face or Fingerprint scan) before payout disbursement via IMPS / NEFT / RTGS.',
      highlights: [
        '100% Escrow Protection: Funds held securely until customer receipt and return clearance.',
        'Automated commission fee deduction based on agreed category margin structure.',
        'Biometric authentication strictly enforced before executing payout transfers to bank accounts.'
      ]
    },
    {
      id: 'fulfillment',
      title: '8. Order Fulfillment SLAs & Packaging Compliance',
      tag: 'Fulfillment & Logistics',
      content: 'Merchants must acknowledge and pack incoming customer orders within fifteen (15) minutes of receipt for standard delivery or five (5) minutes for hyper-local express delivery. All shipments must bear valid NovaKart digital dispatch barcodes and tamper-evident packaging. Failure to maintain fulfillment speed SLAs directly reduces merchant quality scoring and listing visibility.',
      highlights: [
        'Order acknowledgement and packing SLA: 15 minutes standard, 5 minutes express.',
        'Mandatory digital barcode tagging on every parcel for warehouse scan compliance.',
        'Repeated dispatch delays incur quality penalties and algorithmic search de-prioritization.'
      ]
    },
    {
      id: 'helpline',
      title: '9. Dispute Resolution, Administrative Helpline & Mediation',
      tag: 'Support & Grievances',
      content: 'Merchants have 24/7 access to the direct Admin Helpline Desk to resolve operational queries, category approvals, tax reconciliation, and order escalations. In the event of a customer dispute regarding damaged goods or non-delivery, Platform Administration acts as the final binding mediator.',
      highlights: [
        'Direct ticket-based communication with NovaKart Platform Operations and Legal team.',
        'Guaranteed resolution timeframes for verification reviews and settlement disputes.',
        'Impartial administrative adjudication for damaged transit claims and chargeback inquiries.'
      ]
    },
    {
      id: 'compliance',
      title: '10. Dynamic Policy Amendments & Continued Compliance',
      tag: 'Legal Governance',
      content: 'NovaKart reserves the right to revise operational policies, fee structures, and security standards to comply with e-commerce regulations. When updates are published by Platform Administration, all merchants receive instant in-portal notifications. Continued operation of the merchant account constitutes legal and binding acceptance of amended terms.',
      highlights: [
        'Real-time in-app alerts whenever administrative policy updates are released.',
        'Merchants must periodically review and re-acknowledge updated platform terms.',
        'Failure to comply with revised governance rules may result in temporary account restrictions.'
      ]
    }
  ]
};

export default function TermsPage() {
  const [termsData, setTermsData] = useState(DEFAULT_SELLER_TERMS);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState(null);

  useEffect(() => {
    setLoading(true);
    sellerApi.get('/terms/seller')
      .then(({ data }) => {
        if (data.terms && Array.isArray(data.terms.sections) && data.terms.sections.length > 0) {
          // Merge remote sections with local rich metadata if available
          setTermsData({
            ...DEFAULT_SELLER_TERMS,
            ...data.terms,
            sections: data.terms.sections.length >= 6 ? data.terms.sections : DEFAULT_SELLER_TERMS.sections
          });
        }
      })
      .catch((err) => {
        console.warn('Could not fetch remote seller terms, using comprehensive default terms:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredSections = (termsData?.sections || DEFAULT_SELLER_TERMS.sections).filter(sec => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return sec.title.toLowerCase().includes(q) ||
           sec.content.toLowerCase().includes(q) ||
           (sec.tag && sec.tag.toLowerCase().includes(q));
  });

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6FA', padding: '32px 16px', color: '#0F172A', fontFamily: "'Poppins', sans-serif" }}>
      <div style={{ maxWidth: '980px', margin: '0 auto' }}>
        
        {/* Top Navigation Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <Link
            to="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              color: '#1A237E',
              background: '#FFFFFF',
              border: '1.5px solid #CBD5E1',
              padding: '8px 18px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '700',
              fontSize: '0.88rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              transition: 'all 0.2s ease'
            }}
          >
            &larr; Return to Sign In / Dashboard
          </Link>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={() => window.print()}
              style={{
                background: '#FFFFFF',
                border: '1.5px solid #CBD5E1',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#1A237E',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}
            >
              <i className="fa-solid fa-print"></i> Print Agreement
            </button>
          </div>
        </div>

        {/* Executive Blue Header Card */}
        <div style={{
          background: 'linear-gradient(135deg, #1A237E 0%, #1E40AF 60%, #0d133a 100%)',
          borderRadius: '20px',
          padding: '40px 32px',
          color: '#FFFFFF',
          boxShadow: '0 12px 30px rgba(26, 35, 126, 0.25)',
          marginBottom: '28px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle geometric circle accent */}
          <div style={{
            position: 'absolute',
            top: '-40px',
            right: '-40px',
            width: '200px',
            height: '200px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.05)',
            pointerEvents: 'none'
          }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <span style={{
              background: 'rgba(255, 255, 255, 0.18)',
              color: '#FFFFFF',
              border: '1px solid rgba(255, 255, 255, 0.35)',
              padding: '4px 14px',
              borderRadius: '20px',
              fontSize: '0.78rem',
              fontWeight: '800',
              letterSpacing: '0.5px'
            }}>
              OFFICIAL SELLER POLICY
            </span>
            <span style={{
              background: '#EEF2FF',
              color: '#1A237E',
              padding: '3px 12px',
              borderRadius: '20px',
              fontSize: '0.76rem',
              fontWeight: '800'
            }}>
              Version {termsData?.version || '3.0'}
            </span>
            <span style={{ fontSize: '0.8rem', color: '#DBEAFE' }}>
              &bull; Effective Date: {termsData?.effectiveDate ? new Date(termsData.effectiveDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'October 5, 2026'}
            </span>
          </div>

          <h1 style={{ fontSize: '2rem', fontWeight: '800', margin: '0 0 14px 0', lineHeight: '1.25' }}>
            {termsData?.title || 'NovaKart Merchant Agreement & Store Governance Policy'}
          </h1>

          <p style={{ margin: '0 0 20px 0', fontSize: '0.96rem', color: '#E0E7FF', lineHeight: '1.7', maxWidth: '820px' }}>
            {termsData?.summary || 'Comprehensive legal and operational terms governing merchant onboarding, mandatory 2-face & 3-fingerprint biometric KYC, physical/home premises verification, admin category clearance, 7-day post-delivery chat rules, zero tolerance on off-platform links, and financial escrow settlements.'}
          </p>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.12)',
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '0.8rem',
            color: '#DBEAFE'
          }}>
            <i className="fa-solid fa-shield-halved" style={{ color: '#93C5FD' }}></i>
            <span>Exclusively applicable to NovaKart Verified Merchants &amp; Store Partners</span>
          </div>
        </div>

        {/* Merchant SLA & Protocol Highlights Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
          marginBottom: '28px'
        }}>
          <div style={{
            background: '#FFFFFF',
            border: '1.5px solid #DBEAFE',
            borderRadius: '14px',
            padding: '18px 20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1A237E' }}>
                <i className="fa-solid fa-fingerprint" style={{ fontSize: '1.1rem' }}></i>
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: '700' }}>MANDATORY KYC</div>
                <div style={{ fontSize: '0.98rem', fontWeight: '800', color: '#1A237E' }}>2 Faces &bull; 3 Fingerprints</div>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: '1.5' }}>
              Strictly required for payout transfers, bank account alterations, and store security.
            </p>
          </div>

          <div style={{
            background: '#FFFFFF',
            border: '1.5px solid #DBEAFE',
            borderRadius: '14px',
            padding: '18px 20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1A237E' }}>
                <i className="fa-solid fa-comments" style={{ fontSize: '1.1rem' }}></i>
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: '700' }}>CUSTOMER CHAT</div>
                <div style={{ fontSize: '0.98rem', fontWeight: '800', color: '#1A237E' }}>7 Days Post-Delivery Only</div>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: '1.5' }}>
              Direct chat locks permanently after 7 days. Zero tolerance for external URLs or phone numbers.
            </p>
          </div>

          <div style={{
            background: '#FFFFFF',
            border: '1.5px solid #DBEAFE',
            borderRadius: '14px',
            padding: '18px 20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1A237E' }}>
                <i className="fa-solid fa-arrows-rotate" style={{ fontSize: '1.1rem' }}></i>
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: '700' }}>RETURNS &amp; EXCHANGES</div>
                <div style={{ fontSize: '0.98rem', fontWeight: '800', color: '#1A237E' }}>7 Days (+7 on Exchange)</div>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: '1.5' }}>
              Customer return window is 7 days. Approving an exchange extends support by +7 fulfillment days.
            </p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          border: '1.5px solid #E2E8F0',
          padding: '12px 18px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <i className="fa-solid fa-magnifying-glass" style={{ color: '#1A237E', fontSize: '1rem' }}></i>
          <input
            type="text"
            placeholder="Search clauses (e.g., biometrics, 7-day chat, return policy, escrow, external links)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '0.92rem',
              color: '#0F172A',
              fontFamily: 'inherit'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '0.85rem'
              }}
            >
              Clear
            </button>
          )}
          <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: '600' }}>
            {filteredSections.length} Clause{filteredSections.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Main Terms & Conditions Clauses Container */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '18px',
          border: '1.5px solid #E2E8F0',
          padding: '36px 32px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)'
        }}>
          {loading ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#1A237E' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', marginBottom: '14px', display: 'block' }}></i>
              <span style={{ fontWeight: '700', fontSize: '1rem' }}>Loading Official Store Governance Policies...</span>
            </div>
          ) : (
            <div>
              {/* Preamble / Introduction */}
              <div style={{
                background: '#EEF2FF',
                borderLeft: '4px solid #1A237E',
                borderRadius: '8px',
                padding: '20px 24px',
                marginBottom: '32px'
              }}>
                <div style={{ fontSize: '0.82rem', fontWeight: '800', color: '#1A237E', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>
                  Legally Binding Declaration
                </div>
                <p style={{ margin: 0, fontSize: '0.95rem', color: '#1E293B', lineHeight: '1.75' }}>
                  {termsData?.fullText}
                </p>
              </div>

              {/* Clause Cards List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                {filteredSections.map((sec, idx) => (
                  <div
                    key={sec.id || idx}
                    style={{
                      background: '#F8FAFC',
                      borderRadius: '14px',
                      border: '1.5px solid #E2E8F0',
                      padding: '24px 26px',
                      transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                    }}
                  >
                    {/* Clause Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                      <h2 style={{
                        margin: 0,
                        fontSize: '1.2rem',
                        fontWeight: '800',
                        color: '#1A237E',
                        lineHeight: '1.35',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          background: '#1A237E',
                          color: '#FFFFFF',
                          fontSize: '0.82rem',
                          fontWeight: '800'
                        }}>
                          §
                        </span>
                        {sec.title}
                      </h2>

                      {sec.tag && (
                        <span style={{
                          background: '#DBEAFE',
                          color: '#1E40AF',
                          fontSize: '0.74rem',
                          fontWeight: '800',
                          padding: '3px 10px',
                          borderRadius: '12px'
                        }}>
                          {sec.tag}
                        </span>
                      )}
                    </div>

                    {/* Clause Detailed Body */}
                    <p style={{
                      margin: '0 0 14px 0',
                      fontSize: '0.94rem',
                      color: '#334155',
                      lineHeight: '1.75'
                    }}>
                      {sec.content}
                    </p>

                    {/* Specific Highlights / Actionable Rules */}
                    {sec.highlights && sec.highlights.length > 0 && (
                      <div style={{
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '10px',
                        padding: '14px 18px',
                        marginTop: '12px'
                      }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#1A237E', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Key Operational Mandates &amp; Enforcement:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {sec.highlights.map((hl, hIdx) => (
                            <li key={hIdx} style={{ fontSize: '0.88rem', color: '#475569', lineHeight: '1.6' }}>
                              {hl}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Policy Footer Notice */}
              <div style={{
                marginTop: '36px',
                paddingTop: '24px',
                borderTop: '1.5px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                fontSize: '0.82rem',
                color: '#64748B'
              }}>
                <div>
                  © 2026 NovaKart Commercial Commerce Inc. All rights reserved. &bull; Contact Legal: legal@novakart.com
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{
                    background: '#EEF2FF',
                    color: '#1A237E',
                    padding: '4px 12px',
                    borderRadius: '8px',
                    fontWeight: '800',
                    fontSize: '0.8rem'
                  }}>
                    ✓ Ratified by NovaKart Governance Board
                  </span>
                </div>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
