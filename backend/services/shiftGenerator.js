const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { Store, Staff, StaffDayPreference, StaffDayOffRequest,
    StoreClosedDay, StoreStaffRequirement, Shift, ShiftAssignment, sequelize, SystemSetting } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment-timezone');

class ShiftGeneratorService {
    constructor() {
        this.claudeApiUrl = 'https://api.anthropic.com/v1/messages';
        this.claudeApiKey = process.env.CLAUDE_API_KEY;
        this.claudeModel = 'claude-sonnet-4-20250514';
        this.setupSSLCertificates();
    }

    setupSSLCertificates() {
        try {
            const certPath = process.env.NODE_EXTRA_CA_CERTS || '/usr/local/share/ca-certificates/Fortinet_CA_SSL.crt';
            if (fs.existsSync(certPath)) {
                this.caCert = fs.readFileSync(certPath);
            } else {
                const localCertPath = path.join(__dirname, '../../Fortinet_CA_SSL.cer');
                if (fs.existsSync(localCertPath)) {
                    this.caCert = fs.readFileSync(localCertPath);
                }
            }
        } catch (error) {
            // CA証明書の読み込みに失敗しても処理は続行
        }
    }

    async generateShift(storeId, year, month) {
        console.log(`[ShiftGeneratorService] シフト生成開始: 店舗ID ${storeId}, ${year}年${month}月`);
        try {
            const store = await Store.findByPk(storeId);
            if (!store) {
                throw new Error('指定された店舗が見つかりません。');
            }

            const staffs = await Staff.findAll({ where: { store_id: storeId, is_active: true } });
            if (staffs.length === 0) {
                throw new Error('この店舗にアクティブなスタッフがいません。');
            }
            console.log(`[ShiftGeneratorService] 取得したスタッフ数: ${staffs.length}`);

            const staffPreferences = await StaffDayPreference.findAll({
                where: {
                    staff_id: { [Op.in]: staffs.map(s => s.id) },
                    year: year,
                    month: month
                }
            });
            console.log(`[ShiftGeneratorService] 取得したスタッフ希望シフト数: ${staffPreferences.length}`);

            const staffDayOffRequests = await StaffDayOffRequest.findAll({
                where: {
                    staff_id: { [Op.in]: staffs.map(s => s.id) },
                    date: {
                        [Op.between]: [
                            moment.tz(`${year}-${String(month).padStart(2, '0')}-01`, 'Asia/Tokyo').startOf('month').toDate(),
                            moment.tz(`${year}-${String(month).padStart(2, '0')}-01`, 'Asia/Tokyo').endOf('month').toDate()
                        ]
                    }
                }
            });
            console.log(`[ShiftGeneratorService] 取得したスタッフ休み希望数: ${staffDayOffRequests.length}`);


            const storeClosedDays = await StoreClosedDay.findAll({
                where: {
                    store_id: storeId,
                    date: {
                        [Op.between]: [
                            moment.tz(`${year}-${String(month).padStart(2, '0')}-01`, 'Asia/Tokyo').startOf('month').toDate(),
                            moment.tz(`${year}-${String(month).padStart(2, '0')}-01`, 'Asia/Tokyo').endOf('month').toDate()
                        ]
                    }
                }
            });
            console.log(`[ShiftGeneratorService] 取得した店舗定休日数: ${storeClosedDays.length}`);

            const storeRequirements = await StoreStaffRequirement.findAll({
                where: { store_id: storeId }
            });
            console.log(`[ShiftGeneratorService] 取得した店舗要員要件数: ${storeRequirements.length}`);

            const systemSettings = await SystemSetting.findOne();
            console.log(`[ShiftGeneratorService] 取得したシステム設定: ${systemSettings ? 'あり' : 'なし'}`);

            const prompt = this.buildPrompt(
                store, staffs, staffPreferences, staffDayOffRequests,
                storeClosedDays, storeRequirements, systemSettings, year, month
            );
            console.log(`[ShiftGeneratorService] Claude APIプロンプト作成完了。プロンプトサイズ: ${prompt.length} 文字`);
            // console.log("プロンプト内容:\n", prompt); // デバッグ用：プロンプト全体を確認したい場合にコメントを外す

            const response = await this.callClaudeApi(prompt);
            console.log(`[ShiftGeneratorService] Claude APIレスポンス受信完了。`);
            // console.log("Claude APIレスポンス:\n", JSON.stringify(response, null, 2)); // デバッグ用：レスポンス全体を確認したい場合にコメントを外す

            const shiftData = this.parseClaudeResponse(response);
            console.log(`[ShiftGeneratorService] Claudeレスポンス解析完了。生成されたシフト日数: ${shiftData.shifts.length}`);
            console.log(`[ShiftGeneratorService] 生成されたシフトデータ概要:`, JSON.stringify(shiftData, null, 2)); // 生成されたシフトデータの詳細を確認

            // 勤務条件の検証ログを追加
            this.validateGeneratedShift(shiftData, staffs, systemSettings);

            const savedShift = await this.saveShift(storeId, year, month, shiftData);
            console.log(`[ShiftGeneratorService] シフト保存完了: シフトID ${savedShift.id}`);
            return savedShift;

        } catch (error) {
            console.error('[ShiftGeneratorService] シフト生成処理中にエラーが発生しました:', error.message, error.stack);
            throw error;
        }
    }

    buildPrompt(store, staffs, staffPreferences, staffDayOffRequests, storeClosedDays, storeRequirements, systemSettings, year, month) {
        const startDate = moment.tz(`${year}-${String(month).padStart(2, '0')}-01`, 'Asia/Tokyo');
        const endDate = startDate.clone().endOf('month');
        const totalDays = endDate.date();

        let prompt = `あなたは店舗のシフトを最適に生成するAIアシスタントです。以下の情報に基づき、${year}年${month}月のシフトをJSON形式で生成してください。\n\n`;

        prompt += `### 店舗情報\n`;
        prompt += `- 店舗名: ${store.name}\n`;
        prompt += `- 営業時間: ${store.opening_time} - ${store.closing_time}\n`;
        prompt += `- 最低必要人数: ${store.min_staff_for_open}人\n`;
        prompt += `- シフト最小時間（分）: ${systemSettings?.min_shift_minutes || 240}\n`;
        prompt += `- 休憩自動挿入の閾値（時間）: ${systemSettings?.break_threshold_hours || 6}\n`;
        prompt += `- 休憩時間（分）: ${systemSettings?.break_minutes || 60}\n`;
        prompt += `- 最大勤務時間（日）（時間）: ${systemSettings?.max_daily_work_hours || 8}\n`;
        prompt += `- 最大勤務時間（週）（時間）: ${systemSettings?.max_weekly_work_hours || 40}\n`;
        prompt += `- 最大勤務日数（週）: ${systemSettings?.max_weekly_work_days || 5}\n`;
        prompt += `- 最小勤務間隔（時間）: ${systemSettings?.min_rest_hours || 11}\n`; // 追加
        prompt += `- 月の最大勤務時間（時間）: ${systemSettings?.max_monthly_work_hours || 160}\n\n`;


        prompt += `### スタッフ情報\n`;
        staffs.forEach(staff => {
            const preferences = staffPreferences.filter(p => p.staff_id === staff.id);
            const offRequests = staffDayOffRequests.filter(r => r.staff_id === staff.id);
            prompt += `- ID: ${staff.id}, 名前: ${staff.name}, 役職: ${staff.position}, 雇用形態: ${staff.employment_type}\n`;
            prompt += `  - 契約勤務時間（週）（時間）: ${staff.contracted_weekly_hours}\n`;
            prompt += `  - 週あたりの最大勤務日数: ${staff.max_days_per_week || '設定なし'}\n`;
            prompt += `  - 希望勤務時間帯: ${preferences.map(p => `${p.day_of_week} ${p.start_time}-${p.end_time}`).join(', ') || 'なし'}\n`;
            prompt += `  - 休み希望: ${offRequests.map(r => moment(r.date).format('YYYY-MM-DD')).join(', ') || 'なし'}\n`;
            prompt += `  - 各スタッフは1日1シフトのみ割り当て可能。\n`;
            prompt += `  - 各スタッフは最低勤務間隔（${systemSettings?.min_rest_hours || 11}時間）を守ること。\n`;
            prompt += `  - 各スタッフは1日の最大勤務時間（${systemSettings?.max_daily_work_hours || 8}時間）を超過しないこと。\n`;
            prompt += `  - 各スタッフは1週間の最大勤務時間（${systemSettings?.max_weekly_work_hours || 40}時間）を超過しないこと。\n`;
            prompt += `  - 各スタッフは1週間の最大勤務日数（${systemSettings?.max_weekly_work_days || 5}日）を超過しないこと。\n`;
            prompt += `  - 各スタッフは月の最大勤務時間（${systemSettings?.max_monthly_work_hours || 160}時間）を超過しないこと。\n`;
            prompt += `  - 休憩自動挿入の閾値（${systemSettings?.break_threshold_hours || 6}時間）を超える勤務には${systemSettings?.break_minutes || 60}分の休憩を必ず挿入すること。\n`;

        });
        prompt += `\n`;

        prompt += `### 店舗定休日\n`;
        if (storeClosedDays.length > 0) {
            storeClosedDays.forEach(day => {
                prompt += `- ${moment(day.date).format('YYYY-MM-DD')}\n`;
            });
        } else {
            prompt += `- なし\n`;
        }
        prompt += `\n`;

        prompt += `### 店舗の最低要員要件（時間帯別）\n`;
        storeRequirements.forEach(req => {
            prompt += `- ${req.day_of_week} ${req.start_time}-${req.end_time}: ${req.required_staff_count}人\n`;
        });
        prompt += `\n`;

        prompt += `### シフト生成の考慮事項\n`;
        prompt += `- 各日の店舗の営業時間を考慮すること。\n`;
        prompt += `- 各時間帯で最低要員要件を満たすこと。\n`;
        prompt += `- スタッフの休み希望日はシフトに含めないこと。\n`;
        prompt += `- スタッフの契約勤務時間や希望を最大限尊重すること。\n`;
        prompt += `- 店舗定休日はシフトを組まないこと。\n`;
        prompt += `- 各スタッフの週および月の最大勤務時間・日数を遵守すること。\n`;
        prompt += `- 各スタッフの最小勤務間隔を遵守すること。\n`;
        prompt += `- 各スタッフの1日の最大勤務時間を遵守すること。\n`;
        prompt += `- 6時間以上の勤務には必ず60分の休憩を挿入すること。休憩時間は勤務時間に含まれない。\n`;
        prompt += `- シフトは最低4時間からとする。ただし、スタッフの希望を優先し、調整が必要な場合は柔軟に対応する。\n`;
        prompt += `- 日付は 'YYYY-MM-DD' 形式、時刻は 'HH:MM' 形式で記述すること。\n\n`;

        prompt += `### 出力形式 (JSON)\n`;
        prompt += `{\n`;
        prompt += `  "year": ${year},\n`;
        prompt += `  "month": ${month},\n`;
        prompt += `  "shifts": [\n`;
        prompt += `    {\n`;
        prompt += `      "date": "YYYY-MM-DD",\n`;
        prompt += `      "assignments": [\n`;
        prompt += `        {\n`;
        prompt += `          "staff_id": "スタッフID",\n`;
        prompt += `          "start_time": "HH:MM",\n`;
        prompt += `          "end_time": "HH:MM",\n`;
        prompt += `          "break_start_time": "HH:MM",\n`;
        prompt += `          "break_end_time": "HH:MM",\n`;
        prompt += `          "notes": "任意メモ"\n`;
        prompt += `        }\n`;
        prompt += `      ]\n`;
        prompt += `    }\n`;
        prompt += `  ]\n`;
        prompt += `}\n\n`;

        prompt += `上記の条件と形式に従って、${year}年${month}月のシフトJSONを生成してください。`;
        return prompt;
    }

    async callClaudeApi(prompt) {
        const httpsAgent = this.caCert ? new https.Agent({ ca: this.caCert }) : null;

        try {
            const headers = {
                'x-api-key': this.claudeApiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
            };

            const data = {
                model: this.claudeModel,
                max_tokens: 4000,
                messages: [{ role: 'user', content: prompt }]
            };

            const config = { headers: headers };
            if (httpsAgent) {
                config.httpsAgent = httpsAgent;
            }

            const response = await axios.post(this.claudeApiUrl, data, config);
            return response.data;
        } catch (error) {
            if (error.response) {
                console.error('[Claude APIエラー] レスポンスデータ:', error.response.data);
                console.error('[Claude APIエラー] ステータス:', error.response.status);
                console.error('[Claude APIエラー] ヘッダー:', error.response.headers);
                throw new Error(`Claude APIエラー: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            } else if (error.request) {
                console.error('[Claude APIエラー] リクエスト:', error.request);
                throw new Error('Claude APIエラー: レスポンスがありませんでした。');
            } else {
                console.error('[Claude APIエラー] その他のエラー:', error.message);
                throw new Error(`Claude APIエラー: ${error.message}`);
            }
        }
    }

    parseClaudeResponse(response) {
        if (!response || !response.content || response.content.length === 0) {
            throw new Error('Claude APIからのレスポンス内容が空です。');
        }

        const jsonString = response.content[0].text;
        try {
            return JSON.parse(jsonString);
        } catch (e) {
            console.error('[ShiftGeneratorService] ClaudeレスポンスのJSONパースエラー:', e);
            console.error('[ShiftGeneratorService] パース失敗したJSON文字列:', jsonString);
            throw new Error('Claude APIからのレスポンスをJSONとして解析できませんでした。');
        }
    }

    validateGeneratedShift(shiftData, staffs, systemSettings) {
        const staffMap = new Map(staffs.map(s => [s.id, s]));
        const minShiftMinutes = systemSettings?.min_shift_minutes || 240; // 4時間
        const breakThresholdHours = systemSettings?.break_threshold_hours || 6;
        const breakMinutes = systemSettings?.break_minutes || 60;
        const maxDailyWorkHours = systemSettings?.max_daily_work_hours || 8;
        const maxWeeklyWorkHours = systemSettings?.max_weekly_work_hours || 40;
        const maxWeeklyWorkDays = systemSettings?.max_weekly_work_days || 5;
        const minRestHours = systemSettings?.min_rest_hours || 11;
        const maxMonthlyWorkHours = systemSettings?.max_monthly_work_hours || 160;

        const staffMonthlyWorkHours = new Map();
        const staffWeeklyWorkHours = new Map();
        const staffWeeklyWorkDays = new Map();
        const staffLastShiftEnd = new Map();

        for (let i = 0; i < shiftData.shifts.length; i++) {
            const dayShift = shiftData.shifts[i];
            const currentDate = moment(dayShift.date);
            const dayOfWeek = currentDate.day(); // Sunday = 0, Monday = 1, etc.
            const isNewWeek = dayOfWeek === 1; // 月曜日を週の始まりとする

            if (isNewWeek && i !== 0) {
                console.log(`--- 新しい週の開始: ${currentDate.format('YYYY-MM-DD')} ---`);
                staffWeeklyWorkHours.clear();
                staffWeeklyWorkDays.clear();
            }

            if (!dayShift.assignments) {
                console.log(`[Validation] ${dayShift.date}: 割り当てがありません。スキップします。`);
                continue;
            }

            const assignedStaffToday = new Set();

            for (const assignment of dayShift.assignments) {
                const staffId = assignment.staff_id;
                const staff = staffMap.get(staffId);

                if (!staff) {
                    console.warn(`[Validation Warning] ${dayShift.date} - スタッフID ${staffId} が見つかりません。`);
                    continue;
                }

                if (assignedStaffToday.has(staffId)) {
                    console.error(`[Validation Error] ${dayShift.date} - スタッフID ${staffId}: 1日に複数のシフトが割り当てられています。`);
                }
                assignedStaffToday.add(staffId);

                const start = moment(`${dayShift.date} ${assignment.start_time}`);
                const end = moment(`${dayShift.date} ${assignment.end_time}`);

                if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
                    console.error(`[Validation Error] ${dayShift.date} - スタッフID ${staffId}: 不正なシフト時間 (${assignment.start_time}-${assignment.end_time})`);
                    continue;
                }

                let workDurationMinutes = end.diff(start, 'minutes');
                let breakDurationMinutes = 0;

                if (assignment.break_start_time && assignment.break_end_time) {
                    const breakStart = moment(`${dayShift.date} ${assignment.break_start_time}`);
                    const breakEnd = moment(`${dayShift.date} ${assignment.break_end_time}`);
                    if (breakStart.isValid() && breakEnd.isValid() && breakEnd.isAfter(breakStart)) {
                        breakDurationMinutes = breakEnd.diff(breakStart, 'minutes');
                        workDurationMinutes -= breakDurationMinutes;
                    } else {
                        console.error(`[Validation Error] ${dayShift.date} - スタッフID ${staffId}: 不正な休憩時間 (${assignment.break_start_time}-${assignment.break_end_time})`);
                    }
                }

                const workDurationHours = workDurationMinutes / 60;

                // 最小シフト時間
                if (workDurationMinutes < minShiftMinutes) {
                    console.error(`[Validation Error] ${dayShift.date} - スタッフID ${staffId}: 最小シフト時間 ${minShiftMinutes}分 (${minShiftMinutes / 60}時間) を下回っています。割り当て時間: ${workDurationMinutes}分`);
                }

                // 1日の最大勤務時間
                if (workDurationHours > maxDailyWorkHours) {
                    console.error(`[Validation Error] ${dayShift.date} - スタッフID ${staffId}: 1日の最大勤務時間 ${maxDailyWorkHours}時間 を超過しています。割り当て時間: ${workDurationHours.toFixed(2)}時間`);
                }

                // 休憩自動挿入の閾値
                if (workDurationHours * 60 >= breakThresholdHours * 60 && breakDurationMinutes < breakMinutes) {
                    console.error(`[Validation Error] ${dayShift.date} - スタッフID ${staffId}: 勤務時間が${breakThresholdHours}時間を超えているのに、${breakMinutes}分の休憩が不足しています。実休憩: ${breakDurationMinutes}分`);
                }

                // 週の勤務時間
                staffWeeklyWorkHours.set(staffId, (staffWeeklyWorkHours.get(staffId) || 0) + workDurationHours);
                if (staffWeeklyWorkHours.get(staffId) > maxWeeklyWorkHours) {
                    console.error(`[Validation Error] ${dayShift.date} - スタッフID ${staffId}: 週の最大勤務時間 ${maxWeeklyWorkHours}時間 を超過しています。現在の週合計: ${staffWeeklyWorkHours.get(staffId).toFixed(2)}時間`);
                }

                // 週の勤務日数
                staffWeeklyWorkDays.set(staffId, (staffWeeklyWorkDays.get(staffId) || 0) + 1);
                if (staffWeeklyWorkDays.get(staffId) > maxWeeklyWorkDays) {
                    console.error(`[Validation Error] ${dayShift.date} - スタッフID ${staffId}: 週の最大勤務日数 ${maxWeeklyWorkDays}日 を超過しています。現在の週合計: ${staffWeeklyWorkDays.get(staffId)}日`);
                }

                // 月の勤務時間
                staffMonthlyWorkHours.set(staffId, (staffMonthlyWorkHours.get(staffId) || 0) + workDurationHours);
                if (staffMonthlyWorkHours.get(staffId) > maxMonthlyWorkHours) {
                    console.error(`[Validation Error] ${dayShift.date} - スタッフID ${staffId}: 月の最大勤務時間 ${maxMonthlyWorkHours}時間 を超過しています。現在の月合計: ${staffMonthlyWorkHours.get(staffId).toFixed(2)}時間`);
                }

                // 最小勤務間隔 (前回のシフト終了時刻からの計算)
                if (staffLastShiftEnd.has(staffId)) {
                    const lastShiftEnd = staffLastShiftEnd.get(staffId);
                    const restDurationHours = start.diff(lastShiftEnd, 'hours');
                    if (restDurationHours < minRestHours) {
                        console.error(`[Validation Error] ${dayShift.date} - スタッフID ${staffId}: 最小勤務間隔 ${minRestHours}時間 を下回っています。前シフト終了時刻 ${lastShiftEnd.format('HH:MM')}、今回シフト開始時刻 ${assignment.start_time}。間隔: ${restDurationHours}時間`);
                    }
                }
                staffLastShiftEnd.set(staffId, end); // 現在のシフト終了時刻を保存
            }
        }
        console.log('[Validation] シフト検証完了。上記にエラーがなければ、主要な勤務条件は満たされています。');
    }


    async saveShift(storeId, year, month, shiftData) {
        console.log(`[ShiftGeneratorService] シフト保存処理開始: 店舗ID ${storeId}, ${year}年${month}月`);
        const result = await sequelize.transaction(async (t) => {
            let shift = await Shift.findOne({
                where: {
                    store_id: storeId,
                    year: year,
                    month: month
                },
                transaction: t
            });

            if (shift) {
                console.log(`[ShiftGeneratorService] 既存シフトID ${shift.id} を更新します。`);
                await ShiftAssignment.destroy({
                    where: { shift_id: shift.id },
                    transaction: t
                });
                if (shift.status === 'confirmed') {
                    await shift.update({ status: 'draft' }, { transaction: t });
                }
            } else {
                console.log(`[ShiftGeneratorService] 新しいシフトを作成します。`);
                shift = await Shift.create({
                    store_id: storeId,
                    year: year,
                    month: month,
                    status: 'draft'
                }, { transaction: t });
            }

            let savedAssignments = 0;

            for (const dayShift of shiftData.shifts) {
                if (!dayShift.assignments || !Array.isArray(dayShift.assignments)) {
                    continue;
                }

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
                    savedAssignments++;
                }
            }

            console.log(`[ShiftGeneratorService] シフト保存完了: ${savedAssignments}件の割り当てを保存`);
            return shift;
        });

        return result;
    }
}

module.exports = new ShiftGeneratorService();