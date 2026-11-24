# IMPLEMENTATION CHECKLIST & ROADMAP: NECESSITY INDIA PVT. LTD.

---

## Phase 1: Foundation (Current Target)
- [x] Monorepo workspace configuration (`pnpm-workspace.yaml`, `.npmrc`, root `package.json`).
- [x] Architecture, Checklist, Database Schemas, Auth Rules & External Config documentation.
- [ ] Shared package (`packages/shared`):
  - [ ] Enums: `UserRole`, `AccountStatus`, `OrderStatus`, `InvoiceStatus`, `PaymentStatus`, `PaymentMethod`, `CreditStatus`, `SchemeType`, `TaxType`.
  - [ ] Shared TypeScript interfaces: `IUser`, `IRetailer`, `IProduct`, `IOrder`, `IInvoice`, `ICreditAccount`, `IPayment`.
  - [ ] Zod validation schemas for registration, login, token refresh, password reset.
  - [ ] Currency utilities (paise to INR formatter, exact integer addition/subtraction).
- [ ] Backend foundation (`server`):
  - [ ] TypeScript configuration, Express application setup with versioned routing (`/api/v1`).
  - [ ] Security middleware: Helmet, CORS allowlisting, rate limiting (`express-rate-limit`), cookie-parser.
  - [ ] Centralized structured logger (Pino or Winston) with request ID propagation.
  - [ ] Standardized API response format (`ApiResponse<T>` and `ApiError`).
  - [ ] Centralized error handling middleware.
  - [ ] MongoDB connection with graceful connection handling and in-memory fallback for offline/isolated dev & test.
  - [ ] Health check endpoint (`GET /api/v1/health`) reporting DB and memory state.
- [ ] Admin Web foundation (`apps/admin-web`):
  - [ ] Vite + React 18 + TypeScript setup.
  - [ ] Tailwind CSS design system with custom professional palette (Navy `#0f172a`, Slate `#334155`, restrained Emerald `#059669`).
  - [ ] Routing foundation with React Router (`/login`, `/register`, `/forgot-password`, `/admin/*`, `/retailer/*`).
  - [ ] TanStack Query provider and Axios API client configured with credentials.
- [ ] Mobile foundation (`apps/mobile`):
  - [ ] Expo React Native TypeScript setup with Expo Router.
  - [ ] Safe area and navigation layout.
  - [ ] API client and secure token storage adapter interface.

---

## Phase 2: Authentication & Role-Based Access Control (Current Target)
- [ ] Mongoose Data Models:
  - [ ] `User` schema: email, phone, passwordHash, role, accountStatus, failedLoginAttempts, lockoutUntil, refreshSessionId.
  - [ ] `Retailer` schema: businessName, contactPerson, tradeName, gstin, pan, billingAddress, deliveryAddresses, creditLimitPaise, creditStatus, assignedSalesmanId, verificationDocs.
  - [ ] `AuditLog` schema: actorId, action, targetResource, targetId, diff, ipAddress, userAgent, timestamp.
- [ ] Password Security:
  - [ ] Bcrypt/Argon2 password hashing with high cost factor.
  - [ ] Password strength validation (min 8 chars, uppercase, lowercase, numbers, symbols).
  - [ ] Rate-limited login throttling and 15-minute temporary lockout after 5 consecutive failures.
- [ ] Token Management:
  - [ ] Short-lived Access Token (15m expiry, RS256 or HS256).
  - [ ] Secure Refresh Token (7d expiry) with rotation and reuse detection.
  - [ ] HttpOnly, Secure, SameSite=Strict cookies for Web; Bearer authorization headers for Mobile.
  - [ ] Explicit session revocation on logout, account suspension, or password change.
- [ ] Role-Based Access Control Middleware:
  - [ ] Enforce 7 distinct roles: Super Admin, Admin, Accounts Manager, Sales Manager, Salesman, Warehouse Manager, Retailer.
  - [ ] Resource-level authorization: Retailers can strictly access only their own records; Salesmen can access only assigned territories/retailers.
- [ ] Authentication Endpoints (`/api/v1/auth`):
  - [ ] `POST /register`: Retailer business registration (creates pending account).
  - [ ] `POST /login`: Credential validation, lockout check, token generation.
  - [ ] `POST /refresh-token`: Rotated refresh token exchange.
  - [ ] `POST /logout`: Invalidate refresh session.
  - [ ] `GET /me`: Current user session and permissions.
  - [ ] `POST /forgot-password` & `POST /reset-password`: Single-use, time-limited reset tokens.
- [ ] Admin Approval Flow (`/api/v1/retailers`):
  - [ ] `GET /pending`: List pending retailer registrations for Admin review.
  - [ ] `PATCH /:id/status`: Approve (with assigned credit limit & payment terms) or Reject with audit log.
- [ ] Web UI Authentication:
  - [ ] Professional branded Login screen with password show/hide, remember-me toggle, validation errors.
  - [ ] Multi-step Retailer Registration screen with GSTIN validation feedback and address capture.
  - [ ] Protected route wrappers (`ProtectedRoute`, `RoleGuard`).

---

## Phase 3: Catalogue, Inventory & Ordering
- [x] Product & Category Mongoose schemas with SKU, HSN codes, UOM, pack sizes, MRP paise, wholesale price paise, stock levels.
- [x] Catalogue API with pagination, full-text search, category filters, sorting (`/api/v1/products`).
- [x] Server-authoritative Shopping Cart recalculation (`/api/v1/orders/calculate-cart`) with intra-state CGST/SGST & inter-state IGST tax splits.
- [x] Transactional Checkout (`/api/v1/orders/checkout`) with atomic stock reservation, credit limit validation, and idempotency protection.
- [x] Admin product and inventory management (SKU view, stock adjustments with audit log).
- [x] Retailer & Admin interactive web UI (Wholesale Catalogue, Cart Drawer with live credit assessment, Orders List, and Line Snapshot Modal).
- [x] 12 Passing automated integration tests covering Catalogue, Cart Math, Stock Reservation, Credit Shortfall Rejection, and Cancellation Release.

---

## Phase 4: Credit Management, Invoices & Ledger
- [ ] Retailer Credit Account schema: approved credit limit, receivables balance, active reservations.
- [ ] Atomic credit validation formula: `Available Credit = Credit Limit - Receivables - Active Reservations`.
- [ ] Order-level credit reservations with automatic release on cancellation/rejection.
- [ ] Double-entry compliant Ledger schema: debit, credit, running balance, transaction type.
- [ ] Tax invoice generation with HSN summaries and GST splits.

---

## Phase 5: Payment Processing & Bank Reconciliation
- [ ] Multi-mode payment gateway abstraction:
  - [ ] Option A: Credit Account deduction.
  - [ ] Option B: UPI intent / QR generation.
  - [ ] Option C: Bank Transfer (NEFT/RTGS/IMPS) with UTR submission and accounts verification.
  - [ ] Option D: Gateway (Razorpay/Cashfree) checkout sessions.
- [ ] Cryptographic webhook verification and idempotency protection against duplicate callbacks.
- [ ] Accounts reconciliation portal: approve submitted UTRs, allocate receipts to invoices.

---

## Phase 6: Schemes, Salesmen & Reporting
- [ ] Configurable discount rules: Buy X Get Y Free, Quantity slab percentage discounts.
- [ ] Territory and Salesman beat scheduling and proxy ordering.
- [ ] Financial and sales analytics with Recharts: daily collections, overdue receivables, territory sales.

---

## Phase 7: Zoho Integration & External Services
- [ ] Zoho Books & Inventory OAuth 2.0 flow with encrypted token persistence.
- [ ] Outbound customer and sales order sync with exponential backoff and retry queue.
- [ ] Real-time sync status reporting with unconfigured indicator when credentials are blank.

---

## Phase 8: Hardening, Automated Tests & Launch
- [ ] Automated Jest/Supertest suite for auth, credit concurrency, and cart calculation.
- [ ] Seed script for demo products, users, schemes, and test orders.
- [ ] Production build verification and Docker deployment templates.
