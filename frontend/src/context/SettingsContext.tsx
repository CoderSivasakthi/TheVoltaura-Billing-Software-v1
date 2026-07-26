import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

export interface Branch {
    id: string;
    name: string;
    gst: string;
    address: string;
    code: string;
}

export interface HsnCode {
    id: string;
    category: string;
    code: string;
}

export interface TaxRate {
    id: string;
    label: string;
    rate: number;
}

export interface QuotationImages {
    companyLogo?: string;
    companySeal?: string;
    directorSignature?: string;
    solarGenerationImage?: string;
    onGridDiagram?: string;
    hybridDiagram?: string;
    offGridDiagram?: string;
    brandsWeUseImage?: string;
}

export interface QuotationContent {
    page1: {
        subject: string;
        intro: string;
        proposalLetter: string;
        documentsIncluded: string;
        thankYouMessage: string;
        bankDetails: string;
        paymentTerms: string;
    };
    page2: {
        whyChooseUs: string;
        solarPowerExplanation: string;
        howItWorks: string;
        panelDescription: string;
        inverterDescription: string;
        mechanicalInfrastructure: string;
        companyPromise: string;
    };
    page3: {
        solarGenerationHeading: string;
        subsidyNote: string;
        brandsIntroText: string;
    };
    page4: {
        techSpecHeading: string;
        amountInWordsLabel?: string;
    };
    page5: {
        termsAndConditions: string;
        taxes: string;
        paymentTerms: string;
        warranty: string;
        delivery: string;
        exclusions: string;
        validity: string;
        closingMessage: string;
    };
}

export interface QuotationSettings {
    images: QuotationImages;
    content: QuotationContent;
}

export interface SystemSettings {
    orgName: string;
    email: string;
    phone: string;
    invPrefix: string;
    quotPrefix: string;
    gstRate: string;
    logo: string;
    tagline?: string;
    website?: string;
    branches: Branch[];
    hsnCodes: HsnCode[];
    taxRates: TaxRate[];
    lowStock: boolean;
    overdueAlert: boolean;
    amcAlert: boolean;
    quotation?: QuotationSettings;
    invoiceConfig?: any;
    invoicePrefix?: string;
    invoiceCounter?: number;
    invoicePadding?: number;
    quotationPrefix?: string;
    quotationCounter?: number;
    quotationPadding?: number;
}

interface SettingsContextType {
    settings: SystemSettings | null;
    loading: boolean;
    updateSettings: (newSettings: SystemSettings) => Promise<void>;
}

const defaultSettings: SystemSettings = {
    orgName: 'TheVoltaura Private ltd',
    email: 'contact@thevoltaura.com',
    phone: '+91 90255 96481',
    invPrefix: '',
    quotPrefix: '',
    gstRate: '18',
    logo: '',
    tagline: 'Powering Buildings. Empowering Futures.',
    website: 'www.thevoltaura.com',
    invoicePrefix: '',
    invoiceCounter: 1,
    invoicePadding: 4,
    quotationPrefix: '',
    quotationCounter: 1,
    quotationPadding: 4,
    branches: [
        { id: '1', name: 'HO (Chennai)', gst: '33AAAA0000A1Z5', address: '12 1st Cross St, Industrial Estate, Chennai - 600032', code: 'HO' }
    ],
    hsnCodes: [
        { id: '1', category: 'Solar photovoltaic panels', code: '8541' },
        { id: '2', category: 'Solar inverters', code: '8504' },
        { id: '3', category: 'Mounting structures', code: '7308' },
        { id: '4', category: 'Solar lighting systems', code: '8539' },
        { id: '5', category: 'Solar water pumps', code: '8501' },
        { id: '6', category: 'Solar water heaters', code: '8419' },
    ],
    taxRates: [
        { id: '1', label: 'Standard GST', rate: 18 },
        { id: '2', label: 'Reduced GST (Solar Goods)', rate: 5 },
        { id: '3', label: 'Zero GST (Exempt)', rate: 0 },
    ],
    lowStock: true,
    overdueAlert: true,
    amcAlert: true,
    quotation: {
        images: {
            companyLogo: '',
            companySeal: '',
            directorSignature: '',
            solarGenerationImage: '',
            onGridDiagram: '',
            hybridDiagram: '',
            offGridDiagram: '',
            brandsWeUseImage: ''
        },
        content: {
            page1: {
                subject: 'Proposal for Residential Grid Tie Solar Power Plant – Budgetary Quotation',
                intro: 'Dear Sir,',
                proposalLetter: 'With reference to the discussion regarding your requirement of a Grid Tie Solar Power Plant, we at TheVoltAura Private Limited are pleased to submit our techno-commercial offer for the same.\n\nWe supply solar power systems as per specifications laid down by TEDA and MNRE, Government of India. The following documents are enclosed with this proposal:',
                documentsIncluded: '1. Technical Specifications\n2. Price Schedule (Budgetary Quotation)\n3. Terms and Conditions',
                thankYouMessage: 'We look forward to your valued order.\n\nThanking you,',
                bankDetails: 'Account Name : THEVOLTAURA PRIVATE LIMITED\nAccount No : 23180200000411\nIFSC CODE : IOBA0002318\nBank Name : INDIAN OVERSEAS BANK',
                paymentTerms: '• 10% Advance against confirmed Purchase Order\n• 70% Procurement Of Raw Material\n• 10% Before Dispatch / Installation\n• 10% After Successful Installation & Commissioning'
            },
            page2: {
                whyChooseUs: '– Transform your space into a Smart Green Campus\n– Achieve significant electricity cost savings with clean energy\n– Experience a future-ready renewable ecosystem for learning and sustainability\n– Contribute to a greener planet and responsible energy usage',
                solarPowerExplanation: 'At TheVoltaura, we design high-performance solar PV systems that deliver reliable, cost-efficient power directly at the point of use. Our systems are ideal for residential rooftops, commercial buildings, institutions and campuses, and remote locations with limited grid access. While the sun provides free energy, our optimized system design ensures faster ROI and long-term savings.',
                howItWorks: 'Solar panels generate electricity during daylight hours, which is supplied directly to your building through the AC Distribution System. The grid-tied inverter operates seamlessly alongside EB supply. A 1 kW system generates approximately 4.5 units per day under Tamil Nadu conditions. Solar power is first consumed by your load, with any excess automatically exported to the grid. Under Tamil Nadu’s Net Metering Policy, surplus energy earns credits, maximising savings over the system’s 25-year lifespan.',
                panelDescription: '– Advanced crystalline silicon technology\n– High-output 610 Wp or 550Wp panels\n– Durable aluminium frame for long-term outdoor performance\n– Service-friendly junction box design\n– Optimized for grid-connected high-voltage systems',
                inverterDescription: 'Our intelligent inverter system ensures real-time synchronization with the EB grid, controlled and efficient power injection, smart regulation of voltage and output power, and seamless switching between solar and grid usage. This ensures maximum utilization of solar energy with zero disruption.',
                mechanicalInfrastructure: '– Premium corrosion-resistant mounting structures for long life\n– Engineered rooftop installation for safety and durability\n– High-quality DC & AC cabling systems\n– Complete integration with protection systems (ACDB/DCDB)',
                companyPromise: 'We don’t just install solar. We build intelligent energy systems that deliver lower electricity bills, reliable power supply, and a sustainable future.'
            },
            page3: {
                solarGenerationHeading: 'Solar Generation Short View',
                subsidyNote: '★ The MNRE Central Financial Assistance (CFA) subsidy of ₹78,000/- will be released directly to the consumer\'s bank account within 30 days from submission of the installation report after net meter installation.',
                brandsIntroText: 'We use only branded, genuine components across every installation, including but not limited to'
            },
            page4: {
                techSpecHeading: 'TECHNICAL SPECIFICATIONS',
                amountInWordsLabel: 'Amount in words:'
            },
            page5: {
                termsAndConditions: 'TERMS AND CONDITIONS',
                taxes: 'GST applicable as per Government norms (effective rate 8.9%).',
                paymentTerms: 'Option 1:\n• 100% Advance along with confirmed Purchase Order\n\nOR\n\nOption 2:\n• 10% Advance against confirmed Purchase Order\n• 70% Procurement Of Raw Material\n• 10% Before Dispatch / Installation\n• 10% After Successful Installation & Commissioning',
                warranty: '• 5 Years Warranty on the Inverter\n• Solar PV Modules Performance Warranty:\n  – Minimum 90% output capacity up to 10 years\n  – Minimum 80% output capacity up to 25 years\n• 1 Year Comprehensive On-Site Warranty on all installed system components against manufacturing defects and installation-related issues',
                delivery: 'Equipment will be ready for delivery and installation within 4–7 days from receipt of advance payment.',
                exclusions: '– Ladder and hand rails\n– TNEB fee for bidirectional / net meter\n– Safety certificate for systems above 10 kW',
                validity: 'This quotation is valid for a period of seven (7) days from the date of issue. All quotations, invoices, and related transactions shall be governed by the applicable Terms and Conditions of the company.',
                closingMessage: 'Thanking you,'
            }
        }
    }
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchSettings = async () => {
        try {
            const data = await api('GET', '/api/settings');
            if (data && data.global_settings && Object.keys(data.global_settings).length > 0) {
                setSettings({ ...defaultSettings, ...data.global_settings });
            } else {
                const lsSettings = localStorage.getItem('erp_settings');
                if (lsSettings) {
                    try {
                        const parsed = JSON.parse(lsSettings);
                        const migratedSettings = { ...defaultSettings, ...parsed };
                        await api('PUT', '/api/settings', migratedSettings);
                        setSettings(migratedSettings);
                    } catch (e) {
                        setSettings(defaultSettings);
                    }
                } else {
                    setSettings(defaultSettings);
                }
            }
        } catch (e) {
            console.error('Failed to load settings from API, using defaults/localStorage', e);
            try {
                const lsSettings = localStorage.getItem('erp_settings');
                if (lsSettings) {
                    setSettings({ ...defaultSettings, ...JSON.parse(lsSettings) });
                } else {
                    setSettings(defaultSettings);
                }
            } catch {
                setSettings(defaultSettings);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const updateSettings = async (newSettings: SystemSettings) => {
        setSettings(newSettings);
        localStorage.setItem('erp_settings', JSON.stringify(newSettings));
        try {
            await api('PUT', '/api/settings', newSettings);
            window.dispatchEvent(new Event('storage'));
        } catch (e) {
            console.error('Failed to save settings to API', e);
            throw e;
        }
    };

    return (
        <SettingsContext.Provider value={{ settings, loading, updateSettings }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
