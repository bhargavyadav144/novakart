import express from 'express';
import {
  customerRequestCall,
  customerGetMyCalls,
  customerCancelCall,
  customerAcceptCall,
  ivrInputKeyPress,
  agentGetIncomingQueue,
  agentAcceptCall,
  agentHoldCall,
  agentTransferCall,
  agentEndCall,
  agentGetCallHistory,
  adminGetCallQueueDashboard,
  adminGetCallHistory,
  adminForceAssignCall,
  getCallQueueAvailability,
  postCallSpeech,
  getCallTranscript,
  submitCallFeedback,
  getAgentFeedbackReviews
} from '../controllers/callQueueController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

// ==========================================
// PUBLIC
// ==========================================
router.get('/availability', getCallQueueAvailability);

// ==========================================
// CUSTOMER & GENERAL CALL REQUEST ROUTES
// ==========================================
router.post('/request-call', authenticateUser, customerRequestCall);
router.get('/my-calls', authenticateUser, customerGetMyCalls);
router.put('/:callId/cancel', authenticateUser, customerCancelCall);
router.put('/:callId/accept-call', authenticateUser, customerAcceptCall);
router.put('/:callId/ivr-key', authenticateUser, ivrInputKeyPress);
router.post('/:callId/speech', authenticateUser, postCallSpeech);
router.post('/:callId/feedback', authenticateUser, submitCallFeedback);
router.get('/:callId/transcript', authenticateUser, getCallTranscript);


// ==========================================
// SUPPORT AGENT ROUTES (Port 3006)
// ==========================================
router.get('/agent/incoming', authenticateUser, authorizeRoles(ROLES.SUPPORT, ROLES.ADMIN), agentGetIncomingQueue);
router.get('/agent/history', authenticateUser, authorizeRoles(ROLES.SUPPORT, ROLES.ADMIN), agentGetCallHistory);
router.get('/agent/reviews', authenticateUser, authorizeRoles(ROLES.SUPPORT, ROLES.ADMIN), getAgentFeedbackReviews);
router.put('/agent/:callId/accept', authenticateUser, authorizeRoles(ROLES.SUPPORT, ROLES.ADMIN), agentAcceptCall);
router.put('/agent/:callId/hold', authenticateUser, authorizeRoles(ROLES.SUPPORT, ROLES.ADMIN), agentHoldCall);
router.put('/agent/:callId/transfer', authenticateUser, authorizeRoles(ROLES.SUPPORT, ROLES.ADMIN), agentTransferCall);
router.put('/agent/:callId/end', authenticateUser, authorizeRoles(ROLES.SUPPORT, ROLES.ADMIN), agentEndCall);

// ==========================================
// ADMIN ROUTES (Port 3003)
// ==========================================
router.get('/admin/dashboard', authenticateUser, authorizeRoles(ROLES.ADMIN), adminGetCallQueueDashboard);
router.get('/admin/history', authenticateUser, authorizeRoles(ROLES.ADMIN), adminGetCallHistory);
router.put('/admin/:callId/force-assign', authenticateUser, authorizeRoles(ROLES.ADMIN), adminForceAssignCall);

export default router;
