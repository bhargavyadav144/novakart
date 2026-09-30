import { GiftCard } from '../models/GiftCard.js';

// @desc    Get current user's gift cards
// @route   GET /api/gift-cards/my-cards
// @access  Private
export const getMyGiftCards = async (req, res, next) => {
  try {
    const userEmail = (req.user.email || '').toLowerCase().trim();
    const queryConditions = [{ customerId: req.user._id }];
    if (userEmail) {
      queryConditions.push({ email: userEmail });
    }

    let cards = await GiftCard.find({ $or: queryConditions }).sort({ createdAt: -1 });

    // If user has no gift cards yet, automatically issue a ₹50 Welcome Gift Card!
    if (cards.length === 0) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const code = `GC-50-${randomSuffix}`;
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 6); // Valid 6 months

      const newCard = new GiftCard({
        code,
        amount: 50,
        customerId: req.user._id,
        email: userEmail,
        expiryDate,
        isUsed: false
      });
      await newCard.save();

      // Trigger Notification and Email
      try {
        const { createNotification } = await import('./notificationController.js');
        await createNotification({
          recipientId: req.user._id,
          role: req.user.role || 'customer',
          title: `🎁 ₹50 Gift Card Received! Code: ${code}`,
          message: `Congratulations! You received a ₹50 Gift Card (${code}). Copy it to use at checkout or redeem to wallet!`,
          type: 'GIFT_CARD',
          link: '/profile',
          giftCardCode: code,
          emailSent: true,
          emailSubject: `🎁 Your NovaKart ₹50 Gift Card Code: ${code}`,
          emailBody: `Congratulations! Here is your ₹50 Gift Card Code: ${code}.\n\nYou can copy this code at checkout or redeem it directly into your NovaFleet wallet balance!`
        });
      } catch (notifErr) {
        console.error('Failed to trigger gift card notification:', notifErr);
      }

      cards = [newCard];
    }

    res.json({ success: true, cards });
  } catch (error) {
    next(error);
  }
};


// @desc    Validate and verify gift card for order checkout
// @route   POST /api/gift-cards/apply
// @access  Private
export const applyGiftCard = async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Please provide a gift card code.' });
    }

    const cleanCode = code.trim().toUpperCase();
    const altCode = cleanCode.startsWith('GF-')
      ? cleanCode.replace(/^GF-/, 'GC-')
      : cleanCode.startsWith('GC-')
        ? cleanCode.replace(/^GC-/, 'GF-')
        : cleanCode;
    const userEmail = (req.user.email || '').toLowerCase().trim();

    // Special Global First-Order Promo Gift Card: NOVAKART20
    if (cleanCode === 'NOVAKART20' || altCode === 'NOVAKART20') {
      const OrderModule = await import('../models/Order.js');
      const Order = OrderModule.Order || OrderModule;
      
      const orderCount = await Order.countDocuments({ customerId: req.user._id, orderStatus: { $ne: 'CANCELLED' } });
      if (orderCount > 0) {
        return res.status(400).json({ success: false, message: 'This promo code is only valid for your first order.' });
      }

      return res.json({
        success: true,
        message: 'First order promo applied successfully! (₹50 discount)',
        card: {
          code: 'NOVAKART20',
          amount: 50
        }
      });
    }

    let card = await GiftCard.findOne({
      code: { $in: [cleanCode, altCode] }
    });

    // Fallback: If code not found by exact string, check if user has an unused gift card in their account/email
    if (!card) {
      const cardConditions = [{ customerId: req.user._id }];
      if (userEmail) cardConditions.push({ email: userEmail });
      card = await GiftCard.findOne({
        isUsed: false,
        $or: cardConditions
      }).sort({ createdAt: -1 });
    }

    if (!card) {
      return res.status(404).json({ success: false, message: 'Invalid gift card code.' });
    }

    // Match either by customer ID or by user email address
    const cardEmail = (card.email || '').toLowerCase().trim();
    const isOwnerMatch = (card.customerId && card.customerId.toString() === req.user._id.toString()) ||
                         (userEmail && cardEmail && userEmail === cardEmail);

    if (!isOwnerMatch) {
      return res.status(403).json({ success: false, message: 'This gift card belongs to another account email.' });
    }

    if (card.isUsed) {
      return res.status(400).json({ success: false, message: 'This gift card has already been used.' });
    }

    if (new Date() > new Date(card.expiryDate)) {
      return res.status(400).json({ success: false, message: 'This gift card has expired.' });
    }

    res.json({
      success: true,
      message: 'Gift card applied successfully!',
      card: {
        code: cleanCode.startsWith('GF-') ? cleanCode : card.code,
        amount: card.amount
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: get all generated gift cards
// @route   GET /api/gift-cards/admin/all
// @access  Private/Admin
export const getAdminAllGiftCards = async (req, res, next) => {
  try {
    const cards = await GiftCard.find({})
      .populate('customerId', 'name email')
      .populate('orderId', 'orderNumber totalAmount')
      .sort({ createdAt: -1 });
    res.json({ success: true, cards });
  } catch (error) {
    next(error);
  }
};
