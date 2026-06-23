const { db, initializeDatabase } = require('./database');
const Opportunity = require('./models/Opportunity');
const Student = require('./models/Student');
const Application = require('./models/Application');

function seedDatabase() {
  console.log('Seeding database...');

  // Clear existing data (for development)
  db.exec('DELETE FROM applications');
  db.exec('DELETE FROM students');
  db.exec('DELETE FROM opportunities');

  // Create opportunities
  const opportunities = [
    { code: 'NUS', name: 'NUS Exchange Semester', institution: 'National University of Singapore', country: 'Singapore', type: 'Exchange', deadline: '2026-08-31', capacity: 15 },
    { code: 'NTU', name: 'NTU Exchange Program', institution: 'Nanyang Technological University', country: 'Singapore', type: 'Exchange', deadline: '2026-07-15', capacity: 12 },
    { code: 'CAU', name: 'Chung-Ang Summer Program', institution: 'Chung-Ang University', country: 'South Korea', type: 'Summer Program', deadline: '2026-06-30', capacity: 20 },
    { code: 'TUM', name: 'TUM Research Exchange', institution: 'Technical University of Munich', country: 'Germany', type: 'Research Exchange', deadline: '2026-09-15', capacity: 8 },
    { code: 'KYOTO', name: 'Kyoto Research Initiative', institution: 'Kyoto University', country: 'Japan', type: 'Research Exchange', deadline: '2026-10-01', capacity: 10 },
    { code: 'UMEL', name: 'University of Melbourne Exchange', institution: 'University of Melbourne', country: 'Australia', type: 'Exchange', deadline: '2026-07-30', capacity: 18 },
    { code: 'SCIENCES_PO', name: 'Sciences Po Exchange', institution: 'Sciences Po', country: 'France', type: 'Exchange', deadline: '2026-08-15', capacity: 12 },
    { code: 'OXFORD', name: 'Oxford Summer School', institution: 'University of Oxford', country: 'United Kingdom', type: 'Summer Program', deadline: '2026-06-20', capacity: 5 }
  ];

  opportunities.forEach(opp => {
    try {
      Opportunity.create(opp);
    } catch (err) {
      // Likely duplicate, skip
    }
  });

  // Create students
  const students = [
    { student_id: '12012345', name: 'Leon C. Pavino', college: 'CCS', cgpa: 3.42 },
    { student_id: '11822980', name: 'Maria C. Santos', college: 'RVRCOB', cgpa: 3.10 },
    { student_id: '11977120', name: 'Andrea T. Tan', college: 'GCOE', cgpa: 3.55 },
    { student_id: '12004531', name: 'Jorge V. Reyes', college: 'CLA', cgpa: 3.20 },
    { student_id: '11766201', name: 'Paolo R. Medina', college: 'GCOE', cgpa: 2.95 },
    { student_id: '12033419', name: 'Katrina I. Estrella', college: 'CCS', cgpa: 3.78 },
    { student_id: '11911234', name: 'James A. Reyes', college: 'CCS', cgpa: 3.50 },
    { student_id: '12155678', name: 'Sofia M. Diaz', college: 'CLA', cgpa: 3.65 },
    { student_id: '11899012', name: 'Miguel R. Torres', college: 'RVRCOB', cgpa: 3.35 },
    { student_id: '12034567', name: 'Ana B. Garcia', college: 'GCOE', cgpa: 3.25 },
    { student_id: '11978901', name: 'Jose L. Martinez', college: 'CCS', cgpa: 3.45 },
    { student_id: '12123456', name: 'Isabella R. Flores', college: 'CLA', cgpa: 3.72 }
  ];

  students.forEach(student => {
    try {
      Student.create(student);
    } catch (err) {
      // Likely duplicate, skip
    }
  });

  // Create applications (mix of statuses)
  const statuses = ['submitted', 'under-review', 'nominated', 'accepted', 'rejected'];
  const docStatuses = ['complete', 'incomplete'];

  const allStudents = Student.findAll();
  const allOpportunities = Opportunity.findAll();

  let appCount = 0;
  for (let i = 0; i < allStudents.length; i++) {
    const student = allStudents[i];
    const numApps = Math.floor(Math.random() * 3) + 1; // 1-3 applications per student

    for (let j = 0; j < numApps && j < allOpportunities.length; j++) {
      const opportunity = allOpportunities[(i * 3 + j) % allOpportunities.length];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const docsStatus = status === 'rejected' ? 'incomplete' : docStatuses[Math.floor(Math.random() * docStatuses.length)];
      
      // Generate submitted dates in the last 30 days
      const daysAgo = Math.floor(Math.random() * 30) + 1;
      const submittedDate = new Date();
      submittedDate.setDate(submittedDate.getDate() - daysAgo);
      const submittedDateStr = submittedDate.toISOString().split('T')[0];

      try {
        Application.create({
          student_id: student.id,
          opportunity_id: opportunity.id,
          status,
          submitted_date: submittedDateStr,
          documents_status: docsStatus
        });
        appCount++;
      } catch (err) {
        // Skip duplicate applications
      }
    }
  }

  console.log(`Seeded ${opportunities.length} opportunities`);
  console.log(`Seeded ${allStudents.length} students`);
  console.log(`Seeded ${appCount} applications`);

  const stats = Application.getStatistics();
  console.log('\nDashboard Statistics:');
  console.log(`  Pending Review: ${stats.pending}`);
  console.log(`  Urgent (< 7 days): ${stats.urgent}`);
  console.log(`  Nominated: ${stats.nominated}`);
  console.log(`  Accepted: ${stats.accepted}`);
  console.log(`  Live Programs: ${stats.livePrograms} across ${stats.countries} countries`);

  console.log('\nSeeding complete!');
}

// Run seed if executed directly
if (require.main === module) {
  initializeDatabase();
  seedDatabase();
  process.exit(0);
}

module.exports = { seedDatabase };
