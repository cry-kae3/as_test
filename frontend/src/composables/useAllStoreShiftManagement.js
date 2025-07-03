import { ref } from "vue";
import { useStore } from "vuex";
import api from "@/services/api";

export function useAllStoreShiftManagement() {
    const store = useStore();

    const allStoreShifts = ref({});
    const allSystemStaff = ref([]);
    const allSystemStoreShifts = ref({});

    // 全店舗のシフトデータ取得
    const fetchAllStoreShifts = async (staffList, selectedStore, currentYear, currentMonth) => {
        if (
            !staffList ||
            staffList.length === 0 ||
            !selectedStore
        ) {
            return;
        }

        try {
            const uniqueStoreIds = new Set();

            staffList.forEach((staff) => {
                let storeIds = [];
                if (staff.store_ids && Array.isArray(staff.store_ids)) {
                    storeIds = staff.store_ids;
                } else if (staff.stores && Array.isArray(staff.stores)) {
                    storeIds = staff.stores.map((s) => s.id);
                }

                storeIds.forEach((id) => {
                    if (id !== selectedStore.id) {
                        uniqueStoreIds.add(id);
                    }
                });
            });

            const storeShiftsPromises = Array.from(uniqueStoreIds).map(
                async (storeId) => {
                    try {
                        const response = await store.dispatch(
                            "shift/fetchShiftByYearMonth",
                            {
                                year: currentYear,
                                month: currentMonth,
                                storeId: storeId,
                            }
                        );
                        return { storeId, shifts: response?.shifts || [] };
                    } catch (error) {
                        return { storeId, shifts: [] };
                    }
                }
            );

            const results = await Promise.all(storeShiftsPromises);

            allStoreShifts.value = {};
            let totalOtherStoreShifts = 0;

            results.forEach(({ storeId, shifts }) => {
                allStoreShifts.value[storeId] = shifts;
                totalOtherStoreShifts += shifts.length;
            });
        } catch (error) {
            allStoreShifts.value = {};
        }
    };

    // 全システムのスタッフとシフトデータ取得
    const fetchAllSystemStaffAndShifts = async (currentYear, currentMonth) => {
        try {
            // 全店舗データを取得
            const allStores = await store.dispatch("store/fetchStores");

            // 全スタッフデータを取得
            const allStaffPromises = allStores.map(async (store) => {
                try {
                    const staffData = await api.get(`/staff?store_id=${store.id}`);
                    return staffData.data.map((staff) => ({
                        ...staff,
                        storeName: store.name,
                        mainStoreId: store.id,
                    }));
                } catch (error) {
                    return [];
                }
            });

            const allStaffResults = await Promise.all(allStaffPromises);
            const allStaffFlat = allStaffResults.flat();

            // 重複を除去（同じスタッフが複数店舗に所属している場合）
            const uniqueStaffMap = new Map();
            allStaffFlat.forEach((staff) => {
                if (!uniqueStaffMap.has(staff.id)) {
                    uniqueStaffMap.set(staff.id, staff);
                }
            });
            allSystemStaff.value = Array.from(uniqueStaffMap.values());

            // 全店舗のシフトデータを取得
            const allShiftsPromises = allStores.map(async (store) => {
                try {
                    const response = await api.get(
                        `/shifts/${currentYear}/${currentMonth}?store_id=${store.id}`
                    );
                    return {
                        storeId: store.id,
                        storeName: store.name,
                        shifts: response.data?.shifts || [],
                    };
                } catch (error) {
                    return {
                        storeId: store.id,
                        storeName: store.name,
                        shifts: [],
                    };
                }
            });

            const allShiftsResults = await Promise.all(allShiftsPromises);

            allSystemStoreShifts.value = {};
            allShiftsResults.forEach(({ storeId, storeName, shifts }) => {
                allSystemStoreShifts.value[storeId] = {
                    storeName,
                    shifts,
                };
            });
        } catch (error) {
            console.error("全システムデータ取得エラー:", error);
            allSystemStaff.value = [];
            allSystemStoreShifts.value = {};
        }
    };

    // 全システムスタッフの特定店舗での勤務時間計算
    const calculateStoreHoursForAllStaff = (staffId, storeId) => {
        const storeData = allSystemStoreShifts.value[storeId];
        if (!storeData || !storeData.shifts) return 0;

        let totalMinutes = 0;

        storeData.shifts.forEach((dayShift) => {
            if (dayShift.assignments && Array.isArray(dayShift.assignments)) {
                const assignment = dayShift.assignments.find(
                    (a) => a.staff_id === staffId
                );
                if (assignment) {
                    const startTime = new Date(`2000-01-01T${assignment.start_time}`);
                    const endTime = new Date(`2000-01-01T${assignment.end_time}`);
                    let minutes = (endTime - startTime) / (1000 * 60);

                    if (assignment.break_start_time && assignment.break_end_time) {
                        const breakStart = new Date(
                            `2000-01-01T${assignment.break_start_time}`
                        );
                        const breakEnd = new Date(
                            `2000-01-01T${assignment.break_end_time}`
                        );
                        const breakMinutes = (breakEnd - breakStart) / (1000 * 60);
                        minutes -= breakMinutes;
                    }

                    totalMinutes += minutes;
                }
            }
        });

        return Math.round((totalMinutes / 60) * 10) / 10;
    };

    // 全システムスタッフの全店舗時間取得
    const getAllStoreHoursBreakdownForAllStaff = (staffId) => {
        const breakdown = [];

        Object.entries(allSystemStoreShifts.value).forEach(
            ([storeId, storeData]) => {
                const hours = calculateStoreHoursForAllStaff(
                    staffId,
                    parseInt(storeId)
                );
                if (hours > 0) {
                    breakdown.push({
                        storeId: parseInt(storeId),
                        storeName: storeData.storeName,
                        hours,
                    });
                }
            }
        );

        return breakdown.sort((a, b) => a.storeName.localeCompare(b.storeName));
    };

    // 全システムスタッフの合計勤務時間計算
    const calculateTotalHoursForAllSystemStaff = (staffId) => {
        let totalHours = 0;

        Object.keys(allSystemStoreShifts.value).forEach((storeId) => {
            totalHours += calculateStoreHoursForAllStaff(
                staffId,
                parseInt(storeId)
            );
        });

        return totalHours;
    };

    // 全システムスタッフの時間範囲チェック
    const isHoursOutOfRangeForAllSystemStaff = (staffId) => {
        const staff = allSystemStaff.value.find((s) => s.id === staffId);
        if (!staff) return false;

        const totalHours = calculateTotalHoursForAllSystemStaff(staffId);
        const minHours = staff.min_hours_per_month || 0;
        const maxHours = staff.max_hours_per_month || 0;

        if (minHours === 0 && maxHours === 0) return false;

        return totalHours < minHours || totalHours > maxHours;
    };

    // 全システムスタッフの警告チェック
    const hasStaffWarningsForAllSystemStaff = (staffId) => {
        const staff = allSystemStaff.value.find((s) => s.id === staffId);
        if (!staff) return false;

        const totalHours = calculateTotalHoursForAllSystemStaff(staffId);
        const maxMonthHours = staff.max_hours_per_month || 0;
        const minMonthHours = staff.min_hours_per_month || 0;

        return totalHours > maxMonthHours || totalHours < minMonthHours;
    };

    // 全システムスタッフの警告取得
    const getStaffWarningsForAllSystemStaff = (staffId) => {
        const warnings = [];
        const staff = allSystemStaff.value.find((s) => s.id === staffId);
        if (!staff) return warnings;

        const totalHours = calculateTotalHoursForAllSystemStaff(staffId);
        const maxMonthHours = staff.max_hours_per_month || 0;
        const minMonthHours = staff.min_hours_per_month || 0;

        if (maxMonthHours > 0 && totalHours > maxMonthHours) {
            warnings.push({
                type: "over_hours",
                icon: "pi pi-exclamation-triangle",
                message: `月間勤務時間が上限を超過 (${formatHours(
                    totalHours
                )} > ${formatHours(maxMonthHours)})`,
            });
        }

        if (minMonthHours > 0 && totalHours < minMonthHours) {
            warnings.push({
                type: "under_hours",
                icon: "pi pi-exclamation-triangle",
                message: `月間勤務時間が下限を下回り (${formatHours(
                    totalHours
                )} < ${formatHours(minMonthHours)})`,
            });
        }

        return warnings;
    };

    // 他店舗時間の詳細取得
    const getOtherStoreHoursBreakdown = (staffId, staffList, selectedStore, stores) => {
        const breakdown = [];
        const staff = staffList.find((s) => s.id === staffId);
        if (!staff) return breakdown;

        let staffStoreIds = [];
        if (staff.store_ids && Array.isArray(staff.store_ids)) {
            staffStoreIds = staff.store_ids;
        } else if (staff.stores && Array.isArray(staff.stores)) {
            staffStoreIds = staff.stores.map((s) => s.id);
        }

        Object.entries(allStoreShifts.value).forEach(([storeId, storeShifts]) => {
            const storeIdNum = parseInt(storeId);
            if (
                storeIdNum === selectedStore?.id ||
                !staffStoreIds.includes(storeIdNum)
            ) {
                return;
            }

            let totalMinutes = 0;

            if (storeShifts && Array.isArray(storeShifts)) {
                storeShifts.forEach((dayShift) => {
                    if (dayShift.assignments && Array.isArray(dayShift.assignments)) {
                        const assignment = dayShift.assignments.find(
                            (a) => a.staff_id === staffId
                        );
                        if (assignment) {
                            const startTime = new Date(
                                `2000-01-01T${assignment.start_time}`
                            );
                            const endTime = new Date(`2000-01-01T${assignment.end_time}`);
                            let minutes = (endTime - startTime) / (1000 * 60);

                            if (assignment.break_start_time && assignment.break_end_time) {
                                const breakStart = new Date(
                                    `2000-01-01T${assignment.break_start_time}`
                                );
                                const breakEnd = new Date(
                                    `2000-01-01T${assignment.break_end_time}`
                                );
                                const breakMinutes = (breakEnd - breakStart) / (1000 * 60);
                                minutes -= breakMinutes;
                            }

                            totalMinutes += minutes;
                        }
                    }
                });
            }

            if (totalMinutes > 0) {
                const storeInfo = stores.find((s) => s.id === storeIdNum);
                breakdown.push({
                    storeId: storeIdNum,
                    storeName: storeInfo ? storeInfo.name : `店舗${storeIdNum}`,
                    hours: Math.round((totalMinutes / 60) * 10) / 10,
                });
            }
        });

        return breakdown.sort((a, b) => a.storeName.localeCompare(b.storeName));
    };

    // 全店舗の総勤務時間計算
    const calculateTotalHoursAllStores = (staffId, shifts, staffList, selectedStore) => {
        let totalMinutes = 0;

        // 現在の店舗の勤務時間を計算
        shifts.forEach((dayShift) => {
            const assignment = dayShift.assignments.find(
                (a) => a.staff_id === staffId
            );
            if (assignment) {
                const startTime = new Date(`2000-01-01T${assignment.start_time}`);
                const endTime = new Date(`2000-01-01T${assignment.end_time}`);
                let minutes = (endTime - startTime) / (1000 * 60);

                if (assignment.break_start_time && assignment.break_end_time) {
                    const breakStart = new Date(
                        `2000-01-01T${assignment.break_start_time}`
                    );
                    const breakEnd = new Date(
                        `2000-01-01T${assignment.break_end_time}`
                    );
                    const breakMinutes = (breakEnd - breakStart) / (1000 * 60);
                    minutes -= breakMinutes;
                }

                totalMinutes += minutes;
            }
        });

        const staff = staffList.find((s) => s.id === staffId);
        if (!staff) return Math.round((totalMinutes / 60) * 10) / 10;

        let staffStoreIds = [];
        if (staff.store_ids && Array.isArray(staff.store_ids)) {
            staffStoreIds = staff.store_ids;
        } else if (staff.stores && Array.isArray(staff.stores)) {
            staffStoreIds = staff.stores.map((s) => s.id);
        }

        // 他店舗の勤務時間を加算
        Object.entries(allStoreShifts.value).forEach(([storeId, storeShifts]) => {
            const storeIdNum = parseInt(storeId);
            if (
                storeIdNum === selectedStore?.id ||
                !staffStoreIds.includes(storeIdNum)
            ) {
                return;
            }

            if (storeShifts && Array.isArray(storeShifts)) {
                storeShifts.forEach((dayShift) => {
                    if (dayShift.assignments && Array.isArray(dayShift.assignments)) {
                        const assignment = dayShift.assignments.find(
                            (a) => a.staff_id === staffId
                        );
                        if (assignment) {
                            const startTime = new Date(
                                `2000-01-01T${assignment.start_time}`
                            );
                            const endTime = new Date(`2000-01-01T${assignment.end_time}`);
                            let minutes = (endTime - startTime) / (1000 * 60);

                            if (assignment.break_start_time && assignment.break_end_time) {
                                const breakStart = new Date(
                                    `2000-01-01T${assignment.break_start_time}`
                                );
                                const breakEnd = new Date(
                                    `2000-01-01T${assignment.break_end_time}`
                                );
                                const breakMinutes = (breakEnd - breakStart) / (1000 * 60);
                                minutes -= breakMinutes;
                            }

                            totalMinutes += minutes;
                        }
                    }
                });
            }
        });

        return Math.round((totalMinutes / 60) * 10) / 10;
    };

    // 全店舗の勤務時間が範囲外かチェック
    const isHoursOutOfRangeAllStores = (staffId, staffList) => {
        const staff = staffList.find((s) => s.id === staffId);
        if (!staff) return false;

        const totalHours = calculateTotalHoursForAllSystemStaff(staffId);
        const minHours = staff.min_hours_per_month || 0;
        const maxHours = staff.max_hours_per_month || 0;

        if (minHours === 0 && maxHours === 0) return false;

        return totalHours < minHours || totalHours > maxHours;
    };

    // スタッフ警告（全店舗）があるかチェック
    const hasStaffWarningsAllStores = (staffId, staffList, shifts, calculateDayHours) => {
        const staff = staffList.find((s) => s.id === staffId);
        if (!staff) return false;

        const totalHours = calculateTotalHoursForAllSystemStaff(staffId);
        const maxMonthHours = staff.max_hours_per_month || 0;
        const minMonthHours = staff.min_hours_per_month || 0;
        const maxDayHours = staff.max_hours_per_day || 8;

        let hasViolation = false;

        if (
            maxMonthHours > 0 &&
            (totalHours > maxMonthHours || totalHours < minMonthHours)
        ) {
            hasViolation = true;
        }

        shifts.forEach((dayShift) => {
            const assignment = dayShift.assignments.find(
                (a) => a.staff_id === staffId
            );
            if (assignment) {
                const dayHours = calculateDayHours(assignment);
                if (dayHours > maxDayHours) {
                    hasViolation = true;
                }

                const dayOfWeek = new Date(dayShift.date).getDay();
                const dayPreference = staff.dayPreferences?.find(
                    (pref) => pref.day_of_week === dayOfWeek
                );
                if (dayPreference && !dayPreference.available) {
                    hasViolation = true;
                }

                const dayOffRequest = staff.dayOffRequests?.find(
                    (req) =>
                        req.date === dayShift.date &&
                        (req.status === "approved" || req.status === "pending")
                );
                if (dayOffRequest) {
                    hasViolation = true;
                }
            }
        });

        return hasViolation;
    };

    // スタッフ警告（全店舗）取得
    const getStaffWarningsAllStores = (staffId, staffList, shifts, calculateDayHours, formatHours) => {
        const warnings = [];
        const staff = staffList.find((s) => s.id === staffId);
        if (!staff) return warnings;

        const totalHours = calculateTotalHoursForAllSystemStaff(staffId);
        const maxMonthHours = staff.max_hours_per_month || 0;
        const minMonthHours = staff.min_hours_per_month || 0;
        const maxDayHours = staff.max_hours_per_day || 8;

        if (maxMonthHours > 0 && totalHours > maxMonthHours) {
            warnings.push({
                type: "over_hours",
                icon: "pi pi-exclamation-triangle",
                message: `月間勤務時間が上限を超過 (全店舗合計: ${formatHours(
                    totalHours
                )} > ${formatHours(maxMonthHours)})`,
                severity: "error",
            });
        }

        if (minMonthHours > 0 && totalHours < minMonthHours) {
            warnings.push({
                type: "under_hours",
                icon: "pi pi-exclamation-triangle",
                message: `月間勤務時間が下限を下回り (全店舗合計: ${formatHours(
                    totalHours
                )} < ${formatHours(minMonthHours)})`,
                severity: "warn",
            });
        }

        const violationDays = [];
        shifts.forEach((dayShift) => {
            const assignment = dayShift.assignments.find(
                (a) => a.staff_id === staffId
            );
            if (assignment) {
                const dayHours = calculateDayHours(assignment);
                if (dayHours > maxDayHours) {
                    violationDays.push({
                        date: dayShift.date,
                        type: "day_hours_exceeded",
                        message: `${dayShift.date}: 1日勤務時間超過 (${formatHours(
                            dayHours
                        )} > ${formatHours(maxDayHours)})`,
                    });
                }

                const dayOfWeek = new Date(dayShift.date).getDay();
                const dayPreference = staff.dayPreferences?.find(
                    (pref) => pref.day_of_week === dayOfWeek
                );
                if (dayPreference && !dayPreference.available) {
                    violationDays.push({
                        date: dayShift.date,
                        type: "unavailable_day",
                        message: `${dayShift.date}: 勤務不可曜日に割り当て (${["日", "月", "火", "水", "木", "金", "土"][dayOfWeek]
                            }曜日)`,
                    });
                }

                const dayOffRequest = staff.dayOffRequests?.find(
                    (req) =>
                        req.date === dayShift.date &&
                        (req.status === "approved" || req.status === "pending")
                );
                if (dayOffRequest) {
                    violationDays.push({
                        date: dayShift.date,
                        type: "day_off_violation",
                        message: `${dayShift.date}: 休み希望日に割り当て (${dayOffRequest.reason || "お休み"
                            })`,
                    });
                }
            }
        });

        if (violationDays.length > 0) {
            warnings.push({
                type: "schedule_violations",
                icon: "pi pi-ban",
                message: `スケジュール違反 ${violationDays.length}件`,
                severity: "error",
                details: violationDays,
            });
        }

        return warnings;
    };

    // スタッフのステータス判定
    const getStaffStatus = (staffId) => {
        const totalHours = calculateTotalHoursForAllSystemStaff(staffId);
        const staff = allSystemStaff.value.find((s) => s.id === staffId);

        if (!staff) return "normal";

        const minHours = staff.min_hours_per_month || 0;
        const maxHours = staff.max_hours_per_month || 0;

        // 時間範囲外の場合は違反
        if (
            (maxHours > 0 && totalHours > maxHours) ||
            (minHours > 0 && totalHours < minHours)
        ) {
            return "violation";
        }

        // その他の警告条件をチェック
        const hasOtherWarnings = checkStaffOtherWarnings(staffId);
        if (hasOtherWarnings) {
            return "warning";
        }

        return "normal";
    };

    // その他の警告条件チェック
    const checkStaffOtherWarnings = (staffId) => {
        const staff = allSystemStaff.value.find((s) => s.id === staffId);
        if (!staff) return false;

        // ここで他の警告条件をチェック（例：連続勤務日数、1日の最大勤務時間など）
        // 現在のシフトデータから各店舗のシフトをチェック
        let hasViolations = false;

        Object.values(allSystemStoreShifts.value).forEach((storeData) => {
            if (storeData.shifts) {
                storeData.shifts.forEach((dayShift) => {
                    if (dayShift.assignments) {
                        const assignment = dayShift.assignments.find(
                            (a) => a.staff_id === staffId
                        );
                        if (assignment) {
                            // 1日の勤務時間チェック
                            const startTime = new Date(`2000-01-01T${assignment.start_time}`);
                            const endTime = new Date(`2000-01-01T${assignment.end_time}`);
                            let workMillis = endTime - startTime;

                            if (assignment.break_start_time && assignment.break_end_time) {
                                const breakStart = new Date(`2000-01-01T${assignment.break_start_time}`);
                                const breakEnd = new Date(`2000-01-01T${assignment.break_end_time}`);
                                const breakMillis = breakEnd - breakStart;
                                workMillis -= breakMillis;
                            }

                            const dayHours = Math.round((workMillis / (1000 * 60 * 60)) * 100) / 100;
                            const maxDayHours = staff.max_hours_per_day || 8;
                            if (dayHours > maxDayHours) {
                                hasViolations = true;
                            }
                        }
                    }
                });
            }
        });

        return hasViolations;
    };

    // ステータス表示用の関数
    const getStaffStatusInfo = (staffId) => {
        const status = getStaffStatus(staffId);
        const warnings = getStaffWarningsForAllSystemStaff(staffId);

        switch (status) {
            case "violation":
                return {
                    icon: "pi pi-times-circle",
                    text: "違反あり",
                    class: "status-violation",
                    title: warnings.map((w) => w.message).join("\n"),
                };
            case "warning":
                return {
                    icon: "pi pi-exclamation-triangle",
                    text: "要確認",
                    class: "status-warning",
                    title: warnings.map((w) => w.message).join("\n"),
                };
            default:
                return {
                    icon: "pi pi-check-circle",
                    text: "正常",
                    class: "status-ok",
                    title: "正常な状態です",
                };
        }
    };

    // フォーマット関数（依存関数）
    const formatHours = (hours) => {
        if (typeof hours !== "number" || isNaN(hours) || hours < 0) {
            hours = 0;
        }

        const totalMinutes = Math.round(hours * 60);
        const displayHours = Math.floor(totalMinutes / 60);
        const displayMinutes = totalMinutes % 60;

        if (displayMinutes === 0) {
            return `${displayHours}時間`;
        } else {
            return `${displayHours}時間${displayMinutes}分`;
        }
    };

    return {
        // 状態
        allStoreShifts,
        allSystemStaff,
        allSystemStoreShifts,

        // メソッド
        fetchAllStoreShifts,
        fetchAllSystemStaffAndShifts,
        calculateStoreHoursForAllStaff,
        getAllStoreHoursBreakdownForAllStaff,
        calculateTotalHoursForAllSystemStaff,
        isHoursOutOfRangeForAllSystemStaff,
        hasStaffWarningsForAllSystemStaff,
        getStaffWarningsForAllSystemStaff,
        getOtherStoreHoursBreakdown,
        calculateTotalHoursAllStores,
        isHoursOutOfRangeAllStores,
        hasStaffWarningsAllStores,
        getStaffWarningsAllStores,
        getStaffStatus,
        checkStaffOtherWarnings,
        getStaffStatusInfo,
    };
}