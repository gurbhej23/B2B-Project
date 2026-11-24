# AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC) RULES
## Necessity India Pvt. Ltd. — Security Architecture

---

### 1. The 7 Enterprise Roles

| Role | System Code | Scope & Description |
| :--- | :--- | :--- |
| **Super Admin** | `super_admin` | Unrestricted system-wide access, credentials, audit logs, role changes, integrations. |
| **Admin** | `admin` | Day-to-day enterprise operations, retailer approval, price lists, schemes, user onboarding. |
| **Accounts Manager**| `accounts_manager` | Financial authority: ledger adjustments, invoice issuance, UTR verification, credit terms, Zoho sync. |
| **Sales Manager** | `sales_manager` | Territory management, target setting, sales team oversight, territory-wide reports. |
| **Salesman** | `salesman` | Field agent: Beat schedule, order booking for assigned retailers, collection record logging. |
| **Warehouse Manager**| `warehouse_manager` | Physical fulfillment: inventory replenishment, batch picking, packing, dispatch status updates. |
| **Retailer** | `retailer` | External customer: self-service catalog ordering, cart, credit status, invoice and ledger visibility. |

---

### 2. Permissions Matrix

| Module / Action | Super Admin | Admin | Accounts | Sales Mgr | Salesman | Warehouse | Retailer |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **View Own Profile** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Manage Users & Roles** | ✓ | Read/Write | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Approve Retailers** | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Set Credit Limits** | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Product Catalogue (Browse)** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (Active only) |
| **Manage Products & Stock** | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ (Stock only) | ✗ |
| **Place Order (Self)** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ (Own account) |
| **Place Order (On Behalf)**| ✓ | ✓ | ✗ | ✓ | ✓ (Assigned only) | ✗ | ✗ |
| **View Orders** | All | All | All | Territory | Assigned only | Fulfillment | Own only |
| **Cancel Order** | ✓ | ✓ | ✗ | Pre-dispatch | Pre-dispatch | ✗ | Draft/Submitted |
| **Issue Tax Invoice** | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Verify Bank UTRs** | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **View Financial Ledger** | All | All | All | Aggregates | ✗ | ✗ | Own only |
| **Manage Schemes/Discounts**| ✓ | ✓ | ✗ | Propose | ✗ | ✗ | ✗ |
| **Zoho Books Sync** | ✓ | Read/Write | Sync/Retry | ✗ | ✗ | ✗ | ✗ |
| **Audit Logs** | ✓ | Read-only | ✗ | ✗ | ✗ | ✗ | ✗ |

---

### 3. Resource-Level Authorization & Data Isolation

1. **Retailer Multi-Tenant Isolation**:
   - Every retailer query (orders, invoices, payments, credit balances, ledger) MUST be scoped to `req.user.retailerProfileId`.
   - The backend middleware automatically attaches `retailerId` from the verified session, strictly ignoring any client-supplied `retailerId` in query strings or request bodies unless the user possesses an administrative role.
2. **Salesman Territory & Retailer Restriction**:
   - A user with role `salesman` may only query retailers where `retailer.assignedSalesmanId == req.user._id` or `retailer.assignedTerritoryId IN req.user.assignedTerritoryIds`.
   - Order booking on behalf of a retailer checks this relationship before initiating transactions.
3. **Warehouse Separation**:
   - Warehouse personnel have access only to dispatch fulfillment queues and SKU physical stock on hand. Financial ledgers, wholesale margins, and credit balances are hidden.

---

### 4. JWT & Session Security Architecture

1. **Short-Lived Access Token**:
   - Expiration: **15 minutes**.
   - Payload: `{ sub: userId, role: role, retailerId?: string, territoryIds?: string[], sessionId: string }`.
   - Transport:
     - **Web**: Sent via secure, HttpOnly, SameSite=Strict cookie (`access_token`).
     - **Mobile**: Sent via `Authorization: Bearer <token>` header.
2. **Refresh Token & Family Rotation**:
   - Expiration: **7 days**.
   - Rotated on every single refresh request.
   - If an old/reused refresh token is presented, the system detects a potential replay attack, immediately revokes the entire session family, and marks the user account for investigation.
3. **Session Revocation**:
   - Stored in Redis (or indexed MongoDB session table): `refresh_session:{userId}:{sessionId}`.
   - Triggered on: explicit logout, password change, account suspension, or security admin action.
4. **Brute Force & Lockout Defense**:
   - `failedLoginAttempts` tracked per phone/email.
   - After **5 consecutive failed attempts**, account is locked for **15 minutes** (`lockoutUntil`).
   - Rate limiting: max 5 login requests per minute per IP address.
