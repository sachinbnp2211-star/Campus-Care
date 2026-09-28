const express = require('express');
const { protect } = require('../middleware/auth');
const db = require('../config/db');

const router = express.Router();
router.use(protect);

router.get('/', async (req, res, next) => {
  try {
    const [notifications] = await db.execute(
      `SELECT id, user_id, complaint_id, title, message, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.json({ notifications });
  } catch (error) {
    return next(error);
  }
});

router.patch('/read-all', async (req, res, next) => {
  try {
    await db.execute(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = ?',
      [req.user.id]
    );
    return res.json({ message: 'All notifications marked as read.' });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/read', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ message: 'Invalid notification ID.' });
  }

  try {
    const [result] = await db.execute(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Notification not found.' });
    }
    return res.json({ message: 'Notification marked as read.' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
