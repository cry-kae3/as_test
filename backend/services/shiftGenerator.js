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
        this.claudeModel = 'claude-3-5-sonnet-20240620';
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

    async generateShift(storeId, year, month) {
        const store = await Store.findByPk(storeId);
        if (!store) throw new Error('指定された店舗が見つかりません。');

        const settings = await SystemSetting.findOne({ where: { user_id: store.owner_id } });
        const closingDay = settings ? settings.closing_day : 25;
        const autoSetBreakTime = settings?.additional_settings?.auto_set_break_time !== false;

        const period = this.getShiftPeriod(year, month, closingDay);

        const staffs = await Staff.findAll({
            include: [
                {
                    model: Store,
                    as: 'stores',
                    where: { id: storeId },
                    attributes: [],
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

        if (staffs.length === 0) throw new Error('この店舗にアクティブなスタッフがいません。');

        const storeClosedDays = await StoreClosedDay.findAll({ where: { store_id: storeId } });
        const storeRequirements = await StoreStaffRequirement.findAll({ where: { store_id: storeId } });

        let attempts = 0;
        const maxAttempts = 3;
        let lastError = null;
        let currentPrompt = this.buildOverworkPermissivePrompt(store, staffs, storeClosedDays, storeRequirements, year, month, period);

        while (attempts < maxAttempts) {
            attempts++;

            try {
                const response = await this.callClaudeApi(currentPrompt);
                let generatedShiftData = this.parseClaudeResponse(response);

                if (!generatedShiftData || !generatedShiftData.shifts || !Array.isArray(generatedShiftData.shifts)) {
                    throw new Error('生成されたシフトデータの構造が不正です');
                }

                generatedShiftData = this.adjustOvertimeHours(generatedShiftData, staffs);

                if (autoSetBreakTime) {
                    generatedShiftData = this.addBreaksToGeneratedShift(generatedShiftData);
                }

                const validationResult = await this.validateGeneratedShift(generatedShiftData, staffs, period);

                if (validationResult.isValid) {
                    return this.saveShift(generatedShiftData, storeId, year, month);
                } else {
                    lastError = new Error(`制約違反: ${validationResult.violations.slice(0, 3).join(', ')}`);
                    if (attempts < maxAttempts) {
                        currentPrompt = this.buildStricterPrompt(store, staffs, storeClosedDays, storeRequirements, year, month, period, validationResult.violations);
                        continue;
                    }
                }
            } catch (error) {
                lastError = error;
                if (error.message.includes('Unexpected end of JSON input') && attempts < maxAttempts) {
                    currentPrompt = this.buildSimplePrompt(store, staffs, year, month, period);
                    continue;
                }
                if (error.message.includes('API') && attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    continue;
                }
            }
        }

        throw lastError || new Error('制約を満たすシフトを生成できませんでした。スタッフの勤務条件を見直してください。');
    }

    addBreaksToGeneratedShift(generatedShiftData) {
        generatedShiftData.shifts.forEach(dayShift => {
            dayShift.assignments.forEach(assignment => {
                const workMinutes = this.calculateWorkMinutes(assignment.start_time, assignment.end_time);
                const workHours = workMinutes / 60;
                let breakMinutes = 0;

                if (workHours > 8) {
                    breakMinutes = 60;
                } else if (workHours > 6) {
                    breakMinutes = 45;
                }

                if (breakMinutes > 0) {
                    const shiftStart = moment(assignment.start_time, 'HH:mm');
                    const shiftDuration = workMinutes;

                    const breakStartTime = shiftStart.clone().add(Math.floor((shiftDuration - breakMinutes) / 2), 'minutes');

                    assignment.break_start_time = breakStartTime.format('HH:mm');
                    assignment.break_end_time = breakStartTime.clone().add(breakMinutes, 'minutes').format('HH:mm');
                } else {
                    assignment.break_start_time = null;
                    assignment.break_end_time = null;
                }
            });
        });
        return generatedShiftData;
    }

    adjustOvertimeHours(generatedShiftData, staffs) {
        const staffWorkDetails = {};
        const dailyAssignments = {};

        generatedShiftData.shifts.forEach(dayShift => {
            dailyAssignments[dayShift.date] = dayShift.assignments.length;
            dayShift.assignments.forEach(assignment => {
                if (!staffWorkDetails[assignment.staff_id]) {
                    const staffInfo = staffs.find(s => s.id === assignment.staff_id);
                    staffWorkDetails[assignment.staff_id] = {
                        totalMinutes: 0,
                        shifts: [],
                        maxHours: staffInfo ? staffInfo.max_hours_per_month || Infinity : Infinity,
                    };
                }
                const workMinutes = this.calculateWorkMinutes(assignment.start_time, assignment.end_time);
                staffWorkDetails[assignment.staff_id].totalMinutes += workMinutes;
                staffWorkDetails[assignment.staff_id].shifts.push({ ...assignment, date: dayShift.date, workMinutes });
            });
        });

        Object.keys(staffWorkDetails).forEach(staffId => {
            const staffDetail = staffWorkDetails[staffId];
            let overtimeMinutes = staffDetail.totalMinutes - (staffDetail.maxHours * 60);

            if (overtimeMinutes > 0) {
                staffDetail.shifts.sort((a, b) => {
                    const staffCountA = dailyAssignments[a.date] || 0;
                    const staffCountB = dailyAssignments[b.date] || 0;
                    if (staffCountA !== staffCountB) {
                        return staffCountB - staffCountA;
                    }
                    return a.workMinutes - b.workMinutes;
                });

                for (const shiftToRemove of staffDetail.shifts) {
                    if (overtimeMinutes <= 0) break;

                    const dayShift = generatedShiftData.shifts.find(ds => ds.date === shiftToRemove.date);
                    if (dayShift) {
                        const assignmentIndex = dayShift.assignments.findIndex(a =>
                            a.staff_id == staffId &&
                            a.start_time === shiftToRemove.start_time &&
                            a.end_time === shiftToRemove.end_time
                        );

                        if (assignmentIndex !== -1) {
                            dayShift.assignments.splice(assignmentIndex, 1);
                            overtimeMinutes -= shiftToRemove.workMinutes;
                            dailyAssignments[shiftToRemove.date]--;
                        }
                    }
                }
            }
        });

        return generatedShiftData;
    }

    buildOverworkPermissivePrompt(store, staffs, storeClosedDays, storeRequirements, year, month, period) {
        let prompt = `あなたはシフト管理システムです。以下の条件に従ってシフトを生成してください。

## 期間情報
- 対象期間: ${period.startDate.format('YYYY-MM-DD')} ～ ${period.endDate.format('YYYY-MM-DD')}

## スタッフ制約
`;
        staffs.forEach(staff => {
            const unavailableDays = staff.dayPreferences?.filter(p => !p.available).map(p => ['日', '月', '火', '水', '木', '金', '土'][p.day_of_week]) || [];
            const dayOffDates = staff.dayOffRequests?.filter(req => req.status === 'approved' || req.status === 'pending').map(req => req.date) || [];

            prompt += `
【${staff.first_name} ${staff.last_name} (ID: ${staff.id})】
- 1日最大勤務時間: ${staff.max_hours_per_day || 8}時間 (絶対遵守)
- 月間勤務時間目安: ${staff.min_hours_per_month || 0}-${staff.max_hours_per_month || 160}時間 (超過しても良いが、なるべく範囲内に)
- 勤務不可曜日: ${unavailableDays.length > 0 ? unavailableDays.join(',') : 'なし'} (絶対遵守)
- 休み希望日: ${dayOffDates.length > 0 ? dayOffDates.join(',') : 'なし'} (絶対遵守)
`;
        });

        prompt += `
## 重要ルール
1. **1日の勤務時間は、各スタッフの1日最大勤務時間を超えない範囲で、可能な限り長く割り当ててください。**
2. 勤務不可曜日と休み希望日には、絶対にシフトを割り当てないでください。
3. 休憩時間はこちらで設定するため、考慮する必要はありません。
4. 月間勤務時間は目安です。多少超過しても構いませんが、できるだけ範囲内に収めてください。

## 出力形式
以下のJSON形式で正確に出力してください。余計な説明は不要です。

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
\`\`\``;
        return prompt;
    }

    buildSimplePrompt(store, staffs, year, month, period) {
        let prompt = `期間: ${period.startDate.format('YYYY-MM-DD')} ～ ${period.endDate.format('YYYY-MM-DD')}
    
    スタッフ制約:
    `;

        staffs.forEach(staff => {
            prompt += `ID:${staff.id} ${staff.first_name}: 月間${staff.min_hours_per_month || 0}-${staff.max_hours_per_month || 160}h, 1日最大${staff.max_hours_per_day || 8}h\n`;
        });

        prompt += `
    シンプルなシフトをJSON形式で出力:
    
    {"shifts":[{"date":"YYYY-MM-DD","assignments":[{"staff_id":1,"start_time":"09:00","end_time":"17:00"}]}]}`;

        return prompt;
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


    buildStrictPrompt(store, staffs, storeClosedDays, storeRequirements, year, month, period) {
        const analysis = this.calculateStaffConstraints(staffs, period);

        let prompt = `あなたはシフト管理システムです。以下の条件を厳守してシフトを生成してください。
    
    ## 期間情報
    - 対象期間: ${period.startDate.format('YYYY-MM-DD')} ～ ${period.endDate.format('YYYY-MM-DD')}
    - 総日数: ${analysis.totalDays}日間
    
    ## スタッフ制約（絶対遵守）
    `;

        staffs.forEach(staff => {
            const staffAnalysis = analysis.staff[staff.id];
            const unavailableDays = staff.dayPreferences?.filter(p => !p.available).map(p => ['日', '月', '火', '水', '木', '金', '土'][p.day_of_week]) || [];
            const dayOffDates = staff.dayOffRequests?.filter(req => req.status === 'approved' || req.status === 'pending').map(req => req.date) || [];

            prompt += `
    【${staff.first_name} ${staff.last_name} (ID: ${staff.id})】
    - 月間時間: ${staff.min_hours_per_month || 0}-${staff.max_hours_per_month || 160}時間
    - 1日最大: ${staff.max_hours_per_day || 8}時間
    - 勤務不可曜日: ${unavailableDays.length > 0 ? unavailableDays.join(',') : 'なし'}
    - 休み希望: ${dayOffDates.length > 0 ? dayOffDates.join(',') : 'なし'}
    - 推奨1日時間: ${staffAnalysis.recommendedDailyHours}時間`;
        });

        prompt += `
    
    ## 重要ルール
    1. 各スタッフの月間時間は必ず上記範囲内に収める
    2. 1日の勤務時間は絶対に最大時間を超えない  
    3. 勤務不可曜日には絶対に割り当てない
    4. 休み希望日には絶対に割り当てない
    5. 推奨時間を基準に均等配分する
    
    ## 出力形式
    以下のJSON形式で正確に出力してください。余計な説明は不要です。
    
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
    }`;

        return prompt;
    }

    calculateStaffConstraints(staffs, period) {
        const startDate = period.startDate.toDate();
        const endDate = period.endDate.toDate();
        const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

        const analysis = {
            totalDays,
            staff: {}
        };

        staffs.forEach(staff => {
            let workableDays = 0;
            const availableDayOfWeeks = staff.dayPreferences
                ?.filter(p => p.available)
                .map(p => p.day_of_week) || [];

            for (let i = 0; i < totalDays; i++) {
                const checkDate = new Date(startDate);
                checkDate.setDate(checkDate.getDate() + i);
                const dayOfWeek = checkDate.getDay();

                if (availableDayOfWeeks.includes(dayOfWeek)) {
                    const dateStr = checkDate.toISOString().split('T')[0];
                    const hasDayOff = staff.dayOffRequests?.some(req =>
                        req.date === dateStr && (req.status === 'approved' || req.status === 'pending')
                    );

                    if (!hasDayOff) {
                        workableDays++;
                    }
                }
            }

            const minHours = staff.min_hours_per_month || 0;
            const maxHours = staff.max_hours_per_month || 160;
            const maxDailyHours = staff.max_hours_per_day || 8;

            const targetHours = (minHours + maxHours) / 2;
            const recommendedDailyHours = Math.min(
                Math.ceil((targetHours / workableDays) * 4) / 4,
                maxDailyHours
            );

            const maxPossibleHours = workableDays * maxDailyHours;
            const isMinAchievable = minHours <= maxPossibleHours;

            let strategy;
            if (!isMinAchievable) {
                strategy = `⚠️ 最小時間${minHours}hは物理的に不可能（最大可能: ${maxPossibleHours}h）`;
            } else if (recommendedDailyHours * workableDays < minHours) {
                const extraHoursNeeded = minHours - (recommendedDailyHours * workableDays);
                const daysNeedingExtra = Math.ceil(extraHoursNeeded / (maxDailyHours - recommendedDailyHours));
                strategy = `${recommendedDailyHours}h/日を基本とし、${daysNeedingExtra}日間は${maxDailyHours}h勤務`;
            } else {
                strategy = `${recommendedDailyHours}h/日で均等配分`;
            }

            const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
            const availableDaysText = availableDayOfWeeks.map(d => dayNames[d]).join(',') || 'なし';
            const unavailableDaysText = [0, 1, 2, 3, 4, 5, 6]
                .filter(d => !availableDayOfWeeks.includes(d))
                .map(d => dayNames[d]).join(',') || 'なし';

            analysis.staff[staff.id] = {
                workableDays,
                recommendedDailyHours,
                maxPossibleHours,
                isMinAchievable,
                strategy,
                availableDaysText,
                unavailableDaysText
            };
        });

        return analysis;
    }

    async validateGeneratedShift(shiftData, staffs, period) {
        const violations = [];
        const staffWorkHours = {};

        const analysis = this.calculateStaffConstraints(staffs, period);

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

                const availableDays = staff.dayPreferences?.filter(p => p.available).map(p => p.day_of_week) || [];
                if (!availableDays.includes(dayOfWeek)) {
                    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
                    violations.push(`${staff.first_name} ${staff.last_name} (${date}): ${dayNames[dayOfWeek]}曜日は勤務不可`);
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

            if (minHours > 0 && totalHours < minHours) {
                const shortage = minHours - totalHours;
                violations.push(`${staff.first_name} ${staff.last_name}: 月間最小勤務時間不足 (${totalHours.toFixed(1)}h < ${minHours}h, 不足${shortage.toFixed(1)}h)`);
            }

            if (maxHours > 0 && totalHours > maxHours) {
                const excess = totalHours - maxHours;
                violations.push(`${staff.first_name} ${staff.last_name}: 月間最大勤務時間超過 (${totalHours.toFixed(1)}h > ${maxHours}h, 超過${excess.toFixed(1)}h)`);
            }
        }

        return {
            isValid: violations.length === 0,
            violations,
            analysis
        };
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
            return response.data;
        } catch (error) {
            if (error.response?.data) {
            }
            throw error;
        }
    }

    parseClaudeResponse(response) {

        if (!response) {
            throw new Error('Claude APIからのレスポンスが空です。');
        }

        if (!response.content || !Array.isArray(response.content) || response.content.length === 0) {
            throw new Error('Claude APIレスポンスにcontentが含まれていません。');
        }

        const content = response.content[0];
        if (!content.text) {
            throw new Error('Claude APIレスポンスに有効なテキストが含まれていません。');
        }

        let jsonString = content.text;

        let extractedJson = null;

        let match = jsonString.match(/```json\s*\n([\s\S]*?)\n\s*```/);
        if (match && match[1]) {
            extractedJson = match[1];
        }

        if (!extractedJson) {
            match = jsonString.match(/```\s*\n([\s\S]*?)\n\s*```/);
            if (match && match[1] && match[1].trim().startsWith('{')) {
                extractedJson = match[1];
            }
        }

        if (!extractedJson) {
            match = jsonString.match(/\{[\s\S]*\}/);
            if (match) {
                extractedJson = match[0];
            }
        }

        if (extractedJson) {
            jsonString = extractedJson;
        } else {
        }

        jsonString = this.cleanAndRepairJson(jsonString);


        try {
            const parsed = JSON.parse(jsonString);

            if (!parsed.shifts || !Array.isArray(parsed.shifts)) {
                throw new Error('shiftsプロパティが配列ではありません');
            }

            return parsed;
        } catch (error) {

            const lines = jsonString.split('\n');
            lines.forEach((line, index) => {
            });

            throw new Error(`AIからの応答をJSONとして解析できませんでした: ${error.message}`);
        }
    }

    cleanAndRepairJson(jsonString) {
        jsonString = jsonString.trim();

        jsonString = jsonString.replace(/,\s*([}\]])/g, '$1');

        jsonString = jsonString.replace(/\}\s*\}\s*$/, '}');
        jsonString = jsonString.replace(/^\s*\{\s*\{/, '{');

        if (!jsonString.endsWith('}')) {

            const openBraces = (jsonString.match(/\{/g) || []).length;
            const closeBraces = (jsonString.match(/\}/g) || []).length;
            const openBrackets = (jsonString.match(/\[/g) || []).length;
            const closeBrackets = (jsonString.match(/\]/g) || []).length;

            let missingCloseBrackets = openBrackets - closeBrackets;
            let missingCloseBraces = openBraces - closeBraces;

            const lastCompleteEntry = this.findLastCompleteEntry(jsonString);
            if (lastCompleteEntry) {
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
                                break_start_time: assignment.break_start_time,
                                break_end_time: assignment.break_end_time,
                            }, { transaction: t });
                            assignmentCount++;
                        }
                    }
                }
            }
            return shiftData;
        });
    }
}

module.exports = new ShiftGeneratorService();