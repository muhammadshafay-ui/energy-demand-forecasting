const predictBtn = document.getElementById('predictBtn');
const loadingDiv = document.getElementById('loading');
const resultCard = document.getElementById('resultCard');
let chart = null;

predictBtn.addEventListener('click', async () => {
    const hoursAhead = parseInt(document.getElementById('hoursAhead').value);

    loadingDiv.classList.remove('hidden');
    resultCard.classList.add('hidden');
    predictBtn.disabled = true;

    try {
        const response = await fetch('/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hours_ahead: hoursAhead })
        });

        if (!response.ok) throw new Error('Prediction failed');

        const data = await response.json();
        renderResults(data);

    } catch (error) {
        alert('Something went wrong: ' + error.message);
    } finally {
        loadingDiv.classList.add('hidden');
        predictBtn.disabled = false;
    }
});

function renderResults(data) {
    const values = data.predictions.map(p => p.predicted_mw);
    const labels = data.predictions.map(p => p.datetime.slice(5, 16)); // trim to "MM-DD HH:MM"

    const peak = Math.max(...values);
    const low = Math.min(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    document.getElementById('peakValue').textContent = peak.toLocaleString() + ' MW';
    document.getElementById('lowValue').textContent = low.toLocaleString() + ' MW';
    document.getElementById('avgValue').textContent = Math.round(avg).toLocaleString() + ' MW';

    resultCard.classList.remove('hidden');

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
                pointRadius: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#e6e6e6' } } },
            scales: {
                x: { ticks: { color: '#aaa', maxTicksLimit: 12 }, grid: { color: '#2a2d3a' } },
                y: { ticks: { color: '#aaa' }, grid: { color: '#2a2d3a' } }
            }
        }
    });
}