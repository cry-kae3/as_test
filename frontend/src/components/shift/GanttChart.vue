<template>
  <div class="gantt-section">
    <div class="details-header">
      <div class="details-title">
        <h3>
          <i class="pi pi-calendar-check"></i>現在選択中の日付:
          {{ formatSelectedDateDisplay(selectedDate) }}
        </h3>
      </div>
      <div class="details-navigation">
        <Button
          icon="pi pi-chevron-left"
          class="nav-button-small"
          @click="$emit('previous-date')"
          :disabled="loading"
        />
        <Calendar
          :modelValue="selectedDateCalendar"
          @update:modelValue="$emit('update:selectedDateCalendar', $event)"
          dateFormat="yy/mm/dd"
          :showIcon="true"
          iconDisplay="input"
          placeholder="日付選択"
          class="gantt-date-input"
          @date-select="$emit('gantt-date-select', $event)"
          :minDate="minSelectableDate"
          :maxDate="maxSelectableDate"
          :manualInput="false"
        />
        <Button
          icon="pi pi-chevron-right"
          class="nav-button-small"
          @click="$emit('next-date')"
          :disabled="loading"
        />
      </div>
    </div>

    <div class="gantt-container">
      <div class="gantt-header">
        <div class="gantt-staff-header">
          <span>スタッフ名</span>
        </div>
        <div class="gantt-timeline-header" ref="ganttTimelineHeader">
          <div
            v-for="hour in timelineHours"
            :key="hour"
            class="gantt-hour-cell"
            :style="getTimeHeaderStyle()"
          >
            <div class="hour-label">
              {{ hour.toString().padStart(2, "0") }}:00
            </div>
            <div
              v-if="hasHourRequirements(selectedDate, hour)"
              class="hour-requirements"
            >
              <div
                v-for="req in getHourlyStaffingInfo(selectedDate, hour)"
                :key="`${req.requirement.start_time}-${req.requirement.end_time}`"
                class="hour-requirement-badge"
                :class="{
                  shortage: req.hasShortage,
                  satisfied: !req.hasShortage,
                }"
                :title="`${formatTime(req.requirement.start_time)}-${formatTime(
                  req.requirement.end_time
                )}: ${req.assignedCount}/${req.requiredCount}名`"
              >
                <span class="staffing-count"
                  >{{ req.assignedCount }}/{{ req.requiredCount }}</span
                >
                <i
                  v-if="req.hasShortage"
                  class="pi pi-exclamation-triangle shortage-icon"
                ></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="gantt-body" ref="ganttBody" @scroll="syncGanttScroll">
        <div class="gantt-staff-rows">
          <div
            v-for="staff in staffList"
            :key="`gantt-${selectedDate}-${staff.id}`"
            class="gantt-staff-row"
            :class="{
              'has-warnings': hasStaffWarningsAllStores(staff.id),
              'hours-violation': isHoursOutOfRangeAllStores(staff.id),
              'store-closed-day': isStoreClosedOnDate(selectedDate),
            }"
          >
            <div
              class="gantt-staff-info"
              :class="{
                'hours-violation': isHoursOutOfRangeAllStores(staff.id),
              }"
            >
              <div class="staff-avatar-small">
                {{ staff.first_name.charAt(0) }}
              </div>
              <div class="gantt-staff-details">
                <span class="staff-name-small"
                  >{{ staff.last_name }} {{ staff.first_name }}</span
                >
                <span class="staff-role-small">{{
                  staff.position || "一般"
                }}</span>
                <div class="staff-hours-small">
                  <div class="hours-display">
                    <span class="current-hours current-store-hours"
                      >{{ selectedStore.name }}:
                      {{ formatHours(calculateTotalHours(staff.id)) }}</span
                    >
                    <div
                      v-if="getOtherStoreHoursBreakdown(staff.id).length > 0"
                      class="other-stores-hours-small"
                    >
                      <div
                        v-for="breakdown in getOtherStoreHoursBreakdown(
                          staff.id
                        )"
                        :key="breakdown.storeId"
                        class="store-breakdown-small"
                      >
                        {{ breakdown.storeName }}:
                        {{ formatHours(breakdown.hours) }}
                      </div>
                    </div>
                    <span
                      class="total-hours-all-stores"
                      :class="{
                        'out-of-range': isHoursOutOfRangeAllStores(staff.id),
                        'in-range': !isHoursOutOfRangeAllStores(staff.id),
                      }"
                    >
                      合計:
                      {{ formatHours(calculateTotalHoursAllStores(staff.id)) }}
                    </span>
                  </div>
                  <span class="hours-range">
                    /
                    {{ formatHours(staff.min_hours_per_month || 0) }} -
                    {{ formatHours(staff.max_hours_per_month || 0) }}
                  </span>
                </div>
              </div>
              <div
                v-if="hasStaffWarningsAllStores(staff.id)"
                class="warning-indicator-gantt"
                :title="
                  getStaffWarningsAllStores(staff.id)
                    .map((w) => w.message)
                    .join(', ')
                "
              >
                <i class="pi pi-exclamation-triangle"></i>
              </div>
            </div>

            <div
              class="gantt-timeline"
              :class="{
                'is-store-closed': isStoreClosedOnDate(selectedDate),
              }"
              @click="
                !isStoreClosedOnDate(selectedDate) &&
                  $emit('open-gantt-shift-editor', selectedDate, staff, $event)
              "
            >
              <div class="gantt-grid">
                <div
                  v-for="hour in timelineHours"
                  :key="`grid-${hour}`"
                  class="gantt-hour-line"
                  :style="getTimeHeaderStyle()"
                  :class="{
                    'has-shortage': hasHourlyShortage(selectedDate, hour),
                  }"
                ></div>
              </div>

              <div
                v-if="
                  !getShiftForStaff(selectedDate, staff.id) &&
                  !isStoreClosedOnDate(selectedDate)
                "
                class="gantt-availability-indicator"
                :style="getGanttAvailabilityStyle(staff, selectedDate)"
                :title="getGanttAvailabilityTooltip(staff, selectedDate)"
              ></div>

              <div
                v-if="getShiftForStaff(selectedDate, staff.id)"
                class="gantt-shift-block"
                :style="
                  getGanttBarStyle(getShiftForStaff(selectedDate, staff.id))
                "
                :class="{
                  'is-editable':
                    isEditMode && !isStoreClosedOnDate(selectedDate),
                  'is-past-editable':
                    isEditMode &&
                    isPastDate(selectedDate) &&
                    !isStoreClosedOnDate(selectedDate),
                }"
                @click.stop="
                  !isStoreClosedOnDate(selectedDate) &&
                    $emit('open-shift-editor', { date: selectedDate }, staff)
                "
              >
                <div
                  v-if="
                    getShiftForStaff(selectedDate, staff.id).break_start_time
                  "
                  class="gantt-break-bar"
                  :style="
                    getGanttBreakBarStyle(
                      getShiftForStaff(selectedDate, staff.id)
                    )
                  "
                ></div>
                <div class="shift-info-wrapper">
                  <span class="shift-time-text">
                    {{
                      formatTime(
                        getShiftForStaff(selectedDate, staff.id).start_time
                      )
                    }}
                    -
                    {{
                      formatTime(
                        getShiftForStaff(selectedDate, staff.id).end_time
                      )
                    }}
                  </span>
                  <span
                    v-if="
                      getShiftForStaff(selectedDate, staff.id).break_start_time &&
                      getShiftForStaff(selectedDate, staff.id).break_end_time
                    "
                    class="break-time-text"
                  >
                    休憩:
                    {{
                      formatTime(
                        getShiftForStaff(selectedDate, staff.id).break_start_time
                      )
                    }}
                    -
                    {{
                      formatTime(
                        getShiftForStaff(selectedDate, staff.id).break_end_time
                      )
                    }}
                  </span>
                </div>
                <div
                  v-if="hasShiftViolation(selectedDate, staff.id)"
                  class="gantt-violation-icon"
                >
                  <i class="pi pi-exclamation-triangle"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Button from "primevue/button";
import Calendar from "primevue/calendar";

export default {
  name: "GanttChart",
  components: {
    Button,
    Calendar,
  },
  props: {
    selectedDate: String,
    selectedDateCalendar: Date,
    minSelectableDate: Date,
    maxSelectableDate: Date,
    selectedStore: Object,
    staffList: Array,
    timelineHours: Array,
    loading: Boolean,
    isEditMode: Boolean,
    shifts: Array,
    getShiftForStaff: Function,
    calculateTotalHours: Function,
    calculateTotalHoursAllStores: Function,
    getOtherStoreHoursBreakdown: Function,
    isHoursOutOfRangeAllStores: Function,
    hasStaffWarningsAllStores: Function,
    getStaffWarningsAllStores: Function,
    isStoreClosedOnDate: Function,
    hasHourRequirements: Function,
    getHourRequirements: Function,
    hasRequirementShortage: Function,
    getAssignedStaffCount: Function,
    getHourlyStaffingInfo: Function,
    hasShiftViolation: Function,
    canStaffWorkOnDate: Function,
    formatSelectedDateDisplay: Function,
    formatTime: Function,
    formatHours: Function,
    isPastDate: Function,
  },
  emits: [
    "previous-date",
    "next-date",
    "gantt-date-select",
    "open-gantt-shift-editor",
    "open-shift-editor",
    "update:selectedDateCalendar",
  ],
  methods: {
    syncGanttScroll() {
      if (this.$refs.ganttTimelineHeader && this.$refs.ganttBody) {
        requestAnimationFrame(() => {
          this.$refs.ganttTimelineHeader.scrollLeft =
            this.$refs.ganttBody.scrollLeft;
        });
      }
    },
    getTimeHeaderStyle() {
      const hourWidth = 60;
      return {
        width: `${hourWidth}px`,
        minWidth: `${hourWidth}px`,
        flexShrink: 0,
      };
    },
    getGanttBarStyle(shift) {
      if (!shift) return {};

      const shiftStartTime = shift.start_time;
      const shiftEndTime = shift.end_time;

      const startHourFloat = this.parseTimeToFloat(shiftStartTime);
      const endHourFloat = this.parseTimeToFloat(shiftEndTime);

      const hourWidth = 60;
      const left = startHourFloat * hourWidth;
      const width = (endHourFloat - startHourFloat) * hourWidth;

      return {
        left: `${left}px`,
        width: `${width}px`,
      };
    },
    getGanttBreakBarStyle(shift) {
      if (!shift || !shift.break_start_time || !shift.break_end_time) {
        return { display: "none" };
      }

      const breakStartFloat = this.parseTimeToFloat(shift.break_start_time);
      const breakEndFloat = this.parseTimeToFloat(shift.break_end_time);
      const shiftStartFloat = this.parseTimeToFloat(shift.start_time);

      const hourWidth = 60;
      const breakStartOffset = (breakStartFloat - shiftStartFloat) * hourWidth;
      const breakWidth = (breakEndFloat - breakStartFloat) * hourWidth;

      return {
        left: `${breakStartOffset}px`,
        width: `${breakWidth}px`,
        display: "block",
      };
    },
    getGanttAvailabilityStyle(staff, date) {
      if (!this.canStaffWorkOnDate(staff, date)) {
        return { display: "none" };
      }

      const dayOfWeek = new Date(date).getDay();
      const dayPreference =
        staff.dayPreferences &&
        staff.dayPreferences.find((pref) => pref.day_of_week === dayOfWeek);

      if (
        !dayPreference ||
        !dayPreference.preferred_start_time ||
        !dayPreference.preferred_end_time
      ) {
        return { display: "none" };
      }

      const startHourFloat = this.parseTimeToFloat(
        dayPreference.preferred_start_time
      );
      const endHourFloat = this.parseTimeToFloat(
        dayPreference.preferred_end_time
      );

      const hourWidth = 60;
      const left = startHourFloat * hourWidth;
      const width = (endHourFloat - startHourFloat) * hourWidth;

      return {
        left: `${left}px`,
        width: `${width}px`,
        display: "block",
      };
    },
    getGanttAvailabilityTooltip(staff, date) {
      const dayOfWeek = new Date(date).getDay();
      const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
      const dayPreference =
        staff.dayPreferences &&
        staff.dayPreferences.find((pref) => pref.day_of_week === dayOfWeek);

      if (
        !dayPreference ||
        !dayPreference.preferred_start_time ||
        !dayPreference.preferred_end_time
      ) {
        return "";
      }

      return `${staff.last_name} ${staff.first_name}\n${
        dayNames[dayOfWeek]
      }曜日 希望時間：${this.formatTime(
        dayPreference.preferred_start_time
      )}-${this.formatTime(dayPreference.preferred_end_time)}`;
    },
    parseTimeToFloat(timeStr) {
      const [hours, minutes] = timeStr.split(":").map(Number);
      return hours + minutes / 60;
    },
    hasHourlyShortage(date, hour) {
      if (!this.getHourlyStaffingInfo) return false;
      const staffingInfo = this.getHourlyStaffingInfo(date, hour);
      return staffingInfo.some((info) => info.hasShortage);
    },
  },
};
</script>

<style scoped lang="scss">
.gantt-section {
  margin-bottom: 1.5rem;
  border-radius: 6px 6px 0 0;
  overflow: hidden;
}

.details-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  background: linear-gradient(135deg, #275a79, #275a79);
  color: #fff;
  padding: 10px 1.5rem 20px 1.5rem;
  border-radius: 6px 6px 0 0;
}

.details-title h3 {
  margin: 0;
  font-size: 1.25rem;
  color: #fff;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.details-title h3 i {
  color: var(--primary-color);
}

.details-navigation {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.nav-button-small {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: white;
  border: 1px solid #e0e0e0;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  cursor: pointer;
}

.nav-button-small:hover:not(:disabled) {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.nav-button-small:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.gantt-date-input {
  width: 180px;
}

.gantt-date-input :deep(.p-inputtext) {
  text-align: center;
  font-weight: 600;
}

.gantt-container {
  display: flex;
  flex-direction: column;
  background: white;
  overflow: hidden;
  min-height: 300px;
  flex: 1;
  padding: 0;
  box-shadow: inset 0px 0px 8px rgba(147, 147, 147, 1);
  padding: 8px;
}

.gantt-header {
  display: flex;
  background: #f9fafb;
  border-bottom: 2px solid #e5e7eb;
  position: sticky;
  top: 0;
  z-index: 10;
}

.gantt-staff-header {
  min-width: 240px;
  width: 240px;
  padding: 1rem;
  background: #fff;
  color: #1e293b;
  font-weight: 600;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 2px solid #e5e7eb;
  position: sticky;
  left: 0;
  z-index: 11;
}

.gantt-timeline-header {
  display: flex;
  overflow-x: hidden;
  background: #f9fafb;
  flex: 1;
}

.gantt-hour-cell {
  text-align: center;
  padding: 0.75rem 0.25rem;
  border-right: 1px solid #e5e7eb;
  font-size: 0.75rem;
  font-weight: 600;
  color: #475569;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.hour-label {
  font-weight: 700;
  color: #1e293b;
}

.hour-requirements {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.hour-requirement-badge {
  font-size: 0.65rem;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  transition: all 0.2s;
}

.hour-requirement-badge.satisfied {
  background: #10b981;
  color: white;
}

.hour-requirement-badge.shortage {
  background: #fbbf24;
  color: #78350f;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
  100% {
    opacity: 1;
  }
}

.staffing-count {
  font-weight: 700;
  font-size: 0.7rem;
}

.shortage-icon {
  font-size: 0.6rem;
}

.gantt-body {
  flex: 1;
  overflow: auto;
  background: white;
  min-height: 0;
}

.gantt-staff-rows {
  min-height: 100%;
  min-width: calc(24 * 60px);
}

.gantt-staff-row {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
  min-height: 70px;
}

.gantt-staff-row.has-warnings .gantt-timeline {
  background: #fef3c7;
}

.gantt-staff-row.store-closed-day .gantt-timeline {
  background: #f3f4f6 !important;
  opacity: 0.7;
}

.gantt-staff-info {
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
  z-index: 5;
}

.staff-avatar-small {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: #3b82f6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.75rem;
}

.gantt-staff-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.staff-name-small {
  font-weight: 600;
  color: #1e293b;
  font-size: 0.85rem;
}

.staff-role-small {
  font-size: 0.7rem;
  color: #64748b;
}

.staff-hours-small {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.75rem;
}

.other-stores-hours-small {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  margin-top: 0.25rem;
}

.store-breakdown-small {
  font-size: 0.65rem;
  color: #6b7280;
}

.warning-indicator-gantt {
  color: #f59e0b;
  font-size: 0.85rem;
  cursor: help;
}

.gantt-timeline {
  position: relative;
  cursor: pointer;
  min-height: 70px;
  width: calc(24 * 60px);
  min-width: calc(24 * 60px);
  display: flex;
  align-items: center;
  background: white;
  flex: 1;
}

.gantt-timeline.is-store-closed {
  background: #f3f4f6 !important;
  cursor: not-allowed;
}

.gantt-timeline.is-store-closed::after {
  content: "定休日";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #9ca3af;
  font-size: 0.75rem;
  font-weight: 500;
  pointer-events: none;
}

.gantt-grid {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  pointer-events: none;
  width: calc(24 * 60px);
}

.gantt-hour-line {
  border-right: 1px solid #e5e7eb;
  height: 100%;
  flex-shrink: 0;
  position: relative;
  transition: background-color 0.2s;
}

.gantt-hour-line.has-shortage {
  background-color: rgba(251, 191, 36, 0.1);
}

.gantt-hour-line::after {
  content: "";
  position: absolute;
  top: 0;
  left: 50%;
  width: 0;
  height: 100%;
  border-right: 1px dotted #d1d5db;
}

.gantt-shift-block {
  position: absolute;
  top: 10px;
  bottom: 10px;
  background: #10b981;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  z-index: 3;
  transition: all 0.2s;
  overflow: hidden;
}

.gantt-shift-block:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.gantt-shift-block.is-past-editable {
  background: #f59e0b;
}

.shift-info-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  padding: 0 0.75rem;
  position: relative;
  z-index: 2;
}

.shift-time-text {
  font-size: 0.75rem;
  white-space: nowrap;
}

.break-time-text {
  font-size: 0.65rem;
  opacity: 0.9;
  white-space: nowrap;
}

.gantt-violation-icon {
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
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.gantt-availability-indicator {
  position: absolute;
  top: 15px;
  bottom: 15px;
  background: rgba(16, 185, 129, 0.2);
  border: 2px dashed #10b981;
  border-radius: 4px;
  z-index: 2;
  pointer-events: none;
}

.gantt-break-bar {
  position: absolute;
  top: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.1);
  border-left: 1px dashed #ddd;
  border-right: 1px dashed #ddd;

  z-index: 1;
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

@media (max-width: 768px) {
  .gantt-container {
    min-height: 250px;
  }

  .gantt-staff-header,
  .gantt-staff-info {
    min-width: 200px;
    width: 200px;
  }
}
</style>