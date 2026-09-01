import { numberToWords } from './api';
import {
    BUSINESS_RULES,
    calculateSubsidy,
    calculateSolarGeneration,
    calculateMnreSplitGst,
    generatePaymentTermsText,
} from '../config/businessRules';

export interface LineItem {
    id?: string;
    productId: string;
    productName: string;
    qty: number;
    price: number;
    gstRate: number;
    hsnCode?: string;
    description?: string;
    technicalSpecification?: string;
    unit?: string;
    category?: string;
}

export interface CalculationResult {
    systemSizeKw: number;
    dailyGeneration: number;
    annualGeneration: number;
    subsidyAmount: number;
    subtotal: number;
    taxableAmount: number;
    totalGst: number;
    gstBreakdown: {
        cgst5: number;
        sgst5: number;
        cgst18: number;
        sgst18: number;
    };
    grandTotal: number;
    roundOffAmount: number;
    netCustomerCost: number;
    amountInWords: string;
    paymentTermsText: string;
}

export class SolarCalculationEngine {

    /**
     * Extracts wattage from product name and computes total System Size in kW.
     * Example: "Solar Panel 550Wp" x 6 -> 3.30 kW
     */
    static calculateSystemSize(items: LineItem[]): number {
        let totalWatts = 0;

        for (const item of items) {
            const searchStr = `${item.productName || ''} ${item.description || ''}`.toLowerCase();

            const isPanel = searchStr.includes('panel') || searchStr.includes('module') || searchStr.includes('pv');

            // Try to extract wattage e.g., 550W, 540Wp, 550 W
            let match = searchStr.match(/(\d+)\s*(w|wp|watt|watts)\b/i);

            if (!match && isPanel) {
                // Try to find a 3-digit or 4-digit number that likely represents wattage (e.g. PANEL 550)
                match = searchStr.match(/\b(\d{3,4})\b/);
            }

            if (isPanel && match) {
                const watts = parseInt(match[1], 10);
                if (!isNaN(watts)) {
                    totalWatts += (watts * (Number(item.qty) || 0));
                }
            }
        }

        return Number((totalWatts / 1000).toFixed(2));
    }

    /**
     * Daily generation based on the centralized generation factor
     * (BUSINESS_RULES.SOLAR.generationFactorPerKwPerDay units per kW).
     */
    static calculateDailyGeneration(systemSizeKw: number): number {
        return Number((systemSizeKw * BUSINESS_RULES.SOLAR.generationFactorPerKwPerDay).toFixed(2));
    }

    /**
     * Annual generation based on daily generation * BUSINESS_RULES.SOLAR.daysPerYear.
     */
    static calculateAnnualGeneration(dailyGeneration: number): number {
        return Math.round(dailyGeneration * BUSINESS_RULES.SOLAR.daysPerYear);
    }

    /**
     * Tiered MNRE Subsidy Calculation — delegates to the centralized
     * calculateSubsidy() function from businessRules.ts.
     */
    static calculateSubsidy(systemSizeKw: number): number {
        return calculateSubsidy(systemSizeKw);
    }

    /**
     * Full business calculation logic for a document (Quotation/Invoice).
     */
    static calculateDocument(
        items: LineItem[],
        discount: number = 0,
        splitGst: boolean = true,
        roundOff: boolean = true
    ): CalculationResult {

        const systemSizeKw = this.calculateSystemSize(items);
        const { dailyGeneration, annualGeneration } = calculateSolarGeneration(systemSizeKw);
        const subsidyAmount = calculateSubsidy(systemSizeKw);

        let subtotal = 0;
        let totalGst = 0;
        const gstBreakdown = { cgst5: 0, sgst5: 0, cgst18: 0, sgst18: 0 };

        // Subtotal (Sum of Qty * Price)
        for (const item of items) {
            subtotal += (item.qty * item.price);
        }

        const taxableAmount = Math.max(0, subtotal - discount);

        if (splitGst) {
            // MNRE Split GST — rates sourced from BUSINESS_RULES.GST
            const result = calculateMnreSplitGst(taxableAmount);
            totalGst = result.totalGst;
            gstBreakdown.cgst5  = result.cgst5;
            gstBreakdown.sgst5  = result.sgst5;
            gstBreakdown.cgst18 = result.cgst18;
            gstBreakdown.sgst18 = result.sgst18;
        } else {
            // Standard GST logic (per item gstRate)
            // Since discount applies to the total, distribute GST proportionally.
            for (const item of items) {
                const itemTotal = item.qty * item.price;
                const ratio = subtotal > 0 ? (itemTotal / subtotal) : 0;
                const itemTaxable = taxableAmount * ratio;
                totalGst += itemTaxable * (item.gstRate / 100);
            }
        }

        let grandTotal = taxableAmount + totalGst;
        let roundOffAmount = 0;

        if (roundOff) {
            const rounded = Math.round(grandTotal);
            roundOffAmount = rounded - grandTotal;
            grandTotal = rounded;
        }

        const netCustomerCost = grandTotal - subsidyAmount;

        const amountInWords = numberToWords(grandTotal);

        return {
            systemSizeKw,
            dailyGeneration,
            annualGeneration,
            subsidyAmount,
            subtotal,
            taxableAmount,
            totalGst,
            gstBreakdown,
            grandTotal,
            roundOffAmount,
            netCustomerCost,
            amountInWords,
            paymentTermsText: this.generatePaymentTerms(grandTotal),
        };
    }

    /**
     * Generate standard payment terms breakdown.
     * Delegates to the centralized generatePaymentTermsText() from businessRules.ts.
     * Percentages are sourced from BUSINESS_RULES.PAYMENT_TERMS.
     */
    static generatePaymentTerms(grandTotal: number): string {
        return generatePaymentTermsText(grandTotal);
    }
}
