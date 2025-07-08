const { Staff, StaffDayPreference, StaffDayOffRequest, Store, sequelize } = require('../models');
const { Op } = require('sequelize');

// スタッフ一覧取得
const getStaff = async (req, res) => {
    try {
        const { store_id } = req.query;

        let whereClause = {};
        let include = [
            {
                model: Store,
                as: 'stores',
                attributes: ['id', 'name'],
                through: { attributes: [] }
            },
            {
                model: Store,
                as: 'aiGenerationStores',
                attributes: ['id', 'name'],
                through: { attributes: [] }
            },
            {
                model: StaffDayPreference,
                as: 'dayPreferences',
                required: false
            },
            {
                model: StaffDayOffRequest,
                as: 'dayOffRequests',
                required: false,
                where: {
                    date: {
                        [Op.gte]: new Date()
                    }
                }
            }
        ];

        if (store_id) {
            include.push({
                model: Store,
                as: 'stores',
                where: { id: store_id },
                attributes: [],
                through: { attributes: [] },
                required: true
            });
        }

        const staff = await Staff.findAll({
            include,
            order: [['last_name', 'ASC'], ['first_name', 'ASC']]
        });

        // レスポンス用にデータを整形し、Boolean値を確実に変換
        const formattedStaff = staff.map(s => {
            const staffData = s.toJSON();

            // dayPreferencesのBoolean値を厳密に変換
            if (staffData.dayPreferences) {
                staffData.dayPreferences = staffData.dayPreferences.map(pref => ({
                    ...pref,
                    available: pref.available === 'false' || pref.available === false || pref.available === 0 ? false : Boolean(pref.available)
                }));
            }

            // 勤務可能店舗のIDリストを追加
            staffData.store_ids = staffData.stores ? staffData.stores.map(store => store.id) : [];
            staffData.ai_generation_store_ids = staffData.aiGenerationStores ? staffData.aiGenerationStores.map(store => store.id) : [];

            return staffData;
        });

        res.json(formattedStaff);
    } catch (error) {
        console.error('スタッフ一覧取得エラー:', error);
        res.status(500).json({ message: 'スタッフ一覧の取得に失敗しました' });
    }
};

// 特定スタッフ取得
const getStaffById = async (req, res) => {
    try {
        const { id } = req.params;

        const staff = await Staff.findByPk(id, {
            include: [
                {
                    model: Store,
                    as: 'stores',
                    attributes: ['id', 'name'],
                    through: { attributes: [] }
                },
                {
                    model: Store,
                    as: 'aiGenerationStores',
                    attributes: ['id', 'name'],
                    through: { attributes: [] }
                },
                {
                    model: StaffDayPreference,
                    as: 'dayPreferences',
                    order: [['day_of_week', 'ASC']]
                },
                {
                    model: StaffDayOffRequest,
                    as: 'dayOffRequests',
                    order: [['date', 'ASC']]
                }
            ]
        });

        if (!staff) {
            return res.status(404).json({ message: 'スタッフが見つかりません' });
        }

        const staffData = staff.toJSON();

        // dayPreferencesのBoolean値を厳密に変換
        if (staffData.dayPreferences) {
            staffData.dayPreferences = staffData.dayPreferences.map(pref => ({
                ...pref,
                available: pref.available === 'false' || pref.available === false || pref.available === 0 ? false : Boolean(pref.available)
            }));
        }

        // 勤務可能店舗のIDリストを追加
        staffData.store_ids = staffData.stores ? staffData.stores.map(store => store.id) : [];
        staffData.ai_generation_store_ids = staffData.aiGenerationStores ? staffData.aiGenerationStores.map(store => store.id) : [];

        res.json(staffData);
    } catch (error) {
        console.error('スタッフ取得エラー:', error);
        res.status(500).json({ message: 'スタッフ情報の取得に失敗しました' });
    }
};

// スタッフ作成
const createStaff = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const {
            store_id,
            store_ids = [],
            ai_generation_store_ids = [],
            day_preferences = [],
            day_off_requests = [],
            ...staffData
        } = req.body;

        console.log('スタッフ作成リクエスト:', {
            staffData,
            store_ids,
            ai_generation_store_ids,
            day_preferences: day_preferences.map(pref => ({
                day_of_week: pref.day_of_week,
                available: pref.available,
                availableType: typeof pref.available
            }))
        });

        // 基本情報でスタッフを作成
        const staff = await Staff.create({
            ...staffData,
            store_id: store_id || (store_ids.length > 0 ? store_ids[0] : null)
        }, { transaction });

        // 勤務可能店舗の関連付け
        if (store_ids && store_ids.length > 0) {
            await staff.setStores(store_ids, { transaction });
        }

        // AI生成対象店舗の関連付け
        if (ai_generation_store_ids && ai_generation_store_ids.length > 0) {
            await staff.setAiGenerationStores(ai_generation_store_ids, { transaction });
        }

        // 希望シフトの作成
        if (day_preferences && day_preferences.length > 0) {
            const preferencesData = day_preferences.map(pref => ({
                staff_id: staff.id,
                day_of_week: parseInt(pref.day_of_week),
                available: pref.available === 'false' || pref.available === false || pref.available === 0 ? false : Boolean(pref.available),
                preferred_start_time: pref.preferred_start_time || null,
                preferred_end_time: pref.preferred_end_time || null,
                break_start_time: pref.break_start_time || null,
                break_end_time: pref.break_end_time || null
            }));

            console.log('希望シフト作成データ:', preferencesData);
            await StaffDayPreference.bulkCreate(preferencesData, { transaction });
        }

        // 休み希望の作成
        if (day_off_requests && day_off_requests.length > 0) {
            const requestsData = day_off_requests
                .filter(req => req.date)
                .map(req => ({
                    staff_id: staff.id,
                    date: req.date,
                    reason: req.reason || '',
                    status: req.status || 'pending'
                }));

            if (requestsData.length > 0) {
                await StaffDayOffRequest.bulkCreate(requestsData, { transaction });
            }
        }

        await transaction.commit();

        // 作成されたスタッフ情報を取得して返す
        const createdStaff = await Staff.findByPk(staff.id, {
            include: [
                {
                    model: Store,
                    as: 'stores',
                    attributes: ['id', 'name'],
                    through: { attributes: [] }
                },
                {
                    model: Store,
                    as: 'aiGenerationStores',
                    attributes: ['id', 'name'],
                    through: { attributes: [] }
                },
                {
                    model: StaffDayPreference,
                    as: 'dayPreferences',
                    order: [['day_of_week', 'ASC']]
                },
                {
                    model: StaffDayOffRequest,
                    as: 'dayOffRequests',
                    order: [['date', 'ASC']]
                }
            ]
        });

        const finalStaffData = createdStaff.toJSON();

        // dayPreferencesのBoolean値を厳密に変換
        if (finalStaffData.dayPreferences) {
            finalStaffData.dayPreferences = finalStaffData.dayPreferences.map(pref => ({
                ...pref,
                available: pref.available === 'false' || pref.available === false || pref.available === 0 ? false : Boolean(pref.available)
            }));
        }

        // 勤務可能店舗のIDリストを追加
        finalStaffData.store_ids = finalStaffData.stores ? finalStaffData.stores.map(store => store.id) : [];
        finalStaffData.ai_generation_store_ids = finalStaffData.aiGenerationStores ? finalStaffData.aiGenerationStores.map(store => store.id) : [];

        res.json(finalStaffData);
    } catch (error) {
        await transaction.rollback();
        console.error('スタッフ作成エラー:', error);
        res.status(500).json({ message: 'スタッフの作成に失敗しました' });
    }
};

// スタッフ更新
const updateStaff = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { id } = req.params;
        const {
            store_ids = [],
            ai_generation_store_ids = [],
            day_preferences = [],
            day_off_requests = [],
            ...staffData
        } = req.body;

        console.log('スタッフ更新リクエスト:', {
            id,
            staffData,
            store_ids,
            ai_generation_store_ids,
            day_preferences: day_preferences.map(pref => ({
                day_of_week: pref.day_of_week,
                available: pref.available,
                availableType: typeof pref.available
            }))
        });

        const staff = await Staff.findByPk(id);
        if (!staff) {
            await transaction.rollback();
            return res.status(404).json({ message: 'スタッフが見つかりません' });
        }

        // 基本情報を更新
        await staff.update({
            ...staffData,
            store_id: staffData.store_id || (store_ids.length > 0 ? store_ids[0] : staff.store_id)
        }, { transaction });

        // 勤務可能店舗の更新
        if (store_ids && store_ids.length > 0) {
            await staff.setStores(store_ids, { transaction });
        }

        // AI生成対象店舗の更新
        if (ai_generation_store_ids && ai_generation_store_ids.length > 0) {
            await staff.setAiGenerationStores(ai_generation_store_ids, { transaction });
        } else {
            await staff.setAiGenerationStores([], { transaction });
        }

        // 既存の希望シフトを削除
        await StaffDayPreference.destroy({
            where: { staff_id: id },
            transaction
        });

        // 新しい希望シフトを作成
        if (day_preferences && day_preferences.length > 0) {
            const preferencesData = day_preferences.map(pref => ({
                staff_id: parseInt(id),
                day_of_week: parseInt(pref.day_of_week),
                available: pref.available === 'false' || pref.available === false || pref.available === 0 ? false : Boolean(pref.available),
                preferred_start_time: pref.preferred_start_time || null,
                preferred_end_time: pref.preferred_end_time || null,
                break_start_time: pref.break_start_time || null,
                break_end_time: pref.break_end_time || null
            }));

            console.log('希望シフト更新データ:', preferencesData);
            await StaffDayPreference.bulkCreate(preferencesData, { transaction });
        }

        // 既存の休み希望を削除（将来の日付のみ）
        await StaffDayOffRequest.destroy({
            where: {
                staff_id: id,
                date: {
                    [Op.gte]: new Date()
                }
            },
            transaction
        });

        // 新しい休み希望を作成
        if (day_off_requests && day_off_requests.length > 0) {
            const requestsData = day_off_requests
                .filter(req => req.date)
                .map(req => ({
                    staff_id: parseInt(id),
                    date: req.date,
                    reason: req.reason || '',
                    status: req.status || 'pending'
                }));

            if (requestsData.length > 0) {
                await StaffDayOffRequest.bulkCreate(requestsData, { transaction });
            }
        }

        await transaction.commit();

        // 更新されたスタッフ情報を取得して返す
        const updatedStaff = await Staff.findByPk(id, {
            include: [
                {
                    model: Store,
                    as: 'stores',
                    attributes: ['id', 'name'],
                    through: { attributes: [] }
                },
                {
                    model: Store,
                    as: 'aiGenerationStores',
                    attributes: ['id', 'name'],
                    through: { attributes: [] }
                },
                {
                    model: StaffDayPreference,
                    as: 'dayPreferences',
                    order: [['day_of_week', 'ASC']]
                },
                {
                    model: StaffDayOffRequest,
                    as: 'dayOffRequests',
                    order: [['date', 'ASC']]
                }
            ]
        });

        const finalStaffData = updatedStaff.toJSON();

        // dayPreferencesのBoolean値を厳密に変換
        if (finalStaffData.dayPreferences) {
            finalStaffData.dayPreferences = finalStaffData.dayPreferences.map(pref => ({
                ...pref,
                available: pref.available === 'false' || pref.available === false || pref.available === 0 ? false : Boolean(pref.available)
            }));
        }

        // 勤務可能店舗のIDリストを追加
        finalStaffData.store_ids = finalStaffData.stores ? finalStaffData.stores.map(store => store.id) : [];
        finalStaffData.ai_generation_store_ids = finalStaffData.aiGenerationStores ? finalStaffData.aiGenerationStores.map(store => store.id) : [];

        res.json(finalStaffData);
    } catch (error) {
        await transaction.rollback();
        console.error('スタッフ更新エラー:', error);
        res.status(500).json({ message: 'スタッフ情報の更新に失敗しました' });
    }
};

// スタッフ削除
const deleteStaff = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { id } = req.params;

        const staff = await Staff.findByPk(id);
        if (!staff) {
            await transaction.rollback();
            return res.status(404).json({ message: 'スタッフが見つかりません' });
        }

        // 関連データも含めて削除
        await StaffDayPreference.destroy({
            where: { staff_id: id },
            transaction
        });

        await StaffDayOffRequest.destroy({
            where: { staff_id: id },
            transaction
        });

        await staff.destroy({ transaction });

        await transaction.commit();

        res.json({ message: 'スタッフを削除しました' });
    } catch (error) {
        await transaction.rollback();
        console.error('スタッフ削除エラー:', error);
        res.status(500).json({ message: 'スタッフの削除に失敗しました' });
    }
};

// スタッフの希望シフト取得
const getStaffDayPreferences = async (req, res) => {
    try {
        const { id } = req.params;

        const preferences = await StaffDayPreference.findAll({
            where: { staff_id: id },
            order: [['day_of_week', 'ASC']]
        });

        // Boolean値を厳密に変換
        const formattedPreferences = preferences.map(pref => {
            const prefData = pref.toJSON();
            return {
                ...prefData,
                available: prefData.available === 'false' || prefData.available === false || prefData.available === 0 ? false : Boolean(prefData.available)
            };
        });

        res.json(formattedPreferences);
    } catch (error) {
        console.error('希望シフト取得エラー:', error);
        res.status(500).json({ message: '希望シフトの取得に失敗しました' });
    }
};

// スタッフの休み希望取得
const getStaffDayOffRequests = async (req, res) => {
    try {
        const { id } = req.params;
        const { year, month, status } = req.query;

        let whereClause = { staff_id: id };

        if (year && month) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);
            whereClause.date = {
                [Op.between]: [startDate, endDate]
            };
        }

        if (status) {
            whereClause.status = status;
        }

        const dayOffRequests = await StaffDayOffRequest.findAll({
            where: whereClause,
            order: [['date', 'ASC']]
        });

        res.json(dayOffRequests);
    } catch (error) {
        console.error('休み希望取得エラー:', error);
        res.status(500).json({ message: '休み希望の取得に失敗しました' });
    }
};

// 休み希望ステータス更新
const updateDayOffRequestStatus = async (req, res) => {
    try {
        const { staffId, requestId } = req.params;
        const { status } = req.body;

        const dayOffRequest = await StaffDayOffRequest.findOne({
            where: {
                id: requestId,
                staff_id: staffId
            }
        });

        if (!dayOffRequest) {
            return res.status(404).json({ message: '休み希望が見つかりません' });
        }

        await dayOffRequest.update({ status });

        res.json(dayOffRequest);
    } catch (error) {
        console.error('休み希望ステータス更新エラー:', error);
        res.status(500).json({ message: '休み希望ステータスの更新に失敗しました' });
    }
};

// 休み希望一覧取得
const getDayOffRequests = async (req, res) => {
    try {
        const { status, owner_id, store_id } = req.query;

        let whereClause = {};
        let include = [
            {
                model: Staff,
                as: 'staff',
                attributes: ['id', 'first_name', 'last_name', 'store_id'],
                include: []
            }
        ];

        if (status) {
            whereClause.status = status;
        }

        if (owner_id) {
            include[0].include.push({
                model: Store,
                where: { owner_id: owner_id },
                attributes: []
            });
        }

        if (store_id) {
            include[0].where = { store_id: store_id };
        }

        const dayOffRequests = await StaffDayOffRequest.findAll({
            where: whereClause,
            include,
            order: [['date', 'ASC']]
        });

        res.json(dayOffRequests);
    } catch (error) {
        console.error('休み希望一覧取得エラー:', error);
        res.status(500).json({ message: '休み希望一覧の取得に失敗しました' });
    }
};

module.exports = {
    getStaff,
    getStaffById,
    createStaff,
    updateStaff,
    deleteStaff,
    getStaffDayPreferences,
    getStaffDayOffRequests,
    updateDayOffRequestStatus,
    getDayOffRequests
};