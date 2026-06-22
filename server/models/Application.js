const { db } = require('../database');

class Application {
  static create(data) {
    const { student_id, opportunity_id, status, submitted_date, documents_status } = data;
    const stmt = db.prepare(`
      INSERT INTO applications (student_id, opportunity_id, status, submitted_date, documents_status)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(student_id, opportunity_id, status || 'submitted', submitted_date, documents_status || 'incomplete');
    return this.findById(result.lastInsertRowid);
  }

  static findById(id) {
    const stmt = db.prepare(`
      SELECT 
        a.*,
        s.student_id, s.name, s.college, s.cgpa,
        o.code as opp_code, o.name as opp_name, o.institution, o.country, o.type, o.deadline
      FROM applications a
      JOIN students s ON a.student_id = s.id
      JOIN opportunities o ON a.opportunity_id = o.id
      WHERE a.id = ?
    `);
    return stmt.get(id);
  }

  static findAll(filters = {}) {
    let query = `
      SELECT 
        a.id, a.status, a.submitted_date, a.documents_status,
        s.id as student_db_id, s.student_id, s.name, s.college, s.cgpa,
        o.id as opp_db_id, o.code as opp_code, o.name as opp_name, o.institution, o.country, o.type, o.deadline
      FROM applications a
      JOIN students s ON a.student_id = s.id
      JOIN opportunities o ON a.opportunity_id = o.id
      WHERE 1=1
    `;

    const params = [];

    if (filters.status) {
      query += ` AND a.status = ?`;
      params.push(filters.status);
    }

    if (filters.documents_status) {
      query += ` AND a.documents_status = ?`;
      params.push(filters.documents_status);
    }

    if (filters.college) {
      query += ` AND s.college = ?`;
      params.push(filters.college);
    }

    if (filters.search) {
      query += ` AND (s.name LIKE ? OR s.student_id LIKE ? OR s.college LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.dateFrom) {
      query += ` AND a.submitted_date >= ?`;
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      query += ` AND a.submitted_date <= ?`;
      params.push(filters.dateTo);
    }

    // Add sorting
    const sortMap = {
      'recency': 'a.submitted_date DESC',
      'urgency': 'o.deadline ASC',
      'status': 'a.status ASC',
      'college': 's.college ASC',
      'program': 'o.name ASC',
      'cgpa': 's.cgpa DESC',
      'documents': 'a.documents_status ASC'
    };

    const sortBy = filters.sort || 'recency';
    const sortClause = sortMap[sortBy] || sortMap['recency'];
    query += ` ORDER BY ${sortClause}`;

    const stmt = db.prepare(query);
    return stmt.all(...params);
  }

  static updateStatus(id, status) {
    const stmt = db.prepare(`
      UPDATE applications 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(status, id);
    return this.findById(id);
  }

  static batchUpdateStatus(ids, status) {
    const placeholders = ids.map(() => '?').join(',');
    const stmt = db.prepare(`
      UPDATE applications 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `);
    stmt.run(status, ...ids);
    return ids.map(id => this.findById(id));
  }

  static getStatistics() {
    const stats = {};
    
    // Pending review
    const pending = db.prepare(`
      SELECT COUNT(*) as count 
      FROM applications 
      WHERE status = 'submitted' OR status = 'under-review'
    `).get();
    stats.pending = pending.count;

    // Count of urgent (deadline < 7 days from now)
    const urgent = db.prepare(`
      SELECT COUNT(*) as count 
      FROM applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      WHERE (a.status = 'submitted' OR a.status = 'under-review')
      AND julianday(o.deadline) - julianday('now') < 7
    `).get();
    stats.urgent = urgent.count;

    // Nominated
    const nominated = db.prepare(`
      SELECT COUNT(*) as count FROM applications WHERE status = 'nominated'
    `).get();
    stats.nominated = nominated.count;

    // Accepted
    const accepted = db.prepare(`
      SELECT COUNT(*) as count FROM applications WHERE status = 'accepted'
    `).get();
    stats.accepted = accepted.count;

    // Live programs
    const programs = db.prepare(`
      SELECT COUNT(DISTINCT id) as count FROM opportunities
    `).get();
    stats.livePrograms = programs.count;

    // Count distinct countries
    const countries = db.prepare(`
      SELECT COUNT(DISTINCT country) as count FROM opportunities
    `).get();
    stats.countries = countries.count;

    return stats;
  }
}

module.exports = Application;
