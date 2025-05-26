const {
    Shift,
    ShiftAssignment,
    ShiftChangeLog,
    Staff,
    Store,
    SystemSetting,
    sequelize
} = require('../models');
const { Op } = require('sequelize');
const moment = require('moment-timezone');
const shiftGeneratorService = require('../services/shiftGenerator');
const { getShiftPeriodByClosingDay } = require('../services/dateUtils');

const getAllShifts = async (req, res) => {
    try {
        const { store_id, year, month, status } = req.query;

        const where = {};

        if (store_id) {
            where.store_id = store_id;
        }

        if (year) {
            where.year = year;
        }

        if (month) {
            where.month = month;
        }

        if (status) {
            where.status = status;
        }

        const shifts = await Shift.findAll({
            where,
            include: [
                { model: Store, attributes: ['id', 'name'] }
            ],
            order: [
                ['year', 'DESC'],
                ['month', 'DESC']
            ]
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

        const shift = await Shift.findByPk(id, {
            include: [
                { model: Store, attributes: ['id', 'name'] }
            ]
        });

        if (!shift) {
            return res.status(404).json({ message: 'シフトが見つかりません' });
        }

        res.status(200).json(shift);
    } catch (error) {
        console.error('シフト取得エラー:', error);
        res.status(500).json({ message: 'シフト情報の取得中にエラーが発生しました' });
    }
};

const getShiftByYearMonth = async (req, res) => {
    try {
        const { year, month } = req.params;
        const { store_id } = req.query;

        if (!store_id) {
            return res.status(400).json({ message: '店舗IDを指定してください' });
        }

        const shift = await Shift.findOne({
            where: {
                store_id,
                year,
                month
            }
        });

        if (!shift) {
            return res.status(404).json({ message: 'シフトが見つかりません' });
        }

        let userId = req.user.id;
        if (req.user.role === 'staff' && req.user.parent_user_id) {
            userId = req.user.parent_user_id;
        }

        const systemSetting = await SystemSetting.findOne({
            where: { user_id: userId }
        });

        const closingDay = systemSetting ? systemSetting.closing_day : 25;
        const shiftPeriod = getShiftPeriodByClosingDay(parseInt(year), parseInt(month), closingDay);

        const assignments = await ShiftAssignment.findAll({
            where: {
                shift_id: shift.id,
                date: {
                    [Op.between]: [shiftPeriod.startDate, shiftPeriod.endDate]
                }
            },
            include: [
                {
                    model: Staff,
                    attributes: ['id', 'first_name', 'last_name', 'position']
                }
            ],
            order: [
                ['date', 'ASC'],
                ['start_time', 'ASC']
            ]
        });

        const shiftsByDate = {};
        for (const assignment of assignments) {
            const date = moment(assignment.date).format('YYYY-MM-DD');

            if (!shiftsByDate[date]) {
                shiftsByDate[date] = {
                    date,
                    assignments: []
                };
            }

            shiftsByDate[date].assignments.push({
                id: assignment.id,
                staff_id: assignment.staff_id,
                staff_name: `${assignment.Staff.last_name} ${assignment.Staff.first_name}`,
                position: assignment.Staff.position,
                start_time: moment(assignment.start_time, 'HH:mm:ss').format('HH:mm'),
                end_time: moment(assignment.end_time, 'HH:mm:ss').format('HH:mm'),
                break_start_time: assignment.break_start_time ? moment(assignment.break_start_time, 'HH:mm:ss').format('HH:mm') : null,
                break_end_time: assignment.break_end_time ? moment(assignment.break_end_time, 'HH:mm:ss').format('HH:mm') : null,
                notes: assignment.notes
            });
        }

        const staffTotalHours = {};
        for (const assignment of assignments) {
            const staffId = assignment.staff_id;
            const staffName = `${assignment.Staff.last_name} ${assignment.Staff.first_name}`;

            if (!staffTotalHours[staffId]) {
                staffTotalHours[staffId] = {
                    staff_id: staffId,
                    staff_name: staffName,
                    total_hours: 0
                };
            }

            const startTime = moment(assignment.start_time, 'HH:mm:ss');
            const endTime = moment(assignment.end_time, 'HH:mm:ss');
            let duration = moment.duration(endTime.diff(startTime)).asHours();

            if (assignment.break_start_time && assignment.break_end_time) {
                const breakStart = moment(assignment.break_start_time, 'HH:mm:ss');
                const breakEnd = moment(assignment.break_end_time, 'HH:mm:ss');
                const breakDuration = moment.duration(breakEnd.diff(breakStart)).asHours();
                duration -= breakDuration;
            }

            staffTotalHours[staffId].total_hours += duration;
        }

        const result = {
            id: shift.id,
            store_id: shift.store_id,
            year: parseInt(year),
            month: parseInt(month),
            status: shift.status,
            closing_day: closingDay,
            period_start: shiftPeriod.startDate,
            period_end: shiftPeriod.endDate,
            shifts: Object.values(shiftsByDate),
            summary: {
                totalHoursByStaff: Object.values(staffTotalHours).map(item => ({
                    ...item,
                    total_hours: parseFloat(item.total_hours.toFixed(2))
                }))
            }
        };

        res.status(200).json(result);
    } catch (error) {
        console.error('シフト取得エラー:', error);
        res.status(500).json({ message: 'シフト情報の取得中にエラーが発生しました' });
    }
};

const generateShift = async (req, res) => {
    try {
        const { store_id, year, month } = req.body;

        if (!store_id || !year || !month) {
            return res.status(400).json({ message: '店舗ID、年、月は必須です' });
        }

        let userId = req.user.id;
        if (req.user.role === 'staff' && req.user.parent_user_id) {
            userId = req.user.parent_user_id;
        }

        const systemSetting = await SystemSetting.findOne({
            where: { user_id: userId }
        });

        const closingDay = systemSetting ? systemSetting.closing_day : 25;

        const shiftData = await shiftGeneratorService.generateShift(store_id, year, month, closingDay);

        const validation = await shiftGeneratorService.validateShift(shiftData, store_id, year, month);

        shiftData.summary.staffingWarnings = validation.warnings;

        const shift = await shiftGeneratorService.saveShift(shiftData, store_id, year, month);

        shiftData.id = shift.id;
        shiftData.store_id = store_id;
        shiftData.year = parseInt(year);
        shiftData.month = parseInt(month);
        shiftData.status = shift.status;
        shiftData.closing_day = closingDay;

        res.status(200).json(shiftData);
    } catch (error) {
        console.error('シフト生成エラー:', error);
        res.status(500).json({ message: 'シフトの生成中にエラーが発生しました: ' + error.message });
    }
};

const validateShift = async (req, res) => {
    try {
        const { year, month } = req.params;
        const { store_id } = req.query;

        if (!store_id) {
            return res.status(400).json({ message: '店舗IDを指定してください' });
        }

        const shift = await Shift.findOne({
            where: {
                store_id,
                year,
                month
            }
        });

        if (!shift) {
            return res.status(404).json({ message: 'シフトが見つかりません' });
        }

        let userId = req.user.id;
        if (req.user.role === 'staff' && req.user.parent_user_id) {
            userId = req.user.parent_user_id;
        }

        const systemSetting = await SystemSetting.findOne({
            where: { user_id: userId }
        });

        const closingDay = systemSetting ? systemSetting.closing_day : 25;
        const shiftPeriod = getShiftPeriodByClosingDay(parseInt(year), parseInt(month), closingDay);

        const assignments = await ShiftAssignment.findAll({
            where: {
                shift_id: shift.id,
                date: {
                    [Op.between]: [shiftPeriod.startDate, shiftPeriod.endDate]
                }
            },
            include: [
                {
                    model: Staff,
                    attributes: ['id', 'first_name', 'last_name']
                }
            ],
            order: [
                ['date', 'ASC'],
                ['start_time', 'ASC']
            ]
        });

        const shiftsByDate = {};
        for (const assignment of assignments) {
            const date = moment(assignment.date).format('YYYY-MM-DD');

            if (!shiftsByDate[date]) {
                shiftsByDate[date] = {
                    date,
                    assignments: []
                };
            }

            shiftsByDate[date].assignments.push({
                staff_id: assignment.staff_id,
                staff_name: `${assignment.Staff.last_name} ${assignment.Staff.first_name}`,
                start_time: moment(assignment.start_time, 'HH:mm:ss').format('HH:mm'),
                end_time: moment(assignment.end_time, 'HH:mm:ss').format('HH:mm'),
                break_start_time: assignment.break_start_time ? moment(assignment.break_start_time, 'HH:mm:ss').format('HH:mm') : null,
                break_end_time: assignment.break_end_time ? moment(assignment.break_end_time, 'HH:mm:ss').format('HH:mm') : null
            });
        }

        const shiftData = {
            shifts: Object.values(shiftsByDate)
        };

        const validation = await shiftGeneratorService.validateShift(shiftData, store_id, year, month);

        res.status(200).json(validation);
    } catch (error) {
        console.error('シフト検証エラー:', error);
        res.status(500).json({ message: 'シフトの検証中にエラーが発生しました' });
    }
};

const confirmShift = async (req, res) => {
    try {
        const { year, month } = req.params;
        const { store_id } = req.body;

        if (!store_id) {
            return res.status(400).json({ message: '店舗IDを指定してください' });
        }

        const shift = await Shift.findOne({
            where: {
                store_id,
                year,
                month
            }
        });

        if (!shift) {
            return res.status(404).json({ message: 'シフトが見つかりません' });
        }

        const shiftData = await getShiftByYearMonth(year, month, store_id);
        const validation = await shiftGeneratorService.validateShift(shiftData, store_id, year, month);

        if (validation.warnings.length > 0) {
            return res.status(400).json({
                message: 'シフトに人員不足の警告があるため確定できません',
                warnings: validation.warnings
            });
        }

        await shiftGeneratorService.confirmShift(shift.id);

        res.status(200).json({ message: 'シフトを確定しました' });
    } catch (error) {
        console.error('シフト確定エラー:', error);
        res.status(500).json({ message: 'シフトの確定中にエラーが発生しました' });
    }
};

const createShiftAssignment = async (req, res) => {
    try {
        const { year, month } = req.params;
        const { store_id, date, staff_id, start_time, end_time, break_start_time, break_end_time, notes } = req.body;

        if (!store_id || !date || !staff_id || !start_time || !end_time) {
            return res.status(400).json({ message: '店舗ID、日付、スタッフID、開始時間、終了時間は必須です' });
        }

        const shift = await Shift.findOne({
            where: {
                store_id,
                year,
                month
            }
        });

        if (!shift) {
            return res.status(404).json({ message: 'シフトが見つかりません' });
        }

        if (shift.status === 'confirmed') {
            return res.status(400).json({ message: '確定済みのシフトは編集できません' });
        }

        const staff = await Staff.findByPk(staff_id);
        if (!staff) {
            return res.status(404).json({ message: '指定されたスタッフが存在しません' });
        }

        const assignment = await ShiftAssignment.create({
            shift_id: shift.id,
            staff_id,
            date,
            start_time,
            end_time,
            break_start_time,
            break_end_time,
            notes
        });

        await ShiftChangeLog.create({
            shift_assignment_id: assignment.id,
            user_id: req.user.id,
            change_type: 'create',
            new_data: {
                staff_id,
                date,
                start_time,
                end_time,
                break_start_time,
                break_end_time,
                notes
            }
        });

        const createdAssignment = await ShiftAssignment.findByPk(assignment.id, {
            include: [
                { model: Staff, attributes: ['id', 'first_name', 'last_name', 'position'] }
            ]
        });

        const result = {
            id: createdAssignment.id,
            staff_id: createdAssignment.staff_id,
            staff_name: `${createdAssignment.Staff.last_name} ${createdAssignment.Staff.first_name}`,
            position: createdAssignment.Staff.position,
            date: moment(createdAssignment.date).format('YYYY-MM-DD'),
            start_time: moment(createdAssignment.start_time, 'HH:mm:ss').format('HH:mm'),
            end_time: moment(createdAssignment.end_time, 'HH:mm:ss').format('HH:mm'),
            break_start_time: createdAssignment.break_start_time ? moment(createdAssignment.break_start_time, 'HH:mm:ss').format('HH:mm') : null,
            break_end_time: createdAssignment.break_end_time ? moment(createdAssignment.break_end_time, 'HH:mm:ss').format('HH:mm') : null,
            notes: createdAssignment.notes
        };

        res.status(201).json(result);
    } catch (error) {
        console.error('シフト割り当て作成エラー:', error);
        res.status(500).json({ message: 'シフト割り当ての作成中にエラーが発生しました' });
    }
};

const updateShiftAssignment = async (req, res) => {
    try {
        const { year, month, assignmentId } = req.params;
        const { staff_id, start_time, end_time, break_start_time, break_end_time, notes } = req.body;

        const assignment = await ShiftAssignment.findByPk(assignmentId, {
            include: [
                { model: Shift }
            ]
        });

        if (!assignment) {
            return res.status(404).json({ message: 'シフト割り当てが見つかりません' });
        }

        if (assignment.Shift.year != year || assignment.Shift.month != month) {
            return res.status(400).json({ message: '指定されたシフト割り当ては、このシフトに属していません' });
        }

        if (assignment.Shift.status === 'confirmed') {
            return res.status(400).json({ message: '確定済みのシフトは編集できません' });
        }

        if (staff_id) {
            const staff = await Staff.findByPk(staff_id);
            if (!staff) {
                return res.status(404).json({ message: '指定されたスタッフが存在しません' });
            }
        }

        const previousData = {
            staff_id: assignment.staff_id,
            start_time: moment(assignment.start_time, 'HH:mm:ss').format('HH:mm'),
            end_time: moment(assignment.end_time, 'HH:mm:ss').format('HH:mm'),
            break_start_time: assignment.break_start_time ? moment(assignment.break_start_time, 'HH:mm:ss').format('HH:mm') : null,
            break_end_time: assignment.break_end_time ? moment(assignment.break_end_time, 'HH:mm:ss').format('HH:mm') : null,
            notes: assignment.notes
        };

        await assignment.update({
            staff_id: staff_id || assignment.staff_id,
            start_time: start_time || assignment.start_time,
            end_time: end_time || assignment.end_time,
            break_start_time: break_start_time !== undefined ? break_start_time : assignment.break_start_time,
            break_end_time: break_end_time !== undefined ? break_end_time : assignment.break_end_time,
            notes: notes !== undefined ? notes : assignment.notes
        });

        await ShiftChangeLog.create({
            shift_assignment_id: assignment.id,
            user_id: req.user.id,
            change_type: 'update',
            previous_data: previousData,
            new_data: {
                staff_id: assignment.staff_id,
                start_time: moment(assignment.start_time, 'HH:mm:ss').format('HH:mm'),
                end_time: moment(assignment.end_time, 'HH:mm:ss').format('HH:mm'),
                break_start_time: assignment.break_start_time ? moment(assignment.break_start_time, 'HH:mm:ss').format('HH:mm') : null,
                break_end_time: assignment.break_end_time ? moment(assignment.break_end_time, 'HH:mm:ss').format('HH:mm') : null,
                notes: assignment.notes
            }
        });

        const updatedAssignment = await ShiftAssignment.findByPk(assignment.id, {
            include: [
                { model: Staff, attributes: ['id', 'first_name', 'last_name', 'position'] }
            ]
        });

        const result = {
            id: updatedAssignment.id,
            staff_id: updatedAssignment.staff_id,
            staff_name: `${updatedAssignment.Staff.last_name} ${updatedAssignment.Staff.first_name}`,
            position: updatedAssignment.Staff.position,
            date: moment(updatedAssignment.date).format('YYYY-MM-DD'),
            start_time: moment(updatedAssignment.start_time, 'HH:mm:ss').format('HH:mm'),
            end_time: moment(updatedAssignment.end_time, 'HH:mm:ss').format('HH:mm'),
            break_start_time: updatedAssignment.break_start_time ? moment(updatedAssignment.break_start_time, 'HH:mm:ss').format('HH:mm') : null,
            break_end_time: updatedAssignment.break_end_time ? moment(updatedAssignment.break_end_time, 'HH:mm:ss').format('HH:mm') : null,
            notes: updatedAssignment.notes
        };

        res.status(200).json(result);
    } catch (error) {
        console.error('シフト割り当て更新エラー:', error);
        res.status(500).json({ message: 'シフト割り当ての更新中にエラーが発生しました' });
    }
};

const deleteShiftAssignment = async (req, res) => {
    try {
        const { year, month, assignmentId } = req.params;

        const assignment = await ShiftAssignment.findByPk(assignmentId, {
            include: [
                { model: Shift },
                { model: Staff, attributes: ['id', 'first_name', 'last_name'] }
            ]
        });

        if (!assignment) {
            return res.status(404).json({ message: 'シフト割り当てが見つかりません' });
        }

        if (assignment.Shift.year != year || assignment.Shift.month != month) {
            return res.status(400).json({ message: '指定されたシフト割り当ては、このシフトに属していません' });
        }

        if (assignment.Shift.status === 'confirmed') {
            return res.status(400).json({ message: '確定済みのシフトは編集できません' });
        }

        const previousData = {
            staff_id: assignment.staff_id,
            staff_name: `${assignment.Staff.last_name} ${assignment.Staff.first_name}`,
            date: moment(assignment.date).format('YYYY-MM-DD'),
            start_time: moment(assignment.start_time, 'HH:mm:ss').format('HH:mm'),
            end_time: moment(assignment.end_time, 'HH:mm:ss').format('HH:mm'),
            break_start_time: assignment.break_start_time ? moment(assignment.break_start_time, 'HH:mm:ss').format('HH:mm') : null,
            break_end_time: assignment.break_end_time ? moment(assignment.break_end_time, 'HH:mm:ss').format('HH:mm') : null,
            notes: assignment.notes
        };

        await assignment.destroy();

        await ShiftChangeLog.create({
            shift_assignment_id: null,
            user_id: req.user.id,
            change_type: 'delete',
            previous_data: previousData,
            new_data: null
        });

        res.status(200).json({ message: 'シフト割り当てが削除されました' });
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
            return res.status(400).json({ message: '店舗IDを指定してください' });
        }

        const shift = await Shift.findOne({
            where: {
                store_id,
                year,
                month
            }
        });

        if (!shift) {
            return res.status(404).json({ message: 'シフトが見つかりません' });
        }

        const assignments = await ShiftAssignment.findAll({
            where: { shift_id: shift.id },
            attributes: ['id']
        });

        const changeLogs = await ShiftChangeLog.findAll({
            where: {
                [Op.or]: [
                    { shift_assignment_id: assignments.map(a => a.id) },
                    {
                        shift_assignment_id: null,
                        created_at: {
                            [Op.between]: [
                                moment(`${year}-${month}-01`).startOf('month').toDate(),
                                moment(`${year}-${month}-01`).endOf('month').toDate()
                            ]
                        }
                    }
                ]
            },
            include: [
                {
                    model: User,
                    attributes: ['id', 'username']
                }
            ],
            order: [['created_at', 'DESC']]
        });

        const result = changeLogs.map(log => ({
            id: log.id,
            user: log.User ? log.User.username : null,
            change_type: log.change_type,
            previous_data: log.previous_data,
            new_data: log.new_data,
            change_reason: log.change_reason,
            created_at: moment(log.created_at).format('YYYY-MM-DD HH:mm:ss')
        }));

        res.status(200).json(result);
    } catch (error) {
        console.error('シフト変更履歴取得エラー:', error);
        res.status(500).json({ message: 'シフト変更履歴の取得中にエラーが発生しました' });
    }
};

module.exports = {
    getAllShifts,
    getShiftById,
    getShiftByYearMonth,
    generateShift,
    validateShift,
    confirmShift,
    createShiftAssignment,
    updateShiftAssignment,
    deleteShiftAssignment,
    getShiftChangeLogs
};