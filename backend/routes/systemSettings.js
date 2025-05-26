const express = require('express');
const router = express.Router();
const systemSettingsController = require('../controllers/systemSettings');
const { authenticateJWT, isOwnerOrAdmin } = require('../middleware/auth');

router.use(authenticateJWT);
router.use(isOwnerOrAdmin);

router.get('/', systemSettingsController.getSystemSettings);
router.put('/', systemSettingsController.updateSystemSettings);

module.exports = router;