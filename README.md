# NECESSITY INDIA PVT. LTD. — B2B ENTERPRISE PLATFORM
## Enterprise B2B Distributor, Retailer Ordering, Credit & Payment Management Platform

[![Node.js](https://img.shields.io/badge/Node.js-v22.x-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-Expo%2051-purple.svg)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v3.4-38B2AC.svg)](https://tailwindcss.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-forestgreen.svg)](https://www.mongodb.com/)

---

### 1. Executive Summary

This monorepo contains the complete, production-oriented distribution and retailer ordering platform engineered for **Necessity India Pvt. Ltd.**, a premier wholesale distributor of commercial textiles, napkins, paper supplies, tray covers, and cleaning consumables.

The platform provides:
1. **Desktop-First Admin Web Portal** (`apps/admin-web`): React 18 + Vite + Tailwind CSS + TanStack Query + React Router. Includes executive analytics, dealer onboarding KYC approval, credit limit assignments, and audit tracking.
2. **Universal Mobile Application** (`apps/mobile`): React Native with Expo 51 + Expo Router + SecureStore. Tailored for retail store owners and field sales representatives.
3. **High-Security Modular Backend API** (`server`): Node.js + Express + TypeScript, versioned under `/api/v1`, secured with Helmet, CORS allowlisting, rate-limiting, and short-lived JWTs with refresh token rotation and session family reuse detection.
4. **Shared Type & Schema Contract** (`packages/shared`): Unified Zod validation schemas, exact integer paise financial calculations, and domain enums.

---

### 2. Architecture & Monorepo Structure

```
necessity-b2b/
├── apps/
│   ├── admin-web/               # Vite + React 18 Admin, Accounts & Operations Portal
│   └── mobile/                  # Expo 51 React Native Retailer & Salesman App
├── server/                      # Express + TypeScript Modular API Server
│   ├── src/
│   │   ├── config/              # Database (Atlas/in-memory fallback), Logger, Environment
│   │   ├── middleware/          # JWT auth, RBAC guards, rate-limiting, audit logger
│   │   ├── modules/
│   │   │   ├── auth/            # Register, login, lockout defense, token rotation
│   │   │   ├── users/           # User lifecycle and role management
│   │   │   ├── retailers/       # Retailer profile, KYC, GSTIN, credit limits
│   │   │   └── audit/           # Immutable compliance audit trails
│   │   └── scripts/             # Database seeding
├── packages/
│   └── shared/                  # Zero-dependency domain types, schemas & currency math
├── docs/                        # Architecture, Checklists, Schemas, RBAC specifications
├── pnpm-workspace.yaml          # Monorepo workspace configuration
└── .env.example                 # Environment variable templates
```

---

### 3. Financial Exactitude & Core Principles

- **Integer Currency Representation**: All monetary figures are stored as **exact integers in paise** (1 INR = 100 paise). Floating-point arithmetic is strictly prohibited.
- **Authoritative Server Calculations**:
  $$\text{Available Credit} = \text{Approved Credit Limit} - \text{Outstanding Receivables} - \text{Active Reservations}$$
- **Zero-Setup Local Development**: The backend automatically connects to MongoDB Atlas when `MONGODB_URI` is provided; if offline or running in test mode, it seamlessly launches `MongoMemoryServer` without requiring local Docker or MongoDB daemons.

---

### 4. Getting Started & Installation

#### 4.1 Prerequisites
- **Node.js**: v18.0.0 or higher (v22.x recommended)
- **pnpm**: v9.x or v10.x (`npm install -g pnpm`)

#### 4.2 Clone & Install Dependencies
```bash
git clone <repository-url>
cd "necessity-b2b"

# Install all workspace dependencies in hoisted mode
pnpm install
```

#### 4.3 Configure Environment Variables
Copy the template into `.env`:
```bash
cp .env.example .env
```
*(In development, all variables have robust sensible fallbacks).*

#### 4.4 Seed Demo Accounts & Retailers
Seed the database with default accounts (Super Admin, Accounts Manager, Salesman, Approved Retailer, and Pending Retailer):
```bash
pnpm --filter server seed
```

#### 4.5 Run Automated Tests
Execute the Jest integration test suite (verifying health, registration, duplicate checks, 5-strike brute-force lockout, token rotation, and RBAC retailer approval):
```bash
pnpm test
```

#### 4.6 Launch Local Development Servers
To run the full stack simultaneously:
```bash
# Terminal 1: Backend API Server (Port 5000)
pnpm dev:server

# Terminal 2: Admin Web Application (Port 5173)
pnpm dev:web

# Terminal 3: Mobile Application (Expo Metro Bundler)
pnpm dev:mobile
```

Visit the Admin Web Portal at [http://localhost:5173](http://localhost:5173).

---

### 5. Demo Credentials

The login screen features a **"Quick Demo Switcher"** allowing one-click authentication as any role:

| Role | Identifier | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@necessityindia.com` | `AdminPassword123!` | System settings, user roles, integrations |
| **Accounts Manager** | `accounts@necessityindia.com` | `Accounts123!` | Credit approvals, ledger adjustments, UTRs |
| **Field Salesman** | `sales@necessityindia.com` | `Salesman123!` | Beat schedule, order booking on behalf |
| **Active Retailer** | `+919811112222` | `Retailer123!` | ₹5,00,000 credit limit (Apex Hospitality) |
| **Pending Retailer** | `+919833334444` | `Retailer123!` | Awaiting Admin Approval (Metro Trade Links) |

---

### 6. Phase Status & Implementation Roadmap

- [x] **Phase 1: Foundation** (Monorepo, shared package, Express server, Vite web app, Expo mobile app, health check, structured Pino logging, centralized error handling)
- [x] **Phase 2: Authentication & RBAC** (Retailer onboarding, password security with bcrypt, JWT token rotation, 5-attempt brute-force lockout, Admin credit limit approval workflow, interactive UI with demo switcher)
- [x] **Phase 3: Catalogue, Inventory & Ordering** (Product & Category schemas, exact integer paise dealer pricing, pack size & MOQ validation, intra-state CGST/SGST & inter-state IGST splits, transactional checkout, atomic stock reservation & credit reserve, admin inventory stock adjustments, itemized order snapshots, 12 passing Jest tests)
- [ ] **Phase 4: Credit Management, Invoices & Ledger** (Atomic credit reservation release, double-entry ledger entries, tax invoice generation)
- [ ] **Phase 5: Multi-Mode Payments** (Razorpay gateway, Cashfree, UPI QR, Bank transfer UTR verification portal)
- [ ] **Phase 6: Schemes & Discount Engine** (Buy X Get Y Free, slab percentage discounts, sales analytics)
- [ ] **Phase 7: Zoho Books & Inventory Integration** (OAuth 2.0 sync, exponential backoff, status indicator)
- [ ] **Phase 8: Hardening & Launch** (E2E testing, security review, Docker deployment)
