export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: any;
  public readonly raw?: any;

  constructor(message: string, status: number, code?: string, details?: any, raw?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.raw = raw;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Robustly extract a human-readable message from any error representation.
 * Prevents "[object Object]" under all circumstances across backend, admin web, and mobile app.
 */
export function extractErrorMessage(err: any): string {
  if (!err) {
    return 'An unexpected error occurred. Please try again.';
  }

  if (typeof err === 'string') {
    const trimmed = err.trim();
    if (trimmed && trimmed !== '[object Object]') {
      return trimmed;
    }
  }

  // Explicit error codes
  const code = err.code || err.error?.code;
  if (code === 'CUSTOMER_DISABLED') {
    return 'Your account has been disabled. Please contact the administrator.';
  }
  if (code === 'CUSTOMER_NOT_APPROVED') {
    const raw = err.message || err.error?.message;
    if (typeof raw === 'string' && raw.trim() && raw !== '[object Object]') {
      return raw.trim();
    }
    return 'Your retailer account is pending approval by the administrator.';
  }
  if (code === 'INVALID_CREDENTIALS') {
    return 'Invalid phone number / email or password.';
  }
  if (code === 'ACCOUNT_LOCKED') {
    return 'Account is temporarily locked due to multiple failed login attempts. Please try again later.';
  }

  // Axios-style error response: err.response.data
  if (err.response?.data) {
    const data = err.response.data;
    if (typeof data.message === 'string' && data.message.trim() && data.message !== '[object Object]') {
      return data.message.trim();
    }
    if (typeof data.error?.message === 'string' && data.error.message.trim() && data.error.message !== '[object Object]') {
      return data.error.message.trim();
    }
    if (typeof data.error === 'string' && data.error.trim() && data.error !== '[object Object]') {
      return data.error.trim();
    }
  }

  // Validation details array
  if (Array.isArray(err.details) && err.details.length > 0) {
    const detailMsgs = err.details
      .map((d: any) => d.message || d.msg || (typeof d === 'string' ? d : null))
      .filter(Boolean);
    if (detailMsgs.length > 0) {
      return detailMsgs.join('. ');
    }
  }

  // Nested error object
  if (err.error && typeof err.error === 'object') {
    if (typeof err.error.message === 'string' && err.error.message.trim() && err.error.message !== '[object Object]') {
      return err.error.message.trim();
    }
    if (Array.isArray(err.error.details) && err.error.details.length > 0) {
      const detailMsgs = err.error.details
        .map((d: any) => d.message || d.msg || (typeof d === 'string' ? d : null))
        .filter(Boolean);
      if (detailMsgs.length > 0) {
        return detailMsgs.join('. ');
      }
    }
  }

  // Top-level message property
  if (typeof err.message === 'string') {
    const trimmed = err.message.trim();
    if (trimmed && trimmed !== '[object Object]') {
      return trimmed;
    }
  }

  // HTTP status fallbacks
  if (err.status === 401) {
    return 'Invalid credentials or session expired. Please sign in again.';
  }
  if (err.status === 403) {
    return 'Access denied. You do not have permission to perform this action.';
  }
  if (err.status === 404) {
    return 'Requested resource was not found.';
  }
  if (err.status >= 500) {
    return 'Internal server error occurred. Please try again later.';
  }

  return 'An unexpected error occurred. Please try again.';
}
