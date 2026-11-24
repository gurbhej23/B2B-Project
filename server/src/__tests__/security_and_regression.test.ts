import request from 'supertest';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { User } from '../modules/users/user.model';
import { Retailer } from '../modules/retailers/retailer.model';
import { Category } from '../modules/products/category.model';
import { Product } from '../modules/products/product.model';
import { Order } from '../modules/orders/order.model';
import { PaymentTransaction } from '../modules/payments/payment.model';
import { ENV } from '../config/env';
import {
  UserRole,
  AccountStatus,
  CreditStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@necessity/shared';

let mongoServer: MongoMemoryServer;
let app: any;

let adminToken: string;
let salesman1Token: string;
let salesman1User: any;
let salesman2Token: string;
let salesman2User: any;

let retailer1Token: string;
let retailer1Doc: any;
let retailer2Token: string;
let retailer2Doc: any;

let testProduct: any;

jest.setTimeout(60000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  app = createApp();

  // 1. Admin
  await request(app).post('/api/v1/auth/register').send({
    businessName: 'Necessity Admin HQ',
    contactPerson: 'Super Admin',
    phone: '+919999900000',
    email: 'superadmin@necessityindia.com',
    password: 'AdminPassword123!',
    billingAddress: {
      street: 'HQ Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      stateCode: '27',
    },
    termsAccepted: true,
  });

  const adminUser = await User.findOne({ phone: '+919999900000' });
  adminUser!.role = UserRole.SUPER_ADMIN;
  adminUser!.accountStatus = AccountStatus.ACTIVE;
  await adminUser!.save();

  const adminLogin = await request(app).post('/api/v1/auth/login').send({
    identifier: 'superadmin@necessityindia.com',
    password: 'AdminPassword123!',
  });
  adminToken = adminLogin.body.data.tokens.accessToken;

  // 2. Salesman 1
  salesman1User = await User.create({
    name: 'Salesman South',
    phone: '+919811100001',
    email: 'sales1@necessityindia.com',
    passwordHash: adminUser!.passwordHash,
    role: UserRole.SALESMAN,
    accountStatus: AccountStatus.ACTIVE,
  });
  const sales1Login = await request(app).post('/api/v1/auth/login').send({
    identifier: '+919811100001',
    password: 'AdminPassword123!',
  });
  salesman1Token = sales1Login.body.data.tokens.accessToken;

  // 3. Salesman 2
  salesman2User = await User.create({
    name: 'Salesman North',
    phone: '+919811100002',
    email: 'sales2@necessityindia.com',
    passwordHash: adminUser!.passwordHash,
    role: UserRole.SALESMAN,
    accountStatus: AccountStatus.ACTIVE,
  });
  const sales2Login = await request(app).post('/api/v1/auth/login').send({
    identifier: '+919811100002',
    password: 'AdminPassword123!',
  });
  salesman2Token = sales2Login.body.data.tokens.accessToken;

  // 4. Retailer 1 (assigned to Salesman 1)
  await request(app).post('/api/v1/auth/register').send({
    businessName: 'Retailer South Hotel Supplies',
    contactPerson: 'South Buyer',
    phone: '+919822200001',
    email: 'south@retailer.com',
    password: 'RetailerPassword123!',
    billingAddress: {
      street: 'South Road',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
      stateCode: '27',
    },
    termsAccepted: true,
  });

  const ret1User = await User.findOne({ phone: '+919822200001' });
  retailer1Doc = await Retailer.findById(ret1User!.retailerProfileId);
  retailer1Doc.assignedSalesmanId = salesman1User._id;
  retailer1Doc.creditLimitPaise = 5000000; // 50,000 INR
  await retailer1Doc.save();

  ret1User!.accountStatus = AccountStatus.ACTIVE;
  await ret1User!.save();

  const ret1Login = await request(app).post('/api/v1/auth/login').send({
    identifier: '+919822200001',
    password: 'RetailerPassword123!',
  });
  retailer1Token = ret1Login.body.data.tokens.accessToken;

  // 5. Retailer 2 (assigned to Salesman 2)
  await request(app).post('/api/v1/auth/register').send({
    businessName: 'Retailer North Linen Corp',
    contactPerson: 'North Buyer',
    phone: '+919822200002',
    email: 'north@retailer.com',
    password: 'RetailerPassword123!',
    billingAddress: {
      street: 'North Road',
      city: 'Nashik',
      state: 'Maharashtra',
      pincode: '422001',
      stateCode: '27',
    },
    termsAccepted: true,
  });

  const ret2User = await User.findOne({ phone: '+919822200002' });
  retailer2Doc = await Retailer.findById(ret2User!.retailerProfileId);
  retailer2Doc.assignedSalesmanId = salesman2User._id;
  retailer2Doc.creditLimitPaise = 10000000; // 100,000 INR
  await retailer2Doc.save();

  ret2User!.accountStatus = AccountStatus.ACTIVE;
  await ret2User!.save();

  const ret2Login = await request(app).post('/api/v1/auth/login').send({
    identifier: '+919822200002',
    password: 'RetailerPassword123!',
  });
  retailer2Token = ret2Login.body.data.tokens.accessToken;

  // 6. Seed Product
  const cat = await Category.create({
    name: 'Institutional Linens',
    slug: 'institutional-linens',
    description: 'Commercial supplies',
    sortOrder: 1,
    isActive: true,
  });

  testProduct = await Product.create({
    sku: 'LIN-TOWEL-001',
    name: 'Luxury Bath Towel 600 GSM',
    description: 'Commercial 600 GSM 100% cotton institutional bath towel',
    categoryId: cat._id,
    categoryName: cat.name,
    brand: 'Necessity Linens',
    images: [{ url: 'https://example.com/towel.jpg', isPrimary: true }],
    hsnCode: '6302',
    gstRatePercent: 12,
    mrpPaise: 25000,
    dealerPricePaise: 20000, // 200 INR
    stockOnHand: 100,
    stockReserved: 0,
    minOrderQuantity: 10,
    orderQuantityMultiple: 5,
    uom: 'piece',
    packSize: 10,
    caseQuantity: 20,
    isActive: true,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Section 12: Production Security & Master Regression Test Suite', () => {
  // 1. CORS allowlist enforcement
  describe('CORS Allowlist Enforcement', () => {
    it('should reject requests with unauthorized browser origin with 403', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'https://malicious-phishing-site.com');

      expect(res.status).toBe(403);
      const errMsg = res.body.message || res.body.error?.message;
      expect(errMsg).toContain('CORS policy violation');
    });

    it('should allow requests with permitted browser origin', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:5173');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });

    it('should allow legitimate requests without Origin header (mobile apps, backend services)', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('healthy');
    });
  });

  // 2. Retailer IDOR & Ownership Protection
  describe('Retailer Profile IDOR Protection', () => {
    it('Retailer 1 should be forbidden from accessing Retailer 2 profile', async () => {
      const res = await request(app)
        .get(`/api/v1/retailers/${retailer2Doc._id}`)
        .set('Authorization', `Bearer ${retailer1Token}`);

      expect(res.status).toBe(403);
      const errMsg = res.body.message || res.body.error?.message;
      expect(errMsg).toContain('You do not have permission to view other retailers');
    });

    it('Retailer 1 should succeed when accessing their own profile', async () => {
      const res = await request(app)
        .get(`/api/v1/retailers/${retailer1Doc._id}`)
        .set('Authorization', `Bearer ${retailer1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.businessName).toBe('Retailer South Hotel Supplies');
    });
  });

  // 3. Cross-Territory and Cross-Salesman Scoping
  describe('Salesman Cross-Territory Isolation', () => {
    it('Salesman 1 should be forbidden from accessing Retailer 2 (assigned to Salesman 2)', async () => {
      const res = await request(app)
        .get(`/api/v1/retailers/${retailer2Doc._id}`)
        .set('Authorization', `Bearer ${salesman1Token}`);

      expect(res.status).toBe(403);
      const errMsg = res.body.message || res.body.error?.message;
      expect(errMsg).toContain('outside your assigned territory');
    });

    it('Salesman 1 should be forbidden from booking an order for unassigned Retailer 2', async () => {
      const res = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${salesman1Token}`)
        .send({
          retailerId: retailer2Doc._id.toString(),
          items: [{ productId: testProduct._id.toString(), quantity: 10 }],
          paymentMethod: PaymentMethod.CREDIT_ACCOUNT,
          deliveryAddress: {
            street: 'Test St',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400001',
            stateCode: '27',
          },
          idempotencyKey: `idem-sales-unauth-${Date.now()}`,
        });

      expect(res.status).toBe(403);
      const errMsg = res.body.message || res.body.error?.message;
      expect(errMsg).toContain('not authorized to book orders for this retailer');
    });
  });

  // 4. Salesman Order-List Filter Preservation ($and vs $or overwrite)
  describe('Salesman Order-List Query Scoping', () => {
    it('Salesman order search query must NOT leak orders of another salesman', async () => {
      // Create an order for Retailer 2 booked by Salesman 2
      const order2Res = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${salesman2Token}`)
        .send({
          retailerId: retailer2Doc._id.toString(),
          items: [{ productId: testProduct._id.toString(), quantity: 10 }],
          paymentMethod: PaymentMethod.CREDIT_ACCOUNT,
          deliveryAddress: {
            street: 'North St',
            city: 'Nashik',
            state: 'Maharashtra',
            pincode: '422001',
            stateCode: '27',
          },
          idempotencyKey: `idem-sales2-${Date.now()}`,
        });
      expect(order2Res.status).toBe(201);

      // Now Salesman 1 searches orders with query 'ORD'
      const searchRes = await request(app)
        .get('/api/v1/orders?search=ORD')
        .set('Authorization', `Bearer ${salesman1Token}`);

      expect(searchRes.status).toBe(200);
      const items = searchRes.body.data.items || searchRes.body.data;
      const leakedOrder = items.find((o: any) => o.retailerId === retailer2Doc._id.toString());
      expect(leakedOrder).toBeUndefined();
    });
  });

  // 5. Invalid Role Attempting Privileged Action
  describe('RBAC Privilege Checks', () => {
    it('Retailer cannot call admin approval endpoint', async () => {
      const res = await request(app)
        .patch(`/api/v1/retailers/${retailer1Doc._id}/approval`)
        .set('Authorization', `Bearer ${retailer1Token}`)
        .send({
          status: AccountStatus.ACTIVE,
          creditLimitPaise: 99999999,
        });

      expect(res.status).toBe(403);
    });

    it('Retailer cannot approve or deliver their own order', async () => {
      // Place an order for Retailer 1
      const orderRes = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${retailer1Token}`)
        .send({
          items: [{ productId: testProduct._id.toString(), quantity: 10 }],
          paymentMethod: PaymentMethod.CREDIT_ACCOUNT,
          deliveryAddress: {
            street: 'South St',
            city: 'Pune',
            state: 'Maharashtra',
            pincode: '411001',
            stateCode: '27',
          },
          idempotencyKey: `idem-ret-self-${Date.now()}`,
        });
      expect(orderRes.status).toBe(201);
      const orderId = orderRes.body.data.id;

      // Retailer attempts to set status to DELIVERED
      const patchRes = await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${retailer1Token}`)
        .send({ status: OrderStatus.DELIVERED });

      expect(patchRes.status).toBe(403);
      const errMsg = patchRes.body.message || patchRes.body.error?.message;
      expect(errMsg).toContain('Retailers can only cancel orders');
    });
  });

  // 6. Invalid Order State Transitions
  describe('Order State Transitions & Terminal Protection', () => {
    it('Cannot modify status of an already cancelled order', async () => {
      // Place order and cancel it
      const orderRes = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${retailer1Token}`)
        .send({
          items: [{ productId: testProduct._id.toString(), quantity: 10 }],
          paymentMethod: PaymentMethod.CREDIT_ACCOUNT,
          deliveryAddress: {
            street: 'South St',
            city: 'Pune',
            state: 'Maharashtra',
            pincode: '411001',
            stateCode: '27',
          },
          idempotencyKey: `idem-canc-term-${Date.now()}`,
        });
      expect(orderRes.status).toBe(201);
      const orderId = orderRes.body.data.id;

      // Cancel order
      await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${retailer1Token}`)
        .send({ status: OrderStatus.CANCELLED, reason: 'Duplicate order by error' });

      // Admin tries to set cancelled order to APPROVED
      const attemptRes = await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.APPROVED });

      expect(attemptRes.status).toBe(400);
      const errMsg = attemptRes.body.message || attemptRes.body.error?.message;
      expect(errMsg).toMatch(/invalid status transition|already cancelled|terminal status/i);
    });
  });

  // 7. Duplicate Order Submission (Idempotency)
  describe('Order Idempotency', () => {
    it('Submitting checkout with same idempotencyKey returns existing order without double-charging', async () => {
      const idempotencyKey = `idem-${Date.now()}-test-key`;

      const initialRetailer = await Retailer.findById(retailer1Doc._id);
      const initialReservation = initialRetailer!.activeReservationsPaise;

      // Request 1
      const res1 = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${retailer1Token}`)
        .send({
          items: [{ productId: testProduct._id.toString(), quantity: 10 }],
          paymentMethod: PaymentMethod.CREDIT_ACCOUNT,
          deliveryAddress: {
            street: 'South St',
            city: 'Pune',
            state: 'Maharashtra',
            pincode: '411001',
            stateCode: '27',
          },
          idempotencyKey,
        });
      expect(res1.status).toBe(201);
      const order1Id = res1.body.data.id;

      // Request 2 with same idempotency key
      const res2 = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${retailer1Token}`)
        .send({
          items: [{ productId: testProduct._id.toString(), quantity: 10 }],
          paymentMethod: PaymentMethod.CREDIT_ACCOUNT,
          deliveryAddress: {
            street: 'South St',
            city: 'Pune',
            state: 'Maharashtra',
            pincode: '411001',
            stateCode: '27',
          },
          idempotencyKey,
        });

      expect(res2.status).toBe(201);
      expect(res2.body.data.id).toBe(order1Id);

      // Verify credit reservation was only made ONCE
      const afterRetailer = await Retailer.findById(retailer1Doc._id);
      expect(afterRetailer!.activeReservationsPaise).toBe(
        initialReservation + res1.body.data.grandTotalPaise
      );
    });
  });

  // 8. Stock & Credit Atomic Rollback on Failure
  describe('Atomic Stock & Credit Rollback on Shortfall', () => {
    it('should reject checkout and preserve stock when requested quantity exceeds available stock', async () => {
      const p1Before = await Product.findById(testProduct._id);
      const initialP1Reserved = p1Before!.stockReserved;

      // Request 150 items when stockOnHand is 100
      const res = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${retailer1Token}`)
        .send({
          items: [{ productId: testProduct._id.toString(), quantity: 150 }],
          paymentMethod: PaymentMethod.CREDIT_ACCOUNT,
          deliveryAddress: {
            street: 'South St',
            city: 'Pune',
            state: 'Maharashtra',
            pincode: '411001',
            stateCode: '27',
          },
          idempotencyKey: `idem-oversell-${Date.now()}`,
        });

      expect(res.status).toBe(400);
      const errMsg = res.body.message || res.body.error?.message;
      expect(errMsg).toContain('Insufficient stock');

      // Verify testProduct stockReserved was NOT incremented
      const p1After = await Product.findById(testProduct._id);
      expect(p1After!.stockReserved).toBe(initialP1Reserved);
    });
  });

  // 9. Payment Signature & Webhook Verification
  describe('Payment Gateway Security', () => {
    it('should reject payment verification if cryptographic signature is forged', async () => {
      // Create an order
      const orderRes = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${retailer1Token}`)
        .send({
          items: [{ productId: testProduct._id.toString(), quantity: 10 }],
          paymentMethod: PaymentMethod.PAYMENT_GATEWAY,
          deliveryAddress: {
            street: 'South St',
            city: 'Pune',
            state: 'Maharashtra',
            pincode: '411001',
            stateCode: '27',
          },
          idempotencyKey: `idem-gateway-test-${Date.now()}`,
        });
      expect(orderRes.status).toBe(201);
      const orderId = orderRes.body.data.id;

      // Create payment intent
      const intentRes = await request(app)
        .post('/api/v1/payments/intent')
        .set('Authorization', `Bearer ${retailer1Token}`)
        .send({ orderId });

      expect(intentRes.status).toBe(200);
      const providerOrderId = intentRes.body.data.providerOrderId;

      // Attempt to verify with forged signature
      const verifyRes = await request(app)
        .post('/api/v1/payments/verify')
        .set('Authorization', `Bearer ${retailer1Token}`)
        .send({
          providerOrderId,
          providerPaymentId: 'pay_fake12345678',
          signature: 'invalid_forged_hmac_signature_hex',
        });

      if (ENV.PAYMENT_PROVIDER === 'razorpay' && ENV.RAZORPAY_KEY_SECRET) {
        expect(verifyRes.status).toBe(400);
      }
    });

    it('should handle duplicate webhook delivery idempotently', async () => {
      const webhookPayload = {
        id: 'evt_test_123456',
        event: 'order.paid',
        payload: {
          payment: {
            entity: {
              id: 'pay_test_123',
              order_id: 'order_test_123',
              amount: 224000,
            },
          },
        },
      };

      // Record first delivery idempotency key
      await PaymentTransaction.create({
        orderId: new mongoose.Types.ObjectId(),
        retailerId: retailer1Doc._id,
        paymentMethod: PaymentMethod.PAYMENT_GATEWAY,
        provider: 'razorpay',
        amountPaise: 224000,
        currency: 'INR',
        idempotencyKey: 'webhook_evt_test_123456',
      });

      const rawBody = JSON.stringify(webhookPayload);
      let reqBuilder = request(app).post('/api/v1/payments/webhook');
      if (ENV.RAZORPAY_WEBHOOK_SECRET) {
        const signature = crypto
          .createHmac('sha256', ENV.RAZORPAY_WEBHOOK_SECRET)
          .update(rawBody)
          .digest('hex');
        reqBuilder = reqBuilder.set('x-razorpay-signature', signature);
      }

      const res = await reqBuilder.send(webhookPayload);

      expect(res.status).toBe(200);
      expect(res.body.data.action).toBe('DUPLICATE_EVENT_IGNORED');
    });
  });

  // 10. Zoho Integration Status
  describe('Zoho Integration Status', () => {
    it('should return explicit unconfigured status when credentials are not configured', async () => {
      const res = await request(app)
        .get('/api/v1/integrations/zoho/status')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('isConfigured');
      expect(res.body.data).toHaveProperty('status');
      if (!ENV.ZOHO_CLIENT_ID || !ENV.ZOHO_CLIENT_SECRET) {
        expect(res.body.data.status).toBe('UNCONFIGURED_MISSING_CREDENTIALS');
      }
    });
  });
});
