// ─── Combination Validation & Pricing ───────────────────────────
// Each order line for a dish is split into combinations, each with
// its own quantity. Combination quantities must sum to line quantity.
// Every required group must be satisfied per combination.

// ── Types ───────────────────────────────────────────────────────

export interface ResolvedGroup {
  groupId: string;
  name: string;
  required: boolean;
  usesPortions: boolean;
  options: ResolvedGroupOption[];
  portions: ResolvedGroupPortion[];
}

export interface ResolvedGroupOption {
  optionId: string;
  name: string;
  /** Resolved price on the effective tier (null = unavailable) */
  priceCents: number | null;
}

export interface ResolvedGroupPortion {
  portionSizeId: string;
  name: string;
  extraCents: number;
}

/**
 * A combination selection as submitted by the client.
 */
export interface CombinationInput {
  quantity: number;
  selections: SelectionInput[];
}

export interface SelectionInput {
  groupId: string;
  optionId: string;
  portionSizeId?: string | null;
}

/**
 * Validation result for a line's combinations.
 */
export interface CombinationValidationResult {
  valid: boolean;
  errors: CombinationError[];
}

export interface CombinationError {
  /** e.g. 'combinations.0.selections.protein' */
  path: string;
  code: string;
  message: string;
}

// ── Signature ───────────────────────────────────────────────────

/**
 * Compute a stable, unique signature for a combination based on its selections.
 * Used to detect duplicates and as a key for kitchen prep units.
 *
 * Format: sorted "groupId:optionId[:portionSizeId]" joined by "|"
 */
export function computeSignature(selections: SelectionInput[]): string {
  return [...selections]
    .map((s) => {
      const parts = [s.groupId, s.optionId];
      if (s.portionSizeId) parts.push(s.portionSizeId);
      return parts.join(':');
    })
    .sort()
    .join('|');
}

// ── Validation ──────────────────────────────────────────────────

/**
 * Validate combinations for a single order line.
 *
 * Rules:
 * 1. At least 1 combination
 * 2. Sum of combination quantities = line quantity
 * 3. Per combination:
 *    a. quantity > 0
 *    b. Every required group has exactly 1 selection
 *    c. Optional group: 0 or 1 selection
 *    d. Selected option must be in the group's available options
 *    e. Selected option must have a resolved price (not null)
 *    f. If group usesPortions, selection must include a valid portionSizeId
 *    g. If group does NOT use portions, selection must NOT include portionSizeId
 * 4. No duplicate signatures across combinations
 */
export function validateCombinations(
  lineQuantity: number,
  combinations: CombinationInput[],
  resolvedGroups: ResolvedGroup[],
): CombinationValidationResult {
  const errors: CombinationError[] = [];

  if (combinations.length === 0) {
    errors.push({
      path: 'combinations',
      code: 'NO_COMBINATIONS',
      message: 'At least one combination is required',
    });
    return { valid: false, errors };
  }

  // Check sum
  const totalQty = combinations.reduce((sum, c) => sum + c.quantity, 0);
  if (totalQty !== lineQuantity) {
    errors.push({
      path: 'combinations',
      code: 'COMBINATION_SUM_MISMATCH',
      message: `Combination quantities sum to ${totalQty}, expected ${lineQuantity}`,
    });
  }

  const groupMap = new Map<string, ResolvedGroup>();
  for (const g of resolvedGroups) groupMap.set(g.groupId, g);

  const signatures = new Set<string>();

  for (let ci = 0; ci < combinations.length; ci++) {
    const combo = combinations[ci];
    const prefix = `combinations.${ci}`;

    if (combo.quantity <= 0) {
      errors.push({
        path: `${prefix}.quantity`,
        code: 'INVALID_QUANTITY',
        message: 'Combination quantity must be positive',
      });
    }

    // Track which groups are satisfied
    const groupSelections = new Map<string, SelectionInput[]>();
    for (const sel of combo.selections) {
      const arr = groupSelections.get(sel.groupId) || [];
      arr.push(sel);
      groupSelections.set(sel.groupId, arr);
    }

    // Check each group
    for (const group of resolvedGroups) {
      const sels = groupSelections.get(group.groupId) || [];

      if (group.required && sels.length === 0) {
        errors.push({
          path: `${prefix}.selections.${group.name}`,
          code: 'REQUIRED_GROUP_MISSING',
          message: `Required group "${group.name}" must have exactly 1 selection`,
        });
        continue;
      }

      if (sels.length > 1) {
        errors.push({
          path: `${prefix}.selections.${group.name}`,
          code: 'TOO_MANY_SELECTIONS',
          message: `Group "${group.name}" allows at most 1 selection`,
        });
        continue;
      }

      if (sels.length === 1) {
        const sel = sels[0];

        // Check option is in the group
        const opt = group.options.find((o) => o.optionId === sel.optionId);
        if (!opt) {
          errors.push({
            path: `${prefix}.selections.${group.name}`,
            code: 'INVALID_OPTION_SELECTION',
            message: `Option "${sel.optionId}" is not available in group "${group.name}"`,
          });
          continue;
        }

        // Check option has a resolved price
        if (opt.priceCents === null) {
          errors.push({
            path: `${prefix}.selections.${group.name}`,
            code: 'PRICE_NOT_SET',
            message: `Option "${opt.name}" has no price on this tier`,
          });
        }

        // Portion validation
        if (group.usesPortions) {
          if (!sel.portionSizeId) {
            errors.push({
              path: `${prefix}.selections.${group.name}.portionSizeId`,
              code: 'PORTION_REQUIRED',
              message: `Group "${group.name}" requires a portion size`,
            });
          } else {
            const portion = group.portions.find(
              (p) => p.portionSizeId === sel.portionSizeId,
            );
            if (!portion) {
              errors.push({
                path: `${prefix}.selections.${group.name}.portionSizeId`,
                code: 'INVALID_PORTION',
                message: `Portion size "${sel.portionSizeId}" is not valid for group "${group.name}"`,
              });
            }
          }
        } else if (sel.portionSizeId) {
          errors.push({
            path: `${prefix}.selections.${group.name}.portionSizeId`,
            code: 'PORTION_NOT_ALLOWED',
            message: `Group "${group.name}" does not use portions`,
          });
        }
      }
    }

    // Check for selections referencing unknown groups
    for (const sel of combo.selections) {
      if (!groupMap.has(sel.groupId)) {
        errors.push({
          path: `${prefix}.selections`,
          code: 'UNKNOWN_GROUP',
          message: `Unknown group "${sel.groupId}"`,
        });
      }
    }

    // Duplicate signature
    const sig = computeSignature(combo.selections);
    if (signatures.has(sig)) {
      errors.push({
        path: prefix,
        code: 'COMBINATION_DUPLICATE_SIGNATURE',
        message: 'Duplicate combination (same selections already exist)',
      });
    }
    signatures.add(sig);
  }

  return { valid: errors.length === 0, errors };
}

// ── Pricing ─────────────────────────────────────────────────────

/**
 * Price a single combination.
 * unitCents = dishPriceCents + Σ(optionPriceCents + portionExtraCents)
 * totalCents = unitCents × quantity
 */
export function priceCombo(
  dishPriceCents: number,
  selections: SelectionInput[],
  resolvedGroups: ResolvedGroup[],
  quantity: number,
): { unitCents: number; totalCents: number } {
  const groupMap = new Map<string, ResolvedGroup>();
  for (const g of resolvedGroups) groupMap.set(g.groupId, g);

  let optionTotal = 0;
  for (const sel of selections) {
    const group = groupMap.get(sel.groupId);
    if (!group) continue;

    const opt = group.options.find((o) => o.optionId === sel.optionId);
    if (opt && opt.priceCents !== null) {
      optionTotal += opt.priceCents;
    }

    if (sel.portionSizeId && group.usesPortions) {
      const portion = group.portions.find(
        (p) => p.portionSizeId === sel.portionSizeId,
      );
      if (portion) {
        optionTotal += portion.extraCents;
      }
    }
  }

  const unitCents = dishPriceCents + optionTotal;
  return {
    unitCents,
    totalCents: unitCents * quantity,
  };
}

/**
 * Price a line = Σ combo.totalCents
 */
export function priceLine(
  comboTotals: readonly number[],
): number {
  return comboTotals.reduce((sum, t) => sum + t, 0);
}

/**
 * Price an order = Σ line.totalCents
 */
export function priceOrder(
  lineTotals: readonly number[],
): number {
  return lineTotals.reduce((sum, t) => sum + t, 0);
}
