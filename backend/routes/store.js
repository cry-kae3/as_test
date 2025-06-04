const express = require('express');
const router = express.Router();
const storeController = require('../controllers/store');
const { authenticateSession, isAdmin, isManager, isOwnerOrAdmin } = require('../middleware/auth');

router.use(authenticateSession);

router.get('/', isManager, storeController.getAllStores);
router.get('/:id', isManager, storeController.getStoreById);
router.get('/:id/closed-days', isManager, storeController.getStoreClosedDays);
router.get('/:id/staff-requirements', isManager, storeController.getStoreStaffRequirements);
router.get('/:id/business-hours', isManager, storeController.getBusinessHours);

router.post('/:id/business-hours', isOwnerOrAdmin, storeController.saveBusinessHours);
router.post('/:id/closed-days', isOwnerOrAdmin, storeController.saveClosedDays);
router.post('/:id/staff-requirements', isOwnerOrAdmin, storeController.saveStaffRequirements);

router.delete('/:id/staff-requirements', isOwnerOrAdmin, storeController.deleteAllStaffRequirements);
router.delete('/:id/closed-days', isOwnerOrAdmin, storeController.deleteAllClosedDays);

router.post('/', isOwnerOrAdmin, storeController.createStore);
router.put('/:id', isOwnerOrAdmin, storeController.updateStore);
router.delete('/:id', isOwnerOrAdmin, storeController.deleteStore);

module.exports = router;