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

# Get domain name
echo ""
read -p "Enter your domain name (e.g., yourvenue.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
  echo -e "${RED}Domain name is required${NC}"
  exit 1
fi

# Get email for SSL certificates
read -p "Enter your email (for SSL certificates): " ACME_EMAIL
if [ -z "$ACME_EMAIL" ]; then
  echo -e "${RED}Email is required for SSL certificates${NC}"
  exit 1
fi

# Get GitHub repository (for container images)
read -p "Enter GitHub repository (e.g., username/equestrian-venue-manager): " GITHUB_REPO
if [ -z "$GITHUB_REPO" ]; then
  echo -e "${YELLOW}Warning: No GitHub repo specified. You'll need to build images locally.${NC}"
fi

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
ufw allow 443/tcp
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
cat > .env << EOF
# Database Configuration
POSTGRES_USER=evm
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_DB=evm_db

# Application Configuration
SECRET_KEY=${SECRET_KEY}
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Domain Configuration
DOMAIN=${DOMAIN}
FRONTEND_URL=https://${DOMAIN}

# GitHub Container Registry
GITHUB_REPOSITORY=${GITHUB_REPO}
IMAGE_TAG=latest

# Let's Encrypt Email
ACME_EMAIL=${ACME_EMAIL}

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
cat > docker-compose.yml << 'COMPOSE_EOF'
services:
  db:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-evm}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-evm_db}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-evm} -d ${POSTGRES_DB:-evm_db}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - evm-network

  backend:
    image: ghcr.io/${GITHUB_REPOSITORY}/backend:${IMAGE_TAG:-latest}
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-evm}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB:-evm_db}
      SECRET_KEY: ${SECRET_KEY}
      ACCESS_TOKEN_EXPIRE_MINUTES: ${ACCESS_TOKEN_EXPIRE_MINUTES:-30}
      REFRESH_TOKEN_EXPIRE_DAYS: ${REFRESH_TOKEN_EXPIRE_DAYS:-7}
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY:-}
      STRIPE_PUBLISHABLE_KEY: ${STRIPE_PUBLISHABLE_KEY:-}
      STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET:-}
      ARENA_BOOKING_PRICE_PER_HOUR: ${ARENA_BOOKING_PRICE_PER_HOUR:-2500}
      FRONTEND_URL: ${FRONTEND_URL:-https://your-domain.com}
    depends_on:
      db:
        condition: service_healthy
    networks:
      - evm-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=Host(`${DOMAIN}`) && PathPrefix(`/api`)"
      - "traefik.http.routers.backend.entrypoints=websecure"
      - "traefik.http.routers.backend.tls.certresolver=letsencrypt"
      - "traefik.http.services.backend.loadbalancer.server.port=8000"

  frontend:
    image: ghcr.io/${GITHUB_REPOSITORY}/frontend:${IMAGE_TAG:-latest}
    restart: unless-stopped
    depends_on:
      - backend
    networks:
      - evm-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`${DOMAIN}`)"
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
      - "--certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}"
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

echo -e "${GREEN}docker-compose.yml created${NC}"

echo ""
echo -e "${YELLOW}=============================================="
echo " IMPORTANT: DNS Configuration Required"
echo "=============================================="
echo -e "${NC}"
echo "Before continuing, ensure your domain's DNS is configured:"
echo ""
echo "  ${DOMAIN} -> $(curl -s ifconfig.me)"
echo ""
echo "Add an A record pointing to this server's IP address."
echo ""
read -p "Press Enter when DNS is configured (or Ctrl+C to exit)..."

echo ""
echo -e "${GREEN}Step 8: Logging into GitHub Container Registry...${NC}"
if [ -n "$GITHUB_REPO" ]; then
  echo "You need a GitHub Personal Access Token with 'read:packages' permission."
  echo "Create one at: https://github.com/settings/tokens"
  echo ""
  read -p "Enter your GitHub username: " GH_USER
  read -s -p "Enter your GitHub Personal Access Token: " GH_TOKEN
  echo ""

  echo "$GH_TOKEN" | docker login ghcr.io -u "$GH_USER" --password-stdin
  echo -e "${GREEN}Logged into GitHub Container Registry${NC}"
fi

echo ""
echo -e "${GREEN}Step 9: Pulling container images...${NC}"
docker compose pull

echo ""
echo -e "${GREEN}Step 10: Starting services...${NC}"
docker compose up -d

echo ""
echo -e "${GREEN}Step 11: Waiting for database to be ready...${NC}"
sleep 10

echo ""
echo -e "${GREEN}Step 12: Running database migrations...${NC}"
docker compose exec -T backend alembic upgrade head

echo ""
echo -e "${GREEN}Step 13: Creating default admin user...${NC}"
docker compose exec -T backend python scripts/init_admin.py

echo ""
echo -e "${GREEN}=============================================="
echo " Deployment Complete!"
echo "=============================================="
echo -e "${NC}"
echo ""
echo "Your application is now running at:"
echo ""
echo -e "  ${GREEN}https://${DOMAIN}${NC}"
echo ""
echo "Default admin credentials:"
echo -e "  Username: ${YELLOW}admin${NC}"
echo -e "  Password: ${YELLOW}password${NC}"
echo ""
echo -e "${RED}IMPORTANT: Change the admin password immediately after first login!${NC}"
echo ""
echo "Useful commands:"
echo "  cd /opt/evm"
echo "  docker compose logs -f          # View logs"
echo "  docker compose ps               # Check status"
echo "  docker compose restart          # Restart services"
echo "  docker compose pull && docker compose up -d  # Update"
echo ""
echo "To enable demo data, log in as admin and go to:"
echo "  Settings -> Demo Data Management -> Enable Demo Data Mode"
echo ""
