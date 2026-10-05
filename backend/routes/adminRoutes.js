import express from 'express';
import {
  getAdminDashboardStats,
  getAllSellers,
  approveSeller,
  updateSellerCategories,
  rejectSeller,
  toggleBlockSeller,
  getAllDeliveryAgents,
  approveDeliveryAgent,
  rejectDeliveryAgent,
  toggleBlockDeliveryAgent,
  approveAgentBankUpdate,
  creditRiderWallet,
  getAllCustomers,
  toggleBlockCustomer,
  toggleProductStatus
} from '../controllers/adminController.js';
import {
  getAdminHelplineThreads,
  replyAdminHelplineMessage
} from '../controllers/sellerHelplineController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

// Strict Admin-only middleware
router.use(authenticateUser, authorizeRoles(ROLES.ADMIN));

// Admin Helpline for Sellers
router.get('/helpline/threads', getAdminHelplineThreads);
router.post('/helpline/:sellerId/reply', replyAdminHelplineMessage);

router.get('/dashboard-stats', getAdminDashboardStats);

// Seller Moderation & Category Clearance
router.get('/sellers', getAllSellers);
router.put('/sellers/:id/approve', approveSeller);
router.put('/sellers/:id/categories', updateSellerCategories);
router.put('/sellers/:id/reject', rejectSeller);
router.put('/sellers/:id/block', toggleBlockSeller);

// Delivery Agent Moderation & Wallet Operations
router.get('/delivery-agents', getAllDeliveryAgents);
router.put('/delivery-agents/:id/approve', approveDeliveryAgent);
router.put('/delivery-agents/:id/reject', rejectDeliveryAgent);
router.put('/delivery-agents/:id/block', toggleBlockDeliveryAgent);
router.put('/delivery-agents/:id/bank-update', approveAgentBankUpdate);
router.post('/credit-rider-wallet', creditRiderWallet);

// Customer Management
router.get('/customers', getAllCustomers);
router.put('/customers/:id/block', toggleBlockCustomer);

// Product Moderation
router.put('/products/:id/toggle-status', toggleProductStatus);

export default router;
