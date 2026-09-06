# Energy Demand Forecasting

A production-style machine learning system that forecasts hourly electricity demand for the PJM East grid region, using time series feature engineering and XGBoost. Deployed as a containerized FastAPI backend with a custom HTML/CSS/JS frontend.

🔗 **Live App:** [https://energy-demand-forecasting-bqzn.onrender.com/](https://energy-demand-forecasting-bqzn.onrender.com/)

*Note: hosted on Render's free tier — the app spins down after 15 minutes of inactivity, so the first load after idle time may take 30-50 seconds to wake up.*

## 🔍 Overview

Utility companies need accurate electricity demand forecasts to plan power generation, avoid grid overload, and manage costs efficiently. This project builds an end-to-end forecasting pipeline — from raw hourly consumption data to a live, interactive forecasting dashboard — solving a real business problem faced by grid operators.

Unlike standard classification/regression projects, this one required time-aware data handling throughout: no random train/test shuffling, recursive multi-step forecasting at inference time, and a deployment stack (FastAPI + Docker) built for production rather than a quick prototype UI.

## 📊 Dataset

- **Source:** [Hourly Energy Consumption (PJM)](https://www.kaggle.com/datasets/robikscube/hourly-energy-consumption) (Kaggle)
- **File used:** `PJME_hourly.csv` (PJM East region)
- **Size:** ~145,000 hourly readings spanning 2002–2018
- **Columns:** `Datetime`, `PJME_MW` (electricity consumption in Megawatts)

## 🛠️ Tech Stack

- **Python** — pandas, numpy for data handling
- **scikit-learn** — evaluation metrics, baseline comparisons
- **XGBoost** — final forecasting model
- **statsmodels** — seasonal decomposition analysis
- **matplotlib / seaborn** — EDA and result visualization
- **FastAPI** — backend API serving live forecasts
- **Docker** — containerized deployment
- **HTML / CSS / JavaScript (Chart.js)** — custom frontend dashboard

## ⚙️ Approach

1. **Data Cleaning** — converted timestamps to a proper `DatetimeIndex`, removed 4 duplicate timestamps (from DST "fall back" transitions), and filled 30 missing hourly gaps (from DST "spring forward" transitions) via time-based interpolation
2. **EDA & Seasonality Analysis** — confirmed three layers of seasonality: daily (morning/evening peaks), weekly (weekday vs. weekend), and yearly (summer AC + winter heating spikes) — validated formally with STL seasonal decomposition
3. **Feature Engineering:**
   - Time-based features: hour, day of week, month, quarter, year, is_weekend
   - Cyclical encoding (sin/cos) for hour and month, so the model understands time "wraps around" (e.g. hour 23 and hour 0 are close)
   - Lag features: consumption 1 hour ago, 24 hours ago, and 168 hours (1 week) ago
   - Rolling statistics: 24-hour rolling mean/std, 7-day rolling mean (all computed with a 1-step shift to prevent data leakage)
4. **Time-Aware Train/Test Split** — chronological 85/15 split (no shuffling), since shuffling would let the model "see the future" during training
5. **Baseline Models** — tested three naive forecasting methods (same-hour-yesterday, same-hour-last-week, 24h rolling average) to establish a real performance floor before modeling
6. **Model Training** — trained an XGBoost Regressor on the engineered feature set
7. **Evaluation** — MAE, RMSE, MAPE, plus residual analysis (bias check, distribution shape, and error breakdown by hour/month) to verify the model's errors are random noise, not a missed pattern
8. **Deployment:**
   - Saved the model using XGBoost's native format (`.json`) for cross-environment reliability
   - Built a FastAPI backend with a `/predict` endpoint performing **recursive multi-step forecasting** (each predicted hour feeds into the next hour's lag features)
   - Built a custom HTML/CSS/JS frontend with an animated, interactive forecast dashboard (Chart.js line chart, peak/low/average stats)
   - Containerized the full app with Docker for consistent, portable deployment

## 📈 Results

| Method | MAE | RMSE | MAPE |
|---|---|---|---|
| Best Baseline (same hour, 24h ago) | 2,206.33 | 3,027.41 | 7.01% |
| **XGBoost (final model)** | **304.30** | **408.19** | **0.97%** |

**Improvement over best baseline: 86.2%**

- Residual mean: -13.7 MW (essentially zero bias relative to ~30,000 MW scale)
- Residuals are normally distributed and centered at 0 — confirms errors are random noise, not a systematic gap in the model
- Prediction error is highest during demand transition hours (morning ramp-up, evening peak) and lowest during flat overnight hours — an expected, well-understood limitation

### Known limitation: recursive forecasting horizon effect
Because the model uses recursive multi-step forecasting (each hour's prediction feeds into the next), forecast accuracy naturally decreases the further out the horizon extends. Peak values in longer-range forecasts (e.g. day 5-7) tend to be smoothed toward a "typical" seasonal level rather than reproducing sharp, unique daily peaks. This is a well-documented characteristic of recursive forecasting with tree-based models, not a bug — production systems typically address this with direct multi-step forecasting or periodic re-anchoring using fresh real data. The API caps forecasts at 168 hours (7 days) to keep this effect manageable.

## 🚀 Running Locally

### Without Docker

1. Clone the repo:
   ```bash
   git clone https://github.com/muhammadshafay-ui/energy-demand-forecasting.git
   cd energy-demand-forecasting
   ```

2. Create and activate a virtual environment:
   ```bash
   uv venv --python 3.12
   .venv\Scripts\activate      # Windows
   source .venv/bin/activate   # Mac/Linux
   ```

3. Install dependencies:
   ```bash
   uv pip install -r requirements.txt
   ```

4. Run the app:
   ```bash
   uvicorn app.main:app --reload
   ```

5. Open `http://127.0.0.1:8000/` in your browser.

### With Docker

1. Build the image:
   ```bash
   docker build -t energy-demand-forecasting .
   ```

2. Run the container:
   ```bash
   docker run -p 8000:8000 energy-demand-forecasting
   ```

3. Open `http://127.0.0.1:8000/` in your browser.

## 📁 Project Structure

```
energy-demand-forecasting/
├── app/
│   ├── main.py                       # FastAPI backend (feature engineering + /predict endpoint)
│   ├── model/
│   │   ├── energy_forecast_model.json  # Trained XGBoost model (native format)
│   │   ├── model_columns.pkl           # Feature column order used at training time
│   │   └── last_known_data.pkl         # Last 168 hours of real data (needed for lag features at inference)
│   └── static/
│       ├── index.html                # Frontend dashboard
│       ├── style.css                 # Styling
│       └── script.js                 # Fetches forecasts, renders Chart.js line chart
├── Energy_Demand_Forecasting.ipynb   # Training notebook (EDA, feature engineering, modeling, evaluation)
├── Dockerfile
├── .dockerignore
├── requirements.txt
├── .gitignore
└── README.md
```

## 🖥️ App Preview

The dashboard lets a user select a forecast range (24h, 48h, 72h, or 7 days), then displays:
- Peak, lowest, and average predicted demand for the selected period
- An interactive line chart of the hourly forecast, correctly reflecting the daily demand curve (low overnight, peak in the evening)

## 🔮 Future Improvements

- Address the recursive forecasting horizon limitation with direct multi-step models (separate models per forecast horizon) or periodic re-anchoring with live data
- Add confidence intervals around predictions to communicate forecast uncertainty, especially for longer horizons
- Compare against Prophet or LSTM models
- Add authentication and rate-limiting to the API before any real production use
- Deploy with CI/CD (auto-rebuild Docker image on push)

## 👤 Author

**Muhammad Shafay**
Junior Python Backend Developer | AI & Automation Engineer
Portfolio: [shafay-dev.lovable.app](https://shafay-dev.lovable.app)
