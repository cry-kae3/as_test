// frontend/src/composables/useShiftRequirements.js
import { computed } from 'vue';

export function useShiftRequirements() {

    const getDailyRequirements = (storeRequirements, date) => {
        if (!storeRequirements || !storeRequirements.length) {
            return [];
        }

        const dayOfWeek = new Date(date).getDay();

        // 特定日の要件を優先
        const specificRequirements = storeRequirements.filter(req =>
            req.specific_date === date
        );

        if (specificRequirements.length > 0) {
            return specificRequirements.sort((a, b) => {
                const timeA = a.start_time.replace(':', '');
                const timeB = b.start_time.replace(':', '');
                return timeA.localeCompare(timeB);
            });
        }

        // 曜日ベースの要件
        const dayRequirements = storeRequirements.filter(req =>
            req.day_of_week === dayOfWeek && !req.specific_date
        );

        return dayRequirements.sort((a, b) => {
            const timeA = a.start_time.replace(':', '');
            const timeB = b.start_time.replace(':', '');
            return timeA.localeCompare(timeB);
        });
    };

    const hasHourRequirements = (storeRequirements, date) => {
        return getDailyRequirements(storeRequirements, date).length > 0;
    };

    const getHourRequirements = (storeRequirements, date) => {
        const requirements = getDailyRequirements(storeRequirements, date);

        return requirements.map(req => ({
            id: req.id,
            start_time: req.start_time,
            end_time: req.end_time,
            required_staff_count: req.required_staff_count,
            timeSlot: `${req.start_time}-${req.end_time}`,
            isSpecificDate: !!req.specific_date
        }));
    };

    const hasRequirementShortage = (storeRequirements, shifts, date) => {
        if (!hasHourRequirements(storeRequirements, date)) {
            return false;
        }

        const requirements = getHourRequirements(storeRequirements, date);
        const dayShifts = shifts.filter(shift => shift.date === date);

        return requirements.some(req => {
            const assignedCount = getAssignedStaffCount(dayShifts, req.start_time, req.end_time);
            return assignedCount < req.required_staff_count;
        });
    };

    const hasStaffingShortage = (storeRequirements, shifts, date) => {
        return hasRequirementShortage(storeRequirements, shifts, date);
    };

    const getAssignedStaffCount = (dayShifts, startTime, endTime) => {
        if (!dayShifts || !dayShifts.length) {
            return 0;
        }

        const reqStart = convertTimeToMinutes(startTime);
        const reqEnd = convertTimeToMinutes(endTime);

        return dayShifts.filter(shiftDay => {
            if (!shiftDay.assignments) return false;

            return shiftDay.assignments.some(assignment => {
                const assignStart = convertTimeToMinutes(assignment.start_time);
                const assignEnd = convertTimeToMinutes(assignment.end_time);

                // 時間帯の重複チェック
                return assignStart < reqEnd && assignEnd > reqStart;
            });
        }).length;
    };

    const convertTimeToMinutes = (timeString) => {
        if (!timeString) return 0;
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
    };

    const hasDateWarnings = (storeRequirements, shifts, date) => {
        const warnings = getDateWarnings(storeRequirements, shifts, date);
        return warnings.length > 0;
    };

    const getDateWarnings = (storeRequirements, shifts, date) => {
        const warnings = [];

        if (!hasHourRequirements(storeRequirements, date)) {
            return warnings;
        }

        const requirements = getHourRequirements(storeRequirements, date);
        const dayShifts = shifts.filter(shift => shift.date === date);

        requirements.forEach(req => {
            const assignedCount = getAssignedStaffCount(dayShifts, req.start_time, req.end_time);
            const shortage = req.required_staff_count - assignedCount;

            if (shortage > 0) {
                warnings.push(`${req.timeSlot}: ${shortage}名不足 (必要${req.required_staff_count}名/配置${assignedCount}名)`);
            }
        });

        return warnings;
    };

    const getDailyShiftStaff = (shifts, date) => {
        if (!shifts || !shifts.length) {
            return [];
        }

        const dayShift = shifts.find(shift => shift.date === date);
        if (!dayShift || !dayShift.assignments) {
            return [];
        }

        return dayShift.assignments.map(assignment => ({
            id: assignment.id,
            staff_id: assignment.staff_id,
            staff_name: assignment.staff_name,
            start_time: assignment.start_time,
            end_time: assignment.end_time,
            break_start_time: assignment.break_start_time,
            break_end_time: assignment.break_end_time,
            notes: assignment.notes
        }));
    };

    const getRequirementStatus = (storeRequirements, shifts, date, startTime, endTime) => {
        if (!hasHourRequirements(storeRequirements, date)) {
            return {
                hasRequirement: false,
                required: 0,
                assigned: 0,
                shortage: 0,
                isShortage: false
            };
        }

        const requirements = getHourRequirements(storeRequirements, date);
        const dayShifts = shifts.filter(shift => shift.date === date);

        // 指定された時間帯に該当する要件を検索
        const matchingReq = requirements.find(req =>
            req.start_time === startTime && req.end_time === endTime
        );

        if (!matchingReq) {
            return {
                hasRequirement: false,
                required: 0,
                assigned: 0,
                shortage: 0,
                isShortage: false
            };
        }

        const assignedCount = getAssignedStaffCount(dayShifts, startTime, endTime);
        const shortage = Math.max(0, matchingReq.required_staff_count - assignedCount);

        return {
            hasRequirement: true,
            required: matchingReq.required_staff_count,
            assigned: assignedCount,
            shortage: shortage,
            isShortage: shortage > 0,
            timeSlot: matchingReq.timeSlot
        };
    };

    const getAllRequirementsForDate = (storeRequirements, shifts, date) => {
        const requirements = getHourRequirements(storeRequirements, date);
        const dayShifts = shifts.filter(shift => shift.date === date);

        return requirements.map(req => {
            const assignedCount = getAssignedStaffCount(dayShifts, req.start_time, req.end_time);
            const shortage = Math.max(0, req.required_staff_count - assignedCount);

            return {
                ...req,
                assigned: assignedCount,
                shortage: shortage,
                isShortage: shortage > 0,
                isSufficient: shortage === 0,
                isOverstaffed: assignedCount > req.required_staff_count
            };
        });
    };

    const getTotalDailyRequiredStaff = (storeRequirements, date) => {
        const requirements = getHourRequirements(storeRequirements, date);
        if (!requirements.length) return 0;

        // 最大同時必要人数を計算
        const timeSlots = [];
        requirements.forEach(req => {
            const startMinutes = convertTimeToMinutes(req.start_time);
            const endMinutes = convertTimeToMinutes(req.end_time);

            for (let time = startMinutes; time < endMinutes; time += 30) {
                const existing = timeSlots.find(slot => slot.time === time);
                if (existing) {
                    existing.count += req.required_staff_count;
                } else {
                    timeSlots.push({ time, count: req.required_staff_count });
                }
            }
        });

        return Math.max(...timeSlots.map(slot => slot.count), 0);
    };

    const getRequirementsSummary = (storeRequirements, shifts, daysInMonth) => {
        const summary = {
            totalDays: daysInMonth.length,
            daysWithRequirements: 0,
            daysWithShortage: 0,
            totalShortageCount: 0,
            requirementDetails: []
        };

        daysInMonth.forEach(day => {
            const requirements = getAllRequirementsForDate(storeRequirements, shifts, day.date);

            if (requirements.length > 0) {
                summary.daysWithRequirements++;

                const dayShortages = requirements.filter(req => req.isShortage);
                if (dayShortages.length > 0) {
                    summary.daysWithShortage++;
                    summary.totalShortageCount += dayShortages.reduce((sum, req) => sum + req.shortage, 0);
                }

                summary.requirementDetails.push({
                    date: day.date,
                    dayOfWeek: day.dayOfWeek,
                    requirements: requirements,
                    hasShortage: dayShortages.length > 0,
                    shortageCount: dayShortages.reduce((sum, req) => sum + req.shortage, 0)
                });
            }
        });

        return summary;
    };

    return {
        getDailyRequirements,
        hasHourRequirements,
        getHourRequirements,
        hasRequirementShortage,
        hasStaffingShortage,
        getAssignedStaffCount,
        hasDateWarnings,
        getDateWarnings,
        getDailyShiftStaff,
        getRequirementStatus,
        getAllRequirementsForDate,
        getTotalDailyRequiredStaff,
        getRequirementsSummary,
        convertTimeToMinutes
    };
}