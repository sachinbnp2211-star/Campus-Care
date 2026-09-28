const db = require('../config/db');

const getStudentDashboard = async (req, res) => {
  const userId = req.user.id;

  try {
    const [counts] = await db.execute(
      `SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN status IN ('Submitted','Under Review','Assigned') THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status IN ('In Progress') THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN status IN ('Resolved','Closed') THEN 1 ELSE 0 END) AS resolved
       FROM complaints WHERE user_id = ?`,
      [userId]
    );

    const [recent] = await db.execute(
      'SELECT * FROM complaints WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
      [userId]
    );

    res.json({
      summary: counts[0],
      recentComplaints: recent,
    });
  } catch (error) {
    console.error('Student dashboard error:', error);
    res.status(500).json({ message: 'Unable to load dashboard data.' });
  }
};

const getStaffDashboard = async (req, res) => {
  const userId = req.user.id;

  try {
    const [counts] = await db.execute(
      `SELECT 
        COUNT(*) AS assigned,
        SUM(CASE WHEN status IN ('Submitted','Under Review','Assigned') THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN status IN ('Resolved','Closed') THEN 1 ELSE 0 END) AS resolved
       FROM complaints WHERE assigned_staff_id = ?`,
      [userId]
    );

    const [recent] = await db.execute(
      'SELECT * FROM complaints WHERE assigned_staff_id = ? ORDER BY created_at DESC LIMIT 5',
      [userId]
    );

    res.json({ summary: counts[0], recentComplaints: recent });
  } catch (error) {
    console.error('Staff dashboard error:', error);
    res.status(500).json({ message: 'Unable to load dashboard data.' });
  }
};

const getAdminDashboard = async (req, res) => {
  try {
    const [stats] = await db.execute(
      `SELECT 
        (SELECT COUNT(*) FROM complaints) AS total_complaints,
        (SELECT COUNT(*) FROM complaints WHERE status IN ('Submitted','Under Review','Assigned')) AS pending,
        (SELECT COUNT(*) FROM complaints WHERE status = 'In Progress') AS in_progress,
        (SELECT COUNT(*) FROM complaints WHERE status IN ('Resolved','Closed')) AS resolved,
        (SELECT COUNT(*) FROM complaints WHERE status = 'Rejected') AS rejected,
        (SELECT COUNT(*) FROM users WHERE role = 'student') AS total_students,
        (SELECT COUNT(*) FROM users WHERE role = 'staff') AS total_staff` 
    );

    const [categoryStats] = await db.execute(
      `SELECT c.name AS category, COUNT(cp.id) AS value
       FROM categories c
       LEFT JOIN complaints cp ON cp.category_id = c.id
       GROUP BY c.id, c.name
       ORDER BY value DESC` 
    );

    const [statusStats] = await db.execute(
      `SELECT status AS name, COUNT(*) AS value FROM complaints GROUP BY status` 
    );

    const [recent] = await db.execute(
      'SELECT * FROM complaints ORDER BY created_at DESC LIMIT 6'
    );

    const [monthly] = await db.execute(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count
       FROM complaints
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY month ASC LIMIT 12`
    );

    res.json({
      stats: stats[0],
      categoryStats,
      statusStats,
      recentComplaints: recent,
      monthlyStats: monthly,
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ message: 'Unable to load dashboard data.' });
  }
};

module.exports = { getStudentDashboard, getStaffDashboard, getAdminDashboard };
