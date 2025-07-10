import { computed } from "vue";

export function useShiftRequirements() {

    // 日次要件取得
    const getDailyRequirements = (date, storeRequirements) => {
        if (!storeRequirements || storeRequirements.length === 0) {
            return [];
        }

        const dayOfWeek = new Date(date).getDay();

        const specificRequirements = storeRequirements.filter(
            (req) => req.specific_date && req.specific_date === date
        );

        if (specificRequirements.length > 0) {
            return specificRequirements;
        }

        return storeRequirements.filter(
            (req) => req.day_of_week === dayOfWeek && !req.specific_date
        );
    };

    // 時間要件があるかチェック
    const hasHourRequirements = (date, hour, storeRequirements) => {
        const requirements = getDailyRequirements(date, storeRequirements);
        return requirements.some((req) => {
            const reqStartHour = parseTimeToFloat(req.start_time);
            const reqEndHour = parseTimeToFloat(req.end_time);
            return hour >= reqStartHour && hour < reqEndHour;
        });
    };

    // 時間要件取得
    const getHourRequirements = (date, hour, storeRequirements) => {
        const requirements = getDailyRequirements(date, storeRequirements);
        return requirements.filter((req) => {
            const reqStartHour = parseTimeToFloat(req.start_time);
            const reqEndHour = parseTimeToFloat(req.end_time);
            return hour >= reqStartHour && hour < reqEndHour;
        });
    };

    // 要件不足があるかチェック
    const hasRequirementShortage = (date, requirement, shifts) => {
        const assignedCount = getAssignedStaffCount(date, requirement, shifts);
        return assignedCount < requirement.required_staff_count;
    };

    // 人員不足があるかチェック
    const hasStaffingShortage = (date, requirement, shifts) => {
        const assignedCount = getAssignedStaffCount(date, requirement, shifts);
        return assignedCount < requirement.required_staff_count;
    };

    // 割り当てられたスタッフ数取得
    const getAssignedStaffCount = (date, requirement, shifts) => {
        const dayShifts = shifts.find((shift) => shift.date === date);
        if (!dayShifts) return 0;

        const reqStartTime = parseTimeToFloat(requirement.start_time);
        const reqEndTime = parseTimeToFloat(requirement.end_time);

        return dayShifts.assignments.filter((assignment) => {
            const shiftStartTime = parseTimeToFloat(assignment.start_time);
            const shiftEndTime = parseTimeToFloat(assignment.end_time);

            // 休憩時間を考慮した実働判定
            let isWorkingDuringRequirement = false;

            // シフトと要件時間帯が重複しているかチェック
            if (shiftStartTime < reqEndTime && shiftEndTime > reqStartTime) {
                // 休憩時間がある場合
                if (assignment.break_start_time && assignment.break_end_time) {
                    const breakStartTime = parseTimeToFloat(assignment.break_start_time);
                    const breakEndTime = parseTimeToFloat(assignment.break_end_time);

                    // 休憩時間と要件時間帯が完全に重複している場合は除外
                    if (breakStartTime <= reqStartTime && breakEndTime >= reqEndTime) {
                        isWorkingDuringRequirement = false;
                    } else {
                        // 部分的に勤務している場合はカウント
                        isWorkingDuringRequirement = true;
                    }
                } else {
                    // 休憩時間がない場合はカウント
                    isWorkingDuringRequirement = true;
                }
            }

            return isWorkingDuringRequirement;
        }).length;
    };

    // 日付に人員不足があるかチェック（新規追加）
    const hasDateStaffingShortage = (date, storeRequirements, shifts) => {
        const requirements = getDailyRequirements(date, storeRequirements);
        return requirements.some((req) => hasStaffingShortage(date, req, shifts));
    };

    // 日付警告があるかチェック
    const hasDateWarnings = (date, storeRequirements, shifts, staffList, hasShiftViolation) => {
        const requirements = getDailyRequirements(date, storeRequirements);

        // 人員要件のチェック
        const hasStaffingIssues = requirements.some((req) => hasStaffingShortage(date, req, shifts));

        // スタッフ勤務条件違反のチェック - staffListがundefinedまたはnullの場合の対応
        const hasStaffViolations = staffList && Array.isArray(staffList)
            ? staffList.some((staff) => hasShiftViolation(date, staff.id))
            : false;

        return hasStaffingIssues || hasStaffViolations;
    };

    // 日付警告取得
    const getDateWarnings = (date, storeRequirements, shifts, staffList, hasShiftViolation, formatTime) => {
        const warnings = [];
        const requirements = getDailyRequirements(date, storeRequirements);

        requirements.forEach((req) => {
            if (hasStaffingShortage(date, req, shifts)) {
                const assigned = getAssignedStaffCount(date, req, shifts);
                warnings.push({
                    type: "staffing_shortage",
                    icon: "pi pi-users",
                    message: `${formatTime(req.start_time)}-${formatTime(
                        req.end_time
                    )}: 人員不足 (${assigned}/${req.required_staff_count}名)`,
                    severity: "error",
                    assignedCount: assigned,
                    requiredCount: req.required_staff_count,
                    requirement: req
                });
            }
        });

        // staffListがundefinedまたはnullの場合の対応
        if (staffList && Array.isArray(staffList)) {
            staffList.forEach((staff) => {
                if (hasShiftViolation(date, staff.id)) {
                    warnings.push({
                        type: "staff_violation",
                        icon: "pi pi-exclamation-triangle",
                        message: `${staff.last_name} ${staff.first_name}: 勤務条件違反`,
                        severity: "warning"
                    });
                }
            });
        }

        return warnings;
    };

    // 日次シフトスタッフ取得
    const getDailyShiftStaff = (date, staffList, shifts) => {
        if (!date || !staffList || !Array.isArray(staffList)) return [];

        const dayShifts = shifts.find((shift) => shift.date === date);
        if (!dayShifts || !dayShifts.assignments) return [];

        const shiftStaffIds = dayShifts.assignments.map(
            (assignment) => assignment.staff_id
        );

        return staffList.filter((staff) =>
            shiftStaffIds.includes(staff.id)
        );
    };

    // 時間帯別の人員情報を取得（新規追加）
    const getHourlyStaffingInfo = (date, hour, storeRequirements, shifts) => {
        const requirements = getHourRequirements(date, hour, storeRequirements);
        const staffingInfo = [];

        requirements.forEach((req) => {
            const assignedCount = getAssignedStaffCount(date, req, shifts);
            const requiredCount = req.required_staff_count;
            const hasShortage = assignedCount < requiredCount;

            staffingInfo.push({
                requirement: req,
                assignedCount,
                requiredCount,
                hasShortage,
                shortageCount: requiredCount - assignedCount
            });
        });

        return staffingInfo;
    };

    // 時間を浮動小数点数にパース
    const parseTimeToFloat = (timeStr) => {
        const [hours, minutes] = timeStr.split(":").map(Number);
        return hours + minutes / 60;
    };

    return {
        // メソッド
        getDailyRequirements,
        hasHourRequirements,
        getHourRequirements,
        hasRequirementShortage,
        hasStaffingShortage,
        getAssignedStaffCount,
        hasDateWarnings,
        getDateWarnings,
        getDailyShiftStaff,
        hasDateStaffingShortage,
        getHourlyStaffingInfo,
        parseTimeToFloat,
    };
}