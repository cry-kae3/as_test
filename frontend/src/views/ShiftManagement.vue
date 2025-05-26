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
              'editable': isEditMode && !isShiftConfirmed && !isPastDate(day.date)
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
        <div v-else-if="shiftEditorDialog.isPast" class="past-date-message">
          <Message severity="warn">
            <div class="message-content">
              <i class="pi pi-exclamation-triangle mr-2"></i>
              <span>過去の日付は編集できません。</span>
            </div>
          </Message>
        </div>
        <div v-else>
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
        </div>
      </div>

      <template #footer>
        <Button
          v-if="!shiftEditorDialog.isClosed && !shiftEditorDialog.isConfirmed && !shiftEditorDialog.isPast"
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
          v-if="!shiftEditorDialog.isClosed && !shiftEditorDialog.isConfirmed && !shiftEditorDialog.isPast"
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

export default {
  name: "ShiftManagement",
  components: {
    InputMask,
    ProgressSpinner,
    Message,
    ConfirmDialog,
    Toast,
    Checkbox,
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

    const getDeadlineDate = () => {
      const lastDay = new Date(currentYear.value, currentMonth.value, 0).getDate();
      return `${currentYear.value}年${currentMonth.value}月${lastDay}日`;
    };

    const getStatusBannerClass = () => {
      if (isShiftConfirmed.value) {
        return 'status-confirmed';
      }
      
      const today = new Date();
      const deadline = new Date(currentYear.value, currentMonth.value, 0);
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
      const deadline = new Date(currentYear.value, currentMonth.value, 0);
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
      const deadline = new Date(currentYear.value, currentMonth.value, 0);
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
      const deadline = new Date(currentYear.value, currentMonth.value, 0);
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
      const deadlineDate = new Date(currentYear.value, currentMonth.value, 0);
      const checkDate = new Date(date);
      return deadlineDate.toDateString() === checkDate.toDateString();
    };

    const toggleEditMode = () => {
      isEditMode.value = !isEditMode.value;
      
      toast.add({
        severity: 'info',
        summary: isEditMode.value ? '編集モード開始' : '編集モード終了',
        detail: isEditMode.value 
          ? 'シフトセルをクリックして編集できます' 
          : '編集モードを終了しました',
        life: 2000,
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

      if (isPastDate(day.date)) {
        toast.add({
          severity: 'warn',
          summary: '編集不可',
          detail: '過去の日付は編集できません',
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
        await store.dispatch("shift/confirmShift", currentShift.value.id);
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

        const shiftData = await store.dispatch("shift/fetchShifts", {
          store_id: selectedStore.value.id,
          year: currentYear.value,
          month: currentMonth.value,
        });

        if (shiftData && shiftData.length > 0) {
          currentShift.value = shiftData[0];
          const shiftDetails = await store.dispatch(
            "shift/fetchShiftDetails",
            currentShift.value.id
          );
          shifts.value = shiftDetails;
        } else {
          currentShift.value = null;
          shifts.value = [];
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

    const previousMonth = () => {
      if (currentMonth.value === 1) {
        currentYear.value--;
        currentMonth.value = 12;
      } else {
        currentMonth.value--;
      }
    };

    const nextMonth = () => {
      if (currentMonth.value === 12) {
        currentYear.value++;
        currentMonth.value = 1;
      } else {
        currentMonth.value++;
      }
    };

    const changeStore = () => {
      
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
        
        const shiftData = {
          store_id: selectedStore.value.id,
          year: currentYear.value,
          month: currentMonth.value,
          status: 'draft',
        };

        await store.dispatch('shift/createShift', shiftData);
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
        
        await createEmptyShift();
        
        const params = {
          store_id: selectedStore.value.id,
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
          detail: "ポップアップがブロックされています。",
          life: 3000,
        });
        return;
      }

      const printContent = generatePrintContent();

      printWindow.document.open();
      printWindow.document.write(printContent);
      printWindow.document.close();

      printWindow.onload = () => {
        printWindow.print();
      };
    };

    const generatePrintContent = () => {
      const storeName = selectedStore.value ? selectedStore.value.name : "";
      const periodLabel = `${currentYear.value}年${currentMonth.value}月`;
      const statusLabel = isShiftConfirmed.value ? "確定" : "下書き";

      return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>シフト表 - ${storeName} ${periodLabel}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .print-header { text-align: center; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h1>シフト表</h1>
            <p>店舗: ${storeName}</p>
            <p>期間: ${periodLabel}</p>
            <p>ステータス: ${statusLabel}</p>
          </div>
          <p>印刷機能は実装中です</p>
        </body>
        </html>
      `;
    };

    const saveShift = async () => {
      if (!currentShift.value || !shiftEditorDialog.date || !shiftEditorDialog.staff) return;

      saving.value = true;

      try {
        const shiftData = {
          shift_id: currentShift.value.id,
          staff_id: shiftEditorDialog.staff.id,
          date: shiftEditorDialog.date,
          is_day_off: shiftEditorDialog.isRestDay,
        };

        if (!shiftEditorDialog.isRestDay) {
          shiftData.start_time = shiftEditorDialog.startTime;
          shiftData.end_time = shiftEditorDialog.endTime;
        }

        await store.dispatch("shift/saveShiftDetail", shiftData);
        await loadShiftData();
        closeShiftEditor();

        toast.add({
          severity: "success",
          summary: "保存完了",
          detail: "シフトを保存しました",
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
      if (!currentShift.value || !shiftEditorDialog.date || !shiftEditorDialog.staff) return;

      saving.value = true;

      try {
        await store.dispatch("shift/deleteShiftDetail", {
          shift_id: currentShift.value.id,
          staff_id: shiftEditorDialog.staff.id,
          date: shiftEditorDialog.date,
        });

        await loadShiftData();
        closeShiftEditor();

        toast.add({
          severity: "success",
          summary: "削除完了",
          detail: "シフトを削除しました",
          life: 3000,
        });
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
      return shifts.value.find(
        (shift) => shift.date === date && shift.staff_id === staffId
      );
    };

    const calculateTotalHours = (staffId) => {
      let totalMinutes = 0;

      const staffShifts = shifts.value.filter(
        (shift) => shift.staff_id === staffId && !shift.is_day_off
      );

      staffShifts.forEach((shift) => {
        const startTime = parseTime(shift.start_time);
        const endTime = parseTime(shift.end_time);

        if (startTime && endTime) {
          let minutes = endTime - startTime;

          if (minutes < 0) {
            minutes += 24 * 60;
          }

          totalMinutes += minutes;
        }
      });

      return (totalMinutes / 60).toFixed(1);
    };

    const parseTime = (timeStr) => {
      if (!timeStr) return null;

      const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
      if (!match) return null;

      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);

      return hours * 60 + minutes;
    };

    const formatTime = (time) => {
      if (!time) return "";

      if (typeof time === "string" && /^\d{2}:\d{2}$/.test(time)) {
        return time;
      }

      return "";
    };

    const fetchStores = async () => {
      try {
        const storeList = await store.dispatch("store/fetchStores");
        stores.value = storeList;
      } catch (error) {
        console.error("店舗データの取得に失敗しました:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "店舗データの取得に失敗しました",
          life: 3000,
        });
      }
    };

    onMounted(async () => {
      await fetchStores();

      const currentUser = store.getters["auth/currentUser"];
      if (currentUser && currentUser.store_id && stores.value.length > 0) {
        selectedStore.value =
          stores.value.find((s) => s.id === currentUser.store_id) ||
          stores.value[0];
        await loadShiftData();
      }
    });

    watch([selectedStore, currentYear, currentMonth], async () => {
      if (selectedStore.value) {
        await loadShiftData();
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
      shiftEditorDialog,
      confirmShiftDialog,
      hasCurrentShift,
      isShiftConfirmed,
      getDeadlineDate,
      getStatusBannerClass,
      getStatusIcon,
      getStatusText,
      getDeadlineInfo,
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
      createEmptyShift,
      generateAutomaticShift,
      regenerateShift,
      printShift,
      saveShift,
      clearShift,
      getShiftForStaff,
      calculateTotalHours,
      formatTime,
    };
  },
};
</script>

<style scoped>
.shift-management {
  padding: 1rem;
}

.shift-status-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  margin-bottom: 1.5rem;
  border-radius: 8px;
  border-left: 4px solid;
}

.status-normal {
  background-color: #f0f9ff;
  border-left-color: #0ea5e9;
  color: #0c4a6e;
}

.status-warning {
  background-color: #fffbeb;
  border-left-color: #f59e0b;
  color: #92400e;
}

.status-urgent {
  background-color: #fef2f2;
  border-left-color: #ef4444;
  color: #991b1b;
}

.status-overdue {
  background-color: #fdf2f8;
  border-left-color: #ec4899;
  color: #831843;
}

.status-confirmed {
  background-color: #f0fdf4;
  border-left-color: #22c55e;
  color: #166534;
}

.status-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.status-main {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
  font-weight: 600;
}

.deadline-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.status-actions {
  display: flex;
  gap: 0.5rem;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.period-selector {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.year-month-selector {
  display: flex;
  align-items: center;
}

.period-label {
  font-size: 1.25rem;
  font-weight: 500;
  margin: 0 0.5rem;
  min-width: 120px;
  text-align: center;
}

.store-selector {
  min-width: 200px;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
}

.loading-text {
  margin-top: 1rem;
  font-size: 1rem;
  color: var(--text-color-secondary);
}

.empty-message {
  margin: 2rem 0;
}

.message-content {
  display: flex;
  align-items: center;
}

.shift-content {
  margin-top: 1.5rem;
}

.shift-calendar {
  background-color: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  border: 2px solid transparent;
  transition: border-color 0.3s;
}

.shift-calendar.edit-mode {
  border-color: var(--primary-color);
}

.shift-calendar.confirmed {
  border-color: var(--green-500);
}

.calendar-header {
  display: flex;
  background-color: var(--surface-100);
  border-bottom: 1px solid var(--surface-border);
  font-weight: 600;
}

.date-header,
.day-header,
.staff-header {
  padding: 0.75rem;
  text-align: center;
  border-right: 1px solid var(--surface-border);
}

.date-header {
  width: 80px;
}

.day-header {
  width: 60px;
}

.staff-header {
  flex: 1;
  min-width: 120px;
}

.calendar-row {
  display: flex;
  border-bottom: 1px solid var(--surface-border);
}

.calendar-row.deadline {
  background-color: #fff7ed;
  border: 2px solid #f97316;
}

.calendar-row.past {
  background-color: #f8f9fa;
  opacity: 0.7;
}

.date-cell,
.day-cell,
.shift-cell {
  padding: 0.75rem;
  text-align: center;
  border-right: 1px solid var(--surface-border);
}

.date-cell {
  width: 80px;
  position: relative;
}

.date-number {
  display: block;
}

.deadline-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  background-color: #f97316;
  color: white;
  font-size: 0.6rem;
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
}

.day-cell {
  width: 60px;
}

.shift-cell {
  flex: 1;
  min-width: 120px;
  transition: background-color 0.2s;
}

.shift-cell.editable {
  cursor: pointer;
}

.shift-cell.editable:hover {
  background-color: var(--surface-hover);
}

.shift-cell.closed-day {
  background-color: var(--surface-50);
}

.shift-time {
  font-weight: 500;
  color: var(--primary-color);
}

.no-shift {
  color: var(--text-color-secondary);
}

.closed-label {
  color: var(--text-color-secondary);
  font-style: italic;
}

.calendar-row.holiday {
  background-color: rgba(255, 240, 245, 0.5);
}

.calendar-row.today {
  background-color: rgba(240, 248, 255, 0.5);
}

.shift-summary {
  margin-top: 1.5rem;
  background-color: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.summary-header {
  display: flex;
  background-color: var(--surface-100);
  border-bottom: 1px solid var(--surface-border);
  font-weight: 600;
}

.empty-header,
.staff-total-header {
  padding: 0.75rem;
  text-align: center;
  border-right: 1px solid var(--surface-border);
}

.empty-header {
  width: 80px;
}

.staff-total-header {
  flex: 1;
  min-width: 120px;
}

.summary-row {
  display: flex;
}

.empty-cell,
.staff-total-cell {
  padding: 0.75rem;
  text-align: center;
  border-right: 1px solid var(--surface-border);
}

.empty-cell {
  width: 80px;
}

.staff-total-cell {
  flex: 1;
  min-width: 120px;
  font-weight: 500;
}

.shift-editor-content {
  padding: 0.5rem 0;
}

.closed-day-message,
.confirmed-shift-message,
.past-date-message {
  margin-bottom: 1rem;
}

.confirm-shift-content {
  padding: 0.5rem 0;
}

.confirmation-details {
  margin-bottom: 1rem;
}

.detail-item {
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.warning-message {
  margin-top: 1rem;
}

@media (max-width: 1200px) {
  .toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .period-selector {
    margin-bottom: 1rem;
    width: 100%;
    justify-content: space-between;
  }

  .action-buttons {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .action-buttons .p-button {
    flex: 1;
  }
}

@media (max-width: 768px) {
  .shift-status-banner {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .status-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .shift-calendar {
    overflow-x: auto;
  }

  .calendar-header,
  .calendar-row,
  .summary-header,
  .summary-row {
    min-width: 600px;
  }

  .period-selector {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .store-selector {
    width: 100%;
  }
}
</style>