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
        this.geminiModel = 'gemini-2.5-flash';
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
        let currentPrompt = this.buildStrictPrompt(store, staffs, storeClosedDays, storeRequirements, year, month, period);

        while (attempts < maxAttempts) {
            attempts++;

            try {
                const response = await this.callGeminiApi(currentPrompt);

                let generatedShiftData;
                try {
                    generatedShiftData = this.parseGeminiResponse(response);
                } catch (parseError) {

                    if (parseError.message.includes('Unexpected end of JSON input')) {
                        if (attempts < maxAttempts) {
                            currentPrompt = this.buildSimplePrompt(store, staffs, year, month, period);
                            continue;
                        }
                    }
                    throw parseError;
                }

                if (!generatedShiftData || !generatedShiftData.shifts || !Array.isArray(generatedShiftData.shifts)) {
                    throw new Error('生成されたシフトデータの構造が不正です');
                }

                const validationResult = await this.validateGeneratedShift(generatedShiftData, staffs);

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

                if (attempts < maxAttempts) {

                    if (error.message.includes('API')) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                    continue;
                }
            }
        }

        throw lastError || new Error('制約を満たすシフトを生成できませんでした。スタッフの勤務条件を見直してください。');
    }

    buildSimplePrompt(store, staffs, year, month, period) {
        let prompt = `期間: ${period.startDate.format('YYYY-MM-DD')} ～ ${period.endDate.format('YYYY-MM-DD')}
    
    基本ルール:
    - スタッフをシフトに入れる際は、1日の勤務時間が8時間を超えないように、可能な限り長く割り当ててください。
    `;

        staffs.forEach(staff => {
            prompt += `- ID:${staff.id} ${staff.first_name} (1日最大 ${staff.max_hours_per_day || 8}h)\n`;
        });

        prompt += `
    上記ルールに従って、シフトをJSON形式で出力してください。
    重要: 全てのオブジェクトは必ず \`{\` と \`}\` で囲んでください。配列内の各要素がオブジェクトである場合、それぞれを \`{\` と \`}\` で囲む必要があります。
    
    {"shifts":[{"date":"YYYY-MM-DD","assignments":[{"staff_id":1,"start_time":"09:00","end_time":"17:00"}]}]}`;

        return prompt;
    }


    buildStricterPrompt(store, staffs, storeClosedDays, storeRequirements, year, month, period, violations) {
        let prompt = `前回のシフト生成で以下の絶対守るべきルール違反がありました。今度は絶対にルールを守って生成してください。
### 前回の違反内容
${violations.slice(0, 5).join('\n')}

### 絶対厳守ルール
`;

        staffs.forEach(staff => {
            prompt += `
${staff.first_name} ${staff.last_name} (ID: ${staff.id}):
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
        });

        prompt += `

### シフト生成の基本方針
- スタッフをシフトに割り当てる際は、可能な限りそのスタッフの「1日最大勤務時間」に近い時間で割り当てる。
- 月間勤務時間は目安です。

### 期間: ${period.startDate.format('YYYY-MM-DD')} ～ ${period.endDate.format('YYYY-MM-DD')}

前回の違反を修正し、ルールを厳守したシフトをJSON形式で出力してください。
重要: 全てのオブジェクトは必ず \`{\` と \`}\` で囲んでください。配列内の各要素がオブジェクトである場合、それぞれを \`{\` と \`}\` で囲む必要があります。
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
        let prompt = `あなたはシフト管理システムです。以下の条件を厳守してシフトを生成してください。
    
    ## 期間情報
    - 対象期間: ${period.startDate.format('YYYY-MM-DD')} ～ ${period.endDate.format('YYYY-MM-DD')}
    
    ## スタッフ制約（絶対遵守）
    `;

        staffs.forEach(staff => {
            const unavailableDays = staff.dayPreferences?.filter(p => !p.available).map(p => ['日', '月', '火', '水', '木', '金', '土'][p.day_of_week]) || [];
            const dayOffDates = staff.dayOffRequests?.filter(req => req.status === 'approved' || req.status === 'pending').map(req => req.date) || [];

            prompt += `
    【${staff.first_name} ${staff.last_name} (ID: ${staff.id})】
    - 月間時間 (目安): ${staff.min_hours_per_month || 0}-${staff.max_hours_per_month || 160}時間
    - 1日最大勤務時間: ${staff.max_hours_per_day || 8}時間
    - 勤務不可曜日: ${unavailableDays.length > 0 ? unavailableDays.join(',') : 'なし'}
    - 休み希望: ${dayOffDates.length > 0 ? dayOffDates.join(',') : 'なし'}`;
        });

        prompt += `
    
    ## 重要ルール
    1. スタッフをシフトに割り当てる際は、可能な限りそのスタッフの「1日最大勤務時間」に近い時間で割り当てること。
    2. 各日付の人員要件（もしあれば）を満たすことを優先する。
    3. 月間勤務時間は目安とし、多少の過不足は許容する。最終的な調整は人間が行う。
    4. 勤務不可曜日と休み希望日には絶対に割り当てない。
    5. 1日の勤務時間は絶対に「1日最大勤務時間」を超えない。
    
    ## 出力形式
    以下のJSON形式で正確に出力してください。余計な説明は不要です。
    重要: 全てのオブジェクトは必ず \`{\` と \`}\` で囲んでください。配列内の各要素がオブジェクトである場合、それぞれを \`{\` と \`}\` で囲む必要があります。
    
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

    async validateGeneratedShift(shiftData, staffs) {
        const violations = [];
        const warnings = [];
        const staffWorkHours = {};

        if (!shiftData || !shiftData.shifts) {
            return { isValid: false, violations: ['シフトデータが不正です'], warnings: [] };
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

            if (minHours > 0 && totalHours < minHours) {
                const shortage = minHours - totalHours;
                warnings.push(`${staff.first_name} ${staff.last_name}: 月間最小勤務時間不足 (${totalHours.toFixed(1)}h < ${minHours}h, 不足${shortage.toFixed(1)}h)`);
            }

            if (maxHours > 0 && totalHours > maxHours) {
                const excess = totalHours - maxHours;
                warnings.push(`${staff.first_name} ${staff.last_name}: 月間最大勤務時間超過 (${totalHours.toFixed(1)}h > ${maxHours}h, 超過${excess.toFixed(1)}h)`);
            }
        }

        return {
            isValid: violations.length === 0,
            violations,
            warnings
        };
    }

    async callGeminiApi(prompt) {
        const httpsAgent = new https.Agent({ rejectUnauthorized: false });
        const url = `${this.geminiApiUrl}?key=${this.geminiApiKey}`;

        const data = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.2,
                topK: 1,
                topP: 1,
                maxOutputTokens: 65535,
                responseMimeType: "application/json"
            },
            safetySettings: [
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_NONE"
                },
                {
                    category: "HARM_CATEGORY_HATE_SPEECH",
                    threshold: "BLOCK_NONE"
                },
                {
                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold: "BLOCK_NONE"
                },
                {
                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold: "BLOCK_NONE"
                }
            ]
        };

        const config = {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 180000,
            httpsAgent
        };

        try {
            const response = await axios.post(url, data, config);
            return response.data;
        } catch (error) {
            if (error.response?.data) {
                console.error('Gemini API Error:', error.response.data);
            }
            throw error;
        }
    }

    parseGeminiResponse(response) {
        if (!response) {
            throw new Error('Gemini APIからのレスポンスが空です。');
        }

        if (!response.candidates || !Array.isArray(response.candidates) || response.candidates.length === 0) {
            if (response.promptFeedback && response.promptFeedback.blockReason) {
                throw new Error(`リクエストがブロックされました: ${response.promptFeedback.blockReason}`);
            }
            throw new Error('Gemini APIレスポンスにcandidatesが含まれていません。');
        }

        const candidate = response.candidates[0];

        if (candidate.finishReason && candidate.finishReason === 'MAX_TOKENS') {
            console.warn('AIの応答が最大トークン数に達したため、途中で打ち切られた可能性があります。');
        }
        if (candidate.finishReason) {
            console.log(`AI response finishReason: ${candidate.finishReason}`);
        }

        if (!candidate.content || !candidate.content.parts || !Array.isArray(candidate.content.parts) || candidate.content.parts.length === 0) {
            throw new Error('Gemini APIレスポンスに有効なcontentが含まれていません。');
        }

        const content = candidate.content.parts[0];
        if (!content.text) {
            throw new Error('Gemini APIレスポンスに有効なテキストが含まれていません。');
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
            console.log('Gemini Response Text:', content.text);
        }

        jsonString = this.cleanAndRepairJson(jsonString);

        try {
            const parsed = JSON.parse(jsonString);

            if (!parsed.shifts || !Array.isArray(parsed.shifts)) {
                throw new Error('shiftsプロパティが配列ではありません');
            }

            return parsed;
        } catch (error) {
            console.error('JSON Parse Error:', error);
            const lines = jsonString.split('\n');
            lines.forEach((line, index) => {
                console.error(`Line ${index + 1}: ${line}`);
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

            const openBraces = (jsonString.match(/{/g) || []).length;
            const closeBraces = (jsonString.match(/}/g) || []).length;
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