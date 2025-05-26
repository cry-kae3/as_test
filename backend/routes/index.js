const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const storeRoutes = require('./store');
const staffRoutes = require('./staff');
const shiftRoutes = require('./shift');
const adminRoutes = require('./admin');
const systemSettingsRoutes = require('./systemSettings');

router.use('/auth', authRoutes);
router.use('/stores', storeRoutes);
router.use('/staff', staffRoutes);
router.use('/shifts', shiftRoutes);
router.use('/admin', adminRoutes);
router.use('/system-settings', systemSettingsRoutes);

router.get('/', (req, res) => {
    res.json({ message: 'AIS API' });
});

module.exports = router;