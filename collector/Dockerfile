FROM python:3.11-slim
WORKDIR /app
COPY collector/api/requirements.txt /tmp/req.txt
RUN pip install --no-cache-dir -r /tmp/req.txt
COPY shared/ ./shared/
COPY collector/ ./collector/
COPY data/ ./data/
ENV PYTHONPATH=/app
ENV AGENTS_PATH=/app/data/ai-agents.json
EXPOSE 8001
CMD ["uvicorn", "collector.api.main:app", "--host", "0.0.0.0", "--port", "8001"]
