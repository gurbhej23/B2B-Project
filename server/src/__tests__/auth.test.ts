import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { User } from '../modules/users/user.model';
import { Retailer } from '../modules/retailers/retailer.model';
import { UserRole, AccountStatus } from '@necessity/shared';

let mongoServer: MongoMemoryServer;
let app: any;

jest.setTimeout(30000);

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
});

describe('Phase 1 & 2: Health, Authentication & RBAC', () => {
  test('GET /api/v1/health should return 200 and healthy status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
  });

  test('POST /api/v1/auth/register should create a pending retailer account', async () => {
    const payload = {
      businessName: 'Radhe Krishna Enterprises',
      contactPerson: 'Gopal Sharma',
      phone: '+919876543210',
      email: 'gopal@rkenterprises.in',
      password: 'SecurePassword123!',
      gstin: '27AABCU9603R1ZM',
      billingAddress: {
        street: 'Shop 14, APMC Market',
        city: 'Navi Mumbai',
        state: 'Maharashtra',
        pincode: '400703',
        stateCode: '27',
      },
      termsAccepted: true,
    };

    const res = await request(app).post('/api/v1/auth/register').send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accountStatus).toBe(AccountStatus.PENDING);
    expect(res.body.data.phone).toBe('+919876543210');

    // Verify DB records
    const user = await User.findOne({ phone: '+919876543210' });
    expect(user).toBeDefined();
    expect(user?.role).toBe(UserRole.RETAILER);
    expect(user?.accountStatus).toBe(AccountStatus.PENDING);

    const retailer = await Retailer.findOne({ userId: user?._id });
    expect(retailer).toBeDefined();
    expect(retailer?.businessName).toBe('Radhe Krishna Enterprises');
    expect(retailer?.creditLimitPaise).toBe(0);
  });

  test('POST /api/v1/auth/register should reject duplicate phone', async () => {
    const payload = {
      businessName: 'Test Enterprise',
      contactPerson: 'Test Person',
      phone: '+919876543210',
      password: 'SecurePassword123!',
      billingAddress: {
        street: 'Street 1',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        stateCode: '27',
      },
      termsAccepted: true,
    };

    await request(app).post('/api/v1/auth/register').send(payload);
    const res = await request(app).post('/api/v1/auth/register').send(payload);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  test('POST /api/v1/auth/login should return tokens and set HttpOnly cookies', async () => {
    // Register first
    await request(app).post('/api/v1/auth/register').send({
      businessName: 'Galaxy Traders',
      contactPerson: 'Suresh Raina',
      phone: '+919822233344',
      email: 'suresh@galaxy.in',
      password: 'StrongPassword123!',
      billingAddress: {
        street: 'Station Road',
        city: 'Pune',
        state: 'Maharashtra',
        pincode: '411001',
        stateCode: '27',
      },
      termsAccepted: true,
    });

    // Approve retailer so accountStatus is ACTIVE according to approval workflow
    await User.findOneAndUpdate(
      { phone: '+919822233344' },
      { $set: { accountStatus: AccountStatus.ACTIVE } }
    );

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      identifier: '+919822233344',
      password: 'StrongPassword123!',
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.tokens.accessToken).toBeDefined();
    expect(loginRes.body.data.tokens.refreshToken).toBeDefined();

    // Verify Set-Cookie header contains HttpOnly cookies
    const rawCookies = loginRes.headers['set-cookie'];
    const cookies: string[] = Array.isArray(rawCookies) ? rawCookies : rawCookies ? [rawCookies] : [];
    expect(cookies.some((c: string) => c.includes('necessity_access_token'))).toBe(true);
  });

  test('Lockout mechanism: 5 failed logins lock the account for 15 minutes', async () => {
    // Register
    await request(app).post('/api/v1/auth/register').send({
      businessName: 'Target Retail',
      contactPerson: 'Target Person',
      phone: '+919844455566',
      password: 'TargetPassword123!',
      billingAddress: {
        street: 'MG Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
        stateCode: '29',
      },
      termsAccepted: true,
    });

    // 4 failed attempts
    for (let i = 0; i < 4; i++) {
      const res = await request(app).post('/api/v1/auth/login').send({
        identifier: '+919844455566',
        password: 'WrongPassword!',
      });
      expect(res.status).toBe(401);
    }

    // 5th failed attempt triggers lockout
    const fifthRes = await request(app).post('/api/v1/auth/login').send({
      identifier: '+919844455566',
      password: 'WrongPassword!',
    });
    expect(fifthRes.status).toBe(401);

    // 6th attempt even with CORRECT password is blocked by lockout
    const lockedRes = await request(app).post('/api/v1/auth/login').send({
      identifier: '+919844455566',
      password: 'TargetPassword123!',
    });
    expect(lockedRes.status).toBe(403);
    expect(lockedRes.body.error.code).toBe('ACCOUNT_LOCKED');
  });

  test('RBAC: Admin approval workflow for pending retailers', async () => {
    // 1. Create Admin
    const adminUser = await User.create({
      name: 'Super Admin',
      email: 'admin@necessity.test',
      phone: '+919999900000',
      passwordHash: 'dummy',
      role: UserRole.SUPER_ADMIN,
      accountStatus: AccountStatus.ACTIVE,
    });

    // Admin login simulation
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      identifier: '+919999900000',
      password: 'dummy',
    });
    // Use manual token for admin since password is dummy
    const { TokenService } = require('../modules/auth/token.service');
    const adminToken = TokenService.generateAccessToken({
      sub: adminUser._id.toString(),
      role: UserRole.SUPER_ADMIN,
      sessionId: 'admin-sess',
    });

    // 2. Register Retailer
    const regRes = await request(app).post('/api/v1/auth/register').send({
      businessName: 'Shree Krishna Store',
      contactPerson: 'Krishna',
      phone: '+919877788899',
      password: 'KrishnaPassword123!',
      billingAddress: {
        street: 'Main Road',
        city: 'Thane',
        state: 'Maharashtra',
        pincode: '400601',
        stateCode: '27',
      },
      termsAccepted: true,
    });
    const retailerId = regRes.body.data.retailerId;

    // 3. Admin fetches pending list
    const pendingRes = await request(app)
      .get('/api/v1/retailers/pending')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(pendingRes.status).toBe(200);
    expect(pendingRes.body.data.some((r: any) => r.retailerId === retailerId)).toBe(true);

    // 4. Admin approves retailer with ₹2,50,000 credit limit (25000000 paise) and 30-day terms
    const approvalRes = await request(app)
      .patch(`/api/v1/retailers/${retailerId}/approval`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: AccountStatus.ACTIVE,
        creditLimitPaise: 25000000,
        paymentTermsDays: 30,
      });

    expect(approvalRes.status).toBe(200);
    expect(approvalRes.body.data.accountStatus).toBe(AccountStatus.ACTIVE);
    expect(approvalRes.body.data.creditLimitPaise).toBe(25000000);
    expect(approvalRes.body.data.availableCreditPaise).toBe(25000000);

    // 5. Non-admin cannot access pending list
    const regUser = await User.findById(regRes.body.data.userId);
    const regularToken = TokenService.generateAccessToken({
      sub: regRes.body.data.userId,
      role: UserRole.RETAILER,
      sessionId: regUser?.currentRefreshSessionId || 'ret-sess',
    });
    const forbiddenRes = await request(app)
      .get('/api/v1/retailers/pending')
      .set('Authorization', `Bearer ${regularToken}`);

    expect(forbiddenRes.status).toBe(403);
  });
});
