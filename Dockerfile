# The dashboard server for Railway (or any Docker host): the built site, the API, and the Python
# tools it runs (logger + export). Accounts, demos and phone recordings live on a volume at /data.
#
#   docker build -t remotion . && docker run -p 8080:8080 -v remotion-data:/data remotion
FROM node:24-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-venv \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python tools (server/python.ts runs <repo>/.venv/bin/python)
COPY requirements.txt ./
RUN python3 -m venv .venv && .venv/bin/pip install --no-cache-dir -r requirements.txt

# Node dependencies first, so code changes don't reinstall them
COPY software/web/package.json software/web/package-lock.json software/web/
RUN cd software/web && npm ci

COPY . .
RUN cd software/web && npm run build

ENV NODE_ENV=production \
    REMOTION_STATE=/data/state \
    REMOTION_OWNER_DATA=/data/owner \
    REMOTION_APK=/app/release/ReMotion.apk \
    TRUST_PROXY=1 \
    PORT=8080
EXPOSE 8080
WORKDIR /app/software/web
CMD ["node", "server/index.ts"]
