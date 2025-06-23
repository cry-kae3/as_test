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

const getStaffTotalHoursAllStores = async (req, res) => {
    try {
        const { year, month, store_id } = req.query;

        if (!year || !month || !store_id) {
            return res.status(400).json({ message: '年、月、店舗IDが必要です' });
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
                return res.status(403).json({ message: 'この店舗にアクセスする権限がありません' });
            }
        }

        const staff = await Staff.findAll({
            where: { store_id: parseInt(store_id) },
            attributes: ['id']
        });

        const staffIds = staff.map(s => s.id);

        if (staffIds.length === 0) {
            return res.status(200).json({});
        }

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

const deleteShift = async (req, res) => {
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
                return res.status(403).json({ message: 'この店舗のシフトを削除する権限がありません' });
            }
        }

        const shift = await Shift.findOne({
            where: {
                store_id: parseInt(store_id),
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

        const { sequelize } = require('../config/db');

        await sequelize.transaction(async (t) => {
            await ShiftAssignment.destroy({
                where: { shift_id: shift.id },
                transaction: t
            });

            await shift.destroy({ transaction: t });
        });

        res.status(200).json({ message: 'シフトを削除しました' });
    } catch (error) {
        console.error('シフト削除エラー:', error);
        res.status(500).json({ message: 'シフトの削除中にエラーが発生しました' });
    }
};

const generateShift = async (req, res) => {
    try {
        const { storeId, year, month } = req.body;

        console.log('=== シフト生成リクエスト受信 ===');
        console.log('パラメータ:', { store_id: storeId, year, month });
        console.log('リクエストユーザー:', { id: req.user.id, role: req.user.role });

        if (!storeId || !year || !month) {
            return res.status(400).json({ message: '店舗ID、年、月は必須です' });
        }

        if (req.user.role === 'owner' || req.user.role === 'staff') {
            let ownerId = req.user.role === 'staff' ? req.user.parent_user_id : req.user.id;
            const store = await Store.findOne({ where: { id: storeId, owner_id: ownerId } });
            if (!store) {
                return res.status(403).json({ message: 'この店舗にシフトを生成する権限がありません' });
            }
        }

        console.log('権限チェック完了、AI シフト生成開始');
        const savedShiftData = await shiftGeneratorService.generateShift(storeId, year, month);
        console.log('AI シフト生成・保存完了');

        res.status(201).json(savedShiftData);

    } catch (error) {
        console.error('=== シフト生成API失敗 ===');
        console.error('エラー詳細:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
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

const validateStaffWorkingConditions = async (staffId, date, startTime, endTime, breakStartTime, breakEndTime, excludeAssignmentId = null) => {
    const warnings = [];
    const errors = [];

    const staff = await Staff.findByPk(staffId, {
        include: [
            {
                model: require('../models').StaffDayPreference,
                as: 'dayPreferences'
            },
            {
                model: require('../models').StaffDayOffRequest,
                as: 'dayOffRequests',
                where: {
                    date: date,
                    status: ['approved', 'pending']
                },
                required: false
            }
        ]
    });

    if (!staff) {
        errors.push('スタッフが見つかりません');
        return { errors, warnings };
    }

    if (staff.dayOffRequests && staff.dayOffRequests.length > 0) {
        const dayOffRequest = staff.dayOffRequests[0];
        if (dayOffRequest.status === 'approved') {
            errors.push(`${date}は承認済みの休み希望があります（${dayOffRequest.reason || 'お休み'}）`);
        } else {
            warnings.push(`${date}は休み希望があります（${dayOffRequest.reason || 'お休み'}）`);
        }
    }

    const dayOfWeek = new Date(date).getDay();
    const dayPreference = staff.dayPreferences?.find(pref => pref.day_of_week === dayOfWeek);

    if (dayPreference && !dayPreference.available) {
        errors.push(`${['日', '月', '火', '水', '木', '金', '土'][dayOfWeek]}曜日は勤務不可の設定です`);
    }

    if (dayPreference && dayPreference.preferred_start_time && dayPreference.preferred_end_time) {
        if (startTime < dayPreference.preferred_start_time || endTime > dayPreference.preferred_end_time) {
            warnings.push(`希望時間（${dayPreference.preferred_start_time}-${dayPreference.preferred_end_time}）から外れています`);
        }
    }

    const workMinutes = calculateWorkMinutes(startTime, endTime, breakStartTime, breakEndTime);
    const workHours = workMinutes / 60;

    if (staff.max_hours_per_day && workHours > staff.max_hours_per_day) {
        errors.push(`1日の最大勤務時間（${staff.max_hours_per_day}時間）を超過しています（${workHours.toFixed(1)}時間）`);
    }

    const monthlyHours = await calculateMonthlyHours(staffId, date, workMinutes, excludeAssignmentId);

    if (staff.max_hours_per_month && monthlyHours > staff.max_hours_per_month) {
        errors.push(`月間最大勤務時間（${staff.max_hours_per_month}時間）を超過します（${monthlyHours.toFixed(1)}時間）`);
    }

    if (staff.min_hours_per_month && monthlyHours < staff.min_hours_per_month) {
        warnings.push(`月間最小勤務時間（${staff.min_hours_per_month}時間）を下回ります（${monthlyHours.toFixed(1)}時間）`);
    }

    const consecutiveDays = await calculateConsecutiveWorkDays(staffId, date, excludeAssignmentId);

    if (staff.max_consecutive_days && consecutiveDays > staff.max_consecutive_days) {
        errors.push(`最大連続勤務日数（${staff.max_consecutive_days}日）を超過します（${consecutiveDays}日）`);
    }

    if (workHours > 8 && (!breakStartTime || !breakEndTime)) {
        errors.push('8時間超の勤務には最低60分の休憩が必要です');
    } else if (workHours > 6 && (!breakStartTime || !breakEndTime)) {
        errors.push('6時間超の勤務には最低45分の休憩が必要です');
    } else if (breakStartTime && breakEndTime) {
        const breakMinutes = calculateBreakMinutes(breakStartTime, breakEndTime);
        if (workHours > 8 && breakMinutes < 60) {
            errors.push('8時間超の勤務には最低60分の休憩が必要です');
        } else if (workHours > 6 && breakMinutes < 45) {
            errors.push('6時間超の勤務には最低45分の休憩が必要です');
        }
    }

    return { errors, warnings };
};

const calculateWorkMinutes = (startTime, endTime, breakStartTime, breakEndTime) => {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    let minutes = (end - start) / (1000 * 60);

    if (breakStartTime && breakEndTime) {
        const breakStart = new Date(`2000-01-01T${breakStartTime}`);
        const breakEnd = new Date(`2000-01-01T${breakEndTime}`);
        const breakMinutes = (breakEnd - breakStart) / (1000 * 60);
        minutes -= breakMinutes;
    }

    return Math.max(0, minutes);
};

const calculateBreakMinutes = (breakStartTime, breakEndTime) => {
    const breakStart = new Date(`2000-01-01T${breakStartTime}`);
    const breakEnd = new Date(`2000-01-01T${breakEndTime}`);
    return Math.max(0, (breakEnd - breakStart) / (1000 * 60));
};

const calculateMonthlyHours = async (staffId, targetDate, additionalMinutes, excludeAssignmentId = null) => {
    const date = new Date(targetDate);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    const shifts = await Shift.findAll({
        where: {
            year: year,
            month: month
        },
        include: [{
            model: ShiftAssignment,
            as: 'assignments',
            where: {
                staff_id: staffId,
                ...(excludeAssignmentId && { id: { [Op.ne]: excludeAssignmentId } })
            },
            required: false
        }]
    });

    let totalMinutes = additionalMinutes || 0;

    shifts.forEach(shift => {
        shift.assignments.forEach(assignment => {
            totalMinutes += calculateWorkMinutes(
                assignment.start_time,
                assignment.end_time,
                assignment.break_start_time,
                assignment.break_end_time
            );
        });
    });

    return totalMinutes / 60;
};

const calculateConsecutiveWorkDays = async (staffId, targetDate, excludeAssignmentId = null) => {
    const targetDateObj = new Date(targetDate);
    let consecutiveDays = 1;

    let checkDate = new Date(targetDateObj);
    checkDate.setDate(checkDate.getDate() - 1);

    while (true) {
        const dateStr = checkDate.toISOString().split('T')[0];
        const hasShift = await ShiftAssignment.findOne({
            include: [{
                model: Shift,
                where: {
                    year: checkDate.getFullYear(),
                    month: checkDate.getMonth() + 1
                }
            }],
            where: {
                staff_id: staffId,
                date: dateStr,
                ...(excludeAssignmentId && { id: { [Op.ne]: excludeAssignmentId } })
            }
        });

        if (hasShift) {
            consecutiveDays++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }

    checkDate = new Date(targetDateObj);
    checkDate.setDate(checkDate.getDate() + 1);

    while (true) {
        const dateStr = checkDate.toISOString().split('T')[0];
        const hasShift = await ShiftAssignment.findOne({
            include: [{
                model: Shift,
                where: {
                    year: checkDate.getFullYear(),
                    month: checkDate.getMonth() + 1
                }
            }],
            where: {
                staff_id: staffId,
                date: dateStr,
                ...(excludeAssignmentId && { id: { [Op.ne]: excludeAssignmentId } })
            }
        });

        if (hasShift) {
            consecutiveDays++;
            checkDate.setDate(checkDate.getDate() + 1);
        } else {
            break;
        }
    }

    return consecutiveDays;
};

const createShiftAssignment = async (req, res) => {
    try {
        const { year, month } = req.params;
        const { store_id, staff_id, date, start_time, end_time, break_start_time, break_end_time, notes, change_reason, force = false } = req.body;

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
            change_reason,
            force
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
                message: '日付はYYYY-MM-DD 形式で入力してください'
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

        const validation = await validateStaffWorkingConditions(
            parseInt(staff_id),
            date,
            start_time,
            end_time,
            break_start_time,
            break_end_time
        );

        if (!force && validation.errors.length > 0) {
            return res.status(400).json({
                message: '勤務条件に違反しています',
                errors: validation.errors,
                warnings: validation.warnings,
                canForce: true
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

        const response = {
            ...assignment.toJSON(),
            validation: {
                errors: validation.errors,
                warnings: validation.warnings,
                forced: force && validation.errors.length > 0
            }
        };

        res.status(201).json(response);
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
        const { store_id, staff_id, date, start_time, end_time, break_start_time, break_end_time, notes, change_reason, force = false } = req.body;

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

        const validation = await validateStaffWorkingConditions(
            parseInt(staff_id),
            date,
            start_time,
            end_time,
            break_start_time,
            break_end_time,
            assignmentId
        );

        if (!force && validation.errors.length > 0) {
            return res.status(400).json({
                message: '勤務条件に違反しています',
                errors: validation.errors,
                warnings: validation.warnings,
                canForce: true
            });
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

        const response = {
            ...assignment.toJSON(),
            validation: {
                errors: validation.errors,
                warnings: validation.warnings,
                forced: force && validation.errors.length > 0
            }
        };

        res.status(200).json(response);
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
    deleteShift,
    generateShift,
    validateShift,
    confirmShift,
    createShiftAssignment,
    updateShiftAssignment,
    deleteShiftAssignment,
    getShiftChangeLogs
};