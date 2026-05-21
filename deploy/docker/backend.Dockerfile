FROM python:3.11-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:0.7.13 /uv /uvx /usr/local/bin/

COPY pyproject.toml uv.lock ./
COPY docs ./docs
COPY src ./src

RUN uv sync --frozen --no-dev

EXPOSE 8000

CMD ["uvicorn", "urban_violation_backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
