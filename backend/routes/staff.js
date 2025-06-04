const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staff');
const { authenticateSession, isAdmin, isManager } = require('../middleware/auth');

router.use(authenticateSession);

router.use(isManager);

router.get('/', staffController.getAllStaff);

router.get('/:id', staffController.getStaffById);

router.get('/:id/day-preferences', staffController.getStaffDayPreferences);

router.get('/:id/day-off-requests', staffController.getStaffDayOffRequests);

router.post('/', staffController.createStaff);

router.put('/:id', staffController.updateStaff);

router.patch('/:id/day-off-requests/:requestId', staffController.updateDayOffRequestStatus);

router.delete('/:id', isAdmin, staffController.deleteStaff);


router.get('/day-off-requests', staffController.getAllDayOffRequests);

module.exports = router;