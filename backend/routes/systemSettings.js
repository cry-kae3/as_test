const express = require('express');
const router = express.Router();
const systemSettingsController = require('../controllers/systemSettings');
const { authenticateSession, isOwnerOrAdmin } = require('../middleware/auth');

router.use(authenticateSession);
router.use(isOwnerOrAdmin);

router.get('/', systemSettingsController.getSystemSettings);
router.put('/', systemSettingsController.updateSystemSettings);

module.exports = router;