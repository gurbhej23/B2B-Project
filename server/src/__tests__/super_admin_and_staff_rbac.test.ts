import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { User } from '../modules/users/user.model';
import { Retailer } from '../modules/retailers/retailer.model';
import { seedDatabase } from '../scripts/seed';
import { cleanupDefaultStaffAccounts, TARGET_DEFAULT_STAFF_EMAILS } from '../scripts/cleanup-default-staff';
import { ENV } from '../config/env';
import { UserRole, AccountStatus } from '@necessity/shared';

let mongoServer: MongoMemoryServer;
let app: any;

jest.setTimeout(45000);

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

describe('Super Admin Authentication, Seed Isolation & Staff RBAC Suite', () => {
  it('1. Seed process creates ONLY Super Admin and does NOT create Accounts Manager, Salesman, or Warehouse Lead', async () => {
    // Run seedDatabase
    await seedDatabase(true);

    // Verify Super Admin exists with expected properties
    const superAdmin = await User.findOne({ email: ENV.SUPER_ADMIN_EMAIL.toLowerCase() });
    expect(superAdmin).toBeDefined();
    expect(superAdmin?.role).toBe(UserRole.SUPER_ADMIN);
    expect(superAdmin?.accountStatus).toBe(AccountStatus.ACTIVE);
    expect(superAdmin?.email).toBe('admin@necessityindia.com');

    // Verify initial password from ENV was hashed and matches
    const isPasswordValid = await bcrypt.compare(ENV.SUPER_ADMIN_PASSWORD, superAdmin!.passwordHash);
    expect(isPasswordValid).toBe(true);

    // Verify none of the default staff accounts were created
    const accountsManager = await User.findOne({ email: 'accounts@necessityindia.com' });
    expect(accountsManager).toBeNull();

    const salesman = await User.findOne({ email: 'sales@necessityindia.com' });
    expect(salesman).toBeNull();

    const warehouseLead = await User.findOne({ email: 'warehouse@necessityindia.com' });
    expect(warehouseLead).toBeNull();

    // Verify total staff accounts created by seed is exactly 1 (Super Admin only)
    const staffAccounts = await User.find({
      role: {
        $in: [
          UserRole.SUPER_ADMIN,
          UserRole.ADMIN,
          UserRole.ACCOUNTS_MANAGER,
          UserRole.SALES_MANAGER,
          UserRole.SALESMAN,
          UserRole.WAREHOUSE_MANAGER,
        ],
      },
    });
    expect(staffAccounts).toHaveLength(1);
    expect(staffAccounts[0].email).toBe('admin@necessityindia.com');
  });

  it('2. Super Admin can log in successfully with credentials from environment variable', async () => {
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      identifier: ENV.SUPER_ADMIN_EMAIL,
      password: ENV.SUPER_ADMIN_PASSWORD,
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.tokens).toBeDefined();
    expect(loginRes.body.data.tokens.accessToken).toBeDefined();
    expect(loginRes.body.data.user.role).toBe(UserRole.SUPER_ADMIN);
    expect(loginRes.body.data.user.email).toBe(ENV.SUPER_ADMIN_EMAIL.toLowerCase());
  });

  it('3. Public registration strictly creates PENDING RETAILER and rejects role escalation', async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send({
      businessName: 'Hacker Wholesale Store',
      contactPerson: 'Attacker User',
      phone: '+919876500001',
      email: 'attacker@infiltrate.com',
      password: 'HackerPassword123!',
      role: UserRole.SUPER_ADMIN, // Attempting role injection
      accountStatus: AccountStatus.ACTIVE, // Attempting status injection
      billingAddress: {
        street: 'Cyber Road',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        stateCode: '27',
      },
      termsAccepted: true,
    });

    expect(regRes.status).toBe(201);
    expect(regRes.body.success).toBe(true);

    const createdUser = await User.findOne({ phone: '+919876500001' });
    expect(createdUser).toBeDefined();
    // Role MUST remain retailer and status MUST remain pending
    expect(createdUser?.role).toBe(UserRole.RETAILER);
    expect(createdUser?.accountStatus).toBe(AccountStatus.PENDING);
  });

  it('4. Super Admin can provision additional staff accounts via authorized admin workflow (POST /api/v1/auth/staff)', async () => {
    // 1. Log in as Super Admin
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      identifier: ENV.SUPER_ADMIN_EMAIL,
      password: ENV.SUPER_ADMIN_PASSWORD,
    });
    const adminToken = adminLogin.body.data.tokens.accessToken;

    // 2. Create Accounts Manager via Super Admin workflow
    const staffRes = await request(app)
      .post('/api/v1/auth/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Authorized Accounts Executive',
        email: 'accounts.exec@necessityindia.com',
        phone: '+919888877771',
        password: 'StaffPassword123!',
        role: UserRole.ACCOUNTS_MANAGER,
      });

    expect(staffRes.status).toBe(201);
    expect(staffRes.body.success).toBe(true);
    expect(staffRes.body.data.email).toBe('accounts.exec@necessityindia.com');
    expect(staffRes.body.data.role).toBe(UserRole.ACCOUNTS_MANAGER);
    expect(staffRes.body.data.accountStatus).toBe(AccountStatus.ACTIVE);

    // Verify provisioned staff account can log in immediately
    const staffLogin = await request(app).post('/api/v1/auth/login').send({
      identifier: 'accounts.exec@necessityindia.com',
      password: 'StaffPassword123!',
    });
    expect(staffLogin.status).toBe(200);
    expect(staffLogin.body.data.user.role).toBe(UserRole.ACCOUNTS_MANAGER);
  });

  it('5. Unauthorized users (Retailer or unauthenticated) cannot create staff accounts', async () => {
    // 1. Create and approve a legitimate retailer
    const retUser = await User.create({
      name: 'Legit Retailer',
      phone: '+919876500002',
      email: 'retailer@legitstore.in',
      passwordHash: await bcrypt.hash('RetailerPass123!', 10),
      role: UserRole.RETAILER,
      accountStatus: AccountStatus.ACTIVE,
    });

    const retLogin = await request(app).post('/api/v1/auth/login').send({
      identifier: '+919876500002',
      password: 'RetailerPass123!',
    });
    const retailerToken = retLogin.body.data.tokens.accessToken;

    // 2. Retailer attempts to create staff account -> Must be rejected with 403 Forbidden
    const forbiddenRes = await request(app)
      .post('/api/v1/auth/staff')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        name: 'Unauthorized Staff',
        email: 'rogue@necessityindia.com',
        phone: '+919888877772',
        password: 'StaffPassword123!',
        role: UserRole.ADMIN,
      });

    expect(forbiddenRes.status).toBe(403);

    // 3. Unauthenticated request -> Must be rejected with 401 Unauthorized
    const unauthRes = await request(app).post('/api/v1/auth/staff').send({
      name: 'Unauthorized Staff 2',
      email: 'rogue2@necessityindia.com',
      phone: '+919888877773',
      password: 'StaffPassword123!',
      role: UserRole.ADMIN,
    });

    expect(unauthRes.status).toBe(401);
  });

  it('6. Existing customer approval workflow continues to function with Super Admin', async () => {
    // 1. Register pending retailer
    await request(app).post('/api/v1/auth/register').send({
      businessName: 'Krishna General Store',
      contactPerson: 'Gopal Krishna',
      phone: '+919876500003',
      email: 'gopal@krishnastore.in',
      password: 'KrishnaPassword123!',
      billingAddress: {
        street: 'Main Bazaar',
        city: 'Nagpur',
        state: 'Maharashtra',
        pincode: '440001',
        stateCode: '27',
      },
      termsAccepted: true,
    });

    const pendingUser = await User.findOne({ phone: '+919876500003' });
    const pendingRetailer = await Retailer.findOne({ userId: pendingUser!._id });
    expect(pendingRetailer).toBeDefined();

    // 2. Super Admin approves customer
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      identifier: ENV.SUPER_ADMIN_EMAIL,
      password: ENV.SUPER_ADMIN_PASSWORD,
    });
    const adminToken = adminLogin.body.data.tokens.accessToken;

    const approveRes = await request(app)
      .patch(`/api/v1/retailers/${pendingRetailer!._id}/approval`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: AccountStatus.ACTIVE,
        creditLimitPaise: 2000000,
        paymentTermsDays: 15,
      });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.success).toBe(true);

    // 3. Approved customer logs in successfully
    const customerLogin = await request(app).post('/api/v1/auth/login').send({
      identifier: '+919876500003',
      password: 'KrishnaPassword123!',
    });

    expect(customerLogin.status).toBe(200);
    expect(customerLogin.body.data.user.accountStatus).toBe(AccountStatus.ACTIVE);
  });

  it('7. Safe cleanup script can target and disable/remove legacy staff accounts without affecting Super Admin or legitimate customers', async () => {
    // 1. Simulate existing legacy staff accounts in database
    const salt = await bcrypt.genSalt(10);
    await User.create([
      {
        name: 'Legacy Accounts Manager',
        email: 'accounts@necessityindia.com',
        phone: '+919888888888',
        passwordHash: await bcrypt.hash('OldAccounts123!', salt),
        role: UserRole.ACCOUNTS_MANAGER,
        accountStatus: AccountStatus.ACTIVE,
      },
      {
        name: 'Legacy Field Salesman',
        email: 'sales@necessityindia.com',
        phone: '+919777777777',
        passwordHash: await bcrypt.hash('OldSales123!', salt),
        role: UserRole.SALESMAN,
        accountStatus: AccountStatus.ACTIVE,
      },
      {
        name: 'Legacy Warehouse Manager',
        email: 'warehouse@necessityindia.com',
        phone: '+919666666666',
        passwordHash: await bcrypt.hash('OldWarehouse123!', salt),
        role: UserRole.WAREHOUSE_MANAGER,
        accountStatus: AccountStatus.ACTIVE,
      },
    ]);

    // 2. Run cleanup in 'disable' mode
    const disableResult = await cleanupDefaultStaffAccounts('disable');
    expect(disableResult.inspected).toBe(3);
    expect(disableResult.modified).toBe(3);

    for (const email of TARGET_DEFAULT_STAFF_EMAILS) {
      const u = await User.findOne({ email });
      expect(u?.accountStatus).toBe(AccountStatus.SUSPENDED);
    }

    // Verify Super Admin and legitimate customers are completely untouched
    const superAdmin = await User.findOne({ email: ENV.SUPER_ADMIN_EMAIL });
    expect(superAdmin?.accountStatus).toBe(AccountStatus.ACTIVE);

    const customer = await User.findOne({ phone: '+919876500003' });
    expect(customer?.accountStatus).toBe(AccountStatus.ACTIVE);

    // 3. Run cleanup in 'remove' mode
    const removeResult = await cleanupDefaultStaffAccounts('remove');
    expect(removeResult.modified).toBe(3);

    for (const email of TARGET_DEFAULT_STAFF_EMAILS) {
      const u = await User.findOne({ email });
      expect(u).toBeNull();
    }

    // Verify Super Admin and customer still exist and are active
    const superAdminAfter = await User.findOne({ email: ENV.SUPER_ADMIN_EMAIL });
    expect(superAdminAfter).toBeDefined();
    expect(superAdminAfter?.role).toBe(UserRole.SUPER_ADMIN);
  });
});
