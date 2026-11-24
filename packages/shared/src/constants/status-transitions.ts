import { OrderStatus, UserRole } from '../enums';

/**
 * Authoritative Order Status Transition Matrix.
 * Defines permitted lifecycle state transitions across the application.
 * Terminal states (DELIVERED, CANCELLED, REJECTED) permit no further transitions.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [
    OrderStatus.APPROVED,
    OrderStatus.CONFIRMED,
    OrderStatus.PROCESSING,
    OrderStatus.DISPATCHED,
    OrderStatus.PICKED_UP,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
    OrderStatus.REJECTED,
  ],
  [OrderStatus.SUBMITTED]: [
    OrderStatus.APPROVED,
    OrderStatus.CONFIRMED,
    OrderStatus.PROCESSING,
    OrderStatus.DISPATCHED,
    OrderStatus.PICKED_UP,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
    OrderStatus.REJECTED,
  ],
  [OrderStatus.APPROVED]: [
    OrderStatus.PROCESSING,
    OrderStatus.DISPATCHED,
    OrderStatus.PICKED_UP,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.CONFIRMED]: [
    OrderStatus.PROCESSING,
    OrderStatus.DISPATCHED,
    OrderStatus.PICKED_UP,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PROCESSING]: [
    OrderStatus.DISPATCHED,
    OrderStatus.PICKED_UP,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.DISPATCHED]: [
    OrderStatus.DELIVERED,
    OrderStatus.PICKED_UP,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PICKED_UP]: [
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REJECTED]: [],
};

/**
 * Canonical sequential stages of an order.
 * PENDING (0) -> CONFIRMED (1) -> PROCESSING (2) -> SHIPPED (3) -> DELIVERED (4)
 */
export const ORDER_STAGE_SEQUENCE = [
  OrderStatus.SUBMITTED,
  OrderStatus.APPROVED,
  OrderStatus.PROCESSING,
  OrderStatus.DISPATCHED,
  OrderStatus.DELIVERED,
] as const;

/**
 * Returns canonical stage index (0 for Pending/Submitted, 1 for Confirmed/Approved,
 * 2 for Processing, 3 for Shipped/Dispatched/PickedUp, 4 for Delivered, -1 for Cancelled/Rejected).
 */
export function getOrderStatusStageIndex(status: OrderStatus | string): number {
  const s = String(status).toLowerCase();
  if (s === 'pending' || s === 'submitted') return 0;
  if (s === 'approved' || s === 'confirmed') return 1;
  if (s === 'processing') return 2;
  if (s === 'dispatched' || s === 'picked_up' || s === 'shipped') return 3;
  if (s === 'delivered' || s === 'completed') return 4;
  return -1; // cancelled, rejected, or unknown
}

/**
 * Checks if an order status is terminal (no further changes permitted).
 */
export function isTerminalOrderStatus(status: OrderStatus | string): boolean {
  const s = String(status).toLowerCase();
  return s === 'delivered' || s === 'completed' || s === 'cancelled' || s === 'rejected';
}

/**
 * Checks if target status is a valid forward-only transition from current status.
 */
export function isForwardOrderStatusTransition(
  currentStatus: OrderStatus | string,
  targetStatus: OrderStatus | string
): boolean {
  const currentNorm = String(currentStatus).toLowerCase();
  const targetNorm = String(targetStatus).toLowerCase();

  if (currentNorm === targetNorm) {
    return false;
  }

  // Terminal states cannot transition to anything
  if (isTerminalOrderStatus(currentStatus)) {
    return false;
  }

  // Cancellation is permitted from any non-terminal state
  if (targetNorm === 'cancelled' || targetNorm === 'rejected') {
    return true;
  }

  const currentIdx = getOrderStatusStageIndex(currentStatus);
  const targetIdx = getOrderStatusStageIndex(targetStatus);

  if (currentIdx === -1 || targetIdx === -1) {
    return false;
  }

  if (currentIdx === targetIdx) {
    return ORDER_STATUS_TRANSITIONS[currentStatus as OrderStatus]?.includes(targetStatus as OrderStatus) ?? false;
  }

  return targetIdx > currentIdx;
}

/**
 * Checks whether an order status transition is logically valid according to the state machine.
 */
export function isValidOrderStatusTransition(
  currentStatus: OrderStatus,
  targetStatus: OrderStatus
): boolean {
  if (currentStatus === targetStatus) {
    return true;
  }
  const permitted = ORDER_STATUS_TRANSITIONS[currentStatus];
  return Boolean(permitted && permitted.includes(targetStatus));
}

/**
 * Validates whether a specific user role is permitted to trigger a target order status.
 */
export function isRolePermittedForOrderTransition(
  role: UserRole,
  currentStatus: OrderStatus,
  targetStatus: OrderStatus
): boolean {
  // Retailers and salesmen may ONLY cancel orders when in SUBMITTED or PENDING state
  if (role === UserRole.RETAILER || role === UserRole.SALESMAN) {
    return (
      targetStatus === OrderStatus.CANCELLED &&
      (currentStatus === OrderStatus.SUBMITTED || currentStatus === OrderStatus.PENDING)
    );
  }

  // Warehouse managers can process, dispatch, mark picked up, and deliver
  if (role === UserRole.WAREHOUSE_MANAGER) {
    return [
      OrderStatus.PROCESSING,
      OrderStatus.DISPATCHED,
      OrderStatus.PICKED_UP,
      OrderStatus.DELIVERED,
    ].includes(targetStatus);
  }

  // Admin and accounts staff have full workflow authority
  const administrativeRoles = [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.ACCOUNTS_MANAGER,
    UserRole.SALES_MANAGER,
  ];
  return administrativeRoles.includes(role);
}
