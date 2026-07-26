import re

filepath = r"e:\AMAR\Solar-Billing-SaaS-UI\frontend\src\pages\Dashboard.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Make the lineChartOptions constant inside buildNewCharts
replacement_code = """        const lineChartOptions = {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { color: 'var(--g400)', font: { size: 11 } } },
                y: { 
                    border: { display: false }, 
                    grid: { color: '#111827', lineWidth: 1 }, 
                    ticks: { callback: (v: any) => (Number(v) >= 1000 ? (Number(v)/1000) + 'k' : v), color: 'var(--g400)', font: { size: 11 } } 
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
                        data: sortedNetRevData.length ? sortedNetRevData : [0,0,0,0,0,0,0,0,0,0,0,0],
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

        const genRamp = (v: number) => { const a = []; for(let i=12; i>=0; i--) a.push(v * (1 - (i*0.05))); return a; };
        
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
"""

# Find the block from "// 2. Build DOM Charts" up to "createMiniLineChart(actSubChartRef,"
# and replace it.

pattern = re.compile(r"// 2\. Build DOM Charts.*?createMiniLineChart\(actSubChartRef, actSubChartInstance, genRamp\(activeSubs\), '#3b82f6', true\);", re.DOTALL)

if pattern.search(content):
    content = pattern.sub(replacement_code, content)
else:
    print("Pattern not found for replacement!")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("Modification complete.")
