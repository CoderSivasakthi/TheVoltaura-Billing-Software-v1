import { numberToWords } from './api';

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
     * Daily generation based on average (5.0 units per kW).
     */
    static calculateDailyGeneration(systemSizeKw: number): number {
        return Number((systemSizeKw * 5.0).toFixed(2));
    }

    /**
     * Annual generation based on daily generation (365 days).
     */
    static calculateAnnualGeneration(dailyGeneration: number): number {
        return Math.round(dailyGeneration * 365);
    }

    /**
     * Tiered MNRE Subsidy Calculation
     * 1 kW = 30k
     * 2 kW = 60k
     * >= 3 kW = 78k (Max)
     */
    static calculateSubsidy(systemSizeKw: number): number {
        if (systemSizeKw <= 0) return 0;
        if (systemSizeKw >= 3) return 78000;
        
        if (systemSizeKw >= 2) {
            if (systemSizeKw === 2) return 60000;
            // E.g. 2.5 kW -> 60000 + (0.5 * 18000) = 69000
            return Math.min(78000, 60000 + (systemSizeKw - 2) * 18000);
        } else {
            return systemSizeKw * 30000;
        }
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
        const dailyGeneration = this.calculateDailyGeneration(systemSizeKw);
        const annualGeneration = this.calculateAnnualGeneration(dailyGeneration);
        const subsidyAmount = this.calculateSubsidy(systemSizeKw);

        let subtotal = 0;
        let totalGst = 0;
        const gstBreakdown = { cgst5: 0, sgst5: 0, cgst18: 0, sgst18: 0 };

        // Subtotal (Sum of Qty * Price)
        for (const item of items) {
            subtotal += (item.qty * item.price);
        }

        const taxableAmount = Math.max(0, subtotal - discount);

        if (splitGst) {
            // MNRE Split GST logic: 70% @ 5%, 30% @ 18%
            const part5 = taxableAmount * 0.70;
            const part18 = taxableAmount * 0.30;
            
            const tax5 = part5 * 0.05;
            const tax18 = part18 * 0.18;
            
            totalGst = tax5 + tax18; // Effective 8.9%
            
            gstBreakdown.cgst5 = tax5 / 2;
            gstBreakdown.sgst5 = tax5 / 2;
            gstBreakdown.cgst18 = tax18 / 2;
            gstBreakdown.sgst18 = tax18 / 2;
        } else {
            // Standard GST logic (per item)
            // Note: Since discount applies to the total, we must distribute standard GST proportionally if there is a discount.
            // For simplicity, we assume Standard GST applies the item's individual gstRate.
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
            paymentTermsText: this.generatePaymentTerms(grandTotal)
        };
    }

    /**
     * Generate standard payment terms breakdown.
     */
    static generatePaymentTerms(grandTotal: number): string {
        if (grandTotal <= 0) return '';
        
        const advance = Math.round(grandTotal * 0.10);
        const delivery = Math.round(grandTotal * 0.70);
        const installation = Math.round(grandTotal * 0.10);
        const commissioning = grandTotal - advance - delivery - installation; // Ensure it adds up perfectly

        return `10% Advance: ₹${advance.toLocaleString('en-IN')}\n` +
               `70% Upon Material Delivery: ₹${delivery.toLocaleString('en-IN')}\n` +
               `10% Upon Installation: ₹${installation.toLocaleString('en-IN')}\n` +
               `10% Upon Commissioning: ₹${commissioning.toLocaleString('en-IN')}`;
    }
}
