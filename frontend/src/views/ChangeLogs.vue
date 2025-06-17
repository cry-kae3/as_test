<template>
    <div class="change-logs">
      <h1 class="page-title">変更ログ</h1>
      
      <DataTable 
        :value="logs" 
        :paginator="true" 
        :rows="10" 
        :rowsPerPageOptions="[5, 10, 20, 50]"
        dataKey="id" 
        :loading="loading"
        filterDisplay="menu"
        :filters="filters"
        :globalFilterFields="['admin_name', 'user_name', 'field_changed', 'change_reason']"
      >
        <template #header>
          <div class="table-header-container">
            <Button icon="pi pi-refresh" class="p-button-outlined" @click="fetchLogs" />
            <span class="p-input-icon-left">
              <i class="pi pi-search" />
              <InputText v-model="filters['global'].value" placeholder="検索..." />
            </span>
          </div>
        </template>
        
        <Column field="created_at" header="日時" sortable style="min-width: 150px">
          <template #body="{ data }">
            {{ formatDateTime(data.created_at) }}
          </template>
          <template #filter="{ filterModel, filterCallback }">
            <Calendar 
              v-model="filterModel.value" 
              dateFormat="yy-mm-dd" 
              placeholder="日付を選択"
              @date-select="filterCallback()"
            />
          </template>
        </Column>
        
        <Column field="admin_name" header="変更者" sortable style="min-width: 120px">
          <template #filter="{ filterModel, filterCallback }">
            <InputText 
              v-model="filterModel.value" 
              @input="filterCallback()" 
              placeholder="変更者で検索"
            />
          </template>
        </Column>
        
        <Column field="user_name" header="対象ユーザー" sortable style="min-width: 120px">
          <template #filter="{ filterModel, filterCallback }">
            <InputText 
              v-model="filterModel.value" 
              @input="filterCallback()" 
              placeholder="対象ユーザーで検索"
            />
          </template>
        </Column>
        
        <Column field="change_type" header="操作種別" sortable style="min-width: 120px">
          <template #body="{ data }">
            <Tag 
              :severity="getChangeTypeSeverity(data.change_type)" 
              :value="getChangeTypeLabel(data.change_type)"
            />
          </template>
          <template #filter="{ filterModel, filterCallback }">
            <Dropdown 
              v-model="filterModel.value" 
              @change="filterCallback()"
              :options="changeTypes" 
              placeholder="全て"
              class="p-column-filter"
            />
          </template>
        </Column>
        
        <Column field="field_changed" header="変更項目" sortable style="min-width: 120px">
          <template #filter="{ filterModel, filterCallback }">
            <InputText 
              v-model="filterModel.value" 
              @input="filterCallback()" 
              placeholder="変更項目で検索"
            />
          </template>
        </Column>
        
        <Column field="previous_value" header="変更前" style="min-width: 150px" />
        <Column field="new_value" header="変更後" style="min-width: 150px" />
        
        <Column field="impersonation_mode" header="閲覧モード" style="min-width: 100px">
          <template #body="{ data }">
            <span v-if="data.impersonation_mode">
              <i class="pi pi-eye" style="color: var(--primary-color);"></i> 閲覧モード
            </span>
            <span v-else>
              <i class="pi pi-user-edit" style="color: var(--text-color-secondary);"></i> 直接編集
            </span>
          </template>
          <template #filter="{ filterModel, filterCallback }">
            <TriStateCheckbox 
              v-model="filterModel.value" 
              @change="filterCallback()"
            />
          </template>
        </Column>
        
        <Column field="change_reason" header="変更理由" style="min-width: 200px">
          <template #filter="{ filterModel, filterCallback }">
            <InputText 
              v-model="filterModel.value" 
              @input="filterCallback()" 
              placeholder="変更理由で検索"
            />
          </template>
        </Column>
      </DataTable>
    </div>
  </template>
  
  <script>
  import { FilterMatchMode, FilterOperator } from 'primevue/api';
  
  export default {
    data() {
      return {
        logs: [],
        loading: false,
        changeTypes: ['create', 'update', 'delete'],
        filters: {
          global: { value: null, matchMode: FilterMatchMode.CONTAINS },
          admin_name: { value: null, matchMode: FilterMatchMode.CONTAINS },
          user_name: { value: null, matchMode: FilterMatchMode.CONTAINS },
          change_type: { value: null, matchMode: FilterMatchMode.EQUALS },
          field_changed: { value: null, matchMode: FilterMatchMode.CONTAINS },
          impersonation_mode: { value: null, matchMode: FilterMatchMode.EQUALS },
          change_reason: { value: null, matchMode: FilterMatchMode.CONTAINS },
          created_at: { value: null, matchMode: FilterMatchMode.DATE_IS }
        }
      };
    },
    
    methods: {
      async fetchLogs() {
        this.loading = true;
        
        try {
          const response = await this.$axios.get('/api/admin/change-logs');
          this.logs = response.data;
        } catch (error) {
          console.error('変更ログ取得エラー:', error);
          this.$toast.add({
            severity: 'error',
            summary: 'エラー',
            detail: '変更ログの取得に失敗しました',
            life: 3000
          });
        } finally {
          this.loading = false;
        }
      },
      
      formatDateTime(dateTime) {
        if (!dateTime) return '';
        const date = new Date(dateTime);
        return new Intl.DateTimeFormat('ja-JP', {
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }).format(date);
      },
      
      getChangeTypeLabel(type) {
        const labels = {
          'create': '新規作成',
          'update': '更新',
          'delete': '削除'
        };
        return labels[type] || type;
      },
      
      getChangeTypeSeverity(type) {
        const severities = {
          'create': 'success',
          'update': 'info',
          'delete': 'danger'
        };
        return severities[type] || 'info';
      }
    },
    
    mounted() {
      this.fetchLogs();
    }
  };
  </script>
  
  <style scoped>
  .change-logs {
    padding: 1rem;
  }
  
  .page-title {
    margin-bottom: 1.5rem;
  }
  
  .table-header-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 0.5rem;
  }
  </style>