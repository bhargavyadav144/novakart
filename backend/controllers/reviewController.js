import { Review } from '../models/Review.js';
import { Product } from '../models/Product.js';
import { Order } from '../models/Order.js';

// @desc    Add or Update Review for a Delivered Product
// @route   POST /api/reviews
// @access  Private (Customer)
export const addProductReview = async (req, res, next) => {
  try {
    const { productId, orderId, rating, comment, title } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    let verifiedPurchase = false;
    let deliveredAt = null;

    if (orderId) {
      const order = await Order.findById(orderId);
      if (order && order.customerId.toString() === req.user._id.toString()) {
        const itemExists = order.items.some(it => it.productId.toString() === productId.toString());
        if (itemExists && (order.orderStatus === 'DELIVERED' || order.orderStatus === 'COMPLETED')) {
          verifiedPurchase = true;
          deliveredAt = order.proofOfDelivery?.verifiedAt || order.updatedAt;
        }
      }
    }

    // Check if user already reviewed this product (optionally for this order)
    const filter = orderId
      ? { productId: product._id, customerId: req.user._id, orderId }
      : { productId: product._id, customerId: req.user._id };

    let review = await Review.findOne(filter);

    if (review) {
      review.rating = Number(rating) || review.rating;
      review.title = title || review.title;
      review.comment = comment !== undefined ? comment : review.comment;
      review.isVerifiedPurchase = verifiedPurchase || review.isVerifiedPurchase;
      if (deliveredAt) review.deliveredDate = deliveredAt;
      await review.save();
    } else {
      review = await Review.create({
        productId: product._id,
        customerId: req.user._id,
        orderId: orderId || null,
        customerName: req.user.name || 'Verified Customer',
        rating: Number(rating) || 5,
        title: title || 'Verified Customer Review',
        comment: comment || '',
        isVerifiedPurchase: verifiedPurchase,
        deliveredDate: deliveredAt
      });
    }

    // Recalculate Product Ratings Average
    const allReviews = await Review.find({ productId: product._id });
    if (allReviews.length > 0) {
      const avg = allReviews.reduce((acc, item) => item.rating + acc, 0) / allReviews.length;
      product.ratingsAverage = parseFloat(avg.toFixed(1));
      product.ratingsCount = allReviews.length;
      await product.save();
    }

    res.status(201).json({
      success: true,
      message: 'Thank you! Your product review has been published.',
      review
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all Reviews written by logged-in Customer
// @route   GET /api/reviews/my-reviews
// @access  Private (Customer)
export const getCustomerReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ customerId: req.user._id })
      .populate('productId', 'name image price ratingsAverage')
      .populate('orderId', 'orderNumber totalAmount createdAt')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: reviews.length,
      reviews
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Reviews for a Product
// @route   GET /api/reviews/product/:productId
// @access  Public
export const getProductReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ productId: req.params.productId }).sort({ createdAt: -1 });
    res.json({ success: true, count: reviews.length, reviews });
  } catch (error) {
    next(error);
  }
};
