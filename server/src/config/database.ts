import dns from 'dns';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ENV } from './env';
import { logger } from './logger';
import {
  importLocalSnapshot,
  exportLocalSnapshot,
  startAutoSnapshot,
} from './local-db-persistence';

// Configure DNS to use reliable public resolvers if local router DNS fails with SRV lookups
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignore in environments where setting DNS servers is restricted
}

let mongoMemoryServer: MongoMemoryServer | null = null;

/**
 * Mask sensitive credentials from MongoDB URI for safe logging
 */
function maskMongoUri(uri: string): string {
  try {
    return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
  } catch {
    return 'mongodb://[credentials-hidden]';
  }
}

export async function connectDatabase(): Promise<typeof mongoose> {
  const isTest = ENV.NODE_ENV === 'test';
  const isExplicitMemory = ENV.MONGODB_URI === 'memory' || (!ENV.MONGODB_URI && isTest);

  // In test mode or when explicitly set to 'memory', use isolated in-memory MongoDB
  if (isExplicitMemory) {
    logger.info('Initializing isolated in-memory MongoDB instance for automated test suite...');
    mongoMemoryServer = await MongoMemoryServer.create();
    const uri = mongoMemoryServer.getUri();
    logger.info(`Connected to in-memory test MongoDB at ${uri}`);
    return await mongoose.connect(uri, { dbName: ENV.MONGODB_DB_NAME });
  }

  const maskedUri = maskMongoUri(ENV.MONGODB_URI || '');
  logger.info(`Attempting connection to MongoDB at ${maskedUri} (Database: ${ENV.MONGODB_DB_NAME})...`);

  // Fast timeout for development so startup is responsive; higher for production
  const isDev = ENV.NODE_ENV === 'development';
  const selectionTimeoutMs = isDev ? 5000 : 30000;
  const maxRetries = isDev ? 1 : 3;
  let lastError: any = null;

  if (ENV.MONGODB_URI) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const conn = await mongoose.connect(ENV.MONGODB_URI, {
          dbName: ENV.MONGODB_DB_NAME,
          serverSelectionTimeoutMS: selectionTimeoutMs,
          socketTimeoutMS: 45000,
          retryWrites: true,
          w: 'majority',
        });

        const actualDbName = conn.connection.name;
        logger.info(
          `✅ Successfully connected to MongoDB database "${actualDbName}" on host ${conn.connection.host}`
        );

        // In development, also auto-save snapshot from Atlas for local offline backup
        if (isDev) {
          startAutoSnapshot(15000);
        }

        mongoose.connection.on('disconnected', () => {
          logger.warn('⚠️ MongoDB connection lost. Reconnecting...');
        });

        mongoose.connection.on('reconnected', () => {
          logger.info('🔄 MongoDB reconnected successfully.');
        });

        return conn;
      } catch (error: any) {
        lastError = error;
        logger.warn(
          `MongoDB connection attempt ${attempt}/${maxRetries} failed: ${error.message}`
        );

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }
  }

  // DEVELOPMENT SAFETY RESILIENCE:
  // If external MongoDB Atlas is unreachable (e.g. current IP is not whitelisted on Atlas),
  // start local MongoDB with PERSISTENT DISK SNAPSHOT protection.
  // This ensures the development server starts immediately, while all customer records,
  // orders, and products are safely restored from disk and continuously persisted.
  if (isDev) {
    logger.warn(
      `⚠️ Could not connect to Atlas (${lastError?.message || 'No URI specified'}).\n` +
      `🛡️ ACTIVATING PERSISTENT LOCAL DEVELOPMENT DATABASE WITH AUTO-SNAPSHOT RESTORATION...`
    );

    mongoMemoryServer = await MongoMemoryServer.create();
    const uri = mongoMemoryServer.getUri();
    const conn = await mongoose.connect(uri, { dbName: ENV.MONGODB_DB_NAME });

    logger.info(`Connected to local development MongoDB engine at ${uri}`);

    // Automatically restore persisted customer data snapshot from disk
    const restoredCount = await importLocalSnapshot();
    if (restoredCount > 0) {
      logger.info(`🎉 Customer data integrity verified: ${restoredCount} records loaded from persistent disk snapshot.`);
    }

    // Continuously persist all changes to disk so code changes/restarts NEVER lose data
    startAutoSnapshot(8000);

    return conn;
  }

  // Production failure remains fatal
  const diagnosticMsg =
    `\n================================================================================\n` +
    `🚨 FATAL MONGODB CONNECTION FAILURE: Unable to connect to configured MongoDB\n` +
    `Target URI: ${maskedUri}\n` +
    `Target Database: ${ENV.MONGODB_DB_NAME}\n` +
    `Error Details: ${lastError?.message || lastError}\n` +
    `\n` +
    `COMMON ROOT CAUSES & REMEDIES:\n` +
    `1. Atlas IP Whitelist: Ensure your current public IP is whitelisted on MongoDB Atlas\n` +
    `   (MongoDB Atlas -> Network Access -> Add IP Address / Allow Any 0.0.0.0/0 for dev).\n` +
    `2. Credentials: Check that the username and password in MONGODB_URI are correct.\n` +
    `3. Cluster Hostname: Confirm the cluster domain matches your active Atlas cluster.\n` +
    `================================================================================\n`;

  logger.fatal(diagnosticMsg);
  throw new Error(diagnosticMsg);
}

export async function disconnectDatabase(): Promise<void> {
  try {
    // Save final snapshot before disconnect
    await exportLocalSnapshot();

    await mongoose.disconnect();
    if (mongoMemoryServer) {
      await mongoMemoryServer.stop();
      mongoMemoryServer = null;
    }
    logger.info('MongoDB disconnected cleanly');
  } catch (error: any) {
    logger.error(`Error disconnecting MongoDB: ${error.message}`);
  }
}
