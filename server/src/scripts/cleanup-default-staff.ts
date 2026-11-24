import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { User } from '../modules/users/user.model';
import { Retailer } from '../modules/retailers/retailer.model';
import { Order } from '../modules/orders/order.model';
import { AccountStatus, UserRole } from '@necessity/shared';
import { logger } from '../config/logger';

export const TARGET_DEFAULT_STAFF_EMAILS = [
  'accounts@necessityindia.com',
  'sales@necessityindia.com',
  'warehouse@necessityindia.com',
];

export async function cleanupDefaultStaffAccounts(
  action: 'inspect' | 'disable' | 'remove' = 'inspect'
): Promise<{
  inspected: number;
  modified: number;
  details: Array<{ email: string; found: boolean; status?: string; actionTaken: string }>;
}> {
  const details: Array<{ email: string; found: boolean; status?: string; actionTaken: string }> = [];
  let modifiedCount = 0;

  for (const email of TARGET_DEFAULT_STAFF_EMAILS) {
    const user = await User.findOne({ email });

    if (!user) {
      details.push({
        email,
        found: false,
        actionTaken: 'Account does not exist in database',
      });
      continue;
    }

    // Safety guard: NEVER modify Super Admin or customers
    if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.RETAILER) {
      logger.warn(`Safety guard triggered: skipping non-staff user ${email}`);
      details.push({
        email,
        found: true,
        status: user.accountStatus,
        actionTaken: 'Skipped (protected role)',
      });
      continue;
    }

    if (action === 'inspect') {
      details.push({
        email,
        found: true,
        status: user.accountStatus,
        actionTaken: 'Inspected (no changes made)',
      });
    } else if (action === 'disable') {
      user.accountStatus = AccountStatus.SUSPENDED;
      user.currentRefreshSessionId = undefined;
      await user.save();
      modifiedCount++;
      logger.info(`Disabled default staff user: ${email}`);
      details.push({
        email,
        found: true,
        status: AccountStatus.SUSPENDED,
        actionTaken: 'Account status set to SUSPENDED and active sessions invalidated',
      });
    } else if (action === 'remove') {
      // 1. Cleanly unassign salesman references before deletion
      await Retailer.updateMany(
        { assignedSalesmanId: user._id },
        { $unset: { assignedSalesmanId: 1 } }
      );
      await Order.updateMany(
        { salesmanId: user._id },
        { $unset: { salesmanId: 1 } }
      );

      // 2. Delete user record
      await User.deleteOne({ _id: user._id });
      modifiedCount++;
      logger.info(`Safely removed default staff user: ${email}`);
      details.push({
        email,
        found: true,
        actionTaken: 'User record deleted and references cleanly unassigned',
      });
    }
  }

  return {
    inspected: TARGET_DEFAULT_STAFF_EMAILS.length,
    modified: modifiedCount,
    details,
  };
}

async function runCli() {
  try {
    await connectDatabase();

    const args = process.argv.slice(2);
    let action: 'inspect' | 'disable' | 'remove' = 'inspect';

    if (args.includes('--action=disable') || args.includes('--disable')) {
      action = 'disable';
    } else if (args.includes('--action=remove') || args.includes('--remove')) {
      action = 'remove';
    }

    logger.info(`Starting Default Staff Accounts management tool [Mode: ${action.toUpperCase()}]...`);
    const result = await cleanupDefaultStaffAccounts(action);

    logger.info('====================================================');
    logger.info(`Operation summary: ${result.modified} account(s) modified.`);
    result.details.forEach((d) => {
      logger.info(`- ${d.email}: ${d.actionTaken} ${d.status ? `(Status: ${d.status})` : ''}`);
    });
    logger.info('====================================================');

    await disconnectDatabase();
    process.exit(0);
  } catch (error: any) {
    logger.error(`Error running staff cleanup: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module || process.argv[1]?.includes('cleanup-default-staff.ts')) {
  runCli();
}
