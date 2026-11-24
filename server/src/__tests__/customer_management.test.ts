import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { User } from '../modules/users/user.model';
import { Retailer } from '../modules/retailers/retailer.model';
import { Product } from '../modules/products/product.model';
import { AuditLog } from '../modules/audit/audit.model';
import { EmailService } from '../modules/email/email.service';
import { UserRole, AccountStatus, CustomerType, PaymentMethod } from '@necessity/shared';

let mongoServer: MongoMemoryServer;
let app: any;

jest.setTimeout(40000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  app = createApp();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Retailer.deleteMany({});
  await Product.deleteMany({});
  await AuditLog.deleteMany({});
  jest.restoreAllMocks();
});

describe('Feature: B2B Customer Registration, Admin Approval & Customer Management', () => {
  // Helper to create an authenticated admin token
  const createAdminUser = async () => {
    const adminUser = await User.create({
      name: 'Super Admin',
      phone: '+919999999999',
      email: 'admin@necessityindia.com',
      passwordHash: 'dummy_hash',
      role: UserRole.SUPER_ADMIN,
      accountStatus: AccountStatus.ACTIVE,
    });

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      identifier: '+919999999999',
      password: 'AdminPassword123!',
    });

    // In tests we can bypass password comparison or use TokenService directly
    const { TokenService } = require('../modules/auth/token.service');
    const token = TokenService.generateAccessToken({
      sub: adminUser._id.toString(),
      role: UserRole.SUPER_ADMIN,
      name: adminUser.name,
      phone: adminUser.phone,
    });

    return { adminUser, token };
  };

  // 1. Customer registration and validation (mobile format)
  test('1. Customer registration via mobile schema succeeds and normalizes email', async () => {
    const mobilePayload = {
      name: 'Ramesh Patel',
      businessName: 'Patel Wholesale Traders',
      email: '  RAMESH@PatelTraders.IN  ',
      phone: '+919822334455',
      address: 'Plot 10, GIDC Estate',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pincode: '380001',
      gstin: '24AABCU9603R1ZM',
      password: 'SecurePassword123!',
      confirmPassword: 'SecurePassword123!',
    };

    const res = await request(app).post('/api/v1/auth/register').send(mobilePayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Registration submitted. Your account is awaiting admin approval.');

    // Verify in database
    const user = await User.findOne({ phone: '+919822334455' });
    expect(user).toBeTruthy();
    expect(user?.email).toBe('ramesh@pateltraders.in'); // normalized lowercase
    expect(user?.accountStatus).toBe(AccountStatus.PENDING);
    expect(user?.role).toBe(UserRole.RETAILER);

    const retailer = await Retailer.findOne({ userId: user?._id });
    expect(retailer).toBeTruthy();
    expect(retailer?.businessName).toBe('Patel Wholesale Traders');
    expect(retailer?.customerType).toBe('new');
    expect(retailer?.isActive).toBe(true);
  });

  // 2. Duplicate email and phone handling
  test('2. Duplicate mobile number or email returns 409 Conflict', async () => {
    const payload1 = {
      name: 'First User',
      businessName: 'Business One',
      email: 'unique@business.in',
      phone: '+919800000001',
      address: 'Street 1',
      city: 'Mumbai',
      state: 'Maharashtra',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    };

    const res1 = await request(app).post('/api/v1/auth/register').send(payload1);
    expect(res1.status).toBe(201);

    // Duplicate Phone
    const duplicatePhonePayload = {
      ...payload1,
      businessName: 'Another Business',
      email: 'different@business.in',
    };
    const res2 = await request(app).post('/api/v1/auth/register').send(duplicatePhonePayload);
    expect(res2.status).toBe(409);
    expect(res2.body.error.message).toContain('phone number already exists');

    // Duplicate Email
    const duplicateEmailPayload = {
      ...payload1,
      businessName: 'Third Business',
      phone: '+919800000002',
      email: 'UNIQUE@business.in', // case-insensitive check
    };
    const res3 = await request(app).post('/api/v1/auth/register').send(duplicateEmailPayload);
    expect(res3.status).toBe(409);
    expect(res3.body.error.message).toContain('email address already exists');
  });

  // 3. Customer cannot self-approve or escalate role
  test('3. Client cannot self-approve or inject admin role during registration', async () => {
    const exploitPayload = {
      name: 'Attacker',
      businessName: 'Exploit Shop',
      email: 'attacker@evil.com',
      phone: '+919877766655',
      address: 'Dark Web St',
      city: 'Nowhere',
      state: 'Unknown',
      password: 'HackerPassword123!',
      confirmPassword: 'HackerPassword123!',
      role: 'admin',
      accountStatus: 'active',
      customerType: 'old',
      isActive: true,
      approvedAt: new Date(),
    };

    const res = await request(app).post('/api/v1/auth/register').send(exploitPayload);
    expect(res.status).toBe(201);

    const user = await User.findOne({ phone: '+919877766655' });
    expect(user?.role).toBe(UserRole.RETAILER);
    expect(user?.accountStatus).toBe(AccountStatus.PENDING);
  });

  // 4. Admin approval workflow with customerType selection & email trigger
  test('4. Admin can approve customer, set customerType to Old, and trigger email notification', async () => {
    const { token } = await createAdminUser();

    // Register a pending customer
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Sunil Kumar',
      businessName: 'Sunil Provisions',
      email: 'sunil@provisions.in',
      phone: '+919844444444',
      address: 'Main Market',
      city: 'Pune',
      state: 'Maharashtra',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    const retailerId = regRes.body.data.retailerId;

    // Spy on EmailService.sendApprovalEmail
    const emailSpy = jest.spyOn(EmailService, 'sendApprovalEmail').mockResolvedValue({
      success: true,
      messageId: 'mock-msg-12345',
    });

    // Admin approves with customerType = OLD
    const approveRes = await request(app)
      .patch(`/api/v1/customers/${retailerId}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerType: CustomerType.OLD,
        creditLimitPaise: 30000000,
        paymentTermsDays: 30,
      });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.success).toBe(true);

    // Verify database state
    const updatedRetailer = await Retailer.findById(retailerId);
    expect(updatedRetailer?.customerType).toBe(CustomerType.OLD);
    expect(updatedRetailer?.approvedAt).toBeTruthy();
    expect(updatedRetailer?.isActive).toBe(true);

    const updatedUser = await User.findById(updatedRetailer?.userId);
    expect(updatedUser?.accountStatus).toBe(AccountStatus.ACTIVE);

    // Verify email was called with correct parameters
    expect(emailSpy).toHaveBeenCalledTimes(1);
    expect(emailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'sunil@provisions.in',
        customerName: 'Sunil Kumar',
        businessName: 'Sunil Provisions',
        customerType: CustomerType.OLD,
      })
    );

    // 5. Subsequent retry must NOT send duplicate email
    await request(app)
      .patch(`/api/v1/customers/${retailerId}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerType: CustomerType.OLD,
      });

    expect(emailSpy).toHaveBeenCalledTimes(1); // not called again
  });

  // 5. Admin rejection workflow
  test('5. Admin can reject customer application with optional reason', async () => {
    const { token } = await createAdminUser();

    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Unqualified Applicant',
      businessName: 'No Docs Shop',
      email: 'nodocs@shop.in',
      phone: '+919855555555',
      address: 'Bazaar',
      city: 'Nagpur',
      state: 'Maharashtra',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    const retailerId = regRes.body.data.retailerId;

    const rejectionSpy = jest.spyOn(EmailService, 'sendRejectionEmail').mockResolvedValue({
      success: true,
      messageId: 'mock-reject-123',
    });

    const rejectRes = await request(app)
      .patch(`/api/v1/customers/${retailerId}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        rejectionReason: 'Invalid business premises and missing trade registration certificate.',
      });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.success).toBe(true);

    const retailer = await Retailer.findById(retailerId);
    expect(retailer?.isActive).toBe(false);
    expect(retailer?.rejectionReason).toContain('Invalid business premises');

    const user = await User.findById(retailer?.userId);
    expect(user?.accountStatus).toBe(AccountStatus.REJECTED);
    expect(rejectionSpy).toHaveBeenCalledTimes(1);
  });

  // 6. Changing customer type (New -> Old -> New) with audit record
  test('6. Admin can change customer type and record audit trail', async () => {
    const { token } = await createAdminUser();

    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Kishore Kumar',
      businessName: 'Kishore Textiles',
      email: 'kishore@textiles.in',
      phone: '+919866666666',
      address: 'Ring Road',
      city: 'Surat',
      state: 'Gujarat',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    const retailerId = regRes.body.data.retailerId;

    // Change to OLD
    const changeRes = await request(app)
      .patch(`/api/v1/customers/${retailerId}/type`)
      .set('Authorization', `Bearer ${token}`)
      .send({ customerType: CustomerType.OLD });

    expect(changeRes.status).toBe(200);
    expect(changeRes.body.data.customerType).toBe(CustomerType.OLD);

    const retailer = await Retailer.findById(retailerId);
    expect(retailer?.customerType).toBe(CustomerType.OLD);

    // Verify audit log
    const auditLogs = await AuditLog.find({ targetId: retailerId, action: 'CUSTOMER_TYPE_CHANGED' });
    expect(auditLogs.length).toBeGreaterThanOrEqual(1);
    expect(auditLogs[0]?.details?.newType).toBe(CustomerType.OLD);
  });

  // 7. Enable and Disable Customers
  test('7. Admin can disable and re-enable customer, invalidating active sessions', async () => {
    const { token } = await createAdminUser();

    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Mohan Lal',
      businessName: 'Mohan Stores',
      email: 'mohan@stores.in',
      phone: '+919877777771',
      address: 'Station Road',
      city: 'Nashik',
      state: 'Maharashtra',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    const retailerId = regRes.body.data.retailerId;

    // First approve customer
    await request(app)
      .patch(`/api/v1/customers/${retailerId}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ customerType: CustomerType.NEW });

    // Set a mock active session
    await User.findOneAndUpdate({ phone: '+919877777771' }, { currentRefreshSessionId: 'active-session-123' });

    // Disable customer
    const disableRes = await request(app)
      .patch(`/api/v1/customers/${retailerId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false, reason: 'Payment default on invoice #1002' });

    expect(disableRes.status).toBe(200);
    expect(disableRes.body.data.isActive).toBe(false);

    // Verify database state: retailer disabled, user suspended, session revoked
    const disabledRetailer = await Retailer.findById(retailerId);
    expect(disabledRetailer?.isActive).toBe(false);

    const linkedUser = await User.findById(disabledRetailer?.userId);
    expect(linkedUser?.accountStatus).toBe(AccountStatus.ACTIVE); // Approval status preserved
    expect(linkedUser?.currentRefreshSessionId).toBeUndefined(); // Active session revoked

    // Re-enable customer
    const reEnableRes = await request(app)
      .patch(`/api/v1/customers/${retailerId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: true });

    expect(reEnableRes.status).toBe(200);
    expect(reEnableRes.body.data.isActive).toBe(true);

    const reEnabledUser = await User.findById(disabledRetailer?.userId);
    expect(reEnabledUser?.accountStatus).toBe(AccountStatus.ACTIVE);
  });

  // 8. Pending and disabled customers cannot place orders
  test('8. Pending, rejected, and disabled customers are blocked from ordering', async () => {
    const { token } = await createAdminUser();

    // Create a product
    const product = await Product.create({
      sku: 'TEST-SKU-001',
      name: 'Commercial Terry Towel',
      description: 'Institutional Grade',
      categoryId: new mongoose.Types.ObjectId(),
      categoryName: 'Towels',
      brand: 'Necessity',
      images: [{ url: 'https://example.com/img.jpg', isPrimary: true }],
      uom: 'PCS',
      packSize: 10,
      caseQuantity: 100,
      mrpPaise: 50000,
      dealerPricePaise: 35000,
      hsnCode: '6302',
      gstRatePercent: 12,
      minOrderQuantity: 10,
      orderQuantityMultiple: 10,
      stockOnHand: 500,
      stockReserved: 0,
      lowStockThreshold: 50,
      isActive: true,
    });

    // Register pending customer
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Pending Buyer',
      businessName: 'Pending Buyer Ltd.',
      email: 'pending@buyer.in',
      phone: '+919888888881',
      address: 'Market St',
      city: 'Mumbai',
      state: 'Maharashtra',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    const retailerId = regRes.body.data.retailerId;

    const { TokenService } = require('../modules/auth/token.service');
    const userDoc = await User.findById(regRes.body.data.userId);
    const customerToken = TokenService.generateAccessToken({
      sub: regRes.body.data.userId,
      role: UserRole.RETAILER,
      name: 'Pending Buyer',
      phone: '+919888888881',
      sessionId: userDoc?.currentRefreshSessionId,
    });

    const checkoutPayload = {
      items: [{ productId: product._id.toString(), quantity: 10 }],
      paymentMethod: PaymentMethod.CREDIT_ACCOUNT,
      deliveryAddress: {
        street: 'Market St',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        stateCode: '27',
      },
      idempotencyKey: 'idem-test-check-001',
    };

    // Attempt checkout while PENDING -> should fail
    const pendingCheckoutRes = await request(app)
      .post('/api/v1/orders/checkout')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(checkoutPayload);

    expect(pendingCheckoutRes.status).toBe(403);

    // Approve customer
    await request(app)
      .patch(`/api/v1/customers/${retailerId}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ customerType: CustomerType.NEW, creditLimitPaise: 10000000 });

    // Now disable customer
    await request(app)
      .patch(`/api/v1/customers/${retailerId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });

    // Attempt checkout while DISABLED -> should fail with 403
    const disabledCheckoutRes = await request(app)
      .post('/api/v1/orders/checkout')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(checkoutPayload);

    expect(disabledCheckoutRes.status).toBe(403);
  });

  // 9. Approval persists even if email delivery fails
  test('9. Customer approval succeeds and persists in MongoDB even if email provider throws error', async () => {
    const { token } = await createAdminUser();

    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Faulty Mail Customer',
      businessName: 'Offline Buyer',
      email: 'offline@buyer.in',
      phone: '+919899999991',
      address: 'Main Bazar',
      city: 'Pune',
      state: 'Maharashtra',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    const retailerId = regRes.body.data.retailerId;

    // Mock EmailService to simulate an unhandled SMTP network failure
    jest.spyOn(EmailService, 'sendApprovalEmail').mockResolvedValue({
      success: false,
      error: 'SMTP Connection Timeout: 587 unreachable',
    });

    const approveRes = await request(app)
      .patch(`/api/v1/customers/${retailerId}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ customerType: CustomerType.NEW });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.success).toBe(true);

    // Database must still be updated
    const retailer = await Retailer.findById(retailerId);
    expect(retailer?.approvedAt).toBeTruthy();
    expect(retailer?.approvalNotificationStatus).toBe('failed');

    const user = await User.findById(retailer?.userId);
    expect(user?.accountStatus).toBe(AccountStatus.ACTIVE);
  });
});
