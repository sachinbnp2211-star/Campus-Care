const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getDashboard,
  listComplaints,
  updateComplaint,
  listUsers,
  updateUser,
  listStaff,
  createStaff,
  updateStaff,
  updateStaffStatus,
  resetStaffPassword,
  listCategories,
  saveCategory,
  listDepartments,
  saveDepartment,
} = require('../controllers/adminController');

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/dashboard', getDashboard);
router.get('/complaints', listComplaints);
router.patch('/complaints/:id', updateComplaint);

router.get('/staff', listStaff);
router.post('/staff', createStaff);
router.put('/staff/:id', updateStaff);
router.patch('/staff/:id/status', updateStaffStatus);
router.patch('/staff/:id/password', resetStaffPassword);

router.get('/users', listUsers);
router.put('/users/:id', updateUser);
router.get('/categories', listCategories);
router.post('/categories', saveCategory);
router.put('/categories/:id', saveCategory);
router.get('/departments', listDepartments);
router.post('/departments', saveDepartment);
router.put('/departments/:id', saveDepartment);

module.exports = router;
