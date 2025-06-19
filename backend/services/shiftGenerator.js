const axios = require('axios');
const https = require('https');
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
        this.geminiApiKey = process.env.GEMINI_API_KEY;
        this.geminiModel = 'gemini-1.5-flash-latest';
        this.geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent`;
    }

    getShiftPeriod(year, month) {
        const startDate = moment.tz(`${year}-${String(month).padStart(2, '0')}-01`, 'Asia/Tokyo').startOf('month').format('YYYY-MM-DD');
        const endDate = moment.tz(`${year}-${String(month).padStart(2, '0')}-01`, 'Asia/Tokyo').endOf('month').format('YYYY-MM-DD');
        return { startDate, endDate };
    }

    async getStaffTotalHoursAllStores(staffIds, year, month) {
        if (!staffIds || staffIds.length === 0) return {};

        const { startDate, endDate } = this.getShiftPeriod(year, month);
        const assignments = await ShiftAssignment.findAll({
            where: {
                staff_id: { [Op.in]: staffIds },
                date: { [Op.between]: [startDate, endDate] }
            },
            include: [{ model: Shift, attributes: ['store_id'] }]
        });

        const totalHoursByStaff = {};
        staffIds.forEach(id => {
            totalHoursByStaff[id] = { total: 0, byStore: {} };
        });

        for (const assignment of assignments) {
            const workMinutes = this.calculateWorkMinutes(assignment.start_time, assignment.end_time, assignment.break_start_time, assignment.break_end_time);
            const netWorkHours = workMinutes / 60;
            const staffId = assignment.staff_id;
            const storeId = assignment.Shift.store_id;

            totalHoursByStaff[staffId].total += netWorkHours;
            if (!totalHoursByStaff[staffId].byStore[storeId]) {
                totalHoursByStaff[staffId].byStore[storeId] = 0;
            }
            totalHoursByStaff[staffId].byStore[storeId] += netWorkHours;
        }

        return totalHoursByStaff;
    }

    async generateShift(storeId, year, month) {
        const MAX_RETRIES = 3;
        let lastError = null;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            console.log(`[ShiftGeneratorService] 生成試行回数: ${attempt}/${MAX_RETRIES}`);
            try {
                const store = await Store.findByPk(storeId);
                if (!store) throw new Error('指定された店舗が見つかりません。');

                const staffs = await Staff.findAll({
                    where: {
                        [Op.or]: [
                            { store_id: storeId },
                            { id: { [Op.in]: sequelize.literal(`(SELECT staff_id FROM staff_stores WHERE store_id = ${storeId})`) } }
                        ]
                    },
                    include: [
                        { model: StaffDayPreference, as: 'dayPreferences' },
                        { model: StaffDayOffRequest, as: 'dayOffRequests' },
                        { model: Store, as: 'stores', attributes: ['id'] }
                    ]
                });

                if (staffs.length === 0) throw new Error('この店舗にアクティブなスタッフがいません。');
                const staffIds = staffs.map(s => s.id);

                const allStoreHours = await this.getStaffTotalHoursAllStores(staffIds, year, month);

                const storeClosedDays = await StoreClosedDay.findAll({ where: { store_id: storeId } });
                const storeRequirements = await StoreStaffRequirement.findAll({ where: { store_id: storeId } });
                const systemSettings = await SystemSetting.findOne({ where: { user_id: store.owner_id } });

                const prompt = this.buildPrompt(store, staffs, allStoreHours, storeClosedDays, storeRequirements, systemSettings, year, month);
                const response = await this.callGeminiApi(prompt);
                let generatedShiftData = this.parseGeminiResponse(response);

                let validationResult = this.validateGeneratedShift(generatedShiftData, staffs, allStoreHours);

                if (validationResult.errors.length === 0) {
                    console.log("[ShiftGeneratorService] 生成されたシフトは有効です。");
                    return this.saveShift(generatedShiftData, storeId, year, month);
                }

                console.warn(`[ShiftGeneratorService] 試行${attempt}: 制約違反が${validationResult.errors.length}件発見されました。自動修正を試みます...`);
                generatedShiftData = this.fixConstraints(generatedShiftData, validationResult.errors);

                validationResult = this.validateGeneratedShift(generatedShiftData, staffs, allStoreHours);
                if (validationResult.errors.length === 0) {
                    console.log("[ShiftGeneratorService] 制約違反の修正に成功しました。");
                    return this.saveShift(generatedShiftData, storeId, year, month);
                }

                lastError = new Error(`制約違反が解決できませんでした: ${validationResult.errors.join(', ')}`);

            } catch (error) {
                console.error(`[ShiftGeneratorService] 試行${attempt}でエラー発生:`, error.message);
                lastError = error;

                if (attempt < MAX_RETRIES) {
                    const waitTime = Math.pow(2, attempt) * 1000;
                    console.log(`[ShiftGeneratorService] ${waitTime / 1000}秒待機して再試行します...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }

        console.error(`[ShiftGeneratorService] 最大試行回数(${MAX_RETRIES}回)に達しました。`);
        throw lastError;
    }

    fixConstraints(shiftData, errors) {
        const assignmentsToRemove = new Set();
        errors.forEach(error => {
            const match = error.match(/(\d{4}-\d{2}-\d{2}) - スタッフID (\d+):/);
            if (match) {
                const [_, date, staffId] = match;
                assignmentsToRemove.add(`${date}-${staffId}`);
            }
        });

        shiftData.shifts.forEach(dayShift => {
            dayShift.assignments = dayShift.assignments.filter(assignment => {
                const key = `${dayShift.date}-${assignment.staff_id}`;
                if (assignmentsToRemove.has(key)) {
                    console.log(`[FixConstraints] ${dayShift.date} - スタッフID ${assignment.staff_id}: シフト削除`);
                    return false;
                }
                return true;
            });
        });
        return shiftData;
    }

    buildPrompt(store, staffs, allStoreHours, storeClosedDays, storeRequirements, systemSettings, year, month) {
        let prompt = `あなたは店舗のシフトを最適に生成するAIアシスタントです。以下の情報に基づき、${year}年${month}月のシフトをJSON形式で生成してください。\n\n`;
        prompt += `### 店舗・期間情報\n`;
        prompt += `- 店舗名: ${store.name}\n`;
        prompt += `- 対象期間: ${year}年${month}月\n`;
        prompt += `- 営業時間: ${store.opening_time} - ${store.closing_time}\n\n`;

        prompt += `### スタッフ情報と制約条件\n`;
        staffs.forEach(staff => {
            const staffHours = allStoreHours[staff.id] || { total: 0, byStore: {} };
            const otherStoreHours = staffHours.byStore && staffHours.byStore[store.id] ? staffHours.total - staffHours.byStore[store.id] : staffHours.total;
            const remainingMax = (staff.max_hours_per_month || Infinity) - otherStoreHours;
            const remainingMin = Math.max(0, (staff.min_hours_per_month || 0) - otherStoreHours);

            prompt += `- ID: ${staff.id}, 名前: ${staff.first_name} ${staff.last_name}\n`;
            prompt += `  - この店舗での月間勤務時間制約: ${remainingMin.toFixed(1)}時間 ～ ${remainingMax > 0 ? remainingMax.toFixed(1) : '0'}時間 (他店舗での勤務時間 ${otherStoreHours.toFixed(1)}h を考慮済)\n`;
            prompt += `  - 1日の最大勤務時間: ${staff.max_hours_per_day || '未設定'}時間\n`;
            prompt += `  - 最大連続勤務日数: ${staff.max_consecutive_days || '未設定'}日\n`;
            const dayOffs = staff.dayOffRequests.map(r => r.date).join(', ');
            prompt += `  - 休み希望日: ${dayOffs || 'なし'}\n`;

            const dayPrefs = staff.dayPreferences.filter(p => p.available).map(p => {
                const day = ['日', '月', '火', '水', '木', '金', '土'][p.day_of_week];
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
        prompt += `\`\`\`json\n`;
        prompt += `{\n`;
        prompt += `  "shifts": [\n`;
        prompt += `    {\n`;
        prompt += `      "date": "YYYY-MM-DD",\n`;
        prompt += `      "assignments": [\n`;
        prompt += `        {\n`;
        prompt += `          "staff_id": スタッフID,\n`;
        prompt += `          "start_time": "HH:MM",\n`;
        prompt += `          "end_time": "HH:MM",\n`;
        prompt += `          "break_start_time": "HH:MM",\n`;
        prompt += `          "break_end_time": "HH:MM",\n`;
        prompt += `          "notes": "任意メモ"\n`;
        prompt += `        }\n`;
        prompt += `      ]\n`;
        prompt += `    }\n`;
        prompt += `  ],\n`;
        prompt += `  "summary": {\n`;
        prompt += `    "totalHoursByStaff": [\n`;
        prompt += `      { "staff_id": スタッフID, "total_hours": 合計時間 }\n`;
        prompt += `    ]\n`;
        prompt += `  }\n`;
        prompt += `}\n`;
        prompt += `\`\`\`\n\n`;
        prompt += `上記の条件と形式に従って、${year}年${month}月のシフトJSONを生成してください。`;

        return prompt;
    }

    async callGeminiApi(prompt) {
        console.warn('[Security][DEBUG] SSL証明書の検証を強制的に無効にしています。');
        const httpsAgent = new https.Agent({ rejectUnauthorized: false });

        const url = `${this.geminiApiUrl}?key=${this.geminiApiKey}`;

        try {
            const headers = {
                'Content-Type': 'application/json'
            };

            const data = {
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            };

            const config = {
                headers: headers,
                timeout: 120000,
                httpsAgent: httpsAgent
            };

            const response = await axios.post(url, data, config);
            return response.data;
        } catch (error) {
            if (error.response) {
                console.error('[Gemini APIエラー] レスポンスデータ:', error.response.data);
                throw new Error(`Gemini APIエラー: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            } else if (error.request) {
                console.error('[Gemini APIエラー] リクエスト失敗:', error.message);
                console.error('[Gemini APIエラー] エラーコード:', error.code);
                throw new Error(`Gemini APIエラー: レスポンスがありませんでした。(${error.code})`);
            } else {
                console.error('[Gemini APIエラー] リクエスト設定エラー:', error.message);
                throw new Error(`Gemini APIエラー: ${error.message}`);
            }
        }
    }

    parseGeminiResponse(response) {
        if (!response || !response.candidates || response.candidates.length === 0 || !response.candidates[0].content.parts || response.candidates[0].content.parts.length === 0) {
            console.error('Gemini APIからのレスポンス形式が不正です:', response);
            throw new Error('Gemini APIからのレスポンス内容が空または不正な形式です。');
        }

        let jsonString = response.candidates[0].content.parts[0].text;

        const match = jsonString.match(/```json\n([\s\S]*)\n```/);
        if (match && match[1]) {
            jsonString = match[1];
        }

        jsonString = jsonString.replace(/\/\/.*/g, '');

        try {
            return JSON.parse(jsonString);
        } catch (e) {
            console.error('[ShiftGeneratorService] GeminiレスポンスのJSONパースエラー:', e);
            console.error('[ShiftGeneratorService] パース失敗したJSON文字列:', jsonString);
            throw new Error('Gemini APIからのレスポンスをJSONとして解析できませんでした。');
        }
    }

    validateGeneratedShift(shiftData, staffs, allStoreHours) {
        const errors = [];
        const warnings = [];
        const staffMap = new Map(staffs.map(s => [s.id, s]));
        const staffMonthlyHours = new Map();

        staffs.forEach(staff => {
            const initialHours = allStoreHours[staff.id] ? allStoreHours[staff.id].total : 0;
            staffMonthlyHours.set(staff.id, initialHours);
        });

        if (shiftData && shiftData.shifts) {
            for (const dayShift of shiftData.shifts) {
                if (!dayShift.assignments || !Array.isArray(dayShift.assignments)) continue;

                for (const assignment of dayShift.assignments) {
                    const staff = staffMap.get(assignment.staff_id);
                    if (!staff) {
                        warnings.push(`ID ${assignment.staff_id} のスタッフ情報が見つかりません。`);
                        continue;
                    }
                    const workHours = this.calculateWorkMinutes(assignment.start_time, assignment.end_time, assignment.break_start_time, assignment.break_end_time) / 60;
                    const currentTotalHours = (staffMonthlyHours.get(staff.id) || 0) + workHours;
                    staffMonthlyHours.set(staff.id, currentTotalHours);

                    if (staff.max_hours_per_month && currentTotalHours > staff.max_hours_per_month) {
                        errors.push(`${dayShift.date} - スタッフID ${staff.id}: 月の最大勤務時間 ${staff.max_hours_per_month}h を超過 (${currentTotalHours.toFixed(1)}h)`);
                    }
                }
            }
        }

        staffs.forEach(staff => {
            const totalHours = staffMonthlyHours.get(staff.id);
            if (staff.min_hours_per_month && totalHours < staff.min_hours_per_month) {
                warnings.push(`スタッフID ${staff.id}: 月の最小勤務時間 ${staff.min_hours_per_month}h に未達 (${totalHours.toFixed(1)}h)`);
            }
        });

        console.log(`[Validation] シフト検証完了。エラー: ${errors.length}件, 警告: ${warnings.length}件`);
        return { errors, warnings };
    }

    calculateWorkMinutes(startTime, endTime, breakStartTime, breakEndTime) {
        if (!startTime || !endTime) return 0;
        const start = moment(startTime, 'HH:mm:ss');
        const end = moment(endTime, 'HH:mm:ss');
        if (end.isBefore(start)) end.add(1, 'day');
        let workMinutes = end.diff(start, 'minutes');

        if (breakStartTime && breakEndTime) {
            const breakStart = moment(breakStartTime, 'HH:mm:ss');
            const breakEnd = moment(breakEndTime, 'HH:mm:ss');
            if (breakEnd.isBefore(breakStart)) breakEnd.add(1, 'day');
            workMinutes -= breakEnd.diff(breakStart, 'minutes');
        }
        return workMinutes;
    }

    async saveShift(shiftData, storeId, year, month) {
        return await sequelize.transaction(async (t) => {
            let shift = await Shift.findOne({
                where: { store_id: storeId, year, month },
                transaction: t
            });

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
                                break_start_time: assignment.break_start_time || null,
                                break_end_time: assignment.break_end_time || null,
                                notes: assignment.notes || null
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