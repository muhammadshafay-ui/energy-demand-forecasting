const predictBtn = document.getElementById('predictBtn');
const loadingDiv = document.getElementById('loading');
const resultCard = document.getElementById('resultCard');
const chartCard = document.getElementById('chartCard');
const tableCard = document.getElementById('tableCard');
const toggleTableBtn = document.getElementById('toggleTableBtn');
const tableWrapper = document.getElementById('tableWrapper');
const downloadBtn = document.getElementById('downloadBtn');

let chart = null;
let lastData = null;

predictBtn.addEventListener('click', async () => {
    const hoursAhead = parseInt(document.getElementById('hoursAhead').value);

    loadingDiv.classList.remove('hidden');
    resultCard.classList.add('hidden');
    chartCard.classList.add('hidden');
    tableCard.classList.add('hidden');
    predictBtn.disabled = true;

    try {
        const response = await fetch('/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hours_ahead: hoursAhead })
        });

        if (!response.ok) throw new Error('Prediction failed');

        const data = await response.json();
        lastData = data;
        renderResults(data);

    } catch (error) {
        alert('Something went wrong: ' + error.message);
    } finally {
        loadingDiv.classList.add('hidden');
        predictBtn.disabled = false;
    }
});

toggleTableBtn.addEventListener('click', () => {
    tableWrapper.classList.toggle('hidden');
    const isHidden = tableWrapper.classList.contains('hidden');
    toggleTableBtn.textContent = isHidden ? '📋 Show Hourly Breakdown ▾' : '📋 Hide Hourly Breakdown ▴';
});

downloadBtn.addEventListener('click', () => {
    if (!lastData) return;
    let csv = 'Datetime,Predicted MW\n';
    lastData.predictions.forEach(p => {
        csv += `${p.datetime},${p.predicted_mw}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `energy_forecast_${lastData.hours_ahead}h.csv`;
    a.click();
    URL.revokeObjectURL(url);
});

function renderResults(data) {
    const values = data.predictions.map(p => p.predicted_mw);
    const labels = data.predictions.map(p => p.datetime.slice(5, 16));

    const peak = Math.max(...values);
    const low = Math.min(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const swing = peak - low;

    const peakEntry = data.predictions.find(p => p.predicted_mw === peak);
    const lowEntry = data.predictions.find(p => p.predicted_mw === low);

    document.getElementById('peakValue').textContent = peak.toLocaleString() + ' MW';
    document.getElementById('peakTime').textContent = 'at ' + peakEntry.datetime.slice(5, 16);

    document.getElementById('lowValue').textContent = low.toLocaleString() + ' MW';
    document.getElementById('lowTime').textContent = 'at ' + lowEntry.datetime.slice(5, 16);

    document.getElementById('avgValue').textContent = Math.round(avg).toLocaleString() + ' MW';
    document.getElementById('avgRange').textContent = `across ${data.hours_ahead}h`;

    document.getElementById('swingValue').textContent = swing.toLocaleString() + ' MW';

    resultCard.classList.remove('hidden');
    chartCard.classList.remove('hidden');
    tableCard.classList.remove('hidden');

    renderChart(labels, values);
    renderTable(data.predictions);
}

function renderChart(labels, values) {
    const ctx = document.getElementById('forecastChart').getContext('2d');
    if (chart) chart.destroy();

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Predicted Demand (MW)',
                data: values,
                borderColor: '#21d4fd',
                backgroundColor: 'rgba(33, 212, 253, 0.15)',
                fill: true,
                tension: 0.3,
                pointRadius: labels.length > 72 ? 0 : 2,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: '#e8e9ee' } },
                tooltip: {
                    backgroundColor: '#151824',
                    borderColor: '#262a3a',
                    borderWidth: 1,
                    titleColor: '#e8e9ee',
                    bodyColor: '#21d4fd'
                }
            },
            scales: {
                x: { ticks: { color: '#9297a8', maxTicksLimit: 14 }, grid: { color: '#1c2030' } },
                y: { ticks: { color: '#9297a8' }, grid: { color: '#1c2030' } }
            }
        }
    });
}

function renderTable(predictions) {
    const tbody = document.getElementById('forecastTableBody');
    tbody.innerHTML = '';
    predictions.forEach(p => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${p.datetime}</td><td>${p.predicted_mw.toLocaleString()} MW</td>`;
        tbody.appendChild(row);
    });
}