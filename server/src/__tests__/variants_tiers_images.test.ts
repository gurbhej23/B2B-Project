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
  validateTierPricing,
  resolveTierPrice,
  getNextTierSavings,
} from '@necessity/shared';

let mongoServer: MongoMemoryServer;
let app: any;
let adminToken: string;
let retailerToken: string;
let categoryDoc: any;
let retailerDoc: any;

jest.setTimeout(60000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  app = createApp();

  // 1. Admin registration & promotion
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

  const adminUser = await User.findOne({ email: 'admin@necessityindia.com' });
  adminUser!.role = UserRole.SUPER_ADMIN;
  adminUser!.accountStatus = AccountStatus.ACTIVE;
  await adminUser!.save();

  const adminLoginRes = await request(app).post('/api/v1/auth/login').send({
    identifier: 'admin@necessityindia.com',
    password: 'AdminPassword123!',
  });
  adminToken = adminLoginRes.body.data.tokens.accessToken;

  // 2. Retailer registration & approval
  await request(app).post('/api/v1/auth/register').send({
    businessName: 'Royal Hospitality Supplies',
    contactPerson: 'Karan Sharma',
    phone: '+919876543210',
    email: 'karan@royalhospitality.in',
    password: 'RetailerPassword123!',
    billingAddress: {
      street: '100 Gateway Blvd',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      stateCode: '27',
    },
    termsAccepted: true,
  });

  const retUser = await User.findOne({ email: 'karan@royalhospitality.in' });
  const pendingRetailer = await Retailer.findOne({ userId: retUser!._id });

  await request(app)
    .patch(`/api/v1/retailers/${pendingRetailer!._id}/approval`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      status: AccountStatus.ACTIVE,
      creditLimitPaise: 20000000, // ₹2,00,000
      paymentTermsDays: 30,
      creditStatus: CreditStatus.NORMAL,
    });

  retailerDoc = await Retailer.findById(pendingRetailer!._id);

  const retLoginRes = await request(app).post('/api/v1/auth/login').send({
    identifier: 'karan@royalhospitality.in',
    password: 'RetailerPassword123!',
  });
  retailerToken = retLoginRes.body.data.tokens.accessToken;

  // 3. Category creation
  categoryDoc = await Category.create({
    name: 'Institutional Textiles',
    slug: 'institutional-textiles',
    isActive: true,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('1. Multiple Product Images Feature', () => {
  it('allows uploading a product image with file validation', async () => {
    // 1x1 transparent PNG base64
    const validBase64 =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const res = await request(app)
      .post('/api/v1/products/upload-image')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fileBase64: validBase64,
        fileName: 'towel-primary.png',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.url).toMatch(/^\/uploads\/products\//);
  });

  it('rejects unsupported image file types', async () => {
    const invalidBase64 = 'data:application/pdf;base64,JVBERi0xLjUK...';

    const res = await request(app)
      .post('/api/v1/products/upload-image')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fileBase64: invalidBase64,
        fileName: 'document.pdf',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('persists ordered image gallery and primary cover selection on product creation', async () => {
    const images = [
      { url: 'https://example.com/towel-front.jpg', isPrimary: false, altText: 'Front View' },
      { url: 'https://example.com/towel-cover.jpg', isPrimary: true, altText: 'Cover View' },
      { url: 'https://example.com/towel-label.jpg', isPrimary: false, altText: 'Label Spec' },
    ];

    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Luxury Bath Towel 600 GSM',
        sku: 'TOWEL-LUX-600',
        categoryId: categoryDoc._id,
        brand: 'Necessity India',
        description: 'Heavy duty 600 GSM 100% cotton institutional bath towel.',
        hsnCode: '6302',
        uom: 'PCS',
        images,
        mrpPaise: 49900,
        dealerPricePaise: 25000,
        gstRatePercent: 12,
        stockOnHand: 500,
        minOrderQuantity: 10,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.images).toHaveLength(3);
    expect(res.body.data.images[1].isPrimary).toBe(true);
    expect(res.body.data.images[0].url).toBe('https://example.com/towel-front.jpg');
  });
});

describe('2. Product Variants Feature', () => {
  let variantProduct: any;
  let variant1Id: string;
  let variant2Id: string;

  it('creates product with multiple variants having unique SKUs, stock and prices', async () => {
    const variants = [
      {
        sku: 'HANDWASH-500ML',
        name: '500 ml Pump Bottle',
        attributes: { Volume: '500 ml', Type: 'Pump' },
        stockOnHand: 150,
        dealerPricePaise: 12000, // ₹120
        mrpPaise: 18000, // ₹180
        isActive: true,
      },
      {
        sku: 'HANDWASH-5L',
        name: '5 Litre Canister Refill',
        attributes: { Volume: '5 Litre', Type: 'Canister' },
        stockOnHand: 50,
        dealerPricePaise: 80000, // ₹800
        mrpPaise: 120000, // ₹1,200
        isActive: true,
      },
    ];

    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Antiseptic Liquid Handwash',
        sku: 'HANDWASH-BASE',
        categoryId: categoryDoc._id,
        brand: 'Necessity India',
        description: 'Hospital grade germicidal hand hygiene liquid soap.',
        hsnCode: '3401',
        uom: 'PCS',
        hasVariants: true,
        variants,
        mrpPaise: 18000,
        dealerPricePaise: 12000,
        gstRatePercent: 18,
        minOrderQuantity: 1,
      });

    expect(res.status).toBe(201);
    variantProduct = res.body.data;
    expect(variantProduct.hasVariants).toBe(true);
    expect(variantProduct.variants).toHaveLength(2);
    expect(variantProduct.stockOnHand).toBe(200); // 150 + 50 auto-aggregated

    variant1Id = variantProduct.variants[0]._id || variantProduct.variants[0].id;
    variant2Id = variantProduct.variants[1]._id || variantProduct.variants[1].id;
  });

  it('rejects duplicate variant SKU across products or variants', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Duplicate Handwash',
        sku: 'HANDWASH-NEW',
        categoryId: categoryDoc._id,
        brand: 'Necessity India',
        description: 'Duplicate product test.',
        hsnCode: '3401',
        uom: 'PCS',
        hasVariants: true,
        variants: [
          {
            sku: 'HANDWASH-500ML', // Already taken by previous product
            name: 'Conflicting SKU Variant',
            attributes: { Volume: '500 ml' },
            stockOnHand: 10,
          },
        ],
        mrpPaise: 20000,
        dealerPricePaise: 15000,
        gstRatePercent: 18,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/SKU.*already in use/i);
  });

  it('allows activating and deactivating a variant', async () => {
    const res = await request(app)
      .patch(`/api/v1/products/${variantProduct.id}/variants/${variant1Id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.data.variants[0].isActive).toBe(false);

    // Re-activate
    const res2 = await request(app)
      .patch(`/api/v1/products/${variantProduct.id}/variants/${variant1Id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true });

    expect(res2.status).toBe(200);
    expect(res2.body.data.variants[0].isActive).toBe(true);
  });

  it('prevents deletion of variants that are referenced in customer orders', async () => {
    // 1. Place order with variant 1 (500ml)
    const checkoutRes = await request(app)
      .post('/api/v1/orders/checkout')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        items: [
          {
            productId: variantProduct.id,
            variantId: variant1Id,
            quantity: 5,
          },
        ],
        paymentMethod: PaymentMethod.CREDIT_ACCOUNT,
        idempotencyKey: 'idemp-variant-order-1',
        deliveryAddress: {
          street: '100 Gateway Blvd',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          stateCode: '27',
        },
      });

    expect(checkoutRes.status).toBe(201);
    expect(checkoutRes.body.data.items[0].variantSkuSnapshot).toBe('HANDWASH-500ML');

    // 2. Attempt to delete variant 1 as admin
    const deleteRes = await request(app)
      .delete(`/api/v1/products/${variantProduct.id}/variants/${variant1Id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(400);
    expect(deleteRes.body.message).toMatch(/referenced in .* existing order/i);

    // 3. Deleting unreferenced variant 2 succeeds
    const deleteVar2Res = await request(app)
      .delete(`/api/v1/products/${variantProduct.id}/variants/${variant2Id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteVar2Res.status).toBe(200);
    expect(deleteVar2Res.body.data.variants).toHaveLength(1);
  });
});

describe('3. Quantity-Based Tier Pricing Feature', () => {
  let tierProduct: any;

  // Standard tiers matching spec example:
  // 1-9: ₹120 (12000 paise)
  // 10-49: ₹100 (10000 paise)
  // 50-99: ₹90 (9000 paise)
  // 100+: ₹80 (8000 paise)
  const exampleTiers = [
    { minQuantity: 1, maxQuantity: 9, unitPricePaise: 12000 },
    { minQuantity: 10, maxQuantity: 49, unitPricePaise: 10000 },
    { minQuantity: 50, maxQuantity: 99, unitPricePaise: 9000 },
    { minQuantity: 100, unitPricePaise: 8000 },
  ];

  it('validates tier pricing continuous coverage and detects overlaps or gaps', () => {
    // Valid tiers
    const validRes = validateTierPricing(exampleTiers);
    expect(validRes.valid).toBe(true);

    // Overlapping tiers (1-10 and 10-49)
    const overlapTiers = [
      { minQuantity: 1, maxQuantity: 10, unitPricePaise: 12000 },
      { minQuantity: 10, maxQuantity: 49, unitPricePaise: 10000 },
    ];
    const overlapRes = validateTierPricing(overlapTiers);
    expect(overlapRes.valid).toBe(false);
    expect(overlapRes.error).toMatch(/overlaps/i);

    // Gap between tiers (1-9 and 15-49)
    const gapTiers = [
      { minQuantity: 1, maxQuantity: 9, unitPricePaise: 12000 },
      { minQuantity: 15, maxQuantity: 49, unitPricePaise: 10000 },
    ];
    const gapRes = validateTierPricing(gapTiers);
    expect(gapRes.valid).toBe(false);
    expect(gapRes.error).toMatch(/gap detected/i);

    // Negative unit price
    const negPriceTiers = [{ minQuantity: 1, unitPricePaise: -500 }];
    const negRes = validateTierPricing(negPriceTiers);
    expect(negRes.valid).toBe(false);
  });

  it('creates product with quantity tier pricing enabled', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Microfiber Cleaning Cloth Pack',
        sku: 'MICRO-CLOTH-PK',
        categoryId: categoryDoc._id,
        brand: 'Necessity India',
        description: 'Lint-free commercial microfiber wiping cloth.',
        hsnCode: '6302',
        uom: 'PCS',
        isTierPricingEnabled: true,
        tierPricing: exampleTiers,
        mrpPaise: 18000,
        dealerPricePaise: 12000, // Fallback baseline
        gstRatePercent: 18,
        stockOnHand: 1000,
        minOrderQuantity: 1,
      });

    expect(res.status).toBe(201);
    tierProduct = res.body.data;
    expect(tierProduct.isTierPricingEnabled).toBe(true);
    expect(tierProduct.tierPricing).toHaveLength(4);
  });

  it('calculates exact unit price at all boundary quantities: 1, 9, 10, 49, 50, 99, 100, 150', async () => {
    const testCases = [
      { qty: 1, expectedUnitPrice: 12000, expectedSubtotal: 12000 }, // 1 * ₹120
      { qty: 9, expectedUnitPrice: 12000, expectedSubtotal: 108000 }, // 9 * ₹120 = ₹1,080
      { qty: 10, expectedUnitPrice: 10000, expectedSubtotal: 100000 }, // 10 * ₹100 = ₹1,000
      { qty: 49, expectedUnitPrice: 10000, expectedSubtotal: 490000 }, // 49 * ₹100 = ₹4,900
      { qty: 50, expectedUnitPrice: 9000, expectedSubtotal: 450000 }, // 50 * ₹90 = ₹4,500
      { qty: 99, expectedUnitPrice: 9000, expectedSubtotal: 891000 }, // 99 * ₹90 = ₹8,910
      { qty: 100, expectedUnitPrice: 8000, expectedSubtotal: 800000 }, // 100 * ₹80 = ₹8,000
      { qty: 150, expectedUnitPrice: 8000, expectedSubtotal: 1200000 }, // 150 * ₹80 = ₹12,000
    ];

    for (const tc of testCases) {
      const cartRes = await request(app)
        .post('/api/v1/orders/calculate-cart')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({
          items: [{ productId: tierProduct.id, quantity: tc.qty }],
          deliveryStateCode: '27',
        });

      expect(cartRes.status).toBe(200);
      const calculatedItem = cartRes.body.data.items[0];
      expect(calculatedItem.unitPricePaiseSnapshot).toBe(tc.expectedUnitPrice);
      expect(calculatedItem.taxableAmountPaise).toBe(tc.expectedSubtotal);
      expect(calculatedItem.tierAppliedSnapshot).toBeDefined();
      expect(calculatedItem.tierAppliedSnapshot.unitPricePaise).toBe(tc.expectedUnitPrice);
    }
  });

  it('prevents client-side price tampering during checkout and calculates price server-side', async () => {
    // Retailer tries to submit price of ₹10 instead of server tier price
    const checkoutRes = await request(app)
      .post('/api/v1/orders/checkout')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        items: [
          {
            productId: tierProduct.id,
            quantity: 50,
            unitPricePaise: 1000, // Tampered client rate!
          },
        ],
        paymentMethod: PaymentMethod.CREDIT_ACCOUNT,
        idempotencyKey: 'idemp-tier-tamper-02',
        deliveryAddress: {
          street: '100 Gateway Blvd',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          stateCode: '27',
        },
      });

    expect(checkoutRes.status).toBe(201);
    const order = checkoutRes.body.data;
    // Server must enforce ₹90 (9000 paise) for 50 pieces, not ₹10
    expect(order.items[0].unitPricePaiseSnapshot).toBe(9000);
    expect(order.items[0].taxableAmountPaise).toBe(450000);
  });

  it('preserves historical order prices when product or tier prices are subsequently changed', async () => {
    // 1. Order was placed at ₹90/unit for 50 units (taxable: ₹4,500)
    const placedOrder = await Order.findOne({ 'items.productId': tierProduct.id });
    const originalPrice = placedOrder!.items[0].unitPricePaiseSnapshot;
    expect(originalPrice).toBe(9000);

    // 2. Admin increases tier prices significantly
    await request(app)
      .put(`/api/v1/products/${tierProduct.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: tierProduct.name,
        sku: tierProduct.sku,
        description: tierProduct.description,
        categoryId: categoryDoc._id,
        brand: tierProduct.brand,
        hsnCode: '6302',
        uom: 'PCS',
        mrpPaise: tierProduct.mrpPaise,
        dealerPricePaise: tierProduct.dealerPricePaise,
        gstRatePercent: 18,
        isTierPricingEnabled: true,
        tierPricing: [
          { minQuantity: 1, maxQuantity: 9, unitPricePaise: 25000 },
          { minQuantity: 10, maxQuantity: 49, unitPricePaise: 22000 },
          { minQuantity: 50, unitPricePaise: 20000 }, // Increased from 90 to 200!
        ],
      });

    // 3. Historical order remains unchanged at ₹90
    const fetchedOrderRes = await request(app)
      .get(`/api/v1/orders/${placedOrder!._id}`)
      .set('Authorization', `Bearer ${retailerToken}`);

    expect(fetchedOrderRes.status).toBe(200);
    expect(fetchedOrderRes.body.data.items[0].unitPricePaiseSnapshot).toBe(9000);
    expect(fetchedOrderRes.body.data.items[0].taxableAmountPaise).toBe(450000);
  });

  it('correctly reports next tier savings with getNextTierSavings helper', () => {
    // Current quantity: 5 units @ ₹120
    const savings = getNextTierSavings(exampleTiers, 5, 12000);
    expect(savings).not.toBeNull();
    expect(savings!.quantityNeeded).toBe(5); // Need 5 more to reach 10
    expect(savings!.nextTier.unitPricePaise).toBe(10000); // ₹100
    expect(savings!.potentialSavingsPerUnitPaise).toBe(2000); // ₹20 per unit savings

    // At quantity: 120 (already at highest tier)
    const topTierSavings = getNextTierSavings(exampleTiers, 120, 8000);
    expect(topTierSavings).toBeNull();
  });
});
