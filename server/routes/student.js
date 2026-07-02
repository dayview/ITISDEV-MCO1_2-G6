/**
 * Student-scoped routes — all require an authenticated Student session.
 * Every query is filtered to req.session.userId so students can only
 * access their own profile, applications, and documents.
 */
const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/Users');
const Application = require('../models/Applications');
const Document = require('../models/Document');
const AuditLog = require('../models/AuditLog');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Block non-students from all routes in this router
router.use((req, res, next) => {
    if (req.session.role !== 'Student') {
        return res.status(403).json({ message: 'Forbidden: student access only' });
    }
    next();
});

// GET /api/student/profile
router.get('/profile', async (req, res) => {
    try {
        const user = await User.findActiveById(req.session.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user.toPublicJSON());
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PUT /api/student/profile  — students can update their own profile fields only
router.put('/profile', async (req, res) => {
    try {
        const updated = await User.updateProfile(req.session.userId, req.body);
        if (!updated) return res.status(404).json({ message: 'User not found' });

        await AuditLog.logAction({
            action: 'user.profile_updated',
            targetType: 'User',
            targetId: req.session.userId,
            userId: req.session.userId,
            details: Object.keys(req.body),
            ip: req.ip,
        });

        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/student/applications  — own applications only
router.get('/applications', async (req, res) => {
    try {
        const applications = await Application.findByStudent(req.session.userId);
        res.json({ success: true, data: applications });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/student/applications  — submit a new application
router.post('/applications', async (req, res) => {
    try {
        const { opportunityId } = req.body;
        if (!opportunityId) return res.status(400).json({ message: 'opportunityId is required' });

        const application = await Application.createApplication({
            studentId: req.session.userId,
            opportunityId,
        });

        await AuditLog.logAction({
            action: 'application.submitted',
            targetType: 'Application',
            targetId: application._id,
            userId: req.session.userId,
            ip: req.ip,
        });

        res.status(201).json({ success: true, data: application });
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ message: 'Already applied to this opportunity' });
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/student/documents  — own documents only
router.get('/documents', async (req, res) => {
    try {
        const documents = await Document.findByStudent(req.session.userId);
        res.json({ success: true, data: documents });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/student/documents  — upload a document (record only; file handling is separate)
router.post('/documents', async (req, res) => {
    try {
        const { type, fileName, filePath, fileFormat } = req.body;
        if (!type || !filePath) return res.status(400).json({ message: 'type and filePath are required' });

        const doc = await Document.uploadDocument({
            userId: req.session.userId,
            type,
            fileName,
            filePath,
            fileFormat,
        });

        await AuditLog.logAction({
            action: 'document.uploaded',
            targetType: 'Document',
            targetId: doc._id,
            userId: req.session.userId,
            details: { type, fileName },
            ip: req.ip,
        });

        res.status(201).json({ success: true, data: doc });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/student/documents/:id  — delete own document only
router.delete('/documents/:id', async (req, res) => {
    try {
        const doc = await Document.findDocumentById(req.params.id);
        if (!doc) return res.status(404).json({ message: 'Document not found' });

        // Ownership check: document must belong to the requesting student
        if (String(doc.userId) !== req.session.userId) {
            return res.status(403).json({ message: 'Forbidden: not your document' });
        }

        await Document.deleteDocument(req.params.id);

        await AuditLog.logAction({
            action: 'document.deleted',
            targetType: 'Document',
            targetId: doc._id,
            userId: req.session.userId,
            details: { type: doc.type, fileName: doc.fileName },
            ip: req.ip,
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
