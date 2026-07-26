import { useState, useEffect, useMemo } from 'react';
import { api, toast } from '../services/api';
import { useNavigate } from 'react-router-dom';
import {
    Search, RefreshCw, FileSpreadsheet, Printer, 
    Eye, Edit2, Calendar, FolderOpen
} from 'lucide-react';

export default function PriorityOrders() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filters & Pagination
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [priorityFilter, setPriorityFilter] = useState('All');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(25);
    const [sortField, setSortField] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    
    // Engineer Assignment Modal
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [assigningOrder, setAssigningOrder] = useState<any>(null);
    const [engineerName, setEngineerName] = useState('');
    
    const navigate = useNavigate();

    const fetchOrders = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const data = await api('GET', '/api/orders', undefined, silent);
            setOrders(data);
        } catch (e: any) {
            toast(e.message || 'Failed to fetch priority orders', 'error');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
        const intv = setInterval(() => fetchOrders(true), 60000);
        return () => clearInterval(intv);
    }, []);

    // Summary Stats
    const totalOrders = orders.length;
    const highPriority = orders.filter(o => o.priorityLevel === 'High').length;
    const pendingInstall = orders.filter(o => o.currentStage !== 'Commissioned' && o.currentStage !== 'Completed').length;
    const completed = orders.filter(o => o.currentStage === 'Commissioned' || o.currentStage === 'Completed').length;
    const totalValue = orders.reduce((acc, curr) => acc + (Number(curr.grandTotal) || 0), 0);

    const inr = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);

    // Derived Data (Filtering & Sorting)
    const filteredOrders = useMemo(() => {
        let result = orders;
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(o => 
                (o.id || '').toLowerCase().includes(q) ||
                (o.customerName || '').toLowerCase().includes(q) ||
                (o.quotationNumber || '').toLowerCase().includes(q)
            );
        }
        if (statusFilter !== 'All') {
            result = result.filter(o => o.currentStage === statusFilter);
        }
        if (priorityFilter !== 'All') {
            result = result.filter(o => o.priorityLevel === priorityFilter);
        }

        // Sorting
        result.sort((a, b) => {
            let valA = a[sortField];
            let valB = b[sortField];
            
            if (sortField === 'grandTotal') {
                valA = Number(valA || 0);
                valB = Number(valB || 0);
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [orders, search, statusFilter, priorityFilter, sortField, sortOrder]);

    // Pagination
    const totalPages = Math.ceil(filteredOrders.length / perPage);
    const paginatedOrders = filteredOrders.slice((page - 1) * perPage, page * perPage);

    // Handlers
    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('desc');
        }
    };

    const updateOrderProperty = async (orderId: string, property: string, value: string) => {
        try {
            const order = orders.find(o => o.id === orderId);
            if (!order) return;
            const updated = { ...order, [property]: value };
            await api('PUT', `/api/orders/${orderId}`, updated);
            setOrders(orders.map(o => o.id === orderId ? updated : o));
            toast(`Order updated successfully`, 'success');
        } catch (e: any) {
            toast(e.message || 'Failed to update order', 'error');
        }
    };

    const handleAssignEngineer = async () => {
        if (!engineerName.trim()) return;
        await updateOrderProperty(assigningOrder.id, 'assignedEngineer', engineerName);
        setAssignModalOpen(false);
        setEngineerName('');
    };

    const exportToCSV = () => {
        const headers = ['Order ID', 'Quotation No', 'Customer Name', 'Mobile', 'Project Size', 'Project Value', 'Priority', 'Current Stage', 'Assigned Engineer'];
        const csvContent = [
            headers.join(','),
            ...filteredOrders.map(o => [
                o.id,
                o.quotationNumber,
                `"${o.customerName}"`,
                o.customerMobile,
                `"${o.projectSize}"`,
                o.grandTotal,
                o.priorityLevel,
                o.currentStage,
                `"${o.assignedEngineer}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `orders_export_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const printDashboard = () => {
        window.print();
    };

    // Rendering Helpers
    const renderPriorityColor = (level: string) => {
        switch (level) {
            case 'High': return '#fef2f2'; // Very Light Red
            case 'Medium': return '#fff7ed'; // Very Light Orange
            case 'Low': return '#f0f9ff'; // Very Light Blue
            default: return '#f0fdf4'; // Very Light Green
        }
    };

    const renderStageBadge = (stage: string) => {
        let bg = '#f1f5f9', color = '#475569';
        switch (stage) {
            case 'Priority Orders': bg = '#f3e8ff'; color = '#7e22ce'; break; // Purple
            case 'Material Procurement': bg = '#fef3c7'; color = '#b45309'; break; // Yellow
            case 'Installation Scheduled': bg = '#dbeafe'; color = '#1d4ed8'; break; // Blue
            case 'Installation In Progress': bg = '#e0e7ff'; color = '#4338ca'; break; // Indigo
            case 'Commissioned':
            case 'Completed': bg = '#dcfce7'; color = '#15803d'; break; // Green
        }
        return (
            <span style={{ backgroundColor: bg, color, padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {stage}
            </span>
        );
    };

    // CSS variables for layout
    const cardStyle = { backgroundColor: '#fff', borderRadius: '8px', padding: '20px', border: '1px solid #e2e8f0', flex: 1, minWidth: '200px' };

    return (
        <div style={{ padding: '24px', maxWidth: '100%', boxSizing: 'border-box' }} className="print-container">
            {/* Header & Stats */}
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>Operations Dashboard</h1>
                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>Manage all priority orders and EPC project operations</p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <div style={cardStyle}>
                    <p style={{ margin: '0 0 8px', color: '#64748b', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' }}>Confirmed Orders</p>
                    <h2 style={{ margin: 0, fontSize: '28px', color: '#0f172a' }}>{totalOrders}</h2>
                </div>
                <div style={cardStyle}>
                    <p style={{ margin: '0 0 8px', color: '#ef4444', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' }}>High Priority</p>
                    <h2 style={{ margin: 0, fontSize: '28px', color: '#0f172a' }}>{highPriority}</h2>
                </div>
                <div style={cardStyle}>
                    <p style={{ margin: '0 0 8px', color: '#eab308', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' }}>Pending Installation</p>
                    <h2 style={{ margin: 0, fontSize: '28px', color: '#0f172a' }}>{pendingInstall}</h2>
                </div>
                <div style={cardStyle}>
                    <p style={{ margin: '0 0 8px', color: '#22c55e', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' }}>Completed</p>
                    <h2 style={{ margin: 0, fontSize: '28px', color: '#0f172a' }}>{completed}</h2>
                </div>
                <div style={cardStyle}>
                    <p style={{ margin: '0 0 8px', color: '#3b82f6', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' }}>Total Value</p>
                    <h2 style={{ margin: 0, fontSize: '28px', color: '#0f172a' }}>₹{inr(totalValue)}</h2>
                </div>
            </div>

            {/* Toolbar */}
            <div className="no-print" style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '10px' }} />
                        <input 
                            type="text" 
                            placeholder="Search orders..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ padding: '8px 12px 8px 36px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', width: '220px', outline: 'none' }}
                        />
                    </div>
                    <select 
                        value={statusFilter} 
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', backgroundColor: '#f8fafc', outline: 'none' }}
                    >
                        <option value="All">All Stages</option>
                        <option value="Priority Orders">Priority Orders</option>
                        <option value="Material Procurement">Material Procurement</option>
                        <option value="Installation Scheduled">Installation Scheduled</option>
                        <option value="Installation In Progress">Installation In Progress</option>
                        <option value="Commissioned">Commissioned</option>
                    </select>
                    <select 
                        value={priorityFilter} 
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', backgroundColor: '#f8fafc', outline: 'none' }}
                    >
                        <option value="All">All Priorities</option>
                        <option value="High">High Priority</option>
                        <option value="Medium">Medium Priority</option>
                        <option value="Normal">Normal Priority</option>
                        <option value="Low">Low Priority</option>
                    </select>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => fetchOrders()} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', border: '1px solid #cbd5e1', backgroundColor: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                        <RefreshCw size={16} color="#475569" /> Refresh
                    </button>
                    <button onClick={exportToCSV} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', border: '1px solid #cbd5e1', backgroundColor: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                        <FileSpreadsheet size={16} color="#16a34a" /> Export CSV
                    </button>
                    <button onClick={printDashboard} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', border: '1px solid #cbd5e1', backgroundColor: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                        <Printer size={16} color="#3b82f6" /> Print
                    </button>
                </div>
            </div>

            {/* Table */}
            <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1200px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            {['Order ID', 'Quotation No', 'Customer Name', 'Project Size', 'Project Value', 'Priority', 'Current Stage', 'Assigned Engineer', 'Actions'].map((h, i) => {
                                const fieldMap: Record<string, string> = {
                                    'Order ID': 'id',
                                    'Customer Name': 'customerName',
                                    'Project Value': 'grandTotal',
                                    'Priority': 'priorityLevel',
                                    'Current Stage': 'currentStage'
                                };
                                const field = fieldMap[h];
                                return (
                                    <th 
                                        key={i} 
                                        onClick={() => field ? handleSort(field) : null}
                                        style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', cursor: field ? 'pointer' : 'default', userSelect: 'none' }}
                                    >
                                        {h} {field && sortField === field ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px' }}>Loading orders...</td></tr>
                        ) : paginatedOrders.length === 0 ? (
                            <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No orders found.</td></tr>
                        ) : (
                            paginatedOrders.map((o) => {
                                // Shorten ID for display if needed
                                const displayId = o.id.length > 12 ? o.id.split('-').slice(0,2).join('-').substring(0, 10) + '...' : o.id;

                                return (
                                    <tr key={o.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: renderPriorityColor(o.priorityLevel) }}>
                                        <td style={{ padding: '16px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                                            <span title={o.id}>{displayId}</span>
                                        </td>
                                        <td style={{ padding: '16px', color: '#3b82f6', whiteSpace: 'nowrap', cursor: 'pointer', fontWeight: 500 }} onClick={() => navigate(`/quotations/${o.quotationId}`)}>
                                            {o.quotationNumber}
                                        </td>
                                        <td style={{ padding: '16px', fontWeight: 500, whiteSpace: 'nowrap' }}>{o.customerName}</td>
                                        <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>{o.projectSize}</td>
                                        <td style={{ padding: '16px', fontWeight: 600, whiteSpace: 'nowrap', color: '#0f172a' }}>₹{inr(Number(o.grandTotal) || 0)}</td>
                                        <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                                            <select 
                                                value={o.priorityLevel}
                                                onChange={(e) => updateOrderProperty(o.id, 'priorityLevel', e.target.value)}
                                                style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.15)', background: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                                            >
                                                <option value="High">🔴 High</option>
                                                <option value="Medium">🟠 Medium</option>
                                                <option value="Normal">🟢 Normal</option>
                                                <option value="Low">🔵 Low</option>
                                            </select>
                                        </td>
                                        <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                                            {renderStageBadge(o.currentStage || 'Priority Orders')}
                                        </td>
                                        <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                                            {o.assignedEngineer && o.assignedEngineer !== 'Unassigned' ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontWeight: 500, fontSize: '13px' }}>{o.assignedEngineer}</span>
                                                    <button onClick={() => { setAssigningOrder(o); setEngineerName(o.assignedEngineer); setAssignModalOpen(true); }} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0 }}>
                                                        <Edit2 size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button onClick={() => { setAssigningOrder(o); setEngineerName(''); setAssignModalOpen(true); }} style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#475569' }}>
                                                    Assign...
                                                </button>
                                            )}
                                        </td>
                                        <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                <button onClick={() => navigate(`/orders/${o.id}`)} title="View Order" style={{ background: 'none', border: 'none', color: '#0f172a', cursor: 'pointer', padding: 0 }}>
                                                    <Eye size={18} />
                                                </button>
                                                <button title="Schedule Installation" style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0 }}>
                                                    <Calendar size={18} />
                                                </button>
                                                <button title="Documents" style={{ background: 'none', border: 'none', color: '#16a34a', cursor: 'pointer', padding: 0 }}>
                                                    <FolderOpen size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {!loading && filteredOrders.length > 0 && (
                <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', color: '#64748b', fontSize: '14px' }}>
                    <div>
                        Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, filteredOrders.length)} of {filteredOrders.length} entries
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }} style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }}>
                            <option value={25}>25 per page</option>
                            <option value={50}>50 per page</option>
                            <option value={100}>100 per page</option>
                        </select>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '6px 12px', border: '1px solid #cbd5e1', backgroundColor: '#fff', borderRadius: '4px', cursor: page === 1 ? 'not-allowed' : 'pointer' }}>Prev</button>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '6px 12px', border: '1px solid #cbd5e1', backgroundColor: '#fff', borderRadius: '4px', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}>Next</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Assign Modal */}
            {assignModalOpen && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.70)', backdropFilter: 'blur(3px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ backgroundColor: '#fff', padding: '28px', borderRadius: '12px', width: '420px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                        <h3 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Assign Engineer</h3>
                        <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: '14px', lineHeight: 1.5 }}>
                            Assigning team/engineer to <strong>{assigningOrder?.id}</strong> ({assigningOrder?.customerName})
                        </p>
                        
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>Engineer / Team Name</label>
                        <input 
                            type="text"
                            value={engineerName}
                            onChange={(e) => setEngineerName(e.target.value)}
                            placeholder="e.g. John Doe - Install Team Alpha"
                            style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', marginBottom: '24px', boxSizing: 'border-box', outline: 'none', fontSize: '14px' }}
                        />

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button onClick={() => setAssignModalOpen(false)} style={{ padding: '9px 18px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 500, fontSize: '14px' }}>Cancel</button>
                            <button onClick={handleAssignEngineer} style={{ padding: '9px 18px', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}>Save Assignment</button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Minimal Print CSS embedded */}
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    .print-container { padding: 0 !important; }
                    table { font-size: 11px !important; }
                    body { background: white !important; }
                }
            `}</style>
        </div>
    );
}
