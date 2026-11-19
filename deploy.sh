#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRANCH="${DEPLOY_BRANCH:-dev}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yaml}"

cd "$APP_DIR"

echo "==> Pulling latest ${BRANCH}"
git fetch origin
git checkout "$BRANCH"
git reset --hard "origin/${BRANCH}"

echo "==> Building and starting with Docker Compose"
docker compose -f "$COMPOSE_FILE" build
docker compose -f "$COMPOSE_FILE" up -d --force-recreate --remove-orphans

echo "==> Deploy complete"
docker compose -f "$COMPOSE_FILE" ps
