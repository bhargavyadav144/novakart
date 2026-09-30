import express from 'express';
import {
  getSupportWorkers,
  createSupportTicket,
  getMyTickets,
  getTicketById,
  sendTicketMessage,
  getAdminTickets,
  assignTicketWorker,
  updateTicketStatus,
  workerLogin,
  workerGetMyTickets,
  workerClaimTicket,
  workerUpdateDutyStatus,
  adminAddSupportWorker,
  adminGetSupportWorkers,
  adminToggleWorkerBlock,
  requestCallBack,
  workerStartCall,
  workerEndCall,
  inspectOrderForSupport,
  executeInstantRefund,
  executeReturnPickupDispatch,
  executeExpediteDelivery,
  executeGoodwillCredit,
  executeCancelAndRefund,
  getSupportExecutiveMetrics,
  executeSendPaymentRequestToPaymentAdmin,
  customerAcceptCall,
  customerDeclineCall,
  getCustomerPendingOrdersForSupport
} from '../controllers/supportController.js';

import { authenticateUser } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

// Public / General
router.get('/workers', getSupportWorkers);

// Worker Auth (Help Center Portal Port 3006)
router.post('/auth/login', workerLogin);

// Customer & General Endpoints
router.post('/tickets', authenticateUser, createSupportTicket);
router.post('/callback-request', authenticateUser, requestCallBack);
router.get('/my-tickets', authenticateUser, getMyTickets);

// Worker Portal Endpoints (Port 3006)
router.get('/worker/my-tickets', authenticateUser, authorizeRoles(ROLES.SUPPORT, ROLES.ADMIN), workerGetMyTickets);
router.put('/worker/tickets/:id/claim', authenticateUser, authorizeRoles(ROLES.SUPPORT, ROLES.ADMIN), workerClaimTicket);
router.put('/worker/duty-status', authenticateUser, authorizeRoles(ROLES.SUPPORT, ROLES.ADMIN), workerUpdateDutyStatus);

// Telephony Call Handling (Softphone)
router.put('/worker/tickets/:id/call-start', authenticateUser, authorizeRoles(ROLES.SUPPORT, ROLES.ADMIN), workerStartCall);
router.put('/worker/tickets/:id/call-end', authenticateUser, authorizeRoles(ROLES.SUPPORT, ROLES.ADMIN), workerEndCall);
router.put('/tickets/:id/accept-call', authenticateUser, customerAcceptCall);
router.put('/tickets/:id/decline-call', authenticateUser, customerDeclineCall);



// Order Deep Investigation & Diagnostics
router.get('/orders/inspect/:identifier', authenticateUser, authorizeRoles(ROLES.SUPPORT, ROLES.ADMIN), inspectOrderForSupport);
router.get('/customer-pending-orders', authenticateUser, authorizeRoles(ROLES.SUPPORT, ROLES.ADMIN), getCustomerPendingOrdersForSupport);

// Support Resolution Actions (Beyond Just Chat)
router.post('/worker/orders/:orderId/refund', authenticateUser, authorizeRoles(ROLES.SUPPORT, ROLES.ADMIN), executeInstantRefund);
router.post('/worker/orders/:orderId/authorize-return-pickup', authenticateUser, authorizeRoles(ROLES.SUPPORT, ROLES.ADMIN), executeReturnPickupDispatch);
router.post('/worker/orders/:orderId/expedite-delivery', authenticateUser, authorizeRoles(ROLES.SUPPORT, ROLES.ADMIN), executeExpediteDelivery);
router.post('/worker/customers/:customerId/goodwill-credit', authenticateUser, authorizeRoles(ROLES.SUPPORT, ROLES.ADMIN), executeGoodwillCredit);
router.post('/worker/orders/:orderId/cancel-and-refund', authenticateUser, authorizeRoles(ROLES.SUPPORT, ROLES.ADMIN), executeCancelAndRefund);
router.post('/worker/orders/:orderId/send-payment-request', authenticateUser, authorizeRoles(ROLES.SUPPORT, ROLES.ADMIN), executeSendPaymentRequestToPaymentAdmin);


// Shared Ticket Conversation (Customer, Support Officer, or Admin)
router.get('/tickets/:id', authenticateUser, getTicketById);
router.post('/tickets/:id/messages', authenticateUser, sendTicketMessage);
router.put('/tickets/:id/status', authenticateUser, authorizeRoles(ROLES.SUPPORT, ROLES.ADMIN), updateTicketStatus);

// Admin Executive & Governance Endpoints (Port 3003)
router.get('/admin/workers', authenticateUser, authorizeRoles(ROLES.ADMIN), adminGetSupportWorkers);
router.post('/admin/workers', authenticateUser, authorizeRoles(ROLES.ADMIN), adminAddSupportWorker);
router.put('/admin/workers/:id/toggle-block', authenticateUser, authorizeRoles(ROLES.ADMIN), adminToggleWorkerBlock);
router.get('/admin/tickets', authenticateUser, authorizeRoles(ROLES.ADMIN), getAdminTickets);
router.put('/admin/tickets/:id/assign', authenticateUser, authorizeRoles(ROLES.ADMIN), assignTicketWorker);
router.put('/admin/tickets/:id/status', authenticateUser, authorizeRoles(ROLES.ADMIN), updateTicketStatus);
router.get('/admin/executive-metrics', authenticateUser, authorizeRoles(ROLES.ADMIN), getSupportExecutiveMetrics);

export default router;

