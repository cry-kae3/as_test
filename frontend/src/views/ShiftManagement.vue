<template>
  <div class="shift-management">
    <h1 class="page-title">シフト管理</h1>

    <div class="shift-status-banner" :class="getStatusBannerClass()">
      <div class="status-info">
        <div class="status-main">
          <i :class="getStatusIcon()"></i>
          <span class="status-text">{{ getStatusText() }}</span>
        </div>
        <div class="deadline-info" v-if="getDeadlineInfo()">
          <i class="pi pi-clock"></i>
          <span>{{ getDeadlineInfo() }}</span>
        </div>
      </div>
      <div class="status-actions" v-if="canConfirm()">
        <Button
          label="今すぐ確定"
          icon="pi pi-check-circle"
          class="p-button-sm"
          :class="getConfirmButtonClass()"
          @click="confirmShift"
        />
      </div>
    </div>

    <div class="toolbar">
      <div class="period-selector">
        <div class="year-month-selector">
          <Button
            icon="pi pi-chevron-left"
            class="p-button-rounded p-button-text"
            @click="previousMonth"
            :disabled="loading"
          />
          <span class="period-label">{{ currentYear }}年 {{ currentMonth }}月</span>
          <Button
            icon="pi pi-chevron-right"
            class="p-button-rounded p-button-text"
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

      <div class="action-buttons">
        <Button
          v-if="!hasCurrentShift"
          label="シフト作成"
          icon="pi pi-plus"
          class="p-button-primary"
          @click="createShift"
          :disabled="loading || !selectedStore"
        />

        <template v-if="hasCurrentShift && !isShiftConfirmed">
          <Button
            :label="isEditMode ? '編集終了' : 'シフト編集'"
            :icon="isEditMode ? 'pi pi-check' : 'pi pi-pencil'"
            :class="isEditMode ? 'p-button-success' : 'p-button-secondary'"
            @click="toggleEditMode"
            :disabled="loading"
          />

          <Button
            label="AI再生成"
            icon="pi pi-refresh"
            class="p-button-secondary"
            @click="regenerateShift"
            :disabled="loading"
          />
        </template>

        <Button
          v-if="hasCurrentShift"
          label="印刷"
          icon="pi pi-print"
          class="p-button-outlined"
          @click="printShift"
          :disabled="loading"
        />
      </div>
    </div>

    <div v-if="loading" class="loading-container">
      <ProgressSpinner />
      <span class="loading-text">読み込み中...</span>
    </div>

    <div v-else-if="!selectedStore" class="empty-message">
      <Message severity="info">
        <div class="message-content">
          <i class="pi pi-info-circle mr-2"></i>
          <span>店舗を選択してください。</span>
        </div>
      </Message>
    </div>

    <div v-else-if="!hasCurrentShift" class="empty-message">
      <Message severity="info">
        <div class="message-content">
          <i class="pi pi-info-circle mr-2"></i>
          <span>選択した期間のシフトはまだ作成されていません。</span>
        </div>
      </Message>
    </div>

    <div v-else class="shift-content">
      <div class="shift-calendar" :class="{ 'edit-mode': isEditMode, 'confirmed': isShiftConfirmed }">
        <div class="calendar-header">
          <div class="date-header">日付</div>
          <div class="day-header">曜日</div>
          <div v-for="staff in staffList" :key="staff.id" class="staff-header">
            {{ staff.last_name }} {{ staff.first_name }}
          </div>
        </div>

        <div
          v-for="day in daysInMonth"
          :key="day.date"
          :class="[
            'calendar-row',
            { 
              holiday: day.isHoliday, 
              today: day.isToday,
              past: isPastDate(day.date),
              deadline: isDeadlineDate(day.date)
            }
          ]"
        >
          <div class="date-cell">
            <span class="date-number">{{ day.day }}</span>
            <span v-if="isDeadlineDate(day.date)" class="deadline-badge">締切</span>
          </div>
          <div class="day-cell">{{ day.dayOfWeekLabel }}</div>
          <div
            v-for="staff in staffList"
            :key="`${day.date}-${staff.id}`"
            class="shift-cell"
            @click="openShiftEditor(day, staff)"
            :class="{ 
              'closed-day': day.isClosed,
              'editable': isEditMode && !isShiftConfirmed,
              'past-editable': isEditMode && !isShiftConfirmed && isPastDate(day.date)
            }"
          >
            <template v-if="!day.isClosed">
              <div
                v-if="getShiftForStaff(day.date, staff.id)"
                class="shift-time"
              >
                {{ formatTime(getShiftForStaff(day.date, staff.id).start_time) }}
                -
                {{ formatTime(getShiftForStaff(day.date, staff.id).end_time) }}
              </div>
              <div v-else class="no-shift">-</div>
            </template>
            <template v-else>
              <div class="closed-label">休業日</div>
            </template>
          </div>
        </div>
      </div>

      <div class="shift-summary">
        <div class="summary-header">
          <div class="empty-header"></div>
          <div class="empty-header"></div>
          <div
            v-for="staff in staffList"
            :key="`total-${staff.id}`"
            class="staff-total-header"
          >
            合計時間
          </div>
        </div>

        <div class="summary-row">
          <div class="empty-cell"></div>
          <div class="empty-cell"></div>
          <div
            v-for="staff in staffList"
            :key="`hours-${staff.id}`"
            class="staff-total-cell"
          >
            {{ calculateTotalHours(staff.id) }}時間
          </div>
        </div>
      </div>
    </div>

    <Dialog
      v-model:visible="shiftEditorDialog.visible"
      :header="shiftEditorDialog.title"
      :modal="true"
      class="p-fluid"
      :style="{ width: '450px' }"
      :closable="!saving"
    >
      <div class="shift-editor-content">
        <div v-if="shiftEditorDialog.isClosed" class="closed-day-message">
          <Message severity="info">
            <div class="message-content">
              <i class="pi pi-info-circle mr-2"></i>
              <span>この日は店舗の休業日です。</span>
            </div>
          </Message>
        </div>
        <div v-else-if="shiftEditorDialog.isConfirmed" class="confirmed-shift-message">
          <Message severity="warn">
            <div class="message-content">
              <i class="pi pi-exclamation-triangle mr-2"></i>
              <span>シフトは確定済みです。</span>
            </div>
          </Message>
        </div>
        <div v-else>
          <div v-if="shiftEditorDialog.isPast" class="past-date-notice">
            <Message severity="warn">
              <div class="message-content">
                <i class="pi pi-exclamation-triangle mr-2"></i>
                <span>過去の日付を編集しています。変更は履歴に記録されます。</span>
              </div>
            </Message>
          </div>

          <div class="field">
            <label for="shift-start-time">開始時間</label>
            <InputMask
              id="shift-start-time"
              v-model="shiftEditorDialog.startTime"
              mask="99:99"
              placeholder="00:00"
              slotChar="0"
            />
          </div>

          <div class="field">
            <label for="shift-end-time">終了時間</label>
            <InputMask
              id="shift-end-time"
              v-model="shiftEditorDialog.endTime"
              mask="99:99"
              placeholder="00:00"
              slotChar="0"
            />
          </div>

          <div class="field">
            <div class="p-field-checkbox">
              <Checkbox
                id="staff-rest-day"
                v-model="shiftEditorDialog.isRestDay"
                binary
              />
              <label for="staff-rest-day" class="ml-2">休日として設定</label>
            </div>
          </div>

          <div v-if="shiftEditorDialog.isPast" class="field">
            <label for="change-reason">変更理由</label>
            <Textarea
              id="change-reason"
              v-model="shiftEditorDialog.changeReason"
              rows="3"
              placeholder="過去の日付を変更する理由を入力してください（急な体調不良、シフト交代など）"
            />
          </div>
        </div>
      </div>

      <template #footer>
        <Button
          v-if="!shiftEditorDialog.isClosed && !shiftEditorDialog.isConfirmed"
          label="クリア"
          icon="pi pi-trash"
          class="p-button-danger"
          @click="clearShift"
          :disabled="saving || !shiftEditorDialog.hasShift"
        />
        <Button
          label="キャンセル"
          icon="pi pi-times"
          class="p-button-text"
          @click="closeShiftEditor"
          :disabled="saving"
        />
        <Button
          v-if="!shiftEditorDialog.isClosed && !shiftEditorDialog.isConfirmed"
          label="保存"
          icon="pi pi-check"
          class="p-button-primary"
          @click="saveShift"
          :loading="saving"
        />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="confirmShiftDialog.visible"
      header="シフト確定の確認"
      :modal="true"
      class="p-fluid"
      :style="{ width: '450px' }"
    >
      <div class="confirm-shift-content">
        <div class="confirmation-details">
          <div class="detail-item">
            <strong>対象期間:</strong> {{ currentYear }}年{{ currentMonth }}月
          </div>
          <div class="detail-item">
            <strong>店舗:</strong> {{ selectedStore?.name }}
          </div>
          <div class="detail-item">
            <strong>締切日:</strong> {{ getDeadlineDate() }}
          </div>
        </div>
        
        <div class="warning-message">
          <Message severity="warn">
            確定後は編集できなくなります。スタッフへの通知も送信されます。
          </Message>
        </div>
      </div>

      <template #footer>
        <Button
          label="キャンセル"
          icon="pi pi-times"
          class="p-button-text"
          @click="confirmShiftDialog.visible = false"
        />
        <Button
          label="確定する"
          icon="pi pi-check"
          class="p-button-primary"
          @click="executeShiftConfirmation"
          :loading="confirmShiftDialog.processing"
        />
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
  },
  setup() {
    const store = useStore();
    const toast = useToast();
    const confirm = useConfirm();

    const loading = ref(false);
    const saving = ref(false);
    const isEditMode = ref(false);
    const currentYear = ref(new Date().getFullYear());
    const currentMonth = ref(new Date().getMonth() + 1);
    const selectedStore = ref(null);
    const stores = ref([]);
    const staffList = ref([]);
    const shifts = ref([]);
    const daysInMonth = ref([]);
    const currentShift = ref(null);
    const systemSettings = ref({ closing_day: 25 });

    const shiftEditorDialog = reactive({
      visible: false,
      title: "",
      date: null,
      staff: null,
      startTime: "",
      endTime: "",
      isRestDay: false,
      isClosed: false,
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
        return 'p-button-danger';
      } else if (daysUntilDeadline <= 3) {
        return 'p-button-warning';
      } else {
        return 'p-button-success';
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
      shiftEditorDialog.isClosed = day.isClosed;
      shiftEditorDialog.isConfirmed = isShiftConfirmed.value;
      shiftEditorDialog.isPast = isPastDate(day.date);
      shiftEditorDialog.changeReason = "";

      if (shift) {
        shiftEditorDialog.startTime = shift.start_time;
        shiftEditorDialog.endTime = shift.end_time;
        shiftEditorDialog.isRestDay = shift.is_day_off;
        shiftEditorDialog.hasShift = true;
      } else {
        shiftEditorDialog.startTime = "09:00";
        shiftEditorDialog.endTime = "18:00";
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

        const isClosed = dayOfWeek === 0;

        days.push({
          date,
          day,
          dayOfWeek,
          dayOfWeekLabel,
          isHoliday: dayOfWeek === 0 || dayOfWeek === 6,
          isClosed,
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
      await loadShiftData();
    };

    const nextMonth = async () => {
      if (currentMonth.value === 12) {
        currentYear.value++;
        currentMonth.value = 1;
      } else {
        currentMonth.value++;
      }
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
              @page { margin: 0.5cm; size: A4 landscape; }
              body { font-family: Arial, sans-serif; font-size: 10px; }
            }
            body { font-family: Arial, sans-serif; font-size: 12px; }
            .print-header { text-align: center; margin-bottom: 20px; }
            .print-title { font-size: 18px; font-weight: bold; }
            .print-period { font-size: 14px; margin-top: 5px; }
            .print-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .print-table th, .print-table td { 
              border: 1px solid #333; 
              padding: 3px; 
              text-align: center; 
              font-size: 10px; 
            }
            .print-table th { 
              background-color: #f0f0f0; 
              font-weight: bold; 
            }
            .date-col { width: 60px; }
            .day-col { width: 40px; }
            .staff-col { width: 80px; }
            .holiday { background-color: #ffe6e6; }
            .closed { background-color: #f0f0f0; color: #666; }
            .shift-time { font-size: 9px; }
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
                <th class="date-col">日付</th>
                <th class="day-col">曜日</th>
      `;

      staffList.value.forEach(staff => {
        printHtml += `<th class="staff-col">${staff.last_name} ${staff.first_name}</th>`;
      });

      printHtml += `
              </tr>
            </thead>
            <tbody>
      `;

      daysInMonth.value.forEach(day => {
        const rowClass = day.isHoliday ? 'holiday' : '';
        printHtml += `<tr class="${rowClass}">`;
        printHtml += `<td>${day.day}</td>`;
        printHtml += `<td>${day.dayOfWeekLabel}</td>`;

        staffList.value.forEach(staff => {
          const shift = getShiftForStaff(day.date, staff.id);
          const cellClass = day.isClosed ? 'closed' : '';
          
          if (day.isClosed) {
            printHtml += `<td class="${cellClass}">休業日</td>`;
          } else if (shift) {
            printHtml += `<td class="${cellClass}">
              <div class="shift-time">${formatTime(shift.start_time)}-${formatTime(shift.end_time)}</div>
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

      if (!shiftEditorDialog.startTime || !shiftEditorDialog.endTime) {
        toast.add({
          severity: "warn",
          summary: "入力エラー",
          detail: "開始時間と終了時間を入力してください",
          life: 3000,
        });
        return;
      }

      const startTime = shiftEditorDialog.startTime;
      const endTime = shiftEditorDialog.endTime;

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
          date: shiftEditorDialog.date,
          staff_id: shiftEditorDialog.staff.id,
          start_time: startTime,
          end_time: endTime,
          change_reason: shiftEditorDialog.isPast ? shiftEditorDialog.changeReason : null,
        };

        const existingShift = getShiftForStaff(shiftEditorDialog.date, shiftEditorDialog.staff.id);

        if (existingShift) {
          await store.dispatch("shift/updateShiftAssignment", {
            year: currentYear.value,
            month: currentMonth.value,
            assignmentId: existingShift.id,
            ...shiftData,
          });
        } else {
          await store.dispatch("shift/createShiftAssignment", {
            year: currentYear.value,
            month: currentMonth.value,
            ...shiftData,
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
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "シフトの保存に失敗しました",
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
        await fetchSystemSettings();
        
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
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-title {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 20px;
  color: #333;
}

.shift-status-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.shift-status-banner.status-confirmed {
  background: linear-gradient(135deg, #4caf50, #81c784);
  color: white;
}

.shift-status-banner.status-normal {
  background: linear-gradient(135deg, #2196f3, #64b5f6);
  color: white;
}

.shift-status-banner.status-warning {
  background: linear-gradient(135deg, #ff9800, #ffb74d);
  color: white;
}

.shift-status-banner.status-urgent {
  background: linear-gradient(135deg, #f44336, #ef5350);
  color: white;
}

.shift-status-banner.status-overdue {
  background: linear-gradient(135deg, #d32f2f, #f44336);
  color: white;
}

.status-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.status-main {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: bold;
}

.deadline-info {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 14px;
  opacity: 0.9;
}

.status-actions {
  flex-shrink: 0;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 15px 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

.period-selector {
  display: flex;
  align-items: center;
  gap: 15px;
}

.year-month-selector {
  display: flex;
  align-items: center;
  gap: 10px;
}

.period-label {
  font-size: 18px;
  font-weight: bold;
  color: #333;
  min-width: 120px;
  text-align: center;
}

.store-selector {
  min-width: 200px;
}

.action-buttons {
  display: flex;
  gap: 10px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  gap: 15px;
}

.loading-text {
  font-size: 16px;
  color: #666;
}

.empty-message {
  padding: 40px;
  text-align: center;
}

.message-content {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.shift-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.shift-calendar {
  overflow-x: auto;
}

.shift-calendar.edit-mode {
  border: 2px solid #4caf50;
}

.shift-calendar.confirmed {
  border: 2px solid #2196f3;
  opacity: 0.9;
}

.calendar-header {
  display: flex;
  background: #f5f5f5;
  border-bottom: 2px solid #ddd;
  font-weight: bold;
  font-size: 14px;
}

.date-header,
.day-header {
  padding: 12px 8px;
  text-align: center;
  border-right: 1px solid #ddd;
  min-width: 80px;
  flex-shrink: 0;
}

.staff-header {
  padding: 12px 8px;
  text-align: center;
  border-right: 1px solid #ddd;
  min-width: 120px;
  flex-shrink: 0;
}

.calendar-row {
  display: flex;
  border-bottom: 1px solid #eee;
}

.calendar-row.holiday {
  background-color: #fff5f5;
}

.calendar-row.today {
  background-color: #e3f2fd;
}

.calendar-row.past {
  opacity: 0.7;
}

.calendar-row.deadline {
  border-left: 4px solid #f44336;
}

.date-cell,
.day-cell {
  padding: 8px;
  text-align: center;
  border-right: 1px solid #eee;
  min-width: 80px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.date-number {
  font-weight: bold;
  font-size: 14px;
}

.deadline-badge {
  background: #f44336;
  color: white;
  font-size: 10px;
  padding: 2px 4px;
  border-radius: 3px;
}

.shift-cell {
  padding: 8px;
  text-align: center;
  border-right: 1px solid #eee;
  min-width: 120px;
  flex-shrink: 0;
  min-height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.shift-cell.closed-day {
  background-color: #f5f5f5;
  color: #999;
}

.shift-cell.editable {
  cursor: pointer;
  background-color: #f9f9f9;
}

.shift-cell.editable:hover {
  background-color: #e8f5e8;
  border: 1px solid #4caf50;
}

.shift-cell.past-editable {
  background-color: #fff3e0;
}

.shift-cell.past-editable:hover {
  background-color: #ffe0b2;
  border: 1px solid #ff9800;
}

.shift-time {
  font-size: 12px;
  font-weight: bold;
  color: #333;
  background: #e8f5e8;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #4caf50;
}

.no-shift {
  color: #ccc;
  font-size: 14px;
}

.closed-label {
  color: #999;
  font-size: 12px;
}

.shift-summary {
  border-top: 2px solid #ddd;
  background: #fafafa;
}

.summary-header {
  display: flex;
  font-weight: bold;
  font-size: 14px;
  background: #f0f0f0;
}

.empty-header {
  padding: 12px 8px;
  border-right: 1px solid #ddd;
  min-width: 80px;
  flex-shrink: 0;
}

.staff-total-header {
  padding: 12px 8px;
  text-align: center;
  border-right: 1px solid #ddd;
  min-width: 120px;
  flex-shrink: 0;
}

.summary-row {
  display: flex;
}

.empty-cell {
  padding: 8px;
  border-right: 1px solid #eee;
  min-width: 80px;
  flex-shrink: 0;
}

.staff-total-cell {
  padding: 8px;
  text-align: center;
  border-right: 1px solid #eee;
  min-width: 120px;
  flex-shrink: 0;
  font-weight: bold;
  color: #333;
  background: #fff;
}

.shift-editor-content {
  padding: 10px 0;
}

.past-date-notice {
  margin-bottom: 15px;
}

.confirm-shift-content {
  padding: 10px 0;
}

.confirmation-details {
  margin-bottom: 20px;
}

.detail-item {
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.detail-item:last-child {
  border-bottom: none;
}

.warning-message {
  margin-top: 15px;
}

@media (max-width: 1200px) {
  .toolbar {
    flex-direction: column;
    gap: 15px;
    align-items: stretch;
  }

  .period-selector {
    justify-content: center;
  }

  .action-buttons {
    justify-content: center;
  }
}

@media (max-width: 768px) {
  .shift-management {
    padding: 10px;
  }

  .period-selector {
    flex-direction: column;
    gap: 10px;
  }

  .action-buttons {
    flex-wrap: wrap;
  }

  .shift-status-banner {
    flex-direction: column;
    gap: 10px;
    text-align: center;
  }

  .status-actions {
    width: 100%;
  }
}
</style>