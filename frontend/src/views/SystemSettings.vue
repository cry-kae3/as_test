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
import api from '@/services/api';

export default {
  name: 'SystemSettings',
  components: {
    InputNumber,
    ProgressSpinner
  },
  setup() {
    const toast = useToast();
    
    const loading = ref(false);
    const saving = ref(false);
    const submitted = ref(false);
    const originalSettings = ref({});
    
    const settings = reactive({
      closing_day: 25,
      additional_settings: {}
    });

    const fetchSettings = async () => {
      loading.value = true;
      
      try {
        const response = await api.get('/system-settings');
        const data = response.data;
        
        settings.closing_day = data.closing_day;
        settings.additional_settings = data.additional_settings || {};
        
        originalSettings.value = { ...settings };
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
      
      saving.value = true;
      
      try {
        await api.put('/system-settings', {
          closing_day: settings.closing_day,
          timezone: 'Asia/Tokyo',
          additional_settings: settings.additional_settings
        });
        
        originalSettings.value = { ...settings };
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
      settings.closing_day = originalSettings.value.closing_day;
      settings.additional_settings = originalSettings.value.additional_settings;
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

.closing-day-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.closing-day-suffix {
  font-size: 0.95rem;
  color: var(--text-color-secondary);
}

.form-help {
  font-size: 0.85rem;
  color: var(--text-color-secondary);
  line-height: 1.4;
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--surface-border);
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
    margin-left: 0 !important;
  }
}
</style>