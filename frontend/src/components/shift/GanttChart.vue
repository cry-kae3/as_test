<template>
  <div class="gantt-chart-container">
    <!-- ヘッダー -->
    <div class="gantt-header">
      <div class="header-left">
        <h3 class="gantt-title">
          {{ formatSelectedDateDisplay(selectedDate) }}のガントチャート
        </h3>
        <div v-if="isStoreClosedOnDate(selectedDate)" class="closed-notice">
          <i class="pi pi-ban"></i>
          <span>定休日</span>
        </div>
      </div>
      
      <div class="header-controls">
        <div class="date-navigation">
          <Button
            icon="pi pi-chevron-left"
            class="p-button-sm p-button-text"
            @click="$emit('previous-date')"
            :disabled="loading"
          />
          
          <Calendar
            :modelValue="selectedDateCalendar"
            @update:modelValue="$emit('update:selectedDateCalendar', $event)"
            @date-select="$emit('gantt-date-select', $event)"
            dateFormat="yy-mm-dd"
            :minDate="minSelectableDate"
            :maxDate="maxSelectableDate"
            :showIcon="true"
            placeholder="日付選択"
          />
          
          <Button
            icon="pi pi-chevron-right"
            class="p-button-sm p-button-text"
            @click="$emit('next-date')"
            :disabled="loading"
          />
        </div>
      </div>
    </div>

    <!-- 人員要件サマリー -->
    <div v-if="hasHourRequirements(selectedDate)" class="requirements-summary">
      <h4>人員要件</h4>
      <div class="requirement-items">
        <div 
          v-for="(requirement, timeSlot) in getHourRequirements(selectedDate)"
          :key="timeSlot"
          class="requirement-item"
          :class="{
            'shortage': getAssignedStaffCount(selectedDate, requirement.startTime, requirement.endTime) < requirement.requiredCount
          }"
        >
          <div class="requirement-time">{{ requirement.timeSlot }}</div>
          <div class="requirement-count">
            <span class="assigned">{{ getAssignedStaffCount(selectedDate, requirement.startTime, requirement.endTime) }}</span>
            <span class="separator">/</span>
            <span class="required">{{ requirement.requiredCount }}</span>
            <span class="unit">人</span>
          </div>
          <div v-if="getAssignedStaffCount(selectedDate, requirement.startTime, requirement.endTime) < requirement.requiredCount" 
               class="shortage-indicator">
            <i class="pi pi-exclamation-triangle"></i>
            <span>{{ requirement.requiredCount - getAssignedStaffCount(selectedDate, requirement.startTime, requirement.endTime) }}人不足</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ガントチャート本体 -->
    <div class="gantt-chart" v-if="!loading">
      <!-- タイムライン -->
      <div class="timeline-header">
        <div class="staff-column-header">スタッフ</div>
        <div class="hours-column-header">総時間</div>
        <div class="timeline-hours">
          <div 
            v-for="hour in timelineHours" 
            :key="hour"
            class="hour-slot"
            :class="{
              'business-hours': isBusinessHour(hour)
            }"
          >
            {{ hour }}:00
          </div>
        </div>
      </div>

      <!-- 人員要件バー（時間別） -->
      <div v-if="hasHourRequirements(selectedDate)" class="requirement-bars">
        <div class="staff-column"></div>
        <div class="hours-column"></div>
        <div class="timeline-content">
          <div class="requirement-timeline">
            <div 
              v-for="(requirement, timeSlot) in getHourRequirements(selectedDate)"
              :key="timeSlot"
              class="requirement-bar"
              :style="getRequirementBarStyle(requirement)"
              :class="{
                'shortage': getAssignedStaffCount(selectedDate, requirement.startTime, requirement.endTime) < requirement.requiredCount
              }"
              :title="`${requirement.timeSlot}: ${getAssignedStaffCount(selectedDate, requirement.startTime, requirement.endTime)}/${requirement.requiredCount}人`"
            >
              <span class="requirement-text">
                {{ getAssignedStaffCount(selectedDate, requirement.startTime, requirement.endTime) }}/{{ requirement.requiredCount }}人
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- スタッフ行 -->
      <div class="staff-rows">
        <div
          v-for="staff in staffList"
          :key="staff.id"
          class="staff-row"
          :class="{
            'has-shift': getShiftForStaff(staff.id, selectedDate),
            'unavailable': !canStaffWorkOnDate(staff, selectedDate),
            'has-warnings': hasStaffWarningsAllStores(staff, calculateTotalHours(staff.id)),
            'hours-out-of-range': isHoursOutOfRangeAllStores(staff, calculateTotalHours(staff.id)).isUnder || isHoursOutOfRangeAllStores(staff, calculateTotalHours(staff.id)).isOver
          }"
        >
          <!-- スタッフ情報列 -->
          <div class="staff-info">
            <div class="staff-name">
              {{ staff.last_name }} {{ staff.first_name }}
            </div>
            <div class="staff-meta">
              <span v-if="!canStaffWorkOnDate(staff, selectedDate)" class="unavailable-badge">
                勤務不可
              </span>
              <span v-else-if="hasShiftViolation(staff, selectedDate)" class="warning-badge">
                制約違反
              </span>
              <span v-else class="available-badge">
                勤務可能
              </span>
            </div>
          </div>

          <!-- 総時間表示 -->
          <div class="hours-info">
            <div class="current-store-hours">
              {{ formatHours(calculateTotalHours(staff.id)) }}h
            </div>
            <div class="total-hours">
              (全店舗: {{ formatHours(calculateTotalHoursAllStores(staff.id)) }}h)
            </div>
            <div v-if="isHoursOutOfRangeAllStores(staff, calculateTotalHours(staff.id)).isUnder || isHoursOutOfRangeAllStores(staff, calculateTotalHours(staff.id)).isOver" 
                 class="hours-warning">
              <i class="pi pi-exclamation-triangle"></i>
            </div>
          </div>

          <!-- タイムライン -->
          <div class="timeline-content">
            <div class="timeline-grid">
              <!-- 時間スロット -->
              <div 
                v-for="hour in timelineHours" 
                :key="hour"
                class="time-slot"
                :class="{
                  'business-hours': isBusinessHour(hour),
                  'clickable': isEditMode && canStaffWorkOnDate(staff, selectedDate) && !isPastDate(selectedDate)
                }"
                @click="handleTimeSlotClick(hour, staff, $event)"
              >
              </div>

              <!-- シフトバー -->
              <div 
                v-if="getShiftForStaff(staff.id, selectedDate)" 
                class="shift-bar"
                :style="getShiftBarStyle(getShiftForStaff(staff.id, selectedDate))"
                :class="{
                  'past-date': isPastDate(selectedDate),
                  'edit-mode': isEditMode,
                  'has-violation': hasShiftViolation(staff, selectedDate)
                }"
                @click="$emit('open-shift-editor', selectedDate, staff)"
                :title="getShiftTooltip(staff, selectedDate)"
              >
                <span class="shift-time">
                  {{ formatTime(getShiftForStaff(staff.id, selectedDate).start_time) }}
                  -
                  {{ formatTime(getShiftForStaff(staff.id, selectedDate).end_time) }}
                </span>
                
                <!-- 休憩時間表示 -->
                <div 
                  v-if="getShiftForStaff(staff.id, selectedDate).break_start_time && getShiftForStaff(staff.id, selectedDate).break_end_time"
                  class="break-indicator"
                  :style="getBreakIndicatorStyle(getShiftForStaff(staff.id, selectedDate))"
                  title="休憩時間"
                >
                  <i class="pi pi-pause"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ローディング -->
    <div v-if="loading" class="loading-state">
      <ProgressSpinner />
      <span>データを読み込み中...</span>
    </div>

    <!-- フッター情報 -->
    <div class="gantt-footer">
      <div class="summary-info">
        <div class="info-item">
          <i class="pi pi-users"></i>
          <span>配置スタッフ: {{ getAssignedStaffCount(selectedDate) }}人</span>
        </div>
        <div v-if="hasRequirementShortage(selectedDate)" class="info-item warning">
          <i class="pi pi-exclamation-triangle"></i>
          <span>人員要件不足あり</span>
        </div>
        <div v-if="hasDateWarnings && hasDateWarnings(selectedDate)" class="info-item error">
          <i class="pi pi-exclamation-circle"></i>
          <span>制約違反あり</span>
        </div>
      </div>
      
      <div class="legend">
        <div class="legend-item">
          <div class="legend-color business-hours"></div>
          <span>営業時間</span>
        </div>
        <div class="legend-item">
          <div class="legend-color requirement-bar"></div>
          <span>人員要件</span>
        </div>
        <div class="legend-item">
          <div class="legend-color shift-bar"></div>
          <span>シフト</span>
        </div>
        <div class="legend-item">
          <div class="legend-color break-time"></div>
          <span>休憩</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Button from 'primevue/button';
import Calendar from 'primevue/calendar';
import ProgressSpinner from 'primevue/progressspinner';

export default {
  name: 'GanttChart',
  components: {
    Button,
    Calendar,
    ProgressSpinner
  },

  props: {
    selectedDate: {
      type: String,
      required: true
    },
    selectedDateCalendar: {
      type: Date,
      default: null
    },
    minSelectableDate: {
      type: Date,
      default: null
    },
    maxSelectableDate: {
      type: Date,
      default: null
    },
    selectedStore: {
      type: Object,
      required: true
    },
    staffList: {
      type: Array,
      default: () => []
    },
    timelineHours: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    },
    isEditMode: {
      type: Boolean,
      default: false
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
    isStoreClosedOnDate: {
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
    hasRequirementShortage: {
      type: Function,
      required: true
    },
    getAssignedStaffCount: {
      type: Function,
      required: true
    },
    hasShiftViolation: {
      type: Function,
      required: true
    },
    canStaffWorkOnDate: {
      type: Function,
      required: true
    },
    formatSelectedDateDisplay: {
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
    hasDateWarnings: {
      type: Function,
      default: null
    }
  },

  emits: [
    'previous-date',
    'next-date',
    'gantt-date-select',
    'open-gantt-shift-editor',
    'open-shift-editor',
    'update:selectedDateCalendar'
  ],

  setup(props, { emit }) {
    const isBusinessHour = (hour) => {
      if (!props.selectedStore) return false;
      
      const openingHour = parseInt(props.selectedStore.opening_time?.split(':')[0] || '0');
      const closingHour = parseInt(props.selectedStore.closing_time?.split(':')[0] || '24');
      
      return hour >= openingHour && hour < closingHour;
    };

    const getShiftBarStyle = (shift) => {
      if (!shift) return {};

      const startHour = parseInt(shift.start_time.split(':')[0]);
      const startMinute = parseInt(shift.start_time.split(':')[1]);
      const endHour = parseInt(shift.end_time.split(':')[0]);
      const endMinute = parseInt(shift.end_time.split(':')[1]);

      const startPosition = ((startHour + startMinute / 60) / 24) * 100;
      const endPosition = ((endHour + endMinute / 60) / 24) * 100;
      const width = endPosition - startPosition;

      return {
        left: `${startPosition}%`,
        width: `${width}%`
      };
    };

    const getBreakIndicatorStyle = (shift) => {
      if (!shift.break_start_time || !shift.break_end_time) return {};

      const shiftStartHour = parseInt(shift.start_time.split(':')[0]);
      const shiftStartMinute = parseInt(shift.start_time.split(':')[1]);
      const breakStartHour = parseInt(shift.break_start_time.split(':')[0]);
      const breakStartMinute = parseInt(shift.break_start_time.split(':')[1]);
      const breakEndHour = parseInt(shift.break_end_time.split(':')[0]);
      const breakEndMinute = parseInt(shift.break_end_time.split(':')[1]);

      const shiftStart = shiftStartHour + shiftStartMinute / 60;
      const breakStart = breakStartHour + breakStartMinute / 60;
      const breakEnd = breakEndHour + breakEndMinute / 60;

      const breakStartPosition = ((breakStart - shiftStart) / 24) * 100;
      const breakWidth = ((breakEnd - breakStart) / 24) * 100;

      return {
        left: `${breakStartPosition}%`,
        width: `${breakWidth}%`
      };
    };

    const getRequirementBarStyle = (requirement) => {
      const startHour = parseInt(requirement.startTime.split(':')[0]);
      const startMinute = parseInt(requirement.startTime.split(':')[1]);
      const endHour = parseInt(requirement.endTime.split(':')[0]);
      const endMinute = parseInt(requirement.endTime.split(':')[1]);

      const startPosition = ((startHour + startMinute / 60) / 24) * 100;
      const endPosition = ((endHour + endMinute / 60) / 24) * 100;
      const width = endPosition - startPosition;

      return {
        left: `${startPosition}%`,
        width: `${width}%`
      };
    };

    const handleTimeSlotClick = (hour, staff, event) => {
      if (!props.isEditMode || !props.canStaffWorkOnDate(staff, props.selectedDate) || props.isPastDate(props.selectedDate)) {
        return;
      }
      
      emit('open-gantt-shift-editor', props.selectedDate, staff, event);
    };

    const getShiftTooltip = (staff, date) => {
      const shift = props.getShiftForStaff(staff.id, date);
      if (!shift) return '';

      const tooltips = [];
      tooltips.push(`${staff.last_name} ${staff.first_name}`);
      tooltips.push(`勤務: ${props.formatTime(shift.start_time)}-${props.formatTime(shift.end_time)}`);
      
      if (shift.break_start_time && shift.break_end_time) {
        tooltips.push(`休憩: ${props.formatTime(shift.break_start_time)}-${props.formatTime(shift.break_end_time)}`);
      }
      
      const totalHours = props.calculateTotalHoursAllStores(staff.id);
      tooltips.push(`総勤務時間: ${props.formatHours(totalHours)}h`);
      
      if (props.hasShiftViolation(staff, date)) {
        tooltips.push('制約違反があります');
      }
      
      return tooltips.join('\n');
    };

    return {
      isBusinessHour,
      getShiftBarStyle,
      getBreakIndicatorStyle,
      getRequirementBarStyle,
      handleTimeSlotClick,
      getShiftTooltip
    };
  }
};
</script>

<style scoped lang="scss">
.gantt-chart-container {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 1rem;
}

.gantt-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.gantt-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.closed-notice {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.2);
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.875rem;
}

.date-navigation {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.requirements-summary {
  padding: 1rem;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
  
  h4 {
    margin: 0 0 0.75rem 0;
    color: #333;
    font-size: 1rem;
    font-weight: 600;
  }
}

.requirement-items {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.requirement-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 0.875rem;
  
  &.shortage {
    border-color: #f44336;
    background: #ffebee;
  }
}

.requirement-time {
  font-weight: 600;
  color: #333;
}

.requirement-count {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  
  .assigned {
    font-weight: 600;
    color: #2196f3;
  }
  
  .separator {
    color: #666;
  }
  
  .required {
    font-weight: 600;
    color: #333;
  }
  
  .unit {
    color: #666;
  }
}

.shortage-indicator {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: #f44336;
  font-weight: 500;
  
  i {
    font-size: 0.75rem;
  }
}

.gantt-chart {
  min-height: 400px;
}

.timeline-header {
  display: grid;
  grid-template-columns: 200px 120px 1fr;
  background: #f5f5f5;
  border-bottom: 2px solid #e0e0e0;
  font-weight: 600;
  color: #333;
}

.staff-column-header,
.hours-column-header {
  padding: 1rem;
  border-right: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.timeline-hours {
  display: grid;
  grid-template-columns: repeat(24, 1fr);
  border-right: 1px solid #e0e0e0;
}

.hour-slot {
  padding: 0.5rem 0.25rem;
  text-align: center;
  border-right: 1px solid #e0e0e0;
  font-size: 0.75rem;
  
  &.business-hours {
    background: #e3f2fd;
    color: #1976d2;
    font-weight: 600;
  }
}

.requirement-bars {
  display: grid;
  grid-template-columns: 200px 120px 1fr;
  background: #fff9c4;
  border-bottom: 1px solid #e0e0e0;
  height: 40px;
}

.staff-column,
.hours-column {
  border-right: 1px solid #e0e0e0;
}

.requirement-timeline {
  position: relative;
  height: 100%;
}

.requirement-bar {
  position: absolute;
  top: 8px;
  height: 24px;
  background: #ffc107;
  border: 1px solid #ff8f00;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: #333;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #ffb300;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
  
  &.shortage {
    background: #f44336;
    border-color: #d32f2f;
    color: white;
    
    &:hover {
      background: #d32f2f;
    }
  }
}

.requirement-text {
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.staff-rows {
  background: white;
}

.staff-row {
  display: grid;
  grid-template-columns: 200px 120px 1fr;
  border-bottom: 1px solid #e0e0e0;
  min-height: 60px;
  transition: background-color 0.2s ease;
  
  &:hover {
    background: #f8f9fa;
  }
  
  &.unavailable {
    background: #ffebee;
    opacity: 0.7;
  }
  
  &.has-warnings {
    border-left: 4px solid #ff9800;
  }
  
  &.hours-out-of-range {
    border-left: 4px solid #f44336;
  }
}

.staff-info {
  padding: 1rem;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.staff-name {
  font-weight: 600;
  color: #333;
  font-size: 0.875rem;
}

.staff-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.unavailable-badge,
.warning-badge,
.available-badge {
  font-size: 0.7rem;
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
  font-weight: 500;
}

.unavailable-badge {
  background: #ffcdd2;
  color: #c62828;
}

.warning-badge {
  background: #ffe0b2;
  color: #ef6c00;
}

.available-badge {
  background: #c8e6c9;
  color: #2e7d32;
}

.hours-info {
  padding: 1rem;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 0.25rem;
}

.current-store-hours {
  font-weight: 600;
  color: #2196f3;
  font-size: 1rem;
}

.total-hours {
  font-size: 0.75rem;
  color: #666;
}

.hours-warning {
  color: #f44336;
  font-size: 0.875rem;
}

.timeline-content {
  position: relative;
  border-right: 1px solid #e0e0e0;
}

.timeline-grid {
  display: grid;
  grid-template-columns: repeat(24, 1fr);
  height: 60px;
  position: relative;
}

.time-slot {
  border-right: 1px solid #f0f0f0;
  height: 100%;
  
  &.business-hours {
    background: #f8f9fa;
  }
  
  &.clickable {
    cursor: pointer;
    
    &:hover {
      background: #e3f2fd;
    }
  }
}

.shift-bar {
  position: absolute;
  top: 8px;
  height: 44px;
  background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%);
  border: 2px solid #1b5e20;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  overflow: hidden;
  z-index: 1;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    z-index: 2;
  }
  
  &.past-date {
    opacity: 0.7;
    background: linear-gradient(135deg, #9e9e9e 0%, #616161 100%);
    border-color: #424242;
  }
  
  &.has-violation {
    background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
    border-color: #ef6c00;
  }
}

.shift-time {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  z-index: 1;
  position: relative;
}

.break-indicator {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  height: 20px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #333;
  font-size: 0.7rem;
  backdrop-filter: blur(2px);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 4rem;
  color: #666;
}

.gantt-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f8f9fa;
  border-top: 1px solid #e0e0e0;
}

.summary-info {
  display: flex;
  gap: 2rem;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #333;
  
  &.warning {
    color: #ff9800;
  }
  
  &.error {
    color: #f44336;
  }
}

.legend {
  display: flex;
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
  
  &.business-hours {
    background: #e3f2fd;
    border: 1px solid #1976d2;
  }
  
  &.requirement-bar {
    background: #ffc107;
    border: 1px solid #ff8f00;
  }
  
  &.shift-bar {
    background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%);
    border: 1px solid #1b5e20;
  }
  
  &.break-time {
    background: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(0, 0, 0, 0.2);
  }
}

@media (max-width: 1200px) {
  .timeline-header,
  .requirement-bars,
  .staff-row {
    grid-template-columns: 160px 100px 1fr;
  }
  
  .staff-info,
  .hours-info {
    padding: 0.75rem;
  }
  
  .staff-name {
    font-size: 0.8rem;
  }
}

@media (max-width: 768px) {
  .gantt-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .timeline-header,
  .requirement-bars,
  .staff-row {
    grid-template-columns: 120px 80px 1fr;
  }
  
  .timeline-hours,
  .timeline-grid {
    grid-template-columns: repeat(12, 1fr);
  }
  
  .hour-slot {
    font-size: 0.6rem;
    padding: 0.25rem;
  }
  
  .gantt-footer {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .summary-info,
  .legend {
    justify-content: center;
    flex-wrap: wrap;
  }
}
</style>