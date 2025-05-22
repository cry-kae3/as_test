<template>
  <div class="staff-management">
    <h1 class="page-title">スタッフ管理</h1>

    <div class="toolbar">
      <div class="search-container">
        <span class="p-input-icon-left">
          <i class="pi pi-search" />
          <InputText v-model="filters.global.value" placeholder="検索..." />
        </span>
      </div>

      <div class="actions">
        <Button
          label="新規スタッフ"
          icon="pi pi-plus"
          class="p-button-primary"
          @click="openNew"
        />
      </div>
    </div>

    <DataTable
      :value="staffList"
      :loading="loading"
      dataKey="id"
      :paginator="true"
      :rows="10"
      :rowsPerPageOptions="[5, 10, 25, 50]"
      :filters="filters"
      filterDisplay="menu"
      :globalFilterFields="[
        'last_name',
        'first_name',
        'furigana',
        'position',
        'employment_type',
      ]"
      class="mt-3 p-datatable-sm"
      stripedRows
      removableSort
      resizableColumns
      columnResizeMode="fit"
    >
      <template #empty>
        <div class="text-center py-4">スタッフが見つかりません</div>
      </template>
      <template #loading>
        <div class="text-center py-4">データを読み込み中...</div>
      </template>

      <Column field="id" header="ID" sortable style="width: 4rem"></Column>

      <Column field="last_name" header="姓" sortable style="min-width: 6rem">
        <template #filter="{ filterModel, filterCallback }">
          <InputText v-model="filterModel.value" @input="filterCallback()" />
        </template>
      </Column>

      <Column field="first_name" header="名" sortable style="min-width: 6rem">
        <template #filter="{ filterModel, filterCallback }">
          <InputText v-model="filterModel.value" @input="filterCallback()" />
        </template>
      </Column>

      <Column
        field="furigana"
        header="フリガナ"
        sortable
        style="min-width: 8rem"
      >
        <template #filter="{ filterModel, filterCallback }">
          <InputText v-model="filterModel.value" @input="filterCallback()" />
        </template>
      </Column>

      <Column field="gender" header="性別" sortable style="min-width: 5rem">
      </Column>

      <Column field="position" header="役職" sortable style="min-width: 7rem">
        <template #filter="{ filterModel, filterCallback }">
          <Dropdown
            v-model="filterModel.value"
            @change="filterCallback()"
            :options="positionOptions"
            placeholder="全て"
            class="p-column-filter"
          />
        </template>
      </Column>

      <Column
        field="employment_type"
        header="雇用形態"
        sortable
        style="min-width: 7rem"
      >
        <template #filter="{ filterModel, filterCallback }">
          <Dropdown
            v-model="filterModel.value"
            @change="filterCallback()"
            :options="employmentTypeOptions"
            placeholder="全て"
            class="p-column-filter"
          />
        </template>
      </Column>
      <Column header="希望シフト" style="min-width: 12rem">
        <template #body="{ data }">
          <div v-if="data.dayPreferences" class="day-preferences-summary">
            <span
              v-for="day in daysOfWeek"
              :key="day.value"
              :class="{
                'day-unavailable': isDayUnavailable(
                  data.dayPreferences,
                  day.value
                ),
              }"
              class="day-marker"
            >
              {{ day.label }}
            </span>
          </div>

          <div
            v-if="data.dayPreferences && data.dayPreferences.length > 0"
            class="day-time-container"
          >
            <div
              v-for="pref in getPreferencesWithTimes(data.dayPreferences)"
              :key="pref.day_of_week"
              class="day-time"
            >
              {{ getDayOfWeekLabel(pref.day_of_week) }}:
              {{ formatTime(pref.preferred_start_time) }}-{{
                formatTime(pref.preferred_end_time)
              }}
            </div>
          </div>
        </template>
      </Column>

      <Column header="休み希望日" style="min-width: 12rem">
        <template #body="{ data }">
          <div
            v-if="data.dayOffRequests && data.dayOffRequests.length > 0"
            class="day-off-requests-summary"
          >
            <Tag
              v-for="(req, index) in formatDayOffRequests(data.dayOffRequests)"
              :key="index"
              :severity="getStatusSeverity(req.status)"
              :value="formatShortDate(req.date)"
              class="day-off-tag"
            />
          </div>
          <span v-else class="no-data">-</span>
        </template>
      </Column>
      <Column
        field="max_hours_per_month"
        header="月間最大"
        sortable
        style="min-width: 6rem"
      >
        <template #body="{ data }">
          {{ data.max_hours_per_month || "-" }}
        </template>
      </Column>

      <Column
        field="min_hours_per_month"
        header="月間最小"
        sortable
        style="min-width: 6rem"
      >
        <template #body="{ data }">
          {{ data.min_hours_per_month || "-" }}
        </template>
      </Column>

      <Column
        field="max_hours_per_day"
        header="日最大"
        sortable
        style="min-width: 5rem"
      >
        <template #body="{ data }">
          {{ data.max_hours_per_day || "-" }}
        </template>
      </Column>

      <Column
        field="max_consecutive_days"
        header="連続最大"
        sortable
        style="min-width: 6rem"
      >
        <template #body="{ data }">
          {{ data.max_consecutive_days || "-" }}
        </template>
      </Column>

      <Column header="操作" style="width: 6rem">
        <template #body="{ data }">
          <div class="action-buttons">
            <Button
              icon="pi pi-pencil"
              class="p-button-rounded p-button-text p-button-plain"
              @click="editStaff(data)"
              title="編集"
            />
            <Button
              icon="pi pi-trash"
              class="p-button-rounded p-button-text p-button-danger"
              @click="confirmDeleteStaff(data)"
              title="削除"
            />
          </div>
        </template>
      </Column>
    </DataTable>

    <Dialog
      v-model:visible="staffDialog.visible"
      :header="staffDialog.isNew ? '新規スタッフ' : 'スタッフ編集'"
      :modal="true"
      class="p-fluid"
      :style="{ width: '750px' }"
    >
      <div class="p-grid p-formgrid">
        <TabView>
          <TabPanel header="基本情報">
            <div class="field">
              <label for="last_name"
                >姓 <span class="required-mark">*</span></label
              >
              <InputText
                id="last_name"
                v-model="staffDialog.staff.last_name"
                :class="{
                  'p-invalid': submitted && !staffDialog.staff.last_name,
                }"
              />
              <small
                v-if="submitted && !staffDialog.staff.last_name"
                class="p-error"
                >姓は必須です</small
              >
            </div>

            <div class="field">
              <label for="first_name"
                >名 <span class="required-mark">*</span></label
              >
              <InputText
                id="first_name"
                v-model="staffDialog.staff.first_name"
                :class="{
                  'p-invalid': submitted && !staffDialog.staff.first_name,
                }"
              />
              <small
                v-if="submitted && !staffDialog.staff.first_name"
                class="p-error"
                >名は必須です</small
              >
            </div>

            <div class="field">
              <label for="furigana">フリガナ</label>
              <InputText id="furigana" v-model="staffDialog.staff.furigana" />
            </div>

            <div class="field">
              <label for="gender">性別</label>
              <Dropdown
                id="gender"
                v-model="staffDialog.staff.gender"
                :options="genderOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="選択してください"
              />
            </div>

            <div class="field">
              <label for="position">役職</label>
              <Dropdown
                id="position"
                v-model="staffDialog.staff.position"
                :options="positionOptions"
                placeholder="選択してください"
              />
            </div>

            <div class="field">
              <label for="employment_type">雇用形態</label>
              <Dropdown
                id="employment_type"
                v-model="staffDialog.staff.employment_type"
                :options="employmentTypeOptions"
                placeholder="選択してください"
              />
            </div>
          </TabPanel>

          <TabPanel header="勤務条件">
            <div class="field">
              <label for="max_hours_per_month">月間最大勤務時間</label>
              <InputNumber
                id="max_hours_per_month"
                v-model="staffDialog.staff.max_hours_per_month"
                suffix=" 時間"
                min="0"
              />
            </div>

            <div class="field">
              <label for="min_hours_per_month">月間最小勤務時間</label>
              <InputNumber
                id="min_hours_per_month"
                v-model="staffDialog.staff.min_hours_per_month"
                suffix=" 時間"
                min="0"
              />
            </div>

            <div class="field">
              <label for="max_hours_per_day">1日の最大勤務時間</label>
              <InputNumber
                id="max_hours_per_day"
                v-model="staffDialog.staff.max_hours_per_day"
                suffix=" 時間"
                min="0"
                max="24"
              />
            </div>

            <div class="field">
              <label for="max_consecutive_days">最大連続勤務日数</label>
              <InputNumber
                id="max_consecutive_days"
                v-model="staffDialog.staff.max_consecutive_days"
                suffix=" 日"
                min="0"
              />
            </div>
          </TabPanel>

          <TabPanel header="希望シフト">
            <div
              v-for="(day, index) in daysOfWeek"
              :key="day.value"
              class="field day-preference"
            >
              <div class="day-header">
                <label>{{ day.label }}曜日</label>
                <div class="availability-toggle">
                  <InputSwitch
                    v-model="staffDialog.dayPreferences[index].available"
                  />
                  <span class="ml-2">{{
                    staffDialog.dayPreferences[index].available
                      ? "勤務可能"
                      : "勤務不可"
                  }}</span>
                </div>
              </div>

              <div
                v-if="staffDialog.dayPreferences[index].available"
                class="time-range"
              >
                <div class="time-input">
                  <label>開始時間</label>
                  <Dropdown
                    v-model="
                      staffDialog.dayPreferences[index].preferred_start_time
                    "
                    :options="timeOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="開始時間を選択"
                    class="w-full"
                  />
                </div>
                <div class="time-input">
                  <label>終了時間</label>
                  <Dropdown
                    v-model="
                      staffDialog.dayPreferences[index].preferred_end_time
                    "
                    :options="timeOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="終了時間を選択"
                    class="w-full"
                  />
                </div>
              </div>

              <div
                v-if="staffDialog.dayPreferences[index].available"
                class="break-time"
              >
                <div class="time-input">
                  <label>休憩開始</label>
                  <Dropdown
                    v-model="staffDialog.dayPreferences[index].break_start_time"
                    :options="timeOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="開始時間を選択"
                    class="w-full"
                  />
                </div>
                <div class="time-input">
                  <label>休憩終了</label>
                  <Dropdown
                    v-model="staffDialog.dayPreferences[index].break_end_time"
                    :options="timeOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="終了時間を選択"
                    class="w-full"
                  />
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="休み希望">
            <div class="field">
              <h4>日付選択</h4>
              <div class="custom-date-picker">
                <div class="date-input-container">
                  <Calendar
                    v-model="selectedDate"
                    dateFormat="yy-mm-dd"
                    placeholder="日付を選択"
                    showIcon
                    class="date-input"
                  />
                  <Button
                    icon="pi pi-plus"
                    class="p-button-sm"
                    @click="addCustomDate"
                    :disabled="!selectedDate"
                  />
                </div>

                <div class="selected-dates-display mt-3">
                  <div
                    v-for="(request, index) in pendingDayOffRequests"
                    :key="index"
                    class="date-tag"
                  >
                    {{ formatDateWithDayOfWeek(request.date) }}
                    <Button
                      icon="pi pi-times"
                      class="p-button-rounded p-button-text p-button-sm p-button-danger"
                      @click="removeCustomDate(index, request)"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div class="selected-dates-container">
              <h4>休み希望日一覧</h4>
              <div
                v-if="staffDialog.dayOffRequests.length === 0"
                class="text-center py-2"
              >
                休み希望日はありません
              </div>
              <ul v-else class="selected-dates-list">
                <li
                  v-for="(request, index) in staffDialog.dayOffRequests"
                  :key="index"
                  class="selected-date-item"
                >
                  <div class="date-info">
                    <span class="date">{{
                      formatDateWithDayOfWeek(request.date)
                    }}</span>
                    <Dropdown
                      v-model="request.reason"
                      :options="breakReasonOptions"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="理由を選択"
                      class="reason-dropdown"
                    />
                  </div>
                  <Button
                    icon="pi pi-trash"
                    class="p-button-rounded p-button-text p-button-danger p-button-sm"
                    @click="removeDayOffRequest(index)"
                  />
                </li>
              </ul>
            </div>
          </TabPanel>
        </TabView>
      </div>

      <template #footer>
        <Button
          label="キャンセル"
          icon="pi pi-times"
          class="p-button-text"
          @click="hideDialog"
        />
        <Button
          label="保存"
          icon="pi pi-check"
          class="p-button-primary"
          @click="saveStaff"
          :loading="saving"
        />
      </template>
    </Dialog>

    <ConfirmDialog></ConfirmDialog>
    <Toast />
  </div>
</template>

<script>
import { ref, reactive, onMounted, computed } from "vue";
import { useStore } from "vuex";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import InputNumber from "primevue/inputnumber";
import InputMask from "primevue/inputmask";
import InputSwitch from "primevue/inputswitch";
import Calendar from "primevue/calendar";
import { FilterMatchMode, FilterOperator } from "primevue/api";
import { formatDateToJP, getDayOfWeekJP } from "@/utils/date";

export default {
  name: "StaffManagement",
  components: {
    InputNumber,
    InputMask,
    InputSwitch,
    Calendar,
  },
  setup() {
    const store = useStore();
    const toast = useToast();
    const confirm = useConfirm();

    const loading = ref(false);
    const saving = ref(false);
    const submitted = ref(false);
    const staffList = ref([]);
    const selectedDate = ref(null);

    const filters = ref({
      global: { value: null, matchMode: FilterMatchMode.CONTAINS },
      last_name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
      first_name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
      furigana: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
      position: { value: null, matchMode: FilterMatchMode.EQUALS },
      employment_type: { value: null, matchMode: FilterMatchMode.EQUALS },
    });

    const generateTimeOptions = () => {
      const options = [];
      for (let hour = 0; hour < 24; hour++) {
        for (let minute of ["00", "30"]) {
          const formattedHour = hour.toString().padStart(2, "0");
          const timeValue = `${formattedHour}:${minute}`;
          options.push({
            label: timeValue,
            value: timeValue,
          });
        }
      }
      return options;
    };

    const timeOptions = ref(generateTimeOptions());
    const staffDialog = reactive({
      visible: false,
      isNew: false,
      staff: {},
      dayPreferences: [],
      dayOffRequests: [],
    });

    const pendingDayOffRequests = computed(() => {
      return staffDialog.dayOffRequests.filter(
        (req) => req.status === "pending" || !req.status
      );
    });

    const effectiveUser = computed(() => store.getters['auth/effectiveUser']);
    const effectiveUserRole = computed(() => store.getters['auth/effectiveUserRole']);

    const editStaff = async (staff) => {
      loading.value = true;

      try {
        const staffDetail = await store.dispatch(
          "staff/fetchStaffById",
          staff.id
        );

        console.log("スタッフ詳細データ:", staffDetail);

        staffDialog.staff = { ...staffDetail };

        if (
          staffDetail.dayPreferences &&
          Array.isArray(staffDetail.dayPreferences) &&
          staffDetail.dayPreferences.length > 0
        ) {
          console.log("既存の希望シフト:", staffDetail.dayPreferences);

          staffDialog.dayPreferences = daysOfWeek.map((day) => {
            const preference = staffDetail.dayPreferences.find(
              (p) => parseInt(p.day_of_week) === parseInt(day.value)
            );

            if (preference) {
              const preferred_start_time = preference.preferred_start_time
                ? String(preference.preferred_start_time).substring(0, 5)
                : "";
              const preferred_end_time = preference.preferred_end_time
                ? String(preference.preferred_end_time).substring(0, 5)
                : "";
              const break_start_time = preference.break_start_time
                ? String(preference.break_start_time).substring(0, 5)
                : "";
              const break_end_time = preference.break_end_time
                ? String(preference.break_end_time).substring(0, 5)
                : "";

              return {
                id: preference.id,
                day_of_week: parseInt(day.value),
                available:
                  preference.available === true ||
                  preference.available === "true",
                preferred_start_time: preferred_start_time,
                preferred_end_time: preferred_end_time,
                break_start_time: break_start_time,
                break_end_time: break_end_time,
              };
            } else {
              return {
                day_of_week: parseInt(day.value),
                available: true,
                preferred_start_time: "",
                preferred_end_time: "",
                break_start_time: "",
                break_end_time: "",
              };
            }
          });
        } else {
          staffDialog.dayPreferences = daysOfWeek.map((day) => ({
            day_of_week: parseInt(day.value),
            available: true,
            preferred_start_time: "",
            preferred_end_time: "",
            break_start_time: "",
            break_end_time: "",
          }));
        }

        console.log("設定された希望シフト:", staffDialog.dayPreferences);

        if (
          staffDetail.dayOffRequests &&
          staffDetail.dayOffRequests.length > 0
        ) {
          staffDialog.dayOffRequests = staffDetail.dayOffRequests.map(
            (request) => ({
              id: request.id,
              date: request.date,
              reason: request.reason || "requested",
              status: request.status || "pending",
            })
          );
        } else {
          staffDialog.dayOffRequests = [];
        }

        staffDialog.isNew = false;
        staffDialog.visible = true;
        submitted.value = false;
      } catch (error) {
        console.error("スタッフ詳細取得エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "スタッフ情報の取得に失敗しました",
          life: 3002,
        });
      } finally {
        loading.value = false;
      }
    };

    const saveStaff = async () => {
      submitted.value = true;

      if (!staffDialog.staff.last_name || !staffDialog.staff.first_name) {
        toast.add({
          severity: "error",
          summary: "入力エラー",
          detail: "姓と名は必須項目です",
          life: 3000,
        });
        return;
      }

      saving.value = true;

      try {
        console.log(
          "保存前のdayPreferences:",
          JSON.stringify(staffDialog.dayPreferences)
        );

        const dayPreferences = staffDialog.dayPreferences.map((day) => {
          const dayPref = {
            day_of_week: parseInt(day.day_of_week, 10),
            available: day.available === true || day.available === "true",
            preferred_start_time: day.preferred_start_time || null,
            preferred_end_time: day.preferred_end_time || null,
            break_start_time: day.break_start_time || null,
            break_end_time: day.break_end_time || null,
          };

          if (day.id) {
            dayPref.id = day.id;
          }

          return dayPref;
        });

        const dayOffRequests = staffDialog.dayOffRequests.map((req) => ({
          date: req.date,
          reason: req.reason || "requested",
          status: req.status || "pending",
          id: req.id,
        }));

        console.log("送信データ:", {
          staff: staffDialog.staff,
          day_preferences: dayPreferences,
          day_off_requests: dayOffRequests,
        });

        let staffData = {
          ...staffDialog.staff,
          day_preferences: dayPreferences,
          day_off_requests: dayOffRequests,
        };

        if (staffDialog.isNew) {
          await store.dispatch("staff/createStaff", staffData);

          toast.add({
            severity: "success",
            summary: "作成完了",
            detail: "スタッフを作成しました",
            life: 3002,
          });
        } else {
          const response = await store.dispatch("staff/updateStaff", {
            id: staffDialog.staff.id,
            staffData: staffData,
          });

          console.log("更新レスポンス:", response);

          toast.add({
            severity: "success",
            summary: "更新完了",
            detail: "スタッフ情報を更新しました",
            life: 3002,
          });
        }

        hideDialog();
        await fetchStaffList();
      } catch (error) {
        console.error("スタッフ保存エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "スタッフの保存に失敗しました",
          life: 3002,
        });
      } finally {
        saving.value = false;
      }
    };

    const formatDayPreferences = (preferences) => {
      if (!preferences || preferences.length === 0) return [];

      console.log("formatDayPreferences input:", preferences);

      const formattedPrefs = [];
      const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];

      for (let i = 0; i < 7; i++) {
        const pref = preferences.find((p) => {
          if (parseInt(p.day_of_week) === i) {
            console.log(`Found day ${i}:`, p);
          }
          return parseInt(p.day_of_week) === i;
        });

        if (pref) {
          if (pref.preferred_start_time) {
            console.log(
              `Day ${i} has time:`,
              pref.preferred_start_time,
              pref.preferred_end_time
            );
          }

          formattedPrefs.push({
            day: dayLabels[i],
            available: pref.available === true || pref.available === "true",
            start_time: pref.preferred_start_time || null,
            end_time: pref.preferred_end_time || null,
          });
        } else {
          formattedPrefs.push({
            day: dayLabels[i],
            available: true,
            start_time: null,
            end_time: null,
          });
        }
      }

      return formattedPrefs;
    };

    const formatDayOffRequests = (requests) => {
      if (!requests || requests.length === 0) return [];

      return requests
        .slice()
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 5);
    };

    const formatShortDate = (dateString) => {
      if (!dateString) return "";

      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;

      return `${date.getMonth() + 1}/${date.getDate()}`;
    };

    const isDayUnavailable = (preferences, dayOfWeek) => {
      if (!preferences || !Array.isArray(preferences)) return false;
      const preference = preferences.find(p => parseInt(p.day_of_week) === parseInt(dayOfWeek));
      return preference && (preference.available === false || preference.available === 'false');
    };

    const getPreferencesWithTimes = (preferences) => {
      if (!preferences || !Array.isArray(preferences)) return [];
      return preferences.filter(p => 
        p.preferred_start_time && 
        p.preferred_end_time && 
        p.available !== false && 
        p.available !== 'false'
      );
    };

    const formatTime = (time) => {
      if (!time) return '';
      if (typeof time === 'string' && time.length >= 5) {
        return time.substring(0, 5);
      }
      return time;
    };

    const addCustomDate = () => {
      if (!selectedDate.value) {
        toast.add({
          severity: "error",
          summary: "入力エラー",
          detail: "日付を選択してください",
          life: 3000,
        });
        return;
      }

      try {
        const formattedDate = formatDate(selectedDate.value);

        const exists = staffDialog.dayOffRequests.some(
          (request) => request.date === formattedDate
        );

        if (!exists) {
          const newRequest = {
            date: formattedDate,
            reason: "requested",
            status: "pending",
          };

          staffDialog.dayOffRequests.push(newRequest);
          selectedDate.value = null;
        } else {
          toast.add({
            severity: "warn",
            summary: "重複",
            detail: "この日付は既に追加されています",
            life: 3000,
          });
        }
      } catch (e) {
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "無効な日付です",
          life: 3000,
        });
      }
    };

    const removeCustomDate = (index, request) => {
      if (request) {
        const realIndex = staffDialog.dayOffRequests.findIndex(
          (req) => req.date === request.date && req.status === "pending"
        );

        if (realIndex !== -1) {
          staffDialog.dayOffRequests.splice(realIndex, 1);
        }
      }
    };

    const daysOfWeek = [
      { value: 0, label: "日" },
      { value: 1, label: "月" },
      { value: 2, label: "火" },
      { value: 3, label: "水" },
      { value: 4, label: "木" },
      { value: 5, label: "金" },
      { value: 6, label: "土" },
    ];

    const genderOptions = [
      { label: "男性", value: "男性" },
      { label: "女性", value: "女性" },
      { label: "その他", value: "その他" },
    ];

    const positionOptions = ["店長", "副店長", "リーダー", "一般スタッフ"];

    const employmentTypeOptions = [
      "正社員",
      "パート",
      "アルバイト",
      "契約社員",
      "業務委託",
    ];

    const breakReasonOptions = [
      { label: "希望休", value: "requested" },
      { label: "私用", value: "personal" },
      { label: "体調不良", value: "sick" },
      { label: "その他", value: "other" },
    ];

    const fetchStaffList = async () => {
      loading.value = true;

      try {
        let storeId = null;
        
        if (effectiveUserRole.value === 'owner' || effectiveUserRole.value === 'staff') {
          storeId = effectiveUser.value?.store_id;
          if (!storeId) {
            console.error("有効なユーザーに店舗IDが設定されていません");
            toast.add({
              severity: "error",
              summary: "エラー",
              detail: "店舗情報が見つかりません",
              life: 3000,
            });
            return;
          }
        }

        const staff = await store.dispatch("staff/fetchStaff", storeId);

        console.log("取得したスタッフ一覧:", staff);

        for (const s of staff) {
          if (s.dayPreferences && s.dayPreferences.length > 0) {
            console.log(`スタッフID ${s.id} の希望シフト:`, s.dayPreferences);
            const hasPreferredTime = s.dayPreferences.some(
              (p) => p.preferred_start_time
            );
            console.log(
              `スタッフID ${s.id} は希望時間を設定済み:`,
              hasPreferredTime
            );
          }
        }

        if (effectiveUserRole.value === 'admin') {
          staffList.value = staff;
        } else {
          staffList.value = staff.filter((s) => s.store_id === storeId);
        }
      } catch (error) {
        console.error("スタッフ一覧取得エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "スタッフ一覧の取得に失敗しました",
          life: 3002,
        });
      } finally {
        loading.value = false;
      }
    };

    const openNew = () => {
      let defaultStoreId = null;
      
      if (effectiveUserRole.value === 'owner' || effectiveUserRole.value === 'staff') {
        defaultStoreId = effectiveUser.value?.store_id || 1;
      } else {
        defaultStoreId = 1;
      }

      staffDialog.staff = {
        store_id: defaultStoreId,
        last_name: "",
        first_name: "",
        furigana: "",
        gender: null,
        position: null,
        employment_type: null,
        max_hours_per_month: null,
        min_hours_per_month: null,
        max_hours_per_day: null,
        max_consecutive_days: null,
      };

      staffDialog.dayPreferences = daysOfWeek.map((day) => ({
        day_of_week: day.value,
        available: true,
        preferred_start_time: "",
        preferred_end_time: "",
        break_start_time: "",
        break_end_time: "",
      }));

      staffDialog.dayOffRequests = [];
      selectedDate.value = null;

      staffDialog.isNew = true;
      staffDialog.visible = true;
      submitted.value = false;
    };

    const confirmDeleteStaff = (staff) => {
      confirm.require({
        message: `${staff.last_name} ${staff.first_name}を削除してもよろしいですか？`,
        header: "スタッフ削除の確認",
        icon: "pi pi-exclamation-triangle",
        acceptClass: "p-button-danger",
        accept: () => deleteStaff(staff),
      });
    };

    const deleteStaff = async (staff) => {
      try {
        await store.dispatch("staff/deleteStaff", staff.id);

        await fetchStaffList();

        toast.add({
          severity: "success",
          summary: "削除完了",
          detail: `${staff.last_name} ${staff.first_name}を削除しました`,
          life: 3002,
        });
      } catch (error) {
        console.error("スタッフ削除エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "スタッフの削除に失敗しました",
          life: 3002,
        });
      }
    };

    const hideDialog = () => {
      staffDialog.visible = false;
      submitted.value = false;
    };

    const removeDayOffRequest = (index) => {
      staffDialog.dayOffRequests.splice(index, 1);
    };

    const getStatusSeverity = (status) => {
      const severityMap = {
        pending: "warning",
        approved: "success",
        rejected: "danger",
      };

      return severityMap[status] || "info";
    };

    const formatDate = (date) => {
      if (!date) return "";

      const d = date instanceof Date ? date : new Date(date);

      if (isNaN(d.getTime())) return "";

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");

      return `${year}-${month}-${day}`;
    };

    const formatDateWithDayOfWeek = (dateString) => {
      if (!dateString) return "";

      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;

      const dayOfWeek = getDayOfWeekJP(date.getDay());
      return `${formatDateToJP(date)} (${dayOfWeek})`;
    };

    const getDayOfWeekLabel = (dayOfWeek) => {
      const day = daysOfWeek.find((d) => d.value === parseInt(dayOfWeek, 10));
      return day ? day.label : "";
    };

    const getBreakReasonLabel = (reasonValue) => {
      const reason = breakReasonOptions.find((r) => r.value === reasonValue);
      return reason ? reason.label : reasonValue;
    };

    onMounted(() => {
      if (timeOptions.value.length === 0) {
        timeOptions.value = generateTimeOptions();
      }

      fetchStaffList();
    });

    return {
      loading,
      saving,
      submitted,
      staffList,
      filters,
      staffDialog,
      selectedDate,
      pendingDayOffRequests,
      daysOfWeek,
      genderOptions,
      positionOptions,
      employmentTypeOptions,
      breakReasonOptions,
      timeOptions,

      openNew,
      editStaff,
      confirmDeleteStaff,
      hideDialog,
      saveStaff,
      removeDayOffRequest,
      addCustomDate,
      removeCustomDate,

      formatDayPreferences,
      formatDayOffRequests,
      formatShortDate,
      getStatusSeverity,
      formatTime,

      formatDate,
      formatDateWithDayOfWeek,
      getDayOfWeekLabel,
      getBreakReasonLabel,

      isDayUnavailable,
      getPreferencesWithTimes,
    };
  },
};
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.search-container {
  flex: 1;
  margin-right: 1rem;
}

.required-mark {
  color: var(--red-500);
}

.day-preferences-summary {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

.day-marker {
  display: inline-block;
  width: 1.5rem;
  height: 1.5rem;
  line-height: 1.5rem;
  text-align: center;
  font-size: 0.75rem;
  border-radius: 3px;
  background-color: #dcfce7;
  color: #15803d;
}

.day-unavailable {
  background-color: #fee2e2;
  color: #b91c1c;
  text-decoration: line-through;
}

.day-time-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.25rem;
}

.day-time {
  background-color: #f1f5f9;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  font-size: 0.7rem;
  white-space: nowrap;
}

.day-off-requests-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.day-time-info {
  font-size: 0.8rem;
  margin-top: 0.5rem;
  color: var(--text-color-secondary);
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.day-off-tag {
  font-size: 0.7rem !important;
  padding: 0.1rem 0.3rem !important;
}

.no-data {
  color: var(--text-color-secondary);
}

.day-preference {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--surface-border);
}

.day-preference:last-child {
  border-bottom: none;
}

.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.availability-toggle {
  display: flex;
  align-items: center;
}

.time-range,
.break-time {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
}

.time-input {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.time-input label {
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
}

.selected-dates-container {
  margin-top: 1rem;
}

.selected-dates-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.selected-date-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  border-bottom: 1px solid var(--surface-border);
}

.date-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.reason-dropdown {
  width: 120px;
}

.custom-date-picker {
  padding: 1rem;
  background-color: var(--surface-ground);
  border-radius: 4px;
}

.date-input-container {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.date-input {
  flex: 1;
}

.selected-dates-display {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
}

.date-tag {
  background-color: var(--surface-200);
  padding: 0.3rem 0.5rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.action-buttons {
  display: flex;
  gap: 0.25rem;
  justify-content: center;
}

.ml-2 {
  margin-left: 0.5rem;
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .search-container {
    width: 100%;
    margin-bottom: 0.5rem;
  }

  .actions {
    width: 100%;
  }

  .time-range,
  .break-time {
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>
import { ref, reactive, onMounted, computed } from "vue";
import { useStore } from "vuex";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import InputNumber from "primevue/inputnumber";
import InputMask from "primevue/inputmask";
import InputSwitch from "primevue/inputswitch";
import Calendar from "primevue/calendar";
import { FilterMatchMode, FilterOperator } from "primevue/api";
import { formatDateToJP, getDayOfWeekJP } from "@/utils/date";

export default {
  name: "StaffManagement",
  components: {
    InputNumber,
    InputMask,
    InputSwitch,
    Calendar,
  },
  setup() {
    const store = useStore();
    const toast = useToast();
    const confirm = useConfirm();

    const loading = ref(false);
    const saving = ref(false);
    const submitted = ref(false);
    const staffList = ref([]);
    const selectedDate = ref(null);

    const filters = ref({
      global: { value: null, matchMode: FilterMatchMode.CONTAINS },
      last_name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
      first_name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
      furigana: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
      position: { value: null, matchMode: FilterMatchMode.EQUALS },
      employment_type: { value: null, matchMode: FilterMatchMode.EQUALS },
    });

    const generateTimeOptions = () => {
      const options = [];
      for (let hour = 0; hour < 24; hour++) {
        for (let minute of ["00", "30"]) {
          const formattedHour = hour.toString().padStart(2, "0");
          const timeValue = `${formattedHour}:${minute}`;
          options.push({
            label: timeValue,
            value: timeValue,
          });
        }
      }
      return options;
    };

    const timeOptions = ref(generateTimeOptions());
    const staffDialog = reactive({
      visible: false,
      isNew: false,
      staff: {},
      dayPreferences: [],
      dayOffRequests: [],
    });

    const pendingDayOffRequests = computed(() => {
      return staffDialog.dayOffRequests.filter(
        (req) => req.status === "pending" || !req.status
      );
    });

    const effectiveUser = computed(() => store.getters['auth/effectiveUser']);
    const effectiveUserRole = computed(() => store.getters['auth/effectiveUserRole']);

    const editStaff = async (staff) => {
      loading.value = true;

      try {
        const staffDetail = await store.dispatch(
          "staff/fetchStaffById",
          staff.id
        );

        console.log("スタッフ詳細データ:", staffDetail);

        staffDialog.staff = { ...staffDetail };

        if (
          staffDetail.dayPreferences &&
          Array.isArray(staffDetail.dayPreferences) &&
          staffDetail.dayPreferences.length > 0
        ) {
          console.log("既存の希望シフト:", staffDetail.dayPreferences);

          staffDialog.dayPreferences = daysOfWeek.map((day) => {
            const preference = staffDetail.dayPreferences.find(
              (p) => parseInt(p.day_of_week) === parseInt(day.value)
            );

            if (preference) {
              const preferred_start_time = preference.preferred_start_time
                ? String(preference.preferred_start_time).substring(0, 5)
                : "";
              const preferred_end_time = preference.preferred_end_time
                ? String(preference.preferred_end_time).substring(0, 5)
                : "";
              const break_start_time = preference.break_start_time
                ? String(preference.break_start_time).substring(0, 5)
                : "";
              const break_end_time = preference.break_end_time
                ? String(preference.break_end_time).substring(0, 5)
                : "";

              return {
                id: preference.id,
                day_of_week: parseInt(day.value),
                available:
                  preference.available === true ||
                  preference.available === "true",
                preferred_start_time: preferred_start_time,
                preferred_end_time: preferred_end_time,
                break_start_time: break_start_time,
                break_end_time: break_end_time,
              };
            } else {
              return {
                day_of_week: parseInt(day.value),
                available: true,
                preferred_start_time: "",
                preferred_end_time: "",
                break_start_time: "",
                break_end_time: "",
              };
            }
          });
        } else {
          staffDialog.dayPreferences = daysOfWeek.map((day) => ({
            day_of_week: parseInt(day.value),
            available: true,
            preferred_start_time: "",
            preferred_end_time: "",
            break_start_time: "",
            break_end_time: "",
          }));
        }

        console.log("設定された希望シフト:", staffDialog.dayPreferences);

        if (
          staffDetail.dayOffRequests &&
          staffDetail.dayOffRequests.length > 0
        ) {
          staffDialog.dayOffRequests = staffDetail.dayOffRequests.map(
            (request) => ({
              id: request.id,
              date: request.date,
              reason: request.reason || "requested",
              status: request.status || "pending",
            })
          );
        } else {
          staffDialog.dayOffRequests = [];
        }

        staffDialog.isNew = false;
        staffDialog.visible = true;
        submitted.value = false;
      } catch (error) {
        console.error("スタッフ詳細取得エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "スタッフ情報の取得に失敗しました",
          life: 3002,
        });
      } finally {
        loading.value = false;
      }
    };

    const saveStaff = async () => {
      submitted.value = true;

      if (!staffDialog.staff.last_name || !staffDialog.staff.first_name) {
        toast.add({
          severity: "error",
          summary: "入力エラー",
          detail: "姓と名は必須項目です",
          life: 3000,
        });
        return;
      }

      saving.value = true;

      try {
        console.log(
          "保存前のdayPreferences:",
          JSON.stringify(staffDialog.dayPreferences)
        );

        const dayPreferences = staffDialog.dayPreferences.map((day) => {
          const dayPref = {
            day_of_week: parseInt(day.day_of_week, 10),
            available: day.available === true || day.available === "true",
            preferred_start_time: day.preferred_start_time || null,
            preferred_end_time: day.preferred_end_time || null,
            break_start_time: day.break_start_time || null,
            break_end_time: day.break_end_time || null,
          };

          if (day.id) {
            dayPref.id = day.id;
          }

          return dayPref;
        });

        const dayOffRequests = staffDialog.dayOffRequests.map((req) => ({
          date: req.date,
          reason: req.reason || "requested",
          status: req.status || "pending",
          id: req.id,
        }));

        console.log("送信データ:", {
          staff: staffDialog.staff,
          day_preferences: dayPreferences,
          day_off_requests: dayOffRequests,
        });

        let staffData = {
          ...staffDialog.staff,
          day_preferences: dayPreferences,
          day_off_requests: dayOffRequests,
        };

        if (staffDialog.isNew) {
          await store.dispatch("staff/createStaff", staffData);

          toast.add({
            severity: "success",
            summary: "作成完了",
            detail: "スタッフを作成しました",
            life: 3002,
          });
        } else {
          const response = await store.dispatch("staff/updateStaff", {
            id: staffDialog.staff.id,
            staffData: staffData,
          });

          console.log("更新レスポンス:", response);

          toast.add({
            severity: "success",
            summary: "更新完了",
            detail: "スタッフ情報を更新しました",
            life: 3002,
          });
        }

        hideDialog();
        await fetchStaffList();
      } catch (error) {
        console.error("スタッフ保存エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "スタッフの保存に失敗しました",
          life: 3002,
        });
      } finally {
        saving.value = false;
      }
    };

    const formatDayPreferences = (preferences) => {
      if (!preferences || preferences.length === 0) return [];

      console.log("formatDayPreferences input:", preferences);

      const formattedPrefs = [];
      const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];

      for (let i = 0; i < 7; i++) {
        const pref = preferences.find((p) => {
          if (parseInt(p.day_of_week) === i) {
            console.log(`Found day ${i}:`, p);
          }
          return parseInt(p.day_of_week) === i;
        });

        if (pref) {
          if (pref.preferred_start_time) {
            console.log(
              `Day ${i} has time:`,
              pref.preferred_start_time,
              pref.preferred_end_time
            );
          }

          formattedPrefs.push({
            day: dayLabels[i],
            available: pref.available === true || pref.available === "true",
            start_time: pref.preferred_start_time || null,
            end_time: pref.preferred_end_time || null,
          });
        } else {
          formattedPrefs.push({
            day: dayLabels[i],
            available: true,
            start_time: null,
            end_time: null,
          });
        }
      }

      return formattedPrefs;
    };

    const formatDayOffRequests = (requests) => {
      if (!requests || requests.length === 0) return [];

      return requests
        .slice()
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 5);
    };

    const formatShortDate = (dateString) => {
      if (!dateString) return "";

      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;

      return `${date.getMonth() + 1}/${date.getDate()}`;
    };

    const isDayUnavailable = (preferences, dayOfWeek) => {
      if (!preferences || !Array.isArray(preferences)) return false;
      const preference = preferences.find(p => parseInt(p.day_of_week) === parseInt(dayOfWeek));
      return preference && (preference.available === false || preference.available === 'false');
    };

    const getPreferencesWithTimes = (preferences) => {
      if (!preferences || !Array.isArray(preferences)) return [];
      return preferences.filter(p => 
        p.preferred_start_time && 
        p.preferred_end_time && 
        p.available !== false && 
        p.available !== 'false'
      );
    };

    const formatTime = (time) => {
      if (!time) return '';
      if (typeof time === 'string' && time.length >= 5) {
        return time.substring(0, 5);
      }
      return time;
    };

    const addCustomDate = () => {
      if (!selectedDate.value) {
        toast.add({
          severity: "error",
          summary: "入力エラー",
          detail: "日付を選択してください",
          life: 3000,
        });
        return;
      }

      try {
        const formattedDate = formatDate(selectedDate.value);

        const exists = staffDialog.dayOffRequests.some(
          (request) => request.date === formattedDate
        );

        if (!exists) {
          const newRequest = {
            date: formattedDate,
            reason: "requested",
            status: "pending",
          };

          staffDialog.dayOffRequests.push(newRequest);
          selectedDate.value = null;
        } else {
          toast.add({
            severity: "warn",
            summary: "重複",
            detail: "この日付は既に追加されています",
            life: 3000,
          });
        }
      } catch (e) {
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "無効な日付です",
          life: 3000,
        });
      }
    };

    const removeCustomDate = (index, request) => {
      if (request) {
        const realIndex = staffDialog.dayOffRequests.findIndex(
          (req) => req.date === request.date && req.status === "pending"
        );

        if (realIndex !== -1) {
          staffDialog.dayOffRequests.splice(realIndex, 1);
        }
      }
    };

    const daysOfWeek = [
      { value: 0, label: "日" },
      { value: 1, label: "月" },
      { value: 2, label: "火" },
      { value: 3, label: "水" },
      { value: 4, label: "木" },
      { value: 5, label: "金" },
      { value: 6, label: "土" },
    ];

    const genderOptions = [
      { label: "男性", value: "男性" },
      { label: "女性", value: "女性" },
      { label: "その他", value: "その他" },
    ];

    const positionOptions = ["店長", "副店長", "リーダー", "一般スタッフ"];

    const employmentTypeOptions = [
      "正社員",
      "パート",
      "アルバイト",
      "契約社員",
      "業務委託",
    ];

    const breakReasonOptions = [
      { label: "希望休", value: "requested" },
      { label: "私用", value: "personal" },
      { label: "体調不良", value: "sick" },
      { label: "その他", value: "other" },
    ];

    const fetchStaffList = async () => {
      loading.value = true;

      try {
        let storeId = null;
        
        if (effectiveUserRole.value === 'owner' || effectiveUserRole.value === 'staff') {
          storeId = effectiveUser.value?.store_id;
          if (!storeId) {
            console.error("有効なユーザーに店舗IDが設定されていません");
            toast.add({
              severity: "error",
              summary: "エラー",
              detail: "店舗情報が見つかりません",
              life: 3000,
            });
            return;
          }
        }

        const staff = await store.dispatch("staff/fetchStaff", storeId);

        console.log("取得したスタッフ一覧:", staff);

        for (const s of staff) {
          if (s.dayPreferences && s.dayPreferences.length > 0) {
            console.log(`スタッフID ${s.id} の希望シフト:`, s.dayPreferences);
            const hasPreferredTime = s.dayPreferences.some(
              (p) => p.preferred_start_time
            );
            console.log(
              `スタッフID ${s.id} は希望時間を設定済み:`,
              hasPreferredTime
            );
          }
        }

        if (effectiveUserRole.value === 'admin') {
          staffList.value = staff;
        } else {
          staffList.value = staff.filter((s) => s.store_id === storeId);
        }
      } catch (error) {
        console.error("スタッフ一覧取得エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "スタッフ一覧の取得に失敗しました",
          life: 3002,
        });
      } finally {
        loading.value = false;
      }
    };

    const openNew = () => {
      let defaultStoreId = null;
      
      if (effectiveUserRole.value === 'owner' || effectiveUserRole.value === 'staff') {
        defaultStoreId = effectiveUser.value?.store_id || 1;
      } else {
        defaultStoreId = 1;
      }

      staffDialog.staff = {
        store_id: defaultStoreId,
        last_name: "",
        first_name: "",
        furigana: "",
        gender: null,
        position: null,
        employment_type: null,
        max_hours_per_month: null,
        min_hours_per_month: null,
        max_hours_per_day: null,
        max_consecutive_days: null,
      };

      staffDialog.dayPreferences = daysOfWeek.map((day) => ({
        day_of_week: day.value,
        available: true,
        preferred_start_time: "",
        preferred_end_time: "",
        break_start_time: "",
        break_end_time: "",
      }));

      staffDialog.dayOffRequests = [];
      selectedDate.value = null;

      staffDialog.isNew = true;
      staffDialog.visible = true;
      submitted.value = false;
    };

    const confirmDeleteStaff = (staff) => {
      confirm.require({
        message: `${staff.last_name} ${staff.first_name}を削除してもよろしいですか？`,
        header: "スタッフ削除の確認",
        icon: "pi pi-exclamation-triangle",
        acceptClass: "p-button-danger",
        accept: () => deleteStaff(staff),
      });
    };

    const deleteStaff = async (staff) => {
      try {
        await store.dispatch("staff/deleteStaff", staff.id);

        await fetchStaffList();

        toast.add({
          severity: "success",
          summary: "削除完了",
          detail: `${staff.last_name} ${staff.first_name}を削除しました`,
          life: 3002,
        });
      } catch (error) {
        console.error("スタッフ削除エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "スタッフの削除に失敗しました",
          life: 3002,
        });
      }
    };

    const hideDialog = () => {
      staffDialog.visible = false;
      submitted.value = false;
    };

    const removeDayOffRequest = (index) => {
      staffDialog.dayOffRequests.splice(index, 1);
    };

    const getStatusSeverity = (status) => {
      const severityMap = {
        pending: "warning",
        approved: "success",
        rejected: "danger",
      };

      return severityMap[status] || "info";
    };

    const formatDate = (date) => {
      if (!date) return "";

      const d = date instanceof Date ? date : new Date(date);

      if (isNaN(d.getTime())) return "";

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");

      return `${year}-${month}-${day}`;
    };

    const formatDateWithDayOfWeek = (dateString) => {
      if (!dateString) return "";

      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;

      const dayOfWeek = getDayOfWeekJP(date.getDay());
      return `${formatDateToJP(date)} (${dayOfWeek})`;
    };

    const getDayOfWeekLabel = (dayOfWeek) => {
      const day = daysOfWeek.find((d) => d.value === parseInt(dayOfWeek, 10));
      return day ? day.label : "";
    };

    const getBreakReasonLabel = (reasonValue) => {
      const reason = breakReasonOptions.find((r) => r.value === reasonValue);
      return reason ? reason.label : reasonValue;
    };

    const debugDayPreferences = (data) => {
      if (!data || !data.dayPreferences || data.dayPreferences.length === 0) {
        console.log("希望シフトデ