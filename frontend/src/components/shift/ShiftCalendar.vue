<template>
    <div class="calendar-section">
      <div class="edit-mode-indicator" v-if="isEditMode">
        <i class="pi pi-pencil"></i>
        <span>編集モード - セルをクリックして編集</span>
      </div>
  
      <div class="calendar-view">
        <div class="calendar-container">
          <div class="calendar-header">
            <div class="staff-column-header">
              <span>スタッフ名</span>
            </div>
            <div
              v-for="day in daysInMonth"
              :key="day.date"
              class="date-cell-wrapper"
            >
              <div class="date-warning-row">
                <div
                  v-if="hasDateWarnings(day.date)"
                  class="warning-indicator"
                  :data-warning-count="getDateWarnings(day.date).filter(w => w.type === 'staffing_shortage').length || ''"
                  :class="{
                    'has-staffing-shortage': hasDateStaffingShortage(day.date)
                  }"
                >
                  <i class="pi pi-exclamation-triangle"></i>
                  <div class="warning-tooltip">
                    <div
                      v-for="warning in getDateWarnings(day.date)"
                      :key="warning.type + warning.message"
                      class="warning-tooltip-item"
                      :class="warning.type"
                    >
                      <i :class="warning.icon"></i>
                      <span>{{ warning.message }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div
                class="date-cell-header"
                :class="{
                  'is-weekend': day.isWeekend,
                  'is-holiday': day.isNationalHoliday,
                  'is-today': day.isToday,
                  'is-selected': selectedDate === day.date,
                  'has-warnings': hasDateWarnings(day.date),
                  'has-staffing-shortage': hasDateStaffingShortage(day.date),
                  'is-store-closed': day.isStoreClosed,
                }"
                @click="selectDate(day.date)"
              >
                <div class="date-number">{{ day.day }}</div>
                <div class="date-weekday">{{ day.dayOfWeekLabel }}</div>
                <div v-if="day.isNationalHoliday" class="holiday-indicator">
                  祝
                </div>
                <div
                  v-if="
                    day.isStoreClosed &&
                    !day.isNationalHoliday &&
                    !day.isWeekend
                  "
                  class="closed-day-indicator"
                >
                  休
                </div>
              </div>
            </div>
          </div>
  
          <div class="calendar-body">
            <div
              v-for="staff in staffList"
              :key="staff.id"
              class="staff-row"
              :class="{
                'hours-violation': isHoursOutOfRangeAllStores(staff.id),
              }"
            >
              <div
                class="staff-info"
                :class="{
                  'hours-violation': isHoursOutOfRangeAllStores(staff.id),
                }"
              >
                <div class="staff-avatar">
                  {{ staff.first_name.charAt(0) }}
                </div>
                <div class="staff-details">
                  <span class="staff-name"
                    >{{ staff.last_name }} {{ staff.first_name }}</span
                  >
                  <span class="staff-role">{{
                    staff.position || "一般"
                  }}</span>
                  <div class="staff-hours-info">
                    <div class="hours-display">
                      <span class="current-hours current-store-hours"
                        >{{ selectedStore.name }}:
                        {{
                          formatHours(calculateTotalHours(staff.id))
                        }}</span
                      >
                      <div
                        v-if="
                          getOtherStoreHoursBreakdown(staff.id).length > 0
                        "
                        class="other-stores-hours"
                      >
                        <div
                          v-for="breakdown in getOtherStoreHoursBreakdown(
                            staff.id
                          )"
                          :key="breakdown.storeId"
                          class="store-breakdown"
                        >
                          <span class="store-name"
                            >{{ breakdown.storeName }}:</span
                          >
                          <span class="store-hours">{{
                            formatHours(breakdown.hours)
                          }}</span>
                        </div>
                      </div>
                      <span
                        class="total-hours-all-stores"
                        :class="{
                          'out-of-range': isHoursOutOfRangeAllStores(
                            staff.id
                          ),
                          'in-range': !isHoursOutOfRangeAllStores(staff.id),
                        }"
                      >
                        合計:
                        {{
                          formatHours(
                            calculateTotalHoursAllStores(staff.id)
                          )
                        }}
                      </span>
                    </div>
                    <span class="hours-range">
                      / {{ formatHours(staff.min_hours_per_month || 0) }} -
                      {{ formatHours(staff.max_hours_per_month || 0) }}
                    </span>
                  </div>
                  <div
                    v-if="hasStaffWarningsAllStores(staff.id)"
                    class="warning-indicator-staff"
                    :title="
                      getStaffWarningsAllStores(staff.id)
                        .map((w) => w.message)
                        .join(', ')
                    "
                  >
                    <i class="pi pi-exclamation-triangle"></i>
                  </div>
                </div>
              </div>
  
              <div
                v-for="day in daysInMonth"
                :key="`${staff.id}-${day.date}`"
                class="shift-cell"
                :class="{
                  'is-weekend': day.isWeekend,
                  'is-holiday': day.isNationalHoliday,
                  'is-today': day.isToday,
                  'is-past': isPastDate(day.date),
                  'is-editable': isEditMode,
                  'has-shift': getShiftForStaff(day.date, staff.id),
                  'past-editable': isEditMode && isPastDate(day.date),
                  'is-selected': selectedDate === day.date,
                  'is-store-closed': day.isStoreClosed,
                  'can-work':
                    canStaffWorkOnDate(staff, day.date) &&
                    !getShiftForStaff(day.date, staff.id) &&
                    !day.isStoreClosed,
                  unavailable:
                    (!canStaffWorkOnDate(staff, day.date) ||
                      day.isStoreClosed) &&
                    !getShiftForStaff(day.date, staff.id),
                }"
                @click="openShiftEditor(day, staff)"
              >
                <div
                  v-if="getShiftForStaff(day.date, staff.id)"
                  class="shift-time-card"
                >
                  <Button
                    v-if="isEditMode"
                    icon="pi pi-times"
                    class="p-button-rounded p-button-danger p-button-text quick-delete-btn"
                    @click.stop="
                      quickDeleteShift(
                        getShiftForStaff(day.date, staff.id)
                      )
                    "
                    title="シフトを削除"
                    size="small"
                  />
                  <div class="shift-start">
                    {{
                      formatTime(
                        getShiftForStaff(day.date, staff.id).start_time
                      )
                    }}
                  </div>
                  <div class="shift-separator">-</div>
                  <div class="shift-end">
                    {{
                      formatTime(
                        getShiftForStaff(day.date, staff.id).end_time
                      )
                    }}
                  </div>
                  <div
                    v-if="
                      getShiftForStaff(day.date, staff.id).break_start_time
                    "
                    class="break-time-indicator"
                  >
                    <span>
                      {{
                        formatTime(
                          getShiftForStaff(day.date, staff.id)
                            .break_start_time
                        )
                      }}
                      -
                      {{
                        formatTime(
                          getShiftForStaff(day.date, staff.id)
                            .break_end_time
                        )
                      }}
                    </span>
                  </div>
                  <div
                    v-else
                    class="break-time-placeholder"
                  >
                    <!-- 休憩なしの場合のプレースホルダー -->
                  </div>
                  <div
                    v-if="hasShiftViolation(day.date, staff.id)"
                    class="violation-icon"
                  >
                    <i class="pi pi-exclamation-triangle"></i>
                    <div class="violation-tooltip">
                      <div
                        v-for="violation in getShiftViolations(
                          day.date,
                          staff.id
                        )"
                        :key="violation.type"
                        class="violation-tooltip-item"
                      >
                        {{ violation.message }}
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  v-else-if="day.isStoreClosed"
                  class="store-closed-indicator"
                >
                  <span class="closed-text">定休日</span>
                </div>
                <div v-else class="no-shift">
                  <span
                    v-if="isEditMode && canStaffWorkOnDate(staff, day.date)"
                    class="work-available-indicator"
                    :title="getWorkAvailabilityTooltip(staff, day.date)"
                    >+</span
                  >
                  <span
                    v-else-if="
                      isEditMode && !canStaffWorkOnDate(staff, day.date)
                    "
                    class="work-unavailable-indicator"
                    :title="getWorkUnavailabilityReason(staff, day.date)"
                    >×</span
                  >
                  <span v-else-if="isEditMode">+</span>
                </div>
              </div>
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
      Button,
    },
    props: {
      isEditMode: Boolean,
      selectedDate: String,
      selectedStore: Object,
      daysInMonth: Array,
      staffList: Array,
      shifts: Array,
      getShiftForStaff: Function,
      calculateTotalHours: Function,
      calculateTotalHoursAllStores: Function,
      getOtherStoreHoursBreakdown: Function,
      isHoursOutOfRangeAllStores: Function,
      hasStaffWarningsAllStores: Function,
      getStaffWarningsAllStores: Function,
      hasDateWarnings: Function,
      getDateWarnings: Function,
      hasDateStaffingShortage: Function,
      hasShiftViolation: Function,
      getShiftViolations: Function,
      canStaffWorkOnDate: Function,
      getWorkAvailabilityTooltip: Function,
      getWorkUnavailabilityReason: Function,
      formatTime: Function,
      formatHours: Function,
      isPastDate: Function,
    },
    emits: [
      'select-date',
      'open-shift-editor',
      'quick-delete-shift',
    ],
    methods: {
      selectDate(date) {
        this.$emit('select-date', date);
      },
      openShiftEditor(day, staff) {
        this.$emit('open-shift-editor', day, staff);
      },
      quickDeleteShift(shift) {
        this.$emit('quick-delete-shift', shift);
      },
    },
  };
  </script>
  
  <style scoped lang="scss">
  .calendar-section {
    background: white;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid #e5e7eb;
    margin-bottom: 4rem;
    box-shadow: inset 0px 0px 8px rgba(147, 147, 147, 1);
    padding: 8px;
  }
  
  .edit-mode-indicator {
    background: #e0f2fe;
    padding: 0.75rem 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #0369a1;
    font-weight: 500;
    font-size: 0.875rem;
  }
  
  .calendar-view {
    display: flex;
    height: auto;
    min-height: 50vh;
  }
  
  .calendar-container {
    flex: 1;
    overflow: auto;
    background: #fafafa;
    position: relative;
  }
  
  .calendar-header {
    display: flex;
    background: white;
    position: sticky;
    top: 0;
    z-index: 10;
    min-width: fit-content;
  }
  
  .staff-column-header {
    min-width: 240px;
    width: 240px;
    padding: 1rem;
    background: #fff;
    border-right: 1px solid #e5e7eb;
    border-bottom: 2px solid #e5e7eb;
    color: #1e293b;
    font-weight: 600;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    justify-content: center;
    position: sticky;
    left: 0;
    z-index: 11;
  }
  
  .date-cell-wrapper {
    display: flex;
    flex-direction: column;
    min-width: 90px;
    width: 90px;
    border-right: 1px solid #e5e7eb;
    border-bottom: 2px solid #e5e7eb;
    flex-shrink: 0;
  }
  
  .date-warning-row {
    height: 30px;
    background: #f8f9fa;
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .date-cell-header {
    flex: 1;
    padding: 0.75rem 0.25rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    background: white;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .date-cell-header:hover {
    background: #f3f4f6;
  }
  
  .date-cell-header.is-today {
    background: #dbeafe;
    font-weight: 600;
  }
  
  .date-cell-header.is-weekend .date-number,
  .date-cell-header.is-weekend .date-weekday {
    color: #dc2626;
  }
  
  .date-cell-header.is-holiday .date-number,
  .date-cell-header.is-holiday .date-weekday {
    color: #dc2626;
  }
  
  .date-cell-header.is-store-closed {
    background: #f3f4f6 !important;
    color: #6b7280;
    opacity: 0.8;
  }
  
  .date-cell-header.is-store-closed .date-number,
  .date-cell-header.is-store-closed .date-weekday {
    color: #6b7280 !important;
  }
  
  .date-cell-header.is-selected {
    background: #bfdbfe;
  }
  
  .date-cell-header.is-store-closed.is-selected {
    background: #d1d5db !important;
  }
  
  // 人員不足がある日付のスタイル追加
  .date-cell-header.has-staffing-shortage {
    background: #fef3c7 !important;
  }
  
  .date-cell-header.has-staffing-shortage .date-number {
    color: #78350f !important;
    font-weight: 700;
  }
  
  .date-number {
    font-size: 1.1rem;
    font-weight: 600;
    color: #1e293b;
  }
  
  .date-weekday {
    font-size: 0.75rem;
    color: #64748b;
  }
  
  .holiday-indicator {
    font-size: 0.65rem;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    background: #dc2626;
    color: white;
    font-weight: 600;
  }
  
  .closed-day-indicator {
    font-size: 0.65rem;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    background: #9ca3af;
    color: white;
    font-weight: 600;
  }
  
  .warning-indicator {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background: #fbbf24;
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 600;
    color: #78350f;
    position: relative;
    cursor: pointer;
  }
  
  // 人員不足専用のスタイル
  .warning-indicator.has-staffing-shortage {
    background: #fbbf24;
    color: #78350f;
  }
  
  .warning-indicator::before {
    content: attr(data-warning-count);
    margin-right: 0.125rem;
  }
  
  .warning-indicator i {
    font-size: 0.75rem;
  }
  
  .warning-tooltip {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: 0.5rem;
    background: white;
    border-radius: 8px;
    padding: 0.75rem;
    min-width: 250px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: none;
    z-index: 20;
  }
  
  .warning-indicator:hover .warning-tooltip {
    display: block;
  }
  
  .warning-tooltip-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 6px;
    font-size: 0.8rem;
    margin-bottom: 0.5rem;
  }
  
  .warning-tooltip-item:last-child {
    margin-bottom: 0;
  }
  
  .warning-tooltip-item.staffing_shortage {
    background: #fef3c7;
    color: #78350f;
    font-weight: 600;
  }
  
  .warning-tooltip-item.staff_violation {
    background: #fef3c7;
    color: #78350f;
  }
  
  .calendar-body {
    background: white;
    min-width: fit-content;
  }
  
  .staff-row {
    display: flex;
    transition: background 0.2s;
    min-width: fit-content;
  }
  
  .staff-row:hover {
    background: #f9fafb;
  }
  
  .staff-info {
    min-width: 240px;
    width: 240px;
    padding: 1rem;
    background: white;
    border-right: 2px solid #e5e7eb;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    position: sticky;
    left: 0;
    z-index: 6;
  }
  
  .staff-avatar {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: #3b82f6;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.9rem;
    flex-shrink: 0;
  }
  
  .staff-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }
  
  .staff-name {
    font-weight: 600;
    color: #1e293b;
    font-size: 0.9rem;
  }
  
  .staff-role {
    font-size: 0.75rem;
    color: #64748b;
  }
  
  .staff-hours-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-top: 0.25rem;
  }
  
  .hours-display {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .current-hours {
    font-size: 0.8rem;
    font-weight: 700;
    color: #3b82f6;
  }
  
  .current-hours.out-of-range {
    color: #dc2626 !important;
    font-weight: 700;
  }
  
  .other-stores-hours {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }
  
  .store-breakdown {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.7rem;
  }
  
  .store-name {
    color: #6b7280;
    font-weight: 500;
  }
  
  .store-hours {
    color: #059669;
    font-weight: 600;
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
  
  .hours-range {
    font-size: 0.7rem;
    color: #94a3b8;
  }
  
  .warning-indicator-staff {
    color: #f59e0b;
    font-size: 0.8rem;
    cursor: help;
  }
  
  .shift-cell {
    min-width: 90px;
    width: 90px;
    min-height: 130px;
    padding: 5px;
    border-right: 1px solid #e5e7eb;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    transition: all 0.2s;
    flex-shrink: 0;
  }
  
  .shift-cell.is-today {
    background: #dbeafe;
  }
  
  .shift-cell.is-weekend .date-number,
  .shift-cell.is-weekend .date-weekday {
    color: #dc2626;
  }
  
  .shift-cell.is-holiday .date-number,
  .shift-cell.is-holiday .date-weekday {
    color: #dc2626;
  }
  
  .shift-cell.is-past {
    opacity: 0.6;
  }
  
  .shift-cell.is-editable {
    cursor: pointer;
  }
  
  .shift-cell.is-editable:hover {
    background: #e0f2fe;
    transform: scale(1.02);
  }
  
  .shift-cell.past-editable:hover {
    background: #fef3c7;
  }
  
  .shift-cell.is-store-closed {
    background: #f3f4f6 !important;
    color: #9ca3af;
    opacity: 0.7;
  }
  
  .shift-cell.is-store-closed.is-editable:hover {
    background: #f3f4f6 !important;
    transform: none !important;
  }
  
  .shift-time-card {
    background: #10b981;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    font-weight: 600;
    font-size: 0.75rem;
    min-width: 75px;
    width: 100%;
    max-width: 80px;
    height: 120px;
    transition: all 0.2s;
    position: relative;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    justify-content: flex-start;
  }
  
  .shift-time-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
  
  .quick-delete-btn {
    position: absolute !important;
    top: -8px;
    right: -8px;
    width: 20px !important;
    height: 20px !important;
    min-width: 20px !important;
    padding: 0 !important;
    border-radius: 50% !important;
    background: #ef4444 !important;
    border: 2px solid white !important;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2) !important;
    z-index: 10;
    opacity: 0;
    visibility: hidden;
    transition: all 0.2s ease-in-out !important;
    color: white !important;
  }
  
  .quick-delete-btn:hover {
    background: #dc2626 !important;
    transform: scale(1.1) !important;
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3) !important;
  }
  
  .shift-time-card:hover .quick-delete-btn {
    opacity: 1;
    visibility: visible;
  }
  
  .quick-delete-btn .pi {
    font-size: 10px !important;
  }
  
  .break-time-indicator {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.95);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    margin-top: 0.4rem;
    padding: 0.25rem 0.35rem;
    background: rgba(255, 255, 255, 0.25);
    border-radius: 4px;
    font-weight: 500;
    width: 100%;
    line-height: 1.3;
  }
  
  .break-time-indicator .pi {
    display: none;
  }
  
  .break-time-indicator::before {
    content: "休憩";
    font-size: 0.65rem;
    font-weight: 700;
    opacity: 0.95;
    letter-spacing: 0.05em;
  }
  
  .break-time-placeholder {
    height: 2.2rem;
    visibility: hidden;
  }
  
  .shift-start,
  .shift-end {
    font-weight: 700;
    font-size: 0.85rem;
  }
  
  .shift-separator {
    font-size: 0.7rem;
    opacity: 0.8;
    line-height: 0.8;
  }
  
  .violation-icon {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #fbbf24;
    color: #78350f;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.6rem;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
  
  .violation-tooltip {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 0.5rem;
    background: white;
    border-radius: 8px;
    padding: 0.75rem;
    min-width: 200px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: none;
    z-index: 20;
  }
  
  .violation-icon:hover .violation-tooltip {
    display: block;
  }
  
  .violation-tooltip-item {
    font-size: 0.8rem;
    color: #7f1d1d;
    margin-bottom: 0.25rem;
  }
  
  .violation-tooltip-item:last-child {
    margin-bottom: 0;
  }
  
  .no-shift {
    color: #cbd5e1;
    font-size: 1.2rem;
    transition: all 0.2s;
  }
  
  .shift-cell.is-editable .no-shift {
    color: #10b981;
    font-weight: 600;
  }
  
  .shift-cell.is-store-closed .no-shift {
    color: #9ca3af !important;
    cursor: not-allowed;
  }
  
  .store-closed-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 0.7rem;
    color: #9ca3af;
    font-weight: 500;
  }
  
  .closed-text {
    writing-mode: vertical-rl;
    text-orientation: mixed;
  }
  
  .work-available-indicator {
    color: #10b981;
    font-weight: 700;
    font-size: 1.2rem;
  }
  
  .work-unavailable-indicator {
    color: #ef4444;
    font-weight: 700;
    font-size: 1.2rem;
  }
  
  .shift-cell.can-work {
    background-color: #f0fdf4;
    position: relative;
  }
  
  .shift-cell.can-work::before {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    right: 2px;
    bottom: 2px;
    border: 2px dashed #10b981;
    border-radius: 4px;
    pointer-events: none;
  }
  
  .shift-cell.can-work:hover {
    background-color: #dcfce7;
  }
  
  @media (max-width: 768px) {
    .calendar-container {
      min-height: 350px;
      max-height: 55vh;
    }
  
    .staff-column-header,
    .staff-info {
      min-width: 200px;
      width: 200px;
    }
  
    .date-cell-wrapper,
    .shift-cell {
      min-width: 80px;
      width: 80px;
    }
    
    .shift-cell {
      padding: 3px;
    }
    
    .shift-time-card {
      min-width: 70px;
      max-width: 74px;
    }
  }
  </style>