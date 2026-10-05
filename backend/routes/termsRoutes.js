import express from 'express';
import { getTermsByRole, getAllTerms, updateTerms } from '../controllers/termsController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

// Public routes for fetching current Terms & Conditions
router.get('/', getAllTerms);
router.get('/:role', getTermsByRole);

// Admin-only route to update terms and push notifications to all users of that role
router.post('/update', authenticateUser, authorizeRoles(ROLES.ADMIN), updateTerms);

export default router;
