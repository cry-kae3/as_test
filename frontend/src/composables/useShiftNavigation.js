import { nextTick } from "vue";

export function useShiftNavigation() {

    // 日付選択
    const selectDate = (date, selectedDate, updateSelectedDateCalendar) => {
        selectedDate.value = date;
        updateSelectedDateCalendar();
        nextTick(() => {
            // スクロール関連の処理をここに追加
        });
    };

    // 前の日付へ移動
    const previousDate = (selectedDate, daysInMonth) => {
        if (!selectedDate.value || daysInMonth.length === 0) return;

        const currentIndex = daysInMonth.findIndex(
            (day) => day.date === selectedDate.value
        );
        if (currentIndex > 0) {
            selectedDate.value = daysInMonth[currentIndex - 1].date;
        }
    };

    // 次の日付へ移動
    const nextDate = (selectedDate, daysInMonth) => {
        if (!selectedDate.value || daysInMonth.length === 0) return;

        const currentIndex = daysInMonth.findIndex(
            (day) => day.date === selectedDate.value
        );
        if (currentIndex < daysInMonth.length - 1) {
            selectedDate.value = daysInMonth[currentIndex + 1].date;
        }
    };

    // ガントチャート日付選択イベント
    const onGanttDateSelect = (event, selectedDate, daysInMonth, formatDateToString) => {
        if (event.value) {
            const selectedDateStr = formatDateToString(event.value);
            if (daysInMonth.some((day) => day.date === selectedDateStr)) {
                selectedDate.value = selectedDateStr;
            }
        }
    };

    // 前月へ移動
    const previousMonth = async (currentYear, currentMonth, fetchHolidays, loadShiftData, fetchAllSystemStaffAndShifts, setDefaultSelectedDate) => {
        let year = currentYear.value;
        let month = currentMonth.value;

        if (month === 1) {
            year--;
            month = 12;
        } else {
            month--;
        }

        currentYear.value = year;
        currentMonth.value = month;

        await fetchHolidays(year);
        await loadShiftData();
        await fetchAllSystemStaffAndShifts();
        setDefaultSelectedDate();
    };

    // 次月へ移動
    const nextMonth = async (currentYear, currentMonth, fetchHolidays, loadShiftData, fetchAllSystemStaffAndShifts, setDefaultSelectedDate) => {
        let year = currentYear.value;
        let month = currentMonth.value;

        if (month === 12) {
            year++;
            month = 1;
        } else {
            month++;
        }

        currentYear.value = year;
        currentMonth.value = month;

        await fetchHolidays(year);
        await loadShiftData();
        await fetchAllSystemStaffAndShifts();
        setDefaultSelectedDate();
    };

    return {
        // メソッド
        selectDate,
        previousDate,
        nextDate,
        onGanttDateSelect,
        previousMonth,
        nextMonth,
    };
}