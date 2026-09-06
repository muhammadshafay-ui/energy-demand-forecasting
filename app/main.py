# FastAPI app
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from xgboost import XGBRegressor
import pandas as pd
import numpy as np
import joblib
from datetime import datetime, timedelta

# -----------------------
# Load model artifacts
# -----------------------
model = XGBRegressor()
model.load_model('app/model/energy_forecast_model.json')
feature_columns = joblib.load('app/model/model_columns.pkl')
last_known_data = joblib.load('app/model/last_known_data.pkl')  # last 168 hours of real PJME_MW values

app = FastAPI(title="Energy Demand Forecasting API", version="1.0")

app.mount("/static", StaticFiles(directory="app/static"), name="static")

@app.get("/", include_in_schema=False)
def serve_frontend():
    return FileResponse("app/static/index.html")

# Allow the HTML/CSS frontend (running on a different port/origin) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this to your actual frontend domain before production
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------
# Request schema
# -----------------------
class ForecastRequest(BaseModel):
    hours_ahead: int = 24  # how many hours into the future to forecast (default 24)

# -----------------------
# Feature engineering function (mirrors training pipeline exactly)
# -----------------------
def build_features(timestamp, history):
    """
    timestamp: the datetime we're predicting for
    history: a pandas Series of PJME_MW values indexed by datetime,
             containing at least the past 168 hours relative to `timestamp`
    """
    row = {}
    row['hour'] = timestamp.hour
    row['day_of_week'] = timestamp.dayofweek
    row['month'] = timestamp.month
    row['year'] = timestamp.year
    row['quarter'] = timestamp.quarter
    row['day_of_year'] = timestamp.dayofyear
    row['is_weekend'] = int(timestamp.dayofweek in [5, 6])
    row['hour_sin'] = np.sin(2 * np.pi * row['hour'] / 24)
    row['hour_cos'] = np.cos(2 * np.pi * row['hour'] / 24)
    row['month_sin'] = np.sin(2 * np.pi * row['month'] / 12)
    row['month_cos'] = np.cos(2 * np.pi * row['month'] / 12)

    row['lag_1h'] = history.get(timestamp - timedelta(hours=1), np.nan)
    row['lag_24h'] = history.get(timestamp - timedelta(hours=24), np.nan)
    row['lag_168h'] = history.get(timestamp - timedelta(hours=168), np.nan)

    last_24 = [history.get(timestamp - timedelta(hours=h), np.nan) for h in range(1, 25)]
    last_168 = [history.get(timestamp - timedelta(hours=h), np.nan) for h in range(1, 169)]

    row['rolling_mean_24h'] = np.nanmean(last_24)
    row['rolling_std_24h'] = np.nanstd(last_24)
    row['rolling_mean_7d'] = np.nanmean(last_168)

    return row

# -----------------------
# Endpoints
# -----------------------

@app.post("/predict")
def predict(request: ForecastRequest):
    if request.hours_ahead < 1 or request.hours_ahead > 168:
        raise HTTPException(status_code=400, detail="hours_ahead must be between 1 and 168")

    # Working copy of history - a dict {timestamp: value} for fast lookup
    history = last_known_data['PJME_MW'].to_dict()

    last_timestamp = last_known_data.index.max()
    predictions = []

    current_timestamp = last_timestamp

    for step in range(request.hours_ahead):
        current_timestamp = current_timestamp + timedelta(hours=1)

        features = build_features(current_timestamp, pd.Series(history))
        X_input = pd.DataFrame([features])[feature_columns]

        pred_value = float(model.predict(X_input)[0])

        # Feed this prediction back into history so the NEXT hour's lag features can use it
        history[current_timestamp] = pred_value

        predictions.append({
            "datetime": current_timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "predicted_mw": round(pred_value, 2)
        })

    return {
        "forecast_start": (last_timestamp + timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S"),
        "hours_ahead": request.hours_ahead,
        "predictions": predictions
    }