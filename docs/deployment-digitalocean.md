# Deploying Equestrian Venue Manager on DigitalOcean

This guide walks you through deploying the Equestrian Venue Manager application on a DigitalOcean Droplet using the automated deployment script.

## Prerequisites

- A DigitalOcean account
- A domain name
- A GitHub Personal Access Token with `read:packages` permission ([create one here](https://github.com/settings/tokens))

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
5. Note the droplet's IP address

## Step 2: Configure DNS

Point your domain to the droplet's IP address:

1. Go to your domain registrar's DNS settings
2. Add an A record:
   - **Host**: `@` (or your subdomain)
   - **Points to**: Your droplet's IP address
   - **TTL**: 300 (or default)

Wait a few minutes for DNS to propagate.

## Step 3: Deploy with One Command

SSH into your droplet and run the deployment script:

```bash
ssh root@your-droplet-ip
```

Then run:

```bash
curl -sSL https://raw.githubusercontent.com/darrylcauldwell/Equestrian-Venue-Manager/main/deploy.sh | sudo bash
```

The script will prompt you for:
- Your domain name (e.g., `yourvenue.com`)
- Your email address (for SSL certificates)
- Your GitHub repository (e.g., `darrylcauldwell/Equestrian-Venue-Manager`)
- Your GitHub username and Personal Access Token

The script automatically:
- Updates the system
- Installs Docker and Docker Compose
- Configures the firewall (ports 80, 443, SSH)
- Generates secure passwords and secret keys
- Creates all configuration files
- Pulls and starts all containers
- Sets up automatic SSL with Let's Encrypt
- Runs database migrations
- Creates the default admin user

## Step 4: Access Your Application

Once deployment completes, visit your domain: `https://your-domain.com`

**Default admin credentials:**
- Username: `admin`
- Password: `password`

**IMPORTANT: Change the admin password immediately after first login!**

## Post-Deployment Tasks

### Change Admin Password

1. Log in as admin
2. Go to your profile settings
3. Change the password to a secure one

### Configure Site Settings

1. Navigate to Admin → Settings
2. Configure venue name, contact information, and other preferences

### Enable Demo Data (Optional)

To explore the application with sample data:

1. Navigate to Admin → Settings
2. Scroll to "Demo Data" section
3. Click "Enable Demo Data Mode"

## Maintenance Commands

All commands should be run from `/opt/evm`:

```bash
cd /opt/evm

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f backend
docker compose logs -f frontend

# Check container status
docker compose ps

# Restart services
docker compose restart

# Update to latest version
docker compose pull && docker compose up -d

# Run database migrations (after update)
docker compose exec backend alembic upgrade head

# Backup database
docker compose exec db pg_dump -U evm evm_db > backup-$(date +%Y%m%d).sql

# Restore database
cat backup-20240101.sql | docker compose exec -T db psql -U evm evm_db
```

## Troubleshooting

### Application Won't Start

```bash
# Check logs
docker compose logs -f

# Check disk space
df -h

# Check memory
free -m
```

### SSL Certificate Issues

1. Verify domain DNS is pointing to your droplet: `dig your-domain.com`
2. Check Traefik logs: `docker compose logs traefik`
3. Ensure ports 80 and 443 are open: `ufw status`

### Container Images Not Found

1. Re-login to GitHub Container Registry:
   ```bash
   echo "YOUR_PAT" | docker login ghcr.io -u YOUR_USERNAME --password-stdin
   ```
2. Pull images again: `docker compose pull`

### Database Connection Issues

```bash
# Check database container
docker compose logs db

# Verify database is healthy
docker compose ps
```

## Security Recommendations

1. **Change default passwords** immediately after deployment
2. **Use SSH keys** instead of password authentication
3. **Keep system updated**: Run `apt update && apt upgrade -y` regularly
4. **Backup database** regularly
5. **Monitor logs** for suspicious activity

## Updating the Application

When new versions are released:

```bash
cd /opt/evm
docker compose pull
docker compose up -d
docker compose exec backend alembic upgrade head
```

## Uninstalling

To completely remove the application:

```bash
cd /opt/evm
docker compose down -v  # Warning: This deletes all data!
rm -rf /opt/evm
```
