const express = require('express');
const router = express.Router();

// ルートの読み込み
const authRoutes = require('./auth');
const storeRoutes = require('./store');
const staffRoutes = require('./staff');
const shiftRoutes = require('./shift');
const adminRoutes = require('./admin');

// 各ルートを使用
router.use('/auth', authRoutes);
router.use('/stores', storeRoutes);
router.use('/staff', staffRoutes);
router.use('/shifts', shiftRoutes);
router.use('/admin', adminRoutes);

// APIのルートエンドポイントの状態を確認
router.get('/', (req, res) => {
    res.json({ message: 'AIS API' });
});

module.exports = router;