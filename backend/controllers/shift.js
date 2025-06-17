const { Shift, ShiftAssignment, Store, Staff, SystemSetting, ShiftChangeLog } = require('../models');
const { Op } = require('sequelize');
const shiftGeneratorService = require('../services/shiftGenerator');

const getAllShifts = async (req, res) => {
    try {
        const { store_id, year, month } = req.query;

        let whereClause = {};

        if (req.user.role === 'owner' || req.user.role === 'staff') {
            let ownerId = req.user.id;

            if (req.user.role === 'staff' && req.user.parent_user_id) {
                ownerId = req.user.parent_user_id;
            }

            const stores = await Store.findAll({
                where: { owner_id: ownerId },
                attributes: ['id']
            });

            const storeIds = stores.map(store => store.id);
            whereClause.store_id = { [Op.in]: storeIds };
        }

        if (store_id) {
            whereClause.store_id = store_id;
        }

        if (year) {
            whereClause.year = year;
        }

        if (month) {
            whereClause.month = month;
        }

        const shifts = await Shift.findAll({
            where: whereClause,
            include: [
                {
                    model: Store,
                    attributes: ['id', 'name']
                }
            ],
            order: [['year', 'DESC'], ['month', 'DESC']]
        });

        res.status(200).json(shifts);
    } catch (error) {
        console.error('シフト一覧取得エラー:', error);
        res.status(500).json({ message: 'シフト一覧の取得中にエラーが発生しました' });
    }
};

const getShiftById = async (req, res) => {
    try {
        const { id } = req.params;

        let whereClause = { id };

        if (req.user.role === 'owner' || req.user.role === 'staff') {
            let ownerId = req.user.id;

            if (req.user.role === 'staff' && req.user.parent_user_id) {
                ownerId = req.user.parent_user_id;
            }

            const stores = await Store.findAll({
                where: { owner_id: ownerId },
                attributes: ['id']
            });

            const storeIds = stores.map(store => store.id);
            whereClause.store_id = { [Op.in]: storeIds };
        }

        const shift = await Shift.findOne({
            where: whereClause,
            include: [
                {
                    model: Store,
                    attributes: ['id', 'name']
                },
                {
                    model: ShiftAssignment,
                    as: 'assignments',
                    include: [
                        {
                            model: Staff,
                            attributes: ['id', 'first_name', 'last_name']
                        }
                    ]
                }
            ]
        });

        if (!shift) {
            return res.status(404).json({ message: 'シフトが見つかりません' });
        }

        res.status(200).json(shift);
    } catch (error) {
        console.error('シフト取得エラー:', error);
        res.status(500).json({ message: 'シフトの取得中にエラーが発生しました' });
    }
};

const getShiftByYearMonth = async (req, res) => {
    try {
        const { year, month } = req.params;
        const { store_id } = req.query;

        if (!store_id) {
            return res.status(400).json({ message: '店舗IDが必要です' });
        }

        let whereClause = {
            year: parseInt(year),
            month: parseInt(month),
            store_id: parseInt(store_id)
        };

        if (req.user.role === 'owner' || req.user.role === 'staff') {
            let ownerId = req.user.id;

            if (req.user.role === 'staff' && req.user.parent_user_id) {
                ownerId = req.user.parent_user_id;
            }

            const store = await Store.findOne({
                where: {
                    id: store_id,
                    owner_id: ownerId
                }
            });

            if (!store) {
                return res.status(403).json({ message: 'この店舗のシフトにアクセスする権限がありません' });
            }
        }

        const shift = await Shift.findOne({
            where: whereClause,
            include: [
                {
                    model: ShiftAssignment,
                    as: 'assignments',
                    include: [
                        {
                            model: Staff,
                            attributes: ['id', 'first_name', 'last_name']
                        }
                    ]
                }
            ]
        });

        if (!shift) {
            return res.status(404).json({ message: 'シフトが見つかりません' });
        }

        const shifts = [];
        const assignmentsByDate = {};

        shift.assignments.forEach(assignment => {
            const date = assignment.date;
            if (!assignmentsByDate[date]) {
                assignmentsByDate[date] = [];
            }

            assignmentsByDate[date].push({
                id: assignment.id,
                staff_id: assignment.staff_id,
                staff_name: `${assignment.Staff.last_name} ${assignment.Staff.first_name}`,
                start_time: assignment.start_time,
                end_time: assignment.end_time,
                break_start_time: assignment.break_start_time,
                break_end_time: assignment.break_end_time,
                notes: assignment.notes
            });
        });

        Object.keys(assignmentsByDate).forEach(date => {
            shifts.push({
                date: date,
                assignments: assignmentsByDate[date]
            });
        });

        // 全店舗のスタッフ時間情報を取得
        const staffIds = [...new Set(shift.assignments.map(a => a.staff_id))];
        let allStoreHours = null;

        if (staffIds.length > 0) {
            try {
                allStoreHours = await shiftGeneratorService.getStaffTotalHoursAllStores(
                    staffIds,
                    parseInt(year),
                    parseInt(month)
                );
            } catch (error) {
                console.error('全店舗時間集計エラー:', error);
            }
        }

        const response = {
            id: shift.id,
            store_id: shift.store_id,
            year: shift.year,
            month: shift.month,
            status: shift.status,
            shifts: shifts.sort((a, b) => new Date(a.date) - new Date(b.date)),
            allStoreHours: allStoreHours
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('シフト取得エラー:', error);
        res.status(500).json({ message: 'シフトの取得中にエラーが発生しました' });
    }
};

// 全店舗のスタッフ時間集計を取得する新しいエンドポイント
const getStaffTotalHoursAllStores = async (req, res) => {
    try {
        const { year, month, store_id } = req.query;

        if (!year || !month || !store_id) {
            return res.status(400).json({ message: '年、月、店舗IDが必要です' });
        }

        // 権限チェック
        if (req.user.role === 'owner' || req.user.role === 'staff') {
            let ownerId = req.user.id;

            if (req.user.role === 'staff' && req.user.parent_user_id) {
                ownerId = req.user.parent_user_id;
            }

            const store = await Store.findOne({
                where: {
                    id: store_id,
                    owner_id: ownerId
                }
            });

            if (!store) {
                return res.status(403).json({ message: 'この店舗にアクセスする権限がありません' });
            }
        }

        // 対象店舗のスタッフIDを取得
        const staff = await Staff.findAll({
            where: { store_id: parseInt(store_id) },
            attributes: ['id']
        });

        const staffIds = staff.map(s => s.id);

        if (staffIds.length === 0) {
            return res.status(200).json({});
        }

        // 全店舗のスタッフ時間情報を取得
        const allStoreHours = await shiftGeneratorService.getStaffTotalHoursAllStores(
            staffIds,
            parseInt(year),
            parseInt(month)
        );

        res.status(200).json(allStoreHours);
    } catch (error) {
        console.error('全店舗時間集計取得エラー:', error);
        res.status(500).json({ message: '全店舗時間集計の取得中にエラーが発生しました' });
    }
};

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

const createShift = async (req, res) => {
    try {
        const { store_id, year, month, status } = req.body;

        if (!store_id || !year || !month) {
            return res.status(400).json({ message: '店舗ID、年、月は必須です' });
        }

        if (req.user.role === 'owner' || req.user.role === 'staff') {
            let ownerId = req.user.id;

            if (req.user.role === 'staff' && req.user.parent_user_id) {
                ownerId = req.user.parent_user_id;
            }

            const store = await Store.findOne({
                where: {
                    id: store_id,
                    owner_id: ownerId
                }
            });

            if (!store) {
                return res.status(403).json({ message: 'この店舗にシフトを作成する権限がありません' });
            }
        }

        const existingShift = await Shift.findOne({
            where: {
                store_id,
                year,
                month
            }
        });

        if (existingShift) {
            return res.status(400).json({ message: 'この期間のシフトは既に存在します' });
        }

        const shift = await Shift.create({
            store_id,
            year,
            month,
            status: status || 'draft'
        });

        res.status(201).json(shift);
    } catch (error) {
        console.error('シフト作成エラー:', error);
        res.status(500).json({ message: 'シフトの作成中にエラーが発生しました' });
    }
};

const generateShift = async (req, res) => {
    try {
        const { store_id, year, month } = req.body;

        if (!store_id || !year || !month) {
            return res.status(400).json({ message: '店舗ID、年、月は必須です' });
        }

        if (req.user.role === 'owner' || req.user.role === 'staff') {
            let ownerId = req.user.id;

            if (req.user.role === 'staff' && req.user.parent_user_id) {
                ownerId = req.user.parent_user_id;
            }

            const store = await Store.findOne({
                where: {
                    id: store_id,
                    owner_id: ownerId
                }
            });

            if (!store) {
                return res.status(403).json({ message: 'この店舗にシフトを生成する権限がありません' });
            }
        }

        const shiftData = await shiftGeneratorService.generateShift(store_id, year, month);

        const savedShift = await shiftGeneratorService.saveShift(shiftData, store_id, year, month);

        // 全店舗のスタッフ時間情報を取得
        const staff = await Staff.findAll({
            where: { store_id: store_id },
            attributes: ['id']
        });
        const staffIds = staff.map(s => s.id);

        let allStoreHours = null;
        if (staffIds.length > 0) {
            try {
                allStoreHours = await shiftGeneratorService.getStaffTotalHoursAllStores(
                    staffIds,
                    year,
                    month
                );
            } catch (error) {
                console.error('全店舗時間集計エラー:', error);
            }
        }

        const response = {
            id: savedShift.id,
            store_id: savedShift.store_id,
            year: savedShift.year,
            month: savedShift.month,
            status: savedShift.status,
            shifts: shiftData.shifts || [],
            summary: shiftData.summary || {},
            allStoreHours: allStoreHours
        };

        res.status(201).json(response);
    } catch (error) {
        console.error('シフト生成エラー:', error);
        res.status(500).json({
            message: 'シフト生成中にエラーが発生しました',
            error: error.message
        });
    }
};

const validateShift = async (req, res) => {
    try {
        const { year, month } = req.params;
        const { store_id } = req.query;

        if (!store_id) {
            return res.status(400).json({ message: '店舗IDが必要です' });
        }

        if (req.user.role === 'owner' || req.user.role === 'staff') {
            let ownerId = req.user.id;

            if (req.user.role === 'staff' && req.user.parent_user_id) {
                ownerId = req.user.parent_user_id;
            }

            const store = await Store.findOne({
                where: {
                    id: store_id,
                    owner_id: ownerId
                }
            });

            if (!store) {
                return res.status(403).json({ message: 'この店舗のシフトを検証する権限がありません' });
            }
        }

        const shift = await Shift.findOne({
            where: {
                store_id,
                year: parseInt(year),
                month: parseInt(month)
            },
            include: [
                {
                    model: ShiftAssignment,
                    as: 'assignments'
                }
            ]
        });

        if (!shift) {
            return res.status(404).json({ message: 'シフトが見つかりません' });
        }

        const shiftData = {
            shifts: []
        };

        const assignmentsByDate = {};
        shift.assignments.forEach(assignment => {
            const date = assignment.date;
            if (!assignmentsByDate[date]) {
                assignmentsByDate[date] = [];
            }
            assignmentsByDate[date].push(assignment);
        });

        Object.keys(assignmentsByDate).forEach(date => {
            shiftData.shifts.push({
                date: date,
                assignments: assignmentsByDate[date]
            });
        });

        const validationResult = await shiftGeneratorService.validateShift(shiftData, store_id, year, month);

        res.status(200).json(validationResult);
    } catch (error) {
        console.error('シフト検証エラー:', error);
        res.status(500).json({ message: 'シフト検証中にエラーが発生しました' });
    }
};

const confirmShift = async (req, res) => {
    try {
        const { year, month } = req.params;
        const { store_id } = req.body;

        if (!store_id) {
            return res.status(400).json({ message: '店舗IDが必要です' });
        }

        if (req.user.role === 'owner' || req.user.role === 'staff') {
            let ownerId = req.user.id;

            if (req.user.role === 'staff' && req.user.parent_user_id) {
                ownerId = req.user.parent_user_id;
            }

            const store = await Store.findOne({
                where: {
                    id: store_id,
                    owner_id: ownerId
                }
            });

            if (!store) {
                return res.status(403).json({ message: 'この店舗のシフトを確定する権限がありません' });
            }
        }

        const shift = await Shift.findOne({
            where: {
                store_id,
                year: parseInt(year),
                month: parseInt(month)
            }
        });

        if (!shift) {
            return res.status(404).json({ message: 'シフトが見つかりません' });
        }

        if (shift.status === 'confirmed') {
            return res.status(400).json({ message: 'シフトは既に確定済みです' });
        }

        await shift.update({ status: 'confirmed' });

        res.status(200).json({ message: 'シフトを確定しました', shift });
    } catch (error) {
        console.error('シフト確定エラー:', error);
        res.status(500).json({ message: 'シフト確定中にエラーが発生しました' });
    }
};

const createShiftAssignment = async (req, res) => {
    try {
        const { year, month } = req.params;
        const { store_id, staff_id, date, start_time, end_time, break_start_time, break_end_time, notes, change_reason } = req.body;

        console.log('Received assignment data:', {
            year,
            month,
            store_id,
            staff_id,
            date,
            start_time,
            end_time,
            break_start_time,
            break_end_time,
            notes,
            change_reason
        });

        if (!store_id || !staff_id || !date || !start_time || !end_time) {
            console.log('Validation failed:', {
                store_id: !!store_id,
                staff_id: !!staff_id,
                date: !!date,
                start_time: !!start_time,
                end_time: !!end_time
            });
            return res.status(400).json({
                message: '必須フィールドが不足しています',
                missing_fields: {
                    store_id: !store_id,
                    staff_id: !staff_id,
                    date: !date,
                    start_time: !start_time,
                    end_time: !end_time
                }
            });
        }

        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(start_time) || !timeRegex.test(end_time)) {
            return res.status(400).json({
                message: '時間は HH:MM 形式で入力してください'
            });
        }

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
            return res.status(400).json({
                message: '日付は YYYY-MM-DD 形式で入力してください'
            });
        }

        const shift = await Shift.findOne({
            where: {
                store_id: parseInt(store_id),
                year: parseInt(year),
                month: parseInt(month)
            }
        });

        if (!shift) {
            return res.status(404).json({ message: 'シフトが見つかりません' });
        }

        const existingAssignment = await ShiftAssignment.findOne({
            where: {
                shift_id: shift.id,
                staff_id: parseInt(staff_id),
                date: date
            }
        });

        if (existingAssignment) {
            return res.status(400).json({
                message: 'この日付に既にシフトが存在します。更新する場合は更新APIを使用してください。'
            });
        }

        const assignment = await ShiftAssignment.create({
            shift_id: shift.id,
            staff_id: parseInt(staff_id),
            date: date,
            start_time: start_time,
            end_time: end_time,
            break_start_time: break_start_time || null,
            break_end_time: break_end_time || null,
            notes: notes || null
        });

        const isPastDate = new Date(date) < new Date();
        const logData = {
            shift_assignment_id: assignment.id,
            user_id: req.user.id,
            change_type: 'create',
            new_data: {
                staff_id: parseInt(staff_id),
                date,
                start_time,
                end_time,
                break_start_time: break_start_time || null,
                break_end_time: break_end_time || null,
                notes: notes || null
            },
            change_reason: isPastDate && change_reason ? change_reason : '新規シフト作成'
        };

        await ShiftChangeLog.create(logData);

        console.log('Assignment created successfully:', assignment.id);

        res.status(201).json(assignment);
    } catch (error) {
        console.error('シフト割り当て作成エラー:', error);
        res.status(500).json({
            message: 'シフト割り当ての作成中にエラーが発生しました',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

const updateShiftAssignment = async (req, res) => {
    try {
        const { year, month, assignmentId } = req.params;
        const { store_id, staff_id, date, start_time, end_time, break_start_time, break_end_time, notes, change_reason } = req.body;

        const assignment = await ShiftAssignment.findByPk(assignmentId, {
            include: [
                {
                    model: Shift,
                    where: {
                        store_id,
                        year: parseInt(year),
                        month: parseInt(month)
                    }
                }
            ]
        });

        if (!assignment) {
            return res.status(404).json({ message: 'シフト割り当てが見つかりません' });
        }

        const previousData = {
            staff_id: assignment.staff_id,
            date: assignment.date,
            start_time: assignment.start_time,
            end_time: assignment.end_time,
            break_start_time: assignment.break_start_time,
            break_end_time: assignment.break_end_time,
            notes: assignment.notes
        };

        await assignment.update({
            staff_id,
            date,
            start_time,
            end_time,
            break_start_time,
            break_end_time,
            notes
        });

        const isPastDate = new Date(date) < new Date();
        const logData = {
            shift_assignment_id: assignment.id,
            user_id: req.user.id,
            change_type: 'update',
            previous_data: previousData,
            new_data: {
                staff_id,
                date,
                start_time,
                end_time,
                break_start_time,
                break_end_time,
                notes
            },
            change_reason: isPastDate && change_reason ? change_reason : 'シフト変更'
        };

        await ShiftChangeLog.create(logData);

        res.status(200).json(assignment);
    } catch (error) {
        console.error('シフト割り当て更新エラー:', error);
        res.status(500).json({ message: 'シフト割り当ての更新中にエラーが発生しました' });
    }
};

const deleteShiftAssignment = async (req, res) => {
    try {
        const { year, month, assignmentId } = req.params;
        const { change_reason } = req.body;

        const assignment = await ShiftAssignment.findByPk(assignmentId, {
            include: [
                {
                    model: Shift,
                    where: {
                        year: parseInt(year),
                        month: parseInt(month)
                    }
                }
            ]
        });

        if (!assignment) {
            return res.status(404).json({ message: 'シフト割り当てが見つかりません' });
        }

        const previousData = {
            staff_id: assignment.staff_id,
            date: assignment.date,
            start_time: assignment.start_time,
            end_time: assignment.end_time,
            break_start_time: assignment.break_start_time,
            break_end_time: assignment.break_end_time,
            notes: assignment.notes
        };

        const isPastDate = new Date(assignment.date) < new Date();
        const logData = {
            shift_assignment_id: assignment.id,
            user_id: req.user.id,
            change_type: 'delete',
            previous_data: previousData,
            change_reason: isPastDate && change_reason ? change_reason : 'シフト削除'
        };

        await ShiftChangeLog.create(logData);

        await assignment.destroy();

        res.status(200).json({ message: 'シフト割り当てを削除しました' });
    } catch (error) {
        console.error('シフト割り当て削除エラー:', error);
        res.status(500).json({ message: 'シフト割り当ての削除中にエラーが発生しました' });
    }
};

const getShiftChangeLogs = async (req, res) => {
    try {
        const { year, month } = req.params;
        const { store_id } = req.query;

        if (!store_id) {
            return res.status(400).json({ message: '店舗IDが必要です' });
        }

        const shift = await Shift.findOne({
            where: {
                store_id,
                year: parseInt(year),
                month: parseInt(month)
            }
        });

        if (!shift) {
            return res.status(404).json({ message: 'シフトが見つかりません' });
        }

        const changeLogs = await ShiftChangeLog.findAll({
            include: [
                {
                    model: ShiftAssignment,
                    where: {
                        shift_id: shift.id
                    },
                    required: false
                }
            ],
            order: [['created_at', 'DESC']]
        });

        res.status(200).json(changeLogs);
    } catch (error) {
        console.error('シフト変更ログ取得エラー:', error);
        res.status(500).json({ message: 'シフト変更ログの取得中にエラーが発生しました' });
    }
};

module.exports = {
    getAllShifts,
    getShiftById,
    getShiftByYearMonth,
    getStaffTotalHoursAllStores,
    getSystemSettings,
    createShift,
    generateShift,
    validateShift,
    confirmShift,
    createShiftAssignment,
    updateShiftAssignment,
    deleteShiftAssignment,
    getShiftChangeLogs
};