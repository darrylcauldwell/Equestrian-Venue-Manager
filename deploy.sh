#!/bin/bash
#
# Equestrian Venue Manager - Deployment Script
#
# Run this script on a fresh Ubuntu 22.04 droplet:
#   curl -sSL https://raw.githubusercontent.com/darrylcauldwell/Equestrian-Venue-Manager/main/deploy.sh | sudo bash
#
# Or download and run:
#   curl -O https://raw.githubusercontent.com/darrylcauldwell/Equestrian-Venue-Manager/main/deploy.sh
#   chmod +x deploy.sh
#   sudo ./deploy.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}"
echo "=============================================="
echo " Equestrian Venue Manager - Deployment Script"
echo "=============================================="
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root (use sudo)${NC}"
  exit 1
fi

# Get server address (domain or IP)
echo ""
echo "Enter your domain name OR IP address."
echo "Examples: yourvenue.com OR 167.71.133.139"
echo ""
# Try to detect the server's public IP first
DETECTED_IP=$(curl -s ifconfig.me 2>/dev/null || echo "")

echo -n "Domain/IP"
if [ -n "$DETECTED_IP" ]; then
  echo -n " [${DETECTED_IP}]"
fi
echo -n ": "
read SERVER_ADDRESS < /dev/tty

# Use detected IP if nothing entered
if [ -z "$SERVER_ADDRESS" ] && [ -n "$DETECTED_IP" ]; then
  SERVER_ADDRESS="$DETECTED_IP"
  echo "Using: $SERVER_ADDRESS"
elif [ -z "$SERVER_ADDRESS" ]; then
  echo -e "${RED}No IP address entered and could not auto-detect.${NC}"
  exit 1
fi

# Determine if this is an IP address or domain
if [[ "$SERVER_ADDRESS" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  IS_IP=true
  USE_SSL=false
  echo -e "${YELLOW}Detected IP address - will configure HTTP only (no SSL)${NC}"
else
  IS_IP=false
  # Ask about SSL for domain names
  read -p "Enable SSL with Let's Encrypt? (y/n, default: y): " ENABLE_SSL < /dev/tty
  if [ "$ENABLE_SSL" = "n" ] || [ "$ENABLE_SSL" = "N" ]; then
    USE_SSL=false
  else
    USE_SSL=true
    read -p "Enter your email (for SSL certificates): " ACME_EMAIL < /dev/tty
    if [ -z "$ACME_EMAIL" ]; then
      echo -e "${RED}Email is required for SSL certificates${NC}"
      exit 1
    fi
  fi
fi

# Get GitHub repository (for container images)
echo ""
read -p "Enter GitHub repository (default: darrylcauldwell/equestrian-venue-manager): " GITHUB_REPO < /dev/tty
if [ -z "$GITHUB_REPO" ]; then
  GITHUB_REPO="darrylcauldwell/equestrian-venue-manager"
fi
# Ensure lowercase for Docker
GITHUB_REPO=$(echo "$GITHUB_REPO" | tr '[:upper:]' '[:lower:]')

echo ""
echo -e "${GREEN}Step 1: Updating system...${NC}"
apt update && apt upgrade -y

echo ""
echo -e "${GREEN}Step 2: Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com -o get-docker.sh
  sh get-docker.sh
  rm get-docker.sh

  # Install Docker Compose plugin
  apt install -y docker-compose-plugin

  echo -e "${GREEN}Docker installed successfully${NC}"
else
  echo -e "${YELLOW}Docker already installed${NC}"
fi

# Verify Docker
docker --version
docker compose version

echo ""
echo -e "${GREEN}Step 3: Setting up firewall...${NC}"
ufw allow OpenSSH
ufw allow 80/tcp
if [ "$USE_SSL" = true ]; then
  ufw allow 443/tcp
fi
ufw --force enable
echo -e "${GREEN}Firewall configured${NC}"

echo ""
echo -e "${GREEN}Step 4: Creating application directory...${NC}"
mkdir -p /opt/evm
cd /opt/evm

echo ""
echo -e "${GREEN}Step 5: Generating secure passwords...${NC}"
DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
SECRET_KEY=$(openssl rand -hex 32)

echo ""
echo -e "${GREEN}Step 6: Creating environment file...${NC}"

if [ "$USE_SSL" = true ]; then
  FRONTEND_URL="https://${SERVER_ADDRESS}"
else
  FRONTEND_URL="http://${SERVER_ADDRESS}"
fi

cat > .env << EOF
# Database Configuration
POSTGRES_USER=evm
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_DB=evm_db

# Application Configuration
SECRET_KEY=${SECRET_KEY}
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Server Configuration
SERVER_ADDRESS=${SERVER_ADDRESS}
FRONTEND_URL=${FRONTEND_URL}
USE_SSL=${USE_SSL}

# GitHub Container Registry
GITHUB_REPOSITORY=${GITHUB_REPO}
IMAGE_TAG=latest

# Let's Encrypt Email (only used if SSL enabled)
ACME_EMAIL=${ACME_EMAIL:-}

# Stripe Configuration (optional - add later if needed)
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
ARENA_BOOKING_PRICE_PER_HOUR=2500
EOF

chmod 600 .env
echo -e "${GREEN}Environment file created at /opt/evm/.env${NC}"

echo ""
echo -e "${GREEN}Step 7: Creating docker-compose.yml...${NC}"

if [ "$USE_SSL" = true ]; then
  # Full setup with Traefik and SSL
  cat > docker-compose.yml << COMPOSE_EOF
services:
  db:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: \${POSTGRES_USER:-evm}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
      POSTGRES_DB: \${POSTGRES_DB:-evm_db}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER:-evm} -d \${POSTGRES_DB:-evm_db}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - evm-network

  backend:
    image: ghcr.io/\${GITHUB_REPOSITORY}/backend:\${IMAGE_TAG:-latest}
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://\${POSTGRES_USER:-evm}:\${POSTGRES_PASSWORD}@db:5432/\${POSTGRES_DB:-evm_db}
      POSTGRES_USER: \${POSTGRES_USER:-evm}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
      POSTGRES_DB: \${POSTGRES_DB:-evm_db}
      SECRET_KEY: \${SECRET_KEY}
      ACCESS_TOKEN_EXPIRE_MINUTES: \${ACCESS_TOKEN_EXPIRE_MINUTES:-30}
      REFRESH_TOKEN_EXPIRE_DAYS: \${REFRESH_TOKEN_EXPIRE_DAYS:-7}
      STRIPE_SECRET_KEY: \${STRIPE_SECRET_KEY:-}
      STRIPE_PUBLISHABLE_KEY: \${STRIPE_PUBLISHABLE_KEY:-}
      STRIPE_WEBHOOK_SECRET: \${STRIPE_WEBHOOK_SECRET:-}
      ARENA_BOOKING_PRICE_PER_HOUR: \${ARENA_BOOKING_PRICE_PER_HOUR:-2500}
      FRONTEND_URL: \${FRONTEND_URL}
    depends_on:
      db:
        condition: service_healthy
    networks:
      - evm-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=Host(\`\${SERVER_ADDRESS}\`) && PathPrefix(\`/api\`)"
      - "traefik.http.routers.backend.entrypoints=websecure"
      - "traefik.http.routers.backend.tls.certresolver=letsencrypt"
      - "traefik.http.services.backend.loadbalancer.server.port=8000"

  frontend:
    image: ghcr.io/\${GITHUB_REPOSITORY}/frontend:\${IMAGE_TAG:-latest}
    restart: unless-stopped
    depends_on:
      - backend
    networks:
      - evm-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(\`\${SERVER_ADDRESS}\`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
      - "traefik.http.services.frontend.loadbalancer.server.port=80"

  traefik:
    image: traefik:v2.10
    restart: unless-stopped
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--entrypoints.web.http.redirections.entrypoint.to=websecure"
      - "--entrypoints.web.http.redirections.entrypoint.scheme=https"
      - "--certificatesresolvers.letsencrypt.acme.email=\${ACME_EMAIL}"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - letsencrypt:/letsencrypt
    networks:
      - evm-network

volumes:
  postgres_data:
  letsencrypt:

networks:
  evm-network:
    driver: bridge
COMPOSE_EOF

else
  # Simple setup without SSL - direct port mapping
  cat > docker-compose.yml << COMPOSE_EOF
services:
  db:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: \${POSTGRES_USER:-evm}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
      POSTGRES_DB: \${POSTGRES_DB:-evm_db}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER:-evm} -d \${POSTGRES_DB:-evm_db}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - evm-network

  backend:
    image: ghcr.io/\${GITHUB_REPOSITORY}/backend:\${IMAGE_TAG:-latest}
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://\${POSTGRES_USER:-evm}:\${POSTGRES_PASSWORD}@db:5432/\${POSTGRES_DB:-evm_db}
      POSTGRES_USER: \${POSTGRES_USER:-evm}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
      POSTGRES_DB: \${POSTGRES_DB:-evm_db}
      SECRET_KEY: \${SECRET_KEY}
      ACCESS_TOKEN_EXPIRE_MINUTES: \${ACCESS_TOKEN_EXPIRE_MINUTES:-30}
      REFRESH_TOKEN_EXPIRE_DAYS: \${REFRESH_TOKEN_EXPIRE_DAYS:-7}
      STRIPE_SECRET_KEY: \${STRIPE_SECRET_KEY:-}
      STRIPE_PUBLISHABLE_KEY: \${STRIPE_PUBLISHABLE_KEY:-}
      STRIPE_WEBHOOK_SECRET: \${STRIPE_WEBHOOK_SECRET:-}
      ARENA_BOOKING_PRICE_PER_HOUR: \${ARENA_BOOKING_PRICE_PER_HOUR:-2500}
      FRONTEND_URL: \${FRONTEND_URL}
    depends_on:
      db:
        condition: service_healthy
    networks:
      - evm-network

  frontend:
    image: ghcr.io/\${GITHUB_REPOSITORY}/frontend:\${IMAGE_TAG:-latest}
    restart: unless-stopped
    depends_on:
      - backend
    networks:
      - evm-network

  # Nginx reverse proxy for API routing (no SSL)
  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - frontend
      - backend
    networks:
      - evm-network

volumes:
  postgres_data:

networks:
  evm-network:
    driver: bridge
COMPOSE_EOF

  # Create nginx config for routing
  cat > nginx.conf << 'NGINX_EOF'
events {
    worker_connections 1024;
}

http {
    upstream frontend {
        server frontend:80;
    }

    upstream backend {
        server backend:8000;
    }

    server {
        listen 80;
        server_name _;

        # API requests go to backend
        location /api {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Everything else goes to frontend
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
NGINX_EOF

fi

echo -e "${GREEN}docker-compose.yml created${NC}"

echo ""
echo -e "${GREEN}Step 8: Pulling container images...${NC}"
docker compose pull

echo ""
echo -e "${GREEN}Step 9: Starting services...${NC}"
docker compose up -d

echo ""
echo -e "${GREEN}Step 10: Waiting for services to be ready...${NC}"
echo "Waiting for database..."
sleep 10

# Wait for backend to be responsive (up to 60 seconds)
echo "Waiting for backend API..."
for i in {1..30}; do
  if docker compose exec -T backend curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
    echo "Backend is ready!"
    break
  fi
  echo "  Waiting... ($i/30)"
  sleep 2
done

echo ""
echo -e "${GREEN}Step 11: Running database migrations...${NC}"
docker compose exec -T backend alembic upgrade head

echo ""
echo -e "${GREEN}Step 12: Creating admin user...${NC}"
# Try the script first, fall back to inline Python if script doesn't exist
docker compose exec -T backend python scripts/init_database.py 2>/dev/null || \
docker compose exec -T backend python -c "
from app.database import SessionLocal
from app.models.user import User, UserRole
from app.utils.auth import get_password_hash
db = SessionLocal()
if not db.query(User).filter(User.username == 'admin').first():
    admin = User(username='admin', email='admin@example.com', name='Administrator', password_hash=get_password_hash('password'), role=UserRole.ADMIN, is_active=True, must_change_password=True)
    db.add(admin)
    db.commit()
    print('Admin user created')
else:
    print('Admin user already exists')
db.close()
"

echo ""
echo -e "${GREEN}=============================================="
echo " Deployment Complete!"
echo "=============================================="
echo -e "${NC}"
echo ""
echo "Your application is now running at:"
echo ""
echo -e "  ${GREEN}${FRONTEND_URL}${NC}"
echo ""
echo "Default admin credentials:"
echo -e "  Username: ${YELLOW}admin${NC}"
echo -e "  Password: ${YELLOW}password${NC}"
echo ""
echo -e "${RED}IMPORTANT: Change the admin password immediately after first login!${NC}"
echo ""
echo "To load demo data (optional):"
echo "  Log in as admin > Settings > Demo Data > Enable Demo Data"
echo ""
echo "Useful commands:"
echo "  cd /opt/evm"
echo "  docker compose logs -f          # View logs"
echo "  docker compose ps               # Check status"
echo "  docker compose restart          # Restart services"
echo "  docker compose pull && docker compose up -d  # Update"
echo ""
