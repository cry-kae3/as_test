<template>
    <div class="all-staff-shift-summary">
      <div class="summary-header">
        <h3>
          <i class="pi pi-chart-bar"></i>
          全スタッフのシフト状況 ({{ currentYear }}年{{ currentMonth }}月)
        </h3>
      </div>
  
      <!-- フィルター・検索パネル -->
      <div class="table-controls-panel">
        <div class="search-filters">
          <div class="search-group">
            <label class="search-label">スタッフ名検索</label>
            <InputText
              v-model="allStaffTableFilters.searchName"
              placeholder="名前を入力..."
              class="search-input"
            />
          </div>
  
          <div class="search-group">
            <label class="search-label">店舗名検索</label>
            <InputText
              v-model="allStaffTableFilters.searchStore"
              placeholder="店舗名を入力..."
              class="search-input"
            />
          </div>
  
          <div class="filter-group">
            <label class="search-label">ステータス</label>
            <Dropdown
              v-model="allStaffTableFilters.statusFilter"
              :options="statusFilterOptions"
              optionLabel="label"
              optionValue="value"
              class="status-filter"
            />
          </div>
  
          <div class="filter-group">
            <label class="search-label">並び順</label>
            <Dropdown
              v-model="allStaffTableFilters.sortBy"
              :options="sortOptions"
              optionLabel="label"
              optionValue="value"
              class="sort-filter"
            />
          </div>
  
          <div class="filter-actions">
            <Button
              icon="pi pi-refresh"
              label="リセット"
              class="p-button-outlined p-button-sm"
              @click="resetAllStaffFilters"
            />
          </div>
        </div>
  
        <div class="table-summary">
          <span class="summary-text">
            {{ filteredAndSortedAllStaff.length }} /
            {{ allStaff.length }} 名のスタッフを表示
          </span>
        </div>
      </div>
  
      <div class="all-staff-table-container">
        <table class="all-staff-table">
          <thead>
            <tr>
              <th
                class="staff-name-col sortable-header"
                @click="toggleSort('name')"
              >
                <div class="header-content">
                  <span>スタッフ名</span>
                  <i :class="getSortIcon('name')"></i>
                </div>
              </th>
              <th class="store-hours-col">各店舗勤務時間</th>
              <th
                class="total-hours-col sortable-header"
                @click="toggleSort('totalHours')"
              >
                <div class="header-content">
                  <span>合計時間</span>
                  <i :class="getSortIcon('totalHours')"></i>
                </div>
              </th>
              <th class="target-range-col">目標範囲</th>
              <th
                class="status-col sortable-header"
                @click="toggleSort('status')"
              >
                <div class="header-content">
                  <span>状態</span>
                  <i :class="getSortIcon('status')"></i>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="staff in filteredAndSortedAllStaff"
              :key="`all-summary-${staff.id}`"
              class="all-staff-row"
              :class="{
                'has-warnings': hasStaffWarningsForAllSystemStaff(staff, 0),
                'hours-violation': isHoursOutOfRangeForAllSystemStaff(
                  staff,
                  0
                ).isUnder || isHoursOutOfRangeForAllSystemStaff(
                  staff,
                  0
                ).isOver,
              }"
            >
              <!-- スタッフ名 -->
              <td class="staff-name-cell">
                <div class="staff-info-inline">
                  <div class="staff-avatar-table">
                    {{ staff.first_name.charAt(0) }}
                  </div>
                  <span class="staff-name-text">
                    {{ staff.last_name }} {{ staff.first_name }}
                  </span>
                </div>
              </td>
  
              <!-- 各店舗勤務時間 -->
              <td class="store-hours-cell">
                <div class="store-hours-list">
                  <div
                    v-for="breakdown in getStoreBreakdownForStaff(staff.id)"
                    :key="breakdown.storeId"
                    class="store-hours-item"
                  >
                    <span class="store-name-table"
                      >{{ breakdown.storeName }}:</span
                    >
                    <span class="store-hours-table">{{
                      formatHours(breakdown.hours)
                    }}</span>
                  </div>
                  <div
                    v-if="
                      getStoreBreakdownForStaff(staff.id).length === 0
                    "
                    class="no-hours"
                  >
                    <span class="no-hours-text">勤務なし</span>
                  </div>
                </div>
              </td>
  
              <!-- 合計時間 -->
              <td class="total-hours-cell">
                <span
                  class="total-hours-value-table"
                  :class="{
                    'out-of-range': isHoursOutOfRangeForAllSystemStaff(
                      staff,
                      0
                    ).isUnder || isHoursOutOfRangeForAllSystemStaff(
                      staff,
                      0
                    ).isOver,
                  }"
                >
                  {{
                    formatHours(
                      calculateTotalHoursForAllSystemStaff(staff.id, 0).totalHours
                    )
                  }}
                </span>
              </td>
  
              <!-- 目標範囲 -->
              <td class="target-range-cell">
                <span class="target-range-text">
                  {{ formatHours(staff.min_hours_per_month || 0) }} -
                  {{ formatHours(staff.max_hours_per_month || 0) }}
                </span>
              </td>
              <td class="status-cell">
                <div class="status-indicators">
                  <div
                    :class="[
                      'status-indicator',
                      getStatusClass(staff),
                    ]"
                    :title="getStatusTitle(staff)"
                  >
                    <i :class="getStatusIcon(staff)"></i>
                    <span class="status-text">{{
                      getStatusText(staff)
                    }}</span>
                  </div>
                </div>
              </td>
            </tr>
  
            <!-- データがない場合の表示 -->
            <tr
              v-if="filteredAndSortedAllStaff.length === 0"
              class="no-data-row"
            >
              <td colspan="5" class="no-data-cell">
                <div class="no-data-content">
                  <i class="pi pi-info-circle"></i>
                  <span v-if="allStaff.length === 0">
                    データがありません
                  </span>
                  <span v-else>
                    検索条件に一致するスタッフが見つかりません
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </template>
  
  <script>
  import { reactive, computed, nextTick } from 'vue';
  import InputText from 'primevue/inputtext';
  import Dropdown from 'primevue/dropdown';
  import Button from 'primevue/button';
  
  export default {
    name: 'AllStaffSummary',
    components: {
      InputText,
      Dropdown,
      Button,
    },
    props: {
      currentYear: Number,
      currentMonth: Number,
      allStaff: Array,
      getAllStoreHoursBreakdownForAllStaff: Function,
      calculateTotalHoursForAllSystemStaff: Function,
      isHoursOutOfRangeForAllSystemStaff: Function,
      hasStaffWarningsForAllSystemStaff: Function,
      getStaffWarningsForAllSystemStaff: Function,
      getStaffStatus: Function,
      getStaffStatusInfo: Function,
      formatHours: Function,
    },
    setup(props) {
      // フィルタリング・ソート設定
      const allStaffTableFilters = reactive({
        searchName: "",
        searchStore: "",
        statusFilter: "all",
        sortBy: "name",
        sortOrder: "asc",
      });
  
      const statusFilterOptions = [
        { label: "すべて", value: "all" },
        { label: "正常", value: "normal" },
        { label: "要確認", value: "warning" },
        { label: "違反あり", value: "violation" },
      ];
  
      const sortOptions = [
        { label: "スタッフ名", value: "name" },
        { label: "合計時間", value: "totalHours" },
        { label: "勤務店舗数", value: "storeCount" },
        { label: "ステータス", value: "status" },
      ];

      // 全店舗の時間内訳を取得
      const getStoreBreakdownForStaff = (staffId) => {
        const allBreakdowns = props.getAllStoreHoursBreakdownForAllStaff();
        const staffBreakdown = allBreakdowns[staffId];
        
        if (!staffBreakdown || !staffBreakdown.stores) {
          return [];
        }

        return staffBreakdown.stores.map(store => ({
          storeId: store.id,
          storeName: store.name,
          hours: store.hours
        }));
      };
  
      // フィルタリング・ソート処理
      const filteredAndSortedAllStaff = computed(() => {
        let filtered = [...props.allStaff];
  
        // 名前検索
        if (allStaffTableFilters.searchName.trim()) {
          const searchTerm = allStaffTableFilters.searchName.toLowerCase();
          filtered = filtered.filter((staff) =>
            `${staff.last_name} ${staff.first_name}`
              .toLowerCase()
              .includes(searchTerm)
          );
        }
  
        // 店舗検索
        if (allStaffTableFilters.searchStore.trim()) {
          const searchTerm = allStaffTableFilters.searchStore.toLowerCase();
          filtered = filtered.filter((staff) => {
            const breakdown = getStoreBreakdownForStaff(staff.id);
            return breakdown.some((item) => 
              item.storeName.toLowerCase().includes(searchTerm)
            );
          });
        }
  
        // ステータス絞込み
        if (allStaffTableFilters.statusFilter !== "all") {
          filtered = filtered.filter((staff) => {
            const status = getFilterStatus(staff);
            return status === allStaffTableFilters.statusFilter;
          });
        }
  
        // ソート処理
        filtered.sort((a, b) => {
          let aValue, bValue;
  
          switch (allStaffTableFilters.sortBy) {
            case "name":
              aValue = `${a.last_name} ${a.first_name}`;
              bValue = `${b.last_name} ${b.first_name}`;
              break;
            case "totalHours":
              aValue = props.calculateTotalHoursForAllSystemStaff(a.id, 0).totalHours;
              bValue = props.calculateTotalHoursForAllSystemStaff(b.id, 0).totalHours;
              break;
            case "storeCount":
              aValue = getStoreBreakdownForStaff(a.id).length;
              bValue = getStoreBreakdownForStaff(b.id).length;
              break;
            case "status":
              aValue = getStaffStatusPriority(a);
              bValue = getStaffStatusPriority(b);
              break;
            default:
              return 0;
          }
  
          if (typeof aValue === "string") {
            const result = aValue.localeCompare(bValue);
            return allStaffTableFilters.sortOrder === "asc" ? result : -result;
          } else {
            const result = aValue - bValue;
            return allStaffTableFilters.sortOrder === "asc" ? result : -result;
          }
        });
  
        return filtered;
      });

      // ステータスを取得
      const getFilterStatus = (staff) => {
        const status = props.getStaffStatus(staff, 0);
        if (status.type === 'error') return 'violation';
        if (status.type === 'warning') return 'warning';
        return 'normal';
      };
  
      // ステータス優先度取得（ソート用）
      const getStaffStatusPriority = (staff) => {
        const status = getFilterStatus(staff);
        switch (status) {
          case "violation":
            return 3; // 違反（最優先）
          case "warning":
            return 2; // 警告
          case "normal":
            return 1; // 正常
          default:
            return 1;
        }
      };

      // ステータス表示用の関数
      const getStatusClass = (staff) => {
        const statusInfo = props.getStaffStatusInfo(staff, 0);
        switch (statusInfo.type) {
          case 'error':
            return 'status-violation';
          case 'warning':
            return 'status-warning';
          default:
            return 'status-ok';
        }
      };

      const getStatusIcon = (staff) => {
        const statusInfo = props.getStaffStatusInfo(staff, 0);
        switch (statusInfo.type) {
          case 'error':
            return 'pi pi-times-circle';
          case 'warning':
            return 'pi pi-exclamation-triangle';
          default:
            return 'pi pi-check-circle';
        }
      };

      const getStatusText = (staff) => {
        const statusInfo = props.getStaffStatusInfo(staff, 0);
        return statusInfo.label;
      };

      const getStatusTitle = (staff) => {
        const statusInfo = props.getStaffStatusInfo(staff, 0);
        return statusInfo.description;
      };
  
      // ソート切り替え
      const toggleSort = (sortBy) => {
        if (allStaffTableFilters.sortBy === sortBy) {
          allStaffTableFilters.sortOrder =
            allStaffTableFilters.sortOrder === "asc" ? "desc" : "asc";
        } else {
          allStaffTableFilters.sortBy = sortBy;
          allStaffTableFilters.sortOrder = "asc";
        }
      };
  
      // フィルタリセット
      const resetAllStaffFilters = () => {
        allStaffTableFilters.searchName = "";
        allStaffTableFilters.searchStore = "";
        allStaffTableFilters.statusFilter = "all";
        allStaffTableFilters.sortBy = "name";
        allStaffTableFilters.sortOrder = "asc";
  
        nextTick(() => {
          console.log("フィルターがリセットされました:", allStaffTableFilters);
        });
      };
  
      // ソートアイコン取得
      const getSortIcon = (column) => {
        if (allStaffTableFilters.sortBy !== column) {
          return "pi pi-sort";
        }
        return allStaffTableFilters.sortOrder === "asc"
          ? "pi pi-sort-up"
          : "pi pi-sort-down";
      };
  
      return {
        allStaffTableFilters,
        statusFilterOptions,
        sortOptions,
        filteredAndSortedAllStaff,
        toggleSort,
        resetAllStaffFilters,
        getSortIcon,
        getStoreBreakdownForStaff,
        getStatusClass,
        getStatusIcon,
        getStatusText,
        getStatusTitle,
      };
    },
  };
  </script>
  
  <style scoped lang="scss">
  .all-staff-shift-summary {
    background: white;
    border-radius: 6px;
    margin-top: 2rem;
    overflow: hidden;
    border: 1px solid #e5e7eb;
  }
  
  .summary-header {
    padding: 1.5rem;
    background: linear-gradient(135deg, #1e40af, #3b82f6);
    color: white;
  }
  
  .summary-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .summary-header h3 i {
    color: #93c5fd;
    font-size: 1.5rem;
  }
  
  .table-controls-panel {
    background: #f8f9fa;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .search-filters {
    display: grid;
    grid-template-columns: 1fr 1fr 150px 150px auto;
    gap: 1rem;
    align-items: end;
  }
  
  .search-group,
  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .search-label {
    font-size: 0.85rem !important;
    font-weight: 600 !important;
    color: #374151 !important;
    height: 20px !important;
    display: flex !important;
    align-items: center !important;
    margin-bottom: 0 !important;
  }
  
  .search-input {
    width: 100% !important;
    height: 42px !important;
    min-height: 42px !important;
    max-height: 42px !important;
    padding: 0.5rem 0.75rem !important;
    border: 1px solid #d1d5db !important;
    border-radius: 6px !important;
    font-size: 0.875rem !important;
    line-height: 1.4 !important;
    transition: border-color 0.2s !important;
    box-sizing: border-box !important;
    display: flex !important;
    align-items: center !important;
    background: white !important;
  }
  
  .search-input:focus {
    outline: none !important;
    border-color: #3b82f6 !important;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
  }
  
  .search-input:hover {
    border-color: #9ca3af !important;
  }
  
  .search-input::placeholder {
    color: #9ca3af !important;
    font-size: 0.875rem !important;
  }
  
  :deep(.status-filter),
  :deep(.sort-filter) {
    width: 100% !important;
    height: 42px !important;
  }
  
  :deep(.status-filter .p-dropdown),
  :deep(.sort-filter .p-dropdown) {
    width: 100% !important;
    height: 42px !important;
    min-height: 42px !important;
    max-height: 42px !important;
    border: 1px solid #d1d5db !important;
    border-radius: 6px !important;
    font-size: 0.875rem !important;
    display: flex !important;
    align-items: center !important;
    box-sizing: border-box !important;
    padding: 0 !important;
    background: white !important;
  }
  
  :deep(.status-filter .p-dropdown .p-dropdown-label),
  :deep(.sort-filter .p-dropdown .p-dropdown-label) {
    padding: 0.5rem 0.75rem !important;
    line-height: 1.4 !important;
    height: 100% !important;
    display: flex !important;
    align-items: center !important;
    flex: 1 !important;
    font-size: 0.875rem !important;
    border: none !important;
    background: transparent !important;
    margin: 0 !important;
    min-height: auto !important;
    max-height: none !important;
    box-sizing: border-box !important;
  }
  
  .filter-actions {
    display: flex !important;
    align-items: flex-end !important;
    gap: 0.5rem !important;
  }
  
  :deep(.filter-actions .p-button) {
    height: 42px !important;
    min-height: 42px !important;
    max-height: 42px !important;
    padding: 0.5rem 1rem !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 0.5rem !important;
    white-space: nowrap !important;
    font-size: 0.875rem !important;
    box-sizing: border-box !important;
    border-radius: 6px !important;
  }
  
  .table-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 0;
    border-top: 1px solid #e5e7eb;
  }
  
  .summary-text {
    font-size: 0.875rem;
    color: #6b7280;
    font-weight: 500;
  }
  
  .all-staff-table-container {
    overflow-x: auto;
    background: #f8f9fa;
  }
  
  .all-staff-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
    background: white;
  }
  
  .all-staff-table thead {
    background: #f1f5f9;
    border-bottom: 2px solid #e2e8f0;
  }
  
  .all-staff-table th {
    padding: 1rem 0.75rem;
    text-align: left;
    font-weight: 600;
    color: #1e293b;
    border-bottom: 1px solid #e2e8f0;
    white-space: nowrap;
  }
  
  .staff-name-col {
    width: 180px;
    min-width: 180px;
  }
  
  .store-hours-col {
    width: 280px;
    min-width: 280px;
  }
  
  .total-hours-col {
    width: 120px;
    min-width: 120px;
    text-align: center;
  }
  
  .target-range-col {
    width: 140px;
    min-width: 140px;
    text-align: center;
  }
  
  .status-col {
    width: 100px;
    min-width: 100px;
    text-align: center;
  }
  
  .sortable-header {
    cursor: pointer;
    user-select: none;
    transition: background-color 0.2s;
  }
  
  .sortable-header:hover {
    background-color: #e5e7eb !important;
  }
  
  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  
  .header-content i {
    font-size: 0.8rem;
    color: #6b7280;
    transition: color 0.2s;
  }
  
  .sortable-header:hover .header-content i {
    color: #374151;
  }
  
  .all-staff-row {
    border-bottom: 1px solid #e5e7eb;
    transition: background-color 0.2s;
  }
  
  .all-staff-row:hover {
    background-color: #f9fafb;
  }
  
  .all-staff-row.has-warnings {
    background-color: #fef3c7 !important;
  }
  
  .all-staff-row.has-warnings:hover {
    background-color: #fde68a !important;
  }
  
  .all-staff-row.hours-violation {
    background-color: #fee2e2 !important;
  }
  
  .all-staff-row.hours-violation:hover {
    background-color: #fecaca !important;
  }
  
  .all-staff-table td {
    padding: 0.75rem;
    vertical-align: top;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .staff-name-cell {
    position: sticky;
    left: 0;
    background: inherit;
    z-index: 2;
  }
  
  .staff-info-inline {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .staff-avatar-table {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    background: #3b82f6;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.8rem;
    flex-shrink: 0;
  }
  
  .staff-name-text {
    font-weight: 600;
    color: #1e293b;
    white-space: nowrap;
  }
  
  .store-hours-cell {
    max-width: 280px;
  }
  
  .store-hours-list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  
  .store-hours-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.25rem 0.5rem;
    background: #f3f4f6;
    border-radius: 4px;
    font-size: 0.8rem;
  }
  
  .store-name-table {
    color: #475569;
    font-weight: 500;
    flex: 1;
  }
  
  .store-hours-table {
    color: #059669;
    font-weight: 600;
    margin-left: 0.5rem;
  }
  
  .no-hours {
    padding: 0.5rem;
    text-align: center;
  }
  
  .no-hours-text {
    color: #9ca3af;
    font-style: italic;
    font-size: 0.8rem;
  }
  
  .total-hours-cell {
    text-align: center;
  }
  
  .total-hours-value-table {
    font-weight: 700;
    font-size: 1rem;
    color: #10b981;
  }
  
  .total-hours-value-table.out-of-range {
    color: #dc2626 !important;
  }
  
  .target-range-cell {
    text-align: center;
  }
  
  .target-range-text {
    color: #6b7280;
    font-size: 0.85rem;
    font-weight: 500;
  }
  
  .status-cell {
    text-align: center;
  }
  
  .status-indicators {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  
  .status-indicator {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8rem;
    padding: 0.375rem 0.75rem;
    border-radius: 6px;
    font-weight: 500;
    cursor: help;
    transition: all 0.2s;
    white-space: nowrap;
  }
  
  .status-indicator.status-ok {
    background-color: #d1fae5;
    color: #10b981;
    border: 1px solid #a7f3d0;
  }
  
  .status-indicator.status-warning {
    background-color: #fef3c7;
    color: #f59e0b;
    border: 1px solid #fde68a;
  }
  
  .status-indicator.status-violation {
    background-color: #fee2e2;
    color: #ef4444;
    border: 1px solid #fecaca;
  }
  
  .status-indicator:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .status-indicator i {
    font-size: 0.9rem;
  }
  
  .status-text {
    font-weight: 500;
  }
  
  .no-data-row {
    background: #f9fafb;
  }
  
  .no-data-cell {
    text-align: center;
    padding: 3rem 1rem;
  }
  
  .no-data-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    color: #6b7280;
    font-size: 0.875rem;
  }
  
  .no-data-content i {
    font-size: 1.25rem;
    color: #9ca3af;
  }
  
  @media (max-width: 1200px) {
    .search-filters {
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
  
    .filter-group,
    .filter-actions {
      grid-column: span 2;
    }
  
    .filter-actions {
      justify-content: flex-start;
    }
  
    .all-staff-table-container {
      max-height: 500px;
      overflow-y: auto;
    }
  
    .staff-name-col {
      width: 160px;
      min-width: 160px;
    }
  
    .store-hours-col {
      width: 250px;
      min-width: 250px;
    }
  }
  
  @media (max-width: 768px) {
    .search-filters {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
  
    .filter-group,
    .filter-actions {
      grid-column: span 1;
    }
  
    .table-controls-panel {
      padding: 1rem;
    }
  
    .table-summary {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }
  
    .search-input,
    :deep(.filter-actions .p-button),
    :deep(.status-filter .p-dropdown),
    :deep(.sort-filter .p-dropdown) {
      height: 40px !important;
      min-height: 40px !important;
      max-height: 40px !important;
    }
  
    :deep(.status-filter .p-dropdown .p-dropdown-label),
    :deep(.sort-filter .p-dropdown .p-dropdown-label) {
      padding: 0.4rem 0.6rem !important;
    }
  
    .status-indicator {
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
    }
  
    .status-text {
      display: none;
    }
  
    .status-indicator i {
      font-size: 1rem;
    }
  
    .all-staff-table {
      font-size: 0.8rem;
    }
  
    .all-staff-table th,
    .all-staff-table td {
      padding: 0.5rem;
    }
  
    .staff-name-col {
      width: 140px;
      min-width: 140px;
    }
  
    .store-hours-col {
      width: 200px;
      min-width: 200px;
    }
  
    .total-hours-col,
    .target-range-col,
    .status-col {
      width: 80px;
      min-width: 80px;
    }
  
    .store-hours-item {
      font-size: 0.75rem;
    }
  
    .staff-avatar-table {
      width: 28px;
      height: 28px;
      font-size: 0.7rem;
    }
  }
  </style>