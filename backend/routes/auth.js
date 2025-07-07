const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');
const { authenticateSession, isAdmin } = require('../middleware/auth');

router.post('/login', authController.login);

router.use(authenticateSession);
router.get('/me', authController.getCurrentUser);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refreshSession);

router.use(isAdmin);
router.post('/register', authController.register);
router.get('/users', authController.getAllUsers);
router.put('/users/:id', authController.updateUser);
router.delete('/users/:id', authController.deleteUser);

module.exports = router;