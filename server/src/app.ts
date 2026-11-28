import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { ENV } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './modules/auth/auth.routes';
import { retailerRouter } from './modules/retailers/retailer.routes';
import { productRouter } from './modules/products/product.routes';
import { orderRouter } from './modules/orders/order.routes';
import { paymentRouter } from './modules/payments/payment.routes';
import { zohoRouter } from './modules/integrations/zoho/zoho.routes';
import { creditRouter } from './modules/credit/credit.routes';
import { invoiceRouter } from './modules/invoices/invoice.routes';
import { discountRouter } from './modules/discounts/discount.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { analyticsRouter } from './modules/analytics/analytics.routes';
import pricingRouter from './modules/pricing/pricing.routes';
import { sendSuccess } from './utils/response';
import { AppError } from './utils/errors';

export function createApp(): express.Application {
  const app = express();

  // Security Headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // CORS Configuration: Enforce explicit allowlist and reject unauthorized browser origins
  const allowedOrigins: string[] = [
    ENV.CLIENT_WEB_URL,
    ...(Array.isArray(ENV.CORS_ALLOWED_ORIGINS) ? ENV.CORS_ALLOWED_ORIGINS : []),
    'https://b2-b-project-seven.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://localhost:8081',
    'http://127.0.0.1:8081',
    'http://192.168.31.21:8081',
    'http://192.168.31.21:5173',
  ]
    .map((s) => s?.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow mobile apps, curl, Postman, and server-to-server calls without an Origin header
        if (!origin) {
          return callback(null, true);
        }

        const normalizedOrigin = origin.replace(/\/+$/, '');
        if (
          allowedOrigins.includes(normalizedOrigin) ||
          normalizedOrigin.endsWith('.vercel.app') ||
          normalizedOrigin.includes('localhost') ||
          normalizedOrigin.includes('127.0.0.1')
        ) {
          return callback(null, true);
        }

        // Strictly reject unauthorized browser origins
        return callback(new AppError(`CORS policy violation: Origin '${origin}' is not authorized`, 403));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Request-Id',
        'Accept',
        'Idempotency-Key',
        'x-razorpay-signature',
      ],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 86400, // 24 hours preflight cache
    })
  );

  // Parsers
  app.use(
    express.json({
      limit: '10mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser(ENV.COOKIE_SECRET));

  // Static uploads directory for product images
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const productsUploadsDir = path.join(uploadsDir, 'products');
  if (!fs.existsSync(productsUploadsDir)) {
    fs.mkdirSync(productsUploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // Request Auditing & Correlation ID
  app.use(requestLogger);

  // Health Check Endpoint
  app.get(`${ENV.API_PREFIX}/health`, (_req, res) => {
    const dbState = mongoose.connection.readyState;
    const dbStatusMap: Record<number, string> = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    sendSuccess(res, {
      status: 'healthy',
      service: 'Necessity India B2B API Server',
      environment: ENV.NODE_ENV,
      database: dbStatusMap[dbState] || 'unknown',
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    });
  });

  // Feature Modules
  app.use(`${ENV.API_PREFIX}/auth`, authRouter);
  app.use(`${ENV.API_PREFIX}/retailers`, retailerRouter);
  app.use(`${ENV.API_PREFIX}/customers`, retailerRouter);
  app.use(`${ENV.API_PREFIX}/products`, productRouter);
  app.use(`${ENV.API_PREFIX}/orders`, orderRouter);
  app.use(`${ENV.API_PREFIX}/payments`, paymentRouter);
  app.use(`${ENV.API_PREFIX}/credit`, creditRouter);
  app.use(`${ENV.API_PREFIX}/invoices`, invoiceRouter);
  app.use(`${ENV.API_PREFIX}/discounts`, discountRouter);
  app.use(`${ENV.API_PREFIX}/pricing`, pricingRouter);
  app.use(`${ENV.API_PREFIX}/dashboard`, dashboardRouter);
  app.use(`${ENV.API_PREFIX}/analytics`, analyticsRouter);
  app.use(`${ENV.API_PREFIX}/integrations/zoho`, zohoRouter);

  // 404 Route Handler
  app.use((req, _res, next) => {
    next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}
