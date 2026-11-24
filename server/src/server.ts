import http from 'http';
import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { ENV } from './config/env';
import { logger } from './config/logger';
import { User } from './modules/users/user.model';
import { seedDatabase } from './scripts/seed';

async function bootstrap() {
  try {
    // 1. Initialize Database connection
    await connectDatabase();

    // Safely ensure Super Admin account and essential system categories exist.
    // Strictly preserve all existing customer accounts, retailers, orders, and business data.
    try {
      logger.info('Verifying Super Admin account and system categories (preserving all customer data)...');
      await seedDatabase(false);
    } catch (seedErr: any) {
      logger.warn(`Non-fatal notice during system initialization: ${seedErr.message}`);
    }

    // 2. Create Express app
    const app = createApp();

    // 3. Start HTTP server
    const server = http.createServer(app);

    server.listen(ENV.PORT, '0.0.0.0', () => {
      logger.info(
        `🚀 Necessity India B2B API Server running in ${ENV.NODE_ENV} mode on port ${ENV.PORT}`
      );
      logger.info(`🔗 API Base: http://127.0.0.1:${ENV.PORT}${ENV.API_PREFIX}`);
      logger.info(`🏥 Health Check: http://127.0.0.1:${ENV.PORT}${ENV.API_PREFIX}/health`);
    });

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        logger.info('HTTP server closed');
        await disconnectDatabase();
        process.exit(0);
      });

      // Force kill after 10s timeout
      setTimeout(() => {
        logger.error('Graceful shutdown timeout exceeded. Forcing exit.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error: any) {
    logger.fatal(`Failed to start API server: ${error.message}`);
    process.exit(1);
  }
}

bootstrap();
