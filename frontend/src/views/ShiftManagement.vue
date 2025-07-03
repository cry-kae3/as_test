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
              @click="previousMonth"
              :disabled="loading"
            />
            <div class="period-display">
              <span class="year">{{ currentYear }}</span>
              <span class="month">{{ currentMonth }}月</span>
            </div>
            <Button
              icon="pi pi-chevron-right"
              class="nav-button"
              @click="nextMonth"
              :disabled="loading"
            />
          </div>

          <Dropdown
            v-model="selectedStore"
            :options="stores"
            optionLabel="name"
            placeholder="店舗を選択"
            class="store-selector"
            @change="changeStore"
            :disabled="loading || stores.length === 0"
          />
        </div>

        <div class="action-controls">
          <Button
            v-if="!hasCurrentShift"
            label="シフト作成"
            icon="pi pi-plus"
            class="action-button create-button"
            @click="createShift"
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
              @click="toggleEditMode"
              :disabled="loading"
            />

            <Button
              label="AI再生成"
              icon="pi pi-refresh"
              class="action-button regenerate-button"
              @click="regenerateShift"
              :disabled="loading"
            />

            <Button
              label="シフト削除"
              icon="pi pi-trash"
              class="action-button delete-button"
              @click="deleteShift"
              :disabled="loading"
            />

            <Button
              label="印刷"
              icon="pi pi-print"
              class="action-button print-button"
              @click="printShift"
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
          @click="createShift"
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
          @select-date="selectDate"
          @open-shift-editor="openShiftEditor"
          @quick-delete-shift="confirmQuickDelete"
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
            @previous-date="previousDate"
            @next-date="nextDate"
            @gantt-date-select="onGanttDateSelect"
            @open-gantt-shift-editor="openGanttShiftEditor"
            @open-shift-editor="openShiftEditor"
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
      @close="closeShiftEditor"
      @save="saveShift"
      @clear="clearShift"
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
          <div class="selection-card" @click="selectAIGeneration">
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
          <div class="selection-card" @click="selectManualCreation">
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
import { ref, reactive, computed, onMounted, watch, nextTick } from "vue";
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
import api from "@/services/api";
import InputText from "primevue/inputtext";

// コンポーネントのインポート
import ShiftCalendarComponent from "./components/shift/ShiftCalendar.vue";
import GanttChartComponent from "./components/shift/GanttChart.vue";
import DailyInfoPanelComponent from "./components/shift/DailyInfoPanel.vue";
import AllStaffSummaryComponent from "./components/shift/AllStaffSummary.vue";
import ShiftEditorDialogComponent from "./components/shift/ShiftEditorDialog.vue";

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

    // 日次シフトスタッフ取得
    const getDailyShiftStaff = (date) => {
      if (!date || !staffList.value) return [];

      const dayShifts = shifts.value.find((shift) => shift.date === date);
      if (!dayShifts || !dayShifts.assignments) return [];

      const shiftStaffIds = dayShifts.assignments.map(
        (assignment) => assignment.staff_id
      );

      return staffList.value.filter((staff) =>
        shiftStaffIds.includes(staff.id)
      );
    };

    // 店舗が特定日に閉店かどうか
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

    // 全店舗のシフトデータ取得
    const fetchAllStoreShifts = async () => {
      if (
        !staffList.value ||
        staffList.value.length === 0 ||
        !selectedStore.value
      ) {
        return;
      }

      try {
        const uniqueStoreIds = new Set();

        staffList.value.forEach((staff) => {
          let storeIds = [];
          if (staff.store_ids && Array.isArray(staff.store_ids)) {
            storeIds = staff.store_ids;
          } else if (staff.stores && Array.isArray(staff.stores)) {
            storeIds = staff.stores.map((s) => s.id);
          }

          storeIds.forEach((id) => {
            if (id !== selectedStore.value.id) {
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
                  year: currentYear.value,
                  month: currentMonth.value,
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
    const fetchAllSystemStaffAndShifts = async () => {
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
              `/shifts/${currentYear.value}/${currentMonth.value}?store_id=${store.id}`
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
    const getOtherStoreHoursBreakdown = (staffId) => {
      const breakdown = [];
      const staff = staffList.value.find((s) => s.id === staffId);
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
          storeIdNum === selectedStore.value?.id ||
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
          const storeInfo = stores.value.find((s) => s.id === storeIdNum);
          breakdown.push({
            storeId: storeIdNum,
            storeName: storeInfo ? storeInfo.name : `店舗${storeIdNum}`,
            hours: Math.round((totalMinutes / 60) * 10) / 10,
          });
        }
      });

      return breakdown.sort((a, b) => a.storeName.localeCompare(b.storeName));
    };

    // 当店舗の総勤務時間計算
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

    // 全店舗の総勤務時間計算
    const calculateTotalHoursAllStores = (staffId) => {
      let totalMinutes = 0;

      // 現在の店舗の勤務時間を計算
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

      const staff = staffList.value.find((s) => s.id === staffId);
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
          storeIdNum === selectedStore.value?.id ||
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
    const isHoursOutOfRangeAllStores = (staffId) => {
      const staff = staffList.value.find((s) => s.id === staffId);
      if (!staff) return false;

      const totalHours = calculateTotalHoursAllStores(staffId);
      const minHours = staff.min_hours_per_month || 0;
      const maxHours = staff.max_hours_per_month || 0;

      if (minHours === 0 && maxHours === 0) return false;

      return totalHours < minHours || totalHours > maxHours;
    };

    // スタッフ警告（全店舗）があるかチェック
    const hasStaffWarningsAllStores = (staffId) => {
      const staff = staffList.value.find((s) => s.id === staffId);
      if (!staff) return false;

      const totalHours = calculateTotalHoursAllStores(staffId);
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

      shifts.value.forEach((dayShift) => {
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
    const getStaffWarningsAllStores = (staffId) => {
      const warnings = [];
      const staff = staffList.value.find((s) => s.id === staffId);
      if (!staff) return warnings;

      const totalHours = calculateTotalHoursAllStores(staffId);
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
      shifts.value.forEach((dayShift) => {
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
              message: `${dayShift.date}: 勤務不可曜日に割り当て (${
                ["日", "月", "火", "水", "木", "金", "土"][dayOfWeek]
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
              message: `${dayShift.date}: 休み希望日に割り当て (${
                dayOffRequest.reason || "お休み"
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

    // シフト違反があるかチェック
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

    // シフト違反内容取得
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
          message: `${
            ["日", "月", "火", "水", "木", "金", "土"][dayOfWeek]
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

    // 日付警告があるかチェック
    const hasDateWarnings = (date) => {
      const requirements = getDailyRequirements(date);
      return (
        requirements.some((req) => hasStaffingShortage(date, req)) ||
        staffList.value.some((staff) => hasShiftViolation(date, staff.id))
      );
    };

    // 日付警告取得
    const getDateWarnings = (date) => {
      const warnings = [];
      const requirements = getDailyRequirements(date);

      requirements.forEach((req) => {
        if (hasStaffingShortage(date, req)) {
          const assigned = getAssignedStaffCount(date, req);
          warnings.push({
            type: "staffing_shortage",
            icon: "pi pi-users",
            message: `${formatTime(req.start_time)}-${formatTime(
              req.end_time
            )}: 人員不足 (${assigned}/${req.required_staff_count}名)`,
          });
        }
      });

      staffList.value.forEach((staff) => {
        if (hasShiftViolation(date, staff.id)) {
          warnings.push({
            type: "staff_violation",
            icon: "pi pi-exclamation-triangle",
            message: `${staff.last_name} ${staff.first_name}: 勤務条件違反`,
          });
        }
      });

      return warnings;
    };

    // 前の日付へ移動
    const previousDate = () => {
      if (!selectedDate.value || daysInMonth.value.length === 0) return;

      const currentIndex = daysInMonth.value.findIndex(
        (day) => day.date === selectedDate.value
      );
      if (currentIndex > 0) {
        selectedDate.value = daysInMonth.value[currentIndex - 1].date;
      }
    };

    // 次の日付へ移動
    const nextDate = () => {
      if (!selectedDate.value || daysInMonth.value.length === 0) return;

      const currentIndex = daysInMonth.value.findIndex(
        (day) => day.date === selectedDate.value
      );
      if (currentIndex < daysInMonth.value.length - 1) {
        selectedDate.value = daysInMonth.value[currentIndex + 1].date;
      }
    };

    // 日次要件取得
    const getDailyRequirements = (date) => {
      if (!storeRequirements.value || storeRequirements.value.length === 0) {
        return [];
      }

      const dayOfWeek = new Date(date).getDay();

      const specificRequirements = storeRequirements.value.filter(
        (req) => req.specific_date && req.specific_date === date
      );

      if (specificRequirements.length > 0) {
        return specificRequirements;
      }

      return storeRequirements.value.filter(
        (req) => req.day_of_week === dayOfWeek && !req.specific_date
      );
    };

    // 時間要件があるかチェック
    const hasHourRequirements = (date, hour) => {
      const requirements = getDailyRequirements(date);
      return requirements.some((req) => {
        const reqStartHour = parseTimeToFloat(req.start_time);
        const reqEndHour = parseTimeToFloat(req.end_time);
        return hour >= reqStartHour && hour < reqEndHour;
      });
    };

    // 時間要件取得
    const getHourRequirements = (date, hour) => {
      const requirements = getDailyRequirements(date);
      return requirements.filter((req) => {
        const reqStartHour = parseTimeToFloat(req.start_time);
        const reqEndHour = parseTimeToFloat(req.end_time);
        return hour >= reqStartHour && hour < reqEndHour;
      });
    };

    // 時間フォーマット
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

    // クイック削除確認
    const confirmQuickDelete = (shift) => {
      if (!shift) return;

      confirm.require({
        message: "このシフトを削除しますか？",
        header: "シフト削除の確認",
        icon: "pi pi-exclamation-triangle",
        acceptClass: "p-button-danger",
        acceptLabel: "削除",
        rejectLabel: "キャンセル",
        accept: async () => {
          try {
            await store.dispatch("shift/deleteShiftAssignment", {
              year: currentYear.value,
              month: currentMonth.value,
              assignmentId: shift.id,
            });

            await loadShiftData();

            toast.add({
              severity: "success",
              summary: "削除完了",
              detail: "シフトを削除しました",
              life: 3000,
            });
          } catch (error) {
            toast.add({
              severity: "error",
              summary: "エラー",
              detail: "シフトの削除に失敗しました",
              life: 3000,
            });
          }
        },
      });
    };

    // スタッフが特定日に勤務可能かチェック
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

    // 勤務可能性ツールチップ取得
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

    // 勤務不可理由取得
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

    // 要件不足があるかチェック
    const hasRequirementShortage = (date, requirement) => {
      const assignedCount = getAssignedStaffCount(date, requirement);
      return assignedCount < requirement.required_staff_count;
    };

    // 日勤務時間計算
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

    // 人員不足があるかチェック
    const hasStaffingShortage = (date, requirement) => {
      const assignedCount = getAssignedStaffCount(date, requirement);
      return assignedCount < requirement.required_staff_count;
    };

    // 割り当てられたスタッフ数取得
    const getAssignedStaffCount = (date, requirement) => {
      const dayShifts = shifts.value.find((shift) => shift.date === date);
      if (!dayShifts) return 0;

      const reqStartTime = parseTimeToFloat(requirement.start_time);
      const reqEndTime = parseTimeToFloat(requirement.end_time);

      return dayShifts.assignments.filter((assignment) => {
        const shiftStartTime = parseTimeToFloat(assignment.start_time);
        const shiftEndTime = parseTimeToFloat(assignment.end_time);

        return shiftStartTime < reqEndTime && shiftEndTime > reqStartTime;
      }).length;
    };

    // 日付選択
    const selectDate = (date) => {
      selectedDate.value = date;
      updateSelectedDateCalendar();
      nextTick(() => {
        // スクロール関連の処理をここに追加
      });
    };

    // 選択日付カレンダー更新
    const updateSelectedDateCalendar = () => {
      if (selectedDate.value) {
        selectedDateCalendar.value = new Date(selectedDate.value);
      }
    };

    // 日付範囲更新
    const updateDateRanges = () => {
      if (daysInMonth.value.length > 0) {
        minSelectableDate.value = new Date(daysInMonth.value[0].date);
        maxSelectableDate.value = new Date(
          daysInMonth.value[daysInMonth.value.length - 1].date
        );
      }
    };

    // ガントチャート日付選択イベント
    const onGanttDateSelect = (event) => {
      if (event.value) {
        const selectedDateStr = formatDateToString(event.value);
        if (daysInMonth.value.some((day) => day.date === selectedDateStr)) {
          selectedDate.value = selectedDateStr;
        }
      }
    };

    // 日付を文字列にフォーマット
    const formatDateToString = (date) => {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const day = date.getDate().toString().padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    // 選択日付の表示フォーマット
    const formatSelectedDateDisplay = (date) => {
      if (!date) return "";
      const d = new Date(date);
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const dayOfWeek = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
      return `${month}月${day}日(${dayOfWeek})`;
    };

    // 祝日データ取得
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

    // 祝日チェック
    const isHoliday = (date) => {
      return holidays.value.includes(date);
    };

    // 時間を浮動小数点数にパース
    const parseTimeToFloat = (timeStr) => {
      const [hours, minutes] = timeStr.split(":").map(Number);
      return hours + minutes / 60;
    };

    // 時間をコンポーネントにパース
    const parseTimeToComponents = (timeStr) => {
      if (!timeStr) return { hour: "09", minute: "00" };
      const [hour, minute] = timeStr.split(":");
      return {
        hour: hour.padStart(2, "0"),
        minute: minute.padStart(2, "0"),
      };
    };

    // 時間コンポーネントを結合
    const combineTimeComponents = (hour, minute) => {
      return `${hour}:${minute}`;
    };

    // ガントチャートシフトエディタ開く
    const openGanttShiftEditor = (date, staff, event) => {
      if (!isEditMode.value) return;
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

    // システム設定取得
    const fetchSystemSettings = async () => {
      try {
        const response = await api.get("/shifts/system-settings");
        systemSettings.value = response.data;
      } catch (error) {
        systemSettings.value = { closing_day: 25 };
      }
    };

    // シフト期間取得
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

    // 過去の日付かチェック
    const isPastDate = (date) => {
      const today = new Date();
      const checkDate = new Date(date);
      today.setHours(0, 0, 0, 0);
      checkDate.setHours(0, 0, 0, 0);
      return checkDate < today;
    };

    // 編集モード切り替え
    const toggleEditMode = () => {
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

    // シフトエディタ開く
    const openShiftEditor = async (day, staff) => {
      if (!isEditMode.value) {
        toast.add({
          severity: "info",
          summary: "編集不可",
          detail: "「シフト編集」ボタンを押して編集モードにしてください",
          life: 2000,
        });
        return;
      }

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

    // シフトエディタ閉じる
    const closeShiftEditor = () => {
      shiftEditorDialog.visible = false;
    };

    // シフトデータ読み込み
    const loadShiftData = async () => {
      if (!selectedStore.value) {
        return;
      }

      loading.value = true;

      try {
        await fetchStoreDetails(selectedStore.value.id);

        const staffData = await store.dispatch(
          "staff/fetchStaff",
          selectedStore.value.id
        );
        staffList.value = staffData;

        try {
          const shiftData = await store.dispatch(
            "shift/fetchShiftByYearMonth",
            {
              year: currentYear.value,
              month: currentMonth.value,
              storeId: selectedStore.value.id,
            }
          );

          if (shiftData) {
            currentShift.value = {
              id: shiftData.id,
              store_id: shiftData.store_id,
              year: shiftData.year,
              month: shiftData.month,
              status: shiftData.status,
            };
            shifts.value = shiftData.shifts || [];
          } else {
            currentShift.value = null;
            shifts.value = [];
          }
        } catch (error) {
          if (error.response && error.response.status === 404) {
            currentShift.value = null;
            shifts.value = [];
          } else {
            throw error;
          }
        }

        if (staffList.value && staffList.value.length > 0) {
          await fetchAllStoreShifts();
        }

        generateDaysInMonth();
      } catch (error) {
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "シフトデータの取得に失敗しました",
          life: 3000,
        });
      } finally {
        loading.value = false;
      }
    };

    // 月内日数生成
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

    // デフォルト選択日設定
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

    // デフォルト月表示設定
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

    // 前月へ移動
    const previousMonth = async () => {
      if (currentMonth.value === 1) {
        currentYear.value--;
        currentMonth.value = 12;
      } else {
        currentMonth.value--;
      }
      await fetchHolidays(currentYear.value);
      await loadShiftData();
      await fetchAllSystemStaffAndShifts();
      setDefaultSelectedDate();
    };

    // 次月へ移動
    const nextMonth = async () => {
      if (currentMonth.value === 12) {
        currentYear.value++;
        currentMonth.value = 1;
      } else {
        currentMonth.value++;
      }
      await fetchHolidays(currentYear.value);
      await loadShiftData();
      await fetchAllSystemStaffAndShifts();
      setDefaultSelectedDate();
    };

    // 店舗詳細取得
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

    // 店舗変更
    const changeStore = async () => {
      if (selectedStore.value) {
        await loadShiftData();
        setDefaultSelectedDate();
      }
    };

    // AI自動シフト生成
    const generateAutomaticShift = async () => {
      try {
        loading.value = true;

        toast.add({
          severity: "info",
          summary: "シフト生成開始",
          detail: "AIによるシフト生成を開始しています...",
          life: 5000,
        });

        const params = {
          storeId: selectedStore.value.id,
          year: currentYear.value,
          month: currentMonth.value,
        };

        const result = await store.dispatch("shift/generateShift", params);

        await loadShiftData();

        const staffViolations = [];
        const dateViolations = [];

        staffList.value.forEach((staff) => {
          if (hasStaffWarningsAllStores(staff.id)) {
            const warnings = getStaffWarningsAllStores(staff.id);
            staffViolations.push(
              `${staff.last_name} ${staff.first_name}: ${warnings
                .map((w) => w.message)
                .join(", ")}`
            );
          }
        });

        daysInMonth.value.forEach((day) => {
          if (hasDateWarnings(day.date)) {
            const warnings = getDateWarnings(day.date);
            dateViolations.push(
              `${day.date}: ${warnings.map((w) => w.message).join(", ")}`
            );
          }
        });

        if (staffViolations.length > 0 || dateViolations.length > 0) {
          let warningMessage =
            "シフト生成は完了しましたが、以下の注意点があります：\n\n";

          if (staffViolations.length > 0) {
            warningMessage +=
              "【スタッフ関連】\n" + staffViolations.slice(0, 3).join("\n");
            if (staffViolations.length > 3) {
              warningMessage += `\n...他${staffViolations.length - 3}件`;
            }
            warningMessage += "\n\n";
          }

          if (dateViolations.length > 0) {
            warningMessage +=
              "【日付関連】\n" + dateViolations.slice(0, 3).join("\n");
            if (dateViolations.length > 3) {
              warningMessage += `\n...他${dateViolations.length - 3}件`;
            }
          }

          toast.add({
            severity: "warn",
            summary: "シフト生成完了（要確認）",
            detail: warningMessage,
            life: 10000,
          });
        } else {
          toast.add({
            severity: "success",
            summary: "シフト生成完了",
            detail: "制約を守ったシフトが正常に生成されました",
            life: 5000,
          });
        }
      } catch (error) {
        let errorMessage = "AIシフト生成に失敗しました";

        if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.message) {
          if (error.message.includes("制約違反")) {
            errorMessage =
              "スタッフの勤務条件を満たすシフトを生成できませんでした。勤務条件の見直しをご検討ください。";
          } else if (error.message.includes("最大試行回数")) {
            errorMessage =
              "制約条件が厳しすぎるため、シフトを生成できませんでした。条件を緩和するか、手動でシフトを作成してください。";
          } else {
            errorMessage = error.message;
          }
        }

        toast.add({
          severity: "error",
          summary: "生成エラー",
          detail: errorMessage,
          life: 8000,
        });

        confirm.require({
          message:
            "AIシフト生成に失敗しました。空のシフトを作成して手動で編集しますか？",
          header: "代替手段の提案",
          icon: "pi pi-question-circle",
          acceptLabel: "空シフト作成",
          rejectLabel: "キャンセル",
          accept: () => {
            createEmptyShift();
          },
        });
      } finally {
        loading.value = false;
      }
    };

    // シフト再生成
    const regenerateShift = async () => {
      confirm.require({
        message: `現在のシフトを削除してAIで再生成しますか？

⚠️ 注意：
- 現在のシフトは完全に削除されます
- スタッフの勤務条件に違反しないシフトが生成されます
- 条件が厳しい場合、生成に失敗する可能性があります`,
        header: "シフト再生成の確認",
        icon: "pi pi-exclamation-triangle",
        acceptClass: "p-button-warning",
        acceptLabel: "再生成実行",
        rejectLabel: "キャンセル",
        accept: async () => {
          await generateAutomaticShift();
        },
      });
    };

    // AI生成選択
    const selectAIGeneration = () => {
      selectionDialogVisible.value = false;
      generateAutomaticShift();
    };

    // 手動作成選択
    const selectManualCreation = () => {
      selectionDialogVisible.value = false;
      createEmptyShift();
    };

    // シフト作成
    const createShift = async () => {
      const hasStaffData = staffList.value && staffList.value.length > 0;

      if (!hasStaffData) {
        toast.add({
          severity: "warn",
          summary: "注意",
          detail:
            "スタッフが登録されていません。先にスタッフを登録してください。",
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
          detail:
            "勤務可能なスタッフがいません。スタッフの勤務設定を確認してください。",
          life: 5000,
        });
      }

      selectionDialogVisible.value = true;
    };

    // 空シフト作成
    const createEmptyShift = async () => {
      try {
        loading.value = true;

        await store.dispatch("shift/createShift", {
          store_id: selectedStore.value.id,
          year: currentYear.value,
          month: currentMonth.value,
          status: "draft",
        });

        await loadShiftData();
        isEditMode.value = true;

        toast.add({
          severity: "success",
          summary: "作成完了",
          detail: "シフトを作成しました。編集モードになりました。",
          life: 3000,
        });
      } catch (error) {
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "シフトの作成に失敗しました",
          life: 3000,
        });
      } finally {
        loading.value = false;
      }
    };

    // シフト印刷
    const printShift = () => {
      if (!hasCurrentShift.value) return;

      const printWindow = window.open("", "_blank");

      if (!printWindow) {
        toast.add({
          severity: "error",
          summary: "エラー",
          detail:
            "ポップアップがブロックされました。ブラウザの設定を確認してください。",
          life: 3000,
        });
        return;
      }

      const printContent = generatePrintContent();
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    };

    // 印刷コンテンツ生成
    const generatePrintContent = () => {
      const storeName = selectedStore.value ? selectedStore.value.name : "";
      const period = `${currentYear.value}年${currentMonth.value}月`;

      let printHtml = `
 <!DOCTYPE html>
 <html>
 <head>
   <title>${storeName} - ${period} シフト表</title>
   <meta charset="utf-8">
   <style>
     @media print {
       @page { margin: 1cm; size: A4 landscape; }
       body { font-family: Arial, sans-serif; font-size: 9px; }
     }
     body { font-family: Arial, sans-serif; font-size: 12px; }
     .print-header { 
       text-align: center; 
       margin-bottom: 20px; 
       page-break-after: avoid;
     }
     .print-title { 
       font-size: 16px; 
       font-weight: bold; 
       margin-bottom: 8px;
     }
     .print-period { 
       font-size: 12px; 
       color: #666;
     }
     .print-table { 
       width: 100%; 
       border-collapse: collapse; 
       margin-top: 10px;
       page-break-inside: avoid;
     }
     .print-table th, .print-table td { 
       border: 1px solid #333; 
       padding: 4px 2px; 
       text-align: center; 
       font-size: 8px;
       vertical-align: middle;
       -webkit-print-color-adjust: exact;
       color-adjust: exact;
     }
     .print-table th { 
       background-color: #f0f0f0; 
       font-weight: bold;
       font-size: 8px;
       -webkit-print-color-adjust: exact;
       color-adjust: exact;
     }
     .staff-col { 
       width: 80px; 
       text-align: left;
       padding-left: 4px;
       font-weight: bold;
     }
     .date-col { 
       width: 35px;
       font-weight: bold;
     }
     .shift-cell {
       font-size: 7px;
       line-height: 1.2;
     }
     .holiday { 
       color: #dc2626;
     }
     .store-closed { 
       background-color: #f3f4f6;
       color: #6b7280;
       -webkit-print-color-adjust: exact;
       color-adjust: exact;
     }
     .today { 
       background-color: #e6f3ff; 
       -webkit-print-color-adjust: exact;
       color-adjust: exact;
     }
     .summary-section {
       margin-top: 20px;
       page-break-inside: avoid;
     }
     .summary-title {
       font-size: 12px;
       font-weight: bold;
       margin-bottom: 10px;
     }
     .summary-table {
       width: 50%;
       border-collapse: collapse;
     }
     .summary-table th, .summary-table td {
       border: 1px solid #333;
       padding: 4px 8px;
       font-size: 9px;
     }
     .summary-table th {
       background-color: #f0f0f0;
       font-weight: bold;
       -webkit-print-color-adjust: exact;
       color-adjust: exact;
     }
   </style>
 </head>
 <body>
   <div class="print-header">
     <div class="print-title">${storeName} シフト表</div>
     <div class="print-period">${period}</div>
   </div>
   <table class="print-table">
     <thead>
       <tr>
         <th class="staff-col">スタッフ</th>
`;

      daysInMonth.value.forEach((day) => {
        const holidayClass = day.isHoliday ? "holiday" : "";
        const todayClass = day.isToday ? "today" : "";
        const storeClosedClass = day.isStoreClosed ? "store-closed" : "";
        const cellClass =
          `${holidayClass} ${todayClass} ${storeClosedClass}`.trim();
        printHtml += `
   <th class="date-col ${cellClass}">
     <div style="${
       day.isWeekend || day.isNationalHoliday
         ? "color: #dc2626;"
         : day.isStoreClosed && !day.isWeekend && !day.isNationalHoliday
         ? "color: #6b7280;"
         : ""
     }">${day.day}</div>
     <div style="font-size: 6px; ${
       day.isWeekend || day.isNationalHoliday
         ? "color: #dc2626;"
         : day.isStoreClosed && !day.isWeekend && !day.isNationalHoliday
         ? "color: #6b7280;"
         : ""
     }">${day.dayOfWeekLabel}</div>
          ${
            day.isNationalHoliday
              ? '<div style="font-size: 5px; color: red;">祝</div>'
              : ""
          }
          ${
            day.isStoreClosed && !day.isNationalHoliday && !day.isWeekend
              ? '<div style="font-size: 5px; color: #6b7280;">休</div>'
              : ""
          }
        </th>
      `;
      });

      printHtml += `
            </tr>
          </thead>
          <tbody>
    `;

      staffList.value.forEach((staff) => {
        printHtml += `<tr>`;
        printHtml += `<td class="staff-col">${staff.last_name} ${staff.first_name}</td>`;

        daysInMonth.value.forEach((day) => {
          const shift = getShiftForStaff(day.date, staff.id);
          const holidayClass = day.isHoliday ? "holiday" : "";
          const todayClass = day.isToday ? "today" : "";
          const storeClosedClass = day.isStoreClosed ? "store-closed" : "";
          const cellClass =
            `shift-cell ${holidayClass} ${todayClass} ${storeClosedClass}`.trim();

          if (shift) {
            printHtml += `<td class="${cellClass}">
            ${formatTime(shift.start_time)}<br>-<br>${formatTime(
              shift.end_time
            )}
          </td>`;
          } else if (day.isStoreClosed) {
            printHtml += `<td class="${cellClass}">定休日</td>`;
          } else {
            printHtml += `<td class="${cellClass}">-</td>`;
          }
        });

        printHtml += `</tr>`;
      });

      printHtml += `
          </tbody>
        </table>
        
        <div class="summary-section">
          <div class="summary-title">月間勤務時間集計</div>
          <table class="summary-table">
            <thead>
              <tr>
                <th>スタッフ</th>
                <th>${selectedStore.value.name}</th>
                <th>全店合計</th>
              </tr>
            </thead>
            <tbody>
    `;

      staffList.value.forEach((staff) => {
        const currentStoreHours = calculateTotalHours(staff.id);
        const allStoreHours = calculateTotalHoursAllStores(staff.id);

        printHtml += `
        <tr>
          <td>${staff.last_name} ${staff.first_name}</td>
          <td>${formatHours(currentStoreHours)}</td>
          <td>${formatHours(allStoreHours)}</td>
        </tr>
      `;
      });

      printHtml += `
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `;

      return printHtml;
    };

    // シフト保存
    const saveShift = async (shiftData) => {
      if (!shiftEditorDialog.date || !shiftEditorDialog.staff) return;

      if (shiftData.isRestDay) {
        await clearShift();
        return;
      }

      if (
        !shiftData.startTimeHour ||
        !shiftData.startTimeMinute ||
        !shiftData.endTimeHour ||
        !shiftData.endTimeMinute
      ) {
        toast.add({
          severity: "warn",
          summary: "入力エラー",
          detail: "開始時間と終了時間を選択してください",
          life: 3000,
        });
        return;
      }

      const startTime = combineTimeComponents(
        shiftData.startTimeHour,
        shiftData.startTimeMinute
      );
      const endTime = combineTimeComponents(
        shiftData.endTimeHour,
        shiftData.endTimeMinute
      );

      if (startTime >= endTime) {
        toast.add({
          severity: "warn",
          summary: "入力エラー",
          detail: "終了時間は開始時間より後にしてください",
          life: 3000,
        });
        return;
      }

      if (shiftEditorDialog.isPast && !shiftData.changeReason.trim()) {
        toast.add({
          severity: "warn",
          summary: "入力エラー",
          detail: "過去の日付を編集する場合は変更理由を入力してください",
          life: 3000,
        });
        return;
      }

      saving.value = true;

      try {
        const postData = {
          store_id: selectedStore.value.id,
          staff_id: shiftEditorDialog.staff.id,
          date: shiftEditorDialog.date,
          start_time: startTime,
          end_time: endTime,
          break_start_time: null,
          break_end_time: null,
          notes: null,
        };

        if (
          shiftData.hasBreak &&
          shiftData.breakStartTimeHour &&
          shiftData.breakStartTimeMinute &&
          shiftData.breakEndTimeHour &&
          shiftData.breakEndTimeMinute
        ) {
          const breakStartTime = combineTimeComponents(
            shiftData.breakStartTimeHour,
            shiftData.breakStartTimeMinute
          );
          const breakEndTime = combineTimeComponents(
            shiftData.breakEndTimeHour,
            shiftData.breakEndTimeMinute
          );

          if (
            breakStartTime >= startTime &&
            breakEndTime <= endTime &&
            breakStartTime < breakEndTime
          ) {
            postData.break_start_time = breakStartTime;
            postData.break_end_time = breakEndTime;
          }
        }

        if (shiftEditorDialog.isPast) {
          postData.change_reason = shiftData.changeReason;
        }

        const existingShift = getShiftForStaff(
          shiftEditorDialog.date,
          shiftEditorDialog.staff.id
        );

        if (existingShift) {
          await store.dispatch("shift/updateShiftAssignment", {
            year: currentYear.value,
            month: currentMonth.value,
            assignmentId: existingShift.id,
            assignmentData: postData,
          });
        } else {
          await store.dispatch("shift/createShiftAssignment", {
            year: currentYear.value,
            month: currentMonth.value,
            assignmentData: postData,
          });
        }

        await loadShiftData();
        await fetchAllSystemStaffAndShifts();
        shiftEditorDialog.visible = false;

        const successMessage = shiftEditorDialog.isPast
          ? "過去のシフトを変更しました（変更履歴に記録されます）"
          : "シフトを保存しました";

        toast.add({
          severity: "success",
          summary: "保存完了",
          detail: successMessage,
          life: 3000,
        });
      } catch (error) {
        let errorMessage = "シフトの保存に失敗しました";
        if (
          error.response &&
          error.response.data &&
          error.response.data.message
        ) {
          errorMessage = error.response.data.message;
        }

        toast.add({
          severity: "error",
          summary: "エラー",
          detail: errorMessage,
          life: 3000,
        });
      } finally {
        saving.value = false;
      }
    };

    // シフトクリア
    const clearShift = async (data) => {
      if (!shiftEditorDialog.hasShift) {
        shiftEditorDialog.visible = false;
        return;
      }

      if (shiftEditorDialog.isPast && !data?.changeReason?.trim()) {
        toast.add({
          severity: "warn",
          summary: "入力エラー",
          detail: "過去の日付を編集する場合は変更理由を入力してください",
          life: 3000,
        });
        return;
      }

      saving.value = true;

      try {
        const existingShift = getShiftForStaff(
          shiftEditorDialog.date,
          shiftEditorDialog.staff.id
        );

        if (existingShift) {
          await store.dispatch("shift/deleteShiftAssignment", {
            year: currentYear.value,
            month: currentMonth.value,
            assignmentId: existingShift.id,
            change_reason: shiftEditorDialog.isPast
              ? data.changeReason
              : null,
          });

          await loadShiftData();
          await fetchAllSystemStaffAndShifts();
          shiftEditorDialog.visible = false;

          const successMessage = shiftEditorDialog.isPast
            ? "過去のシフトを削除しました（変更履歴に記録されます）"
            : "シフトを削除しました";

          toast.add({
            severity: "success",
            summary: "削除完了",
            detail: successMessage,
            life: 3000,
          });
        }
      } catch (error) {
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "シフトの削除に失敗しました",
          life: 3000,
        });
      } finally {
        saving.value = false;
      }
    };

    // スタッフのシフト取得
    const getShiftForStaff = (date, staffId) => {
      const dayShifts = shifts.value.find((s) => s.date === date);
      if (!dayShifts) return null;

      return dayShifts.assignments.find((a) => a.staff_id === staffId);
    };

    // 時間フォーマット
    const formatTime = (time) => {
      if (!time) return "";
      return time.slice(0, 5);
    };

    // シフト削除
    const deleteShift = async () => {
      confirm.require({
        message: `${currentYear.value}年${currentMonth.value}月のシフトを完全に削除しますか？この操作は取り消せません。`,
        header: "シフト削除の確認",
        icon: "pi pi-exclamation-triangle",
        acceptClass: "p-button-danger",
        acceptLabel: "削除",
        rejectLabel: "キャンセル",
        accept: async () => {
          try {
            loading.value = true;

            await store.dispatch("shift/deleteShift", {
              year: currentYear.value,
              month: currentMonth.value,
              storeId: selectedStore.value.id,
            });

            currentShift.value = null;
            shifts.value = [];
            selectedDate.value = null;
            isEditMode.value = false;

            toast.add({
              severity: "success",
              summary: "削除完了",
              detail: "シフトを削除しました",
              life: 3000,
            });
          } catch (error) {
            toast.add({
              severity: "error",
              summary: "エラー",
              detail: "シフトの削除に失敗しました",
              life: 3000,
            });
          } finally {
            loading.value = false;
          }
        },
      });
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
                const dayHours = calculateDayHours(assignment);
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

    // ステータス表示用の関数を追加
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

    // 監視
    watch([currentYear, currentMonth], async () => {
      await loadShiftData();
      await fetchAllSystemStaffAndShifts();
      setDefaultSelectedDate();
    });

    // マウント時処理
    onMounted(async () => {
      try {
        generateTimeOptions();
        await fetchSystemSettings();
        setDefaultMonthView();

        await fetchHolidays(currentYear.value);

        const storeData = await store.dispatch("store/fetchStores");
        stores.value = storeData;

        if (storeData.length > 0) {
          selectedStore.value = storeData[0];
          await fetchStoreDetails(selectedStore.value.id);
          await loadShiftData();
          await fetchAllSystemStaffAndShifts();
          setDefaultSelectedDate();
        }
      } catch (error) {
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "データの取得に失敗しました",
          life: 3000,
        });
      }
    });

    return {
      // 状態
      deleteShift,
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

      // コンピューテッド
      hasCurrentShift,

      // メソッド
      getDailyShiftStaff,
      isStoreClosedOnDate,
      isHoursOutOfRangeAllStores,
      calculateTotalHoursAllStores,
      getOtherStoreHoursBreakdown,
      hasStaffWarningsAllStores,
      getStaffWarningsAllStores,
      selectDate,
      onGanttDateSelect,
      formatDateToString,
      updateSelectedDateCalendar,
      updateDateRanges,
      formatSelectedDateDisplay,
      isPastDate,
      toggleEditMode,
      openShiftEditor,
      closeShiftEditor,
      previousMonth,
      nextMonth,
      previousDate,
      nextDate,
      changeStore,
      createShift,
      selectAIGeneration,
      selectManualCreation,
      regenerateShift,
      printShift,
      saveShift,
      clearShift,
      getShiftForStaff,
      formatTime,
      calculateTotalHours,
      getDailyRequirements,
      calculateDayHours,
      fetchStoreDetails,
      hasStaffingShortage,
      getAssignedStaffCount,
      hasShiftViolation,
      getShiftViolations,
      hasDateWarnings,
      getDateWarnings,
      hasHourRequirements,
      getHourRequirements,
      hasRequirementShortage,
      formatHours,
      canStaffWorkOnDate,
      getWorkAvailabilityTooltip,
      getWorkUnavailabilityReason,
      confirmQuickDelete,
      getAllStoreHoursBreakdownForAllStaff,
      calculateTotalHoursForAllSystemStaff,
      isHoursOutOfRangeForAllSystemStaff,
      hasStaffWarningsForAllSystemStaff,
      getStaffWarningsForAllSystemStaff,
      getStaffStatus,
      getStaffStatusInfo,
      checkStaffOtherWarnings,
      openGanttShiftEditor
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