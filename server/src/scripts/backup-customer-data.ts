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

export interface BackupData {
  metadata: {
    timestamp: string;
    databaseName: string;
    version: string;
    totalCounts: {
      users: number;
      retailers: number;
      orders: number;
      invoices: number;
      ledger: number;
    };
  };
  collections: {
    users: any[];
    retailers: any[];
    orders: any[];
    invoices: any[];
    ledger: any[];
  };
}

export async function createCustomerBackup(customOutputDir?: string): Promise<string> {
  if (mongoose.connection.readyState !== 1) {
    await connectDatabase();
  }
  const dbName = mongoose.connection.name || 'necessity_b2b';

  const outputDir = customOutputDir || path.resolve(__dirname, '../../../backups');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `customer-backup-${dbName}-${timestamp}.json`;
  const filePath = path.join(outputDir, filename);

  logger.info(`Starting data backup for database "${dbName}"...`);

  const [users, retailers, orders, invoices, ledger] = await Promise.all([
    User.find({}).lean(),
    Retailer.find({}).lean(),
    Order.find({}).lean(),
    Invoice.find({}).lean(),
    LedgerEntry.find({}).lean(),
  ]);

  const backupData: BackupData = {
    metadata: {
      timestamp: new Date().toISOString(),
      databaseName: dbName,
      version: '1.0.0',
      totalCounts: {
        users: users.length,
        retailers: retailers.length,
        orders: orders.length,
        invoices: invoices.length,
        ledger: ledger.length,
      },
    },
    collections: {
      users,
      retailers,
      orders,
      invoices,
      ledger,
    },
  };

  fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf-8');

  // Verify backup exists and is non-empty
  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup verification failed: File was not created at ${filePath}`);
  }

  const stats = fs.statSync(filePath);
  if (stats.size === 0) {
    throw new Error(`Backup verification failed: File created at ${filePath} is empty (0 bytes).`);
  }

  logger.info(
    `✅ Backup successfully created and verified!\n` +
    `   Path: ${filePath}\n` +
    `   Size: ${(stats.size / 1024).toFixed(2)} KB\n` +
    `   Records backed up: Users: ${users.length}, Retailers: ${retailers.length}, Orders: ${orders.length}, Invoices: ${invoices.length}, Ledger: ${ledger.length}`
  );

  return filePath;
}

async function runCliBackup() {
  try {
    const backupPath = await createCustomerBackup();
    console.log(`\nBackup completed: ${backupPath}`);
  } catch (err: any) {
    logger.error(`Backup process failed: ${err.message}`);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

if (require.main === module || process.argv[1]?.includes('backup-customer-data.ts')) {
  runCliBackup();
}
