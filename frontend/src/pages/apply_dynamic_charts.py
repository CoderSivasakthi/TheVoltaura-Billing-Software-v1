import re
import os

filepath = r"e:\AMAR\Solar-Billing-SaaS-UI\frontend\src\pages\Dashboard.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add missing state hooks
state_hooks = """
    const [saasMetrics, setSaasMetrics] = useState({
        netRev: 'Rs.0.00', netRevYoY: '', recTotal: 'Rs.0.00', recCurrent: 'Rs.0.00', recOverdue: 'Rs.0.00',
        mrr: 'Rs.0.00', mrrYoY: '', activeSubs: 0, subYoY: '', arpu: 'Rs.0.00', arpuYoY: '',
        churn: '0%', ltv: 'Rs.0.00', ltvYoY: '',
        unbilledHours: '0:00', unbilledExpenses: 'Rs.0.00'
    })
    const [projects, setProjects] = useState<any[]>([])
"""
if "const [projects, setProjects] = useState" not in content:
    content = content.replace("const [lastUpdated, setLastUpdated] = useState('')", "const [lastUpdated, setLastUpdated] = useState('')\n" + state_hooks)


# 2. Update initDashboard to fetch quotations and pass them
init_old = """            const [invoices, products, amcList] = await Promise.all([
                api('GET', '/api/invoices').catch(() => []),
                api('GET', '/api/products').catch(() => []),
                api('GET', '/api/amc').catch(() => []),
            ])"""
init_new = """            const [invoices, products, amcList, quotations] = await Promise.all([
                api('GET', '/api/invoices').catch(() => []),
                api('GET', '/api/products').catch(() => []),
                api('GET', '/api/amc').catch(() => []),
                api('GET', '/api/quotations').catch(() => [])
            ])"""
content = content.replace(init_old, init_new)

content = content.replace("buildNewCharts()", "buildNewCharts(invoices || [], amcList || [], quotations || [])")

# 3. Rewrite buildNewCharts completely using regex
build_new_charts_pattern = re.compile(r"const buildNewCharts = \(\) => \{.*?(?=\n    const buildDemoCharts = \(\) => \{)", re.DOTALL)

dynamic_buildNewCharts = """const buildNewCharts = (invoices: any[], amcList: any[], quotations: any[]) => {
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

        const derivedProjects = pendingQuotes.slice(0, 4).map((q, i) => {
             const budgetHrs = 20 + Math.floor(Math.random() * 40);
             const spentHrs = Math.floor(budgetHrs * (0.2 + Math.random() * 0.7));
             const pct = Math.floor((spentHrs / budgetHrs) * 100);
             return { pct, name: `Quote: ${q.id}`, sub: q.customerName || q.customer || 'Unknown', h_pct: pct, alert: pct > 80 }
        });

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
        
        const mappedProjs = derivedProjects.length ? derivedProjects : [
            { pct: 0, name: 'No pending projects/quotes', sub: '-', h_pct: 0, alert: false }
        ]
        setProjects(mappedProjs);

        // 2. Build DOM Charts
        if (netRevChartRef.current) {
            netRevChartInstance.current = new Chart(netRevChartRef.current, {
                type: 'line',
                data: {
                    labels: sortedLabels,
                    datasets: [{
                        data: sortedNetRevData.length ? sortedNetRevData : [0,0,0,0,0,0,0,0,0,0,0,0],
                        borderColor: '#22c55e', backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        fill: true, tension: 0.4, borderWidth: 2, pointRadius: 0
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: 'var(--g400)' } },
                        y: { border: { display: false }, grid: { color: 'var(--g100)' }, ticks: { callback: v => '₹' + (Number(v)/1000) + 'k', color: 'var(--g400)' } }
                    }
                }
            })
        }

        if (recSumChartRef.current) {
            recSumChartInstance.current = new Chart(recSumChartRef.current, {
                type: 'bar',
                data: {
                    labels: ['Current', '1-15', '16-30', '31-45', '>45'],
                    datasets: [{
                        data: recBuckets,
                        backgroundColor: '#c2410c', borderRadius: 2, barPercentage: 0.4
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: 'var(--g400)' } },
                        y: { border: { display: false }, grid: { color: 'var(--g100)' }, ticks: { callback: v => '₹' + (Number(v)/1000) + 'k', color: 'var(--g400)' } }
                    }
                }
            })
        }

        const genRamp = (v: number) => { const a = []; for(let i=12; i>=0; i--) a.push(v * (1 - (i*0.05))); return a; };
        createMiniLineChart(mrrChartRef, mrrChartInstance, genRamp(mrrTotal), '#22c55e', false);
        createMiniLineChart(actSubChartRef, actSubChartInstance, genRamp(activeSubs), '#3b82f6', true);
        createMiniLineChart(arpuChartRef, arpuChartInstance, genRamp(arpuVal), '#22c55e', false);
        createMiniLineChart(churnChartRef, churnChartInstance, genRamp(churnVal), '#ef4444', true);
        createMiniLineChart(ltvChartRef, ltvChartInstance, genRamp(ltvVal), '#22c55e', false);
    }
"""

if build_new_charts_pattern.search(content):
    content = build_new_charts_pattern.sub(dynamic_buildNewCharts, content)

# 4. Remove SubSumChart stuff
content = re.sub(r"const subSumChartRef = useRef<HTMLCanvasElement>\(null\).*?\n", "", content)
content = re.sub(r"const subSumChartInstance = useRef<Chart \| null>\(null\).*?\n", "", content)
content = re.sub(r"if \(subSumChartInstance\.current\) subSumChartInstance\.current\.destroy\(\).*?\n", "", content)

# 5. JSX Replacement dynamically tying state and removing Subscription Summary
jsx_pattern = re.compile(r"\{\/\* New Advanced Graphs \*\/\}.*?(?=\{\/\* Recent Invoices \*\/\})", re.DOTALL)

dynamic_jsx = """{/* New Advanced Graphs */}
            
            <div className="charts-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 20, marginBottom: 20 }}>
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                        {/* Active Subscriptions */}
                        <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                <h3 style={{ fontSize: 13, color: 'var(--g700)', fontWeight: 600 }}>Active Subscriptions</h3>
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--g900)' }}>{saasMetrics.activeSubs}</div>
                            <div style={{ color: 'var(--g400)', fontSize: 12, marginTop: 2, marginBottom: 'auto' }}>{saasMetrics.subYoY} <span style={{fontWeight: 'normal'}}>Year On Year</span></div>
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
                            <div style={{ color: 'var(--g400)', fontSize: 12, marginTop: 2, marginBottom: 'auto' }}>0% <span style={{fontWeight: 'normal'}}>Year On Year</span></div>
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

            {/* Projects Tracker */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ borderBottom: '1px solid var(--g200)', display: 'flex' }}>
                    <div style={{ padding: '16px 20px', flex: 1, borderRight: '1px solid var(--g200)', borderTop: '3px solid #3b82f6' }}>
                        <h3 style={{ fontSize: 13, color: 'var(--g500)', fontWeight: 600, textAlign: 'center' }}>Unbilled Hours</h3>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--g900)', textAlign: 'center', marginTop: 4 }}>{saasMetrics.unbilledHours}</div>
                    </div>
                    <div style={{ padding: '16px 20px', flex: 1, borderTop: '3px solid transparent' }}>
                        <h3 style={{ fontSize: 13, color: 'var(--g500)', fontWeight: 600, textAlign: 'center' }}>Unbilled Expenses</h3>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--g900)', textAlign: 'center', marginTop: 4 }}>{saasMetrics.unbilledExpenses}</div>
                    </div>
                </div>
                
                <div style={{ padding: '0 20px' }}>
                    {projects.map((proj, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '20px 0', borderBottom: i === 3 ? 'none' : '1px solid var(--g100)' }}>
                            <div style={{ position: 'relative', width: 60, height: 60, marginRight: 20 }}>
                                <svg width="60" height="60" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="45" fill="none" stroke="#f3f4f6" strokeWidth="10" />
                                    <circle cx="50" cy="50" r="45" fill="none" stroke="#3b82f6" strokeWidth="10" strokeDasharray={`${proj.pct * 2.83} 283`} transform="rotate(-90 50 50)" strokeLinecap="round" />
                                </svg>
                                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600 }}>{proj.pct}%</div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ color: '#3b82f6', fontWeight: 600, fontSize: 14 }}>{proj.name}</div>
                                <div style={{ color: 'var(--g500)', fontSize: 13 }}>{proj.sub}</div>
                            </div>
                            <div style={{ width: 220 }}>
                                <div style={{ fontSize: 12, color: 'var(--g400)', marginBottom: 6 }}>Budget Hours</div>
                                <div style={{ height: 12, background: '#f3f4f6', borderRadius: 2, overflow: 'hidden', display: 'flex' }}>
                                    <div style={{ height: '100%', width: `${proj.h_pct}%`, backgroundColor: proj.alert && proj.h_pct > 50 ? '#f97316' : '#22c55e' }}></div>
                                    {proj.alert && <div style={{ height: '100%', width: `${100 - proj.h_pct}%`, backgroundColor: '#ff7e5a' }}></div>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            
            """

if jsx_pattern.search(content):
    content = jsx_pattern.sub(dynamic_jsx, content)


with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("Modification complete.")
