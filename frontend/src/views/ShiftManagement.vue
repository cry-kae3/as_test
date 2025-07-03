// ShiftManagement.vueの親コンポーネント側で必要な修正部分

// setupメソッド内に以下を追加

// ガントチャート用の日付更新ハンドラー
const updateSelectedDateCalendar = (value) => {
  selectedDateCalendar.value = value;
  if (value) {
    const selectedDateStr = formatDateToString(value);
    if (daysInMonth.value.some((day) => day.date === selectedDateStr)) {
      selectedDate.value = selectedDateStr;
    }
  }
};

// シフトエディタダイアログの表示状態更新
const updateShiftEditorVisible = (value) => {
  shiftEditorDialog.visible = value;
};

// return文に以下を追加
return {
  // 既存の戻り値...
  updateSelectedDateCalendar,
  updateShiftEditorVisible,
  // ...その他
};

// テンプレート部分での修正例

/*
<GanttChart
  :selected-date="selectedDate"
  :selected-date-calendar="selectedDateCalendar"
  @update:selectedDateCalendar="updateSelectedDateCalendar"
  // その他のpropsとイベント
/>

<ShiftEditorDialog
  :visible="shiftEditorDialog.visible"
  @update:visible="updateShiftEditorVisible"
  // その他のpropsとイベント
/>
*/