import { ref } from "vue";
import { useStore } from "vuex";
import api from "@/services/api";

export function useAllStoreShiftManagement() {
    const store = useStore();

    const allStoreShifts = ref({});
    const allSystemStaff = ref([]);
    const allSystemStoreShifts = ref({});

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

    const fetchAllStoreShifts = async (staffList, selectedStore, currentYear, currentMonth) => {
        if (!staffList || staffList.length === 0 || !selectedStore) {
            allStoreShifts.value = {};
            return;
        }

        try {
            const uniqueStoreIds = new Set();
            staffList.forEach((staff) => {
                const storeIds = staff.store_ids || (staff.stores ? staff.stores.map(s => s.id) : []);
                storeIds.forEach((id) => {
                    if (id !== selectedStore.id) {
                        uniqueStoreIds.add(id);
                    }
                });
            });

            const storeShiftsPromises = Array.from(uniqueStoreIds).map(
                (storeId) => store.dispatch("shift/fetchShiftByYearMonth", {
                    year: currentYear,
                    month: currentMonth,
                    storeId: storeId,
                }).catch(() => null)
            );

            const results = await Promise.all(storeShiftsPromises);

            const newAllStoreShifts = {};
            results.forEach((response) => {
                if (response && response.shifts) {
                    newAllStoreShifts[response.store_id] = response.shifts;
                }
            });
            allStoreShifts.value = newAllStoreShifts;
        } catch (error) {
            allStoreShifts.value = {};
        }
    };

    const fetchAllSystemStaffAndShifts = async (currentYear, currentMonth) => {
        try {
            const allStaffResponse = await api.get('/staff');
            allSystemStaff.value = allStaffResponse.data || [];

            const allShiftsResponse = await api.get(`/shifts?year=${currentYear}&month=${currentMonth}`);
            const allShifts = allShiftsResponse.data || [];

            const shiftsByStore = {};
            for (const shift of allShifts) {
                const shiftDetails = await api.get(`/shifts/${shift.id}`);
                if (!shiftsByStore[shift.store_id]) {
                    shiftsByStore[shift.store_id] = {
                        storeName: shift.Store?.name || `店舗${shift.store_id}`,
                        shifts: []
                    };
                }
                shiftsByStore[shift.store_id].shifts.push(...(shiftDetails.data.shifts || []));
            }
            allSystemStoreShifts.value = shiftsByStore;

        } catch (error) {
            allSystemStaff.value = [];
            allSystemStoreShifts.value = {};
        }
    };

    const calculateStoreHoursForAllStaff = (staffId, storeId) => {
        const storeData = allSystemStoreShifts.value[storeId];
        if (!storeData || !storeData.shifts) return 0;

        let totalMinutes = 0;
        storeData.shifts.forEach((dayShift) => {
            const assignment = dayShift.assignments?.find((a) => a.staff_id === staffId);
            if (assignment) {
                const startTime = new Date(`2000-01-01T${assignment.start_time}`);
                const endTime = new Date(`2000-01-01T${assignment.end_time}`);
                let minutes = (endTime - startTime) / (1000 * 60);

                if (assignment.break_start_time && assignment.break_end_time) {
                    const breakStart = new Date(`2000-01-01T${assignment.break_start_time}`);
                    const breakEnd = new Date(`2000-01-01T${assignment.break_end_time}`);
                    minutes -= (breakEnd - breakStart) / (1000 * 60);
                }
                totalMinutes += minutes;
            }
        });
        return Math.round((totalMinutes / 60) * 10) / 10;
    };

    const getAllStoreHoursBreakdownForAllStaff = (staffId) => {
        const breakdown = [];
        Object.entries(allSystemStoreShifts.value).forEach(([storeId, storeData]) => {
            const hours = calculateStoreHoursForAllStaff(staffId, parseInt(storeId));
            if (hours > 0) {
                breakdown.push({
                    storeId: parseInt(storeId),
                    storeName: storeData.storeName,
                    hours,
                });
            }
        });
        return breakdown.sort((a, b) => a.storeName.localeCompare(b.storeName));
    };

    const calculateTotalHoursForAllSystemStaff = (staffId) => {
        return Object.keys(allSystemStoreShifts.value).reduce((total, storeId) => {
            return total + calculateStoreHoursForAllStaff(staffId, parseInt(storeId));
        }, 0);
    };

    const isHoursOutOfRangeForAllSystemStaff = (staffId) => {
        const staff = allSystemStaff.value.find((s) => s.id === staffId);
        if (!staff) return false;
        const totalHours = calculateTotalHoursForAllSystemStaff(staffId);
        const minHours = staff.min_hours_per_month || 0;
        const maxHours = staff.max_hours_per_month || 0;
        return maxHours > 0 && (totalHours < minHours || totalHours > maxHours);
    };

    const hasStaffWarningsForAllSystemStaff = (staffId) => {
        return isHoursOutOfRangeForAllSystemStaff(staffId);
    };

    const getStaffWarningsForAllSystemStaff = (staffId) => {
        if (!hasStaffWarningsForAllSystemStaff(staffId)) return [];
        const staff = allSystemStaff.value.find((s) => s.id === staffId);
        const totalHours = calculateTotalHoursForAllSystemStaff(staffId);
        const minHours = staff.min_hours_per_month || 0;
        const maxHours = staff.max_hours_per_month || 0;
        const warnings = [];
        if (totalHours < minHours) warnings.push({ type: 'under_hours', message: `月間勤務時間が下限を下回っています (${formatHours(totalHours)} / ${formatHours(minHours)})` });
        if (totalHours > maxHours) warnings.push({ type: 'over_hours', message: `月間勤務時間が上限を超過しています (${formatHours(totalHours)} / ${formatHours(maxHours)})` });
        return warnings;
    };

    const getOtherStoreHoursBreakdown = (staffId, staffList, selectedStore) => {
        const breakdown = [];

        // staffListの存在チェック
        if (!staffList || !Array.isArray(staffList)) {
            return breakdown;
        }

        const staff = staffList.find((s) => s.id === staffId);
        if (!staff) return breakdown;

        const staffStoreIds = staff.store_ids || (staff.stores ? staff.stores.map(s => s.id) : []);

        Object.entries(allStoreShifts.value).forEach(([storeId, storeShifts]) => {
            const storeIdNum = parseInt(storeId);
            if (storeIdNum === selectedStore.id || !staffStoreIds.includes(storeIdNum)) {
                return;
            }

            let totalMinutes = 0;
            if (storeShifts && Array.isArray(storeShifts)) {
                storeShifts.forEach((dayShift) => {
                    const assignment = dayShift.assignments?.find((a) => a.staff_id === staffId);
                    if (assignment) {
                        const startTime = new Date(`2000-01-01T${assignment.start_time}`);
                        const endTime = new Date(`2000-01-01T${assignment.end_time}`);
                        let minutes = (endTime - startTime) / (1000 * 60);

                        if (assignment.break_start_time && assignment.break_end_time) {
                            const breakStart = new Date(`2000-01-01T${assignment.break_start_time}`);
                            const breakEnd = new Date(`2000-01-01T${assignment.break_end_time}`);
                            minutes -= (breakEnd - breakStart) / (1000 * 60);
                        }
                        totalMinutes += minutes;
                    }
                });
            }

            if (totalMinutes > 0) {
                const storeInfo = store.state.store.stores.find((s) => s.id === storeIdNum);
                breakdown.push({
                    storeId: storeIdNum,
                    storeName: storeInfo ? storeInfo.name : `店舗${storeIdNum}`,
                    hours: Math.round((totalMinutes / 60) * 10) / 10,
                });
            }
        });
        return breakdown.sort((a, b) => a.storeName.localeCompare(b.storeName));
    };

    // 内部で勤務時間を計算するよう修正
    const calculateTotalHoursAllStores = (staffId, shifts, staffList, selectedStore, calculateTotalHoursFunc) => {
        // 現在の店舗での勤務時間を計算
        let currentStoreHours = 0;
        if (calculateTotalHoursFunc && typeof calculateTotalHoursFunc === 'function') {
            currentStoreHours = calculateTotalHoursFunc(staffId);
        } else if (shifts && Array.isArray(shifts)) {
            // calculateTotalHoursFuncが渡されない場合は、shiftsから直接計算
            shifts.forEach((dayShift) => {
                const assignment = dayShift.assignments?.find((a) => a.staff_id === staffId);
                if (assignment) {
                    const startTime = new Date(`2000-01-01T${assignment.start_time}`);
                    const endTime = new Date(`2000-01-01T${assignment.end_time}`);
                    let minutes = (endTime - startTime) / (1000 * 60);

                    if (assignment.break_start_time && assignment.break_end_time) {
                        const breakStart = new Date(`2000-01-01T${assignment.break_start_time}`);
                        const breakEnd = new Date(`2000-01-01T${assignment.break_end_time}`);
                        minutes -= (breakEnd - breakStart) / (1000 * 60);
                    }
                    currentStoreHours += minutes;
                }
            });
            currentStoreHours = Math.round((currentStoreHours / 60) * 10) / 10;
        }

        // 他店舗での勤務時間を取得
        const breakdown = getOtherStoreHoursBreakdown(staffId, staffList, selectedStore);
        const otherStoreHours = breakdown.reduce((total, item) => total + item.hours, 0);

        return currentStoreHours + otherStoreHours;
    };

    const isHoursOutOfRangeAllStores = (staffId, staffList, shifts, selectedStore, calculateTotalHoursFunc) => {
        // staffListの存在チェック
        if (!staffList || !Array.isArray(staffList)) {
            return false;
        }

        const staff = staffList.find((s) => s.id === staffId);
        if (!staff) return false;

        const totalHours = calculateTotalHoursAllStores(staffId, shifts, staffList, selectedStore, calculateTotalHoursFunc);
        const minHours = staff.min_hours_per_month || 0;
        const maxHours = staff.max_hours_per_month || 0;

        return maxHours > 0 && (totalHours < minHours || totalHours > maxHours);
    };

    const hasStaffWarningsAllStores = (staffId, staffList, shifts, selectedStore, calculateTotalHoursFunc) => {
        return isHoursOutOfRangeAllStores(staffId, staffList, shifts, selectedStore, calculateTotalHoursFunc);
    };

    const getStaffWarningsAllStores = (staffId, staffList, shifts, selectedStore, calculateTotalHoursFunc) => {
        if (!hasStaffWarningsAllStores(staffId, staffList, shifts, selectedStore, calculateTotalHoursFunc)) return [];

        // staffListの存在チェック
        if (!staffList || !Array.isArray(staffList)) {
            return [];
        }

        const staff = staffList.find(s => s.id === staffId);
        if (!staff) return [];

        const totalHours = calculateTotalHoursAllStores(staffId, shifts, staffList, selectedStore, calculateTotalHoursFunc);
        const minHours = staff.min_hours_per_month || 0;
        const maxHours = staff.max_hours_per_month || 0;
        const warnings = [];
        if (totalHours < minHours) warnings.push({ type: 'under_hours', message: `全店舗合計勤務時間が下限を下回っています (${formatHours(totalHours)} / ${formatHours(minHours)})` });
        if (totalHours > maxHours) warnings.push({ type: 'over_hours', message: `全店舗合計勤務時間が上限を超過しています (${formatHours(totalHours)} / ${formatHours(maxHours)})` });
        return warnings;
    };

    const getStaffStatus = (staffId) => {
        if (isHoursOutOfRangeForAllSystemStaff(staffId)) {
            return 'violation';
        }
        if (checkStaffOtherWarnings(staffId)) {
            return 'warning';
        }
        return 'normal';
    };

    const checkStaffOtherWarnings = (staffId) => {
        return false;
    };

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


    return {
        allStoreShifts,
        allSystemStaff,
        allSystemStoreShifts,
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