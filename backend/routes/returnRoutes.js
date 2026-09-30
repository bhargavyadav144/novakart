import express from 'express';
import {
  createReturnOrExchange,
  getOrderReturnRequest,
  getCustomerReturns,
  cancelReturnRequest,
  getAllAdminReturns,
  adminApproveAndDispatchReturn,
  adminRejectReturn,
  getDeliveryAgentReturnPickups,
  deliveryAgentConfirmPickup,
  getWarehouseReturnPackages,
  warehouseQCVerifyAndSendPaymentRequest,
  getPendingRefundReturnsForPayments,
  paymentAdminDisburseRefund,
  sendReturnPaymentRequestToAdmin,
  updateReturnInstructionsAndData
} from '../controllers/returnController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

// ==========================================
// 1. CUSTOMER & GENERAL ROUTES
// ==========================================
router.post('/request', authenticateUser, createReturnOrExchange);
router.get('/order/:orderId', authenticateUser, getOrderReturnRequest);
router.get('/my-returns', authenticateUser, getCustomerReturns);
router.put('/:id/cancel', authenticateUser, cancelReturnRequest);

// ==========================================
// 2. ADMIN RETURN DISPATCH ROUTES
// ==========================================
router.get('/admin/all', authenticateUser, authorizeRoles(ROLES.ADMIN), getAllAdminReturns);
router.put('/admin/:id/approve-and-dispatch', authenticateUser, authorizeRoles(ROLES.ADMIN), adminApproveAndDispatchReturn);
router.put('/admin/:id/reject', authenticateUser, authorizeRoles(ROLES.ADMIN), adminRejectReturn);

// Direct Officer / Admin Payment Request & Instruction Update
router.put('/:id/send-payment-request', authenticateUser, sendReturnPaymentRequestToAdmin);
router.put('/:id/update-instructions-data', authenticateUser, updateReturnInstructionsAndData);

// ==========================================
// 3. DELIVERY AGENT DOORSTEP PICKUP ROUTES
// ==========================================
router.get('/delivery/my-pickups', authenticateUser, authorizeRoles(ROLES.DELIVERY, ROLES.ADMIN), getDeliveryAgentReturnPickups);
router.put('/delivery/:id/pickup-confirm', authenticateUser, authorizeRoles(ROLES.DELIVERY, ROLES.ADMIN), deliveryAgentConfirmPickup);

// ==========================================
// 4. WAREHOUSE HUB QC & PAYMENT REQUEST ROUTES
// ==========================================
router.get('/warehouse/pending-qc', authenticateUser, authorizeRoles(ROLES.WAREHOUSE_MANAGER, ROLES.ADMIN), getWarehouseReturnPackages);
router.put('/warehouse/:id/qc-verify', authenticateUser, authorizeRoles(ROLES.WAREHOUSE_MANAGER, ROLES.ADMIN), warehouseQCVerifyAndSendPaymentRequest);

// ==========================================
// 5. PAYMENT ADMIN / TREASURY REFUND ROUTES
// ==========================================
router.get('/payments/pending-refunds', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.FINANCE), getPendingRefundReturnsForPayments);
router.put('/payments/:id/disburse-refund', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.FINANCE), paymentAdminDisburseRefund);

export default router;

