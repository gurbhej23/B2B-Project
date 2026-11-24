import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { User } from '../modules/users/user.model';
import { Retailer } from '../modules/retailers/retailer.model';
import { Category } from '../modules/products/category.model';
import { Product } from '../modules/products/product.model';
import { PricingGroup, ProductPricingRule } from '../modules/pricing/pricing.model';
import { DiscountGroup, ProductDiscount, Coupon } from '../modules/discounts/discount.model';
import {
  UserRole,
  AccountStatus,
  CreditStatus,
  CustomerType,
  PaymentMethod,
  DiscountType,
  DiscountScope,
} from '@necessity/shared';

let mongoServer: MongoMemoryServer;
let app: any;
let adminToken: string;
let superAdminUser: any;

let testCategory: any;
let testProduct: any;

let standardRetailerUser: any;
let standardRetailerToken: string;
let standardRetailerDoc: any;

let wholesalerUser: any;
let wholesalerToken: string;
let wholesalerDoc: any;

let distributorUser: any;
let distributorToken: string;
let distributorDoc: any;

let goldPricingGroup: any;
let vipDiscountGroup: any;

jest.setTimeout(60000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  app = createApp();

  // 1. Create Super Admin
  await request(app).post('/api/v1/auth/register').send({
    businessName: 'Necessity India Corporate',
    contactPerson: 'Executive Admin',
    phone: '+919999000001',
    email: 'executive.admin@necessityindia.com',
    password: 'AdminPassword123!',
    billingAddress: {
      street: 'Tower A, Bandra Kurla Complex',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400051',
      stateCode: '27',
    },
    termsAccepted: true,
  });

  superAdminUser = await User.findOne({ phone: '+919999000001' });
  superAdminUser!.role = UserRole.SUPER_ADMIN;
  superAdminUser!.accountStatus = AccountStatus.ACTIVE;
  await superAdminUser!.save();

  const adminLoginRes = await request(app).post('/api/v1/auth/login').send({
    identifier: 'executive.admin@necessityindia.com',
    password: 'AdminPassword123!',
  });
  adminToken = adminLoginRes.body.data.tokens.accessToken;

  // 2. Create Category and Test Product
  testCategory = await Category.create({
    name: 'Commercial Textiles',
    slug: 'commercial-textiles',
    isActive: true,
  });

  // Base product: dealer price = ₹200 (20000 paise), MRP = ₹350 (35000 paise)
  testProduct = await Product.create({
    sku: 'TEX-COM-100',
    name: 'Heavy Duty Commercial Bed Linen',
    description: '100% Cotton Hotel Grade Linen Sheet',
    categoryId: testCategory._id,
    categoryName: testCategory.name,
    brand: 'Necessity Prime',
    images: [{ url: 'https://example.com/linen.jpg', isPrimary: true }],
    uom: 'PCS',
    packSize: 5,
    caseQuantity: 20,
    mrpPaise: 35000,
    dealerPricePaise: 20000, // ₹200.00 base dealer price
    hsnCode: '6302',
    gstRatePercent: 12,
    minOrderQuantity: 1,
    orderQuantityMultiple: 1,
    stockOnHand: 500,
    stockReserved: 0,
    isActive: true,
  });

  // 3. Create a custom Pricing Group and Discount Group
  goldPricingGroup = await PricingGroup.create({
    name: 'Gold Wholesale Tier Group',
    code: 'gold-tier',
    description: 'Assigned wholesale tier for high-volume accounts',
    applicableCustomerTypes: [CustomerType.WHOLESALER, CustomerType.DISTRIBUTOR],
    isDefault: false,
    isActive: true,
  });

  vipDiscountGroup = await DiscountGroup.create({
    name: 'VIP Key Accounts Discount Group',
    code: 'vip-discount',
    description: 'Additional commercial rebates for approved key accounts',
    discountPercent: 5,
    applicableCustomerTypes: [CustomerType.WHOLESALER, CustomerType.DISTRIBUTOR],
    isActive: true,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Customer Types, Pricing Groups & 4-Level Pricing Engine Integration Tests', () => {
  // =========================================================================
  // TEST 1: CUSTOMER REGISTRATION, ADMIN APPROVAL & ROLE ASSIGNMENT
  // =========================================================================
  describe('1. Customer Registration, Approval & Role Assignment Workflow', () => {
    let pendingRetailerId: string;
    let pendingUserId: string;

    test('1.1 Customer registers via mobile API in PENDING state with default RETAILER type', async () => {
      const regRes = await request(app).post('/api/v1/auth/register').send({
        businessName: 'Apex Wholesale Corp',
        contactPerson: 'Suresh Shah',
        phone: '+919820111111',
        email: 'suresh@apexwholesale.com',
        password: 'WholesalerPassword123!',
        billingAddress: {
          street: 'Market Yard Gate 2',
          city: 'Pune',
          state: 'Maharashtra',
          pincode: '411037',
          stateCode: '27',
        },
        termsAccepted: true,
      });

      expect(regRes.status).toBe(201);
      expect(regRes.body.success).toBe(true);

      const user = await User.findOne({ phone: '+919820111111' });
      expect(user).toBeDefined();
      expect(user!.accountStatus).toBe(AccountStatus.PENDING);
      pendingUserId = user!._id.toString();

      const retailer = await Retailer.findOne({ userId: user!._id });
      expect(retailer).toBeDefined();
      pendingRetailerId = retailer!._id.toString();
      expect(['new', CustomerType.RETAILER]).toContain(retailer!.customerType);
    });

    test('1.2 Pending customer cannot place orders or checkout', async () => {
      // Login as pending customer
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        identifier: '+919820111111',
        password: 'WholesalerPassword123!',
      });
      const pendingToken = loginRes.body.data.tokens.accessToken;

      // Try checking out
      const checkoutRes = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${pendingToken}`)
        .send({
          items: [{ productId: testProduct._id.toString(), quantity: 5 }],
          paymentMethod: PaymentMethod.CREDIT_ACCOUNT,
          deliveryAddress: {
            street: 'Market Yard Gate 2',
            city: 'Pune',
            state: 'Maharashtra',
            pincode: '411037',
            stateCode: '27',
          },
          idempotencyKey: 'pending-checkout-attempt-1',
        });

      expect(checkoutRes.status).toBe(403);
      expect(checkoutRes.body.success).toBe(false);
    });

    test('1.3 Admin approves pending customer as WHOLESALER with Pricing & Discount Groups', async () => {
      const approveRes = await request(app)
        .patch(`/api/v1/retailers/${pendingRetailerId}/approval`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: AccountStatus.ACTIVE,
          customerType: CustomerType.WHOLESALER,
          pricingGroupId: goldPricingGroup._id.toString(),
          discountGroupId: vipDiscountGroup._id.toString(),
          creditLimitPaise: 5000000, // ₹50,000
          paymentTermsDays: 30,
          creditStatus: CreditStatus.NORMAL,
        });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.success).toBe(true);
      expect(approveRes.body.data.customerType).toBe(CustomerType.WHOLESALER);

      // Verify persistence in DB
      const updatedRetailer = await Retailer.findById(pendingRetailerId);
      expect(updatedRetailer!.customerType).toBe(CustomerType.WHOLESALER);
      expect(updatedRetailer!.pricingGroupId?.toString()).toBe(goldPricingGroup._id.toString());
      expect(updatedRetailer!.discountGroupId?.toString()).toBe(vipDiscountGroup._id.toString());

      const updatedUser = await User.findById(pendingUserId);
      expect(updatedUser!.accountStatus).toBe(AccountStatus.ACTIVE);

      wholesalerUser = updatedUser;
      wholesalerDoc = updatedRetailer;

      // Login to get active wholesaler token
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        identifier: '+919820111111',
        password: 'WholesalerPassword123!',
      });
      wholesalerToken = loginRes.body.data.tokens.accessToken;
    });

    test('1.4 Create standard Retailer and Distributor accounts for precedence testing', async () => {
      // Create standard Retailer
      await request(app).post('/api/v1/auth/register').send({
        businessName: 'Standard Corner Store',
        contactPerson: 'Karan Mehra',
        phone: '+919820222222',
        email: 'karan@cornerstore.com',
        password: 'RetailerPassword123!',
        billingAddress: {
          street: 'Main Road',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400002',
          stateCode: '27',
        },
        termsAccepted: true,
      });

      standardRetailerUser = await User.findOne({ phone: '+919820222222' });
      standardRetailerDoc = await Retailer.findOne({ userId: standardRetailerUser._id });

      await request(app)
        .patch(`/api/v1/retailers/${standardRetailerDoc._id}/approval`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: AccountStatus.ACTIVE,
          customerType: CustomerType.RETAILER,
          creditLimitPaise: 2000000,
        });

      const retLogin = await request(app).post('/api/v1/auth/login').send({
        identifier: '+919820222222',
        password: 'RetailerPassword123!',
      });
      standardRetailerToken = retLogin.body.data.tokens.accessToken;

      // Create Distributor
      await request(app).post('/api/v1/auth/register').send({
        businessName: 'Maharashtra Regional Distributors',
        contactPerson: 'Vijay Verma',
        phone: '+919820333333',
        email: 'vijay@distributors.com',
        password: 'DistributorPassword123!',
        billingAddress: {
          street: 'Industrial Area',
          city: 'Nagpur',
          state: 'Maharashtra',
          pincode: '440001',
          stateCode: '27',
        },
        termsAccepted: true,
      });

      distributorUser = await User.findOne({ phone: '+919820333333' });
      distributorDoc = await Retailer.findOne({ userId: distributorUser._id });

      await request(app)
        .patch(`/api/v1/retailers/${distributorDoc._id}/approval`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: AccountStatus.ACTIVE,
          customerType: CustomerType.DISTRIBUTOR,
          pricingGroupId: goldPricingGroup._id.toString(),
          creditLimitPaise: 10000000,
        });

      const distLogin = await request(app).post('/api/v1/auth/login').send({
        identifier: '+919820333333',
        password: 'DistributorPassword123!',
      });
      distributorToken = distLogin.body.data.tokens.accessToken;
    });
  });

  // =========================================================================
  // TEST 2: PRICING ENGINE 4-LEVEL PRECEDENCE VERIFICATION
  // =========================================================================
  describe('2. Pricing Engine 4-Level Precedence Hierarchy', () => {
    // Base Price: 20000 paise (₹200.00)
    // Level 3: Customer Type Rule (WHOLESALER) -> 18500 paise (₹185.00)
    // Level 2: Pricing Group Rule (goldPricingGroup) -> 17000 paise (₹170.00)
    // Level 1: Customer-Specific Override (distributorDoc) -> 15500 paise (₹155.00)

    beforeAll(async () => {
      // Level 3 Rule: Customer Type 'wholesaler' gets ₹185
      await ProductPricingRule.create({
        productId: testProduct._id,
        customerType: CustomerType.WHOLESALER,
        customPricePaise: 18500,
        isActive: true,
      });

      // Level 2 Rule: Gold Pricing Group gets ₹170
      await ProductPricingRule.create({
        productId: testProduct._id,
        pricingGroupId: goldPricingGroup._id,
        customPricePaise: 17000,
        isActive: true,
      });

      // Level 1 Rule: Customer-Specific Override for distributor gets ₹155
      await ProductPricingRule.create({
        productId: testProduct._id,
        retailerId: distributorDoc._id,
        customPricePaise: 15500,
        isActive: true,
      });
    });

    test('2.1 Level 4: Standard Retailer with no custom rule gets default base price (₹200)', async () => {
      const res = await request(app)
        .post('/api/v1/orders/calculate-cart')
        .set('Authorization', `Bearer ${standardRetailerToken}`)
        .send({
          items: [{ productId: testProduct._id.toString(), quantity: 1 }],
          deliveryStateCode: '27',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Unit price = 20000 paise
      expect(res.body.data.items[0].unitPricePaiseSnapshot).toBe(20000);
      expect(res.body.data.taxableAmountPaise).toBe(20000);
    });

    test('2.2 Level 3: Wholesaler without pricing group gets Customer-Type rule (₹185)', async () => {
      // Temporarily clear pricingGroupId on wholesaler to test Level 3 fallback
      await Retailer.findByIdAndUpdate(wholesalerDoc._id, { pricingGroupId: null });

      const res = await request(app)
        .post('/api/v1/orders/calculate-cart')
        .set('Authorization', `Bearer ${wholesalerToken}`)
        .send({
          items: [{ productId: testProduct._id.toString(), quantity: 1 }],
          deliveryStateCode: '27',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Wholesaler type price = 18500 paise
      expect(res.body.data.items[0].unitPricePaiseSnapshot).toBe(18500);
    });

    test('2.3 Level 2: Wholesaler assigned to Gold Pricing Group gets Pricing Group rule (₹170)', async () => {
      // Re-assign goldPricingGroup to wholesaler
      await Retailer.findByIdAndUpdate(wholesalerDoc._id, { pricingGroupId: goldPricingGroup._id });

      const res = await request(app)
        .post('/api/v1/orders/calculate-cart')
        .set('Authorization', `Bearer ${wholesalerToken}`)
        .send({
          items: [{ productId: testProduct._id.toString(), quantity: 1 }],
          deliveryStateCode: '27',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Pricing Group rule overrides Customer Type rule -> 17000 paise
      expect(res.body.data.items[0].unitPricePaiseSnapshot).toBe(17000);
    });

    test('2.4 Level 1: Customer-Specific override supersedes Pricing Group & Customer Type (₹155)', async () => {
      // Distributor has goldPricingGroup AND customer-specific override
      const res = await request(app)
        .post('/api/v1/orders/calculate-cart')
        .set('Authorization', `Bearer ${distributorToken}`)
        .send({
          items: [{ productId: testProduct._id.toString(), quantity: 1 }],
          deliveryStateCode: '27',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Customer specific override wins -> 15500 paise
      expect(res.body.data.items[0].unitPricePaiseSnapshot).toBe(15500);
    });
  });

  // =========================================================================
  // TEST 3: WHOLESALER QUANTITY TIERS & MOQ VALIDATION
  // =========================================================================
  describe('3. Quantity-Based Tier Pricing Slabs & MOQ Validation', () => {
    let tierProduct: any;

    beforeAll(async () => {
      tierProduct = await Product.create({
        sku: 'TIER-PROD-01',
        name: 'Bulk Industrial Cotton Cleaning Rolls',
        description: 'High tensile microfiber cleaning cloth rolls for industrial use',
        categoryId: testCategory._id,
        categoryName: testCategory.name,
        brand: 'Necessity Prime',
        uom: 'ROLL',
        packSize: 1,
        mrpPaise: 50000,
        dealerPricePaise: 30000, // ₹300.00
        hsnCode: '6302',
        gstRatePercent: 12,
        minOrderQuantity: 1,
        stockOnHand: 1000,
        stockReserved: 0,
        isActive: true,
      });

      // Pricing rule on this tier product with quantity slabs:
      // MOQ: 5 units
      // 5-9 units: ₹280 (28000 paise)
      // 10-49 units: ₹250 (25000 paise)
      // 50+ units: ₹220 (22000 paise)
      await ProductPricingRule.create({
        productId: tierProduct._id,
        customerType: CustomerType.WHOLESALER,
        customPricePaise: 28000,
        minOrderQuantity: 5,
        tierPricing: [
          { minQuantity: 5, maxQuantity: 9, unitPricePaise: 28000 },
          { minQuantity: 10, maxQuantity: 49, unitPricePaise: 25000 },
          { minQuantity: 50, maxQuantity: undefined, unitPricePaise: 22000 },
        ],
        isActive: true,
      });
    });

    test('3.1 Rejects order when quantity is below configured rule MOQ (ordered 3 < MOQ 5)', async () => {
      const res = await request(app)
        .post('/api/v1/orders/calculate-cart')
        .set('Authorization', `Bearer ${wholesalerToken}`)
        .send({
          items: [{ productId: tierProduct._id.toString(), quantity: 3 }],
          deliveryStateCode: '27',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/minimum order quantity.*5/i);
    });

    test('3.2 Resolves slab 1 price (₹280) when ordering 6 units', async () => {
      const res = await request(app)
        .post('/api/v1/orders/calculate-cart')
        .set('Authorization', `Bearer ${wholesalerToken}`)
        .send({
          items: [{ productId: tierProduct._id.toString(), quantity: 6 }],
          deliveryStateCode: '27',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items[0].unitPricePaiseSnapshot).toBe(28000);
      expect(res.body.data.taxableAmountPaise).toBe(28000 * 6);
    });

    test('3.3 Resolves slab 2 volume price (₹250) when ordering 20 units', async () => {
      const res = await request(app)
        .post('/api/v1/orders/calculate-cart')
        .set('Authorization', `Bearer ${wholesalerToken}`)
        .send({
          items: [{ productId: tierProduct._id.toString(), quantity: 20 }],
          deliveryStateCode: '27',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items[0].unitPricePaiseSnapshot).toBe(25000);
      expect(res.body.data.taxableAmountPaise).toBe(25000 * 20);
    });

    test('3.4 Resolves slab 3 max-volume price (₹220) when ordering 100 units', async () => {
      const res = await request(app)
        .post('/api/v1/orders/calculate-cart')
        .set('Authorization', `Bearer ${wholesalerToken}`)
        .send({
          items: [{ productId: tierProduct._id.toString(), quantity: 100 }],
          deliveryStateCode: '27',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items[0].unitPricePaiseSnapshot).toBe(22000);
      expect(res.body.data.taxableAmountPaise).toBe(22000 * 100);
    });
  });

  // =========================================================================
  // TEST 4: DISCOUNT GROUPS & CUSTOMER TYPE RESTRICTIONS
  // =========================================================================
  describe('4. Discount Groups & Customer-Type Restricted Discounts & Coupons', () => {
    let wholesalerOnlyDiscount: any;
    let vipCoupon: any;

    beforeAll(async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Product discount only for 'wholesaler' type
      wholesalerOnlyDiscount = await ProductDiscount.create({
        name: 'Exclusive Wholesaler 10% Rebate',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 10,
        scope: DiscountScope.ALL_PRODUCTS,
        eligibleCustomerTypes: [CustomerType.WHOLESALER],
        startDate: now,
        endDate: future,
        isActive: true,
        priority: 10,
      });

      // Coupon restricted to vipDiscountGroup
      vipCoupon = await Coupon.create({
        code: 'VIPREBATE500',
        description: '₹500 flat discount for VIP discount group members',
        discountType: DiscountType.FIXED_AMOUNT,
        discountValue: 50000, // ₹500
        minOrderValuePaise: 50000,
        eligibleDiscountGroupIds: [vipDiscountGroup._id],
        startDate: now,
        endDate: future,
        perCustomerLimit: 5,
        isActive: true,
      });
    });

    test('4.1 Wholesaler gets wholesaler-only product discount', async () => {
      const res = await request(app)
        .post('/api/v1/orders/calculate-cart')
        .set('Authorization', `Bearer ${wholesalerToken}`)
        .send({
          items: [{ productId: testProduct._id.toString(), quantity: 10 }],
          deliveryStateCode: '27',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Unit price for wholesaler with gold group is 17000 paise
      // 10% discount = 1700 paise per item -> 17000 total discount for 10 items
      expect(res.body.data.totalProductDiscountPaise).toBeGreaterThan(0);
      expect(res.body.data.items[0].appliedDiscountPaise).toBe(17000);
    });

    test('4.2 Retailer is ineligible for wholesaler-only discount', async () => {
      const res = await request(app)
        .post('/api/v1/orders/calculate-cart')
        .set('Authorization', `Bearer ${standardRetailerToken}`)
        .send({
          items: [{ productId: testProduct._id.toString(), quantity: 10 }],
          deliveryStateCode: '27',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Retailer does NOT get the discount
      expect(res.body.data.totalProductDiscountPaise).toBe(0);
      expect(res.body.data.items[0].appliedDiscountPaise).toBe(0);
    });

    test('4.3 Wholesaler assigned to VIP discount group can apply VIP coupon', async () => {
      const res = await request(app)
        .post('/api/v1/orders/calculate-cart')
        .set('Authorization', `Bearer ${wholesalerToken}`)
        .send({
          items: [{ productId: testProduct._id.toString(), quantity: 10 }],
          couponCode: 'VIPREBATE500',
          deliveryStateCode: '27',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.couponCode).toBe('VIPREBATE500');
      expect(res.body.data.couponDiscountPaise).toBe(50000); // ₹500 off
    });

    test('4.4 Retailer NOT in VIP discount group cannot apply VIP coupon', async () => {
      const res = await request(app)
        .post('/api/v1/orders/calculate-cart')
        .set('Authorization', `Bearer ${standardRetailerToken}`)
        .send({
          items: [{ productId: testProduct._id.toString(), quantity: 10 }],
          couponCode: 'VIPREBATE500',
          deliveryStateCode: '27',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/not (valid|eligible) for your customer (discount group|profile)/i);
    });
  });

  // =========================================================================
  // TEST 5: ZERO CLIENT TRUST & ACCESS CONTROL
  // =========================================================================
  describe('5. Zero Client Trust & Tamper Resistance', () => {
    test('5.1 Backend overrides client-tampered price in checkout', async () => {
      // Wholesaler with gold tier price is 17000 paise (₹170)
      // Client attempts to pass fake low price: 1000 paise (₹10)
      const checkoutRes = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${wholesalerToken}`)
        .send({
          items: [
            {
              productId: testProduct._id.toString(),
              quantity: 2,
              unitPricePaise: 1000, // TAMPER ATTEMPT
              lineTotalPaise: 2000,
            },
          ],
          paymentMethod: PaymentMethod.CREDIT_ACCOUNT,
          deliveryAddress: {
            street: 'Market Yard Gate 2',
            city: 'Pune',
            state: 'Maharashtra',
            pincode: '411037',
            stateCode: '27',
          },
          idempotencyKey: 'tamper-price-test-checkout',
        });

      expect(checkoutRes.status).toBe(201);
      expect(checkoutRes.body.success).toBe(true);

      const placedOrder = checkoutRes.body.data;
      // Authoritative unit price 17000 minus 10% discount (1700) = 15300 paise taxable per unit
      expect(placedOrder.items[0].unitPricePaiseSnapshot).toBe(17000);
      expect(placedOrder.items[0].appliedDiscountPaise).toBe(3400); // 1700 * 2
      expect(placedOrder.taxableAmountPaise).toBe(15300 * 2);
    });

    test('5.2 Disabled retailer is immediately blocked from cart and checkout', async () => {
      // Admin deactivates standard retailer
      const disableRes = await request(app)
        .patch(`/api/v1/customers/${standardRetailerDoc._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false, reason: 'Audit compliance review' });

      expect(disableRes.status).toBe(200);

      const res = await request(app)
        .post('/api/v1/orders/calculate-cart')
        .set('Authorization', `Bearer ${standardRetailerToken}`)
        .send({
          items: [{ productId: testProduct._id.toString(), quantity: 1 }],
          deliveryStateCode: '27',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CUSTOMER_DISABLED');
    });
  });
});
