import { ref, reactive, computed, nextTick } from "vue";
import { useStore } from "vuex";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import api from "@/services/api";

export function useShiftManagement() {
    const store = useStore();
    const toast = useToast();
    const confirm = useConfirm();

    // リアクティブな状態
    const loading = ref(false);
    const saving = ref(false);
    const isEditMode = ref(false);
    const selectionDialogVisible = ref(false);
    const selectedDate = ref(null);
    const currentYear = ref(new Date().getFullYear());
    const currentMonth = ref(new Date().getMonth() + 1);
    const selectedStore = ref(null);
    const stores = ref([]);
    const staffList = ref([]);
    const shifts = ref([]);
    const daysInMonth = ref([]);
    const currentShift = ref(null);
    const systemSettings = ref(null);
    const holidays = ref([]);
    const storeRequirements = ref([]);
    const currentStore = ref(null);
    const storeBusinessHours = ref([]);
    const storeClosedDays = ref([]);
    const allStoreShifts = ref({});
    const allSystemStaff = ref([]);
    const allSystemStoreShifts = ref({});

    // カレンダー関連
    const selectedDateCalendar = ref(null);
    const minSelectableDate = ref(null);
    const maxSelectableDate = ref(null);

    // 時間オプション
    const hourOptions = ref([]);
    const minuteOptions = ref([]);

    // 時間オプション生成
    const generateTimeOptions = () => {
        hourOptions.value = Array.from({ length: 24 }, (_, i) => ({
            label: i.toString().padStart(2, "0"),
            value: i.toString().padStart(2, "0"),
        }));

        minuteOptions.value = [
            { label: "00", value: "00" },
            { label: "15", value: "15" },
            { label: "30", value: "30" },
            { label: "45", value: "45" },
        ];
    };

    // タイムライン時間
    const timelineHours = computed(() => {
        const hours = [];
        for (let hour = 0; hour <= 23; hour++) {
            hours.push(hour);
        }
        return hours;
    });

    // シフトエディタダイアログ
    const shiftEditorDialog = reactive({
        visible: false,
        title: "",
        date: null,
        staff: null,
        startTimeHour: "09",
        startTimeMinute: "00",
        endTimeHour: "18",
        endTimeMinute: "00",
        hasBreak: false,
        breakStartTimeHour: "",
        breakStartTimeMinute: "",
        breakEndTimeHour: "",
        breakEndTimeMinute: "",
        isRestDay: false,
        isPast: false,
        hasShift: false,
        changeReason: "",
    });

    // 現在のシフトがあるかどうか
    const hasCurrentShift = computed(() => {
        return currentShift.value !== null;
    });

    // ユーティリティ関数
    const parseTimeToFloat = (timeStr) => {
        const [hours, minutes] = timeStr.split(":").map(Number);
        return hours + minutes / 60;
    };

    const parseTimeToComponents = (timeStr) => {
        if (!timeStr) return { hour: "09", minute: "00" };
        const [hour, minute] = timeStr.split(":");
        return {
            hour: hour.padStart(2, "0"),
            minute: minute.padStart(2, "0"),
        };
    };

    const combineTimeComponents = (hour, minute) => {
        return `${hour}:${minute}`;
    };

    const formatTime = (time) => {
        if (!time) return "";
        return time.slice(0, 5);
    };

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

    const isPastDate = (date) => {
        const today = new Date();
        const checkDate = new Date(date);
        today.setHours(0, 0, 0, 0);
        checkDate.setHours(0, 0, 0, 0);
        return checkDate < today;
    };

    const formatDateToString = (date) => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const day = date.getDate().toString().padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    const formatSelectedDateDisplay = (date) => {
        if (!date) return "";
        const d = new Date(date);
        const month = d.getMonth() + 1;
        const day = d.getDate();
        const dayOfWeek = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
        return `${month}月${day}日(${dayOfWeek})`;
    };

    // 祝日関連
    const fetchHolidays = async (year) => {
        try {
            const response = await fetch(
                `https://holidays-jp.github.io/api/v1/${year}/date.json`
            );
            const data = await response.json();
            holidays.value = Object.keys(data);
        } catch (error) {
            holidays.value = [];
        }
    };

    const isHoliday = (date) => {
        return holidays.value.includes(date);
    };

    // システム設定関連
    const fetchSystemSettings = async () => {
        try {
            const response = await api.get("/shifts/system-settings");
            systemSettings.value = response.data;
        } catch (error) {
            systemSettings.value = { closing_day: 25 };
        }
    };

    const getShiftPeriod = (year, month, closingDay) => {
        let startDate, endDate;

        if (month === 1) {
            startDate = new Date(year - 1, 11, closingDay + 1);
            endDate = new Date(year, 0, closingDay);
        } else {
            startDate = new Date(year, month - 2, closingDay + 1);
            endDate = new Date(year, month - 1, closingDay);
        }

        const daysInPrevMonth = new Date(
            startDate.getFullYear(),
            startDate.getMonth() + 1,
            0
        ).getDate();
        if (startDate.getDate() > daysInPrevMonth) {
            startDate.setDate(daysInPrevMonth);
        }

        const daysInCurrentMonth = new Date(
            endDate.getFullYear(),
            endDate.getMonth() + 1,
            0
        ).getDate();
        if (endDate.getDate() > daysInCurrentMonth) {
            endDate.setDate(daysInCurrentMonth);
        }

        return { startDate, endDate };
    };

    // 店舗関連
    const isStoreClosedOnDate = (date) => {
        if (!date) {
            return false;
        }

        const dayOfWeek = new Date(date).getDay();

        const isClosedByDayOfWeek =
            storeBusinessHours.value &&
            storeBusinessHours.value.some((hours) => {
                const match = hours.day_of_week === dayOfWeek && hours.is_closed;
                return match;
            });

        const isClosedBySpecificDate =
            storeClosedDays.value &&
            storeClosedDays.value.some((closedDay) => {
                const match = closedDay.specific_date === date;
                return match;
            });

        const result = isClosedByDayOfWeek || isClosedBySpecificDate;
        return result;
    };

    const fetchStoreDetails = async (storeId) => {
        try {
            const storeData = await store.dispatch("store/fetchStore", storeId);

            const businessHours = await store.dispatch(
                "store/fetchStoreBusinessHours",
                storeId
            );

            const closedDays = await store.dispatch(
                "store/fetchStoreClosedDays",
                storeId
            );

            currentStore.value = {
                ...storeData,
                operating_hours: businessHours || [],
            };

            storeBusinessHours.value = businessHours || [];
            storeClosedDays.value = closedDays || [];

            const requirements = await store.dispatch(
                "store/fetchStoreStaffRequirements",
                storeId
            );
            storeRequirements.value = requirements || [];
        } catch (error) {
            storeRequirements.value = [];
            storeBusinessHours.value = [];
            storeClosedDays.value = [];
        }
    };

    // シフト関連
    const getShiftForStaff = (date, staffId) => {
        const dayShifts = shifts.value.find((s) => s.date === date);
        if (!dayShifts) return null;

        return dayShifts.assignments.find((a) => a.staff_id === staffId);
    };

    const calculateDayHours = (shift) => {
        if (!shift) return 0;

        const startTime = new Date(`2000-01-01T${shift.start_time}`);
        const endTime = new Date(`2000-01-01T${shift.end_time}`);
        let workMillis = endTime - startTime;

        if (shift.break_start_time && shift.break_end_time) {
            const breakStart = new Date(`2000-01-01T${shift.break_start_time}`);
            const breakEnd = new Date(`2000-01-01T${shift.break_end_time}`);
            const breakMillis = breakEnd - breakStart;
            workMillis -= breakMillis;
        }

        return Math.round((workMillis / (1000 * 60 * 60)) * 100) / 100;
    };

    const calculateTotalHours = (staffId) => {
        let totalMinutes = 0;

        shifts.value.forEach((dayShift) => {
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

        return Math.round((totalMinutes / 60) * 10) / 10;
    };

    // スタッフ警告関連
    const hasShiftViolation = (date, staffId) => {
        const shift = getShiftForStaff(date, staffId);
        if (!shift) return false;

        const staff = staffList.value.find((s) => s.id === staffId);
        if (!staff) return false;

        const dayHours = calculateDayHours(shift);
        const maxDayHours = staff.max_hours_per_day || 8;

        if (dayHours > maxDayHours) {
            return true;
        }

        const dayOfWeek = new Date(date).getDay();
        const dayPreference = staff.dayPreferences?.find(
            (pref) => pref.day_of_week === dayOfWeek
        );
        if (dayPreference && !dayPreference.available) {
            return true;
        }

        const dayOffRequest = staff.dayOffRequests?.find(
            (req) =>
                req.date === date &&
                (req.status === "approved" || req.status === "pending")
        );
        if (dayOffRequest) {
            return true;
        }

        return false;
    };

    const getShiftViolations = (date, staffId) => {
        const violations = [];
        const shift = getShiftForStaff(date, staffId);
        if (!shift) return violations;

        const staff = staffList.value.find((s) => s.id === staffId);
        if (!staff) return violations;

        const dayHours = calculateDayHours(shift);
        const maxDayHours = staff.max_hours_per_day || 8;

        if (dayHours > maxDayHours) {
            violations.push({
                type: "day_hours",
                icon: "pi pi-clock",
                message: `1日の勤務時間が上限を超過 (${formatHours(
                    dayHours
                )} > ${formatHours(maxDayHours)})`,
                severity: "error",
            });
        }

        const dayOfWeek = new Date(date).getDay();
        const dayPreference = staff.dayPreferences?.find(
            (pref) => pref.day_of_week === dayOfWeek
        );
        if (dayPreference && !dayPreference.available) {
            violations.push({
                type: "unavailable_day",
                icon: "pi pi-ban",
                message: `${["日", "月", "火", "水", "木", "金", "土"][dayOfWeek]
                    }曜日は勤務不可設定です`,
                severity: "error",
            });
        }

        const dayOffRequest = staff.dayOffRequests?.find(
            (req) =>
                req.date === date &&
                (req.status === "approved" || req.status === "pending")
        );
        if (dayOffRequest) {
            violations.push({
                type: "day_off_violation",
                icon: "pi pi-ban",
                message: `休み希望日です (${dayOffRequest.reason || "お休み"})`,
                severity: "error",
            });
        }

        return violations;
    };

    // スタッフ勤務可能性チェック
    const canStaffWorkOnDate = (staff, date) => {
        const hasDayOffRequest =
            staff.dayOffRequests &&
            staff.dayOffRequests.some(
                (request) =>
                    request.date === date &&
                    (request.status === "approved" || request.status === "pending")
            );

        if (hasDayOffRequest) {
            return false;
        }

        const dayOfWeek = new Date(date).getDay();
        const dayPreference =
            staff.dayPreferences &&
            staff.dayPreferences.find((pref) => pref.day_of_week === dayOfWeek);

        if (dayPreference && !dayPreference.available) {
            return false;
        }

        return true;
    };

    const getWorkAvailabilityTooltip = (staff, date) => {
        const dayOfWeek = new Date(date).getDay();
        const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
        const dayPreference =
            staff.dayPreferences &&
            staff.dayPreferences.find((pref) => pref.day_of_week === dayOfWeek);

        let tooltip = `${dayNames[dayOfWeek]}曜日：勤務可能`;

        if (
            dayPreference &&
            dayPreference.preferred_start_time &&
            dayPreference.preferred_end_time
        ) {
            tooltip += `\n希望時間：${formatTime(
                dayPreference.preferred_start_time
            )}-${formatTime(dayPreference.preferred_end_time)}`;
        }

        return tooltip;
    };

    const getWorkUnavailabilityReason = (staff, date) => {
        const dayOffRequest =
            staff.dayOffRequests &&
            staff.dayOffRequests.find(
                (request) =>
                    request.date === date &&
                    (request.status === "approved" || request.status === "pending")
            );

        if (dayOffRequest) {
            return `休み希望：${dayOffRequest.reason || "お休み"}`;
        }

        const dayOfWeek = new Date(date).getDay();
        const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
        const dayPreference =
            staff.dayPreferences &&
            staff.dayPreferences.find((pref) => pref.day_of_week === dayOfWeek);

        if (dayPreference && !dayPreference.available) {
            return `${dayNames[dayOfWeek]}曜日：勤務不可`;
        }

        return "勤務不可";
    };

    // 日付・期間管理
    const generateDaysInMonth = () => {
        const year = currentYear.value;
        const month = currentMonth.value;
        const closingDay = systemSettings.value.closing_day || 25;

        const { startDate, endDate } = getShiftPeriod(year, month, closingDay);
        const today = new Date();
        const days = [];

        const current = new Date(startDate);
        let processedDays = 0;
        let closedDaysCount = 0;

        while (current <= endDate) {
            const dateStr = `${current.getFullYear()}-${(current.getMonth() + 1)
                .toString()
                .padStart(2, "0")}-${current.getDate().toString().padStart(2, "0")}`;
            const dayOfWeek = current.getDay();
            const dayOfWeekLabel = ["日", "月", "火", "水", "木", "金", "土"][
                dayOfWeek
            ];

            const storeClosedForDay = isStoreClosedOnDate(dateStr);

            if (storeClosedForDay) {
                closedDaysCount++;
            }

            days.push({
                date: dateStr,
                day: current.getDate(),
                dayOfWeek,
                dayOfWeekLabel,
                isHoliday: isHoliday(dateStr) || dayOfWeek === 0 || dayOfWeek === 6,
                isNationalHoliday: isHoliday(dateStr),
                isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
                isStoreClosed: storeClosedForDay,
                isToday:
                    today.getFullYear() === current.getFullYear() &&
                    today.getMonth() === current.getMonth() &&
                    today.getDate() === current.getDate(),
            });

            current.setDate(current.getDate() + 1);
            processedDays++;
        }

        daysInMonth.value = days;
    };

    const setDefaultSelectedDate = () => {
        const today = new Date();
        const todayString = `${today.getFullYear()}-${(today.getMonth() + 1)
            .toString()
            .padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}`;

        const todayExists = daysInMonth.value.some(
            (day) => day.date === todayString
        );

        if (todayExists) {
            selectedDate.value = todayString;
        } else {
            const firstDayOfMonthString = `${currentYear.value}-${String(
                currentMonth.value
            ).padStart(2, "0")}-01`;
            const firstDayOfMonthExists = daysInMonth.value.some(
                (day) => day.date === firstDayOfMonthString
            );

            if (firstDayOfMonthExists) {
                selectedDate.value = firstDayOfMonthString;
            } else if (daysInMonth.value.length > 0) {
                selectedDate.value = daysInMonth.value[0].date;
            } else {
                selectedDate.value = null;
            }
        }

        updateSelectedDateCalendar();
        updateDateRanges();
    };

    const updateSelectedDateCalendar = () => {
        if (selectedDate.value) {
            selectedDateCalendar.value = new Date(selectedDate.value);
        }
    };

    const updateDateRanges = () => {
        if (daysInMonth.value.length > 0) {
            minSelectableDate.value = new Date(daysInMonth.value[0].date);
            maxSelectableDate.value = new Date(
                daysInMonth.value[daysInMonth.value.length - 1].date
            );
        }
    };

    const setDefaultMonthView = () => {
        if (!systemSettings.value) return;

        const today = new Date();
        const closingDay = systemSettings.value.closing_day || 25;
        let year = today.getFullYear();
        let month = today.getMonth() + 1;

        if (today.getDate() > closingDay) {
            if (month === 12) {
                month = 1;
                year += 1;
            } else {
                month += 1;
            }
        }

        currentYear.value = year;
        currentMonth.value = month;
    };

    return {
        // 状態
        loading,
        saving,
        isEditMode,
        selectionDialogVisible,
        selectedDate,
        selectedDateCalendar,
        minSelectableDate,
        maxSelectableDate,
        timelineHours,
        hourOptions,
        minuteOptions,
        currentYear,
        currentMonth,
        selectedStore,
        stores,
        staffList,
        shifts,
        daysInMonth,
        currentShift,
        systemSettings,
        shiftEditorDialog,
        storeRequirements,
        currentStore,
        storeBusinessHours,
        storeClosedDays,
        allStoreShifts,
        allSystemStaff,
        allSystemStoreShifts,
        holidays,

        // コンピューテッド
        hasCurrentShift,

        // ユーティリティ関数
        parseTimeToFloat,
        parseTimeToComponents,
        combineTimeComponents,
        formatTime,
        formatHours,
        isPastDate,
        formatDateToString,
        formatSelectedDateDisplay,
        generateTimeOptions,

        // 祝日関連
        fetchHolidays,
        isHoliday,

        // システム設定関連
        fetchSystemSettings,
        getShiftPeriod,
        setDefaultMonthView,

        // 店舗関連
        isStoreClosedOnDate,
        fetchStoreDetails,

        // シフト関連
        getShiftForStaff,
        calculateDayHours,
        calculateTotalHours,

        // スタッフ警告関連
        hasShiftViolation,
        getShiftViolations,

        // スタッフ勤務可能性チェック
        canStaffWorkOnDate,
        getWorkAvailabilityTooltip,
        getWorkUnavailabilityReason,

        // 日付・期間管理
        generateDaysInMonth,
        setDefaultSelectedDate,
        updateSelectedDateCalendar,
        updateDateRanges,
    };
}