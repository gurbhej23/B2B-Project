import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from root or server
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test', 'staging']).default('development'),
  PORT: z.coerce.number().default(5000),
  API_PREFIX: z.string().default('/api/v1'),
  CLIENT_WEB_URL: z.string().default('http://localhost:5173'),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];
      return val.split(',').map((s) => s.trim()).filter(Boolean);
    }),
  MOBILE_APP_SCHEME: z.string().default('necessityb2b://'),

  MONGODB_URI: z.string().default(''),
  MONGODB_DB_NAME: z.string().default('necessity_b2b'),

  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_ENABLED: z
    .string()
    .optional()
    .transform((val) => val === 'true'),

  JWT_ACCESS_SECRET: z.string().min(16).default('necessity_enterprise_b2b_jwt_access_super_secret_key_2026!'),
  JWT_REFRESH_SECRET: z.string().min(16).default('necessity_enterprise_b2b_jwt_refresh_super_secret_key_2026!'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  COOKIE_SECRET: z.string().min(16).default('necessity_secure_cookie_secret_salt_2026!'),

  PAYMENT_PROVIDER: z.enum(['razorpay', 'cashfree', 'bank_transfer', 'mock_gateway']).default('razorpay'),
  RAZORPAY_KEY_ID: z.string().default(''),
  RAZORPAY_KEY_SECRET: z.string().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(''),

  COMPANY_NAME: z.string().default('NECESSITY INDIA PRIVATE LIMITED'),
  COMPANY_ADDRESS: z.string().default('D-182 1ST FLOOR PHASE 8 B, MOHALI, PUNJAB'),
  COMPANY_GSTIN: z.string().default('03AAICN2021R1ZF'),
  COMPANY_BANK_NAME: z.string().default('UCO Bank'),
  COMPANY_BANK_ACCOUNT_NO: z.string().default('01340510001998'),
  COMPANY_BANK_IFSC: z.string().default('UCBA0000134'),
  COMPANY_BANK_ACCOUNT_NAME: z.string().default('NECESSITY INDIA PRIVATE LIMITED'),
  COMPANY_UPI_VPA: z.string().default('necessityindia@ucobank'),

  ZOHO_ENABLED: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
  ZOHO_CLIENT_ID: z.string().default(''),
  ZOHO_CLIENT_SECRET: z.string().default(''),
  ZOHO_ORGANIZATION_ID: z.string().default(''),
  ZOHO_REDIRECT_URI: z.string().default('http://localhost:5000/api/v1/integrations/zoho/callback'),
  ZOHO_ACCOUNTS_URL: z.string().default('https://accounts.zoho.in'),
  ZOHO_API_BASE_URL: z.string().default('https://www.zohoapis.in/books/v3'),

  STORAGE_PROVIDER: z.string().default('local'),
  SMS_PROVIDER: z.string().default('console'),

  // Email / SMTP Configuration
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('Necessity India Wholesale <orders@necessityindia.com>'),
  SUPPORT_EMAIL: z.string().default('support@necessityindia.com'),
  SUPPORT_PHONE: z.string().default('+91 22 2830 1122'),

  // Initial Super Admin Configuration (Seed & Setup)
  SUPER_ADMIN_EMAIL: z.string().email().default('admin@necessityindia.com'),
  SUPER_ADMIN_PASSWORD: z.string().min(8).default('AdminPassword123!'),
  SUPER_ADMIN_PHONE: z.string().default('+919999999999'),
  SUPER_ADMIN_NAME: z.string().default('Rajesh Sharma (Super Admin)'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.format());
  throw new Error('Environment variable validation failed');
}

export const ENV = parsed.data;

// In production / staging, verify secrets are not defaults and database URI is provided
if (ENV.NODE_ENV === 'production' || ENV.NODE_ENV === 'staging') {
  const isDefaultAccess = ENV.JWT_ACCESS_SECRET.includes('necessity_enterprise_b2b_jwt_access_super_secret');
  const isDefaultRefresh = ENV.JWT_REFRESH_SECRET.includes('necessity_enterprise_b2b_jwt_refresh_super_secret');
  const isDefaultCookie = ENV.COOKIE_SECRET.includes('necessity_secure_cookie_secret_salt');

  if (isDefaultAccess || isDefaultRefresh || isDefaultCookie) {
    throw new Error(
      'FATAL: Production deployment requires custom, high-entropy JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, and COOKIE_SECRET. Default secrets are rejected.'
    );
  }

  if (!ENV.MONGODB_URI) {
    throw new Error('FATAL: Production deployment requires MONGODB_URI to be configured.');
  }
}

