import re

with open(r"e:\AMAR\Solar-Billing-SaaS-UI\frontend\src\pages\Dashboard.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add Refs
refs_injection = """
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

    const subSumChartRef = useRef<HTMLCanvasElement>(null)
    const subSumChartInstance = useRef<Chart | null>(null)
"""
content = content.replace("const donutChartInstance = useRef<Chart | null>(null)", "const donutChartInstance = useRef<Chart | null>(null)\n" + refs_injection)

# 2. Add build functionality (dummy data for the new charts)
new_charts_build = """
    const buildNewCharts = () => {
        // Destroy old instances
        if (netRevChartInstance.current) netRevChartInstance.current.destroy()
        if (recSumChartInstance.current) recSumChartInstance.current.destroy()
        if (mrrChartInstance.current) mrrChartInstance.current.destroy()
        if (actSubChartInstance.current) actSubChartInstance.current.destroy()
        if (arpuChartInstance.current) arpuChartInstance.current.destroy()
        if (churnChartInstance.current) churnChartInstance.current.destroy()
        if (ltvChartInstance.current) ltvChartInstance.current.destroy()
        if (subSumChartInstance.current) subSumChartInstance.current.destroy()

        const createMiniLineChart = (ref: any, instance: any, data: any[], color: string, fillArea: boolean = false) => {
            if (ref.current) {
                instance.current = new Chart(ref.current, {
                    type: 'line',
                    data: {
                        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
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
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false }, tooltip: { enabled: false } },
                        scales: { x: { display: false }, y: { display: false } },
                        interaction: { intersect: false }
                    }
                })
            }
        }

        // 1. Net Revenue
        if (netRevChartRef.current) {
            netRevChartInstance.current = new Chart(netRevChartRef.current, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan 24'],
                    datasets: [{
                        data: [0, 2, 0.2, 1.5, 12, 0, 1.2, 0, 0, 0.8, 0.4, 0.1, 0],
                        borderColor: '#22c55e',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                        pointRadius: 0
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: 'var(--g400)' } },
                        y: { border: { display: false }, grid: { color: 'var(--g100)' }, ticks: { callback: v => v + ' M', color: 'var(--g400)' } }
                    }
                }
            })
        }

        // 2. Receivable Summary
        if (recSumChartRef.current) {
            recSumChartInstance.current = new Chart(recSumChartRef.current, {
                type: 'bar',
                data: {
                    labels: ['Current', '1-15', '16-30', '31-45', '>45'],
                    datasets: [{
                        data: [0, 0, 0, 0, 372],
                        backgroundColor: '#c2410c',
                        borderRadius: 2,
                        barPercentage: 0.4
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: 'var(--g400)' } },
                        y: { border: { display: false }, grid: { color: 'var(--g100)' }, ticks: { callback: v => v + ' K', color: 'var(--g400)' } }
                    }
                }
            })
        }

        // mini charts
        createMiniLineChart(mrrChartRef, mrrChartInstance, [340, 350, 360, 370, 375, 380, 410, 420, 422, 423, 428, 445, 448], '#22c55e', false);
        createMiniLineChart(actSubChartRef, actSubChartInstance, [1000, 1050, 1100, 1150, 1200, 1220, 1250, 1300, 1350, 1400, 1450, 1500, 1522], '#3b82f6', true);
        createMiniLineChart(arpuChartRef, arpuChartInstance, [350, 345, 340, 335, 320, 320, 315, 305, 300, 298, 298, 305, 298], '#22c55e', false);
        createMiniLineChart(churnChartRef, churnChartInstance, [2.5, 1.2, 1.0, 2.1, 2.8, 1.5, 1.8, 2.0, 1.0, 1.2, 3.0, 2.1, 1.1], '#ef4444', true);
        createMiniLineChart(ltvChartRef, ltvChartInstance, [11000, 11500, 15000, 13000, 12000, 12000, 12100, 12150, 12200, 12250, 12500, 12700, 12916], '#22c55e', false);

        // Subscription Summary
        if (subSumChartRef.current) {
            subSumChartInstance.current = new Chart(subSumChartRef.current, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan 24'],
                    datasets: [
                        { label: 'Signups', data: [50, 60, 80, 125, 110, 130, 145, 120, 115, 125, 105, 128, 60], borderColor: '#22c55e', tension: 0.4, borderWidth: 2, pointRadius: 0 },
                        { label: 'Activations', data: [48, 62, 85, 130, 112, 132, 143, 122, 118, 123, 106, 124, 58], borderColor: '#3b82f6', tension: 0.4, borderWidth: 2, pointRadius: 0 },
                        { label: 'Cancellations', data: [65, 20, 12, 45, 75, 74, 60, 75, 72, 80, 58, 88, 35], borderColor: '#f97316', tension: 0.4, borderWidth: 2, pointRadius: 0 },
                        { label: 'Reactivations', data: [0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0], borderColor: '#8b5cf6', tension: 0.4, borderWidth: 2, pointRadius: 0 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: 'var(--g400)' } },
                        y: { border: { display: false }, grid: { color: 'var(--g100)' }, ticks: { color: 'var(--g400)' } }
                    },
                    interaction: { intersect: false, mode: 'index' }
                }
            })
        }
    }
"""

content = content.replace("buildCharts(invoices || [])", "buildCharts(invoices || [])\n            buildNewCharts()")
content = content.replace("buildDemoCharts()", "buildDemoCharts()\n            buildNewCharts()")

# Fix the method signature to include buildNewCharts
content = content.replace("const buildDemoCharts = () => {", new_charts_build + "\n    const buildDemoCharts = () => {")

# Add cleanup
cleanup = """
            if (netRevChartInstance.current) netRevChartInstance.current.destroy()
            if (recSumChartInstance.current) recSumChartInstance.current.destroy()
            if (mrrChartInstance.current) mrrChartInstance.current.destroy()
            if (actSubChartInstance.current) actSubChartInstance.current.destroy()
            if (arpuChartInstance.current) arpuChartInstance.current.destroy()
            if (churnChartInstance.current) churnChartInstance.current.destroy()
            if (ltvChartInstance.current) ltvChartInstance.current.destroy()
            if (subSumChartInstance.current) subSumChartInstance.current.destroy()
"""
content = content.replace("if (donutChartInstance.current) donutChartInstance.current.destroy()", "if (donutChartInstance.current) donutChartInstance.current.destroy()" + cleanup)


# 3. Add the UI below Quick Actions
new_ui = """
            {/* New Advanced Graphs */}
            
            <div className="charts-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                {/* Net Revenue */}
                <div className="card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                        <h3 style={{ fontSize: 14, color: 'var(--g700)', fontWeight: 600 }}>Net Revenue</h3>
                        <span style={{ fontSize: 13, color: 'var(--g500)', cursor: 'pointer' }}>Last 12 months ⌄</span>
                    </div>
                    <div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--g900)' }}>Rs.17,628,857.60</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <span style={{ color: '#22c55e', backgroundColor: '#dcfce7', padding: '2px 6px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>486.9% ↑</span>
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
                            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--g900)', marginTop: 4 }}>Rs.372,580.05</div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 13 }}>
                            <div style={{ color: 'var(--g500)' }}>Current <span style={{ color: '#3b82f6', fontWeight: 600 }}>: Rs.0.00</span></div>
                            <div style={{ color: 'var(--g500)', marginTop: 4 }}>Overdue <span style={{ color: '#ea580c', fontWeight: 600 }}>: Rs.372,580.05</span></div>
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
                        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--g900)' }}>Rs.454,102.86</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <span style={{ color: '#22c55e', backgroundColor: '#dcfce7', padding: '2px 6px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>29.3% ↑</span>
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
                            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--g900)' }}>1522</div>
                            <div style={{ color: 'var(--g400)', fontSize: 12, marginTop: 2, marginBottom: 'auto' }}>0% <span style={{fontWeight: 'normal'}}>Year On Year</span></div>
                            <div style={{ height: 60, marginTop: 10, position: 'relative', marginLeft: '-10px', marginRight: '-10px' }}>
                                <canvas ref={actSubChartRef}></canvas>
                            </div>
                        </div>

                        {/* ARPU */}
                        <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                <h3 style={{ fontSize: 13, color: 'var(--g700)', fontWeight: 600 }}>ARPU</h3>
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--g900)' }}>Rs.298.36</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, marginBottom: 'auto' }}>
                                <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 600 }}>18.7% ↓</span>
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
                            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--g900)' }}>2.31%</div>
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
                            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--g900)' }}>Rs.12,916.00</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, marginBottom: 'auto' }}>
                                <span style={{ color: '#22c55e', backgroundColor: '#dcfce7', padding: '2px 6px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>123.8% ↑</span>
                                <span style={{ color: 'var(--g400)', fontSize: 12 }}>Year On Year</span>
                            </div>
                            <div style={{ height: 60, marginTop: 10, position: 'relative', marginLeft: '-10px', marginRight: '-10px' }}>
                                <canvas ref={ltvChartRef}></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Subscription Summary */}
            <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h3 style={{ fontSize: 14, color: 'var(--g700)', fontWeight: 600 }}>Subscription Summary</h3>
                    <span style={{ fontSize: 13, color: 'var(--g500)', cursor: 'pointer' }}>Last 12 months ⌄</span>
                </div>
                
                <div style={{ display: 'flex', gap: 30, marginBottom: 10 }}>
                    <div>
                        <div style={{ color: 'var(--g500)', fontSize: 13, marginBottom: 4 }}>Signups</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--g900)', borderLeft: '3px solid #22c55e', paddingLeft: 8 }}>1304</div>
                    </div>
                    <div>
                        <div style={{ color: 'var(--g500)', fontSize: 13, marginBottom: 4 }}>Activations</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--g900)', borderLeft: '3px solid #3b82f6', paddingLeft: 8 }}>1305</div>
                    </div>
                    <div>
                        <div style={{ color: 'var(--g500)', fontSize: 13, marginBottom: 4 }}>Cancellations</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--g900)', borderLeft: '3px solid #f97316', paddingLeft: 8 }}>742</div>
                    </div>
                    <div>
                        <div style={{ color: 'var(--g500)', fontSize: 13, marginBottom: 4 }}>Reactivations</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--g900)', borderLeft: '3px solid #8b5cf6', paddingLeft: 8 }}>2</div>
                    </div>
                </div>

                <div style={{ height: 300, position: 'relative', width: '100%' }}>
                    <canvas ref={subSumChartRef}></canvas>
                </div>
            </div>

            {/* Projects Tracker */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ borderBottom: '1px solid var(--g200)', display: 'flex' }}>
                    <div style={{ padding: '16px 20px', flex: 1, borderRight: '1px solid var(--g200)', borderTop: '3px solid #3b82f6' }}>
                        <h3 style={{ fontSize: 13, color: 'var(--g500)', fontWeight: 600, textAlign: 'center' }}>Unbilled Hours</h3>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--g900)', textAlign: 'center', marginTop: 4 }}>12:00</div>
                    </div>
                    <div style={{ padding: '16px 20px', flex: 1, borderTop: '3px solid transparent' }}>
                        <h3 style={{ fontSize: 13, color: 'var(--g500)', fontWeight: 600, textAlign: 'center' }}>Unbilled Expenses</h3>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--g900)', textAlign: 'center', marginTop: 4 }}>Rs.100.00</div>
                    </div>
                </div>
                
                <div style={{ padding: '0 20px' }}>
                    {[
                        { pct: 39, name: 'Licensed Fresh Bacon', sub: 'John Smith Customer', h_pct: 35, alert: false },
                        { pct: 16, name: 'Gorgeous Metal Car', sub: 'Emily Johnson Custom...', h_pct: 80, alert: true },
                        { pct: 55, name: 'Practical Concrete Towels', sub: 'David Williams Custo...', h_pct: 95, alert: true },
                        { pct: 25, name: 'Refined Cotton Cheese', sub: 'Sarah Brown Customer', h_pct: 40, alert: false }
                    ].map((proj, i) => (
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

content = content.replace("{/* Recent Invoices */}", new_ui + "\n            {/* Recent Invoices */}")

# Remove multiple Active Subscriptions from MRR left, 
# The string replacement might miss if something is wrong but this looks solid.

with open(r"e:\AMAR\Solar-Billing-SaaS-UI\frontend\src\pages\Dashboard.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Modification complete.")
