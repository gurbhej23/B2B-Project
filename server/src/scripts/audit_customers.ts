import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { Retailer } from '../modules/retailers/retailer.model';
import { User } from '../modules/users/user.model';
import { AuditLog } from '../modules/audit/audit.model';
import { logger } from '../config/logger';

export interface CustomerAuditReport {
  totalCustomers: number;
  totalEnabled: number;
  totalDisabled: number;
  disabledCustomers: Array<{
    id: string;
    businessName: string;
    contactPerson: string;
    phone: string;
    email?: string;
    accountStatus?: string;
    customerType?: string;
    lastDisabledEvent?: {
      timestamp: Date;
      actorId: string;
      reason?: string;
    };
  }>;
}

export async function runCustomerAudit(): Promise<CustomerAuditReport> {
  const retailers = await Retailer.find({}).populate('userId', 'email phone name accountStatus');
  
  const report: CustomerAuditReport = {
    totalCustomers: retailers.length,
    totalEnabled: 0,
    totalDisabled: 0,
    disabledCustomers: [],
  };

  for (const r of retailers) {
    const isCurrentlyActive = r.isActive ?? true;
    if (isCurrentlyActive) {
      report.totalEnabled++;
    } else {
      report.totalDisabled++;

      // Check audit history for disabling events
      const lastAudit = await AuditLog.findOne({
        targetResource: 'retailers',
        targetId: r._id.toString(),
        action: 'CUSTOMER_DISABLED',
      }).sort({ createdAt: -1 });

      report.disabledCustomers.push({
        id: r._id.toString(),
        businessName: r.businessName,
        contactPerson: r.contactPerson,
        phone: r.phone,
        email: r.email,
        accountStatus: (r.userId as any)?.accountStatus,
        customerType: r.customerType,
        lastDisabledEvent: lastAudit ? {
          timestamp: lastAudit.createdAt,
          actorId: lastAudit.actorId ? lastAudit.actorId.toString() : 'system',
          reason: (lastAudit.details as any)?.reason,
        } : undefined,
      });
    }
  }

  return report;
}

async function main() {
  try {
    await connectDatabase();
    logger.info('=====================================================');
    logger.info('🔎 AUDITING B2B CUSTOMER ACCOUNT STATUS INTEGRITY');
    logger.info('=====================================================');

    const report = await runCustomerAudit();

    logger.info(`Total Customers in Database: ${report.totalCustomers}`);
    logger.info(`  • Enabled Customers (isActive: true):   ${report.totalEnabled}`);
    logger.info(`  • Disabled Customers (isActive: false): ${report.totalDisabled}`);

    if (report.disabledCustomers.length > 0) {
      logger.info('\n📋 LIST OF CURRENTLY DISABLED CUSTOMERS (FOR ADMIN REVIEW):');
      report.disabledCustomers.forEach((c, idx) => {
        logger.info(`  ${idx + 1}. [ID: ${c.id}] ${c.businessName} (${c.contactPerson})`);
        logger.info(`     Phone: ${c.phone} | Status: ${c.accountStatus || 'N/A'} | Type: ${c.customerType || 'N/A'}`);
        if (c.lastDisabledEvent) {
          logger.info(`     Disabled on: ${c.lastDisabledEvent.timestamp.toISOString()} by Actor: ${c.lastDisabledEvent.actorId}`);
          if (c.lastDisabledEvent.reason) {
            logger.info(`     Reason: "${c.lastDisabledEvent.reason}"`);
          }
        }
      });

      // Target fix argument
      const fixArg = process.argv.find((a) => a.startsWith('--fix='));
      if (fixArg) {
        const targetId = fixArg.split('=')[1];
        if (mongoose.Types.ObjectId.isValid(targetId)) {
          const updated = await Retailer.findByIdAndUpdate(
            targetId,
            { $set: { isActive: true } },
            { new: true }
          );
          if (updated) {
            logger.info(`\n✅ Safely reactivated specific customer: ${updated.businessName} (ID: ${updated._id})`);
          } else {
            logger.warn(`\n⚠️ Customer with ID ${targetId} not found.`);
          }
        } else {
          logger.error(`\n❌ Invalid MongoDB ID provided: ${targetId}`);
        }
      } else {
        logger.info('\n💡 To safely re-enable a specific customer after admin review, run:');
        logger.info('   pnpm --filter server exec ts-node src/scripts/audit_customers.ts --fix=<CUSTOMER_ID>');
      }
    } else {
      logger.info('\n✅ No anomalous bulk disabled accounts detected.');
    }
  } catch (error: any) {
    logger.error(`Audit error: ${error.message}`);
  } finally {
    await disconnectDatabase();
  }
}

if (require.main === module || process.argv[1]?.includes('audit_customers.ts')) {
  main();
}
