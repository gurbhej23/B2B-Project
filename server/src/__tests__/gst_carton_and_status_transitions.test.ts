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
import {
  UserRole,
  AccountStatus,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  isValidOrderStatusTransition,
  isRolePermittedForOrderTransition,
} from '@necessity/shared';

let mongoServer: MongoMemoryServer;
let app: any;
let adminToken: string;
let adminUserDoc: any;
let retailerToken: string;
let retailerUserDoc: any;
let retailerDoc: any;
let testCategoryDoc: any;

jest.setTimeout(60000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  app = createApp();

  // 1. Create Super Admin
  await request(app).post('/api/v1/auth/register').send({
    businessName: 'Necessity HQ',
    contactPerson: 'Admin Lead',
    phone: '+919999900001',
    email: 'admin.lead@necessity.in',
    password: 'Password123!',
    billingAddress: {
      street: 'Admin Blvd',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      stateCode: '27',
    },
    termsAccepted: true,
  });

  adminUserDoc = await User.findOne({ phone: '+919999900001' });
  adminUserDoc.role = UserRole.SUPER_ADMIN;
  adminUserDoc.accountStatus = AccountStatus.ACTIVE;
  await adminUserDoc.save();

  const adminLogin = await request(app).post('/api/v1/auth/login').send({
    identifier: 'admin.lead@necessity.in',
    password: 'Password123!',
  });
  adminToken = adminLogin.body.data.tokens.accessToken;

  // 2. Create Retailer
  const retReg = await request(app).post('/api/v1/auth/register').send({
    businessName: 'Apex Traders',
    contactPerson: 'Apex Owner',
    phone: '+919999900002',
    email: 'apex@traders.in',
    password: 'Password123!',
    billingAddress: {
      street: 'Market St',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
      stateCode: '27',
    },
    termsAccepted: true,
  });

  retailerUserDoc = await User.findOne({ phone: '+919999900002' });
  retailerUserDoc.accountStatus = AccountStatus.ACTIVE;
  await retailerUserDoc.save();

  retailerDoc = await Retailer.findOne({ userId: retailerUserDoc._id });
  retailerDoc.creditLimitPaise = 5000000; // 50,000 INR
  retailerDoc.isActive = true;
  await retailerDoc.save();

  const retLogin = await request(app).post('/api/v1/auth/login').send({
    identifier: 'apex@traders.in',
    password: 'Password123!',
  });
  retailerToken = retLogin.body.data.tokens.accessToken;

  // 3. Create Category
  testCategoryDoc = await Category.create({
    name: 'Beverages',
    slug: 'beverages',
    displayOrder: 1,
    isActive: true,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('1. Product Management without GST and Carton Fields', () => {
  let createdProductId: string;

  test('Admin can create product without providing gstRatePercent or caseQuantity', async () => {
    const productPayload = {
      name: 'Organic Mango Juice 1L',
      sku: 'OMJ-1000',
      description: 'Pure Organic Mango Juice',
      categoryId: testCategoryDoc._id.toString(),
      brand: 'Necessity Fresh',
      hsnCode: '22029920',
      mrpPaise: 12000, // 120 INR
      dealerPricePaise: 9500, // 95 INR
      stockOnHand: 200,
      lowStockThreshold: 20,
      uom: 'PCS',
      packSize: 1,
      minOrderQuantity: 1,
      orderQuantityMultiple: 1,
      isActive: true,
      // Note: gstRatePercent and caseQuantity are intentionally omitted
    };

    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(productPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Organic Mango Juice 1L');
    createdProductId = res.body.data.id || res.body.data._id;

    // Verify MongoDB document defaults: gstRatePercent defaults to 18, caseQuantity defaults to 1
    const savedDoc = await Product.findById(createdProductId);
    expect(savedDoc).toBeDefined();
    expect(savedDoc?.mrpPaise).toBe(12000);
    expect(savedDoc?.dealerPricePaise).toBe(9500);
    expect(savedDoc?.gstRatePercent).toBe(18);
    expect(savedDoc?.caseQuantity).toBe(1);
    expect(savedDoc?.uom).toBe('PCS');
  });

  test('Admin can edit product without sending gstRatePercent or caseQuantity, preserving pricing', async () => {
    const updatePayload = {
      name: 'Organic Mango Juice 1L Premium',
      mrpPaise: 12500,
      dealerPricePaise: 9800,
      stockOnHand: 250,
      lowStockThreshold: 25,
    };

    const res = await request(app)
      .patch(`/api/v1/products/${createdProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(updatePayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Organic Mango Juice 1L Premium');

    const updatedDoc = await Product.findById(createdProductId);
    expect(updatedDoc?.mrpPaise).toBe(12500);
    expect(updatedDoc?.dealerPricePaise).toBe(9800);
    expect(updatedDoc?.gstRatePercent).toBe(18);
    expect(updatedDoc?.caseQuantity).toBe(1);
  });
});

describe('2. Ordering and Billing: Unit Ordering and Backend Tax Calculation Fallback', () => {
  let juiceProduct: any;

  beforeAll(async () => {
    juiceProduct = await Product.create({
      name: 'Cold Pressed Orange Juice 500ml',
      sku: 'CPO-500',
      description: 'Cold pressed orange juice bottle',
      brand: 'Necessity Fresh',
      categoryId: testCategoryDoc._id,
      hsnCode: '22029920',
      mrpPaise: 8000,
      dealerPricePaise: 6000, // 60 INR
      stockOnHand: 100,
      stockReserved: 0,
      lowStockThreshold: 10,
      uom: 'PCS',
      packSize: 1,
      minOrderQuantity: 1,
      orderQuantityMultiple: 1, // Individual piece ordering without carton constraint
      isActive: true,
      // gstRatePercent intentionally omitted, triggers default 18%
    });
  });

  test('Customer can order by individual piece (quantity: 5) without carton multiple restrictions', async () => {
    const calcRes = await request(app)
      .post('/api/v1/orders/calculate-cart')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        items: [{ productId: juiceProduct._id.toString(), quantity: 5 }],
      });

    expect(calcRes.status).toBe(200);
    expect(calcRes.body.success).toBe(true);
    const summary = calcRes.body.data;

    // Subtotal: 5 * 6000 = 30000 paise (300 INR)
    expect(summary.subtotalPaise).toBe(30000);
    // Since both buyer and seller are in Maharashtra (stateCode 27), tax is split into CGST (9%) and SGST (9%)
    // 18% of 30000 = 5400 paise -> CGST 2700, SGST 2700
    expect(summary.totalCgstPaise).toBe(2700);
    expect(summary.totalSgstPaise).toBe(2700);
    expect(summary.totalIgstPaise).toBe(0);
    expect(summary.grandTotalPaise).toBe(35400); // 354 INR
  });

  test('Placing order creates line items with tax breakdown and preserves financial integrity', async () => {
    const checkoutRes = await request(app)
      .post('/api/v1/orders/checkout')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        items: [{ productId: juiceProduct._id.toString(), quantity: 3 }],
        paymentMethod: PaymentMethod.CREDIT_ACCOUNT,
        deliveryAddress: {
          street: 'Market St',
          city: 'Pune',
          state: 'Maharashtra',
          pincode: '411001',
          stateCode: '27',
        },
        idempotencyKey: 'idem-test-order-gst-001',
      });

    expect(checkoutRes.status).toBe(201);
    const orderData = checkoutRes.body.data;
    expect([OrderStatus.PENDING, OrderStatus.SUBMITTED]).toContain(orderData.status);
    expect(orderData.items[0].quantity).toBe(3);
    expect(orderData.items[0].gstRatePercentSnapshot).toBe(18);
    expect(orderData.subtotalPaise).toBe(18000);
    expect(orderData.totalCgstPaise).toBe(1620); // 9% of 180 INR = 16.20 INR = 1620 paise
    expect(orderData.totalSgstPaise).toBe(1620); // 9% of 180 INR = 16.20 INR = 1620 paise
    expect(orderData.grandTotalPaise).toBe(21240);
  });
});

describe('3. Order Status State Machine and Permissions', () => {
  test('Shared status transition matrix enforces valid transitions', () => {
    // Valid transitions
    expect(isValidOrderStatusTransition(OrderStatus.SUBMITTED, OrderStatus.APPROVED)).toBe(true);
    expect(isValidOrderStatusTransition(OrderStatus.APPROVED, OrderStatus.PROCESSING)).toBe(true);
    expect(isValidOrderStatusTransition(OrderStatus.PROCESSING, OrderStatus.DISPATCHED)).toBe(true);
    expect(isValidOrderStatusTransition(OrderStatus.DISPATCHED, OrderStatus.DELIVERED)).toBe(true);
    expect(isValidOrderStatusTransition(OrderStatus.SUBMITTED, OrderStatus.CANCELLED)).toBe(true);

    // Invalid backwards transitions (strictly prohibited by sequential state machine)
    expect(isValidOrderStatusTransition(OrderStatus.DELIVERED, OrderStatus.PROCESSING)).toBe(false);
    expect(isValidOrderStatusTransition(OrderStatus.CANCELLED, OrderStatus.APPROVED)).toBe(false);
    expect(isValidOrderStatusTransition(OrderStatus.APPROVED, OrderStatus.SUBMITTED)).toBe(false);
  });

  test('Role permissions restrict order transitions', () => {
    // Retailer can cancel SUBMITTED order, but cannot approve, process, dispatch or deliver
    expect(isRolePermittedForOrderTransition(UserRole.RETAILER, OrderStatus.SUBMITTED, OrderStatus.CANCELLED)).toBe(true);
    expect(isRolePermittedForOrderTransition(UserRole.RETAILER, OrderStatus.SUBMITTED, OrderStatus.APPROVED)).toBe(false);
    expect(isRolePermittedForOrderTransition(UserRole.RETAILER, OrderStatus.PROCESSING, OrderStatus.DISPATCHED)).toBe(false);

    // Admin can transition across all operational workflows
    expect(isRolePermittedForOrderTransition(UserRole.SUPER_ADMIN, OrderStatus.SUBMITTED, OrderStatus.APPROVED)).toBe(true);
    expect(isRolePermittedForOrderTransition(UserRole.SUPER_ADMIN, OrderStatus.APPROVED, OrderStatus.PROCESSING)).toBe(true);
    expect(isRolePermittedForOrderTransition(UserRole.SUPER_ADMIN, OrderStatus.PROCESSING, OrderStatus.DISPATCHED)).toBe(true);
    expect(isRolePermittedForOrderTransition(UserRole.SUPER_ADMIN, OrderStatus.DISPATCHED, OrderStatus.DELIVERED)).toBe(true);
  });

  test('Order status update endpoint blocks invalid transitions and enforces state machine', async () => {
    const order = await Order.create({
      orderNumber: 'ORD-TEST-STATE-01',
      retailerId: retailerDoc._id,
      retailerName: retailerDoc.businessName,
      placedByUserId: retailerUserDoc._id,
      placedByName: retailerUserDoc.name,
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          productNameSnapshot: 'Test Item',
          skuSnapshot: 'TI-01',
          hsnCodeSnapshot: '2202',
          quantity: 2,
          unitPricePaiseSnapshot: 5000,
          appliedDiscountPaise: 0,
          taxableAmountPaise: 10000,
          gstRatePercentSnapshot: 18,
          cgstPaise: 900,
          sgstPaise: 900,
          igstPaise: 0,
          lineTotalPaise: 11800,
        },
      ],
      subtotalPaise: 10000,
      totalDiscountPaise: 0,
      taxableAmountPaise: 10000,
      totalCgstPaise: 900,
      totalSgstPaise: 900,
      totalIgstPaise: 0,
      deliveryFeePaise: 0,
      grandTotalPaise: 11800,
      deliveryAddress: {
        street: 'Market St',
        city: 'Pune',
        state: 'Maharashtra',
        pincode: '411001',
        stateCode: '27',
      },
      paymentMethod: PaymentMethod.CREDIT_ACCOUNT,
      paymentStatus: PaymentStatus.PENDING,
      status: OrderStatus.SUBMITTED,
    });

    // 1. Valid transition from SUBMITTED to APPROVED should succeed
    const approveRes = await request(app)
      .patch(`/api/v1/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: OrderStatus.APPROVED, note: 'Approved by admin' });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe(OrderStatus.APPROVED);

    // 2. Backward transition from APPROVED to SUBMITTED is strictly blocked with 400
    const invalidBackwardRes = await request(app)
      .patch(`/api/v1/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: OrderStatus.SUBMITTED, note: 'Going backward' });

    expect(invalidBackwardRes.status).toBe(400);
    expect(invalidBackwardRes.body.success).toBe(false);

    // 3. Retailer cannot change status to PROCESSING (403 Forbidden)
    const retailerForbiddenRes = await request(app)
      .patch(`/api/v1/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({ status: OrderStatus.PROCESSING });

    expect(retailerForbiddenRes.status).toBe(403);

    // 4. Admin advances to PROCESSING -> DISPATCHED -> DELIVERED
    await request(app)
      .patch(`/api/v1/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: OrderStatus.PROCESSING });

    await request(app)
      .patch(`/api/v1/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: OrderStatus.DISPATCHED });

    const deliverRes = await request(app)
      .patch(`/api/v1/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: OrderStatus.DELIVERED });

    expect(deliverRes.status).toBe(200);
    expect(deliverRes.body.data.status).toBe(OrderStatus.DELIVERED);

    // 5. Terminal state: DELIVERED cannot transition to CANCELLED or SUBMITTED
    const terminalRes = await request(app)
      .patch(`/api/v1/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: OrderStatus.CANCELLED });

    expect(terminalRes.status).toBe(400);
  });
});

describe('4. Customer Status Rules and Safe Archival', () => {
  test('Pending customer cannot place orders', async () => {
    // Create new customer who is PENDING
    const regRes = await request(app).post('/api/v1/auth/register').send({
      businessName: 'Pending Store',
      contactPerson: 'Pending Owner',
      phone: '+919876500001',
      email: 'pending.store@example.com',
      password: 'Password123!',
      billingAddress: {
        street: 'Test St',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        stateCode: '27',
      },
      termsAccepted: true,
    });

    const pendingUser = await User.findOne({ phone: '+919876500001' });
    expect(pendingUser?.accountStatus).toBe(AccountStatus.PENDING);

    // 1. Pending customer cannot log in (blocked with 403 awaiting approval)
    const pendingLogin = await request(app).post('/api/v1/auth/login').send({
      identifier: 'pending.store@example.com',
      password: 'Password123!',
    });
    if (pendingLogin.status === 200) {
      expect(pendingLogin.body.data.isPendingApproval).toBe(true);
    } else {
      expect(pendingLogin.status).toBe(403);
      expect(pendingLogin.body.message).toContain('approval');
    }

    // 2. Pending customer token cannot place orders (blocked with 403)
    const freshPendingUser = await User.findById(pendingUser!._id);
    const { TokenService } = require('../modules/auth/token.service');
    const pendingToken =
      pendingLogin.body.data?.tokens?.accessToken ||
      TokenService.generateAccessToken({
        sub: freshPendingUser!._id.toString(),
        role: UserRole.RETAILER,
        sessionId: freshPendingUser?.currentRefreshSessionId,
      });

    const dummyProd = await Product.findOne({ isActive: true });
    const orderRes = await request(app)
      .post('/api/v1/orders/checkout')
      .set('Authorization', `Bearer ${pendingToken}`)
      .send({
        items: [{ productId: dummyProd!._id.toString(), quantity: 1 }],
        paymentMethod: PaymentMethod.CREDIT_ACCOUNT,
        deliveryAddress: {
          street: 'Test St',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          stateCode: '27',
        },
        idempotencyKey: 'pending-order-attempt-001',
      });

    expect(orderRes.status).toBe(403);
  });

  test('Customer with order history cannot be deleted; must be safely archived', async () => {
    // retailerDoc has placed orders earlier in tests
    const deleteRes = await request(app)
      .delete(`/api/v1/customers/${retailerDoc._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);
    expect(deleteRes.body.data.action).toBe('archived');

    // Verify retailer document still exists in MongoDB but is marked archived and inactive
    const checkRetailer = await Retailer.findById(retailerDoc._id);
    expect(checkRetailer).toBeDefined();
    expect(checkRetailer?.isArchived).toBe(true);
    expect(checkRetailer?.isActive).toBe(false);

    // Verify linked user accountStatus is SUSPENDED
    const checkUser = await User.findById(retailerDoc.userId);
    expect(checkUser?.accountStatus).toBe(AccountStatus.SUSPENDED);

    // Verify historical orders remain untouched
    const orderCount = await Order.countDocuments({ retailerId: retailerDoc._id });
    expect(orderCount).toBeGreaterThan(0);
  });

  test('Disabled customer loses access to operations and re-enabling restores access cleanly', async () => {
    // Try to access profile or list with archived/disabled user
    const disabledAccessRes = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${retailerToken}`);

    // Disabled users receive 403 Forbidden
    expect(disabledAccessRes.status).toBe(403);

    // Re-enable customer via Admin endpoint
    const reEnableRes = await request(app)
      .patch(`/api/v1/customers/${retailerDoc._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true, reason: 'Restoring retailer account' });

    expect(reEnableRes.status).toBe(200);
    expect(reEnableRes.body.data.isActive).toBe(true);

    const restoredRetailer = await Retailer.findById(retailerDoc._id);
    expect(restoredRetailer?.isActive).toBe(true);

    const restoredUser = await User.findById(retailerDoc.userId);
    expect(restoredUser?.accountStatus).toBe(AccountStatus.ACTIVE);
  });
});
