# Deploying Equestrian Venue Manager on DigitalOcean

This guide walks you through deploying the Equestrian Venue Manager application on a DigitalOcean Droplet.

## Prerequisites

- A DigitalOcean account
- (Optional) A domain name for SSL - you can deploy with just an IP address

## Deployment Options

| Option | SSL | Requirements |
|--------|-----|--------------|
| IP Address Only | No (HTTP) | Just a droplet |
| Domain with SSL | Yes (HTTPS) | Domain + email for certificates |

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

## Step 2: Configure DNS (Optional - for SSL)

If you want SSL (HTTPS), point your domain to the droplet:

1. Go to your domain registrar's DNS settings
2. Add an A record:
   - **Host**: `@` (or your subdomain)
   - **Points to**: Your droplet's IP address
   - **TTL**: 300 (or default)
3. Wait 5-10 minutes for DNS to propagate
4. Verify: `dig your-domain.com` should show your droplet IP

## Step 3: Deploy

SSH into your droplet:

```bash
ssh root@your-droplet-ip
```

Run the deployment script:

```bash
curl -sSL https://raw.githubusercontent.com/darrylcauldwell/Equestrian-Venue-Manager/main/deploy.sh | sudo bash
```

The script will prompt you for:
- **Domain/IP**: Enter your domain name OR press Enter to use the detected IP
- **SSL**: If using a domain, whether to enable SSL (recommended)
- **Email**: If enabling SSL, your email for Let's Encrypt certificates
- **GitHub repo**: Press Enter for the default repository

The script automatically:
- Updates the system
- Installs Docker and Docker Compose
- Configures the firewall
- Generates secure passwords
- Pulls container images from GitHub Container Registry
- Runs database migrations
- Creates the admin user

## Step 4: Access Your Application

Once deployment completes (typically 3-5 minutes):

**With domain + SSL:**
```
https://your-domain.com
```

**With IP only:**
```
http://your-droplet-ip
```

**Default admin credentials:**
- Username: `admin`
- Password: `password`

**IMPORTANT: Change the admin password immediately!**

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      DigitalOcean Droplet                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐                                            │
│  │   Traefik   │ ← Port 80/443 (with SSL)                   │
│  │  or nginx   │ ← Port 80 (IP-only mode)                   │
│  └──────┬──────┘                                            │
│         │                                                   │
│    ┌────┴────┐                                              │
│    │         │                                              │
│ ┌──▼──┐  ┌───▼───┐  ┌────────┐                              │
│ │Front│  │Backend│  │Database│                              │
│ │ end │  │  API  │──│ Postgres│                             │
│ │React│  │FastAPI│  │        │                              │
│ └─────┘  └───────┘  └────────┘                              │
│                                                             │
│  Container Network: evm-network                             │
└─────────────────────────────────────────────────────────────┘
```

## Maintenance Commands

All commands run from `/opt/evm`:

```bash
cd /opt/evm

# View all logs
docker compose logs -f

# View specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db

# Check status
docker compose ps

# Restart all services
docker compose restart

# Restart specific service
docker compose restart backend
```

## Updating the Application

```bash
cd /opt/evm
docker compose pull
docker compose up -d
docker compose exec -T backend alembic upgrade head
```

## Database Operations

### Backups

The application provides **two backup methods**:

#### 1. Admin UI (Recommended)
Access via **Admin → Settings → Backups**:

- **Database Backup** (pg_dump): Full PostgreSQL dump for disaster recovery
  - Click "Create Database Backup"
  - Download the .sql file to your laptop
  - Recommended: Weekly

- **Data Export** (JSON): Human-readable export for seeding/portability
  - Click "Export Data Now"
  - Useful for setting up new environments
  - Can be scheduled automatically

#### 2. Command Line (Direct)
```bash
cd /opt/evm

# Create database backup
docker compose exec -T db pg_dump -U evm evm_db > backup-$(date +%Y%m%d).sql

# Restore from backup
cat backup.sql | docker compose exec -T db psql -U evm evm_db
```

### Database Shell Access
```bash
docker compose exec db psql -U evm evm_db
```

### Backup Best Practices
1. **Download Database Backups** to your laptop weekly
2. Keep at least 4 weeks of backups
3. Test restore process periodically
4. Store backups off-server (laptop, S3, etc.)

## Troubleshooting

### Cannot Access Application

1. **Check containers are running:**
   ```bash
   cd /opt/evm
   docker compose ps
   ```
   All containers should show "Up" status.

2. **Check firewall:**
   ```bash
   ufw status
   ```
   Ports 80 (and 443 if SSL) should be allowed.

3. **Check logs:**
   ```bash
   docker compose logs --tail=50
   ```

### Login Fails with "Invalid username or password"

The admin user may not have been created. Create it manually:

```bash
cd /opt/evm
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
```

### Database Connection Errors

If you see "password authentication failed":

```bash
cd /opt/evm

# Remove old data and start fresh
docker compose down -v
docker compose up -d

# Wait for startup, then run migrations
sleep 30
docker compose exec -T backend alembic upgrade head
```

### Backend Not Starting

Check backend logs:
```bash
docker compose logs backend --tail=100
```

Common issues:
- Database not ready: Wait and restart backend
- Migration errors: Check migration logs

### SSL Certificate Issues

1. Verify DNS is propagated:
   ```bash
   dig your-domain.com
   ```
   Should show your droplet IP.

2. Check Traefik logs:
   ```bash
   docker compose logs traefik
   ```

3. Rate limits: Let's Encrypt has rate limits. Wait an hour if you've made many attempts.

### API Returns 404

If the frontend loads but API calls fail:

1. Check if backend is healthy:
   ```bash
   docker compose exec -T backend curl -f http://localhost:8000/api/health
   ```

2. Check nginx/traefik routing:
   ```bash
   docker compose logs nginx   # IP-only mode
   docker compose logs traefik # SSL mode
   ```

### Out of Memory

If containers keep restarting:

```bash
# Check memory
free -m

# Check Docker memory usage
docker stats --no-stream
```

Consider upgrading to a larger droplet (4GB RAM recommended).

### Disk Space

```bash
# Check disk usage
df -h

# Clean up Docker
docker system prune -a
```

## Fresh Reinstall

To completely remove and reinstall:

```bash
cd /opt/evm
docker compose down -v
rm -rf /opt/evm

# Then re-run the deployment script
curl -sSL https://raw.githubusercontent.com/darrylcauldwell/Equestrian-Venue-Manager/main/deploy.sh | sudo bash
```

## Security Recommendations

1. **Change default passwords** immediately after deployment
2. **Use SSH keys** instead of password authentication
3. **Keep system updated**: Run `apt update && apt upgrade -y` regularly
4. **Enable automatic updates**:
   ```bash
   apt install unattended-upgrades
   dpkg-reconfigure unattended-upgrades
   ```
5. **Backup database** regularly
6. **Monitor logs** for suspicious activity

## Configuration

All configuration is in `/opt/evm/.env`:

```bash
# View current config
cat /opt/evm/.env

# Edit config (then restart)
nano /opt/evm/.env
docker compose restart
```

Key settings:
- `POSTGRES_PASSWORD`: Database password (auto-generated)
- `SECRET_KEY`: JWT signing key (auto-generated)
- `FRONTEND_URL`: Public URL of the application
- `STRIPE_*`: Payment integration (optional)
