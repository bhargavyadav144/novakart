import express from 'express';
import { addProductReview, getProductReviews, getCustomerReviews } from '../controllers/reviewController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

router.get('/my-reviews', authenticateUser, getCustomerReviews);
router.get('/product/:productId', getProductReviews);
router.post('/', authenticateUser, addProductReview);

export default router;
