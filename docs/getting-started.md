# Getting Started

This guide covers setting up the Equestrian Venue Manager for local development.

## Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local frontend development)
- Python 3.11+ (for local backend development)

## Quick Start with Docker

### 1. Clone the Repository

```bash
git clone https://github.com/darrylcauldwell/Equestrian-Venue-Manager.git
cd Equestrian-Venue-Manager
```

### 2. Create Environment File (Optional)

```bash
cp .env.example .env
```

Edit `.env` with your settings (see [Environment Variables](#environment-variables) below).
The application will work with default values if you skip this step.

### 3. Start the Application

```bash
docker compose up --build
```

**That's it!** The application will automatically:
- ✅ Wait for the database to be ready
- ✅ Run all database migrations
- ✅ Seed the database with demo data (on first start)
- ✅ Create the default admin user
- ✅ Start the application

### 4. Access the Application

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Documentation | http://localhost:8000/docs |

### 5. Login

Default admin credentials:
- **Username**: `admin`
- **Password**: `password`


### Stop and remove

```shell
docker compose down -v --remove-orphans
```

**You will be required to change this password on first login.**

---

## Development Modes

This project supports two development modes:

### Development Mode (Default)

Hot-reload enabled for rapid development:

```bash
docker compose up --build
# Or use Make:
make dev
```

- Frontend with Vite hot reload on http://localhost:3000
- Backend with uvicorn auto-reload on http://localhost:8000
- Volume mounts for instant code changes
- Best for: Writing code, debugging, rapid iteration

### Test Mode (Production-like)

Matches CI environment for catching issues before push:

```bash
./scripts/test-mode.sh up
```

- Production Dockerfiles (static frontend build)
- Nginx proxy (single origin, like production)
- Backend healthchecks enabled
- Fresh test database with E2E fixtures
- Best for: Running E2E tests, catching CI issues locally

#### Running E2E Tests in Test Mode

```bash
# Basic test run
./scripts/test-mode.sh test

# Or with CI-like sharding (4 parallel shards)
SHARDS=4 ./scripts/run-e2e-tests.sh

# Full CI-like test suite
make test
```

#### Test Mode Commands

| Command | Description |
|---------|-------------|
| `./scripts/test-mode.sh up` | Start test environment |
| `./scripts/test-mode.sh down` | Stop and clean up |
| `./scripts/test-mode.sh logs` | View container logs |
| `./scripts/test-mode.sh test` | Run E2E tests |

#### Make Commands

| Command | Description |
|---------|-------------|
| `make dev` | Start development mode with hot reload |
| `make test` | Full CI-like test suite (build + lint + unit + e2e) |
| `make unit` | Run backend + frontend unit tests |
| `make e2e` | Run E2E tests in production-like environment |
| `make e2e-sharded` | Run E2E with 4 parallel shards (like CI) |
| `make lint` | Run linting and TypeScript checks |
| `make clean` | Clean up all containers |

#### When to Use Test Mode

Use test mode before pushing to CI when you've:
- Changed Docker configurations
- Modified nginx settings
- Updated Playwright tests
- Changed authentication flow
- Made significant frontend changes

This catches issues locally (~5 min) instead of waiting for CI (~30 min).

---

## Initial Setup (After First Login)

1. **Log in as admin** at http://localhost:3000/login

2. **Create Arenas**
   - Go to Admin > Arenas
   - Click "+ Add Arena"
   - Create your arenas (e.g., Indoor Arena, Outdoor Arena, Round Pen)

3. **Manage Users**
   - Users register via the public registration page
   - Go to Admin > Users to view all users
   - Change user roles as needed (livery, staff, coach)

4. **Configure Payments (Optional)**
   - Go to Admin > Settings > Payment Settings
   - Enable Stripe payments for guest arena bookings
   - Enter your Stripe API keys from the [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
   - Configure webhooks for automated payment confirmation

5. **Configure Weather (Optional)**
   - Go to Admin > Settings
   - Enter your postcode for weather forecasts
   - Optionally override with manual coordinates

6. **Enable Demo Data (Optional)**
   - Go to Admin > Settings
   - Click "Enable Demo Data Mode" to populate sample data
   - This creates sample users, horses, bookings, and other test data

---

## Breakglass: Reset Admin Password

If you've lost access to the admin account, you can reset the password using one of two methods:

### Method 1: Environment Variable (Recommended)

Stop the containers, set the environment variable, and restart:

```bash
docker compose down
RESET_ADMIN_PASSWORD=true docker compose up
```

The admin password will be reset to `password` on startup, then the container continues running normally.

### Method 2: Manual Script Execution

If the containers are already running:

```bash
docker compose exec backend python scripts/reset_admin_password.py
```

**Important:** After using either method:
1. Login with username `admin` and password `password`
2. You will be forced to change the password on first login
3. Choose a strong, unique password

---

## Local Development

### Backend Development

For local backend development without Docker:

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Start PostgreSQL only (from root directory)
cd ..
docker compose up db -d
cd backend

# Run migrations
alembic upgrade head

# Create admin user (if needed)
python scripts/init_admin.py

# Optionally seed demo data (if starting fresh)
python scripts/seed_database.py

# Start the server with hot reload
uvicorn app.main:app --reload
```

**Note:** When using Docker (`docker compose up`), migrations, seeding, and admin creation happen automatically.

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

The frontend development server runs on http://localhost:5173 and proxies API requests to the backend.

---

## Environment Variables

Create a `.env` file in the root directory:

```env
# Database
POSTGRES_USER=evm
POSTGRES_PASSWORD=evm_password
POSTGRES_DB=evm_db
DATABASE_URL=postgresql://evm:evm_password@db:5432/evm_db

# Security
SECRET_KEY=your-secure-secret-key-change-in-production
```

---

## Testing

### Backend Tests

```bash
cd backend
pytest --cov=app tests/
```

### Frontend Unit Tests

```bash
cd frontend
npm test
```

### End-to-End Tests

```bash
cd frontend
npx playwright test
```

---

## API Documentation

Interactive API documentation is available at http://localhost:8000/docs when running the backend.

For complete endpoint documentation, see [API_REFERENCE.md](./API_REFERENCE.md).

### Key Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get tokens
- `POST /api/auth/refresh` - Refresh access token

#### Users (Admin)
- `GET /api/users/` - List all users
- `PUT /api/users/{id}/role` - Update user role

#### Arenas & Bookings
- `GET /api/arenas/` - List active arenas
- `POST /api/arenas/` - Create arena (admin)
- `GET /api/bookings/public` - Public calendar view
- `POST /api/bookings/guest` - Guest booking (with payment)
- `POST /api/bookings/` - Authenticated booking

#### Horses & Health
- `GET /api/horses/` - List user's horses
- `POST /api/horses/` - Add horse
- `GET /api/horses/{id}/health-records` - Health records
- `GET /api/horses/{id}/feed` - Feed requirements
- `POST /api/medication-logs/` - Log medication
- `GET /api/rehab/programs` - List rehab programs

#### Livery & Billing
- `GET /api/livery-packages/` - List livery packages
- `POST /api/services/` - Create service request
- `GET /api/invoices/my` - View user invoices
- `POST /api/billing/run-monthly-billing` - Run monthly billing (admin)

#### Payments
- `GET /api/payments/config` - Stripe configuration
- `POST /api/payments/create-checkout` - Create Stripe checkout
- `POST /api/payments/webhook` - Stripe webhook

---

## Project Structure

```
├── docker-compose.yml          # Development compose file
├── docker-compose.prod.yml     # Production compose with Traefik
├── backend/
│   ├── Dockerfile              # Development Dockerfile
│   ├── Dockerfile.prod         # Production Dockerfile
│   ├── requirements.txt
│   ├── alembic/                # Database migrations
│   ├── scripts/
│   │   ├── init_admin.py       # Initial admin setup
│   │   └── seed_database.py    # Demo data seeding
│   ├── app/
│   │   ├── main.py             # FastAPI application
│   │   ├── config.py           # Configuration
│   │   ├── database.py         # Database connection
│   │   ├── models/             # SQLAlchemy models
│   │   ├── schemas/            # Pydantic schemas
│   │   ├── routers/            # API endpoints
│   │   └── utils/              # Utilities (auth, etc.)
│   └── tests/
├── frontend/
│   ├── Dockerfile              # Development Dockerfile
│   ├── Dockerfile.prod         # Production Dockerfile
│   ├── nginx.conf              # Production nginx config
│   ├── package.json
│   ├── src/
│   │   ├── components/         # Reusable components
│   │   ├── pages/              # Page components
│   │   │   └── admin/          # Admin pages
│   │   ├── contexts/           # React contexts
│   │   ├── services/           # API client
│   │   └── types/              # TypeScript types
│   └── e2e/                    # Playwright E2E tests
└── docs/
    ├── getting-started.md      # This file
    ├── deployment-digitalocean.md
    ├── API_REFERENCE.md        # Complete API documentation
    ├── USER_ACCEPTANCE_TESTS.md
    └── CODEBASE_OPTIMIZATION.md
```

---

## Stripe Payment Setup

Stripe is configured through the Admin Settings UI:

1. **Get your Stripe API keys:**
   - Create a [Stripe account](https://dashboard.stripe.com/register)
   - Get your keys from the [API keys page](https://dashboard.stripe.com/apikeys)
   - Use test keys (pk_test_... and sk_test_...) for development

2. **Configure in Admin Settings:**
   - Go to Admin > Settings > Payment Settings
   - Enable Stripe Payments
   - Enter your Publishable Key and Secret Key
   - Save settings

3. **Set up webhooks (recommended for production):**
   - Go to [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
   - Add endpoint: `https://yourdomain.com/api/payments/webhook`
   - Select event: `checkout.session.completed`
   - Copy the webhook secret and paste in Admin Settings

4. **For local development testing:**
   - Install the [Stripe CLI](https://stripe.com/docs/stripe-cli)
   - Forward webhooks to your local server:
     ```bash
     stripe listen --forward-to localhost:8000/api/payments/webhook
     ```
   - Copy the webhook signing secret to Admin Settings

---

## Troubleshooting

### Database Connection Issues

If you see database connection errors:
```bash
# Check if PostgreSQL is running
docker compose ps

# View database logs
docker compose logs db

# View backend logs (includes migration output)
docker compose logs backend

# Reset the database (WARNING: deletes all data)
docker compose down -v
docker compose up
# Migrations, seeding, and admin creation will happen automatically
```

### Frontend Not Connecting to Backend

Ensure the backend is running and healthy:
```bash
curl http://localhost:8000/api/health
```

### Permission Errors on Docker Volumes

On Linux, you may need to adjust permissions:
```bash
sudo chown -R $USER:$USER ./backend/uploads
```

### Migrations Not Running

If you suspect migrations aren't running:
```bash
# Check backend startup logs
docker compose logs backend | grep -i migration

# Manually run migrations (if needed)
docker compose exec backend alembic upgrade head

# Check current migration version
docker compose exec backend alembic current
```

### Admin User Issues

If you can't login or forgot the admin password, see [Breakglass: Reset Admin Password](#breakglass-reset-admin-password).
