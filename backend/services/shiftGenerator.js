const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { Store, Staff, StaffDayPreference, StaffDayOffRequest,
    StoreClosedDay, StoreStaffRequirement, Shift, ShiftAssignment, sequelize } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment-timezone');

class ShiftGeneratorService {
    constructor() {
        this.claudeApiUrl = 'https://api.anthropic.com/v1/messages';
        this.claudeApiKey = process.env.CLAUDE_API_KEY;
        // 最新のClaude 4 Sonnetモデルに更新
        this.claudeModel = 'claude-sonnet-4-20250514';

        this.setupSSLCertificates();
    }

    setupSSLCertificates() {
        const fs = require('fs');
        const path = require('path');

        try {
            const certPath = process.env.NODE_EXTRA_CA_CERTS || '/usr/local/share/ca-certificates/Fortinet_CA_SSL.crt';

            if (fs.existsSync(certPath)) {
                this.caCert = fs.readFileSync(certPath);
                console.log('企業CA証明書を読み込みました:', certPath);
            } else {
                const localCertPath = path.join(__dirname, '../../Fortinet_CA_SSL.cer');
                if (fs.existsSync(localCertPath)) {
                    this.caCert = fs.readFileSync(localCertPath);
                    console.log('ローカルCA証明書を読み込みました:', localCertPath);
                }
            }
        } catch (error) {
            console.warn('CA証明書の読み込みに失敗しました:', error.message);
        }
    }

    async generateShift(storeId, year, month) {
        try {
            console.log('シフト生成を開始します');

            if (!this.claudeApiKey) {
                throw new Error('Claude API キーが設定されていません');
            }

            const store = await Store.findByPk(storeId, {
                include: [
                    { model: StoreClosedDay, as: 'closedDays' },
                    { model: StoreStaffRequirement, as: 'staffRequirements' }
                ]
            });

            if (!store) {
                throw new Error('店舗が見つかりません');
            }

            const staff = await Staff.findAll({
                where: { store_id: storeId },
                include: [
                    { model: StaffDayPreference, as: 'dayPreferences' }
                ]
            });

            if (staff.length === 0) {
                throw new Error('スタッフが登録されていません');
            }

            const startDate = moment(`${year}-${month.toString().padStart(2, '0')}-01`);
            const endDate = moment(startDate).endOf('month');
            const daysInMonth = endDate.date();

            const dayOffRequests = await StaffDayOffRequest.findAll({
                where: {
                    staff_id: staff.map(s => s.id),
                    date: {
                        [Op.between]: [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]
                    },
                    status: ['pending', 'approved']
                }
            });

            const storeData = this._formatStoreData(store);
            const staffData = this._formatStaffData(staff, dayOffRequests);
            const calendarData = this._generateCalendarData(year, month, daysInMonth);
            const requirementsData = this._formatRequirementsData(store, year, month, daysInMonth);

            const prompt = this._generatePrompt(storeData, staffData, calendarData, requirementsData, year, month);

            console.log('Claude APIにリクエスト送信中...');

            const response = await this._callClaudeAPI(prompt);

            console.log('Claude APIからレスポンスを受信しました');

            const shiftData = this._parseAIResponse(response);

            const validationResult = await this.validateShift(shiftData, storeId, year, month);

            if (validationResult.warnings.length > 0) {
                if (!shiftData.summary) {
                    shiftData.summary = {};
                }
                shiftData.summary.staffingWarnings = validationResult.warnings;
            }

            return shiftData;
        } catch (error) {
            console.error('シフト生成エラー:', error);
            throw error;
        }
    }

    _generatePrompt(storeData, staffData, calendarData, requirementsData, year, month) {
        const monthNames = [
            '1月', '2月', '3月', '4月', '5月', '6月',
            '7月', '8月', '9月', '10月', '11月', '12月'
        ];

        const closedDaysInfo = storeData.closed_days.map(day => {
            if (day.specific_date) {
                return `${day.specific_date}`;
            } else if (day.day_of_week !== null) {
                const dayNames = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
                return dayNames[day.day_of_week];
            }
            return '';
        }).join(', ');

        const staffDetails = staffData.map(staff => {
            const dayPrefs = staff.day_preferences.map(pref =>
                `${pref.day_name}:${pref.available ? `${pref.preferred_start_time || '未設定'}-${pref.preferred_end_time || '未設定'}` : '休み'}`
            ).join(', ');

            const dayOffs = staff.days_off.map(off => `${off.date}(${off.reason || ''})`).join(', ');

            return `
    スタッフID: ${staff.id}
    名前: ${staff.name}
    役職: ${staff.position}
    雇用形態: ${staff.employment_type}
    月間勤務時間: 最小${staff.min_hours_per_month}時間～最大${staff.max_hours_per_month}時間
    1日最大勤務時間: ${staff.max_hours_per_day}時間
    最大連続勤務日数: ${staff.max_consecutive_days}日
    曜日別希望: ${dayPrefs}
    休み希望: ${dayOffs || 'なし'}`;
        }).join('\n');

        const requirementDetails = requirementsData.map(req => {
            if (req.requirements.length === 0) return null;
            const reqs = req.requirements.map(r =>
                `${r.start_time}-${r.end_time}: ${r.required_staff_count}名必要`
            ).join(', ');
            return `${req.date}: ${reqs}`;
        }).filter(Boolean).join('\n');

        // プロンプトを簡潔にして、レスポンスサイズを制限
        return `
# シフト生成リクエスト

## 基本情報
年月: ${year}年${monthNames[month - 1]}
店舗: ${storeData.name}
営業時間: ${storeData.opening_time}～${storeData.closing_time}
定休日: ${closedDaysInfo}

## スタッフ情報
${staffDetails}

## 日別要件
${requirementDetails}

## 制約条件
1. 労働基準法遵守（6時間超で45分、8時間超で60分の休憩）
2. スタッフの希望シフトを尊重
3. 休み希望は絶対条件
4. 勤務時間の均等配分
5. 連続勤務日数制限

## 出力形式
必ずJSON形式のみで回答してください。説明文は不要です。

{
  "shifts": [
    {
      "date": "YYYY-MM-DD",
      "assignments": [
        {
          "staff_id": 1,
          "staff_name": "田中 太郎",
          "start_time": "09:00",
          "end_time": "18:00",
          "break_start_time": "12:00",
          "break_end_time": "13:00"
        }
      ]
    }
  ],
  "summary": {
    "totalHoursByStaff": [
      {
        "staff_id": 1,
        "staff_name": "田中 太郎",
        "total_hours": 160
      }
    ]
  }
}`;
    }

    async _callClaudeAPI(prompt) {
        try {
            const requestData = {
                model: this.claudeModel,
                max_tokens: 8000, // トークン数を増加
                temperature: 0.1,
                system: "あなたはシフト最適化の専門家です。必ずJSON形式のデータのみを返してください。説明文や追加のテキストは一切含めないでください。",
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ]
            };

            console.log('Claude API リクエスト送信中...');
            console.log('API URL:', this.claudeApiUrl);
            console.log('Model:', this.claudeModel);
            console.log('API Key exists:', !!this.claudeApiKey);
            console.log('プロンプト文字数:', prompt.length);

            const httpsAgentOptions = {};

            if (process.env.NODE_ENV === 'development') {
                httpsAgentOptions.rejectUnauthorized = false;
                console.log('開発環境: SSL証明書検証を無効化');
            } else {
                httpsAgentOptions.rejectUnauthorized = true;
                if (this.caCert) {
                    httpsAgentOptions.ca = this.caCert;
                    console.log('本番環境: カスタムCA証明書を使用');
                }
            }

            const httpsAgent = new https.Agent(httpsAgentOptions);

            const axiosConfig = {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.claudeApiKey,
                    'anthropic-version': '2023-06-01'
                },
                timeout: 180000, // タイムアウトを3分に延長
                httpsAgent: httpsAgent
            };

            console.log('Sending request to Claude API...');
            const startTime = Date.now();
            const response = await axios.post(this.claudeApiUrl, requestData, axiosConfig);
            const endTime = Date.now();

            console.log('Claude API response received');
            console.log('Response time:', endTime - startTime, 'ms');
            console.log('Response status:', response.status);

            if (response.data && response.data.content && Array.isArray(response.data.content)) {
                const responseText = response.data.content[0]?.text;
                console.log('Content received, length:', responseText?.length || 0);
                console.log('Response preview:', responseText?.substring(0, 500) + '...');
                return responseText;
            } else {
                console.error('Unexpected response format:', response.data);
                throw new Error('Unexpected response format from Claude API');
            }
        } catch (error) {
            if (error.response) {
                console.error('Claude API エラーレスポンス:', {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    data: error.response.data
                });

                if (error.response.status === 401) {
                    throw new Error('Claude API認証エラー: APIキーを確認してください');
                } else if (error.response.status === 429) {
                    throw new Error('Claude APIレート制限エラー: しばらく待ってからお試しください');
                } else if (error.response.status === 500) {
                    throw new Error('Claude APIサーバーエラー: しばらく待ってからお試しください');
                } else {
                    throw new Error(`Claude APIエラー: ${error.response.data?.error?.message || error.response.statusText}`);
                }
            } else if (error.request) {
                console.error('Claude API リクエストエラー:', error.message);
                console.error('Error code:', error.code);

                if (error.code === 'ECONNABORTED') {
                    throw new Error('Claude API接続タイムアウト: リクエストが時間内に完了しませんでした');
                } else if (error.code === 'ENOTFOUND') {
                    throw new Error('Claude API DNS解決エラー: インターネット接続を確認してください');
                } else if (error.code === 'ECONNREFUSED') {
                    throw new Error('Claude API接続拒否: ネットワーク設定を確認してください');
                }

                throw new Error('Claude APIへの接続に失敗しました');
            } else {
                console.error('予期しないエラー:', error);
                throw error;
            }
        }
    }

    _formatStoreData(store) {
        return {
            id: store.id,
            name: store.name,
            opening_time: store.opening_time,
            closing_time: store.closing_time,
            closed_days: store.closedDays.map(day => ({
                day_of_week: day.day_of_week,
                specific_date: day.specific_date ? moment(day.specific_date).format('YYYY-MM-DD') : null
            }))
        };
    }

    _formatStaffData(staff, dayOffRequests) {
        const staffData = staff.map(s => {
            const daysOff = dayOffRequests
                .filter(req => req.staff_id === s.id)
                .map(req => ({
                    date: moment(req.date).format('YYYY-MM-DD'),
                    reason: req.reason,
                    status: req.status
                }));

            const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
            const formattedPreferences = s.dayPreferences.map(pref => ({
                day_of_week: pref.day_of_week,
                day_name: dayNames[pref.day_of_week],
                available: pref.available,
                preferred_start_time: pref.preferred_start_time,
                preferred_end_time: pref.preferred_end_time,
                break_start_time: pref.break_start_time,
                break_end_time: pref.break_end_time
            }));

            return {
                id: s.id,
                name: `${s.last_name} ${s.first_name}`,
                position: s.position || '一般スタッフ',
                employment_type: s.employment_type || 'パート',
                max_hours_per_month: s.max_hours_per_month || 160,
                min_hours_per_month: s.min_hours_per_month || 0,
                max_hours_per_day: s.max_hours_per_day || 8,
                max_consecutive_days: s.max_consecutive_days || 5,
                day_preferences: formattedPreferences,
                days_off: daysOff
            };
        });

        return staffData;
    }

    _generateCalendarData(year, month, daysInMonth) {
        const calendarData = [];
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

        for (let day = 1; day <= daysInMonth; day++) {
            const date = moment(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);
            const dayOfWeek = date.day();

            calendarData.push({
                date: date.format('YYYY-MM-DD'),
                day_of_week: dayOfWeek,
                day_name: dayNames[dayOfWeek],
                is_weekend: [0, 6].includes(dayOfWeek)
            });
        }

        return calendarData;
    }

    _formatRequirementsData(store, year, month, daysInMonth) {
        const requirementsData = [];

        for (let day = 1; day <= daysInMonth; day++) {
            const date = moment(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);
            const dayOfWeek = date.day();
            const dateStr = date.format('YYYY-MM-DD');

            const regularRequirements = store.staffRequirements
                .filter(req => req.day_of_week === dayOfWeek && !req.specific_date);

            const specialRequirements = store.staffRequirements
                .filter(req => req.specific_date && moment(req.specific_date).format('YYYY-MM-DD') === dateStr);

            const dayRequirements = specialRequirements.length > 0 ? specialRequirements : regularRequirements;

            const formattedRequirements = dayRequirements.map(req => ({
                start_time: moment(req.start_time, 'HH:mm:ss').format('HH:mm'),
                end_time: moment(req.end_time, 'HH:mm:ss').format('HH:mm'),
                required_staff_count: req.required_staff_count
            }));

            requirementsData.push({
                date: dateStr,
                day_of_week: dayOfWeek,
                requirements: formattedRequirements
            });
        }

        return requirementsData;
    }

    _parseAIResponse(response) {
        try {
            console.log('AIレスポンスの解析を開始します');
            console.log('Response length:', response?.length || 0);

            if (!response) {
                throw new Error('レスポンスが空です');
            }

            // 複数のパターンでJSONを抽出
            let jsonString = null;

            // パターン1: ```json ... ``` ブロック
            const jsonBlockMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonBlockMatch && jsonBlockMatch[1]) {
                jsonString = jsonBlockMatch[1].trim();
                console.log('JSONブロックからデータを抽出しました');
            }

            // パターン2: ```JSON ... ``` ブロック（大文字）
            if (!jsonString) {
                const jsonBlockMatchUpper = response.match(/```JSON\s*([\s\S]*?)\s*```/);
                if (jsonBlockMatchUpper && jsonBlockMatchUpper[1]) {
                    jsonString = jsonBlockMatchUpper[1].trim();
                    console.log('JSONブロック（大文字）からデータを抽出しました');
                }
            }

            // パターン3: { で始まり } で終わるJSON
            if (!jsonString) {
                const jsonObjectMatch = response.match(/(\{[\s\S]*\})/);
                if (jsonObjectMatch && jsonObjectMatch[1]) {
                    jsonString = jsonObjectMatch[1].trim();
                    console.log('JSONオブジェクトからデータを抽出しました');
                }
            }

            if (!jsonString) {
                console.error('JSONデータが見つかりません');
                console.error('Response preview:', response.substring(0, 1000));
                throw new Error('AIレスポンスからJSONデータを抽出できませんでした');
            }

            // JSON文字列の検証と修復
            jsonString = this._repairJsonString(jsonString);

            console.log('JSON文字列を抽出しました (length: ' + jsonString.length + ')');
            console.log('JSON preview:', jsonString.substring(0, 500) + '...');

            try {
                const shiftData = JSON.parse(jsonString);
                console.log('JSONのパースに成功しました');

                // データ構造の検証
                if (!shiftData.shifts || !Array.isArray(shiftData.shifts)) {
                    throw new Error('シフトデータの形式が正しくありません: shifts配列が見つかりません');
                }

                // サマリーデータがない場合は生成
                if (!shiftData.summary) {
                    shiftData.summary = this._generateSummary(shiftData.shifts);
                }

                return shiftData;
            } catch (parseError) {
                console.error('JSONパースエラー:', parseError.message);
                console.error('問題のあるJSON文字列:', jsonString);

                // 部分的なJSONの修復を試行
                const repairedJson = this._attemptJsonRepair(jsonString);
                if (repairedJson) {
                    console.log('JSON修復を試行します');
                    return JSON.parse(repairedJson);
                }

                throw new Error('JSONのパースに失敗しました: ' + parseError.message);
            }
        } catch (error) {
            console.error('AIレスポンス解析エラー:', error);
            throw new Error('AIレスポンスの解析に失敗しました: ' + error.message);
        }
    }

    _repairJsonString(jsonString) {
        // 基本的なJSON修復
        jsonString = jsonString
            .replace(/,\s*}/g, '}')  // 末尾の不要なカンマを削除
            .replace(/,\s*]/g, ']')  // 配列の末尾の不要なカンマを削除
            .replace(/^\s*,/gm, '')  // 行頭の不要なカンマを削除
            .trim();

        return jsonString;
    }

    _attemptJsonRepair(jsonString) {
        try {
            // 切り捨てられたJSONの修復を試行
            let repaired = jsonString;

            // 未完了のオブジェクトや配列を閉じる
            const openBraces = (repaired.match(/\{/g) || []).length;
            const closeBraces = (repaired.match(/\}/g) || []).length;
            const openBrackets = (repaired.match(/\[/g) || []).length;
            const closeBrackets = (repaired.match(/\]/g) || []).length;

            // 不足している閉じ括弧を追加
            for (let i = 0; i < openBrackets - closeBrackets; i++) {
                repaired += ']';
            }
            for (let i = 0; i < openBraces - closeBraces; i++) {
                repaired += '}';
            }

            // 最後のカンマを削除
            repaired = repaired.replace(/,\s*([}\]])/, '$1');

            console.log('修復されたJSON:', repaired.substring(0, 500) + '...');

            // パースを試行
            JSON.parse(repaired);
            return repaired;
        } catch (error) {
            console.error('JSON修復に失敗:', error.message);
            return null;
        }
    }

    _generateSummary(shifts) {
        const staffHours = {};

        shifts.forEach(dayShift => {
            if (dayShift.assignments) {
                dayShift.assignments.forEach(assignment => {
                    const staffId = assignment.staff_id;
                    const startTime = moment(assignment.start_time, 'HH:mm');
                    const endTime = moment(assignment.end_time, 'HH:mm');

                    let hours = endTime.diff(startTime, 'minutes') / 60;

                    // 休憩時間を差し引く
                    if (assignment.break_start_time && assignment.break_end_time) {
                        const breakStart = moment(assignment.break_start_time, 'HH:mm');
                        const breakEnd = moment(assignment.break_end_time, 'HH:mm');
                        const breakHours = breakEnd.diff(breakStart, 'minutes') / 60;
                        hours -= breakHours;
                    }

                    if (!staffHours[staffId]) {
                        staffHours[staffId] = {
                            staff_id: staffId,
                            staff_name: assignment.staff_name || `スタッフ${staffId}`,
                            total_hours: 0
                        };
                    }
                    staffHours[staffId].total_hours += hours;
                });
            }
        });

        return {
            totalHoursByStaff: Object.values(staffHours).map(staff => ({
                ...staff,
                total_hours: Math.round(staff.total_hours * 10) / 10
            }))
        };
    }

    async validateShift(shiftData, storeId, year, month) {
        try {
            console.log('シフトの検証を開始します');

            const store = await Store.findByPk(storeId, {
                include: [
                    { model: StoreStaffRequirement, as: 'staffRequirements' }
                ]
            });

            if (!store) {
                throw new Error('店舗が見つかりません');
            }

            const warnings = [];

            for (const dayShift of shiftData.shifts) {
                const date = moment(dayShift.date);
                const dayOfWeek = date.day();

                const specialRequirements = store.staffRequirements
                    .filter(req => req.specific_date && moment(req.specific_date).format('YYYY-MM-DD') === dayShift.date);

                const regularRequirements = store.staffRequirements
                    .filter(req => req.day_of_week === dayOfWeek && !req.specific_date);

                const requirements = specialRequirements.length > 0 ? specialRequirements : regularRequirements;

                if (requirements.length === 0) {
                    continue;
                }

                for (const requirement of requirements) {
                    const startTime = moment(requirement.start_time, 'HH:mm:ss');
                    const endTime = moment(requirement.end_time, 'HH:mm:ss');

                    const timeSlots = this._generateTimeSlots(startTime, endTime, 15);

                    const staffCounts = {};
                    timeSlots.forEach(slot => {
                        staffCounts[slot] = 0;
                    });

                    const assignments = dayShift.assignments || [];

                    for (const assignment of assignments) {
                        const assignmentStart = moment(assignment.start_time, 'HH:mm');
                        const assignmentEnd = moment(assignment.end_time, 'HH:mm');

                        const breakStart = assignment.break_start_time ? moment(assignment.break_start_time, 'HH:mm') : null;
                        const breakEnd = assignment.break_end_time ? moment(assignment.break_end_time, 'HH:mm') : null;

                        timeSlots.forEach(slot => {
                            const slotTime = moment(slot, 'HH:mm');
                            const isInBreak = breakStart && breakEnd &&
                                slotTime.isSameOrAfter(breakStart) &&
                                slotTime.isBefore(breakEnd);

                            const isWorking = slotTime.isSameOrAfter(assignmentStart) &&
                                slotTime.isBefore(assignmentEnd) &&
                                !isInBreak;

                            if (isWorking) {
                                staffCounts[slot]++;
                            }
                        });
                    }

                    let currentWarningStart = null;
                    let currentShortage = 0;

                    for (let i = 0; i < timeSlots.length; i++) {
                        const slot = timeSlots[i];
                        const staffCount = staffCounts[slot];
                        const shortage = requirement.required_staff_count - staffCount;

                        if (shortage > 0 && currentWarningStart === null) {
                            currentWarningStart = slot;
                            currentShortage = shortage;
                        }
                        else if (currentWarningStart !== null &&
                            (shortage !== currentShortage || shortage <= 0 || i === timeSlots.length - 1)) {

                            if (currentShortage > 0) {
                                warnings.push({
                                    date: dayShift.date,
                                    time_range: `${currentWarningStart}-${slot}`,
                                    required: requirement.required_staff_count,
                                    assigned: requirement.required_staff_count - currentShortage,
                                    message: `人員が不足しています（必要: ${requirement.required_staff_count}名, 割当: ${requirement.required_staff_count - currentShortage}名）`
                                });
                            }

                            if (shortage > 0) {
                                currentWarningStart = slot;
                                currentShortage = shortage;
                            } else {
                                currentWarningStart = null;
                            }
                        }
                    }
                }
            }

            console.log(`検証完了: ${warnings.length}件の警告があります`);

            return {
                isValid: warnings.length === 0,
                warnings
            };
        } catch (error) {
            console.error('シフト検証エラー:', error);
            throw error;
        }
    }

    _generateTimeSlots(startTime, endTime, intervalMinutes) {
        const slots = [];
        const current = moment(startTime);

        while (current.isBefore(endTime)) {
            slots.push(current.format('HH:mm'));
            current.add(intervalMinutes, 'minutes');
        }

        return slots;
    }

    async saveShift(shiftData, storeId, year, month) {
        try {
            console.log('シフトの保存を開始します');

            let shift = await Shift.findOne({
                where: {
                    store_id: storeId,
                    year,
                    month
                }
            });

            const result = await sequelize.transaction(async (t) => {
                if (!shift) {
                    console.log('新規シフトを作成します');
                    shift = await Shift.create({
                        store_id: storeId,
                        year,
                        month,
                        status: 'draft'
                    }, { transaction: t });
                } else {
                    console.log('既存シフトを更新します');

                    await ShiftAssignment.destroy({
                        where: { shift_id: shift.id },
                        transaction: t
                    });

                    if (shift.status === 'confirmed') {
                        await shift.update({ status: 'draft' }, { transaction: t });
                        console.log('確定済みシフトをドラフト状態に変更しました');
                    }
                }

                console.log('シフト割り当てを保存します');
                for (const dayShift of shiftData.shifts) {
                    if (!dayShift.assignments || !Array.isArray(dayShift.assignments)) {
                        console.warn(`${dayShift.date}のassignmentsがありません`);
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
                    }
                }

                console.log('シフトの保存が完了しました');
                return shift;
            });

            return result;
        } catch (error) {
            console.error('シフト保存エラー:', error);
            throw error;
        }
    }

    async confirmShift(shiftId) {
        try {
            console.log(`シフト(ID: ${shiftId})の確定を開始します`);

            const shift = await Shift.findByPk(shiftId);

            if (!shift) {
                throw new Error('シフトが見つかりません');
            }

            if (shift.status === 'confirmed') {
                console.log('既に確定済みのシフトです');
                return shift;
            }

            await shift.update({ status: 'confirmed' });
            console.log('シフトを確定しました');

            return shift;
        } catch (error) {
            console.error('シフト確定エラー:', error);
            throw error;
        }
    }

    async getShiftForPrinting(shiftId) {
        try {
            console.log(`印刷用シフト(ID: ${shiftId})の取得を開始します`);

            const shift = await Shift.findByPk(shiftId, {
                include: [
                    {
                        model: Store,
                        as: 'store'
                    },
                    {
                        model: ShiftAssignment,
                        as: 'assignments',
                        include: [
                            {
                                model: Staff,
                                as: 'staff'
                            }
                        ]
                    }
                ]
            });

            if (!shift) {
                throw new Error('シフトが見つかりません');
            }

            const assignmentsByDate = {};
            const staffList = [];
            const staffMap = {};

            for (const assignment of shift.assignments) {
                if (!staffMap[assignment.staff_id]) {
                    staffMap[assignment.staff_id] = {
                        id: assignment.staff_id,
                        name: `${assignment.staff.last_name} ${assignment.staff.first_name}`,
                        position: assignment.staff.position,
                        totalHours: 0
                    };
                    staffList.push(staffMap[assignment.staff_id]);
                }

                const dateStr = moment(assignment.date).format('YYYY-MM-DD');
                if (!assignmentsByDate[dateStr]) {
                    assignmentsByDate[dateStr] = [];
                }

                let hoursWorked = this._calculateWorkingHours(
                    assignment.start_time,
                    assignment.end_time,
                    assignment.break_start_time,
                    assignment.break_end_time
                );

                staffMap[assignment.staff_id].totalHours += hoursWorked;

                assignmentsByDate[dateStr].push({
                    staff_id: assignment.staff_id,
                    staff_name: `${assignment.staff.last_name} ${assignment.staff.first_name}`,
                    start_time: moment(assignment.start_time, 'HH:mm:ss').format('HH:mm'),
                    end_time: moment(assignment.end_time, 'HH:mm:ss').format('HH:mm'),
                    break_start_time: assignment.break_start_time ?
                        moment(assignment.break_start_time, 'HH:mm:ss').format('HH:mm') : null,
                    break_end_time: assignment.break_end_time ?
                        moment(assignment.break_end_time, 'HH:mm:ss').format('HH:mm') : null,
                    hours_worked: hoursWorked
                });
            }

            const dates = Object.keys(assignmentsByDate).sort();
            const dailyShifts = dates.map(date => {
                return {
                    date,
                    day_of_week: moment(date).day(),
                    day_name: ['日', '月', '火', '水', '木', '金', '土'][moment(date).day()],
                    assignments: assignmentsByDate[date]
                };
            });

            console.log('印刷用シフトの取得が完了しました');

            return {
                store_name: shift.store.name,
                year: shift.year,
                month: shift.month,
                status: shift.status,
                daily_shifts: dailyShifts,
                staff_summary: staffList.map(staff => ({
                    ...staff,
                    totalHours: Math.round(staff.totalHours * 10) / 10
                }))
            };
        } catch (error) {
            console.error('印刷用シフト取得エラー:', error);
            throw error;
        }
    }

    _calculateWorkingHours(startTime, endTime, breakStartTime, breakEndTime) {
        const start = moment(startTime, 'HH:mm:ss');
        const end = moment(endTime, 'HH:mm:ss');

        let totalMinutes = end.diff(start, 'minutes');

        if (breakStartTime && breakEndTime) {
            const breakStart = moment(breakStartTime, 'HH:mm:ss');
            const breakEnd = moment(breakEndTime, 'HH:mm:ss');
            const breakMinutes = breakEnd.diff(breakStart, 'minutes');
            totalMinutes -= breakMinutes;
        }

        return totalMinutes / 60;
    }
}

module.exports = new ShiftGeneratorService();