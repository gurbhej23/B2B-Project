import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import nodemailer from 'nodemailer';
import { createApp } from '../app';
import { User } from '../modules/users/user.model';
import { Retailer } from '../modules/retailers/retailer.model';
import { Category } from '../modules/products/category.model';
import { Product } from '../modules/products/product.model';
import { Order } from '../modules/orders/order.model';
import { EmailService } from '../modules/email/email.service';
import { OrderNotificationService } from '../modules/orders/order-notification.service';
import { ENV } from '../config/env';
import {
  UserRole,
  AccountStatus,
  OrderStatus,
  PaymentMethod,
} from '@necessity/shared';

let mongoServer: MongoMemoryServer;
let app: any;
let adminToken: string;
let adminUserDoc: any;
let retailerToken: string;
let retailerUserDoc: any;
let retailerDoc: any;
let testCategoryDoc: any;
let testProductDoc: any;

// Spy/mock mail sending
const mockSendMail = jest.fn();

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(() => ({
      sendMail: mockSendMail,
    })),
  },
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
  })),
}));

jest.setTimeout(60000);

beforeAll(async () => {
  // Configure test SMTP env values so EmailService initializes transporter
  (ENV as any).SMTP_HOST = 'smtp.testserver.com';
  (ENV as any).SMTP_USER = 'test_orders@necessity.in';
  (ENV as any).SMTP_PASS = 'TestPass123';
  (EmailService as any).transporter = {
    sendMail: mockSendMail,
  };

  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  app = createApp();

  // Setup default mock response
  mockSendMail.mockResolvedValue({
    messageId: '<test-message-id-12345@necessity.in>',
  });

  // 1. Create Super Admin
  await request(app).post('/api/v1/auth/register').send({
    businessName: 'Necessity HQ',
    contactPerson: 'Admin Lead',
    phone: '+919888800001',
    email: 'admin.notif@necessity.in',
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

  adminUserDoc = await User.findOne({ phone: '+919888800001' });
  adminUserDoc.role = UserRole.SUPER_ADMIN;
  adminUserDoc.accountStatus = AccountStatus.ACTIVE;
  await adminUserDoc.save();

  const adminLogin = await request(app).post('/api/v1/auth/login').send({
    identifier: 'admin.notif@necessity.in',
    password: 'Password123!',
  });
  adminToken = adminLogin.body.data.tokens.accessToken;

  // 2. Create Retailer with email
  await request(app).post('/api/v1/auth/register').send({
    businessName: 'Apex Supermart',
    contactPerson: 'Rajesh Verma',
    phone: '+919888800002',
    email: 'rajesh.apex@gmail.com',
    password: 'Password123!',
    billingAddress: {
      street: 'Station Road',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
      stateCode: '27',
    },
    termsAccepted: true,
  });

  retailerUserDoc = await User.findOne({ phone: '+919888800002' });
  retailerUserDoc.accountStatus = AccountStatus.ACTIVE;
  await retailerUserDoc.save();

  retailerDoc = await Retailer.findOne({ userId: retailerUserDoc._id });
  retailerDoc.creditLimitPaise = 10000000; // 100,000 INR
  retailerDoc.isActive = true;
  await retailerDoc.save();

  const retLogin = await request(app).post('/api/v1/auth/login').send({
    identifier: 'rajesh.apex@gmail.com',
    password: 'Password123!',
  });
  retailerToken = retLogin.body.data.tokens.accessToken;

  // 3. Create Category & Product
  testCategoryDoc = await Category.create({
    name: 'Packaged Goods',
    slug: 'packaged-goods',
    displayOrder: 1,
    isActive: true,
  });

  testProductDoc = await Product.create({
    name: 'Premium Basmati Rice 5kg',
    sku: 'PBR-5000',
    description: 'Aged Basmati Rice',
    categoryId: testCategoryDoc._id,
    brand: 'Necessity Kitchen',
    hsnCode: '10063020',
    mrpPaise: 65000, // 650 INR
    dealerPricePaise: 48000, // 480 INR
    stockOnHand: 150,
    lowStockThreshold: 10,
    uom: 'PCS',
    packSize: 1,
    minOrderQuantity: 1,
    orderQuantityMultiple: 1,
    isActive: true,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(() => {
  mockSendMail.mockClear();
  mockSendMail.mockResolvedValue({
    messageId: '<test-message-id-12345@necessity.in>',
  });
  (EmailService as any).transporter = {
    sendMail: mockSendMail,
  };
});

describe('Automated Order Status Email Notifications System', () => {
  let createdOrderId: string;
  let orderNumber: string;

  test('1. Customer places order -> "Your Order Has Been Placed – Necessity India" email sent', async () => {
    // Retailer checks out an order
    const checkoutRes = await request(app)
      .post('/api/v1/orders/checkout')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        items: [
          {
            productId: testProductDoc._id.toString(),
            quantity: 3,
          },
        ],
        paymentMethod: PaymentMethod.CREDIT_ACCOUNT,
        deliveryAddress: {
          street: 'Shop 14, Main Market',
          city: 'Pune',
          state: 'Maharashtra',
          pincode: '411001',
          stateCode: '27',
        },
        idempotencyKey: 'idemp-notif-order-001',
        customerNotes: 'Deliver between 10am and 4pm',
      });

    expect(checkoutRes.status).toBe(201);
    const orderData = checkoutRes.body.data;
    createdOrderId = orderData.id || orderData._id;
    orderNumber = orderData.orderNumber;
    expect(createdOrderId).toBeDefined();

    // Verify order was saved in database
    const dbOrder = await Order.findById(createdOrderId);
    expect(dbOrder).not.toBeNull();
    expect([OrderStatus.PENDING, OrderStatus.SUBMITTED]).toContain(dbOrder!.status);

    // Verify email was sent with correct subject and customer email
    expect(mockSendMail).toHaveBeenCalled();
    const mailArgs = mockSendMail.mock.calls[0][0];
    expect(mailArgs.to).toBe('rajesh.apex@gmail.com');
    expect(mailArgs.subject).toBe('Your Order Has Been Placed – Necessity India');
    expect(mailArgs.html).toContain(orderNumber);
    expect(mailArgs.html).toContain('Premium Basmati Rice 5kg');
    expect(mailArgs.html).toContain('Pending Approval');

    // Verify notification was logged in database
    expect(dbOrder!.notifications).toHaveLength(1);
    expect([OrderStatus.PENDING, OrderStatus.SUBMITTED]).toContain(dbOrder!.notifications![0].status);
    expect(dbOrder!.notifications![0].success).toBe(true);
    expect(dbOrder!.notifications![0].recipientEmail).toBe('rajesh.apex@gmail.com');
    expect(dbOrder!.notifications![0].sentAt).toBeDefined();
  });

  test('2. Admin approves order -> "Your Order Has Been Approved – Necessity India" email sent', async () => {
    const approveRes = await request(app)
      .patch(`/api/v1/orders/${createdOrderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: OrderStatus.APPROVED,
      });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe(OrderStatus.APPROVED);

    // Verify approved email sent
    expect(mockSendMail).toHaveBeenCalled();
    const mailArgs = mockSendMail.mock.calls[0][0];
    expect(mailArgs.to).toBe('rajesh.apex@gmail.com');
    expect(mailArgs.subject).toBe('Your Order Has Been Approved – Necessity India');
    expect(mailArgs.html).toContain(orderNumber);
    expect(mailArgs.html).toContain('Approved');

    // Verify order notifications history has 2 records
    const dbOrder = await Order.findById(createdOrderId);
    expect(dbOrder!.notifications).toHaveLength(2);
    expect(dbOrder!.notifications![1].status).toBe(OrderStatus.APPROVED);
    expect(dbOrder!.notifications![1].success).toBe(true);
  });

  test('3. Admin dispatches order with courier details -> "Your Order Has Been Dispatched – Necessity India" email sent', async () => {
    // First move to PROCESSING
    await request(app)
      .patch(`/api/v1/orders/${createdOrderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: OrderStatus.PROCESSING,
      });

    mockSendMail.mockClear();

    // Move to DISPATCHED with transport/tracking details
    const dispatchRes = await request(app)
      .patch(`/api/v1/orders/${createdOrderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: OrderStatus.DISPATCHED,
        dispatchDetails: {
          courierName: 'DTDC Express',
          trackingNumber: 'DTDC-9928310',
          trackingUrl: 'https://track.dtdc.com/DTDC-9928310',
          transportDetails: '2 cartons packed securely',
        },
      });

    expect(dispatchRes.status).toBe(200);
    expect(dispatchRes.body.data.status).toBe(OrderStatus.DISPATCHED);

    // Verify dispatched email sent with carrier info and tracking link
    expect(mockSendMail).toHaveBeenCalled();
    const mailArgs = mockSendMail.mock.calls[0][0];
    expect(mailArgs.to).toBe('rajesh.apex@gmail.com');
    expect(mailArgs.subject).toBe('Your Order Has Been Dispatched – Necessity India');
    expect(mailArgs.html).toContain(orderNumber);
    expect(mailArgs.html).toContain('DTDC Express');
    expect(mailArgs.html).toContain('DTDC-9928310');
    expect(mailArgs.html).toContain('https://track.dtdc.com/DTDC-9928310');

    // Verify dispatch details persisted in order document
    const dbOrder = await Order.findById(createdOrderId);
    expect(dbOrder!.dispatchDetails?.courierName).toBe('DTDC Express');
    expect(dbOrder!.dispatchDetails?.trackingNumber).toBe('DTDC-9928310');
    expect(dbOrder!.notifications?.some((n) => n.status === OrderStatus.DISPATCHED && n.success)).toBe(true);
  });

  test('4. Admin marks order as Picked Up -> "Your Order Has Been Picked Up – Necessity India" email sent', async () => {
    mockSendMail.mockClear();

    const pickupRes = await request(app)
      .patch(`/api/v1/orders/${createdOrderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: OrderStatus.PICKED_UP,
        pickupDetails: {
          pickupLocation: 'Necessity Central Warehouse - Gate 2',
          collectedBy: 'Suraj Sharma (Store Manager)',
          notes: 'Driver ID verified PB65-9921',
        },
      });

    expect(pickupRes.status).toBe(200);
    expect(pickupRes.body.data.status).toBe(OrderStatus.PICKED_UP);

    // Verify picked up email sent
    expect(mockSendMail).toHaveBeenCalled();
    const mailArgs = mockSendMail.mock.calls[0][0];
    expect(mailArgs.to).toBe('rajesh.apex@gmail.com');
    expect(mailArgs.subject).toBe('Your Order Has Been Picked Up – Necessity India');
    expect(mailArgs.html).toContain(orderNumber);
    expect(mailArgs.html).toContain('Necessity Central Warehouse - Gate 2');
    expect(mailArgs.html).toContain('Suraj Sharma (Store Manager)');

    // Verify pickup details persisted on order
    const dbOrder = await Order.findById(createdOrderId);
    expect(dbOrder!.pickupDetails?.collectedBy).toBe('Suraj Sharma (Store Manager)');
    expect(dbOrder!.notifications?.some((n) => n.status === OrderStatus.PICKED_UP && n.success)).toBe(true);
  });

  test('5. Duplicate Prevention: re-saving status does not send duplicate email', async () => {
    mockSendMail.mockClear();

    // Attempt to update status to PICKED_UP again
    const repeatRes = await request(app)
      .patch(`/api/v1/orders/${createdOrderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: OrderStatus.PICKED_UP,
      });

    expect(repeatRes.status).toBe(200);
    // Transporter should NOT have been called again
    expect(mockSendMail).not.toHaveBeenCalled();

    // Directly calling notification service for an already notified status returns null and skips sending
    const notifService = new OrderNotificationService();
    const duplicateAttempt = await notifService.sendOrderStatusNotification(
      createdOrderId,
      OrderStatus.PICKED_UP
    );
    expect(duplicateAttempt).toBeNull();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  test('6. Email Delivery Failure Handling: order update succeeds even if email fails', async () => {
    // Create a new order for testing failure resilience
    const newOrderRes = await request(app)
      .post('/api/v1/orders/checkout')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        items: [{ productId: testProductDoc._id.toString(), quantity: 1 }],
        paymentMethod: PaymentMethod.CREDIT_ACCOUNT,
        deliveryAddress: {
          street: 'Street 1',
          city: 'Pune',
          state: 'Maharashtra',
          pincode: '411001',
          stateCode: '27',
        },
        idempotencyKey: 'idemp-notif-order-002',
      });

    const failedOrderId = newOrderRes.body.data.id || newOrderRes.body.data._id;

    // Simulate SMTP network failure
    mockSendMail.mockRejectedValueOnce(new Error('Connection timeout to SMTP gateway'));

    // Admin approves the order
    const approveRes = await request(app)
      .patch(`/api/v1/orders/${failedOrderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: OrderStatus.APPROVED,
      });

    // The order status update MUST succeed despite email failure
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe(OrderStatus.APPROVED);

    // Verify that the failed attempt was logged in notifications with success: false
    const dbOrder = await Order.findById(failedOrderId);
    expect(dbOrder!.status).toBe(OrderStatus.APPROVED);
    const failedNotif = dbOrder!.notifications?.find(
      (n) => n.status === OrderStatus.APPROVED && !n.success
    );
    expect(failedNotif).toBeDefined();
    expect(failedNotif!.error).toContain('Connection timeout to SMTP gateway');

    // 7. Admin retry of failed notification
    mockSendMail.mockResolvedValueOnce({
      messageId: '<retry-success-id@necessity.in>',
    });

    const retryRes = await request(app)
      .post(`/api/v1/orders/${failedOrderId}/retry-notification`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: OrderStatus.APPROVED });

    expect(retryRes.status).toBe(200);
    expect(retryRes.body.data.success).toBe(true);

    // Retrying an already successful status must block duplicates
    const duplicateRetryRes = await request(app)
      .post(`/api/v1/orders/${failedOrderId}/retry-notification`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: OrderStatus.APPROVED });

    expect(duplicateRetryRes.status).toBe(400);
    expect(duplicateRetryRes.body.message).toContain('Duplicate sending blocked');
  });

  test('8. Missing Customer Email: logs failure record gracefully without crashing order workflow', async () => {
    // Create retailer without email
    const noEmailUser = await User.create({
      phone: '+919888800099',
      name: 'No Email User',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
      role: UserRole.RETAILER,
      accountStatus: AccountStatus.ACTIVE,
      termsAccepted: true,
      billingAddress: {
        street: 'No Email Lane',
        city: 'Pune',
        state: 'Maharashtra',
        pincode: '411001',
        stateCode: '27',
      },
    });

    const noEmailRetailer = await Retailer.create({
      userId: noEmailUser._id,
      businessName: 'No Email Enterprise',
      contactPerson: 'No Email User',
      phone: '+919888800099',
      billingAddress: {
        street: 'No Email Lane',
        city: 'Pune',
        state: 'Maharashtra',
        pincode: '411001',
        stateCode: '27',
      },
      creditLimitPaise: 5000000,
      isActive: true,
      // Intentionally omitting email
    });

    const directOrder = await Order.create({
      orderNumber: 'ORD-TEST-NOEMAIL-1',
      retailerId: noEmailRetailer._id,
      retailerName: noEmailRetailer.businessName,
      placedByUserId: noEmailUser._id,
      placedByName: noEmailUser.name,
      items: [
        {
          productId: testProductDoc._id,
          productNameSnapshot: testProductDoc.name,
          skuSnapshot: testProductDoc.sku,
          hsnCodeSnapshot: testProductDoc.hsnCode,
          gstRatePercentSnapshot: 18,
          quantity: 2,
          unitPricePaiseSnapshot: 48000,
          mrpPaiseSnapshot: 65000,
          taxableAmountPaise: 96000,
          lineTotalPaise: 96000,
        },
      ],
      taxableAmountPaise: 96000,
      subtotalPaise: 96000,
      grandTotalPaise: 96000,
      paymentMethod: PaymentMethod.CREDIT_ACCOUNT,
      status: OrderStatus.SUBMITTED,
      deliveryAddress: {
        street: 'No Email Lane',
        city: 'Pune',
        state: 'Maharashtra',
        pincode: '411001',
        stateCode: '27',
      },
    });

    const notifService = new OrderNotificationService();
    const result = await notifService.sendOrderStatusNotification(
      directOrder._id.toString(),
      OrderStatus.APPROVED
    );

    expect(result).not.toBeNull();
    expect(result!.success).toBe(false);
    expect(result!.error).toContain('no valid registered email address');

    // Order remains intact and records notification failure
    const refreshedOrder = await Order.findById(directOrder._id);
    expect(refreshedOrder!.notifications).toHaveLength(1);
    expect(refreshedOrder!.notifications![0].recipientEmail).toBe('no_registered_email');
  });

  test('9. Security & RBAC: Retailer cannot trigger retry-notification endpoint', async () => {
    const unauthorizedRes = await request(app)
      .post(`/api/v1/orders/${createdOrderId}/retry-notification`)
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({ status: OrderStatus.APPROVED });

    expect(unauthorizedRes.status).toBe(403);
  });
});
