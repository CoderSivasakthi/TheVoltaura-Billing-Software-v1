/**
 * ═══════════════════════════════════════════════════════════════════
 *  THEVOLTAURA BILLING SOFTWARE — CENTRALIZED BUSINESS RULES
 * ═══════════════════════════════════════════════════════════════════
 *
 *  THIS IS THE SINGLE SOURCE OF TRUTH for all configurable business
 *  rules, calculation constants, and rate definitions.
 *
 *  HOW TO USE
 *  ----------
 *  Import this object into any module that needs a business rule:
 *
 *    import { BUSINESS_RULES } from '../config/businessRules';
 *
 *  To change a rule across the ENTIRE application, edit only this
 *  file — every consumer will automatically pick up the new value.
 *
 *  WHAT BELONGS HERE
 *  -----------------
 *  ✅ GST rates and split logic
 *  ✅ Subsidy slabs and thresholds
 *  ✅ Solar generation factors
 *  ✅ Payment term percentages
 *  ✅ Franchise commission rates
 *  ✅ Invoice defaults
 *  ✅ Product/inventory thresholds
 *
 *  WHAT DOES NOT BELONG HERE
 *  -------------------------
 *  ❌ Product/customer/transaction data (lives in DB)
 *  ❌ UI component logic
 *  ❌ API/authentication logic
 *  ❌ Database queries
 *
 * ═══════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface GstRules {
    /** Default GST rate applied to new line items when no product rate is known */
    defaultRate: number;
    /** All valid GST rate options shown in dropdowns */
    availableRates: number[];
    /**
     * MNRE Solar Split GST — Government mandate splits solar projects into
     * two components: 70% taxed at 5% (solar panels) and 30% at 18% (services).
     * Effective blended rate ≈ 8.9%.
     */
    mnreSplitRatios: { low: number; high: number };
    mnreSplitRates:  { low: number; high: number };
    /** HSN-based fallback rates for display on invoice tax tables */
    hsnPanelFallbackRate: number;   // HSN 8541 — Solar panels
    hsnOtherFallbackRate: number;   // All other HSN codes
    hsnPanelCode: string;           // The HSN code treated as "panel"
}

export interface SubsidyRules {
    /**
     * MNRE PM-Surya Ghar Subsidy (Residential/Domestic)
     * Slab 1: Up to 2 kW  → ₹30,000 per kW
     * Slab 2: 2–3 kW      → ₹60,000 base + ₹18,000 per extra kW above 2
     * Cap:    ≥ 3 kW      → ₹78,000 (maximum, irrespective of system size)
     *
     * Note: Subsidy applies to RESIDENTIAL installations only.
     * Commercial/Industrial projects are not eligible.
     */
    ratePerKwUpTo2Kw: number;      // ₹30,000 per kW for first 2 kW
    base2KwAmount: number;         // ₹60,000 fixed for exactly 2 kW systems
    extraPerKwAbove2Kw: number;    // ₹18,000 per kW for capacity 2–3 kW
    cap: number;                   // ₹78,000 absolute maximum subsidy
}

export interface SolarRules {
    /**
     * Average solar generation per kW of system capacity per day.
     * Based on Tamil Nadu average peak sun hours.
     * Industry standard: 3.5–5.5 units/kW/day; TheVoltaura uses 5.0.
     */
    generationFactorPerKwPerDay: number;
    /** Days used for annual generation estimate (standard calendar year) */
    daysPerYear: number;
}

export interface PaymentTermRules {
    /**
     * Standard payment schedule for solar projects (as fractions of grand total).
     * Must sum to 1.0 (100%).
     */
    advance: number;       // 10% — On confirmed purchase order
    delivery: number;      // 70% — On material delivery/procurement
    installation: number;  // 10% — Before dispatch / on installation
    commissioning: number; // 10% — After successful commissioning
}

export interface FranchiseRules {
    /**
     * Lead Payment: Fixed amount paid to franchise per registered lead
     * (customer with status = 'Lead') regardless of conversion.
     */
    leadPaymentPerLead: number;
    /**
     * Client Commission: Paid per kW of system size once a lead converts
     * to a client (customer with confirmed quotation >= minKwForCommission).
     * Applied on Math.floor(totalKw) to prevent partial-kW over-payments.
     */
    commissionPerKw: number;
    /** Minimum system size in kW required before commission is earned */
    minKwForCommission: number;
}

export interface InvoiceRules {
    /** Default number of days from invoice date before payment is due */
    defaultDueDays: number;
}

export interface ProductRules {
    /** Stock quantity below this threshold triggers a "Low Stock" alert */
    lowStockThreshold: number;
}

export interface BusinessRules {
    GST: GstRules;
    SUBSIDY: SubsidyRules;
    SOLAR: SolarRules;
    PAYMENT_TERMS: PaymentTermRules;
    FRANCHISE: FranchiseRules;
    INVOICE: InvoiceRules;
    PRODUCTS: ProductRules;
}

// ─────────────────────────────────────────────────────────────────────────────
// THE RULES — EDIT THESE VALUES TO CHANGE BEHAVIOR APPLICATION-WIDE
// ─────────────────────────────────────────────────────────────────────────────

export const BUSINESS_RULES: BusinessRules = {

    // ── GST ──────────────────────────────────────────────────────────────────
    GST: {
        defaultRate:    18,
        availableRates: [0, 5, 12, 18, 28],

        // MNRE Split GST — 70% at 5% + 30% at 18% → effective ≈ 8.9%
        mnreSplitRatios: { low: 0.70, high: 0.30 },
        mnreSplitRates:  { low: 0.05, high: 0.18 },

        // HSN fallback rates for invoice tax table display
        hsnPanelFallbackRate: 5,
        hsnOtherFallbackRate: 18,
        hsnPanelCode:         '8541',
    },

    // ── MNRE SUBSIDY ─────────────────────────────────────────────────────────
    SUBSIDY: {
        ratePerKwUpTo2Kw:   30000,   // ₹30,000/kW for <= 2 kW systems
        base2KwAmount:      60000,   // ₹60,000 fixed for exactly 2 kW
        extraPerKwAbove2Kw: 18000,   // ₹18,000/kW for the 2–3 kW range
        cap:                78000,   // ₹78,000 maximum — never exceeded
    },

    // ── SOLAR GENERATION ─────────────────────────────────────────────────────
    SOLAR: {
        generationFactorPerKwPerDay: 5.0,   // units (kWh) per kW per day
        daysPerYear:                 365,    // days used for annual estimate
    },

    // ── PAYMENT TERMS ────────────────────────────────────────────────────────
    PAYMENT_TERMS: {
        advance:       0.10,   // 10% — Advance on Purchase Order confirmation
        delivery:      0.70,   // 70% — On material procurement / delivery
        installation:  0.10,   // 10% — Before dispatch / during installation
        commissioning: 0.10,   // 10% — After successful commissioning
    },

    // ── FRANCHISE COMMISSION ─────────────────────────────────────────────────
    FRANCHISE: {
        leadPaymentPerLead:  200,    // Rs.200 per registered lead
        commissionPerKw:    2000,    // Rs.2,000 per kW (on floor of total kW)
        minKwForCommission:    1,    // must have >= 1 kW to earn commission
    },

    // ── INVOICE DEFAULTS ─────────────────────────────────────────────────────
    INVOICE: {
        defaultDueDays: 30,          // 30 days payment terms by default
    },

    // ── PRODUCT / INVENTORY ──────────────────────────────────────────────────
    PRODUCTS: {
        lowStockThreshold: 10,       // alert when stock < 10 units
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE CALCULATION FUNCTIONS
// Centralized here so every part of the application uses the same formula.
// Import these functions instead of re-implementing calculations inline.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates MNRE PM-Surya Ghar subsidy for a residential solar system.
 *
 * Slabs (as per current government rates):
 *   - <= 2 kW : Rs.30,000 per kW
 *   - 2–3 kW  : Rs.60,000 base + Rs.18,000 per kW above 2 kW
 *   - >= 3 kW : Rs.78,000 (fixed maximum)
 *
 * @param systemSizeKw - Total system capacity in kilowatts
 * @returns Subsidy amount in INR
 */
export function calculateSubsidy(systemSizeKw: number): number {
    const { ratePerKwUpTo2Kw, base2KwAmount, extraPerKwAbove2Kw, cap } = BUSINESS_RULES.SUBSIDY;
    if (systemSizeKw <= 0) return 0;
    if (systemSizeKw >= 3) return cap;
    if (systemSizeKw >= 2) {
        if (systemSizeKw === 2) return base2KwAmount;
        return Math.min(cap, base2KwAmount + (systemSizeKw - 2) * extraPerKwAbove2Kw);
    }
    return systemSizeKw * ratePerKwUpTo2Kw;
}

/**
 * Calculates estimated solar generation for a given system size.
 *
 * @param systemSizeKw - Total system capacity in kilowatts
 * @returns Object with dailyGeneration (kWh/day) and annualGeneration (kWh/year)
 */
export function calculateSolarGeneration(systemSizeKw: number): {
    dailyGeneration: number;
    annualGeneration: number;
} {
    const { generationFactorPerKwPerDay, daysPerYear } = BUSINESS_RULES.SOLAR;
    const dailyGeneration = Number((systemSizeKw * generationFactorPerKwPerDay).toFixed(2));
    const annualGeneration = Math.round(dailyGeneration * daysPerYear);
    return { dailyGeneration, annualGeneration };
}

/**
 * Calculates MNRE split GST amounts for a given taxable base.
 * Splits the taxable amount into 70% @ 5% and 30% @ 18%.
 * Effective blended rate ≈ 8.9%.
 *
 * @param taxableAmount - Pre-GST amount to apply split GST to
 * @returns GST breakdown with cgst5, sgst5, cgst18, sgst18, and totalGst
 */
export function calculateMnreSplitGst(taxableAmount: number): {
    cgst5: number;
    sgst5: number;
    cgst18: number;
    sgst18: number;
    totalGst: number;
} {
    const { mnreSplitRatios, mnreSplitRates } = BUSINESS_RULES.GST;
    const part5  = taxableAmount * mnreSplitRatios.low;
    const part18 = taxableAmount * mnreSplitRatios.high;
    const tax5   = part5  * mnreSplitRates.low;
    const tax18  = part18 * mnreSplitRates.high;
    const totalGst = tax5 + tax18;
    return {
        cgst5:  tax5  / 2,
        sgst5:  tax5  / 2,
        cgst18: tax18 / 2,
        sgst18: tax18 / 2,
        totalGst,
    };
}

/**
 * Calculates franchise commission earnings for a branch.
 *
 * - Lead Payment: Fixed amount per customer with status = 'Lead'
 * - Client Commission: commissionPerKw per kW (floor) for clients with >= minKwForCommission kW
 *
 * @param customers - Array of customer records
 * @param quotations - Array of quotation records
 * @returns Breakdown: leadCount, leadPayment, clientCount, clientComm, totalEarnings
 */
export function calculateFranchiseCommission(
    customers: any[],
    quotations: any[]
): {
    leadCount: number;
    leadPayment: number;
    clientCount: number;
    clientComm: number;
    totalEarnings: number;
} {
    const { leadPaymentPerLead, commissionPerKw, minKwForCommission } = BUSINESS_RULES.FRANCHISE;

    const leadCount   = customers.filter((c: any) => c.status === 'Lead').length;
    const leadPayment = leadCount * leadPaymentPerLead;

    let clientCount = 0;
    let clientComm  = 0;
    const clients = customers.filter((c: any) => c.status !== 'Lead');

    clients.forEach((client: any) => {
        clientCount++;
        const clientQuotes = quotations.filter((q: any) =>
            q.customer_id  === client.id ||
            q.customerId   === client.id ||
            q.customerCode === client.customerCode ||
            (q.customer && q.customer.id === client.id)
        );
        let totalKw = 0;
        if (clientQuotes.length > 0) {
            totalKw = clientQuotes.reduce(
                (sum: number, q: any) =>
                    sum + (parseFloat(q.systemSizeKw) || parseFloat(q.system_size_kw) || 0),
                0
            );
        }
        if (totalKw >= minKwForCommission) {
            clientComm += Math.floor(totalKw) * commissionPerKw;
        }
    });

    return {
        leadCount,
        leadPayment,
        clientCount,
        clientComm,
        totalEarnings: leadPayment + clientComm,
    };
}

/**
 * Generates the standard payment terms breakdown amounts from a grand total.
 * Uses PAYMENT_TERMS percentages as the single source of truth.
 *
 * @param grandTotal - The final invoice/quotation total (post-GST, post-roundoff)
 * @returns Object with rupee amounts for advance, delivery, installation, commissioning
 */
export function calculatePaymentTermsBreakdown(grandTotal: number): {
    advance: number;
    delivery: number;
    installation: number;
    commissioning: number;
} {
    if (grandTotal <= 0) {
        return { advance: 0, delivery: 0, installation: 0, commissioning: 0 };
    }
    const t = BUSINESS_RULES.PAYMENT_TERMS;
    const advance       = Math.round(grandTotal * t.advance);
    const delivery      = Math.round(grandTotal * t.delivery);
    const installation  = Math.round(grandTotal * t.installation);
    // Remainder ensures amounts always sum to exactly grandTotal
    const commissioning = grandTotal - advance - delivery - installation;
    return { advance, delivery, installation, commissioning };
}

/**
 * Generates a human-readable payment terms string (used in quotation documents).
 *
 * @param grandTotal - The final total amount
 * @returns Multi-line string with labelled amount breakdown
 */
export function generatePaymentTermsText(grandTotal: number): string {
    if (grandTotal <= 0) return '';
    const { advance, delivery, installation, commissioning } = calculatePaymentTermsBreakdown(grandTotal);
    const t = BUSINESS_RULES.PAYMENT_TERMS;
    return (
        `${t.advance * 100}% Advance: Rs.${advance.toLocaleString('en-IN')}\n` +
        `${t.delivery * 100}% Upon Material Delivery: Rs.${delivery.toLocaleString('en-IN')}\n` +
        `${t.installation * 100}% Upon Installation: Rs.${installation.toLocaleString('en-IN')}\n` +
        `${t.commissioning * 100}% Upon Commissioning: Rs.${commissioning.toLocaleString('en-IN')}`
    );
}
