import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, toast } from '../services/api';
import { ArrowLeft, CheckCircle } from 'lucide-react';

export default function ViewOrder() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Overview');

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                const data = await api('GET', `/api/orders/${id}`);
                setOrder(data);
            } catch (e: any) {
                toast(e.message || 'Error fetching order', 'error');
                navigate('/priority-orders');
            } finally {
                setLoading(false);
            }
        };
        fetchOrder();
    }, [id, navigate]);

    if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading order details...</div>;
    if (!order) return <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>Order not found.</div>;

    const inr = (n: any) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(n) || 0);

    const tabs = [
        'Overview', 'Customer Details', 'Quotation', 'Payment History', 
        'Documents', 'Material Tracking', 'Installation', 'Engineer Notes', 'Invoice'
    ];

    type TimelineStatus = 'completed' | 'active' | 'pending';
    const timelineStages: { label: string, status: TimelineStatus }[] = [
        { label: 'Quotation', status: 'completed' },
        { label: 'Advance Received', status: 'completed' },
        { label: 'Confirmed Order', status: 'completed' },
        { label: 'Material Ordered', status: order.currentStage === 'Material Procurement' ? 'active' : 'pending' },
        { label: 'Material Delivered', status: 'pending' },
        { label: 'Installation Scheduled', status: order.currentStage === 'Installation Scheduled' ? 'active' : 'pending' },
        { label: 'Installation Completed', status: order.currentStage === 'Installation In Progress' ? 'active' : 'pending' },
        { label: 'Net Meter Applied', status: 'pending' },
        { label: 'Commissioned', status: order.currentStage === 'Commissioned' || order.currentStage === 'Completed' ? 'completed' : 'pending' }
    ];

    // Helper to determine logic of timeline based on currentStage string matching 
    let passed = true;
    const computedTimeline = timelineStages.map(ts => {
        if (ts.status === 'active') passed = false;
        if (ts.status === 'completed') return ts;
        if (ts.status === 'pending') {
            if (passed && (order.currentStage === 'Completed' || order.currentStage === 'Commissioned')) return { ...ts, status: 'completed' };
            const fallbackStatus: TimelineStatus = passed ? 'completed' : 'pending';
            return { ...ts, status: fallbackStatus };
        }
        return ts;
    });

    return (
        <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '24px', boxSizing: 'border-box', fontFamily: "'Inter', sans-serif" }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button 
                        onClick={() => navigate('/priority-orders')}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', border: '1px solid #cbd5e1', backgroundColor: '#fff', borderRadius: '8px', cursor: 'pointer', color: '#475569' }}
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {order.id}
                            <span style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '16px', fontWeight: 600 }}>{order.priorityLevel || 'Normal'} Priority</span>
                        </h2>
                        <div style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>
                            Customer: <strong>{order.customerName}</strong> &nbsp;|&nbsp; Quotation: <a href={`#/quotations/${order.quotationId}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{order.quotationNumber}</a>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button style={{ padding: '8px 16px', border: '1px solid #cbd5e1', backgroundColor: '#fff', borderRadius: '6px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', color: '#334155' }}>
                        Generate Work Order
                    </button>
                    <button style={{ padding: '8px 16px', border: 'none', backgroundColor: '#2563eb', color: '#fff', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                        Schedule Installation
                    </button>
                </div>
            </div>

            {/* Visual Timeline */}
            <div style={{ backgroundColor: '#fff', padding: '32px 24px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px', overflowX: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', minWidth: '900px' }}>
                    <div style={{ position: 'absolute', top: '15px', left: '40px', right: '40px', height: '2px', backgroundColor: '#e2e8f0', zIndex: 1 }} />
                    
                    {computedTimeline.map((stage, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, width: '100px', textAlign: 'center' }}>
                            <div style={{ 
                                width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                backgroundColor: stage.status === 'completed' ? '#16a34a' : (stage.status === 'active' ? '#2563eb' : '#f1f5f9'),
                                color: stage.status === 'completed' ? '#fff' : (stage.status === 'active' ? '#fff' : '#94a3b8'),
                                border: stage.status === 'pending' ? '2px solid #cbd5e1' : 'none',
                                marginBottom: '8px',
                                boxShadow: stage.status === 'active' ? '0 0 0 4px #dbeafe' : 'none'
                            }}>
                                {stage.status === 'completed' ? <CheckCircle size={18} /> : (i + 1)}
                            </div>
                            <span style={{ fontSize: '11px', fontWeight: stage.status === 'active' ? 700 : 500, color: stage.status === 'active' ? '#0f172a' : '#64748b' }}>
                                {stage.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tabs Navigation */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '24px', overflowX: 'auto' }}>
                {tabs.map(tab => (
                    <button 
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{ 
                            padding: '12px 20px', 
                            background: 'none', 
                            border: 'none', 
                            borderBottom: activeTab === tab ? '2px solid #2563eb' : '2px solid transparent',
                            color: activeTab === tab ? '#2563eb' : '#64748b',
                            fontWeight: activeTab === tab ? 600 : 500,
                            fontSize: '14px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s'
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Tab Content Panes */}
            <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', minHeight: '400px' }}>
                {activeTab === 'Overview' && (
                    <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                        <div>
                            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>Project Summary</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '12px 0', fontSize: '14px' }}>
                                <span style={{ color: '#64748b' }}>Project Size:</span> <span style={{ fontWeight: 500 }}>{order.projectSize || 'N/A'} {order.projectSize ? 'kW' : ''}</span>
                                <span style={{ color: '#64748b' }}>System Type:</span> <span style={{ fontWeight: 500 }}>{order.projectType || 'N/A'}</span>
                                <span style={{ color: '#64748b' }}>Current Stage:</span> <span style={{ fontWeight: 600, color: '#2563eb' }}>{order.currentStage || 'Priority Orders'}</span>
                                <span style={{ color: '#64748b' }}>Assigned Eng.:</span> <span style={{ fontWeight: 500 }}>{order.assignedEngineer || 'Unassigned'}</span>
                                <span style={{ color: '#64748b' }}>Created Date:</span> <span style={{ fontWeight: 500 }}>{new Date(order.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <div>
                            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>Financial Summary</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '12px 0', fontSize: '14px' }}>
                                <span style={{ color: '#64748b' }}>Project Value:</span> <span style={{ fontWeight: 600, fontSize: '15px' }}>₹ {inr(order.grandTotal)}</span>
                                <span style={{ color: '#64748b' }}>Advance Paid:</span> <span style={{ fontWeight: 500, color: '#16a34a' }}>₹ {inr(order.advanceAmount)}</span>
                                <span style={{ color: '#64748b' }}>Payment Date:</span> <span style={{ fontWeight: 500 }}>{order.advancePaymentDate ? new Date(order.advancePaymentDate).toLocaleDateString() : 'N/A'}</span>
                                <span style={{ color: '#64748b' }}>Balance Pending:</span> <span style={{ fontWeight: 600, color: '#ef4444' }}>₹ {inr(Number(order.grandTotal) - Number(order.advanceAmount || 0))}</span>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'Customer Details' && (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>👤</div>
                        <h3 style={{ color: '#0f172a' }}>Customer Profile</h3>
                        <p>Detailed customer address, site survey documents, and contact history will be displayed here.</p>
                    </div>
                )}

                {activeTab === 'Material Tracking' && (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
                        <h3 style={{ color: '#0f172a' }}>Procurement & Logistics</h3>
                        <p>BOM, PO generation, and delivery tracking module goes here.</p>
                    </div>
                )}

                {activeTab === 'Installation' && (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>👷</div>
                        <h3 style={{ color: '#0f172a' }}>Installation Schedule</h3>
                        <p>Calendar views, site photos, daily logs, and commissioning checklists will be available here.</p>
                    </div>
                )}

                {/* Generic placeholder for other tabs */}
                {['Quotation', 'Payment History', 'Documents', 'Engineer Notes', 'Invoice'].includes(activeTab) && (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                        <p><strong>{activeTab}</strong> module is currently under development.</p>
                    </div>
                )}
            </div>
            
        </div>
    );
}
