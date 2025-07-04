<template>
    <Dialog 
      v-model:visible="visible" 
      :header="isNew ? '新規スタッフ' : (isAdmin && isImpersonating ? '管理者編集モード' : 'スタッフ編集')"
      :modal="true" 
      class="p-fluid" 
      :style="{ width: '550px' }"
    >
      <!-- 既存のフォーム内容 -->
      
      <!-- 管理者が変更する場合のみ表示される理由フィールド -->
      <div v-if="isAdmin && isImpersonating" class="field">
        <label for="change_reason">変更理由 <span class="required-mark">*</span></label>
        <Textarea 
          id="change_reason" 
          v-model="changeReason" 
          rows="3" 
          :class="{ 'p-invalid': submitted && !changeReason }"
          placeholder="管理者として変更する理由を記入してください"
        />
        <small v-if="submitted && !changeReason" class="p-error">変更理由は必須です</small>
      </div>
      
      <template #footer>
        <Button 
          label="キャンセル" 
          icon="pi pi-times" 
          class="p-button-text" 
          @click="closeDialog" 
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
  </template>
  
  <script>
  import { mapGetters } from 'vuex';
  
  export default {
    data() {
      return {
        visible: false,
        isNew: false,
        staffData: {},
        submitted: false,
        saving: false,
        changeReason: ''
      };
    },
    
    computed: {
      ...mapGetters({
        isAdmin: 'auth/isAdmin',
        isImpersonating: 'auth/isImpersonating'
      })
    },
    
    methods: {
      openDialog(staff) {
        this.staffData = staff ? { ...staff } : {};
        this.isNew = !staff;
        this.changeReason = '';
        this.submitted = false;
        this.visible = true;
      },
      
      closeDialog() {
        this.visible = false;
      },
      
      async saveStaff() {
        this.submitted = true;
        
        // 基本バリデーション
        if (!this.staffData.first_name || !this.staffData.last_name) {
          return;
        }
        
        // 管理者モードで変更理由が必要
        if (this.isAdmin && this.isImpersonating && !this.changeReason) {
          return;
        }
        
        this.saving = true;
        
        try {
          // 変更データの作成
          const staffData = { ...this.staffData };
          
          // 管理者モードの場合は変更理由を追加
          if (this.isAdmin && this.isImpersonating) {
            staffData.change_reason = this.changeReason;
          }
          
          if (this.isNew) {
            await this.$axios.post('/api/staff', staffData);
            this.$emit('staff-created');
          } else {
            const url = `/api/staff/${this.staffData.id}`;
            const params = this.isImpersonating ? { impersonation: true } : {};
            await this.$axios.put(url, staffData, { params });
            this.$emit('staff-updated');
          }
          
          this.closeDialog();
          this.$toast.add({
            severity: 'success',
            summary: this.isNew ? '作成完了' : '更新完了',
            detail: this.isNew ? 'スタッフを作成しました' : 'スタッフ情報を更新しました',
            life: 3000
          });
        } catch (error) {
          console.error(this.isNew ? 'スタッフ作成エラー:' : 'スタッフ更新エラー:', error);
          this.$toast.add({
            severity: 'error',
            summary: 'エラー',
            detail: this.isNew ? 'スタッフの作成に失敗しました' : 'スタッフ情報の更新に失敗しました',
            life: 3000
          });
        } finally {
          this.saving = false;
        }
      }
    }
  };
  </script>
  
  <style scoped>
  .required-mark {
    color: var(--red-500);
  }
  </style>