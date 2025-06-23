const axios = require('axios');
const https = require('https');
const {
    Store, Staff, StaffDayPreference, StaffDayOffRequest,
    StoreClosedDay, StoreStaffRequirement, Shift, ShiftAssignment, SystemSetting, sequelize
} = require('../models');
const { Op } = require('sequelize');
const moment = require('moment-timezone');

class ShiftGeneratorService {
    constructor() {
        this.claudeApiKey = process.env.CLAUDE_API_KEY;
        this.claudeModel = 'claude-sonnet-4-20250514';
        this.claudeApiUrl = 'https://api.anthropic.com/v1/messages';
    }

    getShiftPeriod(year, month, closingDay) {
        const targetMonth = moment.tz(`${year}-${String(month).padStart(2, '0')}-01`, "Asia/Tokyo");
        const endDate = targetMonth.date(closingDay).startOf('day');
        const startDate = endDate.clone().subtract(1, 'month').add(1, 'day').startOf('day');
        return { startDate, endDate };
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

            return result;
        } catch (error) {
            console.error('Error calculating staff total hours across all stores:', error);
            throw new Error('Failed to calculate staff total hours.');
        }
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

    buildStrictPrompt(store, staffs, storeClosedDays, storeRequirements, year, month, period) {
        let prompt = `シフト管理システムです。制約を厳格に守ってシフトを生成してください。

期間: ${period.startDate.format('YYYY-MM-DD')} から ${period.endDate.format('YYYY-MM-DD')}

スタッフ制約:
`;

        staffs.forEach(staff => {
            prompt += `ID ${staff.id} (${staff.first_name} ${staff.last_name}): `;
            prompt += `最大${staff.max_hours_per_day || 8}時間/日, `;
            prompt += `月間${staff.min_hours_per_month || 0}-${staff.max_hours_per_month || 160}時間, `;

            const unavailableDays = staff.dayPreferences?.filter(p => !p.available).map(p =>
                ['日', '月', '火', '水', '木', '金', '土'][p.day_of_week]
            ) || [];

            if (unavailableDays.length > 0) {
                prompt += `勤務不可: ${unavailableDays.join(',')}曜日, `;
            }

            const availableDays = staff.dayPreferences?.filter(p => p.available).map(p => {
                const day = ['日', '月', '火', '水', '木', '金', '土'][p.day_of_week];
                return day;
            }) || [];

            prompt += `勤務可能: ${availableDays.join(',')}曜日
`;
        });

        prompt += `
重要ルール:
1. 1日の勤務時間は絶対に各スタッフの上限を超えない
2. 勤務不可曜日には絶対にシフトを組まない
3. 勤務時間は8時間以下にする

以下のJSON形式で出力してください。他の文字は一切含めないでください:

{
  "shifts": [
    {
      "date": "2025-05-26",
      "assignments": [
        {
          "staff_id": 1,
          "start_time": "09:00",
          "end_time": "17:00"
        }
      ]
    }
  ]
}`;

        return prompt;
    }

    async generateShift(storeId, year, month) {
        const store = await Store.findByPk(storeId);
        if (!store) throw new Error('指定された店舗が見つかりません。');

        const settings = await SystemSetting.findOne({ where: { user_id: store.owner_id } });
        const closingDay = settings ? settings.closing_day : 25;

        const period = this.getShiftPeriod(year, month, closingDay);

        const staffs = await Staff.findAll({
            where: { [Op.or]: [{ store_id: storeId }, { id: { [Op.in]: sequelize.literal(`(SELECT staff_id FROM staff_stores WHERE store_id = ${storeId})`) } }] },
            include: [
                { model: StaffDayPreference, as: 'dayPreferences' },
                {
                    model: StaffDayOffRequest,
                    as: 'dayOffRequests',
                    where: { date: { [Op.between]: [period.startDate.format('YYYY-MM-DD'), period.endDate.format('YYYY-MM-DD')] } },
                    required: false
                }
            ]
        });

        if (staffs.length === 0) throw new Error('この店舗にアクティブなスタッフがいません。');

        const storeClosedDays = await StoreClosedDay.findAll({ where: { store_id: storeId } });
        const storeRequirements = await StoreStaffRequirement.findAll({ where: { store_id: storeId } });

        let prompt = this.buildStrictPrompt(store, staffs, storeClosedDays, storeRequirements, year, month, period);

        console.log("=========================================");
        console.log("========= Simplified Prompt =========");
        console.log(prompt);
        console.log("=========================================");

        let attempts = 0;
        const maxAttempts = 3;
        let lastError = null;

        while (attempts < maxAttempts) {
            attempts++;
            console.log(`AI生成試行 ${attempts}/${maxAttempts}`);

            try {
                const response = await this.callClaudeApi(prompt);
                const generatedShiftData = this.parseClaudeResponse(response);

                const validationResult = await this.validateGeneratedShift(generatedShiftData, staffs, period);

                if (validationResult.isValid) {
                    console.log('✅ 生成されたシフトは全ての制約を満たしています');
                    return this.saveShift(generatedShiftData, storeId, year, month);
                } else {
                    console.log('❌ 生成されたシフトに制約違反があります:', validationResult.violations.slice(0, 5));
                    lastError = new Error(`制約違反: ${validationResult.violations.slice(0, 3).join(', ')}`);

                    if (attempts < maxAttempts) {
                        console.log('より厳格なプロンプトで再生成します...');
                        // プロンプトをより厳しく調整
                        prompt = this.buildStricterPrompt(store, staffs, storeClosedDays, storeRequirements, year, month, period, validationResult.violations);
                        continue;
                    }
                }
            } catch (error) {
                console.error(`試行 ${attempts} でエラー:`, error.message);
                lastError = error;

                if (attempts < maxAttempts) {
                    console.log('再生成を試行します...');
                    continue;
                }
            }
        }

        throw lastError || new Error('最大試行回数に達しました。制約を満たすシフトを生成できませんでした。');
    }

    buildStricterPrompt(store, staffs, storeClosedDays, storeRequirements, year, month, period, violations) {
        let prompt = `前回のシフト生成で制約違反が発生しました。今度は絶対に制約を守ってください。

### 前回の違反内容
${violations.slice(0, 5).join('\n')}

### 絶対厳守ルール
`;

        staffs.forEach(staff => {
            prompt += `
${staff.first_name} ${staff.last_name} (ID: ${staff.id}):
- 1日は絶対に${staff.max_hours_per_day || 8}時間以下
- 月間は絶対に${staff.max_hours_per_month || 160}時間以下`;

            const unavailableDays = staff.dayPreferences?.filter(p => !p.available).map(p =>
                ['日', '月', '火', '水', '木', '金', '土'][p.day_of_week]
            ) || [];

            if (unavailableDays.length > 0) {
                prompt += `
- ${unavailableDays.join(', ')}曜日は絶対に勤務させない`;
            }
        });

        prompt += `

### 期間: ${period.startDate.format('YYYY-MM-DD')} ～ ${period.endDate.format('YYYY-MM-DD')}

制約を絶対に守って、より保守的なシフトを作成してください。
勤務時間は6-8時間以内に抑えてください。

\`\`\`json
{
  "shifts": [
    {
      "date": "YYYY-MM-DD", 
      "assignments": [
        {
          "staff_id": スタッフID,
          "start_time": "HH:MM",
          "end_time": "HH:MM"
        }
      ]
    }
  ]
}
\`\`\``;

        return prompt;
    }

    async validateGeneratedShift(shiftData, staffs, period) {
        const violations = [];
        const staffWorkHours = {};
        const staffWorkDays = {};

        if (!shiftData || !shiftData.shifts) {
            return { isValid: false, violations: ['シフトデータが不正です'] };
        }

        for (const dayShift of shiftData.shifts) {
            const date = dayShift.date;
            const dayOfWeek = new Date(date).getDay();

            if (!dayShift.assignments) continue;

            for (const assignment of dayShift.assignments) {
                const staffId = assignment.staff_id;
                const staff = staffs.find(s => s.id === staffId);

                if (!staff) {
                    violations.push(`存在しないスタッフID: ${staffId}`);
                    continue;
                }

                const validation = this.validateStaffConstraints(staff, date, assignment.start_time, assignment.end_time);
                if (validation.errors.length > 0) {
                    violations.push(`${staff.first_name} ${staff.last_name} (${date}): ${validation.errors.join(', ')}`);
                }

                if (!staffWorkHours[staffId]) {
                    staffWorkHours[staffId] = 0;
                    staffWorkDays[staffId] = [];
                }

                const workMinutes = this.calculateWorkMinutes(assignment.start_time, assignment.end_time);
                staffWorkHours[staffId] += workMinutes;
                staffWorkDays[staffId].push(date);
            }
        }

        for (const staff of staffs) {
            const staffId = staff.id;
            const totalHours = (staffWorkHours[staffId] || 0) / 60;

            if (staff.min_hours_per_month && totalHours < staff.min_hours_per_month) {
                violations.push(`${staff.first_name} ${staff.last_name}: 月間最小勤務時間不足 (${totalHours.toFixed(1)}h < ${staff.min_hours_per_month}h)`);
            }

            if (staff.max_hours_per_month && totalHours > staff.max_hours_per_month) {
                violations.push(`${staff.first_name} ${staff.last_name}: 月間最大勤務時間超過 (${totalHours.toFixed(1)}h > ${staff.max_hours_per_month}h)`);
            }

            const workDays = staffWorkDays[staffId] || [];
            if (workDays.length > 0) {
                const consecutiveDays = this.calculateMaxConsecutiveDays(workDays);
                const maxConsecutive = staff.max_consecutive_days || 5;

                if (consecutiveDays > maxConsecutive) {
                    violations.push(`${staff.first_name} ${staff.last_name}: 最大連続勤務日数超過 (${consecutiveDays}日 > ${maxConsecutive}日)`);
                }
            }
        }

        return {
            isValid: violations.length === 0,
            violations
        };
    }

    calculateMaxConsecutiveDays(workDays) {
        if (workDays.length === 0) return 0;

        const sortedDays = workDays.sort();
        let maxConsecutive = 1;
        let currentConsecutive = 1;

        for (let i = 1; i < sortedDays.length; i++) {
            const prevDate = new Date(sortedDays[i - 1]);
            const currentDate = new Date(sortedDays[i]);
            const diffDays = (currentDate - prevDate) / (1000 * 60 * 60 * 24);

            if (diffDays === 1) {
                currentConsecutive++;
                maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
            } else {
                currentConsecutive = 1;
            }
        }

        return maxConsecutive;
    }

    async callClaudeApi(prompt) {
        const httpsAgent = new https.Agent({ rejectUnauthorized: false });
        const url = this.claudeApiUrl;

        const data = {
            model: this.claudeModel,
            max_tokens: 4096,
            temperature: 0.2,
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ]
        };

        const config = {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.claudeApiKey,
                'anthropic-version': '2023-06-01'
            },
            timeout: 180000,
            httpsAgent
        };

        try {
            const response = await axios.post(url, data, config);
            console.log('Claude API 呼び出し成功');
            return response.data;
        } catch (error) {
            console.error('Claude API エラー:', error.response?.status, error.response?.statusText);
            if (error.response?.data) {
                console.error('Claude API エラー詳細:', JSON.stringify(error.response.data, null, 2));
            }
            throw error;
        }
    }

    parseClaudeResponse(response) {
        console.log('Claude APIレスポンス解析開始');

        // レスポンス構造の詳細チェック
        if (!response) {
            console.error('レスポンスがnullまたはundefined');
            throw new Error('Claude APIからのレスポンスが空です。');
        }

        if (!response.content || !Array.isArray(response.content) || response.content.length === 0) {
            console.error('content配列が存在しないか空:', response);
            throw new Error('Claude APIレスポンスにcontentが含まれていません。');
        }

        const content = response.content[0];
        if (!content.text) {
            console.error('textが存在しない:', content);
            throw new Error('Claude APIレスポンスに有効なテキストが含まれていません。');
        }

        let jsonString = content.text;
        console.log('元のレスポンステキスト長:', jsonString.length);
        console.log('レスポンステキストの最初の200文字:', jsonString.substring(0, 200));

        // 複数のJSONブロック抽出パターンを試す
        let extractedJson = null;

        // パターン1: ```json...```
        let match = jsonString.match(/```json\s*\n([\s\S]*?)\n\s*```/);
        if (match && match[1]) {
            extractedJson = match[1];
            console.log('パターン1でJSON抽出成功');
        }

        // パターン2: ```...```（jsonタグなし）
        if (!extractedJson) {
            match = jsonString.match(/```\s*\n([\s\S]*?)\n\s*```/);
            if (match && match[1] && match[1].trim().startsWith('{')) {
                extractedJson = match[1];
                console.log('パターン2でJSON抽出成功');
            }
        }

        // パターン3: 直接JSONを探す
        if (!extractedJson) {
            match = jsonString.match(/\{[\s\S]*\}/);
            if (match) {
                extractedJson = match[0];
                console.log('パターン3でJSON抽出成功');
            }
        }

        if (extractedJson) {
            jsonString = extractedJson;
        } else {
            console.log('JSONブロックが見つからない、元のテキストをそのまま使用');
        }

        // JSONクリーニング
        jsonString = jsonString.trim();

        // 末尾のカンマを削除
        jsonString = jsonString.replace(/,\s*([}\]])/g, '$1');

        // 重複する括弧やブレースを削除
        jsonString = jsonString.replace(/\}\s*\}\s*$/, '}');
        jsonString = jsonString.replace(/^\s*\{\s*\{/, '{');

        console.log('クリーニング後のJSON文字列長:', jsonString.length);
        console.log('クリーニング後のJSON最初の200文字:', jsonString.substring(0, 200));

        try {
            const parsed = JSON.parse(jsonString);
            console.log(`シフト生成結果: ${parsed.shifts?.length || 0}日分のシフト`);

            // 基本的な構造チェック
            if (!parsed.shifts || !Array.isArray(parsed.shifts)) {
                throw new Error('shiftsプロパティが配列ではありません');
            }

            return parsed;
        } catch (error) {
            console.error("JSON解析エラー:", error.message);
            console.error("解析対象のJSON文字列:");
            console.error(jsonString);

            // より詳細なエラー情報を提供
            const lines = jsonString.split('\n');
            lines.forEach((line, index) => {
                console.error(`${index + 1}: ${line}`);
            });

            throw new Error(`AIからの応答をJSONとして解析できませんでした: ${error.message}`);
        }
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
                console.log(`保存完了: ${assignmentCount}件のシフト割り当て`);
            }
            return shiftData;
        });
    }
}

module.exports = new ShiftGeneratorService();