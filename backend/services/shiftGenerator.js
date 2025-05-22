const { anthropic, DEFAULT_AI_PARAMS } = require('../config/claude');
const { Store, Staff, StaffDayPreference, StaffDayOffRequest,
    StoreClosedDay, StoreStaffRequirement, Shift, ShiftAssignment } = require('../models');
const { Op, sequelize } = require('sequelize');
const moment = require('moment-timezone');

// シフト生成サービス
class ShiftGeneratorService {
    // 指定された年月のシフトを生成
    async generateShift(storeId, year, month) {
        try {
            // 店舗情報の取得
            const store = await Store.findByPk(storeId, {
                include: [
                    { model: StoreClosedDay, as: 'closedDays' },
                    { model: StoreStaffRequirement, as: 'staffRequirements' }
                ]
            });

            if (!store) {
                throw new Error('店舗が見つかりません');
            }

            // スタッフ情報の取得
            const staff = await Staff.findAll({
                where: { store_id: storeId },
                include: [
                    { model: StaffDayPreference, as: 'dayPreferences' }
                ]
            });

            if (staff.length === 0) {
                throw new Error('スタッフが登録されていません');
            }

            // 対象月の開始日と終了日
            const startDate = moment(`${year}-${month}-01`);
            const endDate = moment(startDate).endOf('month');
            const daysInMonth = endDate.date();

            // スタッフの休み希望の取得
            const dayOffRequests = await StaffDayOffRequest.findAll({
                where: {
                    staff_id: staff.map(s => s.id),
                    date: {
                        [Op.between]: [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]
                    },
                    status: ['pending', 'approved']  // 承認済みと保留中の休み希望を考慮
                }
            });

            // Claude AIに渡すデータの準備
            const storeData = this._formatStoreData(store);
            const staffData = this._formatStaffData(staff, dayOffRequests);
            const calendarData = this._generateCalendarData(year, month, daysInMonth);
            const requirementsData = this._formatRequirementsData(store, year, month, daysInMonth);

            // Claude AIに入力するプロンプトの作成
            const prompt = this._generatePrompt(storeData, staffData, calendarData, requirementsData, year, month);

            console.log('Claude APIにリクエスト送信中...');

            // Claude APIを呼び出してシフトを生成
            const response = await anthropic.messages.create({
                ...DEFAULT_AI_PARAMS,
                system: "あなたはシフト最適化と生成の専門家です。労働基準法を遵守しながら、人員要件と従業員の希望休みを考慮して最適なシフトを作成します。JSONフォーマット形式で出力してください。",
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.1 // 決定論的な結果のために低い温度を設定
            });

            console.log('Claude APIからレスポンスを受信しました');

            // レスポンスを解析してシフトデータを抽出
            const shiftData = this._parseAIResponse(response.content[0].text);

            // シフトの検証
            const validationResult = await this.validateShift(shiftData, storeId, year, month);

            // 警告があればシフトデータに追加
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

    // 店舗データをフォーマット
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

    // スタッフデータをフォーマット
    _formatStaffData(staff, dayOffRequests) {
        const staffData = staff.map(s => {
            // スタッフの休み希望を取得
            const daysOff = dayOffRequests
                .filter(req => req.staff_id === s.id)
                .map(req => ({
                    date: moment(req.date).format('YYYY-MM-DD'),
                    reason: req.reason,
                    status: req.status
                }));

            // 曜日ごとの希望を曜日名に変換して見やすくする
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

    // カレンダーデータを生成
    _generateCalendarData(year, month, daysInMonth) {
        const calendarData = [];
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

        for (let day = 1; day <= daysInMonth; day++) {
            const date = moment(`${year}-${month}-${day}`);
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

    // 人員要件データをフォーマット
    _formatRequirementsData(store, year, month, daysInMonth) {
        const requirementsData = [];

        for (let day = 1; day <= daysInMonth; day++) {
            const date = moment(`${year}-${month}-${day}`);
            const dayOfWeek = date.day();
            const dateStr = date.format('YYYY-MM-DD');

            // 曜日ごとの人員要件を取得
            const regularRequirements = store.staffRequirements
                .filter(req => req.day_of_week === dayOfWeek && !req.specific_date);

            // 特定日の人員要件を取得
            const specialRequirements = store.staffRequirements
                .filter(req => req.specific_date && moment(req.specific_date).format('YYYY-MM-DD') === dateStr);

            // 特定日の要件があればそれを優先、なければ曜日ごとの要件を使用
            const dayRequirements = specialRequirements.length > 0 ? specialRequirements : regularRequirements;

            // 時間帯ごとに整形
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

    // Claude AIへのプロンプトを生成
    _generatePrompt(storeData, staffData, calendarData, requirementsData, year, month) {
        const monthNames = [
            '1月', '2月', '3月', '4月', '5月', '6月',
            '7月', '8月', '9月', '10月', '11月', '12月'
        ];

        // 休業日情報をわかりやすく整形
        const closedDaysInfo = storeData.closed_days.map(day => {
            if (day.specific_date) {
                return `${day.specific_date}`;
            } else if (day.day_of_week !== null) {
                const dayNames = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
                return dayNames[day.day_of_week];
            }
            return '';
        }).join(', ');

        return `
# シフト生成リクエスト

## 年月
${year}年${monthNames[month - 1]}（${month}月）

## 店舗情報
店舗名: ${storeData.name}
営業時間: ${storeData.opening_time}～${storeData.closing_time}
定休日: ${closedDaysInfo}

## スタッフ情報
${JSON.stringify(staffData, null, 2)}

## カレンダー情報
${JSON.stringify(calendarData, null, 2)}

## 人員要件
${JSON.stringify(requirementsData, null, 2)}

## 作成ルール
1. 労働基準法を遵守すること
   - 6時間超8時間以内の勤務には最低45分の休憩が必要
   - 8時間超の勤務には最低1時間の休憩が必要
2. スタッフの希望シフト（曜日・時間帯）をできる限り尊重すること
3. スタッフの休み希望は必ず尊重すること（絶対条件）
4. スタッフの最大・最小勤務時間を尊重すること
5. 各スタッフの勤務時間をできるだけ均等にすること
6. 最大連続勤務日数を超えないようにすること
7. 定休日には誰もシフトに入れないこと
8. 各時間帯で必要な人員数を満たすこと

## 出力形式
JSONフォーマットで、以下の構造で出力してください。必ずJSON形式で返してください。

\`\`\`json
{
    "shifts": [
        {
            "date": "YYYY-MM-DD",
            "assignments": [
                {
                    "staff_id": 1,
                    "staff_name": "山田 太郎",
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
                "staff_name": "山田 太郎",
                "total_hours": 160
            }
        ],
        "staffingWarnings": [
            {
                "date": "YYYY-MM-DD",
                "time_range": "09:00-12:00",
                "required": 2,
                "assigned": 1,
                "message": "人員が不足しています"
            }
        ]
    }
}
\`\`\`

必ず上記のJSON形式で出力してください。各スタッフの勤務パターンや休憩時間を考慮して、最適なシフトを生成してください。また、シフト要件が満たされない場合は警告を出力してください。

要件を満たせない場合は、以下の優先順位で対応してください：
1. 休み希望は絶対に尊重する
2. 労働基準法（休憩時間など）は必ず守る
3. できるだけ人員要件を満たす（満たせない場合は警告を出す）
4. できるだけ希望シフトを尊重する
5. できるだけ勤務時間を均等にする

細かいルール：
- 営業時間外にはシフトを入れない
- 休憩時間は労働時間に含めない
- 日をまたぐシフトは作成しない（深夜帯は当日の終了時間まで）
- 同じ日に複数回出勤するシフトは作成しない（1日1回のみ）
`;
    }

    // Claude AIのレスポンスを解析
    _parseAIResponse(response) {
        try {
            console.log('AIレスポンスの解析を開始します');

            // JSONデータを抽出
            const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);

            if (!jsonMatch || !jsonMatch[1]) {
                console.error('JSONデータが見つかりません:', response);
                throw new Error('AIレスポンスからJSONデータを抽出できませんでした');
            }

            const jsonString = jsonMatch[1].trim();
            console.log('JSON文字列を抽出しました');

            // JSONをパース
            try {
                const shiftData = JSON.parse(jsonString);
                console.log('JSONのパースに成功しました');
                return shiftData;
            } catch (parseError) {
                console.error('JSONパースエラー:', parseError);
                console.error('問題のある文字列:', jsonString);

                // エラー箇所を特定するための処理
                const lines = jsonString.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    try {
                        JSON.parse(lines.slice(0, i + 1).join('\n'));
                    } catch (lineError) {
                        console.error(`エラー発生行: ${i + 1}行目`, lines[i]);
                        break;
                    }
                }

                throw new Error('JSONのパースに失敗しました: ' + parseError.message);
            }
        } catch (error) {
            console.error('AIレスポンス解析エラー:', error);
            throw new Error('AIレスポンスの解析に失敗しました: ' + error.message);
        }
    }

    // 生成されたシフトの警告を検証
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

            // 各日付のシフトを検証
            for (const dayShift of shiftData.shifts) {
                const date = moment(dayShift.date);
                const dayOfWeek = date.day();

                // 特定日の人員要件を取得
                const specialRequirements = store.staffRequirements
                    .filter(req => req.specific_date && moment(req.specific_date).format('YYYY-MM-DD') === dayShift.date);

                // 曜日ごとの人員要件を取得
                const regularRequirements = store.staffRequirements
                    .filter(req => req.day_of_week === dayOfWeek && !req.specific_date);

                // 特定日の要件があればそれを優先、なければ曜日ごとの要件を使用
                const requirements = specialRequirements.length > 0 ? specialRequirements : regularRequirements;

                // 人員要件がない場合はスキップ
                if (requirements.length === 0) {
                    continue;
                }

                // 各時間帯の人員要件を検証
                for (const requirement of requirements) {
                    const startTime = moment(requirement.start_time, 'HH:mm:ss');
                    const endTime = moment(requirement.end_time, 'HH:mm:ss');

                    // 時間範囲を15分単位で分割して人員をカウント
                    const timeSlots = this._generateTimeSlots(startTime, endTime, 15);

                    // 各時間スロットでの人員をカウント
                    const staffCounts = {};
                    timeSlots.forEach(slot => {
                        staffCounts[slot] = 0;
                    });

                    // assignments配列がない場合は空配列として扱う
                    const assignments = dayShift.assignments || [];

                    for (const assignment of assignments) {
                        const assignmentStart = moment(assignment.start_time, 'HH:mm');
                        const assignmentEnd = moment(assignment.end_time, 'HH:mm');

                        // 休憩時間を考慮
                        const breakStart = assignment.break_start_time ? moment(assignment.break_start_time, 'HH:mm') : null;
                        const breakEnd = assignment.break_end_time ? moment(assignment.break_end_time, 'HH:mm') : null;

                        // 各時間スロットでスタッフがいるかチェック
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

                    // 人員不足の時間帯を特定
                    let currentWarningStart = null;
                    let currentShortage = 0;

                    // すべての時間スロットをチェック
                    for (let i = 0; i < timeSlots.length; i++) {
                        const slot = timeSlots[i];
                        const staffCount = staffCounts[slot];
                        const shortage = requirement.required_staff_count - staffCount;

                        // 人員不足の時間帯の開始
                        if (shortage > 0 && currentWarningStart === null) {
                            currentWarningStart = slot;
                            currentShortage = shortage;
                        }
                        // 人員不足の程度が変わった、または十分な人員になった
                        else if (currentWarningStart !== null &&
                            (shortage !== currentShortage || shortage <= 0 || i === timeSlots.length - 1)) {

                            // 警告を作成
                            if (currentShortage > 0) {
                                warnings.push({
                                    date: dayShift.date,
                                    time_range: `${currentWarningStart}-${slot}`,
                                    required: requirement.required_staff_count,
                                    assigned: requirement.required_staff_count - currentShortage,
                                    message: `人員が不足しています（必要: ${requirement.required_staff_count}名, 割当: ${requirement.required_staff_count - currentShortage}名）`
                                });
                            }

                            // 新しい警告状態を設定
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

    // 時間範囲を一定間隔で分割
    _generateTimeSlots(startTime, endTime, intervalMinutes) {
        const slots = [];
        const current = moment(startTime);

        while (current.isBefore(endTime)) {
            slots.push(current.format('HH:mm'));
            current.add(intervalMinutes, 'minutes');
        }

        return slots;
    }

    // データベースにシフトを保存
    async saveShift(shiftData, storeId, year, month) {
        try {
            console.log('シフトの保存を開始します');

            // 既存のシフトを検索
            let shift = await Shift.findOne({
                where: {
                    store_id: storeId,
                    year,
                    month
                }
            });

            // トランザクションを開始
            const result = await sequelize.transaction(async (t) => {
                // シフトが存在しない場合は新規作成
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
                    // シフトが存在する場合はステータスを確認
                    if (shift.status === 'confirmed') {
                        throw new Error('既に確定済みのシフトは更新できません');
                    }

                    // 既存のシフト割り当てを削除
                    await ShiftAssignment.destroy({
                        where: { shift_id: shift.id },
                        transaction: t
                    });
                }

                console.log('シフト割り当てを保存します');
                // シフト割り当てを保存
                for (const dayShift of shiftData.shifts) {
                    // assignments配列がない場合は次の日に進む
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

    // シフトを確定
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

    // シフトを印刷用フォーマットで取得
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

            // 日付ごとにシフトをグループ化
            const assignmentsByDate = {};
            const staffList = [];
            const staffMap = {};

            // スタッフのリストを作成
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

                // 日付ごとにグループ化
                const dateStr = moment(assignment.date).format('YYYY-MM-DD');
                if (!assignmentsByDate[dateStr]) {
                    assignmentsByDate[dateStr] = [];
                }

                // 勤務時間を計算（休憩時間を除く）
                let hoursWorked = this._calculateWorkingHours(
                    assignment.start_time,
                    assignment.end_time,
                    assignment.break_start_time,
                    assignment.break_end_time
                );

                // スタッフの総勤務時間を更新
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

            // 結果を整形
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
                    totalHours: Math.round(staff.totalHours * 10) / 10 // 小数点第1位まで
                }))
            };
        } catch (error) {
            console.error('印刷用シフト取得エラー:', error);
            throw error;
        }
    }

    // 勤務時間を計算（休憩時間を除く）
    _calculateWorkingHours(startTime, endTime, breakStartTime, breakEndTime) {
        const start = moment(startTime, 'HH:mm:ss');
        const end = moment(endTime, 'HH:mm:ss');

        let totalMinutes = end.diff(start, 'minutes');

        // 休憩時間があれば差し引く
        if (breakStartTime && breakEndTime) {
            const breakStart = moment(breakStartTime, 'HH:mm:ss');
            const breakEnd = moment(breakEndTime, 'HH:mm:ss');
            const breakMinutes = breakEnd.diff(breakStart, 'minutes');
            totalMinutes -= breakMinutes;
        }

        return totalMinutes / 60; // 時間単位に変換
    }
}

module.exports = new ShiftGeneratorService();