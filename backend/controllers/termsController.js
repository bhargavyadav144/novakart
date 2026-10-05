import { TermsAndConditions } from '../models/TermsAndConditions.js';
import { User } from '../models/User.js';
import { createNotification } from './notificationController.js';
import { emitToUser } from '../services/socketService.js';
import { ROLES } from '../config/constants.js';

// Default Fallback Terms
const DEFAULT_TERMS = {
  seller: {
    role: 'seller',
    title: 'NovaKart Merchant Agreement & Store Governance Policy',
    version: '2.0',
    effectiveDate: new Date('2026-10-01'),
    summary: 'Updated merchant guidelines covering mandatory biometrics for settlement, premises verification, and product category clearance.',
    sections: [
      {
        title: '1. Merchant Eligibility & Registration Verification',
        content: 'To establish a store on NovaKart, merchants must complete identity verification, provide proof of physical premises or registered home business, and undergo 2-face + 3-fingerprint biometric KYC enrollment.'
      },
      {
        title: '2. Product Category Clearance & Listing Standards',
        content: 'Merchants may only publish products within categories approved by the NovaKart Administrator. All products must conform to legal, health, and intellectual property standards. Counterfeit or prohibited items result in immediate account termination.'
      },
      {
        title: '3. Order Fulfillment & Dispatch SLAs',
        content: 'Merchants must acknowledge and pack orders within 15 minutes of receipt for standard delivery or 5 minutes for express delivery. Failure to adhere to fulfillment SLAs may impact merchant store ratings and listing prominence.'
      },
      {
        title: '4. Biometric Security for Financial Operations',
        content: 'For your security, changes to bank settlement details, UPI accounts, or manual earnings withdrawal requests strictly require matching biometric verification (registered face or touch fingerprint) alongside your password.'
      },
      {
        title: '5. Commission, Settlement Ledgers & Escrow',
        content: 'Platform fees are deducted automatically upon order completion. Payouts are transferred via IMPS/NEFT to the verified bank account according to the agreed settlement cycle (T+1 or T+2).'
      },
      {
        title: '6. Amendments & Policy Updates',
        content: 'NovaKart reserves the right to modify these Terms & Conditions. Merchants will receive in-app notifications whenever policy updates occur. Continued use of the Merchant Portal constitutes acceptance of updated terms.'
      }
    ],
    fullText: 'Welcome to the NovaKart Merchant Portal. By registering and operating a store on NovaKart, you agree to comply with our store governance, biometric security, product category clearance, and fulfillment standards.'
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
