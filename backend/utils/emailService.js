import nodemailer from 'nodemailer';

// Helper to create mail transporter
const getMailTransporter = () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  } else if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
  }
  return null;
};

// Generic mail sender
export const sendHtmlEmail = async (to, subject, htmlContent) => {
  try {
    const transporter = getMailTransporter();
    if (!transporter) {
      console.log(`⚠️ [Email Service]: Nodemailer is not configured. Falling back to console logger.`);
      console.log(`To: ${to}\nSubject: ${subject}\nContent: ${htmlContent}`);
      return false;
    }

    const fromEmail = process.env.SMTP_USER || process.env.GMAIL_USER;
    const info = await transporter.sendMail({
      from: `"NovaKart Delivery" <${fromEmail}>`,
      to,
      subject,
      html: htmlContent
    });
    console.log(`✅ [Email Service]: Email sent successfully. Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`❌ [Email Service]: Failed to send email to ${to}:`, error.message);
    return false;
  }
};

// 1. Order Confirmed Mail Template
export const sendOrderPlacedEmail = async (email, order, expectedDate) => {
  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name} x ${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${item.price * item.quantity}</td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid var(--secondary-color); padding-bottom: 15px; margin-bottom: 20px;">
        <h2 style="color: #ff9900; margin: 0;">NovaKart Order Confirmed!</h2>
        <p style="color: #64748b; margin: 5px 0 0;">Thank you for shopping with us.</p>
      </div>

      <div style="margin-bottom: 20px;">
        <p><strong>Order Number:</strong> ${order.orderNumber}</p>
        <p><strong>Estimated Delivery Date:</strong> <span style="color: #2e7d32; font-weight: bold;">${expectedDate}</span></p>
      </div>

      <h3 style="border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">Order Details</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f8fafc;">
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e2e8f0;">Item</th>
            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e2e8f0;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
          <tr>
            <td style="padding: 10px; font-weight: bold; border-top: 2px solid #e2e8f0;">Shipping Fee:</td>
            <td style="padding: 10px; font-weight: bold; border-top: 2px solid #e2e8f0; text-align: right;">₹${order.shippingFee}</td>
          </tr>
          ${order.discount > 0 ? `
          <tr>
            <td style="padding: 10px; font-weight: bold; color: #2e7d32;">Discount Applied:</td>
            <td style="padding: 10px; font-weight: bold; color: #2e7d32; text-align: right;">-₹${order.discount}</td>
          </tr>
          ` : ''}
          <tr style="font-size: 1.15rem; font-weight: bold; color: #1e293b;">
            <td style="padding: 10px; border-top: 2px solid #e2e8f0;">Total Payable:</td>
            <td style="padding: 10px; border-top: 2px solid #e2e8f0; text-align: right;">₹${order.totalAmount}</td>
          </tr>
        </tbody>
      </table>

      <div style="background-color: #f8fafc; border-radius: 8px; padding: 15px; margin-bottom: 20px; font-size: 0.9rem;">
        <strong>Shipping Address:</strong><br/>
        ${order.deliveryAddress.fullName}<br/>
        ${order.deliveryAddress.street}<br/>
        ${order.deliveryAddress.city}, ${order.deliveryAddress.state} - ${order.deliveryAddress.postalCode}<br/>
        Phone: ${order.deliveryAddress.phone}
      </div>

      <div style="text-align: center; color: #94a3b8; font-size: 0.78rem; border-top: 1px solid #e2e8f0; padding-top: 15px;">
        This is an automated shipping notification from your NovaKart secure checkout system.
      </div>
    </div>
  `;

  await sendHtmlEmail(email, `🛒 Order Placed Successfully: ${order.orderNumber}`, html);
};

// 2. Order Status Update Template
export const sendOrderStatusUpdateEmail = async (email, order, status, note, expectedDate) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid var(--secondary-color); padding-bottom: 15px; margin-bottom: 20px;">
        <h2 style="color: #ff9900; margin: 0;">Order Status Update</h2>
        <p style="color: #64748b; margin: 5px 0 0;">Your NovaKart order has a new update.</p>
      </div>

      <div style="margin-bottom: 20px; line-height: 1.6;">
        <p><strong>Order Number:</strong> ${order.orderNumber}</p>
        <p><strong>New Status:</strong> <span style="background-color: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 20px; font-weight: bold; text-transform: uppercase; font-size: 0.8rem;">${status}</span></p>
        ${note ? `<p><strong>Update Note:</strong> ${note}</p>` : ''}
        ${expectedDate ? `<p><strong>Expected Delivery:</strong> <span style="color: #2e7d32; font-weight: bold;">${expectedDate}</span></p>` : ''}
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="http://localhost:3000/orders/${order._id}/track" style="background-color: #ff9900; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">Track Your Order</a>
      </div>

      <div style="text-align: center; color: #94a3b8; font-size: 0.78rem; border-top: 1px solid #e2e8f0; padding-top: 15px;">
        Need help? Contact support or track real-time delivery agents on our website.
      </div>
    </div>
  `;

  await sendHtmlEmail(email, `📦 Order ${order.orderNumber} Status Updated: ${status}`, html);
};

// 3. Gift Card Earned Template
export const sendGiftCardEmail = async (email, giftCard) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; text-align: center;">
      <div style="font-size: 4rem; margin-bottom: 10px;">🎁</div>
      <h2 style="color: #ff9900; margin: 0 0 10px;">You've Received a ₹50 Gift Card!</h2>
      <p style="color: #64748b; font-size: 1.05rem; margin-bottom: 24px;">Thank you for placing an order above ₹1000 on NovaKart. Here is your reward!</p>

      <div style="background: linear-gradient(135deg, #ff9900, #ff5500); color: white; border-radius: 12px; padding: 24px; display: inline-block; margin-bottom: 24px; box-shadow: 0 4px 15px rgba(255, 85, 0, 0.25);">
        <span style="font-size: 0.85rem; letter-spacing: 2px; text-transform: uppercase; opacity: 0.85;">GIFT CARD CODE</span><br/>
        <strong style="font-size: 2.2rem; letter-spacing: 1px; display: block; margin: 8px 0;">${giftCard.code}</strong>
        <span style="font-size: 0.9rem; font-weight: bold; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px;">VALUE: ₹50</span>
      </div>

      <div style="font-size: 0.9rem; color: #4b5563; margin-bottom: 24px; line-height: 1.5;">
        Valid for 30 days until <span style="font-weight: bold; color: #ef4444;">${new Date(giftCard.expiryDate).toLocaleDateString()}</span>.<br/>
        You can apply this code during checkout to get an instant ₹50 discount on your next order!
      </div>

      <div style="text-align: center; color: #94a3b8; font-size: 0.78rem; border-top: 1px solid #e2e8f0; padding-top: 15px;">
        NovaKart secure rewards and offers panel.
      </div>
    </div>
  `;

  await sendHtmlEmail(email, `🎁 Congratulations! You've earned a ₹50 Gift Card!`, html);
};

// 4. Delivery OTP Email Template
export const sendDeliveryOtpEmail = async (email, order, otp, agentName = 'Delivery Executive') => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #3B82F6; padding-bottom: 15px; margin-bottom: 20px;">
        <h2 style="color: #1E40AF; margin: 0;">🔑 Secure Delivery Verification OTP</h2>
        <p style="color: #64748b; margin: 5px 0 0;">Your NovaKart order <strong>#${order.orderNumber}</strong> is Out for Delivery!</p>
      </div>

      <div style="text-align: center; background: #EFF6FF; border: 2px dashed #3B82F6; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <span style="font-size: 0.85rem; letter-spacing: 2px; text-transform: uppercase; color: #1E40AF; font-weight: bold;">YOUR 6-DIGIT DELIVERY OTP CODE</span><br/>
        <strong style="font-size: 2.5rem; letter-spacing: 6px; color: #1D4ED8; display: block; margin: 10px 0;">${otp}</strong>
        <span style="font-size: 0.85rem; color: #4b5563;">Please give this OTP to delivery executive <strong>${agentName}</strong> to collect your parcel.</span>
      </div>

      <div style="background-color: #f8fafc; border-radius: 8px; padding: 15px; margin-bottom: 20px; font-size: 0.9rem; line-height: 1.6;">
        <strong>Order Summary:</strong><br/>
        • Order Number: <strong>${order.orderNumber}</strong><br/>
        • Customer Name: <strong>${order.deliveryAddress?.fullName || 'Customer'}</strong><br/>
        • Delivery Address: ${order.deliveryAddress?.street || ''}, ${order.deliveryAddress?.city || ''} (${order.deliveryAddress?.postalCode || ''})<br/>
        • Payment Method: <strong>${order.paymentMethod || 'Prepaid Online'}</strong>
      </div>

      <div style="text-align: center; margin: 25px 0;">
        <a href="http://localhost:3000/orders/${order._id}/track" style="background-color: #2563EB; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">Track Live Delivery Rider</a>
      </div>

      <div style="text-align: center; color: #94a3b8; font-size: 0.78rem; border-top: 1px solid #e2e8f0; padding-top: 15px;">
        For security, do not share this OTP with anyone other than your assigned NovaKart delivery agent.
      </div>
    </div>
  `;

  await sendHtmlEmail(email, `🔑 Delivery OTP: ${otp} for NovaKart Order #${order.orderNumber}`, html);
};

// 5. Wallet Withdrawal / Cashout Email Template
export const sendWalletWithdrawalEmail = async (email, agentName, amount, bankDetails, remainingBalance) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #10B981; padding-bottom: 15px; margin-bottom: 20px;">
        <h2 style="color: #047857; margin: 0;">⚡ Wallet Cashout Request Processed</h2>
        <p style="color: #64748b; margin: 5px 0 0;">Hi <strong>${agentName}</strong>, your payout request has been registered.</p>
      </div>

      <div style="background-color: #ECFDF5; border: 1.5px solid #A7F3D0; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 20px;">
        <div style="font-size: 0.8rem; color: #047857; font-weight: bold; text-transform: uppercase;">Amount Withdrawn</div>
        <div style="font-size: 2.2rem; font-weight: 900; color: #059669; margin: 6px 0;">₹${amount.toLocaleString('en-IN')}</div>
        <div style="fontSize: 0.82rem; color: #065F46;">Sent to: <strong>${bankDetails?.bankName || 'Registered Bank'}</strong> (A/C: •••• ${bankDetails?.accountNumber?.slice(-4) || '8204'})</div>
      </div>

      <div style="background-color: #f8fafc; border-radius: 8px; padding: 15px; margin-bottom: 20px; font-size: 0.88rem; line-height: 1.6;">
        • <strong>Transaction Time:</strong> ${new Date().toLocaleString('en-IN')}<br/>
        • <strong>Destination IFSC:</strong> ${bankDetails?.ifscCode || 'SBIN0004521'}<br/>
        • <strong>Remaining Wallet Balance:</strong> <strong style="color: #2563EB;">₹${remainingBalance.toLocaleString('en-IN')}</strong><br/>
        • <strong>Daily Cashout Limit:</strong> 1 withdrawal completed for today
      </div>

      <div style="text-align: center; color: #94a3b8; font-size: 0.78rem; border-top: 1px solid #e2e8f0; padding-top: 15px;">
        This is an automated payout confirmation from NovaKart Fleet Nodal Treasury.
      </div>
    </div>
  `;

  await sendHtmlEmail(email, `⚡ NovaKart Wallet Cashout of ₹${amount.toLocaleString('en-IN')} Submitted`, html);
};

// 6. Security Password OTP Email Template
export const sendPasswordOtpEmail = async (email, name, otp) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #EF4444; padding-bottom: 15px; margin-bottom: 20px;">
        <h2 style="color: #B91C1C; margin: 0;">🔐 Account Password Reset OTP</h2>
        <p style="color: #64748b; margin: 5px 0 0;">Verification code for <strong>${name}</strong></p>
      </div>

      <div style="text-align: center; background: #FEF2F2; border: 2px dashed #EF4444; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <span style="font-size: 0.85rem; letter-spacing: 2px; text-transform: uppercase; color: #991B1B; font-weight: bold;">YOUR 6-DIGIT SECURITY OTP</span><br/>
        <strong style="font-size: 2.6rem; letter-spacing: 8px; color: #DC2626; display: block; margin: 10px 0;">${otp}</strong>
        <span style="font-size: 0.82rem; color: #7F1D1D;">Valid for 10 minutes. Do not share this OTP with anyone.</span>
      </div>

      <div style="text-align: center; color: #94a3b8; font-size: 0.78rem; border-top: 1px solid #e2e8f0; padding-top: 15px;">
        If you did not request a password change, please report immediately to NovaKart Support.
      </div>
    </div>
  `;

  await sendHtmlEmail(email, `🔐 Password Reset Security OTP: ${otp}`, html);
};

// 7. Merchant Store Approval Confirmation Email Template
export const sendSellerApprovalEmail = async (email, ownerName, storeName, approvedCategories = []) => {
  const categoriesList = approvedCategories && approvedCategories.length > 0
    ? approvedCategories.join(', ')
    : 'All Standard Retail Categories';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 14px; background-color: #ffffff; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
      <div style="text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 20px; margin-bottom: 24px;">
        <div style="font-size: 28px; font-weight: 800; color: #0f172a; letter-spacing: 0.5px;">
          <span style="color: #0f766e;">Nova</span>Kart <span style="font-size: 14px; background: #ccfbf1; color: #0f766e; padding: 4px 10px; border-radius: 20px; font-weight: 700; vertical-align: middle;">Merchant Network</span>
        </div>
        <p style="color: #64748b; margin: 6px 0 0; font-size: 14px;">Store KYC Verification &amp; Account Approval Notice</p>
      </div>

      <div style="background: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
        <div style="font-size: 2rem; margin-bottom: 8px;">🎉</div>
        <h2 style="color: #065f46; margin: 0 0 6px 0; font-size: 20px;">Congratulations, ${ownerName || 'Merchant'}!</h2>
        <p style="color: #047857; margin: 0; font-size: 15px; font-weight: 600;">
          Your store "<strong>${storeName}</strong>" has been officially reviewed and approved by the NovaKart Administration!
        </p>
      </div>

      <div style="margin-bottom: 24px; color: #334155; font-size: 14px; line-height: 1.6;">
        <p>Your store profile, premises verification, and compliance documentation have passed admin clearance. <strong>Your merchant portal is now fully activated with the real operational interface!</strong></p>
        
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 16px 0;">
          <div style="font-weight: 700; color: #0f172a; margin-bottom: 8px;">Approved Catalog Categories:</div>
          <div style="color: #0f766e; font-weight: 600; font-size: 13.5px;">✓ ${categoriesList}</div>
        </div>

        <h3 style="color: #0f172a; font-size: 16px; margin: 18px 0 10px 0;">Unlocked Operational Features:</h3>
        <ul style="padding-left: 20px; margin: 0; color: #475569;">
          <li style="margin-bottom: 6px;"><strong>Add &amp; Publish Products:</strong> Post store items in your approved categories.</li>
          <li style="margin-bottom: 6px;"><strong>Receive &amp; Fulfill Orders:</strong> Accept customer orders and print shipping labels.</li>
          <li style="margin-bottom: 6px;"><strong>Bank Payouts &amp; Settlements:</strong> Access direct treasury disbursals.</li>
          <li style="margin-bottom: 6px;"><strong>Customer Order Chat:</strong> 7-day post-delivery customer support chat.</li>
          <li style="margin-bottom: 6px;"><strong>Admin Helpline:</strong> Direct helpline support with NovaKart admins.</li>
        </ul>
      </div>

      <div style="text-align: center; margin: 32px 0 20px;">
        <a href="https://seller-frontend-gamma.vercel.app/login" style="background: #0f766e; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 800; font-size: 15px; display: inline-block;">
          Sign In to Real Merchant Portal &rarr;
        </a>
      </div>

      <div style="text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px;">
        NovaKart Marketplace &bull; Security &amp; Compliance Department &bull; Automated Dispatch
      </div>
    </div>
  `;

  await sendHtmlEmail(email, `🎉 Congratulations! Your NovaKart Merchant Store "${storeName}" Has Been Approved!`, html);
};

