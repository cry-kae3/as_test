<template>
  <div class="shift-management">
    <div class="header-section">
      <h1 class="page-title">シフト管理</h1>
    </div>

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

      <div class="view-controls">
        <div class="view-mode-tabs">
          <button
            class="view-tab"
            :class="{ active: viewMode === 'calendar' }"
            @click="setViewMode('calendar')"
          >
            <i class="pi pi-table"></i>
            カレンダー
          </button>
          <button
            class="view-tab"
            :class="{ active: viewMode === 'gantt' }"
            @click="setViewMode('gantt')"
          >
            <i class="pi pi-chart-bar"></i>
            ガントチャート
          </button>
        </div>
        <div v-if="viewMode === 'gantt'" class="date-selector">
          <Dropdown
            v-model="selectedDate"
            :options="dateOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="日付を選択"
            class="date-dropdown"
          />
        </div>
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
            label="印刷"
            icon="pi pi-print"
            class="action-button print-button"
            @click="printShift"
            :disabled="loading"
          />
        </template>
      </div>
    </div>

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
        {{ currentYear }}年{{ currentMonth }}月のシフトはまだ作成されていません
      </p>
      <Button
        label="シフトを作成"
        icon="pi pi-plus"
        class="action-button create-button"
        @click="createShift"
      />
    </div>

    <div v-else class="shift-content">
      <div v-if="isEditMode" class="edit-mode-indicator">
        <i class="pi pi-pencil"></i>
        <span>編集モード - セルをクリックして編集</span>
      </div>

      <div v-if="viewMode === 'calendar'" class="calendar-view">
        <div class="calendar-container">
          <div class="calendar-header">
            <div class="staff-column-header">
              <span>スタッフ</span>
            </div>
            <div
              v-for="day in daysInMonth"
              :key="day.date"
              class="date-cell-header"
              :class="{
                'is-weekend': day.isWeekend,
                'is-holiday': day.isNationalHoliday,
                'is-today': day.isToday,
                'is-selected': selectedDate === day.date,
                'has-warnings': hasDateWarnings(day.date),
              }"
              @click="selectDate(day.date)"
            >
              <div class="date-number">{{ day.day }}</div>
              <div class="date-weekday">{{ day.dayOfWeekLabel }}</div>
              <div v-if="day.isNationalHoliday" class="holiday-indicator">
                祝
              </div>
              <!-- ↓ ここを修正 -->
              <div
                v-if="hasDateWarnings(day.date)"
                class="warning-indicator"
                :data-warning-count="getDateWarnings(day.date).length"
              >
                <i class="pi pi-exclamation-triangle"></i>
                <div class="warning-tooltip">
                  <div
                    v-for="warning in getDateWarnings(day.date)"
                    :key="warning.type"
                    class="warning-tooltip-item"
                    :class="warning.type"
                  >
                    <i :class="warning.icon"></i>
                    <span>{{ warning.message }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="calendar-body">
            <div v-for="staff in staffList" :key="staff.id" class="staff-row">
              <div class="staff-info">
                <div class="staff-avatar">
                  {{ staff.first_name.charAt(0) }}
                </div>
                <div class="staff-details">
                  <span class="staff-name"
                    >{{ staff.last_name }} {{ staff.first_name }}</span
                  >
                  <span class="staff-role">{{ staff.position || "一般" }}</span>
                  <div class="staff-hours-info">
                    <span class="current-hours"
                      >{{ calculateTotalHours(staff.id) }}h</span
                    >
                    <span class="hours-range"
                      >/ {{ staff.max_hours_per_month || 0 }}h</span
                    >
                  </div>
                  <div v-if="hasStaffWarnings(staff.id)" class="staff-warnings">
                    <div
                      v-for="warning in getStaffWarnings(staff.id)"
                      :key="warning.type"
                      class="warning-badge"
                      :title="warning.message"
                    >
                      {{ warning.icon }}
                    </div>
                  </div>
                </div>
              </div>

              <div
                v-for="day in daysInMonth"
                :key="`${staff.id}-${day.date}`"
                class="shift-cell"
                :class="{
                  'is-weekend': day.isWeekend,
                  'is-holiday': day.isNationalHoliday,
                  'is-today': day.isToday,
                  'is-past': isPastDate(day.date),
                  'is-editable': isEditMode,
                  'has-shift': getShiftForStaff(day.date, staff.id),
                  'past-editable': isEditMode && isPastDate(day.date),
                  'is-selected': selectedDate === day.date,
                  'has-violation': hasShiftViolation(day.date, staff.id),
                }"
                @click="openShiftEditor(day, staff)"
              >
                <div
                  v-if="getShiftForStaff(day.date, staff.id)"
                  class="shift-time-card"
                  :class="{
                    violation: hasShiftViolation(day.date, staff.id),
                  }"
                >
                  <div class="shift-start">
                    {{
                      formatTime(
                        getShiftForStaff(day.date, staff.id).start_time
                      )
                    }}
                  </div>
                  <div class="shift-separator">-</div>
                  <div class="shift-end">
                    {{
                      formatTime(getShiftForStaff(day.date, staff.id).end_time)
                    }}
                  </div>
                  <div
                    v-if="hasShiftViolation(day.date, staff.id)"
                    class="violation-icon"
                  >
                    <i class="pi pi-exclamation-triangle"></i>
                    <div class="violation-tooltip">
                      <div
                        v-for="violation in getShiftViolations(
                          day.date,
                          staff.id
                        )"
                        :key="violation.type"
                        class="violation-tooltip-item"
                      >
                        {{ violation.message }}
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else class="no-shift">
                  <span v-if="isEditMode">+</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="gantt-info-panel">
          <div class="date-info-header">
            <h3>{{ formatDateForGantt(selectedDate) }}</h3>
            <div v-if="hasDateWarnings(selectedDate)" class="date-warnings">
              <div
                v-for="warning in getDateWarnings(selectedDate)"
                :key="warning.type"
                class="warning-item"
                :class="warning.type"
              >
                <i :class="warning.icon"></i>
                <span>{{ warning.message }}</span>
              </div>
            </div>
          </div>

          <div class="requirements-section">
            <h4 class="section-title">
              <i class="pi pi-users"></i>
              人員要件
            </h4>
            <div
              v-if="getDailyRequirements(selectedDate).length > 0"
              class="requirements-list"
            >
              <div
                v-for="req in getDailyRequirements(selectedDate)"
                :key="`req-${req.start_time}-${req.end_time}`"
                class="requirement-item"
                :class="{
                  shortage: hasStaffingShortage(selectedDate, req),
                }"
              >
                <div class="time-range">
                  {{ formatTime(req.start_time) }} -
                  {{ formatTime(req.end_time) }}
                </div>
                <div class="staff-count">
                  <span class="assigned-count">{{
                    getAssignedStaffCount(selectedDate, req)
                  }}</span>
                  <span class="separator">/</span>
                  <span class="required-count">{{
                    req.required_staff_count
                  }}</span>
                  <span class="count-unit">名</span>
                </div>
                <div
                  v-if="hasStaffingShortage(selectedDate, req)"
                  class="shortage-icon"
                >
                  <i class="pi pi-exclamation-triangle"></i>
                </div>
              </div>
            </div>
            <div v-else class="no-requirements">
              <i class="pi pi-info-circle"></i>
              <span>設定なし</span>
            </div>
          </div>

          <div class="staff-summary-section">
            <h4 class="section-title">
              <i class="pi pi-user"></i>
              スタッフ状況
            </h4>
            <div class="staff-summary-grid">
              <div
                v-for="staff in staffList"
                :key="`summary-${staff.id}`"
                class="staff-summary-card"
                :class="{
                  'has-warnings': hasStaffWarnings(staff.id),
                }"
              >
                <div class="staff-header">
                  <div class="staff-avatar-tiny">
                    {{ staff.first_name.charAt(0) }}
                  </div>
                  <div class="staff-name-summary">
                    {{ staff.last_name }} {{ staff.first_name }}
                  </div>
                  <div
                    v-if="hasStaffWarnings(staff.id)"
                    class="warning-indicator-small"
                  >
                    <i class="pi pi-exclamation-triangle"></i>
                  </div>
                </div>

                <div class="summary-stats">
                  <div class="stat-item">
                    <span class="stat-value"
                      >{{ calculateTotalHours(staff.id) }}h</span
                    >
                    <span class="stat-range"
                      >/{{ staff.max_hours_per_month || 0 }}h</span
                    >
                  </div>

                  <div
                    v-if="getShiftForStaff(selectedDate, staff.id)"
                    class="today-shift"
                  >
                    <span class="today-hours">
                      本日:
                      {{
                        calculateDayHours(
                          getShiftForStaff(selectedDate, staff.id)
                        )
                      }}h
                    </span>
                    <div
                      v-if="hasShiftViolation(selectedDate, staff.id)"
                      class="violations"
                    >
                      <div
                        v-for="violation in getShiftViolations(
                          selectedDate,
                          staff.id
                        )"
                        :key="violation.type"
                        class="violation-badge"
                        :title="violation.message"
                      >
                        {{ violation.icon }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="viewMode === 'gantt' && selectedDate" class="gantt-view">
        <div class="gantt-container" ref="ganttContainer">
          <div class="gantt-header">
            <div class="gantt-staff-header">
              <span>スタッフ</span>
            </div>
            <div class="gantt-timeline-header" ref="ganttTimelineHeader">
              <div
                v-for="hour in timelineHours"
                :key="hour"
                class="gantt-hour-cell"
                :style="getTimeHeaderStyle()"
              >
                <div class="hour-label">
                  {{ hour.toString().padStart(2, "0") }}:00
                </div>
                <div
                  v-if="hasHourRequirements(selectedDate, hour)"
                  class="hour-requirements"
                >
                  <div
                    v-for="req in getHourRequirements(selectedDate, hour)"
                    :key="`${req.start_time}-${req.end_time}`"
                    class="hour-requirement-badge"
                    :class="{
                      shortage: hasRequirementShortage(selectedDate, req),
                    }"
                  >
                    {{ getAssignedStaffCount(selectedDate, req) }}/{{
                      req.required_staff_count
                    }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="gantt-body" ref="ganttBody" @scroll="syncGanttScroll">
            <div class="gantt-staff-rows">
              <div
                v-for="staff in staffList"
                :key="`gantt-${selectedDate}-${staff.id}`"
                class="gantt-staff-row"
                :class="{
                  'has-warnings': hasStaffWarnings(staff.id),
                }"
              >
                <div class="gantt-staff-info">
                  <div class="staff-avatar-small">
                    {{ staff.first_name.charAt(0) }}
                  </div>
                  <div class="gantt-staff-details">
                    <span class="staff-name-small"
                      >{{ staff.last_name }} {{ staff.first_name }}</span
                    >
                    <div class="staff-hours-small">
                      <span class="current-hours"
                        >{{ calculateTotalHours(staff.id) }}h</span
                      >
                      <span class="hours-range"
                        >/{{ staff.max_hours_per_month || 0 }}h</span
                      >
                    </div>
                  </div>
                  <div
                    v-if="hasStaffWarnings(staff.id)"
                    class="warning-indicator-gantt"
                  >
                    <i class="pi pi-exclamation-triangle"></i>
                  </div>
                </div>

                <div
                  class="gantt-timeline"
                  @click="openGanttShiftEditor(selectedDate, staff, $event)"
                >
                  <div class="gantt-grid">
                    <div
                      v-for="hour in timelineHours"
                      :key="`grid-${hour}`"
                      class="gantt-hour-line"
                      :style="getTimeHeaderStyle()"
                    ></div>
                  </div>

                  <div
                    v-if="getShiftForStaff(selectedDate, staff.id)"
                    class="gantt-shift-block"
                    :style="
                      getGanttBarStyle(getShiftForStaff(selectedDate, staff.id))
                    "
                    :class="{
                      'is-editable': isEditMode,
                      'is-past-editable':
                        isEditMode && isPastDate(selectedDate),
                      'has-violation': hasShiftViolation(
                        selectedDate,
                        staff.id
                      ),
                    }"
                    @click.stop="openShiftEditor({ date: selectedDate }, staff)"
                  >
                    <span class="shift-time-text">
                      {{
                        formatTime(
                          getShiftForStaff(selectedDate, staff.id).start_time
                        )
                      }}
                      -
                      {{
                        formatTime(
                          getShiftForStaff(selectedDate, staff.id).end_time
                        )
                      }}
                    </span>
                    <div
                      v-if="hasShiftViolation(selectedDate, staff.id)"
                      class="gantt-violation-icon"
                    >
                      <i class="pi pi-exclamation-triangle"></i>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="viewMode === 'gantt' && !selectedDate" class="gantt-no-date">
        <div class="empty-icon">
          <i class="pi pi-calendar"></i>
        </div>
        <h3>日付を選択してください</h3>
        <p>ガントチャートを表示するには日付を選択してください</p>
      </div>
    </div>

    <Dialog
      v-model:visible="shiftEditorDialog.visible"
      :header="shiftEditorDialog.title"
      :modal="true"
      class="shift-editor-dialog"
      :style="{ width: '500px' }"
      :closable="!saving"
    >
      <div class="shift-editor-form">
        <div v-if="shiftEditorDialog.isPast" class="status-alert warning">
          <i class="pi pi-exclamation-triangle"></i>
          <span>過去の日付を編集しています。変更は履歴に記録されます。</span>
        </div>

        <div class="time-inputs-section">
          <div class="time-input-group">
            <label class="form-label">開始時間</label>
            <div class="time-selector">
              <Dropdown
                v-model="shiftEditorDialog.startTimeHour"
                :options="hourOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="時"
                class="time-dropdown"
              />
              <span class="time-separator">:</span>
              <Dropdown
                v-model="shiftEditorDialog.startTimeMinute"
                :options="minuteOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="分"
                class="time-dropdown"
              />
            </div>
          </div>

          <div class="time-input-group">
            <label class="form-label">終了時間</label>
            <div class="time-selector">
              <Dropdown
                v-model="shiftEditorDialog.endTimeHour"
                :options="hourOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="時"
                class="time-dropdown"
              />
              <span class="time-separator">:</span>
              <Dropdown
                v-model="shiftEditorDialog.endTimeMinute"
                :options="minuteOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="分"
                class="time-dropdown"
              />
            </div>
          </div>
        </div>

        <div class="form-group checkbox-group">
          <Checkbox
            v-model="shiftEditorDialog.isRestDay"
            binary
            class="form-checkbox"
          />
          <label class="checkbox-label">休日として設定</label>
        </div>

        <div v-if="shiftEditorDialog.isPast" class="form-group">
          <label class="form-label">変更理由</label>
          <Textarea
            v-model="shiftEditorDialog.changeReason"
            rows="3"
            placeholder="変更理由を入力してください"
            class="form-textarea"
          />
        </div>
      </div>

      <template #footer>
        <div class="dialog-actions">
          <Button
            label="削除"
            icon="pi pi-trash"
            class="delete-button"
            @click="clearShift"
            :disabled="saving || !shiftEditorDialog.hasShift"
          />
          <Button
            label="キャンセル"
            icon="pi pi-times"
            class="cancel-button"
            @click="closeShiftEditor"
            :disabled="saving"
          />
          <Button
            label="保存"
            icon="pi pi-check"
            class="save-button"
            @click="saveShift"
            :loading="saving"
          />
        </div>
      </template>
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
import api from "@/services/api";

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
  },
  setup() {
    const store = useStore();
    const toast = useToast();
    const confirm = useConfirm();

    const loading = ref(false);
    const saving = ref(false);
    const isEditMode = ref(false);
    const viewMode = ref("calendar");
    const selectedDate = ref(null);
    const currentYear = ref(new Date().getFullYear());
    const currentMonth = ref(new Date().getMonth() + 1);
    const selectedStore = ref(null);
    const stores = ref([]);
    const staffList = ref([]);
    const shifts = ref([]);
    const daysInMonth = ref([]);
    const currentShift = ref(null);
    const systemSettings = ref({ closing_day: 25 });
    const holidays = ref([]);
    const storeRequirements = ref([]);
    const currentStore = ref(null);

    const ganttContainer = ref(null);
    const ganttTimelineHeader = ref(null);
    const ganttBody = ref(null);

    const hourOptions = ref([]);
    const minuteOptions = ref([]);

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

    const timelineHours = computed(() => {
      const hours = [];
      for (let hour = 0; hour <= 23; hour++) {
        hours.push(hour);
      }
      return hours;
    });

    const dateOptions = computed(() => {
      return daysInMonth.value.map((day) => ({
        label: formatDateForGantt(day.date),
        value: day.date,
      }));
    });

    const shiftEditorDialog = reactive({
      visible: false,
      title: "",
      date: null,
      staff: null,
      startTimeHour: "09",
      startTimeMinute: "00",
      endTimeHour: "18",
      endTimeMinute: "00",
      isRestDay: false,
      isPast: false,
      hasShift: false,
      changeReason: "",
    });

    const hasCurrentShift = computed(() => {
      return currentShift.value !== null;
    });

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

    const hasHourRequirements = (date, hour) => {
      const requirements = getDailyRequirements(date);
      return requirements.some((req) => {
        const reqStartHour = parseTimeToFloat(req.start_time);
        const reqEndHour = parseTimeToFloat(req.end_time);
        return hour >= reqStartHour && hour < reqEndHour;
      });
    };

    const hasHourShortage = (date, hour) => {
      const requirements = getHourRequirements(date, hour);
      return requirements.some((req) => hasRequirementShortage(date, req));
    };

    const getHourRequirements = (date, hour) => {
      const requirements = getDailyRequirements(date);
      return requirements.filter((req) => {
        const reqStartHour = parseTimeToFloat(req.start_time);
        const reqEndHour = parseTimeToFloat(req.end_time);
        return hour >= reqStartHour && hour < reqEndHour;
      });
    };

    const hasRequirementShortage = (date, requirement) => {
      const assignedCount = getAssignedStaffCount(date, requirement);
      return assignedCount < requirement.required_staff_count;
    };

    const getConsecutiveWorkDays = (staffId, currentDate) => {
      if (!shifts.value || shifts.value.length === 0) return 0;

      const currentDateObj = new Date(currentDate);
      let consecutiveDays = 0;
      let checkDate = new Date(currentDateObj);

      while (true) {
        const dateStr = `${checkDate.getFullYear()}-${(checkDate.getMonth() + 1)
          .toString()
          .padStart(2, "0")}-${checkDate
          .getDate()
          .toString()
          .padStart(2, "0")}`;

        const hasShift = shifts.value.some(
          (dayShift) =>
            dayShift.date === dateStr &&
            dayShift.assignments.some(
              (assignment) => assignment.staff_id === staffId
            )
        );

        if (hasShift) {
          consecutiveDays++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      checkDate = new Date(currentDateObj);
      checkDate.setDate(checkDate.getDate() + 1);

      while (true) {
        const dateStr = `${checkDate.getFullYear()}-${(checkDate.getMonth() + 1)
          .toString()
          .padStart(2, "0")}-${checkDate
          .getDate()
          .toString()
          .padStart(2, "0")}`;

        const hasShift = shifts.value.some(
          (dayShift) =>
            dayShift.date === dateStr &&
            dayShift.assignments.some(
              (assignment) => assignment.staff_id === staffId
            )
        );

        if (hasShift) {
          consecutiveDays++;
          checkDate.setDate(checkDate.getDate() + 1);
        } else {
          break;
        }
      }

      return consecutiveDays;
    };

    const calculateDayHours = (shift) => {
      if (!shift) return 0;

      const startTime = new Date(`2000-01-01 ${shift.start_time}`);
      const endTime = new Date(`2000-01-01 ${shift.end_time}`);
      let hours = (endTime - startTime) / (1000 * 60 * 60);

      if (shift.break_start_time && shift.break_end_time) {
        const breakStart = new Date(`2000-01-01 ${shift.break_start_time}`);
        const breakEnd = new Date(`2000-01-01 ${shift.break_end_time}`);
        const breakHours = (breakEnd - breakStart) / (1000 * 60 * 60);
        hours -= breakHours;
      }

      return Math.round(hours * 10) / 10;
    };

    const fetchStoreDetails = async (storeId) => {
      try {
        const storeData = await store.dispatch("store/fetchStore", storeId);
        currentStore.value = storeData;

        const requirements = await store.dispatch(
          "store/fetchStoreStaffRequirements",
          storeId
        );
        console.log("取得した人員要件:", requirements);
        storeRequirements.value = requirements || [];
      } catch (error) {
        console.error("店舗詳細情報の取得に失敗しました:", error);
        storeRequirements.value = [];
      }
    };

    const hasStaffingShortage = (date, requirement) => {
      const assignedCount = getAssignedStaffCount(date, requirement);
      return assignedCount < requirement.required_staff_count;
    };

    const getAssignedStaffCount = (date, requirement) => {
      const dayShifts = shifts.value.find((shift) => shift.date === date);
      if (!dayShifts) return 0;

      const reqStartTime = parseTimeToFloat(requirement.start_time);
      const reqEndTime = parseTimeToFloat(requirement.end_time);

      // 要件の時間帯に勤務しているスタッフをカウント
      return dayShifts.assignments.filter((assignment) => {
        const shiftStartTime = parseTimeToFloat(assignment.start_time);
        const shiftEndTime = parseTimeToFloat(assignment.end_time);

        // シフトが要件の時間帯と重なっているかチェック
        // (シフト開始が要件終了より前) かつ (シフト終了が要件開始より後)
        return shiftStartTime < reqEndTime && shiftEndTime > reqStartTime;
      }).length;
    };

    const hasShiftViolation = (date, staffId) => {
      const shift = getShiftForStaff(date, staffId);
      if (!shift) return false;

      const staff = staffList.value.find((s) => s.id === staffId);
      if (!staff) return false;

      const dayHours = calculateDayHours(shift);
      const maxDayHours = staff.max_hours_per_day || 8;
      const consecutiveDays = getConsecutiveWorkDays(staffId, date);
      const maxConsecutiveDays = staff.max_consecutive_days || 5;

      return dayHours > maxDayHours || consecutiveDays > maxConsecutiveDays;
    };

    const getShiftViolations = (date, staffId) => {
      const violations = [];
      const shift = getShiftForStaff(date, staffId);
      if (!shift) return violations;

      const staff = staffList.value.find((s) => s.id === staffId);
      if (!staff) return violations;

      const dayHours = calculateDayHours(shift);
      const maxDayHours = staff.max_hours_per_day || 8;
      const consecutiveDays = getConsecutiveWorkDays(staffId, date);
      const maxConsecutiveDays = staff.max_consecutive_days || 5;

      if (dayHours > maxDayHours) {
        violations.push({
          type: "day_hours",
          icon: "⏰",
          message: `1日の勤務時間が上限を超過 (${dayHours}h > ${maxDayHours}h)`,
        });
      }

      if (consecutiveDays > maxConsecutiveDays) {
        violations.push({
          type: "consecutive_days",
          icon: "📅",
          message: `連続勤務日数が上限を超過 (${consecutiveDays}日 > ${maxConsecutiveDays}日)`,
        });
      }

      return violations;
    };

    const hasStaffWarnings = (staffId) => {
      const staff = staffList.value.find((s) => s.id === staffId);
      if (!staff) return false;

      const totalHours = calculateTotalHours(staffId);
      const maxMonthHours = staff.max_hours_per_month || 0;
      const minMonthHours = staff.min_hours_per_month || 0;

      return totalHours > maxMonthHours || totalHours < minMonthHours;
    };

    const getStaffWarnings = (staffId) => {
      const warnings = [];
      const staff = staffList.value.find((s) => s.id === staffId);
      if (!staff) return warnings;

      const totalHours = calculateTotalHours(staffId);
      const maxMonthHours = staff.max_hours_per_month || 0;
      const minMonthHours = staff.min_hours_per_month || 0;

      if (totalHours > maxMonthHours) {
        warnings.push({
          type: "over_hours",
          icon: "⚠️",
          message: `月間勤務時間が上限を超過 (${totalHours}h > ${maxMonthHours}h)`,
        });
      }

      if (totalHours < minMonthHours) {
        warnings.push({
          type: "under_hours",
          icon: "📉",
          message: `月間勤務時間が下限を下回り (${totalHours}h < ${minMonthHours}h)`,
        });
      }

      return warnings;
    };

    const hasDateWarnings = (date) => {
      const requirements = getDailyRequirements(date);
      return (
        requirements.some((req) => hasStaffingShortage(date, req)) ||
        staffList.value.some((staff) => hasShiftViolation(date, staff.id))
      );
    };

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

    const setViewMode = (mode) => {
      viewMode.value = mode;
    };

    const selectDate = (date) => {
      selectedDate.value = date;
      viewMode.value = "gantt";
      nextTick(() => {
        if (ganttBody.value) {
          ganttBody.value.scrollLeft = 0;
        }
      });
    };

    const syncGanttScroll = () => {
      if (ganttTimelineHeader.value && ganttBody.value) {
        ganttTimelineHeader.value.scrollLeft = ganttBody.value.scrollLeft;
      }
    };

    const formatDateForGantt = (date) => {
      const d = new Date(date);
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const dayOfWeek = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
      return `${month}月${day}日(${dayOfWeek})`;
    };

    const fetchHolidays = async (year) => {
      try {
        const response = await fetch(
          `https://holidays-jp.github.io/api/v1/${year}/date.json`
        );
        const data = await response.json();
        holidays.value = Object.keys(data);
      } catch (error) {
        console.error("祝日データの取得に失敗:", error);
        holidays.value = [];
      }
    };

    const isHoliday = (date) => {
      return holidays.value.includes(date);
    };

    const getTimeHeaderStyle = () => {
      const hourWidth = 60;
      return {
        width: `${hourWidth}px`,
        minWidth: `${hourWidth}px`,
      };
    };

    const getGanttBarStyle = (shift) => {
      if (!shift) return {};

      const shiftStartTime = shift.start_time;
      const shiftEndTime = shift.end_time;

      const startHourFloat = parseTimeToFloat(shiftStartTime);
      const endHourFloat = parseTimeToFloat(shiftEndTime);

      const hourWidth = 60;
      const left = startHourFloat * hourWidth;
      const width = (endHourFloat - startHourFloat) * hourWidth;

      return {
        left: `${left}px`,
        width: `${width}px`,
      };
    };

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

    const openGanttShiftEditor = (date, staff, event) => {
      if (!isEditMode.value) return;

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

    const fetchSystemSettings = async () => {
      try {
        const response = await api.get("/shifts/system-settings");
        systemSettings.value = response.data;
      } catch (error) {
        console.error("システム設定取得エラー:", error);
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

    const isPastDate = (date) => {
      const today = new Date();
      const checkDate = new Date(date);
      today.setHours(0, 0, 0, 0);
      checkDate.setHours(0, 0, 0, 0);
      return checkDate < today;
    };

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
      } else {
        shiftEditorDialog.startTimeHour = "09";
        shiftEditorDialog.startTimeMinute = "00";
        shiftEditorDialog.endTimeHour = "18";
        shiftEditorDialog.endTimeMinute = "00";
        shiftEditorDialog.isRestDay = false;
        shiftEditorDialog.hasShift = false;
      }

      shiftEditorDialog.visible = true;
    };

    const closeShiftEditor = () => {
      shiftEditorDialog.visible = false;
    };

    const loadShiftData = async () => {
      if (!selectedStore.value) return;

      loading.value = true;

      try {
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

        generateDaysInMonth();
      } catch (error) {
        console.error("シフトデータの取得に失敗しました:", error);
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

    const generateDaysInMonth = () => {
      const year = currentYear.value;
      const month = currentMonth.value;
      const closingDay = systemSettings.value.closing_day || 25;

      const { startDate, endDate } = getShiftPeriod(year, month, closingDay);
      const today = new Date();
      const days = [];

      const current = new Date(startDate);
      while (current <= endDate) {
        const dateStr = `${current.getFullYear()}-${(current.getMonth() + 1)
          .toString()
          .padStart(2, "0")}-${current.getDate().toString().padStart(2, "0")}`;
        const dayOfWeek = current.getDay();
        const dayOfWeekLabel = ["日", "月", "火", "水", "木", "金", "土"][
          dayOfWeek
        ];

        days.push({
          date: dateStr,
          day: current.getDate(),
          dayOfWeek,
          dayOfWeekLabel,
          isHoliday: isHoliday(dateStr) || dayOfWeek === 0 || dayOfWeek === 6,
          isNationalHoliday: isHoliday(dateStr),
          isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
          isToday:
            today.getFullYear() === current.getFullYear() &&
            today.getMonth() === current.getMonth() &&
            today.getDate() === current.getDate(),
        });

        current.setDate(current.getDate() + 1);
      }

      daysInMonth.value = days;
    };

    const previousMonth = async () => {
      if (currentMonth.value === 1) {
        currentYear.value--;
        currentMonth.value = 12;
      } else {
        currentMonth.value--;
      }
      selectedDate.value = null;
      await fetchHolidays(currentYear.value);
      await loadShiftData();
    };

    const nextMonth = async () => {
      if (currentMonth.value === 12) {
        currentYear.value++;
        currentMonth.value = 1;
      } else {
        currentMonth.value++;
      }
      selectedDate.value = null;
      await fetchHolidays(currentYear.value);
      await loadShiftData();
    };

    const changeStore = async () => {
      selectedDate.value = null;
      if (selectedStore.value) {
        await fetchStoreDetails(selectedStore.value.id);
      }
      await loadShiftData();
    };

    const createShift = async () => {
      confirm.require({
        message: "シフトの作成方法を選択してください",
        header: "シフト作成",
        acceptLabel: "AI自動生成",
        rejectLabel: "手動作成",
        acceptClass: "p-button-primary",
        rejectClass: "p-button-secondary",
        accept: () => {
          generateAutomaticShift();
        },
        reject: () => {
          createEmptyShift();
        },
      });
    };

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
        console.error("シフト作成エラー:", error);
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

    const generateAutomaticShift = async () => {
      try {
        loading.value = true;

        const params = {
          storeId: selectedStore.value.id,
          year: currentYear.value,
          month: currentMonth.value,
        };

        await store.dispatch("shift/generateShift", params);
        await loadShiftData();

        toast.add({
          severity: "success",
          summary: "生成完了",
          detail: "AIによるシフト生成が完了しました",
          life: 3000,
        });
      } catch (error) {
        console.error("自動シフト生成エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "自動シフト生成に失敗しました",
          life: 3000,
        });
      } finally {
        loading.value = false;
      }
    };

    const regenerateShift = async () => {
      confirm.require({
        message: "現在のシフトを削除してAIで再生成しますか？",
        header: "シフト再生成の確認",
        icon: "pi pi-exclamation-triangle",
        acceptClass: "p-button-warning",
        accept: async () => {
          await generateAutomaticShift();
        },
      });
    };

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
              background-color: #ffe6e6; 
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
        const cellClass = `${holidayClass} ${todayClass}`.trim();
        printHtml += `
          <th class="date-col ${cellClass}">
            <div>${day.day}</div>
            <div style="font-size: 6px;">${day.dayOfWeekLabel}</div>
            ${
              day.isNationalHoliday
                ? '<div style="font-size: 5px; color: red;">祝</div>'
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
          const cellClass = `shift-cell ${holidayClass} ${todayClass}`.trim();

          if (shift) {
            printHtml += `<td class="${cellClass}">
              ${formatTime(shift.start_time)}<br>-<br>${formatTime(
              shift.end_time
            )}
            </td>`;
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
                  <th>合計時間</th>
                </tr>
              </thead>
              <tbody>
      `;

      staffList.value.forEach((staff) => {
        printHtml += `
          <tr>
            <td>${staff.last_name} ${staff.first_name}</td>
            <td>${calculateTotalHours(staff.id)}時間</td>
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

    const saveShift = async () => {
      if (!shiftEditorDialog.date || !shiftEditorDialog.staff) return;

      if (shiftEditorDialog.isRestDay) {
        await clearShift();
        return;
      }

      if (
        !shiftEditorDialog.startTimeHour ||
        !shiftEditorDialog.startTimeMinute ||
        !shiftEditorDialog.endTimeHour ||
        !shiftEditorDialog.endTimeMinute
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
        shiftEditorDialog.startTimeHour,
        shiftEditorDialog.startTimeMinute
      );
      const endTime = combineTimeComponents(
        shiftEditorDialog.endTimeHour,
        shiftEditorDialog.endTimeMinute
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

      if (shiftEditorDialog.isPast && !shiftEditorDialog.changeReason.trim()) {
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
        const shiftData = {
          store_id: selectedStore.value.id,
          staff_id: shiftEditorDialog.staff.id,
          date: shiftEditorDialog.date,
          start_time: startTime,
          end_time: endTime,
          break_start_time: null,
          break_end_time: null,
          notes: null,
        };

        if (shiftEditorDialog.isPast) {
          shiftData.change_reason = shiftEditorDialog.changeReason;
        }

        console.log("Sending shift data:", shiftData);

        const existingShift = getShiftForStaff(
          shiftEditorDialog.date,
          shiftEditorDialog.staff.id
        );

        if (existingShift) {
          await store.dispatch("shift/updateShiftAssignment", {
            year: currentYear.value,
            month: currentMonth.value,
            assignmentId: existingShift.id,
            assignmentData: shiftData,
          });
        } else {
          await store.dispatch("shift/createShiftAssignment", {
            year: currentYear.value,
            month: currentMonth.value,
            assignmentData: shiftData,
          });
        }

        await loadShiftData();
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
        console.error("シフト保存エラー:", error);

        if (error.response) {
          console.error("Response data:", error.response.data);
          console.error("Response status:", error.response.status);
        }

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

    const clearShift = async () => {
      if (!shiftEditorDialog.hasShift) {
        shiftEditorDialog.visible = false;
        return;
      }

      if (shiftEditorDialog.isPast && !shiftEditorDialog.changeReason.trim()) {
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
              ? shiftEditorDialog.changeReason
              : null,
          });

          await loadShiftData();
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
        console.error("シフト削除エラー:", error);
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

    const getShiftForStaff = (date, staffId) => {
      const dayShifts = shifts.value.find((s) => s.date === date);
      if (!dayShifts) return null;

      return dayShifts.assignments.find((a) => a.staff_id === staffId);
    };

    const formatTime = (time) => {
      if (!time) return "";
      return time.slice(0, 5);
    };

    const calculateTotalHours = (staffId) => {
      let totalHours = 0;

      shifts.value.forEach((dayShift) => {
        const assignment = dayShift.assignments.find(
          (a) => a.staff_id === staffId
        );
        if (assignment) {
          const startTime = new Date(`2000-01-01 ${assignment.start_time}`);
          const endTime = new Date(`2000-01-01 ${assignment.end_time}`);
          const hours = (endTime - startTime) / (1000 * 60 * 60);
          totalHours += hours;
        }
      });

      return Math.round(totalHours * 10) / 10;
    };

    watch([currentYear, currentMonth], () => {
      loadShiftData();
    });

    onMounted(async () => {
      try {
        generateTimeOptions();
        await fetchSystemSettings();
        await fetchHolidays(currentYear.value);

        const storeData = await store.dispatch("store/fetchStores");
        stores.value = storeData;

        if (storeData.length > 0) {
          selectedStore.value = storeData[0];
          await fetchStoreDetails(selectedStore.value.id);
          await loadShiftData();

          const today = new Date();
          const todayString = `${today.getFullYear()}-${(today.getMonth() + 1)
            .toString()
            .padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}`;

          const todayExists = daysInMonth.value.some(
            (day) => day.date === todayString
          );
          if (todayExists) {
            selectedDate.value = todayString;
          } else if (daysInMonth.value.length > 0) {
            selectedDate.value = daysInMonth.value[0].date;
          }
        }
      } catch (error) {
        console.error("初期化エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "データの取得に失敗しました",
          life: 3000,
        });
      }
    });

    return {
      loading,
      saving,
      isEditMode,
      viewMode,
      selectedDate,
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
      dateOptions,
      ganttContainer,
      ganttTimelineHeader,
      ganttBody,
      storeRequirements,
      currentStore,
      hasCurrentShift,
      setViewMode,
      selectDate,
      syncGanttScroll,
      formatDateForGantt,
      getTimeHeaderStyle,
      getGanttBarStyle,
      parseTimeToFloat,
      parseTimeToComponents,
      combineTimeComponents,
      openGanttShiftEditor,
      isPastDate,
      toggleEditMode,
      openShiftEditor,
      closeShiftEditor,
      previousMonth,
      nextMonth,
      changeStore,
      createShift,
      regenerateShift,
      printShift,
      saveShift,
      clearShift,
      getShiftForStaff,
      formatTime,
      calculateTotalHours,
      getDailyRequirements,
      getConsecutiveWorkDays,
      calculateDayHours,
      fetchStoreDetails,
      hasStaffingShortage,
      getAssignedStaffCount,
      hasShiftViolation,
      getShiftViolations,
      hasStaffWarnings,
      getStaffWarnings,
      hasDateWarnings,
      getDateWarnings,
      hasHourRequirements,
      hasHourShortage,
      getHourRequirements,
      hasRequirementShortage,
    };
  },
};
</script>

<style scoped>
.shift-management {
  min-height: 100vh;
  background: #f8f9fa;
  padding: 1.5rem;
}

.header-section {
  margin-bottom: 2rem;
}

.page-title {
  font-size: 2rem;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 1rem;
  letter-spacing: -0.025em;
}

.control-panel {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.period-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-shrink: 0;
}

.month-navigator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #f8f9fa;
  padding: 0.5rem;
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.nav-button {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  background: white;
  border: 1px solid #ced4da;
  color: #6c757d;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  font-size: 0.875rem;
}

.nav-button:hover {
  background: #007bff;
  border-color: #007bff;
  color: white;
}

.period-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 80px;
}

.year {
  font-size: 0.75rem;
  color: #6c757d;
}

.month {
  font-size: 1.1rem;
  font-weight: 600;
  color: #495057;
}

.store-selector {
  min-width: 200px;
  flex-shrink: 0;
}

.view-controls {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  flex-shrink: 0;
}

.view-mode-tabs {
  display: flex;
  background: #f8f9fa;
  border-radius: 6px;
  padding: 0.25rem;
  border: 1px solid #dee2e6;
}

.view-tab {
  padding: 0.5rem 0.75rem;
  border: none;
  background: transparent;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  font-size: 0.875rem;
  color: #6c757d;
  transition: all 0.2s ease;
  cursor: pointer;
  white-space: nowrap;
}

.view-tab:hover {
  color: #495057;
}

.view-tab.active {
  background: white;
  color: #007bff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.date-selector {
  width: 100%;
  max-width: 250px;
}

.date-dropdown {
  width: 100%;
}

.action-controls {
  display: flex;
  gap: 0.75rem;
  flex-shrink: 0;
}

.action-button {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: 500;
  font-size: 0.875rem;
  border: 1px solid #ced4da;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.create-button {
  background: #28a745;
  color: white;
  border-color: #28a745;
}

.create-button:hover {
  background: #218838;
  border-color: #1e7e34;
}

.edit-button {
  background: white;
  color: #6c757d;
}

.edit-button:hover {
  background: #f8f9fa;
  color: #495057;
}

.edit-button.active {
  background: #17a2b8;
  color: white;
  border-color: #17a2b8;
}

.regenerate-button,
.print-button {
  background: white;
  color: #6c757d;
}

.regenerate-button:hover,
.print-button:hover {
  background: #f8f9fa;
  color: #495057;
}

.loading-state,
.empty-state,
.gantt-no-date {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 4rem 2rem;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.loading-text {
  font-size: 1rem;
  color: #6c757d;
  font-weight: 500;
}

.empty-icon {
  width: 60px;
  height: 60px;
  margin: 0 auto 1.5rem;
  border-radius: 50%;
  background: #f8f9fa;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: #adb5bd;
}

.empty-state h3,
.gantt-no-date h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #495057;
  margin-bottom: 0.5rem;
}

.empty-state p,
.gantt-no-date p {
  color: #6c757d;
  margin-bottom: 1.5rem;
}

.shift-content {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.edit-mode-indicator {
  background: #e7f3ff;
  border-bottom: 1px solid #b3d4fc;
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #0056b3;
  font-weight: 500;
  font-size: 0.875rem;
}

.edit-mode-indicator i {
  color: #007bff;
}

.calendar-view {
  position: relative;
}

.calendar-container {
  overflow: auto;
  max-height: calc(100vh - 400px);
  background-color: #495057;
}

.calendar-header {
  display: flex;
  background: #495057;
  border-bottom: 1px solid #dee2e6;
  position: sticky;
  top: 0;
  z-index: 10;
  padding-top: 25px;  /* 上部に余白を追加 */
}

.staff-column-header {
  min-width: 220px;
  width: 220px;
  padding: 1rem;
  background: #495057;
  color: white;
  font-weight: 600;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  position: sticky;
  left: 0;
  z-index: 11;
  border-right: 1px solid #dee2e6;
}

.date-cell-header:hover {
  background: #e9ecef;
}

.date-cell-header.is-today {
  background: #e3f2fd;
  border-bottom: 2px solid #1976d2;
}

.date-cell-header.is-weekend {
  background: #fff3e0;
}

.date-cell-header.is-holiday {
  background: #ffebee;
}

.date-cell-header.has-warnings {
}

.date-number {
  font-size: 1rem;
  font-weight: 600;
  color: #495057;
}

.date-weekday {
  font-size: 0.7rem;
  color: #6c757d;
}

.holiday-indicator {
  font-size: 0.6rem;
  padding: 0.1rem 0.2rem;
  border-radius: 2px;
  background: #dc3545;
  color: white;
  font-weight: 500;
}


.date-cell-header {
  min-width: 70px;
  width: 70px;
  padding: 0.75rem 0.5rem;
  text-align: center;
  border-right: 1px solid #dee2e6;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  background: #f8f9fa;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: visible;  /* 外側の要素を表示可能にする */
}

.warning-indicator {
  position: absolute;
  top: -20px;  /* 日付エリアの上部外側に配置 */
  left: 50%;  /* 中央揃え */
  transform: translateX(-50%);  /* 中央揃えの調整 */
  display: flex;
  align-items: center;
  gap: 0.2rem;
  background: #fff3cd;
  padding: 0.1rem 0.4rem;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  border: 1px solid #ffc107;
  z-index: 15;
  font-size: 0.6rem;
  white-space: nowrap;
}

.warning-indicator::before {
  content: attr(data-warning-count);
  font-weight: 600;
  color: #856404;
}

.warning-indicator i {
  color: #856404;
  font-size: 0.6rem;
}

.warning-tooltip {
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 0.5rem;
  z-index: 20;
  width: 200px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  display: none;
}

.warning-indicator:hover .warning-tooltip {
  display: block;
}

.warning-tooltip-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem;
  border-radius: 3px;
  font-size: 0.75rem;
  margin-bottom: 0.25rem;
}

.warning-tooltip-item:last-child {
  margin-bottom: 0;
}

.warning-tooltip-item.staffing_shortage {
  background: #fff3cd;
  color: #856404;
}

.warning-tooltip-item.staff_violation {
  background: #f8d7da;
  color: #721c24;
}

.calendar-body {
  display: block;
}

.staff-row {
  display: flex;
  border-bottom: 1px solid #b6b6b6;
}

.staff-row:hover {
  background: #f8f9fa;
}

.staff-info {
  min-width: 220px;
  width: 220px;
  padding: 1rem;
  background: #fafafa;
  border-right: 1px solid #dee2e6;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  position: sticky;
  left: 0;
  z-index: 5;
}

.staff-avatar {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  background: #007bff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.8rem;
}

.staff-details {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  flex: 1;
}

.staff-name {
  font-weight: 500;
  color: #495057;
  font-size: 0.8rem;
}

.staff-role {
  font-size: 0.7rem;
  color: #6c757d;
}

.staff-hours-info {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  margin-top: 0.25rem;
}

.current-hours {
  font-size: 0.75rem;
  font-weight: 600;
  color: #007bff;
}

.hours-range {
  font-size: 0.7rem;
  color: #6c757d;
}

.staff-warnings {
  display: flex;
  gap: 0.25rem;
  margin-top: 0.25rem;
}

.warning-badge {
  font-size: 0.6rem;
  padding: 0.1rem 0.2rem;
  border-radius: 2px;
  background: #fff3cd;
  border: 1px solid #ffc107;
  cursor: help;
}

.shift-cell {
  min-width: 70px;
  width: 70px;
  min-height: 60px;
  border-right: 1px solid #f1f3f4;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.2s ease;
  cursor: default;
}

.shift-cell.is-today {
  background: #e3f2fd;
}

.shift-cell.is-weekend {
  background: #fff8e1;
}

.shift-cell.is-holiday {
  background: #fce4ec;
}

.shift-cell.is-past {
  opacity: 0.7;
}

.shift-cell.is-editable {
  cursor: pointer;
}

.shift-cell.is-editable:hover {
  background: #f0f8ff;
  transform: scale(1.02);
}

.shift-cell.past-editable:hover {
  background: #fff3cd;
}

.shift-cell.has-violation {
}

.shift-time-card {
  background: #28a745;
  color: white;
  padding: 0.4rem 0.3rem;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  font-weight: 500;
  font-size: 0.65rem;
  min-width: 45px;
  transition: all 0.2s ease;
  position: relative;
}

.shift-time-card.violation {
  background: #dc3545;
}

.shift-time-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(40, 167, 69, 0.3);
}

.shift-start,
.shift-end {
  font-weight: 600;
}

.shift-separator {
  font-size: 0.55rem;
  opacity: 0.8;
}

.violation-icon {
  position: absolute;
  top: -0.25rem;
  right: -0.25rem;
  color: #ffc107;
  font-size: 0.6rem;
  background: white;
  border-radius: 50%;
  width: 12px;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.violation-tooltip {
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 0.5rem;
  z-index: 20;
  width: 180px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  display: none;
}

.violation-icon:hover .violation-tooltip {
  display: block;
}

.violation-tooltip-item {
  font-size: 0.75rem;
  color: #721c24;
  margin-bottom: 0.25rem;
}

.violation-tooltip-item:last-child {
  margin-bottom: 0;
}

.no-shift {
  color: #adb5bd;
  font-size: 1rem;
  transition: all 0.2s ease;
}

.shift-cell.is-editable .no-shift {
  color: #28a745;
  font-weight: 500;
}

.gantt-view {
  position: relative;
  height: calc(100vh - 450px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.gantt-info-panel {
  width: 100%;
  flex-shrink: 0;
  display: flex;
  gap: 1rem;
  overflow-x: auto;
}

.date-info-header {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 1rem;
}

.date-info-header h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #495057;
}

.date-warnings {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.warning-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
}

.warning-item.staffing_shortage {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffc107;
}

.warning-item.staff_violation {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #dc3545;
}

.requirements-section,
.staff-summary-section {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  overflow: hidden;
  min-width: 300px;
  flex-shrink: 0;
}

.section-title {
  background: #f8f9fa;
  padding: 0.75rem 1rem;
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #495057;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section-title i {
  color: #007bff;
}

.requirements-list {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.requirement-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 4px;
  border: 1px solid #e9ecef;
  position: relative;
}

.requirement-item.shortage {
  background: #fff3cd;
  border-color: #ffc107;
}

.time-range {
  font-size: 0.8rem;
  font-weight: 500;
  color: #495057;
}

.staff-count {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
}

.assigned-count {
  font-size: 1.1rem;
  font-weight: 600;
  color: #007bff;
}

.separator {
  color: #6c757d;
}

.required-count {
  font-size: 1.1rem;
  font-weight: 600;
  color: #495057;
}

.count-unit {
  font-size: 0.75rem;
  color: #6c757d;
}

.shortage-icon {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  color: #ffc107;
  font-size: 0.7rem;
}

.no-requirements {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #6c757d;
  font-size: 0.8rem;
  padding: 1rem;
  text-align: center;
  justify-content: center;
}

.staff-summary-grid {
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
}

.staff-summary-card {
  background: #fafafa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 0.75rem;
}

.staff-summary-card.has-warnings {
  background: #fff5f5;
  border-color: #fed7d7;
}

.staff-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.staff-avatar-tiny {
  width: 24px;
  height: 24px;
  border-radius: 3px;
  background: #007bff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  font-size: 0.65rem;
}

.staff-name-summary {
  font-weight: 500;
  color: #495057;
  font-size: 0.8rem;
  flex: 1;
}

.warning-indicator-small {
  color: #ffc107;
  font-size: 0.7rem;
}

.summary-stats {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-item {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
}

.stat-value {
  font-weight: 600;
  color: #007bff;
  font-size: 0.9rem;
}

.stat-range {
  color: #6c757d;
  font-size: 0.75rem;
}

.today-shift {
  padding: 0.25rem 0.5rem;
  background: #e3f2fd;
  border-radius: 3px;
  margin-top: 0.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.today-hours {
  font-weight: 600;
  color: #28a745;
  font-size: 0.8rem;
}

.violations {
  display: flex;
  gap: 0.25rem;
}

.violation-badge {
  font-size: 0.6rem;
  padding: 0.1rem 0.2rem;
  border-radius: 2px;
  background: #f8d7da;
  border: 1px solid #dc3545;
  cursor: help;
}

.gantt-container {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  overflow: hidden;
  min-height: 400px;
}

.gantt-header {
  display: grid;
  grid-template-columns: 220px 1fr;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  position: sticky;
  top: 0;
  z-index: 10;
}

.gantt-staff-header {
  padding: 1rem;
  background: #495057;
  color: white;
  font-weight: 600;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid #dee2e6;
}

.gantt-timeline-header {
  display: flex;
  overflow: hidden;
  background: #f8f9fa;
}

.gantt-hour-cell {
  text-align: center;
  padding: 0.5rem 0.25rem;
  border-right: 1px solid #dee2e6;
  font-size: 0.7rem;
  font-weight: 500;
  color: #495057;
  background: #f8f9fa;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  position: relative;
}

.hour-label {
  font-weight: 600;
}

.hour-requirements {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.hour-requirement-badge {
  font-size: 0.6rem;
  padding: 0.1rem 0.2rem;
  border-radius: 2px;
  background: #28a745;
  color: white;
  border: 1px solid #28a745;
}

.hour-requirement-badge.shortage {
  background: #dc3545;
  border-color: #dc3545;
}

.gantt-body {
  flex: 1;
  overflow: auto;
  background: white;
}

.gantt-staff-rows {
  display: flex;
  flex-direction: column;
}

.gantt-staff-row {
  display: grid;
  grid-template-columns: 220px 1fr;
  border-bottom: 1px solid #f1f3f4;
  min-height: 60px;
}

.gantt-staff-row:hover {
  background: #f8f9fa;
}

.gantt-staff-row.has-warnings {
  background: #fff5f5;
}

.gantt-staff-info {
  padding: 0.75rem;
  background: #fafafa;
  border-right: 1px solid #dee2e6;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.staff-avatar-small {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: #007bff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  font-size: 0.7rem;
}

.gantt-staff-details {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  flex: 1;
}

.staff-name-small {
  font-weight: 500;
  color: #495057;
  font-size: 0.75rem;
}

.staff-hours-small {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
}

.warning-indicator-gantt {
  color: #ffc107;
  font-size: 0.7rem;
}

.gantt-timeline {
  position: relative;
  cursor: pointer;
  min-height: 60px;
  display: flex;
  align-items: center;
  padding: 0;
}

.gantt-timeline:hover {
  background: rgba(0, 123, 255, 0.05);
}

.gantt-grid {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
}

.gantt-hour-line {
  border-right: 1px solid #f1f3f4;
  height: 100%;
}

.gantt-shift-block {
  position: absolute;
  top: 8px;
  bottom: 8px;
  background: #28a745;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  z-index: 3;
  transition: all 0.2s ease;
}

.gantt-shift-block:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.gantt-shift-block.is-past-editable {
  background: #ffc107;
}

.gantt-shift-block.has-violation {
  background: #dc3545;
}

.shift-time-text {
  font-size: 0.7rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 0.5rem;
}

.gantt-violation-icon {
  position: absolute;
  top: -0.25rem;
  right: -0.25rem;
  color: #ffc107;
  font-size: 0.6rem;
  background: white;
  border-radius: 50%;
  width: 12px;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.shift-editor-dialog .p-dialog-content {
  border-radius: 8px;
}

.shift-editor-form {
  padding: 0.5rem 0;
}

.status-alert {
  padding: 0.75rem 1rem;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  font-weight: 500;
  font-size: 0.875rem;
}

.status-alert.warning {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.time-inputs-section {
  margin-bottom: 1rem;
}

.time-input-group {
  margin-bottom: 1rem;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #495057;
  font-size: 0.875rem;
}

.time-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #f8f9fa;
  padding: 0.5rem;
  border-radius: 6px;
  border: 1px solid #ced4da;
  max-width: 250px;
}

.time-dropdown {
  flex: 1;
  border: none;
  background: transparent;
}

.time-separator {
  font-size: 1.1rem;
  font-weight: 600;
  color: #6c757d;
}

.form-group {
  margin-bottom: 1rem;
}

.form-textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.875rem;
}

.checkbox-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.checkbox-label {
  font-weight: 500;
  color: #495057;
  cursor: pointer;
  font-size: 0.875rem;
}

.dialog-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  padding-top: 0.5rem;
}

.delete-button,
.cancel-button,
.save-button {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-weight: 500;
  border: 1px solid;
  transition: all 0.2s ease;
  cursor: pointer;
  font-size: 0.875rem;
}

.delete-button {
  background: #dc3545;
  color: white;
  border-color: #dc3545;
}

.delete-button:hover {
  background: #c82333;
  border-color: #bd2130;
}

.cancel-button {
  background: #f8f9fa;
  color: #6c757d;
  border-color: #ced4da;
}

.cancel-button:hover {
  background: #e9ecef;
  color: #495057;
}

.save-button {
  background: #28a745;
  color: white;
  border-color: #28a745;
}

.save-button:hover {
  background: #218838;
  border-color: #1e7e34;
}

@media (max-width: 1024px) {
  .control-panel {
    flex-direction: column;
    align-items: stretch;
    gap: 1.5rem;
  }

  .period-controls {
    justify-content: center;
  }

  .view-controls {
    flex-direction: row;
    justify-content: center;
    gap: 1rem;
  }

  .action-controls {
    justify-content: center;
    flex-wrap: wrap;
  }

  .store-selector {
    min-width: 250px;
  }

  .gantt-view {
    flex-direction: column;
    height: auto;
  }

  .gantt-info-panel {
    width: 100%;
    flex-direction: row;
    overflow-x: auto;
  }

  .requirements-section,
  .staff-summary-section {
    min-width: 280px;
    flex-shrink: 0;
  }

  .gantt-container {
    height: calc(100vh - 500px);
  }
}

@media (max-width: 768px) {
  .control-panel {
    padding: 1rem;
    gap: 1rem;
  }

  .period-controls {
    gap: 0.75rem;
  }

  .store-selector {
    min-width: 200px;
  }

  .action-controls {
    gap: 0.5rem;
  }

  .action-button {
    padding: 0.4rem 0.8rem;
    font-size: 0.8rem;
  }

  .view-tab {
    padding: 0.4rem 0.6rem;
    font-size: 0.8rem;
  }

  .shift-management {
    padding: 1rem;
  }

  .page-title {
    font-size: 1.5rem;
  }

  .staff-column-header,
  .staff-info {
    min-width: 160px;
    width: 160px;
  }

  .date-cell-header,
  .shift-cell {
    min-width: 50px;
    width: 50px;
  }

  .date-cell-header {
    min-width: 70px;
    width: 70px;
    padding: 1.25rem 0.5rem;
    text-align: center;
    border-right: 1px solid #dee2e6;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    background: #f8f9fa;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    overflow: visible; /* ← この行を追加 */
  }

  .staff-avatar {
    width: 28px;
    height: 28px;
    font-size: 0.7rem;
  }

  .staff-name {
    font-size: 0.75rem;
  }

  .shift-time-card {
    padding: 0.3rem 0.2rem;
    font-size: 0.6rem;
    min-width: 36px;
  }

  .time-selector {
    flex-direction: column;
    gap: 0.5rem;
  }

  .time-dropdown {
    width: 100%;
  }

  .calendar-container {
    max-height: calc(100vh - 500px);
  }

  .gantt-view {
    height: calc(100vh - 550px);
  }

  .gantt-info-panel {
    flex-direction: column;
    max-height: 300px;
  }

  .requirements-section,
  .staff-summary-section {
    min-width: unset;
  }

  .staff-summary-grid {
    max-height: 200px;
  }

  .gantt-container {
    height: calc(100vh - 700px);
  }

  .gantt-header {
    grid-template-columns: 120px 1fr;
  }

  .gantt-staff-row {
    grid-template-columns: 120px 1fr;
  }

  .gantt-staff-header,
  .gantt-staff-info {
    padding: 0.4rem;
  }

  .staff-name-small {
    font-size: 0.65rem;
  }

  .view-controls {
    flex-direction: row;
    gap: 0.5rem;
  }

  .date-selector {
    max-width: 150px;
  }
}

@media (max-width: 576px) {
  .period-controls {
    flex-direction: column;
    gap: 1rem;
  }

  .view-controls {
    flex-direction: column;
    gap: 0.75rem;
  }

  .action-controls {
    flex-direction: column;
    width: 100%;
  }

  .action-button {
    width: 100%;
    justify-content: center;
  }

  .store-selector {
    min-width: 100%;
  }

  .date-dropdown {
    width: 100%;
  }

  .gantt-view {
    height: auto;
    gap: 0.5rem;
  }

  .section-title {
    padding: 0.5rem;
    font-size: 0.8rem;
  }

  .requirements-list {
    padding: 0.5rem;
  }

  .staff-summary-card {
    padding: 0.5rem;
  }

  .gantt-container {
    height: 300px;
  }
}
</style>