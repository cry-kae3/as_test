const express = require('express');
const router = express.Router();
const { User, UserChangeLog } = require('../models');
const { authenticateSession, isAdmin, isOwnerOrAdmin } = require('../middleware/auth');

router.use(authenticateSession);
router.use(isOwnerOrAdmin);

router.get('/change-logs', async (req, res) => {
    try {
        const logs = await UserChangeLog.findAll({
            include: [
                {
                    model: User,
                    attributes: ['username'],
                    as: 'admin'
                },
                {
                    model: User,
                    attributes: ['username']
                }
            ],
            order: [['created_at', 'DESC']]
        });

        const formattedLogs = logs.map(log => ({
            id: log.id,
            admin_name: log.admin.username,
            user_name: log.User.username,
            change_type: log.change_type,
            field_changed: log.field_changed,
            previous_value: log.previous_value,
            new_value: log.new_value,
            change_reason: log.change_reason,
            impersonation_mode: log.impersonation_mode,
            created_at: log.created_at
        }));

        res.status(200).json(formattedLogs);
    } catch (error) {
        console.error('変更ログ取得エラー:', error);
        res.status(500).json({ message: '変更ログの取得中にエラーが発生しました' });
    }
});

module.exports = router;