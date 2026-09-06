# Use a lightweight official Python image
FROM python:3.12-slim

# Set the working directory inside the container
WORKDIR /code

# Copy requirements first (Docker layer caching - dependencies won't
# reinstall on every build unless requirements.txt itself changes)
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY ./app ./app

# Expose the port FastAPI/uvicorn will run on
EXPOSE 8000

# Command to run the app when the container starts
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]