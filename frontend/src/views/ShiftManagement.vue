<template>
  <div class="shift-management">
    <h1 class="page-title">シフト管理</h1>

    <div class="toolbar">
      <div class="period-selector">
        <div class="year-month-selector">
          <Button
            icon="pi pi-chevron-left"
            class="p-button-rounded p-button-text"
            @click="previousMonth"
            :disabled="loading"
          />
          <span class="period-label"
            >{{ currentYear }}年 {{ currentMonth }}月</span
          >
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
          label="新規シフト作成"
          icon="pi pi-plus"
          class="p-button-primary"
          @click="createNewShift"
          :disabled="loading || !selectedStore || hasCurrentShift"
        />
        <Button
          label="シフト確定"
          icon="pi pi-check"
          class="p-button-success ml-2"
          @click="confirmShift"
          :disabled="loading || !hasCurrentShift || isShiftConfirmed"
        />
        <Button
          label="自動シフト生成"
          icon="pi pi-cog"
          class="p-button-secondary ml-2"
          @click="generateAutomaticShift"
          :disabled="loading || !hasCurrentShift || isShiftConfirmed"
        />
        <Button
          label="印刷"
          icon="pi pi-print"
          class="p-button-outlined ml-2"
          @click="printShift"
          :disabled="loading || !hasCurrentShift"
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
          <span
            >選択した期間のシフトはまだ作成されていません。「新規シフト作成」ボタンをクリックしてシフトを作成してください。</span
          >
        </div>
      </Message>
    </div>

    <div v-else class="shift-content">
      <!-- シフトステータスインジケーター -->
      <div
        :class="[
          'shift-status',
          { confirmed: isShiftConfirmed, draft: !isShiftConfirmed },
        ]"
      >
        <i
          :class="['pi', isShiftConfirmed ? 'pi-check-circle' : 'pi-file-edit']"
        ></i>
        <span>{{ isShiftConfirmed ? "確定済み" : "下書き" }}</span>
      </div>

      <!-- シフト表示部分 -->
      <div class="shift-calendar">
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
            { holiday: day.isHoliday, today: day.isToday },
          ]"
        >
          <div class="date-cell">{{ day.day }}</div>
          <div class="day-cell">{{ day.dayOfWeekLabel }}</div>
          <div
            v-for="staff in staffList"
            :key="`${day.date}-${staff.id}`"
            class="shift-cell"
            @click="openShiftEditor(day, staff)"
            :class="{ 'closed-day': day.isClosed }"
          >
            <template v-if="!day.isClosed">
              <div
                v-if="getShiftForStaff(day.date, staff.id)"
                class="shift-time"
              >
                {{
                  formatTime(getShiftForStaff(day.date, staff.id).start_time)
                }}
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

      <!-- 合計時間表示 -->
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

    <!-- シフト編集ダイアログ -->
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
              <span
                >この日は店舗の休業日です。シフトを設定することはできません。</span
              >
            </div>
          </Message>
        </div>
        <div
          v-else-if="shiftEditorDialog.isConfirmed"
          class="confirmed-shift-message"
        >
          <Message severity="warn">
            <div class="message-content">
              <i class="pi pi-exclamation-triangle mr-2"></i>
              <span
                >シフトは確定済みです。変更するには、シフトの確定を解除してください。</span
              >
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

          <div
            v-if="shiftEditorDialog.preferredTime"
            class="staff-preference-info"
          >
            <div class="preference-label">スタッフの希望時間:</div>
            <div class="preference-time">
              {{ shiftEditorDialog.preferredTime }}
            </div>
          </div>

          <div
            v-if="shiftEditorDialog.dayOffRequest"
            class="day-off-request-info"
          >
            <div
              :class="[
                'request-status',
                getRequestStatusClass(shiftEditorDialog.dayOffRequest.status),
              ]"
            >
              休み希望:
              {{
                getRequestStatusLabel(shiftEditorDialog.dayOffRequest.status)
              }}
            </div>
            <div class="request-reason">
              理由: {{ shiftEditorDialog.dayOffRequest.reason || "未指定" }}
            </div>
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
          :disabled="shiftEditorDialog.isRestDay ? false : !isValidShiftTime()"
        />
      </template>
    </Dialog>

    <!-- 自動シフト生成設定ダイアログ -->
    <Dialog
      v-model:visible="automaticShiftDialog.visible"
      header="自動シフト生成"
      :modal="true"
      class="p-fluid"
      :style="{ width: '550px' }"
    >
      <div class="automatic-shift-settings">
        <div class="field">
          <h3>設定オプション</h3>
          <div class="p-field-checkbox mt-3">
            <Checkbox
              id="respect-preferences"
              v-model="automaticShiftDialog.respectPreferences"
              binary
            />
            <label for="respect-preferences" class="ml-2"
              >スタッフの希望時間を考慮する</label
            >
          </div>

          <div class="p-field-checkbox mt-2">
            <Checkbox
              id="respect-day-off"
              v-model="automaticShiftDialog.respectDayOff"
              binary
            />
            <label for="respect-day-off" class="ml-2"
              >スタッフの休み希望を考慮する</label
            >
          </div>

          <div class="p-field-checkbox mt-2">
            <Checkbox
              id="balance-hours"
              v-model="automaticShiftDialog.balanceHours"
              binary
            />
            <label for="balance-hours" class="ml-2"
              >スタッフ間の勤務時間を平準化する</label
            >
          </div>
        </div>

        <div class="field mt-4">
          <h3>対象期間</h3>
          <div class="date-range-selector">
            <div class="range-option">
              <RadioButton
                id="whole-month"
                v-model="automaticShiftDialog.periodType"
                value="whole"
                name="period-type"
              />
              <label for="whole-month" class="ml-2">月全体</label>
            </div>

            <div class="range-option">
              <RadioButton
                id="date-range"
                v-model="automaticShiftDialog.periodType"
                value="range"
                name="period-type"
              />
              <label for="date-range" class="ml-2">期間指定</label>
            </div>
          </div>

          <div
            v-if="automaticShiftDialog.periodType === 'range'"
            class="date-range-inputs mt-2"
          >
            <div class="field">
              <label for="start-date">開始日</label>
              <Calendar
                id="start-date"
                v-model="automaticShiftDialog.startDate"
                dateFormat="yy-mm-dd"
                :minDate="getMonthStartDate()"
                :maxDate="getMonthEndDate()"
                showIcon
              />
            </div>

            <div class="field">
              <label for="end-date">終了日</label>
              <Calendar
                id="end-date"
                v-model="automaticShiftDialog.endDate"
                dateFormat="yy-mm-dd"
                :minDate="automaticShiftDialog.startDate || getMonthStartDate()"
                :maxDate="getMonthEndDate()"
                showIcon
              />
            </div>
          </div>
        </div>

        <div class="field mt-4">
          <h3>生成オプション</h3>
          <div class="p-field-checkbox mt-2">
            <Checkbox
              id="clear-existing"
              v-model="automaticShiftDialog.clearExisting"
              binary
            />
            <label for="clear-existing" class="ml-2"
              >既存のシフトをクリアして新規作成</label
            >
          </div>
        </div>
      </div>

      <template #footer>
        <Button
          label="キャンセル"
          icon="pi pi-times"
          class="p-button-text"
          @click="automaticShiftDialog.visible = false"
        />
        <Button
          label="シフト自動生成"
          icon="pi pi-cog"
          class="p-button-primary"
          @click="executeAutomaticShiftGeneration"
          :loading="automaticShiftDialog.processing"
          :disabled="
            automaticShiftDialog.periodType === 'range' &&
            (!automaticShiftDialog.startDate || !automaticShiftDialog.endDate)
          "
        />
      </template>
    </Dialog>

    <!-- シフト確定確認ダイアログ -->
    <Dialog
      v-model:visible="confirmShiftDialog.visible"
      header="シフト確定の確認"
      :modal="true"
      class="p-fluid"
      :style="{ width: '450px' }"
    >
      <div class="confirm-shift-content">
        <p>
          シフトを確定すると、スタッフに通知が送信され、変更が反映されます。
        </p>
        <p>確定後の変更は、確定を解除してから行う必要があります。</p>
        <p>シフトを確定してもよろしいですか？</p>
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
import Calendar from "primevue/calendar";
import ProgressSpinner from "primevue/progressspinner";
import Message from "primevue/message";
import ConfirmDialog from "primevue/confirmdialog";
import Toast from "primevue/toast";
import Checkbox from "primevue/checkbox";
import RadioButton from "primevue/radiobutton";
import { formatDateToJP, getDayOfWeekJP } from "@/utils/date";

export default {
  name: "ShiftManagement",
  components: {
    InputMask,
    Calendar,
    ProgressSpinner,
    Message,
    ConfirmDialog,
    Toast,
    Checkbox,
    RadioButton,
  },
  setup() {
    const store = useStore();
    const toast = useToast();
    const confirm = useConfirm();

    // 状態変数
    const loading = ref(false);
    const saving = ref(false);
    const currentYear = ref(new Date().getFullYear());
    const currentMonth = ref(new Date().getMonth() + 1);
    const selectedStore = ref(null);
    const stores = ref([]);
    const staffList = ref([]);
    const shifts = ref([]);
    const daysInMonth = ref([]);
    const currentShift = ref(null);

    // シフト編集ダイアログの状態
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
      hasShift: false,
      preferredTime: null,
      dayOffRequest: null,
    });

    // 自動シフト生成ダイアログの状態
    const automaticShiftDialog = reactive({
      visible: false,
      periodType: "whole", // 'whole' or 'range'
      startDate: null,
      endDate: null,
      respectPreferences: true,
      respectDayOff: true,
      balanceHours: true,
      clearExisting: false,
      processing: false,
    });

    // シフト確定確認ダイアログの状態
    const confirmShiftDialog = reactive({
      visible: false,
      processing: false,
    });

    // 計算プロパティ
    const hasCurrentShift = computed(() => {
      return currentShift.value !== null;
    });

    const isShiftConfirmed = computed(() => {
      return currentShift.value && currentShift.value.status === "confirmed";
    });

    // 初期化
    onMounted(async () => {
      await fetchStores();

      // ログインユーザーの店舗情報をもとに初期店舗を選択
      const currentUser = store.getters["auth/currentUser"];
      if (currentUser && currentUser.store_id && stores.value.length > 0) {
        selectedStore.value =
          stores.value.find((s) => s.id === currentUser.store_id) ||
          stores.value[0];
        await loadShiftData();
      }
    });

    // 店舗選択や表示月の変更を監視
    watch([selectedStore, currentYear, currentMonth], async () => {
      if (selectedStore.value) {
        await loadShiftData();
      }
    });

    // 店舗データの取得
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

    // シフトデータの読み込み
    const loadShiftData = async () => {
      if (!selectedStore.value) return;

      loading.value = true;

      try {
        // スタッフ一覧の取得
        const staffData = await store.dispatch(
          "staff/fetchStaff",
          selectedStore.value.id
        );
        staffList.value = staffData;

        // 対象月のシフト取得
        const shiftData = await store.dispatch("shift/fetchShifts", {
          store_id: selectedStore.value.id,
          year: currentYear.value,
          month: currentMonth.value,
        });

        // 対象月のシフトがある場合
        if (shiftData && shiftData.length > 0) {
          currentShift.value = shiftData[0];

          // シフト詳細データの取得
          const shiftDetails = await store.dispatch(
            "shift/fetchShiftDetails",
            currentShift.value.id
          );
          shifts.value = shiftDetails;
        } else {
          currentShift.value = null;
          shifts.value = [];
        }

        // 対象月の日付データを生成
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

    // 月の日付データを生成
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
        const dayOfWeekLabel = getDayOfWeekJP(dayOfWeek);

        // 休業日かどうかのチェック
        const isClosed = checkIfDayClosed(date, dayOfWeek);

        days.push({
          date,
          day,
          dayOfWeek,
          dayOfWeekLabel,
          isHoliday: dayOfWeek === 0 || dayOfWeek === 6, // 日曜・土曜を休日とする
          isClosed,
          isToday:
            today.getFullYear() === year &&
            today.getMonth() + 1 === month &&
            today.getDate() === day,
        });
      }

      daysInMonth.value = days;
    };

    // 休業日かどうかをチェック
    const checkIfDayClosed = (date, dayOfWeek) => {
      // 祝日や特別休業日の場合に true を返す
      // ここでは簡略化のため、日曜日のみ休業日とする
      return dayOfWeek === 0;
    };

    // 前月に移動
    const previousMonth = () => {
      if (currentMonth.value === 1) {
        currentYear.value--;
        currentMonth.value = 12;
      } else {
        currentMonth.value--;
      }
    };

    // 翌月に移動
    const nextMonth = () => {
      if (currentMonth.value === 12) {
        currentYear.value++;
        currentMonth.value = 1;
      } else {
        currentMonth.value++;
      }
    };

    // 店舗を変更
    const changeStore = () => {
      // loadShiftData は監視関数で自動的に呼び出される
    };

    // 新規シフト作成
    const createNewShift = async () => {
      if (!selectedStore.value) return;

      loading.value = true;

      try {
        // 新規シフトデータ作成
        const shiftData = {
          store_id: selectedStore.value.id,
          year: currentYear.value,
          month: currentMonth.value,
          status: "draft",
        };

        const createdShift = await store.dispatch(
          "shift/createShift",
          shiftData
        );

        toast.add({
          severity: "success",
          summary: "作成完了",
          detail: "シフトを作成しました",
          life: 3000,
        });

        // シフトデータを再読み込み
        await loadShiftData();
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

    // シフト確定ダイアログの表示
    const confirmShift = () => {
      if (!hasCurrentShift.value || isShiftConfirmed.value) return;

      confirmShiftDialog.visible = true;
    };

    // シフト確定の実行
    const executeShiftConfirmation = async () => {
      if (!currentShift.value) return;

      confirmShiftDialog.processing = true;

      try {
        await store.dispatch("shift/confirmShift", currentShift.value.id);

        // シフトデータを再読み込み
        await loadShiftData();

        confirmShiftDialog.visible = false;

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

    // 自動シフト生成ダイアログの表示
    const generateAutomaticShift = () => {
      if (!hasCurrentShift.value || isShiftConfirmed.value) return;

      // ダイアログの初期化
      automaticShiftDialog.periodType = "whole";
      automaticShiftDialog.startDate = getMonthStartDate();
      automaticShiftDialog.endDate = getMonthEndDate();
      automaticShiftDialog.respectPreferences = true;
      automaticShiftDialog.respectDayOff = true;
      automaticShiftDialog.balanceHours = true;
      automaticShiftDialog.clearExisting = false;
      automaticShiftDialog.visible = true;
    };

    // 自動シフト生成の実行
    const executeAutomaticShiftGeneration = async () => {
      if (!currentShift.value) return;

      automaticShiftDialog.processing = true;

      try {
        // 期間の設定
        const startDate =
          automaticShiftDialog.periodType === "whole"
            ? getMonthStartDate()
            : formatDate(automaticShiftDialog.startDate);

        const endDate =
          automaticShiftDialog.periodType === "whole"
            ? getMonthEndDate()
            : formatDate(automaticShiftDialog.endDate);

        // 自動シフト生成のパラメータ
        const params = {
          shift_id: currentShift.value.id,
          start_date: startDate,
          end_date: endDate,
          respect_preferences: automaticShiftDialog.respectPreferences,
          respect_day_off: automaticShiftDialog.respectDayOff,
          balance_hours: automaticShiftDialog.balanceHours,
          clear_existing: automaticShiftDialog.clearExisting,
        };

        await store.dispatch("shift/generateAutomaticShift", params);

        // シフトデータを再読み込み
        await loadShiftData();

        automaticShiftDialog.visible = false;

        toast.add({
          severity: "success",
          summary: "生成完了",
          detail: "自動シフトを生成しました",
          life: 3000,
        });
      } catch (error) {
        console.error("自動シフト生成エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "自動シフトの生成に失敗しました",
          life: 3000,
        });
      } finally {
        automaticShiftDialog.processing = false;
      }
    };

    // シフト印刷
    const printShift = () => {
      if (!hasCurrentShift.value) return;

      // 印刷用ウィンドウを開く
      const printWindow = window.open("", "_blank");

      if (!printWindow) {
        toast.add({
          severity: "error",
          summary: "エラー",
          detail:
            "ポップアップがブロックされています。ブラウザの設定を確認してください。",
          life: 3000,
        });
        return;
      }

      // 印刷用HTML生成
      const printContent = generatePrintContent();

      printWindow.document.open();
      printWindow.document.write(printContent);
      printWindow.document.close();

      // 読み込み完了後に印刷
      printWindow.onload = () => {
        printWindow.print();
      };
    };

    // 印刷用コンテンツの生成
    const generatePrintContent = () => {
      const storeName = selectedStore.value ? selectedStore.value.name : "";
      const periodLabel = `${currentYear.value}年${currentMonth.value}月`;
      const statusLabel = isShiftConfirmed.value ? "確定" : "下書き";

      // 印刷用スタイルシート
      const styles = `
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
          }
          .print-header {
            text-align: center;
            margin-bottom: 20px;
          }
          .print-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .print-info {
            font-size: 14px;
            margin-bottom: 5px;
          }
          .print-status {
            font-size: 14px;
            font-weight: bold;
            padding: 5px 10px;
            display: inline-block;
            margin-top: 5px;
          }
          .status-confirmed {
            background-color: #d4edda;
            color: #155724;
          }
          .status-draft {
            background-color: #fff3cd;
            color: #856404;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: center;
          }
          th {
            background-color: #f2f2f2;
          }
          .weekend {
            background-color: #f8f9fa;
          }
          .holiday {
            background-color: #ffe6e6;
          }
          .today {
            background-color: #e6f7ff;
          }
          .closed-day {
            background-color: #f8f9fa;
            color: #999;
          }
          .print-footer {
            margin-top: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
        </style>
      `;

      // テーブルヘッダーの生成
      let tableHeader = `
        <tr>
          <th>日付</th>
          <th>曜日</th>
      `;

      // スタッフ列のヘッダー
      staffList.value.forEach((staff) => {
        tableHeader += `<th>${staff.last_name} ${staff.first_name}</th>`;
      });

      tableHeader += "</tr>";

      // テーブル行の生成
      let tableRows = "";

      daysInMonth.value.forEach((day) => {
        const rowClass = day.isHoliday ? "holiday" : day.isToday ? "today" : "";

        tableRows += `
          <tr class="${rowClass}">
            <td>${day.day}</td>
            <td>${day.dayOfWeekLabel}</td>
        `;

        // スタッフごとのシフト
        staffList.value.forEach((staff) => {
          const shift = getShiftForStaff(day.date, staff.id);
          const cellClass = day.isClosed ? "closed-day" : "";

          if (day.isClosed) {
            tableRows += `<td class="${cellClass}">休業日</td>`;
          } else if (shift) {
            tableRows += `<td>${formatTime(shift.start_time)} - ${formatTime(
              shift.end_time
            )}</td>`;
          } else {
            tableRows += `<td>-</td>`;
          }
        });

        tableRows += "</tr>";
      });

      // 合計時間行の生成
      let totalRow = `
        <tr>
          <th colspan="2">合計時間</th>
      `;

      staffList.value.forEach((staff) => {
        totalRow += `<th>${calculateTotalHours(staff.id)}時間</th>`;
      });

      totalRow += "</tr>";

      // 完全なHTML
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>シフト表 - ${storeName} ${periodLabel}</title>
          ${styles}
        </head>
        <body>
          <div class="print-header">
            <div class="print-title">シフト表</div>
            <div class="print-info">店舗: ${storeName}</div>
            <div class="print-info">期間: ${periodLabel}</div>
            <div class="print-status status-${
              isShiftConfirmed.value ? "confirmed" : "draft"
            }">
              ${statusLabel}
            </div>
          </div>
          
          <table>
            <thead>
              ${tableHeader}
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
            <tfoot>
              ${totalRow}
            </tfoot>
          </table>
          
          <div class="print-footer">
            出力日時: ${new Date().toLocaleString()}
          </div>
        </body>
        </html>
      `;
    };

    // シフト編集ダイアログを開く
    const openShiftEditor = async (day, staff) => {
      // 確定済みシフトは編集不可（管理者のみ）
      const isAdmin = store.getters["auth/isAdmin"];
      if (isShiftConfirmed.value && !isAdmin) return;

      // 現在のシフトを取得
      const shift = getShiftForStaff(day.date, staff.id);

      // スタッフの希望シフト
      const dayOfWeek = day.dayOfWeek;
      const preference = await getStaffPreference(staff.id, dayOfWeek);

      // 休み希望
      const dayOffRequest = await getStaffDayOffRequest(staff.id, day.date);

      // ダイアログ設定
      shiftEditorDialog.title = `${staff.last_name} ${
        staff.first_name
      } - ${formatDateToJP(day.date)}`;
      shiftEditorDialog.date = day.date;
      shiftEditorDialog.staff = staff;
      shiftEditorDialog.isClosed = day.isClosed;
      shiftEditorDialog.isConfirmed = isShiftConfirmed.value;

      if (shift) {
        shiftEditorDialog.startTime = shift.start_time;
        shiftEditorDialog.endTime = shift.end_time;
        shiftEditorDialog.isRestDay = shift.is_day_off;
        shiftEditorDialog.hasShift = true;
      } else {
        // 新規シフト
        shiftEditorDialog.startTime =
          preference && preference.preferred_start_time
            ? preference.preferred_start_time
            : "09:00";
        shiftEditorDialog.endTime =
          preference && preference.preferred_end_time
            ? preference.preferred_end_time
            : "18:00";
        shiftEditorDialog.isRestDay = false;
        shiftEditorDialog.hasShift = false;
      }

      // 希望シフト情報
      if (
        preference &&
        preference.available &&
        preference.preferred_start_time &&
        preference.preferred_end_time
      ) {
        shiftEditorDialog.preferredTime = `${preference.preferred_start_time} - ${preference.preferred_end_time}`;
      } else {
        shiftEditorDialog.preferredTime = null;
      }

      // 休み希望情報
      shiftEditorDialog.dayOffRequest = dayOffRequest;

      shiftEditorDialog.visible = true;
    };

    // シフト編集ダイアログを閉じる
    const closeShiftEditor = () => {
      shiftEditorDialog.visible = false;
    };

    // シフトを保存
    const saveShift = async () => {
      if (
        !currentShift.value ||
        !shiftEditorDialog.date ||
        !shiftEditorDialog.staff
      )
        return;

      saving.value = true;

      try {
        const shiftData = {
          shift_id: currentShift.value.id,
          staff_id: shiftEditorDialog.staff.id,
          date: shiftEditorDialog.date,
          is_day_off: shiftEditorDialog.isRestDay,
        };

        // 休日でない場合は時間を設定
        if (!shiftEditorDialog.isRestDay) {
          shiftData.start_time = shiftEditorDialog.startTime;
          shiftData.end_time = shiftEditorDialog.endTime;
        }

        await store.dispatch("shift/saveShiftDetail", shiftData);

        // シフトデータを再読み込み
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

    // シフトをクリア
    const clearShift = async () => {
      if (
        !currentShift.value ||
        !shiftEditorDialog.date ||
        !shiftEditorDialog.staff
      )
        return;

      saving.value = true;

      try {
        await store.dispatch("shift/deleteShiftDetail", {
          shift_id: currentShift.value.id,
          staff_id: shiftEditorDialog.staff.id,
          date: shiftEditorDialog.date,
        });

        // シフトデータを再読み込み
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

    // スタッフの特定日のシフトを取得
    const getShiftForStaff = (date, staffId) => {
      return shifts.value.find(
        (shift) => shift.date === date && shift.staff_id === staffId
      );
    };

    // スタッフの曜日別希望シフトを取得
    const getStaffPreference = async (staffId, dayOfWeek) => {
      try {
        const preferences = await store.dispatch(
          "staff/fetchStaffPreferences",
          staffId
        );
        return preferences.find((p) => p.day_of_week === dayOfWeek);
      } catch (error) {
        console.error("スタッフの希望シフト取得エラー:", error);
        return null;
      }
    };

    // スタッフの休み希望を取得
    const getStaffDayOffRequest = async (staffId, date) => {
      try {
        const requests = await store.dispatch(
          "staff/fetchStaffDayOffRequests",
          {
            staff_id: staffId,
            date: date,
          }
        );

        return requests.length > 0 ? requests[0] : null;
      } catch (error) {
        console.error("スタッフの休み希望取得エラー:", error);
        return null;
      }
    };

    // スタッフの月間合計時間を計算
    const calculateTotalHours = (staffId) => {
      let totalMinutes = 0;

      // スタッフのシフトを取得
      const staffShifts = shifts.value.filter(
        (shift) => shift.staff_id === staffId && !shift.is_day_off
      );

      // 時間合計を計算
      staffShifts.forEach((shift) => {
        const startTime = parseTime(shift.start_time);
        const endTime = parseTime(shift.end_time);

        if (startTime && endTime) {
          let minutes = endTime - startTime;

          // 24時間表記の場合の調整
          if (minutes < 0) {
            minutes += 24 * 60;
          }

          totalMinutes += minutes;
        }
      });

      // 分から時間に変換（小数点1桁まで）
      return (totalMinutes / 60).toFixed(1);
    };

    // 時間文字列をパース（分単位で返す）
    const parseTime = (timeStr) => {
      if (!timeStr) return null;

      const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
      if (!match) return null;

      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);

      return hours * 60 + minutes;
    };

    // 時間のフォーマット
    const formatTime = (time) => {
      if (!time) return "";

      // 既に HH:MM 形式であれば何もしない
      if (typeof time === "string" && /^\d{2}:\d{2}$/.test(time)) {
        return time;
      }

      return "";
    };

    // 日付のフォーマット
    // 日付フォーマット（YYYY-MM-DD）
    const formatDate = (date) => {
      if (!date) return "";

      // 日付が Date オブジェクトでない場合は変換する
      const d = date instanceof Date ? date : new Date(date);

      // 不正な日付の場合は空文字を返す
      if (isNaN(d.getTime())) return "";

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");

      return `${year}-${month}-${day}`;
    };

    // 月初の日付を取得
    const getMonthStartDate = () => {
      return new Date(currentYear.value, currentMonth.value - 1, 1);
    };

    // 月末の日付を取得
    const getMonthEndDate = () => {
      return new Date(currentYear.value, currentMonth.value, 0);
    };

    // 有効なシフト時間かチェック
    const isValidShiftTime = () => {
      const startTime = shiftEditorDialog.startTime;
      const endTime = shiftEditorDialog.endTime;

      return (
        startTime &&
        endTime &&
        /^\d{2}:\d{2}$/.test(startTime) &&
        /^\d{2}:\d{2}$/.test(endTime)
      );
    };

    // 休み希望のステータスラベルを取得
    const getRequestStatusLabel = (status) => {
      const statusMap = {
        pending: "保留中",
        approved: "承認済み",
        rejected: "拒否",
      };

      return statusMap[status] || status;
    };

    // 休み希望のステータスクラスを取得
    const getRequestStatusClass = (status) => {
      const classMap = {
        pending: "status-pending",
        approved: "status-approved",
        rejected: "status-rejected",
      };

      return classMap[status] || "";
    };

    // 郵便番号検索
    const searchWithZipCode = async (zipCode) => {
      if (!zipCode || !/^\d{7}$/.test(zipCode)) {
        toast.add({
          severity: "warn",
          summary: "形式エラー",
          detail: "郵便番号はハイフンなしの7桁の数字で入力してください",
          life: 3000,
        });
        return null;
      }

      try {
        const response = await fetch(
          `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zipCode}`
        );
        const data = await response.json();

        if (data.results && data.results.length > 0) {
          const result = data.results[0];
          return {
            prefecture: result.address1,
            city: result.address2,
            address: result.address3,
            fullAddress: `${result.address1}${result.address2}${result.address3}`,
          };
        }

        return null;
      } catch (error) {
        console.error("郵便番号検索エラー:", error);
        return null;
      }
    };

    return {
      // 状態変数
      loading,
      saving,
      currentYear,
      currentMonth,
      selectedStore,
      stores,
      staffList,
      shifts,
      daysInMonth,
      currentShift,
      shiftEditorDialog,
      automaticShiftDialog,
      confirmShiftDialog,

      // 計算プロパティ
      hasCurrentShift,
      isShiftConfirmed,

      // メソッド
      previousMonth,
      nextMonth,
      changeStore,
      createNewShift,
      confirmShift,
      executeShiftConfirmation,
      generateAutomaticShift,
      executeAutomaticShiftGeneration,
      printShift,
      openShiftEditor,
      closeShiftEditor,
      saveShift,
      clearShift,
      getShiftForStaff,
      calculateTotalHours,
      formatTime,
      formatDate,
      getMonthStartDate,
      getMonthEndDate,
      isValidShiftTime,
      getRequestStatusLabel,
      getRequestStatusClass,
      searchWithZipCode,
    };
  },
};
</script>

<style scoped>
.shift-management {
  padding: 1rem;
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

.shift-status {
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.shift-status.confirmed {
  background-color: var(--green-100);
  color: var(--green-700);
}

.shift-status.draft {
  background-color: var(--yellow-100);
  color: var(--yellow-700);
}

.shift-status i {
  margin-right: 0.5rem;
}

.shift-calendar {
  background-color: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
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
  width: 60px;
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

.date-cell,
.day-cell,
.shift-cell {
  padding: 0.75rem;
  text-align: center;
  border-right: 1px solid var(--surface-border);
}

.date-cell {
  width: 60px;
}

.day-cell {
  width: 60px;
}

.shift-cell {
  flex: 1;
  min-width: 120px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.shift-cell:hover {
  background-color: var(--surface-hover);
}

.shift-cell.closed-day {
  background-color: var(--surface-50);
  cursor: default;
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
  width: 60px;
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
  width: 60px;
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
.confirmed-shift-message {
  margin-bottom: 1rem;
}

.staff-preference-info,
.day-off-request-info {
  margin-top: 1rem;
  padding: 0.75rem;
  background-color: var(--surface-50);
  border-radius: 4px;
}

.preference-label,
.request-status {
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.request-status {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  display: inline-block;
}

.request-status.status-pending {
  background-color: var(--yellow-100);
  color: var(--yellow-700);
}

.request-status.status-approved {
  background-color: var(--green-100);
  color: var(--green-700);
}

.request-status.status-rejected {
  background-color: var(--red-100);
  color: var(--red-700);
}

.request-reason {
  margin-top: 0.5rem;
  font-size: 0.875rem;
}

.automatic-shift-settings {
  padding: 0.5rem 0;
}

.date-range-selector {
  margin-top: 0.5rem;
}

.range-option {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
}

.date-range-inputs {
  display: flex;
  gap: 1rem;
}

.confirm-shift-content {
  padding: 0.5rem 0;
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
    margin-left: 0 !important;
    flex: 1;
  }
}

@media (max-width: 768px) {
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

  .date-range-inputs {
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>