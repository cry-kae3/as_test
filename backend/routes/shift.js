const express = require('express');
const router = express.Router();
const shiftController = require('../controllers/shift');
const { authenticateSession, isAdmin, isManager } = require('../middleware/auth');

router.use(authenticateSession);
router.use(isManager);

router.get('/', shiftController.getAllShifts);
router.get('/system-settings', shiftController.getSystemSettings);
router.get('/staff-total-hours', shiftController.getStaffTotalHoursAllStores);
router.get('/:id', shiftController.getShiftById);
router.get('/:year/:month', shiftController.getShiftByYearMonth);
router.get('/:year/:month/validate', shiftController.validateShift);
router.get('/:year/:month/logs', shiftController.getShiftChangeLogs);
router.post('/', shiftController.createShift);
router.post('/generate', shiftController.generateShift);
router.post('/:year/:month/confirm', shiftController.confirmShift);
router.post('/:year/:month/assignments', shiftController.createShiftAssignment);
router.put('/:year/:month/assignments/:assignmentId', shiftController.updateShiftAssignment);
router.delete('/:year/:month/assignments/:assignmentId', shiftController.deleteShiftAssignment);

router.delete('/:year/:month', authenticateUser, isManager, shiftController.deleteShift);


module.exports = router;