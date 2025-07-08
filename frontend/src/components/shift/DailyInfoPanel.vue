<template>
  <div class="daily-info-panel">
    <!-- パネルヘッダー -->
    <div class="panel-header">
      <h3 class="panel-title">
        {{ formatSelectedDateDisplay(selectedDate) }} の詳細情報
      </h3>
      <div class="header-badges">
        <Badge 
          v-if="getTotalAssignedStaff() > 0"
          :value="`${getTotalAssignedStaff()}人配置`"
          severity="info"
        />
        <Badge 
          v-if="hasDateWarnings(selectedDate)"
          value="警告あり"
          severity="warning"
        />
        <Badge 
          v-if="hasStaffingShortage(selectedDate)"
          value="人員不足"
          severity="danger"
        />
      </div>
    </div>

    <!-- 人員要件セクション -->
    <div v-if="getDailyRequirements(selectedDate).length > 0" class="info-section">
      <div class="section-header">
        <h4 class="section-title">
          <i class="pi pi-users"></i>
          人員要件
        </h4>
      </div>
      
      <div class="requirements-grid">
        <div 
          v-for="requirement in getDailyRequirements(selectedDate)"
          :key="`${requirement.start_time}-${requirement.end_time}`"
          class="requirement-card"
          :class="{
            'shortage': getAssignedStaffCount(selectedDate, requirement.start_time, requirement.end_time) < requirement.required_staff_count,
            'adequate': getAssignedStaffCount(selectedDate, requirement.start_time, requirement.end_time) >= requirement.required_staff_count
          }"
        >
          <div class="requirement-header">
            <span class="time-range">
              {{ formatTime(requirement.start_time) }} - {{ formatTime(requirement.end_time) }}
            </span>
            <div class="staff-count">
              <span class="assigned">{{ getAssignedStaffCount(selectedDate, requirement.start_time, requirement.end_time) }}</span>
              <span class="separator">/</span>
              <span class="required">{{ requirement.required_staff_count }}</span>
              <span class="unit">人</span>
            </div>
          </div>
          
          <div v-if="getAssignedStaffCount(selectedDate, requirement.start_time, requirement.end_time) < requirement.required_staff_count" 
               class="shortage-info">
            <i class="pi pi-exclamation-triangle"></i>
            <span>{{ requirement.required_staff_count - getAssignedStaffCount(selectedDate, requirement.start_time, requirement.end_time) }}人不足</span>
          </div>
          
          <div v-else class="adequate-info">
            <i class="pi pi-check-circle"></i>
            <span>要件満足</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 配置スタッフセクション -->
    <div v-if="getDailyShiftStaff(selectedDate).length > 0" class="info-section">
      <div class="section-header">
        <h4 class="section-title">
          <i class="pi pi-calendar"></i>
          配置スタッフ ({{ getDailyShiftStaff(selectedDate).length }}人)
        </h4>
      </div>
      
      <div class="staff-grid">
        <div 
          v-for="shiftStaff in getDailyShiftStaff(selectedDate)"
          :key="shiftStaff.id"
          class="staff-card"
          :class="{
            'has-warnings': hasStaffWarningsAllStores(shiftStaff, calculateTotalHours(shiftStaff.id)),
            'hours-out-of-range': isHoursOutOfRangeAllStores(shiftStaff, calculateTotalHours(shiftStaff.id)).isUnder || isHoursOutOfRangeAllStores(shiftStaff, calculateTotalHours(shiftStaff.id)).isOver,
            'has-violation': hasShiftViolation(shiftStaff, selectedDate)
          }"
        >
          <div class="staff-header">
            <div class="staff-name">
              {{ shiftStaff.last_name }} {{ shiftStaff.first_name }}
            </div>
            <div class="staff-badges">
              <Badge 
                v-if="hasShiftViolation(shiftStaff, selectedDate)"
                value="制約違反"
                severity="warning"
                size="small"
              />
              <Badge 
                v-if="isHoursOutOfRangeAllStores(shiftStaff, calculateTotalHours(shiftStaff.id)).isOver"
                value="時間超過"
                severity="danger"
                size="small"
              />
              <Badge 
                v-if="isHoursOutOfRangeAllStores(shiftStaff, calculateTotalHours(shiftStaff.id)).isUnder"
                value="時間不足"
                severity="warning"
                size="small"
              />
            </div>
          </div>
          
          <div class="shift-details">
            <div class="time-info">
              <i class="pi pi-clock"></i>
              <span>{{ formatTime(shiftStaff.assignment.start_time) }} - {{ formatTime(shiftStaff.assignment.end_time) }}</span>
            </div>
            
            <div v-if="shiftStaff.assignment.break_start_time && shiftStaff.assignment.break_end_time" 
                 class="break-info">
              <i class="pi pi-pause"></i>
              <span>休憩: {{ formatTime(shiftStaff.assignment.break_start_time) }} - {{ formatTime(shiftStaff.assignment.break_end_time) }}</span>
            </div>
            
            <div class="hours-info">
              <div class="daily-hours">
                <span class="label">勤務:</span>
                <span class="value">{{ formatHours(calculateDayHours(shiftStaff.assignment)) }}h</span>
              </div>
              
              <div class="total-hours">
                <span class="label">今月:</span>
                <span class="value">{{ formatHours(calculateTotalHoursAllStores(shiftStaff.id)) }}h</span>
              </div>
              
              <div v-if="getOtherStoreHoursBreakdown(shiftStaff.id).totalHours > 0" class="other-stores">
                <span class="label">他店:</span>
                <span class="value">{{ formatHours(getOtherStoreHoursBreakdown(shiftStaff.id).totalHours) }}h</span>
              </div>
            </div>
          </div>
          
          <!-- 警告詳細 -->
          <div v-if="getShiftViolations(shiftStaff, selectedDate).length > 0" class="violations">
            <div class="violations-header">
              <i class="pi pi-exclamation-triangle"></i>
              <span>制約違反</span>
            </div>
            <ul class="violations-list">
              <li v-for="violation in getShiftViolations(shiftStaff, selectedDate)" :key="violation">
                {{ violation }}
              </li>
            </ul>
          </div>
          
          <!-- 他店舗勤務詳細 -->
          <div v-if="getOtherStoreHoursBreakdown(shiftStaff.id).stores.length > 0" class="other-stores-detail">
            <div class="other-stores-header">
              <i class="pi pi-building"></i>
              <span>他店舗勤務</span>
            </div>
            <div class="other-stores-list">
              <div 
                v-for="store in getOtherStoreHoursBreakdown(shiftStaff.id).stores"
                :key="store.name"
                class="store-item"
              >
                <span class="store-name">{{ store.name }}</span>
                <span class="store-hours">{{ formatHours(store.hours) }}h</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 未配置スタッフセクション -->
    <div v-if="getUnassignedStaff().length > 0" class="info-section">
      <div class="section-header">
        <h4 class="section-title">
          <i class="pi pi-user-minus"></i>
          未配置スタッフ ({{ getUnassignedStaff().length }}人)
        </h4>
      </div>
      
      <div class="unassigned-grid">
        <div 
          v-for="staff in getUnassignedStaff()"
          :key="staff.id"
          class="unassigned-card"
          :class="{
            'unavailable': !canStaffWorkOnDate(staff, selectedDate),
            'available': canStaffWorkOnDate(staff, selectedDate)
          }"
        >
          <div class="staff-info">
            <span class="staff-name">{{ staff.last_name }} {{ staff.first_name }}</span>
            <div class="availability-status">
              <i :class="canStaffWorkOnDate(staff, selectedDate) ? 'pi pi-check-circle available' : 'pi pi-times-circle unavailable'"></i>
              <span v-if="canStaffWorkOnDate(staff, selectedDate)" class="available">勤務可能</span>
              <span v-else class="unavailable">{{ getWorkUnavailabilityReason(staff, selectedDate) }}</span>
            </div>
          </div>
          
          <div class="staff-details">
            <div class="hours-summary">
              <span class="label">今月:</span>
              <span class="value">{{ formatHours(calculateTotalHoursAllStores(staff.id)) }}h</span>
            </div>
            
            <div v-if="hasStaffWarningsAllStores(staff, calculateTotalHours(staff.id))" class="warnings">
              <i class="pi pi-exclamation-triangle"></i>
              <span>時間制約</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 日付警告セクション -->
    <div v-if="hasDateWarnings(selectedDate)" class="info-section warning-section">
      <div class="section-header">
        <h4 class="section-title warning">
          <i class="pi pi-exclamation-triangle"></i>
          警告・注意事項
        </h4>
      </div>
      
      <div class="warnings-list">
        <div 
          v-for="warning in getDateWarnings(selectedDate)"
          :key="warning.message"
          class="warning-item"
          :class="warning.severity"
        >
          <i :class="warning.severity === 'error' ? 'pi pi-times-circle' : 'pi pi-exclamation-triangle'"></i>
          <div class="warning-content">
            <div v-if="warning.staffName" class="warning-staff">{{ warning.staffName }}</div>
            <div class="warning-message">{{ warning.message }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- サマリーセクション -->
    <div class="info-section summary-section">
      <div class="section-header">
        <h4 class="section-title">
          <i class="pi pi-chart-bar"></i>
          日次サマリー
        </h4>
      </div>
      
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-label">配置スタッフ数</div>
          <div class="summary-value primary">{{ getTotalAssignedStaff() }}人</div>
        </div>
        
        <div class="summary-item">
          <div class="summary-label">総勤務時間</div>
          <div class="summary-value">{{ formatHours(getTotalWorkHours()) }}h</div>
        </div>
        
        <div class="summary-item">
          <div class="summary-label">人員要件</div>
          <div class="summary-value" :class="{ 'danger': hasStaffingShortage(selectedDate), 'success': !hasStaffingShortage(selectedDate) && getDailyRequirements(selectedDate).length > 0 }">
            {{ hasStaffingShortage(selectedDate) ? '不足あり' : getDailyRequirements(selectedDate).length > 0 ? '満足' : '設定なし' }}
          </div>
        </div>
        
        <div class="summary-item">
          <div class="summary-label">制約違反</div>
          <div class="summary-value" :class="{ 'danger': hasDateWarnings(selectedDate), 'success': !hasDateWarnings(selectedDate) }">
            {{ hasDateWarnings(selectedDate) ? 'あり' : 'なし' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Badge from 'primevue/badge';

export default {
  name: 'DailyInfoPanel',
  components: {
    Badge
  },
  
  props: {
    selectedDate: {
      type: String,
      required: true
    },
    selectedStore: {
      type: Object,
      required: true
    },
    staffList: {
      type: Array,
      default: () => []
    },
    shifts: {
      type: Array,
      default: () => []
    },
    // 関数props
    getDailyShiftStaff: {
      type: Function,
      required: true
    },
    hasDateWarnings: {
      type: Function,
      required: true
    },
    getDateWarnings: {
      type: Function,
      required: true
    },
    getDailyRequirements: {
      type: Function,
      required: true
    },
    hasStaffingShortage: {
      type: Function,
      required: true
    },
    getAssignedStaffCount: {
      type: Function,
      required: true
    },
    hasStaffWarningsAllStores: {
      type: Function,
      required: true
    },
    isHoursOutOfRangeAllStores: {
      type: Function,
      required: true
    },
    calculateTotalHours: {
      type: Function,
      required: true
    },
    getOtherStoreHoursBreakdown: {
      type: Function,
      required: true
    },
    calculateTotalHoursAllStores: {
      type: Function,
      required: true
    },
    getShiftForStaff: {
      type: Function,
      required: true
    },
    hasShiftViolation: {
      type: Function,
      required: true
    },
    getShiftViolations: {
      type: Function,
      required: true
    },
    calculateDayHours: {
      type: Function,
      required: true
    },
    formatTime: {
      type: Function,
      required: true
    },
    formatHours: {
      type: Function,
      required: true
    },
    canStaffWorkOnDate: {
      type: Function,
      required: true
    },
    getWorkUnavailabilityReason: {
      type: Function,
      required: true
    }
  },

  setup(props) {
    const formatSelectedDateDisplay = (date) => {
      if (!date) return '';
      
      const targetDate = new Date(date);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth() + 1;
      const day = targetDate.getDate();
      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
      const dayOfWeek = dayNames[targetDate.getDay()];
      
      return `${year}年${month}月${day}日（${dayOfWeek}）`;
    };

    const getTotalAssignedStaff = () => {
      return props.getDailyShiftStaff(props.selectedDate).length;
    };

    const getTotalWorkHours = () => {
      const dailyStaff = props.getDailyShiftStaff(props.selectedDate);
      let totalMinutes = 0;
      
      dailyStaff.forEach(staff => {
        totalMinutes += props.calculateDayHours(staff.assignment) * 60;
      });
      
      return totalMinutes / 60;
    };

    const getUnassignedStaff = () => {
      if (!props.staffList || props.staffList.length === 0) return [];
      
      const assignedStaffIds = props.getDailyShiftStaff(props.selectedDate).map(staff => staff.id);
      
      return props.staffList.filter(staff => !assignedStaffIds.includes(staff.id));
    };

    const getWorkUnavailabilityReason = (staff, date) => {
      if (!props.canStaffWorkOnDate(staff, date)) {
        return props.getWorkUnavailabilityReason(staff, date);
      }
      return '';
    };

    return {
      formatSelectedDateDisplay,
      getTotalAssignedStaff,
      getTotalWorkHours,
      getUnassignedStaff,
      getWorkUnavailabilityReason
    };
  }
};
</script>

<style scoped lang="scss">
.daily-info-panel {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.panel-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.header-badges {
  display: flex;
  gap: 0.5rem;
}

.info-section {
  padding: 1.5rem;
  border-bottom: 1px solid #e0e0e0;
  
  &:last-child {
    border-bottom: none;
  }
  
  &.warning-section {
    background: #fff3e0;
    border-left: 4px solid #ff9800;
  }
  
  &.summary-section {
    background: #f8f9fa;
  }
}

.section-header {
  margin-bottom: 1rem;
}

.section-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #333;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  &.warning {
    color: #f57c00;
  }
  
  i {
    color: #2196f3;
    
    &.pi-exclamation-triangle {
      color: #ff9800;
    }
  }
}

.requirements-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.requirement-card {
  padding: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  transition: all 0.2s ease;
  
  &.shortage {
    border-color: #f44336;
    background: #ffebee;
  }
  
  &.adequate {
    border-color: #4caf50;
    background: #f1f8e9;
  }
}

.requirement-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.time-range {
  font-weight: 600;
  color: #333;
  font-size: 0.875rem;
}

.staff-count {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-weight: 600;
  
  .assigned {
    color: #2196f3;
    font-size: 1.125rem;
  }
  
  .separator {
    color: #666;
  }
  
  .required {
    color: #333;
    font-size: 1.125rem;
  }
  
  .unit {
    color: #666;
    font-size: 0.875rem;
  }
}

.shortage-info,
.adequate-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.shortage-info {
  color: #f44336;
}

.adequate-info {
  color: #4caf50;
}

.staff-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1rem;
}

.staff-card {
  padding: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  transition: all 0.2s ease;
  
  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  &.has-warnings {
    border-left: 4px solid #ff9800;
  }
  
  &.hours-out-of-range {
    border-left: 4px solid #f44336;
  }
  
  &.has-violation {
    background: #fff3e0;
    border-color: #ff9800;
  }
}

.staff-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.staff-name {
  font-weight: 600;
  color: #333;
  font-size: 1rem;
}

.staff-badges {
  display: flex;
  gap: 0.5rem;
}

.shift-details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.time-info,
.break-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #333;
  
  i {
    color: #2196f3;
  }
}

.break-info {
  i {
    color: #ff9800;
  }
}

.hours-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.daily-hours,
.total-hours,
.other-stores {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 6px;
  font-size: 0.875rem;
}

.label {
  color: #666;
  font-size: 0.75rem;
  margin-bottom: 0.25rem;
}

.value {
  font-weight: 600;
  color: #333;
}

.violations,
.other-stores-detail {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #f5f5f5;
  border-radius: 6px;
}

.violations-header,
.other-stores-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: #666;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.violations-list {
  margin: 0;
  padding-left: 1.25rem;
  
  li {
    font-size: 0.875rem;
    color: #f57c00;
    margin-bottom: 0.25rem;
  }
}

.other-stores-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.store-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}

.store-name {
  color: #333;
}

.store-hours {
  font-weight: 600;
  color: #2196f3;
}

.unassigned-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.unassigned-card {
  padding: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  
  &.unavailable {
    background: #fafafa;
    opacity: 0.8;
  }
  
  &.available {
    border-color: #4caf50;
    background: #f8fff8;
  }
}

.staff-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.availability-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  
  .available {
    color: #4caf50;
  }
  
  .unavailable {
    color: #f44336;
  }
}

.staff-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.hours-summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.warnings {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: #ff9800;
  font-size: 0.875rem;
}

.warnings-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.warning-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 6px;
  
  &.error {
    background: #ffebee;
    color: #c62828;
    
    i {
      color: #f44336;
    }
  }
  
  &.warning {
    background: #fff3e0;
    color: #ef6c00;
    
    i {
      color: #ff9800;
    }
  }
}

.warning-content {
  flex: 1;
}

.warning-staff {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.warning-message {
  font-size: 0.875rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
}

.summary-item {
  text-align: center;
  padding: 1rem;
  background: white;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.summary-label {
  font-size: 0.875rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.summary-value {
  font-size: 1.25rem;
  font-weight: 600;
  color: #333;
  
  &.primary {
    color: #2196f3;
  }
  
  &.success {
    color: #4caf50;
  }
  
  &.danger {
    color: #f44336;
  }
}

@media (max-width: 768px) {
  .panel-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .requirements-grid,
  .staff-grid,
  .unassigned-grid {
    grid-template-columns: 1fr;
  }
  
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .hours-info {
    grid-template-columns: 1fr;
  }
  
  .staff-header {
    flex-direction: column;
    gap: 0.5rem;
    align-items: stretch;
  }
}
</style>