<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    :header="shiftData.title"
    :modal="true"
    class="shift-editor-dialog"
    :style="{ width: '500px' }"
    :closable="!saving"
  >
    <div class="shift-editor-form">
      <div v-if="shiftData.isPast" class="status-alert warning">
        <i class="pi pi-exclamation-triangle"></i>
        <span>過去の日付を編集しています。変更は履歴に記録されます。</span>
      </div>

      <div class="time-inputs-section">
        <div class="time-input-group">
          <label class="form-label">勤務開始</label>
          <div class="time-selector">
            <Dropdown
              :modelValue="shiftData.startTimeHour"
              @update:modelValue="shiftData.startTimeHour = $event"
              :options="hourOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="時"
              class="time-dropdown"
              @change="handleShiftTimeChange"
            />
            <span class="time-separator">:</span>
            <Dropdown
              :modelValue="shiftData.startTimeMinute"
              @update:modelValue="shiftData.startTimeMinute = $event"
              :options="minuteOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="分"
              class="time-dropdown"
              @change="handleShiftTimeChange"
            />
          </div>
        </div>

        <div class="time-input-group">
          <label class="form-label">勤務終了</label>
          <div class="time-selector">
            <Dropdown
              :modelValue="shiftData.endTimeHour"
              @update:modelValue="shiftData.endTimeHour = $event"
              :options="hourOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="時"
              class="time-dropdown"
              @change="handleShiftTimeChange"
            />
            <span class="time-separator">:</span>
            <Dropdown
              :modelValue="shiftData.endTimeMinute"
              @update:modelValue="shiftData.endTimeMinute = $event"
              :options="minuteOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="分"
              class="time-dropdown"
              @change="handleShiftTimeChange"
            />
          </div>
        </div>

        <Divider />

        <div class="form-group break-settings-group">
          <div class="checkbox-group">
            <Checkbox
              :modelValue="shiftData.hasBreak"
              @update:modelValue="shiftData.hasBreak = $event"
              :binary="true"
              inputId="hasBreakCheck"
            />
            <label for="hasBreakCheck" class="checkbox-label"
              >休憩を設定する</label
            >
          </div>

          <div
            class="break-time-inputs"
            :class="{ disabled: !shiftData.hasBreak }"
          >
            <div class="time-selector">
              <Dropdown
                :modelValue="shiftData.breakStartTimeHour"
                @update:modelValue="shiftData.breakStartTimeHour = $event"
                :options="hourOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="休憩開始 時"
                class="time-dropdown"
                showClear
                :disabled="!shiftData.hasBreak"
              />
              <span class="time-separator">:</span>
              <Dropdown
                :modelValue="shiftData.breakStartTimeMinute"
                @update:modelValue="shiftData.breakStartTimeMinute = $event"
                :options="minuteOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="分"
                class="time-dropdown"
                showClear
                :disabled="!shiftData.hasBreak"
              />
            </div>
            <div class="time-selector mt-2">
              <Dropdown
                :modelValue="shiftData.breakEndTimeHour"
                @update:modelValue="shiftData.breakEndTimeHour = $event"
                :options="hourOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="休憩終了 時"
                class="time-dropdown"
                showClear
                :disabled="!shiftData.hasBreak"
              />
              <span class="time-separator">:</span>
              <Dropdown
                :modelValue="shiftData.breakEndTimeMinute"
                @update:modelValue="shiftData.breakEndTimeMinute = $event"
                :options="minuteOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="分"
                class="time-dropdown"
                showClear
                :disabled="!shiftData.hasBreak"
              />
            </div>
          </div>
        </div>
      </div>

      <div v-if="shiftData.isPast" class="form-group">
        <label class="form-label">変更理由</label>
        <Textarea
          :modelValue="shiftData.changeReason"
          @update:modelValue="shiftData.changeReason = $event"
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
          @click="$emit('clear')"
          :disabled="saving || !shiftData.hasShift"
        />
        <Button
          label="キャンセル"
          icon="pi pi-times"
          class="cancel-button"
          @click="$emit('close')"
          :disabled="saving"
        />
        <Button
          label="保存"
          icon="pi pi-check"
          class="save-button"
          @click="$emit('save', shiftData)"
          :loading="saving"
        />
      </div>
    </template>
  </Dialog>
</template>

<script>
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import Dropdown from 'primevue/dropdown';
import Checkbox from 'primevue/checkbox';
import Textarea from 'primevue/textarea';
import Divider from 'primevue/divider';

export default {
  name: 'ShiftEditorDialog',
  components: {
    Dialog,
    Button,
    Dropdown,
    Checkbox,
    Textarea,
    Divider,
  },
  props: {
    visible: Boolean,
    saving: Boolean,
    shiftData: Object,
    hourOptions: Array,
    minuteOptions: Array,
  },
  emits: [
    'update:visible',
    'close',
    'save',
    'clear',
  ],
  methods: {
    handleShiftTimeChange() {
      if (!this.shiftData.hasBreak) {
        this.shiftData.breakStartTimeHour = "";
        this.shiftData.breakStartTimeMinute = "";
        this.shiftData.breakEndTimeHour = "";
        this.shiftData.breakEndTimeMinute = "";
      }
    },
  },
};
</script>

<style scoped lang="scss">
.shift-editor-dialog :deep(.p-dialog-content) {
  padding: 1.5rem;
}

.shift-editor-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.status-alert {
  padding: 1rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 500;
  font-size: 0.875rem;
}

.status-alert.warning {
  background: #fef3c7;
  color: #78350f;
  border: 1px solid #fbbf24;
}

.time-inputs-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.time-input-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-weight: 600;
  color: #1e293b;
  font-size: 0.875rem;
}

.time-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #f9fafb;
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  max-width: 300px;
}

.time-dropdown {
  flex: 1;
}

.time-separator {
  font-size: 1.25rem;
  font-weight: 600;
  color: #64748b;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.break-settings-group {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.checkbox-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.checkbox-label {
  font-weight: 500;
  color: #475569;
  cursor: pointer;
  font-size: 0.875rem;
}

.break-time-inputs {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition: opacity 0.2s;
}

.break-time-inputs.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.mt-2 {
  margin-top: 0.5rem;
}

.form-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.875rem;
  resize: vertical;
}

.form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.dialog-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding-top: 0.5rem;
}

.delete-button,
.cancel-button,
.save-button {
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.2s;
  cursor: pointer;
}

.delete-button {
  background: #ef4444;
  color: white;
  border: 1px solid #ef4444;
  margin-right: auto;
}

.delete-button:hover:not(:disabled) {
  background: #dc2626;
  border-color: #dc2626;
  transform: translateY(-1px);
  box-shadow: 0 2px 5px rgba(239, 68, 68, 0.3);
}

.delete-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.cancel-button {
  background: white;
  color: #64748b;
  border: 1px solid #e5e7eb;
}

.cancel-button:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #cbd5e1;
}

.save-button {
  background: #10b981;
  color: white;
  border: 1px solid #10b981;
}

.save-button:hover:not(:disabled) {
  background: #059669;
  border-color: #059669;
}
</style>