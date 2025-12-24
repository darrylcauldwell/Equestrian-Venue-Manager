# Deploying Equestrian Venue Manager on DigitalOcean

This guide walks you through deploying the Equestrian Venue Manager application on a DigitalOcean Droplet.

## Prerequisites

- A DigitalOcean account
- A domain name pointed to your droplet's IP address
- Basic familiarity with Linux command line

## Step 1: Create a DigitalOcean Droplet

1. Log in to your DigitalOcean account
2. Click "Create" → "Droplets"
3. Choose the following settings:
   - **Region**: Choose the region closest to your users
   - **Image**: Ubuntu 22.04 LTS
   - **Size**:
     - Minimum: Basic Plan, 2GB RAM / 1 vCPU ($12/month)
     - Recommended: Basic Plan, 4GB RAM / 2 vCPUs ($24/month)
   - **Authentication**: SSH Key (recommended) or Password
4. Click "Create Droplet"

## Step 2: Initial Server Setup

Connect to your droplet via SSH:

```bash
ssh root@your-droplet-ip
```

### Update System

```bash
apt update && apt upgrade -y
```

### Create a Non-Root User (Recommended)

```bash
adduser evm
usermod -aG sudo evm
```

### Configure Firewall

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

## Step 3: Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Add user to docker group
usermod -aG docker evm

# Install Docker Compose plugin
apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version
```

## Step 4: Set Up the Application

### Create Application Directory

```bash
mkdir -p /opt/evm
cd /opt/evm
```

### Download Production Docker Compose File

```bash
curl -o docker-compose.yml https://raw.githubusercontent.com/YOUR-ORG/equestrian-venue-manager/main/docker-compose.prod.yml
```

Or create it manually (copy contents from `docker-compose.prod.yml` in the repository).

### Create Environment File

```bash
nano .env
```

Add the following configuration:

```env
# Database Configuration
POSTGRES_USER=evm
POSTGRES_PASSWORD=your-secure-database-password-here
POSTGRES_DB=evm_db

# Application Configuration
SECRET_KEY=your-very-long-random-secret-key-here

# Domain Configuration
DOMAIN=your-domain.com

# GitHub Container Registry
GITHUB_REPOSITORY=your-org/equestrian-venue-manager
IMAGE_TAG=latest

# Let's Encrypt Email (for SSL certificates)
ACME_EMAIL=your-email@example.com

# Traefik Dashboard Auth (optional)
# Generate with: echo $(htpasswd -nb admin your-password) | sed -e s/\\$/\\$\\$/g
TRAEFIK_AUTH=admin:$$apr1$$xxx$$xxxxxxxxxxxxxxxxxxxxxxxx
```

Generate a secure secret key:

```bash
openssl rand -hex 32
```

Generate Traefik dashboard password:

```bash
# Install apache2-utils for htpasswd
apt install apache2-utils -y
echo $(htpasswd -nb admin your-password) | sed -e s/\\$/\\$\\$/g
```

### Log in to GitHub Container Registry

```bash
# Use a GitHub Personal Access Token with packages:read permission
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

## Step 5: Start the Application

```bash
cd /opt/evm
docker compose -f docker-compose.yml up -d
```

**That's it!** The application will automatically:
- Wait for the database to be ready
- Run all database migrations
- Seed demo data (on first start only)
- Create the default admin user with:
  - Username: `admin`
  - Password: `password`
- Start the application

**Important**: Change the admin password immediately after first login!

## Step 6: Verify Deployment

1. Check all containers are running:
   ```bash
   docker compose ps
   ```

2. Check container logs:
   ```bash
   docker compose logs -f
   ```

3. Visit your domain in a browser: `https://your-domain.com`

4. Log in with the default admin credentials:
   - Username: `admin`
   - Password: `password`

## Post-Deployment Tasks

### Change Admin Password

1. Log in as admin
2. Go to your profile settings
3. Change the password to a secure one

### Configure Site Settings

1. Navigate to Admin → Settings
2. Configure:
   - Site name
   - Contact information
   - Business hours
   - Other preferences

### Configure Stripe Payments (Optional)

To enable guest arena booking payments:

1. Navigate to Admin → Settings → Payment Settings
2. Toggle "Enable Stripe Payments"
3. Enter your Stripe API keys from the [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
4. Configure webhook endpoint:
   - In Stripe Dashboard, go to [Webhooks](https://dashboard.stripe.com/webhooks)
   - Add endpoint: `https://your-domain.com/api/payments/webhook`
   - Select event: `checkout.session.completed`
   - Copy the webhook signing secret and paste in Settings
5. Save settings

### Enable Demo Data (Optional)

If you want to explore the application with sample data:

1. Navigate to Admin → Settings
2. Scroll to "Demo Data" section
3. Click "Enable Demo Data Mode"

This will populate the system with sample:
- Users (livery clients, staff, coaches)
- Horses
- Arenas
- Bookings
- And other sample data

To remove demo data later, click "Clean Demo Data" in the same section.

## Maintenance

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
```

### Update Application

```bash
cd /opt/evm

# Pull latest images
docker compose pull

# Restart with new images
docker compose up -d

# Run migrations (if needed)
docker compose exec backend alembic upgrade head
```

### Backup Database

```bash
# Create backup
docker compose exec db pg_dump -U evm evm_db > backup-$(date +%Y%m%d).sql

# Restore backup
cat backup-20240101.sql | docker compose exec -T db psql -U evm evm_db
```

### SSL Certificate Renewal

Traefik automatically handles SSL certificate renewal via Let's Encrypt. Certificates are stored in the `letsencrypt` volume.

## Troubleshooting

### Application Won't Start

1. Check logs: `docker compose logs -f`
2. Verify environment variables: `cat .env`
3. Check disk space: `df -h`
4. Check memory: `free -m`

### Database Connection Issues

1. Check database container: `docker compose logs db`
2. Verify DATABASE_URL in backend logs
3. Ensure PostgreSQL is healthy: `docker compose ps`

### SSL Certificate Issues

1. Verify domain DNS is pointing to your droplet
2. Check Traefik logs: `docker compose logs traefik`
3. Ensure ports 80 and 443 are open

### Container Images Not Found

1. Verify you're logged in to ghcr.io
2. Check GITHUB_REPOSITORY environment variable
3. Ensure images are publicly accessible or PAT has correct permissions

## Security Recommendations

1. **Change default passwords** immediately after deployment
2. **Enable UFW firewall** and only allow necessary ports
3. **Use SSH keys** instead of password authentication
4. **Keep system updated**: `apt update && apt upgrade -y`
5. **Monitor logs** regularly for suspicious activity
6. **Backup database** regularly
7. **Use strong passwords** for all accounts

## Resource Scaling

If you need more resources:

1. **Vertical Scaling**: Resize your droplet in DigitalOcean dashboard
2. **Database Performance**: Consider DigitalOcean Managed Databases
3. **CDN**: Use DigitalOcean Spaces or Cloudflare for static assets
4. **Load Balancing**: Use DigitalOcean Load Balancers for high availability
