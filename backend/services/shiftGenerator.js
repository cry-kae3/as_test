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

    buildPrompt(store, staffs, storeClosedDays, storeRequirements, year, month, period) {
        let prompt = `あなたは、スタッフの労働条件を最優先する、非常に有能なシフト管理AIです。以下のルール階層を厳密に守り、${period.startDate.format('YYYY年M月D日')}から${period.endDate.format('YYYY年M月D日')}までのシフトをJSON形式で一度に生成してください。\n\n`;
        prompt += `### ルール階層（上にあるほど優先度が高い）\n`;
        prompt += `1. **レベル1：絶対遵守ルール（最優先）**\n`;
        prompt += `   - スタッフ個人の「休み希望日」と「勤務不可曜日」には、絶対にシフトを割り当てないでください。\n`;
        prompt += `   - スタッフ個人の「1日の最大勤務時間」「月間勤務時間制約」の制約を必ず守ってください。\n\n`;
        prompt += `2. **レベル2：努力目標**\n`;
        prompt += `   - レベル1のルールを守った上で、スタッフの「希望時間」内にシフトを割り当てるように最大限努力してください。\n\n`;
        prompt += `3. **レベル3：任意目標（優先度：低）**\n`;
        prompt += `   - 上記の全ルールを守った上で、もし余裕があれば、店舗の「最低要員要件」を満たしてください。この目標は、スタッフのルールを破ってまで達成する必要は全くありません。\n\n`;
        prompt += `--- 以下、シフト生成に必要なデータです ---\n\n`;
        prompt += `### 店舗・期間情報\n`;
        prompt += `- 店舗名: ${store.name}\n`;
        prompt += `- 対象期間: ${period.startDate.format('YYYY-MM-DD')} ～ ${period.endDate.format('YYYY-MM-DD')}\n`;
        prompt += `- 営業時間: ${store.opening_time} - ${store.closing_time}\n\n`;
        prompt += `### スタッフ情報と制約条件\n`;
        staffs.forEach(staff => {
            prompt += `- ID: ${staff.id}, 名前: ${staff.first_name} ${staff.last_name}\n`;
            prompt += `  - 月間勤務時間制約: ${staff.min_hours_per_month || 0}時間 ～ ${staff.max_hours_per_month || 999}時間\n`;
            prompt += `  - 1日の最大勤務時間: ${staff.max_hours_per_day || '未設定'}時間\n`;
            const dayOffs = staff.dayOffRequests.map(r => r.date).join(', ');
            prompt += `  - 休み希望日: ${dayOffs || 'なし'}\n`;
            const dayPrefs = staff.dayPreferences.map(p => {
                const day = ['日', '月', '火', '水', '木', '金', '土'][p.day_of_week];
                if (!p.available) return `${day}(不可)`;
                const time = (p.preferred_start_time && p.preferred_end_time) ? ` (${p.preferred_start_time.slice(0, 5)}-${p.preferred_end_time.slice(0, 5)})` : '';
                return day + time;
            }).join(', ');
            prompt += `  - 勤務可能曜日と希望時間: ${dayPrefs || '特になし'}\n\n`;
        });
        prompt += `### 店舗定休日\n`;
        if (storeClosedDays.length > 0) {
            prompt += storeClosedDays.map(day => `- ${day.specific_date || '毎週' + ['日', '月', '火', '水', '木', '金', '土'][day.day_of_week] + '曜日'}`).join('\n') + '\n\n';
        } else {
            prompt += `- なし\n\n`;
        }
        prompt += `### 店舗の最低要員要件（時間帯別）\n`;
        if (storeRequirements.length > 0) {
            storeRequirements.forEach(req => {
                const day = req.specific_date ? req.specific_date : `毎週${['日', '月', '火', '水', '木', '金', '土'][req.day_of_week]}曜日`;
                prompt += `- ${day} ${req.start_time.slice(0, 5)}-${req.end_time.slice(0, 5)}: ${req.required_staff_count}人\n`;
            });
        } else {
            prompt += `- 全時間帯で1人以上\n`;
        }
        prompt += `\n`;
        prompt += `### 出力形式 (JSON) - 必ずこの形式で、絶対にコメントや追加の説明を含めずに出力してください\n`;
        prompt += `\`\`\`json\n{\n  "shifts": [\n    {\n      "date": "YYYY-MM-DD",\n      "assignments": [\n        {\n          "staff_id": スタッフID,\n          "start_time": "HH:MM",\n          "end_time": "HH:MM"\n        }\n      ]\n    }\n  ]\n}\n\`\`\`\n\n`;
        prompt += `上記のルールとデータに基づき、シフトのJSONを生成してください。`;
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

        const prompt = this.buildPrompt(store, staffs, storeClosedDays, storeRequirements, year, month, period);

        console.log("=========================================");
        console.log("========= Generated Gemini Prompt =========");
        console.log(prompt);
        console.log("=========================================");

        const response = await this.callGeminiApi(prompt);

        console.log("--- Raw Gemini Response ---");
        console.log(JSON.stringify(response, null, 2));
        console.log("--------------------------");

        const generatedShiftData = this.parseGeminiResponse(response);

        return this.saveShift(generatedShiftData, storeId, year, month);
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
        if (match && match[1]) jsonString = match[1];
        return JSON.parse(jsonString);
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