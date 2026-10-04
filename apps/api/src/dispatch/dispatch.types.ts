// ─── Dispatch Types and Enums ────────────────────────────────────

export enum DropStage {
  PREPARING = 'PREPARING',
  KITCHEN_READY = 'KITCHEN_READY',
  DISPATCH_READY = 'DISPATCH_READY',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
}

export const STAGE_RANK: Record<DropStage, number> = {
  [DropStage.PREPARING]: 1,
  [DropStage.KITCHEN_READY]: 2,
  [DropStage.DISPATCH_READY]: 3,
  [DropStage.OUT_FOR_DELIVERY]: 4,
  [DropStage.DELIVERED]: 5,
};

/**
 * Determine fulfilment stage of a single order based on timestamps and status.
 */
export function getOrderStage(order: {
  status: string;
  kitchenReadyAt?: Date | string | null;
  dispatchReadyAt?: Date | string | null;
  outForDeliveryAt?: Date | string | null;
  deliveredAt?: Date | string | null;
}): DropStage {
  if (order.deliveredAt || order.status === 'DELIVERED') return DropStage.DELIVERED;
  if (order.outForDeliveryAt) return DropStage.OUT_FOR_DELIVERY;
  if (order.dispatchReadyAt) return DropStage.DISPATCH_READY;
  if (order.kitchenReadyAt) return DropStage.KITCHEN_READY;
  return DropStage.PREPARING;
}

/**
 * Compute the drop stage as the least advanced active order.
 * If all active orders are at stage S or higher, the drop is at min(stage of orders).
 */
export function computeDropStage(
  activeOrders: Array<{
    status: string;
    kitchenReadyAt?: Date | string | null;
    dispatchReadyAt?: Date | string | null;
    outForDeliveryAt?: Date | string | null;
    deliveredAt?: Date | string | null;
  }>,
  dropFallback?: {
    outForDeliveryAt?: Date | string | null;
    deliveredAt?: Date | string | null;
  },
): DropStage {
  if (!activeOrders || activeOrders.length === 0) {
    if (dropFallback?.deliveredAt) return DropStage.DELIVERED;
    if (dropFallback?.outForDeliveryAt) return DropStage.OUT_FOR_DELIVERY;
    return DropStage.PREPARING;
  }

  let minRank = 999;
  let minStage = DropStage.DELIVERED;

  for (const order of activeOrders) {
    const stage = getOrderStage(order);
    const rank = STAGE_RANK[stage];
    if (rank < minRank) {
      minRank = rank;
      minStage = stage;
    }
  }

  return minStage;
}

export interface DispatchBoardSummary {
  totalDrops: number;
  stageCounts: Record<DropStage, number>;
  unassignedCount: number;
  behindScheduleCount: number;
  totalOrders: number;
  totalMeals: number;
}

export interface DispatchBoardOrder {
  id: string;
  number: number;
  status: string;
  employeeName: string;
  packaging: string;
  totalMeals: number;
  kitchenReadyAt: string | null;
  dispatchReadyAt: string | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  plannedKitchenReadyAt: string | null;
  plannedDispatchReadyAt: string | null;
}

export interface DispatchBoardDrop {
  id: string;
  deliveryDate: string;
  deliveryTimeMin: number;
  deliveryTime: string;
  company: {
    id: string;
    name: string;
    driverNotes?: string | null;
    defaultDriverId?: string | null;
    dispatchLeadMinutes: number;
  };
  address: {
    id: string;
    label: string;
    line1: string;
    line2?: string | null;
    city: string;
    state?: string | null;
    postcode: string;
  };
  driver: {
    id: string;
    name: string;
    email: string;
  } | null;
  stage: DropStage;
  orderCount: number;
  totalMeals: number;
  canDispatchReady: boolean;
  stillCookingCount: number;
  isBehindSchedule: boolean;
  plannedDispatchReadyAt: string | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  deliveredNote: string | null;
  onTime: boolean | null;
  hasPhoto: boolean;
  orders: DispatchBoardOrder[];
}

export interface DispatchBoardResponse {
  date: string;
  summary: DispatchBoardSummary;
  drops: DispatchBoardDrop[];
}

export interface DriverDropDto {
  id: string;
  deliveryDate: string;
  deliveryTimeMin: number;
  deliveryTime: string;
  company: {
    id: string;
    name: string;
    driverNotes?: string | null;
  };
  address: {
    id: string;
    label: string;
    line1: string;
    line2?: string | null;
    city: string;
    state?: string | null;
    postcode: string;
  };
  stage: DropStage;
  orderCount: number;
  mealsCount: number;
  recipientNames: string[];
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  deliveredNote: string | null;
  onTime: boolean | null;
  hasPhoto: boolean;
}

export interface DriverDropsResponse {
  date: string;
  summary: {
    totalDrops: number;
    deliveredDrops: number;
    remainingDrops: number;
  };
  drops: DriverDropDto[];
}
