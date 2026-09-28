const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getDashboard,
  listCategories,
  listAssignedComplaints,
  getComplaintDetails,
  updateStatus,
  downloadAttachment,
} = require('../controllers/staffController');

const router = express.Router();

router.use(protect, authorize('staff'));

router.get('/dashboard', getDashboard);
router.get('/categories', listCategories);
router.get('/complaints', listAssignedComplaints);
router.get('/complaints/:id/attachments/:attachmentId', downloadAttachment);
router.get('/complaints/:id', getComplaintDetails);
router.patch('/complaints/:id/status', updateStatus);

module.exports = router;
