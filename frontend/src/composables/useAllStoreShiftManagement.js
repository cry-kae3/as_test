import { ref, computed } from 'vue';
import { useStore } from 'vuex';

export function useAllStoreShiftManagement() {
    const store = useStore();

    // リアクティブデータ
    const allSystemStaff = ref([]);
    const allStoreShifts = ref(new Map());
    const currentYearMonth = ref({ year: null, month: null });

    /**
     * 勤務時間の計算（休憩時間を考慮）
     */
    const calculateWorkMinutes = (startTime, endTime, breakStartTime = null, breakEndTime = null) => {
        if (!startTime || !endTime) return 0;

        try {
            const start = new Date(`2000-01-01T${startTime}`);
            const end = new Date(`2000-01-01T${endTime}`);

            // 終了時間が開始時間より前の場合は翌日とみなす
            if (end < start) {
                end.setDate(end.getDate() + 1);
            }

            let workMinutes = (end - start) / (1000 * 60);

            // 休憩時間を差し引く
            if (breakStartTime && breakEndTime) {
                const breakStart = new Date(`2000-01-01T${breakStartTime}`);
                const breakEnd = new Date(`2000-01-01T${breakEndTime}`);

                if (breakEnd < breakStart) {
                    breakEnd.setDate(breakEnd.getDate() + 1);
                }

                const breakMinutes = (breakEnd - breakStart) / (1000 * 60);
                workMinutes -= breakMinutes;
            }

            return Math.max(0, workMinutes);
        } catch (error) {
            console.error('勤務時間計算エラー:', error);
            return 0;
        }
    };

    /**
     * 全店舗のシフト情報を取得
     */
    const fetchAllStoreShifts = async (staffList, currentStore, year, month) => {
        try {
            console.log('🔄 全店舗シフト取得開始:', {
                year,
                month,
                currentStore: currentStore?.name,
                staffCount: staffList?.length
            });

            if (!staffList || staffList.length === 0) {
                console.log('⚠️ スタッフリストが空のため、全店舗シフト取得をスキップ');
                return;
            }

            const allStores = await store.dispatch('store/fetchStores');
            const allShiftsMap = new Map();

            // 各店舗のシフトデータを取得
            for (const shopStore of allStores) {
                if (shopStore.id === currentStore?.id) continue; // 現在の店舗は除外

                try {
                    console.log(`📊 店舗 ${shopStore.name} のシフト取得中...`);

                    const shiftData = await store.dispatch('shift/fetchShiftByYearMonth', {
                        year,
                        month,
                        storeId: shopStore.id
                    });

                    if (shiftData && shiftData.shifts) {
                        // 現在の店舗のスタッフのシフトのみをフィルタリング
                        const relevantShifts = shiftData.shifts.filter(shift =>
                            shift.assignments && shift.assignments.some(assignment =>
                                staffList.some(staff => staff.id === assignment.staff_id)
                            )
                        );

                        if (relevantShifts.length > 0) {
                            allShiftsMap.set(shopStore.id, {
                                store: shopStore,
                                shifts: relevantShifts
                            });
                            console.log(`✅ 店舗 ${shopStore.name}: ${relevantShifts.length}日分のシフト取得`);
                        }
                    }
                } catch (error) {
                    // 404エラー（シフトが存在しない）は正常なケースとして処理
                    if (error.response?.status !== 404) {
                        console.error(`❌ 店舗 ${shopStore.name} のシフト取得エラー:`, error);
                    }
                }
            }

            allStoreShifts.value = allShiftsMap;
            console.log('✅ 全店舗シフト取得完了:', {
                storeCount: allShiftsMap.size,
                stores: Array.from(allShiftsMap.keys()).map(id =>
                    allShiftsMap.get(id).store.name
                )
            });

        } catch (error) {
            console.error('❌ 全店舗シフト取得エラー:', error);
        }
    };

    /**
     * 全システムのスタッフとシフト情報を取得
     */
    const fetchAllSystemStaffAndShifts = async (year, month) => {
        try {
            console.log('🔄 全システムスタッフ&シフト取得開始:', { year, month });

            // 全システムのスタッフを取得
            const systemStaff = await store.dispatch('staff/fetchStaff');
            allSystemStaff.value = systemStaff || [];

            // 年月を記録
            currentYearMonth.value = { year, month };

            console.log('✅ 全システムスタッフ取得完了:', {
                staffCount: allSystemStaff.value.length
            });

        } catch (error) {
            console.error('❌ 全システムスタッフ取得エラー:', error);
            allSystemStaff.value = [];
        }
    };

    /**
     * スタッフの他店舗での勤務時間内訳を取得
     */
    const getOtherStoreHoursBreakdown = (staffId, currentStoreId = null) => {
        if (!allStoreShifts.value || allStoreShifts.value.size === 0) {
            return {
                stores: [],
                totalHours: 0,
                breakdown: {}
            };
        }

        const breakdown = {};
        let totalMinutes = 0;

        allStoreShifts.value.forEach((storeData, storeId) => {
            if (currentStoreId && storeId === currentStoreId) return;

            const { store: shopStore, shifts } = storeData;
            let storeMinutes = 0;

            shifts.forEach(shift => {
                if (!shift.assignments) return;

                shift.assignments.forEach(assignment => {
                    if (assignment.staff_id === staffId) {
                        const minutes = calculateWorkMinutes(
                            assignment.start_time,
                            assignment.end_time,
                            assignment.break_start_time,
                            assignment.break_end_time
                        );
                        storeMinutes += minutes;
                        totalMinutes += minutes;
                    }
                });
            });

            if (storeMinutes > 0) {
                breakdown[storeId] = {
                    storeName: shopStore.name,
                    hours: parseFloat((storeMinutes / 60).toFixed(2)),
                    minutes: storeMinutes
                };
            }
        });

        const stores = Object.values(breakdown).map(item => ({
            name: item.storeName,
            hours: item.hours
        }));

        return {
            stores,
            totalHours: parseFloat((totalMinutes / 60).toFixed(2)),
            breakdown
        };
    };

    /**
     * スタッフの全店舗合計勤務時間を計算
     */
    const calculateTotalHoursAllStores = (staffId, currentStoreHours = 0, currentStoreId = null) => {
        const otherStoreData = getOtherStoreHoursBreakdown(staffId, currentStoreId);
        const totalHours = currentStoreHours + otherStoreData.totalHours;

        return {
            currentStoreHours,
            otherStoreHours: otherStoreData.totalHours,
            totalHours,
            breakdown: otherStoreData.breakdown
        };
    };

    /**
     * 全システムスタッフの全店舗時間内訳を取得
     */
    const getAllStoreHoursBreakdownForAllStaff = () => {
        if (!allSystemStaff.value || allSystemStaff.value.length === 0) {
            return {};
        }

        const result = {};

        allSystemStaff.value.forEach(staff => {
            const breakdown = getOtherStoreHoursBreakdown(staff.id);
            result[staff.id] = {
                staffName: `${staff.last_name} ${staff.first_name}`,
                ...breakdown
            };
        });

        return result;
    };

    /**
     * 全システムスタッフの総勤務時間を計算
     */
    const calculateTotalHoursForAllSystemStaff = (staffId, currentStoreHours = 0) => {
        const allStoreBreakdown = getAllStoreHoursBreakdownForAllStaff();
        const staffBreakdown = allStoreBreakdown[staffId];

        if (!staffBreakdown) {
            return {
                currentStoreHours,
                otherStoreHours: 0,
                totalHours: currentStoreHours,
                breakdown: {}
            };
        }

        return {
            currentStoreHours,
            otherStoreHours: staffBreakdown.totalHours,
            totalHours: currentStoreHours + staffBreakdown.totalHours,
            breakdown: staffBreakdown.breakdown
        };
    };

    /**
     * 全店舗合計での勤務時間が範囲外かチェック
     */
    const isHoursOutOfRangeAllStores = (staff, currentStoreHours = 0) => {
        const totalData = calculateTotalHoursAllStores(staff.id, currentStoreHours);
        const totalHours = totalData.totalHours;

        const minHours = staff.min_hours_per_month || 0;
        const maxHours = staff.max_hours_per_month || 0;

        return {
            isUnder: minHours > 0 && totalHours < minHours,
            isOver: maxHours > 0 && totalHours > maxHours,
            totalHours,
            minHours,
            maxHours,
            shortage: minHours > 0 && totalHours < minHours ? minHours - totalHours : 0,
            excess: maxHours > 0 && totalHours > maxHours ? totalHours - maxHours : 0
        };
    };

    /**
     * 全システムスタッフでの勤務時間が範囲外かチェック
     */
    const isHoursOutOfRangeForAllSystemStaff = (staff, currentStoreHours = 0) => {
        const totalData = calculateTotalHoursForAllSystemStaff(staff.id, currentStoreHours);
        const totalHours = totalData.totalHours;

        const minHours = staff.min_hours_per_month || 0;
        const maxHours = staff.max_hours_per_month || 0;

        return {
            isUnder: minHours > 0 && totalHours < minHours,
            isOver: maxHours > 0 && totalHours > maxHours,
            totalHours,
            minHours,
            maxHours,
            shortage: minHours > 0 && totalHours < minHours ? minHours - totalHours : 0,
            excess: maxHours > 0 && totalHours > maxHours ? totalHours - maxHours : 0
        };
    };

    /**
     * スタッフに警告があるかチェック（全店舗版）
     */
    const hasStaffWarningsAllStores = (staff, currentStoreHours = 0) => {
        const rangeCheck = isHoursOutOfRangeAllStores(staff, currentStoreHours);
        return rangeCheck.isUnder || rangeCheck.isOver;
    };

    /**
     * スタッフに警告があるかチェック（全システム版）
     */
    const hasStaffWarningsForAllSystemStaff = (staff, currentStoreHours = 0) => {
        const rangeCheck = isHoursOutOfRangeForAllSystemStaff(staff, currentStoreHours);
        return rangeCheck.isUnder || rangeCheck.isOver;
    };

    /**
     * スタッフの警告内容を取得（全店舗版）
     */
    const getStaffWarningsAllStores = (staff, currentStoreHours = 0) => {
        const warnings = [];
        const rangeCheck = isHoursOutOfRangeAllStores(staff, currentStoreHours);

        if (rangeCheck.isUnder) {
            warnings.push(`月間最小勤務時間不足: ${rangeCheck.shortage.toFixed(1)}時間`);
        }

        if (rangeCheck.isOver) {
            warnings.push(`月間最大勤務時間超過: ${rangeCheck.excess.toFixed(1)}時間`);
        }

        return warnings;
    };

    /**
     * スタッフの警告内容を取得（全システム版）
     */
    const getStaffWarningsForAllSystemStaff = (staff, currentStoreHours = 0) => {
        const warnings = [];
        const rangeCheck = isHoursOutOfRangeForAllSystemStaff(staff, currentStoreHours);

        if (rangeCheck.isUnder) {
            warnings.push(`月間最小勤務時間不足: ${rangeCheck.shortage.toFixed(1)}時間`);
        }

        if (rangeCheck.isOver) {
            warnings.push(`月間最大勤務時間超過: ${rangeCheck.excess.toFixed(1)}時間`);
        }

        return warnings;
    };

    /**
     * スタッフのステータスを取得
     */
    const getStaffStatus = (staff, currentStoreHours = 0) => {
        const totalData = calculateTotalHoursForAllSystemStaff(staff.id, currentStoreHours);
        const rangeCheck = isHoursOutOfRangeForAllSystemStaff(staff, currentStoreHours);

        if (rangeCheck.isOver) {
            return {
                type: 'error',
                label: '超過',
                description: `月間最大勤務時間を${rangeCheck.excess.toFixed(1)}時間超過`
            };
        }

        if (rangeCheck.isUnder) {
            return {
                type: 'warning',
                label: '不足',
                description: `月間最小勤務時間まで${rangeCheck.shortage.toFixed(1)}時間不足`
            };
        }

        return {
            type: 'success',
            label: '正常',
            description: '月間勤務時間は適正範囲内'
        };
    };

    /**
     * スタッフステータスの詳細情報を取得
     */
    const getStaffStatusInfo = (staff, currentStoreHours = 0) => {
        const totalData = calculateTotalHoursForAllSystemStaff(staff.id, currentStoreHours);
        const status = getStaffStatus(staff, currentStoreHours);

        return {
            ...status,
            currentStoreHours: totalData.currentStoreHours,
            otherStoreHours: totalData.otherStoreHours,
            totalHours: totalData.totalHours,
            minHours: staff.min_hours_per_month || 0,
            maxHours: staff.max_hours_per_month || 0,
            breakdown: totalData.breakdown
        };
    };

    return {
        // データ
        allSystemStaff: computed(() => allSystemStaff.value),
        allStoreShifts: computed(() => allStoreShifts.value),
        currentYearMonth: computed(() => currentYearMonth.value),

        // 関数
        fetchAllStoreShifts,
        fetchAllSystemStaffAndShifts,
        getOtherStoreHoursBreakdown,
        calculateTotalHoursAllStores,
        getAllStoreHoursBreakdownForAllStaff,
        calculateTotalHoursForAllSystemStaff,
        isHoursOutOfRangeAllStores,
        isHoursOutOfRangeForAllSystemStaff,
        hasStaffWarningsAllStores,
        hasStaffWarningsForAllSystemStaff,
        getStaffWarningsAllStores,
        getStaffWarningsForAllSystemStaff,
        getStaffStatus,
        getStaffStatusInfo
    };
}