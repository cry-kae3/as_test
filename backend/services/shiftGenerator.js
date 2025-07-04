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

        this.log('=== ShiftGeneratorService 初期化開始 ===');
        if (!this.claudeApiKey) {
            this.log('❌ CLAUDE_API_KEY環境変数が設定されていません', 'error');
        } else {
            this.log('✅ Claude API設定完了:', {
                apiUrl: this.claudeApiUrl,
                apiKeyPrefix: this.claudeApiKey.substring(0, 10) + '...',
                apiKeyLength: this.claudeApiKey.length
            });
        }
        this.log('=== ShiftGeneratorService 初期化完了 ===');
    }

    log(message, level = 'info', data = null) {
        const timestamp = moment().format('YYYY-MM-DD HH:mm:ss.SSS');
        const logMessage = typeof message === 'object' ? JSON.stringify(message, null, 2) : message;
        const dataStr = data ? ` | データ: ${JSON.stringify(data, null, 2)}` : '';
        const logLevel = typeof level === 'string' ? level.toUpperCase() : 'INFO';
        const fullMessage = `[${timestamp}] [${logLevel}] ${logMessage}${dataStr}`;

        // コンソール出力
        if (logLevel === 'ERROR') {
            console.error(fullMessage);
        } else {
            console.log(fullMessage);
        }

        // ファイル出力
        const today = moment().format('YYYY-MM-DD');
        const logFile = path.join(this.logDir, `shift-generator-${today}.log`);

        try {
            fs.appendFileSync(logFile, fullMessage + '\n', 'utf8');
        } catch (error) {
            console.error('ログファイル書き込みエラー:', error);
        }

        // エラーログは別ファイルにも出力
        if (logLevel === 'ERROR') {
            const errorLogFile = path.join(this.logDir, `shift-generator-error-${today}.log`);
            try {
                fs.appendFileSync(errorLogFile, fullMessage + '\n', 'utf8');
            } catch (error) {
                console.error('エラーログファイル書き込みエラー:', error);
            }
        }
    }

    getShiftPeriod(year, month, closingDay) {
        this.log(`getShiftPeriod実行`, 'info', { year, month, closingDay });
        const targetMonth = moment.tz(`${year}-${String(month).padStart(2, '0')}-01`, "Asia/Tokyo");
        const endDate = targetMonth.date(closingDay).startOf('day');
        const startDate = endDate.clone().subtract(1, 'month').add(1, 'day').startOf('day');
        const period = { startDate, endDate };
        this.log(`期間計算結果: ${startDate.format('YYYY-MM-DD')} ～ ${endDate.format('YYYY-MM-DD')}`);
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
            this.log('getStaffTotalHoursAllStores開始', 'info', { staffIds, year, month });
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
                staffHours[id] = {
                    totalMinutes: 0,
                    staffName: ''
                };
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

            this.log('スタッフ総労働時間計算完了', 'info', result);
            return result;
        } catch (error) {
            this.log('getStaffTotalHoursAllStores エラー', 'error', error);
            throw new Error('Failed to calculate staff total hours.');
        }
    }

    async getOtherStoreShifts(staffList, currentStoreId, year, month, period) {
        this.log('getOtherStoreShifts開始', 'info', { currentStoreId, staffCount: staffList.length });
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

        this.log('他店舗シフト取得完了');
        return otherStoreShifts;
    }

    validateStaffConstraints(staff, date, startTime, endTime) {
        const errors = [];
        const warnings = [];

        const dayOfWeek = new Date(date).getDay();
        const dayPreference = staff.dayPreferences?.find(pref => pref.day_of_week === dayOfWeek);

        if (dayPreference && !dayPreference.available) {
            errors.push(`${['日', '月', '火', '水', '木', '金', '土'][dayOfWeek]}曜日は勤務不可設定です`);
        }

        const dayOffRequest = staff.dayOffRequests?.find(req =>
            req.date === date && (req.status === 'approved' || req.status === 'pending')
        );
        if (dayOffRequest) {
            if (dayOffRequest.status === 'approved') {
                errors.push(`${date}は承認済みの休み希望があります`);
            } else {
                errors.push(`${date}は休み希望があります`);
            }
        }

        const workMinutes = this.calculateWorkMinutes(startTime, endTime);
        const workHours = workMinutes / 60;

        if (staff.max_hours_per_day && workHours > staff.max_hours_per_day) {
            errors.push(`1日の最大勤務時間（${staff.max_hours_per_day}時間）を超過します（${workHours.toFixed(1)}時間）`);
        }

        if (workHours > 8) {
            warnings.push('8時間超の勤務には休憩時間が必要です');
        } else if (workHours > 6) {
            warnings.push('6時間超の勤務には休憩時間が必要です');
        }

        return { errors, warnings };
    }

    async generateShift(storeId, year, month) {
        const sessionId = `${storeId}-${year}-${month}-${Date.now()}`;
        this.log('=== シフト生成開始 ===', 'info', { sessionId, storeId, year, month });

        try {
            this.log('1. 店舗情報取得中...');
            const store = await Store.findByPk(storeId);
            if (!store) {
                this.log('❌ 店舗が見つかりません', 'error', { storeId });
                throw new Error('指定された店舗が見つかりません。');
            }
            this.log('✅ 店舗情報取得完了', 'info', { storeName: store.name });

            this.log('2. システム設定取得中...');
            const settings = await SystemSetting.findOne({ where: { user_id: store.owner_id } });
            const closingDay = settings ? settings.closing_day : 25;
            this.log('✅ 締め日設定', 'info', { closingDay });

            this.log('3. 期間計算中...');
            const period = this.getShiftPeriod(year, month, closingDay);

            this.log('4. スタッフ情報取得中...');
            const staffs = await Staff.findAll({
                include: [
                    {
                        model: Store,
                        as: 'aiGenerationStores',
                        where: { id: storeId },
                        attributes: ['id', 'name'],
                    },
                    {
                        model: Store,
                        as: 'stores',
                        attributes: ['id', 'name'],
                        through: { attributes: [] },
                        required: false
                    },
                    { model: StaffDayPreference, as: 'dayPreferences' },
                    {
                        model: StaffDayOffRequest,
                        as: 'dayOffRequests',
                        where: { date: { [Op.between]: [period.startDate.format('YYYY-MM-DD'), period.endDate.format('YYYY-MM-DD')] } },
                        required: false
                    }
                ]
            });

            if (staffs.length === 0) {
                this.log('❌ AI生成対象のスタッフがいません', 'error');
                throw new Error('この店舗にAI生成対象のスタッフがいません。');
            }

            this.log('✅ スタッフ情報取得完了', 'info', { staffCount: staffs.length });
            staffs.forEach(staff => {
                this.log(`スタッフ詳細: ID:${staff.id} ${staff.last_name} ${staff.first_name}`, 'info', {
                    monthlyHours: `${staff.min_hours_per_month || 0}-${staff.max_hours_per_month || 160}h`,
                    dailyHours: `${staff.max_hours_per_day || 8}h`
                });
            });

            this.log('5. 他店舗シフト情報取得中...');
            const otherStoreShifts = await this.getOtherStoreShifts(staffs, storeId, year, month, period);

            this.log('6. 店舗設定取得中...');
            const storeClosedDays = await StoreClosedDay.findAll({ where: { store_id: storeId } });
            const storeRequirements = await StoreStaffRequirement.findAll({ where: { store_id: storeId } });
            this.log('✅ 店舗設定取得完了', 'info', {
                closedDaysCount: storeClosedDays.length,
                requirementsCount: storeRequirements.length
            });

            let attempts = 0;
            const maxAttempts = 3;
            let lastError = null;
            let currentPrompt = this.buildStrictPrompt(store, staffs, storeClosedDays, storeRequirements, year, month, period, otherStoreShifts);

            this.log('7. Claude APIでシフト生成開始...');
            while (attempts < maxAttempts) {
                attempts++;
                this.log(`--- 試行 ${attempts}/${maxAttempts} ---`);

                try {
                    this.log('Claude API呼び出し中...');
                    const response = await this.callClaudeApi(currentPrompt);
                    this.log('✅ Claude APIレスポンス受信完了');

                    let generatedShiftData;
                    try {
                        this.log('レスポンス解析中...');
                        generatedShiftData = this.parseClaudeResponse(response);
                        this.log('✅ レスポンス解析完了');
                    } catch (parseError) {
                        this.log('❌ レスポンス解析エラー', 'error', parseError.message);
                        if (parseError.message.includes('Unexpected end of JSON input')) {
                            if (attempts < maxAttempts) {
                                this.log('シンプルプロンプトで再試行します');
                                currentPrompt = this.buildSimplePrompt(store, staffs, year, month, period, otherStoreShifts);
                                continue;
                            }
                        }
                        throw parseError;
                    }

                    if (!generatedShiftData || !generatedShiftData.shifts || !Array.isArray(generatedShiftData.shifts)) {
                        this.log('❌ 生成されたシフトデータの構造が不正です', 'error');
                        throw new Error('生成されたシフトデータの構造が不正です');
                    }

                    this.log('バリデーション実行中...');
                    const validationResult = await this.validateGeneratedShift(generatedShiftData, staffs, otherStoreShifts);

                    if (validationResult.isValid) {
                        this.log('✅ バリデーション成功');
                        this.log('シフト保存中...');
                        const result = await this.saveShift(generatedShiftData, storeId, year, month);
                        this.log('✅ シフト保存完了');
                        this.log('=== シフト生成正常終了 ===', 'info', { sessionId });
                        return result;
                    } else {
                        this.log('❌ バリデーション失敗', 'error', validationResult.violations.slice(0, 3));
                        lastError = new Error(`制約違反: ${validationResult.violations.slice(0, 3).join(', ')}`);

                        if (attempts < maxAttempts) {
                            this.log('より厳格なプロンプトで再試行します');
                            currentPrompt = this.buildStricterPrompt(store, staffs, storeClosedDays, storeRequirements, year, month, period, validationResult.violations, otherStoreShifts);
                            continue;
                        }
                    }
                } catch (error) {
                    this.log(`❌ 試行 ${attempts} でエラー`, 'error', error.message);
                    this.log('エラー詳細', 'error', error);
                    lastError = error;

                    // レート制限対応
                    if (error.response?.status === 429 || error.message.includes('rate') || error.message.includes('limit')) {
                        this.log('⚠️ レート制限に達しました。60秒待機します...', 'warn');
                        await new Promise(resolve => setTimeout(resolve, 60000));
                    } else if (error.response?.status >= 500) {
                        this.log('⚠️ サーバーエラーです。10秒待機します...', 'warn');
                        await new Promise(resolve => setTimeout(resolve, 10000));
                    } else if (attempts < maxAttempts) {
                        if (error.message.includes('API')) {
                            this.log('2秒待機後に再試行します...');
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        }
                        continue;
                    }
                }
            }

            this.log('❌ 全ての試行が失敗しました', 'error');
            this.log('=== シフト生成異常終了 ===', 'error', { sessionId });
            throw lastError || new Error('制約を満たすシフトを生成できませんでした。スタッフの勤務条件を見直してください。');

        } catch (error) {
            this.log('❌ generateShift 致命的エラー', 'error', error.message);
            this.log('スタックトレース', 'error', error.stack);
            this.log('=== シフト生成致命的エラーで終了 ===', 'error', { sessionId });
            throw error;
        }
    }

    buildSimplePrompt(store, staffs, year, month, period, otherStoreShifts) {
        this.log('buildSimplePrompt 実行中...');
        let prompt = `期間: ${period.startDate.format('YYYY-MM-DD')} ～ ${period.endDate.format('YYYY-MM-DD')}

基本ルール:
- 以下の利用可能なスタッフIDのみを使用してください。
- スタッフをシフトに入れる際は、1日の勤務時間が8時間を超えないように、可能な限り長く割り当ててください。
- 他店舗で既にシフトが入っている時間帯には絶対に割り当てないでください。

利用可能なスタッフID:
`;

        staffs.forEach(staff => {
            prompt += `- スタッフID: ${staff.id} (${staff.last_name} ${staff.first_name}) 1日最大 ${staff.max_hours_per_day || 8}h`;

            const otherShifts = otherStoreShifts[staff.id] || [];
            if (otherShifts.length > 0) {
                prompt += '\n  他店舗シフト:';
                otherShifts.forEach(shift => {
                    prompt += `\n    ${shift.date}: ${shift.start_time}-${shift.end_time} (${shift.store_name})`;
                });
            }
            prompt += '\n';
        });

        prompt += `
上記ルールに従って、シフトをJSON形式で出力してください。
重要: 
- 必ず上記のスタッフIDのみを使用
- 各スタッフの月間勤務時間を絶対に超過させない
- 全てのオブジェクトは必ず \`{\` と \`}\` で囲む

{"shifts":[{"date":"YYYY-MM-DD","assignments":[{"staff_id":${staffs[0]?.id || 1},"start_time":"09:00","end_time":"17:00"}]}]}`;

        this.log('buildSimplePrompt 完了', 'info', { promptLength: prompt.length });
        return prompt;
    }

    buildStricterPrompt(store, staffs, storeClosedDays, storeRequirements, year, month, period, violations, otherStoreShifts) {
        this.log('buildStricterPrompt 実行中...', 'info', { violationsCount: violations.length });
        let prompt = `前回のシフト生成で以下の絶対守るべきルール違反がありました。今度は絶対にルールを守って生成してください。

### 前回の違反内容
${violations.slice(0, 5).join('\n')}

### 利用可能なスタッフIDとその制約
`;

        staffs.forEach(staff => {
            prompt += `
スタッフID: ${staff.id} (${staff.last_name} ${staff.first_name}):
- 1日の勤務時間は絶対に${staff.max_hours_per_day || 8}時間以下にすること。`;

            const unavailableDays = staff.dayPreferences?.filter(p => !p.available).map(p =>
                ['日', '月', '火', '水', '木', '金', '土'][p.day_of_week]
            ) || [];
            if (unavailableDays.length > 0) {
                prompt += `
- ${unavailableDays.join(', ')}曜日は絶対に勤務させないこと。`;
            }

            const dayOffDates = staff.dayOffRequests?.filter(req => req.status === 'approved' || req.status === 'pending').map(req => req.date) || [];
            if (dayOffDates.length > 0) {
                prompt += `
- 休み希望日(${dayOffDates.join(',')})には絶対に勤務させないこと。`;
            }

            const otherShifts = otherStoreShifts[staff.id] || [];
            if (otherShifts.length > 0) {
                prompt += `
- 以下の日時は他店舗で勤務のため絶対に割り当てないこと:`;
                otherShifts.forEach(shift => {
                    prompt += `\n  ${shift.date}: ${shift.start_time}-${shift.end_time} (${shift.store_name})`;
                });
            }
        });

        const availableStaffIds = staffs.map(s => s.id).join(', ');
        prompt += `

### 重要な注意事項（絶対遵守）
- 使用可能なスタッフID: ${availableStaffIds}
- 上記以外のスタッフIDは絶対に使用しないこと
- 各スタッフの月間勤務時間は絶対に上限を超えないこと
- 期間: ${period.startDate.format('YYYY-MM-DD')} ～ ${period.endDate.format('YYYY-MM-DD')}

前回の違反を修正し、ルールを厳守したシフトをJSON形式で出力してください。
{
  "shifts": [
    {
      "date": "YYYY-MM-DD", 
      "assignments": [
        {
          "staff_id": ${staffs[0]?.id || 1},
          "start_time": "HH:MM",
          "end_time": "HH:MM"
        }
      ]
    }
  ]
}`;

        this.log('buildStricterPrompt 完了', 'info', { promptLength: prompt.length });
        return prompt;
    }

    buildStrictPrompt(store, staffs, storeClosedDays, storeRequirements, year, month, period, otherStoreShifts) {
        this.log('buildStrictPrompt 実行中...');
        let prompt = `あなたはシフト管理システムです。以下の条件を厳守してシフトを生成してください。

## 期間情報
- 対象期間: ${period.startDate.format('YYYY-MM-DD')} ～ ${period.endDate.format('YYYY-MM-DD')}

## 利用可能なスタッフID（絶対遵守）
`;

        const availableStaffIds = staffs.map(s => s.id);
        prompt += `使用可能なスタッフID: ${availableStaffIds.join(', ')}\n`;
        prompt += `重要: 上記以外のスタッフIDは絶対に使用しないでください。\n\n`;

        prompt += `## スタッフ制約（絶対遵守）\n`;

        staffs.forEach(staff => {
            const unavailableDays = staff.dayPreferences?.filter(p => !p.available).map(p => ['日', '月', '火', '水', '木', '金', '土'][p.day_of_week]) || [];
            const dayOffDates = staff.dayOffRequests?.filter(req => req.status === 'approved' || req.status === 'pending').map(req => req.date) || [];
            const otherShifts = otherStoreShifts[staff.id] || [];

            prompt += `
【スタッフID: ${staff.id} - ${staff.first_name} ${staff.last_name}】
- 月間時間上限（絶対遵守）: ${staff.max_hours_per_month || 160}時間
- 月間時間下限（目標）: ${staff.min_hours_per_month || 0}時間
- 1日最大勤務時間: ${staff.max_hours_per_day || 8}時間
- 勤務不可曜日: ${unavailableDays.length > 0 ? unavailableDays.join(',') : 'なし'}
- 休み希望: ${dayOffDates.length > 0 ? dayOffDates.join(',') : 'なし'}`;

            if (otherShifts.length > 0) {
                prompt += `
- 他店舗勤務（重複不可）:`;
                otherShifts.forEach(shift => {
                    prompt += `\n      ${shift.date}: ${shift.start_time}-${shift.end_time} (${shift.store_name})`;
                });
            }
        });

        prompt += `

## 重要ルール（絶対遵守）
1. 使用可能スタッフID（${availableStaffIds.join(', ')}）以外は絶対に使用しない
2. 勤務不可曜日と休み希望日には絶対に割り当てない
3. 1日の勤務時間は絶対に「1日最大勤務時間」を超えない
4. 他店舗で既に勤務がある日時には絶対に割り当てない
5. 各スタッフの月間勤務時間は絶対に上限（max_hours_per_month）を超えてはならない
6. 各スタッフの月間勤務時間は下限（min_hours_per_month）から上限（max_hours_per_month）の範囲内に収めること
7. 月間時間制限は「目安」ではなく「絶対的な制約」として扱うこと

## 出力形式
以下のJSON形式で正確に出力してください。余計な説明は不要です。
重要: スタッフIDは ${availableStaffIds.join(', ')} のいずれかを使用してください。

{
  "shifts": [
    {
      "date": "YYYY-MM-DD",
      "assignments": [
        {
          "staff_id": ${staffs[0]?.id || availableStaffIds[0]},
          "start_time": "09:00", 
          "end_time": "17:00"
        }
      ]
    }
  ]
}`;

        this.log('buildStrictPrompt 完了', 'info', { promptLength: prompt.length });
        return prompt;
    }

    async validateGeneratedShift(shiftData, staffs, otherStoreShifts) {
        this.log('validateGeneratedShift 実行中...');
        const violations = [];
        const warnings = [];
        const staffWorkHours = {};

        if (!shiftData || !shiftData.shifts) {
            this.log('❌ シフトデータが不正です', 'error');
            return { isValid: false, violations: ['シフトデータが不正です'], warnings: [] };
        }

        const validStaffIds = staffs.map(s => s.id);
        this.log('有効なスタッフID', 'info', validStaffIds);

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
                    violations.push(`${staff.first_name} ${staff.last_name} (${date}): 他店舗（${conflictingShift.store_name}）と時間が重複 (${conflictingShift.start_time}-${conflictingShift.end_time})`);
                }

                const availableDays = staff.dayPreferences?.filter(p => p.available).map(p => p.day_of_week) || [];
                if (!availableDays.includes(dayOfWeek)) {
                    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
                    violations.push(`${staff.first_name} ${staff.last_name} (${date}): ${dayNames[dayOfWeek]}曜日は勤務不可`);
                }

                const dayOffRequest = staff.dayOffRequests?.find(req =>
                    req.date === date && (req.status === 'approved' || req.status === 'pending')
                );
                if (dayOffRequest) {
                    violations.push(`${staff.first_name} ${staff.last_name} (${date}): 休み希望日`);
                }

                const workMinutes = this.calculateWorkMinutes(assignment.start_time, assignment.end_time);
                const workHours = workMinutes / 60;
                const maxDailyHours = staff.max_hours_per_day || 8;

                if (workHours > maxDailyHours) {
                    violations.push(`${staff.first_name} ${staff.last_name} (${date}): 1日勤務時間超過 (${workHours.toFixed(1)}h > ${maxDailyHours}h)`);
                }

                if (!staffWorkHours[staffId]) {
                    staffWorkHours[staffId] = 0;
                }
                staffWorkHours[staffId] += workMinutes;
            }
        }

        for (const staff of staffs) {
            const staffId = staff.id;
            const totalMinutes = staffWorkHours[staffId] || 0;
            const totalHours = totalMinutes / 60;
            const minHours = staff.min_hours_per_month || 0;
            const maxHours = staff.max_hours_per_month || 0;

            this.log(`${staff.first_name} ${staff.last_name}: 月間勤務時間`, 'info', {
                totalHours: totalHours.toFixed(1),
                limits: `${minHours}-${maxHours}h`
            });

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
        this.log(`バリデーション結果: ${isValid ? '✅ 成功' : '❌ 失敗'}`, isValid ? 'info' : 'error');
        if (!isValid) {
            this.log('違反内容', 'error', violations.slice(0, 5));
        }

        return {
            isValid,
            violations,
            warnings
        };
    }

    async callClaudeApi(prompt) {
        this.log('=== Claude API 呼び出し開始 ===');
        const https = require('https');

        if (!this.claudeApiKey) {
            this.log('❌ CLAUDE_API_KEY環境変数が設定されていません', 'error');
            throw new Error('CLAUDE_API_KEY環境変数が設定されていません。.envファイルを確認してください。');
        }

        const url = this.claudeApiUrl;
        this.log('API URL', 'info', url);

        const data = {
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 8192,
            temperature: 0.1,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ]
        };

        this.log('リクエストデータ', 'info', {
            model: data.model,
            max_tokens: data.max_tokens,
            temperature: data.temperature,
            promptLength: prompt.length
        });

        const httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });

        const config = {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.claudeApiKey,
                'anthropic-version': '2023-06-01'
            },
            timeout: 120000,
            httpsAgent: httpsAgent
        };

        this.log('ヘッダー情報', 'info', {
            'Content-Type': config.headers['Content-Type'],
            'anthropic-version': config.headers['anthropic-version'],
            'x-api-key-prefix': this.claudeApiKey.substring(0, 10) + '...',
            timeout: config.timeout
        });

        try {
            this.log('Claude API リクエスト送信中...');
            const startTime = Date.now();
            const response = await axios.post(url, data, config);
            const endTime = Date.now();
            this.log('✅ Claude API レスポンス受信完了', 'info', {
                responseTime: endTime - startTime,
                status: response.status,
                statusText: response.statusText,
                contentLength: JSON.stringify(response.data).length
            });
            this.log('=== Claude API 呼び出し終了 ===');
            return response.data;
        } catch (error) {
            this.log('=== Claude API エラー発生 ===', 'error');
            this.log('❌ エラータイプ', 'error', error.constructor.name);
            this.log('❌ メッセージ', 'error', error.message);

            if (error.response) {
                this.log('❌ レスポンスエラー詳細', 'error', {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    headers: error.response.headers,
                    data: error.response.data
                });

                // レート制限の詳細チェック
                if (error.response.status === 429) {
                    this.log('🚫 レート制限エラー - 1分後に再試行してください', 'error');
                } else if (error.response.status >= 500) {
                    this.log('🔧 サーバーエラー - Anthropic側の問題の可能性があります', 'error');
                } else if (error.response.status === 400) {
                    this.log('📝 リクエストエラー - APIキーまたはリクエスト形式を確認してください', 'error');
                }
            } else if (error.request) {
                this.log('❌ リクエストエラー', 'error', error.request);
            } else {
                this.log('❌ その他のエラー', 'error', error.message);
            }

            if (error.code) {
                this.log('❌ エラーコード', 'error', error.code);
            }

            if (error.message.includes('certificate')) {
                this.log('❌ SSL証明書エラーが発生しました', 'error');
            }

            if (error.message.includes('timeout')) {
                this.log('❌ タイムアウトエラーが発生しました', 'error');
            }

            this.log('=== Claude API エラー終了 ===', 'error');
            throw error;
        }
    }

    parseClaudeResponse(response) {
        this.log('parseClaudeResponse 実行中...');

        if (!response) {
            this.log('❌ レスポンスが空です', 'error');
            throw new Error('Claude APIからのレスポンスが空です。');
        }

        this.log('レスポンス構造確認', 'info', {
            hasContent: !!response.content,
            contentType: typeof response.content,
            contentIsArray: Array.isArray(response.content),
            contentLength: response.content ? response.content.length : 0
        });

        if (!response.content || !Array.isArray(response.content) || response.content.length === 0) {
            this.log('❌ 有効なcontentが含まれていません', 'error');
            throw new Error('Claude APIレスポンスに有効なcontentが含まれていません。');
        }

        const content = response.content[0];
        this.log('コンテンツ情報', 'info', {
            hasText: !!content.text,
            textLength: content.text ? content.text.length : 0
        });

        if (!content.text) {
            this.log('❌ 有効なテキストが含まれていません', 'error');
            throw new Error('Claude APIレスポンスに有効なテキストが含まれていません。');
        }

        let jsonString = content.text;
        this.log('レスポンステキスト（最初の500文字）', 'info', jsonString.substring(0, 500));

        let extractedJson = null;

        let match = jsonString.match(/```json\s*\n([\s\S]*?)\n\s*```/);
        if (match && match[1]) {
            extractedJson = match[1];
            this.log('✅ JSONコードブロックを発見');
        }

        if (!extractedJson) {
            match = jsonString.match(/```\s*\n([\s\S]*?)\n\s*```/);
            if (match && match[1] && match[1].trim().startsWith('{')) {
                extractedJson = match[1];
                this.log('✅ 一般コードブロックからJSONを発見');
            }
        }

        if (!extractedJson) {
            match = jsonString.match(/\{[\s\S]*\}/);
            if (match) {
                extractedJson = match[0];
                this.log('✅ テキスト中からJSONオブジェクトを発見');
            }
        }

        if (extractedJson) {
            jsonString = extractedJson;
            this.log('抽出されたJSON（最初の300文字）', 'info', jsonString.substring(0, 300));
        } else {
            this.log('⚠️ JSONが見つからない場合の全テキスト', 'warn', content.text);
        }

        this.log('JSON修復処理実行中...');
        jsonString = this.cleanAndRepairJson(jsonString);

        try {
            this.log('JSON解析実行中...');
            const parsed = JSON.parse(jsonString);
            this.log('✅ JSON解析成功');

            if (!parsed.shifts || !Array.isArray(parsed.shifts)) {
                this.log('❌ shiftsプロパティが配列ではありません', 'error');
                throw new Error('shiftsプロパティが配列ではありません');
            }

            this.log('✅ shifts配列を確認', 'info', { shiftCount: parsed.shifts.length });
            return parsed;
        } catch (error) {
            this.log('❌ JSON解析エラー', 'error', error.message);
            this.log('解析対象のJSON', 'error', jsonString);

            throw new Error(`AIからの応答をJSONとして解析できませんでした: ${error.message}`);
        }
    }

    cleanAndRepairJson(jsonString) {
        this.log('cleanAndRepairJson 実行中...');
        jsonString = jsonString.trim();

        jsonString = jsonString.replace(/,\s*([}\]])/g, '$1');
        jsonString = jsonString.replace(/\}\s*\}\s*$/, '}');
        jsonString = jsonString.replace(/^\s*\{\s*\{/, '{');

        if (!jsonString.endsWith('}')) {
            this.log('⚠️ JSONが不完全です。修復を試行します...', 'warn');

            const openBraces = (jsonString.match(/{/g) || []).length;
            const closeBraces = (jsonString.match(/}/g) || []).length;
            const openBrackets = (jsonString.match(/\[/g) || []).length;
            const closeBrackets = (jsonString.match(/\]/g) || []).length;

            this.log('括弧の状況', 'info', {
                openBraces,
                closeBraces,
                openBrackets,
                closeBrackets
            });

            let missingCloseBrackets = openBrackets - closeBrackets;
            let missingCloseBraces = openBraces - closeBraces;

            const lastCompleteEntry = this.findLastCompleteEntry(jsonString);
            if (lastCompleteEntry) {
                this.log('✅ 最後の完全なエントリを使用');
                jsonString = lastCompleteEntry;
            }

            while (missingCloseBrackets > 0) {
                jsonString += ']';
                missingCloseBrackets--;
            }
            while (missingCloseBraces > 0) {
                jsonString += '}';
                missingCloseBraces--;
            }
        }

        this.log('✅ JSON修復完了');
        return jsonString;
    }

    findLastCompleteEntry(jsonString) {
        this.log('findLastCompleteEntry 実行中...');
        const shiftsMatch = jsonString.match(/"shifts":\s*\[([\s\S]*)/);
        if (!shiftsMatch) {
            this.log('❌ shifts配列が見つかりません', 'error');
            return null;
        }

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

        if (matches.length === 0) {
            this.log('❌ 完全なエントリが見つかりません', 'error');
            return null;
        }

        this.log('✅ 完全なエントリを発見', 'info', { entryCount: matches.length });
        const lastMatch = matches[matches.length - 1];
        const truncatedShifts = shiftsContent.substring(0, lastMatch.endIndex);

        return `{"shifts":[${truncatedShifts}]}`;
    }

    async saveShift(shiftData, storeId, year, month) {
        this.log('saveShift 実行中...', 'info', { storeId, year, month });

        return await sequelize.transaction(async (t) => {
            this.log('トランザクション開始');

            let shift = await Shift.findOne({ where: { store_id: storeId, year, month }, transaction: t });
            if (shift) {
                this.log('既存のシフトを発見。シフト割り当てを削除中...', 'info', { shiftId: shift.id });
                await ShiftAssignment.destroy({ where: { shift_id: shift.id }, transaction: t });
            } else {
                this.log('新しいシフトを作成中...');
                shift = await Shift.create({ store_id: storeId, year, month, status: 'draft' }, { transaction: t });
                this.log('新しいシフトを作成完了', 'info', { shiftId: shift.id });
            }

            if (shiftData && shiftData.shifts) {
                let assignmentCount = 0;
                this.log('シフト割り当て保存開始', 'info', { dayCount: shiftData.shifts.length });

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
                this.log('✅ シフト割り当て保存完了', 'info', { assignmentCount });
            }

            this.log('トランザクション完了');
            return shiftData;
        });
    }
}

module.exports = new ShiftGeneratorService();
