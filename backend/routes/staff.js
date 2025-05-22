const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staff');
const { authenticateJWT, isAdmin, isManager } = require('../middleware/auth');

// すべてのルートでJWT認証が必要
router.use(authenticateJWT);

// 以下のルートはマネージャー以上の権限が必要
router.use(isManager);

// スタッフ一覧の取得
router.get('/', staffController.getAllStaff);

// 特定のスタッフ情報の取得
router.get('/:id', staffController.getStaffById);

// スタッフの曜日ごとの希望シフトの取得
router.get('/:id/day-preferences', staffController.getStaffDayPreferences);

// スタッフの休み希望の取得
router.get('/:id/day-off-requests', staffController.getStaffDayOffRequests);

// スタッフの作成
router.post('/', staffController.createStaff);

// スタッフ情報の更新
router.put('/:id', staffController.updateStaff);

// 休み希望のステータス更新
router.patch('/:id/day-off-requests/:requestId', staffController.updateDayOffRequestStatus);

// スタッフの削除（管理者のみ）
router.delete('/:id', isAdmin, staffController.deleteStaff);


router.get('/day-off-requests', staffController.getAllDayOffRequests);

module.exports = router;