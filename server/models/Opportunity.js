const { db } = require('../database');

class Opportunity {
  static create(data) {
    const { code, name, institution, country, type, deadline, capacity } = data;
    const stmt = db.prepare(`
      INSERT INTO opportunities (code, name, institution, country, type, deadline, capacity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(code, name, institution, country, type, deadline, capacity);
    return this.findById(result.lastInsertRowid);
  }

  static findById(id) {
    const stmt = db.prepare('SELECT * FROM opportunities WHERE id = ?');
    return stmt.get(id);
  }

  static findAll() {
    const stmt = db.prepare('SELECT * FROM opportunities ORDER BY deadline ASC');
    return stmt.all();
  }

  static findByCode(code) {
    const stmt = db.prepare('SELECT * FROM opportunities WHERE code = ?');
    return stmt.get(code);
  }
}

module.exports = Opportunity;
