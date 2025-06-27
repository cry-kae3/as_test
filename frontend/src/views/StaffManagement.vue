<template>
  <div class="staff-management">
    <div class="page-header">
      <h1 class="page-title">スタッフ管理</h1>
    </div>

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

    <div class="table-container">
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
        class="p-datatable-sm"
        stripedRows
        removableSort
        :scrollable="true"
      >
        <template #empty>
          <div class="text-center py-4">スタッフが見つかりません</div>
        </template>
        <template #loading>
          <div class="text-center py-4">データを読み込み中...</div>
        </template>

        <Column field="id" header="ID" sortable :style="{ minWidth: '60px', width: '60px' }"></Column>

        <Column field="last_name" header="姓" sortable :style="{ minWidth: '80px' }">
          <template #filter="{ filterModel, filterCallback }">
            <InputText v-model="filterModel.value" @input="filterCallback()" class="p-column-filter" />
          </template>
        </Column>

        <Column field="first_name" header="名" sortable :style="{ minWidth: '80px' }">
          <template #filter="{ filterModel, filterCallback }">
            <InputText v-model="filterModel.value" @input="filterCallback()" class="p-column-filter" />
          </template>
        </Column>

        <Column header="勤務可能店舗" :style="{ minWidth: '150px' }" v-if="effectiveUserRole === 'admin'">
          <template #body="{ data }">
            <div v-if="data.stores && data.stores.length > 0" class="store-tags">
              <Tag
                v-for="store in data.stores.slice(0, 3)"
                :key="store.id"
                :value="store.name"
                class="store-tag"
              />
              <span v-if="data.stores.length > 3" class="more-stores">+{{ data.stores.length - 3 }}店舗</span>
            </div>
            <span v-else class="no-data">-</span>
          </template>
        </Column>

        <Column field="furigana" header="フリガナ" sortable :style="{ minWidth: '100px' }">
          <template #filter="{ filterModel, filterCallback }">
            <InputText v-model="filterModel.value" @input="filterCallback()" class="p-column-filter" />
          </template>
        </Column>

        <Column field="gender" header="性別" sortable :style="{ minWidth: '70px' }"></Column>

        <Column field="position" header="役職" sortable :style="{ minWidth: '100px' }">
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

        <Column field="employment_type" header="雇用形態" sortable :style="{ minWidth: '100px' }">
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

        <Column header="希望シフト" :style="{ minWidth: '400px' }">
          <template #body="{ data }">
            <div v-if="data.dayPreferences" class="day-preferences-summary">
              <span
                v-for="day in daysOfWeek"
                :key="day.value"
                :class="{
                  'day-unavailable': isDayUnavailable(data.dayPreferences, day.value),
                }"
                class="day-marker"
              >
                {{ day.label }}
              </span>
            </div>
            <div v-if="data.dayPreferences && data.dayPreferences.length > 0" class="day-time-container">
              <div
                v-for="pref in getPreferencesWithTimes(data.dayPreferences)"
                :key="pref.day_of_week"
                class="day-time"
              >
                {{ getDayOfWeekLabel(pref.day_of_week) }}:
                {{ formatTime(pref.preferred_start_time) }}-{{ formatTime(pref.preferred_end_time) }}
              </div>
            </div>
          </template>
        </Column>

        <Column header="休み希望日" :style="{ minWidth: '150px' }">
          <template #body="{ data }">
            <div v-if="data.dayOffRequests && data.dayOffRequests.length > 0" class="day-off-requests-summary">
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

        <Column field="max_hours_per_month" header="月間最大勤務時間" sortable :style="{ minWidth: '120px' }">
          <template #body="{ data }">
            {{ data.max_hours_per_month ? data.max_hours_per_month + 'h' : "-" }}
          </template>
        </Column>

        <Column field="min_hours_per_month" header="月間最小勤務時間" sortable :style="{ minWidth: '120px' }">
          <template #body="{ data }">
            {{ data.min_hours_per_month ? data.min_hours_per_month + 'h' : "-" }}
          </template>
        </Column>

        <Column field="max_hours_per_day" header="1日の最大勤務時間" sortable :style="{ minWidth: '120px' }">
          <template #body="{ data }">
            {{ data.max_hours_per_day ? data.max_hours_per_day + 'h' : "-" }}
          </template>
        </Column>

        <Column header="操作" :style="{ minWidth: '100px', width: '100px' }">
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
    </div>

    <Dialog
      v-model:visible="staffDialog.visible"
      :header="staffDialog.isNew ? '新規スタッフ' : 'スタッフ編集'"
      :modal="true"
      class="p-fluid staff-dialog"
      :style="{ width: '90vw', maxWidth: '800px', height: '90vh' }"
      :maximizable="true"
    >
      <div class="dialog-content">
        <TabView class="full-height-tabs">
          <TabPanel header="基本情報">
            <div class="tab-content">
              <div class="p-grid p-formgrid">
                <div class="p-col-12" v-if="shouldShowStoreSelection">
                  <div class="field">
                    <label for="store_ids">勤務可能店舗 <span class="required-mark">*</span></label>
                    <div class="store-selection-container">
                      <MultiSelect
                        id="store_ids"
                        v-model="staffDialog.staff.store_ids"
                        :options="storeOptions"
                        optionLabel="name"
                        optionValue="id"
                        placeholder="店舗を選択してください"
                        :class="{ 'p-invalid': submitted && shouldShowStoreSelection && (!staffDialog.staff.store_ids || staffDialog.staff.store_ids.length === 0) }"
                        display="chip"
                        :showToggleAll="false"
                        class="w-full"
                      />
                      <div class="area-selection mt-2">
                        <label class="area-label">エリア一括選択:</label>
                        <div class="area-buttons">
                          <Button
                            v-for="area in areaOptions"
                            :key="area.value"
                            :label="area.label"
                            @click="selectStoresByArea(area.value)"
                            class="p-button-sm p-button-outlined area-btn"
                            type="button"
                          />
                        </div>
                      </div>
                    </div>
                    <small v-if="submitted && shouldShowStoreSelection && (!staffDialog.staff.store_ids || staffDialog.staff.store_ids.length === 0)" class="p-error">
                      勤務可能店舗を少なくとも1つ選択してください
                    </small>
                  </div>
                </div>

                <div class="p-col-12 p-md-6">
                  <div class="field">
                    <label for="last_name">姓 <span class="required-mark">*</span></label>
                    <InputText
                      id="last_name"
                      v-model="staffDialog.staff.last_name"
                      :class="{ 'p-invalid': submitted && !staffDialog.staff.last_name }"
                    />
                    <small v-if="submitted && !staffDialog.staff.last_name" class="p-error">姓は必須です</small>
                  </div>
                </div>

                <div class="p-col-12 p-md-6">
                  <div class="field">
                    <label for="first_name">名 <span class="required-mark">*</span></label>
                    <InputText
                      id="first_name"
                      v-model="staffDialog.staff.first_name"
                      :class="{ 'p-invalid': submitted && !staffDialog.staff.first_name }"
                    />
                    <small v-if="submitted && !staffDialog.staff.first_name" class="p-error">名は必須です</small>
                  </div>
                </div>

                <div class="p-col-12 p-md-6">
                  <div class="field">
                    <label for="furigana">フリガナ</label>
                    <InputText id="furigana" v-model="staffDialog.staff.furigana" />
                  </div>
                </div>

                <div class="p-col-12 p-md-6">
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
                </div>

                <div class="p-col-12 p-md-6">
                  <div class="field">
                    <label for="position">役職</label>
                    <Dropdown
                      id="position"
                      v-model="staffDialog.staff.position"
                      :options="positionOptions"
                      placeholder="選択してください"
                    />
                  </div>
                </div>

                <div class="p-col-12 p-md-6">
                  <div class="field">
                    <label for="employment_type">雇用形態</label>
                    <Dropdown
                      id="employment_type"
                      v-model="staffDialog.staff.employment_type"
                      :options="employmentTypeOptions"
                      placeholder="選択してください"
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="勤務条件">
            <div class="tab-content">
              <div class="p-grid p-formgrid">
                <div class="p-col-12 p-md-6">
                  <div class="field">
                    <label for="max_hours_per_month">月間最大勤務時間</label>
                    <InputNumber
                      id="max_hours_per_month"
                      v-model="staffDialog.staff.max_hours_per_month"
                      suffix=" 時間"
                      :min="0"
                      :max="300"
                    />
                  </div>
                </div>

                <div class="p-col-12 p-md-6">
                  <div class="field">
                    <label for="min_hours_per_month">月間最小勤務時間</label>
                    <InputNumber
                      id="min_hours_per_month"
                      v-model="staffDialog.staff.min_hours_per_month"
                      suffix=" 時間"
                      :min="0"
                      :max="300"
                    />
                  </div>
                </div>

                <div class="p-col-12 p-md-6">
                  <div class="field">
                    <label for="max_hours_per_day">1日の最大勤務時間</label>
                    <InputNumber
                      id="max_hours_per_day"
                      v-model="staffDialog.staff.max_hours_per_day"
                      suffix=" 時間"
                      :min="0"
                      :max="24"
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="希望シフト">
            <div class="tab-content">
              <div class="preferences-container">
                <div
                  v-for="(day, index) in daysOfWeek"
                  :key="day.value"
                  class="day-preference"
                >
                  <div class="day-header">
                    <label class="day-label">{{ day.label }}曜日</label>
                    <div class="availability-toggle">
                      <InputSwitch v-model="staffDialog.dayPreferences[index].available" />
                      <span class="availability-text">
                        {{ staffDialog.dayPreferences[index].available ? "勤務可能" : "勤務不可" }}
                      </span>
                    </div>
                  </div>

                  <div v-if="staffDialog.dayPreferences[index].available" class="time-settings">
                    <div class="time-section">
                      <h5>勤務時間</h5>
                      <div class="time-range">
                        <div class="time-input">
                          <label>開始時間</label>
                          <Dropdown
                            v-model="staffDialog.dayPreferences[index].preferred_start_time"
                            :options="timeOptions"
                            optionLabel="label"
                            optionValue="value"
                            placeholder="開始時間を選択"
                            showClear
                          />
                        </div>
                        <div class="time-input">
                          <label>終了時間</label>
                          <Dropdown
                            v-model="staffDialog.dayPreferences[index].preferred_end_time"
                            :options="timeOptions"
                            optionLabel="label"
                            optionValue="value"
                            placeholder="終了時間を選択"
                            showClear
                          />
                        </div>
                      </div>
                    </div>

                    <div class="time-section">
                      <h5>休憩時間</h5>
                      <div class="time-range">
                        <div class="time-input">
                          <label>休憩開始</label>
                          <Dropdown
                            v-model="staffDialog.dayPreferences[index].break_start_time"
                            :options="timeOptions"
                            optionLabel="label"
                            optionValue="value"
                            placeholder="開始時間を選択"
                            showClear
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
                            showClear
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="休み希望">
            <div class="tab-content">
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
                </div>
              </div>

              <div class="selected-dates-container">
                <h4>休み希望日一覧</h4>
                <div v-if="staffDialog.dayOffRequests.length === 0" class="no-requests">
                  休み希望日はありません
                </div>
                <div v-else class="requests-list">
                  <div
                    v-for="(request, index) in staffDialog.dayOffRequests"
                    :key="index"
                    class="request-item"
                  >
                    <div class="request-info">
                      <span class="request-date">{{ formatDateWithDayOfWeek(request.date) }}</span>
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
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>
        </TabView>
      </div>

      <template #footer>
        <div class="dialog-footer">
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
        </div>
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
import MultiSelect from "primevue/multiselect";
import { FilterMatchMode, FilterOperator } from "primevue/api";
import { formatDateToJP, getDayOfWeekJP } from "@/utils/date";

export default {
  name: "StaffManagement",
  components: {
    InputNumber,
    InputMask,
    InputSwitch,
    Calendar,
    MultiSelect,
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
    const storeOptions = ref([]);
    const areaOptions = ref([]);

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
    
    const shouldShowStoreSelection = computed(() => {
      return effectiveUserRole.value === 'admin' && storeOptions.value.length > 0;
    });

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

    const initializeStaffDialog = () => {
      return {
        visible: false,
        isNew: false,
        staff: {},
        dayPreferences: daysOfWeek.map((day) => ({
          day_of_week: day.value,
          available: true,
          preferred_start_time: null,
          preferred_end_time: null,
          break_start_time: null,
          break_end_time: null,
        })),
        dayOffRequests: [],
      };
    };

    const editStaff = async (staff) => {
      loading.value = true;

      try {
        const staffDetail = await store.dispatch("staff/fetchStaffById", staff.id);
        console.log("スタッフ詳細データ:", staffDetail);

        staffDialog.staff = {
          id: staffDetail.id,
          store_id: staffDetail.store_id,
          store_ids: staffDetail.store_ids || (staffDetail.store_id ? [staffDetail.store_id] : []),
          last_name: staffDetail.last_name || '',
          first_name: staffDetail.first_name || '',
          furigana: staffDetail.furigana || '',
          gender: staffDetail.gender,
          position: staffDetail.position,
          employment_type: staffDetail.employment_type,
          max_hours_per_month: staffDetail.max_hours_per_month,
          min_hours_per_month: staffDetail.min_hours_per_month,
          max_hours_per_day: staffDetail.max_hours_per_day,
        };

        if (staffDetail.dayPreferences && Array.isArray(staffDetail.dayPreferences)) {
          staffDialog.dayPreferences = daysOfWeek.map((day) => {
            const preference = staffDetail.dayPreferences.find(
              (p) => parseInt(p.day_of_week) === parseInt(day.value)
            );
            
            return preference || {
                day_of_week: parseInt(day.value),
                available: false,
                preferred_start_time: null,
                preferred_end_time: null,
                break_start_time: null,
                break_end_time: null,
              };
          });
        } else {
          staffDialog.dayPreferences = daysOfWeek.map((day) => ({
            day_of_week: parseInt(day.value),
            available: false,
            preferred_start_time: null,
            preferred_end_time: null,
            break_start_time: null,
            break_end_time: null,
          }));
        }

        if (staffDetail.dayOffRequests && staffDetail.dayOffRequests.length > 0) {
          staffDialog.dayOffRequests = staffDetail.dayOffRequests.map((request) => ({
            id: request.id,
            date: request.date,
            reason: request.reason || "requested",
            status: request.status || "pending",
          }));
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
          life: 3000,
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

      if (shouldShowStoreSelection.value && (!staffDialog.staff.store_ids || staffDialog.staff.store_ids.length === 0)) {
        toast.add({
          severity: "error",
          summary: "入力エラー",
          detail: "勤務可能店舗を少なくとも1つ選択してください",
          life: 3000,
        });
        return;
      }

      saving.value = true;

      try {
        const dayPreferences = staffDialog.dayPreferences.map((day) => ({
          day_of_week: parseInt(day.day_of_week, 10),
          available: Boolean(day.available),
          preferred_start_time: day.preferred_start_time || null,
          preferred_end_time: day.preferred_end_time || null,
          break_start_time: day.break_start_time || null,
          break_end_time: day.break_end_time || null,
          ...(day.id && { id: day.id })
        }));

        const dayOffRequests = staffDialog.dayOffRequests.map((req) => ({
          date: req.date,
          reason: req.reason || "requested",
          status: req.status || "pending",
          ...(req.id && { id: req.id })
        }));

        const staffData = {
          ...staffDialog.staff,
          store_ids: staffDialog.staff.store_ids || [],
          store_id: staffDialog.staff.store_ids && staffDialog.staff.store_ids.length > 0 
            ? staffDialog.staff.store_ids[0] 
            : staffDialog.staff.store_id,
          day_preferences: dayPreferences,
          day_off_requests: dayOffRequests,
        };

        console.log("保存データ:", staffData);

        if (staffDialog.isNew) {
          await store.dispatch("staff/createStaff", staffData);
          toast.add({
            severity: "success",
            summary: "作成完了",
            detail: "スタッフを作成しました",
            life: 3000,
          });
        } else {
          await store.dispatch("staff/updateStaff", {
            id: staffDialog.staff.id,
            staffData: staffData,
          });
          toast.add({
            severity: "success",
            summary: "更新完了",
            detail: "スタッフ情報を更新しました",
            life: 3000,
          });
        }

        hideDialog();
        await fetchStaffList();
      } catch (error) {
        console.error("スタッフ保存エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: error.response?.data?.message || "スタッフの保存に失敗しました",
          life: 3000,
        });
      } finally {
        saving.value = false;
      }
    };

    const fetchStoreOptions = async () => {
      try {
        console.log('fetchStoreOptions called, effectiveUserRole:', effectiveUserRole.value);
        
        if (effectiveUserRole.value === 'admin') {
          const stores = await store.dispatch("store/fetchStores");
          console.log('店舗一覧取得結果:', stores);
          storeOptions.value = stores || [];
          
          generateAreaOptions(stores || []);
        } else {
          storeOptions.value = [];
          areaOptions.value = [];
        }
      } catch (error) {
        console.error("店舗一覧取得エラー:", error);
        storeOptions.value = [];
        areaOptions.value = [];
      }
    };

    const generateAreaOptions = (stores) => {
      const areas = new Set();
      stores.forEach(store => {
        if (store.area && store.area.trim()) {
          areas.add(store.area.trim());
        }
      });
      
      areaOptions.value = Array.from(areas).map(area => ({
        label: area,
        value: area
      }));
      
      console.log('生成されたエリアオプション:', areaOptions.value);
    };

    const selectStoresByArea = (areaValue) => {
      const areaStores = storeOptions.value
        .filter(store => store.area && store.area.trim() === areaValue)
        .map(store => store.id);
      
      console.log(`エリア ${areaValue} の店舗:`, areaStores);
      
      if (areaStores.length > 0) {
        const currentSelection = staffDialog.staff.store_ids || [];
        const newSelection = [...new Set([...currentSelection, ...areaStores])];
        staffDialog.staff.store_ids = newSelection;
        
        toast.add({
          severity: "success",
          summary: "エリア選択完了",
          detail: `${areaValue}の${areaStores.length}店舗を選択しました`,
          life: 3000,
        });
      } else {
        toast.add({
          severity: "warn",
          summary: "店舗なし",
          detail: `${areaValue}に該当する店舗がありません`,
          life: 3000,
        });
      }
    };

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
        staffList.value = staff;
      } catch (error) {
        console.error("スタッフ一覧取得エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "スタッフ一覧の取得に失敗しました",
          life: 3000,
        });
      } finally {
        loading.value = false;
      }
    };

    const openNew = () => {
      let defaultStoreId = null;
      
      console.log('openNew called', {
        effectiveUserRole: effectiveUserRole.value,
        storeOptions: storeOptions.value.length,
        shouldShowStoreSelection: shouldShowStoreSelection.value
      });
      
      if (effectiveUserRole.value === 'owner' || effectiveUserRole.value === 'staff') {
        defaultStoreId = effectiveUser.value?.store_id || 1;
      } else if (effectiveUserRole.value === 'admin') {
        defaultStoreId = null;
      }

      staffDialog.staff = {
        store_id: defaultStoreId,
        store_ids: defaultStoreId ? [defaultStoreId] : [],
        last_name: "",
        first_name: "",
        furigana: "",
        gender: null,
        position: null,
        employment_type: null,
        max_hours_per_month: null,
        min_hours_per_month: null,
        max_hours_per_day: null,
      };

      staffDialog.dayPreferences = daysOfWeek.map((day) => ({
        day_of_week: day.value,
        available: true,
        preferred_start_time: null,
        preferred_end_time: null,
        break_start_time: null,
        break_end_time: null,
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
          life: 3000,
        });
      } catch (error) {
        console.error("スタッフ削除エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "スタッフの削除に失敗しました",
          life: 3000,
        });
      }
    };

    const hideDialog = () => {
      staffDialog.visible = false;
      submitted.value = false;
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
        const exists = staffDialog.dayOffRequests.some((request) => request.date === formattedDate);

        if (!exists) {
          staffDialog.dayOffRequests.push({
            date: formattedDate,
            reason: "requested",
            status: "pending",
          });
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

    const removeDayOffRequest = (index) => {
      staffDialog.dayOffRequests.splice(index, 1);
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

    const formatShortDate = (dateString) => {
      if (!dateString) return "";
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return `${date.getMonth() + 1}/${date.getDate()}`;
    };

    const formatTime = (time) => {
      if (!time) return '';
      if (typeof time === 'string' && time.length >= 5) {
        return time.substring(0, 5);
      }
      return time;
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

    const getDayOfWeekLabel = (dayOfWeek) => {
      const day = daysOfWeek.find((d) => d.value === parseInt(dayOfWeek, 10));
      return day ? day.label : "";
    };

    const formatDayOffRequests = (requests) => {
      if (!requests || requests.length === 0) return [];
      return requests
        .slice()
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 5);
    };

    const getStatusSeverity = (status) => {
      const severityMap = {
        pending: "warning",
        approved: "success",
        rejected: "danger",
      };
      return severityMap[status] || "info";
    };

    onMounted(async () => {
      console.log('Component mounted, effectiveUserRole:', effectiveUserRole.value);
      await fetchStoreOptions();
      await fetchStaffList();
    });

    return {
      loading,
      saving,
      submitted,
      staffList,
      filters,
      staffDialog,
      selectedDate,
      effectiveUser,
      effectiveUserRole,
      shouldShowStoreSelection,
      pendingDayOffRequests,
      daysOfWeek,
      genderOptions,
      positionOptions,
      employmentTypeOptions,
      breakReasonOptions,
      timeOptions,
      storeOptions,
      areaOptions,

      fetchStoreOptions,
      generateAreaOptions,
      selectStoresByArea,
      openNew,
      editStaff,
      confirmDeleteStaff,
      hideDialog,
      saveStaff,
      removeDayOffRequest,
      addCustomDate,

      formatTime,
      formatShortDate,
      formatDateWithDayOfWeek,
      getDayOfWeekLabel,
      formatDayOffRequests,
      getStatusSeverity,
      isDayUnavailable,
      getPreferencesWithTimes,
    };
  },
};
</script>

<style scoped>
.staff-management {
  padding: 1rem;
  max-height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.page-header {
  margin-bottom: 1rem;
  flex-shrink: 0;
}


.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  gap: 1rem;
  flex-shrink: 0;
}

.search-container {
  flex: 1;
  max-width: 400px;
}

.table-container {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.required-mark {
  color: var(--red-500);
}

.store-selection-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.area-selection {
  padding: 0.75rem;
  background-color: var(--surface-ground);
  border-radius: 6px;
  border: 1px solid var(--surface-border);
}

.area-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-color-secondary);
  margin-bottom: 0.5rem;
  display: block;
}

.area-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.area-btn {
  font-size: 0.8rem;
  padding: 0.25rem 0.75rem;
}

.store-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;
}

.store-tag {
  font-size: 0.7rem !important;
  padding: 0.1rem 0.3rem !important;
  background-color: var(--blue-100) !important;
  color: var(--blue-700) !important;
}

.more-stores {
  font-size: 0.7rem;
  color: var(--text-color-secondary);
  font-style: italic;
}
.staff-dialog {
  max-height: 95vh;
}

:deep(.staff-dialog .p-dialog) {
  max-height: 95vh;
  display: flex;
  flex-direction: column;
}

:deep(.staff-dialog .p-dialog-content) {
  flex: 1;
  overflow: hidden;
  padding: 0;
}

.dialog-content {
  height: 60vh;
  min-height: 400px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.full-height-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
}

:deep(.full-height-tabs .p-tabview-panels) {
  flex: 1;
  overflow: hidden;
}

:deep(.full-height-tabs .p-tabview-panel) {
  height: 100%;
  overflow: hidden;
}

.tab-content {
  height: 100%;
  overflow-y: auto;
  padding: 1rem;
}

.preferences-container {
  max-height: 60vh;
  overflow-y: auto;
}

.day-preference {
  margin-bottom: 1.5rem;
  padding: 1rem;
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  background-color: var(--surface-ground);
}

.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.day-label {
  font-weight: 600;
  font-size: 1rem;
}

.availability-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.availability-text {
  font-size: 0.9rem;
  color: var(--text-color-secondary);
}

.time-settings {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.time-section h5 {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  color: var(--text-color-secondary);
}

.time-range {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.time-input {
  display: flex;
  flex-direction: column;
}

.time-input label {
  font-size: 0.8rem;
  margin-bottom: 0.25rem;
  color: var(--text-color-secondary);
}

.day-preferences-summary {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
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

.day-off-tag {
  font-size: 0.7rem !important;
  padding: 0.1rem 0.3rem !important;
}

.no-data {
  color: var(--text-color-secondary);
}

.action-buttons {
  display: flex;
  gap: 0.25rem;
  justify-content: center;
}

.custom-date-picker {
  padding: 1rem;
  background-color: var(--surface-ground);
  border-radius: 4px;
  margin-bottom: 1rem;
}

.date-input-container {
  display: flex;
  gap: 0.5rem;
}

.date-input {
  flex: 1;
}

.selected-dates-container {
  margin-top: 1rem;
}

.no-requests {
  text-align: center;
  padding: 2rem;
  color: var(--text-color-secondary);
}

.requests-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.request-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background-color: var(--surface-ground);
  border-radius: 4px;
  border: 1px solid var(--surface-border);
}

.request-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
}

.request-date {
  font-weight: 500;
  min-width: 140px;
}

.reason-dropdown {
  min-width: 120px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

@media (max-width: 1200px) {
  .staff-dialog {
    width: 95vw !important;
    max-width: none !important;
  }
}

@media (max-width: 768px) {

  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-container {
    max-width: none;
    margin-bottom: 0.5rem;
  }

  .staff-dialog {
    width: 100vw !important;
    height: 100vh !important;
    max-height: 100vh !important;
  }

  :deep(.staff-dialog .p-dialog) {
    margin: 0;
    border-radius: 0;
    max-height: 100vh;
  }

  .dialog-content {
    height: calc(100vh - 120px);
  }

  .time-range {
    grid-template-columns: 1fr;
  }

  .day-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .request-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .request-date {
    min-width: auto;
  }

  .area-buttons {
    flex-direction: column;
  }

  .area-btn {
    width: 100%;
    justify-content: center;
  }

  .store-tags {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 480px) {
  .day-time-container {
    flex-direction: column;
  }
  
  .day-time {
    white-space: normal;
    text-align: center;
  }
}

:deep(.p-column-filter) {
  width: 100%;
  min-width: 100px;
}

:deep(.p-datatable) {
}

:deep(.p-datatable .p-datatable-wrapper) {
}

:deep(.p-datatable-thead > tr > th) {
  white-space: nowrap;
  position: sticky;
  top: 0;
  z-index: 1;
}

:deep(.p-datatable-tbody > tr > td) {
  padding: 0.5rem;
  white-space: nowrap;
}

:deep(.p-tabview .p-tabview-panels) {
  padding: 0;
}

:deep(.p-tabview .p-tabview-panel) {
  height: 100%;
}
</style>