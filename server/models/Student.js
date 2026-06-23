const { db } = require('../database');

class Student {
  static create(data) {
    const { student_id, name, college, cgpa } = data;
    const stmt = db.prepare(`
      INSERT INTO students (student_id, name, college, cgpa)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(student_id, name, college, cgpa);
    return this.findById(result.lastInsertRowid);
  }

  static findById(id) {
    const stmt = db.prepare('SELECT * FROM students WHERE id = ?');
    return stmt.get(id);
  }

  static findByStudentId(student_id) {
    const stmt = db.prepare('SELECT * FROM students WHERE student_id = ?');
    return stmt.get(student_id);
  }

  static findAll() {
    const stmt = db.prepare('SELECT * FROM students ORDER BY name ASC');
    return stmt.all();
  }
}

module.exports = Student;
