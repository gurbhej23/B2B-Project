import { ITierPrice } from '../types';

export interface TierValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates quantity-based tier pricing rules:
 * - Positive integer minQuantity (>= 1)
 * - Non-negative integer unitPricePaise (>= 0)
 * - If maxQuantity exists, must be >= minQuantity
 * - Only the final tier can be open-ended (no maxQuantity)
 * - No overlaps between tiers
 * - No gaps between tiers (contiguous coverage)
 * - Optional: Tier prices cannot exceed base wholesale price
 */
export function validateTierPricing(
  tiers: ITierPrice[],
  baseWholesalePricePaise?: number,
  moq?: number
): TierValidationResult {
  if (!tiers || tiers.length === 0) {
    return { valid: true };
  }

  // Sort by minQuantity ascending to evaluate sequence
  const sorted = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);

  // Validate that the first tier starts at MOQ if specified
  if (moq !== undefined && moq > 0) {
    if (sorted[0].minQuantity !== moq) {
      return {
        valid: false,
        error: `Tier 1 minimum quantity (${sorted[0].minQuantity}) must start at the Minimum Order Quantity (MOQ: ${moq})`,
      };
    }
  }

  for (let i = 0; i < sorted.length; i++) {
    const tier = sorted[i];

    if (!Number.isInteger(tier.minQuantity) || tier.minQuantity < 1) {
      return {
        valid: false,
        error: `Tier ${i + 1}: Minimum quantity must be a positive integer (at least 1)`,
      };
    }

    if (!Number.isInteger(tier.unitPricePaise) || tier.unitPricePaise < 0) {
      return {
        valid: false,
        error: `Tier ${i + 1}: Unit price must be a valid non-negative amount`,
      };
    }

    if (baseWholesalePricePaise !== undefined && baseWholesalePricePaise > 0) {
      if (tier.unitPricePaise > baseWholesalePricePaise) {
        return {
          valid: false,
          error: `Tier ${i + 1}: Unit price (₹${(tier.unitPricePaise / 100).toFixed(2)}) cannot exceed base wholesale price (₹${(baseWholesalePricePaise / 100).toFixed(2)})`,
        };
      }
    }

    if (tier.maxQuantity !== undefined && tier.maxQuantity !== null) {
      if (!Number.isInteger(tier.maxQuantity) || tier.maxQuantity < tier.minQuantity) {
        return {
          valid: false,
          error: `Tier ${i + 1}: Maximum quantity (${tier.maxQuantity}) cannot be less than minimum quantity (${tier.minQuantity})`,
        };
      }
    } else {
      // Open-ended tier
      if (i !== sorted.length - 1) {
        return {
          valid: false,
          error: `Tier ${i + 1}: Only the final tier can be open-ended without a maximum quantity`,
        };
      }
    }

    // Check relationship with next tier
    if (i < sorted.length - 1) {
      const nextTier = sorted[i + 1];
      if (tier.maxQuantity === undefined || tier.maxQuantity === null) {
        return {
          valid: false,
          error: `Tier ${i + 1} is open-ended, so no subsequent tier can follow it`,
        };
      }

      if (nextTier.minQuantity <= tier.maxQuantity) {
        return {
          valid: false,
          error: `Tier ${i + 1} (up to ${tier.maxQuantity}) overlaps with Tier ${i + 2} (starts at ${nextTier.minQuantity})`,
        };
      }

      if (nextTier.minQuantity > tier.maxQuantity + 1) {
        return {
          valid: false,
          error: `Gap detected between Tier ${i + 1} (ends at ${tier.maxQuantity}) and Tier ${i + 2} (starts at ${nextTier.minQuantity}). Coverage must be continuous.`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Resolves the unit price for a given quantity based on configured tier pricing.
 * Falls back to baseline dealer price if tier pricing is disabled, empty, or outside configured tiers.
 */
export function resolveTierPrice(
  tiers: ITierPrice[] | undefined | null,
  quantity: number,
  fallbackUnitPricePaise: number
): { unitPricePaise: number; appliedTier?: ITierPrice } {
  if (!tiers || tiers.length === 0 || quantity <= 0) {
    return { unitPricePaise: fallbackUnitPricePaise };
  }

  // Find matching tier
  for (const tier of tiers) {
    const isAboveMin = quantity >= tier.minQuantity;
    const isBelowMax =
      tier.maxQuantity === undefined || tier.maxQuantity === null || quantity <= tier.maxQuantity;

    if (isAboveMin && isBelowMax) {
      return {
        unitPricePaise: tier.unitPricePaise,
        appliedTier: tier,
      };
    }
  }

  return { unitPricePaise: fallbackUnitPricePaise };
}

export interface NextTierSavings {
  nextTier: ITierPrice;
  quantityNeeded: number;
  potentialSavingsPerUnitPaise: number;
}

/**
 * Calculates the quantity needed to reach the next tier and potential savings.
 */
export function getNextTierSavings(
  tiers: ITierPrice[] | undefined | null,
  currentQuantity: number,
  currentUnitPricePaise: number
): NextTierSavings | null {
  if (!tiers || tiers.length === 0) return null;

  const sorted = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);

  for (const tier of sorted) {
    if (tier.minQuantity > currentQuantity) {
      const quantityNeeded = tier.minQuantity - currentQuantity;
      const savings = currentUnitPricePaise - tier.unitPricePaise;
      return {
        nextTier: tier,
        quantityNeeded,
        potentialSavingsPerUnitPaise: Math.max(0, savings),
      };
    }
  }

  return null;
}
