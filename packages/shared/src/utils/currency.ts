/**
 * Formats integer paise into an Indian Rupee string with locale separation.
 * E.g., 150075 paise -> "₹1,500.75"
 */
export function formatPaiseToINR(paise: number | undefined | null): string {
  if (paise === undefined || paise === null || isNaN(paise)) {
    return '₹0.00';
  }
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/**
 * Converts Indian Rupees into integer paise safely avoiding IEEE floating-point drift.
 * E.g., 1500.75 -> 150075
 */
export function inrToPaise(rupees: number | string): number {
  const numeric = typeof rupees === 'string' ? parseFloat(rupees) : rupees;
  if (isNaN(numeric)) return 0;
  return Math.round(numeric * 100);
}

/**
 * Converts integer paise into rupees float for display or calculations where required.
 */
export function paiseToRupees(paise: number): number {
  return (paise || 0) / 100;
}

export interface GstTaxBreakdown {
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalTaxPaise: number;
}

/**
 * Calculates exact integer paise GST tax split.
 * If intra-state: CGST = (Rate/2)% and SGST = (Rate/2)%.
 * If inter-state: IGST = Rate%.
 */
export function calculateGstBreakdown(
  taxableAmountPaise: number,
  gstRatePercent: number,
  isInterState: boolean
): GstTaxBreakdown {
  if (!taxableAmountPaise || taxableAmountPaise <= 0 || !gstRatePercent) {
    return { cgstPaise: 0, sgstPaise: 0, igstPaise: 0, totalTaxPaise: 0 };
  }

  if (isInterState) {
    const igstPaise = Math.round((taxableAmountPaise * gstRatePercent) / 100);
    return {
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise,
      totalTaxPaise: igstPaise,
    };
  } else {
    const halfRate = gstRatePercent / 2;
    const cgstPaise = Math.round((taxableAmountPaise * halfRate) / 100);
    const sgstPaise = Math.round((taxableAmountPaise * halfRate) / 100);
    return {
      cgstPaise,
      sgstPaise,
      igstPaise: 0,
      totalTaxPaise: cgstPaise + sgstPaise,
    };
  }
}
