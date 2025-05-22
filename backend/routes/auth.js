const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');
const { authenticateJWT, isAdmin } = require('../middleware/auth');

// パブリックルート
router.post('/login', authController.login);

// JWTで保護されたルート
router.use(authenticateJWT);
router.get('/me', authController.getCurrentUser);

// 管理者用ルート
router.use(isAdmin);
router.post('/register', authController.register);
router.get('/users', authController.getAllUsers);
router.put('/users/:id', authController.updateUser);
router.delete('/users/:id', authController.deleteUser);

module.exports = router;