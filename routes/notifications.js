const express = require('express');
const pool = require('../db');
const { loginVerification } = require('../auth');
const router = express.Router();

const COLUMNS = 'notification_id, order_id, message, link, is_read, created_at';

// GET /notifications (Role: any logged in user)
// The 50 newest notifications for whoever is logged in, newest first
router.get('/notifications', loginVerification, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT ${COLUMNS}
      FROM Notifications
      WHERE user_id = ?
      ORDER BY created_at DESC, notification_id DESC
      LIMIT 50
    `, [req.session.user.user_id]);

    res.json(rows.map((row) => ({ ...row, is_read: Boolean(row.is_read) })));
  } catch (err) {
    console.error('Notifications error:', err);
    res.status(500).json({ error: 'Could not load notifications.' });
  }
});

// PUT /notifications/:id/read (Role: any logged in user)
// Marks one of your own notifications as read. Someone else's counts as not found.
router.put('/notifications/:id/read', loginVerification, async (req, res) => {
  const notificationId = Number(req.params.id);

  try {
    const [rows] = await pool.query(
      `SELECT ${COLUMNS} FROM Notifications WHERE notification_id = ? AND user_id = ?`,
      [notificationId, req.session.user.user_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    await pool.query('UPDATE Notifications SET is_read = TRUE WHERE notification_id = ?', [notificationId]);
    res.json({ ...rows[0], is_read: true });
  } catch (err) {
    console.error('Notification read error:', err);
    res.status(500).json({ error: 'Could not update the notification.' });
  }
});

module.exports = router;
