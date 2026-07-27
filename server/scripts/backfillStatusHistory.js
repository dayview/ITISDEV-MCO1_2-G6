require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Application = require('../models/Applications');
const User = require('../models/User');

// One-off, idempotent migration. Older applications were written before statusHistory
// entries carried `changedBy`, and some predate statusHistory entirely. This backfills
// attribution so the schema's now-required `changedBy` holds and the student tracker can
// render an accurate stage timeline:
//   - a "submitted" entry is attributed to the student who owns the application
//   - every later entry is attributed to a fallback administrator (as the lifecycle
//     only advances by admin action)
//   - applications with no history at all get a synthesized "submitted" entry
// Re-running is safe: entries that already have `changedBy` are left untouched.
async function backfill() {
    await connectDB();
    console.log('Backfilling application status history...');
    console.log('Connected database:', mongoose.connection.name);

    const fallbackAdmin = await User.findOne({ role: { $in: ['OVPERI_Admin', 'System_Admin'] } }).select('_id');
    if (!fallbackAdmin) {
        console.error('Refusing to run: no admin user found to attribute administrative stage changes to.');
        process.exit(1);
    }

    const applications = await Application.find({});
    let entriesFilled = 0;
    let historiesSynthesized = 0;
    let documentsModified = 0;

    for (const application of applications) {
        let modified = false;

        if (!Array.isArray(application.statusHistory) || application.statusHistory.length === 0) {
            application.statusHistory = [{
                status: 'submitted',
                changedAt: application.submittedDate ? new Date(application.submittedDate) : (application.createdAt || new Date()),
                changedBy: application.userId
            }];
            historiesSynthesized += 1;
            modified = true;
        } else {
            application.statusHistory.forEach(entry => {
                if (!entry.changedBy) {
                    entry.changedBy = entry.status === 'submitted' ? application.userId : fallbackAdmin._id;
                    entriesFilled += 1;
                    modified = true;
                }
            });
        }

        if (modified) {
            await application.save();
            documentsModified += 1;
        }
    }

    console.log(`Applications scanned: ${applications.length}`);
    console.log(`Applications modified: ${documentsModified}`);
    console.log(`History entries attributed: ${entriesFilled}`);
    console.log(`Histories synthesized (were empty): ${historiesSynthesized}`);
    process.exit(0);
}

backfill().catch(err => { console.error(err); process.exit(1); });
