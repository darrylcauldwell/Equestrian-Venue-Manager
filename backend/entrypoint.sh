#!/bin/bash
set -e

echo "=== Equestrian Venue Manager Backend Starting ==="

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until PGPASSWORD=$POSTGRES_PASSWORD psql -h "db" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\q' 2>/dev/null; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done

echo "PostgreSQL is up - continuing..."

# Run Alembic migrations (idempotent - only runs new migrations)
echo "Running database migrations..."
alembic upgrade head

# Ensure admin user exists (idempotent - only creates if no admin exists)
echo "Ensuring admin user exists..."
python scripts/init_admin.py

# Breakglass: Reset admin password if requested
if [ "$RESET_ADMIN_PASSWORD" = "true" ]; then
  echo "BREAKGLASS: Resetting admin password..."
  python scripts/reset_admin_password.py
  echo "Admin password has been reset to default"
fi

echo "=== Starting FastAPI application ==="

# Execute the main command (uvicorn server)
exec "$@"
