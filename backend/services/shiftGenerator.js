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
        this.geminiApiKey = process.env.GEMINI_API_KEY;
        this.geminiModel = 'gemini-1.5-pro-latest';
        this.geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent`;
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
        let prompt = `あなたは、労働基準法と個人の制約を厳格に遵守するシフト管理AIです。以下のルールは絶対に破ってはいけません。

### 🚨 絶対遵守ルール（違反は一切許可されません）
1. **スタッフの「勤務不可曜日」には絶対にシフトを割り当てない**
2. **スタッフの「休み希望日」には絶対にシフトを割り当てない**
3. **スタッフの「1日最大勤務時間」を絶対に超過しない**
4. **スタッフの「月間最大勤務時間」を絶対に超過しない**
5. **スタッフの「最大連続勤務日数」を絶対に超過しない**

### 📋 生成対象期間
- 期間: ${period.startDate.format('YYYY-MM-DD')} ～ ${period.endDate.format('YYYY-MM-DD')}
- 店舗: ${store.name}
- 営業時間: ${store.opening_time} - ${store.closing_time}

### 👥 スタッフ制約条件（絶対遵守）
`;

        staffs.forEach(staff => {
            prompt += `
**${staff.first_name} ${staff.last_name} (ID: ${staff.id})**
- 月間勤務時間制限: 最低${staff.min_hours_per_month || 0}時間 ～ 最大${staff.max_hours_per_month || 999}時間（絶対遵守）
- 1日最大勤務時間: ${staff.max_hours_per_day || 8}時間（絶対遵守）
- 最大連続勤務日数: ${staff.max_consecutive_days || 5}日（絶対遵守）`;

            const dayOffs = staff.dayOffRequests?.map(r => r.date).join(', ') || 'なし';
            prompt += `
- 休み希望日: ${dayOffs}（絶対に割り当て禁止）`;

            const unavailableDays = staff.dayPreferences?.filter(p => !p.available).map(p =>
                ['日', '月', '火', '水', '木', '金', '土'][p.day_of_week]
            ).join(', ') || 'なし';
            prompt += `
- 勤務不可曜日: ${unavailableDays}（絶対に割り当て禁止）`;

            const availableDays = staff.dayPreferences?.filter(p => p.available).map(p => {
                const day = ['日', '月', '火', '水', '木', '金', '土'][p.day_of_week];
                const time = (p.preferred_start_time && p.preferred_end_time) ?
                    ` (希望時間: ${p.preferred_start_time.slice(0, 5)}-${p.preferred_end_time.slice(0, 5)})` : '';
                return day + time;
            }).join(', ') || '制限なし';
            prompt += `
- 勤務可能曜日: ${availableDays}
`;
        });

        prompt += `
### 🏪 店舗定休日
`;
        if (storeClosedDays.length > 0) {
            storeClosedDays.forEach(day => {
                prompt += `- ${day.specific_date || '毎週' + ['日', '月', '火', '水', '木', '金', '土'][day.day_of_week] + '曜日'}\n`;
            });
        } else {
            prompt += `- なし\n`;
        }

        prompt += `
### 👥 店舗の人員要件（参考・努力目標）
`;
        if (storeRequirements.length > 0) {
            storeRequirements.forEach(req => {
                const day = req.specific_date ? req.specific_date : `毎週${['日', '月', '火', '水', '木', '金', '土'][req.day_of_week]}曜日`;
                prompt += `- ${day} ${req.start_time.slice(0, 5)}-${req.end_time.slice(0, 5)}: ${req.required_staff_count}人（可能な範囲で）\n`;
            });
        } else {
            prompt += `- 全時間帯で1人以上（可能な範囲で）\n`;
        }

        prompt += `
### ⚠️ 重要な注意事項
- 上記のスタッフ制約は絶対に守ってください
- 人員要件は努力目標です。スタッフ制約を破ってまで満たす必要はありません
- 勤務不可曜日や休み希望日への割り当ては絶対に行わないでください
- 各スタッフの最大勤務時間を絶対に超過しないでください

### 📄 出力形式（この形式以外は受け付けません）
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
\`\`\`

制約を守りつつ、可能な限り良いシフトを生成してください。`;

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

        const prompt = this.buildStrictPrompt(store, staffs, storeClosedDays, storeRequirements, year, month, period);

        console.log("=========================================");
        console.log("========= Enhanced Strict Prompt =========");
        console.log(prompt);
        console.log("=========================================");

        let attempts = 0;
        const maxAttempts = 3;
        let lastError = null;

        while (attempts < maxAttempts) {
            attempts++;
            console.log(`AI生成試行 ${attempts}/${maxAttempts}`);

            try {
                const response = await this.callGeminiApi(prompt);
                const generatedShiftData = this.parseGeminiResponse(response);

                const validationResult = await this.validateGeneratedShift(generatedShiftData, staffs, period);

                if (validationResult.isValid) {
                    console.log('✅ 生成されたシフトは全ての制約を満たしています');
                    return this.saveShift(generatedShiftData, storeId, year, month);
                } else {
                    console.log('❌ 生成されたシフトに制約違反があります:', validationResult.violations);
                    lastError = new Error(`制約違反: ${validationResult.violations.join(', ')}`);

                    if (attempts < maxAttempts) {
                        console.log('再生成を試行します...');
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

    async callGeminiApi(prompt) {
        const httpsAgent = new https.Agent({ rejectUnauthorized: false });
        const url = `${this.geminiApiUrl}?key=${this.geminiApiKey}`;
        const data = { contents: [{ parts: [{ text: prompt }] }] };
        const config = { headers: { 'Content-Type': 'application/json' }, timeout: 120000, httpsAgent };
        const response = await axios.post(url, data, config);
        return response.data;
    }

    parseGeminiResponse(response) {
        if (!response || !response.candidates || !response.candidates[0].content || !response.candidates[0].content.parts) {
            throw new Error('Gemini APIからのレスポンス形式が不正です。');
        }
        let jsonString = response.candidates[0].content.parts[0].text;
        const match = jsonString.match(/```json\n([\s\S]*)\n```/);
        if (match && match[1]) {
            jsonString = match[1];
        }

        jsonString = jsonString.replace(/,\s*([}\]])/g, '$1');

        try {
            return JSON.parse(jsonString);
        } catch (error) {
            console.error("Failed to parse cleaned JSON:", error);
            console.error("Cleaned JSON string:", jsonString);
            throw new Error('AIからの応答をJSONとして解析できませんでした。');
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
                        }
                    }
                }
            }
            return shiftData;
        });
    }
}

module.exports = new ShiftGeneratorService();