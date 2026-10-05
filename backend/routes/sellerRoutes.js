import express from 'express';
import {
  getSellerDashboardStats,
  getSellerProfile,
  updateSellerProfile,
  verifySellerBiometric,
  authorizeSellerFaceChange,
  enrollSellerFace,
  enrollSellerBiometrics,
  updateVerificationStage,
  requestSellerPayout
} from '../controllers/sellerController.js';
import {
  getSellerHelpline,
  sendSellerHelplineMessage
} from '../controllers/sellerHelplineController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

router.use(authenticateUser, authorizeRoles(ROLES.SELLER));

// Admin Helpline for Sellers
router.get('/helpline', getSellerHelpline);
router.post('/helpline/message', sendSellerHelplineMessage);

router.get('/dashboard-stats', getSellerDashboardStats);
router.get('/profile', getSellerProfile);
router.put('/profile', updateSellerProfile);

// Verification, Biometrics & Payout Disbursals
router.post('/verify-biometric', verifySellerBiometric);
router.post('/authorize-face-change', authorizeSellerFaceChange);
router.post('/enroll-face', enrollSellerFace);
router.post('/enroll-biometrics', enrollSellerBiometrics);
router.post('/update-verification-stage', updateVerificationStage);
router.post('/request-payout', requestSellerPayout);

export default router;
