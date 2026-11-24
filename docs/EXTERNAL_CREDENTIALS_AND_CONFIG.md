# EXTERNAL CREDENTIALS & INTEGRATION CONFIGURATION
## Necessity India Pvt. Ltd. — Environment & Third-Party Services Guide

---

### 1. Configuration Strategy & Adapters

To guarantee stability across local development, staging, and production environments, the platform implements **Adapter Interfaces** for all third-party dependencies:

1. **Database Adapter**: Connects to live MongoDB Atlas replica sets in production; falls back to `mongodb-memory-server` in zero-config local testing and CI environments.
2. **Payment Gateway Adapter**: Pluggable interface supporting Razorpay, Cashfree, and deterministic Mock Gateway.
3. **Zoho Books Adapter**: Official Zoho OAuth 2.0 client. When credentials are unconfigured or revoked, the admin panel explicitly displays an **"Integration Unconfigured"** badge with setup guides instead of faking sync results.
4. **SMS / OTP Adapter**: Pluggable interface for Fast2SMS, MSG91, or local console logger in development.
5. **Storage Adapter**: AWS S3 or Cloudinary for product catalog media and KYC documents, with local static file serving fallback in dev.

---

### 2. Environment Variables Specification (`.env.example`)

The following variables configure the backend and micro-services:

```env
# ==========================================
# APPLICATION & SERVER CONFIGURATION
# ==========================================
NODE_ENV=development
PORT=5000
API_PREFIX=/api/v1
CLIENT_WEB_URL=http://localhost:5173
MOBILE_APP_SCHEME=necessityb2b://

# ==========================================
# DATABASE (MONGODB ATLAS)
# ==========================================
# Provide a MongoDB connection URI. If omitted in development,
# the server auto-boots an isolated in-memory MongoDB instance.
MONGODB_URI=mongodb://localhost:27017/necessity_b2b
MONGODB_DB_NAME=necessity_b2b

# ==========================================
# REDIS (SESSIONS, CACHE & LOCKS)
# ==========================================
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=false

# ==========================================
# AUTHENTICATION & JWT SECURITY
# ==========================================
JWT_ACCESS_SECRET=your_super_secret_jwt_access_key_min_32_characters_long
JWT_REFRESH_SECRET=your_super_secret_jwt_refresh_key_min_32_characters_long
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
COOKIE_SECRET=your_secure_cookie_secret_key_here

# ==========================================
# PAYMENT GATEWAY (RAZORPAY / CASHFREE)
# ==========================================
PAYMENT_PROVIDER=mock_gateway # Options: mock_gateway, razorpay, cashfree
RAZORPAY_KEY_ID=rzp_test_YourKeyIdHere
RAZORPAY_KEY_SECRET=YourRazorpaySecretKeyHere
RAZORPAY_WEBHOOK_SECRET=YourWebhookSecretHere

CASHFREE_APP_ID=
CASHFREE_SECRET_KEY=
CASHFREE_API_VERSION=2023-08-01

# ==========================================
# COMPANY BANK DETAILS (FOR NEFT / RTGS)
# ==========================================
COMPANY_BANK_NAME=HDFC Bank Ltd.
COMPANY_BANK_ACCOUNT_NO=50200012345678
COMPANY_BANK_IFSC=HDFC0001234
COMPANY_BANK_ACCOUNT_NAME=Necessity India Pvt. Ltd.
COMPANY_UPI_VPA=necessityindia@hdfcbank

# ==========================================
# ZOHO BOOKS & INVENTORY INTEGRATION (OAUTH 2.0)
# ==========================================
ZOHO_ENABLED=false
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_ORGANIZATION_ID=
ZOHO_REDIRECT_URI=http://localhost:5000/api/v1/integrations/zoho/callback
ZOHO_ACCOUNTS_URL=https://accounts.zoho.in
ZOHO_API_BASE_URL=https://www.zohoapis.in/books/v3

# ==========================================
# CLOUD STORAGE (S3 / CLOUDINARY)
# ==========================================
STORAGE_PROVIDER=local # Options: local, s3, cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# ==========================================
# SMS / OTP PROVIDER
# ==========================================
SMS_PROVIDER=console # Options: console, fast2sms, msg91
SMS_API_KEY=
```
