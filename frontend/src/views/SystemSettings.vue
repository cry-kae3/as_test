<template>
  <div class="system-settings">
    <div class="page-header">
      <h1 class="page-title">システム設定</h1>
    </div>

    <div v-if="loading" class="loading-container">
      <ProgressSpinner />
      <span class="loading-text">読み込み中...</span>
    </div>

    <div v-else class="settings-container">
      <Card>
        <template #title>
          <div class="card-title">
            <i class="pi pi-cog mr-2"></i>
            基本設定
          </div>
        </template>
        <template #content>
          <div class="settings-form">
            <div class="field">
              <label for="closing_day">締め日 <span class="required-mark">*</span></label>
              <div class="closing-day-container">
                <InputNumber
                  id="closing_day"
                  v-model="settings.closing_day"
                  :min="1"
                  :max="31"
                  showButtons
                  :class="{ 'p-invalid': submitted && !settings.closing_day }"
                />
                <span class="closing-day-suffix">日</span>
              </div>
              <small class="form-help">
                シフト期間の締め日を設定します。例：25日に設定すると、25日〜翌月24日までがシフト期間になります。
              </small>
              <small v-if="submitted && !settings.closing_day" class="p-error">
                締め日は必須です
              </small>
            </div>

            <div class="field">
              <label for="min_daily_hours">1日最低勤務時間 <span class="required-mark">*</span></label>
              <div class="min-hours-container">
                <InputNumber
                  id="min_daily_hours"
                  v-model="settings.min_daily_hours"
                  :min="1.0"
                  :max="12.0"
                  :minFractionDigits="1"
                  :maxFractionDigits="1"
                  :step="0.5"
                  showButtons
                  :class="{ 'p-invalid': submitted && !settings.min_daily_hours }"
                />
                <span class="min-hours-suffix">時間</span>
              </div>
              <small class="form-help">
                スタッフがシフトに入る場合の1日あたりの最低勤務時間を設定します。AI生成時にこの時間以上の勤務となるようシフトが組まれます。
              </small>
              <small v-if="submitted && !settings.min_daily_hours" class="p-error">
                最低勤務時間は必須です
              </small>
            </div>

            <div class="field">
              <label for="auto_set_break_time">AIシフト生成時の休憩自動設定</label>
              <div class="flex align-items-center">
                <InputSwitch id="auto_set_break_time" v-model="settings.additional_settings.auto_set_break_time" />
                <span class="ml-2">{{ settings.additional_settings.auto_set_break_time ? '有効' : '無効' }}</span>
              </div>
              <small class="form-help">
                有効にすると、AIがシフトを生成する際に日本の労働法に基づき自動で休憩時間を設定します。
              </small>
            </div>
          </div>
        </template>
      </Card>

      <div class="action-buttons">
        <Button
          label="保存"
          icon="pi pi-save"
          class="p-button-primary"
          @click="saveSettings"
          :loading="saving"
        />
        <Button
          label="リセット"
          icon="pi pi-refresh"
          class="p-button-secondary ml-2"
          @click="resetSettings"
          :disabled="saving"
        />
      </div>
    </div>

    <Toast />
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import InputNumber from 'primevue/inputnumber';
import ProgressSpinner from 'primevue/progressspinner';
import InputSwitch from 'primevue/inputswitch';
import api from '@/services/api';

export default {
  name: 'SystemSettings',
  components: {
    InputNumber,
    ProgressSpinner,
    InputSwitch
  },
  setup() {
    const toast = useToast();
    
    const loading = ref(false);
    const saving = ref(false);
    const submitted = ref(false);
    const originalSettings = ref({});
    
    const settings = reactive({
      closing_day: null,
      min_daily_hours: null,
      additional_settings: {
        auto_set_break_time: true
      }
    });

    const fetchSettings = async () => {
      loading.value = true;
      
      try {
        const response = await api.get('/system-settings');
        const data = response.data;
        
        settings.closing_day = data.closing_day;
        settings.min_daily_hours = data.min_daily_hours;
        settings.additional_settings = {
          auto_set_break_time: true,
          ...(data.additional_settings || {})
        };
        
        originalSettings.value = JSON.parse(JSON.stringify(settings));
      } catch (error) {
        console.error('システム設定取得エラー:', error);
        toast.add({
          severity: 'error',
          summary: 'エラー',
          detail: 'システム設定の取得に失敗しました',
          life: 3000
        });
      } finally {
        loading.value = false;
      }
    };

    const saveSettings = async () => {
      submitted.value = true;
      
      if (!settings.closing_day || settings.closing_day < 1 || settings.closing_day > 31) {
        toast.add({
          severity: 'error',
          summary: 'バリデーションエラー',
          detail: '締め日は1-31の範囲で入力してください',
          life: 3000
        });
        return;
      }

      if (!settings.min_daily_hours || settings.min_daily_hours < 1.0 || settings.min_daily_hours > 12.0) {
        toast.add({
          severity: 'error',
          summary: 'バリデーションエラー',
          detail: '最低勤務時間は1.0-12.0時間の範囲で入力してください',
          life: 3000
        });
        return;
      }
      
      saving.value = true;
      
      try {
        await api.put('/system-settings', {
          closing_day: settings.closing_day,
          min_daily_hours: settings.min_daily_hours,
          timezone: 'Asia/Tokyo',
          additional_settings: settings.additional_settings
        });
        
        originalSettings.value = JSON.parse(JSON.stringify(settings));
        submitted.value = false;
        
        toast.add({
          severity: 'success',
          summary: '保存完了',
          detail: 'システム設定を保存しました',
          life: 3000
        });
      } catch (error) {
        console.error('システム設定保存エラー:', error);
        toast.add({
          severity: 'error',
          summary: 'エラー',
          detail: 'システム設定の保存に失敗しました',
          life: 3000
        });
      } finally {
        saving.value = false;
      }
    };

    const resetSettings = () => {
      const original = JSON.parse(JSON.stringify(originalSettings.value));
      settings.closing_day = original.closing_day;
      settings.min_daily_hours = original.min_daily_hours;
      settings.additional_settings = original.additional_settings;
      submitted.value = false;
      
      toast.add({
        severity: 'info',
        summary: 'リセット完了',
        detail: '設定を元に戻しました',
        life: 2000
      });
    };

    onMounted(() => {
      fetchSettings();
    });

    return {
      loading,
      saving,
      submitted,
      settings,
      saveSettings,
      resetSettings
    };
  }
};
</script>

<style scoped>

.system-settings {
  padding: 1rem;
  max-width: 800px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
}

.page-title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--text-color);
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  gap: 1rem;
}

.loading-text {
  color: var(--text-color-secondary);
  font-size: 1rem;
}

.settings-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.card-title {
  display: flex;
  align-items: center;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-color);
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field label {
  font-weight: 500;
  color: var(--text-color);
  font-size: 0.95rem;
}

.required-mark {
  color: var(--red-500);
}

.closing-day-container,
.min-hours-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.closing-day-suffix,
.min-hours-suffix {
  font-size: 0.95rem;
  color: var(--text-color-secondary);
}

.form-help {
  color: var(--text-color-secondary);
  font-size: 0.875rem;
  line-height: 1.4;
  margin-top: 0.25rem;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  padding-top: 1rem;
}

.closing-day-container .p-inputnumber,
.min-hours-container .p-inputnumber {
  width: 120px;
}

.closing-day-container .p-inputnumber input,
.min-hours-container .p-inputnumber input {
  text-align: center;
  font-weight: 600;
}

.p-invalid {
  border-color: var(--red-500) !important;
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2) !important;
}

.p-error {
  color: var(--red-500);
  font-size: 0.8rem;
  margin-top: 0.25rem;
}

.action-buttons .p-button {
  padding: 0.75rem 1.5rem;
  font-weight: 500;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.action-buttons .p-button-primary {
  background: var(--primary-color);
  border-color: var(--primary-color);
}

.action-buttons .p-button-primary:hover:not(:disabled) {
  background: var(--primary-600);
  border-color: var(--primary-600);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(var(--primary-rgb), 0.3);
}

.action-buttons .p-button-secondary {
  background: var(--surface-0);
  border-color: var(--surface-300);
  color: var(--text-color);
}

.action-buttons .p-button-secondary:hover:not(:disabled) {
  background: var(--surface-100);
  border-color: var(--surface-400);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.settings-container .p-card {
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--surface-200);
}

.settings-container .p-card .p-card-title {
  padding: 1.5rem 1.5rem 0;
  border-bottom: 1px solid var(--surface-200);
  margin-bottom: 0;
  padding-bottom: 1rem;
}

.settings-container .p-card .p-card-content {
  padding: 1.5rem;
}

@media (max-width: 768px) {
  .system-settings {
    padding: 0.5rem;
  }
  
  .page-title {
    font-size: 1.5rem;
  }
  
  .action-buttons {
    flex-direction: column;
  }
  
  .action-buttons .p-button {
    width: 100%;
    justify-content: center;
  }
  
  .closing-day-container,
  .min-hours-container {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  
  .closing-day-container .p-inputnumber,
  .min-hours-container .p-inputnumber {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .settings-container .p-card .p-card-title,
  .settings-container .p-card .p-card-content {
    padding: 1rem;
  }
  
  .settings-form {
    gap: 1.25rem;
  }
  
  .card-title {
    font-size: 1.125rem;
  }
}
</style>