import React from 'react';
import { statusTag } from '../services/api';

interface ERPDocumentHeaderProps {
    title: string;
    status: string;
    approvalStatus?: string;
    backLabel: string;
    onBack: () => void;
    children?: React.ReactNode; // Action buttons
}

export default function ERPDocumentHeader({ title, status, approvalStatus, backLabel, onBack, children }: ERPDocumentHeaderProps) {
    return (
        <div 
            className="no-print" 
            style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '12px 28px', 
                background: '#fff', 
                borderBottom: '1px solid #e5e7eb',
                flexWrap: 'wrap',
                gap: '12px',
                width: '100%',
                boxSizing: 'border-box'
            }}
        >
            {/* LEFT SECTION: Back Button + Title + Status Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', minWidth: 0 }}>
                <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={onBack}
                    style={{ whiteSpace: 'nowrap' }}
                >
                    {backLabel}
                </button>
                <strong style={{ fontSize: '18px', fontWeight: 700, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {title}
                </strong>
                <span 
                    style={{ display: 'inline-flex', alignItems: 'center' }}
                    dangerouslySetInnerHTML={{ __html: statusTag(status) }} 
                />
                {approvalStatus && (
                    <span 
                        style={{ display: 'inline-flex', alignItems: 'center' }}
                        dangerouslySetInnerHTML={{ __html: statusTag(approvalStatus) }} 
                    />
                )}
            </div>

            {/* CENTER SECTION: Empty for spacing */}
            <div style={{ flex: '1 1 0%', minWidth: '0px' }} className="header-spacer-center" />

            {/* RIGHT SECTION: Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                {children}
            </div>
        </div>
    );
}
