import express from 'express';
import {
  placeOrder,
  getCustomerOrders,
  getOrderById,
  cancelCustomerOrder,
  getSellerOrders,
  acceptSellerOrder,
  rejectSellerOrder,
  getDeliveryRadarRequests,
  acceptDeliveryRequest,
  updateDeliveryStatus,
  resendDeliveryOtp,
  requestDoorstepReturnOtp,
  confirmDoorstepReturn,
  markCustomerUnreachable,
  getAdminAllOrders
} from '../controllers/orderController.js';
import {
  getOrderChat,
  sendOrderChatMessage,
  requestOrderExchangeExtension
} from '../controllers/orderChatController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

// Order Chat Endpoints (Customer, Seller & Admin with 7-Day & Exchange Extension Rules)
router.get('/:id/chat', authenticateUser, getOrderChat);
router.post('/:id/chat', authenticateUser, sendOrderChatMessage);
router.post('/:id/chat/exchange-extension', authenticateUser, requestOrderExchangeExtension);

// Customer & General Endpoints
router.post('/place', authenticateUser, placeOrder);
router.get('/my-orders', authenticateUser, getCustomerOrders);
router.put('/:id/cancel', authenticateUser, cancelCustomerOrder);

// Seller Endpoints
router.get('/seller/incoming', authenticateUser, authorizeRoles(ROLES.SELLER), getSellerOrders);
router.put('/seller/:id/accept', authenticateUser, authorizeRoles(ROLES.SELLER), acceptSellerOrder);
router.put('/seller/:id/reject', authenticateUser, authorizeRoles(ROLES.SELLER), rejectSellerOrder);

// Delivery Agent Endpoints
router.get('/delivery/radar-requests', authenticateUser, authorizeRoles(ROLES.DELIVERY), getDeliveryRadarRequests);
router.put('/delivery/requests/:requestId/accept', authenticateUser, authorizeRoles(ROLES.DELIVERY), acceptDeliveryRequest);
router.put('/delivery/:id/update-status', authenticateUser, authorizeRoles(ROLES.DELIVERY), updateDeliveryStatus);
router.post('/delivery/:id/resend-otp', authenticateUser, authorizeRoles(ROLES.DELIVERY), resendDeliveryOtp);
router.post('/delivery/:id/request-doorstep-return-otp', authenticateUser, authorizeRoles(ROLES.DELIVERY), requestDoorstepReturnOtp);
router.post('/delivery/:id/confirm-doorstep-return', authenticateUser, authorizeRoles(ROLES.DELIVERY), confirmDoorstepReturn);
router.post('/delivery/:id/customer-unreachable', authenticateUser, authorizeRoles(ROLES.DELIVERY), markCustomerUnreachable);

// Admin Monitoring Endpoints
router.get('/admin/all', authenticateUser, authorizeRoles(ROLES.ADMIN), getAdminAllOrders);

// Generic Order Detail (Authenticated for participants)
router.get('/:id', authenticateUser, getOrderById);

export default router;
