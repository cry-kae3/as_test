// 日付フォーマットのユーティリティ関数

// 日付をYYYY-MM-DD形式の文字列に変換
export const formatDateToISO = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

// 時間をHH:MM形式の文字列に変換
export const formatTimeToHHMM = (time) => {
    if (!time) return '';

    // 既にHH:MM形式の場合はそのまま返す
    if (typeof time === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
        return time.substring(0, 5);
    }

    const d = new Date(time);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${hours}:${minutes}`;
};

// 日付を日本語形式（YYYY年MM月DD日）に変換
export const formatDateToJP = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();

    return `${year}年${month}月${day}日`;
};

// 曜日を日本語に変換
export const getDayOfWeekJP = (dayIndex) => {
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    return dayNames[dayIndex];
};

// 曜日を日本語表記で取得（YYYY年MM月DD日（曜））
export const formatDateWithDayOfWeekJP = (date) => {
    const d = new Date(date);
    const dayOfWeek = getDayOfWeekJP(d.getDay());

    return `${formatDateToJP(date)}（${dayOfWeek}）`;
};

// 年月を日本語形式（YYYY年MM月）に変換
export const formatYearMonthToJP = (year, month) => {
    return `${year}年${month}月`;
};

// 指定した年月の日数を取得
export const getDaysInMonth = (year, month) => {
    return new Date(year, month, 0).getDate();
};

// 指定した年月の全日付の配列を取得
export const getAllDatesInMonth = (year, month) => {
    const daysInMonth = getDaysInMonth(year, month);
    const dates = [];

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        dates.push({
            date: formatDateToISO(date),
            dayOfWeek: date.getDay(),
            dayOfMonth: day
        });
    }

    return dates;
};

// 時間の差分を計算（時間単位）
export const calculateHoursBetween = (startTime, endTime) => {
    if (!startTime || !endTime) return 0;

    // HH:MM形式の文字列をDate型に変換
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);

    const start = new Date(2000, 0, 1, startHours, startMinutes);
    const end = new Date(2000, 0, 1, endHours, endMinutes);

    // 日を跨ぐ場合（endが小さい場合）、endを翌日にする
    if (end < start) {
        end.setDate(end.getDate() + 1);
    }

    const diffMs = end - start;
    const diffHours = diffMs / (1000 * 60 * 60);

    return parseFloat(diffHours.toFixed(2));
};

// 勤務時間（休憩考慮済み）を時間単位で計算する
export const calculateWorkHours = (shift) => {
    if (!shift || !shift.start_time || !shift.end_time) return 0;

    const start = new Date(`2000-01-01T${shift.start_time}:00`);
    const end = new Date(`2000-01-01T${shift.end_time}:00`);

    let workMillis = end.getTime() - start.getTime();
    if (workMillis < 0) { // 深夜シフト対応
        workMillis += 24 * 60 * 60 * 1000;
    }

    let breakMillis = 0;
    if (shift.break_start_time && shift.break_end_time) {
        const breakStart = new Date(`2000-01-01T${shift.break_start_time}:00`);
        const breakEnd = new Date(`2000-01-01T${shift.break_end_time}:00`);
        breakMillis = breakEnd.getTime() - breakStart.getTime();
        if (breakMillis < 0) { // 深夜休憩対応
            breakMillis += 24 * 60 * 60 * 1000;
        }
    }

    const netMillis = workMillis - breakMillis;
    const hours = netMillis > 0 ? netMillis / (1000 * 60 * 60) : 0;

    // 小数点第2位で丸める
    return Math.round(hours * 100) / 100;
};

// 勤務時間から必要な休憩時間を計算
export const calculateRequiredBreak = (startTime, endTime) => {
    const workHours = calculateHoursBetween(startTime, endTime);

    if (workHours > 8) {
        return 60; // 8時間超：60分（1時間）以上
    } else if (workHours > 6) {
        return 45; // 6時間超8時間以内：45分以上
    } else {
        return 0; // 6時間以内：不要
    }
};

// 現在の日本時間を取得
export const getCurrentJapanTime = () => {
    const now = new Date();
    const jst = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9時間
    return jst;
};

/**
 * シフト時間の妥当性を検証
 * @param {string} startTime 開始時間（HH:MM形式）
 * @param {string} endTime 終了時間（HH:MM形式）
 * @returns {boolean} 妥当な場合はtrue
 */
export function validateShiftTimes(startTime, endTime) {
    if (!startTime || !endTime) return false;

    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);

    // 終了時間が開始時間より後であること
    return end > start;
}

/**
 * 勤務時間と休憩時間の妥当性を検証
 * @param {string} startTime 勤務開始時間
 * @param {string} endTime 勤務終了時間
 * @param {string} breakStartTime 休憩開始時間
 * @param {string} breakEndTime 休憩終了時間
 * @returns {boolean|object} シンプルな場合はboolean、詳細な検証の場合はオブジェクト
 */
export function validateWorkAndBreakTime(startTime, endTime, breakStartTime, breakEndTime) {
    if (!startTime || !endTime) return false;

    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);

    // 休憩時間がない場合は勤務時間のみ検証
    if (!breakStartTime || !breakEndTime) {
        return end > start;
    }

    const breakStart = new Date(`2000-01-01T${breakStartTime}`);
    const breakEnd = new Date(`2000-01-01T${breakEndTime}`);

    // すべての条件をチェック
    return (
        end > start &&
        breakStart >= start &&
        breakEnd > breakStart &&
        breakEnd <= end
    );
}