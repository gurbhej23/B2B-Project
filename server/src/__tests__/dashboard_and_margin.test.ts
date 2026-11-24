import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { User } from '../modules/users/user.model';
import { Retailer } from '../modules/retailers/retailer.model';
import { Order } from '../modules/orders/order.model';
import { Product } from '../modules/products/product.model';
import { Category } from '../modules/products/category.model';
import { PaymentTransaction } from '../modules/payments/payment.model';
import { seedDatabase } from '../scripts/seed';
import { ENV } from '../config/env';
import {
  UserRole,
  AccountStatus,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  inrToPaise,
  validateTierPricing,
} from '@necessity/shared';

let mongoServer: MongoMemoryServer;
let app: any;
let adminToken: string;
let retailerToken: string;
let testRetailerId: string;
let testOrderId: string;

jest.setTimeout(45000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  app = createApp();

  // Seed initial Super Admin and base catalog
  await seedDatabase(true);

  // Authenticate Super Admin
  const adminLoginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({
      identifier: ENV.SUPER_ADMIN_EMAIL,
      password: ENV.SUPER_ADMIN_PASSWORD,
    });
  expect(adminLoginRes.status).toBe(200);
  adminToken = adminLoginRes.body.data.tokens.accessToken;

  // Create an approved active retailer
  const retailerUser = await User.create({
    name: 'Test Retailer Dealer',
    phone: '9876543210',
    email: 'retailer@teststore.com',
    passwordHash: 'dummyhash',
    role: UserRole.RETAILER,
    accountStatus: AccountStatus.ACTIVE,
  });

  const retailerProfile = await Retailer.create({
    userId: retailerUser._id,
    businessName: 'Apex Textiles Wholesalers',
    gstin: '27AAAAA0000A1Z5',
    pan: 'AAAAA0000A',
    contactPerson: 'Mr. Dealer',
    phone: '9876543210',
    email: 'retailer@teststore.com',
    billingAddress: {
      street: 'Market Road',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      stateCode: '27',
    },
    shippingAddress: {
      street: 'Market Road',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      stateCode: '27',
    },
    creditLimitPaise: 50000000, // ₹5,00,000
    availableCreditPaise: 42000000,
    outstandingReceivablesPaise: 8000000, // ₹80,000 verified outstanding
    paymentTermsDays: 30,
    isActive: true,
  });
  testRetailerId = retailerProfile._id.toString();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Necessity India B2B — Admin Dashboard & Product Pricing Margin Suite', () => {
  describe('PART 1: Executive Dashboard Metrics & Authoritative API', () => {
    it('1. GET /api/v1/dashboard/overview requires admin authentication', async () => {
      const unauthRes = await request(app).get('/api/v1/dashboard/overview');
      expect(unauthRes.status).toBe(401);
    });

    it('2. GET /api/v1/dashboard/overview accurately reflects database records', async () => {
      const retailerUser = await User.findOne({ email: 'retailer@teststore.com' });

      // Create 1 pending order awaiting admin review
      const order = await Order.create({
        orderNumber: 'ORD-TEST-001',
        retailerId: testRetailerId,
        retailerName: 'Apex Textiles Wholesalers',
        placedByUserId: retailerUser!._id,
        placedByName: 'Test Retailer Dealer',
        deliveryAddress: {
          street: 'Market Road',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          stateCode: '27',
        },
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            productNameSnapshot: 'Cotton Bath Towel',
            skuSnapshot: 'CBT-001',
            hsnCodeSnapshot: '6302',
            quantity: 10,
            unitPricePaiseSnapshot: 18900,
            gstRatePercentSnapshot: 12,
            itemTotalPaise: 189000,
            taxableAmountPaise: 189000,
            gstAmountPaise: 22680,
            lineTotalPaise: 211680,
          },
        ],
        subtotalPaise: 189000,
        taxableAmountPaise: 189000,
        totalCgstPaise: 11340,
        totalSgstPaise: 11340,
        totalIgstPaise: 0,
        deliveryFeePaise: 0,
        totalDiscountPaise: 0,
        grandTotalPaise: 211680,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        paymentStatus: PaymentStatus.PENDING,
        status: OrderStatus.SUBMITTED, // Pending order!
      });
      testOrderId = order._id.toString();

      // Create 1 pending retailer awaiting approval
      await User.create({
        name: 'Pending Wholesale Applicant',
        phone: '9123456789',
        email: 'applicant@b2bstore.com',
        passwordHash: 'dummy',
        role: UserRole.RETAILER,
        accountStatus: AccountStatus.PENDING, // Pending review!
      });

      // Create 1 pending bank transfer payment awaiting verification
      await PaymentTransaction.create({
        orderId: order._id,
        retailerId: testRetailerId,
        amountPaise: 211680,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        status: PaymentStatus.PENDING, // Awaiting verification!
        bankReferenceUtr: 'UTR123456789012',
      });

      // Call dashboard overview
      const res = await request(app)
        .get('/api/v1/dashboard/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const overview = res.body.data;
      expect(overview.operationalCards).toBeDefined();

      // Executive KPI Summary Boxes:
      expect(overview.summaryBoxes).toBeDefined();
      expect(overview.summaryBoxes.totalUsersCount).toBeGreaterThanOrEqual(1);
      expect(overview.summaryBoxes.pendingUsersCount).toBeGreaterThanOrEqual(1);
      expect(typeof overview.summaryBoxes.totalProductsCount).toBe('number');
      expect(typeof overview.summaryBoxes.activeProductsCount).toBe('number');
      expect(overview.summaryBoxes.totalOrdersCount).toBeGreaterThanOrEqual(1);
      expect(overview.summaryBoxes.nonCancelledOrdersCount).toBeGreaterThanOrEqual(1);
      expect(overview.summaryBoxes.totalRevenuePaise).toBeGreaterThanOrEqual(211680);

      // Operational Summary Cards:
      expect(overview.operationalCards.pendingOrdersCount).toBeGreaterThanOrEqual(1);
      expect(overview.operationalCards.pendingRetailersCount).toBeGreaterThanOrEqual(1);
      expect(overview.operationalCards.paymentsToVerifyCount).toBeGreaterThanOrEqual(1);
      expect(overview.operationalCards.totalOutstandingPaise).toBeGreaterThanOrEqual(8000000);

      // Supporting Sections:
      expect(overview.todayOrders).toBeDefined();
      expect(overview.todayOrders.count).toBeGreaterThanOrEqual(1);
      expect(overview.retailerStats).toBeDefined();
      expect(overview.retailerStats.approvedRetailersCount).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(overview.lowStockAlerts)).toBe(true);
      expect(Array.isArray(overview.recentActivity)).toBe(true);
    });

    it('3. GET /api/v1/payments/pending lists offline bank transfers for verification', async () => {
      const res = await request(app)
        .get('/api/v1/payments/pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const payment = res.body.data.find((p: any) => p.bankReferenceUtr === 'UTR123456789012');
      expect(payment).toBeDefined();
      expect(payment.status).toBe(PaymentStatus.PENDING);
      expect(payment.amountPaise).toBe(211680);
    });

    it('4. PATCH /api/v1/payments/:id/verify verifies payment and updates order', async () => {
      const pendingPayment = await PaymentTransaction.findOne({ bankReferenceUtr: 'UTR123456789012' });
      expect(pendingPayment).toBeDefined();

      const verifyRes = await request(app)
        .patch(`/api/v1/payments/${pendingPayment!._id}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Verified via HDFC wholesale bank statement' });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.data.status).toBe(PaymentStatus.SUCCESSFUL);
      expect(verifyRes.body.data.notes).toBe('Verified via HDFC wholesale bank statement');

      // Verify associated Order paymentStatus updated
      const updatedOrder = await Order.findById(testOrderId);
      expect(updatedOrder?.paymentStatus).toBe(PaymentStatus.SUCCESSFUL);

      // Verification queue now decreases
      const pendingAfter = await PaymentTransaction.find({
        status: { $in: [PaymentStatus.PENDING, PaymentStatus.SUBMITTED_FOR_VERIFICATION] },
      });
      const stillPending = pendingAfter.find((p) => p.id === pendingPayment!.id);
      expect(stillPending).toBeUndefined();
    });
  });

  describe('PART 2: Product Pricing, Retailer Price Difference & Tax Rules', () => {
    it('5. Computes exact Retailer Price Difference: MRP ₹299 & Wholesale ₹189 -> ₹110 and 36.79%', () => {
      const mrp = 299;
      const wholesale = 189;

      const priceDifference = mrp - wholesale;
      const differencePercentOfMrp = (priceDifference / mrp) * 100;

      expect(priceDifference).toBe(110);
      expect(differencePercentOfMrp).toBeCloseTo(36.789, 2);
      expect(differencePercentOfMrp.toFixed(2)).toBe('36.79');
    });

    it('6. Handles zero, negative, and invalid MRP safely without NaN or Infinity', () => {
      const calculateDifference = (mrpRupees: any, dealerRupees: any) => {
        const parsedMrp = Math.max(0, parseFloat(mrpRupees) || 0);
        const parsedDealer = Math.max(0, parseFloat(dealerRupees) || 0);
        const priceDifferenceRs = Math.max(0, parsedMrp - parsedDealer);
        const differencePercentOfMrp = parsedMrp > 0 ? (priceDifferenceRs / parsedMrp) * 100 : 0;
        const formattedPercent = Number.isFinite(differencePercentOfMrp) ? differencePercentOfMrp.toFixed(2) : '0.00';
        return { priceDifferenceRs, differencePercentOfMrp, formattedPercent };
      };

      // Zero MRP
      const zeroResult = calculateDifference(0, 189);
      expect(zeroResult.priceDifferenceRs).toBe(0);
      expect(zeroResult.differencePercentOfMrp).toBe(0);
      expect(zeroResult.formattedPercent).toBe('0.00');

      // Invalid / Empty string
      const invalidResult = calculateDifference('', 'abc');
      expect(invalidResult.priceDifferenceRs).toBe(0);
      expect(invalidResult.differencePercentOfMrp).toBe(0);
      expect(invalidResult.formattedPercent).toBe('0.00');

      // Wholesale exceeds MRP (dealer price higher than MRP)
      const higherWholesale = calculateDifference(200, 250);
      expect(higherWholesale.priceDifferenceRs).toBe(0);
      expect(higherWholesale.formattedPercent).toBe('0.00');
    });

    it('7. validateTierPricing enforces that tier price cannot exceed base wholesale price', () => {
      const baseWholesalePricePaise = inrToPaise(189); // ₹189

      // Valid tiers: Tier prices ₹180 and ₹170 are both <= ₹189
      const validTiers = [
        { minQuantity: 10, maxQuantity: 49, unitPricePaise: inrToPaise(180) },
        { minQuantity: 50, unitPricePaise: inrToPaise(170) },
      ];
      const validResult = validateTierPricing(validTiers, baseWholesalePricePaise);
      expect(validResult.valid).toBe(true);

      // Invalid tier: Tier 1 price ₹200 exceeds base wholesale price ₹189
      const invalidTiers = [
        { minQuantity: 10, maxQuantity: 49, unitPricePaise: inrToPaise(200) },
      ];
      const invalidResult = validateTierPricing(invalidTiers, baseWholesalePricePaise);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toContain('cannot exceed base wholesale price');
    });

    it('8. POST /api/v1/products creates product with custom GST rate and validated tiers', async () => {
      let categoryDoc = await Category.findOne();
      if (!categoryDoc) {
        categoryDoc = await Category.create({ name: 'Facility Supplies', slug: 'facility-supplies' });
      }

      const productPayload = {
        name: 'Luxury Cotton Hand Towel 450 GSM',
        sku: 'HT-LUX-450',
        categoryId: categoryDoc._id.toString(),
        brand: 'Necessity India',
        description: 'Premium wholesale hand towel pack',
        mrpPaise: inrToPaise(299),
        dealerPricePaise: inrToPaise(189),
        gstRatePercent: 12, // Custom product-specific GST
        hsnCode: '6302',
        uom: 'PCS',
        packSize: 6,
        minOrderQuantity: 12,
        orderQuantityMultiple: 6,
        stockOnHand: 500,
        warehouseLocation: 'Main Central Warehouse',
        lowStockThreshold: 50,
        hasVariants: false,
        isTierPricingEnabled: true,
        tierPricing: [
          { minQuantity: 12, maxQuantity: 60, unitPricePaise: inrToPaise(175) },
          { minQuantity: 61, unitPricePaise: inrToPaise(165) },
        ],
      };

      const createRes = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(productPayload);

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      expect(createRes.body.data.gstRatePercent).toBe(12);
      expect(createRes.body.data.dealerPricePaise).toBe(18900);
      expect(createRes.body.data.mrpPaise).toBe(29900);
      expect(createRes.body.data.tierPricing.length).toBe(2);
    });

    it('9. POST /api/v1/products rejects product if tier unit price exceeds base wholesale rate', async () => {
      const categoryDoc = await Category.findOne();

      const invalidPayload = {
        name: 'Invalid Tier Towel',
        sku: 'INV-TIER-001',
        categoryId: categoryDoc?._id.toString(),
        brand: 'Necessity India',
        description: 'Test product with invalid tier price',
        mrpPaise: inrToPaise(299),
        dealerPricePaise: inrToPaise(189),
        gstRatePercent: 18,
        hsnCode: '6302',
        uom: 'PCS',
        stockOnHand: 100,
        hasVariants: false,
        isTierPricingEnabled: true,
        tierPricing: [
          { minQuantity: 10, maxQuantity: 50, unitPricePaise: inrToPaise(210) }, // ₹210 > ₹189!
        ],
      };

      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('cannot exceed base wholesale price');
    });

    it('10. validateTierPricing enforces that Tier 1 starts at MOQ', () => {
      const baseWholesalePricePaise = inrToPaise(189);
      const moq = 10;

      // Invalid: Tier 1 starts at 5 when MOQ is 10
      const invalidTiers = [
        { minQuantity: 5, maxQuantity: 49, unitPricePaise: inrToPaise(180) },
        { minQuantity: 50, unitPricePaise: inrToPaise(170) },
      ];
      const invalidResult = validateTierPricing(invalidTiers, baseWholesalePricePaise, moq);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toContain('must start at the Minimum Order Quantity');

      // Valid: Tier 1 starts at MOQ 10
      const validTiers = [
        { minQuantity: 10, maxQuantity: 49, unitPricePaise: inrToPaise(180) },
        { minQuantity: 50, unitPricePaise: inrToPaise(170) },
      ];
      const validResult = validateTierPricing(validTiers, baseWholesalePricePaise, moq);
      expect(validResult.valid).toBe(true);
    });

    it('11. Computes accurate tax-exclusive Potential Retailer Gross Margin across GST slabs', () => {
      // Helper function matching the frontend & backend calculation
      const calculateCommercialMargin = (mrpRs: number, wholesaleBaseRs: number, gstRatePct: number) => {
        const sellingPriceExclGst = gstRatePct > 0 ? mrpRs / (1 + gstRatePct / 100) : mrpRs;
        const potentialRetailerMarginRs = Math.max(0, sellingPriceExclGst - wholesaleBaseRs);
        const marginPercent = sellingPriceExclGst > 0 ? (potentialRetailerMarginRs / sellingPriceExclGst) * 100 : 0;
        const applicableGstRs = (wholesaleBaseRs * gstRatePct) / 100;
        const wholesalePriceInclGst = wholesaleBaseRs + applicableGstRs;
        return {
          sellingPriceExclGst: Number(sellingPriceExclGst.toFixed(2)),
          potentialRetailerMarginRs: Number(potentialRetailerMarginRs.toFixed(2)),
          marginPercent: Number(marginPercent.toFixed(2)),
          applicableGstRs: Number(applicableGstRs.toFixed(2)),
          wholesalePriceInclGst: Number(wholesalePriceInclGst.toFixed(2)),
        };
      };

      // Case A: 18% GST (Standard) - MRP ₹299, Wholesale Base ₹189
      const caseA = calculateCommercialMargin(299, 189, 18);
      expect(caseA.sellingPriceExclGst).toBe(253.39);
      expect(caseA.potentialRetailerMarginRs).toBe(64.39);
      expect(caseA.marginPercent).toBe(25.41);
      expect(caseA.applicableGstRs).toBe(34.02);
      expect(caseA.wholesalePriceInclGst).toBe(223.02);

      // Case B: 12% GST - MRP ₹200, Wholesale Base ₹120
      const caseB = calculateCommercialMargin(200, 120, 12);
      expect(caseB.sellingPriceExclGst).toBe(178.57);
      expect(caseB.potentialRetailerMarginRs).toBe(58.57);
      expect(caseB.marginPercent).toBe(32.80);
      expect(caseB.applicableGstRs).toBe(14.40);
      expect(caseB.wholesalePriceInclGst).toBe(134.40);

      // Case C: 0% GST (Exempt) - MRP ₹100, Wholesale Base ₹80
      const caseC = calculateCommercialMargin(100, 80, 0);
      expect(caseC.sellingPriceExclGst).toBe(100.00);
      expect(caseC.potentialRetailerMarginRs).toBe(20.00);
      expect(caseC.marginPercent).toBe(20.00);
      expect(caseC.applicableGstRs).toBe(0.00);
      expect(caseC.wholesalePriceInclGst).toBe(80.00);
    });
  });
});
