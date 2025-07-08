import { computed } from 'vue';

export function useShiftRequirements(
    storeRequirements,
    shifts,
    staffList,
    hasShiftViolation,
    formatTime
) {
    /**
     * 指定日の人員要件を取得
     */
    const getDailyRequirements = (date) => {
        if (!storeRequirements.value || !date) return [];

        const targetDate = new Date(date);
        const dayOfWeek = targetDate.getDay();

        // 曜日ベースの要件を取得
        const dayRequirements = storeRequirements.value.filter(req =>
            req.day_of_week === dayOfWeek && !req.specific_date
        );

        // 特定日の要件を取得
        const specificRequirements = storeRequirements.value.filter(req =>
            req.specific_date === date
        );

        // 特定日の要件が存在する場合はそれを優先、なければ曜日ベースの要件を使用
        const requirements = specificRequirements.length > 0 ? specificRequirements : dayRequirements;

        return requirements.map(req => ({
            ...req,
            timeSlot: `${formatTime(req.start_time)}-${formatTime(req.end_time)}`,
            requiredCount: req.required_staff_count || 1
        })).sort((a, b) => a.start_time.localeCompare(b.start_time));
    };

    /**
     * 指定日に時間別の人員要件があるかチェック
     */
    const hasHourRequirements = (date) => {
        const requirements = getDailyRequirements(date);
        return requirements.length > 0;
    };

    /**
     * 指定日の時間別人員要件を取得
     */
    const getHourRequirements = (date) => {
        const requirements = getDailyRequirements(date);
        if (requirements.length === 0) return {};

        const hourRequirements = {};

        requirements.forEach(req => {
            const key = `${req.start_time}-${req.end_time}`;
            hourRequirements[key] = {
                startTime: req.start_time,
                endTime: req.end_time,
                requiredCount: req.required_staff_count || 1,
                timeSlot: `${formatTime(req.start_time)}-${formatTime(req.end_time)}`
            };
        });

        return hourRequirements;
    };

    /**
     * 指定日時に配置されているスタッフ数を取得
     */
    const getAssignedStaffCount = (date, startTime = null, endTime = null) => {
        if (!shifts.value || !date) return 0;

        const dayShifts = shifts.value.filter(shift => shift.date === date);
        if (dayShifts.length === 0) return 0;

        let assignedStaff = [];

        dayShifts.forEach(shift => {
            if (!shift.assignments) return;

            shift.assignments.forEach(assignment => {
                // 時間指定がない場合は、その日に勤務しているスタッフ数を返す
                if (!startTime || !endTime) {
                    if (!assignedStaff.includes(assignment.staff_id)) {
                        assignedStaff.push(assignment.staff_id);
                    }
                    return;
                }

                // 時間指定がある場合は、その時間帯に勤務しているスタッフ数を返す
                const assignStart = new Date(`2000-01-01T${assignment.start_time}`);
                const assignEnd = new Date(`2000-01-01T${assignment.end_time}`);
                const reqStart = new Date(`2000-01-01T${startTime}`);
                const reqEnd = new Date(`2000-01-01T${endTime}`);

                // 時間帯が重複するかチェック
                if (assignStart < reqEnd && assignEnd > reqStart) {
                    if (!assignedStaff.includes(assignment.staff_id)) {
                        assignedStaff.push(assignment.staff_id);
                    }
                }
            });
        });

        return assignedStaff.length;
    };

    /**
     * 指定日の人員要件不足をチェック
     */
    const hasRequirementShortage = (date) => {
        const requirements = getDailyRequirements(date);
        if (requirements.length === 0) return false;

        return requirements.some(req => {
            const assignedCount = getAssignedStaffCount(date, req.start_time, req.end_time);
            return assignedCount < req.required_staff_count;
        });
    };

    /**
     * 指定日のスタッフ不足をチェック（一般的な不足）
     */
    const hasStaffingShortage = (date) => {
        return hasRequirementShortage(date);
    };

    /**
     * 指定日に勤務しているスタッフを取得
     */
    const getDailyShiftStaff = (date) => {
        if (!shifts.value || !staffList.value || !date) return [];

        const dayShifts = shifts.value.filter(shift => shift.date === date);
        if (dayShifts.length === 0) return [];

        const shiftStaff = [];

        dayShifts.forEach(shift => {
            if (!shift.assignments) return;

            shift.assignments.forEach(assignment => {
                const staff = staffList.value.find(s => s.id === assignment.staff_id);
                if (staff) {
                    shiftStaff.push({
                        ...staff,
                        assignment: {
                            start_time: assignment.start_time,
                            end_time: assignment.end_time,
                            break_start_time: assignment.break_start_time,
                            break_end_time: assignment.break_end_time,
                            notes: assignment.notes
                        }
                    });
                }
            });
        });

        return shiftStaff.sort((a, b) =>
            a.assignment.start_time.localeCompare(b.assignment.start_time)
        );
    };

    /**
     * 指定日に警告があるかチェック
     */
    const hasDateWarnings = (date) => {
        if (!date) return false;

        // 人員要件不足のチェック
        if (hasRequirementShortage(date)) return true;

        // シフト制約違反のチェック
        const dayShifts = shifts.value?.filter(shift => shift.date === date) || [];

        return dayShifts.some(shift => {
            if (!shift.assignments) return false;

            return shift.assignments.some(assignment => {
                const staff = staffList.value?.find(s => s.id === assignment.staff_id);
                return staff && hasShiftViolation(staff, date, assignment);
            });
        });
    };

    /**
     * 指定日の警告内容を取得
     */
    const getDateWarnings = (date) => {
        const warnings = [];

        if (!date) return warnings;

        // 人員要件不足の警告
        const requirements = getDailyRequirements(date);
        requirements.forEach(req => {
            const assignedCount = getAssignedStaffCount(date, req.start_time, req.end_time);
            if (assignedCount < req.required_staff_count) {
                const shortage = req.required_staff_count - assignedCount;
                warnings.push({
                    type: 'requirement',
                    severity: 'error',
                    message: `${req.timeSlot}: ${shortage}人不足（${assignedCount}/${req.required_staff_count}人）`
                });
            }
        });

        // シフト制約違反の警告
        const dayShifts = shifts.value?.filter(shift => shift.date === date) || [];
        dayShifts.forEach(shift => {
            if (!shift.assignments) return;

            shift.assignments.forEach(assignment => {
                const staff = staffList.value?.find(s => s.id === assignment.staff_id);
                if (staff && hasShiftViolation) {
                    const violations = hasShiftViolation(staff, date, assignment);
                    if (violations && violations.length > 0) {
                        violations.forEach(violation => {
                            warnings.push({
                                type: 'violation',
                                severity: 'warning',
                                staffName: `${staff.last_name} ${staff.first_name}`,
                                message: violation
                            });
                        });
                    }
                }
            });
        });

        return warnings;
    };

    /**
     * 時間別の詳細な人員状況を取得
     */
    const getHourlyStaffingDetails = (date) => {
        const requirements = getDailyRequirements(date);
        if (requirements.length === 0) return {};

        const details = {};

        requirements.forEach(req => {
            const assignedCount = getAssignedStaffCount(date, req.start_time, req.end_time);
            const isShortage = assignedCount < req.required_staff_count;

            const key = `${req.start_time}-${req.end_time}`;
            details[key] = {
                timeSlot: req.timeSlot,
                startTime: req.start_time,
                endTime: req.end_time,
                requiredCount: req.required_staff_count,
                assignedCount,
                shortage: isShortage ? req.required_staff_count - assignedCount : 0,
                hasShortage: isShortage,
                status: isShortage ? 'shortage' : 'adequate'
            };
        });

        return details;
    };

    /**
     * 日付の人員配置状況サマリーを取得
     */
    const getDailyStaffingSummary = (date) => {
        const requirements = getDailyRequirements(date);
        const totalAssigned = getAssignedStaffCount(date);

        if (requirements.length === 0) {
            return {
                totalAssigned,
                hasRequirements: false,
                overallStatus: 'no_requirements',
                details: []
            };
        }

        const details = getHourlyStaffingDetails(date);
        const hasAnyShortage = Object.values(details).some(detail => detail.hasShortage);

        return {
            totalAssigned,
            hasRequirements: true,
            overallStatus: hasAnyShortage ? 'shortage' : 'adequate',
            requirementCount: requirements.length,
            shortageCount: Object.values(details).filter(detail => detail.hasShortage).length,
            details: Object.values(details)
        };
    };

    return {
        // 基本的な要件チェック
        getDailyRequirements,
        hasHourRequirements,
        getHourRequirements,

        // スタッフ配置状況
        getAssignedStaffCount,
        getDailyShiftStaff,

        // 不足チェック
        hasRequirementShortage,
        hasStaffingShortage,

        // 警告システム
        hasDateWarnings,
        getDateWarnings,

        // 詳細情報
        getHourlyStaffingDetails,
        getDailyStaffingSummary
    };
}