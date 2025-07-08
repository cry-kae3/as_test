const axios = require('axios');
const fs = require('fs');
const path = require('path');
const {
    Store, Staff, StaffDayPreference, StaffDayOffRequest,
    StoreClosedDay, StoreStaffRequirement, Shift, ShiftAssignment, SystemSetting, sequelize
} = require('../models');
const { Op } = require('sequelize');
const moment = require('moment-timezone');

class ShiftGeneratorService {
    constructor() {
        this.claudeApiKey = process.env.CLAUDE_API_KEY;
        this.claudeApiUrl = 'https://api.anthropic.com/v1/messages';

        this.logDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }

        this.currentSessionLog = null;
        this.sessionId = null;

        console.log('=== ShiftGeneratorService 初期化 ===');
        if (!this.claudeApiKey) {
            console.error('❌ CLAUDE_API_KEY環境変数が設定されていません');
        } else {
            console.log('✅ Claude API設定完了');
        }
    }

    initializeSession(storeId, year, month) {
        const now = moment().tz('Asia/Tokyo');
        const dateTimeString = now.format('YYYY年MM月DD日_HH時mm分ss秒');

        this.sessionId = `shift-generation_store${storeId}_${year}年${month}月_${dateTimeString}`;
        this.currentSessionLog = {
            sessionId: this.sessionId,
            storeId,
            year,
            month,
            startTime: now.format('YYYY-MM-DD HH:mm:ss'),
            endTime: null,
            status: 'RUNNING',
            processes: [],
            errors: [],
            result: null
        };

        this.logProcess('SESSION_START', `シフト生成開始 - 店舗${storeId} ${year}年${month}月`);
    }

    logProcess(phase, message, data = null) {
        const logEntry = {
            timestamp: moment().tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss'),
            phase,
            message,
            data
        };

        if (data && (data.prompt || data.response || data.parsedData)) {
            const dataInfo = {};
            if (data.promptLength) dataInfo.promptLength = data.promptLength;
            if (data.responseLength) dataInfo.responseLength = data.responseLength;
            if (data.parsedShifts) dataInfo.parsedShifts = data.parsedShifts;
            if (data.violationCount !== undefined) dataInfo.violationCount = data.violationCount;
            if (data.staffCount) dataInfo.staffCount = data.staffCount;
            console.log(`[${phase}] ${message}`, dataInfo);
        } else {
            console.log(`[${phase}] ${message}`, data || '');
        }

        if (this.currentSessionLog) {
            this.currentSessionLog.processes.push(logEntry);
        }
    }

    logError(phase, error, data = null) {
        const errorEntry = {
            timestamp: moment().tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss'),
            phase,
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            data
        };

        console.error(`[ERROR:${phase}] ${error.message}`, data ? data : '');

        if (this.currentSessionLog) {
            this.currentSessionLog.errors.push(errorEntry);
        }
    }

    finalizeSession(status, result = null, error = null) {
        if (this.currentSessionLog) {
            const now = moment().tz('Asia/Tokyo');
            this.currentSessionLog.endTime = now.format('YYYY-MM-DD HH:mm:ss');
            this.currentSessionLog.status = status;
            this.currentSessionLog.result = result;

            if (error) {
                this.logError('SESSION_END', error);
            }

            const logFileName = `${this.sessionId}.log`;
            const logFilePath = path.join(this.logDir, logFileName);

            try {
                fs.writeFileSync(logFilePath, JSON.stringify(this.currentSessionLog, null, 2), 'utf8');
                console.log(`📄 ログファイル出力: ${logFileName}`);
            } catch (writeError) {
                console.error('ログ書き込みエラー:', writeError);
            }

            this.currentSessionLog = null;
            this.sessionId = null;
        }
    }

    getShiftPeriod(year, month, closingDay) {
        this.logProcess('PERIOD_CALCULATION', `期間計算: ${year}年${month}月（締め日: ${closingDay}日）`);

        const targetMonth = moment.tz(`${year}-${String(month).padStart(2, '0')}-01`, "Asia/Tokyo");
        const endDate = targetMonth.date(closingDay).startOf('day');
        const startDate = endDate.clone().subtract(1, 'month').add(1, 'day').startOf('day');

        const period = { startDate, endDate };

        this.logProcess('PERIOD_RESULT', `期間: ${startDate.format('YYYY-MM-DD')} ～ ${endDate.format('YYYY-MM-DD')}`);
        return period;
    }

    calculateWorkMinutes(startTime, endTime) {
        if (!startTime || !endTime) return 0;
        const start = moment(startTime, 'HH:mm');
        const end = moment(endTime, 'HH:mm');
        if (end.isBefore(start)) end.add(1, 'day');
        return end.diff(start, 'minutes');
    }

    // 🔥 新機能: 日本の労働法に基づく休憩時間を計算
    calculateRequiredBreakTime(workHours) {
        if (workHours >= 8) {
            return { start: "12:00", end: "13:00", minutes: 60 }; // 8時間以上：1時間休憩
        } else if (workHours >= 6) {
            return { start: "12:00", end: "12:45", minutes: 45 }; // 6時間以上：45分休憩
        }
        return null; // 6時間未満：休憩不要
    }

    // 🔥 新機能: 勤務時間に応じた終了時間を計算（休憩込み）
    calculateEndTimeWithBreak(startTime, workHours) {
        const start = moment(startTime, 'HH:mm');
        const breakTime = this.calculateRequiredBreakTime(workHours);
        
        if (breakTime) {
            // 休憩時間を含めて終了時間を計算
            const end = start.clone().add(workHours, 'hours').add(breakTime.minutes, 'minutes');
            return {
                endTime: end.format('HH:mm'),
                breakStart: breakTime.start,
                breakEnd: breakTime.end
            };
        } else {
            // 休憩なし
            const end = start.clone().add(workHours, 'hours');
            return {
                endTime: end.format('HH:mm'),
                breakStart: null,
                breakEnd: null
            };
        }
    }

    // 🔥 新機能: スタッフの希望時間を取得
    getStaffPreferredTime(staff, dayOfWeek) {
        const dayPreference = staff.dayPreferences?.find(p => p.day_of_week === dayOfWeek);
        if (dayPreference && dayPreference.preferred_start_time && dayPreference.preferred_end_time) {
            return {
                startTime: dayPreference.preferred_start_time,
                endTime: dayPreference.preferred_end_time
            };
        }
        return null;
    }

    async getStaffTotalHoursAllStores(staffIds, year, month) {
        try {
            this.logProcess('STAFF_HOURS_CALCULATION', `全店舗スタッフ時間計算開始`, { staffIds, year, month });

            const shiftsInMonth = await Shift.findAll({
                where: { year, month },
                include: [{
                    model: ShiftAssignment,
                    as: 'assignments',
                    where: { staff_id: { [Op.in]: staffIds } },
                    include: [{
                        model: Staff,
                        attributes: ['id', 'first_name', 'last_name']
                    }]
                }]
            });

            const staffHours = {};
            staffIds.forEach(id => {
                staffHours[id] = { totalMinutes: 0, staffName: '' };
            });

            shiftsInMonth.forEach(shift => {
                shift.assignments.forEach(assignment => {
                    const staffId = assignment.staff_id;
                    if (staffHours[staffId]) {
                        const workMinutes = this.calculateWorkMinutes(assignment.start_time, assignment.end_time);
                        // 🔥 修正: 休憩時間を差し引く
                        const breakMinutes = assignment.break_start_time && assignment.break_end_time 
                            ? this.calculateWorkMinutes(assignment.break_start_time, assignment.break_end_time)
                            : 0;
                        const actualWorkMinutes = workMinutes - breakMinutes;
                        
                        staffHours[staffId].totalMinutes += actualWorkMinutes;
                        if (!staffHours[staffId].staffName && assignment.Staff) {
                            staffHours[staffId].staffName = `${assignment.Staff.last_name} ${assignment.Staff.first_name}`;
                        }
                    }
                });
            });

            const result = {};
            for (const staffId in staffHours) {
                const staffInfo = await Staff.findByPk(staffId, { attributes: ['first_name', 'last_name'] });
                result[staffId] = {
                    total_hours: parseFloat((staffHours[staffId].totalMinutes / 60).toFixed(2)),
                    staff_name: staffHours[staffId].staffName || (staffInfo ? `${staffInfo.last_name} ${staffInfo.first_name}` : '')
                };
            }

            this.logProcess('STAFF_HOURS_RESULT', `スタッフ時間計算完了`, result);
            return result;
        } catch (error) {
            this.logError('STAFF_HOURS_ERROR', error);
            throw new Error('Failed to calculate staff total hours.');
        }
    }

    async getOtherStoreShifts(staffList, currentStoreId, year, month, period) {
        this.logProcess('OTHER_STORE_SHIFTS', `他店舗シフト取得開始`, { currentStoreId, staffCount: staffList.length });

        const otherStoreShifts = {};
        for (const staff of staffList) {
            otherStoreShifts[staff.id] = [];
            const otherStoreIds = staff.stores
                .filter(store => store.id !== currentStoreId)
                .map(store => store.id);

            if (otherStoreIds.length === 0) continue;

            const otherShifts = await Shift.findAll({
                where: {
                    store_id: { [Op.in]: otherStoreIds },
                    year: year,
                    month: month
                },
                include: [
                    {
                        model: ShiftAssignment,
                        as: 'assignments',
                        where: {
                            staff_id: staff.id,
                            date: {
                                [Op.between]: [
                                    period.startDate.format('YYYY-MM-DD'),
                                    period.endDate.format('YYYY-MM-DD')
                                ]
                            }
                        },
                        required: false
                    },
                    {
                        model: Store,
                        attributes: ['id', 'name']
                    }
                ]
            });

            otherShifts.forEach(shift => {
                if (shift.assignments) {
                    shift.assignments.forEach(assignment => {
                        otherStoreShifts[staff.id].push({
                            date: assignment.date,
                            start_time: assignment.start_time,
                            end_time: assignment.end_time,
                            break_start_time: assignment.break_start_time,
                            break_end_time: assignment.break_end_time,
                            store_id: shift.store_id,
                            store_name: shift.Store ? shift.Store.name : `店舗${shift.store_id}`
                        });
                    });
                }
            });
        }

        this.logProcess('OTHER_STORE_SHIFTS_RESULT', `他店舗シフト取得完了`);
        return otherStoreShifts;
    }

    async fetchRealTimeStaffData(storeId, period) {
        this.logProcess('REALTIME_STAFF_FETCH', `リアルタイムスタッフデータ取得開始`, { storeId });

        try {
            const staffWithData = await Staff.findAll({
                include: [
                    {
                        model: Store,
                        as: 'stores',
                        where: { id: storeId },
                        attributes: ['id', 'name'],
                        through: { attributes: [] },
                        required: true
                    },
                    {
                        model: Store,
                        as: 'stores',
                        attributes: ['id', 'name'],
                        through: { attributes: [] },
                        required: false
                    },
                    {
                        model: StaffDayPreference,
                        as: 'dayPreferences',
                        required: false,
                        order: [['day_of_week', 'ASC']]
                    },
                    {
                        model: StaffDayOffRequest,
                        as: 'dayOffRequests',
                        required: false,
                        where: {
                            date: {
                                [Op.between]: [
                                    period.startDate.format('YYYY-MM-DD'),
                                    period.endDate.format('YYYY-MM-DD')
                                ]
                            }
                        }
                    }
                ],
                logging: (sql, timing) => {
                    console.log(`[SQL] ${sql}`);
                    if (timing) console.log(`[TIMING] ${timing}ms`);
                }
            });

            this.logProcess('WORKABLE_STAFF_COUNT', `勤務可能スタッフ数`, { count: staffWithData.length });

            const aiTargetStaffIds = await sequelize.query(`
                SELECT DISTINCT staff_id 
                FROM staff_ai_generation_stores 
                WHERE store_id = :storeId
            `, {
                replacements: { storeId },
                type: sequelize.QueryTypes.SELECT
            });

            const aiTargetIds = aiTargetStaffIds.map(row => row.staff_id);
            this.logProcess('AI_TARGET_IDS', `AI生成対象スタッフID`, { aiTargetIds });

            let targetStaff;
            if (aiTargetIds.length > 0) {
                targetStaff = staffWithData.filter(staff => aiTargetIds.includes(staff.id));
                this.logProcess('AI_TARGET_FILTERED', `AI生成対象によるフィルタリング完了`, {
                    filteredCount: targetStaff.length,
                    originalCount: staffWithData.length
                });
            } else {
                targetStaff = staffWithData;
                this.logProcess('NO_AI_FILTER', `AI生成対象設定なし、全勤務可能スタッフを対象`, {
                    count: targetStaff.length
                });
            }

            const finalStaffData = targetStaff.map(staff => {
                const staffData = staff.toJSON();

                this.logProcess('STAFF_DATA_DEBUG', `スタッフ ${staff.id} のデータ`, {
                    staffId: staff.id,
                    name: `${staff.last_name} ${staff.first_name}`,
                    dayPreferencesCount: staffData.dayPreferences?.length || 0,
                    dayOffRequestsCount: staffData.dayOffRequests?.length || 0,
                    dayPreferencesDetail: staffData.dayPreferences?.map(pref => ({
                        day_of_week: pref.day_of_week,
                        dayName: ['日', '月', '火', '水', '木', '金', '土'][pref.day_of_week],
                        available: pref.available,
                        availableType: typeof pref.available,
                        preferred_start_time: pref.preferred_start_time,
                        preferred_end_time: pref.preferred_end_time
                    })) || []
                });

                return staffData;
            });

            this.logProcess('DATA_INTEGRITY_CHECK', `データ整合性チェック`, {
                totalStaff: finalStaffData.length,
                staffWithoutPreferences: finalStaffData.filter(s => !s.dayPreferences || s.dayPreferences.length === 0).length,
                staffWithIncompletePreferences: finalStaffData.filter(s => s.dayPreferences && s.dayPreferences.length < 7).length,
                booleanTypeValidation: finalStaffData.map(staff => ({
                    staffId: staff.id,
                    availableTypes: staff.dayPreferences?.map(pref => typeof pref.available) || []
                }))
            });

            return finalStaffData;

        } catch (error) {
            this.logError('REALTIME_STAFF_FETCH_ERROR', error);
            throw new Error(`スタッフデータの取得に失敗しました: ${error.message}`);
        }
    }

    async validateGeneratedShift(shiftData, staffs, otherStoreShifts, systemSettings = null) {
        this.logProcess('VALIDATION_START', `シフト検証開始`);
        const violations = [];
        const warnings = [];
        const staffWorkHours = {};
        const staffHoursSummary = {};

        if (!shiftData || !shiftData.shifts) {
            return { isValid: false, violations: ['シフトデータが不正です'], warnings: [] };
        }

        const validStaffIds = staffs.map(s => s.id);
        const minDailyHours = systemSettings?.min_daily_hours || 4.0;

        for (const dayShift of shiftData.shifts) {
            const date = dayShift.date;
            const dayOfWeek = new Date(date).getDay();

            if (!dayShift.assignments) continue;

            for (const assignment of dayShift.assignments) {
                const staffId = assignment.staff_id;

                if (!validStaffIds.includes(staffId)) {
                    violations.push(`存在しないスタッフID: ${staffId}`);
                    continue;
                }

                const staff = staffs.find(s => s.id === staffId);
                if (!staff) {
                    violations.push(`スタッフが見つかりません: ${staffId}`);
                    continue;
                }

                const otherShifts = otherStoreShifts[staffId] || [];
                const conflictingShift = otherShifts.find(otherShift => {
                    if (otherShift.date !== date) return false;
                    const assignStart = moment(assignment.start_time, 'HH:mm');
                    const assignEnd = moment(assignment.end_time, 'HH:mm');
                    const otherStart = moment(otherShift.start_time, 'HH:mm');
                    const otherEnd = moment(otherShift.end_time, 'HH:mm');
                    return assignStart.isBefore(otherEnd) && assignEnd.isAfter(otherStart);
                });

                if (conflictingShift) {
                    violations.push(`${staff.first_name} ${staff.last_name} (${date}): 他店舗（${conflictingShift.store_name}）と時間が重複`);
                }

                const dayPreference = staff.dayPreferences?.find(p => p.day_of_week === dayOfWeek);

                if (dayPreference) {
                    const isAvailable = Boolean(dayPreference.available);

                    if (!isAvailable) {
                        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
                        violations.push(`${staff.first_name} ${staff.last_name} (${date}): ${dayNames[dayOfWeek]}曜日は勤務不可`);
                    }
                }

                const dayOffRequest = staff.dayOffRequests?.find(req =>
                    req.date === date && (req.status === 'approved' || req.status === 'pending')
                );
                if (dayOffRequest) {
                    violations.push(`${staff.first_name} ${staff.last_name} (${date}): 休み希望日`);
                }

                const workMinutes = this.calculateWorkMinutes(assignment.start_time, assignment.end_time);
                const breakMinutes = assignment.break_start_time && assignment.break_end_time 
                    ? this.calculateWorkMinutes(assignment.break_start_time, assignment.break_end_time)
                    : 0;
                const actualWorkMinutes = workMinutes - breakMinutes;
                const workHours = actualWorkMinutes / 60;
                const maxDailyHours = staff.max_hours_per_day || 8;

                // 🔥 新機能: 最低勤務時間チェック
                if (workHours < minDailyHours) {
                    violations.push(`${staff.first_name} ${staff.last_name} (${date}): 1日最低勤務時間不足 (${workHours.toFixed(1)}h < ${minDailyHours}h)`);
                }

                if (workHours > maxDailyHours) {
                    violations.push(`${staff.first_name} ${staff.last_name} (${date}): 1日勤務時間超過 (${workHours.toFixed(1)}h > ${maxDailyHours}h)`);
                }

                // 🔥 新機能: 労働法の休憩時間チェック
                const requiredBreak = this.calculateRequiredBreakTime(workHours);
                if (requiredBreak && (!assignment.break_start_time || !assignment.break_end_time)) {
                    violations.push(`${staff.first_name} ${staff.last_name} (${date}): ${workHours >= 8 ? '8時間以上' : '6時間以上'}の勤務には休憩が必要です`);
                } else if (requiredBreak && breakMinutes < requiredBreak.minutes) {
                    violations.push(`${staff.first_name} ${staff.last_name} (${date}): 休憩時間不足 (${breakMinutes}分 < ${requiredBreak.minutes}分)`);
                }

                if (!staffWorkHours[staffId]) {
                    staffWorkHours[staffId] = 0;
                    staffHoursSummary[staffId] = {
                        name: `${staff.first_name} ${staff.last_name}`,
                        minHours: staff.min_hours_per_month || 0,
                        maxHours: staff.max_hours_per_month || 0,
                        actualHours: 0,
                        assignments: []
                    };
                }
                staffWorkHours[staffId] += actualWorkMinutes;
                staffHoursSummary[staffId].assignments.push({
                    date: date,
                    start_time: assignment.start_time,
                    end_time: assignment.end_time,
                    break_start_time: assignment.break_start_time,
                    break_end_time: assignment.break_end_time,
                    hours: workHours
                });
            }
        }

        for (const staff of staffs) {
            const staffId = staff.id;
            const totalMinutes = staffWorkHours[staffId] || 0;
            const totalHours = totalMinutes / 60;
            const minHours = staff.min_hours_per_month || 0;
            const maxHours = staff.max_hours_per_month || 0;

            if (staffHoursSummary[staffId]) {
                staffHoursSummary[staffId].actualHours = totalHours;
            } else {
                staffHoursSummary[staffId] = {
                    name: `${staff.first_name} ${staff.last_name}`,
                    minHours: minHours,
                    maxHours: maxHours,
                    actualHours: totalHours,
                    assignments: []
                };
            }

            if (minHours > 0 && totalHours < minHours) {
                const shortage = minHours - totalHours;
                violations.push(`${staff.first_name} ${staff.last_name}: 月間最小勤務時間不足 (${totalHours.toFixed(1)}h < ${minHours}h, 不足${shortage.toFixed(1)}h)`);
            }

            if (maxHours > 0 && totalHours > maxHours) {
                const excess = totalHours - maxHours;
                violations.push(`${staff.first_name} ${staff.last_name}: 月間最大勤務時間超過 (${totalHours.toFixed(1)}h > ${maxHours}h, 超過${excess.toFixed(1)}h)`);
            }
        }

        const isValid = violations.length === 0;

        this.logProcess('VALIDATION_COMPLETE', `検証完了`, {
            isValid,
            violationCount: violations.length,
            warningCount: warnings.length
        });

        return { isValid, violations, warnings };
    }

    getCriticalViolations(validationResult) {
        if (!validationResult?.violations) return [];
        
        return validationResult.violations.filter(violation => {
            // 月間最大勤務時間超過は重大
            if (violation.includes('月間最大勤務時間超過')) return true;
            // 休み希望違反は重大
            if (violation.includes('休み希望日') || violation.includes('勤務不可')) return true;
            // 他店舗重複は重大
            if (violation.includes('他店舗') && violation.includes('重複')) return true;
            // 最低勤務時間不足は重大
            if (violation.includes('1日最低勤務時間不足')) return true;
            // 休憩時間不足は重大
            if (violation.includes('休憩が必要です') || violation.includes('休憩時間不足')) return true;
            
            return false;
        });
    }

    calculateShiftScore(validationResult, shiftData, staffs) {
        let score = 1000; // ベーススコア
        
        if (!validationResult) return 0;
        
        // 制約違反ペナルティ
        const violations = validationResult.violations || [];
        score -= violations.length * 100;
        
        // 重大な違反には追加ペナルティ
        const criticalViolations = this.getCriticalViolations(validationResult);
        score -= criticalViolations.length * 500;
        
        // カバレッジボーナス（より多くの日にシフトが組まれている）
        const totalAssignments = shiftData.shifts?.reduce((sum, day) => 
            sum + (day.assignments?.length || 0), 0) || 0;
        score += totalAssignments * 10;
        
        // スタッフの最小勤務時間充足ボーナス
        staffs.forEach(staff => {
            const staffAssignments = this.getStaffAssignments(shiftData, staff.id);
            const totalHours = this.calculateStaffTotalHours(staffAssignments);
            const minHours = staff.min_hours_per_month || 0;
            
            if (totalHours >= minHours) {
                score += 50; // 最小時間達成ボーナス
            }
        });
        
        return Math.max(0, score);
    }

    getStaffTotalHours(shiftData, staffId) {
        if (!shiftData?.shifts) return 0;
        
        let totalMinutes = 0;
        shiftData.shifts.forEach(day => {
            if (day.assignments) {
                day.assignments.forEach(assignment => {
                    if (assignment.staff_id === staffId) {
                        const workMinutes = this.calculateWorkMinutes(assignment.start_time, assignment.end_time);
                        const breakMinutes = assignment.break_start_time && assignment.break_end_time 
                            ? this.calculateWorkMinutes(assignment.break_start_time, assignment.break_end_time)
                            : 0;
                        totalMinutes += (workMinutes - breakMinutes);
                    }
                });
            }
        });
        
        return totalMinutes / 60;
    }

    getStaffAssignments(shiftData, staffId) {
        const assignments = [];
        if (!shiftData?.shifts) return assignments;
        
        shiftData.shifts.forEach(day => {
            if (day.assignments) {
                day.assignments.forEach(assignment => {
                    if (assignment.staff_id === staffId) {
                        const workMinutes = this.calculateWorkMinutes(assignment.start_time, assignment.end_time);
                        const breakMinutes = assignment.break_start_time && assignment.break_end_time 
                            ? this.calculateWorkMinutes(assignment.break_start_time, assignment.break_end_time)
                            : 0;
                        const actualWorkMinutes = workMinutes - breakMinutes;
                        
                        assignments.push({
                            date: day.date,
                            start_time: assignment.start_time,
                            end_time: assignment.end_time,
                            break_start_time: assignment.break_start_time,
                            break_end_time: assignment.break_end_time,
                            hours: actualWorkMinutes / 60
                        });
                    }
                });
            }
        });
        
        return assignments;
    }

    calculateStaffTotalHours(assignments) {
        return assignments.reduce((total, assignment) => total + assignment.hours, 0);
    }

    hasFixableViolations(validationResult) {
        if (!validationResult?.violations) return false;
        
        return validationResult.violations.some(violation => {
            // 月間時間関連は修正可能
            if (violation.includes('月間最小勤務時間不足')) return true;
            if (violation.includes('月間最大勤務時間超過')) return true;
            
            return false;
        });
    }

    async attemptConstraintFix(shiftData, validationResult, staffs, otherStoreShifts) {
        this.logProcess('CONSTRAINT_FIX_START', '制約違反の修正開始');
        
        const fixedShiftData = JSON.parse(JSON.stringify(shiftData)); // ディープコピー
        
        // 月間勤務時間の修正
        const timeViolations = validationResult.violations.filter(v => 
            v.includes('月間最小勤務時間不足') || v.includes('月間最大勤務時間超過')
        );
        
        for (const violation of timeViolations) {
            const staffMatch = violation.match(/^([^:]+):/);
            if (!staffMatch) continue;
            
            const staffName = staffMatch[1];
            const staff = staffs.find(s => `${s.first_name} ${s.last_name}` === staffName);
            if (!staff) continue;
            
            if (violation.includes('月間最大勤務時間超過')) {
                // 勤務時間を削減
                this.reduceStaffHours(fixedShiftData, staff, staffs);
            } else if (violation.includes('月間最小勤務時間不足')) {
                // 勤務時間を増加
                this.increaseStaffHours(fixedShiftData, staff, staffs, otherStoreShifts);
            }
        }
        
        this.logProcess('CONSTRAINT_FIX_COMPLETE', '制約違反の修正完了');
        return fixedShiftData;
    }

    reduceStaffHours(shiftData, staff, staffs) {
        const staffAssignments = [];
        
        // スタッフの全割り当てを収集
        shiftData.shifts.forEach((day, dayIndex) => {
            if (day.assignments) {
                day.assignments.forEach((assignment, assignIndex) => {
                    if (assignment.staff_id === staff.id) {
                        const workMinutes = this.calculateWorkMinutes(assignment.start_time, assignment.end_time);
                        const breakMinutes = assignment.break_start_time && assignment.break_end_time 
                            ? this.calculateWorkMinutes(assignment.break_start_time, assignment.break_end_time)
                            : 0;
                        const actualWorkMinutes = workMinutes - breakMinutes;
                        
                        staffAssignments.push({
                            dayIndex,
                            assignIndex,
                            assignment,
                            date: day.date,
                            hours: actualWorkMinutes / 60
                        });
                    }
                });
            }
        });
        
        // 勤務時間の短い順にソート
        staffAssignments.sort((a, b) => a.hours - b.hours);
        
        // 必要に応じて割り当てを削除
        const maxHours = staff.max_hours_per_month || 160;
        let currentTotal = staffAssignments.reduce((sum, sa) => sum + sa.hours, 0);
        
        while (currentTotal > maxHours && staffAssignments.length > 0) {
            const toRemove = staffAssignments.pop();
            shiftData.shifts[toRemove.dayIndex].assignments.splice(toRemove.assignIndex, 1);
            currentTotal -= toRemove.hours;
            
            // インデックスを調整
            staffAssignments.forEach(sa => {
                if (sa.dayIndex === toRemove.dayIndex && sa.assignIndex > toRemove.assignIndex) {
                    sa.assignIndex--;
                }
            });
        }
    }

    increaseStaffHours(shiftData, staff, staffs, otherStoreShifts, systemSettings = null) {
        const minHours = staff.min_hours_per_month || 0;
        const maxHours = staff.max_hours_per_month || 160;
        const minDailyHours = systemSettings?.min_daily_hours || 4.0;
        
        const currentTotal = this.getStaffTotalHours(shiftData, staff.id);
        const neededHours = minHours - currentTotal;
        
        if (neededHours <= 0) return;
        
        // 勤務可能な日を探して追加
        const availableDays = this.findAvailableDaysForStaff(shiftData, staff, otherStoreShifts);
        
        let addedHours = 0;
        for (const availableDay of availableDays) {
            if (addedHours >= neededHours) break;
            
            const suggestedHours = Math.max(
                minDailyHours,
                Math.min(
                    neededHours - addedHours,
                    staff.max_hours_per_day || 8
                )
            );
            
            // スタッフの希望時間を取得
            const preferredTime = this.getStaffPreferredTime(staff, availableDay.dayOfWeek);
            let startTime, endTime, breakStart = null, breakEnd = null;
            
            if (preferredTime) {
                startTime = preferredTime.startTime;
                const workTime = this.calculateEndTimeWithBreak(startTime, suggestedHours);
                endTime = workTime.endTime;
                breakStart = workTime.breakStart;
                breakEnd = workTime.breakEnd;
            } else {
                startTime = "10:00";
                const workTime = this.calculateEndTimeWithBreak(startTime, suggestedHours);
                endTime = workTime.endTime;
                breakStart = workTime.breakStart;
                breakEnd = workTime.breakEnd;
            }
            
            const newAssignment = {
                staff_id: staff.id,
                start_time: startTime,
                end_time: endTime,
                break_start_time: breakStart,
                break_end_time: breakEnd
            };
            
            const dayShift = shiftData.shifts.find(d => d.date === availableDay.date);
            if (dayShift) {
                if (!dayShift.assignments) dayShift.assignments = [];
                dayShift.assignments.push(newAssignment);
                addedHours += suggestedHours;
            }
        }
    }

    findAvailableDaysForStaff(shiftData, staff, otherStoreShifts) {
        const availableDays = [];
        const otherShifts = otherStoreShifts[staff.id] || [];
        
        // 全ての日付をチェック
        shiftData.shifts.forEach(day => {
            const date = day.date;
            const dayOfWeek = new Date(date).getDay();
            
            // 既に割り当てがある場合はスキップ
            const hasAssignment = day.assignments?.some(a => a.staff_id === staff.id);
            if (hasAssignment) return;
            
            // 他店舗でのシフトがある場合はスキップ
            const hasOtherShift = otherShifts.some(s => s.date === date);
            if (hasOtherShift) return;
            
            // 勤務不可曜日チェック
            const dayPreference = staff.dayPreferences?.find(p => p.day_of_week === dayOfWeek);
            if (dayPreference && !dayPreference.available) return;
            
            // 休み希望チェック
            const hasDayOff = staff.dayOffRequests?.some(req => 
                req.date === date && (req.status === 'approved' || req.status === 'pending')
            );
            if (hasDayOff) return;
            
            availableDays.push({ date, dayOfWeek });
        });
        
        return availableDays;
    }

    async generateShift(storeId, year, month) {
        this.initializeSession(storeId, year, month);

        try {
            this.logProcess('STORE_FETCH', `店舗情報取得開始`, { storeId });
            const store = await Store.findByPk(storeId);
            if (!store) {
                throw new Error('指定された店舗が見つかりません。');
            }
            this.logProcess('STORE_RESULT', `店舗情報取得完了`, { storeName: store.name });

            this.logProcess('SYSTEM_SETTINGS_FETCH', `システム設定取得開始`);
            const settings = await SystemSetting.findOne({ where: { user_id: store.owner_id } });
            const closingDay = settings ? settings.closing_day : 25;
            const systemSettings = settings ? settings : { min_daily_hours: 4.0 };
            this.logProcess('SYSTEM_SETTINGS_RESULT', `システム設定取得完了`, { closingDay, minDailyHours: systemSettings.min_daily_hours });

            const period = this.getShiftPeriod(year, month, closingDay);

            this.logProcess('STAFF_FETCH', `リアルタイムスタッフ情報取得開始`);
            const staffs = await this.fetchRealTimeStaffData(storeId, period);

            if (staffs.length === 0) {
                throw new Error('この店舗に勤務可能なスタッフがいません。');
            }

            this.logProcess('STAFF_RESULT', `リアルタイムスタッフ情報取得完了`, {
                staffCount: staffs.length,
                staffDetails: staffs.map(staff => ({
                    id: staff.id,
                    name: `${staff.last_name} ${staff.first_name}`,
                    totalMinHours: staff.min_hours_per_month || 0,
                    totalMaxHours: staff.max_hours_per_month || 160,
                    dayPreferences: staff.dayPreferences?.length || 0,
                    daysOff: staff.dayOffRequests?.length || 0,
                    dayPreferencesDetail: staff.dayPreferences?.map(pref => ({
                        day_of_week: pref.day_of_week,
                        dayName: ['日', '月', '火', '水', '木', '金', '土'][pref.day_of_week],
                        available: pref.available,
                        availableType: typeof pref.available,
                        updatedAt: pref.updatedAt,
                        preferred_start_time: pref.preferred_start_time,
                        preferred_end_time: pref.preferred_end_time
                    })) || []
                }))
            });

            const otherStoreShifts = await this.getOtherStoreShifts(staffs, storeId, year, month, period);

            this.logProcess('STORE_SETTINGS_FETCH', `店舗設定取得開始`);
            const storeClosedDays = await StoreClosedDay.findAll({ where: { store_id: storeId } });
            const storeRequirements = await StoreStaffRequirement.findAll({ where: { store_id: storeId } });
            this.logProcess('STORE_SETTINGS_RESULT', `店舗設定取得完了`, {
                closedDaysCount: storeClosedDays.length,
                requirementsCount: storeRequirements.length
            });

            const MAX_RETRY_ATTEMPTS = 3; // 最大再試行回数
            let attempt = 0;
            let bestResult = null;
            let bestValidation = null;

            while (attempt < MAX_RETRY_ATTEMPTS) {
                attempt++;
                this.logProcess('GENERATION_ATTEMPT', `シフト生成試行 ${attempt}/${MAX_RETRY_ATTEMPTS}`);

                // AIプロンプト生成（試行回数に応じて調整）
                const prompt = this.buildPrompt(
                    store, staffs, storeClosedDays, storeRequirements, 
                    year, month, period, otherStoreShifts, attempt, systemSettings
                );
                this.logProcess('PROMPT_GENERATION', `AIプロンプト生成完了`, {
                    promptLength: prompt.length
                });

                // Claude API呼び出し
                this.logProcess('AI_API_CALL', `Claude API呼び出し開始`);
                const response = await this.callClaudeApi(prompt);
                this.logProcess('AI_API_RESULT', `Claude APIレスポンス受信完了`, {
                    responseLength: JSON.stringify(response).length
                });

                // レスポンス解析
                this.logProcess('RESPONSE_PARSING', `レスポンス解析開始`);
                const generatedShiftData = this.parseClaudeResponse(response);

                if (!generatedShiftData?.shifts) {
                    this.logProcess('PARSE_ERROR', `試行${attempt}: データ解析失敗`);
                    continue;
                }

                this.logProcess('RESPONSE_PARSING_RESULT', `レスポンス解析完了`, {
                    parsedShifts: generatedShiftData?.shifts?.length || 0
                });

                // バリデーション実行
                this.logProcess('VALIDATION', `バリデーション実行中`);
                const validationResult = await this.validateGeneratedShift(generatedShiftData, staffs, otherStoreShifts, systemSettings);
                this.logProcess('VALIDATION_RESULT', `バリデーション完了`, {
                    isValid: validationResult.isValid,
                    violationCount: validationResult.violations?.length || 0,
                    warningCount: validationResult.warnings?.length || 0,
                    violations: validationResult.violations || [],
                    warnings: validationResult.warnings || []
                });

                // 結果の評価
                const score = this.calculateShiftScore(validationResult, generatedShiftData, staffs);
                
                if (validationResult.isValid) {
                    // 制約違反なし - 即座に採用
                    this.logProcess('GENERATION_SUCCESS', `試行${attempt}: 制約違反なしで成功`);
                    
                    this.logProcess('SAVE_SHIFT', `シフト保存開始`);
                    const result = await this.saveShift(generatedShiftData, storeId, year, month);
                    this.logProcess('SAVE_SHIFT_RESULT', `シフト保存完了`);
                    
                    const finalResult = {
                        success: true,
                        shiftData: result,
                        validation: validationResult,
                        hasWarnings: false,
                        attempts: attempt
                    };

                    this.finalizeSession('SUCCESS', finalResult);
                    return finalResult;
                }

                // 制約違反あり - ベスト結果として保存
                if (!bestResult || score > this.calculateShiftScore(bestValidation, bestResult.shiftData, staffs)) {
                    bestResult = {
                        shiftData: generatedShiftData,
                        validation: validationResult,
                        score: score
                    };
                    bestValidation = validationResult;
                }

                this.logProcess('CONSTRAINT_VIOLATION', `試行${attempt}: 制約違反`, {
                    violationCount: validationResult.violations?.length || 0,
                    score: score
                });

                // 重大な制約違反がある場合は修正を試行
                if (this.hasFixableViolations(validationResult)) {
                    this.logProcess('ATTEMPTING_FIX', `試行${attempt}: 制約違反の修正を試行`);
                    const fixedShiftData = await this.attemptConstraintFix(
                        generatedShiftData, validationResult, staffs, otherStoreShifts
                    );
                    
                    if (fixedShiftData) {
                        const fixedValidation = await this.validateGeneratedShift(
                            fixedShiftData, staffs, otherStoreShifts, systemSettings
                        );
                        
                        if (fixedValidation.isValid) {
                            this.logProcess('FIX_SUCCESS', `試行${attempt}: 修正成功`);
                            const result = await this.saveShift(fixedShiftData, storeId, year, month);
                            
                            const finalResult = {
                                success: true,
                                shiftData: result,
                                validation: fixedValidation,
                                hasWarnings: false,
                                attempts: attempt,
                                wasFixed: true
                            };

                            this.finalizeSession('SUCCESS', finalResult);
                            return finalResult;
                        }
                    }
                }
            }

            // 全試行で制約違反 - 最良結果の処理
            if (bestResult) {
                const criticalViolations = this.getCriticalViolations(bestValidation);
                
                if (criticalViolations.length > 0) {
                    // 重大な制約違反がある場合は保存しない
                    this.logProcess('CRITICAL_VIOLATIONS', `重大な制約違反により生成を中止`, {
                        violations: criticalViolations
                    });
                    
                    const errorResult = {
                        success: false,
                        error: 'CRITICAL_CONSTRAINTS_VIOLATED',
                        message: `重大な制約違反があるため、シフトを生成できませんでした。\n\n主な問題:\n${criticalViolations.slice(0, 5).join('\n')}`,
                        violations: criticalViolations,
                        attempts: MAX_RETRY_ATTEMPTS
                    };

                    this.finalizeSession('FAILED', errorResult);
                    throw new Error(errorResult.message);
                }

                // 軽微な制約違反のみ - 警告付きで保存
                this.logProcess('MINOR_VIOLATIONS_SAVE', `軽微な制約違反のみ、警告付きで保存`);
                const result = await this.saveShift(bestResult.shiftData, storeId, year, month);
                
                const finalResult = {
                    success: true,
                    shiftData: result,
                    validation: bestValidation,
                    hasWarnings: true,
                    warningMessage: `一部制約違反がありますが、最良結果として保存しました。\n\n要確認事項:\n${bestValidation.violations?.slice(0, 3).join('\n') || ''}`,
                    attempts: MAX_RETRY_ATTEMPTS
                };

                this.finalizeSession('SUCCESS_WITH_WARNINGS', finalResult);
                return finalResult;
            }

            // 全試行失敗
            throw new Error('すべての試行でシフト生成に失敗しました');

        } catch (error) {
            this.logError('GENERATE_SHIFT_ERROR', error);
            this.finalizeSession('ERROR', null, error);
            throw error;
        }
    }

    buildPrompt(store, staffs, storeClosedDays, storeRequirements, year, month, period, otherStoreShifts, attempt = 1, systemSettings = null) {
        // 期間内の全日付を生成（曜日情報付き）
        const allDates = [];
        const dateToWeekdayMap = {};
        const weekdayNames = ['日', '月', '火', '水', '木', '金', '土'];

        const startDate = period.startDate.clone();
        while (startDate.isSameOrBefore(period.endDate)) {
            const dateStr = startDate.format('YYYY-MM-DD');
            const dayOfWeek = startDate.day();
            allDates.push(dateStr);
            dateToWeekdayMap[dateStr] = {
                dayOfWeek: dayOfWeek,
                dayName: weekdayNames[dayOfWeek]
            };
            startDate.add(1, 'day');
        }

        const minDailyHours = systemSettings?.min_daily_hours || 4.0;

        // 各日付に対して勤務可能なスタッフをマッピング
        const dateStaffAvailability = {};

        allDates.forEach(date => {
            const weekdayInfo = dateToWeekdayMap[date];
            dateStaffAvailability[date] = {
                weekday: weekdayInfo.dayName,
                availableStaff: []
            };

            staffs.forEach(staff => {
                // 勤務不可曜日チェック
                const dayPreference = staff.dayPreferences?.find(p => p.day_of_week === weekdayInfo.dayOfWeek);
                const isAvailable = dayPreference ? Boolean(dayPreference.available) : true;

                // 休み希望チェック
                const hasDayOff = staff.dayOffRequests?.some(req =>
                    req.date === date && (req.status === 'approved' || req.status === 'pending')
                );

                // 他店舗シフトチェック
                const otherShifts = otherStoreShifts[staff.id] || [];
                const hasOtherShift = otherShifts.some(shift => shift.date === date);

                if (isAvailable && !hasDayOff && !hasOtherShift) {
                    const staffInfo = {
                        id: staff.id,
                        name: `${staff.first_name} ${staff.last_name}`,
                        preferredTime: dayPreference?.preferred_start_time && dayPreference?.preferred_end_time
                            ? `${dayPreference.preferred_start_time}-${dayPreference.preferred_end_time}`
                            : null
                    };
                    dateStaffAvailability[date].availableStaff.push(staffInfo);
                }
            });
        });

        let prompt = `あなたはシフト管理システムです。以下の条件を厳密に守ってシフトを生成してください。
    
    ## 🚨 絶対に守るべきルール
    1. 各日付に指定された「勤務可能スタッフ」以外は絶対に配置しない
    2. 月間勤務時間の範囲を絶対に守る
    3. 1日最低${minDailyHours}時間以上の勤務を必須とする
    4. 労働基準法の休憩時間を必ず設定する（6時間以上45分、8時間以上60分）
    
    ## 期間情報
    - 対象期間: ${period.startDate.format('YYYY-MM-DD')} ～ ${period.endDate.format('YYYY-MM-DD')}
    - 生成日数: ${allDates.length}日間
    
    ## スタッフ勤務時間制約（厳守）
    ${staffs.map(s => {
            const totalCurrent = 0; // 現在の累計時間（新規生成の場合は0）
            const minHours = s.min_hours_per_month || 0;
            const maxHours = s.max_hours_per_month || 160;
            const neededMin = Math.max(0, minHours - totalCurrent);
            const availableMax = Math.max(0, maxHours - totalCurrent);

            return `${s.first_name} ${s.last_name} (ID:${s.id}): 
       - 月間: 最小${minHours}時間、最大${maxHours}時間
       - 残り必要時間: ${neededMin}時間以上
       - 残り配置可能時間: ${availableMax}時間以下
       - 1日最大: ${s.max_hours_per_day || 8}時間`;
        }).join('\n')}
    
    ## 🗓️ 日付別勤務可能スタッフ（これ以外のスタッフは絶対に配置禁止）
    
    `;

        // 日付ごとに勤務可能スタッフを明記
        Object.entries(dateStaffAvailability).forEach(([date, info]) => {
            prompt += `
    【${date} (${info.weekday}曜日)】
    勤務可能スタッフ: `;

            if (info.availableStaff.length === 0) {
                prompt += `なし（この日はシフトを空にしてください）`;
            } else {
                prompt += `\n${info.availableStaff.map(s =>
                    `  - ${s.name} (ID:${s.id})${s.preferredTime ? ` 希望時間:${s.preferredTime}` : ''}`
                ).join('\n')}`;
            }
            prompt += '\n';
        });

        // 営業時間と要件
        prompt += `
    ## 営業時間
    - ${store.opening_time} - ${store.closing_time}
    
    ## 出力形式
    以下のJSON形式で出力してください。上記の「勤務可能スタッフ」に記載されていないスタッフは絶対に含めないでください。
    
    \`\`\`json
    {
      "shifts": [
        {
          "date": "YYYY-MM-DD",
          "assignments": [
            {
              "staff_id": 番号,
              "start_time": "HH:MM",
              "end_time": "HH:MM",
              "break_start_time": "HH:MM",
              "break_end_time": "HH:MM"
            }
          ]
        }
      ]
    }
    \`\`\`
    
    重要: 
    - 各日付の「勤務可能スタッフ」リストに載っていないスタッフは絶対に配置しない
    - 勤務可能スタッフがいない日は、assignmentsを空配列[]にする
    - ${minDailyHours}時間未満の勤務は禁止
    - 希望時間がある場合は可能な限り従う`;

        return prompt;
    }

    async callClaudeApi(prompt) {
        if (!this.claudeApiKey) {
            throw new Error('CLAUDE_API_KEY環境変数が設定されていません。.envファイルを確認してください。');
        }

        const data = {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 30000,
            temperature: 0.1,
            messages: [{ role: 'user', content: prompt }]
        };

        const config = {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.claudeApiKey,
                'anthropic-version': '2023-06-01'
            },
            timeout: 120000
        };

        if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
            const https = require('https');
            config.httpsAgent = new https.Agent({
                rejectUnauthorized: false
            });
            this.logProcess('SSL_CHECK_DISABLED', 'SSL証明書検証を無効化してAPI呼び出しを実行');
        }

        try {
            const startTime = Date.now();
            const response = await axios.post(this.claudeApiUrl, data, config);
            const endTime = Date.now();

            this.logProcess('API_CALL_SUCCESS', `Claude API呼び出し成功`, {
                responseTime: endTime - startTime,
                status: response.status,
                contentLength: JSON.stringify(response.data).length,
                model: data.model,
                inputTokens: response.data.usage?.input_tokens,
                outputTokens: response.data.usage?.output_tokens,
                stopReason: response.data.stop_reason,
                sslDisabled: process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0'
            });

            return response.data;
        } catch (error) {
            this.logError('API_CALL_ERROR', error, {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                model: data.model,
                sslDisabled: process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0',
                errorCode: error.code,
                errorMessage: error.message
            });
            throw error;
        }
    }

    parseClaudeResponse(response) {
        if (!response?.content?.[0]?.text) {
            throw new Error('Claude APIレスポンスに有効なテキストが含まれていません。');
        }

        let jsonString = response.content[0].text;

        let extractedJson = null;
        let match = jsonString.match(/```json\s*\n([\s\S]*?)\n\s*```/);
        if (match && match[1]) {
            extractedJson = match[1];
        } else {
            match = jsonString.match(/```\s*\n([\s\S]*?)\n\s*```/);
            if (match && match[1] && match[1].trim().startsWith('{')) {
                extractedJson = match[1];
            } else {
                match = jsonString.match(/\{[\s\S]*\}/);
                if (match) {
                    extractedJson = match[0];
                }
            }
        }

        if (extractedJson) {
            jsonString = extractedJson;
        }

        jsonString = this.cleanAndRepairJson(jsonString);

        try {
            const parsed = JSON.parse(jsonString);
            if (!parsed.shifts || !Array.isArray(parsed.shifts)) {
                throw new Error('shiftsプロパティが配列ではありません');
            }
            return parsed;
        } catch (error) {
            this.logError('JSON_PARSE_ERROR', error, { jsonString: jsonString.substring(0, 500) });
            throw new Error(`AIからの応答をJSONとして解析できませんでした: ${error.message}`);
        }
    }

    cleanAndRepairJson(jsonString) {
        jsonString = jsonString.trim();
        jsonString = jsonString.replace(/,\s*([}\]])/g, '$1');
        jsonString = jsonString.replace(/\}\s*\}\s*$/, '}');
        jsonString = jsonString.replace(/^\s*\{\s*\{/, '{');

        if (!jsonString.endsWith('}')) {
            const openBraces = (jsonString.match(/{/g) || []).length;
            const closeBraces = (jsonString.match(/}/g) || []).length;
            const openBrackets = (jsonString.match(/\[/g) || []).length;
            const closeBrackets = (jsonString.match(/\]/g) || []).length;

            const lastCompleteEntry = this.findLastCompleteEntry(jsonString);
            if (lastCompleteEntry) {
                jsonString = lastCompleteEntry;
            }

            let missingCloseBrackets = openBrackets - closeBrackets;
            let missingCloseBraces = openBraces - closeBraces;

            while (missingCloseBrackets > 0) {
                jsonString += ']';
                missingCloseBrackets--;
            }
            while (missingCloseBraces > 0) {
                jsonString += '}';
                missingCloseBraces--;
            }
        }

        return jsonString;
    }

    findLastCompleteEntry(jsonString) {
        const shiftsMatch = jsonString.match(/"shifts":\s*\[([\s\S]*)/);
        if (!shiftsMatch) return null;

        const shiftsContent = shiftsMatch[1];
        const completeObjectPattern = /\{[^{}]*"date":\s*"[^"]+",\s*"assignments":\s*\[[^\]]*\]\s*\}/g;
        const matches = [];
        let match;

        while ((match = completeObjectPattern.exec(shiftsContent)) !== null) {
            matches.push({
                match: match[0],
                endIndex: match.index + match[0].length
            });
        }

        if (matches.length === 0) return null;

        const lastMatch = matches[matches.length - 1];
        const truncatedShifts = shiftsContent.substring(0, lastMatch.endIndex);
        return `{"shifts":[${truncatedShifts}]}`;
    }

    async saveShift(shiftData, storeId, year, month) {
        return await sequelize.transaction(async (t) => {
            let shift = await Shift.findOne({ where: { store_id: storeId, year, month }, transaction: t });
            if (shift) {
                await ShiftAssignment.destroy({ where: { shift_id: shift.id }, transaction: t });
            } else {
                shift = await Shift.create({ store_id: storeId, year, month, status: 'draft' }, { transaction: t });
            }

            if (shiftData && shiftData.shifts) {
                let assignmentCount = 0;
                for (const dayShift of shiftData.shifts) {
                    if (dayShift.assignments && Array.isArray(dayShift.assignments)) {
                        for (const assignment of dayShift.assignments) {
                            await ShiftAssignment.create({
                                shift_id: shift.id,
                                staff_id: assignment.staff_id,
                                date: dayShift.date,
                                start_time: assignment.start_time,
                                end_time: assignment.end_time,
                                break_start_time: assignment.break_start_time || null,
                                break_end_time: assignment.break_end_time || null,
                            }, { transaction: t });
                            assignmentCount++;
                        }
                    }
                }
                this.logProcess('SHIFT_ASSIGNMENTS_SAVED', `シフト割り当て保存完了`, { assignmentCount });
            }

            return shiftData;
        });
    }

    async validateShift(shiftData, storeId, year, month) {
        try {
            const store = await Store.findByPk(storeId);
            if (!store) {
                throw new Error('指定された店舗が見つかりません。');
            }

            const settings = await SystemSetting.findOne({ where: { user_id: store.owner_id } });
            const closingDay = settings ? settings.closing_day : 25;
            const systemSettings = settings ? settings : { min_daily_hours: 4.0 };
            const period = this.getShiftPeriod(year, month, closingDay);

            const staffs = await this.fetchRealTimeStaffData(storeId, period);
            const otherStoreShifts = await this.getOtherStoreShifts(staffs, storeId, year, month, period);

            return await this.validateGeneratedShift(shiftData, staffs, otherStoreShifts, systemSettings);
        } catch (error) {
            this.logError('VALIDATE_SHIFT_ERROR', error);
            throw error;
        }
    }
}

module.exports = new ShiftGeneratorService();