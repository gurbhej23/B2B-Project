import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { User } from '../modules/users/user.model';
import { Retailer } from '../modules/retailers/retailer.model';
import { Product } from '../modules/products/product.model';
import { Order } from '../modules/orders/order.model';
import {
  UserRole,
  AccountStatus,
} from '@necessity/shared';
import { ENV } from '../config/env';
import { logger } from '../config/logger';

export async function seedDatabase(_shouldClear = false): Promise<void> {
  // STRICT DATA PRESERVATION RULE:
  // Under NO circumstances should customer accounts, retailers, orders, or products
  // ever be deleted, wiped, or reset by seed or server bootstrap operations.
  const salt = await bcrypt.genSalt(12);

  // 1. Initial Super Admin (Safe find-or-create: strictly preserves all customer & retailer data)
  const superAdminEmail = ENV.SUPER_ADMIN_EMAIL.toLowerCase().trim();
  let superAdmin = await User.findOne({ email: superAdminEmail });
  if (!superAdmin) {
    const adminPasswordHash = await bcrypt.hash(ENV.SUPER_ADMIN_PASSWORD, salt);
    superAdmin = await User.create({
      name: ENV.SUPER_ADMIN_NAME,
      email: superAdminEmail,
      phone: ENV.SUPER_ADMIN_PHONE,
      passwordHash: adminPasswordHash,
      role: UserRole.SUPER_ADMIN,
      accountStatus: AccountStatus.ACTIVE,
    });
    logger.info(`Created Initial Super Admin: ${superAdmin.email} (${superAdmin.phone})`);
  } else {
    // Ensure Super Admin retains proper permissions and active status without modifying any customer accounts
    let needsUpdate = false;
    if (superAdmin.role !== UserRole.SUPER_ADMIN) {
      superAdmin.role = UserRole.SUPER_ADMIN;
      needsUpdate = true;
    }
    if (superAdmin.accountStatus !== AccountStatus.ACTIVE) {
      superAdmin.accountStatus = AccountStatus.ACTIVE;
      needsUpdate = true;
    }
    if (needsUpdate) {
      await superAdmin.save();
      logger.info(`Verified Super Admin permissions: ${superAdmin.email}`);
    }
  }

  // NOTE: Customer accounts, staff accounts, and demo data are NOT wiped or overwritten.
  logger.info('✅ Database initialization complete: Super Admin verified. All customer data preserved.');
}

async function runCliSeed() {
  try {
    await connectDatabase();
    logger.info('🌱 Running database verification for Necessity India B2B Platform (Data Preservation Active)...');
    await seedDatabase(false);
  } catch (error: any) {
    logger.error(`Seed verification error: ${error.message}`);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

// If invoked directly from CLI
if (require.main === module || process.argv[1]?.includes('seed.ts')) {
  runCliSeed();
}
