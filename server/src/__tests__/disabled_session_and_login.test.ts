import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { User } from '../modules/users/user.model';
import { Retailer } from '../modules/retailers/retailer.model';
import { AuditLog } from '../modules/audit/audit.model';
import { TokenService } from '../modules/auth/token.service';
import { UserRole, AccountStatus, CustomerType, extractErrorMessage, ApiError } from '@necessity/shared';

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
  await AuditLog.deleteMany({});
  jest.restoreAllMocks();
});

describe('Disabled Customer Session, Auto-Logout & Login Resolution Test Suite', () => {
  // Helper to create admin user
  const createAdmin = async () => {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('AdminSecret123!', salt);

    const admin = await User.create({
      name: 'Super Admin',
      phone: '+919999999999',
      email: 'admin@necessityindia.com',
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      accountStatus: AccountStatus.ACTIVE,
    });

    const token = TokenService.generateAccessToken({
      sub: admin._id.toString(),
      role: UserRole.SUPER_ADMIN,
      sessionId: 'admin-session-xyz',
    });

    return { admin, token };
  };

  // Helper to create customer with password
  const createCustomerWithCredentials = async (
    suffix: string,
    password = 'Password123!',
    accountStatus: AccountStatus = AccountStatus.ACTIVE,
    isActive = true,
    customerType: CustomerType = CustomerType.NEW
  ) => {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      name: `Customer ${suffix}`,
      phone: `+91987654321${suffix}`,
      email: `customer${suffix}@trade.in`,
      passwordHash,
      role: UserRole.RETAILER,
      accountStatus,
      currentRefreshSessionId: `session-${suffix}`,
    });

    const retailer = await Retailer.create({
      userId: user._id,
      businessName: `Test Wholesale Business ${suffix} Pvt Ltd`,
      contactPerson: `Contact ${suffix}`,
      phone: user.phone,
      email: user.email,
      gstin: `27AABCU960${suffix}R1ZM`,
      customerType,
      isActive,
      creditLimitPaise: 5000000,
      paymentTermsDays: 15,
      billingAddress: {
        street: '123 Station Road',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        stateCode: '27',
      },
      deliveryAddresses: [{
        street: '123 Station Road',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        stateCode: '27',
        isDefault: true,
      }],
    });

    user.retailerProfileId = retailer._id as mongoose.Types.ObjectId;
    await user.save();

    return { user, retailer, rawPassword: password };
  };

  // Test 1: Active, approved customer can log in
  test('1. Active, approved customer can log in successfully and receive tokens', async () => {
    const { user, rawPassword } = await createCustomerWithCredentials('1', 'ValidPass123!', AccountStatus.ACTIVE, true);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: user.phone,
        password: rawPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens).toBeDefined();
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toBeDefined();
    expect(res.body.data.user.role).toBe(UserRole.RETAILER);
    expect(res.body.data.user.accountStatus).toBe(AccountStatus.ACTIVE);
  });

  // Test 2: Disabled customer cannot log in (returns CUSTOMER_DISABLED error code)
  test('2. Disabled customer cannot log in and returns stable CUSTOMER_DISABLED code', async () => {
    const { user, rawPassword } = await createCustomerWithCredentials('2', 'ValidPass123!', AccountStatus.ACTIVE, false);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: user.phone,
        password: rawPassword,
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CUSTOMER_DISABLED');
    expect(res.body.error.message).toContain('Your account has been disabled');
    expect(res.body.error.message).not.toContain('[object Object]');
  });

  // Test 3: Pending or rejected customer cannot access protected business features
  test('3. Pending or rejected customer cannot log in or access protected features', async () => {
    const { user: pendingUser, rawPassword: pPass } = await createCustomerWithCredentials(
      '3p',
      'ValidPass123!',
      AccountStatus.PENDING,
      true
    );

    const pendingLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: pendingUser.phone, password: pPass });

    if (pendingLogin.status === 200) {
      expect(pendingLogin.body.data.isPendingApproval).toBe(true);
    } else {
      expect(pendingLogin.status).toBe(403);
      expect(pendingLogin.body.error.code).toBe('CUSTOMER_NOT_APPROVED');
    }

    const { user: rejectedUser, rawPassword: rPass } = await createCustomerWithCredentials(
      '3r',
      'ValidPass123!',
      AccountStatus.REJECTED,
      false
    );

    const rejectedLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: rejectedUser.phone, password: rPass });

    expect(rejectedLogin.status).toBe(403);
    expect(rejectedLogin.body.error.code).toBe('CUSTOMER_NOT_APPROVED');
  });

  // Test 4: Disabling a currently logged-in customer causes their next protected API request to be rejected
  test('4. Disabling a currently logged-in customer causes their next protected API request to be rejected', async () => {
    const { token: adminToken } = await createAdmin();
    const cust = await createCustomerWithCredentials('4', 'Pass456!', AccountStatus.ACTIVE, true);

    // Customer logs in and obtains token
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: cust.user.phone, password: cust.rawPassword });

    expect(loginRes.status).toBe(200);
    const customerToken = loginRes.body.data.tokens.accessToken;

    // First request while active succeeds
    const firstReq = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(firstReq.status).toBe(200);

    // Admin disables Customer 4
    const disableRes = await request(app)
      .patch(`/api/v1/customers/${cust.retailer._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false, reason: 'Temporary suspension for compliance' });
    expect(disableRes.status).toBe(200);

    // The VERY NEXT authenticated API request by the disabled customer is rejected with 403 CUSTOMER_DISABLED
    const nextReq = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(nextReq.status).toBe(403);
    expect(nextReq.body.error.code).toBe('CUSTOMER_DISABLED');
    expect(nextReq.body.error.message).toContain('Your account has been disabled');
  });

  // Test 5: Re-enabling an approved customer allows a fresh login with valid credentials
  test('5. Re-enabling an approved customer allows a fresh login with valid credentials', async () => {
    const { token: adminToken } = await createAdmin();
    const cust = await createCustomerWithCredentials('5', 'Pass789!', AccountStatus.ACTIVE, true);

    // 1. Admin disables customer
    await request(app)
      .patch(`/api/v1/customers/${cust.retailer._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    // 2. Customer cannot log in while disabled
    const blockedRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: cust.user.phone, password: cust.rawPassword });
    expect(blockedRes.status).toBe(403);

    // 3. Admin re-enables customer
    const enableRes = await request(app)
      .patch(`/api/v1/customers/${cust.retailer._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true });
    expect(enableRes.status).toBe(200);
    expect(enableRes.body.data.isActive).toBe(true);

    // 4. Customer successfully logs in again with valid credentials
    const freshLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: cust.user.phone, password: cust.rawPassword });

    expect(freshLoginRes.status).toBe(200);
    expect(freshLoginRes.body.success).toBe(true);
    expect(freshLoginRes.body.data.tokens.accessToken).toBeDefined();

    // Verify token works on protected endpoints
    const freshToken = freshLoginRes.body.data.tokens.accessToken;
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${freshToken}`);
    expect(meRes.status).toBe(200);
  });

  // Test 6: Re-enabling does not automatically change approval status or customer type
  test('6. Re-enabling a customer does not automatically change approval status or customer type', async () => {
    const { token: adminToken } = await createAdmin();

    // Pending customer
    const pendingCust = await createCustomerWithCredentials('6p', 'Pass111!', AccountStatus.PENDING, false, CustomerType.OLD);
    await request(app)
      .patch(`/api/v1/customers/${pendingCust.retailer._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true });

    const freshUserP = await User.findById(pendingCust.user._id);
    const freshRetP = await Retailer.findById(pendingCust.retailer._id);
    expect(freshUserP?.accountStatus).toBe(AccountStatus.PENDING); // Preserved!
    expect(freshRetP?.customerType).toBe(CustomerType.OLD); // Preserved!
    expect(freshRetP?.isActive).toBe(true);

    // Attempting login must still be blocked because account is not approved
    const loginAttempt = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: pendingCust.user.phone, password: pendingCust.rawPassword });
    if (loginAttempt.status === 200) {
      expect(loginAttempt.body.data.isPendingApproval).toBe(true);
    } else {
      expect(loginAttempt.status).toBe(403);
      expect(loginAttempt.body.error.code).toBe('CUSTOMER_NOT_APPROVED');
    }
  });

  // Test 7: Invalid credentials return readable error with 401 INVALID_CREDENTIALS
  test('7. Invalid credentials return a readable error with 401 and INVALID_CREDENTIALS', async () => {
    const { user } = await createCustomerWithCredentials('7', 'CorrectPassword!', AccountStatus.ACTIVE, true);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: user.phone, password: 'WrongPassword!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.error.message).toBe('Invalid phone/email or password');
  });

  // Test 8: extractErrorMessage safely extracts readable strings and never displays [object Object]
  test('8. extractErrorMessage parses complex errors and never produces [object Object]', () => {
    // 1. Raw object error from backend
    const backendErrorObj = {
      success: false,
      error: {
        code: 'CUSTOMER_DISABLED',
        message: 'Your account has been disabled. Please contact the administrator.',
      },
    };
    expect(extractErrorMessage(backendErrorObj)).toBe('Your account has been disabled. Please contact the administrator.');

    // 2. Error whose message property was set to [object Object]
    const stringifiedObjError = new Error('[object Object]');
    expect(extractErrorMessage(stringifiedObjError)).not.toBe('[object Object]');
    expect(typeof extractErrorMessage(stringifiedObjError)).toBe('string');

    // 3. Nested Axios response error
    const axiosStyleError = {
      response: {
        data: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid phone number format',
          },
        },
      },
    };
    expect(extractErrorMessage(axiosStyleError)).toBe('Invalid phone number format');

    // 4. ApiError instance
    const apiError = new ApiError('Forbidden resource', 403, 'FORBIDDEN');
    expect(extractErrorMessage(apiError)).toBe('Forbidden resource');

    // 5. Network error
    const networkError = new ApiError('Network connection failed. Cannot connect.', 0, 'NETWORK_ERROR');
    expect(extractErrorMessage(networkError)).toContain('Network connection failed');
  });

  // Test 9: Disabling one customer does not affect another customer's session
  test('9. Disabling Customer A does not affect Customer B session', async () => {
    const { token: adminToken } = await createAdmin();
    const custA = await createCustomerWithCredentials('9a', 'PassA123!', AccountStatus.ACTIVE, true);
    const custB = await createCustomerWithCredentials('9b', 'PassB123!', AccountStatus.ACTIVE, true);

    // Both customers log in
    const loginA = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: custA.user.phone, password: custA.rawPassword });
    const loginB = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: custB.user.phone, password: custB.rawPassword });

    const tokenA = loginA.body.data.tokens.accessToken;
    const tokenB = loginB.body.data.tokens.accessToken;

    // Admin disables Customer A
    await request(app)
      .patch(`/api/v1/customers/${custA.retailer._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    // Customer A is rejected
    const resA = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(resA.status).toBe(403);
    expect(resA.body.error.code).toBe('CUSTOMER_DISABLED');

    // Customer B remains active and unaffected
    const resB = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(resB.status).toBe(200);
    expect(resB.body.success).toBe(true);
    expect(resB.body.data.user.phone).toBe(custB.user.phone);
  });

  // Test 10: Admin authentication and access remain completely functional when customers are disabled
  // Test 10: Admin authentication and administrative access remain unaffected
  test('10. Admin authentication and administrative access remain unaffected', async () => {
    const { admin, token: adminToken } = await createAdmin();
    const cust = await createCustomerWithCredentials('10', 'PassAdminTest!', AccountStatus.ACTIVE, true);

    // Admin disables customer
    const disableRes = await request(app)
      .patch(`/api/v1/customers/${cust.retailer._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(disableRes.status).toBe(200);

    // Admin's own session remains 100% active and healthy
    const adminMe = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminMe.status).toBe(200);
    expect(adminMe.body.data.user.id).toBe(admin._id.toString());
    expect(adminMe.body.data.user.role).toBe(UserRole.SUPER_ADMIN);
  });

  // Test 11: Refresh token request by disabled customer is rejected with CUSTOMER_DISABLED
  test('11. Refresh token request by disabled customer is rejected with CUSTOMER_DISABLED', async () => {
    const { token: adminToken } = await createAdmin();
    const cust = await createCustomerWithCredentials('11', 'RefreshPass123!', AccountStatus.ACTIVE, true);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: cust.user.phone, password: cust.rawPassword });
    expect(loginRes.status).toBe(200);
    const refreshToken = loginRes.body.data.tokens.refreshToken;

    // Admin disables customer
    await request(app)
      .patch(`/api/v1/customers/${cust.retailer._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    // Attempting to refresh tokens with existing refresh token is rejected
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(refreshRes.status).toBe(403);
    expect(refreshRes.body.error.code).toBe('CUSTOMER_DISABLED');
  });

  // Test 12: Errors do not expose sensitive internal data, password hashes, or secrets
  test('12. Error responses do not expose sensitive internal data or secrets', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: '+919876543210', password: 'bad_password' });

    expect(res.status).toBe(401);
    const jsonStr = JSON.stringify(res.body);
    expect(jsonStr).not.toContain('passwordHash');
    expect(jsonStr).not.toContain('JWT_ACCESS_SECRET');
    expect(jsonStr).not.toContain('[object Object]');
  });
});

