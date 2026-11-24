import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { User } from '../modules/users/user.model';
import { Retailer } from '../modules/retailers/retailer.model';
import { AuditLog } from '../modules/audit/audit.model';
import { TokenService } from '../modules/auth/token.service';
import { EmailService } from '../modules/email/email.service';
import { UserRole, AccountStatus, CustomerType } from '@necessity/shared';

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

describe('Customer Status Isolation & Targeting Test Suite', () => {
  // Helper to create admin token
  const getAdminToken = async () => {
    const admin = await User.create({
      name: 'Super Admin',
      phone: '+919999999999',
      email: 'admin@necessityindia.com',
      passwordHash: 'dummy',
      role: UserRole.SUPER_ADMIN,
      accountStatus: AccountStatus.ACTIVE,
    });

    const token = TokenService.generateAccessToken({
      sub: admin._id.toString(),
      role: UserRole.SUPER_ADMIN,
      sessionId: 'admin-session-123',
    });

    return { admin, token };
  };

  // Helper to create retailer customer
  const createCustomer = async (suffix: string, status: AccountStatus = AccountStatus.ACTIVE, type: CustomerType = CustomerType.NEW) => {
    const user = await User.create({
      name: `Customer ${suffix}`,
      phone: `+91981111111${suffix}`,
      email: `customer${suffix}@trade.in`,
      passwordHash: 'dummy_hash',
      role: UserRole.RETAILER,
      accountStatus: status,
      currentRefreshSessionId: `session-${suffix}`,
    });

    const retailer = await Retailer.create({
      userId: user._id,
      businessName: `Business ${suffix} Pvt Ltd`,
      contactPerson: `Contact ${suffix}`,
      phone: user.phone,
      email: user.email,
      gstin: `27AABCU960${suffix}R1ZM`,
      customerType: type,
      isActive: true,
      creditLimitPaise: 10000000,
      paymentTermsDays: 30,
      billingAddress: {
        street: '123 Market St',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        stateCode: '27',
      },
      deliveryAddresses: [{
        street: '123 Market St',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        stateCode: '27',
        isDefault: true,
      }],
    });

    user.retailerProfileId = retailer._id as mongoose.Types.ObjectId;
    await user.save();

    return { user, retailer };
  };

  // 1 & 2. Disabling Customer A changes only Customer A's isActive; B and C remain active
  test('1 & 2. Disabling Customer A changes only Customer A to inactive; Customer B and C remain active', async () => {
    const { token } = await getAdminToken();

    const custA = await createCustomer('1');
    const custB = await createCustomer('2');
    const custC = await createCustomer('3');

    // Disable Customer A
    const res = await request(app)
      .patch(`/api/v1/customers/${custA.retailer._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false, reason: 'Temporary payment reconciliation hold' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(custA.retailer._id.toString());
    expect(res.body.data.isActive).toBe(false);

    // Verify Customer A is inactive in MongoDB
    const freshA = await Retailer.findById(custA.retailer._id);
    expect(freshA?.isActive).toBe(false);

    // Verify Customer B and C remain strictly active
    const freshB = await Retailer.findById(custB.retailer._id);
    const freshC = await Retailer.findById(custC.retailer._id);
    expect(freshB?.isActive).toBe(true);
    expect(freshC?.isActive).toBe(true);
  });

  // 3. Enabling Customer A does not change Customer B or C
  test('3. Enabling Customer A does not change Customer B or C', async () => {
    const { token } = await getAdminToken();

    const custA = await createCustomer('1');
    const custB = await createCustomer('2');

    // Customer A starts disabled, Customer B is disabled for a different reason
    await Retailer.findByIdAndUpdate(custA.retailer._id, { $set: { isActive: false } });
    await Retailer.findByIdAndUpdate(custB.retailer._id, { $set: { isActive: false } });

    // Enable only Customer A
    const res = await request(app)
      .patch(`/api/v1/customers/${custA.retailer._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: true });

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(true);

    // Customer A is now active
    const freshA = await Retailer.findById(custA.retailer._id);
    expect(freshA?.isActive).toBe(true);

    // Customer B must remain unchanged (inactive)
    const freshB = await Retailer.findById(custB.retailer._id);
    expect(freshB?.isActive).toBe(false);
  });

  // 4. Invalid customer ID returns validation error
  test('4. An invalid customer ID returns 400 Bad Request validation error', async () => {
    const { token } = await getAdminToken();

    const res = await request(app)
      .patch('/api/v1/customers/invalid-mongo-id-1234/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // 5. Nonexistent customer returns 404
  test('5. A nonexistent customer returns 404 Not Found', async () => {
    const { token } = await getAdminToken();
    const nonExistentId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .patch(`/api/v1/customers/${nonExistentId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // 6. Unauthenticated user cannot change customer status
  test('6. An unauthenticated user cannot change customer status (401 Unauthorized)', async () => {
    const custA = await createCustomer('1');

    const res = await request(app)
      .patch(`/api/v1/customers/${custA.retailer._id}/status`)
      .send({ isActive: false });

    expect(res.status).toBe(401);
  });

  // 7. Non-admin user cannot disable customers
  test('7. A non-admin user (e.g. Retailer) cannot disable customers (403 Forbidden)', async () => {
    const custA = await createCustomer('1');
    const custB = await createCustomer('2');

    const retailerToken = TokenService.generateAccessToken({
      sub: custA.user._id.toString(),
      role: UserRole.RETAILER,
      sessionId: 'session-1',
    });

    const res = await request(app)
      .patch(`/api/v1/customers/${custB.retailer._id}/status`)
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({ isActive: false });

    expect(res.status).toBe(403);

    // Verify Customer B is still active
    const freshB = await Retailer.findById(custB.retailer._id);
    expect(freshB?.isActive).toBe(true);
  });

  // 8. API failure does not mutate the database
  test('8. Request body failure does not mutate database or other records', async () => {
    const { token } = await getAdminToken();
    const custA = await createCustomer('1');

    // Invalid body (missing boolean isActive)
    const res = await request(app)
      .patch(`/api/v1/customers/${custA.retailer._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: 'not_a_boolean' });

    expect(res.status).toBe(422);

    // Verify Customer A remains active
    const freshA = await Retailer.findById(custA.retailer._id);
    expect(freshA?.isActive).toBe(true);
  });

  // 9. Customer type, approval status, and business history remain unchanged
  test('9. Disabling preserves customer type, approval status, and credit terms intact', async () => {
    const { token } = await getAdminToken();

    // Create an approved customer with Old customer type
    const cust = await createCustomer('1', AccountStatus.ACTIVE, CustomerType.OLD);
    const initialCreditLimit = cust.retailer.creditLimitPaise;
    const initialTerms = cust.retailer.paymentTermsDays;

    // Disable customer
    const res = await request(app)
      .patch(`/api/v1/customers/${cust.retailer._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false, reason: 'Auditing credit accounts' });

    expect(res.status).toBe(200);

    const updatedRetailer = await Retailer.findById(cust.retailer._id);
    const linkedUser = await User.findById(cust.user._id);

    // Only isActive changed
    expect(updatedRetailer?.isActive).toBe(false);

    // Preserved fields
    expect(updatedRetailer?.customerType).toBe(CustomerType.OLD);
    expect(updatedRetailer?.creditLimitPaise).toBe(initialCreditLimit);
    expect(updatedRetailer?.paymentTermsDays).toBe(initialTerms);
    expect(linkedUser?.accountStatus).toBe(AccountStatus.ACTIVE); // Approval status preserved!
    expect(linkedUser?.currentRefreshSessionId).toBeUndefined(); // Active session revoked!
  });

  // 10. The customer list correctly displays each customer's individual status
  test('10. Customer list endpoint accurately reflects individual isActive statuses', async () => {
    const { token } = await getAdminToken();

    const custA = await createCustomer('1');
    const custB = await createCustomer('2');

    // Disable only Customer A
    await Retailer.findByIdAndUpdate(custA.retailer._id, { $set: { isActive: false } });

    const listRes = await request(app)
      .get('/api/v1/customers')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    const items = listRes.body.data;

    const itemA = items.find((i: any) => i.id === custA.retailer._id.toString());
    const itemB = items.find((i: any) => i.id === custB.retailer._id.toString());

    expect(itemA).toBeDefined();
    expect(itemB).toBeDefined();
    expect(itemA.isActive).toBe(false);
    expect(itemB.isActive).toBe(true);
  });

  // 11. Disabling a customer sends account disabled email notification
  test('11. Disabling customer triggers sendAccountDisabledEmail with reason', async () => {
    const { token } = await getAdminToken();
    const cust = await createCustomer('3');

    const emailSpy = jest.spyOn(EmailService, 'sendAccountDisabledEmail').mockResolvedValue({
      success: true,
      messageId: 'mock-disabled-msg-id',
    });

    const res = await request(app)
      .patch(`/api/v1/customers/${cust.retailer._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false, reason: 'Overdue balance of 30 days' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isActive).toBe(false);
    expect(res.body.data.emailNotification?.success).toBe(true);

    expect(emailSpy).toHaveBeenCalledTimes(1);
    expect(emailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: cust.retailer.email,
        businessName: cust.retailer.businessName,
        reason: 'Overdue balance of 30 days',
      })
    );
  });

  // 12. Enabling a customer sends account enabled email notification
  test('12. Enabling customer triggers sendAccountEnabledEmail', async () => {
    const { token } = await getAdminToken();
    const cust = await createCustomer('4');

    // First disable
    await Retailer.findByIdAndUpdate(cust.retailer._id, { $set: { isActive: false } });

    const emailSpy = jest.spyOn(EmailService, 'sendAccountEnabledEmail').mockResolvedValue({
      success: true,
      messageId: 'mock-enabled-msg-id',
    });

    const res = await request(app)
      .patch(`/api/v1/customers/${cust.retailer._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: true, reason: 'Account restored' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.emailNotification?.success).toBe(true);

    expect(emailSpy).toHaveBeenCalledTimes(1);
    expect(emailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: cust.retailer.email,
        businessName: cust.retailer.businessName,
      })
    );
  });
});
