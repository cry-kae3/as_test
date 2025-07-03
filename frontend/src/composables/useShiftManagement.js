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
        shifts
    }
}