import nodemailer, { Transporter } from 'nodemailer';
import { ENV } from '../../config/env';
import { logger } from '../../config/logger';
import { OrderStatus, formatPaiseToINR } from '@necessity/shared';

export interface OrderItemEmailSnapshot {
  productName: string;
  sku: string;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
}

export interface SendOrderStatusEmailParams {
  to: string;
  customerName: string;
  businessName: string;
  orderNumber: string;
  orderDate: Date;
  status: OrderStatus;
  items: OrderItemEmailSnapshot[];
  subtotalPaise: number;
  totalGstPaise: number;
  deliveryFeePaise: number;
  grandTotalPaise: number;
  paymentMethod: string;
  paymentStatus: string;
  deliveryAddress?: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  dispatchDetails?: {
    dispatchedAt?: Date;
    courierName?: string;
    trackingNumber?: string;
    trackingUrl?: string;
    transportDetails?: string;
  };
  pickupDetails?: {
    pickedUpAt?: Date;
    pickupLocation?: string;
    collectedBy?: string;
    notes?: string;
  };
  reason?: string;
}

export interface SendPaymentReceivedEmailParams {
  to: string;
  customerName: string;
  businessName: string;
  orderNumber: string;
  orderDate?: Date;
  amountPaidPaise: number;
  totalPaidPaise: number;
  remainingBalancePaise: number;
  grandTotalPaise: number;
  paymentMethod: string;
  referenceNumber: string;
  isPartial: boolean;
  notes?: string;
}

export interface SendPaymentFailedEmailParams {
  to: string;
  customerName: string;
  businessName: string;
  orderNumber: string;
  orderDate?: Date;
  amountPaise: number;
  paymentMethod: string;
  referenceNumber?: string;
  reason?: string;
}

export interface SendPaymentRefundedEmailParams {
  to: string;
  customerName: string;
  businessName: string;
  orderNumber: string;
  amountRefundedPaise: number;
  paymentMethod: string;
  refundId: string;
  reason?: string;
}

export interface SendApprovalEmailParams {
  to: string;
  customerName: string;
  businessName: string;
  customerType: string;
}

export interface SendRejectionEmailParams {
  to: string;
  customerName: string;
  businessName: string;
  reason?: string;
}

export interface SendRegistrationConfirmationEmailParams {
  to: string;
  customerName: string;
  businessName: string;
  referenceNumber: string;
  phone: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
}

export interface SendAccountDisabledEmailParams {
  to: string;
  customerName: string;
  businessName: string;
  reason?: string;
}

export interface SendAccountEnabledEmailParams {
  to: string;
  customerName: string;
  businessName: string;
}

export class EmailService {
  private static transporter: Transporter | null = null;

  private static getTransporter(): Transporter | null {
    if (!ENV.SMTP_HOST || !ENV.SMTP_USER) {
      return null;
    }

    if (!this.transporter) {
      const port = Number(ENV.SMTP_PORT) || 587;
      const isSecure = ENV.SMTP_SECURE || port === 465;

      this.transporter = nodemailer.createTransport({
        host: ENV.SMTP_HOST,
        port,
        secure: isSecure,
        auth: {
          user: ENV.SMTP_USER,
          pass: ENV.SMTP_PASS,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });
    }

    return this.transporter;
  }

  /**
   * Verify SMTP connection status without sending an email
   */
  static async verifyConnection(): Promise<{
    configured: boolean;
    ready: boolean;
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    from?: string;
    error?: string;
  }> {
    const transporter = this.getTransporter();
    if (!transporter) {
      return {
        configured: false,
        ready: false,
        error: 'SMTP_HOST or SMTP_USER is not configured in backend environment variables.',
      };
    }

    try {
      await transporter.verify();
      const maskedUser = ENV.SMTP_USER
        ? ENV.SMTP_USER.replace(/(?<=^.{2}).*(?=@)/, '***')
        : '';
      return {
        configured: true,
        ready: true,
        host: ENV.SMTP_HOST,
        port: Number(ENV.SMTP_PORT) || 587,
        secure: ENV.SMTP_SECURE || ENV.SMTP_PORT === 465,
        user: maskedUser,
        from: ENV.SMTP_FROM,
      };
    } catch (err: any) {
      logger.error(`[EmailService] SMTP connection verification failed: ${err.message}`);
      return {
        configured: true,
        ready: false,
        host: ENV.SMTP_HOST,
        port: Number(ENV.SMTP_PORT) || 587,
        error: err.message || 'SMTP server connection verification failed.',
      };
    }
  }

  /**
   * Send B2B customer registration submission confirmation email
   */
  static async sendRegistrationConfirmationEmail(
    params: SendRegistrationConfirmationEmailParams
  ): Promise<EmailSendResult> {
    const { to, customerName, businessName, referenceNumber, phone } = params;

    const transporter = this.getTransporter();
    if (!transporter) {
      logger.info(
        `[EmailService] SMTP not configured. Skipped sending registration confirmation email to ${to} (${businessName}).`
      );
      return {
        success: false,
        skipped: true,
        error: 'SMTP provider is not configured. Email notification skipped.',
      };
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Wholesale Onboarding Application Received</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; margin: 0; padding: 20px; color: #334155; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { background: #F47732; padding: 32px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0 0 6px 0; font-size: 24px; font-weight: 700; }
    .header p { margin: 0; font-size: 14px; opacity: 0.95; }
    .content { padding: 32px 24px; }
    .badge { display: inline-block; background: #FFF1E8; color: #E95B2A; font-weight: 700; font-size: 13px; padding: 6px 14px; border-radius: 9999px; border: 1px solid #FED7AA; margin-bottom: 20px; }
    .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: #F8FAFC; border-radius: 8px; border: 1px solid #E2E8F0; }
    .info-table td { padding: 12px 16px; font-size: 14px; border-bottom: 1px solid #E2E8F0; }
    .info-table td.label { font-weight: 600; color: #64748B; width: 40%; }
    .info-table td.value { font-weight: 700; color: #0F172A; }
    .instructions { background: #FFF8F3; border-left: 4px solid #F47732; padding: 16px; border-radius: 4px; margin: 24px 0; }
    .instructions h3 { margin: 0 0 6px 0; font-size: 15px; color: #C2410C; }
    .instructions p { margin: 0; font-size: 14px; line-height: 1.5; color: #9A3412; }
    .footer { background: #F8FAFC; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748B; border-top: 1px solid #E2E8F0; }
    .footer a { color: #F47732; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>NECESSITY INDIA PVT. LTD.</h1>
      <p>Institutional Supplies & Wholesale Distribution</p>
    </div>
    <div class="content">
      <div class="badge">Application Under Review</div>
      <p style="font-size: 16px; font-weight: 600; color: #0F172A;">Dear ${customerName},</p>
      <p>Thank you for submitting your wholesale customer registration with Necessity India for <strong>${businessName}</strong>.</p>
      <p>Your onboarding profile has been registered in our system and is currently undergoing institutional verification.</p>

      <table class="info-table">
        <tr>
          <td class="label">Application Reference</td>
          <td class="value" style="font-family: monospace; color: #F47732;">${referenceNumber}</td>
        </tr>
        <tr>
          <td class="label">Business Firm</td>
          <td class="value">${businessName}</td>
        </tr>
        <tr>
          <td class="label">Authorized Contact</td>
          <td class="value">${customerName}</td>
        </tr>
        <tr>
          <td class="label">Registered Email</td>
          <td class="value">${to}</td>
        </tr>
        <tr>
          <td class="label">Registered Phone</td>
          <td class="value">+91 ${phone}</td>
        </tr>
      </table>

      <div class="instructions">
        <h3>What Happens Next?</h3>
        <p>To protect wholesale prices and trade margins, every account is reviewed by our compliance team. Once verified, you will receive an account approval notification email unlocking institutional pricing and ordering lines.</p>
      </div>

      <p style="font-size: 13px; color: #64748B;">If you have any questions or wish to submit additional trade documentation, please reply to this email or contact our support team.</p>
    </div>
    <div class="footer">
      <p>Necessity India Pvt. Ltd. | Customer Support: <a href="mailto:${ENV.SUPPORT_EMAIL}">${ENV.SUPPORT_EMAIL}</a> | Phone: ${ENV.SUPPORT_PHONE}</p>
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
NECESSITY INDIA PVT. LTD.
Wholesale Onboarding Application Received

Dear ${customerName},

Thank you for submitting your wholesale customer registration for ${businessName}.
Your onboarding application has been received and is currently under institutional verification.

Application Summary:
- Application Reference: ${referenceNumber}
- Business Firm: ${businessName}
- Contact Person: ${customerName}
- Registered Email: ${to}
- Mobile: +91 ${phone}

What Happens Next:
Our compliance team will review your submitted business credentials. Once approved, you will receive an account activation notification email with access to wholesale catalogs and ordering lines.

Support Contact:
Email: ${ENV.SUPPORT_EMAIL}
Phone: ${ENV.SUPPORT_PHONE}

Necessity India Pvt. Ltd.
    `.trim();

    try {
      const info = await transporter.sendMail({
        from: ENV.SMTP_FROM,
        to,
        subject: `Wholesale Application Received – Reference #${referenceNumber.slice(-8).toUpperCase()}`,
        text: textContent,
        html: htmlContent,
      });

      logger.info(
        `[EmailService] Registration confirmation email sent to ${to} (MessageId: ${info.messageId})`
      );
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      logger.error(`[EmailService] Failed to send registration email to ${to}: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send B2B customer account approval email with professional HTML and plain text
   */
  static async sendApprovalEmail(params: SendApprovalEmailParams): Promise<EmailSendResult> {
    const { to, customerName, businessName, customerType } = params;

    const transporter = this.getTransporter();
    if (!transporter) {
      logger.info(
        `[EmailService] SMTP not configured. Skipped sending approval email to ${to} (${businessName}).`
      );
      return {
        success: false,
        skipped: true,
        error: 'SMTP provider is not configured. Email notification skipped.',
      };
    }

    const appLoginUrl = ENV.CLIENT_WEB_URL ? `${ENV.CLIENT_WEB_URL}/login` : '';
    const formattedCustomerType =
      customerType.toLowerCase() === 'old' ? 'Existing Wholesale Partner (Old)' : 'New Wholesale Account (New)';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your B2B Account Has Been Approved</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 20px; color: #334155; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { background: #047857; padding: 32px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0 0 8px 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { margin: 0; font-size: 14px; opacity: 0.9; }
    .content { padding: 32px 24px; }
    .greeting { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 16px; }
    .badge { display: inline-block; background: #ecfdf5; color: #047857; font-weight: 700; font-size: 13px; padding: 4px 12px; border-radius: 9999px; border: 1px solid #a7f3d0; margin-bottom: 20px; }
    .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
    .info-table td { padding: 12px 16px; font-size: 14px; border-bottom: 1px solid #e2e8f0; }
    .info-table td.label { font-weight: 600; color: #64748b; width: 40%; }
    .info-table td.value { font-weight: 700; color: #0f172a; }
    .instructions { background: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; border-radius: 4px; margin: 24px 0; }
    .instructions h3 { margin: 0 0 8px 0; font-size: 15px; color: #065f46; }
    .instructions p { margin: 0; font-size: 14px; line-height: 1.5; color: #047857; }
    .btn-container { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background: #059669; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 28px; border-radius: 8px; }
    .footer { background: #f8fafc; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    .footer a { color: #059669; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>NECESSITY INDIA PVT. LTD.</h1>
      <p>Institutional Supplies & B2B Distribution Management</p>
    </div>
    <div class="content">
      <div class="badge">✓ Account Approved</div>
      <p class="greeting">Dear ${customerName},</p>
      <p>We are pleased to inform you that your B2B wholesale ordering account for <strong>${businessName}</strong> has been verified and approved by our commercial accounts team.</p>
      
      <table class="info-table">
        <tr>
          <td class="label">Business / Shop:</td>
          <td class="value">${businessName}</td>
        </tr>
        <tr>
          <td class="label">Contact Person:</td>
          <td class="value">${customerName}</td>
        </tr>
        <tr>
          <td class="label">Customer Classification:</td>
          <td class="value">${formattedCustomerType}</td>
        </tr>
        <tr>
          <td class="label">Approval Status:</td>
          <td class="value" style="color: #059669;">Approved (Active)</td>
        </tr>
      </table>

      <div class="instructions">
        <h3>How to start placing orders:</h3>
        <p>1. Open the <strong>Necessity B2B</strong> mobile app on your smartphone or access the portal.<br>
        2. Sign in using your registered mobile number or email and password.<br>
        3. Browse towels, napkins, cleaning chemicals, tray covers, and wholesale supplies at your approved tiered pricing.</p>
      </div>

      ${
        appLoginUrl
          ? `<div class="btn-container">
        <a href="${appLoginUrl}" class="btn">Sign In to Wholesale Portal</a>
      </div>`
          : ''
      }

      <p style="font-size: 13px; color: #64748b;">If you need assistance with credit lines or catalogue customization, contact your assigned representative or our corporate support desk.</p>
    </div>
    <div class="footer">
      <p><strong>Necessity India Pvt. Ltd.</strong></p>
      <p>Commercial Facilities, Hospitality & Healthcare Supplies</p>
      <p>Support: <a href="mailto:${ENV.SUPPORT_EMAIL}">${ENV.SUPPORT_EMAIL}</a> | Phone: ${ENV.SUPPORT_PHONE}</p>
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
Dear ${customerName},

We are pleased to inform you that your B2B wholesale ordering account for ${businessName} has been approved by Necessity India Pvt. Ltd.

Account Details:
- Business Name: ${businessName}
- Contact Person: ${customerName}
- Customer Type: ${formattedCustomerType}
- Status: Approved (Active)

Instructions:
1. Open the Necessity B2B mobile application or web portal.
2. Sign in with your registered phone number or email and your password.
3. Access institutional wholesale catalogue and place orders with full business credit terms.
${appLoginUrl ? `\nPortal Link: ${appLoginUrl}` : ''}

Support Contact:
Email: ${ENV.SUPPORT_EMAIL}
Phone: ${ENV.SUPPORT_PHONE}

Necessity India Pvt. Ltd.
    `.trim();

    try {
      const info = await transporter.sendMail({
        from: ENV.SMTP_FROM,
        to,
        subject: 'Your B2B Account Has Been Approved',
        text: textContent,
        html: htmlContent,
      });

      logger.info(`[EmailService] Approval email successfully sent to ${to} (MessageId: ${info.messageId})`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      // Safe error logging without exposing secrets
      logger.error(`[EmailService] Failed to send approval email to ${to}: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send B2B customer account rejection email
   */
  static async sendRejectionEmail(params: SendRejectionEmailParams): Promise<EmailSendResult> {
    const { to, customerName, businessName, reason } = params;

    const transporter = this.getTransporter();
    if (!transporter) {
      logger.info(`[EmailService] SMTP not configured. Skipped sending rejection email to ${to}.`);
      return {
        success: false,
        skipped: true,
        error: 'SMTP provider is not configured.',
      };
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>B2B Account Application Update</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; margin: 0; padding: 20px; color: #334155; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; }
    .header { background: #b91c1c; padding: 32px 24px; text-align: center; color: #ffffff; }
    .content { padding: 32px 24px; }
    .reason-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 4px; margin: 20px 0; color: #991b1b; }
    .footer { background: #f8fafc; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0; font-size:22px;">NECESSITY INDIA PVT. LTD.</h1>
      <p style="margin:4px 0 0 0; font-size:14px; opacity:0.9;">B2B Registration Update</p>
    </div>
    <div class="content">
      <p>Dear ${customerName},</p>
      <p>Thank you for your interest in partnering with Necessity India Pvt. Ltd. for wholesale supplies for <strong>${businessName}</strong>.</p>
      <p>After reviewing your commercial registration details, our verification team was unable to approve your wholesale account at this time.</p>
      
      ${
        reason
          ? `<div class="reason-box">
        <strong>Reason provided by verification team:</strong><br>${reason}
      </div>`
          : ''
      }

      <p>If you believe this is in error or have updated commercial documentation (GSTIN, trade license, or business proofs), please contact our onboarding desk.</p>
    </div>
    <div class="footer">
      <p>Support: <a href="mailto:${ENV.SUPPORT_EMAIL}">${ENV.SUPPORT_EMAIL}</a> | Phone: ${ENV.SUPPORT_PHONE}</p>
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
Dear ${customerName},

Thank you for your application for a wholesale B2B account for ${businessName}.

Our verification team was unable to approve your wholesale account at this time.
${reason ? `\nReason: ${reason}\n` : ''}
If you have updated business documentation or wish to clarify your registration, please reach out to our team at ${ENV.SUPPORT_EMAIL} or ${ENV.SUPPORT_PHONE}.

Necessity India Pvt. Ltd.
    `.trim();

    try {
      const info = await transporter.sendMail({
        from: ENV.SMTP_FROM,
        to,
        subject: 'B2B Wholesale Account Application Update',
        text: textContent,
        html: htmlContent,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      logger.error(`[EmailService] Failed to send rejection email to ${to}: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send B2B customer account disabled notification email
   */
  static async sendAccountDisabledEmail(params: SendAccountDisabledEmailParams): Promise<EmailSendResult> {
    const { to, customerName, businessName, reason } = params;

    const transporter = this.getTransporter();
    if (!transporter) {
      logger.info(
        `[EmailService] SMTP not configured. Skipped sending account disabled email to ${to} (${businessName}).`
      );
      return {
        success: false,
        skipped: true,
        error: 'SMTP provider is not configured. Email notification skipped.',
      };
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your B2B Account Has Been Disabled</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 20px; color: #334155; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { background: #dc2626; padding: 32px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0 0 8px 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { margin: 0; font-size: 14px; opacity: 0.9; }
    .content { padding: 32px 24px; }
    .greeting { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 16px; }
    .badge { display: inline-block; background: #fef2f2; color: #dc2626; font-weight: 700; font-size: 13px; padding: 4px 12px; border-radius: 9999px; border: 1px solid #fecaca; margin-bottom: 20px; }
    .notice-box { background: #fff1f2; border-left: 4px solid #e11d48; padding: 16px; border-radius: 4px; margin: 20px 0; }
    .notice-box h3 { margin: 0 0 8px 0; font-size: 15px; color: #9f1239; }
    .notice-box p { margin: 0; font-size: 14px; line-height: 1.5; color: #be123c; }
    .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
    .info-table td { padding: 12px 16px; font-size: 14px; border-bottom: 1px solid #e2e8f0; }
    .info-table td.label { font-weight: 600; color: #64748b; width: 40%; }
    .info-table td.value { font-weight: 700; color: #0f172a; }
    .footer { background: #f8fafc; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    .footer a { color: #dc2626; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>NECESSITY INDIA PVT. LTD.</h1>
      <p>Institutional Supplies & B2B Distribution Management</p>
    </div>
    <div class="content">
      <div class="badge">✕ Account Disabled</div>
      <p class="greeting">Dear ${customerName},</p>
      <p>This is an official notice that your wholesale B2B ordering account for <strong>${businessName}</strong> has been disabled by an administrator.</p>
      
      <table class="info-table">
        <tr>
          <td class="label">Business / Shop:</td>
          <td class="value">${businessName}</td>
        </tr>
        <tr>
          <td class="label">Contact Person:</td>
          <td class="value">${customerName}</td>
        </tr>
        <tr>
          <td class="label">Account Status:</td>
          <td class="value" style="color: #dc2626;">Disabled / Inactive</td>
        </tr>
      </table>

      ${
        reason
          ? `<div class="notice-box">
        <h3>Reason for Account Disabling:</h3>
        <p>${reason}</p>
      </div>`
          : ''
      }

      <p style="font-size: 14px; line-height: 1.6; color: #475569;">
        While your account is disabled, you will be unable to log in to the wholesale mobile app or web portal, view catalogue pricing, or place purchase orders.
      </p>

      <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
        If you have questions, believe this was done in error, or would like to request account reinstatement, please contact our support desk.
      </p>
    </div>
    <div class="footer">
      <p><strong>Necessity India Pvt. Ltd.</strong></p>
      <p>Commercial Facilities, Hospitality & Healthcare Supplies</p>
      <p>Support: <a href="mailto:${ENV.SUPPORT_EMAIL}">${ENV.SUPPORT_EMAIL}</a> | Phone: ${ENV.SUPPORT_PHONE}</p>
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
Dear ${customerName},

This is an official notice that your B2B wholesale ordering account for ${businessName} has been disabled by an administrator.

Account Details:
- Business: ${businessName}
- Contact Person: ${customerName}
- Status: Disabled / Inactive
${reason ? `\nReason: ${reason}\n` : ''}
While disabled, your account is prevented from placing new wholesale orders or logging into the mobile application.

To request reactivation or for questions, contact our support team:
Email: ${ENV.SUPPORT_EMAIL}
Phone: ${ENV.SUPPORT_PHONE}

Necessity India Pvt. Ltd.
    `.trim();

    try {
      const info = await transporter.sendMail({
        from: ENV.SMTP_FROM,
        to,
        subject: 'Your B2B Account Has Been Disabled',
        text: textContent,
        html: htmlContent,
      });

      logger.info(`[EmailService] Account disabled email successfully sent to ${to} (MessageId: ${info.messageId})`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      logger.error(`[EmailService] Failed to send account disabled email to ${to}: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send B2B customer account enabled notification email
   */
  static async sendAccountEnabledEmail(params: SendAccountEnabledEmailParams): Promise<EmailSendResult> {
    const { to, customerName, businessName } = params;

    const transporter = this.getTransporter();
    if (!transporter) {
      logger.info(
        `[EmailService] SMTP not configured. Skipped sending account enabled email to ${to} (${businessName}).`
      );
      return {
        success: false,
        skipped: true,
        error: 'SMTP provider is not configured. Email notification skipped.',
      };
    }

    const appLoginUrl = ENV.CLIENT_WEB_URL ? `${ENV.CLIENT_WEB_URL}/login` : '';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your B2B Account Has Been Enabled</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 20px; color: #334155; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { background: #047857; padding: 32px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0 0 8px 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { margin: 0; font-size: 14px; opacity: 0.9; }
    .content { padding: 32px 24px; }
    .greeting { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 16px; }
    .badge { display: inline-block; background: #ecfdf5; color: #047857; font-weight: 700; font-size: 13px; padding: 4px 12px; border-radius: 9999px; border: 1px solid #a7f3d0; margin-bottom: 20px; }
    .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
    .info-table td { padding: 12px 16px; font-size: 14px; border-bottom: 1px solid #e2e8f0; }
    .info-table td.label { font-weight: 600; color: #64748b; width: 40%; }
    .info-table td.value { font-weight: 700; color: #0f172a; }
    .instructions { background: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; border-radius: 4px; margin: 24px 0; }
    .instructions h3 { margin: 0 0 8px 0; font-size: 15px; color: #065f46; }
    .instructions p { margin: 0; font-size: 14px; line-height: 1.5; color: #047857; }
    .btn-container { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background: #059669; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 28px; border-radius: 8px; }
    .footer { background: #f8fafc; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    .footer a { color: #059669; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>NECESSITY INDIA PVT. LTD.</h1>
      <p>Institutional Supplies & B2B Distribution Management</p>
    </div>
    <div class="content">
      <div class="badge">✓ Account Enabled & Active</div>
      <p class="greeting">Dear ${customerName},</p>
      <p>We are pleased to inform you that your B2B wholesale ordering account for <strong>${businessName}</strong> has been enabled and reactivated.</p>
      
      <table class="info-table">
        <tr>
          <td class="label">Business / Shop:</td>
          <td class="value">${businessName}</td>
        </tr>
        <tr>
          <td class="label">Contact Person:</td>
          <td class="value">${customerName}</td>
        </tr>
        <tr>
          <td class="label">Account Status:</td>
          <td class="value" style="color: #059669;">Enabled (Active)</td>
        </tr>
      </table>

      <div class="instructions">
        <h3>Wholesale access restored:</h3>
        <p>You can now log in to the <strong>Necessity B2B</strong> mobile app or wholesale portal to view current inventory, tiered institutional pricing, and place wholesale orders.</p>
      </div>

      ${
        appLoginUrl
          ? `<div class="btn-container">
        <a href="${appLoginUrl}" class="btn">Sign In to Wholesale Portal</a>
      </div>`
          : ''
      }
    </div>
    <div class="footer">
      <p><strong>Necessity India Pvt. Ltd.</strong></p>
      <p>Commercial Facilities, Hospitality & Healthcare Supplies</p>
      <p>Support: <a href="mailto:${ENV.SUPPORT_EMAIL}">${ENV.SUPPORT_EMAIL}</a> | Phone: ${ENV.SUPPORT_PHONE}</p>
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
Dear ${customerName},

We are pleased to inform you that your B2B wholesale ordering account for ${businessName} has been enabled and reactivated.

Account Details:
- Business: ${businessName}
- Contact Person: ${customerName}
- Status: Enabled (Active)

Wholesale access has been restored. You can now log in to the Necessity B2B mobile app or web portal to place orders.
${appLoginUrl ? `\nPortal Link: ${appLoginUrl}` : ''}

Support Contact:
Email: ${ENV.SUPPORT_EMAIL}
Phone: ${ENV.SUPPORT_PHONE}

Necessity India Pvt. Ltd.
    `.trim();

    try {
      const info = await transporter.sendMail({
        from: ENV.SMTP_FROM,
        to,
        subject: 'Your B2B Account Has Been Enabled',
        text: textContent,
        html: htmlContent,
      });

      logger.info(`[EmailService] Account enabled email successfully sent to ${to} (MessageId: ${info.messageId})`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      logger.error(`[EmailService] Failed to send account enabled email to ${to}: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // =========================================================================
  // ORDER STATUS EMAIL NOTIFICATIONS
  // =========================================================================

  private static formatCurrency(paise: number): string {
    return formatPaiseToINR(paise);
  }

  private static formatDate(date: Date | string | undefined): string {
    if (!date) return '—';
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Internal reusable HTML template builder for all Order Status emails
   */
  private static buildOrderStatusHtml(
    params: SendOrderStatusEmailParams,
    config: {
      headerTitle: string;
      badgeText: string;
      badgeBg: string;
      badgeBorder: string;
      badgeColor: string;
      headline: string;
      message: string;
      showDispatchDetails?: boolean;
      showPickupDetails?: boolean;
    }
  ): string {
    const {
      customerName,
      businessName,
      orderNumber,
      orderDate,
      items,
      subtotalPaise,
      totalGstPaise,
      deliveryFeePaise,
      grandTotalPaise,
      paymentMethod,
      deliveryAddress,
      dispatchDetails,
      pickupDetails,
    } = params;

    const formattedPayment = paymentMethod ? paymentMethod.replace(/_/g, ' ').toUpperCase() : 'B2B ACCOUNT';
    const addressString = deliveryAddress
      ? `${deliveryAddress.street}, ${deliveryAddress.city}, ${deliveryAddress.state} - ${deliveryAddress.pincode}`
      : 'Registered Business Address';

    const itemsHtml = items
      .map(
        (item, index) => `
      <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#fcfcfd'};">
        <td style="padding: 10px 12px; font-size: 13px; color: #1e293b; border-bottom: 1px solid #f1f5f9; font-weight: 600;">
          ${item.productName}
          <div style="font-size: 11px; color: #64748b; font-family: monospace; font-weight: normal; margin-top: 2px;">SKU: ${item.sku}</div>
        </td>
        <td style="padding: 10px 12px; font-size: 13px; color: #1e293b; border-bottom: 1px solid #f1f5f9; text-align: center; font-weight: bold;">
          ${item.quantity}
        </td>
        <td style="padding: 10px 12px; font-size: 13px; color: #475569; border-bottom: 1px solid #f1f5f9; text-align: right;">
          ${this.formatCurrency(item.unitPricePaise)}
        </td>
        <td style="padding: 10px 12px; font-size: 13px; color: #0f172a; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 700;">
          ${this.formatCurrency(item.lineTotalPaise)}
        </td>
      </tr>
    `
      )
      .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.headerTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px 12px; color: #334155; }
    .card { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .top-accent { background: #F47732; height: 6px; width: 100%; }
    .header { padding: 28px 24px 20px; text-align: center; border-bottom: 1px solid #f1f5f9; }
    .company-title { margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
    .company-subtitle { margin: 4px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #F47732; font-weight: 700; }
    .content { padding: 28px 24px; }
    .status-badge { display: inline-block; background: ${config.badgeBg}; border: 1px solid ${config.badgeBorder}; color: ${config.badgeColor}; font-weight: 800; font-size: 12px; padding: 5px 14px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; }
    .headline { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 10px 0; letter-spacing: -0.3px; }
    .message-text { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0; }
    .meta-card { background: #fffaf7; border: 1px solid #fed7aa; border-radius: 10px; padding: 16px; margin-bottom: 24px; }
    .meta-grid { width: 100%; border-collapse: collapse; }
    .meta-label { font-size: 11px; font-weight: 700; color: #9a3412; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 2px; }
    .meta-value { font-size: 13px; font-weight: 600; color: #1e293b; padding-bottom: 10px; }
    .section-title { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin: 0 0 12px 0; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .items-table th { background: #f8fafc; padding: 10px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; border-bottom: 1px solid #e2e8f0; }
    .summary-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; }
    .summary-line { display: flex; justify-content: space-between; font-size: 13px; color: #64748b; margin-bottom: 6px; }
    .summary-line.total { border-top: 1px solid #cbd5e1; padding-top: 10px; margin-top: 10px; font-size: 16px; font-weight: 800; color: #0f172a; }
    .highlight-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; }
    .btn { display: inline-block; background-color: #F47732; color: #ffffff !important; font-size: 13px; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(244, 119, 50, 0.25); }
    .footer { background: #f8fafc; padding: 20px 24px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; line-height: 1.6; }
    .footer a { color: #F47732; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="top-accent"></div>
    <div class="header">
      <h1 class="company-title">NECESSITY INDIA</h1>
      <p class="company-subtitle">B2B Wholesale & Distribution</p>
    </div>

    <div class="content">
      <div style="text-align: left;">
        <span class="status-badge">${config.badgeText}</span>
      </div>

      <h2 class="headline">${config.headline}</h2>
      <p class="message-text">Dear <strong>${customerName || businessName}</strong>,<br>${config.message}</p>

      <!-- Order Metadata Summary -->
      <div class="meta-card">
        <table class="meta-grid">
          <tr>
            <td style="width: 50%;">
              <div class="meta-label">Order Number</div>
              <div class="meta-value" style="font-family: monospace; font-size: 14px; color: #F47732;">${orderNumber}</div>
            </td>
            <td style="width: 50%;">
              <div class="meta-label">Order Date</div>
              <div class="meta-value">${this.formatDate(orderDate)}</div>
            </td>
          </tr>
          <tr>
            <td>
              <div class="meta-label">Customer / Business</div>
              <div class="meta-value">${businessName}</div>
            </td>
            <td>
              <div class="meta-label">Payment Instrument</div>
              <div class="meta-value">${formattedPayment}</div>
            </td>
          </tr>
          <tr>
            <td colspan="2">
              <div class="meta-label">Delivery Destination</div>
              <div class="meta-value" style="padding-bottom: 0;">${addressString}</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Specific Dispatch Tracking Box -->
      ${
        config.showDispatchDetails && dispatchDetails
          ? `
      <div class="highlight-box">
        <div style="font-size: 12px; font-weight: 800; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
          🚚 Consignment & Dispatch Details
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          ${
            dispatchDetails.courierName
              ? `<tr><td style="color: #64748b; padding: 3px 0; width: 140px;">Courier / Transport:</td><td style="font-weight: 700; color: #1e293b;">${dispatchDetails.courierName}</td></tr>`
              : ''
          }
          ${
            dispatchDetails.trackingNumber
              ? `<tr><td style="color: #64748b; padding: 3px 0;">Tracking / Docket No:</td><td style="font-weight: 700; font-family: monospace; color: #F47732;">${dispatchDetails.trackingNumber}</td></tr>`
              : ''
          }
          ${
            dispatchDetails.dispatchedAt
              ? `<tr><td style="color: #64748b; padding: 3px 0;">Dispatched At:</td><td style="color: #1e293b;">${this.formatDate(dispatchDetails.dispatchedAt)}</td></tr>`
              : ''
          }
          ${
            dispatchDetails.transportDetails
              ? `<tr><td style="color: #64748b; padding: 3px 0;">Notes / Waybill:</td><td style="color: #1e293b;">${dispatchDetails.transportDetails}</td></tr>`
              : ''
          }
        </table>
        ${
          dispatchDetails.trackingUrl
            ? `
        <div style="margin-top: 14px; text-align: left;">
          <a href="${dispatchDetails.trackingUrl}" class="btn" target="_blank" rel="noopener noreferrer">
            Track Consignment Live &rarr;
          </a>
        </div>
        `
            : ''
        }
      </div>
      `
          : ''
      }

      <!-- Specific Picked Up Details Box -->
      ${
        config.showPickupDetails && pickupDetails
          ? `
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px;">
        <div style="font-size: 12px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
          📦 Pickup & Collection Record
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          ${
            pickupDetails.pickedUpAt
              ? `<tr><td style="color: #64748b; padding: 3px 0; width: 140px;">Pickup Date & Time:</td><td style="font-weight: 700; color: #1e293b;">${this.formatDate(pickupDetails.pickedUpAt)}</td></tr>`
              : ''
          }
          ${
            pickupDetails.pickupLocation
              ? `<tr><td style="color: #64748b; padding: 3px 0;">Pickup Location:</td><td style="color: #1e293b;">${pickupDetails.pickupLocation}</td></tr>`
              : `<tr><td style="color: #64748b; padding: 3px 0;">Pickup Location:</td><td style="color: #1e293b;">Necessity Central Warehouse</td></tr>`
          }
          ${
            pickupDetails.collectedBy
              ? `<tr><td style="color: #64748b; padding: 3px 0;">Collected By:</td><td style="font-weight: 600; color: #1e293b;">${pickupDetails.collectedBy}</td></tr>`
              : ''
          }
          ${
            pickupDetails.notes
              ? `<tr><td style="color: #64748b; padding: 3px 0;">Gate Pass / Notes:</td><td style="color: #1e293b;">${pickupDetails.notes}</td></tr>`
              : ''
          }
        </table>
      </div>
      `
          : ''
      }

      <!-- Ordered Items Snapshot -->
      <div class="section-title">Ordered Line Items (${items.length} ${items.length === 1 ? 'Product' : 'Products'})</div>
      <table class="items-table">
        <thead>
          <tr>
            <th style="text-align: left;">Product Item</th>
            <th style="text-align: center; width: 60px;">Qty</th>
            <th style="text-align: right; width: 90px;">Unit Rate</th>
            <th style="text-align: right; width: 100px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <!-- Financial Summary Box -->
      <div class="summary-box">
        <div class="summary-line">
          <span>Items Taxable Subtotal:</span>
          <span style="font-weight: 600; color: #1e293b;">${this.formatCurrency(subtotalPaise)}</span>
        </div>
        ${
          totalGstPaise > 0
            ? `
        <div class="summary-line">
          <span>Applicable GST (Taxes):</span>
          <span style="font-weight: 600; color: #1e293b;">${this.formatCurrency(totalGstPaise)}</span>
        </div>
        `
            : ''
        }
        <div class="summary-line">
          <span>Commercial Shipping & Handling:</span>
          <span style="font-weight: 600; color: #059669;">${deliveryFeePaise > 0 ? this.formatCurrency(deliveryFeePaise) : 'FREE'}</span>
        </div>
        <div class="summary-line total">
          <span>Order Grand Total:</span>
          <span style="color: #F47732;">${this.formatCurrency(grandTotalPaise)}</span>
        </div>
      </div>
    </div>

    <!-- Footer Support Contact -->
    <div class="footer">
      <p style="margin: 0 0 6px 0;"><strong>${ENV.COMPANY_NAME}</strong></p>
      <p style="margin: 0 0 6px 0;">${ENV.COMPANY_ADDRESS}</p>
      <p style="margin: 0;">
        Customer Support: <a href="mailto:${ENV.SUPPORT_EMAIL}">${ENV.SUPPORT_EMAIL}</a> | Phone: ${ENV.SUPPORT_PHONE}
      </p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Internal reusable plain-text template generator for email clients without HTML support
   */
  private static buildOrderStatusText(
    params: SendOrderStatusEmailParams,
    config: {
      headline: string;
      message: string;
      showDispatchDetails?: boolean;
      showPickupDetails?: boolean;
    }
  ): string {
    const {
      customerName,
      businessName,
      orderNumber,
      orderDate,
      items,
      subtotalPaise,
      totalGstPaise,
      grandTotalPaise,
      dispatchDetails,
      pickupDetails,
    } = params;

    let itemsList = items
      .map((it) => `- ${it.productName} (SKU: ${it.sku}) x ${it.quantity} @ ${this.formatCurrency(it.unitPricePaise)} = ${this.formatCurrency(it.lineTotalPaise)}`)
      .join('\n');

    let extraDetails = '';
    if (config.showDispatchDetails && dispatchDetails) {
      extraDetails += `\nDISPATCH & TRACKING DETAILS:\n`;
      if (dispatchDetails.courierName) extraDetails += `- Courier/Transporter: ${dispatchDetails.courierName}\n`;
      if (dispatchDetails.trackingNumber) extraDetails += `- Tracking Number: ${dispatchDetails.trackingNumber}\n`;
      if (dispatchDetails.dispatchedAt) extraDetails += `- Dispatched Date: ${this.formatDate(dispatchDetails.dispatchedAt)}\n`;
      if (dispatchDetails.trackingUrl) extraDetails += `- Tracking Link: ${dispatchDetails.trackingUrl}\n`;
    }

    if (config.showPickupDetails && pickupDetails) {
      extraDetails += `\nPICKUP & COLLECTION DETAILS:\n`;
      if (pickupDetails.pickedUpAt) extraDetails += `- Pickup Time: ${this.formatDate(pickupDetails.pickedUpAt)}\n`;
      if (pickupDetails.pickupLocation) extraDetails += `- Location: ${pickupDetails.pickupLocation}\n`;
      if (pickupDetails.collectedBy) extraDetails += `- Collected By: ${pickupDetails.collectedBy}\n`;
    }

    return `
NECESSITY INDIA - B2B WHOLESALE & DISTRIBUTION
=====================================================

${config.headline}

Dear ${customerName || businessName},

${config.message}

ORDER DETAILS:
- Order Number: ${orderNumber}
- Order Date: ${this.formatDate(orderDate)}
- Business: ${businessName}
${extraDetails}
ORDERED PRODUCTS:
${itemsList}

FINANCIAL SUMMARY:
- Taxable Subtotal: ${this.formatCurrency(subtotalPaise)}
- Taxes (GST): ${this.formatCurrency(totalGstPaise)}
- Total Amount: ${this.formatCurrency(grandTotalPaise)}

Support Contacts:
- Email: ${ENV.SUPPORT_EMAIL}
- Phone: ${ENV.SUPPORT_PHONE}
- Address: ${ENV.COMPANY_ADDRESS}

Necessity India Pvt. Ltd.
    `.trim();
  }

  /**
   * 1.A: Send "Order Placed - Pending" email
   */
  static async sendOrderPlacedEmail(params: SendOrderStatusEmailParams): Promise<EmailSendResult> {
    const transporter = this.getTransporter();
    if (!transporter) {
      logger.info(`[EmailService] SMTP not configured. Skipped sending Order Placed email for order ${params.orderNumber} to ${params.to}.`);
      return {
        success: false,
        skipped: true,
        error: 'SMTP provider is not configured. Email notification skipped.',
      };
    }

    const htmlContent = this.buildOrderStatusHtml(params, {
      headerTitle: 'Your Order Has Been Placed – Necessity India',
      badgeText: 'Status: Pending Approval',
      badgeBg: '#fff7ed',
      badgeBorder: '#fed7aa',
      badgeColor: '#c2410c',
      headline: 'Your Wholesale Order Has Been Placed',
      message: 'Thank you for placing your wholesale order with Necessity India. Your order has been successfully registered in our platform and is currently awaiting administrative approval.',
    });

    const textContent = this.buildOrderStatusText(params, {
      headline: 'Your Wholesale Order Has Been Placed (Pending)',
      message: 'Thank you for placing your wholesale order with Necessity India. Your order has been successfully registered in our platform and is currently awaiting administrative approval.',
    });

    try {
      const info = await transporter.sendMail({
        from: ENV.SMTP_FROM,
        to: params.to,
        subject: 'Your Order Has Been Placed – Necessity India',
        text: textContent,
        html: htmlContent,
      });

      logger.info(`[EmailService] Order Placed email sent to ${params.to} for order ${params.orderNumber} (MessageId: ${info.messageId})`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      logger.error(`[EmailService] Failed to send Order Placed email for order ${params.orderNumber} to ${params.to}: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 1.B: Send "Order Approved" email
   */
  static async sendOrderApprovedEmail(params: SendOrderStatusEmailParams): Promise<EmailSendResult> {
    const transporter = this.getTransporter();
    if (!transporter) {
      logger.info(`[EmailService] SMTP not configured. Skipped sending Order Approved email for order ${params.orderNumber} to ${params.to}.`);
      return {
        success: false,
        skipped: true,
        error: 'SMTP provider is not configured. Email notification skipped.',
      };
    }

    const htmlContent = this.buildOrderStatusHtml(params, {
      headerTitle: 'Your Order Has Been Approved – Necessity India',
      badgeText: 'Status: Approved',
      badgeBg: '#f0fdf4',
      badgeBorder: '#bbf7d0',
      badgeColor: '#15803d',
      headline: 'Your Order Has Been Approved',
      message: 'We are pleased to inform you that your wholesale order has been approved by our accounts & sales team. Your order will now proceed to our warehouse fulfillment team for picking, packing, and dispatch preparation.',
    });

    const textContent = this.buildOrderStatusText(params, {
      headline: 'Your Order Has Been Approved',
      message: 'We are pleased to inform you that your wholesale order has been approved by our accounts & sales team. Your order will now proceed to our warehouse fulfillment team for picking, packing, and dispatch preparation.',
    });

    try {
      const info = await transporter.sendMail({
        from: ENV.SMTP_FROM,
        to: params.to,
        subject: 'Your Order Has Been Approved – Necessity India',
        text: textContent,
        html: htmlContent,
      });

      logger.info(`[EmailService] Order Approved email sent to ${params.to} for order ${params.orderNumber} (MessageId: ${info.messageId})`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      logger.error(`[EmailService] Failed to send Order Approved email for order ${params.orderNumber} to ${params.to}: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 1.C: Send "Order Dispatched" email
   */
  static async sendOrderDispatchedEmail(params: SendOrderStatusEmailParams): Promise<EmailSendResult> {
    const transporter = this.getTransporter();
    if (!transporter) {
      logger.info(`[EmailService] SMTP not configured. Skipped sending Order Dispatched email for order ${params.orderNumber} to ${params.to}.`);
      return {
        success: false,
        skipped: true,
        error: 'SMTP provider is not configured. Email notification skipped.',
      };
    }

    const htmlContent = this.buildOrderStatusHtml(params, {
      headerTitle: 'Your Order Has Been Dispatched – Necessity India',
      badgeText: 'Status: Dispatched',
      badgeBg: '#eef2ff',
      badgeBorder: '#c7d2fe',
      badgeColor: '#4338ca',
      headline: 'Your Order Is On Its Way',
      message: 'Great news! Your wholesale order has been inspected, packed, and dispatched from our warehouse facility. It is now on its way to your designated destination.',
      showDispatchDetails: true,
    });

    const textContent = this.buildOrderStatusText(params, {
      headline: 'Your Order Has Been Dispatched',
      message: 'Great news! Your wholesale order has been inspected, packed, and dispatched from our warehouse facility. It is now on its way to your designated destination.',
      showDispatchDetails: true,
    });

    try {
      const info = await transporter.sendMail({
        from: ENV.SMTP_FROM,
        to: params.to,
        subject: 'Your Order Has Been Dispatched – Necessity India',
        text: textContent,
        html: htmlContent,
      });

      logger.info(`[EmailService] Order Dispatched email sent to ${params.to} for order ${params.orderNumber} (MessageId: ${info.messageId})`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      logger.error(`[EmailService] Failed to send Order Dispatched email for order ${params.orderNumber} to ${params.to}: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 1.D: Send "Order Picked Up" email
   */
  static async sendOrderPickedUpEmail(params: SendOrderStatusEmailParams): Promise<EmailSendResult> {
    const transporter = this.getTransporter();
    if (!transporter) {
      logger.info(`[EmailService] SMTP not configured. Skipped sending Order Picked Up email for order ${params.orderNumber} to ${params.to}.`);
      return {
        success: false,
        skipped: true,
        error: 'SMTP provider is not configured. Email notification skipped.',
      };
    }

    const htmlContent = this.buildOrderStatusHtml(params, {
      headerTitle: 'Your Order Has Been Picked Up – Necessity India',
      badgeText: 'Status: Picked Up',
      badgeBg: '#ecfdf5',
      badgeBorder: '#a7f3d0',
      badgeColor: '#047857',
      headline: 'Your Order Has Been Picked Up',
      message: 'This is to confirm that your wholesale order has been successfully picked up and collected. The order fulfillment cycle for this consignment is now complete.',
      showPickupDetails: true,
    });

    const textContent = this.buildOrderStatusText(params, {
      headline: 'Your Order Has Been Picked Up',
      message: 'This is to confirm that your wholesale order has been successfully picked up and collected. The order fulfillment cycle for this consignment is now complete.',
      showPickupDetails: true,
    });

    try {
      const info = await transporter.sendMail({
        from: ENV.SMTP_FROM,
        to: params.to,
        subject: 'Your Order Has Been Picked Up – Necessity India',
        text: textContent,
        html: htmlContent,
      });

      logger.info(`[EmailService] Order Picked Up email sent to ${params.to} for order ${params.orderNumber} (MessageId: ${info.messageId})`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      logger.error(`[EmailService] Failed to send Order Picked Up email for order ${params.orderNumber} to ${params.to}: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 1.E: Send "Order Processing" email
   */
  static async sendOrderProcessingEmail(params: SendOrderStatusEmailParams): Promise<EmailSendResult> {
    const transporter = this.getTransporter();
    if (!transporter) {
      logger.info(`[EmailService] SMTP not configured. Skipped sending Order Processing email for order ${params.orderNumber} to ${params.to}.`);
      return {
        success: false,
        skipped: true,
        error: 'SMTP provider is not configured. Email notification skipped.',
      };
    }

    const htmlContent = this.buildOrderStatusHtml(params, {
      headerTitle: 'Your Order Is Being Processed – Necessity India',
      badgeText: 'Status: In Processing',
      badgeBg: '#eff6ff',
      badgeBorder: '#bfdbfe',
      badgeColor: '#1d4ed8',
      headline: 'Your Wholesale Order Is Being Prepared',
      message: 'Your order is currently being picked and packed at our warehouse fulfillment facility. You will receive dispatch and tracking details once shipment is initiated.',
    });

    const textContent = this.buildOrderStatusText(params, {
      headline: 'Your Wholesale Order Is Being Prepared',
      message: 'Your order is currently being picked and packed at our warehouse fulfillment facility. You will receive dispatch and tracking details once shipment is initiated.',
    });

    try {
      const info = await transporter.sendMail({
        from: ENV.SMTP_FROM,
        to: params.to,
        subject: 'Your Order Is Being Processed – Necessity India',
        text: textContent,
        html: htmlContent,
      });

      logger.info(`[EmailService] Order Processing email sent to ${params.to} for order ${params.orderNumber} (MessageId: ${info.messageId})`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      logger.error(`[EmailService] Failed to send Order Processing email for order ${params.orderNumber} to ${params.to}: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 1.F: Send "Order Delivered" email
   */
  static async sendOrderDeliveredEmail(params: SendOrderStatusEmailParams): Promise<EmailSendResult> {
    const transporter = this.getTransporter();
    if (!transporter) {
      logger.info(`[EmailService] SMTP not configured. Skipped sending Order Delivered email for order ${params.orderNumber} to ${params.to}.`);
      return {
        success: false,
        skipped: true,
        error: 'SMTP provider is not configured. Email notification skipped.',
      };
    }

    const htmlContent = this.buildOrderStatusHtml(params, {
      headerTitle: 'Your Order Has Been Delivered – Necessity India',
      badgeText: 'Status: Delivered',
      badgeBg: '#ecfdf5',
      badgeBorder: '#a7f3d0',
      badgeColor: '#047857',
      headline: 'Consignment Delivered Successfully',
      message: 'We are pleased to inform you that your wholesale consignment has been delivered to your facility address. Thank you for doing business with Necessity India.',
    });

    const textContent = this.buildOrderStatusText(params, {
      headline: 'Consignment Delivered Successfully',
      message: 'We are pleased to inform you that your wholesale consignment has been delivered to your facility address. Thank you for doing business with Necessity India.',
    });

    try {
      const info = await transporter.sendMail({
        from: ENV.SMTP_FROM,
        to: params.to,
        subject: 'Your Order Has Been Delivered – Necessity India',
        text: textContent,
        html: htmlContent,
      });

      logger.info(`[EmailService] Order Delivered email sent to ${params.to} for order ${params.orderNumber} (MessageId: ${info.messageId})`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      logger.error(`[EmailService] Failed to send Order Delivered email for order ${params.orderNumber} to ${params.to}: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 1.G: Send "Order Rejected" email
   */
  static async sendOrderRejectedEmail(params: SendOrderStatusEmailParams): Promise<EmailSendResult> {
    const transporter = this.getTransporter();
    if (!transporter) {
      logger.info(`[EmailService] SMTP not configured. Skipped sending Order Rejected email for order ${params.orderNumber} to ${params.to}.`);
      return {
        success: false,
        skipped: true,
        error: 'SMTP provider is not configured. Email notification skipped.',
      };
    }

    const htmlContent = this.buildOrderStatusHtml(params, {
      headerTitle: 'Order Update – Necessity India',
      badgeText: 'Status: Rejected',
      badgeBg: '#fef2f2',
      badgeBorder: '#fecaca',
      badgeColor: '#b91c1c',
      headline: 'Order Status Update',
      message: `Your wholesale order could not be approved at this time.${params.reason ? ` Reason: ${params.reason}` : ''} Please contact your sales representative or accounts manager for assistance.`,
    });

    const textContent = this.buildOrderStatusText(params, {
      headline: 'Order Status Update (Rejected)',
      message: `Your wholesale order could not be approved at this time.${params.reason ? ` Reason: ${params.reason}` : ''} Please contact your sales representative or accounts manager for assistance.`,
    });

    try {
      const info = await transporter.sendMail({
        from: ENV.SMTP_FROM,
        to: params.to,
        subject: 'Order Update: Order Rejected – Necessity India',
        text: textContent,
        html: htmlContent,
      });

      logger.info(`[EmailService] Order Rejected email sent to ${params.to} for order ${params.orderNumber} (MessageId: ${info.messageId})`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      logger.error(`[EmailService] Failed to send Order Rejected email for order ${params.orderNumber} to ${params.to}: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 1.H: Send "Payment Received" (Full or Partial) email
   */
  static async sendPaymentReceivedEmail(params: SendPaymentReceivedEmailParams): Promise<EmailSendResult> {
    const transporter = this.getTransporter();
    if (!transporter) {
      logger.info(`[EmailService] SMTP not configured. Skipped sending Payment Received email for order ${params.orderNumber} to ${params.to}.`);
      return {
        success: false,
        skipped: true,
        error: 'SMTP provider is not configured. Email notification skipped.',
      };
    }

    const statusTitle = params.isPartial ? 'Partial Payment Received' : 'Payment Received in Full';
    const badgeBg = params.isPartial ? '#fffbeb' : '#f0fdf4';
    const badgeBorder = params.isPartial ? '#fde68a' : '#bbf7d0';
    const badgeColor = params.isPartial ? '#b45309' : '#15803d';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${statusTitle} – Necessity India</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .container { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #252525; padding: 24px 28px; text-align: left; border-bottom: 3px solid #F47721; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
    .header p { margin: 4px 0 0; font-size: 12px; color: #94a3b8; }
    .body-content { padding: 28px; }
    .badge { display: inline-block; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; background-color: ${badgeBg}; border: 1px solid ${badgeBorder}; color: ${badgeColor}; }
    .headline { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 8px; }
    .subtext { font-size: 14px; color: #475569; line-height: 1.5; margin-bottom: 24px; }
    .receipt-box { background: #fffaf5; border: 1px solid #fed7aa; border-radius: 10px; padding: 18px; margin-bottom: 24px; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px dashed #fdba74; }
    .row:last-child { border-bottom: none; }
    .label { color: #64748b; font-weight: 500; }
    .val { color: #0f172a; font-weight: 700; }
    .footer { background: #f8fafc; padding: 20px 28px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Necessity India</h1>
      <p>Institutional Wholesale & Facility Supplies</p>
    </div>
    <div class="body-content">
      <div class="badge">${statusTitle}</div>
      <h2 class="headline">Payment Recorded & Verified</h2>
      <p class="subtext">
        Dear <strong>${params.customerName}</strong> (${params.businessName}),<br/>
        This email confirms that an offline payment has been verified and recorded by our accounts department for Order <strong>#${params.orderNumber}</strong>.
      </p>

      <table style="width: 100%; border-collapse: collapse; background: #fffaf5; border: 1px solid #fed7aa; border-radius: 10px; margin-bottom: 24px;">
        <tr>
          <td style="padding: 10px 14px; font-size: 13px; color: #64748b; border-bottom: 1px dashed #fed7aa;">Amount Received:</td>
          <td style="padding: 10px 14px; font-size: 15px; color: #ea580c; font-weight: 800; text-align: right; border-bottom: 1px dashed #fed7aa;">${formatPaiseToINR(params.amountPaidPaise)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 14px; font-size: 13px; color: #64748b; border-bottom: 1px dashed #fed7aa;">Payment Method:</td>
          <td style="padding: 8px 14px; font-size: 13px; color: #0f172a; font-weight: 700; text-align: right; border-bottom: 1px dashed #fed7aa;">${params.paymentMethod}</td>
        </tr>
        <tr>
          <td style="padding: 8px 14px; font-size: 13px; color: #64748b; border-bottom: 1px dashed #fed7aa;">Reference / UTR:</td>
          <td style="padding: 8px 14px; font-size: 13px; font-family: monospace; color: #0f172a; font-weight: 700; text-align: right; border-bottom: 1px dashed #fed7aa;">${params.referenceNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 14px; font-size: 13px; color: #64748b; border-bottom: 1px dashed #fed7aa;">Total Order Amount:</td>
          <td style="padding: 8px 14px; font-size: 13px; color: #0f172a; font-weight: 600; text-align: right; border-bottom: 1px dashed #fed7aa;">${formatPaiseToINR(params.grandTotalPaise)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 14px; font-size: 13px; color: #64748b; border-bottom: 1px dashed #fed7aa;">Cumulative Amount Paid:</td>
          <td style="padding: 8px 14px; font-size: 13px; color: #15803d; font-weight: 700; text-align: right; border-bottom: 1px dashed #fed7aa;">${formatPaiseToINR(params.totalPaidPaise)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; font-size: 13px; color: #0f172a; font-weight: 800;">Remaining Balance:</td>
          <td style="padding: 10px 14px; font-size: 14px; color: ${params.remainingBalancePaise > 0 ? '#b91c1c' : '#15803d'}; font-weight: 800; text-align: right;">${formatPaiseToINR(params.remainingBalancePaise)}</td>
        </tr>
      </table>

      ${params.notes ? `<p style="font-size: 12px; color: #64748b; font-style: italic;">Note: ${params.notes}</p>` : ''}

      <p style="font-size: 13px; color: #475569; margin-top: 20px;">
        You can log in to the <strong>Necessity B2B</strong> mobile app anytime to view updated balance and complete payment records.
      </p>
    </div>
    <div class="footer">
      <p><strong>Necessity India Pvt. Ltd.</strong></p>
      <p>Commercial Facilities, Hospitality & Healthcare Supplies</p>
      <p>Support: <a href="mailto:${ENV.SUPPORT_EMAIL}" style="color: #F47721; text-decoration: none;">${ENV.SUPPORT_EMAIL}</a> | Phone: ${ENV.SUPPORT_PHONE}</p>
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
${statusTitle} – Necessity India
Order: #${params.orderNumber}
Customer: ${params.customerName} (${params.businessName})

Amount Received: ${formatPaiseToINR(params.amountPaidPaise)}
Payment Method: ${params.paymentMethod}
Reference: ${params.referenceNumber}
Total Order Value: ${formatPaiseToINR(params.grandTotalPaise)}
Total Paid to Date: ${formatPaiseToINR(params.totalPaidPaise)}
Remaining Balance Due: ${formatPaiseToINR(params.remainingBalancePaise)}
${params.notes ? `Note: ${params.notes}\n` : ''}
Thank you for your payment.
Necessity India Pvt. Ltd.
    `;

    try {
      const info = await transporter.sendMail({
        from: ENV.SMTP_FROM,
        to: params.to,
        subject: `${statusTitle} for Order #${params.orderNumber} – Necessity India`,
        text: textContent,
        html: htmlContent,
      });

      logger.info(`[EmailService] Payment Received email sent to ${params.to} for order ${params.orderNumber} (MessageId: ${info.messageId})`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      logger.error(`[EmailService] Failed to send Payment Received email for order ${params.orderNumber} to ${params.to}: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 1.I: Send "Payment Unsuccessful / Failed" email
   */
  static async sendPaymentFailedEmail(params: SendPaymentFailedEmailParams): Promise<EmailSendResult> {
    const transporter = this.getTransporter();
    if (!transporter) {
      logger.info(`[EmailService] SMTP not configured. Skipped sending Payment Failed email for order ${params.orderNumber} to ${params.to}.`);
      return {
        success: false,
        skipped: true,
        error: 'SMTP provider is not configured. Email notification skipped.',
      };
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Unsuccessful – Necessity India</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .container { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #252525; padding: 24px 28px; text-align: left; border-bottom: 3px solid #dc2626; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
    .header p { margin: 4px 0 0; font-size: 12px; color: #94a3b8; }
    .body-content { padding: 28px; }
    .badge { display: inline-block; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; background-color: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; }
    .headline { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 8px; }
    .subtext { font-size: 14px; color: #475569; line-height: 1.5; margin-bottom: 24px; }
    .footer { background: #f8fafc; padding: 20px 28px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Necessity India</h1>
      <p>Institutional Wholesale & Facility Supplies</p>
    </div>
    <div class="body-content">
      <div class="badge">Payment Unsuccessful</div>
      <h2 class="headline">Payment Transaction Not Completed</h2>
      <p class="subtext">
        Dear <strong>${params.customerName}</strong> (${params.businessName}),<br/>
        We were unable to process your payment for Order <strong>#${params.orderNumber}</strong>. No funds have been settled for this transaction.
      </p>

      <table style="width: 100%; border-collapse: collapse; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; margin-bottom: 24px;">
        <tr>
          <td style="padding: 10px 14px; font-size: 13px; color: #64748b; border-bottom: 1px dashed #fca5a5;">Order Number:</td>
          <td style="padding: 10px 14px; font-size: 14px; color: #0f172a; font-weight: 700; text-align: right; border-bottom: 1px dashed #fca5a5;">#${params.orderNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 14px; font-size: 13px; color: #64748b; border-bottom: 1px dashed #fca5a5;">Attempted Amount:</td>
          <td style="padding: 8px 14px; font-size: 14px; color: #b91c1c; font-weight: 800; text-align: right; border-bottom: 1px dashed #fca5a5;">${formatPaiseToINR(params.amountPaise)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 14px; font-size: 13px; color: #64748b; border-bottom: 1px dashed #fca5a5;">Payment Method:</td>
          <td style="padding: 8px 14px; font-size: 13px; color: #0f172a; font-weight: 700; text-align: right; border-bottom: 1px dashed #fca5a5;">${params.paymentMethod}</td>
        </tr>
        ${params.referenceNumber ? `
        <tr>
          <td style="padding: 8px 14px; font-size: 13px; color: #64748b; border-bottom: 1px dashed #fca5a5;">Reference / Ref ID:</td>
          <td style="padding: 8px 14px; font-size: 13px; font-family: monospace; color: #0f172a; font-weight: 700; text-align: right; border-bottom: 1px dashed #fca5a5;">${params.referenceNumber}</td>
        </tr>` : ''}
        ${params.reason ? `
        <tr>
          <td style="padding: 10px 14px; font-size: 13px; color: #64748b;">Reason / Status:</td>
          <td style="padding: 10px 14px; font-size: 13px; color: #b91c1c; font-weight: 700; text-align: right;">${params.reason}</td>
        </tr>` : ''}
      </table>

      <p style="font-size: 13px; color: #475569; margin-top: 20px;">
        Your order is safely preserved. You can open the <strong>Necessity B2B</strong> mobile app, go to <strong>Orders</strong>, and tap <strong>Pay Balance via Razorpay</strong> to retry your payment with UPI, Card, or Netbanking.
      </p>
    </div>
    <div class="footer">
      <p><strong>Necessity India Pvt. Ltd.</strong></p>
      <p>Support: <a href="mailto:${ENV.SUPPORT_EMAIL}" style="color: #F47721; text-decoration: none;">${ENV.SUPPORT_EMAIL}</a> | Phone: ${ENV.SUPPORT_PHONE}</p>
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
Payment Unsuccessful – Necessity India
Order: #${params.orderNumber}
Customer: ${params.customerName} (${params.businessName})

Attempted Amount: ${formatPaiseToINR(params.amountPaise)}
Payment Method: ${params.paymentMethod}
${params.referenceNumber ? `Reference: ${params.referenceNumber}\n` : ''}
${params.reason ? `Reason: ${params.reason}\n` : ''}

Your payment was not completed. Your order is safely preserved.
You can log in to the Necessity B2B mobile app anytime and retry payment from Order Details.

Necessity India Pvt. Ltd.
    `;

    try {
      const info = await transporter.sendMail({
        from: ENV.SMTP_FROM,
        to: params.to,
        subject: `Payment Unsuccessful for Order #${params.orderNumber} – Necessity India`,
        text: textContent,
        html: htmlContent,
      });

      logger.info(`[EmailService] Payment Unsuccessful email sent to ${params.to} for order ${params.orderNumber} (MessageId: ${info.messageId})`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      logger.error(`[EmailService] Failed to send Payment Unsuccessful email for order ${params.orderNumber} to ${params.to}: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 1.J: Send "Payment Refund Initiated" email
   */
  static async sendPaymentRefundedEmail(params: SendPaymentRefundedEmailParams): Promise<EmailSendResult> {
    const transporter = this.getTransporter();
    if (!transporter) {
      logger.info(`[EmailService] SMTP not configured. Skipped sending Payment Refund email for order ${params.orderNumber} to ${params.to}.`);
      return {
        success: false,
        skipped: true,
        error: 'SMTP provider is not configured. Email notification skipped.',
      };
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Refund Initiated – Necessity India</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .container { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #252525; padding: 24px 28px; text-align: left; border-bottom: 3px solid #16a34a; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
    .header p { margin: 4px 0 0; font-size: 12px; color: #94a3b8; }
    .body-content { padding: 28px; }
    .badge { display: inline-block; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; background-color: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
    .headline { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 8px; }
    .subtext { font-size: 14px; color: #475569; line-height: 1.5; margin-bottom: 24px; }
    .footer { background: #f8fafc; padding: 20px 28px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Necessity India</h1>
      <p>Institutional Wholesale & Facility Supplies</p>
    </div>
    <div class="body-content">
      <div class="badge">Refund Processed</div>
      <h2 class="headline">Payment Refund Initiated</h2>
      <p class="subtext">
        Dear <strong>${params.customerName}</strong> (${params.businessName}),<br/>
        A refund has been successfully initiated for your wholesale order <strong>#${params.orderNumber}</strong>. The funds are being reversed directly back to your original payment method.
      </p>

      <table style="width: 100%; border-collapse: collapse; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; margin-bottom: 24px;">
        <tr>
          <td style="padding: 10px 14px; font-size: 13px; color: #64748b; border-bottom: 1px dashed #86efac;">Order Number:</td>
          <td style="padding: 10px 14px; font-size: 14px; color: #0f172a; font-weight: 700; text-align: right; border-bottom: 1px dashed #86efac;">#${params.orderNumber}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; font-size: 13px; color: #64748b; border-bottom: 1px dashed #86efac;">Refund Amount:</td>
          <td style="padding: 10px 14px; font-size: 16px; color: #16a34a; font-weight: 800; text-align: right; border-bottom: 1px dashed #86efac;">${formatPaiseToINR(params.amountRefundedPaise)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 14px; font-size: 13px; color: #64748b; border-bottom: 1px dashed #86efac;">Refund Reference / ID:</td>
          <td style="padding: 8px 14px; font-size: 13px; font-family: monospace; color: #0f172a; font-weight: 700; text-align: right; border-bottom: 1px dashed #86efac;">${params.refundId}</td>
        </tr>
        <tr>
          <td style="padding: 8px 14px; font-size: 13px; color: #64748b; border-bottom: 1px dashed #86efac;">Payment Method:</td>
          <td style="padding: 8px 14px; font-size: 13px; color: #0f172a; font-weight: 700; text-align: right; border-bottom: 1px dashed #86efac;">${params.paymentMethod}</td>
        </tr>
        ${params.reason ? `
        <tr>
          <td style="padding: 8px 14px; font-size: 13px; color: #64748b; border-bottom: 1px dashed #86efac;">Cancellation Reason:</td>
          <td style="padding: 8px 14px; font-size: 13px; color: #0f172a; font-weight: 600; text-align: right; border-bottom: 1px dashed #86efac;">${params.reason}</td>
        </tr>` : ''}
        <tr>
          <td style="padding: 10px 14px; font-size: 12px; color: #64748b;">Estimated Credit Time:</td>
          <td style="padding: 10px 14px; font-size: 12px; color: #15803d; font-weight: 700; text-align: right;">UPI: Instant / 24-48 hrs • Cards: 5-7 business days</td>
        </tr>
      </table>

      <p style="font-size: 13px; color: #475569; margin-top: 20px;">
        Depending on your issuing bank or UPI provider, the refunded amount will reflect in your account within the standard banking turnaround time.
      </p>
    </div>
    <div class="footer">
      <p><strong>Necessity India Pvt. Ltd.</strong></p>
      <p>Support: <a href="mailto:${ENV.SUPPORT_EMAIL}" style="color: #F47721; text-decoration: none;">${ENV.SUPPORT_EMAIL}</a> | Phone: ${ENV.SUPPORT_PHONE}</p>
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
Payment Refund Initiated – Necessity India
Order: #${params.orderNumber}
Customer: ${params.customerName} (${params.businessName})

Refund Amount: ${formatPaiseToINR(params.amountRefundedPaise)}
Refund ID: ${params.refundId}
Payment Method: ${params.paymentMethod}
${params.reason ? `Reason: ${params.reason}\n` : ''}
Timeline: UPI is instant to 24-48 hrs; Cards/Netbanking take 5-7 business days depending on your bank.

Necessity India Pvt. Ltd.
    `;

    try {
      const info = await transporter.sendMail({
        from: ENV.SMTP_FROM,
        to: params.to,
        subject: `Payment Refund Initiated for Order #${params.orderNumber} – Necessity India`,
        text: textContent,
        html: htmlContent,
      });

      logger.info(`[EmailService] Payment Refund email sent to ${params.to} for order ${params.orderNumber} (RefundId: ${params.refundId}, MessageId: ${info.messageId})`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      logger.error(`[EmailService] Failed to send Payment Refund email for order ${params.orderNumber} to ${params.to}: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
