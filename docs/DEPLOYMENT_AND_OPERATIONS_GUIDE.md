# Necessity India B2B — Production Deployment, Operations & Disaster Recovery Guide

## 1. Production Architecture Overview

The Necessity India B2B Wholesale Platform is architected for enterprise-grade reliability, strict financial accuracy, and high availability:

| Layer | Technology | Production Target | Scaling Strategy |
|---|---|---|---|
| **Backend API** | Node.js (v20+ LTS), Express, TypeScript | PM2 Cluster / Docker on Linux VM / AWS ECS | Horizontal cluster mode (PM2 `-i max`), stateless JWT |
| **Primary Database** | MongoDB Atlas (v7.0+ Replica Set) | M10+ dedicated cluster with continuous backups | Read replica scaling, connection pooling (`maxPoolSize=50`) |
| **Admin Web Portal** | React 18, Vite, Tailwind CSS | Static CDN (AWS S3 + CloudFront / Cloudflare / Nginx) | Edge cached, zero server compute overhead |
| **Customer Mobile** | Pure React Native CLI (Android) | Signed Android APK / Google Play Store AAB | Native Hermes engine, Proguard minified |
| **Payment Gateway** | Razorpay Payment Gateway (Live) | Razorpay Webhook Event Bus | Idempotent ledger updates, HMAC-SHA256 signature verification |
| **Document Engine** | PDFKit Streaming Engine | Inline Node.js worker streaming | Direct pipe to HTTP response, zero disk footprint |

---

## 2. Environment Variables Specification

The production environment requires these variables in `/server/.env` or container secrets:

```bash
# ==========================================
# APPLICATION & SERVER CONFIGURATION
# ==========================================
NODE_ENV=production
PORT=5000
API_PREFIX=/api/v1
CLIENT_WEB_URL=https://admin.necessityindia.com
CORS_ALLOWED_ORIGINS=https://admin.necessityindia.com
MOBILE_APP_SCHEME=necessityb2b://

# ==========================================
# DATABASE (MONGODB ATLAS)
# ==========================================
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.pxno0p8.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
MONGODB_DB_NAME=necessity_b2b_production

# ==========================================
# AUTHENTICATION & JWT SECURITY (MUST BE CRYPTOGRAPHICALLY RANDOM IN PRODUCTION)
# Generate with: openssl rand -base64 48
# ==========================================
JWT_ACCESS_SECRET=your_production_64_char_cryptographically_secure_random_key_1
JWT_REFRESH_SECRET=your_production_64_char_cryptographically_secure_random_key_2
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
COOKIE_SECRET=your_production_64_char_cryptographically_secure_cookie_salt

# ==========================================
# PAYMENT GATEWAY (RAZORPAY LIVE)
# ==========================================
PAYMENT_PROVIDER=razorpay
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=your_custom_webhook_secret_set_in_razorpay_dashboard

# ==========================================
# COMPANY BUSINESS & BANK DETAILS (OFFICIAL TAX INVOICES)
# Verified from Certificate & Tax Invoice (Mohali, Punjab)
# ==========================================
COMPANY_NAME="NECESSITY INDIA PRIVATE LIMITED"
COMPANY_ADDRESS="D-182 1ST FLOOR PHASE 8 B, MOHALI, PUNJAB"
COMPANY_GSTIN=03AAICN2021R1ZF
COMPANY_BANK_NAME="UCO Bank"
COMPANY_BANK_ACCOUNT_NO=01340510001998
COMPANY_BANK_IFSC=UCBA0000134
COMPANY_BANK_ACCOUNT_NAME="NECESSITY INDIA PRIVATE LIMITED"
COMPANY_UPI_VPA=necessityindia@ucobank
SUPPORT_EMAIL=orders@necessityindia.com
SUPPORT_PHONE="+91 98760 76067"

# ==========================================
# EMAIL / SMTP (TRANSACTIONAL NOTIFICATIONS)
# ==========================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=necessityindia1313@gmail.com
SMTP_PASS=iafqcnbsmowzwpzb
SMTP_FROM="Necessity India Wholesale <orders@necessityindia.com>"

# ==========================================
# SUPER ADMIN RECOVERY SEED
# ==========================================
SUPER_ADMIN_EMAIL=admin@necessityindia.com
SUPER_ADMIN_PASSWORD=ProductionSuperSecureAdminPassword2026!
SUPER_ADMIN_PHONE=+919876076067
SUPER_ADMIN_NAME="Super Admin (Necessity India)"
```

---

## 3. MongoDB Atlas Configuration & Backup Strategy

### 3.1 Network Access & Security
1. Navigate to **MongoDB Atlas > Network Access > IP Access List**.
2. Add the static elastic IP(s) of your production backend API server(s) with description `Production API Gateway`.
3. Never use `0.0.0.0/0` (Allow Access from Anywhere) in production environments.
4. Enforce TLS 1.3 encryption on connection strings.

### 3.2 Connection Pooling & Performance
The connection pool in `server/src/config/database.ts` is tuned for enterprise workloads:
- `maxPoolSize`: 50 connections per instance.
- `minPoolSize`: 10 warm connections.
- `serverSelectionTimeoutMS`: 5000 ms.
- `socketTimeoutMS`: 45000 ms.

### 3.3 Automated & Manual Backup Runbook
- **Atlas Continuous Cloud Backups**: Enable point-in-time recovery (PITR) in Atlas cluster settings with 7-day retention and automated hourly snapshots.
- **Automated Daily Offsite Backup (Cron Script)**:
  ```bash
  #!/bin/bash
  # backup_mongodb.sh
  TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
  BACKUP_DIR="/var/backups/necessity_b2b"
  mkdir -p "$BACKUP_DIR"
  
  mongodump --uri="$MONGODB_URI" --db=necessity_b2b_production --gzip --archive="$BACKUP_DIR/backup_$TIMESTAMP.gz"
  
  # Keep only 14 days of local archives
  find "$BACKUP_DIR" -type f -name "backup_*.gz" -mtime +14 -delete
  ```
- **Disaster Recovery Restore**:
  ```bash
  mongorestore --uri="$MONGODB_URI" --gzip --archive="/var/backups/necessity_b2b/backup_20261029_000000.gz" --drop
  ```

---

## 4. Backend Deployment (Linux / PM2 / Nginx)

### 4.1 Production Build
On the deployment server:
```bash
git pull origin main
pnpm install --frozen-lockfile
pnpm --filter shared build
pnpm --filter server build
```

### 4.2 Process Management with PM2
Create `ecosystem.config.js` in the server root:
```javascript
module.exports = {
  apps: [
    {
      name: 'necessity-b2b-api',
      script: './dist/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    }
  ]
};
```
Start and persist the cluster:
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### 4.3 Nginx Reverse Proxy & SSL Configuration
Install Certbot for automated Let's Encrypt certificates. Nginx configuration (`/etc/nginx/sites-available/necessity-api`):
```nginx
server {
    listen 80;
    server_name api.necessityindia.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.necessityindia.com;

    ssl_certificate /etc/letsencrypt/live/api.necessityindia.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.necessityindia.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Rate limiting zone for public auth
    limit_req zone=auth_limit burst=10 nodelay;

    location /api/v1/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }

    # PDF Invoices Streaming Buffer Exemption
    location /api/v1/invoices/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_buffering off;
        proxy_read_timeout 120s;
    }
}
```

---

## 5. Admin Web Portal Deployment

### 5.1 Production Vite Build
```bash
pnpm --filter admin-web build
```
This produces an optimized, tree-shaken static bundle in `apps/admin-web/dist`.

### 5.2 Nginx Static Serving with SPA Fallback
```nginx
server {
    listen 443 ssl http2;
    server_name admin.necessityindia.com;

    root /var/www/necessity-admin/dist;
    index index.html;

    # Gzip / Brotli compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, no-transform";
    }
}
```

---

## 6. Payment Gateway (Razorpay) Live Setup & Verification

### 6.1 Switching from Test to Live Mode
1. Log in to [Razorpay Dashboard](https://dashboard.razorpay.com/).
2. Toggle the switch at top-left from **Test Mode** to **Live Mode**.
3. Complete business KYC verification (uploading Necessity India Pvt Ltd Certificate of Incorporation, GSTIN `03AAICN2021R1ZF`, PAN, and Bank statement).
4. Navigate to **Settings > API Keys** and click **Generate Live Key**.
5. Copy `RAZORPAY_KEY_ID` (starts with `rzp_live_`) and `RAZORPAY_KEY_SECRET` into production `.env`.

### 6.2 Razorpay Webhook Configuration
1. Go to **Settings > Webhooks > Add New Webhook**.
2. **Webhook URL**: `https://api.necessityindia.com/api/v1/payments/razorpay/webhook`.
3. **Secret**: Enter a strong passphrase and set it as `RAZORPAY_WEBHOOK_SECRET` in `.env`.
4. **Alert Email**: Enter `orders@necessityindia.com`.
5. **Active Events**: Select:
   - `order.paid`
   - `payment.authorized`
   - `payment.captured`
   - `payment.failed`
6. Click **Create Webhook**. The endpoint is cryptographically verified via HMAC-SHA256 and handles retries with built-in idempotency.

---

## 7. Android Customer App Release Build (React Native CLI)

### 7.1 Keystore Generation
Generate a production release signing key using JDK `keytool`:
```bash
keytool -genkeypair -v -storetype PKCS12 -keystore necessity-release-key.keystore -alias necessity-key-alias -keyalg RSA -keysize 2048 -validity 10000
```
Place `necessity-release-key.keystore` in `apps/mobile/android/app/`.

### 7.2 Configure Gradle Signing (`apps/mobile/android/gradle.properties`)
```properties
MYAPP_UPLOAD_STORE_FILE=necessity-release-key.keystore
MYAPP_UPLOAD_KEY_ALIAS=necessity-key-alias
MYAPP_UPLOAD_STORE_PASSWORD=your_keystore_password
MYAPP_UPLOAD_KEY_PASSWORD=your_key_password
```

### 7.3 Build Release APK or Play Store Bundle (AAB)
From `apps/mobile/android`:
```bash
# Clean previous builds
./gradlew clean

# Build standalone APK for testing / direct distribution
./gradlew assembleRelease

# Build Android App Bundle (.aab) for Google Play Console submission
./gradlew bundleRelease
```
Outputs:
- **APK**: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- **AAB**: `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`

