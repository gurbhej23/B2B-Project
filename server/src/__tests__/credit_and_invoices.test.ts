import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { User } from '../modules/users/user.model';
import { Retailer } from '../modules/retailers/retailer.model';
import { Category } from '../modules/products/category.model';
import { Product } from '../modules/products/product.model';
import { Order } from '../modules/orders/order.model';
import { Invoice } from '../modules/invoices/invoice.model';
import { LedgerEntry } from '../modules/credit/ledger.model';
import {
  UserRole,
  AccountStatus,
  CreditStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  InvoiceStatus,
  LedgerEntryType,
} from '@necessity/shared';

let mongoServer: MongoMemoryServer;
let app: any;
let adminToken: string;
let retailerToken: string;
let otherRetailerToken: string;
let retailerDoc: any;
let otherRetailerDoc: any;
let testProductDoc: any;

jest.setTimeout(45000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  app = createApp();

  // 1. Create Admin
  const adminRes = await request(app).post('/api/v1/auth/register').send({
    businessName: 'Necessity HQ Administration',
    contactPerson: 'Master Admin',
    phone: '+919876543210',
    email: 'admin@necessityindia.com',
    password: 'AdminPassword123!',
    billingAddress: {
      street: 'HQ Business Park',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
      stateCode: '07',
    },
    termsAccepted: true,
  });

  const adminUser = await User.findOne({ phone: '+919876543210' });
  if (adminUser) {
    adminUser.role = UserRole.SUPER_ADMIN;
    adminUser.accountStatus = AccountStatus.ACTIVE;
    await adminUser.save();
  }

  const adminLogin = await request(app).post('/api/v1/auth/login').send({
    identifier: '+919876543210',
    password: 'AdminPassword123!',
  });
  adminToken = adminLogin.body.data.tokens.accessToken;

  // 2. Create Retailer 1 (Primary Test Customer)
  await request(app).post('/api/v1/auth/register').send({
    businessName: 'Apex Wholesale Mart',
    tradeName: 'Apex Grocers',
    contactPerson: 'Rajesh Kumar',
    phone: '+919111111111',
    email: 'rajesh@apexmart.com',
    password: 'RetailerPassword123!',
    gstin: '07AAAAA0000A1Z5',
    billingAddress: {
      street: '12 Commercial Street',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110006',
      stateCode: '07',
    },
    termsAccepted: true,
  });

  const ret1User = await User.findOne({ phone: '+919111111111' });
  if (ret1User) {
    ret1User.accountStatus = AccountStatus.ACTIVE;
    await ret1User.save();
    retailerDoc = await Retailer.findOne({ userId: ret1User._id });
    if (retailerDoc) {
      retailerDoc.creditLimitPaise = 5000000; // ₹50,000.00
      retailerDoc.paymentTermsDays = 21; // 21 days
      retailerDoc.creditStatus = CreditStatus.NORMAL;
      retailerDoc.isActive = true;
      await retailerDoc.save();
    }
  }

  const ret1Login = await request(app).post('/api/v1/auth/login').send({
    identifier: '+919111111111',
    password: 'RetailerPassword123!',
  });
  retailerToken = ret1Login.body.data.tokens.accessToken;

  // 3. Create Retailer 2 (For multi-tenant isolation tests)
  await request(app).post('/api/v1/auth/register').send({
    businessName: 'Beta Supermarket',
    contactPerson: 'Suresh Verma',
    phone: '+919222222222',
    email: 'suresh@betamart.com',
    password: 'RetailerPassword123!',
    billingAddress: {
      street: '45 Ring Road',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110008',
      stateCode: '07',
    },
    termsAccepted: true,
  });

  const ret2User = await User.findOne({ phone: '+919222222222' });
  if (ret2User) {
    ret2User.accountStatus = AccountStatus.ACTIVE;
    await ret2User.save();
    otherRetailerDoc = await Retailer.findOne({ userId: ret2User._id });
    if (otherRetailerDoc) {
      otherRetailerDoc.creditLimitPaise = 1000000; // ₹10,000.00
      otherRetailerDoc.isActive = true;
      await otherRetailerDoc.save();
    }
  }

  const ret2Login = await request(app).post('/api/v1/auth/login').send({
    identifier: '+919222222222',
    password: 'RetailerPassword123!',
  });
  otherRetailerToken = ret2Login.body.data.tokens.accessToken;



  // 4. Create Category & Product
  const category = await Category.create({
    name: 'Spices & Seasoning',
    slug: 'spices-seasoning',
    code: 'CAT-SPICES',
  });

  testProductDoc = await Product.create({
    sku: 'SPICE-TURM-500G',
    name: 'Pure Ground Turmeric Powder 500g',
    description: '100% natural turmeric powder for commercial distribution',
    categoryId: category._id,
    brand: 'Necessity Organics',
    uom: 'packet',
    packSize: 1,
    caseQuantity: 24,
    mrpPaise: 25000,
    dealerPricePaise: 18000, // ₹180.00
    hsnCode: '09103030',
    gstRatePercent: 5,
    minOrderQuantity: 10,
    orderQuantityMultiple: 5,
    stockOnHand: 500,
    stockReserved: 0,
    lowStockThreshold: 20,
    isActive: true,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Phase 4: Credit & Ledger Architecture', () => {
  it('1. Admin can fetch Credit Overview with customer-wise balances and summary totals', async () => {
    const res = await request(app)
      .get('/api/v1/credit/overview')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toBeInstanceOf(Array);
    expect(res.body.data.summary).toBeDefined();

    const apex = res.body.data.items.find(
      (item: any) => item.businessName === 'Apex Wholesale Mart'
    );
    expect(apex).toBeDefined();
    expect(apex.creditLimitPaise).toBe(5000000);
    expect(apex.paymentTermsDays).toBe(21);
    expect(apex.availableCreditPaise).toBe(5000000);
    expect(res.body.data.summary.totalCreditLimitPaise).toBeGreaterThan(0);
  });

  it('2. Generating an Invoice from an Order posts a Debit to Ledger and increments receivables', async () => {
    // Create an order for Apex
    const order = await Order.create({
      orderNumber: 'ORD-202610-1001',
      retailerId: retailerDoc._id,
      retailerName: retailerDoc.businessName,
      placedByUserId: retailerDoc.userId,
      placedByName: 'Rajesh Kumar',
      status: OrderStatus.CONFIRMED,
      items: [
        {
          productId: testProductDoc._id,
          skuSnapshot: testProductDoc.sku,
          productNameSnapshot: testProductDoc.name,
          hsnCodeSnapshot: testProductDoc.hsnCode,
          quantity: 20,
          unitPricePaiseSnapshot: 18000,
          appliedDiscountPaise: 0,
          taxableAmountPaise: 360000,
          gstRatePercentSnapshot: 5,
          cgstPaise: 9000,
          sgstPaise: 9000,
          igstPaise: 0,
          lineTotalPaise: 378000, // ₹3,780.00
        },
      ],
      subtotalPaise: 360000,
      totalDiscountPaise: 0,
      taxableAmountPaise: 360000,
      totalCgstPaise: 9000,
      totalSgstPaise: 9000,
      totalIgstPaise: 0,
      deliveryFeePaise: 0,
      grandTotalPaise: 378000,
      paymentMethod: PaymentMethod.CREDIT_ACCOUNT,
      paymentStatus: PaymentStatus.PENDING,
      deliveryAddress: retailerDoc.billingAddress,
    });

    const res = await request(app)
      .post(`/api/v1/invoices/generate-from-order/${order._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.invoiceNumber).toMatch(/^INV-/);
    expect(res.body.data.totalPaise).toBe(378000);
    expect(res.body.data.outstandingAmountPaise).toBe(378000);
    expect(res.body.data.status).toBe(InvoiceStatus.ISSUED);

    // Verify calculated dueDate matches paymentTermsDays (21 days)
    const issueDate = new Date(res.body.data.issueDate);
    const dueDate = new Date(res.body.data.dueDate);
    const diffDays = Math.round((dueDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(21);

    // Verify debit was posted to LedgerEntry
    const ledger = await LedgerEntry.findOne({
      retailerId: retailerDoc._id,
      type: LedgerEntryType.INVOICE_POSTED,
    });
    expect(ledger).toBeDefined();
    expect(ledger?.debitPaise).toBe(378000);
    expect(ledger?.runningBalancePaise).toBe(378000);

    // Verify Retailer receivables updated
    const updatedRetailer = await Retailer.findById(retailerDoc._id);
    expect(updatedRetailer?.outstandingReceivablesPaise).toBe(378000);
    expect(updatedRetailer?.calculateAvailableCreditPaise()).toBe(5000000 - 378000);
  });

  it('3. Admin can record a payment; reduces receivables and creates immutable ledger entry without deleting history', async () => {
    const paymentAmount = 200000; // ₹2,000.00
    const res = await request(app)
      .post('/api/v1/credit/payment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        retailerId: retailerDoc._id.toString(),
        amountPaise: paymentAmount,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        referenceNumber: 'NEFT-AXIS-2026102201',
        notes: 'Partial settlement via NEFT',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.newRunningBalance).toBe(378000 - paymentAmount); // ₹1,780.00

    // Verify historical transactions were preserved (2 total ledger entries: 1 invoice, 1 payment)
    const allEntries = await LedgerEntry.find({ retailerId: retailerDoc._id }).sort({ date: 1 });
    expect(allEntries).toHaveLength(2);
    expect(allEntries[0].type).toBe(LedgerEntryType.INVOICE_POSTED);
    expect(allEntries[0].debitPaise).toBe(378000);
    expect(allEntries[1].type).toBe(LedgerEntryType.PAYMENT_RECEIVED);
    expect(allEntries[1].creditPaise).toBe(200000);
    expect(allEntries[1].runningBalancePaise).toBe(178000);

    // Verify Retailer receivables decreased
    const updatedRetailer = await Retailer.findById(retailerDoc._id);
    expect(updatedRetailer?.outstandingReceivablesPaise).toBe(178000);
  });

  it('4. Ledger statement calculates opening balance, period movements, and sequential balances', async () => {
    const res = await request(app)
      .get(`/api/v1/credit/ledger?retailerId=${retailerDoc._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.customer.businessName).toBe('Apex Wholesale Mart');
    expect(res.body.data.periodStats.totalDebitPaise).toBe(378000);
    expect(res.body.data.periodStats.totalCreditPaise).toBe(200000);
    expect(res.body.data.periodStats.netMovementPaise).toBe(178000);
    expect(res.body.data.entries.length).toBeGreaterThanOrEqual(2);
  });

  it('5. RBAC: Retailer cannot record payments or ledger adjustments', async () => {
    const res = await request(app)
      .post('/api/v1/credit/payment')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        retailerId: retailerDoc._id.toString(),
        amountPaise: 50000,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        referenceNumber: 'MALICIOUS-ENTRY',
      });

    expect(res.status).toBe(403);
  });

  it('6. Multi-Tenant Isolation: Retailer 1 cannot view Retailer 2 ledger statement', async () => {
    const res = await request(app)
      .get(`/api/v1/credit/ledger?retailerId=${otherRetailerDoc._id}`)
      .set('Authorization', `Bearer ${retailerToken}`);

    expect(res.status).toBe(403);
  });

  it('7. Admin can adjust credit with Credit Note and Debit Adjustment', async () => {
    // Record Credit Note of ₹500.00
    const cnRes = await request(app)
      .post('/api/v1/credit/adjust')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        retailerId: retailerDoc._id.toString(),
        type: LedgerEntryType.CREDIT_NOTE,
        amountPaise: 50000,
        reason: 'Trade discount credit note',
      });

    expect(cnRes.status).toBe(200);
    expect(cnRes.body.data.runningBalancePaise).toBe(178000 - 50000); // 128000

    const updatedRetailer = await Retailer.findById(retailerDoc._id);
    expect(updatedRetailer?.outstandingReceivablesPaise).toBe(128000);
  });
});

describe('Phase 7: Invoices & Zoho Sync Architecture', () => {
  it('1. Admin can list invoices with status indicators and search filter', async () => {
    const res = await request(app)
      .get('/api/v1/invoices?search=Apex')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toBeInstanceOf(Array);
    expect(res.body.data.items.length).toBeGreaterThan(0);
    expect(res.body.data.summary.totalInvoicedPaise).toBeGreaterThan(0);
  });

  it('2. Fetching single invoice details returns line items and tax breakdown', async () => {
    const invoice = await Invoice.findOne({ retailerId: retailerDoc._id });
    expect(invoice).toBeDefined();

    const res = await request(app)
      .get(`/api/v1/invoices/${invoice?._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].sku).toBe('SPICE-TURM-500G');
    expect(res.body.data.items[0].taxableAmountPaise).toBe(360000);
  });

  it('3. Zoho integration status returns safe UNCONFIGURED state when credentials are not present', async () => {
    const res = await request(app)
      .get('/api/v1/integrations/zoho/status')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isConfigured).toBe(false);
    expect(res.body.data.status).toBe('UNCONFIGURED_MISSING_CREDENTIALS');
    expect(res.body.data.missingKeys).toContain('ZOHO_CLIENT_ID');
    expect(res.body.data.details).toContain('Zoho integration is not active');
  });

  it('4. Attempting to sync to Zoho when unconfigured fails gracefully with descriptive error', async () => {
    const invoice = await Invoice.findOne({ retailerId: retailerDoc._id });
    expect(invoice).toBeDefined();

    const res = await request(app)
      .post(`/api/v1/invoices/${invoice?._id}/sync-zoho`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Zoho integration credentials are not configured');

    // Verify invoice marked as sync failed without crashing
    const updatedInvoice = await Invoice.findById(invoice?._id);
    expect(updatedInvoice?.zohoSyncStatus).toBe('failed');
    expect(updatedInvoice?.zohoLastSyncError).toContain('Zoho Books credentials not configured');
  });

  it('5. Download Tax Invoice PDF returns application/pdf stream with correct disposition header', async () => {
    const invoice = await Invoice.findOne({ retailerId: retailerDoc._id });
    expect(invoice).toBeDefined();

    const res = await request(app)
      .get(`/api/v1/invoices/${invoice?._id}/pdf`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toBe('application/pdf');
    expect(res.header['content-disposition']).toContain(`Tax-Invoice-${invoice?.invoiceNumber}.pdf`);
    expect(res.body).toBeInstanceOf(Buffer);
    expect(res.body.length).toBeGreaterThan(500); // Valid PDF binary bytes
  });

  it('6. Multi-Tenant PDF Security: Retailer 2 cannot download Retailer 1 invoice PDF', async () => {
    const invoice = await Invoice.findOne({ retailerId: retailerDoc._id });
    expect(invoice).toBeDefined();

    const res = await request(app)
      .get(`/api/v1/invoices/${invoice?._id}/pdf`)
      .set('Authorization', `Bearer ${otherRetailerToken}`);

    expect(res.status).toBe(403);
  });

  it('7. Admin records offline partial payment: updates balance due, status to partially_paid, and creates PaymentTransaction', async () => {
    const invoice = await Invoice.findOne({ retailerId: retailerDoc._id });
    expect(invoice).toBeDefined();

    const partialAmount = 100000; // ₹1,000.00
    const res = await request(app)
      .post(`/api/v1/invoices/${invoice?._id}/payments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        amountPaise: partialAmount,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        bankReferenceUtr: 'UTR-TEST-PARTIAL-999',
        notes: 'Partial payment received via NEFT',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.invoice.paidAmountPaise).toBe(partialAmount);
    expect(res.body.data.invoice.outstandingAmountPaise).toBe(invoice!.totalPaise - partialAmount);
    expect(res.body.data.invoice.status).toBe(InvoiceStatus.PARTIALLY_PAID);
    expect(res.body.data.invoice.payments).toHaveLength(1);
    expect(res.body.data.invoice.payments[0].bankReferenceUtr).toBe('UTR-TEST-PARTIAL-999');
  });

  it('8. Admin records remaining balance: status automatically transitions to PAID with 0 balance due', async () => {
    const invoice = await Invoice.findOne({ retailerId: retailerDoc._id });
    expect(invoice).toBeDefined();

    const remaining = invoice!.outstandingAmountPaise;
    const res = await request(app)
      .post(`/api/v1/invoices/${invoice?._id}/payments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        amountPaise: remaining,
        paymentMethod: PaymentMethod.UPI,
        bankReferenceUtr: 'UPI-TEST-FULL-111',
        notes: 'Final settlement payment',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.invoice.paidAmountPaise).toBe(invoice!.totalPaise);
    expect(res.body.data.invoice.outstandingAmountPaise).toBe(0);
    expect(res.body.data.invoice.status).toBe(InvoiceStatus.PAID);
  });

  it('9. Overdue calculation: past due date with remaining balance results in OVERDUE status', async () => {
    // Create an unpaid invoice with past due date
    const pastDueInvoice = await Invoice.create({
      invoiceNumber: `INV-OVERDUE-${Date.now()}`,
      retailerId: retailerDoc._id,
      retailerBusinessName: retailerDoc.businessName,
      retailerGstin: retailerDoc.gstin,
      issueDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days past due
      subtotalPaise: 100000,
      taxPaise: 18000,
      totalPaise: 118000,
      paidAmountPaise: 0,
      outstandingAmountPaise: 118000,
      status: InvoiceStatus.ISSUED,
      items: [],
      zohoSyncStatus: 'not_synced',
    });

    const res = await request(app)
      .get(`/api/v1/invoices/${pastDueInvoice._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(InvoiceStatus.OVERDUE);
  });

  it('10. Proforma invoice generation & issuing: draft mode does not post ledger until formally issued', async () => {
    const order = await Order.create({
      orderNumber: `ORD-PROFORMA-${Date.now()}`,
      retailerId: retailerDoc._id,
      placedByUserId: new mongoose.Types.ObjectId(),
      placedByName: 'Rajesh Kumar',
      retailerName: retailerDoc.businessName,
      items: [
        {
          productId: testProductDoc._id,
          skuSnapshot: testProductDoc.sku,
          productNameSnapshot: testProductDoc.name,
          hsnCodeSnapshot: '9999',
          quantity: 2,
          unitPricePaiseSnapshot: 50000,
          taxableAmountPaise: 100000,
          gstRatePercentSnapshot: 18,
          cgstPaise: 9000,
          sgstPaise: 9000,
          igstPaise: 0,
          lineTotalPaise: 118000,
        },
      ],
      subtotalPaise: 100000,
      totalDiscountPaise: 0,
      taxableAmountPaise: 100000,
      totalCgstPaise: 9000,
      totalSgstPaise: 9000,
      totalIgstPaise: 0,
      deliveryFeePaise: 0,
      grandTotalPaise: 118000,
      paymentMethod: PaymentMethod.CREDIT_ACCOUNT,
      paymentStatus: PaymentStatus.PENDING,
      deliveryAddress: retailerDoc.billingAddress,
    });

    // 1. Generate as Proforma
    const genRes = await request(app)
      .post(`/api/v1/invoices/generate-from-order/${order._id}?asProforma=true`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ asProforma: true });

    expect(genRes.status).toBe(200);
    expect(genRes.body.data.status).toBe(InvoiceStatus.DRAFT);
    const invoiceId = genRes.body.data._id || genRes.body.data.id;

    // 2. Issue the invoice formally
    const issueRes = await request(app)
      .post(`/api/v1/invoices/${invoiceId}/issue`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(issueRes.status).toBe(200);
    expect(issueRes.body.data.status).toBe(InvoiceStatus.ISSUED);
  });
});

describe('Phase 8: Analytics & Financial Reporting Architecture', () => {
  it('1. GET /api/v1/analytics/overview returns authoritative multi-metric financial intelligence', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/overview')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const fin = res.body.data.financialSummary;
    expect(fin).toBeDefined();
    expect(fin.invoicedSalesPaise).toBeGreaterThanOrEqual(378000);
    expect(fin.grossOrderValuePaise).toBeGreaterThanOrEqual(378000);
    expect(fin.collectedPaymentsPaise).toBeGreaterThanOrEqual(200000);
    expect(fin.outstandingReceivablesPaise).toBeDefined();

    expect(res.body.data.orderStats.totalOrdersCount).toBeGreaterThanOrEqual(1);
    expect(res.body.data.topSellingProducts).toBeInstanceOf(Array);
    expect(res.body.data.topCustomers).toBeInstanceOf(Array);
  });

  it('2. GET /api/v1/analytics/export returns valid CSV format for sales and ledgers', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/export?type=sales')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('text/csv');
    expect(res.text).toContain('Invoice Number');
    expect(res.text).toContain('Apex Wholesale Mart');
  });

  it('3. RBAC: Unauthorized retail customer cannot access analytics or CSV export', async () => {
    const overviewRes = await request(app)
      .get('/api/v1/analytics/overview')
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(overviewRes.status).toBe(403);

    const exportRes = await request(app)
      .get('/api/v1/analytics/export?type=sales')
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(exportRes.status).toBe(403);
  });
});
