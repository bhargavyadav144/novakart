import express from 'express';
import {
  getDeliveryDashboardStats,
  scanWarehousePickup,
  getWarehouseDockPackages,
  toggleAgentDuty,
  updateAgentLocation,
  getDeliveryHistory,
  getDeliveryProfile,
  updateDeliveryProfile,
  verifyFacePhoto,
  sendPasswordOtp,
  changeDeliveryPassword,
  updateAgentRouteByWarehouseManager,
  requestBankUpdate,
  submitSupportTicket,
  requestRiderCashout,
  redeemGiftCardToWallet
} from '../controllers/deliveryController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

// Warehouse Manager / Admin Route Assignment Endpoint
router.put('/agents/:agentId/assign-route', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SUPPORT), updateAgentRouteByWarehouseManager);

router.use(authenticateUser, authorizeRoles(ROLES.DELIVERY));

router.get('/dashboard-stats', getDeliveryDashboardStats);
router.post('/warehouse-pickup/scan', scanWarehousePickup);
router.get('/warehouse-dock-packages', getWarehouseDockPackages);
router.put('/toggle-duty', toggleAgentDuty);
router.put('/location', updateAgentLocation);
router.get('/history', getDeliveryHistory);

// Rider Profile & Private Security
router.get('/profile', getDeliveryProfile);
router.put('/profile', updateDeliveryProfile);
router.post('/verify-face', verifyFacePhoto);
router.post('/send-password-otp', sendPasswordOtp);
router.put('/change-password', changeDeliveryPassword);
router.post('/request-bank-update', requestBankUpdate);
router.post('/support-ticket', submitSupportTicket);
router.post('/request-cashout', requestRiderCashout);
router.post('/redeem-gift-card', redeemGiftCardToWallet);

export default router;

