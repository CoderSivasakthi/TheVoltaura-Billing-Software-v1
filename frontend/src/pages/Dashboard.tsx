import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Clock, Wrench, AlertTriangle, RefreshCw, FilePlus, UserPlus, Download, Box } from 'lucide-react'
import { api, fmt, fmtDate, statusTag, displayName } from '../services/api'
import { Chart, registerables } from 'chart.js'
import { useAuth } from '../context/AuthContext'
import SuperAdminDashboard from './SuperAdminDashboard'

Chart.register(...registerables)

export default function DashboardWrapper() {
    const { isSuperAdmin } = useAuth()
    return isSuperAdmin() ? <SuperAdminDashboard /> : <FranchiseDashboard />
}

function FranchiseDashboard() {
    const navigate = useNavigate()
    const [kpi, setKpi] = useState({ revenue: '₹0', pending: '₹0', amc: '0', expiringAmc: '0', amcRevenue: '₹0', lowStock: '0' })
    const [recentInvoices, setRecentInvoices] = useState<any[]>([])
    const [lastUpdated, setLastUpdated] = useState('')

    const [saasMetrics, setSaasMetrics] = useState({
        netRev: 'Rs.0.00', netRevYoY: '', recTotal: 'Rs.0.00', recCurrent: 'Rs.0.00', recOverdue: 'Rs.0.00',
        mrr: 'Rs.0.00', mrrYoY: '', activeSubs: 0, subYoY: '', arpu: 'Rs.0.00', arpuYoY: '',
        churn: '0%', ltv: 'Rs.0.00', ltvYoY: '',
        unbilledHours: '0:00', unbilledExpenses: 'Rs.0.00'
    })
    const [priorityOrdersSummary, setPriorityOrdersSummary] = useState({ high: 0, normal: 0, pendingInstalls: 0, confirmedOrders: 0, todaysInstalls: 0 });

    const revChartRef = useRef<HTMLCanvasElement>(null)
    const donutChartRef = useRef<HTMLCanvasElement>(null)
    const revChartInstance = useRef<Chart | null>(null)
    const donutChartInstance = useRef<Chart | null>(null)

    // New Chart Refs
    const netRevChartRef = useRef<HTMLCanvasElement>(null)
    const netRevChartInstance = useRef<Chart | null>(null)
    const recSumChartRef = useRef<HTMLCanvasElement>(null)
    const recSumChartInstance = useRef<Chart | null>(null)

    const mrrChartRef = useRef<HTMLCanvasElement>(null)
    const mrrChartInstance = useRef<Chart | null>(null)
    const actSubChartRef = useRef<HTMLCanvasElement>(null)
    const actSubChartInstance = useRef<Chart | null>(null)
    const arpuChartRef = useRef<HTMLCanvasElement>(null)
    const arpuChartInstance = useRef<Chart | null>(null)
    const churnChartRef = useRef<HTMLCanvasElement>(null)
    const churnChartInstance = useRef<Chart | null>(null)
    const ltvChartRef = useRef<HTMLCanvasElement>(null)
    const ltvChartInstance = useRef<Chart | null>(null)



    const initDashboard = useCallback(async (silent = false) => {
        try {
            const [invoices, products, amcList, quotations, orders] = await Promise.all([
                api('GET', '/api/invoices', undefined, silent).catch(() => []),
                api('GET', '/api/products', undefined, silent).catch(() => []),
                api('GET', '/api/amc', undefined, silent).catch(() => []),
                api('GET', '/api/quotations', undefined, silent).catch(() => []),
                api('GET', '/api/orders', undefined, silent).catch(() => [])
            ])
            // KPI calculations
            const totalRev = (invoices || []).filter((i: any) => (i.status || '').toLowerCase() === 'paid')
                .reduce((s: number, i: any) => s + Number(i.total || i.grandTotal || 0), 0)
            const pendingAmt = (invoices || []).filter((i: any) => ['pending', 'overdue'].includes((i.status || '').toLowerCase()))
                .reduce((s: number, i: any) => s + Number(i.total || i.grandTotal || 0), 0)

            const today = new Date().getTime()
            const activeAmc = (amcList || []).filter((a: any) => {
                if (!a.amcExpiryDate) return (a.status || '').toLowerCase() === 'active';
                return (new Date(a.amcExpiryDate).getTime() - today) > 0;
            }).length

            const expiringAmc = (amcList || []).filter((a: any) => {
                if (!a.amcExpiryDate) return false;
                const days = (new Date(a.amcExpiryDate).getTime() - today) / 86400000;
                return days > 0 && days <= 30;
            }).length

            const amcRev = (amcList || []).filter((a: any) => {
                if (!a.amcExpiryDate) return (a.status || '').toLowerCase() === 'active';
                return (new Date(a.amcExpiryDate).getTime() - today) > 0;
            }).reduce((s: number, a: any) => s + Number(a.totalContractValue || a.amcContractValue || 0), 0)

            const lowStock = (products || []).filter((p: any) => Number(p.stock || 0) < 10).length

            setKpi({
                revenue: fmt(totalRev), pending: fmt(pendingAmt),
                amc: String(activeAmc), expiringAmc: String(expiringAmc),
                amcRevenue: fmt(amcRev), lowStock: String(lowStock)
            })

            const highPriority = (orders || []).filter((o: any) => o.priorityLevel === 'High').length;
            const normalPriority = (orders || []).filter((o: any) => o.priorityLevel === 'Normal').length;
            const pendingInstalls = (orders || []).filter((o: any) => o.projectStatus !== 'Completed').length;
            const confirmedOrders = (orders || []).length;
            
            const todayStr = new Date().toISOString().split('T')[0];
            const todaysInstalls = (orders || []).filter((o: any) => o.expectedInstallationDate === todayStr).length;

            setPriorityOrdersSummary({ high: highPriority, normal: normalPriority, pendingInstalls, confirmedOrders, todaysInstalls });

            // Recent invoices (last 5)
            const sorted = [...(invoices || [])].sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
            setRecentInvoices(sorted.slice(0, 5))

            setLastUpdated(`Last updated: ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`)

            // Charts
            buildCharts(invoices || [])
            buildNewCharts(invoices || [], amcList || [], quotations || [])
        } catch {
            buildDemoCharts()
            buildNewCharts([], [], [])
        }
    }, [])

    const buildCharts = (invoices: any[]) => {
        // Revenue chart
        if (revChartRef.current) {
            if (revChartInstance.current) revChartInstance.current.destroy()
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            const monthData = new Array(12).fill(0)
            invoices.forEach((inv: any) => {
                const d = new Date(inv.date)
                if (!isNaN(d.getTime())) {
                    monthData[d.getMonth()] += Number(inv.total || inv.grandTotal || 0)
                }
            })
            revChartInstance.current = new Chart(revChartRef.current, {
                type: 'bar',
                data: {
                    labels: months,
                    datasets: [{
                        label: 'Revenue',
                        data: monthData,
                        backgroundColor: 'rgba(245,158,11,0.15)',
                        borderColor: '#F59E0B',
                        borderWidth: 2,
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, ticks: { callback: (v: any) => '₹' + (Number(v) / 1000).toFixed(0) + 'k' } },
                        x: { grid: { display: false } }
                    }
                }
            })
        }

        // Donut chart
        if (donutChartRef.current) {
            if (donutChartInstance.current) donutChartInstance.current.destroy()
            if (netRevChartInstance.current) netRevChartInstance.current.destroy()
            if (recSumChartInstance.current) recSumChartInstance.current.destroy()
            if (mrrChartInstance.current) mrrChartInstance.current.destroy()
            if (actSubChartInstance.current) actSubChartInstance.current.destroy()
            if (arpuChartInstance.current) arpuChartInstance.current.destroy()
            if (churnChartInstance.current) churnChartInstance.current.destroy()
            if (ltvChartInstance.current) ltvChartInstance.current.destroy()

            const paid = invoices.filter((i: any) => (i.status || '').toLowerCase() === 'paid').length
            const pending = invoices.filter((i: any) => (i.status || '').toLowerCase() === 'pending').length
            const overdue = invoices.filter((i: any) => (i.status || '').toLowerCase() === 'overdue').length
            const total = paid + pending + overdue || 1

            const donutTotalEl = document.getElementById('donutTotal')
            if (donutTotalEl) donutTotalEl.textContent = String(invoices.length)
            const dlPaid = document.getElementById('dlPaid')
            const dlPending = document.getElementById('dlPending')
            const dlOverdue = document.getElementById('dlOverdue')
            if (dlPaid) dlPaid.textContent = Math.round((paid / total) * 100) + '%'
            if (dlPending) dlPending.textContent = Math.round((pending / total) * 100) + '%'
            if (dlOverdue) dlOverdue.textContent = Math.round((overdue / total) * 100) + '%'

            donutChartInstance.current = new Chart(donutChartRef.current, {
                type: 'doughnut',
                data: {
                    labels: ['Paid', 'Pending', 'Overdue'],
                    datasets: [{
                        data: [paid, pending, overdue],
                        backgroundColor: ['#10B981', '#F59E0B', '#EF4444'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, cutout: '72%',
                    plugins: { legend: { display: false } }
                }
            })
        }
    }


    const buildNewCharts = (invoices: any[], amcList: any[], quotations: any[]) => {
        if (netRevChartInstance.current) netRevChartInstance.current.destroy()
        if (recSumChartInstance.current) recSumChartInstance.current.destroy()
        if (mrrChartInstance.current) mrrChartInstance.current.destroy()
        if (actSubChartInstance.current) actSubChartInstance.current.destroy()
        if (arpuChartInstance.current) arpuChartInstance.current.destroy()
        if (churnChartInstance.current) churnChartInstance.current.destroy()
        if (ltvChartInstance.current) ltvChartInstance.current.destroy()

        const createMiniLineChart = (ref: any, instance: any, data: any[], color: string, fillArea: boolean = false) => {
            if (ref.current) {
                instance.current = new Chart(ref.current, {
                    type: 'line',
                    data: {
                        labels: ['12m', '11m', '10m', '9m', '8m', '7m', '6m', '5m', '4m', '3m', '2m', '1m', 'Now'],
                        datasets: [{
                            data: data,
                            borderColor: color,
                            borderWidth: 2,
                            tension: 0.4,
                            pointRadius: 0,
                            fill: fillArea,
                            backgroundColor: fillArea ? `${color}15` : 'transparent'
                        }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { display: false }, tooltip: { enabled: false } },
                        scales: { x: { display: false }, y: { display: false } },
                        interaction: { intersect: false }
                    }
                })
            }
        }

        // 1. Data Crunching
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentMonthIndex = new Date().getMonth();
        const netRevDataRaw = new Array(12).fill(0);
        let totalNetRev = 0;

        let totalRec = 0; let currentRec = 0; let overdueRec = 0;
        const recBuckets = [0, 0, 0, 0, 0];

        invoices.forEach(inv => {
            const st = (inv.status || '').toLowerCase();
            const total = Number(inv.total || inv.grandTotal || 0);

            if (st === 'paid') {
                totalNetRev += total;
                const d = new Date(inv.createdAt || inv.date);
                if (!isNaN(d.getTime())) {
                    netRevDataRaw[d.getMonth()] += total;
                }
            } else if (st === 'pending' || st === 'overdue') {
                totalRec += total;
                if (st === 'overdue') overdueRec += total;
                else currentRec += total;

                if (st === 'overdue') {
                    const dDate = new Date(inv.dueDate || inv.createdAt || inv.date);
                    if (!isNaN(dDate.getTime())) {
                        const daysOverdue = Math.floor((new Date().getTime() - dDate.getTime()) / (1000 * 3600 * 24));
                        if (daysOverdue <= 0) recBuckets[0] += total;
                        else if (daysOverdue <= 15) recBuckets[1] += total;
                        else if (daysOverdue <= 30) recBuckets[2] += total;
                        else if (daysOverdue <= 45) recBuckets[3] += total;
                        else recBuckets[4] += total;
                    } else {
                        recBuckets[4] += total;
                    }
                } else {
                    recBuckets[0] += total;
                }
            }
        });

        const sortedNetRevData = [];
        const sortedLabels = [];
        for (let i = 11; i >= 0; i--) {
            let m = currentMonthIndex - i;
            if (m < 0) m += 12;
            sortedNetRevData.push(netRevDataRaw[m]);
            sortedLabels.push(months[m]);
        }

        let activeAmcList = amcList.filter(a => (a.status || '').toLowerCase() === 'active');
        let mrrTotal = activeAmcList.reduce((sum, a) => sum + (Number(a.annualValue) / 12 || 0), 0);
        let activeSubs = activeAmcList.length;
        let arpuVal = activeSubs > 0 ? mrrTotal / activeSubs : 0;
        let churnVal = amcList.length > 0 ? ((amcList.length - activeSubs) / amcList.length) * 100 : 0;
        let ltvVal = churnVal > 0 ? arpuVal / (churnVal / 100) : (arpuVal * 36);

        let unbilledExp = 0;
        let pendingQuotes = quotations.filter(q => ['draft', 'pending'].includes((q.status || '').toLowerCase()));
        pendingQuotes.forEach(q => unbilledExp += Number(q.total || q.grandTotal || 0));



        setSaasMetrics({
            netRev: fmt(totalNetRev), netRevYoY: '+0.0% YoY',
            recTotal: fmt(totalRec), recCurrent: fmt(currentRec), recOverdue: fmt(overdueRec),
            mrr: fmt(mrrTotal), mrrYoY: '+0.0% YoY',
            activeSubs: activeSubs, subYoY: '0% YoY',
            arpu: fmt(arpuVal), arpuYoY: '0.0% YoY',
            churn: churnVal.toFixed(2) + '%',
            ltv: fmt(ltvVal), ltvYoY: '+0.0% YoY',
            unbilledHours: '0:00', unbilledExpenses: fmt(unbilledExp)
        });



        const lineChartOptions = {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { color: 'var(--g400)', font: { size: 11 } } },
                y: {
                    border: { display: false },
                    grid: { color: '#111827', lineWidth: 1 },
                    ticks: { callback: (v: any) => (Number(v) >= 1000 ? (Number(v) / 1000) + 'k' : v), color: 'var(--g400)', font: { size: 11 } }
                }
            },
            interaction: { intersect: false, mode: 'index' as const }
        };

        // 2. Build DOM Charts
        if (netRevChartRef.current) {
            netRevChartInstance.current = new Chart(netRevChartRef.current, {
                type: 'line',
                data: {
                    labels: sortedLabels,
                    datasets: [{
                        data: sortedNetRevData.length ? sortedNetRevData : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                        borderColor: '#22c55e', backgroundColor: 'transparent',
                        fill: false, tension: 0.4, borderWidth: 2, pointRadius: 0
                    }]
                },
                options: lineChartOptions
            })
        }

        if (recSumChartRef.current) {
            recSumChartInstance.current = new Chart(recSumChartRef.current, {
                type: 'line',
                data: {
                    labels: ['Current', '1-15', '16-30', '31-45', '>45'],
                    datasets: [{
                        data: recBuckets,
                        borderColor: '#c2410c', backgroundColor: 'transparent',
                        fill: false, tension: 0.4, borderWidth: 2, pointRadius: 0
                    }]
                },
                options: lineChartOptions
            })
        }

        const genRamp = (v: number) => { const a = []; for (let i = 12; i >= 0; i--) a.push(v * (1 - (i * 0.05))); return a; };

        if (mrrChartRef.current) {
            mrrChartInstance.current = new Chart(mrrChartRef.current, {
                type: 'line',
                data: {
                    labels: ['12m', '11m', '10m', '9m', '8m', '7m', '6m', '5m', '4m', '3m', '2m', '1m', 'Now'],
                    datasets: [{
                        data: genRamp(mrrTotal),
                        borderColor: '#3b82f6', backgroundColor: 'transparent',
                        fill: false, tension: 0.4, borderWidth: 2, pointRadius: 0
                    }]
                },
                options: lineChartOptions
            })
        }

        createMiniLineChart(actSubChartRef, actSubChartInstance, genRamp(activeSubs), '#3b82f6', true);

        createMiniLineChart(arpuChartRef, arpuChartInstance, genRamp(arpuVal), '#22c55e', false);
        createMiniLineChart(churnChartRef, churnChartInstance, genRamp(churnVal), '#ef4444', true);
        createMiniLineChart(ltvChartRef, ltvChartInstance, genRamp(ltvVal), '#22c55e', false);
    }

    const buildDemoCharts = () => {
        const demoData = [120000, 95000, 140000, 110000, 160000, 130000, 175000, 145000, 190000, 155000, 200000, 170000]
        if (revChartRef.current) {
            if (revChartInstance.current) revChartInstance.current.destroy()
            revChartInstance.current = new Chart(revChartRef.current, {
                type: 'bar',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                    datasets: [{
                        label: 'Revenue',
                        data: demoData,
                        backgroundColor: 'rgba(245,158,11,0.15)',
                        borderColor: '#F59E0B',
                        borderWidth: 2,
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, ticks: { callback: (v: any) => '₹' + (Number(v) / 1000).toFixed(0) + 'k' } },
                        x: { grid: { display: false } }
                    }
                }
            })
        }
        if (donutChartRef.current) {
            if (donutChartInstance.current) donutChartInstance.current.destroy()
            if (netRevChartInstance.current) netRevChartInstance.current.destroy()
            if (recSumChartInstance.current) recSumChartInstance.current.destroy()
            if (mrrChartInstance.current) mrrChartInstance.current.destroy()
            if (actSubChartInstance.current) actSubChartInstance.current.destroy()
            if (arpuChartInstance.current) arpuChartInstance.current.destroy()
            if (churnChartInstance.current) churnChartInstance.current.destroy()
            if (ltvChartInstance.current) ltvChartInstance.current.destroy()

            donutChartInstance.current = new Chart(donutChartRef.current, {
                type: 'doughnut',
                data: {
                    labels: ['Paid', 'Pending', 'Overdue'],
                    datasets: [{ data: [18, 5, 2], backgroundColor: ['#10B981', '#F59E0B', '#EF4444'], borderWidth: 0 }]
                },
                options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false } } }
            })
        }
    }

    useEffect(() => {
        initDashboard()
        const intv = setInterval(() => initDashboard(true), 60000)
        return () => {
            clearInterval(intv)
            if (revChartInstance.current) revChartInstance.current.destroy()
            if (donutChartInstance.current) donutChartInstance.current.destroy()
            if (netRevChartInstance.current) netRevChartInstance.current.destroy()
            if (recSumChartInstance.current) recSumChartInstance.current.destroy()
            if (mrrChartInstance.current) mrrChartInstance.current.destroy()
            if (actSubChartInstance.current) actSubChartInstance.current.destroy()
            if (arpuChartInstance.current) arpuChartInstance.current.destroy()
            if (churnChartInstance.current) churnChartInstance.current.destroy()
            if (ltvChartInstance.current) ltvChartInstance.current.destroy()

        }
    }, [initDashboard])

    return (
        <div className="page active" id="dashboard-page">
            <div className="ph">
                <div>
                    <h2>Dashboard Overview</h2>
                    <div className="sub">Welcome back, here's what's happening with your solar projects today.</div>
                </div>
                <div className="ph-actions">
                    <span style={{ fontSize: 12, color: 'var(--g400)' }} id="dashLastUpdated">{lastUpdated}</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => initDashboard()}>
                        <RefreshCw size={14} /> Refresh
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="kpi-grid">
                <div className="kpi-card">
                    <div className="kpi-top"><div className="kpi-label">Total Revenue</div><div className="kpi-icon ki-green"><TrendingUp size={20} color="var(--green)" /></div></div>
                    <div className="kpi-val" id="kpiRevenue">{kpi.revenue}</div>
                    <div className="kpi-delta"><span className="pct up">+12%</span><span className="desc">from last month</span></div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-top"><div className="kpi-label">Pending Payments</div><div className="kpi-icon ki-orange"><Clock size={20} color="var(--orange)" /></div></div>
                    <div className="kpi-val" id="kpiPending">{kpi.pending}</div>
                    <div className="kpi-delta"><span className="pct down">+5%</span><span className="desc">increase in pending</span></div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-top"><div className="kpi-label">Low Stock Items</div><div className="kpi-icon ki-red"><AlertTriangle size={20} color="var(--red)" /></div></div>
                    <div className="kpi-val" id="kpiLowStock">{kpi.lowStock}</div>
                    <div className="kpi-delta"><span className="kpi-alert" id="kpiLowStockAlert">Requires attention</span></div>
                </div>
                {/* AMC specific cards wrapper - letting grid auto wrap if it's 4 columns or keeping it as 6 */}
                <div className="kpi-card">
                    <div className="kpi-top"><div className="kpi-label">Active Vendor AMCs</div><div className="kpi-icon ki-blue"><Wrench size={20} color="var(--blue)" /></div></div>
                    <div className="kpi-val" id="kpiAmc">{kpi.amc}</div>
                    <div className="kpi-delta"><span className="pct up">+8%</span><span className="desc">new contracts</span></div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-top"><div className="kpi-label">Expiring AMC (&lt;30d)</div><div className="kpi-icon ki-orange"><Clock size={20} color="var(--orange)" /></div></div>
                    <div className="kpi-val">{kpi.expiringAmc}</div>
                    <div className="kpi-delta"><span className="kpi-alert">Needs renewal</span></div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-top"><div className="kpi-label">AMC Revenue</div><div className="kpi-icon ki-green"><TrendingUp size={20} color="var(--green)" /></div></div>
                    <div className="kpi-val">{kpi.amcRevenue}</div>
                    <div className="kpi-delta"><span className="pct up">Stable</span><span className="desc">active values</span></div>
                </div>
            </div>

            {/* Charts */}
            <div className="charts-row" style={{ alignItems: 'stretch' }}>
                <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div className="section-hdr" style={{ marginBottom: 4 }}>
                        <div><h3>Monthly Revenue</h3><div className="ch-sub">Yearly performance overview</div></div>
                        <span className="badge b-gray badge-no-dot" style={{ fontSize: 11 }}>Last 12 Months</span>
                    </div>
                    <div style={{ position: 'relative', flex: 1, minHeight: 240, width: '100%' }}>
                        <canvas id="revenueChart" ref={revChartRef}></canvas>
                    </div>
                </div>
                <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <h3 style={{ marginBottom: 'auto' }}>Invoice Status</h3>
                    <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '10px 0', minHeight: 200 }}>
                        <canvas id="invoiceStatusChart" ref={donutChartRef} style={{ maxHeight: 200, maxWidth: 200 }}></canvas>
                        <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
                            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--g900)' }} id="donutTotal">0</div>
                            <div style={{ fontSize: 11, color: 'var(--g400)', fontWeight: 600 }}>INVOICES</div>
                        </div>
                    </div>
                    <div className="donut-legend" id="donutLegend" style={{ marginTop: 'auto' }}>
                        <div className="dl-row"><div><span className="dl-dot" style={{ background: '#10B981' }}></span>Paid</div><div className="dl-pct" id="dlPaid">0%</div></div>
                        <div className="dl-row"><div><span className="dl-dot" style={{ background: '#F59E0B' }}></span>Pending</div><div className="dl-pct" id="dlPending">0%</div></div>
                        <div className="dl-row"><div><span className="dl-dot" style={{ background: '#EF4444' }}></span>Overdue</div><div className="dl-pct" id="dlOverdue">0%</div></div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="card cp" style={{ marginBottom: 20 }}>
                <div className="section-hdr"><h3>Quick Actions</h3><span style={{ fontSize: 12, color: 'var(--g400)' }}>Frequently used tools to manage your operations</span></div>
                <div className="qa-grid">
                    <button className="qa-card" onClick={() => navigate('/create-quotation')}><div className="qa-icon"><FilePlus /></div><div className="qa-title">Create Quotation</div><div className="qa-desc">Draft a new proposal</div></button>
                    <button className="qa-card" onClick={() => navigate('/customers')}><div className="qa-icon"><UserPlus /></div><div className="qa-title">Add Customer</div><div className="qa-desc">Register new client</div></button>
                    <button className="qa-card" onClick={() => navigate('/reports')}><div className="qa-icon"><Download /></div><div className="qa-title">Generate Report</div><div className="qa-desc">Download analytics</div></button>
                    <button className="qa-card" onClick={() => navigate('/products')}><div className="qa-icon"><Box /></div><div className="qa-title">Check Inventory</div><div className="qa-desc">Review stock levels</div></button>
                </div>
            </div>


            {/* New Advanced Graphs */}

            <div className="charts-row" style={{ display: 'grid', gap: 20, marginBottom: 20 }}>
                {/* Net Revenue */}
                <div className="card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                        <h3 style={{ fontSize: 14, color: 'var(--g700)', fontWeight: 600 }}>Net Revenue</h3>
                        <span style={{ fontSize: 13, color: 'var(--g500)', cursor: 'pointer' }}>Last 12 months ⌄</span>
                    </div>
                    <div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--g900)' }}>{saasMetrics.netRev}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <span style={{ color: '#22c55e', backgroundColor: '#dcfce7', padding: '2px 6px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{saasMetrics.netRevYoY}</span>
                            <span style={{ color: 'var(--g400)', fontSize: 12 }}>Year On Year</span>
                        </div>
                    </div>
                    <div style={{ height: 260, marginTop: 20, position: 'relative' }}>
                        <canvas ref={netRevChartRef}></canvas>
                    </div>
                </div>

                {/* Receivable Summary */}
                <div className="card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                        <h3 style={{ fontSize: 14, color: 'var(--g700)', fontWeight: 600 }}>Receivable Summary</h3>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ color: 'var(--g500)', fontSize: 13 }}>Total Receivables</div>
                            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--g900)', marginTop: 4 }}>{saasMetrics.recTotal}</div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 13 }}>
                            <div style={{ color: 'var(--g500)' }}>Current <span style={{ color: '#3b82f6', fontWeight: 600 }}>: {saasMetrics.recCurrent}</span></div>
                            <div style={{ color: 'var(--g500)', marginTop: 4 }}>Overdue <span style={{ color: '#ea580c', fontWeight: 600 }}>: {saasMetrics.recOverdue}</span></div>
                        </div>
                    </div>
                    <div style={{ height: 260, marginTop: 20, position: 'relative' }}>
                        <canvas ref={recSumChartRef}></canvas>
                    </div>
                </div>
            </div>

            <div className="amc-layout" style={{ gap: 20, marginBottom: 20 }}>
                {/* MRR (Main left card) */}
                <div className="card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                        <h3 style={{ fontSize: 14, color: 'var(--g700)', fontWeight: 600 }}>MRR</h3>
                        <span style={{ fontSize: 13, color: 'var(--g500)', cursor: 'pointer' }}>Last 12 months ⌄</span>
                    </div>
                    <div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--g900)' }}>{saasMetrics.mrr}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <span style={{ color: '#22c55e', backgroundColor: '#dcfce7', padding: '2px 6px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{saasMetrics.mrrYoY}</span>
                            <span style={{ color: 'var(--g400)', fontSize: 12 }}>Year On Year</span>
                        </div>
                    </div>
                    <div style={{ height: 260, marginTop: 20, position: 'relative', width: '100%', marginLeft: '-15px' }}>
                        <canvas ref={mrrChartRef}></canvas>
                    </div>
                </div>

                {/* Grid for small metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
                    <div className="fr2" style={{ gap: 20 }}>
                        {/* Active Subscriptions */}
                        <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                <h3 style={{ fontSize: 13, color: 'var(--g700)', fontWeight: 600 }}>Active Subscriptions</h3>
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--g900)' }}>{saasMetrics.activeSubs}</div>
                            <div style={{ color: 'var(--g400)', fontSize: 12, marginTop: 2, marginBottom: 'auto' }}>{saasMetrics.subYoY} <span style={{ fontWeight: 'normal' }}>Year On Year</span></div>
                            <div style={{ height: 60, marginTop: 10, position: 'relative', marginLeft: '-10px', marginRight: '-10px' }}>
                                <canvas ref={actSubChartRef}></canvas>
                            </div>
                        </div>

                        {/* ARPU */}
                        <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                <h3 style={{ fontSize: 13, color: 'var(--g700)', fontWeight: 600 }}>ARPU</h3>
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--g900)' }}>{saasMetrics.arpu}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, marginBottom: 'auto' }}>
                                <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 600 }}>{saasMetrics.arpuYoY}</span>
                                <span style={{ color: 'var(--g400)', fontSize: 12 }}>Year On Year</span>
                            </div>
                            <div style={{ height: 60, marginTop: 10, position: 'relative', marginLeft: '-10px', marginRight: '-10px' }}>
                                <canvas ref={arpuChartRef}></canvas>
                            </div>
                        </div>

                        {/* Churn Rate */}
                        <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                <h3 style={{ fontSize: 13, color: 'var(--g700)', fontWeight: 600 }}>Churn Rate</h3>
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--g900)' }}>{saasMetrics.churn}</div>
                            <div style={{ color: 'var(--g400)', fontSize: 12, marginTop: 2, marginBottom: 'auto' }}>0% <span style={{ fontWeight: 'normal' }}>Year On Year</span></div>
                            <div style={{ height: 60, marginTop: 10, position: 'relative', marginLeft: '-10px', marginRight: '-10px' }}>
                                <canvas ref={churnChartRef}></canvas>
                            </div>
                        </div>

                        {/* LTV */}
                        <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                <h3 style={{ fontSize: 13, color: 'var(--g700)', fontWeight: 600 }}>LTV</h3>
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--g900)' }}>{saasMetrics.ltv}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, marginBottom: 'auto' }}>
                                <span style={{ color: '#22c55e', backgroundColor: '#dcfce7', padding: '2px 6px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{saasMetrics.ltvYoY}</span>
                                <span style={{ color: 'var(--g400)', fontSize: 12 }}>Year On Year</span>
                            </div>
                            <div style={{ height: 60, marginTop: 10, position: 'relative', marginLeft: '-10px', marginRight: '-10px' }}>
                                <canvas ref={ltvChartRef}></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Priority Orders Tracker */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ borderBottom: '1px solid var(--g200)', display: 'flex', flexWrap: 'wrap' }}>
                    <div style={{ padding: '16px 20px', flex: '1 1 20%', borderRight: '1px solid var(--g200)', borderTop: '3px solid #3b82f6' }}>
                        <h3 style={{ fontSize: 13, color: 'var(--g500)', fontWeight: 600, textAlign: 'center' }}>Total Confirmed Orders</h3>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--g900)', textAlign: 'center', marginTop: 4 }}>{priorityOrdersSummary.confirmedOrders || 0}</div>
                    </div>
                    <div style={{ padding: '16px 20px', flex: '1 1 20%', borderRight: '1px solid var(--g200)', borderTop: '3px solid #ef4444' }}>
                        <h3 style={{ fontSize: 13, color: 'var(--g500)', fontWeight: 600, textAlign: 'center' }}>High Priority</h3>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--g900)', textAlign: 'center', marginTop: 4 }}>{priorityOrdersSummary.high}</div>
                    </div>
                    <div style={{ padding: '16px 20px', flex: '1 1 20%', borderRight: '1px solid var(--g200)', borderTop: '3px solid #22c55e' }}>
                        <h3 style={{ fontSize: 13, color: 'var(--g500)', fontWeight: 600, textAlign: 'center' }}>Normal Priority</h3>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--g900)', textAlign: 'center', marginTop: 4 }}>{priorityOrdersSummary.normal}</div>
                    </div>
                    <div style={{ padding: '16px 20px', flex: '1 1 20%', borderRight: '1px solid var(--g200)', borderTop: '3px solid #f59e0b' }}>
                        <h3 style={{ fontSize: 13, color: 'var(--g500)', fontWeight: 600, textAlign: 'center' }}>Pending Installs</h3>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--g900)', textAlign: 'center', marginTop: 4 }}>{priorityOrdersSummary.pendingInstalls}</div>
                    </div>
                    <div style={{ padding: '16px 20px', flex: '1 1 20%', borderTop: '3px solid #8b5cf6' }}>
                        <h3 style={{ fontSize: 13, color: 'var(--g500)', fontWeight: 600, textAlign: 'center' }}>Today's Installs</h3>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--g900)', textAlign: 'center', marginTop: 4 }}>{priorityOrdersSummary.todaysInstalls || 0}</div>
                    </div>
                </div>

                <div style={{ padding: '15px 20px', background: '#f8fafc', display: 'flex', justifyContent: 'center' }}>
                    <button className="btn btn-primary" onClick={() => navigate('/priority-orders')}>
                        Manage Priority Orders
                    </button>
                </div>
            </div>

            {/* Recent Invoices */}
            <div className="card" style={{ overflow: 'hidden' }}>
                <div className="section-hdr" style={{ padding: '18px 20px 0' }}><h3>Recent Invoices</h3><a href="#" onClick={(e) => { e.preventDefault(); navigate('/invoices') }}>View all →</a></div>
                <div className="tw">
                    <table className="tbl" id="dashRecentInvTable">
                        <thead><tr><th>Invoice ID</th><th>Customer</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
                        <tbody id="dashRecentInvoices">
                            {recentInvoices.length === 0 ? (
                                <tr><td colSpan={5} className="empty-state">No invoices yet</td></tr>
                            ) : (
                                recentInvoices.map((inv: any) => (
                                    <tr
                                        key={inv.id}
                                        className="tr-clickable"
                                        onClick={() => navigate(`/view-invoice/${inv.id}`)}
                                        tabIndex={0}
                                        role="button"
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/view-invoice/${inv.id}`); } }}
                                    >
                                        <td><strong>{inv.id}</strong></td>
                                        <td>{displayName(inv.customerName || inv.customer)}</td>
                                        <td>{fmtDate(inv.createdAt || inv.date)}</td>
                                        <td>{fmt(inv.total || inv.grandTotal)}</td>
                                        <td dangerouslySetInnerHTML={{ __html: statusTag(inv.status) }}></td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
