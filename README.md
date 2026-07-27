# GEMS - Global Exchange Management System

A group repository for **ITISDEV MCO#1 & MCO#2** (Group 6).
A web-based scholarship and exchange opportunity management platform for DLSU students and administrators.

---

## Tech Stack
| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express 5 |
| Database | MongoDB via Mongoose |
| Frontend | Vanilla HTML/CSS/JS |
| Icons | Lucide |

---

## Repository Structure
```text
ITISDEV-MCO1_2-G6/
│
├── .env                        
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── README.md
│
├── server/                     ← all back-end code
│   ├── server.js               ← entry point (npm start / npm run dev)
│   ├── config/
│   │   └── db.js               ← single Mongoose connection module
│   ├── middleware/
│   │   ├── auth.js
│   │   └── errorHandler.js
│   ├── lib/                    ← request/response mapping + business logic helpers
│   ├── models/                 ← canonical Mongoose schemas (one per entity)
│   │   ├── Applications.js
│   │   ├── AuditLog.js
│   │   ├── Document.js
│   │   ├── Opportunity.js
│   │   └── User.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── applications.js
│   │   └── statistics.js
│   │   (opportunity/document routes are declared inline in server.js)
│   └── scripts/
│       └── seed.js
│
├── views/
│   ├── student/                 ← student-facing frontend (served at /, /:page)
│   │   ├── dashboard.html
│   │   ├── catalog.html
│   │   └── ...
│   └── admin/                   ← admin-facing frontend (served at /admin/:page)
│       ├── dashboard.html
│       ├── applicants.html
│       ├── programs.html
│       ├── post-opportunity.html
│       └── admin-profile.html
│
└── public/                     ← static assets, mounted at /public
    ├── css/
    ├── images/
    └── js/
        ├── admin-dashboard.js
        ├── admin-applicants.js
        ├── admin-programs.js
        ├── catalog.js
        ├── opportunity-api.js
        ├── opportunity-data.js
        ├── opportunity-detail.js
        └── profile.js
```

---

## Getting Started

### Prerequisites
- Node.js v18+
- npm

### Installation
```bash
git clone https://github.com/dayview/ITISDEV-MCO1_2-G6.git
cd ITISDEV-MCO1_2-G6
npm install
cp .env.example .env
```

Open `.env` and replace `MONGO_URI` with your MongoDB connection string.

### Database Environments

Every runtime uses the same `MONGO_URI` variable, supplied by its local environment or deployment
secret manager. The server validates the database name before the session store or application models
connect, preventing one environment from accidentally using another environment's data.

| `NODE_ENV` | Allowed database suffix | Recommended database | Destructive seed |
|---|---|---|---|
| `development` | `_dev`, `_development`, `_demo` | `gems_development` or `gems_demo` | Explicit opt-in only |
| `test` | `_test` | `gems_test` | Test-only |
| `production` | `_prod`, `_production` | `gems_production` | Never |

The deterministic professor-demo data should remain in `gems_demo`; use `gems_development` for daily
coding so ordinary experiments do not alter the presentation baseline. Production should use a
separate Atlas project or cluster when practical, a least-privilege database user, deployment-managed
secrets, network restrictions, and backups. Never commit `.env` or production credentials.

The reminder scheduler is disabled in `.env.example`. Enable it only in the one process responsible
for scheduled jobs. Local document uploads still use `storage/documents`; replace this with durable
managed object storage before multi-instance or production deployment.

### Running the Server
```bash
npm start
# or for development:
npm run dev
```

Server runs at: `http://localhost:3000`

### Seed the Database
```bash
ALLOW_DATABASE_SEED=true npm run seed
```

This connects using `MONGO_URI` from `.env`, clears the `opportunities`, `users`, `applications`,
`documents`, and `notifications` collections, and inserts fresh deterministic sample data. The script
requires the explicit `ALLOW_DATABASE_SEED=true` opt-in, accepts only development/test/demo database
names, and refuses to run if `NODE_ENV=production`.

**Seeded login credentials** — every seeded account is created with a bcrypt-hashed password (no
plaintext password comparison exists anywhere in the login route). The default development password is
`GemsDev123!`; override it by setting `SEED_PASSWORD` in `.env` before seeding.
- Admin: `admin@dlsu.edu.ph` / `GemsDev123!`
- Student: any other seeded email, e.g. `leon_pavino@dlsu.edu.ph` / `GemsDev123!`

These are printed by `npm run seed` itself (only when `NODE_ENV !== 'production'`) so they never need to
be committed anywhere. Never reuse this password for a real account.
