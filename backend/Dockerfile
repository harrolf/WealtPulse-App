FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
# Added curl for healthcheck
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN groupadd -r appuser && useradd -r -g appuser -d /app appuser

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Copy and setup entrypoint
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# Change ownership of the app directory to appuser
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Create data and logs directories (ensure permissions)
# Since we switched to USER appuser, we need to ensure these exist or are writable.
# However, COPY . . copies them if they exist. If not, we should likely create them before switching user 
# OR rely on volume mounts. For now, we'll assume they might be mounted or created in app.
# The `RUN mkdir` in previous version was effective because of root. 
# We'll rely on the chown above to fix permissions for copied files.

# Set entrypoint
ENTRYPOINT ["./entrypoint.sh"]

# Command to run the application (No --reload)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
