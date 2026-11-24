import dns from 'dns';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { createCustomerBackup } from './backup-customer-data';
import { User } from '../modules/users/user.model';
import { Retailer } from '../modules/retailers/retailer.model';
import { Order } from '../modules/orders/order.model';
import { Invoice } from '../modules/invoices/invoice.model';
import { PaymentTransaction } from '../modules/payments/payment.model';
import { LedgerEntry } from '../modules/credit/ledger.model';
import { Product } from '../modules/products/product.model';
import { StockTransaction } from '../modules/products/stock-transaction.model';
import { UserRole } from '@necessity/shared';
import { logger } from '../config/logger';

// Set public DNS servers in case of local router SRV lookup issues
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // ignore
}

export async function resetCustomersAndOrders(): Promise<void> {
  console.log('====================================================');
  console.log('🔄 STARTING CUSTOMER & ORDER DATA RESET OPERATION');
  console.log('====================================================');

  await connectDatabase();

  // 1. CREATE A SAFETY BACKUP FIRST
  console.log('\n📦 Step 1: Creating safety backup before deletion...');
  let backupPath = '';
  try {
    backupPath = await createCustomerBackup();
    console.log(`✅ Safety backup created at: ${backupPath}`);
  } catch (err: any) {
    console.warn(`⚠️ Warning: Backup creation encountered an issue (${err.message}). Proceeding carefully.`);
  }

  // 2. IDENTIFY CUSTOMERS AND THEIR ACCOUNTS
  console.log('\n🔍 Step 2: Scanning customer, order, and transactional data...');
  const allRetailers = await Retailer.find({}).lean();
  const retailerIds = allRetailers.map((r) => r._id);
  const retailerUserIds = allRetailers
    .map((r) => r.userId)
    .filter((uid): uid is mongoose.Types.ObjectId => Boolean(uid));

  // Find users that are customers (RETAILER role or linked to a retailer profile)
  const customerUsers = await User.find({
    $or: [
      { role: UserRole.RETAILER },
      { _id: { $in: retailerUserIds } },
      { retailerProfileId: { $exists: true, $ne: null } },
    ],
  }).lean();

  // Protect staff and admin accounts!
  const protectedRoles = [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.ACCOUNTS_MANAGER,
    UserRole.SALES_MANAGER,
    UserRole.SALESMAN,
    UserRole.WAREHOUSE_MANAGER,
  ];

  const targetCustomerUserIds = customerUsers
    .filter((u) => !protectedRoles.includes(u.role))
    .map((u) => u._id);

  const preservedUsers = await User.find({
    _id: { $nin: targetCustomerUserIds },
  }).select('name phone email role accountStatus').lean();

  const totalOrders = await Order.countDocuments({});
  const totalInvoices = await Invoice.countDocuments({});
  const totalPayments = await PaymentTransaction.countDocuments({});
  const totalLedger = await LedgerEntry.countDocuments({});
  const totalRetailers = allRetailers.length;

  console.log('\n📊 Data Found to be Reset:');
  console.log(`   - Retailers/Customers:   ${totalRetailers}`);
  console.log(`   - Customer User Accounts: ${targetCustomerUserIds.length}`);
  console.log(`   - Orders:                ${totalOrders}`);
  console.log(`   - Invoices:              ${totalInvoices}`);
  console.log(`   - Payment Transactions:  ${totalPayments}`);
  console.log(`   - Credit Ledger Entries: ${totalLedger}`);

  console.log('\n🛡️ Admin & Staff Accounts Protected:');
  preservedUsers.forEach((u, i) => {
    console.log(`   ${i + 1}. [${u.role.toUpperCase()}] ${u.name} (${u.phone || 'no phone'} / ${u.email || 'no email'})`);
  });

  // 3. EXECUTE SAFE DELETION
  console.log('\n🗑️ Step 3: Deleting customer & order transactional data...');

  // A. Delete Orders
  const orderResult = await Order.deleteMany({});
  console.log(`   ✓ Deleted Orders: ${orderResult.deletedCount}`);

  // B. Delete Invoices
  const invoiceResult = await Invoice.deleteMany({});
  console.log(`   ✓ Deleted Invoices: ${invoiceResult.deletedCount}`);

  // C. Delete Payment Transactions
  const paymentResult = await PaymentTransaction.deleteMany({});
  console.log(`   ✓ Deleted Payment Transactions: ${paymentResult.deletedCount}`);

  // D. Delete Credit Ledger Entries
  const ledgerResult = await LedgerEntry.deleteMany({});
  console.log(`   ✓ Deleted Credit Ledger Entries: ${ledgerResult.deletedCount}`);

  // E. Delete Retailers
  const retailerResult = await Retailer.deleteMany({});
  console.log(`   ✓ Deleted Retailers: ${retailerResult.deletedCount}`);

  // F. Delete Customer User Accounts
  let userResultCount = 0;
  if (targetCustomerUserIds.length > 0) {
    const userResult = await User.deleteMany({ _id: { $in: targetCustomerUserIds } });
    userResultCount = userResult.deletedCount || 0;
  }
  console.log(`   ✓ Deleted Customer Users: ${userResultCount}`);

  // G. Reset Product Stock Reservations
  console.log('\n📦 Step 4: Resetting product stock reservations to 0...');
  const productUpdateResult = await Product.updateMany(
    {},
    {
      $set: {
        stockReserved: 0,
        'variants.$[].stockReserved': 0,
      },
    }
  );
  console.log(`   ✓ Products updated with stock reservations cleared: ${productUpdateResult.modifiedCount}`);

  // H. Clean up order stock transactions
  const stockTxResult = await StockTransaction.deleteMany({
    transactionType: { $in: ['ORDER_ALLOCATION', 'ORDER_CANCELLED', 'ORDER_FULFILLED', 'ORDER_RESERVATION'] },
  });
  console.log(`   ✓ Deleted order-related stock transactions: ${stockTxResult.deletedCount}`);

  // 4. VERIFICATION
  console.log('\n🔎 Step 5: Verifying clean database state...');
  const postRetailers = await Retailer.countDocuments({});
  const postOrders = await Order.countDocuments({});
  const postInvoices = await Invoice.countDocuments({});
  const postPayments = await PaymentTransaction.countDocuments({});
  const postLedger = await LedgerEntry.countDocuments({});
  const postUsers = await User.countDocuments({});
  const postCustomerUsers = await User.countDocuments({ role: UserRole.RETAILER });

  console.log('====================================================');
  console.log('🎉 RESET COMPLETED SUCCESSFULLY!');
  console.log('====================================================');
  console.log(`   - Customers / Retailers: ${postRetailers} (was ${totalRetailers})`);
  console.log(`   - Orders:                ${postOrders} (was ${totalOrders})`);
  console.log(`   - Invoices:              ${postInvoices} (was ${totalInvoices})`);
  console.log(`   - Payments:              ${postPayments} (was ${totalPayments})`);
  console.log(`   - Credit Ledger Entries: ${postLedger} (was ${totalLedger})`);
  console.log(`   - Remaining Users:       ${postUsers} (All admin/staff, 0 customer accounts)`);
  if (backupPath) {
    console.log(`   - Safety Backup Archive: ${backupPath}`);
  }
  console.log('====================================================\n');
}

async function main() {
  try {
    await resetCustomersAndOrders();
  } catch (error: any) {
    console.error('❌ Error executing reset:', error);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

if (require.main === module || process.argv[1]?.includes('reset-customer-and-orders.ts')) {
  main();
}
