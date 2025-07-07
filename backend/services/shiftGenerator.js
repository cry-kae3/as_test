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

        // ログディレクトリの作成
        this.logDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }

        // 実行ごとのログコンテナ
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
                        staffHours[staffId].totalMinutes += workMinutes;
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

    // 🔥 完全リアルタイムデータベース取得
    async fetchRealTimeStaffData(storeId, period) {
        this.logProcess('REALTIME_STAFF_FETCH', `🔥 リアルタイムスタッフデータ取得開始`, { storeId });

        // 🔥 強制的に最新データをデータベースから取得（キャッシュ無効）
        const staffWithStores = await Staff.findAll({
            include: [
                {
                    model: Store,
                    as: 'stores',
                    where: { id: storeId },
                    attributes: ['id', 'name'],
                    through: { attributes: [] }
                },
                {
                    model: Store,
                    as: 'stores',
                    attributes: ['id', 'name'],
                    through: { attributes: [] },
                    required: false
                }
            ],
            // 🔥 強制的にデータベースから取得
            logging: (sql) => {
                console.log('🔥 EXECUTING SQL:', sql);
            }
        });

        this.logProcess('WORKABLE_STAFF_COUNT', `勤務可能スタッフ数`, { count: staffWithStores.length });

        // 🔥 各スタッフの最新希望シフトを個別に取得
        const finalStaffData = [];

        for (const staff of staffWithStores) {
            this.logProcess('FETCH_STAFF_PREFERENCES', `スタッフ${staff.id}の希望シフト取得中`, {
                staffId: staff.id,
                staffName: `${staff.last_name} ${staff.first_name}`
            });

            // 🔥 最新の希望シフトを強制取得
            const latestPreferences = await StaffDayPreference.findAll({
                where: { staff_id: staff.id },
                order: [['day_of_week', 'ASC'], ['updatedAt', 'DESC']],
                // 🔥 強制的にデータベースから取得
                logging: (sql) => {
                    console.log(`🔥 PREFERENCES SQL for staff ${staff.id}:`, sql);
                }
            });

            // 🔥 最新の休み希望を強制取得
            const latestDayOffRequests = await StaffDayOffRequest.findAll({
                where: {
                    staff_id: staff.id,
                    date: {
                        [Op.between]: [
                            period.startDate.format('YYYY-MM-DD'),
                            period.endDate.format('YYYY-MM-DD')
                        ]
                    }
                },
                // 🔥 強制的にデータベースから取得
                logging: (sql) => {
                    console.log(`🔥 DAY OFF SQL for staff ${staff.id}:`, sql);
                }
            });

            // 🔥 希望シフトの詳細ログ
            this.logProcess('STAFF_PREFERENCES_DETAIL', `スタッフ${staff.id}の希望シフト詳細`, {
                staffId: staff.id,
                staffName: `${staff.last_name} ${staff.first_name}`,
                preferencesCount: latestPreferences.length,
                dayOffCount: latestDayOffRequests.length,
                preferences: latestPreferences.map(pref => ({
                    day_of_week: pref.day_of_week,
                    dayName: ['日', '月', '火', '水', '木', '金', '土'][pref.day_of_week],
                    available: pref.available,
                    availableType: typeof pref.available,
                    updatedAt: pref.updatedAt,
                    preferred_start_time: pref.preferred_start_time,
                    preferred_end_time: pref.preferred_end_time
                }))
            });

            // スタッフデータを結合
            const staffObj = staff.toJSON();
            staffObj.dayPreferences = latestPreferences.map(pref => pref.toJSON());
            staffObj.dayOffRequests = latestDayOffRequests.map(req => req.toJSON());

            finalStaffData.push(staffObj);
        }

        // 🔥 AI生成対象フィルタリング
        const aiTargetStaffIds = await sequelize.query(`
            SELECT DISTINCT staff_id 
            FROM staff_ai_generation_stores 
            WHERE store_id = :storeId
        `, {
            replacements: { storeId },
            type: sequelize.QueryTypes.SELECT,
            logging: (sql) => {
                console.log('🔥 AI TARGET SQL:', sql);
            }
        });

        const aiTargetIds = aiTargetStaffIds.map(row => row.staff_id);
        this.logProcess('AI_TARGET_IDS', `AI生成対象スタッフID`, { aiTargetIds });

        // AI生成対象のフィルタリング
        let targetStaff;
        if (aiTargetIds.length > 0) {
            targetStaff = finalStaffData.filter(staff => aiTargetIds.includes(staff.id));
            this.logProcess('AI_TARGET_FILTERED', `AI生成対象によるフィルタリング完了`, {
                filteredCount: targetStaff.length,
                originalCount: finalStaffData.length,
                filteredStaffIds: targetStaff.map(s => s.id)
            });
        } else {
            targetStaff = finalStaffData;
            this.logProcess('NO_AI_FILTER', `AI生成対象設定なし、全勤務可能スタッフを対象`, {
                count: targetStaff.length
            });
        }

        // 🔥 データ整合性チェック
        this.logProcess('DATA_INTEGRITY_CHECK', `データ整合性チェック`, {
            totalWorkableStaff: finalStaffData.length,
            aiTargetStaff: targetStaff.length,
            staffWithoutPreferences: targetStaff.filter(s => !s.dayPreferences || s.dayPreferences.length === 0).length,
            staffWithIncompletePreferences: targetStaff.filter(s => s.dayPreferences && s.dayPreferences.length < 7).length
        });

        return targetStaff;
    }

    // 🔥 データ正規化（Boolean型統一）
    normalizeStaffData(staffs) {
        this.logProcess('NORMALIZE_DATA', `データ正規化開始`, { staffCount: staffs.length });

        const normalizedStaffs = staffs.map(staff => {
            if (staff.dayPreferences) {
                staff.dayPreferences = staff.dayPreferences.map(pref => {
                    // 🔥 Boolean型に強制統一
                    let normalizedAvailable;
                    if (pref.available === null || pref.available === undefined) {
                        normalizedAvailable = false;
                    } else if (typeof pref.available === 'string') {
                        normalizedAvailable = pref.available === 'true' || pref.available === '1';
                    } else {
                        normalizedAvailable = Boolean(pref.available);
                    }

                    return {
                        ...pref,
                        available: normalizedAvailable
                    };
                });
            }

            return staff;
        });

        // 🔥 正規化結果の詳細ログ
        this.logProcess('NORMALIZE_RESULT', `正規化結果`, {
            normalizedStaffs: normalizedStaffs.map(staff => ({
                id: staff.id,
                name: `${staff.last_name} ${staff.first_name}`,
                dayPreferencesNormalized: staff.dayPreferences?.map(pref => ({
                    day_of_week: pref.day_of_week,
                    dayName: ['日', '月', '火', '水', '木', '金', '土'][pref.day_of_week],
                    original: pref.available,
                    type: typeof pref.available,
                    updatedAt: pref.updatedAt
                })) || []
            }))
        });

        return normalizedStaffs;
    }

    async validateGeneratedShift(shiftData, staffs, otherStoreShifts) {
        this.logProcess('VALIDATION_START', `シフト検証開始`);
        const violations = [];
        const warnings = [];
        const staffWorkHours = {};
        const staffHoursSummary = {};

        if (!shiftData || !shiftData.shifts) {
            return { isValid: false, violations: ['シフトデータが不正です'], warnings: [] };
        }

        const validStaffIds = staffs.map(s => s.id);

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

                // 他店舗との重複チェック
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

                // 🔥 勤務不可曜日チェック（正規化後のデータで）
                const dayPreference = staff.dayPreferences?.find(p => p.day_of_week === dayOfWeek);

                if (dayPreference) {
                    const isAvailable = Boolean(dayPreference.available);

                    if (!isAvailable) {
                        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
                        violations.push(`${staff.first_name} ${staff.last_name} (${date}): ${dayNames[dayOfWeek]}曜日は勤務不可`);
                    }
                }

                // 休み希望チェック
                const dayOffRequest = staff.dayOffRequests?.find(req =>
                    req.date === date && (req.status === 'approved' || req.status === 'pending')
                );
                if (dayOffRequest) {
                    violations.push(`${staff.first_name} ${staff.last_name} (${date}): 休み希望日`);
                }

                // 勤務時間チェック
                const workMinutes = this.calculateWorkMinutes(assignment.start_time, assignment.end_time);
                const workHours = workMinutes / 60;
                const maxDailyHours = staff.max_hours_per_day || 8;

                if (workHours > maxDailyHours) {
                    violations.push(`${staff.first_name} ${staff.last_name} (${date}): 1日勤務時間超過 (${workHours.toFixed(1)}h > ${maxDailyHours}h)`);
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
                staffWorkHours[staffId] += workMinutes;
                staffHoursSummary[staffId].assignments.push({
                    date: date,
                    start_time: assignment.start_time,
                    end_time: assignment.end_time,
                    hours: workHours
                });
            }
        }

        // 月間勤務時間チェック
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
            this.logProcess('SYSTEM_SETTINGS_RESULT', `システム設定取得完了`, { closingDay });

            const period = this.getShiftPeriod(year, month, closingDay);

            // 🔥 完全リアルタイムデータベース取得
            this.logProcess('STAFF_FETCH', `🔥 リアルタイムスタッフ情報取得開始`);
            const rawStaffs = await this.fetchRealTimeStaffData(storeId, period);

            if (rawStaffs.length === 0) {
                throw new Error('この店舗に勤務可能なスタッフがいません。');
            }

            // 🔥 データ正規化
            const staffs = this.normalizeStaffData(rawStaffs);

            // 詳細なスタッフ情報をログ出力
            this.logProcess('STAFF_RESULT', `🔥 リアルタイムスタッフ情報取得完了`, {
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

            // プロンプト生成
            const prompt = this.buildPrompt(store, staffs, storeClosedDays, storeRequirements, year, month, period, otherStoreShifts);
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
            this.logProcess('RESPONSE_PARSING_RESULT', `レスポンス解析完了`, {
                parsedShifts: generatedShiftData?.shifts?.length || 0
            });

            if (!generatedShiftData || !generatedShiftData.shifts || !Array.isArray(generatedShiftData.shifts)) {
                throw new Error('生成されたシフトデータの構造が不正です');
            }

            // バリデーション
            this.logProcess('VALIDATION', `バリデーション実行中`);
            const validationResult = await this.validateGeneratedShift(generatedShiftData, staffs, otherStoreShifts);
            this.logProcess('VALIDATION_RESULT', `バリデーション完了`, {
                isValid: validationResult.isValid,
                violationCount: validationResult.violations?.length || 0,
                warningCount: validationResult.warnings?.length || 0,
                violations: validationResult.violations || [],
                warnings: validationResult.warnings || []
            });

            // 制約違反があっても警告として処理し、そのまま保存
            if (!validationResult.isValid) {
                this.logProcess('VALIDATION_WARNING', `制約違反がありますが、データを保存します`, {
                    violations: validationResult.violations?.slice(0, 5) || []
                });
            }

            // シフト保存
            this.logProcess('SAVE_SHIFT', `シフト保存開始`);
            const result = await this.saveShift(generatedShiftData, storeId, year, month);
            this.logProcess('SAVE_SHIFT_RESULT', `シフト保存完了`);

            const finalResult = {
                success: true,
                shiftData: result,
                validation: validationResult,
                hasWarnings: !validationResult.isValid,
                warningMessage: !validationResult.isValid ?
                    `制約違反がありますが、シフトを生成しました。手動で調整してください。\n主な問題: ${validationResult.violations?.slice(0, 3).join(', ') || '不明'}` : null
            };

            this.finalizeSession('SUCCESS', finalResult);
            return finalResult;

        } catch (error) {
            this.logError('GENERATE_SHIFT_ERROR', error);
            this.finalizeSession('ERROR', null, error);
            throw error;
        }
    }

    buildPrompt(store, staffs, storeClosedDays, storeRequirements, year, month, period, otherStoreShifts) {
        // 期間内の全日付を生成
        const allDates = [];
        const startDate = period.startDate.clone();
        while (startDate.isSameOrBefore(period.endDate)) {
            allDates.push(startDate.format('YYYY-MM-DD'));
            startDate.add(1, 'day');
        }

        // 🔥 リアルタイムデータに基づくスタッフ制約解析
        const staffConstraintDetails = staffs.map(staff => {
            const unavailableDays = staff.dayPreferences?.filter(p => {
                const isAvailable = Boolean(p.available);
                return !isAvailable;
            }) || [];

            const dayOffDates = staff.dayOffRequests?.filter(req =>
                req.status === 'approved' || req.status === 'pending'
            ).map(req => req.date) || [];

            const unavailableDayNames = unavailableDays.map(p =>
                ['日', '月', '火', '水', '木', '金', '土'][p.day_of_week]
            );

            return {
                staffId: staff.id,
                staffName: `${staff.first_name} ${staff.last_name}`,
                unavailableDayNames: unavailableDayNames,
                dayOffDates: dayOffDates,
                otherShifts: otherStoreShifts[staff.id] || []
            };
        });

        this.logProcess('🔥 REALTIME_STAFF_CONSTRAINTS', `🔥 リアルタイムスタッフ制約解析`, {
            staffConstraints: staffConstraintDetails
        });

        let prompt = `あなたはシフト管理システムです。以下の条件を参考にシフトを生成してください。
    
    ## 期間情報
    - 対象期間: ${period.startDate.format('YYYY-MM-DD')} ～ ${period.endDate.format('YYYY-MM-DD')}
    - 生成する日数: ${allDates.length}日間
    - 生成対象日付: ${allDates.join(', ')}
    
    ## スタッフ情報
    
    `;

        staffs.forEach(staff => {
            const unavailableDays = staff.dayPreferences?.filter(p => {
                const isAvailable = Boolean(p.available);
                return !isAvailable;
            }).map(p => {
                const dayName = ['日', '月', '火', '水', '木', '金', '土'][p.day_of_week];
                return dayName;
            }) || [];

            const dayOffDates = staff.dayOffRequests?.filter(req =>
                req.status === 'approved' || req.status === 'pending'
            ).map(req => req.date) || [];
            const otherShifts = otherStoreShifts[staff.id] || [];

            prompt += `【${staff.first_name} ${staff.last_name} (ID: ${staff.id})】
    - 月間勤務時間: このスタッフの月間合計勤務時間は、必ず ${staff.min_hours_per_month || 0} 時間から ${staff.max_hours_per_month || 160} 時間の範囲に収めてください。この範囲から逸脱してはいけません。
    - 1日最大勤務時間: ${staff.max_hours_per_day || 8}時間
    - 勤務不可曜日: ${unavailableDays.length > 0 ? unavailableDays.join(',') : 'なし'}
    - 休み希望: ${dayOffDates.length > 0 ? dayOffDates.join(',') : 'なし'}`;

            if (otherShifts.length > 0) {
                prompt += `
    - 他店舗勤務（重複不可）:`;
                otherShifts.forEach(shift => {
                    prompt += `\n  ${shift.date}: ${shift.start_time}-${shift.end_time} (${shift.store_name})`;
                });
            }
            prompt += '\n';
        });

        prompt += `
    ## 重要ルール
    1. 各スタッフの月間合計勤務時間は、指定された「月間勤務時間」の範囲内に必ず収めること。これが最も重要なルールです。
    2. **期間内のすべての日付（${allDates.length}日間）について、適切なスタッフ配置を考慮してシフトを生成すること。**
    3. スタッフをシフトに割り当てる際は、可能な限りそのスタッフの「1日最大勤務時間」に近い時間で割り当てること。
    4. 各日付の人員要件（もしあれば）を満たすことを優先する。
    5. 勤務不可曜日と休み希望日には絶対に割り当てない。
    6. 1日の勤務時間は絶対に「1日最大勤務時間」を超えない。
    7. 他店舗で既に勤務がある日時には絶対に割り当てない（同じ時間帯に複数店舗で勤務することはできない）。
    8. **すべての日付に少なくとも1人以上のスタッフを配置するよう努めること。**
    
    ## 営業時間と店舗要件
    - 営業時間: ${store.opening_time} - ${store.closing_time}`;

        // 店舗の人員要件を追加
        if (storeRequirements && storeRequirements.length > 0) {
            prompt += '\n- 人員要件:';
            storeRequirements.forEach(req => {
                if (req.day_of_week !== null) {
                    const dayName = ['日', '月', '火', '水', '木', '金', '土'][req.day_of_week];
                    prompt += `\n  ${dayName}曜日 ${req.start_time}-${req.end_time}: ${req.required_staff_count}人`;
                }
            });
        }

        // 定休日情報を追加
        if (storeClosedDays && storeClosedDays.length > 0) {
            prompt += '\n- 定休日:';
            storeClosedDays.forEach(closedDay => {
                if (closedDay.day_of_week !== null) {
                    const dayName = ['日', '月', '火', '水', '木', '金', '土'][closedDay.day_of_week];
                    prompt += `\n  ${dayName}曜日`;
                } else if (closedDay.specific_date) {
                    prompt += `\n  ${closedDay.specific_date}`;
                }
            });
        }

        prompt += `
    
    ## 出力形式
    以下のJSON形式で正確に出力してください。**期間内のすべての日付（${allDates.length}日間）について出力してください。**
    重要: 全てのオブジェクトは必ず \`{\` と \`}\` で囲んでください。配列内の各要素がオブジェクトである場合、それぞれを \`{\` と \`}\` で囲む必要があります。
    
    \`\`\`json
    {
      "shifts": [
        {
          "date": "YYYY-MM-DD",
          "assignments": [
            {
              "staff_id": 1,
              "start_time": "09:00", 
              "end_time": "17:00"
            }
          ]
        }
      ]
    }
    \`\`\`
    
    **注意: 必ず期間内のすべての日付（${period.startDate.format('YYYY-MM-DD')}から${period.endDate.format('YYYY-MM-DD')}まで）についてシフトを生成してください。定休日や勤務できる人がいない日でも、空の assignments 配列でdate要素を含めてください。**`;

        return prompt;
    }

    async callClaudeApi(prompt) {
        if (!this.claudeApiKey) {
            throw new Error('CLAUDE_API_KEY環境変数が設定されていません。.envファイルを確認してください。');
        }

        const data = {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 8192,
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

        // JSONの抽出
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

        // JSON修復
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
}

module.exports = new ShiftGeneratorService();