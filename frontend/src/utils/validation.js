// 入力値のバリデーション関数

// メールアドレスのバリデーション
export const validateEmail = (email) => {
    const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
    return re.test(email);
};

// 必須入力のバリデーション
export const validateRequired = (value) => {
    return value !== null && value !== undefined && value !== '';
};

// 数値のバリデーション
export const validateNumber = (value) => {
    return !isNaN(Number(value));
};

// 整数のバリデーション
export const validateInteger = (value) => {
    const num = Number(value);
    return !isNaN(num) && Number.isInteger(num);
};

// 正の数のバリデーション
export const validatePositiveNumber = (value) => {
    const num = Number(value);
    return !isNaN(num) && num > 0;
};

// 正の整数または0のバリデーション
export const validateNonNegativeInteger = (value) => {
    const num = Number(value);
    return !isNaN(num) && Number.isInteger(num) && num >= 0;
};

// 範囲のバリデーション
export const validateRange = (value, min, max) => {
    const num = Number(value);
    return !isNaN(num) && num >= min && num <= max;
};

// 時間形式（HH:MM）のバリデーション
export const validateTimeFormat = (value) => {
    const re = /^([01]\d|2[0-3]):([0-5]\d)$/;
    return re.test(value);
};

// 日付形式（YYYY-MM-DD）のバリデーション
export const validateDateFormat = (value) => {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!re.test(value)) return false;

    const date = new Date(value);
    return date instanceof Date && !isNaN(date);
};

// パスワードの強度のバリデーション
export const validatePasswordStrength = (password) => {
    // 最低8文字、大文字、小文字、数字を含む
    const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return re.test(password);
};

// 電話番号のバリデーション
export const validatePhoneNumber = (phone) => {
    // 日本の電話番号形式（ハイフンあり/なし両対応）
    const re = /^(0\d{1,4}(-|\s)?)?\d{1,4}(-|\s)?\d{4}$/;
    return re.test(phone);
};

// 曜日のバリデーション（0-6）
export const validateDayOfWeek = (day) => {
    const num = Number(day);
    return !isNaN(num) && Number.isInteger(num) && num >= 0 && num <= 6;
};

// シフト時間の整合性チェック
export const validateShiftTimes = (startTime, endTime, breakStartTime, breakEndTime) => {
    if (!startTime || !endTime || !validateTimeFormat(startTime) || !validateTimeFormat(endTime)) {
        return { valid: false, message: '開始時間と終了時間は必須です' };
    }

    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);

    if (start >= end) {
        return { valid: false, message: '終了時間は開始時間よりも後である必要があります' };
    }

    // 休憩時間のチェック
    if (breakStartTime && breakEndTime) {
        if (!validateTimeFormat(breakStartTime) || !validateTimeFormat(breakEndTime)) {
            return { valid: false, message: '休憩時間は HH:MM 形式で入力してください' };
        }

        const breakStart = new Date(`2000-01-01T${breakStartTime}`);
        const breakEnd = new Date(`2000-01-01T${breakEndTime}`);

        if (breakStart >= breakEnd) {
            return { valid: false, message: '休憩終了時間は休憩開始時間よりも後である必要があります' };
        }

        if (breakStart <= start || breakEnd >= end) {
            return { valid: false, message: '休憩時間はシフト時間内に収まる必要があります' };
        }
    } else if (breakStartTime || breakEndTime) {
        return { valid: false, message: '休憩開始時間と休憩終了時間は両方とも入力してください' };
    }

    return { valid: true };
};

// 労働時間と法定休憩時間のチェック
export const validateWorkAndBreakTime = (startTime, endTime, breakStartTime, breakEndTime) => {
    if (!startTime || !endTime) {
        return { valid: false, message: '開始時間と終了時間は必須です' };
    }

    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);

    const workDurationMs = end - start;
    const workHours = workDurationMs / (1000 * 60 * 60);

    let breakDurationMs = 0;

    if (breakStartTime && breakEndTime) {
        const breakStart = new Date(`2000-01-01T${breakStartTime}`);
        const breakEnd = new Date(`2000-01-01T${breakEndTime}`);
        breakDurationMs = breakEnd - breakStart;
    }

    const breakMinutes = breakDurationMs / (1000 * 60);

    // 労働基準法に基づく休憩時間のチェック
    if (workHours > 8) {
        if (breakMinutes < 60) {
            return { valid: false, message: '8時間超の勤務には最低60分の休憩が必要です' };
        }
    } else if (workHours > 6) {
        if (breakMinutes < 45) {
            return { valid: false, message: '6時間超の勤務には最低45分の休憩が必要です' };
        }
    }

    return { valid: true };
  };