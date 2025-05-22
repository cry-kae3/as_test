const { UserChangeLog } = require('../models');

const logUserChange = async (req, res, next) => {
    const originalSend = res.send;

    res.send = function (data) {
        if (res.statusCode >= 200 && res.statusCode < 300 && req.logChange) {
            const { userId, changeType, fields, previousValues, newValues, reason, isImpersonating } = req.logChange;

            try {
                // スタッフの場合はログを記録しない
                // スタッフIDがユーザーテーブルに存在するかチェックするか、
                // または単にスタッフの変更はログに記録しないようにする
                if (req.originalUrl.includes('/staff/') && !req.originalUrl.includes('/users/')) {
                    console.log('スタッフの変更はログに記録しません');
                } else {
                    fields.forEach(async (field, index) => {
                        await UserChangeLog.create({
                            user_id: userId,
                            admin_id: req.user.id,
                            change_type: changeType,
                            field_changed: field,
                            previous_value: previousValues[index],
                            new_value: newValues[index],
                            change_reason: reason,
                            impersonation_mode: isImpersonating
                        });
                    });
                }
            } catch (error) {
                console.error('変更ログ記録エラー:', error);
            }
        }

        originalSend.call(this, data);
    };

    next();
};

module.exports = { logUserChange };