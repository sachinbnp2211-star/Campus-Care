const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getStudentDashboard,
  getStaffDashboard,
  getAdminDashboard,
} = require('../controllers/dashboardController');

const router = express.Router();

router.use(protect);
router.get('/student', authorize('student'), getStudentDashboard);
router.get('/staff', authorize('staff'), getStaffDashboard);
router.get('/admin', authorize('admin'), getAdminDashboard);

module.exports = router;
