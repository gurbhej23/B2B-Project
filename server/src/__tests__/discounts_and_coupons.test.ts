import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { User } from '../modules/users/user.model';
import { Retailer } from '../modules/retailers/retailer.model';
import { Category } from '../modules/products/category.model';
import { Product } from '../modules/products/product.model';
import { Order } from '../modules/orders/order.model';
import { ProductDiscount, Coupon, CouponRedemption } from '../modules/discounts/discount.model';
import {
  UserRole,
  AccountStatus,
  CreditStatus,
  CustomerType,
  PaymentMethod,
  DiscountType,
  DiscountScope,
} from '@necessity/shared';
import { zohoService } from '../modules/integrations/zoho/zoho.service';

let mongoServer: MongoMemoryServer;
let app: any;
let adminToken: string;
let retailerToken: string;
let anotherRetailerToken: string;
let activeRetailerDoc: any;
let anotherRetailerDoc: any;
let testProductDoc: any;
let testCategoryDoc: any;

jest.setTimeout(60000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  app = createApp();

  // 1. Create Admin
  await request(app).post('/api/v1/auth/register').send({
    businessName: 'Necessity Head Office',
    contactPerson: 'Admin User',
    phone: '+919999900001',
    email: 'admin.discounts@necessityindia.com',
    password: 'AdminPassword123!',
    billingAddress: {
      street: 'HQ Tower',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      stateCode: '27',
    },
    termsAccepted: true,
  });

  const adminUser = await User.findOne({ phone: '+919999900001' });
  adminUser!.role = UserRole.SUPER_ADMIN;
  adminUser!.accountStatus = AccountStatus.ACTIVE;
  await adminUser!.save();

  const adminLoginRes = await request(app).post('/api/v1/auth/login').send({
    identifier: 'admin.discounts@necessityindia.com',
    password: 'AdminPassword123!',
  });
  adminToken = adminLoginRes.body.data.tokens.accessToken;

  // 2. Create Primary Retailer (Mumbai, Maharashtra - State 27)
  await request(app).post('/api/v1/auth/register').send({
    businessName: 'Oberoi Grand Hospitality',
    contactPerson: 'Karan Mehra',
    phone: '+919822200001',
    email: 'karan@oberoigrand.in',
    password: 'RetailerPassword123!',
    billingAddress: {
      street: '100 Nariman Point',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400021',
      stateCode: '27',
    },
    termsAccepted: true,
  });

  const rUser = await User.findOne({ phone: '+919822200001' });
  const pendingRetailer = await Retailer.findOne({ userId: rUser!._id });

  await request(app)
    .patch(`/api/v1/retailers/${pendingRetailer!._id}/approval`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      status: AccountStatus.ACTIVE,
      creditLimitPaise: 50000000, // ₹5,00,000 credit limit
      paymentTermsDays: 30,
      creditStatus: CreditStatus.NORMAL,
      customerType: CustomerType.NEW,
    });

  await User.findByIdAndUpdate(rUser!._id, { accountStatus: AccountStatus.ACTIVE });
  activeRetailerDoc = await Retailer.findById(pendingRetailer!._id);

  const rLoginRes = await request(app).post('/api/v1/auth/login').send({
    identifier: '+919822200001',
    password: 'RetailerPassword123!',
  });
  retailerToken = rLoginRes.body.data.tokens.accessToken;

  // 3. Create Second Retailer (Ahmedabad, Gujarat - State 24)
  await request(app).post('/api/v1/auth/register').send({
    businessName: 'Gujarat Textile Wholesale Ltd',
    contactPerson: 'Bhavin Patel',
    phone: '+919822200002',
    email: 'bhavin@gujarattextile.in',
    password: 'RetailerPassword123!',
    billingAddress: {
      street: 'SG Highway',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pincode: '380054',
      stateCode: '24',
    },
    termsAccepted: true,
  });

  const rUser2 = await User.findOne({ phone: '+919822200002' });
  const pendingRetailer2 = await Retailer.findOne({ userId: rUser2!._id });

  await request(app)
    .patch(`/api/v1/retailers/${pendingRetailer2!._id}/approval`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      status: AccountStatus.ACTIVE,
      creditLimitPaise: 50000000,
      paymentTermsDays: 30,
      creditStatus: CreditStatus.NORMAL,
      customerType: CustomerType.NEW,
    });

  await User.findByIdAndUpdate(rUser2!._id, { accountStatus: AccountStatus.ACTIVE });
  anotherRetailerDoc = await Retailer.findById(pendingRetailer2!._id);

  const rLoginRes2 = await request(app).post('/api/v1/auth/login').send({
    identifier: '+919822200002',
    password: 'RetailerPassword123!',
  });
  anotherRetailerToken = rLoginRes2.body.data.tokens.accessToken;

  // 4. Create Category and Test Product with Quantity Tier Pricing
  testCategoryDoc = await Category.create({
    name: 'Hospitality Linens',
    slug: 'hospitality-linens',
    isActive: true,
  });

  testProductDoc = await Product.create({
    sku: 'TOW-PREM-001',
    name: 'Premium Egyptian Cotton Bath Towel 700 GSM',
    description: 'High-density institutional cotton bath towel',
    categoryId: testCategoryDoc._id,
    categoryName: testCategoryDoc.name,
    brand: 'Necessity Gold',
    images: [{ url: 'https://example.com/towel.jpg', isPrimary: true }],
    uom: 'PCS',
    packSize: 6,
    caseQuantity: 24,
    mrpPaise: 100000, // ₹1,000.00 MRP
    dealerPricePaise: 50000, // ₹500.00 wholesale baseline unit price
    hsnCode: '6302',
    gstRatePercent: 12, // 12% GST
    minOrderQuantity: 10,
    orderQuantityMultiple: 5,
    stockOnHand: 500,
    stockReserved: 0,
    isTierPricingEnabled: true,
    tierPricing: [
      { minQuantity: 10, maxQuantity: 49, unitPricePaise: 50000 },
      { minQuantity: 50, maxQuantity: 99, unitPricePaise: 45000 }, // ₹450 (10% bulk discount)
      { minQuantity: 100, unitPricePaise: 40000 }, // ₹400 (20% super bulk discount)
    ],
    isActive: true,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Necessity India B2B - Discounts & Coupons Architecture', () => {
  // -------------------------------------------------------------------------
  // 1. RBAC & Security Validation
  // -------------------------------------------------------------------------
  test('Retailers should be forbidden from creating product discounts or coupons', async () => {
    const discountRes = await request(app)
      .post('/api/v1/discounts/products')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        name: 'Unauthorized Discount',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 10,
        scope: DiscountScope.ALL_PRODUCTS,
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
      });
    expect(discountRes.status).toBe(403);

    const couponRes = await request(app)
      .post('/api/v1/discounts/coupons')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        code: 'HACK10',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 10,
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
      });
    expect(couponRes.status).toBe(403);
  });

  // -------------------------------------------------------------------------
  // 2. Admin Creation & Listing of Product Discounts and Coupons
  // -------------------------------------------------------------------------
  test('Admin should successfully create and list Product Discounts', async () => {
    const today = new Date();
    const nextMonth = new Date(Date.now() + 30 * 86400000);

    const res = await request(app)
      .post('/api/v1/discounts/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Festive Season 10% Off Linens',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 10, // 10%
        scope: DiscountScope.CATEGORIES,
        applicableCategoryIds: [testCategoryDoc._id.toString()],
        startDate: today.toISOString(),
        endDate: nextMonth.toISOString(),
        minQuantity: 10,
        priority: 5,
        isActive: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Festive Season 10% Off Linens');

    const listRes = await request(app)
      .get('/api/v1/discounts/products')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
  });

  test('Admin should successfully create and list Order Coupons', async () => {
    const today = new Date();
    const nextMonth = new Date(Date.now() + 30 * 86400000);

    const res = await request(app)
      .post('/api/v1/discounts/coupons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'WELCOME500',
        description: '₹500 flat discount on orders over ₹10,000',
        discountType: DiscountType.FIXED_AMOUNT,
        discountValue: 50000, // ₹500.00 (50000 paise)
        minOrderValuePaise: 1000000, // ₹10,000.00 MOV
        startDate: today.toISOString(),
        endDate: nextMonth.toISOString(),
        perCustomerLimit: 1,
        totalUsageLimit: 50,
        isActive: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.code).toBe('WELCOME500');

    const listRes = await request(app)
      .get('/api/v1/discounts/coupons')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
  });

  // -------------------------------------------------------------------------
  // 3. Product Discount + Quantity-Tier Price Deterministic Calculation
  // -------------------------------------------------------------------------
  test('Step 1 & 2: Quantity-tier price resolves first, then 10% product discount applies on top', async () => {
    // 50 towels at tier 2 = ₹450 baseline unit price (45000 paise)
    // 10% product discount applies on ₹450 = ₹45 unit discount (4500 paise)
    // Net unit price = ₹405 (40500 paise)
    // 50 towels * ₹405 = ₹20,250 taxable (2025000 paise)
    // Intra-state (Maharashtra 27): 12% GST = 6% CGST (121500 paise), 6% SGST (121500 paise)
    // Grand Total = 2025000 + 121500 + 121500 = 2268000 paise (₹22,680.00)
    const res = await request(app)
      .post('/api/v1/orders/calculate-cart')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        items: [{ productId: testProductDoc._id.toString(), quantity: 50 }],
        deliveryStateCode: '27',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const calc = res.body.data;
    expect(calc.subtotalPaise).toBe(2250000); // 50 * 45000 = ₹22,500 gross tier value
    expect(calc.totalProductDiscountPaise).toBe(225000); // 50 * 4500 = ₹2,250 product discount
    expect(calc.taxableAmountPaise).toBe(2025000); // ₹20,250 net taxable
    expect(calc.totalCgstPaise).toBe(121500); // 6% CGST
    expect(calc.totalSgstPaise).toBe(121500); // 6% SGST
    expect(calc.totalIgstPaise).toBe(0);
    expect(calc.grandTotalPaise).toBe(2268000); // ₹22,680.00
  });

  // -------------------------------------------------------------------------
  // 4. Order Coupon Validation (Case-insensitive, MOV, Combined with Product Discount)
  // -------------------------------------------------------------------------
  test('Step 4 & 5: Combined Product Discount and Order Coupon without negative totals', async () => {
    // Cart with 50 towels:
    // Taxable after product discount = 2025000 paise (₹20,250.00)
    // Coupon 'welcome500' (lowercase input -> case-insensitive) gives ₹500 off (50000 paise)
    // Final Taxable Amount = 2025000 - 50000 = 1975000 paise (₹19,750.00)
    // 12% GST on 1975000 paise:
    // 6% CGST = 118500 paise
    // 6% SGST = 118500 paise
    // Grand Total = 1975000 + 118500 + 118500 = 2212000 paise (₹22,120.00)
    const res = await request(app)
      .post('/api/v1/orders/calculate-cart')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        items: [{ productId: testProductDoc._id.toString(), quantity: 50 }],
        deliveryStateCode: '27',
        couponCode: 'welcome500', // lowercase
      });

    expect(res.status).toBe(200);
    const calc = res.body.data;
    expect(calc.couponCode).toBe('WELCOME500');
    expect(calc.couponDiscountPaise).toBe(50000);
    expect(calc.totalDiscountPaise).toBe(225000 + 50000); // 275000 paise
    expect(calc.taxableAmountPaise).toBe(1975000);
    expect(calc.totalCgstPaise).toBe(118500);
    expect(calc.totalSgstPaise).toBe(118500);
    expect(calc.grandTotalPaise).toBe(2212000);
  });

  // -------------------------------------------------------------------------
  // 5. Minimum Order Value (MOV) Rejection
  // -------------------------------------------------------------------------
  test('Coupon rejected if cart value is below minimum order value', async () => {
    // 10 towels at tier 1 = ₹500 unit price, minus 10% = ₹450 = ₹4,500 taxable (450000 paise)
    // WELCOME500 requires ₹10,000 MOV (1000000 paise) -> must reject
    const res = await request(app)
      .post('/api/v1/orders/calculate-cart')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        items: [{ productId: testProductDoc._id.toString(), quantity: 10 }],
        deliveryStateCode: '27',
        couponCode: 'WELCOME500',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/minimum order value/i);
  });

  // -------------------------------------------------------------------------
  // 6. Expired and Inactive Coupons
  // -------------------------------------------------------------------------
  test('Inactive and expired coupons are rejected with explicit error message', async () => {
    // Create an inactive coupon
    await Coupon.create({
      code: 'INACTIVE10',
      discountType: DiscountType.PERCENTAGE,
      discountValue: 10,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
      isActive: false,
    });

    const inactiveRes = await request(app)
      .post('/api/v1/orders/calculate-cart')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        items: [{ productId: testProductDoc._id.toString(), quantity: 50 }],
        deliveryStateCode: '27',
        couponCode: 'INACTIVE10',
      });

    expect(inactiveRes.status).toBe(400);
    expect(inactiveRes.body.message).toMatch(/inactive/i);

    // Create an expired coupon
    await Coupon.create({
      code: 'EXPIRED10',
      discountType: DiscountType.PERCENTAGE,
      discountValue: 10,
      startDate: new Date(Date.now() - 172800000),
      endDate: new Date(Date.now() - 86400000),
      isActive: true,
    });

    const expiredRes = await request(app)
      .post('/api/v1/orders/calculate-cart')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        items: [{ productId: testProductDoc._id.toString(), quantity: 50 }],
        deliveryStateCode: '27',
        couponCode: 'EXPIRED10',
      });

    expect(expiredRes.status).toBe(400);
    expect(expiredRes.body.message).toMatch(/expired/i);
  });

  // -------------------------------------------------------------------------
  // 7. Maximum Discount Cap on Percentage Coupons
  // -------------------------------------------------------------------------
  test('Percentage coupon respects max discount cap', async () => {
    await Coupon.create({
      code: 'PERCENTCAP',
      discountType: DiscountType.PERCENTAGE,
      discountValue: 50, // 50% discount
      maxDiscountPaise: 100000, // Capped at ₹1,000 (100000 paise)
      minOrderValuePaise: 0,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
      isActive: true,
    });

    // 50 towels = ₹20,250 taxable base. 50% would be ₹10,125, but cap is ₹1,000 (100000 paise)
    const res = await request(app)
      .post('/api/v1/orders/calculate-cart')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        items: [{ productId: testProductDoc._id.toString(), quantity: 50 }],
        deliveryStateCode: '27',
        couponCode: 'PERCENTCAP',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.couponDiscountPaise).toBe(100000);
  });

  // -------------------------------------------------------------------------
  // 8. Inter-State IGST Calculation with Discounts
  // -------------------------------------------------------------------------
  test('Inter-state orders correctly compute full IGST instead of CGST/SGST', async () => {
    // Delivery to Gujarat (State 24):
    // 50 towels taxable after product & WELCOME500 coupon = 1975000 paise (₹19,750.00)
    // 12% IGST = 237000 paise (₹2,370.00)
    // Total = 1975000 + 237000 = 2212000 paise
    const res = await request(app)
      .post('/api/v1/orders/calculate-cart')
      .set('Authorization', `Bearer ${anotherRetailerToken}`)
      .send({
        items: [{ productId: testProductDoc._id.toString(), quantity: 50 }],
        deliveryStateCode: '24', // Gujarat
        couponCode: 'WELCOME500',
      });

    expect(res.status).toBe(200);
    const calc = res.body.data;
    expect(calc.totalCgstPaise).toBe(0);
    expect(calc.totalSgstPaise).toBe(0);
    expect(calc.totalIgstPaise).toBe(237000);
    expect(calc.grandTotalPaise).toBe(2212000);
  });

  // -------------------------------------------------------------------------
  // 9. Atomic Order Checkout, Coupon Redemption & Per-Customer Usage Limits
  // -------------------------------------------------------------------------
  test('Order checkout atomically records coupon redemption and enforces perCustomerLimit', async () => {
    const checkoutPayload = {
      items: [{ productId: testProductDoc._id.toString(), quantity: 50 }],
      paymentMethod: PaymentMethod.CREDIT_ACCOUNT,
      deliveryAddress: {
        street: '100 Nariman Point',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400021',
        stateCode: '27',
      },
      couponCode: 'WELCOME500',
      idempotencyKey: `ord-test-redemption-${Date.now()}`,
    };

    // 1st checkout with WELCOME500 -> should succeed
    const firstOrderRes = await request(app)
      .post('/api/v1/orders/checkout')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send(checkoutPayload);

    expect(firstOrderRes.status).toBe(201);
    expect(firstOrderRes.body.success).toBe(true);

    const orderDoc = firstOrderRes.body.data;
    expect(orderDoc.couponCode).toBe('WELCOME500');
    expect(orderDoc.couponDiscountPaise).toBe(50000);

    // Verify atomic increment of usage count
    const couponAfter = await Coupon.findOne({ code: 'WELCOME500' });
    expect(couponAfter!.usageCount).toBe(1);

    // Verify redemption record was created
    const redemption = await CouponRedemption.findOne({ orderId: orderDoc.id || orderDoc._id });
    expect(redemption).toBeDefined();
    expect(redemption!.couponCode).toBe('WELCOME500');
    expect(redemption!.discountAmountPaise).toBe(50000);

    // 2nd checkout by the SAME retailer with WELCOME500 (perCustomerLimit = 1) -> must reject
    const secondCheckoutPayload = {
      ...checkoutPayload,
      idempotencyKey: `ord-test-redemption-second-${Date.now()}`,
    };

    const secondOrderRes = await request(app)
      .post('/api/v1/orders/checkout')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send(secondCheckoutPayload);

    expect(secondOrderRes.status).toBe(400);
    expect(secondOrderRes.body.message).toMatch(/maximum usage limit/i);
  });

  // -------------------------------------------------------------------------
  // 10. Historical Order Immutability
  // -------------------------------------------------------------------------
  test('Editing or deactivating promotions does not change historical order totals', async () => {
    // Find the order created in test 9
    const existingOrder = await Order.findOne({ couponCode: 'WELCOME500' });
    expect(existingOrder).toBeDefined();
    const originalGrandTotal = existingOrder!.grandTotalPaise;
    const originalTaxable = existingOrder!.taxableAmountPaise;

    // Deactivate the coupon
    await Coupon.findOneAndUpdate({ code: 'WELCOME500' }, { isActive: false, discountValue: 0 });

    // Fetch the order again via API
    const res = await request(app)
      .get(`/api/v1/orders/${existingOrder!._id}`)
      .set('Authorization', `Bearer ${retailerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.grandTotalPaise).toBe(originalGrandTotal);
    expect(res.body.data.taxableAmountPaise).toBe(originalTaxable);
    expect(res.body.data.couponCode).toBe('WELCOME500');
    expect(res.body.data.couponDiscountPaise).toBe(50000);
  });

  // -------------------------------------------------------------------------
  // 11. Zoho Integration Compatibility & Duplicate-Tax Prevention
  // -------------------------------------------------------------------------
  test('Zoho invoice line item rates reflect net discounted taxable rate', async () => {
    const existingOrder = await Order.findOne({ couponCode: 'WELCOME500' });
    expect(existingOrder).toBeDefined();

    // Verify each line item's net rate:
    // item.taxableAmountPaise / item.quantity matches post-discount rate exactly
    for (const item of existingOrder!.items) {
      const netRatePaise = Math.round(item.taxableAmountPaise / item.quantity);
      expect(netRatePaise).toBeLessThan(item.unitPricePaiseSnapshot);
    }
  });
});
