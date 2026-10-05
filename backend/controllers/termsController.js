import { TermsAndConditions } from '../models/TermsAndConditions.js';
import { User } from '../models/User.js';
import { createNotification } from './notificationController.js';
import { emitToUser } from '../services/socketService.js';
import { ROLES } from '../config/constants.js';

// Default Fallback Terms
const DEFAULT_TERMS = {
  seller: {
    role: 'seller',
    title: 'NovaKart Official Merchant Agreement, Store Governance & Operational Policy',
    version: '3.0',
    effectiveDate: new Date('2026-10-05'),
    summary: 'Comprehensive legal and operational terms governing merchant onboarding, mandatory 2-face & 3-fingerprint biometric KYC, physical/home premises verification, admin category clearance, 7-day post-delivery chat rules, zero tolerance on off-platform links, and financial escrow settlements.',
    sections: [
      {
        title: '1. Merchant Eligibility & Mandatory Biometric KYC Enrollment',
        content: 'To establish and maintain an active merchant storefront on NovaKart, all store owners must undergo strict identity verification. This includes mandatory enrollment of two (2) distinct facial angles (Frontal View and Ergonomic Side Angle) and three (3) unique touch fingerprints. Biometric identifiers are encrypted and securely utilized to authorize critical account events including bank account modifications, UPI credentials, and financial payout withdrawals.'
      },
      {
        title: '2. Premises Classification & Operational Verification',
        content: 'Merchants must declare and verify their operating facility type: Physical Commercial Store or Registered Home Business. Physical stores must submit storefront signage imagery, interior inventory proof, and GPS geofence coordinates. Home businesses must supply utility bills (under 60 days old) and local municipal trading permits. All premises documentation undergoes manual inspection and approval by the NovaKart Platform Administrator prior to storefront listing.'
      },
      {
        title: '3. Product Category Clearance & Anti-Counterfeit Mandate',
        content: 'Merchants are strictly prohibited from publishing listings in product categories without prior explicit clearance from Platform Administration. Every new product category requested must be vetted and authorized by Admin before items become visible to customers. NovaKart maintains a zero-tolerance policy against counterfeit, expired, adulterated, or hazardous merchandise. Violation results in instant product takedown and potential permanent platform de-registration.'
      },
      {
        title: '4. Customer Order Communication & Strict 7-Day Window Policy',
        content: 'NovaKart provides an integrated in-app order chat service to facilitate smooth delivery coordination and customer support. The communication channel activates upon order confirmation and remains functional during transit and for exactly seven (7) calendar days following confirmed delivery. Upon the expiration of seven (7) days post-delivery, the customer-merchant chat channel automatically disables and locks permanently to preserve operational closure.'
      },
      {
        title: '5. Zero-Tolerance Prohibition on External Links & Off-Platform Contacts',
        content: 'To prevent fraud, protect consumer security, and ensure transaction integrity, merchants are strictly forbidden from transmitting external hyperlinks (HTTP/HTTPS URLs), personal telephone numbers, WhatsApp contact cards, UPI handles, or requests for direct payment in customer chats or platform helpline tickets. Automated deep-inspection filters intercept and block unauthorized links. Repeated transmission of external links triggers instant account review and administrative penalties.'
      },
      {
        title: '6. 7-Day Post-Delivery Return & Exchange Fulfillment SLA',
        content: 'Customers are entitled to request returns or product replacements within seven (7) calendar days post physical delivery. When a merchant accepts an exchange request, the platform automatically grants an additional seven (7) day fulfillment extension window for product exchange transit, reverse logistics pickup, and replacement dispatch. Once the return/exchange window concludes, the transaction is finalized.'
      },
      {
        title: '7. Financial Escrow, Platform Commission & Biometric Payout Authorization',
        content: 'All customer payments remain held in secure NovaKart escrow until successful order delivery and lapse of the return dispute window. Applicable platform commission fees are deducted per order ledger. Withdrawal requests or modifications to linked bank account credentials (IFSC, Account Number) strictly require matching biometric verification (Face or Fingerprint scan) before payout disbursement via IMPS / NEFT / RTGS.'
      },
      {
        title: '8. Order Fulfillment SLAs & Packaging Compliance',
        content: 'Merchants must acknowledge and pack incoming customer orders within fifteen (15) minutes of receipt for standard delivery or five (5) minutes for hyper-local express delivery. All shipments must bear valid NovaKart digital dispatch barcodes and tamper-evident packaging. Failure to maintain fulfillment speed SLAs directly reduces merchant quality scoring and listing visibility.'
      },
      {
        title: '9. Dispute Resolution, Administrative Helpline & Mediation',
        content: 'Merchants have 24/7 access to the direct Admin Helpline Desk to resolve operational queries, category approvals, tax reconciliation, and order escalations. In the event of a customer dispute regarding damaged goods or non-delivery, Platform Administration acts as the final binding mediator.'
      },
      {
        title: '10. Dynamic Policy Amendments & Continued Compliance',
        content: 'NovaKart reserves the right to revise operational policies, fee structures, and security standards to comply with e-commerce regulations. When updates are published by Platform Administration, all merchants receive instant in-portal notifications. Continued operation of the merchant account constitutes legal and binding acceptance of amended terms.'
      }
    ],
    fullText: 'Official NovaKart Store Partner Agreement. All merchants must complete biometric KYC, facility verification, and comply with category clearance before listing products. By operating a store on NovaKart, you agree to these legally binding terms, fulfillment SLAs, customer chat rules, and biometric governance standards.'
  },
  customer: {
    role: 'customer',
    title: 'NovaKart Customer Terms of Service & Purchase Agreement',
    version: '2.0',
    effectiveDate: new Date('2026-10-01'),
    summary: 'Customer ordering terms, live order tracking, return window policies, and wallet balance guidelines.',
    sections: [
      {
        title: '1. User Account & Security',
        content: 'Customers must maintain the confidentiality of their login credentials and OTP codes. NovaKart never asks for your password or OTP over phone or chat.'
      },
      {
        title: '2. Ordering, Pricing & Delivery Timeframes',
        content: 'Prices displayed are inclusive of applicable taxes. Delivery estimates are based on real-time traffic and warehouse dispatch conditions.'
      },
      {
        title: '3. Cancellations, Returns & Refunds',
        content: 'Orders may be cancelled prior to dispatch. Return requests must be initiated within the permissible return window (7 days for general goods, immediate upon delivery for perishables).'
      },
      {
        title: '4. Customer Conduct & Reviews',
        content: 'Customer reviews must be genuine and reflective of actual product experience. Abusive language or fraudulent chargebacks are strictly prohibited.'
      }
    ],
    fullText: 'Welcome to NovaKart. By placing orders or creating a customer account on NovaKart, you agree to these Terms of Service.'
  },
  delivery: {
    role: 'delivery',
    title: 'NovaKart Delivery Partner Fleet & Service Agreement',
    version: '2.0',
    effectiveDate: new Date('2026-10-01'),
    summary: 'Rider safety standards, GPS tracking requirements, cash collection protocols, and payout rates.',
    sections: [
      {
        title: '1. Fleet Partner Onboarding',
        content: 'Delivery partners must hold a valid Driving License, vehicle registration, and complete biometric face verification before accepting orders.'
      },
      {
        title: '2. Real-Time GPS Tracking & Geofencing',
        content: 'Partners must keep GPS location services active throughout duty shifts for accurate order dispatch and customer safety.'
      },
      {
        title: '3. Cash Collection & Remittance',
        content: 'Cash collected on Pay-on-Delivery orders must be remitted promptly through digital settlement or deposit at the logistics hub.'
      }
    ],
    fullText: 'Welcome to the NovaKart Delivery Partner Network. By accepting deliveries on NovaKart, you agree to our fleet terms and safety standards.'
  }
};

// @desc    Get Terms & Conditions for a specific role
// @route   GET /api/terms/:role
// @access  Public
export const getTermsByRole = async (req, res, next) => {
  try {
    const role = (req.params.role || req.query.role || 'seller').toLowerCase();
    
    // Find the latest active terms in DB
    let terms = await TermsAndConditions.findOne({ role, isActive: true }).sort({ createdAt: -1 });

    if (!terms && DEFAULT_TERMS[role]) {
      // Seed default into DB on the fly if not exists
      terms = await TermsAndConditions.create(DEFAULT_TERMS[role]);
    }

    res.json({
      success: true,
      role,
      terms: terms || DEFAULT_TERMS[role] || DEFAULT_TERMS.seller
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all active Terms & Conditions across all roles
// @route   GET /api/terms
// @access  Public
export const getAllTerms = async (req, res, next) => {
  try {
    const roles = ['seller', 'customer', 'delivery'];
    const results = {};

    for (const role of roles) {
      let doc = await TermsAndConditions.findOne({ role, isActive: true }).sort({ createdAt: -1 });
      if (!doc && DEFAULT_TERMS[role]) {
        doc = await TermsAndConditions.create(DEFAULT_TERMS[role]);
      }
      results[role] = doc || DEFAULT_TERMS[role];
    }

    res.json({
      success: true,
      terms: results
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Update/Publish Terms & Conditions and Broadcast Notifications to All Users of that Role
// @route   POST /api/terms/update
// @access  Private (Admin only)
export const updateTerms = async (req, res, next) => {
  try {
    const { role, title, version, summary, sections, fullText } = req.body;

    if (!role || !title || !fullText) {
      return res.status(400).json({ success: false, message: 'Please provide role, title, and policy content.' });
    }

    const cleanRole = role.toLowerCase().trim();

    // Deactivate previous terms for this role
    await TermsAndConditions.updateMany({ role: cleanRole }, { isActive: false });

    // Create new active terms record
    const newTerms = await TermsAndConditions.create({
      role: cleanRole,
      title: title.trim(),
      version: version ? version.trim() : '2.1',
      effectiveDate: new Date(),
      summary: summary || 'Terms and Conditions updated by Administrator.',
      sections: Array.isArray(sections) ? sections : [],
      fullText: fullText.trim(),
      isActive: true,
      updatedBy: req.user._id
    });

    // Broadcast Notifications to ALL users with this role
    const targetUsers = await User.find({ role: cleanRole, isBlocked: false });
    
    let notifiedCount = 0;
    const notificationPromises = targetUsers.map(async (u) => {
      try {
        await createNotification({
          recipientId: u._id,
          role: cleanRole,
          title: `📜 New ${cleanRole.toUpperCase()} Terms & Conditions (v${newTerms.version})`,
          message: `NovaKart Admin has published updated Terms & Conditions: "${newTerms.summary}". Please review the updated policy.`,
          type: 'POLICY_UPDATE',
          link: '/terms'
        });
        notifiedCount++;
      } catch (e) {
        // Continue notifying others
      }
    });

    await Promise.all(notificationPromises);

    res.json({
      success: true,
      message: `🎉 Updated Terms & Conditions published successfully for '${cleanRole}'. All ${notifiedCount} active ${cleanRole}s have received notifications.`,
      terms: newTerms,
      notifiedCount
    });
  } catch (error) {
    next(error);
  }
};
