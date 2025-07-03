<template>
  <div class="shift-management">
    <div class="header-section">
      <h1 class="page-title">シフト管理</h1>
    </div>

    <div class="cp-area">
      <div class="control-panel">
        <div class="period-controls">
          <div class="month-navigator">
            <Button
              icon="pi pi-chevron-left"
              class="nav-button"
              @click="handlePreviousMonth"
              :disabled="loading"
            />
            <div class="period-display">
              <span class="year">{{ currentYear }}</span>
              <span class="month">{{ currentMonth }}月</span>
            </div>
            <Button
              icon="pi pi-chevron-right"
              class="nav-button"
              @click="handleNextMonth"
              :disabled="loading"
            />
          </div>

          <Dropdown
            v-model="selectedStore"
            :options="stores"
            optionLabel="name"
            placeholder="店舗を選択"
            class="store-selector"
            @change="handleStoreChange"
            :disabled="loading || stores.length === 0"
          />
        </div>

        <div class="action-controls">
          <Button
            v-if="!hasCurrentShift"
            label="シフト作成"
            icon="pi pi-plus"
            class="action-button create-button"
            @click="handleCreateShift"
            :disabled="loading || !selectedStore"
          />

          <template v-if="hasCurrentShift">
            <Button
              :label="isEditMode ? '編集完了' : 'シフト編集'"
              :icon="isEditMode ? 'pi pi-check' : 'pi pi-pencil'"
              :class="
                isEditMode
                  ? 'action-button edit-button active'
                  : 'action-button edit-button'
              "
              @click="handleToggleEditMode"
              :disabled="loading"
            />

            <Button
              label="AI再生成"
              icon="pi pi-refresh"
              class="action-button regenerate-button"
              @click="handleRegenerateShift"
              :disabled="loading"
            />

            <Button
              label="シフト削除"
              icon="pi pi-trash"
              class="action-button delete-button"
              @click="handleDeleteShift"
              :disabled="loading"
            />

            <Button
              label="印刷"
              icon="pi pi-print"
              class="action-button print-button"
              @click="handlePrintShift"
              :disabled="loading"
            />
          </template>
        </div>
      </div>
    </div>

    <div class="shift-content">
      <div v-if="loading" class="loading-state">
        <ProgressSpinner />
        <span class="loading-text">データを読み込み中...</span>
      </div>

      <div v-else-if="!selectedStore" class="empty-state">
        <div class="empty-icon">
          <i class="pi pi-building"></i>
        </div>
        <h3>店舗を選択してください</h3>
        <p>シフトを表示するには店舗を選択する必要があります</p>
      </div>

      <div v-else-if="!hasCurrentShift" class="empty-state">
        <div class="empty-icon">
          <i class="pi pi-calendar-plus"></i>
        </div>
        <h3>シフトがありません</h3>
        <p>
          {{ currentYear }}年{{
            currentMonth
          }}月のシフトはまだ作成されていません
        </p>
        <Button
          label="シフトを作成"
          icon="pi pi-plus"
          class="action-button create-button"
          @click="handleCreateShift"
        />
      </div>

      <div v-else class="sc-wrap">
        <ShiftCalendarComponent
          :isEditMode="isEditMode"
          :selectedDate="selectedDate"
          :selectedStore="selectedStore"
          :daysInMonth="daysInMonth"
          :staffList="staffList"
          :shifts="shifts"
          :getShiftForStaff="getShiftForStaff"
          :calculateTotalHours="calculateTotalHours"
          :calculateTotalHoursAllStores="calculateTotalHoursAllStores"
          :getOtherStoreHoursBreakdown="getOtherStoreHoursBreakdown"
          :isHoursOutOfRangeAllStores="isHoursOutOfRangeAllStores"
          :hasStaffWarningsAllStores="hasStaffWarningsAllStores"
          :getStaffWarningsAllStores="getStaffWarningsAllStores"
          :hasDateWarnings="hasDateWarnings"
          :getDateWarnings="getDateWarnings"
          :hasShiftViolation="hasShiftViolation"
          :getShiftViolations="getShiftViolations"
          :canStaffWorkOnDate="canStaffWorkOnDate"
          :getWorkAvailabilityTooltip="getWorkAvailabilityTooltip"
          :getWorkUnavailabilityReason="getWorkUnavailabilityReason"
          :formatTime="formatTime"
          :formatHours="formatHours"
          :isPastDate="isPastDate"
          @select-date="handleSelectDate"
          @open-shift-editor="handleOpenShiftEditor"
          @quick-delete-shift="handleQuickDeleteShift"
        />

        <div v-if="selectedDate" class="daily-details-wrapper">
          <GanttChartComponent
            :selectedDate="selectedDate"
            :selectedDateCalendar="selectedDateCalendar"
            :minSelectableDate="minSelectableDate"
            :maxSelectableDate="maxSelectableDate"
            :selectedStore="selectedStore"
            :staffList="staffList"
            :timelineHours="timelineHours"
            :loading="loading"
            :isEditMode="isEditMode"
            :shifts="shifts"
            :getShiftForStaff="getShiftForStaff"
            :calculateTotalHours="calculateTotalHours"
            :calculateTotalHoursAllStores="calculateTotalHoursAllStores"
            :getOtherStoreHoursBreakdown="getOtherStoreHoursBreakdown"
            :isHoursOutOfRangeAllStores="isHoursOutOfRangeAllStores"
            :hasStaffWarningsAllStores="hasStaffWarningsAllStores"
            :getStaffWarningsAllStores="getStaffWarningsAllStores"
            :isStoreClosedOnDate="isStoreClosedOnDate"
            :hasHourRequirements="hasHourRequirements"
            :getHourRequirements="getHourRequirements"
            :hasRequirementShortage="hasRequirementShortage"
            :getAssignedStaffCount="getAssignedStaffCount"
            :hasShiftViolation="hasShiftViolation"
            :canStaffWorkOnDate="canStaffWorkOnDate"
            :formatSelectedDateDisplay="formatSelectedDateDisplay"
            :formatTime="formatTime"
            :formatHours="formatHours"
            :isPastDate="isPastDate"
            @previous-date="handlePreviousDate"
            @next-date="handleNextDate"
            @gantt-date-select="handleGanttDateSelect"
            @open-gantt-shift-editor="handleOpenGanttShiftEditor"
            @open-shift-editor="handleOpenShiftEditor"
            @update:selectedDateCalendar="selectedDateCalendar = $event"
          />

          <DailyInfoPanelComponent
            :selectedDate="selectedDate"
            :selectedStore="selectedStore"
            :staffList="staffList"
            :shifts="shifts"
            :getDailyShiftStaff="getDailyShiftStaff"
            :hasDateWarnings="hasDateWarnings"
            :getDateWarnings="getDateWarnings"
            :getDailyRequirements="getDailyRequirements"
            :hasStaffingShortage="hasStaffingShortage"
            :getAssignedStaffCount="getAssignedStaffCount"
            :hasStaffWarningsAllStores="hasStaffWarningsAllStores"
            :isHoursOutOfRangeAllStores="isHoursOutOfRangeAllStores"
            :calculateTotalHours="calculateTotalHours"
            :getOtherStoreHoursBreakdown="getOtherStoreHoursBreakdown"
            :calculateTotalHoursAllStores="calculateTotalHoursAllStores"
            :getShiftForStaff="getShiftForStaff"
            :hasShiftViolation="hasShiftViolation"
            :getShiftViolations="getShiftViolations"
            :calculateDayHours="calculateDayHours"
            :formatTime="formatTime"
            :formatHours="formatHours"
          />
        </div>

        <AllStaffSummaryComponent
          :currentYear="currentYear"
          :currentMonth="currentMonth"
          :allStaff="allSystemStaff"
          :getAllStoreHoursBreakdownForAllStaff="getAllStoreHoursBreakdownForAllStaff"
          :calculateTotalHoursForAllSystemStaff="calculateTotalHoursForAllSystemStaff"
          :isHoursOutOfRangeForAllSystemStaff="isHoursOutOfRangeForAllSystemStaff"
          :hasStaffWarningsForAllSystemStaff="hasStaffWarningsForAllSystemStaff"
          :getStaffWarningsForAllSystemStaff="getStaffWarningsForAllSystemStaff"
          :getStaffStatus="getStaffStatus"
          :getStaffStatusInfo="getStaffStatusInfo"
          :formatHours="formatHours"
        />
      </div>
    </div>

    <ShiftEditorDialogComponent
      :visible="shiftEditorDialog.visible"
      :saving="saving"
      :shiftData="shiftEditorDialog"
      :hourOptions="hourOptions"
      :minuteOptions="minuteOptions"
      @update:visible="shiftEditorDialog.visible = $event"
      @close="handleCloseShiftEditor"
      @save="handleSaveShift"
      @clear="handleClearShift"
    />

    <Dialog
      v-model:visible="selectionDialogVisible"
      header="シフト作成方法の選択"
      :modal="true"
      :style="{ width: '50rem' }"
      :breakpoints="{ '960px': '75vw', '640px': '90vw' }"
    >
      <div class="grid">
        <div class="col-12 md:col-6 p-3">
          <div class="selection-card" @click="handleSelectAIGeneration">
            <div class="card-header">
              <i class="pi pi-sparkles"></i>
              <h3>AI自動生成</h3>
            </div>
            <p class="card-content">
              スタッフの勤務条件を最優先にシフトを組みます。人員要件を満たさない場合があるため、生成後に手動での調整が必要になることがあります。
            </p>
            <Button label="AIで作成" class="p-button-primary mt-auto" />
          </div>
        </div>
        <div class="col-12 md:col-6 p-3">
          <div class="selection-card" @click="handleSelectManualCreation">
            <div class="card-header">
              <i class="pi pi-pencil"></i>
              <h3>手動作成</h3>
            </div>
            <p class="card-content">
              空のシフト表が作成されます。すべての割り当てを手動で行い、ご自身で勤務条件を確認する必要があります。
            </p>
            <Button label="手動で作成" class="p-button-secondary mt-auto" />
          </div>
        </div>
      </div>
    </Dialog>

    <ConfirmDialog></ConfirmDialog>
    <Toast />
  </div>
</template>

<script>
import { ref, onMounted, watch, nextTick } from "vue";
import { useStore } from "vuex";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import InputMask from "primevue/inputmask";
import ProgressSpinner from "primevue/progressspinner";
import Message from "primevue/message";
import ConfirmDialog from "primevue/confirmdialog";
import Toast from "primevue/toast";
import Checkbox from "primevue/checkbox";
import Textarea from "primevue/textarea";
import SelectButton from "primevue/selectbutton";
import Calendar from "primevue/calendar";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import Dropdown from "primevue/dropdown";
import Divider from "primevue/divider";
import InputText from "primevue/inputtext";

// コンポーネントのインポート
import ShiftCalendarComponent from "@/components/shift/ShiftCalendar.vue";
import GanttChartComponent from "@/components/shift/GanttChart.vue";
import DailyInfoPanelComponent from "@/components/shift/DailyInfoPanel.vue";
import AllStaffSummaryComponent from "@/components/shift/AllStaffSummary.vue";
import ShiftEditorDialogComponent from "@/components/shift/ShiftEditorDialog.vue";

// Composablesのインポート
import { useShiftManagement } from "@/composables/useShiftManagement";
import { useAllStoreShiftManagement } from "@/composables/useAllStoreShiftManagement";
import { useShiftRequirements } from "@/composables/useShiftRequirements";
import { useShiftActions } from "@/composables/useShiftActions";
import { useShiftEditor } from "@/composables/useShiftEditor";
import { useShiftNavigation } from "@/composables/useShiftNavigation";

export default {
  name: "ShiftManagement",
  components: {
    InputMask,
    ProgressSpinner,
    Message,
    ConfirmDialog,
    Toast,
    Checkbox,
    Textarea,
    SelectButton,
    Calendar,
    Dialog,
    Button,
    Dropdown,
    Divider,
    InputText,
    ShiftCalendarComponent,
    GanttChartComponent,
    DailyInfoPanelComponent,
    AllStaffSummaryComponent,
    ShiftEditorDialogComponent,
  },

  setup() {
    const store = useStore();
    const toast = useToast();
    const confirm = useConfirm();

    // 基本状態
    const loading = ref(false);
    const isEditMode = ref(false);
    const selectionDialogVisible = ref(false);

    // Composablesの利用
    const {
      // 状態
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
      storeRequirements,
      currentStore,
      storeBusinessHours,
      storeClosedDays,
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
    } = useShiftManagement();

    const {
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
    } = useAllStoreShiftManagement();

    const {
      // メソッド
      getDailyRequirements,
      hasHourRequirements,
      getHourRequirements,
      hasRequirementShortage,
      hasStaffingShortage,
      getAssignedStaffCount,
      hasDateWarnings,
      getDateWarnings,
      getDailyShiftStaff,
    } = useShiftRequirements();

    const {
      // 状態
      saving,

      // メソッド
      generateAutomaticShift,
      createEmptyShift,
      regenerateShift,
      deleteShift,
      saveShift,
      clearShift,
      confirmQuickDelete,
      printShift,
      generatePrintContent,
    } = useShiftActions();

    const {
      // 状態
      shiftEditorDialog,

      // メソッド
      openShiftEditor,
      openGanttShiftEditor,
      closeShiftEditor,
    } = useShiftEditor();

    const {
      // メソッド
      selectDate,
      previousDate,
      nextDate,
      onGanttDateSelect,
      previousMonth,
      nextMonth,
    } = useShiftNavigation();

    // データ読み込み関数
    const loadShiftData = async () => {
      if (!selectedStore.value) return;

      try {
        loading.value = true;

        // シフトデータの取得
        const shiftData = await store.dispatch("shift/fetchShiftByYearMonth", {
          year: currentYear.value,
          month: currentMonth.value,
          storeId: selectedStore.value.id,
        });

        // シフトデータの設定
        if (shiftData && shiftData.shifts) {
          shifts.value = shiftData.shifts;
          currentShift.value = {
            id: shiftData.id,
            store_id: shiftData.store_id,
            year: shiftData.year,
            month: shiftData.month,
            status: shiftData.status,
          };
        } else {
          shifts.value = [];
          currentShift.value = null;
        }

        // スタッフデータの取得
        const staffData = await store.dispatch("staff/fetchStaff", selectedStore.value.id);
        staffList.value = staffData || [];

        // 他店舗シフトデータの取得
        await fetchAllStoreShifts(staffList.value, selectedStore.value, currentYear.value, currentMonth.value);

        // 全システムデータの取得
        await fetchAllSystemStaffAndShifts(currentYear.value, currentMonth.value);

        // 店舗詳細の取得
        await fetchStoreDetails(selectedStore.value.id);

        // 日付データの生成
        generateDaysInMonth();
        setDefaultSelectedDate();

        console.log("シフトデータ読み込み完了:", {
          shifts: shifts.value.length,
          staff: staffList.value.length,
          currentShift: currentShift.value,
          hasCurrentShift: hasCurrentShift.value,
        });
      } catch (error) {
        console.error("シフトデータ読み込みエラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "データの読み込みに失敗しました",
          life: 3000,
        });
      } finally {
        loading.value = false;
      }
    };

    // 初期化関数
    const initializeData = async () => {
      try {
        loading.value = true;

        // 時間オプションの生成
        generateTimeOptions();

        // システム設定の取得
        await fetchSystemSettings();

        // デフォルト月表示の設定
        setDefaultMonthView();

        // 祝日データの取得
        await fetchHolidays(currentYear.value);

        // 店舗データの取得
        const storeData = await store.dispatch("store/fetchStores");
        stores.value = storeData || [];

        // デフォルト店舗の設定
        if (stores.value.length > 0 && !selectedStore.value) {
          selectedStore.value = stores.value[0];
          await loadShiftData();
        }

        console.log("初期化完了:", {
          stores: stores.value.length,
          selectedStore: selectedStore.value?.name,
          currentYear: currentYear.value,
          currentMonth: currentMonth.value,
        });
      } catch (error) {
        console.error("初期化エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "アプリケーションの初期化に失敗しました",
          life: 5000,
        });
      } finally {
        loading.value = false;
      }
    };

    // イベントハンドラー
    const handleStoreChange = async () => {
      await loadShiftData();
    };

    const handleToggleEditMode = () => {
      isEditMode.value = !isEditMode.value;
      toast.add({
        severity: "info",
        summary: isEditMode.value ? "編集モード開始" : "編集モード終了",
        detail: isEditMode.value
          ? "シフトセルをクリックして編集できます"
          : "編集モードを終了しました",
        life: 3000,
      });
    };

    const handleCreateShift = () => {
      const hasStaffData = staffList.value && staffList.value.length > 0;

      if (!hasStaffData) {
        toast.add({
          severity: "warn",
          summary: "注意",
          detail: "スタッフが登録されていません。先にスタッフを登録してください。",
          life: 5000,
        });
        return;
      }

      const hasValidStaff = staffList.value.some((staff) => {
        const hasValidDayPreferences =
          staff.dayPreferences &&
          staff.dayPreferences.some((pref) => pref.available);
        return hasValidDayPreferences;
      });

      if (!hasValidStaff) {
        toast.add({
          severity: "warn",
          summary: "注意",
          detail: "勤務可能なスタッフがいません。スタッフの勤務設定を確認してください。",
          life: 5000,
        });
      }

      selectionDialogVisible.value = true;
    };

    const handleSelectAIGeneration = async () => {
      selectionDialogVisible.value = false;
      await generateAutomaticShift(
        selectedStore.value,
        currentYear.value,
        currentMonth.value,
        staffList.value,
        hasStaffWarningsAllStores,
        getStaffWarningsAllStores,
        hasDateWarnings,
        getDateWarnings,
        daysInMonth.value,
        formatHours,
        loadShiftData
      );
    };

    const handleSelectManualCreation = async () => {
      selectionDialogVisible.value = false;
      await createEmptyShift(
        selectedStore.value,
        currentYear.value,
        currentMonth.value,
        loadShiftData
      );
      isEditMode.value = true;
    };

    const handleRegenerateShift = async () => {
      await regenerateShift(
        currentYear.value,
        currentMonth.value,
        () => generateAutomaticShift(
          selectedStore.value,
          currentYear.value,
          currentMonth.value,
          staffList.value,
          hasStaffWarningsAllStores,
          getStaffWarningsAllStores,
          hasDateWarnings,
          getDateWarnings,
          daysInMonth.value,
          formatHours,
          loadShiftData
        )
      );
    };

    const handleDeleteShift = async () => {
      const success = await deleteShift(
        currentYear.value,
        currentMonth.value,
        selectedStore.value
      );
      if (success) {
        await loadShiftData();
      }
    };

    const handlePrintShift = () => {
      printShift(
        hasCurrentShift.value,
        selectedStore.value,
        currentYear.value,
        currentMonth.value,
        daysInMonth.value,
        staffList.value,
        getShiftForStaff,
        formatTime,
        formatHours,
        calculateTotalHours,
        calculateTotalHoursAllStores
      );
    };

    const handlePreviousMonth = async () => {
      await previousMonth(
        currentYear,
        currentMonth,
        fetchHolidays,
        loadShiftData,
        fetchAllSystemStaffAndShifts,
        setDefaultSelectedDate
      );
    };

    const handleNextMonth = async () => {
      await nextMonth(
        currentYear,
        currentMonth,
        fetchHolidays,
        loadShiftData,
        fetchAllSystemStaffAndShifts,
        setDefaultSelectedDate
      );
    };

    const handleSelectDate = (date) => {
      selectDate(date, updateSelectedDateCalendar);
    };

    const handlePreviousDate = () => {
      previousDate(daysInMonth.value);
    };

    const handleNextDate = () => {
      nextDate(daysInMonth.value);
    };

    const handleGanttDateSelect = (event) => {
      onGanttDateSelect(event, daysInMonth.value, formatDateToString);
    };

    const handleOpenShiftEditor = async (day, staff) => {
      await openShiftEditor(day, staff, getShiftForStaff, parseTimeToComponents, isPastDate);
    };

    const handleOpenGanttShiftEditor = (date, staff, event) => {
      openGanttShiftEditor(date, staff, event, isEditMode.value, isStoreClosedOnDate, getShiftForStaff, isPastDate);
    };

    const handleCloseShiftEditor = () => {
      closeShiftEditor();
    };

    const handleSaveShift = async (shiftData) => {
      const success = await saveShift(
        shiftData,
        selectedStore.value,
        currentYear.value,
        currentMonth.value,
        getShiftForStaff,
        combineTimeComponents,
        loadShiftData,
        fetchAllSystemStaffAndShifts
      );
      if (success) {
        closeShiftEditor();
      }
    };

    const handleClearShift = async () => {
      const success = await clearShift(
        shiftEditorDialog,
        currentYear.value,
        currentMonth.value,
        getShiftForStaff,
        loadShiftData,
        fetchAllSystemStaffAndShifts
      );
      if (success) {
        closeShiftEditor();
      }
    };

    const handleQuickDeleteShift = async (shift) => {
      await confirmQuickDelete(shift, currentYear.value, currentMonth.value, loadShiftData);
    };

    // ライフサイクル
    onMounted(async () => {
      await initializeData();
    });

    // 監視
    watch(selectedStore, async (newStore) => {
      if (newStore) {
        await loadShiftData();
      }
    });

    return {
      // 基本状態
      loading,
      isEditMode,
      selectionDialogVisible,

      // shiftManagementから
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
      storeRequirements,
      currentStore,
      storeBusinessHours,
      storeClosedDays,
      holidays,
      hasCurrentShift,
      parseTimeToFloat,
      parseTimeToComponents,
      combineTimeComponents,
      formatTime,
      formatHours,
      isPastDate,
      formatDateToString,
      formatSelectedDateDisplay,
      generateTimeOptions,
      fetchHolidays,
      isHoliday,
      fetchSystemSettings,
      getShiftPeriod,
      setDefaultMonthView,
      isStoreClosedOnDate,
      fetchStoreDetails,
      getShiftForStaff,
      calculateDayHours,
      calculateTotalHours,
      hasShiftViolation,
      getShiftViolations,
      canStaffWorkOnDate,
      getWorkAvailabilityTooltip,
      getWorkUnavailabilityReason,
      generateDaysInMonth,
      setDefaultSelectedDate,
      updateSelectedDateCalendar,
      updateDateRanges,

      // allStoreShiftManagementから
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

      // shiftRequirementsから
      getDailyRequirements,
      hasHourRequirements,
      getHourRequirements,
      hasRequirementShortage,
      hasStaffingShortage,
      getAssignedStaffCount,
      hasDateWarnings,
      getDateWarnings,
      getDailyShiftStaff,

      // shiftActionsから
      saving,
      generateAutomaticShift,
      createEmptyShift,
      regenerateShift,
      deleteShift,
      saveShift,
      clearShift,
      confirmQuickDelete,
      printShift,
      generatePrintContent,

      // shiftEditorから
      shiftEditorDialog,
      openShiftEditor,
      openGanttShiftEditor,
      closeShiftEditor,

      // shiftNavigationから
      selectDate,
      previousDate,
      nextDate,
      onGanttDateSelect,
      previousMonth,
      nextMonth,

      // イベントハンドラー
      handleStoreChange,
      handleToggleEditMode,
      handleCreateShift,
      handleSelectAIGeneration,
      handleSelectManualCreation,
      handleRegenerateShift,
      handleDeleteShift,
      handlePrintShift,
      handlePreviousMonth,
      handleNextMonth,
      handleSelectDate,
      handlePreviousDate,
      handleNextDate,
      handleGanttDateSelect,
      handleOpenShiftEditor,
      handleOpenGanttShiftEditor,
      handleCloseShiftEditor,
      handleSaveShift,
      handleClearShift,
      handleQuickDeleteShift,

      // その他の関数
      loadShiftData,
      initializeData,
    };
  },
};
</script>

<style scoped lang="scss">
.shift-management {
  min-height: 100vh;
  padding: 1rem;
  max-width: 100%;
  margin: 0 auto;
  min-width: 768px;
  width: 100%;
  box-sizing: border-box;
}

@media (min-width: 1536px) {
  .shift-management {
    padding: 1rem;
    max-width: 1400px;
  }
}

.header-section {
  margin-bottom: 0.5rem;
}

.control-panel {
  background: white;
  border-radius: 0px;
  padding: 1.5rem;
  margin: 0 0 0px 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  max-width: 100%;
}

@media (min-width: 1536px) {
  .control-panel {
    padding: 2rem;
    gap: 1.5rem;
  }
}

@media (min-width: 1920px) {
  .control-panel {
    padding: 2.5rem;
    gap: 2rem;
  }
}

.period-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.month-navigator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #f8f9fa;
  padding: 0.5rem;
  border-radius: 8px;
}

.nav-button {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  background: white;
  border: 1px solid #e0e0e0;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  cursor: pointer;
}

.nav-button:hover:not(:disabled) {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.nav-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.period-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 100px;
}

.year {
  font-size: 0.8rem;
  color: #666;
}

.month {
  font-size: 1.25rem;
  font-weight: 600;
  color: #2c3e50;
}

.store-selector {
  min-width: 220px;
}

.action-controls {
  display: flex;
  gap: 0.75rem;
}

.action-button {
  padding: 0.5rem 1.25rem;
  border-radius: 8px;
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.2s;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.create-button {
  background: #10b981;
  color: white;
  border: 1px solid #10b981;
}

.create-button:hover:not(:disabled) {
  background: #059669;
  border-color: #059669;
}

.edit-button {
  background: white;
  color: #666;
  border: 1px solid #e0e0e0;
}

.edit-button:hover:not(:disabled) {
  background: #f8f9fa;
  border-color: #ccc;
}

.edit-button.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.regenerate-button,
.print-button,
.delete-button {
  background: white;
  color: #666;
  border: 1px solid #e0e0e0;
}

.regenerate-button:hover:not(:disabled),
.print-button:hover:not(:disabled) {
  background: #f8f9fa;
  border-color: #ccc;
}

.delete-button {
  background: #ef4444;
  color: white;
  border: 1px solid #ef4444;
}

.delete-button:hover:not(:disabled) {
  background: #dc2626;
  border-color: #dc2626;
}

.loading-state,
.empty-state {
  background: white;
  padding: 4rem 2rem;
  text-align: center;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.loading-text {
  font-size: 1rem;
  color: #666;
}

.empty-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 1.5rem;
  border-radius: 50%;
  background: #f0f4ff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: #3b82f6;
}

.empty-state h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.empty-state p {
  color: #666;
  margin-bottom: 2rem;
}

.shift-content {
  overflow: hidden;
  padding: 30px 20px;
  background: linear-gradient(135deg, #e8ebed, #dfe3e6);
}

.daily-details-wrapper {
  margin-top: 1.5rem;
  background-color: #ffffff;
  border-radius: 6px;
}

:deep(.p-confirm-dialog-message) {
  white-space: pre-line;
}

.selection-card {
  border-radius: 8px;
  padding: 1.5rem;
  height: 100%;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  display: flex;
  flex-direction: column;
  text-align: center;
  background-color: var(--surface-a);
  box-shadow: 0px 0px 2px rgb(103, 103, 103);
}

.selection-card:hover {
  transform: translate(0, -2px);
  box-shadow: 0px 0px 6px rgb(69, 146, 213);
}

.selection-card .card-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  font-size: 1.25rem;
  margin-bottom: 1rem;
}

.selection-card .card-header i {
  font-size: 1.75rem;
  color: var(--primary-color);
}

.selection-card .card-header h3 {
  margin: 0;
  font-weight: 600;
  color: var(--text-color);
}

.selection-card .card-content {
  color: var(--text-color-secondary);
  flex-grow: 1;
  line-height: 1.6;
  margin-bottom: 1.5rem;
  white-space: pre-line;
  text-align: left;
}

@media (max-width: 768px) {
  .shift-management {
    padding: 1rem;
    min-width: 768px;
    margin-left: 0;
    margin-right: 0;
    width: 100vw;
    box-sizing: border-box;
  }

  .control-panel {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }

  .period-controls,
  .action-controls {
    width: 100%;
    justify-content: center;
    flex-wrap: wrap;
  }

  .action-controls {
    gap: 0.5rem;
  }

  .action-button {
    flex: 1;
    min-width: 140px;
  }
}
</style>
