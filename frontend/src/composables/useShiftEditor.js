import { reactive } from "vue";

export function useShiftEditor() {

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

    // シフトエディタ開く
    const openShiftEditor = async (day, staff, getShiftForStaff, parseTimeToComponents, isPastDate) => {
        const shift = getShiftForStaff(day.date, staff.id);

        shiftEditorDialog.title = `${staff.last_name} ${staff.first_name} - ${day.date}`;
        shiftEditorDialog.date = day.date;
        shiftEditorDialog.staff = staff;
        shiftEditorDialog.isPast = isPastDate(day.date);
        shiftEditorDialog.changeReason = "";

        if (shift) {
            const startTime = parseTimeToComponents(shift.start_time);
            const endTime = parseTimeToComponents(shift.end_time);

            shiftEditorDialog.startTimeHour = startTime.hour;
            shiftEditorDialog.startTimeMinute = startTime.minute;
            shiftEditorDialog.endTimeHour = endTime.hour;
            shiftEditorDialog.endTimeMinute = endTime.minute;
            shiftEditorDialog.isRestDay = shift.is_day_off;
            shiftEditorDialog.hasShift = true;

            if (shift.break_start_time && shift.break_end_time) {
                shiftEditorDialog.hasBreak = true;
                const breakStart = parseTimeToComponents(shift.break_start_time);
                const breakEnd = parseTimeToComponents(shift.break_end_time);
                shiftEditorDialog.breakStartTimeHour = breakStart.hour;
                shiftEditorDialog.breakStartTimeMinute = breakStart.minute;
                shiftEditorDialog.breakEndTimeHour = breakEnd.hour;
                shiftEditorDialog.breakEndTimeMinute = breakEnd.minute;
            } else {
                shiftEditorDialog.hasBreak = false;
                shiftEditorDialog.breakStartTimeHour = "";
                shiftEditorDialog.breakStartTimeMinute = "";
                shiftEditorDialog.breakEndTimeHour = "";
                shiftEditorDialog.breakEndTimeMinute = "";
            }
        } else {
            shiftEditorDialog.startTimeHour = "09";
            shiftEditorDialog.startTimeMinute = "00";
            shiftEditorDialog.endTimeHour = "18";
            shiftEditorDialog.endTimeMinute = "00";
            shiftEditorDialog.isRestDay = false;
            shiftEditorDialog.hasShift = false;
            shiftEditorDialog.hasBreak = false;
            shiftEditorDialog.breakStartTimeHour = "";
            shiftEditorDialog.breakStartTimeMinute = "";
            shiftEditorDialog.breakEndTimeHour = "";
            shiftEditorDialog.breakEndTimeMinute = "";
        }

        shiftEditorDialog.visible = true;
    };

    // ガントチャートシフトエディタ開く
    const openGanttShiftEditor = (date, staff, event, isEditMode, isStoreClosedOnDate, getShiftForStaff, isPastDate) => {
        if (!isEditMode) return;
        if (isStoreClosedOnDate(date)) return;

        const existingShift = getShiftForStaff(date, staff.id);
        if (existingShift) return;

        const rect = event.currentTarget.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const hourWidth = 60;

        const clickedHour = Math.floor(clickX / hourWidth);
        const startHour = clickedHour.toString().padStart(2, "0");
        const endHour = (clickedHour + 8).toString().padStart(2, "0");

        shiftEditorDialog.title = `${staff.last_name} ${staff.first_name} - ${date}`;
        shiftEditorDialog.date = date;
        shiftEditorDialog.staff = staff;
        shiftEditorDialog.startTimeHour = startHour;
        shiftEditorDialog.startTimeMinute = "00";
        shiftEditorDialog.endTimeHour = endHour;
        shiftEditorDialog.endTimeMinute = "00";
        shiftEditorDialog.isRestDay = false;
        shiftEditorDialog.isPast = isPastDate(date);
        shiftEditorDialog.hasShift = false;
        shiftEditorDialog.changeReason = "";
        shiftEditorDialog.visible = true;
    };

    // シフトエディタ閉じる
    const closeShiftEditor = () => {
        shiftEditorDialog.visible = false;
    };

    return {
        // 状態
        shiftEditorDialog,

        // メソッド
        openShiftEditor,
        openGanttShiftEditor,
        closeShiftEditor,
    };
}