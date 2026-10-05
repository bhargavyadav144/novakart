import { User } from '../models/User.js';
import { Seller } from '../models/Seller.js';
import { DeliveryAgent } from '../models/DeliveryAgent.js';
import { Product } from '../models/Product.js';
import { Order } from '../models/Order.js';
import { emitToUser } from '../services/socketService.js';
import { ROLES, ACCOUNT_STATUSES, ORDER_STATUSES } from '../config/constants.js';
import { createNotification } from './notificationController.js';
import { calculateVerificationProgress } from './sellerController.js';

// @desc    Admin Master Statistics Overview
// @route   GET /api/admin/dashboard-stats
// @access  Private (Admin)
export const getAdminDashboardStats = async (req, res, next) => {
  try {
    const totalCustomers = await User.countDocuments({ role: ROLES.CUSTOMER });
    const totalSellers = await Seller.countDocuments();
    const pendingSellers = await Seller.countDocuments({ status: ACCOUNT_STATUSES.PENDING });
    const totalDeliveryAgents = await DeliveryAgent.countDocuments();
    const pendingAgents = await DeliveryAgent.countDocuments({ status: ACCOUNT_STATUSES.PENDING });
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ orderStatus: ORDER_STATUSES.PENDING });
    const completedOrders = await Order.countDocuments({ orderStatus: ORDER_STATUSES.DELIVERED });
    const cancelledOrders = await Order.countDocuments({ orderStatus: ORDER_STATUSES.CANCELLED });

    // Fetch all non-cancelled orders with populated relations
    const allOrders = await Order.find({ orderStatus: { $ne: ORDER_STATUSES.CANCELLED } })
      .populate('sellerId', 'storeName ownerName email phone')
      .populate('customerId', 'name email phone')
      .populate('deliveryAgentId', 'fullName email phone vehicleNumber')
      .sort({ createdAt: -1 });

    // 1. Core Financial Aggregates
    let totalGrossRevenue = 0; // Total GMV
    let totalSubtotal = 0;     // Product Sales Volume
    let totalTaxes = 0;        // GST / Tax
    let totalShippingFees = 0; // Delivery fees collected from buyers
    let totalDiscounts = 0;
    let totalConvenienceFees = 0;
    let totalPlatformCommission = 0; // 10% commission cut from sellers
    let totalPaymentGatewayFee = 0;  // 2% gateway processing fee
    let totalSellerPayouts = 0;      // What sellers will get
    let totalDeliveryPayouts = 0;    // Driver earnings

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let monthlyGrossRevenue = 0;
    let monthlyPlatformCommission = 0;
    let monthlySellerPayouts = 0;
    let monthlyTaxes = 0;
    let monthlyShippingFees = 0;
    let monthlyOrderCount = 0;

    let lastMonthGrossRevenue = 0;

    // Monthly breakdown map (key: YYYY-MM)
    const monthsMap = {};

    // Seller financial breakdown map (key: sellerId)
    const sellerFinancialsMap = {};

    // Detailed order-by-order financial breakdowns
    const ordersBreakdown = allOrders.map(ord => {
      const orderDate = new Date(ord.createdAt);
      const gross = ord.totalAmount || 0;
      const subtotal = ord.subtotal || 0;
      const tax = ord.tax || 0;
      const shipping = ord.shippingFee || 0;
      const convFee = ord.convenienceFee || 0;

      // Platform Cut Formulas (Amazon-style):
      // - Category Referral Commission: 10% of subtotal
      // - Payment Processing: 2% of total order
      // - Convenience Fee: 100% kept by platform
      const commissionRate = 0.10;
      const commissionCut = Math.round(subtotal * commissionRate);
      const paymentGatewayFee = Math.round(gross * 0.02);
      const totalCutFromSeller = commissionCut + paymentGatewayFee;
      const sellerWillGet = Math.max(0, subtotal - totalCutFromSeller);
      const riderPayout = ord.deliveryAgentId ? 50 : Math.min(shipping, 50);
      const logisticsMargin = shipping - riderPayout;
      const platformNetKeeps = commissionCut + convFee + logisticsMargin;

      // Accumulate totals
      totalGrossRevenue += gross;
      totalSubtotal += subtotal;
      totalTaxes += tax;
      totalShippingFees += shipping;
      totalDiscounts += (ord.discount || 0);
      totalConvenienceFees += convFee;
      totalPlatformCommission += commissionCut;
      totalPaymentGatewayFee += paymentGatewayFee;
      totalSellerPayouts += sellerWillGet;
      totalDeliveryPayouts += riderPayout;

      // Monthly aggregation
      const isCurrentMonth = orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
      const isLastMonth = (orderDate.getMonth() === (currentMonth - 1 + 12) % 12) && 
        (currentMonth === 0 ? orderDate.getFullYear() === currentYear - 1 : orderDate.getFullYear() === currentYear);

      if (isCurrentMonth) {
        monthlyGrossRevenue += gross;
        monthlyPlatformCommission += commissionCut;
        monthlySellerPayouts += sellerWillGet;
        monthlyTaxes += tax;
        monthlyShippingFees += shipping;
        monthlyOrderCount++;
      } else if (isLastMonth) {
        lastMonthGrossRevenue += gross;
      }

      // Group into months
      const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = orderDate.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      if (!monthsMap[monthKey]) {
        monthsMap[monthKey] = {
          key: monthKey,
          label: monthLabel,
          monthName: orderDate.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
          grossSales: 0,
          subtotal: 0,
          platformCommission: 0,
          taxes: 0,
          deliveryFees: 0,
          sellerPayouts: 0,
          driverPayouts: 0,
          orderCount: 0
        };
      }
      monthsMap[monthKey].grossSales += gross;
      monthsMap[monthKey].subtotal += subtotal;
      monthsMap[monthKey].platformCommission += commissionCut;
      monthsMap[monthKey].taxes += tax;
      monthsMap[monthKey].deliveryFees += shipping;
      monthsMap[monthKey].sellerPayouts += sellerWillGet;
      monthsMap[monthKey].driverPayouts += riderPayout;
      monthsMap[monthKey].orderCount++;

      // Group into seller financials
      const sellerIdStr = ord.sellerId?._id?.toString() || 'unknown';
      const storeName = ord.sellerId?.storeName || 'Independent Merchant';
      if (!sellerFinancialsMap[sellerIdStr]) {
        sellerFinancialsMap[sellerIdStr] = {
          sellerId: sellerIdStr,
          storeName,
          ownerName: ord.sellerId?.ownerName || 'Verified Seller',
          email: ord.sellerId?.email || 'N/A',
          phone: ord.sellerId?.phone || 'N/A',
          ordersHandled: 0,
          grossSales: 0,
          subtotal: 0,
          platformCommissionCut: 0,
          paymentGatewayFees: 0,
          totalCutFromSeller: 0,
          netSellerPayout: 0,
          settlementStatus: 'Ready for Payout'
        };
      }
      sellerFinancialsMap[sellerIdStr].ordersHandled++;
      sellerFinancialsMap[sellerIdStr].grossSales += gross;
      sellerFinancialsMap[sellerIdStr].subtotal += subtotal;
      sellerFinancialsMap[sellerIdStr].platformCommissionCut += commissionCut;
      sellerFinancialsMap[sellerIdStr].paymentGatewayFees += paymentGatewayFee;
      sellerFinancialsMap[sellerIdStr].totalCutFromSeller += totalCutFromSeller;
      sellerFinancialsMap[sellerIdStr].netSellerPayout += sellerWillGet;

      return {
        _id: ord._id,
        orderNumber: ord.orderNumber,
        createdAt: ord.createdAt,
        orderStatus: ord.orderStatus,
        paymentMethod: ord.paymentMethod,
        customerName: ord.deliveryAddress?.fullName || ord.customerId?.name || 'Customer',
        customerPhone: ord.deliveryAddress?.phone || ord.customerId?.phone || 'N/A',
        storeName,
        destinationCity: ord.deliveryAddress?.city || 'AP',
        deliveryAgentName: ord.deliveryAgentId?.fullName || 'Assigned Courier',
        itemsCount: ord.items?.length || 1,
        grossAmount: gross,
        subtotal,
        tax,
        shippingFee: shipping,
        convenienceFee: convFee,
        discount: ord.discount || 0,
        commissionRatePct: 10,
        commissionCut,
        paymentGatewayFee,
        totalCutFromSeller,
        sellerWillGet,
        riderPayout,
        logisticsMargin,
        platformNetKeeps,
        settlementStatus: ord.orderStatus === 'DELIVERED' ? 'SETTLED' : 'READY_TO_DISBURSE'
      };
    });

    const monthlyTrends = Object.values(monthsMap).sort((a, b) => a.key.localeCompare(b.key));
    const sellerSettlements = Object.values(sellerFinancialsMap).sort((a, b) => b.grossSales - a.grossSales);

    // Take rate percentage
    const platformTakeRatePct = totalSubtotal > 0 
      ? ((totalPlatformCommission + totalConvenienceFees) / totalSubtotal) * 100 
      : 10.5;

    // Month-over-month growth
    const momGrowthPct = lastMonthGrossRevenue > 0
      ? Math.round(((monthlyGrossRevenue - lastMonthGrossRevenue) / lastMonthGrossRevenue) * 100)
      : (monthlyGrossRevenue > 0 ? 100 : 0);

    // Tax audit breakdown (Indian GST split)
    const taxAudit = {
      totalTaxCollected: totalTaxes,
      cgst: Math.round(totalTaxes * 0.5),
      sgst: Math.round(totalTaxes * 0.5),
      tcsWithheld: Math.round(totalSubtotal * 0.01), // 1% E-commerce TCS
      netGovtRemittance: totalTaxes + Math.round(totalSubtotal * 0.01)
    };

    // Logistics breakdown
    const logisticsFinancials = {
      totalDeliveryFeesCollected: totalShippingFees,
      totalDriverPayouts: totalDeliveryPayouts,
      netLogisticsMargin: totalShippingFees - totalDeliveryPayouts,
      avgDeliveryFee: allOrders.length > 0 ? Math.round(totalShippingFees / allOrders.length) : 0,
      activeFleetCount: totalDeliveryAgents,
      totalDispatches: allOrders.filter(o => o.deliveryAgentId).length
    };

    res.json({
      success: true,
      stats: {
        totalCustomers,
        totalSellers,
        pendingSellers,
        totalDeliveryAgents,
        pendingAgents,
        totalProducts,
        totalOrders,
        pendingOrders,
        completedOrders,
        cancelledOrders,
        totalRevenue: totalGrossRevenue,

        // Amazon-grade Financials Engine
        financials: {
          totalGrossRevenue,
          monthlyGrossRevenue,
          lastMonthGrossRevenue,
          momGrowthPct,
          totalSubtotal,
          totalTaxes,
          totalShippingFees,
          totalConvenienceFees,
          totalDiscounts,
          totalPlatformCommission,
          totalPaymentGatewayFee,
          totalCutFromSellers: totalPlatformCommission + totalPaymentGatewayFee,
          totalSellerPayouts,
          totalDeliveryPayouts,
          platformNetEarnings: totalPlatformCommission + totalConvenienceFees + (totalShippingFees - totalDeliveryPayouts),
          platformTakeRatePct: Math.round(platformTakeRatePct * 10) / 10,
          averageOrderValue: allOrders.length > 0 ? Math.round(totalGrossRevenue / allOrders.length) : 0,
          monthlyOrderCount,
          monthlySellerPayouts,
          monthlyPlatformCommission,
          monthlyTaxes,
          monthlyShippingFees
        },

        monthlyTrends,
        sellerSettlements,
        logisticsFinancials,
        taxAudit,
        ordersBreakdown
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// SELLER MANAGEMENT
// ============================================================================

export const getAllSellers = async (req, res, next) => {
  try {
    const sellers = await Seller.find().populate('userId', 'name email isBlocked').sort({ createdAt: -1 });
    res.json({ success: true, count: sellers.length, sellers });
  } catch (error) {
    next(error);
  }
};

export const approveSeller = async (req, res, next) => {
  try {
    const seller = await Seller.findById(req.params.id);
    if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

    seller.status = ACCOUNT_STATUSES.APPROVED;
    seller.isApproved = true;
    seller.verificationStatus = 'approved';

    // Approve requested product categories or specified categories
    if (req.body.approvedCategories && Array.isArray(req.body.approvedCategories)) {
      seller.approvedProductCategories = req.body.approvedCategories;
    } else if ((!seller.approvedProductCategories || seller.approvedProductCategories.length === 0) && seller.requestedProductCategories?.length > 0) {
      seller.approvedProductCategories = seller.requestedProductCategories;
    }

    // Mark documents as verified upon admin approval
    if (seller.governmentId) {
      seller.governmentId.isVerified = true;
    }
    if (seller.taxDetails) {
      seller.taxDetails.isVerified = true;
    }

    const { progress } = calculateVerificationProgress(seller);
    seller.verificationProgress = progress;
    await seller.save();

    emitToUser(seller.userId, 'account_status_approved', {
      message: `Congratulations! Your seller store '${seller.storeName}' has been approved by admin. Approved categories: ${seller.approvedProductCategories.join(', ')}.`
    });

    // Persistent in-app notification
    createNotification({
      recipientId: seller.userId,
      role: 'seller',
      title: '🎉 Store & Product Categories Approved!',
      message: `Your store "${seller.storeName}" has been approved with categories: ${seller.approvedProductCategories.join(', ')}. Start listing products!`,
      type: 'SELLER_APPROVAL',
      link: '/',
    });

    res.json({ success: true, message: `Seller store '${seller.storeName}' approved.`, seller });
  } catch (error) {
    next(error);
  }
};

export const updateSellerCategories = async (req, res, next) => {
  try {
    const seller = await Seller.findById(req.params.id);
    if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

    const { approvedCategories } = req.body;
    seller.approvedProductCategories = Array.isArray(approvedCategories) ? approvedCategories : [];
    const { progress } = calculateVerificationProgress(seller);
    seller.verificationProgress = progress;
    await seller.save();

    res.json({
      success: true,
      message: `Approved product categories updated for '${seller.storeName}'.`,
      approvedCategories: seller.approvedProductCategories,
      seller
    });
  } catch (error) {
    next(error);
  }
};

export const rejectSeller = async (req, res, next) => {
  try {
    const seller = await Seller.findById(req.params.id);
    if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

    seller.status = ACCOUNT_STATUSES.REJECTED;
    seller.isApproved = false;
    await seller.save();

    res.json({ success: true, message: `Seller store '${seller.storeName}' rejected.`, seller });
  } catch (error) {
    next(error);
  }
};

export const toggleBlockSeller = async (req, res, next) => {
  try {
    const seller = await Seller.findById(req.params.id);
    if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

    const user = await User.findById(seller.userId);
    user.isBlocked = !user.isBlocked;
    await user.save();

    seller.status = user.isBlocked ? ACCOUNT_STATUSES.BLOCKED : ACCOUNT_STATUSES.APPROVED;
    await seller.save();

    res.json({
      success: true,
      message: `Seller account is now ${user.isBlocked ? 'BLOCKED' : 'ACTIVE'}`,
      isBlocked: user.isBlocked
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// DELIVERY AGENT MANAGEMENT
// ============================================================================

export const getAllDeliveryAgents = async (req, res, next) => {
  try {
    const agents = await DeliveryAgent.find().populate('userId', 'name email isBlocked').sort({ createdAt: -1 });
    res.json({ success: true, count: agents.length, agents });
  } catch (error) {
    next(error);
  }
};

export const approveDeliveryAgent = async (req, res, next) => {
  try {
    const agent = await DeliveryAgent.findById(req.params.id);
    if (!agent) return res.status(404).json({ success: false, message: 'Delivery agent not found' });

    agent.status = ACCOUNT_STATUSES.APPROVED;
    agent.isApproved = true;
    await agent.save();

    emitToUser(agent.userId, 'account_status_approved', {
      message: 'Your delivery agent application is approved. You can now go online to receive delivery requests!'
    });

    // Persistent in-app notification
    createNotification({
      recipientId: agent.userId,
      role: 'delivery',
      title: '✅ Application Approved!',
      message: 'Welcome to the fleet! Your delivery agent account is active. Go online to start receiving requests.',
      type: 'AGENT_APPROVAL',
      link: '/',
    });

    res.json({ success: true, message: `Delivery agent '${agent.fullName}' approved.`, agent });
  } catch (error) {
    next(error);
  }
};

export const rejectDeliveryAgent = async (req, res, next) => {
  try {
    const agent = await DeliveryAgent.findById(req.params.id);
    if (!agent) return res.status(404).json({ success: false, message: 'Delivery agent not found' });

    agent.status = ACCOUNT_STATUSES.REJECTED;
    agent.isApproved = false;
    await agent.save();

    res.json({ success: true, message: `Delivery agent '${agent.fullName}' rejected.`, agent });
  } catch (error) {
    next(error);
  }
};

// Approve / Reject Delivery Agent Pending Bank Details
export const approveAgentBankUpdate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'approve' | 'reject'
    const agent = await DeliveryAgent.findById(id);

    if (!agent) return res.status(404).json({ success: false, message: 'Delivery agent not found' });
    if (!agent.pendingBankDetails || agent.pendingBankDetails.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'No pending bank details update request found for this agent.' });
    }

    if (action === 'approve') {
      agent.bankDetails = {
        accountName: agent.pendingBankDetails.accountName || agent.fullName,
        accountNumber: agent.pendingBankDetails.accountNumber,
        bankName: agent.pendingBankDetails.bankName,
        ifscCode: agent.pendingBankDetails.ifscCode,
        upiId: agent.pendingBankDetails.upiId,
        isVerified: true
      };
      agent.pendingBankDetails.status = 'APPROVED';

      createNotification({
        recipientId: agent.userId,
        role: 'delivery',
        title: '✅ Bank Payout Details Approved!',
        message: `System Admin has approved your new bank account (${agent.bankDetails.bankName} - ${agent.bankDetails.accountNumber.slice(-4)}). Cashouts will now disburse to this account.`,
        type: 'PAYMENT',
        link: '/earnings'
      });
    } else {
      agent.pendingBankDetails.status = 'REJECTED';
      createNotification({
        recipientId: agent.userId,
        role: 'delivery',
        title: '❌ Bank Update Request Rejected',
        message: 'System Admin could not verify your requested bank details update. Please contact support.',
        type: 'PAYMENT',
        link: '/earnings'
      });
    }

    await agent.save();
    res.json({ success: true, message: `Bank update request ${action}d successfully.`, agent });
  } catch (error) {
    next(error);
  }
};

// Credit Rider Wallet (Support / Payment Adjustment)
export const creditRiderWallet = async (req, res, next) => {
  try {
    const { agentId, amount, reason, ticketId } = req.body;
    if (!agentId || !amount) {
      return res.status(400).json({ success: false, message: 'Please provide agentId and amount to credit.' });
    }

    const agent = await DeliveryAgent.findById(agentId);
    if (!agent) return res.status(404).json({ success: false, message: 'Delivery agent not found' });

    const creditAmount = Number(amount);
    if (isNaN(creditAmount) || creditAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0.' });
    }

    if (!agent.wallet) {
      agent.wallet = { availableBalance: 0, pendingVerificationBalance: 0, totalWithdrawn: 0 };
    }
    agent.wallet.availableBalance = (agent.wallet.availableBalance || 0) + creditAmount;
    agent.totalEarnings = (agent.totalEarnings || 0) + creditAmount;

    // Resolve support ticket if provided
    if (ticketId && agent.supportTickets) {
      const ticket = agent.supportTickets.find(t => t.ticketId === ticketId);
      if (ticket) {
        ticket.status = 'RESOLVED';
        ticket.resolvedAmount = creditAmount;
        ticket.adminNotes = reason || 'Funds credited by Admin';
        ticket.resolvedAt = new Date();
      }
    }

    await agent.save();

    createNotification({
      recipientId: agent.userId,
      role: 'delivery',
      title: `💰 Wallet Credited: +₹${creditAmount}`,
      message: `System Admin credited ₹${creditAmount} to your wallet. Reason: ${reason || 'Support Issue Adjustment'}. Available balance: ₹${agent.wallet.availableBalance}.`,
      type: 'PAYMENT',
      link: '/earnings'
    });

    res.json({
      success: true,
      message: `✅ Successfully credited ₹${creditAmount} to ${agent.fullName}'s wallet!`,
      wallet: agent.wallet
    });
  } catch (error) {
    next(error);
  }
};

export const toggleBlockDeliveryAgent = async (req, res, next) => {
  try {
    const agent = await DeliveryAgent.findById(req.params.id);
    if (!agent) return res.status(404).json({ success: false, message: 'Delivery agent not found' });

    const user = await User.findById(agent.userId);
    user.isBlocked = !user.isBlocked;
    await user.save();

    agent.status = user.isBlocked ? ACCOUNT_STATUSES.BLOCKED : ACCOUNT_STATUSES.APPROVED;
    await agent.save();

    res.json({
      success: true,
      message: `Delivery agent account is now ${user.isBlocked ? 'BLOCKED' : 'ACTIVE'}`,
      isBlocked: user.isBlocked
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// CUSTOMER MANAGEMENT & PRODUCT MODERATION
// ============================================================================

export const getAllCustomers = async (req, res, next) => {
  try {
    const { query } = req.query;
    let filter = { role: ROLES.CUSTOMER };

    if (query) {
      filter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { phone: { $regex: query, $options: 'i' } }
      ];
    }

    const customers = await User.find(filter).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, count: customers.length, customers });
  } catch (error) {
    next(error);
  }
};

export const toggleBlockCustomer = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Customer not found' });

    user.isBlocked = !user.isBlocked;
    await user.save();

    res.json({
      success: true,
      message: `Customer account is now ${user.isBlocked ? 'BLOCKED' : 'ACTIVE'}`,
      isBlocked: user.isBlocked
    });
  } catch (error) {
    next(error);
  }
};

export const toggleProductStatus = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    product.status = product.status === 'active' ? 'disabled' : 'active';
    await product.save();

    res.json({
      success: true,
      message: `Product status updated to ${product.status}`,
      product
    });
  } catch (error) {
    next(error);
  }
};
