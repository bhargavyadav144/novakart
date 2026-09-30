import { Seller } from '../models/Seller.js';
import { Product } from '../models/Product.js';
import { Order } from '../models/Order.js';
import { ORDER_STATUSES } from '../config/constants.js';

// @desc    Get Seller Dashboard Statistics
// @route   GET /api/sellers/dashboard-stats
// @access  Private (Seller)
export const getSellerDashboardStats = async (req, res, next) => {
  try {
    const seller = await Seller.findOne({ userId: req.user._id });
    if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

    const totalProducts = await Product.countDocuments({ sellerId: seller._id });
    const totalOrders = await Order.countDocuments({ sellerId: seller._id });
    const pendingOrders = await Order.countDocuments({ sellerId: seller._id, orderStatus: ORDER_STATUSES.PENDING });
    const completedOrders = await Order.countDocuments({ sellerId: seller._id, orderStatus: ORDER_STATUSES.DELIVERED });

    // Recent orders
    const recentOrders = await Order.find({ sellerId: seller._id })
      .populate('customerId', 'name phone')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      stats: {
        storeName: seller.storeName,
        isApproved: seller.isApproved,
        status: seller.status,
        revenue: seller.revenue,
        totalProducts,
        totalOrders,
        pendingOrders,
        completedOrders
      },
      recentOrders
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Full Seller Profile
// @route   GET /api/sellers/profile
// @access  Private (Seller)
export const getSellerProfile = async (req, res, next) => {
  try {
    const seller = await Seller.findOne({ userId: req.user._id });
    if (!seller) return res.status(404).json({ success: false, message: 'Seller profile not found.' });

    res.json({
      success: true,
      seller
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Store Profile, Photos & Location
// @route   PUT /api/sellers/profile
// @access  Private (Seller)
export const updateSellerProfile = async (req, res, next) => {
  try {
    const {
      storeName,
      ownerName,
      email,
      phone,
      businessAddress,
      city,
      state,
      postalCode,
      lat,
      lng,
      logo,
      banner,
      bankDetails
    } = req.body;

    let seller = await Seller.findOne({ userId: req.user._id });
    if (!seller) return res.status(404).json({ success: false, message: 'Seller profile not found.' });

    if (storeName) seller.storeName = storeName;
    if (ownerName) seller.ownerName = ownerName;
    if (email) seller.email = email;
    if (phone) seller.phone = phone;
    if (businessAddress) seller.businessAddress = businessAddress;
    if (logo) seller.logo = logo;
    if (banner) seller.banner = banner;

    if (!seller.location) seller.location = {};
    if (city) seller.location.city = city;
    if (state) seller.location.state = state;
    if (postalCode) seller.location.postalCode = postalCode;
    if (lat !== undefined && lng !== undefined) {
      seller.location.lat = parseFloat(lat);
      seller.location.lng = parseFloat(lng);
    }

    if (bankDetails && typeof bankDetails === 'object') {
      if (!seller.bankDetails) seller.bankDetails = {};
      if (bankDetails.accountHolderName !== undefined) seller.bankDetails.accountHolderName = bankDetails.accountHolderName;
      if (bankDetails.bankName !== undefined) seller.bankDetails.bankName = bankDetails.bankName;
      if (bankDetails.accountNumber !== undefined) seller.bankDetails.accountNumber = bankDetails.accountNumber;
      if (bankDetails.ifscCode !== undefined) seller.bankDetails.ifscCode = bankDetails.ifscCode;
      if (bankDetails.upiId !== undefined) seller.bankDetails.upiId = bankDetails.upiId;
    }

    await seller.save();

    res.json({
      success: true,
      message: 'Store profile, location coordinates & owner photos updated successfully.',
      seller
    });
  } catch (error) {
    next(error);
  }
};
