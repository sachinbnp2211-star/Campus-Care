const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { complaintAttachments } = require('../middleware/complaintUpload');
const {
  listCategories,
  listDepartments,
  createComplaint,
  listComplaints,
  getComplaintDetails,
  updateComplaint,
  denyStudentStatusUpdate,
  downloadAttachment,
} = require('../controllers/studentComplaintController');

const router = express.Router();

router.use(protect, authorize('student'));

router.get('/categories', listCategories);
router.get('/departments', listDepartments);
router.get('/', listComplaints);
router.post('/', complaintAttachments, (req, _res, next) => {
  req.complaintFiles = [
    ...(req.files?.attachments || []),
    ...(req.files?.image || []),
  ];
  next();
}, createComplaint);
router.get('/:id/attachments/:attachmentId', downloadAttachment);
router.put('/:id/status', denyStudentStatusUpdate);
router.get('/:id', getComplaintDetails);
router.put('/:id', updateComplaint);

module.exports = router;
