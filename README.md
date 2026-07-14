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

### Running the Server
```bash
npm start
# or for development:
npm run dev
```

Server runs at: `http://localhost:3000`

### Seed the Database
```bash
npm run seed
```

This connects using `MONGO_URI` from `.env`, clears the `opportunities`, `users`, and `applications`
collections, and inserts fresh sample data (10 opportunities, 20 users, 55 applications). The script
refuses to run if `NODE_ENV=production`.

**Seeded login credentials** — every seeded account is created with a bcrypt-hashed password (no
plaintext password comparison exists anywhere in the login route). The default development password is
`GemsDev123!`; override it by setting `SEED_PASSWORD` in `.env` before seeding.
- Admin: `admin@dlsu.edu.ph` / `GemsDev123!`
- Student: any other seeded email, e.g. `leon_pavino@dlsu.edu.ph` / `GemsDev123!`

These are printed by `npm run seed` itself (only when `NODE_ENV !== 'production'`) so they never need to
be committed anywhere. Never reuse this password for a real account.
