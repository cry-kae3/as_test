const { SystemSetting, User } = require('../models');

const getSystemSettings = async (req, res) => {
    try {
        let userId = req.user.id;

        if (req.user.role === 'staff' && req.user.parent_user_id) {
            userId = req.user.parent_user_id;
        }

        let settings = await SystemSetting.findOne({
            where: { user_id: userId }
        });

        if (!settings) {
            settings = await SystemSetting.create({
                user_id: userId,
                closing_day: 25,
                min_daily_hours: 4.0,
                timezone: 'Asia/Tokyo',
                additional_settings: {}
            });
        }

        res.status(200).json(settings);
    } catch (error) {
        console.error('システム設定取得エラー:', error);
        res.status(500).json({ message: 'システム設定の取得中にエラーが発生しました' });
    }
};

const updateSystemSettings = async (req, res) => {
    try {
        let userId = req.user.id;

        if (req.user.role === 'staff' && req.user.parent_user_id) {
            userId = req.user.parent_user_id;
        }

        const { closing_day, min_daily_hours, additional_settings } = req.body;

        if (closing_day && (closing_day < 1 || closing_day > 31)) {
            return res.status(400).json({ message: '締め日は1-31の範囲で指定してください' });
        }

        if (min_daily_hours && (min_daily_hours < 1.0 || min_daily_hours > 12.0)) {
            return res.status(400).json({ message: '最低勤務時間は1.0-12.0時間の範囲で指定してください' });
        }

        let settings = await SystemSetting.findOne({
            where: { user_id: userId }
        });

        const updateData = {};
        if (closing_day !== undefined) updateData.closing_day = closing_day;
        if (min_daily_hours !== undefined) updateData.min_daily_hours = min_daily_hours;
        updateData.timezone = 'Asia/Tokyo';
        if (additional_settings !== undefined) updateData.additional_settings = additional_settings;

        if (settings) {
            await settings.update(updateData);
        } else {
            settings = await SystemSetting.create({
                user_id: userId,
                closing_day: closing_day || 25,
                min_daily_hours: min_daily_hours || 4.0,
                timezone: 'Asia/Tokyo',
                additional_settings: additional_settings || {}
            });
        }

        res.status(200).json(settings);
    } catch (error) {
        console.error('システム設定更新エラー:', error);
        res.status(500).json({ message: 'システム設定の更新中にエラーが発生しました' });
    }
};

module.exports = {
    getSystemSettings,
    updateSystemSettings
};