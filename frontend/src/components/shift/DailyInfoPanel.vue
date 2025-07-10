<template>
    <div class="daily-info-panel">
      <div
        v-if="hasDateWarnings(selectedDate)"
        class="daily-info-section date-warnings-section"
      >
        <h4 class="section-title">
          <i class="pi pi-exclamation-triangle"></i>
          警告・注意事項
        </h4>
        <div class="date-warnings">
          <div
            v-for="warning in getDateWarnings(selectedDate)"
            :key="warning.type"
            class="warning-item"
            :class="warning.type"
          >
            <i :class="warning.icon"></i>
            <span>{{ warning.message }}</span>
          </div>
        </div>
      </div>
  
      <div class="daily-info-section requirements-section">
        <h4 class="section-title">
          <i class="pi pi-users"></i>
          人員要件
        </h4>
        <div
          v-if="getDailyRequirements(selectedDate).length > 0"
          class="requirements-list"
        >
          <div
            v-for="req in getDailyRequirements(selectedDate)"
            :key="`req-${req.start_time}-${req.end_time}`"
            class="requirement-item"
            :class="{
              shortage: hasStaffingShortage(selectedDate, req),
            }"
          >
            <div class="time-range">
              {{ formatTime(req.start_time) }} -
              {{ formatTime(req.end_time) }}
            </div>
            <div class="staff-count">
              <span class="assigned-count">{{
                getAssignedStaffCount(selectedDate, req)
              }}</span>
              <span class="separator">/</span>
              <span class="required-count">{{
                req.required_staff_count
              }}</span>
              <span class="count-unit">名</span>
            </div>
            <div
              v-if="hasStaffingShortage(selectedDate, req)"
              class="shortage-icon"
            >
              <i class="pi pi-exclamation-triangle"></i>
            </div>
          </div>
        </div>
        <div v-else class="no-requirements">
          <i class="pi pi-info-circle"></i>
          <span>設定なし</span>
        </div>
      </div>
  
      <div class="daily-info-section staff-summary-section">
        <h4 class="section-title">
          <i class="pi pi-clock"></i>
          勤務スタッフ
        </h4>
        <div class="staff-summary-grid">
          <div
            v-for="staff in getDailyShiftStaff(selectedDate)"
            :key="`summary-${staff.id}`"
            class="staff-summary-card"
            :class="{
              'has-warnings': hasStaffWarningsAllStores(staff.id),
              'hours-violation': isHoursOutOfRangeAllStores(staff.id),
            }"
          >
            <div class="staff-header">
              <div class="staff-avatar-tiny">
                {{ staff.first_name.charAt(0) }}
              </div>
              <div class="staff-name-summary">
                {{ staff.last_name }} {{ staff.first_name }}
              </div>
              <div
                v-if="hasStaffWarningsAllStores(staff.id)"
                class="warning-indicator-small"
              >
                <i class="pi pi-exclamation-triangle"></i>
              </div>
            </div>
  
            <div class="summary-stats">
              <div class="stat-item">
                <div class="hours-display">
                  <span
                    class="stat-value current-store-hours"
                    >{{ selectedStore.name }}:
                    {{ formatHours(calculateTotalHours(staff.id)) }}</span
                  >
                  <div
                    v-if="
                      getOtherStoreHoursBreakdown(staff.id).length > 0
                    "
                    class="other-stores-hours-tiny"
                  >
                    <div
                      v-for="breakdown in getOtherStoreHoursBreakdown(
                        staff.id
                      )"
                      :key="breakdown.storeId"
                      class="store-breakdown-tiny"
                    >
                      {{ breakdown.storeName }}:
                      {{ formatHours(breakdown.hours) }}
                    </div>
                  </div>
                  <span
                    class="total-hours-all-stores"
                    :class="{
                      'out-of-range': isHoursOutOfRangeAllStores(
                        staff.id
                      ),
                      'in-range': !isHoursOutOfRangeAllStores(
                        staff.id
                      ),
                    }"
                  >
                    合計:
                    {{
                      formatHours(calculateTotalHoursAllStores(staff.id))
                    }}
                  </span>
                </div>
                <span class="stat-range">
                  / {{ formatHours(staff.min_hours_per_month || 0) }} -
                  {{ formatHours(staff.max_hours_per_month || 0) }}
                </span>
              </div>
  
              <div class="today-shift">
                <span class="today-hours">
                  本日:
                  {{
                    formatHours(
                      calculateDayHours(
                        getShiftForStaff(selectedDate, staff.id)
                      )
                    )
                  }}
                </span>
                <div
                  v-if="hasShiftViolation(selectedDate, staff.id)"
                  class="violations"
                >
                  <div
                    v-for="violation in getShiftViolations(
                      selectedDate,
                      staff.id
                    )"
                    :key="violation.type"
                    class="violation-badge"
                    :title="violation.message"
                  >
                    <i class="pi pi-exclamation-triangle"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div
            v-if="getDailyShiftStaff(selectedDate).length === 0"
            class="no-shift-staff"
          >
            <i class="pi pi-info-circle"></i>
            <span>シフトに入っているスタッフはいません</span>
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <script>
  export default {
    name: 'DailyInfoPanel',
    props: {
      selectedDate: String,
      selectedStore: Object,
      staffList: Array,
      shifts: Array,
      getDailyShiftStaff: Function,
      hasDateWarnings: Function,
      getDateWarnings: Function,
      getDailyRequirements: Function,
      hasStaffingShortage: Function,
      getAssignedStaffCount: Function,
      hasStaffWarningsAllStores: Function,
      isHoursOutOfRangeAllStores: Function,
      calculateTotalHours: Function,
      getOtherStoreHoursBreakdown: Function,
      calculateTotalHoursAllStores: Function,
      getShiftForStaff: Function,
      hasShiftViolation: Function,
      getShiftViolations: Function,
      calculateDayHours: Function,
      formatTime: Function,
      formatHours: Function,
    },
  };
  </script>
  
  <style scoped lang="scss">
  .daily-info-panel {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
    padding: 1.5rem;
    align-items: stretch;
  }
  
  .daily-info-section {
    background: #f8f9fa;
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  
  .daily-info-section .section-title {
    padding: 0.75rem 1rem;
    font-size: 1.1rem;
    background-color: #f1f5f9;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
    height: 60px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    box-sizing: border-box;
  }
  
  .date-warnings-section .section-title i {
    color: #f59e0b;
    font-size: 1rem;
  }
  
  .date-warnings {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
    padding: 1rem;
    min-height: 200px;
    max-height: 300px;
    overflow-y: auto;
  }
  
  .warning-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.85rem;
  }
  
  .warning-item.staffing_shortage {
    background: #fef3c7;
    color: #78350f;
  }
  
  .warning-item.staff_violation {
    background: #fee2e2;
    color: #7f1d1d;
  }
  
  .requirements-section {
    display: flex;
    flex-direction: column;
  }
  
  .requirements-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-height: 200px;
    max-height: 300px;
    overflow-y: auto;
    padding: 1rem;
  }
  
  .requirement-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: white;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
  }
  
  .requirement-item.shortage {
    background: #fef3c7;
    border-color: #fbbf24;
  }
  
  .time-range {
    font-size: 0.85rem;
    font-weight: 600;
    color: #475569;
  }
  
  .staff-count {
    display: flex;
    align-items: baseline;
    gap: 0.25rem;
  }
  
  .assigned-count {
    font-size: 1.25rem;
    font-weight: 700;
    color: #3b82f6;
  }
  
  .separator {
    color: #94a3b8;
  }
  
  .required-count {
    font-size: 1.25rem;
    font-weight: 700;
    color: #64748b;
  }
  
  .count-unit {
    font-size: 0.8rem;
    color: #94a3b8;
  }
  
  .shortage-icon {
    color: #f59e0b;
    font-size: 0.9rem;
    margin-left: 0.5rem;
  }
  
  .no-requirements {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: #94a3b8;
    font-size: 0.85rem;
    padding: 2rem;
  }
  
  .staff-summary-section {
    display: flex;
    flex-direction: column;
  }
  
  .staff-summary-grid {
    flex: 1;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-height: 300px;
    max-height: 1000px;
    overflow-y: auto;
  }
  
  .staff-summary-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 0.75rem;
    transition: all 0.2s;
  }
  
  .staff-summary-card:hover {
    background: #f9fafb;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  .staff-summary-card.has-warnings {
    background: #fef3c7;
    border-color: #fbbf24;
  }
  
  .staff-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  
  .staff-avatar-tiny {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: #3b82f6;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.7rem;
  }
  
  .staff-name-summary {
    font-weight: 600;
    color: #1e293b;
    font-size: 0.85rem;
    flex: 1;
  }
  
  .warning-indicator-small {
    color: #f59e0b;
    font-size: 0.8rem;
  }
  
  .summary-stats {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .hours-display {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .stat-value {
    font-weight: 700;
    color: #3b82f6;
    font-size: 1rem;
  }
  
  .stat-value.out-of-range {
    color: #dc2626 !important;
    font-weight: 700;
  }
  
  .other-stores-hours-tiny {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    margin-top: 0.25rem;
  }
  
  .store-breakdown-tiny {
    font-size: 0.6rem;
    color: #6b7280;
  }
  
  .total-hours-all-stores {
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
  }
  
  .total-hours-all-stores.out-of-range {
    color: #dc2626 !important;
    font-weight: 700;
  }
  
  .stat-range {
    color: #94a3b8;
    font-size: 0.8rem;
  }
  
  .today-shift {
    padding: 0.375rem 0.625rem;
    background: #dbeafe;
    border-radius: 6px;
    margin-top: 0.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .today-hours {
    font-weight: 600;
    color: #059669;
    font-size: 0.85rem;
  }
  
  .violations {
    display: flex;
    gap: 0.25rem;
  }
  
  .violation-badge {
    font-size: 0.65rem;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    background: #fee2e2;
    color: #dc2626;
    font-weight: 600;
    cursor: help;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  
  .no-shift-staff {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: #94a3b8;
    font-size: 0.85rem;
    padding: 2rem;
    text-align: center;
  }
  
  @media (max-width: 1200px) {
    .daily-info-panel {
      grid-template-columns: 1fr;
  
      .daily-info-section {
        height: auto;
      }
  
      .date-warnings,
      .requirements-list,
      .staff-summary-grid {
        min-height: auto;
      }
    }
  }
  </style>