const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./database');
const { seedDatabase } = require('./seed');
const applicationsRouter = require('./routes/applications');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../gems/public')));

// Initialize database
initializeDatabase();

// Routes
app.use('/api', applicationsRouter);

// Serve HTML files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../gems/views/student/dashboard.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../gems/views/admin/dashboard.html'));
});

app.get('/student/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../gems/views/student/dashboard.html'));
});

app.get('/student/catalog', (req, res) => {
  res.sendFile(path.join(__dirname, '../gems/views/student/catalog.html'));
});

app.get('/student/applications', (req, res) => {
  res.sendFile(path.join(__dirname, '../gems/views/student/applications.html'));
});

app.get('/student/profile', (req, res) => {
  res.sendFile(path.join(__dirname, '../gems/views/student/profile.html'));
});

app.get('/student/documents', (req, res) => {
  res.sendFile(path.join(__dirname, '../gems/views/student/documents.html'));
});

app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../gems/views/admin/dashboard.html'));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'GEMS server is running' });
});

// Seed database endpoint (for development)
app.post('/api/seed', (req, res) => {
  try {
    seedDatabase();
    res.json({ success: true, message: 'Database seeded successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   GEMS Admin Dashboard Server          ║');
  console.log(`║   Running on: http://localhost:${PORT}        ║`);
  console.log('║   Admin: http://localhost:3000/admin   ║');
  console.log('╚════════════════════════════════════════╝\n');
  console.log('📍 API Endpoints:');
  console.log('  GET  /api/applications - List applications with filters');
  console.log('  GET  /api/applications/:id - Get single application');
  console.log('  PATCH /api/applications/:id/status - Update status');
  console.log('  POST /api/applications/bulk-action - Batch update');
  console.log('  GET  /api/applications/export - Export to CSV');
  console.log('  GET  /api/statistics - Get dashboard stats');
  console.log('  POST /api/seed - Seed database (dev only)');
  console.log('  GET  /api/health - Health check\n');
});

module.exports = app;
