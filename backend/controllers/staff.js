const { Staff, StaffDayPreference, StaffDayOffRequest, Store } = require('../models');
const { sequelize } = require('../config/db');
const { Op } = require('sequelize');

const getAllDayOffRequests = async (req, res) => {
    try {
        const { status, store_id } = req.query;
        const whereClause = {};

        if (status) {
            whereClause.status = status;
        }

        const include = [{
            model: Staff,
            attributes: ['id', 'first_name', 'last_name', 'store_id'],
            as: 'staff'
        }];

        if (store_id) {
            include[0].where = { store_id };
        }

        if (req.user.role === 'owner' || req.user.role === 'staff') {
            let ownerId = req.user.id;

            if (req.user.role === 'staff' && req.user.parent_user_id) {
                ownerId = req.user.parent_user_id;
            }

            include[0].include = [{
                model: Store,
                where: { owner_id: ownerId },
                attributes: []
            }];
        }

        const requests = await StaffDayOffRequest.findAll({
            where: whereClause,
            include,
            order: [['date', 'ASC']]
        });

        const formattedRequests = requests.map(request => ({
            id: request.id,
            staff_id: request.staff_id,
            staff_name: `${request.staff.last_name} ${request.staff.first_name}`,
            date: request.date,
            reason: request.reason,
            status: request.status
        }));

        res.status(200).json(formattedRequests);
    } catch (error) {
        console.error('休み希望取得エラー:', error);
        res.status(500).json({ message: '休み希望の取得中にエラーが発生しました', error: error.message });
    }
};

const getAllStaff = async (req, res) => {
    try {
        const { store_id } = req.query;

        const where = {};
        if (store_id) {
            where.store_id = store_id;
        }

        const include = [
            {
                model: Store,
                attributes: ['id', 'name'],
                required: true
            },
            {
                model: StaffDayPreference,
                as: 'dayPreferences',
                required: false
            },
            {
                model: StaffDayOffRequest,
                as: 'dayOffRequests',
                required: false
            },
            {
                model: Store,
                as: 'stores',
                through: { attributes: [] },
                attributes: ['id', 'name', 'area'],
                required: false
            }
        ];

        if (req.user.role === 'owner' || req.user.role === 'staff') {
            let ownerId = req.user.id;

            if (req.user.role === 'staff' && req.user.parent_user_id) {
                ownerId = req.user.parent_user_id;
            }

            include[0].where = { owner_id: ownerId };
        }

        const staff = await Staff.findAll({
            where,
            include,
            order: [['id', 'ASC']]
        });

        res.status(200).json(staff);
    } catch (error) {
        console.error('スタッフ一覧取得エラー詳細:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            sql: error.sql || 'No SQL',
            parameters: error.parameters || 'No parameters'
        });

        res.status(500).json({
            message: 'スタッフ一覧の取得中にエラーが発生しました',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

const getStaffById = async (req, res) => {
    try {
        const { id } = req.params;

        const include = [
            {
                model: Store,
                attributes: ['id', 'name'],
                required: true
            },
            { model: StaffDayPreference, as: 'dayPreferences' },
            { model: StaffDayOffRequest, as: 'dayOffRequests' },
            {
                model: Store,
                as: 'stores',
                through: { attributes: [] },
                attributes: ['id', 'name', 'area'],
                required: false
            }
        ];

        if (req.user.role === 'owner' || req.user.role === 'staff') {
            let ownerId = req.user.id;

            if (req.user.role === 'staff' && req.user.parent_user_id) {
                ownerId = req.user.parent_user_id;
            }

            include[0].where = { owner_id: ownerId };
        }

        const staff = await Staff.findByPk(id, {
            include
        });

        if (!staff) {
            return res.status(404).json({ message: 'スタッフが見つかりません' });
        }

        if (staff.dayPreferences && !Array.isArray(staff.dayPreferences)) {
            staff.dayPreferences = [];
        }

        if (staff.dayOffRequests && !Array.isArray(staff.dayOffRequests)) {
            staff.dayOffRequests = [];
        }

        const existingDayPreferences = staff.dayPreferences.map(p => parseInt(p.day_of_week, 10));
        const missingDays = Array.from({ length: 7 }, (_, i) => i).filter(day => !existingDayPreferences.includes(day));

        const additionalPreferences = missingDays.map(day => ({
            staff_id: parseInt(id, 10),
            day_of_week: day,
            available: true,
            preferred_start_time: null,
            preferred_end_time: null,
            break_start_time: null,
            break_end_time: null
        }));

        const completeResponse = {
            ...staff.toJSON(),
            dayPreferences: [...staff.dayPreferences, ...additionalPreferences],
            store_ids: staff.stores ? staff.stores.map(store => store.id) : []
        };

        res.status(200).json(completeResponse);
    } catch (error) {
        console.error('スタッフ取得エラー:', error);
        res.status(500).json({ message: 'スタッフ情報の取得中にエラーが発生しました' });
    }
};

const createStaff = async (req, res) => {
    try {
        const {
            store_id,
            store_ids,
            first_name,
            last_name,
            furigana,
            gender,
            position,
            employment_type,
            max_hours_per_month,
            min_hours_per_month,
            max_hours_per_day,
            max_consecutive_days,
            day_preferences,
            day_off_requests
        } = req.body;

        if (!store_id || !first_name || !last_name) {
            return res.status(400).json({ message: '店舗ID、姓、名は必須です' });
        }

        let whereClause = { id: store_id };

        if (req.user.role === 'owner' || req.user.role === 'staff') {
            let ownerId = req.user.id;

            if (req.user.role === 'staff' && req.user.parent_user_id) {
                ownerId = req.user.parent_user_id;
            }

            whereClause.owner_id = ownerId;
        }

        const store = await Store.findOne({ where: whereClause });
        if (!store) {
            return res.status(404).json({ message: '指定された店舗が存在しません' });
        }

        const result = await sequelize.transaction(async (t) => {
            const staff = await Staff.create({
                store_id,
                first_name,
                last_name,
                furigana,
                gender,
                position,
                employment_type,
                max_hours_per_month,
                min_hours_per_month,
                max_hours_per_day,
                max_consecutive_days
            }, { transaction: t });

            let storesToAssign = [];

            if (store_ids && Array.isArray(store_ids) && store_ids.length > 0) {
                storesToAssign = store_ids.includes(store_id) ? store_ids : [...store_ids, store_id];
            } else {
                storesToAssign = [store_id];
            }

            await staff.setStores(storesToAssign, { transaction: t });

            if (day_preferences && day_preferences.length > 0) {
                await StaffDayPreference.bulkCreate(
                    day_preferences.map(pref => ({
                        staff_id: staff.id,
                        day_of_week: pref.day_of_week,
                        available: pref.available !== undefined ? pref.available : true,
                        preferred_start_time: pref.preferred_start_time,
                        preferred_end_time: pref.preferred_end_time,
                        break_start_time: pref.break_start_time,
                        break_end_time: pref.break_end_time
                    })),
                    { transaction: t }
                );
            } else {
                const defaultPreferences = [];
                for (let day = 0; day < 7; day++) {
                    defaultPreferences.push({
                        staff_id: staff.id,
                        day_of_week: day,
                        available: true,
                        preferred_start_time: null,
                        preferred_end_time: null,
                        break_start_time: null,
                        break_end_time: null
                    });
                }
                await StaffDayPreference.bulkCreate(defaultPreferences, { transaction: t });
            }

            if (day_off_requests && day_off_requests.length > 0) {
                await StaffDayOffRequest.bulkCreate(
                    day_off_requests.map(req => ({
                        staff_id: staff.id,
                        date: req.date,
                        reason: req.reason,
                        status: req.status || 'pending'
                    })),
                    { transaction: t }
                );
            }

            return staff;
        });

        const createdStaff = await Staff.findByPk(result.id, {
            include: [
                { model: Store, attributes: ['id', 'name'] },
                { model: StaffDayPreference, as: 'dayPreferences' },
                { model: StaffDayOffRequest, as: 'dayOffRequests' },
                {
                    model: Store,
                    as: 'stores',
                    through: { attributes: [] },
                    attributes: ['id', 'name', 'area']
                }
            ]
        });

        res.status(201).json(createdStaff);
    } catch (error) {
        console.error('スタッフ作成エラー:', error);
        res.status(500).json({ message: 'スタッフの作成中にエラーが発生しました', error: error.message });
    }
};

const updateStaff = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            store_id,
            store_ids,
            first_name,
            last_name,
            furigana,
            gender,
            position,
            employment_type,
            max_hours_per_month,
            min_hours_per_month,
            max_hours_per_day,
            max_consecutive_days,
            day_preferences,
            day_off_requests,
            change_reason
        } = req.body;
        const isImpersonating = req.query.impersonation === 'true';

        const include = [
            {
                model: Store,
                attributes: ['id', 'name'],
                required: true
            }
        ];

        if (req.user.role === 'owner' || req.user.role === 'staff') {
            let ownerId = req.user.id;

            if (req.user.role === 'staff' && req.user.parent_user_id) {
                ownerId = req.user.parent_user_id;
            }

            include[0].where = { owner_id: ownerId };
        }

        const staff = await Staff.findByPk(id, {
            include
        });

        if (!staff) {
            return res.status(404).json({ message: 'スタッフが見つかりません' });
        }

        const previousValues = {
            store_id: staff.store_id,
            first_name: staff.first_name,
            last_name: staff.last_name,
            furigana: staff.furigana,
            gender: staff.gender,
            position: staff.position,
            employment_type: staff.employment_type,
            max_hours_per_month: staff.max_hours_per_month,
            min_hours_per_month: staff.min_hours_per_month,
            max_hours_per_day: staff.max_hours_per_day,
            max_consecutive_days: staff.max_consecutive_days
        };

        await sequelize.transaction(async (t) => {
            await staff.update({
                store_id: store_id || staff.store_id,
                first_name: first_name || staff.first_name,
                last_name: last_name || staff.last_name,
                furigana: furigana !== undefined ? furigana : staff.furigana,
                gender: gender !== undefined ? gender : staff.gender,
                position: position !== undefined ? position : staff.position,
                employment_type: employment_type !== undefined ? employment_type : staff.employment_type,
                max_hours_per_month: max_hours_per_month !== undefined ? max_hours_per_month : staff.max_hours_per_month,
                min_hours_per_month: min_hours_per_month !== undefined ? min_hours_per_month : staff.min_hours_per_month,
                max_hours_per_day: max_hours_per_day !== undefined ? max_hours_per_day : staff.max_hours_per_day,
                max_consecutive_days: max_consecutive_days !== undefined ? max_consecutive_days : staff.max_consecutive_days
            }, { transaction: t });

            if (store_ids !== undefined) {
                let storesToAssign = [];

                if (store_ids && Array.isArray(store_ids) && store_ids.length > 0) {
                    const finalStoreId = store_id || staff.store_id;
                    storesToAssign = store_ids.includes(finalStoreId) ? store_ids : [...store_ids, finalStoreId];
                } else {
                    storesToAssign = [store_id || staff.store_id];
                }

                await staff.setStores(storesToAssign, { transaction: t });
            }

            if (day_preferences !== undefined) {
                await StaffDayPreference.destroy({
                    where: { staff_id: id },
                    transaction: t
                });

                if (day_preferences && Array.isArray(day_preferences) && day_preferences.length > 0) {
                    await StaffDayPreference.bulkCreate(
                        day_preferences.map(pref => ({
                            staff_id: id,
                            day_of_week: parseInt(pref.day_of_week, 10),
                            available: pref.available === true || pref.available === 'true',
                            preferred_start_time: pref.preferred_start_time || null,
                            preferred_end_time: pref.preferred_end_time || null,
                            break_start_time: pref.break_start_time || null,
                            break_end_time: pref.break_end_time || null
                        })),
                        { transaction: t }
                    );
                }
            }

            if (day_off_requests !== undefined) {
                await StaffDayOffRequest.destroy({
                    where: {
                        staff_id: id,
                        status: 'pending'
                    },
                    transaction: t
                });

                if (day_off_requests && Array.isArray(day_off_requests) && day_off_requests.length > 0) {
                    await StaffDayOffRequest.bulkCreate(
                        day_off_requests.map(req => ({
                            staff_id: id,
                            date: req.date,
                            reason: req.reason || "requested",
                            status: req.status || "pending"
                        })),
                        { transaction: t }
                    );
                }
            }
        });

        const fields = [];
        const previousValuesList = [];
        const newValuesList = [];

        if (store_id && store_id !== previousValues.store_id) {
            fields.push('store_id');
            previousValuesList.push(String(previousValues.store_id));
            newValuesList.push(String(store_id));
        }
        if (first_name && first_name !== previousValues.first_name) {
            fields.push('first_name');
            previousValuesList.push(previousValues.first_name);
            newValuesList.push(first_name);
        }
        if (last_name && last_name !== previousValues.last_name) {
            fields.push('last_name');
            previousValuesList.push(previousValues.last_name);
            newValuesList.push(last_name);
        }
        if (furigana !== undefined && furigana !== previousValues.furigana) {
            fields.push('furigana');
            previousValuesList.push(previousValues.furigana);
            newValuesList.push(furigana);
        }
        if (gender !== undefined && gender !== previousValues.gender) {
            fields.push('gender');
            previousValuesList.push(previousValues.gender);
            newValuesList.push(gender);
        }
        if (position !== undefined && position !== previousValues.position) {
            fields.push('position');
            previousValuesList.push(previousValues.position);
            newValuesList.push(position);
        }
        if (employment_type !== undefined && employment_type !== previousValues.employment_type) {
            fields.push('employment_type');
            previousValuesList.push(previousValues.employment_type);
            newValuesList.push(employment_type);
        }
        if (max_hours_per_month !== undefined && max_hours_per_month !== previousValues.max_hours_per_month) {
            fields.push('max_hours_per_month');
            previousValuesList.push(String(previousValues.max_hours_per_month));
            newValuesList.push(String(max_hours_per_month));
        }
        if (min_hours_per_month !== undefined && min_hours_per_month !== previousValues.min_hours_per_month) {
            fields.push('min_hours_per_month');
            previousValuesList.push(String(previousValues.min_hours_per_month));
            newValuesList.push(String(min_hours_per_month));
        }
        if (max_hours_per_day !== undefined && max_hours_per_day !== previousValues.max_hours_per_day) {
            fields.push('max_hours_per_day');
            previousValuesList.push(String(previousValues.max_hours_per_day));
            newValuesList.push(String(max_hours_per_day));
        }
        if (max_consecutive_days !== undefined && max_consecutive_days !== previousValues.max_consecutive_days) {
            fields.push('max_consecutive_days');
            previousValuesList.push(String(previousValues.max_consecutive_days));
            newValuesList.push(String(max_consecutive_days));
        }
        if (day_preferences !== undefined) {
            fields.push('day_preferences');
            previousValuesList.push('変更前の希望シフト設定');
            newValuesList.push('変更後の希望シフト設定');
        }
        if (day_off_requests !== undefined) {
            fields.push('day_off_requests');
            previousValuesList.push('変更前の休み希望設定');
            newValuesList.push('変更後の休み希望設定');
        }

        if (fields.length > 0) {
            req.logChange = {
                userId: parseInt(id),
                changeType: 'update',
                fields: fields,
                previousValues: previousValuesList,
                newValues: newValuesList,
                reason: change_reason || '管理者による更新',
                isImpersonating: isImpersonating
            };
        }

        const updatedStaff = await Staff.findByPk(id, {
            include: [
                { model: Store, attributes: ['id', 'name'] },
                { model: StaffDayPreference, as: 'dayPreferences' },
                { model: StaffDayOffRequest, as: 'dayOffRequests' },
                {
                    model: Store,
                    as: 'stores',
                    through: { attributes: [] },
                    attributes: ['id', 'name', 'area']
                }
            ]
        });

        res.status(200).json(updatedStaff);
    } catch (error) {
        console.error('スタッフ更新エラー:', error);
        res.status(500).json({ message: 'スタッフ情報の更新中にエラーが発生しました', error: error.message });
    }
};

const deleteStaff = async (req, res) => {
    try {
        const { id } = req.params;

        const include = [
            {
                model: Store,
                attributes: ['id', 'name'],
                required: true
            }
        ];

        if (req.user.role === 'owner' || req.user.role === 'staff') {
            let ownerId = req.user.id;

            if (req.user.role === 'staff' && req.user.parent_user_id) {
                ownerId = req.user.parent_user_id;
            }

            include[0].where = { owner_id: ownerId };
        }

        const staff = await Staff.findByPk(id, {
            include
        });

        if (!staff) {
            return res.status(404).json({ message: 'スタッフが見つかりません' });
        }

        await staff.destroy();

        res.status(200).json({ message: 'スタッフが削除されました' });
    } catch (error) {
        console.error('スタッフ削除エラー:', error);
        res.status(500).json({ message: 'スタッフの削除中にエラーが発生しました' });
    }
};

const getStaffDayPreferences = async (req, res) => {
    try {
        const { id } = req.params;

        const dayPreferences = await StaffDayPreference.findAll({
            where: { staff_id: id },
            order: [['day_of_week', 'ASC']]
        });

        res.status(200).json(dayPreferences);
    } catch (error) {
        console.error('希望シフト取得エラー:', error);
        res.status(500).json({ message: '希望シフト情報の取得中にエラーが発生しました' });
    }
};

const getStaffDayOffRequests = async (req, res) => {
    try {
        const { id } = req.params;
        const { year, month, status } = req.query;

        const where = { staff_id: id };

        if (year && month) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);

            where.date = {
                [Op.between]: [startDate, endDate]
            };
        }

        if (status) {
            where.status = status;
        }

        const dayOffRequests = await StaffDayOffRequest.findAll({
            where,
            order: [['date', 'ASC']]
        });

        res.status(200).json(dayOffRequests);
    } catch (error) {
        console.error('休み希望取得エラー:', error);
        res.status(500).json({ message: '休み希望情報の取得中にエラーが発生しました' });
    }
};

const updateDayOffRequestStatus = async (req, res) => {
    try {
        const { id, requestId } = req.params;
        const { status } = req.body;

        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: '無効なステータスです。pending, approved, rejectedのいずれかを指定してください' });
        }

        const dayOffRequest = await StaffDayOffRequest.findOne({
            where: {
                id: requestId,
                staff_id: id
            }
        });

        if (!dayOffRequest) {
            return res.status(404).json({ message: '指定された休み希望が見つかりません' });
        }

        await dayOffRequest.update({ status });

        res.status(200).json(dayOffRequest);
    } catch (error) {
        console.error('休み希望ステータス更新エラー:', error);
        res.status(500).json({ message: '休み希望ステータスの更新中にエラーが発生しました' });
    }
};

module.exports = {
    getAllDayOffRequests,
    getAllStaff,
    getStaffById,
    createStaff,
    updateStaff,
    deleteStaff,
    getStaffDayPreferences,
    getStaffDayOffRequests,
    updateDayOffRequestStatus
};