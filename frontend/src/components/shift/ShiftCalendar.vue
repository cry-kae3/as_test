<template>
  <div class="shift-calendar">
    <!-- カレンダーヘッダー -->
    <div class="calendar-header">
      <div class="weekday-headers">
        <div 
          v-for="day in weekdays" 
          :key="day"
          class="weekday-header"
          :class="{ 
            'weekend': day === '日' || day === '土',
            'sunday': day === '日',
            'saturday': day === '土'
          }"
        >
          {{ day }}
        </div>
      </div>
    </div>

    <!-- カレンダーボディ -->
    <div class="calendar-body">
      <div class="calendar-grid">
        <div
          v-for="day in daysInMonth"
          :key="day.date"
          class="day-cell"
          :class="{
            'selected': selectedDate === day.date,
            'weekend': day.dayOfWeek === 0 || day.dayOfWeek === 6,
            'sunday': day.dayOfWeek === 0,
            'saturday': day.dayOfWeek === 6,
            'today': isToday(day.date),
            'past': isPastDate(day.date),
            'has-warnings': hasDateWarnings(day.date),
            'has-shortage': hasStaffingShortage(day.date)
          }"
          @click="selectDate(day.date)"
        >
          <!-- 日付ヘッダー -->
          <div class="day-header">
            <span class="day-number">{{ day.dayOfMonth }}</span>
            
            <!-- 警告アイコン -->
            <div v-if="hasDateWarnings(day.date)" class="warning-indicators">
              <i 
                v-if="hasStaffingShortage(day.date)"
                class="pi pi-exclamation-triangle warning-icon shortage"
                :title="getShortageTooltip(day.date)"
              ></i>
              <i 
                v-if="hasShiftViolations(day.date)"
                class="pi pi-exclamation-circle warning-icon violation"
                title="シフト制約違反があります"
              ></i>
            </div>
          </div>

          <!-- スタッフ人数表示 -->
          <div class="staff-count-display">
            <div class="assigned-count">
              <i class="pi pi-users"></i>
              <span>{{ getAssignedStaffCount(day.date) }}人</span>
            </div>
            
            <!-- 人員要件表示 -->
            <div v-if="hasHourRequirements(day.date)" class="requirement-summary">
              <div 
                v-for="(requirement, timeSlot) in getHourRequirements(day.date)"
                :key="timeSlot"
                class="requirement-item"
                :class="{
                  'shortage': getAssignedStaffCount(day.date, requirement.startTime, requirement.endTime) < requirement.requiredCount
                }"
              >
                <span class="time-slot">{{ requirement.timeSlot }}</span>
                <span class="count-info">
                  {{ getAssignedStaffCount(day.date, requirement.startTime, requirement.endTime) }}/{{ requirement.requiredCount }}
                </span>
              </div>
            </div>
          </div>

          <!-- スタッフ一覧 -->
          <div class="staff-list">
            <div
              v-for="staff in staffList"
              :key="staff.id"
              class="staff-row"
              :class="{
                'has-shift': getShiftForStaff(staff.id, day.date),
                'unavailable': !canStaffWorkOnDate(staff, day.date),
                'has-violation': hasStaffViolation(staff, day.date),
                'hours-warning': hasStaffWarningsAllStores(staff, calculateTotalHours(staff.id)),
                'hours-out-of-range': isHoursOutOfRangeAllStores(staff, calculateTotalHours(staff.id))
              }"
              @click.stop="openShiftEditor(day, staff)"
              :title="getStaffTooltip(staff, day.date)"
            >
              <div class="staff-info">
                <span class="staff-name">{{ staff.last_name }}</span>
                <span class="staff-hours">
                  {{ formatHours(calculateTotalHoursAllStores(staff.id)) }}h
                </span>
              </div>

              <div 
                v-if="getShiftForStaff(staff.id, day.date)" 
                class="shift-info"
                :class="{
                  'past-date': isPastDate(day.date),
                  'edit-mode': isEditMode
                }"
              >
                <div class="shift-time">
                  {{ formatTime(getShiftForStaff(staff.id, day.date).start_time) }}
                  -
                  {{ formatTime(getShiftForStaff(staff.id, day.date).end_time) }}
                </div>
                
                <!-- 削除ボタン（編集モード時のみ） -->
                <Button
                  v-if="isEditMode && !isPastDate(day.date)"
                  icon="pi pi-times"
                  class="p-button-danger p-button-text p-button-sm quick-delete-btn"
                  @click.stop="$emit('quick-delete-shift', getShiftForStaff(staff.id, day.date))"
                  title="シフト削除"
                />
              </div>

              <div v-else class="no-shift">
                <span v-if="!canStaffWorkOnDate(staff, day.date)" class="unavailable-reason">
                  {{ getWorkUnavailabilityReason(staff, day.date) }}
                </span>
                <span v-else-if="isEditMode" class="add-shift-hint">
                  クリックして追加
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 凡例 -->
    <div class="calendar-legend">
      <div class="legend-section">
        <h4>カレンダー凡例</h4>
        <div class="legend-items">
          <div class="legend-item">
            <div class="legend-color has-shortage"></div>
            <span>人員要件不足</span>
          </div>
          <div class="legend-item">
            <div class="legend-color has-warnings"></div>
            <span>制約違反あり</span>
          </div>
          <div class="legend-item">
            <div class="legend-color weekend"></div>
            <span>土日</span>
          </div>
          <div class="legend-item">
            <div class="legend-color past"></div>
            <span>過去の日付</span>
          </div>
        </div>
      </div>
      
      <div class="legend-section">
        <h4>スタッフ表示</h4>
        <div class="legend-items">
          <div class="legend-item">
            <i class="pi pi-exclamation-triangle legend-icon shortage"></i>
            <span>人員不足</span>
          </div>
          <div class="legend-item">
            <i class="pi pi-exclamation-circle legend-icon violation"></i>
            <span>制約違反</span>
          </div>
          <div class="legend-item">
            <i class="pi pi-users legend-icon"></i>
            <span>配置人数</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Button from 'primevue/button';

export default {
  name: 'ShiftCalendar',
  components: {
    Button
  },
  
  props: {
    isEditMode: {
      type: Boolean,
      default: false
    },
    selectedDate: {
      type: String,
      default: null
    },
    selectedStore: {
      type: Object,
      default: null
    },
    daysInMonth: {
      type: Array,
      default: () => []
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
    getShiftForStaff: {
      type: Function,
      required: true
    },
    calculateTotalHours: {
      type: Function,
      required: true
    },
    calculateTotalHoursAllStores: {
      type: Function,
      required: true
    },
    getOtherStoreHoursBreakdown: {
      type: Function,
      required: true
    },
    isHoursOutOfRangeAllStores: {
      type: Function,
      required: true
    },
    hasStaffWarningsAllStores: {
      type: Function,
      required: true
    },
    getStaffWarningsAllStores: {
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
    hasShiftViolation: {
      type: Function,
      required: true
    },
    getShiftViolations: {
      type: Function,
      required: true
    },
    canStaffWorkOnDate: {
      type: Function,
      required: true
    },
    getWorkAvailabilityTooltip: {
      type: Function,
      required: true
    },
    getWorkUnavailabilityReason: {
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
    isPastDate: {
      type: Function,
      required: true
    },
    hasHourRequirements: {
      type: Function,
      required: true
    },
    getHourRequirements: {
      type: Function,
      required: true
    },
    getAssignedStaffCount: {
      type: Function,
      required: true
    },
    hasStaffingShortage: {
      type: Function,
      required: true
    }
  },

  emits: [
    'select-date',
    'open-shift-editor',
    'quick-delete-shift'
  ],

  setup(props, { emit }) {
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

    const selectDate = (date) => {
      emit('select-date', date);
    };

    const openShiftEditor = (day, staff) => {
      if (!props.isEditMode && !props.getShiftForStaff(staff.id, day.date)) {
        return;
      }
      emit('open-shift-editor', day, staff);
    };

    const isToday = (date) => {
      const today = new Date();
      const targetDate = new Date(date);
      return today.toDateString() === targetDate.toDateString();
    };

    const hasShiftViolations = (date) => {
      if (!props.shifts || !props.staffList) return false;
      
      const dayShifts = props.shifts.filter(shift => shift.date === date);
      
      return dayShifts.some(shift => {
        if (!shift.assignments) return false;
        
        return shift.assignments.some(assignment => {
          const staff = props.staffList.find(s => s.id === assignment.staff_id);
          return staff && props.hasShiftViolation(staff, date, assignment);
        });
      });
    };

    const getShortageTooltip = (date) => {
      const warnings = props.getDateWarnings(date);
      const shortageWarnings = warnings.filter(w => w.type === 'requirement');
      
      if (shortageWarnings.length === 0) return '';
      
      return shortageWarnings.map(w => w.message).join('\n');
    };

    const getStaffTooltip = (staff, date) => {
      const tooltips = [];
      
      // 基本情報
      tooltips.push(`${staff.last_name} ${staff.first_name}`);
      
      // 勤務可否
      if (!props.canStaffWorkOnDate(staff, date)) {
        tooltips.push(`勤務不可: ${props.getWorkUnavailabilityReason(staff, date)}`);
        return tooltips.join('\n');
      }
      
      // シフト情報
      const shift = props.getShiftForStaff(staff.id, date);
      if (shift) {
        tooltips.push(`勤務時間: ${props.formatTime(shift.start_time)}-${props.formatTime(shift.end_time)}`);
        
        if (shift.break_start_time && shift.break_end_time) {
          tooltips.push(`休憩: ${props.formatTime(shift.break_start_time)}-${props.formatTime(shift.break_end_time)}`);
        }
      }
      
      // 時間情報
      const totalHours = props.calculateTotalHoursAllStores(staff.id);
      tooltips.push(`総勤務時間: ${props.formatHours(totalHours)}h`);
      
      // 警告情報
      const warnings = props.getStaffWarningsAllStores(staff, props.calculateTotalHours(staff.id));
      if (warnings.length > 0) {
        tooltips.push('警告: ' + warnings.join(', '));
      }
      
      return tooltips.join('\n');
    };

    return {
      weekdays,
      selectDate,
      openShiftEditor,
      isToday,
      hasShiftViolations,
      getShortageTooltip,
      getStaffTooltip
    };
  }
};
</script>

<style scoped lang="scss">
.shift-calendar {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.calendar-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1rem;
}

.weekday-headers {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
}

.weekday-header {
  text-align: center;
  font-weight: 600;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  
  &.weekend {
    background: rgba(255, 255, 255, 0.2);
  }
  
  &.sunday {
    color: #ffcccb;
  }
  
  &.saturday {
    color: #add8e6;
  }
}

.calendar-body {
  padding: 1rem;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  background: #e0e4e7;
  border-radius: 8px;
  overflow: hidden;
}

.day-cell {
  background: white;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  
  &:hover {
    background: #f8f9fa;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    z-index: 1;
  }
  
  &.selected {
    background: #e3f2fd;
    border: 2px solid #2196f3;
    z-index: 2;
  }
  
  &.weekend {
    background: #fafafa;
  }
  
  &.sunday {
    background: #fff5f5;
  }
  
  &.saturday {
    background: #f0f8ff;
  }
  
  &.today {
    border: 2px solid #4caf50;
    background: #f1f8e9;
  }
  
  &.past {
    opacity: 0.7;
    background: #f5f5f5;
  }
  
  &.has-warnings {
    border-left: 4px solid #ff9800;
  }
  
  &.has-shortage {
    border-left: 4px solid #f44336;
  }
}

.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  border-bottom: 1px solid #e0e0e0;
  background: #fafafa;
}

.day-number {
  font-weight: 600;
  font-size: 1rem;
  color: #333;
}

.warning-indicators {
  display: flex;
  gap: 0.25rem;
}

.warning-icon {
  font-size: 0.875rem;
  
  &.shortage {
    color: #f44336;
  }
  
  &.violation {
    color: #ff9800;
  }
}

.staff-count-display {
  padding: 0.5rem;
  border-bottom: 1px solid #e0e0e0;
  background: #f9f9f9;
}

.assigned-count {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: #333;
  margin-bottom: 0.5rem;
  
  i {
    color: #2196f3;
  }
}

.requirement-summary {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.requirement-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  padding: 0.25rem;
  border-radius: 4px;
  background: white;
  
  &.shortage {
    background: #ffebee;
    border: 1px solid #f44336;
    color: #c62828;
  }
}

.time-slot {
  font-weight: 500;
}

.count-info {
  font-weight: 600;
}

.staff-list {
  flex: 1;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  overflow-y: auto;
}

.staff-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem;
  border-radius: 4px;
  border: 1px solid transparent;
  transition: all 0.2s ease;
  font-size: 0.75rem;
  
  &:hover {
    background: #f0f8ff;
    border-color: #2196f3;
  }
  
  &.has-shift {
    background: #e8f5e8;
    border-color: #4caf50;
  }
  
  &.unavailable {
    background: #ffebee;
    border-color: #f44336;
    opacity: 0.7;
  }
  
  &.has-violation {
    background: #fff3e0;
    border-color: #ff9800;
  }
  
  &.hours-warning {
    border-left: 3px solid #ff9800;
  }
  
  &.hours-out-of-range {
    border-left: 3px solid #f44336;
  }
}

.staff-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.staff-name {
  font-weight: 600;
  color: #333;
}

.staff-hours {
  font-size: 0.7rem;
  color: #666;
  background: #e0e0e0;
  padding: 0.125rem 0.375rem;
  border-radius: 12px;
}

.shift-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  &.past-date {
    opacity: 0.7;
  }
}

.shift-time {
  font-weight: 500;
  color: #2e7d32;
}

.quick-delete-btn {
  padding: 0.25rem;
  width: 1.5rem;
  height: 1.5rem;
  
  :deep(.p-button-icon) {
    font-size: 0.7rem;
  }
}

.no-shift {
  text-align: center;
  color: #999;
  font-style: italic;
}

.unavailable-reason {
  color: #d32f2f;
  font-weight: 500;
}

.add-shift-hint {
  color: #1976d2;
}

.calendar-legend {
  background: #f8f9fa;
  padding: 1rem;
  border-top: 1px solid #e0e0e0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

.legend-section {
  h4 {
    margin: 0 0 0.5rem 0;
    color: #333;
    font-size: 0.875rem;
    font-weight: 600;
  }
}

.legend-items {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #666;
}

.legend-color {
  width: 1rem;
  height: 1rem;
  border-radius: 2px;
  border: 1px solid #ccc;
  
  &.has-shortage {
    background: #ffebee;
    border-color: #f44336;
  }
  
  &.has-warnings {
    background: #fff3e0;
    border-color: #ff9800;
  }
  
  &.weekend {
    background: #fafafa;
    border-color: #bdbdbd;
  }
  
  &.past {
    background: #f5f5f5;
    border-color: #9e9e9e;
  }
}

.legend-icon {
  font-size: 0.875rem;
  
  &.shortage {
    color: #f44336;
  }
  
  &.violation {
    color: #ff9800;
  }
}

@media (max-width: 1400px) {
  .day-cell {
    min-height: 180px;
  }
  
  .calendar-legend {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}

@media (max-width: 1200px) {
  .day-cell {
    min-height: 160px;
  }
  
  .staff-row {
    font-size: 0.7rem;
  }
}

@media (max-width: 768px) {
  .calendar-grid {
    grid-template-columns: 1fr;
  }
  
  .weekday-headers {
    display: none;
  }
  
  .day-cell {
    min-height: auto;
    border-bottom: 1px solid #e0e0e0;
  }
  
  .day-header {
    background: #e3f2fd;
  }
}
</style>