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

            return shiftStartTime < reqEndTime && shiftEndTime > reqStartTime;
        }).length;
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
        parseTimeToFloat,
    };
}