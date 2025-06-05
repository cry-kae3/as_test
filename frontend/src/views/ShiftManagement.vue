<template>
  <div class="shift-management">
    <div class="header-section">
      <h1 class="page-title">シフト管理</h1>
      
      <div class="shift-status-banner" :class="getStatusBannerClass()">
        <div class="status-info">
          <div class="status-main">
            <div class="status-icon-wrapper">
              <i :class="getStatusIcon()"></i>
            </div>
            <div class="status-content">
              <span class="status-text">{{ getStatusText() }}</span>
              <span class="deadline-info" v-if="getDeadlineInfo()">
                <i class="pi pi-clock"></i>
                {{ getDeadlineInfo() }}
              </span>
            </div>
          </div>
        </div>
        <div class="status-actions" v-if="canConfirm()">
          <Button
            label="今すぐ確定"
            icon="pi pi-check-circle"
            class="confirm-button"
            :class="getConfirmButtonClass()"
            @click="confirmShift"
          />
        </div>
      </div>
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
            v-for="option in viewModeOptions"
            :key="option.value"
            class="view-tab"
            :class="{ active: viewMode === option.value }"
            @click="viewMode = option.value"
          >
            <i :class="option.value === 'calendar' ? 'pi pi-table' : 'pi pi-chart-bar'"></i>
            {{ option.label }}
          </button>
        </div>
      </div>

      <div class="action-controls">
        <Button
          v-if="!hasCurrentShift"
          label="シフト作成"
          icon="pi pi-plus"
          class="create-button"
          @click="createShift"
          :disabled="loading || !selectedStore"
        />

        <template v-if="hasCurrentShift && !isShiftConfirmed">
          <Button
            :label="isEditMode ? '編集終了' : 'シフト編集'"
            :icon="isEditMode ? 'pi pi-check' : 'pi pi-pencil'"
            :class="isEditMode ? 'edit-button active' : 'edit-button'"
            @click="toggleEditMode"
            :disabled="loading"
          />

          <Button
            label="AI再生成"
            icon="pi pi-refresh"
            class="regenerate-button"
            @click="regenerateShift"
            :disabled="loading"
          />
        </template>

        <Button
          v-if="hasCurrentShift"
          label="印刷"
          icon="pi pi-print"
          class="print-button"
          @click="printShift"
          :disabled="loading"
        />
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
      <p>{{ currentYear }}年{{ currentMonth }}月のシフトはまだ作成されていません</p>
      <Button
        label="シフトを作成"
        icon="pi pi-plus"
        class="create-button"
        @click="createShift"
      />
    </div>

    <div v-else class="shift-content">
      <div v-if="viewMode === 'calendar'" class="modern-calendar" :class="{ 'edit-mode': isEditMode, 'confirmed': isShiftConfirmed }">
        <div class="calendar-container">
          <div class="calendar-header">
            <div class="staff-column-header">
              <span>スタッフ</span>
            </div>
            <div class="dates-header">
              <div 
                v-for="day in daysInMonth" 
                :key="day.date" 
                class="date-cell-header"
                :class="{
                  'is-weekend': day.isWeekend,
                  'is-holiday': day.isNationalHoliday,
                  'is-today': day.isToday,
                  'is-deadline': isDeadlineDate(day.date)
                }"
              >
                <div class="date-number">{{ day.day }}</div>
                <div class="date-weekday">{{ day.dayOfWeekLabel }}</div>
                <div v-if="day.isNationalHoliday" class="holiday-indicator">祝</div>
                <div v-if="isDeadlineDate(day.date)" class="deadline-indicator">締切</div>
              </div>
            </div>
          </div>

          <div class="calendar-body">
            <div
              v-for="staff in staffList"
              :key="staff.id"
              class="staff-row"
            >
              <div class="staff-info">
                <div class="staff-avatar">
                  {{ staff.first_name.charAt(0) }}
                </div>
                <div class="staff-details">
                  <span class="staff-name">{{ staff.last_name }} {{ staff.first_name }}</span>
                  <span class="staff-role">{{ staff.position || '一般' }}</span>
                </div>
              </div>
              
              <div class="shift-cells">
                <div
                  v-for="day in daysInMonth"
                  :key="`${staff.id}-${day.date}`"
                  class="shift-cell"
                  :class="{ 
                    'is-weekend': day.isWeekend,
                    'is-holiday': day.isNationalHoliday,
                    'is-today': day.isToday,
                    'is-past': isPastDate(day.date),
                    'is-deadline': isDeadlineDate(day.date),
                    'is-editable': isEditMode && !isShiftConfirmed,
                    'has-shift': getShiftForStaff(day.date, staff.id),
                    'past-editable': isEditMode && !isShiftConfirmed && isPastDate(day.date)
                  }"
                  @click="openShiftEditor(day, staff)"
                >
                  <div
                    v-if="getShiftForStaff(day.date, staff.id)"
                    class="shift-time-card"
                  >
                    <div class="shift-start">{{ formatTime(getShiftForStaff(day.date, staff.id).start_time) }}</div>
                    <div class="shift-separator">-</div>
                    <div class="shift-end">{{ formatTime(getShiftForStaff(day.date, staff.id).end_time) }}</div>
                  </div>
                  <div v-else class="no-shift">
                    <span v-if="isEditMode && !isShiftConfirmed">+</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="viewMode === 'gantt'" class="modern-gantt" :class="{ 'edit-mode': isEditMode, 'confirmed': isShiftConfirmed }">
        <div class="gantt-header">
          <div class="gantt-staff-header">
            <span>スタッフ</span>
          </div>
          <div class="gantt-timeline-header">
            <div
              v-for="hour in timelineHours"
              :key="hour"
              class="gantt-hour-cell"
              :style="getTimeHeaderStyle()"
            >
              {{ hour.toString().padStart(2, '0') }}:00
            </div>
          </div>
        </div>

        <div class="gantt-body">
          <div
            v-for="day in daysInMonth"
            :key="day.date"
            class="gantt-day-section"
            :class="{ 
              'is-weekend': day.isWeekend,
              'is-holiday': day.isNationalHoliday,
              'is-today': day.isToday,
              'is-past': isPastDate(day.date),
              'is-deadline': isDeadlineDate(day.date)
            }"
          >
            <div class="gantt-day-header">
              <div class="day-info">
                <span class="day-number">{{ day.day }}日</span>
                <span class="day-weekday">{{ day.dayOfWeekLabel }}</span>
                <div class="day-badges">
                  <span v-if="day.isNationalHoliday" class="holiday-badge">祝</span>
                  <span v-if="isDeadlineDate(day.date)" class="deadline-badge">締切</span>
                </div>
              </div>
            </div>

            <div class="gantt-staff-rows">
              <div
                v-for="staff in staffList"
                :key="`gantt-${day.date}-${staff.id}`"
                class="gantt-staff-row"
              >
                <div class="gantt-staff-info">
                  <div class="staff-avatar-small">
                    {{ staff.first_name.charAt(0) }}
                  </div>
                  <span class="staff-name-small">{{ staff.last_name }} {{ staff.first_name }}</span>
                </div>
                
                <div class="gantt-timeline" @click="openGanttShiftEditor(day, staff, $event)">
                  <div class="gantt-grid">
                    <div
                      v-for="hour in timelineHours"
                      :key="`grid-${hour}`"
                      class="gantt-hour-line"
                      :style="getTimeHeaderStyle()"
                    ></div>
                  </div>
                  
                  <div
                    v-if="getShiftForStaff(day.date, staff.id)"
                    class="gantt-shift-block"
                    :style="getGanttBarStyle(getShiftForStaff(day.date, staff.id))"
                    :class="{ 
                      'is-editable': isEditMode && !isShiftConfirmed,
                      'is-past-editable': isEditMode && !isShiftConfirmed && isPastDate(day.date)
                    }"
                    @click.stop="openShiftEditor(day, staff)"
                  >
                    <span class="shift-time-text">
                      {{ formatTime(getShiftForStaff(day.date, staff.id).start_time) }}
                      -
                      {{ formatTime(getShiftForStaff(day.date, staff.id).end_time) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="shift-summary-panel">
        <h3 class="summary-title">月間勤務時間</h3>
        <div class="summary-grid">
          <div
            v-for="staff in staffList"
            :key="`summary-${staff.id}`"
            class="summary-card"
          >
            <div class="summary-staff">
              <div class="staff-avatar-small">
                {{ staff.first_name.charAt(0) }}
              </div>
              <span class="staff-name">{{ staff.last_name }} {{ staff.first_name }}</span>
            </div>
            <div class="summary-hours">
              <span class="hours-number">{{ calculateTotalHours(staff.id) }}</span>
              <span class="hours-unit">時間</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <Dialog
      v-model:visible="shiftEditorDialog.visible"
      :header="shiftEditorDialog.title"
      :modal="true"
      class="modern-dialog"
      :style="{ width: '600px' }"
      :closable="!saving"
    >
      <div class="shift-editor-form">
        <div v-if="shiftEditorDialog.isConfirmed" class="status-alert confirmed">
          <i class="pi pi-info-circle"></i>
          <span>シフトは確定済みです。編集はできません。</span>
        </div>
        
        <div v-else>
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
                  class="time-dropdown hour-dropdown"
                />
                <span class="time-separator">:</span>
                <Dropdown
                  v-model="shiftEditorDialog.startTimeMinute"
                  :options="minuteOptions"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="分"
                  class="time-dropdown minute-dropdown"
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
                  class="time-dropdown hour-dropdown"
                />
                <span class="time-separator">:</span>
                <Dropdown
                  v-model="shiftEditorDialog.endTimeMinute"
                  :options="minuteOptions"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="分"
                  class="time-dropdown minute-dropdown"
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
      </div>

      <template #footer>
        <div class="dialog-actions">
          <Button
            v-if="!shiftEditorDialog.isConfirmed"
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
            v-if="!shiftEditorDialog.isConfirmed"
            label="保存"
            icon="pi pi-check"
            class="save-button"
            @click="saveShift"
            :loading="saving"
          />
        </div>
      </template>
    </Dialog>

    <Dialog
      v-model:visible="confirmShiftDialog.visible"
      header="シフト確定"
      :modal="true"
      class="modern-dialog"
      :style="{ width: '450px' }"
    >
      <div class="confirm-content">
        <div class="confirm-details">
          <div class="detail-row">
            <span class="detail-label">対象期間</span>
            <span class="detail-value">{{ currentYear }}年{{ currentMonth }}月</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">店舗</span>
            <span class="detail-value">{{ selectedStore?.name }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">締切日</span>
            <span class="detail-value">{{ getDeadlineDate() }}</span>
          </div>
        </div>
        
        <div class="status-alert warning">
          <i class="pi pi-exclamation-triangle"></i>
          <span>確定後は編集できなくなります。スタッフへの通知も送信されます。</span>
        </div>
      </div>

      <template #footer>
        <div class="dialog-actions">
          <Button
            label="キャンセル"
            icon="pi pi-times"
            class="cancel-button"
            @click="confirmShiftDialog.visible = false"
          />
          <Button
            label="確定する"
            icon="pi pi-check"
            class="confirm-button"
            @click="executeShiftConfirmation"
            :loading="confirmShiftDialog.processing"
          />
        </div>
      </template>
    </Dialog>

    <ConfirmDialog></ConfirmDialog>
    <Toast />
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, watch } from "vue";
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
import api from '@/services/api';

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
    const viewMode = ref('calendar');
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

    const hourOptions = ref([]);
    const minuteOptions = ref([]);

    const generateTimeOptions = () => {
      hourOptions.value = Array.from({ length: 24 }, (_, i) => ({
        label: i.toString().padStart(2, '0'),
        value: i.toString().padStart(2, '0')
      }));

      minuteOptions.value = [
        { label: '00', value: '00' },
        { label: '15', value: '15' },
        { label: '30', value: '30' },
        { label: '45', value: '45' }
      ];
    };

    const viewModeOptions = ref([
      { label: 'カレンダー', value: 'calendar' },
      { label: 'ガントチャート', value: 'gantt' }
    ]);

    const timelineHours = computed(() => {
      const hours = [];
      for (let hour = 0; hour <= 23; hour++) {
        hours.push(hour);
      }
      return hours;
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
      isConfirmed: false,
      isPast: false,
      hasShift: false,
      changeReason: "",
    });

    const confirmShiftDialog = reactive({
      visible: false,
      processing: false,
    });

    const hasCurrentShift = computed(() => {
      return currentShift.value !== null;
    });

    const isShiftConfirmed = computed(() => {
      return currentShift.value && currentShift.value.status === "confirmed";
    });

    const fetchHolidays = async (year) => {
      try {
        const response = await fetch(`https://holidays-jp.github.io/api/v1/${year}/date.json`);
        const data = await response.json();
        holidays.value = Object.keys(data);
      } catch (error) {
        console.error('祝日データの取得に失敗:', error);
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
        minWidth: `${hourWidth}px`
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
        width: `${width}px`
      };
    };

    const parseTimeToFloat = (timeStr) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours + minutes / 60;
    };

    const parseTimeToComponents = (timeStr) => {
      if (!timeStr) return { hour: "09", minute: "00" };
      const [hour, minute] = timeStr.split(':');
      return {
        hour: hour.padStart(2, '0'),
        minute: minute.padStart(2, '0')
      };
    };

    const combineTimeComponents = (hour, minute) => {
      return `${hour}:${minute}`;
    };

    const openGanttShiftEditor = (day, staff, event) => {
      if (!isEditMode.value || isShiftConfirmed.value) return;
      
      const existingShift = getShiftForStaff(day.date, staff.id);
      if (existingShift) return;
      
      const rect = event.currentTarget.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const hourWidth = 60;
      
      const clickedHour = Math.floor(clickX / hourWidth);
      const startHour = clickedHour.toString().padStart(2, '0');
      const endHour = (clickedHour + 8).toString().padStart(2, '0');
      
      shiftEditorDialog.title = `${staff.last_name} ${staff.first_name} - ${day.date}`;
      shiftEditorDialog.date = day.date;
      shiftEditorDialog.staff = staff;
      shiftEditorDialog.startTimeHour = startHour;
      shiftEditorDialog.startTimeMinute = "00";
      shiftEditorDialog.endTimeHour = endHour;
      shiftEditorDialog.endTimeMinute = "00";
      shiftEditorDialog.isRestDay = false;
      shiftEditorDialog.isConfirmed = isShiftConfirmed.value;
      shiftEditorDialog.isPast = isPastDate(day.date);
      shiftEditorDialog.hasShift = false;
      shiftEditorDialog.changeReason = "";
      shiftEditorDialog.visible = true;
    };

    const fetchSystemSettings = async () => {
      try {
        const response = await api.get('/shifts/system-settings');
        systemSettings.value = response.data;
      } catch (error) {
        console.error('システム設定取得エラー:', error);
        systemSettings.value = { closing_day: 25 };
      }
    };

    const getDeadlineDate = () => {
      const closingDay = systemSettings.value.closing_day || 25;
      let deadlineYear = currentYear.value;
      let deadlineMonth = currentMonth.value;
      
      if (currentMonth.value === 1) {
        deadlineYear = currentYear.value - 1;
        deadlineMonth = 12;
      } else {
        deadlineMonth = currentMonth.value - 1;
      }
      
      const daysInPrevMonth = new Date(deadlineYear, deadlineMonth, 0).getDate();
      const actualClosingDay = Math.min(closingDay, daysInPrevMonth);
      
      return `${deadlineYear}年${deadlineMonth}月${actualClosingDay}日`;
    };

    const getStatusBannerClass = () => {
      if (isShiftConfirmed.value) {
        return 'status-confirmed';
      }
      
      const today = new Date();
      const closingDay = systemSettings.value.closing_day || 25;
      
      let deadlineYear = currentYear.value;
      let deadlineMonth = currentMonth.value;
      
      if (currentMonth.value === 1) {
        deadlineYear = currentYear.value - 1;
        deadlineMonth = 12;
      } else {
        deadlineMonth = currentMonth.value - 1;
      }
      
      const daysInPrevMonth = new Date(deadlineYear, deadlineMonth, 0).getDate();
      const actualClosingDay = Math.min(closingDay, daysInPrevMonth);
      const deadline = new Date(deadlineYear, deadlineMonth - 1, actualClosingDay);
      
      const daysUntilDeadline = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
      
      if (daysUntilDeadline < 0) {
        return 'status-overdue';
      } else if (daysUntilDeadline <= 3) {
        return 'status-urgent';
      } else if (daysUntilDeadline <= 7) {
        return 'status-warning';
      } else {
        return 'status-normal';
      }
    };

    const getStatusIcon = () => {
      if (isShiftConfirmed.value) {
        return 'pi pi-check-circle';
      }
      
      const today = new Date();
      const closingDay = systemSettings.value.closing_day || 25;
      
      let deadlineYear = currentYear.value;
      let deadlineMonth = currentMonth.value;
      
      if (currentMonth.value === 1) {
        deadlineYear = currentYear.value - 1;
        deadlineMonth = 12;
      } else {
        deadlineMonth = currentMonth.value - 1;
      }
      
      const daysInPrevMonth = new Date(deadlineYear, deadlineMonth, 0).getDate();
      const actualClosingDay = Math.min(closingDay, daysInPrevMonth);
      const deadline = new Date(deadlineYear, deadlineMonth - 1, actualClosingDay);
      
      const daysUntilDeadline = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
      
      if (daysUntilDeadline < 0) {
        return 'pi pi-exclamation-triangle';
      } else if (daysUntilDeadline <= 3) {
        return 'pi pi-clock';
      } else {
        return 'pi pi-calendar';
      }
    };

    const getStatusText = () => {
      if (isShiftConfirmed.value) {
        return `${currentYear.value}年${currentMonth.value}月のシフトは確定済みです`;
      }
      
      const today = new Date();
      const closingDay = systemSettings.value.closing_day || 25;
      
      let deadlineYear = currentYear.value;
      let deadlineMonth = currentMonth.value;
      
      if (currentMonth.value === 1) {
        deadlineYear = currentYear.value - 1;
        deadlineMonth = 12;
      } else {
        deadlineMonth = currentMonth.value - 1;
      }
      
      const daysInPrevMonth = new Date(deadlineYear, deadlineMonth, 0).getDate();
      const actualClosingDay = Math.min(closingDay, daysInPrevMonth);
      const deadline = new Date(deadlineYear, deadlineMonth - 1, actualClosingDay);
      
      const daysUntilDeadline = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
      
      if (daysUntilDeadline < 0) {
        return `締切を${Math.abs(daysUntilDeadline)}日過ぎています（要確定）`;
      } else if (daysUntilDeadline === 0) {
        return '本日が締切日です（要確定）';
      } else if (daysUntilDeadline <= 3) {
        return `締切まで${daysUntilDeadline}日（至急確定が必要）`;
      } else if (daysUntilDeadline <= 7) {
        return `締切まで${daysUntilDeadline}日`;
      } else {
        return `締切まで${daysUntilDeadline}日`;
      }
    };

    const getDeadlineInfo = () => {
      if (isShiftConfirmed.value) {
        return null;
      }
      return `締切: ${getDeadlineDate()}`;
    };

    const canConfirm = () => {
      return hasCurrentShift.value && !isShiftConfirmed.value;
    };

    const getConfirmButtonClass = () => {
      const today = new Date();
      const closingDay = systemSettings.value.closing_day || 25;
      
      let deadlineYear = currentYear.value;
      let deadlineMonth = currentMonth.value;
      
      if (currentMonth.value === 1) {
        deadlineYear = currentYear.value - 1;
        deadlineMonth = 12;
      } else {
        deadlineMonth = currentMonth.value - 1;
      }
      
      const daysInPrevMonth = new Date(deadlineYear, deadlineMonth, 0).getDate();
      const actualClosingDay = Math.min(closingDay, daysInPrevMonth);
      const deadline = new Date(deadlineYear, deadlineMonth - 1, actualClosingDay);
      
      const daysUntilDeadline = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
      
      if (daysUntilDeadline <= 0) {
        return 'urgent';
      } else if (daysUntilDeadline <= 3) {
        return 'warning';
      } else {
        return 'normal';
      }
    };

    const isPastDate = (date) => {
      const today = new Date();
      const checkDate = new Date(date);
      today.setHours(0, 0, 0, 0);
      checkDate.setHours(0, 0, 0, 0);
      return checkDate < today;
    };

    const isDeadlineDate = (date) => {
      const closingDay = systemSettings.value.closing_day || 25;
      let deadlineYear = currentYear.value;
      let deadlineMonth = currentMonth.value;
      
      if (currentMonth.value === 1) {
        deadlineYear = currentYear.value - 1;
        deadlineMonth = 12;
      } else {
        deadlineMonth = currentMonth.value - 1;
      }
      
      const daysInPrevMonth = new Date(deadlineYear, deadlineMonth, 0).getDate();
      const actualClosingDay = Math.min(closingDay, daysInPrevMonth);
      const deadlineDate = new Date(deadlineYear, deadlineMonth - 1, actualClosingDay);
      const checkDate = new Date(date);
      return deadlineDate.toDateString() === checkDate.toDateString();
    };

    const toggleEditMode = () => {
      isEditMode.value = !isEditMode.value;
      
      toast.add({
        severity: 'info',
        summary: isEditMode.value ? '編集モード開始' : '編集モード終了',
        detail: isEditMode.value 
          ? 'シフトセルをクリックして編集できます（過去の日付も編集可能）' 
          : '編集モードを終了しました',
        life: 3000,
      });
    };

    const openShiftEditor = async (day, staff) => {
      if (!isEditMode.value && !isShiftConfirmed.value) {
        toast.add({
          severity: 'info',
          summary: '編集不可',
          detail: '「シフト編集」ボタンを押して編集モードにしてください',
          life: 2000,
        });
        return;
      }

      if (isShiftConfirmed.value) {
        toast.add({
          severity: 'warn',
          summary: '編集不可',
          detail: '確定済みのシフトは編集できません',
          life: 2000,
        });
        return;
      }

      const shift = getShiftForStaff(day.date, staff.id);

      shiftEditorDialog.title = `${staff.last_name} ${staff.first_name} - ${day.date}`;
      shiftEditorDialog.date = day.date;
      shiftEditorDialog.staff = staff;
      shiftEditorDialog.isConfirmed = isShiftConfirmed.value;
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

    const confirmShift = () => {
      confirmShiftDialog.visible = true;
    };

    const executeShiftConfirmation = async () => {
      confirmShiftDialog.processing = true;

      try {
        await store.dispatch("shift/confirmShift", {
          year: currentYear.value,
          month: currentMonth.value,
          storeId: selectedStore.value.id
        });
        await loadShiftData();
        confirmShiftDialog.visible = false;
        isEditMode.value = false;

        toast.add({
          severity: "success",
          summary: "確定完了",
          detail: "シフトを確定しました",
          life: 3000,
        });
      } catch (error) {
        console.error("シフト確定エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "シフトの確定に失敗しました",
          life: 3000,
        });
      } finally {
        confirmShiftDialog.processing = false;
      }
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
          const shiftData = await store.dispatch("shift/fetchShiftByYearMonth", {
            year: currentYear.value,
            month: currentMonth.value,
            storeId: selectedStore.value.id
          });

          if (shiftData) {
            currentShift.value = {
              id: shiftData.id,
              store_id: shiftData.store_id,
              year: shiftData.year,
              month: shiftData.month,
              status: shiftData.status
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
      const daysNum = new Date(year, month, 0).getDate();
      const today = new Date();
      const days = [];

      for (let day = 1; day <= daysNum; day++) {
        const date = `${year}-${month.toString().padStart(2, "0")}-${day
          .toString()
          .padStart(2, "0")}`;
        const dayOfWeek = new Date(year, month - 1, day).getDay();
        const dayOfWeekLabel = ["日", "月", "火", "水", "木", "金", "土"][dayOfWeek];

        days.push({
          date,
          day,
          dayOfWeek,
          dayOfWeekLabel,
          isHoliday: isHoliday(date) || dayOfWeek === 0 || dayOfWeek === 6,
          isNationalHoliday: isHoliday(date),
          isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
          isToday:
            today.getFullYear() === year &&
            today.getMonth() + 1 === month &&
            today.getDate() === day,
        });
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
      await fetchHolidays(currentYear.value);
      await loadShiftData();
    };

    const changeStore = async () => {
      await loadShiftData();
    };

    const createShift = async () => {
      confirm.require({
        message: 'シフトの作成方法を選択してください',
        header: 'シフト作成',
        acceptLabel: 'AI自動生成',
        rejectLabel: '手動作成',
        acceptClass: 'p-button-primary',
        rejectClass: 'p-button-secondary',
        accept: () => {
          generateAutomaticShift();
        },
        reject: () => {
          createEmptyShift();
        }
      });
    };

    const createEmptyShift = async () => {
      try {
        loading.value = true;
        
        await store.dispatch('shift/createShift', {
          store_id: selectedStore.value.id,
          year: currentYear.value,
          month: currentMonth.value,
          status: 'draft',
        });
        
        await loadShiftData();
        isEditMode.value = true;
        
        toast.add({
          severity: 'success',
          summary: '作成完了',
          detail: 'シフトを作成しました。編集モードになりました。',
          life: 3000,
        });
      } catch (error) {
        console.error('シフト作成エラー:', error);
        toast.add({
          severity: 'error',
          summary: 'エラー',
          detail: 'シフトの作成に失敗しました',
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

        await store.dispatch('shift/generateShift', params);
        await loadShiftData();

        toast.add({
          severity: 'success',
          summary: '生成完了',
          detail: 'AIによるシフト生成が完了しました',
          life: 3000,
        });
      } catch (error) {
        console.error('自動シフト生成エラー:', error);
        toast.add({
          severity: 'error',
          summary: 'エラー',
          detail: '自動シフト生成に失敗しました',
          life: 3000,
        });
      } finally {
        loading.value = false;
      }
    };

    const regenerateShift = async () => {
      confirm.require({
        message: '現在のシフトを削除してAIで再生成しますか？',
        header: 'シフト再生成の確認',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-warning',
        accept: async () => {
          await generateAutomaticShift();
        }
      });
    };

    const printShift = () => {
      if (!hasCurrentShift.value) return;

      const printWindow = window.open("", "_blank");

      if (!printWindow) {
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "ポップアップがブロックされました。ブラウザの設定を確認してください。",
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
      const storeName = selectedStore.value ? selectedStore.value.name : '';
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

      daysInMonth.value.forEach(day => {
        const holidayClass = day.isHoliday ? 'holiday' : '';
        const todayClass = day.isToday ? 'today' : '';
        const cellClass = `${holidayClass} ${todayClass}`.trim();
        printHtml += `
          <th class="date-col ${cellClass}">
            <div>${day.day}</div>
            <div style="font-size: 6px;">${day.dayOfWeekLabel}</div>
            ${day.isNationalHoliday ? '<div style="font-size: 5px; color: red;">祝</div>' : ''}
          </th>
        `;
      });

      printHtml += `
              </tr>
            </thead>
            <tbody>
      `;

      staffList.value.forEach(staff => {
        printHtml += `<tr>`;
        printHtml += `<td class="staff-col">${staff.last_name} ${staff.first_name}</td>`;

        daysInMonth.value.forEach(day => {
          const shift = getShiftForStaff(day.date, staff.id);
          const holidayClass = day.isHoliday ? 'holiday' : '';
          const todayClass = day.isToday ? 'today' : '';
          const cellClass = `shift-cell ${holidayClass} ${todayClass}`.trim();
          
          if (shift) {
            printHtml += `<td class="${cellClass}">
              ${formatTime(shift.start_time)}<br>-<br>${formatTime(shift.end_time)}
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

      staffList.value.forEach(staff => {
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

      if (!shiftEditorDialog.startTimeHour || !shiftEditorDialog.startTimeMinute || 
          !shiftEditorDialog.endTimeHour || !shiftEditorDialog.endTimeMinute) {
        toast.add({
          severity: "warn",
          summary: "入力エラー",
          detail: "開始時間と終了時間を選択してください",
          life: 3000,
        });
        return;
      }

      const startTime = combineTimeComponents(shiftEditorDialog.startTimeHour, shiftEditorDialog.startTimeMinute);
      const endTime = combineTimeComponents(shiftEditorDialog.endTimeHour, shiftEditorDialog.endTimeMinute);

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
          notes: null
        };

        if (shiftEditorDialog.isPast) {
          shiftData.change_reason = shiftEditorDialog.changeReason;
        }

        console.log('Sending shift data:', shiftData);

        const existingShift = getShiftForStaff(shiftEditorDialog.date, shiftEditorDialog.staff.id);

        if (existingShift) {
          await store.dispatch("shift/updateShiftAssignment", {
            year: currentYear.value,
            month: currentMonth.value,
            assignmentId: existingShift.id,
            assignmentData: shiftData
          });
        } else {
          await store.dispatch("shift/createShiftAssignment", {
            year: currentYear.value,
            month: currentMonth.value,
            assignmentData: shiftData
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
        if (error.response && error.response.data && error.response.data.message) {
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
        const existingShift = getShiftForStaff(shiftEditorDialog.date, shiftEditorDialog.staff.id);

        if (existingShift) {
          await store.dispatch("shift/deleteShiftAssignment", {
            year: currentYear.value,
            month: currentMonth.value,
            assignmentId: existingShift.id,
            change_reason: shiftEditorDialog.isPast ? shiftEditorDialog.changeReason : null,
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
        const assignment = dayShift.assignments.find((a) => a.staff_id === staffId);
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
          await loadShiftData();
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
      viewModeOptions,
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
      confirmShiftDialog,
      hasCurrentShift,
      isShiftConfirmed,
      getTimeHeaderStyle,
      getGanttBarStyle,
      parseTimeToFloat,
      parseTimeToComponents,
      combineTimeComponents,
      openGanttShiftEditor,
      getStatusBannerClass,
      getStatusIcon,
      getStatusText,
      getDeadlineInfo,
      getDeadlineDate,
      canConfirm,
      getConfirmButtonClass,
      isPastDate,
      isDeadlineDate,
      toggleEditMode,
      openShiftEditor,
      closeShiftEditor,
      confirmShift,
      executeShiftConfirmation,
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
    };
  },
};
</script>

<style scoped>
.shift-management {
  min-height: 100vh;
  background: #fafafa;
  padding: 1.5rem;
}

.header-section {
  margin-bottom: 2rem;
}

.page-title {
  font-size: 2rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 2rem;
  letter-spacing: -0.025em;
}

.shift-status-banner {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  margin-bottom: 1.5rem;
}

.shift-status-banner.status-confirmed {
  border-left: 4px solid #059669;
  background: #f0fdf4;
}

.shift-status-banner.status-normal {
  border-left: 4px solid #2563eb;
  background: #eff6ff;
}

.shift-status-banner.status-warning {
  border-left: 4px solid #d97706;
  background: #fffbeb;
}

.shift-status-banner.status-urgent {
  border-left: 4px solid #dc2626;
  background: #fef2f2;
}

.shift-status-banner.status-overdue {
  border-left: 4px solid #b91c1c;
  background: #fef2f2;
}

.status-main {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.status-icon-wrapper {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: #f9fafb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  color: #6b7280;
}

.status-confirmed .status-icon-wrapper {
  background: #d1fae5;
  color: #059669;
}

.status-normal .status-icon-wrapper {
  background: #dbeafe;
  color: #2563eb;
}

.status-warning .status-icon-wrapper {
  background: #fef3c7;
  color: #d97706;
}

.status-urgent .status-icon-wrapper {
  background: #fecaca;
  color: #dc2626;
}

.status-overdue .status-icon-wrapper {
  background: #fee2e2;
  color: #b91c1c;
}

.status-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  color: #111827;
}

.status-text {
  font-size: 1rem;
  font-weight: 500;
}

.deadline-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #6b7280;
}

.confirm-button {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 500;
  font-size: 0.875rem;
  border: none;
  transition: all 0.2s ease;
}

.confirm-button.urgent {
  background: #dc2626;
  color: white;
}

.confirm-button.warning {
  background: #d97706;
  color: white;
}

.confirm-button.normal {
  background: #2563eb;
  color: white;
}

.confirm-button:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.control-panel {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 2rem;
}

.period-controls {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.month-navigator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #f9fafb;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.nav-button {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: white;
  border: 1px solid #d1d5db;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  font-size: 0.875rem;
}

.nav-button:hover {
  background: #2563eb;
  border-color: #2563eb;
  color: white;
}

.period-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 100px;
}

.year {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 400;
}

.month {
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
}

.store-selector {
  min-width: 200px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
}

.view-controls {
  display: flex;
  justify-content: center;
}

.view-mode-tabs {
  display: flex;
  background: #f9fafb;
  border-radius: 8px;
  padding: 0.25rem;
  border: 1px solid #e5e7eb;
}

.view-tab {
  padding: 0.5rem 0.75rem;
  border: none;
  background: transparent;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  font-size: 0.875rem;
  color: #6b7280;
  transition: all 0.2s ease;
  cursor: pointer;
}

.view-tab:hover {
  color: #374151;
}

.view-tab.active {
  background: white;
  color: #2563eb;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.action-controls {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.create-button, .edit-button, .regenerate-button, .print-button {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 500;
  font-size: 0.875rem;
  border: 1px solid #d1d5db;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.create-button {
  background: #2563eb;
  color: white;
  border-color: #2563eb;
}

.create-button:hover {
  background: #1d4ed8;
}

.edit-button {
  background: white;
  color: #6b7280;
}

.edit-button:hover {
  background: #f9fafb;
  color: #374151;
}

.edit-button.active {
  background: #059669;
  color: white;
  border-color: #059669;
}

.regenerate-button {
  background: white;
  color: #6b7280;
}

.regenerate-button:hover {
  background: #f9fafb;
  color: #374151;
}

.print-button {
  background: white;
  color: #6b7280;
}

.print-button:hover {
  background: #f9fafb;
  color: #374151;
}

.loading-state, .empty-state {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 4rem 2rem;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.loading-text {
  font-size: 1.1rem;
  color: #64748b;
  font-weight: 500;
}

.empty-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 2rem;
  border-radius: 50%;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: #cbd5e1;
}

.empty-state h3 {
  font-size: 1.3rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.5rem;
}

.empty-state p {
  color: #64748b;
  font-size: 0.95rem;
  margin-bottom: 2rem;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.shift-content {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.modern-calendar {
  position: relative;
}

.modern-calendar.edit-mode::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: #10b981;
  z-index: 10;
}

.modern-calendar.confirmed::before {
  background: #3b82f6;
}

.calendar-header {
  display: flex;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 9;
}

.staff-column-header {
  min-width: 200px;
  width: 200px;
  padding: 1.5rem 1rem;
  background: #1e293b;
  color: white;
  font-weight: 600;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  position: sticky;
  left: 0;
  z-index: 10;
}

.calendar-container {
  overflow-x: auto;
}

.date-cell-header {
  min-width: 80px;
  width: 80px;
  padding: 1rem 0.5rem;
  text-align: center;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  position: relative;
  transition: all 0.2s ease;
}

.date-cell-header:hover {
  background: #f8fafc;
}

.date-cell-header.is-today {
  background: #eff6ff;
  border-left: 3px solid #3b82f6;
}

.date-cell-header.is-weekend {
  background: #fef3c7;
}

.date-cell-header.is-holiday {
  background: #fecaca;
}

.date-cell-header.is-deadline::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 2px;
  background: #ef4444;
  border-radius: 1px;
}

.date-number {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1e293b;
}

.date-weekday {
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 500;
}

.holiday-indicator, .deadline-indicator {
  font-size: 0.65rem;
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  color: white;
  font-weight: 500;
}

.holiday-indicator {
  background: #ef4444;
}

.deadline-indicator {
  background: #f59e0b;
}

.dates-header {
  display: flex;
  flex: 1;
}

.staff-row {
  display: flex;
  border-bottom: 1px solid #f1f5f9;
  transition: all 0.2s ease;
}

.staff-row:hover {
  background: #f8fafc;
}

.staff-info {
  min-width: 200px;
  width: 200px;
  padding: 1.2rem 1rem;
  background: #f8fafc;
  border-right: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  position: sticky;
  left: 0;
  z-index: 5;
}

.staff-avatar {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: #3b82f6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.9rem;
}

.staff-details {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.staff-name {
  font-weight: 500;
  color: #1e293b;
  font-size: 0.85rem;
}

.staff-role {
  font-size: 0.7rem;
  color: #64748b;
  font-weight: 400;
}

.shift-cells {
  display: flex;
  flex: 1;
}

.shift-cell {
  min-width: 80px;
  width: 80px;
  min-height: 70px;
  border-right: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.2s ease;
  cursor: default;
}

.shift-cell.is-today {
  background: #eff6ff;
}

.shift-cell.is-weekend {
  background: #fffbeb;
}

.shift-cell.is-holiday {
  background: #fef2f2;
}

.shift-cell.is-past {
  opacity: 0.6;
}

.shift-cell.is-deadline::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #ef4444;
}

.shift-cell.is-editable {
  cursor: pointer;
  background: #f0fdf4;
}

.shift-cell.is-editable:hover {
  background: #dcfce7;
  transform: scale(1.02);
}

.shift-cell.past-editable {
  background: #fffbeb;
}

.shift-cell.past-editable:hover {
  background: #fef3c7;
}

.shift-time-card {
  background: #10b981;
  color: white;
  padding: 0.5rem 0.4rem;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  font-weight: 500;
  font-size: 0.7rem;
  min-width: 50px;
  transition: all 0.2s ease;
}

.shift-time-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(16, 185, 129, 0.2);
}

.shift-start, .shift-end {
  font-weight: 600;
}

.shift-separator {
  font-size: 0.6rem;
  opacity: 0.8;
}

.no-shift {
  color: #cbd5e1;
  font-size: 1.2rem;
  font-weight: 300;
  transition: all 0.2s ease;
}

.shift-cell.is-editable .no-shift {
  color: #10b981;
  font-weight: 500;
}

.modern-gantt {
  position: relative;
}

.modern-gantt.edit-mode::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #4ecdc4, #44a08d);
  z-index: 10;
}

.modern-gantt.confirmed::before {
  background: linear-gradient(90deg, #667eea, #764ba2);
}

.gantt-header {
  display: flex;
  background: linear-gradient(135deg, #f8f9ff, #e8f0fe);
  border-bottom: 2px solid rgba(102, 126, 234, 0.1);
  position: sticky;
  top: 0;
  z-index: 9;
}

.gantt-staff-header {
  min-width: 200px;
  width: 200px;
  padding: 1.5rem 1rem;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  font-weight: 600;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  position: sticky;
  left: 0;
  z-index: 10;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
}

.gantt-timeline-header {
  display: flex;
  flex: 1;
}

.gantt-hour-cell {
  text-align: center;
  padding: 1rem 0.5rem;
  border-right: 1px solid rgba(102, 126, 234, 0.1);
  font-size: 0.8rem;
  font-weight: 600;
  color: #667eea;
  background: rgba(102, 126, 234, 0.02);
}

.gantt-body {
  max-height: 70vh;
  overflow-y: auto;
}

.gantt-day-section {
  border-bottom: 2px solid rgba(102, 126, 234, 0.1);
}

.gantt-day-section.is-today {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.03), rgba(118, 75, 162, 0.03));
}

.gantt-day-section.is-weekend {
  background: rgba(255, 152, 0, 0.02);
}

.gantt-day-section.is-holiday {
  background: rgba(244, 67, 54, 0.02);
}

.gantt-day-header {
  padding: 1rem;
  background: rgba(248, 249, 255, 0.8);
  border-bottom: 1px solid rgba(102, 126, 234, 0.1);
}

.day-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.day-number {
  font-size: 1.2rem;
  font-weight: 700;
  color: #333;
}

.day-weekday {
  font-size: 0.9rem;
  color: #666;
  font-weight: 500;
}

.day-badges {
  display: flex;
  gap: 0.5rem;
}

.holiday-badge, .deadline-badge {
  font-size: 0.7rem;
  padding: 0.2rem 0.4rem;
  border-radius: 8px;
  color: white;
  font-weight: 600;
}

.holiday-badge {
  background: linear-gradient(135deg, #ff4757, #ff3742);
}

.deadline-badge {
  background: linear-gradient(135deg, #ff9f43, #feca57);
}

.gantt-staff-rows {
  display: flex;
  flex-direction: column;
}

.gantt-staff-row {
  display: flex;
  min-height: 60px;
  border-bottom: 1px solid rgba(102, 126, 234, 0.05);
  transition: all 0.3s ease;
}

.gantt-staff-row:hover {
  background: rgba(102, 126, 234, 0.02);
}

.gantt-staff-info {
  min-width: 200px;
  width: 200px;
  padding: 1rem;
  background: rgba(248, 249, 255, 0.6);
  border-right: 1px solid rgba(102, 126, 234, 0.1);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  position: sticky;
  left: 0;
  z-index: 5;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.03);
}

.staff-avatar-small {
  width: 35px;
  height: 35px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.9rem;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.staff-name-small {
  font-weight: 500;
  color: #333;
  font-size: 0.85rem;
}

.gantt-timeline {
  position: relative;
  flex: 1;
  cursor: pointer;
  transition: all 0.3s ease;
}

.gantt-timeline:hover {
  background: rgba(76, 220, 196, 0.05);
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
  border-right: 1px solid rgba(102, 126, 234, 0.05);
  height: 100%;
  transition: all 0.3s ease;
}

.gantt-hour-line:hover {
  background: rgba(102, 126, 234, 0.05);
}

.gantt-shift-block {
  position: absolute;
  top: 8px;
  bottom: 8px;
  background: linear-gradient(135deg, #4ecdc4, #44a08d);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(76, 220, 196, 0.3);
  transition: all 0.3s ease;
  cursor: pointer;
  z-index: 3;
}

.gantt-shift-block:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(76, 220, 196, 0.4);
}

.gantt-shift-block.is-editable {
  background: linear-gradient(135deg, #66bb6a, #81c784);
}

.gantt-shift-block.is-past-editable {
  background: linear-gradient(135deg, #ff9800, #ffb74d);
}

.shift-time-text {
  font-size: 0.8rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 0.5rem;
}

.calendar-body {
  max-height: 70vh;
  overflow-y: auto;
}

.shift-summary-panel {
  padding: 1.5rem;
  background: #fafafa;
  border-top: 1px solid #e5e7eb;
}

.summary-title {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 1rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
}

.summary-card {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid #e5e7eb;
  transition: all 0.2s ease;
}

.summary-card:hover {
  border-color: #d1d5db;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.summary-staff {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.summary-hours {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.hours-number {
  font-size: 1.25rem;
  font-weight: 600;
  color: #2563eb;
}

.hours-unit {
  font-size: 0.7rem;
  color: #6b7280;
  font-weight: 400;
}

.staff-avatar-small {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: #2563eb;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  font-size: 0.7rem;
}

.staff-name-small {
  font-weight: 500;
  color: #111827;
  font-size: 0.75rem;
}

.modern-dialog .p-dialog-content {
  border-radius: 20px;
}

.shift-editor-form {
  padding: 1rem 0;
}

.status-alert {
  padding: 1rem 1.5rem;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  font-weight: 500;
}

.status-alert.confirmed {
  background: linear-gradient(135deg, rgba(33, 150, 243, 0.1), rgba(100, 181, 246, 0.1));
  color: #1976d2;
  border: 1px solid rgba(33, 150, 243, 0.2);
}

.status-alert.warning {
  background: linear-gradient(135deg, rgba(255, 152, 0, 0.1), rgba(255, 183, 77, 0.1));
  color: #f57c00;
  border: 1px solid rgba(255, 152, 0, 0.2);
}

.time-inputs-section {
  margin-bottom: 1.5rem;
}

.time-input-group {
  margin-bottom: 1.5rem;
}

.form-label {
  display: block;
  margin-bottom: 0.75rem;
  font-weight: 600;
  color: #374151;
  font-size: 0.875rem;
}

.time-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #f9fafb;
  padding: 0.75rem;
  border-radius: 12px;
  border: 2px solid #e5e7eb;
  transition: all 0.3s ease;
  max-width: 300px;
}

.p-inputtext{
  font-size: 1.2em;
}

.time-selector:focus-within {
  border-color: #3b82f6;
  background: white;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.time-dropdown {
  flex: 1;
  border: none;
  background: transparent;
}

.hour-dropdown {
  min-width: 80px;
}

.minute-dropdown {
  min-width: 80px;
}

.time-separator {
  font-size: 1.25rem;
  font-weight: 600;
  color: #6b7280;
  padding: 0 0.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-input, .form-textarea {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid rgba(102, 126, 234, 0.2);
  border-radius: 12px;
  font-size: 1rem;
  transition: all 0.3s ease;
  background: rgba(248, 249, 255, 0.5);
}

.form-input:focus, .form-textarea:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  background: white;
}

.checkbox-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.form-checkbox {
  width: 20px;
  height: 20px;
}

.checkbox-label {
  font-weight: 500;
  color: #333;
  cursor: pointer;
}

.dialog-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  padding-top: 1rem;
  width: 100%;
}

.delete-button, .cancel-button, .save-button, .confirm-button {
  padding: 0.75rem 1.5rem;
  border-radius: 12px;
  font-weight: 600;
  border: none;
  transition: all 0.3s ease;
  cursor: pointer;
}

.delete-button {
  background: linear-gradient(135deg, #ff4757, #ff3742);
  color: white;
}

.cancel-button {
  background: #f8f9fa;
  color: #666;
  border: 2px solid #e9ecef;
}

.save-button, .confirm-button {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.delete-button:hover, .cancel-button:hover, .save-button:hover, .confirm-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.confirm-content {
  padding: 1rem 0;
}

.confirm-details {
  margin-bottom: 1.5rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid rgba(102, 126, 234, 0.1);
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  font-weight: 600;
  color: #666;
}

.detail-value {
  font-weight: 500;
  color: #333;
}


@media (max-width: 1024px) {
  .control-panel {
    grid-template-columns: 1fr;
    gap: 1rem;
    text-align: center;
  }

  .action-controls {
    justify-content: center;
    flex-wrap: wrap;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .shift-management {
    padding: 1rem;
  }

  .page-title {
    font-size: 1.5rem;
  }

  .shift-status-banner {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }

  .staff-column-header, .staff-info {
    min-width: 120px;
    width: 120px;
  }

  .date-cell-header, .shift-cell {
    min-width: 48px;
    width: 48px;
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
    gap: 0.75rem;
  }

  .time-dropdown {
    width: 100%;
  }
}
</style>