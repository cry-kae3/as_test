const express = require('express');
const router = express.Router();
const shiftController = require('../controllers/shift');
const { authenticateJWT, isAdmin, isManager } = require('../middleware/auth');

// すべてのルートでJWT認証が必要
router.use(authenticateJWT);

// 以下のルートはマネージャー以上の権限が必要
router.use(isManager);

// シフト一覧の取得
router.get('/', shiftController.getAllShifts);

// 特定のシフト情報の取得
router.get('/:id', shiftController.getShiftById);

// 特定の年月のシフト情報の取得
router.get('/:year/:month', shiftController.getShiftByYearMonth);

// 特定の年月のシフト検証
router.get('/:year/:month/validate', shiftController.validateShift);

// シフト変更履歴の取得
router.get('/:year/:month/logs', shiftController.getShiftChangeLogs);

// シフトの自動生成
router.post('/generate', shiftController.generateShift);

// シフトの確定
router.post('/:year/:month/confirm', shiftController.confirmShift);

// シフト割り当ての作成
router.post('/:year/:month/assignments', shiftController.createShiftAssignment);

// シフト割り当ての更新
router.put('/:year/:month/assignments/:assignmentId', shiftController.updateShiftAssignment);

// シフト割り当ての削除
router.delete('/:year/:month/assignments/:assignmentId', shiftController.deleteShiftAssignment);

module.exports = router;