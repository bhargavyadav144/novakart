import express from 'express';
import {
  getSellerDashboardStats,
  getSellerProfile,
  updateSellerProfile,
  verifySellerBiometric,
  authorizeSellerFaceChange,
  enrollSellerFace,
  enrollSellerBiometrics,
  requestSellerPayout
} from '../controllers/sellerController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

router.use(authenticateUser, authorizeRoles(ROLES.SELLER));

router.get('/dashboard-stats', getSellerDashboardStats);
router.get('/profile', getSellerProfile);
router.put('/profile', updateSellerProfile);

// Biometric & Payout Disbursals
router.post('/verify-biometric', verifySellerBiometric);
router.post('/authorize-face-change', authorizeSellerFaceChange);
router.post('/enroll-face', enrollSellerFace);
router.post('/enroll-biometrics', enrollSellerBiometrics);
router.post('/request-payout', requestSellerPayout);

export default router;
