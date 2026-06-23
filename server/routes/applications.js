const express = require('express');
const Application = require('../models/Application');
const Student = require('../models/Student');

const router = express.Router();

/**
 * GET /api/applications
 * Fetch applications with sorting and filtering
 * Query params:
 *  - sort: recency|urgency|status|college|program|cgpa|documents
 *  - status: submitted|under-review|nominated|accepted|rejected
 *  - documents: complete|incomplete
 *  - college: college code (e.g., CCS)
 *  - search: search term (name, ID, or college)
 *  - dateFrom: YYYY-MM-DD
 *  - dateTo: YYYY-MM-DD
 */
router.get('/applications', (req, res) => {
  try {
    const filters = {
      sort: req.query.sort || 'recency',
      status: req.query.status,
      documents_status: req.query.documents,
      college: req.query.college,
      search: req.query.search,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo
    };

    // Remove undefined filters
    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

    const applications = Application.findAll(filters);
    res.json({
      success: true,
      data: applications,
      count: applications.length
    });
  } catch (err) {
    console.error('Error fetching applications:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/applications/:id
 * Fetch a single application with full details
 */
router.get('/applications/:id', (req, res) => {
  try {
    const application = Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    res.json({ success: true, data: application });
  } catch (err) {
    console.error('Error fetching application:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/applications/:id/status
 * Update application status
 * Body: { status: "nominated"|"accepted"|"rejected"|"under-review"|"submitted" }
 */
router.patch('/applications/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }
    const application = Application.updateStatus(req.params.id, status);
    res.json({ success: true, data: application, message: `Application status updated to ${status}` });
  } catch (err) {
    console.error('Error updating application status:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/applications/bulk-action
 * Batch update applications
 * Body: { ids: [1, 2, 3], action: "approve"|"reject"|"nominate", status: "nominated"|"accepted"|"rejected" }
 */
router.post('/applications/bulk-action', (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'IDs array is required' });
    }
    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }

    const applications = Application.batchUpdateStatus(ids, status);
    res.json({ 
      success: true, 
      data: applications, 
      message: `Updated ${applications.length} applications to ${status}` 
    });
  } catch (err) {
    console.error('Error batch updating applications:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/applications/export?[filters]
 * Export applications as CSV
 */
router.get('/applications/export', (req, res) => {
  try {
    const filters = {
      sort: req.query.sort || 'recency',
      status: req.query.status,
      documents_status: req.query.documents,
      college: req.query.college,
      search: req.query.search
    };

    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

    const applications = Application.findAll(filters);

    // Generate CSV
    let csv = 'Student Name,Student ID,College,CGPA,Program,Institution,Status,Documents,Submitted Date,Deadline\n';
    applications.forEach(app => {
      const row = [
        `"${app.name}"`,
        app.student_id,
        app.college,
        app.cgpa,
        `"${app.opp_name}"`,
        `"${app.institution}"`,
        app.status,
        app.documents_status,
        app.submitted_date,
        app.deadline
      ].join(',');
      csv += row + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="applications.csv"');
    res.send(csv);
  } catch (err) {
    console.error('Error exporting applications:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/statistics
 * Get dashboard statistics
 */
router.get('/statistics', (req, res) => {
  try {
    const stats = Application.getStatistics();
    res.json({ success: true, data: stats });
  } catch (err) {
    console.error('Error fetching statistics:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
