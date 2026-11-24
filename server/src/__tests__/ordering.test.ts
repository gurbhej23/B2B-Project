import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { User } from '../modules/users/user.model';
import { Retailer } from '../modules/retailers/retailer.model';
import { Category } from '../modules/products/category.model';
import { Product } from '../modules/products/product.model';
import { Order } from '../modules/orders/order.model';
import {
  UserRole,
  AccountStatus,
  CreditStatus,
  OrderStatus,
  PaymentMethod,
} from '@necessity/shared';

let mongoServer: MongoMemoryServer;
let app: any;
let adminToken: string;
let retailerToken: string;
let activeRetailerDoc: any;
let testProductDoc: any;

jest.setTimeout(45000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    instance: {
      launchTimeout: 45000,
    },
  });
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  app = createApp();

  // 1. Create Admin
  await request(app).post('/api/v1/auth/register').send({
    businessName: 'Necessity Head Office',
    contactPerson: 'Admin User',
    phone: '+919999999999',
    email: 'admin@necessityindia.com',
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

  // Promote to Super Admin
  const adminUser = await User.findOne({ phone: '+919999999999' });
  adminUser!.role = UserRole.SUPER_ADMIN;
  adminUser!.accountStatus = AccountStatus.ACTIVE;
  await adminUser!.save();

  const adminLoginRes = await request(app).post('/api/v1/auth/login').send({
    identifier: 'admin@necessityindia.com',
    password: 'AdminPassword123!',
  });
  adminToken = adminLoginRes.body.data.tokens.accessToken;

  // 2. Create and Approve Retailer
  await request(app).post('/api/v1/auth/register').send({
    businessName: 'Apex Grand Hotel Supplies',
    contactPerson: 'Amit Verma',
    phone: '+919811112222',
    email: 'apex@grandhotel.in',
    password: 'RetailerPassword123!',
    billingAddress: {
      street: '42 Marine Drive',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400020',
      stateCode: '27',
    },
    termsAccepted: true,
  });

  const retailerUser = await User.findOne({ phone: '+919811112222' });
  const pendingRetailer = await Retailer.findOne({ userId: retailerUser!._id });

  // Admin approves with ₹1,00,000 credit limit (10000000 paise)
  await request(app)
    .patch(`/api/v1/retailers/${pendingRetailer!._id}/approval`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      status: AccountStatus.ACTIVE,
      creditLimitPaise: 10000000, // ₹1,00,000
      paymentTermsDays: 30,
      creditStatus: CreditStatus.NORMAL,
    });

  activeRetailerDoc = await Retailer.findById(pendingRetailer!._id);

  const retailerLoginRes = await request(app).post('/api/v1/auth/login').send({
    identifier: '+919811112222',
    password: 'RetailerPassword123!',
  });
  retailerToken = retailerLoginRes.body.data.tokens.accessToken;

  // 3. Create Category and Product
  const category = await Category.create({
    name: 'Luxury Bath Linens',
    slug: 'luxury-bath-linens',
    isActive: true,
  });

  testProductDoc = await Product.create({
    sku: 'TOW-LUX-001',
    name: 'Luxury White Bath Towel 600 GSM',
    description: '100% Combed Turkish Cotton Towel',
    categoryId: category._id,
    categoryName: category.name,
    brand: 'Necessity Classic',
    images: [{ url: 'https://example.com/towel.jpg', isPrimary: true }],
    uom: 'PCS',
    packSize: 6,
    caseQuantity: 24,
    mrpPaise: 90000, // ₹900.00
    dealerPricePaise: 40000, // ₹400.00 wholesale
    hsnCode: '6302',
    gstRatePercent: 12,
    minOrderQuantity: 12,
    orderQuantityMultiple: 6,
    stockOnHand: 100,
    stockReserved: 0,
    isActive: true,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('Phase 3: Product Catalogue, Cart & Authoritative Ordering', () => {
  test('GET /api/v1/products should return catalogue with availableStock virtual', async () => {
    const res = await request(app)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${retailerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    const product = res.body.data.find((p: any) => p.sku === 'TOW-LUX-001');
    expect(product).toBeDefined();
    expect(product.dealerPricePaise).toBe(40000);
    expect(product.availableStock).toBe(100);
  });

  test('POST /api/v1/orders/calculate-cart should compute exact integer paise and intra-state GST splits', async () => {
    // 12 towels at ₹400 = ₹4,800 taxable (480000 paise)
    // 12% GST intra-state: 6% CGST (28800 paise), 6% SGST (28800 paise)
    // Total = 480000 + 28800 + 28800 = 537600 paise (₹5,376.00)
    const res = await request(app)
      .post('/api/v1/orders/calculate-cart')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        items: [{ productId: testProductDoc._id.toString(), quantity: 12 }],
        deliveryStateCode: '27',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.taxableAmountPaise).toBe(480000);
    expect(res.body.data.totalCgstPaise).toBe(28800);
    expect(res.body.data.totalSgstPaise).toBe(28800);
    expect(res.body.data.totalIgstPaise).toBe(0);
    expect(res.body.data.grandTotalPaise).toBe(537600);
  });

  test('POST /api/v1/orders/checkout should enforce minOrderQuantity & order multiples', async () => {
    // minOrderQuantity is 12, try ordering 5
    const res = await request(app)
      .post('/api/v1/orders/checkout')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        items: [{ productId: testProductDoc._id.toString(), quantity: 5 }],
        paymentMethod: PaymentMethod.CREDIT_ACCOUNT,
        deliveryAddress: {
          street: '42 Marine Drive',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400020',
          stateCode: '27',
        },
        idempotencyKey: 'idemp-test-order-bad-qty',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Minimum order quantity');
  });

  test('POST /api/v1/orders/checkout should place order, reserve stock, and reserve credit limit', async () => {
    // Order 12 towels: grand total = 537600 paise
    const res = await request(app)
      .post('/api/v1/orders/checkout')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        items: [{ productId: testProductDoc._id.toString(), quantity: 12 }],
        paymentMethod: PaymentMethod.CREDIT_ACCOUNT,
        deliveryAddress: {
          street: '42 Marine Drive',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400020',
          stateCode: '27',
        },
        idempotencyKey: 'idemp-test-order-001',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orderNumber).toMatch(/^ORD-/);
    expect(res.body.data.grandTotalPaise).toBe(537600);
    expect([OrderStatus.PENDING, OrderStatus.SUBMITTED]).toContain(res.body.data.status);

    // Verify stockReserved on Product incremented by 12
    const updatedProduct = await Product.findById(testProductDoc._id);
    expect(updatedProduct!.stockReserved).toBe(12);
    expect(updatedProduct!.stockOnHand - updatedProduct!.stockReserved).toBe(88);

    // Verify activeReservationsPaise on Retailer incremented by 537600
    const updatedRetailer = await Retailer.findById(activeRetailerDoc._id);
    expect(updatedRetailer!.activeReservationsPaise).toBe(537600);
  });

  test('POST /api/v1/orders/checkout should reject order when credit limit is exceeded', async () => {
    // Retailer has ₹1,00,000 credit limit and 537600 reserved.
    // Try ordering 300 towels -> 300 * 400 = 12000000 taxable (exceeds ₹1,00,000 credit limit)
    // First increase stock on hand so stock isn't the limiting factor
    await Product.findByIdAndUpdate(testProductDoc._id, { $set: { stockOnHand: 500 } });

    const res = await request(app)
      .post('/api/v1/orders/checkout')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        items: [{ productId: testProductDoc._id.toString(), quantity: 300 }],
        paymentMethod: PaymentMethod.CREDIT_ACCOUNT,
        deliveryAddress: {
          street: '42 Marine Drive',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400020',
          stateCode: '27',
        },
        idempotencyKey: 'idemp-test-order-exceed-credit',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Insufficient credit limit');
  });

  test('PATCH /api/v1/orders/:id/status to CANCELLED should release stock and credit reservations', async () => {
    const order = await Order.findOne({ idempotencyKey: 'idemp-test-order-001' });
    expect(order).toBeDefined();

    const cancelRes = await request(app)
      .patch(`/api/v1/orders/${order!._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: OrderStatus.CANCELLED,
        reason: 'Customer cancelled prior to dispatch',
      });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe(OrderStatus.CANCELLED);

    // Verify Product stockReserved released back to 0
    const prod = await Product.findById(testProductDoc._id);
    expect(prod!.stockReserved).toBe(0);

    // Verify Retailer activeReservationsPaise released back to 0
    const ret = await Retailer.findById(activeRetailerDoc._id);
    expect(ret!.activeReservationsPaise).toBe(0);
  });
});
