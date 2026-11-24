import { ENV } from '../../../config/env';
import { Retailer } from '../../retailers/retailer.model';
import { Product } from '../../products/product.model';
import { Order } from '../../orders/order.model';
import { Invoice } from '../../invoices/invoice.model';
import { auditLogger } from '../../audit/audit.service';
import { ApiError } from '../../../utils/api-error';

export interface ZohoSyncStatus {
  isConfigured: boolean;
  status: 'CONFIGURED_AND_CONNECTED' | 'UNCONFIGURED_MISSING_CREDENTIALS' | 'ERROR';
  environment: string;
  missingKeys: string[];
  lastSyncTimestamp?: string;
  details: string;
}

export class ZohoIntegrationService {
  private cachedAccessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  /**
   * Evaluates configuration status without fabricating live connection.
   */
  getSyncStatus(): ZohoSyncStatus {
    const missingKeys: string[] = [];
    if (!ENV.ZOHO_CLIENT_ID) missingKeys.push('ZOHO_CLIENT_ID');
    if (!ENV.ZOHO_CLIENT_SECRET) missingKeys.push('ZOHO_CLIENT_SECRET');
    if (!ENV.ZOHO_ORGANIZATION_ID) missingKeys.push('ZOHO_ORGANIZATION_ID');

    if (missingKeys.length > 0) {
      return {
        isConfigured: false,
        status: 'UNCONFIGURED_MISSING_CREDENTIALS',
        environment: ENV.NODE_ENV,
        missingKeys,
        details:
          'Zoho integration is not active. Production requires Zoho API OAuth2 credentials in environment variables.',
      };
    }

    return {
      isConfigured: true,
      status: 'CONFIGURED_AND_CONNECTED',
      environment: ENV.NODE_ENV,
      missingKeys: [],
      details: 'Zoho Books and Inventory credentials are configured.',
    };
  }

  /**
   * Refreshes OAuth2 access token with Zoho Accounts server using server-side refresh token.
   */
  async getAccessToken(): Promise<string> {
    const status = this.getSyncStatus();
    if (!status.isConfigured) {
      throw ApiError.badRequest(
        `Zoho integration cannot execute: missing credentials [${status.missingKeys.join(', ')}]. Please configure server environment.`
      );
    }

    const now = Date.now();
    if (this.cachedAccessToken && this.tokenExpiresAt > now + 60000) {
      return this.cachedAccessToken;
    }

    // Call Zoho Accounts OAuth2 token endpoint
    const tokenUrl = `${ENV.ZOHO_ACCOUNTS_URL}/oauth/v2/token`;
    const params = new URLSearchParams({
      refresh_token: process.env.ZOHO_REFRESH_TOKEN || '',
      client_id: ENV.ZOHO_CLIENT_ID,
      client_secret: ENV.ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token',
    });

    try {
      const response = await fetch(`${tokenUrl}?${params.toString()}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Zoho OAuth token refresh failed (${response.status}): ${errText}`);
      }

      const data = (await response.json()) as { access_token: string; expires_in: number };
      if (!data.access_token) {
        throw new Error('Zoho token response did not contain access_token');
      }

      this.cachedAccessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
      return this.cachedAccessToken;
    } catch (err: any) {
      throw ApiError.badRequest(`Zoho OAuth2 authentication error: ${err.message}`);
    }
  }

  /**
   * Syncs Retailer contact details to Zoho Books Contact/Customer.
   */
  async syncRetailerCustomer(retailerId: string): Promise<{ success: boolean; zohoContactId?: string; error?: string }> {
    const retailer = await Retailer.findById(retailerId);
    if (!retailer) {
      throw ApiError.notFound('Retailer profile not found');
    }

    const status = this.getSyncStatus();
    if (!status.isConfigured) {
      return {
        success: false,
        error: `Zoho unconfigured: missing [${status.missingKeys.join(', ')}]`,
      };
    }

    const accessToken = await this.getAccessToken();
    const contactPayload = {
      contact_name: retailer.businessName,
      company_name: retailer.businessName,
      contact_type: 'customer',
      customer_sub_type: 'business',
      gst_no: retailer.gstin || '',
      pan_no: retailer.pan || '',
      payment_terms: retailer.paymentTermsDays || 30,
      billing_address: {
        address: retailer.billingAddress?.street || '',
        city: retailer.billingAddress?.city || '',
        state: retailer.billingAddress?.state || '',
        zip: retailer.billingAddress?.pincode || '',
        country: 'India',
      },
      custom_fields: [
        { label: 'Necessity Retailer ID', value: retailer._id.toString() },
      ],
    };

    const url = `${ENV.ZOHO_API_BASE_URL}/contacts?organization_id=${ENV.ZOHO_ORGANIZATION_ID}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contactPayload),
    });

    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: err };
    }

    const resJson = (await response.json()) as any;
    const zohoContactId = resJson.contact?.contact_id;

    // Persist external ID on Retailer model
    (retailer as any).zohoContactId = zohoContactId;
    await retailer.save();

    await auditLogger.logAction({
      actorId: 'SYSTEM_ZOHO_SYNC',
      action: 'ZOHO_RETAILER_SYNCED',
      targetResource: 'Retailer',
      targetId: retailer.id,
      details: { zohoContactId },
    });

    return { success: true, zohoContactId };
  }

  /**
   * Syncs Order to Zoho Books Invoice upon fulfillment/delivery.
   */
  async createZohoInvoice(orderId: string): Promise<{ success: boolean; zohoInvoiceId?: string; error?: string }> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    const status = this.getSyncStatus();
    if (!status.isConfigured) {
      return {
        success: false,
        error: `Zoho unconfigured: missing [${status.missingKeys.join(', ')}]`,
      };
    }

    const retailer = await Retailer.findById(order.retailerId);
    const zohoContactId = (retailer as any)?.zohoContactId;

    if (!zohoContactId) {
      return {
        success: false,
        error: 'Retailer has not been synced to Zoho Books yet. Please sync customer first.',
      };
    }

    const accessToken = await this.getAccessToken();

    const lineItems = order.items.map((item) => {
      const totalItemDiscountPaise = (item.appliedDiscountPaise || 0) + (item.couponDiscountPaise || 0);
      const discountDesc = totalItemDiscountPaise > 0
        ? ` • Discount applied: ₹${(totalItemDiscountPaise / 100).toFixed(2)}`
        : '';

      return {
        name: item.productNameSnapshot,
        description: `SKU: ${item.skuSnapshot}${discountDesc}`,
        rate: item.quantity > 0 ? (item.taxableAmountPaise / item.quantity) / 100 : item.unitPricePaiseSnapshot / 100,
        quantity: item.quantity,
        hsn_or_sac: item.hsnCodeSnapshot || '',
        tax_percentage: item.gstRatePercentSnapshot,
      };
    });

    const invoicePayload = {
      customer_id: zohoContactId,
      reference_number: order.orderNumber,
      date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      line_items: lineItems,
      shipping_charge: order.deliveryFeePaise / 100,
      notes: order.customerNotes || 'Commercial distribution order processed by Necessity India Pvt. Ltd.',
    };

    const url = `${ENV.ZOHO_API_BASE_URL}/invoices?organization_id=${ENV.ZOHO_ORGANIZATION_ID}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invoicePayload),
    });

    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: err };
    }

    const resJson = (await response.json()) as any;
    const zohoInvoiceId = resJson.invoice?.invoice_id;

    (order as any).zohoInvoiceId = zohoInvoiceId;
    (order as any).zohoInvoiceNumber = resJson.invoice?.invoice_number;
    await order.save();

    return { success: true, zohoInvoiceId };
  }

  /**
   * Syncs an Invoice document to Zoho Books with customer auto-sync and deduplication.
   */
  async syncInvoice(invoiceId: string): Promise<{ success: boolean; zohoInvoiceId?: string; error?: string }> {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      throw ApiError.notFound('Invoice not found');
    }

    const status = this.getSyncStatus();
    if (!status.isConfigured) {
      return {
        success: false,
        error: `Zoho unconfigured: missing [${status.missingKeys.join(', ')}]`,
      };
    }

    // Deduplication check: Do not re-sync if already synced
    if (invoice.zohoInvoiceId) {
      return {
        success: true,
        zohoInvoiceId: invoice.zohoInvoiceId,
      };
    }

    const retailer = await Retailer.findById(invoice.retailerId);
    if (!retailer) {
      return { success: false, error: 'Customer profile not found for invoice' };
    }

    let zohoContactId = (retailer as any)?.zohoContactId;
    if (!zohoContactId) {
      const syncCustomerRes = await this.syncRetailerCustomer(retailer.id);
      if (!syncCustomerRes.success || !syncCustomerRes.zohoContactId) {
        return {
          success: false,
          error: `Failed to sync customer to Zoho Books: ${syncCustomerRes.error || 'Unknown error'}`,
        };
      }
      zohoContactId = syncCustomerRes.zohoContactId;
    }

    const accessToken = await this.getAccessToken();

    const lineItems = invoice.items.map((item) => ({
      name: item.name,
      description: `SKU: ${item.sku}`,
      rate: item.unitPricePaise / 100,
      quantity: item.quantity,
      hsn_or_sac: item.hsnCode || '',
      tax_percentage: item.gstRatePercent,
    }));

    const invoicePayload = {
      customer_id: zohoContactId,
      invoice_number: invoice.invoiceNumber,
      reference_number: invoice.orderNumber || invoice.invoiceNumber,
      date: invoice.issueDate.toISOString().split('T')[0],
      due_date: invoice.dueDate.toISOString().split('T')[0],
      line_items: lineItems,
      notes: invoice.notes || 'B2B Wholesale Tax Invoice issued by Necessity India Pvt. Ltd.',
    };

    const url = `${ENV.ZOHO_API_BASE_URL}/invoices?organization_id=${ENV.ZOHO_ORGANIZATION_ID}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invoicePayload),
    });

    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: err };
    }

    const resJson = (await response.json()) as any;
    const zohoInvoiceId = resJson.invoice?.invoice_id;

    return { success: true, zohoInvoiceId };
  }
}


export const zohoService = new ZohoIntegrationService();
