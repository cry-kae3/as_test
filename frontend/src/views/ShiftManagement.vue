<template>
  <div class="shift-management">
    <div class="header-section">
      <h1 class="page-title">シフト管理</h1>
    </div>

    <div class="control-panel">
      <div class="period-controls">
        <div class="month-navigator">
          <Button
            icon="pi pi-chevron-left"
            class="nav-button"
            @click="previousMonth"
            :disabled="loading"
          />
          <div class="period-display">
            <span class="year">{{ currentYear }}</span>
            <span class="month">{{ currentMonth }}月</span>
          </div>
          <Button
            icon="pi pi-chevron-right"
            class="nav-button"
            @click="nextMonth"
            :disabled="loading"
          />
        </div>

        <Dropdown
          v-model="selectedStore"
          :options="stores"
          optionLabel="name"
          placeholder="店舗を選択"
          class="store-selector"
          @change="changeStore"
          :disabled="loading || stores.length === 0"
        />
      </div>

      <div class="view-controls">
        <div class="view-mode-tabs">
          <button
            class="view-tab"
            :class="{ active: viewMode === 'calendar' }"
            @click="setViewMode('calendar')"
          >
            <i class="pi pi-table"></i>
            カレンダー
          </button>
          <button
            class="view-tab"
            :class="{ active: viewMode === 'gantt' }"
            @click="setViewMode('gantt')"
          >
            <i class="pi pi-chart-bar"></i>
            ガントチャート
          </button>
        </div>
      </div>

      <div class="action-controls">
        <Button
          v-if="!hasCurrentShift"
          label="シフト作成"
          icon="pi pi-plus"
          class="action-button create-button"
          @click="createShift"
          :disabled="loading || !selectedStore"
        />

        <template v-if="hasCurrentShift">
          <Button
            :label="isEditMode ? '編集完了' : 'シフト編集'"
            :icon="isEditMode ? 'pi pi-check' : 'pi pi-pencil'"
            :class="
              isEditMode
                ? 'action-button edit-button active'
                : 'action-button edit-button'
            "
            @click="toggleEditMode"
            :disabled="loading"
          />

          <Button
            label="AI再生成"
            icon="pi pi-refresh"
            class="action-button regenerate-button"
            @click="regenerateShift"
            :disabled="loading"
          />

          <Button
            label="シフト削除"
            icon="pi pi-trash"
            class="action-button delete-button"
            @click="deleteShift"
            :disabled="loading"
          />

          <Button
            label="印刷"
            icon="pi pi-print"
            class="action-button print-button"
            @click="printShift"
            :disabled="loading"
          />
        </template>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <ProgressSpinner />
      <span class="loading-text">データを読み込み中...</span>
    </div>

    <div v-else-if="!selectedStore" class="empty-state">
      <div class="empty-icon">
        <i class="pi pi-building"></i>
      </div>
      <h3>店舗を選択してください</h3>
      <p>シフトを表示するには店舗を選択する必要があります</p>
    </div>

    <div v-else-if="!hasCurrentShift" class="empty-state">
      <div class="empty-icon">
        <i class="pi pi-calendar-plus"></i>
      </div>
      <h3>シフトがありません</h3>
      <p>
        {{ currentYear }}年{{ currentMonth }}月のシフトはまだ作成されていません
      </p>
      <Button
        label="シフトを作成"
        icon="pi pi-plus"
        class="action-button create-button"
        @click="createShift"
      />
    </div>

    <div v-else class="shift-content">
      <div v-if="isEditMode" class="edit-mode-indicator">
        <i class="pi pi-pencil"></i>
        <span>編集モード - セルをクリックして編集</span>
      </div>

      <div v-if="viewMode === 'calendar'" class="calendar-view">
        <div class="calendar-container">
          <div class="calendar-header">
            <div class="staff-column-header">
              <span>スタッフ</span>
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
                  :data-warning-count="getDateWarnings(day.date).length"
                >
                  <i class="pi pi-exclamation-triangle"></i>
                  <div class="warning-tooltip">
                    <div
                      v-for="warning in getDateWarnings(day.date)"
                      :key="warning.type"
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
                  <span class="staff-role">{{ staff.position || "一般" }}</span>
                  <div class="staff-hours-info">
                    <span
                      class="current-hours"
                      :class="{ 'out-of-range': isHoursOutOfRange(staff.id) }"
                      >{{ formatHours(calculateTotalHours(staff.id)) }}</span
                    >
                    <span
                      v-if="hasTotalHoursFromOtherStores(staff.id)"
                      class="total-hours-all-stores"
                      :class="{
                        'out-of-range': isHoursOutOfRangeAllStores(staff.id),
                      }"
                    >
                      ({{
                        formatHours(calculateTotalHoursAllStores(staff.id))
                      }})
                    </span>
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
                  'past-editable':
                    isEditMode && isPastDate(day.date),
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
                  <div class="shift-work-time">
                    <div class="shift-start">
                      {{ formatTime(getShiftForStaff(day.date, staff.id).start_time) }}
                    </div>
                    <div class="shift-separator">-</div>
                    <div class="shift-end">
                      {{ formatTime(getShiftForStaff(day.date, staff.id).end_time) }}
                    </div>
                  </div>
                  <div
                    v-if="getShiftForStaff(day.date, staff.id).break_start_time"
                    class="shift-break-time"
                  >
                    <i class="pi pi-coffee"></i>
                    <span>{{ formatTime(getShiftForStaff(day.date, staff.id).break_start_time) }} - {{ formatTime(getShiftForStaff(day.date, staff.id).break_end_time) }}</span>
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
                    v-if="isEditMode && canStaffWorkOnDate(staff, day.date) && hasRemainingMonthlyHours(staff.id)"
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
                  <span v-else-if="isEditMode && hasRemainingMonthlyHours(staff.id)">+</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="gantt-info-panel">
          <div v-if="selectedDate" class="date-info-header">
            <div class="date-navigation-header">
              <Button
                icon="pi pi-chevron-left"
                class="nav-button-small"
                @click="previousDate"
                :disabled="loading"
              />
              <h3>{{ formatDateForGantt(selectedDate) }}</h3>
              <Button
                icon="pi pi-chevron-right"
                class="nav-button-small"
                @click="nextDate"
                :disabled="loading"
              />
            </div>
            <div v-if="hasDateWarnings(selectedDate)" class="date-warnings">
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

          <div v-if="selectedDate" class="requirements-section">
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

          <div class="staff-summary-section">
            <h4 class="section-title">
              <i class="pi pi-user"></i>
              スタッフ状況
            </h4>
            <div class="staff-summary-grid">
              <div
                v-for="staff in staffList"
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
                    <span
                      class="stat-value"
                      :class="{ 'out-of-range': isHoursOutOfRange(staff.id) }"
                      >{{ formatHours(calculateTotalHours(staff.id)) }}</span
                    >
                    <span
                      v-if="hasTotalHoursFromOtherStores(staff.id)"
                      class="total-hours-all-stores"
                      :class="{
                        'out-of-range': isHoursOutOfRangeAllStores(staff.id),
                      }"
                    >
                      ({{
                        formatHours(calculateTotalHoursAllStores(staff.id))
                      }})
                    </span>
                    <span class="stat-range">
                      / {{ formatHours(staff.min_hours_per_month || 0) }} -
                      {{ formatHours(staff.max_hours_per_month || 0) }}
                    </span>
                  </div>

                  <div
                    v-if="getShiftForStaff(selectedDate, staff.id)"
                    class="today-shift"
                  >
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
            </div>
          </div>
        </div>
      </div>
      <div v-if="viewMode === 'gantt'" class="gantt-view">
        <div v-if="selectedDate" class="gantt-container">
          <div class="gantt-header">
            <div class="gantt-staff-header">
              <span>スタッフ</span>
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
                    v-for="req in getHourRequirements(selectedDate, hour)"
                    :key="`${req.start_time}-${req.end_time}`"
                    class="hour-requirement-badge"
                    :class="{
                      shortage: hasRequirementShortage(selectedDate, req),
                    }"
                  >
                    {{ getAssignedStaffCount(selectedDate, req) }}/{{
                      req.required_staff_count
                    }}
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
                      <span
                        class="current-hours"
                        :class="{ 'out-of-range': isHoursOutOfRange(staff.id) }"
                        >{{ formatHours(calculateTotalHours(staff.id)) }}</span
                      >
                      <span
                        v-if="hasTotalHoursFromOtherStores(staff.id)"
                        class="total-hours-all-stores"
                        :class="{
                          'out-of-range': isHoursOutOfRangeAllStores(staff.id),
                        }"
                      >
                        ({{
                          formatHours(calculateTotalHoursAllStores(staff.id))
                        }})
                      </span>
                      <span class="hours-range">
                        / {{ formatHours(staff.min_hours_per_month || 0) }} -
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
                      openGanttShiftEditor(selectedDate, staff, $event)
                  "
                >
                  <div class="gantt-grid">
                    <div
                      v-for="hour in timelineHours"
                      :key="`grid-${hour}`"
                      class="gantt-hour-line"
                      :style="getTimeHeaderStyle()"
                    ></div>
                  </div>

                  <div
                    v-if="
                      !getShiftForStaff(selectedDate, staff.id) &&
                      !isStoreClosedOnDate(selectedDate) &&
                      hasRemainingMonthlyHours(staff.id)
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
                        openShiftEditor({ date: selectedDate }, staff)
                    "
                  >
                    <div class="gantt-shift-content">
                        <span class="shift-time-text">
                        {{ formatTime(getShiftForStaff(selectedDate, staff.id).start_time) }}
                        -
                        {{ formatTime(getShiftForStaff(selectedDate, staff.id).end_time) }}
                        </span>
                        <div v-if="getShiftForStaff(selectedDate, staff.id).break_start_time" class="gantt-break-block" :style="getGanttBreakBarStyle(getShiftForStaff(selectedDate, staff.id))"></div>
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

        <div v-if="!selectedDate" class="gantt-no-date">
          <div class="empty-icon">
            <i class="pi pi-calendar"></i>
          </div>
          <h3>日付を選択してください</h3>
          <p>ガントチャートを表示するには日付を選択してください</p>
        </div>

        <div class="gantt-info-panel">
          <div v-if="selectedDate" class="date-info-header">
            <div class="date-navigation-header">
              <Button
                icon="pi pi-chevron-left"
                class="nav-button-small"
                @click="previousDate"
                :disabled="loading"
              />
              <h3>{{ formatDateForGantt(selectedDate) }}</h3>
              <Button
                icon="pi pi-chevron-right"
                class="nav-button-small"
                @click="nextDate"
                :disabled="loading"
              />
            </div>
            <div v-if="hasDateWarnings(selectedDate)" class="date-warnings">
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

          <div v-if="selectedDate" class="requirements-section">
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

          <div class="staff-summary-section">
            <h4 class="section-title">
              <i class="pi pi-user"></i>
              スタッフ状況
            </h4>
            <div class="staff-summary-grid">
              <div
                v-for="staff in staffList"
                :key="`gantt-summary-${staff.id}`"
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
                    <span
                      class="stat-value"
                      :class="{ 'out-of-range': isHoursOutOfRange(staff.id) }"
                      >{{ formatHours(calculateTotalHours(staff.id)) }}</span
                    >
                    <span
                      v-if="hasTotalHoursFromOtherStores(staff.id)"
                      class="total-hours-all-stores"
                      :class="{
                        'out-of-range': isHoursOutOfRangeAllStores(staff.id),
                      }"
                    >
                      ({{
                        formatHours(calculateTotalHoursAllStores(staff.id))
                      }})
                    </span>
                    <span class="stat-range">
                      / {{ formatHours(staff.min_hours_per_month || 0) }} -
                      {{ formatHours(staff.max_hours_per_month || 0) }}
                    </span>
                  </div>

                  <div
                    v-if="
                      selectedDate && getShiftForStaff(selectedDate, staff.id)
                    "
                    class="today-shift"
                  >
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
            </div>
          </div>
        </div>
      </div>
    </div>

    <Dialog
      v-model:visible="shiftEditorDialog.visible"
      :header="shiftEditorDialog.title"
      :modal="true"
      class="shift-editor-dialog"
      :style="{ width: '500px' }"
      :closable="!saving"
    >
      <div class="shift-editor-form">
        <div v-if="shiftEditorDialog.isPast" class="status-alert warning">
          <i class="pi pi-exclamation-triangle"></i>
          <span>過去の日付を編集しています。変更は履歴に記録されます。</span>
        </div>

        <div class="time-inputs-section">
          <h5>勤務時間</h5>
          <div class="time-input-group">
            <label class="form-label">開始時間</label>
            <div class="time-selector">
              <Dropdown
                v-model="shiftEditorDialog.startTimeHour"
                :options="hourOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="時"
                class="time-dropdown"
              />
              <span class="time-separator">:</span>
              <Dropdown
                v-model="shiftEditorDialog.startTimeMinute"
                :options="minuteOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="分"
                class="time-dropdown"
              />
            </div>
          </div>

          <div class="time-input-group">
            <label class="form-label">終了時間</label>
            <div class="time-selector">
              <Dropdown
                v-model="shiftEditorDialog.endTimeHour"
                :options="hourOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="時"
                class="time-dropdown"
              />
              <span class="time-separator">:</span>
              <Dropdown
                v-model="shiftEditorDialog.endTimeMinute"
                :options="minuteOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="分"
                class="time-dropdown"
              />
            </div>
          </div>
        </div>
        
        <div class="time-inputs-section">
          <h5>休憩時間 (任意)</h5>
           <div class="time-input-group">
            <label class="form-label">休憩開始</label>
            <div class="time-selector">
              <Dropdown v-model="shiftEditorDialog.breakStartTimeHour" :options="hourOptions" optionLabel="label" optionValue="value" placeholder="時" class="time-dropdown" showClear />
              <span class="time-separator">:</span>
              <Dropdown v-model="shiftEditorDialog.breakStartTimeMinute" :options="minuteOptions" optionLabel="label" optionValue="value" placeholder="分" class="time-dropdown" showClear />
            </div>
          </div>

          <div class="time-input-group">
            <label class="form-label">休憩終了</label>
            <div class="time-selector">
              <Dropdown v-model="shiftEditorDialog.breakEndTimeHour" :options="hourOptions" optionLabel="label" optionValue="value" placeholder="時" class="time-dropdown" showClear />
              <span class="time-separator">:</span>
              <Dropdown v-model="shiftEditorDialog.breakEndTimeMinute" :options="minuteOptions" optionLabel="label" optionValue="value" placeholder="分" class="time-dropdown" showClear />
            </div>
          </div>
        </div>

        <div class="form-group checkbox-group">
          <Checkbox
            v-model="shiftEditorDialog.isRestDay"
            binary
            class="form-checkbox"
          />
          <label class="checkbox-label">休日として設定</label>
        </div>

        <div v-if="shiftEditorDialog.isPast" class="form-group">
          <label class="form-label">変更理由</label>
          <Textarea
            v-model="shiftEditorDialog.changeReason"
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
            @click="clearShift"
            :disabled="saving || !shiftEditorDialog.hasShift"
          />
          <Button
            label="キャンセル"
            icon="pi pi-times"
            class="cancel-button"
            @click="closeShiftEditor"
            :disabled="saving"
          />
          <Button
            label="保存"
            icon="pi pi-check"
            class="save-button"
            @click="saveShift"
            :loading="saving"
          />
        </div>
      </template>
    </Dialog>
    
    <Dialog v-model:visible="selectionDialogVisible" header="シフト作成方法の選択" :modal="true" :style="{ width: '50rem' }" :breakpoints="{ '960px': '75vw', '640px': '90vw' }">
      <div class="grid">
        <div class="col-12 md:col-6 p-2">
          <div class="selection-card" @click="selectAIGeneration">
            <div class="card-header">
              <i class="pi pi-sparkles"></i>
              <h3>AI自動生成</h3>
            </div>
            <p class="card-content">
              スタッフの勤務条件を最優先にシフトを組みます。人員要件を満たさない場合があるため、生成後に手動での調整が必要になることがあります。
            </p>
            <Button label="AIで作成" class="p-button-primary mt-auto" />
          </div>
        </div>
        <div class="col-12 md:col-6 p-2">
          <div class="selection-card" @click="selectManualCreation">
            <div class="card-header">
               <i class="pi pi-pencil"></i>
               <h3>手動作成</h3>
            </div>
            <p class="card-content">
              空のシフト表が作成されます。すべての割り当てを手動で行い、ご自身で勤務条件を確認する必要があります。
            </p>
            <Button label="手動で作成" class="p-button-secondary mt-auto" />
          </div>
        </div>
      </div>
    </Dialog>

    <ConfirmDialog></ConfirmDialog>
    <Toast />
  </div>
</template>