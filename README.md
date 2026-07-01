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
│   ├── server.js               ← entry point
│   ├── config/
│   │   └── db.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── errorHandler.js
│   ├── models/
│   │   ├── Applications.js
│   │   ├── AuditLog.js
│   │   ├── Document.js
│   │   ├── Opportunity.js
│   │   └── User.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── applications.js
│   │   ├── opportunities.js    ← future: Opportunity CRUD
│   │   └── statistics.js
│   └── scripts/                
│       └── seed.js
│
└── client/                     
    ├── views/
    │   ├── admin/
    │   │   ├── dashboard.html
    │   │   ├── applicants.html
    │   │   ├── programs.html
    │   │   ├── post-opportunity.html
    │   │   └── admin-profile.html
    │   └── student/
    │       ├── dashboard.html
    │       ├── catalog.html
    │       └── ...
    └── public/
        ├── css/
        │   └── gems.css
        │   └── login.css
        │   └── profile.css
        │   └── register.css
        ├── images/
        │   └── OVPERI-black.png
        │   └── OVPERI-white.png
        └── js/
            ├── admin-dashboard.js
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
```

### Running the Server
```bash
npm start
# or for development:
npm run dev
```

Server runs at: `http://localhost:3000`

### Seed the Database
<in progress>

