<template>
  <div class="staff-management">
    <Card class="staff-card">
      <template #header>
        <div class="card-header">
          <h1>スタッフ管理</h1>
          <Button
            label="新規スタッフ"
            icon="pi pi-plus"
            @click="openDialog(null)"
            class="p-button-success"
          />
        </div>
      </template>

      <template #content>
        <div class="filters-section">
          <div class="filter-item">
            <label for="storeFilter">店舗でフィルター：</label>
            <Dropdown
              id="storeFilter"
              v-model="selectedStoreFilter"
              :options="storeFilterOptions"
              optionLabel="name"
              optionValue="id"
              placeholder="すべて"
              @change="loadStaff"
              showClear
            />
          </div>
        </div>

        <DataTable
          :value="staff"
          :paginator="true"
          :rows="20"
          :loading="loading"
          class="staff-table"
          responsiveLayout="scroll"
          :globalFilterFields="['first_name', 'last_name', 'position']"
        >
          <template #header>
            <div class="table-header">
              <span class="p-input-icon-left">
                <i class="pi pi-search" />
                <InputText
                  v-model="globalFilter"
                  placeholder="スタッフ検索..."
                />
              </span>
            </div>
          </template>

          <Column field="full_name" header="名前" :sortable="true">
            <template #body="slotProps">
              {{ slotProps.data.last_name }} {{ slotProps.data.first_name }}
            </template>
          </Column>

          <Column field="position" header="役職" :sortable="true">
            <template #body="slotProps">
              <Tag
                :value="slotProps.data.position || '一般'"
                :severity="getPositionSeverity(slotProps.data.position)"
              />
            </template>
          </Column>

          <Column field="employment_type" header="雇用形態" :sortable="true">
            <template #body="slotProps">
              <Tag
                :value="slotProps.data.employment_type || 'アルバイト'"
                :severity="getEmploymentSeverity(slotProps.data.employment_type)"
              />
            </template>
          </Column>

          <Column field="stores" header="勤務可能店舗">
            <template #body="slotProps">
              <div class="store-tags">
                <Tag
                  v-for="store in slotProps.data.stores"
                  :key="store.id"
                  :value="store.name"
                  class="store-tag"
                />
              </div>
            </template>
          </Column>

          <Column field="aiGenerationStores" header="AI生成対象">
            <template #body="slotProps">
              <div class="store-tags">
                <Tag
                  v-for="store in slotProps.data.aiGenerationStores"
                  :key="store.id"
                  :value="store.name"
                  class="ai-generation-tag"
                  severity="info"
                />
              </div>
            </template>
          </Column>

          <Column field="max_hours_per_month" header="月間時間" :sortable="true">
            <template #body="slotProps">
              {{ formatHours(slotProps.data.min_hours_per_month) }} -
              {{ formatHours(slotProps.data.max_hours_per_month) }}
            </template>
          </Column>

          <Column header="アクション" :exportable="false">
            <template #body="slotProps">
              <div class="action-buttons">
                <Button
                  icon="pi pi-pencil"
                  class="p-button-rounded p-button-text"
                  @click="openDialog(slotProps.data)"
                  title="編集"
                />
                <Button
                  icon="pi pi-trash"
                  class="p-button-rounded p-button-text p-button-danger"
                  @click="confirmDelete(slotProps.data)"
                  title="削除"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Dialog
      v-model:visible="dialogVisible"
      :header="isEdit ? 'スタッフ編集' : '新規スタッフ'"
      :modal="true"
      class="staff-dialog"
      :style="{ width: '900px', maxWidth: '95vw' }"
      :breakpoints="{ '960px': '95vw', '640px': '95vw' }"
    >
      <div class="dialog-content">
        <TabView>
          <TabPanel header="基本情報">
            <div class="form-grid">
              <div class="form-group">
                <label for="lastName">姓 <span class="required">*</span></label>
                <InputText
                  id="lastName"
                  v-model="formData.last_name"
                  :class="{ 'p-invalid': submitted && !formData.last_name }"
                />
                <small v-if="submitted && !formData.last_name" class="p-error">姓は必須です</small>
              </div>

              <div class="form-group">
                <label for="firstName">名 <span class="required">*</span></label>
                <InputText
                  id="firstName"
                  v-model="formData.first_name"
                  :class="{ 'p-invalid': submitted && !formData.first_name }"
                />
                <small v-if="submitted && !formData.first_name" class="p-error">名は必須です</small>
              </div>

              <div class="form-group">
                <label for="furigana">フリガナ</label>
                <InputText id="furigana" v-model="formData.furigana" />
              </div>

              <div class="form-group">
                <label for="gender">性別</label>
                <Dropdown
                  id="gender"
                  v-model="formData.gender"
                  :options="genderOptions"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="選択してください"
                />
              </div>

              <div class="form-group">
                <label for="position">役職</label>
                <InputText id="position" v-model="formData.position" />
              </div>

              <div class="form-group">
                <label for="employmentType">雇用形態</label>
                <Dropdown
                  id="employmentType"
                  v-model="formData.employment_type"
                  :options="employmentOptions"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="選択してください"
                />
              </div>
            </div>
          </TabPanel>

          <TabPanel header="勤務条件">
            <div class="form-grid">
              <div class="form-group">
                <label for="maxHoursMonth">月間最大勤務時間</label>
                <InputNumber
                  id="maxHoursMonth"
                  v-model="formData.max_hours_per_month"
                  suffix=" 時間"
                  :min="0"
                  :max="300"
                />
              </div>

              <div class="form-group">
                <label for="minHoursMonth">月間最小勤務時間</label>
                <InputNumber
                  id="minHoursMonth"
                  v-model="formData.min_hours_per_month"
                  suffix=" 時間"
                  :min="0"
                  :max="300"
                />
              </div>

              <div class="form-group">
                <label for="maxHoursDay">1日最大勤務時間</label>
                <InputNumber
                  id="maxHoursDay"
                  v-model="formData.max_hours_per_day"
                  suffix=" 時間"
                  :min="1"
                  :max="24"
                />
              </div>

              <div class="form-group">
                <label for="maxConsecutiveDays">最大連続勤務日数</label>
                <InputNumber
                  id="maxConsecutiveDays"
                  v-model="formData.max_consecutive_days"
                  suffix=" 日"
                  :min="1"
                  :max="31"
                />
              </div>
            </div>
          </TabPanel>

          <TabPanel header="店舗設定">
            <div class="store-settings">
              <div class="store-section">
                <h4>勤務可能店舗 <span class="required">*</span></h4>
                <p class="section-description">
                  このスタッフが勤務可能な店舗を選択してください。
                  シフト管理画面のスタッフ一覧に表示されます。
                </p>
                <div class="store-selection">
                  <div
                    v-for="store in availableStores"
                    :key="store.id"
                    class="store-checkbox"
                  >
                    <Checkbox
                      :id="`store-${store.id}`"
                      v-model="formData.store_ids"
                      :value="store.id"
                    />
                    <label :for="`store-${store.id}`" class="store-label">
                      {{ store.name }}
                    </label>
                  </div>
                </div>
                <small v-if="submitted && (!formData.store_ids || formData.store_ids.length === 0)" class="p-error">
                  少なくとも1つの店舗を選択してください
                </small>
              </div>

              <Divider />

              <div class="store-section">
                <h4>AI生成対象店舗</h4>
                <p class="section-description">
                  AIシフト自動生成の対象とする店舗を選択してください。
                  選択しない場合、AI生成時にこのスタッフは除外されます。
                </p>
                <div class="store-selection">
                  <div
                    v-for="store in workableStores"
                    :key="`ai-${store.id}`"
                    class="store-checkbox"
                  >
                    <Checkbox
                      :id="`ai-store-${store.id}`"
                      v-model="formData.ai_generation_store_ids"
                      :value="store.id"
                    />
                    <label :for="`ai-store-${store.id}`" class="store-label">
                      {{ store.name }}
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="希望シフト">
            <div class="day-preferences">
              <div class="preferences-header">
                <h4>曜日別勤務設定</h4>
                <p class="preferences-description">
                  各曜日の勤務可否と希望時間を設定してください。
                  時間は24時間形式（例：09:00）で入力してください。
                </p>
              </div>

              <div class="preferences-container">
                <div
                  v-for="day in dayOptions"
                  :key="day.value"
                  class="day-preference-card"
                >
                  <div class="day-preference-header">
                    <div class="day-checkbox-wrapper">
                      <Checkbox
                        :id="`available-${day.value}`"
                        v-model="getDayPreferenceByDayOfWeek(day.value).available"
                        :binary="true"
                      />
                      <label :for="`available-${day.value}`" class="day-name">
                        {{ day.label }}
                      </label>
                    </div>
                    <div class="availability-status" :class="{ active: getDayPreferenceByDayOfWeek(day.value).available }">
                      {{ getDayPreferenceByDayOfWeek(day.value).available ? '勤務可' : '勤務不可' }}
                    </div>
                  </div>

                  <div
                    v-if="getDayPreferenceByDayOfWeek(day.value).available"
                    class="time-settings"
                  >
                    <div class="time-input-group">
                      <label class="time-label">開始時間</label>
                      <InputMask
                        v-model="getDayPreferenceByDayOfWeek(day.value).preferred_start_time"
                        mask="99:99"
                        placeholder="09:00"
                        class="time-input"
                      />
                    </div>
                    <div class="time-separator">〜</div>
                    <div class="time-input-group">
                      <label class="time-label">終了時間</label>
                      <InputMask
                        v-model="getDayPreferenceByDayOfWeek(day.value).preferred_end_time"
                        mask="99:99"
                        placeholder="18:00"
                        class="time-input"
                      />
                    </div>
                  </div>

                  <div
                    v-else
                    class="unavailable-message"
                  >
                    この曜日は勤務不可に設定されています
                  </div>
                </div>
              </div>

              <div class="preferences-note">
                <div class="note-icon">
                  <i class="pi pi-info-circle"></i>
                </div>
                <div class="note-content">
                  <p><strong>設定のヒント：</strong></p>
                  <ul>
                    <li>勤務可能な曜日にチェックを入れてください</li>
                    <li>希望時間が未入力の場合、AI生成時に店舗の営業時間内で自動設定されます</li>
                    <li>設定後もシフト管理画面で個別に調整可能です</li>
                  </ul>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="休み希望">
            <div class="day-off-requests">
              <div class="day-off-header">
                <h4>休み希望管理</h4>
                <Button
                  label="新しい休み希望を追加"
                  icon="pi pi-plus"
                  @click="addDayOffRequest"
                  class="p-button-success"
                  size="small"
                />
              </div>

              <div v-if="formData.day_off_requests.length === 0" class="no-requests">
                <div class="no-requests-icon">
                  <i class="pi pi-calendar-times"></i>
                </div>
                <p>休み希望がありません</p>
                <p class="no-requests-sub">上のボタンから新しい休み希望を追加できます</p>
              </div>

              <div
                v-for="(request, index) in formData.day_off_requests"
                :key="index"
                class="day-off-item"
              >
                <div class="day-off-content">
                  <div class="day-off-field">
                    <label class="field-label">日付</label>
                    <Calendar
                      v-model="request.date"
                      dateFormat="yy-mm-dd"
                      :showIcon="true"
                      placeholder="日付を選択"
                    />
                  </div>
                  <div class="day-off-field">
                    <label class="field-label">理由</label>
                    <InputText 
                      v-model="request.reason" 
                      placeholder="理由を入力してください"
                      class="reason-input"
                    />
                  </div>
                  <div class="day-off-field">
                    <label class="field-label">ステータス</label>
                    <Dropdown
                      v-model="request.status"
                      :options="dayOffStatusOptions"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="ステータス"
                    />
                  </div>
                  <div class="day-off-actions">
                    <Button
                      icon="pi pi-trash"
                      class="p-button-danger p-button-text p-button-rounded"
                      @click="removeDayOffRequest(index)"
                      title="削除"
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>
        </TabView>
      </div>

      <template #footer>
        <Button
          label="キャンセル"
          icon="pi pi-times"
          class="p-button-text"
          @click="dialogVisible = false"
        />
        <Button
          label="保存"
          icon="pi pi-check"
          @click="saveStaff"
          :loading="saving"
        />
      </template>
    </Dialog>

    <ConfirmDialog />
    <Toast />
  </div>
</template>

<script>
import { ref, reactive, onMounted, computed, watch } from 'vue';
import { useStore } from 'vuex';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

export default {
  name: 'StaffManagement',
  setup() {
    const store = useStore();
    const toast = useToast();
    const confirm = useConfirm();

    const staff = ref([]);
    const availableStores = ref([]);
    const loading = ref(false);
    const saving = ref(false);
    const dialogVisible = ref(false);
    const isEdit = ref(false);
    const submitted = ref(false);
    const globalFilter = ref('');
    const selectedStoreFilter = ref(null);

    const storeFilterOptions = computed(() => {
      return availableStores.value.map(store => ({
        id: store.id,
        name: store.name
      }));
    });

    const workableStores = computed(() => {
      if (!formData.store_ids || formData.store_ids.length === 0) {
        return [];
      }
      return availableStores.value.filter(store => 
        formData.store_ids.includes(store.id)
      );
    });

    const formData = reactive({
      id: null,
      first_name: '',
      last_name: '',
      furigana: '',
      gender: null,
      position: '',
      employment_type: null,
      max_hours_per_month: null,
      min_hours_per_month: null,
      max_hours_per_day: 8,
      max_consecutive_days: 5,
      store_ids: [],
      ai_generation_store_ids: [],
      day_preferences: [],
      day_off_requests: []
    });

    const genderOptions = ref([
      { label: '男性', value: '男性' },
      { label: '女性', value: '女性' },
      { label: 'その他', value: 'その他' }
    ]);

    const employmentOptions = ref([
      { label: '正社員', value: '正社員' },
      { label: 'パート', value: 'パート' },
      { label: 'アルバイト', value: 'アルバイト' },
      { label: '契約社員', value: '契約社員' }
    ]);

    const dayOptions = ref([
      { label: '日曜日', value: 0 },
      { label: '月曜日', value: 1 },
      { label: '火曜日', value: 2 },
      { label: '水曜日', value: 3 },
      { label: '木曜日', value: 4 },
      { label: '金曜日', value: 5 },
      { label: '土曜日', value: 6 }
    ]);

    const dayOffStatusOptions = ref([
      { label: '申請中', value: 'pending' },
      { label: '承認済み', value: 'approved' },
      { label: '却下', value: 'rejected' }
    ]);

    const initializeDayPreferences = () => {
      formData.day_preferences = dayOptions.value.map(day => ({
        day_of_week: day.value,
        available: true,
        preferred_start_time: '',
        preferred_end_time: ''
      }));
    };

    // 曜日に基づいて希望シフトデータを取得する関数（修正点）
    const getDayPreferenceByDayOfWeek = (dayOfWeek) => {
      const preference = formData.day_preferences.find(pref => pref.day_of_week === dayOfWeek);
      return preference || {
        day_of_week: dayOfWeek,
        available: true,
        preferred_start_time: '',
        preferred_end_time: ''
      };
    };

    const loadStaff = async () => {
      try {
        loading.value = true;
        const staffData = await store.dispatch('staff/fetchStaff', selectedStoreFilter.value);
        staff.value = staffData;
      } catch (error) {
        toast.add({
          severity: 'error',
          summary: 'エラー',
          detail: 'スタッフ一覧の取得に失敗しました',
          life: 3000
        });
      } finally {
        loading.value = false;
      }
    };

    const loadStores = async () => {
      try {
        const storeData = await store.dispatch('store/fetchStores');
        availableStores.value = storeData;
      } catch (error) {
        toast.add({
          severity: 'error',
          summary: 'エラー',
          detail: '店舗一覧の取得に失敗しました',
          life: 3000
        });
      }
    };

    const resetForm = () => {
      Object.assign(formData, {
        id: null,
        first_name: '',
        last_name: '',
        furigana: '',
        gender: null,
        position: '',
        employment_type: null,
        max_hours_per_month: null,
        min_hours_per_month: null,
        max_hours_per_day: 8,
        max_consecutive_days: 5,
        store_ids: [],
        ai_generation_store_ids: [],
        day_preferences: [],
        day_off_requests: []
      });
      initializeDayPreferences();
    };

    const openDialog = (staffData) => {
      resetForm();
      submitted.value = false;

      if (staffData) {
        isEdit.value = true;
        Object.assign(formData, {
          id: staffData.id,
          first_name: staffData.first_name,
          last_name: staffData.last_name,
          furigana: staffData.furigana,
          gender: staffData.gender,
          position: staffData.position,
          employment_type: staffData.employment_type,
          max_hours_per_month: staffData.max_hours_per_month,
          min_hours_per_month: staffData.min_hours_per_month,
          max_hours_per_day: staffData.max_hours_per_day,
          max_consecutive_days: staffData.max_consecutive_days,
          store_ids: staffData.store_ids || [],
          ai_generation_store_ids: staffData.ai_generation_store_ids || [],
          day_off_requests: (staffData.dayOffRequests || []).map(req => ({
            date: req.date,
            reason: req.reason,
            status: req.status
          }))
        });

        // 修正点：day_of_weekでソートしてからマッピング
        if (staffData.dayPreferences && staffData.dayPreferences.length > 0) {
          // バックエンドからのデータをday_of_week順にソート
          const sortedPreferences = [...staffData.dayPreferences].sort((a, b) => a.day_of_week - b.day_of_week);
          
          // 全曜日（0-6）のデータを確実に持つように初期化
          formData.day_preferences = dayOptions.value.map(day => {
            const existingPref = sortedPreferences.find(pref => pref.day_of_week === day.value);
            return existingPref || {
              day_of_week: day.value,
              available: true,
              preferred_start_time: '',
              preferred_end_time: ''
            };
          });
        } else {
          initializeDayPreferences();
        }
      } else {
        isEdit.value = false;
        if (availableStores.value.length > 0) {
          formData.store_ids = [availableStores.value[0].id];
        }
        initializeDayPreferences();
      }

      dialogVisible.value = true;
    };

    const addDayOffRequest = () => {
      formData.day_off_requests.push({
        date: null,
        reason: '',
        status: 'pending'
      });
    };

    const removeDayOffRequest = (index) => {
      formData.day_off_requests.splice(index, 1);
    };

    const saveStaff = async () => {
      submitted.value = true;

      if (!formData.first_name || !formData.last_name || !formData.store_ids.length) {
        toast.add({
          severity: 'warn',
          summary: '入力エラー',
          detail: '必須項目を入力してください',
          life: 3000
        });
        return;
      }

      try {
        saving.value = true;

        const staffData = {
          ...formData,
          store_id: formData.store_ids[0],
          day_preferences: formData.day_preferences,
          day_off_requests: formData.day_off_requests.filter(req => req.date)
        };

        if (isEdit.value) {
          await store.dispatch('staff/updateStaff', {
            id: formData.id,
            staffData
          });
          toast.add({
            severity: 'success',
            summary: '更新完了',
            detail: 'スタッフ情報を更新しました',
            life: 3000
          });
        } else {
          await store.dispatch('staff/createStaff', staffData);
          toast.add({
            severity: 'success',
            summary: '作成完了',
            detail: 'スタッフを作成しました',
            life: 3000
          });
        }

        dialogVisible.value = false;
        await loadStaff();
      } catch (error) {
        toast.add({
          severity: 'error',
          summary: 'エラー',
          detail: isEdit.value ? 'スタッフ情報の更新に失敗しました' : 'スタッフの作成に失敗しました',
          life: 3000
        });
      } finally {
        saving.value = false;
      }
    };

    const confirmDelete = (staffData) => {
      confirm.require({
        message: `${staffData.last_name} ${staffData.first_name}を削除しますか？`,
        header: '削除確認',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: async () => {
          try {
            await store.dispatch('staff/deleteStaff', staffData.id);
            toast.add({
              severity: 'success',
              summary: '削除完了',
              detail: 'スタッフを削除しました',
              life: 3000
            });
            await loadStaff();
          } catch (error) {
            toast.add({
              severity: 'error',
              summary: 'エラー',
              detail: 'スタッフの削除に失敗しました',
              life: 3000
            });
          }
        }
      });
    };

    const formatHours = (hours) => {
      return hours ? `${hours}h` : '-';
    };

    const getPositionSeverity = (position) => {
      switch (position) {
        case '店長': return 'danger';
        case 'マネージャー': return 'warning';
        case 'リーダー': return 'info';
        default: return 'secondary';
      }
    };

    const getEmploymentSeverity = (type) => {
      switch (type) {
        case '正社員': return 'success';
        case 'パート': return 'info';
        case 'アルバイト': return 'warning';
        case '契約社員': return 'secondary';
        default: return 'secondary';
      }
    };

    watch(
      () => formData.store_ids,
      (newStoreIds) => {
        if (formData.ai_generation_store_ids) {
          formData.ai_generation_store_ids = formData.ai_generation_store_ids.filter(
            id => newStoreIds.includes(id)
          );
        }
      },
      { deep: true }
    );

    onMounted(async () => {
      await loadStores();
      await loadStaff();
    });

    return {
      staff,
      availableStores,
      loading,
      saving,
      dialogVisible,
      isEdit,
      submitted,
      globalFilter,
      selectedStoreFilter,
      storeFilterOptions,
      workableStores,
      formData,
      genderOptions,
      employmentOptions,
      dayOptions,
      dayOffStatusOptions,
      loadStaff,
      loadStores,
      resetForm,
      openDialog,
      addDayOffRequest,
      removeDayOffRequest,
      saveStaff,
      confirmDelete,
      formatHours,
      getPositionSeverity,
      getEmploymentSeverity,
      getDayPreferenceByDayOfWeek
    };
  }
};
</script>

<style scoped>
.staff-management {
  padding: 1rem;
}

.staff-card {
  margin-bottom: 1rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
}

.filters-section {
  margin-bottom: 1rem;
  display: flex;
  gap: 1rem;
  align-items: center;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-item label {
  font-weight: 600;
  color: #374151;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.staff-table {
  margin-top: 1rem;
}

.store-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.store-tag {
  font-size: 0.75rem;
}

.ai-generation-tag {
  font-size: 0.75rem;
}

.action-buttons {
  display: flex;
  gap: 0.25rem;
}

.staff-dialog :deep(.p-dialog-content) {
  padding: 0;
}

.dialog-content {
  min-height: 500px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  padding: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 600;
  color: #374151;
}

.required {
  color: #ef4444;
}

.store-settings {
  padding: 1rem;
}

.store-section {
  margin-bottom: 1.5rem;
}

.store-section h4 {
  margin: 0 0 0.5rem 0;
  color: #374151;
  font-weight: 600;
}

.section-description {
  margin: 0 0 1rem 0;
  color: #6b7280;
  font-size: 0.875rem;
  line-height: 1.5;
}

.store-selection {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
}

.store-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.store-checkbox:hover {
  background-color: #f9fafb;
}

.store-label {
  font-weight: 500;
  color: #374151;
  cursor: pointer;
}

/* 希望シフトタブの改善されたスタイル */
.day-preferences {
  padding: 1.5rem;
  background-color: #f9fafb;
  min-height: 400px;
}

.preferences-header {
  margin-bottom: 2rem;
  text-align: center;
}

.preferences-header h4 {
  margin: 0 0 0.5rem 0;
  color: #1f2937;
  font-size: 1.25rem;
  font-weight: 700;
}

.preferences-description {
  margin: 0;
  color: #6b7280;
  font-size: 0.875rem;
  line-height: 1.5;
  max-width: 600px;
  margin: 0 auto;
}

.preferences-container {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  margin-bottom: 2rem;
}

.day-preference-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.25rem;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.day-preference-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.day-preference-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.day-checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.day-name {
  font-weight: 600;
  font-size: 1rem;
  color: #1f2937;
  cursor: pointer;
  user-select: none;
}

.availability-status {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  background-color: #fee2e2;
  color: #991b1b;
  transition: all 0.2s ease;
}

.availability-status.active {
  background-color: #dcfce7;
  color: #166534;
}

.time-settings {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 1rem;
  align-items: end;
  padding: 1rem;
  background-color: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.time-input-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.time-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #4b5563;
}

.time-input {
  width: 100%;
}

.time-separator {
  font-size: 1.125rem;
  font-weight: 500;
  color: #6b7280;
  text-align: center;
  padding-bottom: 0.25rem;
}

.unavailable-message {
  padding: 1rem;
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #991b1b;
  font-size: 0.875rem;
  text-align: center;
  font-style: italic;
}

.preferences-note {
  display: flex;
  gap: 1rem;
  padding: 1.25rem;
  background-color: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 12px;
  margin-top: 1rem;
}

.note-icon {
  color: #3b82f6;
  font-size: 1.25rem;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.note-content {
  flex: 1;
}

.note-content p {
  margin: 0 0 0.5rem 0;
  color: #1e40af;
  font-weight: 600;
  font-size: 0.875rem;
}

.note-content ul {
  margin: 0;
  padding-left: 1.25rem;
  color: #1e40af;
}

.note-content li {
  margin-bottom: 0.25rem;
  font-size: 0.8rem;
  line-height: 1.4;
}

/* 休み希望タブのスタイル */
.day-off-requests {
  padding: 1.5rem;
}

.day-off-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.day-off-header h4 {
  margin: 0;
  color: #1f2937;
  font-size: 1.25rem;
  font-weight: 700;
}

.no-requests {
  text-align: center;
  padding: 3rem 1rem;
  color: #6b7280;
}

.no-requests-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  color: #d1d5db;
}

.no-requests p {
  margin: 0.5rem 0;
}

.no-requests-sub {
  font-size: 0.875rem;
}

.day-off-item {
  margin-bottom: 1rem;
  padding: 1.25rem;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: white;
  transition: border-color 0.2s ease;
}

.day-off-item:hover {
  border-color: #3b82f6;
}

.day-off-content {
  display: grid;
  grid-template-columns: auto 2fr auto auto;
  gap: 1rem;
  align-items: end;
}

.day-off-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #4b5563;
}

.reason-input {
  min-width: 200px;
}

.day-off-actions {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* レスポンシブ対応 */
@media (max-width: 1200px) {
  .preferences-container {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .card-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .filters-section {
    flex-direction: column;
    align-items: stretch;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .store-selection {
    grid-template-columns: 1fr;
  }

  .preferences-container {
    grid-template-columns: 1fr;
  }

  .time-settings {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .time-separator {
    display: none;
  }

  .day-off-header {
    flex-direction: column;
    align-items: stretch;
  }

  .day-off-content {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .reason-input {
    min-width: auto;
  }

  .preferences-note {
    flex-direction: column;
    gap: 0.75rem;
  }
}

@media (max-width: 640px) {
  .staff-management {
    padding: 0.5rem;
  }

  .day-preferences,
  .day-off-requests {
    padding: 1rem;
  }

  .day-preference-card {
    padding: 1rem;
  }

  .preferences-header {
    margin-bottom: 1.5rem;
  }

  .preferences-header h4 {
    font-size: 1.125rem;
  }
}
</style>
