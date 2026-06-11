FROM python:3.11-slim

WORKDIR /app

COPY checker/api/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY data/ ./data/
COPY checker/ ./checker/

ENV PYTHONPATH=/app
ENV AGENTS_PATH=/app/data/ai-agents.json

EXPOSE 8000
CMD ["uvicorn", "checker.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
