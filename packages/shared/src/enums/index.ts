export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  ACCOUNTS_MANAGER = 'accounts_manager',
  SALES_MANAGER = 'sales_manager',
  SALESMAN = 'salesman',
  WAREHOUSE_MANAGER = 'warehouse_manager',
  RETAILER = 'retailer',
}

export enum AccountStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  REJECTED = 'rejected',
  SUSPENDED = 'suspended',
}

export enum CustomerType {
  RETAILER = 'retailer',
  WHOLESALER = 'wholesaler',
  DISTRIBUTOR = 'distributor',
  NEW = 'new',
  OLD = 'old',
}

export enum OrderStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
  PROCESSING = 'processing',
  DISPATCHED = 'dispatched',
  PICKED_UP = 'picked_up',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  ISSUED = 'issued',
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  CREDIT_ACCOUNT = 'credit_account',
  UPI = 'upi',
  BANK_TRANSFER = 'bank_transfer',
  NEFT_RTGS_IMPS = 'neft_rtgs_imps',
  PAYMENT_GATEWAY = 'payment_gateway',
  CHEQUE = 'cheque',
  CASH = 'cash',
}

export enum PaymentStatus {
  UNPAID = 'unpaid',
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
  REFUNDED = 'refunded',
  INITIATED = 'initiated',
  PENDING = 'pending',
  SUBMITTED_FOR_VERIFICATION = 'submitted_for_verification',
  SUCCESSFUL = 'successful',
  FAILED = 'failed',
  EXPIRED = 'expired',
  PARTIALLY_RECONCILED = 'partially_reconciled',
  RECONCILED = 'reconciled',
  REVERSED = 'reversed',
}

export enum CreditStatus {
  NORMAL = 'normal',
  ON_HOLD = 'on_hold',
  RESTRICTED = 'restricted',
}

export enum CreditReservationStatus {
  ACTIVE = 'active',
  CONVERTED_TO_INVOICE = 'converted_to_invoice',
  RELEASED = 'released',
  EXPIRED = 'expired',
}

export enum LedgerEntryType {
  INVOICE_POSTED = 'invoice_posted',
  PAYMENT_RECEIVED = 'payment_received',
  CREDIT_NOTE = 'credit_note',
  DEBIT_ADJUSTMENT = 'debit_adjustment',
  OPENING_BALANCE = 'opening_balance',
}

export enum SchemeType {
  BUY_X_GET_PERCENT_OFF = 'buy_x_get_percent_off',
  BUY_X_GET_Y_FREE = 'buy_x_get_y_free',
  SLAB_DISCOUNT = 'slab_discount',
  FLAT_DISCOUNT = 'flat_discount',
}

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED_AMOUNT = 'fixed_amount',
}

export enum DiscountScope {
  ALL_PRODUCTS = 'all_products',
  CATEGORIES = 'categories',
  PRODUCTS = 'products',
}
