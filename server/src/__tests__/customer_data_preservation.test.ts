import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from '../modules/users/user.model';
import { Retailer } from '../modules/retailers/retailer.model';
import { Order } from '../modules/orders/order.model';
import '../modules/pricing/pricing.model';
import '../modules/discounts/discount.model';
import { RetailerService } from '../modules/retailers/retailer.service';
import { EmailService } from '../modules/email/email.service';
import { seedDatabase } from '../scripts/seed';
import { createCustomerBackup } from '../scripts/backup-customer-data';
import { restoreCustomerData } from '../scripts/restore-customer-data';
import { AccountStatus, CreditStatus, CustomerType, UserRole, OrderStatus, PaymentMethod, PaymentStatus } from '@necessity/shared';
import fs from 'fs';
import path from 'path';

let mongoServer: MongoMemoryServer;

jest.setTimeout(30000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  jest.spyOn(EmailService, 'sendAccountDisabledEmail').mockResolvedValue({ success: true, messageId: 'mock-1' } as any);
  jest.spyOn(EmailService, 'sendAccountEnabledEmail').mockResolvedValue({ success: true, messageId: 'mock-2' } as any);
  jest.spyOn(EmailService, 'sendApprovalEmail').mockResolvedValue({ success: true, messageId: 'mock-3' } as any);
  jest.spyOn(EmailService, 'sendRejectionEmail').mockResolvedValue({ success: true, messageId: 'mock-4' } as any);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  jest.restoreAllMocks();
});

describe('CRITICAL: Customer Data Preservation & Immutability Suite', () => {
  let customerUser1: any;
  let retailerDoc1: any;
  let customerUser2: any;
  let retailerDoc2: any;

  beforeEach(async () => {
    // Clear and create 2 distinct customer accounts
    await User.deleteMany({});
    await Retailer.deleteMany({});
    await Order.deleteMany({});

    customerUser1 = await User.create({
      name: 'Ramesh Patel',
      phone: '+919876543210',
      email: 'ramesh@pateltextiles.com',
      passwordHash: 'hashed_password_1',
      role: UserRole.RETAILER,
      accountStatus: AccountStatus.ACTIVE,
    });

    retailerDoc1 = await Retailer.create({
      userId: customerUser1._id,
      businessName: 'Patel Textiles Wholesale',
      contactPerson: 'Ramesh Patel',
      phone: '+919876543210',
      email: 'ramesh@pateltextiles.com',
      gstin: '03AAICN2021R1Z1',
      pan: 'AAICN2021R',
      billingAddress: {
        street: 'Shop 12, Market Rd',
        city: 'Amritsar',
        state: 'Punjab',
        pincode: '143001',
        stateCode: '03',
      },
      customerType: CustomerType.RETAILER,
      creditLimitPaise: 5000000,
      paymentTermsDays: 15,
      creditStatus: CreditStatus.NORMAL,
      isActive: true,
    });

    customerUser1.retailerProfileId = retailerDoc1._id;
    await customerUser1.save();

    customerUser2 = await User.create({
      name: 'Suresh Kumar',
      phone: '+919876543211',
      email: 'suresh@kumarstores.in',
      passwordHash: 'hashed_password_2',
      role: UserRole.RETAILER,
      accountStatus: AccountStatus.PENDING,
    });

    retailerDoc2 = await Retailer.create({
      userId: customerUser2._id,
      businessName: 'Kumar Departmental Store',
      contactPerson: 'Suresh Kumar',
      phone: '+919876543211',
      email: 'suresh@kumarstores.in',
      gstin: '03AAICN2021R1Z2',
      pan: 'AAICN2021S',
      billingAddress: {
        street: 'Mall Road 45',
        city: 'Ludhiana',
        state: 'Punjab',
        pincode: '141001',
        stateCode: '03',
      },
      customerType: CustomerType.WHOLESALER,
      creditLimitPaise: 2000000,
      paymentTermsDays: 7,
      creditStatus: CreditStatus.NORMAL,
      isActive: true,
    });

    customerUser2.retailerProfileId = retailerDoc2._id;
    await customerUser2.save();
  });

  test('1. seedDatabase() NEVER deletes or overwrites existing customer records', async () => {
    // Run seedDatabase
    await seedDatabase(false);

    // Verify both customer records and their profiles are intact
    const allUsers = await User.find({ role: UserRole.RETAILER });
    expect(allUsers).toHaveLength(2);

    const ramesh = await User.findOne({ email: 'ramesh@pateltextiles.com' });
    expect(ramesh).toBeDefined();
    expect(ramesh?._id.toString()).toBe(customerUser1._id.toString());
    expect(ramesh?.passwordHash).toBe('hashed_password_1');

    const suresh = await User.findOne({ email: 'suresh@kumarstores.in' });
    expect(suresh).toBeDefined();
    expect(suresh?._id.toString()).toBe(customerUser2._id.toString());

    const allRetailers = await Retailer.find({});
    expect(allRetailers).toHaveLength(2);

    const patel = await Retailer.findOne({ businessName: 'Patel Textiles Wholesale' });
    expect(patel).toBeDefined();
    expect(patel?.creditLimitPaise).toBe(5000000);
    expect(patel?.customerType).toBe(CustomerType.RETAILER);
  });

  test('2. updateCustomerStatus (Disable/Enable) strictly modifies only target customer', async () => {
    const adminUser = await User.create({
      name: 'Super Admin',
      phone: '+919999999999',
      email: 'admin@necessityindia.com',
      passwordHash: 'hash',
      role: UserRole.SUPER_ADMIN,
      accountStatus: AccountStatus.ACTIVE,
    });

    // Disable Customer 1 (Patel)
    await RetailerService.updateCustomerStatus(
      retailerDoc1._id.toString(),
      false,
      adminUser._id.toString(),
      'Temporary audit'
    );

    // Verify Customer 1 is disabled but Customer 2 remains active
    const patelUpdated = await Retailer.findById(retailerDoc1._id);
    expect(patelUpdated?.isActive).toBe(false);
    expect(patelUpdated?.businessName).toBe('Patel Textiles Wholesale'); // Preserved!
    expect(patelUpdated?.creditLimitPaise).toBe(5000000); // Preserved!

    const sureshUntouched = await Retailer.findById(retailerDoc2._id);
    expect(sureshUntouched?.isActive).toBe(true); // Untouched!
    expect(sureshUntouched?.businessName).toBe('Kumar Departmental Store'); // Untouched!
  });

  test('3. updateApproval modifies only target customer and retains existing details', async () => {
    const adminUser = await User.findOne({ role: UserRole.SUPER_ADMIN }) || await User.create({
      name: 'Super Admin',
      phone: '+919999999999',
      email: 'admin@necessityindia.com',
      passwordHash: 'hash',
      role: UserRole.SUPER_ADMIN,
      accountStatus: AccountStatus.ACTIVE,
    });

    // Approve customer 2 (Suresh)
    await RetailerService.updateApproval(
      retailerDoc2._id.toString(),
      {
        status: AccountStatus.ACTIVE,
        customerType: CustomerType.WHOLESALER,
        creditLimitPaise: 3500000,
        paymentTermsDays: 21,
      },
      adminUser._id.toString()
    );

    // Customer 2 should be active and have updated credit
    const sureshUpdated = await Retailer.findById(retailerDoc2._id);
    expect(sureshUpdated?.customerType).toBe(CustomerType.WHOLESALER);
    expect(sureshUpdated?.creditLimitPaise).toBe(3500000);
    expect(sureshUpdated?.paymentTermsDays).toBe(21);
    expect(sureshUpdated?.businessName).toBe('Kumar Departmental Store'); // Preserved!

    // Customer 1 should be completely unchanged
    const patelUntouched = await Retailer.findById(retailerDoc1._id);
    expect(patelUntouched?.creditLimitPaise).toBe(5000000);
    expect(patelUntouched?.customerType).toBe(CustomerType.RETAILER);
  });

  test('4. listRetailers retrieves existing customers without pagination drops', async () => {
    const res = await RetailerService.listRetailers({ page: 1, limit: 10 });
    expect(res.total).toBe(2);
    expect(res.data).toHaveLength(2);
    const names = res.data.map((r: any) => r.businessName);
    expect(names).toContain('Patel Textiles Wholesale');
    expect(names).toContain('Kumar Departmental Store');
  });

  test('5. Safe Archival preserves customer when order history exists', async () => {
    const adminUser = await User.findOne({ role: UserRole.SUPER_ADMIN }) || await User.create({
      name: 'Super Admin',
      phone: '+919999999999',
      email: 'admin@necessityindia.com',
      passwordHash: 'hash',
      role: UserRole.SUPER_ADMIN,
      accountStatus: AccountStatus.ACTIVE,
    });

    // Create a valid order for Customer 1
    await Order.create({
      orderNumber: 'ORD-TEST-001',
      retailerId: retailerDoc1._id,
      retailerName: retailerDoc1.businessName,
      placedByUserId: customerUser1._id,
      placedByName: customerUser1.name,
      deliveryAddress: {
        street: 'Shop 12',
        city: 'Amritsar',
        state: 'Punjab',
        pincode: '143001',
        stateCode: '03',
      },
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      paymentStatus: PaymentStatus.PENDING,
      status: OrderStatus.APPROVED,
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          skuSnapshot: 'SKU-001',
          productNameSnapshot: 'Test Cotton Towel',
          hsnCodeSnapshot: '6302',
          gstRatePercentSnapshot: 12,
          quantity: 10,
          unitPricePaiseSnapshot: 10000,
          appliedDiscountPaise: 0,
          taxableAmountPaise: 89286,
          cgstPaise: 5357,
          sgstPaise: 5357,
          igstPaise: 0,
          lineTotalPaise: 100000,
        },
      ],
      subtotalPaise: 100000,
      totalDiscountPaise: 0,
      taxableAmountPaise: 89286,
      totalCgstPaise: 5357,
      totalSgstPaise: 5357,
      totalIgstPaise: 0,
      deliveryFeePaise: 0,
      grandTotalPaise: 100000,
      notifications: [],
    });

    // Attempt deleteOrArchive
    const result = await RetailerService.deleteOrArchiveCustomer(
      retailerDoc1._id.toString(),
      adminUser._id.toString()
    );

    expect(result.action).toBe('archived');
    // Ensure document was NOT dropped/deleted
    const archivedDoc = await Retailer.findById(retailerDoc1._id);
    expect(archivedDoc).toBeDefined();
    expect(archivedDoc?.isArchived).toBe(true);
    expect(archivedDoc?.isActive).toBe(false);
  });

  test('6. Backup and Restore preserves full fidelity of customer data', async () => {
    const tmpDir = path.resolve(__dirname, '../../test-backups');
    const backupPath = await createCustomerBackup(tmpDir);

    expect(fs.existsSync(backupPath)).toBe(true);
    const backupContent = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    expect(backupContent.metadata.totalCounts.retailers).toBe(2);

    // Modify a field in memory
    await Retailer.updateOne({ _id: retailerDoc1._id }, { $set: { businessName: 'Corrupted Name' } });
    expect((await Retailer.findById(retailerDoc1._id))?.businessName).toBe('Corrupted Name');

    // Run restore
    await restoreCustomerData(backupPath);

    // Verify restored original name
    const restoredPatel = await Retailer.findById(retailerDoc1._id);
    expect(restoredPatel?.businessName).toBe('Patel Textiles Wholesale');

    // Clean up temporary test backup
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }
    if (fs.existsSync(tmpDir)) {
      fs.rmdirSync(tmpDir);
    }
  });
});
