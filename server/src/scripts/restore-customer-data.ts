import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { User } from '../modules/users/user.model';
import { Retailer } from '../modules/retailers/retailer.model';
import { Order } from '../modules/orders/order.model';
import { Invoice } from '../modules/invoices/invoice.model';
import { LedgerEntry } from '../modules/credit/ledger.model';
import { logger } from '../config/logger';
import { BackupData } from './backup-customer-data';

export async function restoreCustomerData(backupFilePath: string): Promise<void> {
  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup file does not exist at path: ${backupFilePath}`);
  }

  const fileContent = fs.readFileSync(backupFilePath, 'utf-8');
  const backup: BackupData = JSON.parse(fileContent);

  if (!backup.metadata || !backup.collections) {
    throw new Error('Invalid backup file format: Missing metadata or collections.');
  }

  if (mongoose.connection.readyState !== 1) {
    await connectDatabase();
  }
  const dbName = mongoose.connection.name || 'necessity_b2b';

  logger.info(
    `Restoring data into database "${dbName}" from backup created at ${backup.metadata.timestamp}...`
  );

  let restoredUsers = 0;
  for (const user of backup.collections.users || []) {
    await User.updateOne({ _id: user._id }, { $set: user }, { upsert: true });
    restoredUsers++;
  }

  let restoredRetailers = 0;
  for (const retailer of backup.collections.retailers || []) {
    await Retailer.updateOne({ _id: retailer._id }, { $set: retailer }, { upsert: true });
    restoredRetailers++;
  }

  let restoredOrders = 0;
  for (const order of backup.collections.orders || []) {
    await Order.updateOne({ _id: order._id }, { $set: order }, { upsert: true });
    restoredOrders++;
  }

  let restoredInvoices = 0;
  for (const invoice of backup.collections.invoices || []) {
    await Invoice.updateOne({ _id: invoice._id }, { $set: invoice }, { upsert: true });
    restoredInvoices++;
  }

  let restoredLedger = 0;
  for (const entry of backup.collections.ledger || []) {
    await LedgerEntry.updateOne({ _id: entry._id }, { $set: entry }, { upsert: true });
    restoredLedger++;
  }

  logger.info(
    `✅ Data restoration completed successfully!\n` +
    `   Users restored/upserted: ${restoredUsers}\n` +
    `   Retailers restored/upserted: ${restoredRetailers}\n` +
    `   Orders restored/upserted: ${restoredOrders}\n` +
    `   Invoices restored/upserted: ${restoredInvoices}\n` +
    `   Ledger entries restored/upserted: ${restoredLedger}`
  );
}

async function runCliRestore() {
  const targetFile = process.argv[2];
  if (!targetFile) {
    console.error('Usage: pnpm tsx src/scripts/restore-customer-data.ts <path-to-backup.json>');
    process.exit(1);
  }

  try {
    await restoreCustomerData(path.resolve(targetFile));
  } catch (err: any) {
    logger.error(`Restore failed: ${err.message}`);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

if (require.main === module || process.argv[1]?.includes('restore-customer-data.ts')) {
  runCliRestore();
}
