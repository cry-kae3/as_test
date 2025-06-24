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
                  'past-editable': isEditMode && isPastDate(day.date),
                  'is-selected': selectedDate === day.date,
                  'is-store-closed': day.isStoreClosed,
                  'can-work':
                    canStaffWorkOnDate(staff, day.date) &&
                    !getShiftForStaff(day.date, staff.id),
                  unavailable:
                    !canStaffWorkOnDate(staff, day.date) &&
                    !getShiftForStaff(day.date, staff.id),
                }"
                @click="openShiftEditor(day, staff)"
              >
                <div
                  v-if="getShiftForStaff(day.date, staff.id)"
                  class="shift-time-card"
                >
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
                      formatTime(getShiftForStaff(day.date, staff.id).end_time)
                    }}
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

        <div class="gantt-info-panel">
          <div class="date-info-header">
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

          <div class="requirements-section">
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
                  @click="openGanttShiftEditor(selectedDate, staff, $event)"
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
                    v-if="!getShiftForStaff(selectedDate, staff.id)"
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
                      'is-editable': isEditMode,
                      'is-past-editable':
                        isEditMode && isPastDate(selectedDate),
                    }"
                    @click.stop="openShiftEditor({ date: selectedDate }, staff)"
                  >
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

    <ConfirmDialog></ConfirmDialog>
    <Toast />
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, watch, nextTick } from "vue";
import { useStore } from "vuex";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import InputMask from "primevue/inputmask";
import ProgressSpinner from "primevue/progressspinner";
import Message from "primevue/message";
import ConfirmDialog from "primevue/confirmdialog";
import Toast from "primevue/toast";
import Checkbox from "primevue/checkbox";
import Textarea from "primevue/textarea";
import SelectButton from "primevue/selectbutton";
import Calendar from "primevue/calendar";
import api from "@/services/api";

export default {
  name: "ShiftManagement",
  components: {
    InputMask,
    ProgressSpinner,
    Message,
    ConfirmDialog,
    Toast,
    Checkbox,
    Textarea,
    SelectButton,
    Calendar,
  },
  setup() {
    const store = useStore();
    const toast = useToast();
    const confirm = useConfirm();

    const loading = ref(false);
    const saving = ref(false);
    const isEditMode = ref(false);
    const viewMode = ref("calendar");
    const selectedDate = ref(null);
    const ganttSelectedDate = ref(null);
    const ganttMinDate = ref(null);
    const ganttMaxDate = ref(null);
    const currentYear = ref(new Date().getFullYear());
    const currentMonth = ref(new Date().getMonth() + 1);
    const selectedStore = ref(null);
    const stores = ref([]);
    const staffList = ref([]);
    const shifts = ref([]);
    const daysInMonth = ref([]);
    const currentShift = ref(null);
    const systemSettings = ref({ closing_day: 25 });
    const holidays = ref([]);
    const storeRequirements = ref([]);
    const currentStore = ref(null);

    const allStoreShifts = ref({});

    const ganttContainer = ref(null);
    const ganttTimelineHeader = ref(null);
    const ganttBody = ref(null);

    const hourOptions = ref([]);
    const minuteOptions = ref([]);

    const generateTimeOptions = () => {
      hourOptions.value = Array.from({ length: 24 }, (_, i) => ({
        label: i.toString().padStart(2, "0"),
        value: i.toString().padStart(2, "0"),
      }));

      minuteOptions.value = [
        { label: "00", value: "00" },
        { label: "15", value: "15" },
        { label: "30", value: "30" },
        { label: "45", value: "45" },
      ];
    };

    const timelineHours = computed(() => {
      const hours = [];
      for (let hour = 0; hour <= 23; hour++) {
        hours.push(hour);
      }
      return hours;
    });

    const dateOptions = computed(() => {
      return daysInMonth.value.map((day) => ({
        label: formatDateForGantt(day.date),
        value: day.date,
      }));
    });

    const shiftEditorDialog = reactive({
      visible: false,
      title: "",
      date: null,
      staff: null,
      startTimeHour: "09",
      startTimeMinute: "00",
      endTimeHour: "18",
      endTimeMinute: "00",
      isRestDay: false,
      isPast: false,
      hasShift: false,
      changeReason: "",
    });

    const hasCurrentShift = computed(() => {
      return currentShift.value !== null;
    });

    const fetchAllStoreShifts = async () => {
      if (
        !staffList.value ||
        staffList.value.length === 0 ||
        !selectedStore.value
      ) {
        return;
      }

      try {
        console.log("=== 他店舗シフト取得開始 ===");
        console.log(
          "対象期間:",
          currentYear.value,
          "年",
          currentMonth.value,
          "月"
        );
        console.log("除外店舗ID:", selectedStore.value.id);

        const uniqueStoreIds = new Set();

        staffList.value.forEach((staff) => {
          let storeIds = [];
          if (staff.store_ids && Array.isArray(staff.store_ids)) {
            storeIds = staff.store_ids;
          } else if (staff.stores && Array.isArray(staff.stores)) {
            storeIds = staff.stores.map((s) => s.id);
          }

          storeIds.forEach((id) => {
            if (id !== selectedStore.value.id) {
              uniqueStoreIds.add(id);
            }
          });
        });

        console.log("他店舗ID一覧:", Array.from(uniqueStoreIds));

        const storeShiftsPromises = Array.from(uniqueStoreIds).map(
          async (storeId) => {
            try {
              console.log(`店舗ID ${storeId} のシフト取得中...`);
              const response = await store.dispatch(
                "shift/fetchShiftByYearMonth",
                {
                  year: currentYear.value,
                  month: currentMonth.value,
                  storeId: storeId,
                }
              );
              console.log(
                `店舗ID ${storeId} のシフト取得完了:`,
                response?.shifts?.length || 0,
                "シフト"
              );
              return { storeId, shifts: response?.shifts || [] };
            } catch (error) {
              console.log(
                `店舗ID ${storeId} のシフトデータ取得エラー:`,
                error.message
              );
              return { storeId, shifts: [] };
            }
          }
        );

        const results = await Promise.all(storeShiftsPromises);

        allStoreShifts.value = {};
        let totalOtherStoreShifts = 0;

        results.forEach(({ storeId, shifts }) => {
          allStoreShifts.value[storeId] = shifts;
          totalOtherStoreShifts += shifts.length;
        });

        console.log("=== 他店舗シフト取得完了 ===");
        console.log("取得店舗数:", results.length);
        console.log("総シフト数:", totalOtherStoreShifts);
        console.log("詳細データ:", allStoreShifts.value);

        staffList.value.forEach((staff) => {
          const otherStoreHours =
            calculateTotalHoursAllStores(staff.id) -
            calculateTotalHours(staff.id);
          if (otherStoreHours > 0) {
            console.log(
              `${staff.last_name} ${
                staff.first_name
              }: 他店舗 ${otherStoreHours.toFixed(1)}時間`
            );
          }
        });
      } catch (error) {
        console.error("全店舗シフトデータ取得エラー:", error);
        allStoreShifts.value = {};
      }
    };

    const calculateTotalHours = (staffId) => {
      let totalMinutes = 0;

      shifts.value.forEach((dayShift) => {
        const assignment = dayShift.assignments.find(
          (a) => a.staff_id === staffId
        );
        if (assignment) {
          const startTime = new Date(`2000-01-01T${assignment.start_time}`);
          const endTime = new Date(`2000-01-01T${assignment.end_time}`);
          let minutes = (endTime - startTime) / (1000 * 60);

          if (assignment.break_start_time && assignment.break_end_time) {
            const breakStart = new Date(
              `2000-01-01T${assignment.break_start_time}`
            );
            const breakEnd = new Date(
              `2000-01-01T${assignment.break_end_time}`
            );
            const breakMinutes = (breakEnd - breakStart) / (1000 * 60);
            minutes -= breakMinutes;
          }

          totalMinutes += minutes;
        }
      });

      return Math.round((totalMinutes / 60) * 10) / 10;
    };

    const calculateTotalHoursAllStores = (staffId) => {
      let totalMinutes = 0;

      shifts.value.forEach((dayShift) => {
        const assignment = dayShift.assignments.find(
          (a) => a.staff_id === staffId
        );
        if (assignment) {
          const startTime = new Date(`2000-01-01T${assignment.start_time}`);
          const endTime = new Date(`2000-01-01T${assignment.end_time}`);
          let minutes = (endTime - startTime) / (1000 * 60);

          if (assignment.break_start_time && assignment.break_end_time) {
            const breakStart = new Date(
              `2000-01-01T${assignment.break_start_time}`
            );
            const breakEnd = new Date(
              `2000-01-01T${assignment.break_end_time}`
            );
            const breakMinutes = (breakEnd - breakStart) / (1000 * 60);
            minutes -= breakMinutes;
          }

          totalMinutes += minutes;
        }
      });

      const staff = staffList.value.find((s) => s.id === staffId);
      if (!staff) return Math.round((totalMinutes / 60) * 10) / 10;

      let staffStoreIds = [];
      if (staff.store_ids && Array.isArray(staff.store_ids)) {
        staffStoreIds = staff.store_ids;
      } else if (staff.stores && Array.isArray(staff.stores)) {
        staffStoreIds = staff.stores.map((s) => s.id);
      }

      Object.entries(allStoreShifts.value).forEach(([storeId, storeShifts]) => {
        const storeIdNum = parseInt(storeId);
        if (
          storeIdNum === selectedStore.value?.id ||
          !staffStoreIds.includes(storeIdNum)
        ) {
          return;
        }

        if (storeShifts && Array.isArray(storeShifts)) {
          storeShifts.forEach((dayShift) => {
            if (dayShift.assignments && Array.isArray(dayShift.assignments)) {
              const assignment = dayShift.assignments.find(
                (a) => a.staff_id === staffId
              );
              if (assignment) {
                const startTime = new Date(
                  `2000-01-01T${assignment.start_time}`
                );
                const endTime = new Date(`2000-01-01T${assignment.end_time}`);
                let minutes = (endTime - startTime) / (1000 * 60);

                if (assignment.break_start_time && assignment.break_end_time) {
                  const breakStart = new Date(
                    `2000-01-01T${assignment.break_start_time}`
                  );
                  const breakEnd = new Date(
                    `2000-01-01T${assignment.break_end_time}`
                  );
                  const breakMinutes = (breakEnd - breakStart) / (1000 * 60);
                  minutes -= breakMinutes;
                }

                totalMinutes += minutes;
              }
            }
          });
        }
      });

      return Math.round((totalMinutes / 60) * 10) / 10;
    };

    const hasTotalHoursFromOtherStores = (staffId) => {
      const currentStoreHours = calculateTotalHours(staffId);
      const allStoreHours = calculateTotalHoursAllStores(staffId);
      return allStoreHours > currentStoreHours;
    };

    const isHoursOutOfRange = (staffId) => {
      const staff = staffList.value.find((s) => s.id === staffId);
      if (!staff) return false;

      const totalHours = calculateTotalHours(staffId);
      const minHours = staff.min_hours_per_month || 0;
      const maxHours = staff.max_hours_per_month || 0;

      if (minHours === 0 && maxHours === 0) return false;

      return totalHours < minHours || totalHours > maxHours;
    };

    const isHoursOutOfRangeAllStores = (staffId) => {
      const staff = staffList.value.find((s) => s.id === staffId);
      if (!staff) return false;

      const totalHours = calculateTotalHoursAllStores(staffId);
      const minHours = staff.min_hours_per_month || 0;
      const maxHours = staff.max_hours_per_month || 0;

      if (minHours === 0 && maxHours === 0) return false;

      return totalHours < minHours || totalHours > maxHours;
    };

    const hasStaffWarnings = (staffId) => {
      const staff = staffList.value.find((s) => s.id === staffId);
      if (!staff) return false;

      const totalHours = calculateTotalHours(staffId);
      const maxMonthHours = staff.max_hours_per_month || 0;
      const minMonthHours = staff.min_hours_per_month || 0;

      return totalHours > maxMonthHours || totalHours < minMonthHours;
    };

    const getStaffWarnings = (staffId) => {
      const warnings = [];
      const staff = staffList.value.find((s) => s.id === staffId);
      if (!staff) return warnings;

      const totalHours = calculateTotalHours(staffId);
      const maxMonthHours = staff.max_hours_per_month || 0;
      const minMonthHours = staff.min_hours_per_month || 0;

      if (totalHours > maxMonthHours) {
        warnings.push({
          type: "over_hours",
          icon: "pi pi-exclamation-triangle",
          message: `月間勤務時間が上限を超過 (${formatHours(
            totalHours
          )} > ${formatHours(maxMonthHours)})`,
        });
      }

      if (totalHours < minMonthHours) {
        warnings.push({
          type: "under_hours",
          icon: "pi pi-exclamation-triangle",
          message: `月間勤務時間が下限を下回り (${formatHours(
            totalHours
          )} < ${formatHours(minMonthHours)})`,
        });
      }

      return warnings;
    };

    const updateGanttDateRange = () => {
      if (daysInMonth.value.length > 0) {
        ganttMinDate.value = new Date(daysInMonth.value[0].date);
        ganttMaxDate.value = new Date(
          daysInMonth.value[daysInMonth.value.length - 1].date
        );
      }
    };

    const onGanttDateSelected = (date) => {
      if (date) {
        const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1)
          .toString()
          .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;

        const validDate = daysInMonth.value.find((day) => day.date === dateStr);
        if (validDate) {
          selectedDate.value = dateStr;
        }
      }
    };

    const previousDate = () => {
      if (!selectedDate.value || daysInMonth.value.length === 0) return;

      const currentIndex = daysInMonth.value.findIndex(
        (day) => day.date === selectedDate.value
      );
      if (currentIndex > 0) {
        selectedDate.value = daysInMonth.value[currentIndex - 1].date;
        ganttSelectedDate.value = new Date(selectedDate.value);
      }
    };

    const nextDate = () => {
      if (!selectedDate.value || daysInMonth.value.length === 0) return;

      const currentIndex = daysInMonth.value.findIndex(
        (day) => day.date === selectedDate.value
      );
      if (currentIndex < daysInMonth.value.length - 1) {
        selectedDate.value = daysInMonth.value[currentIndex + 1].date;
        ganttSelectedDate.value = new Date(selectedDate.value);
      }
    };

    const getDailyRequirements = (date) => {
      if (!storeRequirements.value || storeRequirements.value.length === 0) {
        return [];
      }

      const dayOfWeek = new Date(date).getDay();

      const specificRequirements = storeRequirements.value.filter(
        (req) => req.specific_date && req.specific_date === date
      );

      if (specificRequirements.length > 0) {
        return specificRequirements;
      }

      return storeRequirements.value.filter(
        (req) => req.day_of_week === dayOfWeek && !req.specific_date
      );
    };

    const hasHourRequirements = (date, hour) => {
      const requirements = getDailyRequirements(date);
      return requirements.some((req) => {
        const reqStartHour = parseTimeToFloat(req.start_time);
        const reqEndHour = parseTimeToFloat(req.end_time);
        return hour >= reqStartHour && hour < reqEndHour;
      });
    };

    const hasHourShortage = (date, hour) => {
      const requirements = getHourRequirements(date, hour);
      return requirements.some((req) => hasRequirementShortage(date, req));
    };

    const getHourRequirements = (date, hour) => {
      const requirements = getDailyRequirements(date);
      return requirements.filter((req) => {
        const reqStartHour = parseTimeToFloat(req.start_time);
        const reqEndHour = parseTimeToFloat(req.end_time);
        return hour >= reqStartHour && hour < reqEndHour;
      });
    };

    const formatHours = (hours) => {
      if (typeof hours !== "number" || isNaN(hours) || hours < 0) {
        hours = 0;
      }

      const totalMinutes = Math.round(hours * 60);
      const displayHours = Math.floor(totalMinutes / 60);
      const displayMinutes = totalMinutes % 60;

      if (displayMinutes === 0) {
        return `${displayHours}時間`;
      } else {
        return `${displayHours}時間${displayMinutes}分`;
      }
    };

    const canStaffWorkOnDate = (staff, date) => {
      const hasDayOffRequest =
        staff.dayOffRequests &&
        staff.dayOffRequests.some(
          (request) =>
            request.date === date &&
            (request.status === "approved" || request.status === "pending")
        );

      if (hasDayOffRequest) {
        return false;
      }

      const dayOfWeek = new Date(date).getDay();
      const dayPreference =
        staff.dayPreferences &&
        staff.dayPreferences.find((pref) => pref.day_of_week === dayOfWeek);

      if (dayPreference && !dayPreference.available) {
        return false;
      }

      return true;
    };

    const getWorkAvailabilityTooltip = (staff, date) => {
      const dayOfWeek = new Date(date).getDay();
      const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
      const dayPreference =
        staff.dayPreferences &&
        staff.dayPreferences.find((pref) => pref.day_of_week === dayOfWeek);

      let tooltip = `${dayNames[dayOfWeek]}曜日：勤務可能`;

      if (
        dayPreference &&
        dayPreference.preferred_start_time &&
        dayPreference.preferred_end_time
      ) {
        tooltip += `\n希望時間：${formatTime(
          dayPreference.preferred_start_time
        )}-${formatTime(dayPreference.preferred_end_time)}`;
      }

      return tooltip;
    };

    const getWorkUnavailabilityReason = (staff, date) => {
      const dayOffRequest =
        staff.dayOffRequests &&
        staff.dayOffRequests.find(
          (request) =>
            request.date === date &&
            (request.status === "approved" || request.status === "pending")
        );

      if (dayOffRequest) {
        return `休み希望：${dayOffRequest.reason || "お休み"}`;
      }

      const dayOfWeek = new Date(date).getDay();
      const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
      const dayPreference =
        staff.dayPreferences &&
        staff.dayPreferences.find((pref) => pref.day_of_week === dayOfWeek);

      if (dayPreference && !dayPreference.available) {
        return `${dayNames[dayOfWeek]}曜日：勤務不可`;
      }
      

      return "勤務不可";
    };

    const getGanttAvailabilityStyle = (staff, date) => {
      if (!canStaffWorkOnDate(staff, date)) {
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

      const startHourFloat = parseTimeToFloat(
        dayPreference.preferred_start_time
      );
      const endHourFloat = parseTimeToFloat(dayPreference.preferred_end_time);

      const hourWidth = 60;
      const left = startHourFloat * hourWidth;
      const width = (endHourFloat - startHourFloat) * hourWidth;

      return {
        left: `${left}px`,
        width: `${width}px`,
        display: "block",
      };
    };

    const getGanttAvailabilityTooltip = (staff, date) => {
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
      }曜日 希望時間：${formatTime(
        dayPreference.preferred_start_time
      )}-${formatTime(dayPreference.preferred_end_time)}`;
    };

    const hasRequirementShortage = (date, requirement) => {
      const assignedCount = getAssignedStaffCount(date, requirement);
      return assignedCount < requirement.required_staff_count;
    };

    const getConsecutiveWorkDays = (staffId, currentDate) => {
      if (!shifts.value || shifts.value.length === 0) return 0;

      const currentDateObj = new Date(currentDate);
      let consecutiveDays = 0;
      let checkDate = new Date(currentDateObj);

      while (true) {
        const dateStr = `${checkDate.getFullYear()}-${(checkDate.getMonth() + 1)
          .toString()
          .padStart(2, "0")}-${checkDate
          .getDate()
          .toString()
          .padStart(2, "0")}`;

        const hasShift = shifts.value.some(
          (dayShift) =>
            dayShift.date === dateStr &&
            dayShift.assignments.some(
              (assignment) => assignment.staff_id === staffId
            )
        );

        if (hasShift) {
          consecutiveDays++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      checkDate = new Date(currentDateObj);
      checkDate.setDate(checkDate.getDate() + 1);

      while (true) {
        const dateStr = `${checkDate.getFullYear()}-${(checkDate.getMonth() + 1)
          .toString()
          .padStart(2, "0")}-${checkDate
          .getDate()
          .toString()
          .padStart(2, "0")}`;

        const hasShift = shifts.value.some(
          (dayShift) =>
            dayShift.date === dateStr &&
            dayShift.assignments.some(
              (assignment) => assignment.staff_id === staffId
            )
        );

        if (hasShift) {
          consecutiveDays++;
          checkDate.setDate(checkDate.getDate() + 1);
        } else {
          break;
        }
      }

      return consecutiveDays;
    };

    const calculateDayHours = (shift) => {
      if (!shift) return 0;

      const startTime = new Date(`2000-01-01T${shift.start_time}`);
      const endTime = new Date(`2000-01-01T${shift.end_time}`);
      let minutes = (endTime - startTime) / (1000 * 60);

      if (shift.break_start_time && shift.break_end_time) {
        const breakStart = new Date(`2000-01-01T${shift.break_start_time}`);
        const breakEnd = new Date(`2000-01-01T${shift.break_end_time}`);
        const breakMinutes = (breakEnd - breakStart) / (1000 * 60);
        minutes -= breakMinutes;
      }

      return Math.round((minutes / 60) * 10) / 10;
    };

    const fetchStoreDetails = async (storeId) => {
      try {
        const storeData = await store.dispatch("store/fetchStore", storeId);

        const businessHours = await store.dispatch(
          "store/fetchStoreBusinessHours",
          storeId
        );

        currentStore.value = {
          ...storeData,
          operating_hours: businessHours || [],
        };

        console.log(
          "fetchStoreDetails - currentStore.value:",
          currentStore.value
        );
        console.log("fetchStoreDetails - operating_hours:", businessHours);

        const requirements = await store.dispatch(
          "store/fetchStoreStaffRequirements",
          storeId
        );
        console.log("取得した人員要件:", requirements);
        storeRequirements.value = requirements || [];
      } catch (error) {
        console.error("店舗詳細情報の取得に失敗しました:", error);
        storeRequirements.value = [];
      }
    };

    const hasStaffingShortage = (date, requirement) => {
      const assignedCount = getAssignedStaffCount(date, requirement);
      return assignedCount < requirement.required_staff_count;
    };

    const getAssignedStaffCount = (date, requirement) => {
      const dayShifts = shifts.value.find((shift) => shift.date === date);
      if (!dayShifts) return 0;

      const reqStartTime = parseTimeToFloat(requirement.start_time);
      const reqEndTime = parseTimeToFloat(requirement.end_time);

      return dayShifts.assignments.filter((assignment) => {
        const shiftStartTime = parseTimeToFloat(assignment.start_time);
        const shiftEndTime = parseTimeToFloat(assignment.end_time);

        return shiftStartTime < reqEndTime && shiftEndTime > reqStartTime;
      }).length;
    };

    const hasStaffWarningsAllStores = (staffId) => {
      const staff = staffList.value.find((s) => s.id === staffId);
      if (!staff) return false;

      const totalHours = calculateTotalHoursAllStores(staffId);
      const maxMonthHours = staff.max_hours_per_month || 0;
      const minMonthHours = staff.min_hours_per_month || 0;
      const maxDayHours = staff.max_hours_per_day || 8;

      let hasViolation = false;

      if (
        maxMonthHours > 0 &&
        (totalHours > maxMonthHours || totalHours < minMonthHours)
      ) {
        hasViolation = true;
      }

      shifts.value.forEach((dayShift) => {
        const assignment = dayShift.assignments.find(
          (a) => a.staff_id === staffId
        );
        if (assignment) {
          const dayHours = calculateDayHours(assignment);
          if (dayHours > maxDayHours) {
            hasViolation = true;
          }

          const dayOfWeek = new Date(dayShift.date).getDay();
          const dayPreference = staff.dayPreferences?.find(
            (pref) => pref.day_of_week === dayOfWeek
          );
          if (dayPreference && !dayPreference.available) {
            hasViolation = true;
          }

          const dayOffRequest = staff.dayOffRequests?.find(
            (req) =>
              req.date === dayShift.date &&
              (req.status === "approved" || req.status === "pending")
          );
          if (dayOffRequest) {
            hasViolation = true;
          }
        }
      });

      return hasViolation;
    };

    const getStaffWarningsAllStores = (staffId) => {
      const warnings = [];
      const staff = staffList.value.find((s) => s.id === staffId);
      if (!staff) return warnings;

      const totalHours = calculateTotalHoursAllStores(staffId);
      const maxMonthHours = staff.max_hours_per_month || 0;
      const minMonthHours = staff.min_hours_per_month || 0;
      const maxDayHours = staff.max_hours_per_day || 8;

      if (maxMonthHours > 0 && totalHours > maxMonthHours) {
        warnings.push({
          type: "over_hours",
          icon: "pi pi-exclamation-triangle",
          message: `月間勤務時間が上限を超過 (全店舗合計: ${formatHours(
            totalHours
          )} > ${formatHours(maxMonthHours)})`,
          severity: "error",
        });
      }

      if (minMonthHours > 0 && totalHours < minMonthHours) {
        warnings.push({
          type: "under_hours",
          icon: "pi pi-exclamation-triangle",
          message: `月間勤務時間が下限を下回り (全店舗合計: ${formatHours(
            totalHours
          )} < ${formatHours(minMonthHours)})`,
          severity: "warn",
        });
      }

      const violationDays = [];
      shifts.value.forEach((dayShift) => {
        const assignment = dayShift.assignments.find(
          (a) => a.staff_id === staffId
        );
        if (assignment) {
          const dayHours = calculateDayHours(assignment);
          if (dayHours > maxDayHours) {
            violationDays.push({
              date: dayShift.date,
              type: "day_hours_exceeded",
              message: `${dayShift.date}: 1日勤務時間超過 (${formatHours(
                dayHours
              )} > ${formatHours(maxDayHours)})`,
            });
          }

          const dayOfWeek = new Date(dayShift.date).getDay();
          const dayPreference = staff.dayPreferences?.find(
            (pref) => pref.day_of_week === dayOfWeek
          );
          if (dayPreference && !dayPreference.available) {
            violationDays.push({
              date: dayShift.date,
              type: "unavailable_day",
              message: `${dayShift.date}: 勤務不可曜日に割り当て (${
                ["日", "月", "火", "水", "木", "金", "土"][dayOfWeek]
              }曜日)`,
            });
          }

          const dayOffRequest = staff.dayOffRequests?.find(
            (req) =>
              req.date === dayShift.date &&
              (req.status === "approved" || req.status === "pending")
          );
          if (dayOffRequest) {
            violationDays.push({
              date: dayShift.date,
              type: "day_off_violation",
              message: `${dayShift.date}: 休み希望日に割り当て (${
                dayOffRequest.reason || "お休み"
              })`,
            });
          }
        }
      });

      if (violationDays.length > 0) {
        warnings.push({
          type: "schedule_violations",
          icon: "pi pi-ban",
          message: `スケジュール違反 ${violationDays.length}件`,
          severity: "error",
          details: violationDays,
        });
      }

      const workDays = shifts.value
        .filter((dayShift) =>
          dayShift.assignments.some((a) => a.staff_id === staffId)
        )
        .map((dayShift) => dayShift.date)
        .sort();

      if (workDays.length > 0) {
        const maxConsecutive = calculateMaxConsecutiveDays(workDays);
        const allowedConsecutive = staff.max_consecutive_days || 5;

        if (maxConsecutive > allowedConsecutive) {
          warnings.push({
            type: "consecutive_days",
            icon: "pi pi-clock",
            message: `最大連続勤務日数超過 (${maxConsecutive}日 > ${allowedConsecutive}日)`,
            severity: "error",
          });
        }
      }

      return warnings;
    };

    const calculateMaxConsecutiveDays = (workDays) => {
      if (workDays.length === 0) return 0;

      const sortedDays = workDays.sort();
      let maxConsecutive = 1;
      let currentConsecutive = 1;

      for (let i = 1; i < sortedDays.length; i++) {
        const prevDate = new Date(sortedDays[i - 1]);
        const currentDate = new Date(sortedDays[i]);
        const diffDays = (currentDate - prevDate) / (1000 * 60 * 60 * 24);

        if (diffDays === 1) {
          currentConsecutive++;
          maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
        } else {
          currentConsecutive = 1;
        }
      }

      return maxConsecutive;
    };

    const hasShiftViolation = (date, staffId) => {
      const shift = getShiftForStaff(date, staffId);
      if (!shift) return false;

      const staff = staffList.value.find((s) => s.id === staffId);
      if (!staff) return false;

      const dayHours = calculateDayHours(shift);
      const maxDayHours = staff.max_hours_per_day || 8;

      if (dayHours > maxDayHours) {
        return true;
      }

      const dayOfWeek = new Date(date).getDay();
      const dayPreference = staff.dayPreferences?.find(
        (pref) => pref.day_of_week === dayOfWeek
      );
      if (dayPreference && !dayPreference.available) {
        return true;
      }

      const dayOffRequest = staff.dayOffRequests?.find(
        (req) =>
          req.date === date &&
          (req.status === "approved" || req.status === "pending")
      );
      if (dayOffRequest) {
        return true;
      }

      const workDays = shifts.value
        .filter((dayShift) =>
          dayShift.assignments.some((a) => a.staff_id === staffId)
        )
        .map((dayShift) => dayShift.date);

      if (workDays.includes(date)) {
        const consecutiveDays = getConsecutiveWorkDaysForDate(staffId, date);
        const maxConsecutiveDays = staff.max_consecutive_days || 5;

        if (consecutiveDays > maxConsecutiveDays) {
          return true;
        }
      }

      return false;
    };

    const getShiftViolations = (date, staffId) => {
      const violations = [];
      const shift = getShiftForStaff(date, staffId);
      if (!shift) return violations;

      const staff = staffList.value.find((s) => s.id === staffId);
      if (!staff) return violations;

      const dayHours = calculateDayHours(shift);
      const maxDayHours = staff.max_hours_per_day || 8;

      if (dayHours > maxDayHours) {
        violations.push({
          type: "day_hours",
          icon: "pi pi-clock",
          message: `1日の勤務時間が上限を超過 (${formatHours(
            dayHours
          )} > ${formatHours(maxDayHours)})`,
          severity: "error",
        });
      }

      const dayOfWeek = new Date(date).getDay();
      const dayPreference = staff.dayPreferences?.find(
        (pref) => pref.day_of_week === dayOfWeek
      );
      if (dayPreference && !dayPreference.available) {
        violations.push({
          type: "unavailable_day",
          icon: "pi pi-ban",
          message: `${
            ["日", "月", "火", "水", "木", "金", "土"][dayOfWeek]
          }曜日は勤務不可設定です`,
          severity: "error",
        });
      }

      const dayOffRequest = staff.dayOffRequests?.find(
        (req) =>
          req.date === date &&
          (req.status === "approved" || req.status === "pending")
      );
      if (dayOffRequest) {
        violations.push({
          type: "day_off_violation",
          icon: "pi pi-ban",
          message: `休み希望日です (${dayOffRequest.reason || "お休み"})`,
          severity: "error",
        });
      }

      const consecutiveDays = getConsecutiveWorkDaysForDate(staffId, date);
      const maxConsecutiveDays = staff.max_consecutive_days || 5;

      if (consecutiveDays > maxConsecutiveDays) {
        violations.push({
          type: "consecutive_days",
          icon: "pi pi-calendar",
          message: `連続勤務日数が上限を超過 (${consecutiveDays}日 > ${maxConsecutiveDays}日)`,
          severity: "error",
        });
      }

      return violations;
    };

    const getConsecutiveWorkDaysForDate = (staffId, targetDate) => {
      const workDays = shifts.value
        .filter((dayShift) =>
          dayShift.assignments.some((a) => a.staff_id === staffId)
        )
        .map((dayShift) => dayShift.date)
        .sort();

      if (!workDays.includes(targetDate)) return 0;

      let consecutiveDays = 1;
      const targetIndex = workDays.indexOf(targetDate);

      for (let i = targetIndex - 1; i >= 0; i--) {
        const prevDate = new Date(workDays[i]);
        const checkDate = new Date(workDays[i + 1]);
        const diffDays = (checkDate - prevDate) / (1000 * 60 * 60 * 24);

        if (diffDays === 1) {
          consecutiveDays++;
        } else {
          break;
        }
      }

      for (let i = targetIndex + 1; i < workDays.length; i++) {
        const currentDate = new Date(workDays[i]);
        const prevDate = new Date(workDays[i - 1]);
        const diffDays = (currentDate - prevDate) / (1000 * 60 * 60 * 24);

        if (diffDays === 1) {
          consecutiveDays++;
        } else {
          break;
        }
      }

      return consecutiveDays;
    };

    const hasDateWarnings = (date) => {
      const requirements = getDailyRequirements(date);
      return (
        requirements.some((req) => hasStaffingShortage(date, req)) ||
        staffList.value.some((staff) => hasShiftViolation(date, staff.id))
      );
    };

    const getDateWarnings = (date) => {
      const warnings = [];
      const requirements = getDailyRequirements(date);

      requirements.forEach((req) => {
        if (hasStaffingShortage(date, req)) {
          const assigned = getAssignedStaffCount(date, req);
          warnings.push({
            type: "staffing_shortage",
            icon: "pi pi-users",
            message: `${formatTime(req.start_time)}-${formatTime(
              req.end_time
            )}: 人員不足 (${assigned}/${req.required_staff_count}名)`,
          });
        }
      });

      staffList.value.forEach((staff) => {
        if (hasShiftViolation(date, staff.id)) {
          warnings.push({
            type: "staff_violation",
            icon: "pi pi-exclamation-triangle",
            message: `${staff.last_name} ${staff.first_name}: 勤務条件違反`,
          });
        }
      });

      return warnings;
    };

    const setViewMode = (mode) => {
      viewMode.value = mode;
    };

    const selectDate = (date) => {
      selectedDate.value = date;
      ganttSelectedDate.value = new Date(date);
      viewMode.value = "gantt";
      nextTick(() => {
        if (ganttBody.value) {
          ganttBody.value.scrollLeft = 0;
        }
      });
    };

    const syncGanttScroll = () => {
      if (ganttTimelineHeader.value && ganttBody.value) {
        requestAnimationFrame(() => {
          ganttTimelineHeader.value.scrollLeft = ganttBody.value.scrollLeft;
        });
      }
    };

    const formatDateForGantt = (date) => {
      if (!date) return "";
      const d = new Date(date);
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const dayOfWeek = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
      return `${month}月${day}日(${dayOfWeek})`;
    };

    const fetchHolidays = async (year) => {
      try {
        const response = await fetch(
          `https://holidays-jp.github.io/api/v1/${year}/date.json`
        );
        const data = await response.json();
        holidays.value = Object.keys(data);
      } catch (error) {
        console.error("祝日データの取得に失敗:", error);
        holidays.value = [];
      }
    };

    const isHoliday = (date) => {
      return holidays.value.includes(date);
    };

    const getTimeHeaderStyle = () => {
      const hourWidth = 60;
      return {
        width: `${hourWidth}px`,
        minWidth: `${hourWidth}px`,
        flexShrink: 0,
      };
    };

    const getGanttBarStyle = (shift) => {
      if (!shift) return {};

      const shiftStartTime = shift.start_time;
      const shiftEndTime = shift.end_time;

      const startHourFloat = parseTimeToFloat(shiftStartTime);
      const endHourFloat = parseTimeToFloat(shiftEndTime);

      const hourWidth = 60;
      const left = startHourFloat * hourWidth;
      const width = (endHourFloat - startHourFloat) * hourWidth;

      return {
        left: `${left}px`,
        width: `${width}px`,
      };
    };

    const parseTimeToFloat = (timeStr) => {
      const [hours, minutes] = timeStr.split(":").map(Number);
      return hours + minutes / 60;
    };

    const parseTimeToComponents = (timeStr) => {
      if (!timeStr) return { hour: "09", minute: "00" };
      const [hour, minute] = timeStr.split(":");
      return {
        hour: hour.padStart(2, "0"),
        minute: minute.padStart(2, "0"),
      };
    };

    const combineTimeComponents = (hour, minute) => {
      return `${hour}:${minute}`;
    };

    const openGanttShiftEditor = (date, staff, event) => {
      if (!isEditMode.value) return;

      const existingShift = getShiftForStaff(date, staff.id);
      if (existingShift) return;

      const rect = event.currentTarget.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const hourWidth = 60;

      const clickedHour = Math.floor(clickX / hourWidth);
      const startHour = clickedHour.toString().padStart(2, "0");
      const endHour = (clickedHour + 8).toString().padStart(2, "0");

      shiftEditorDialog.title = `${staff.last_name} ${staff.first_name} - ${date}`;
      shiftEditorDialog.date = date;
      shiftEditorDialog.staff = staff;
      shiftEditorDialog.startTimeHour = startHour;
      shiftEditorDialog.startTimeMinute = "00";
      shiftEditorDialog.endTimeHour = endHour;
      shiftEditorDialog.endTimeMinute = "00";
      shiftEditorDialog.isRestDay = false;
      shiftEditorDialog.isPast = isPastDate(date);
      shiftEditorDialog.hasShift = false;
      shiftEditorDialog.changeReason = "";
      shiftEditorDialog.visible = true;
    };

    const fetchSystemSettings = async () => {
      try {
        const response = await api.get("/shifts/system-settings");
        systemSettings.value = response.data;
        console.log("システム設定を取得しました:", systemSettings.value);
      } catch (error) {
        console.error("システム設定取得エラー:", error);
        systemSettings.value = { closing_day: 25 };
      }
    };

    const getShiftPeriod = (year, month, closingDay) => {
      let startDate, endDate;

      if (month === 1) {
        startDate = new Date(year - 1, 11, closingDay + 1);
        endDate = new Date(year, 0, closingDay);
      } else {
        startDate = new Date(year, month - 2, closingDay + 1);
        endDate = new Date(year, month - 1, closingDay);
      }

      const daysInPrevMonth = new Date(
        startDate.getFullYear(),
        startDate.getMonth() + 1,
        0
      ).getDate();
      if (startDate.getDate() > daysInPrevMonth) {
        startDate.setDate(daysInPrevMonth);
      }

      const daysInCurrentMonth = new Date(
        endDate.getFullYear(),
        endDate.getMonth() + 1,
        0
      ).getDate();
      if (endDate.getDate() > daysInCurrentMonth) {
        endDate.setDate(daysInCurrentMonth);
      }

      return { startDate, endDate };
    };

    const isPastDate = (date) => {
      const today = new Date();
      const checkDate = new Date(date);
      today.setHours(0, 0, 0, 0);
      checkDate.setHours(0, 0, 0, 0);
      return checkDate < today;
    };

    const toggleEditMode = () => {
      isEditMode.value = !isEditMode.value;

      toast.add({
        severity: "info",
        summary: isEditMode.value ? "編集モード開始" : "編集モード終了",
        detail: isEditMode.value
          ? "シフトセルをクリックして編集できます"
          : "編集モードを終了しました",
        life: 3000,
      });
    };

    const openShiftEditor = async (day, staff) => {
      if (!isEditMode.value) {
        toast.add({
          severity: "info",
          summary: "編集不可",
          detail: "「シフト編集」ボタンを押して編集モードにしてください",
          life: 2000,
        });
        return;
      }

      const shift = getShiftForStaff(day.date, staff.id);

      shiftEditorDialog.title = `${staff.last_name} ${staff.first_name} - ${day.date}`;
      shiftEditorDialog.date = day.date;
      shiftEditorDialog.staff = staff;
      shiftEditorDialog.isPast = isPastDate(day.date);
      shiftEditorDialog.changeReason = "";

      if (shift) {
        const startTime = parseTimeToComponents(shift.start_time);
        const endTime = parseTimeToComponents(shift.end_time);

        shiftEditorDialog.startTimeHour = startTime.hour;
        shiftEditorDialog.startTimeMinute = startTime.minute;
        shiftEditorDialog.endTimeHour = endTime.hour;
        shiftEditorDialog.endTimeMinute = endTime.minute;
        shiftEditorDialog.isRestDay = shift.is_day_off;
        shiftEditorDialog.hasShift = true;
      } else {
        shiftEditorDialog.startTimeHour = "09";
        shiftEditorDialog.startTimeMinute = "00";
        shiftEditorDialog.endTimeHour = "18";
        shiftEditorDialog.endTimeMinute = "00";
        shiftEditorDialog.isRestDay = false;
        shiftEditorDialog.hasShift = false;
      }

      shiftEditorDialog.visible = true;
    };

    const closeShiftEditor = () => {
      shiftEditorDialog.visible = false;
    };

    const loadShiftData = async () => {
      if (!selectedStore.value) return;

      loading.value = true;

      try {
        const staffData = await store.dispatch(
          "staff/fetchStaff",
          selectedStore.value.id
        );
        staffList.value = staffData;

        try {
          const shiftData = await store.dispatch(
            "shift/fetchShiftByYearMonth",
            {
              year: currentYear.value,
              month: currentMonth.value,
              storeId: selectedStore.value.id,
            }
          );

          if (shiftData) {
            currentShift.value = {
              id: shiftData.id,
              store_id: shiftData.store_id,
              year: shiftData.year,
              month: shiftData.month,
              status: shiftData.status,
            };
            shifts.value = shiftData.shifts || [];
          } else {
            currentShift.value = null;
            shifts.value = [];
          }
        } catch (error) {
          if (error.response && error.response.status === 404) {
            currentShift.value = null;
            shifts.value = [];
          } else {
            throw error;
          }
        }

        if (staffList.value && staffList.value.length > 0) {
          await fetchAllStoreShifts();
        }

        generateDaysInMonth();
        updateGanttDateRange();
      } catch (error) {
        console.error("シフトデータの取得に失敗しました:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "シフトデータの取得に失敗しました",
          life: 3000,
        });
      } finally {
        loading.value = false;
      }
    };

    const isStoreClosed = (date) => {
      if (!currentStore.value || !currentStore.value.operating_hours) {
        return false;
      }

      const dayOfWeek = new Date(date).getDay();

      const operatingHours = currentStore.value.operating_hours.find(
        (hours) => hours.day_of_week === dayOfWeek
      );

      if (operatingHours && operatingHours.is_closed) {
        return true;
      }

      if (currentStore.value.special_holidays) {
        if (currentStore.value.special_holidays.includes(date)) {
          return true;
        }
      }

      return false;
    };

    const generateDaysInMonth = () => {
      const year = currentYear.value;
      const month = currentMonth.value;
      const closingDay = systemSettings.value.closing_day || 25;

      console.log(
        `カレンダー生成: ${year}年${month}月, 締め日: ${closingDay}日`
      );

      const { startDate, endDate } = getShiftPeriod(year, month, closingDay);
      const today = new Date();
      const days = [];

      console.log(
        `期間: ${startDate.toISOString().split("T")[0]} から ${
          endDate.toISOString().split("T")[0]
        }`
      );

      const current = new Date(startDate);
      while (current <= endDate) {
        const dateStr = `${current.getFullYear()}-${(current.getMonth() + 1)
          .toString()
          .padStart(2, "0")}-${current.getDate().toString().padStart(2, "0")}`;
        const dayOfWeek = current.getDay();
        const dayOfWeekLabel = ["日", "月", "火", "水", "木", "金", "土"][
          dayOfWeek
        ];

        const storeClosedForDay = isStoreClosed(dateStr);

        days.push({
          date: dateStr,
          day: current.getDate(),
          dayOfWeek,
          dayOfWeekLabel,
          isHoliday: isHoliday(dateStr) || dayOfWeek === 0 || dayOfWeek === 6,
          isNationalHoliday: isHoliday(dateStr),
          isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
          isStoreClosed: storeClosedForDay,
          isToday:
            today.getFullYear() === current.getFullYear() &&
            today.getMonth() === current.getMonth() &&
            today.getDate() === current.getDate(),
        });

        current.setDate(current.getDate() + 1);
      }

      daysInMonth.value = days;
      console.log(`生成された日数: ${days.length}日`);
    };

    const previousMonth = async () => {
      if (currentMonth.value === 1) {
        currentYear.value--;
        currentMonth.value = 12;
      } else {
        currentMonth.value--;
      }
      selectedDate.value = null;
      ganttSelectedDate.value = null;
      await fetchHolidays(currentYear.value);
      await loadShiftData();
    };

    const nextMonth = async () => {
      if (currentMonth.value === 12) {
        currentYear.value++;
        currentMonth.value = 1;
      } else {
        currentMonth.value++;
      }
      selectedDate.value = null;
      ganttSelectedDate.value = null;
      await fetchHolidays(currentYear.value);
      await loadShiftData();
    };

    const changeStore = async () => {
      selectedDate.value = null;
      ganttSelectedDate.value = null;
      if (selectedStore.value) {
        await fetchStoreDetails(selectedStore.value.id);
      }
      await loadShiftData();
    };

    const generateAutomaticShift = async () => {
      try {
        loading.value = true;

        toast.add({
          severity: "info",
          summary: "シフト生成開始",
          detail: "AIによるシフト生成を開始しています...",
          life: 5000,
        });

        const params = {
          storeId: selectedStore.value.id,
          year: currentYear.value,
          month: currentMonth.value,
        };

        console.log("=== AIシフト生成開始 ===");
        console.log("パラメータ:", params);
        console.log("スタッフ数:", staffList.value.length);
        console.log("期間:", `${currentYear.value}年${currentMonth.value}月`);

        const result = await store.dispatch("shift/generateShift", params);

        console.log("=== AIシフト生成完了 ===");
        console.log("生成されたシフト数:", result?.shifts?.length || 0);

        await loadShiftData();

        const staffViolations = [];
        const dateViolations = [];

        staffList.value.forEach((staff) => {
          if (hasStaffWarningsAllStores(staff.id)) {
            const warnings = getStaffWarningsAllStores(staff.id);
            staffViolations.push(
              `${staff.last_name} ${staff.first_name}: ${warnings
                .map((w) => w.message)
                .join(", ")}`
            );
          }
        });

        daysInMonth.value.forEach((day) => {
          if (hasDateWarnings(day.date)) {
            const warnings = getDateWarnings(day.date);
            dateViolations.push(
              `${day.date}: ${warnings.map((w) => w.message).join(", ")}`
            );
          }
        });

        if (staffViolations.length > 0 || dateViolations.length > 0) {
          let warningMessage =
            "シフト生成は完了しましたが、以下の注意点があります：\n\n";

          if (staffViolations.length > 0) {
            warningMessage +=
              "【スタッフ関連】\n" + staffViolations.slice(0, 3).join("\n");
            if (staffViolations.length > 3) {
              warningMessage += `\n...他${staffViolations.length - 3}件`;
            }
            warningMessage += "\n\n";
          }

          if (dateViolations.length > 0) {
            warningMessage +=
              "【日付関連】\n" + dateViolations.slice(0, 3).join("\n");
            if (dateViolations.length > 3) {
              warningMessage += `\n...他${dateViolations.length - 3}件`;
            }
          }

          toast.add({
            severity: "warn",
            summary: "シフト生成完了（要確認）",
            detail: warningMessage,
            life: 10000,
          });

          console.log("⚠️ 生成されたシフトに警告があります");
          console.log("スタッフ警告:", staffViolations);
          console.log("日付警告:", dateViolations);
        } else {
          toast.add({
            severity: "success",
            summary: "シフト生成完了",
            detail: "制約を守ったシフトが正常に生成されました",
            life: 5000,
          });

          console.log("✅ 制約を守ったシフトが生成されました");
        }

        const totalStaffHours = staffList.value.reduce((sum, staff) => {
          return sum + calculateTotalHours(staff.id);
        }, 0);

        console.log("=== 生成結果サマリー ===");
        console.log("総勤務時間:", totalStaffHours.toFixed(1), "時間");
        console.log(
          "平均勤務時間:",
          (totalStaffHours / staffList.value.length).toFixed(1),
          "時間/人"
        );
        console.log(
          "制約違反数:",
          staffViolations.length + dateViolations.length
        );
      } catch (error) {
        console.error("=== AIシフト生成失敗 ===");
        console.error("エラー詳細:", error);

        let errorMessage = "AIシフト生成に失敗しました";

        if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.message) {
          if (error.message.includes("制約違反")) {
            errorMessage =
              "スタッフの勤務条件を満たすシフトを生成できませんでした。勤務条件の見直しをご検討ください。";
          } else if (error.message.includes("最大試行回数")) {
            errorMessage =
              "制約条件が厳しすぎるため、シフトを生成できませんでした。条件を緩和するか、手動でシフトを作成してください。";
          } else {
            errorMessage = error.message;
          }
        }

        toast.add({
          severity: "error",
          summary: "生成エラー",
          detail: errorMessage,
          life: 8000,
        });

        confirm.require({
          message:
            "AIシフト生成に失敗しました。空のシフトを作成して手動で編集しますか？",
          header: "代替手段の提案",
          icon: "pi pi-question-circle",
          acceptLabel: "空シフト作成",
          rejectLabel: "キャンセル",
          accept: () => {
            createEmptyShift();
          },
        });
      } finally {
        loading.value = false;
      }
    };

    const regenerateShift = async () => {
      confirm.require({
        message: `現在のシフトを削除してAIで再生成しますか？

⚠️ 注意：
- 現在のシフトは完全に削除されます
- スタッフの勤務条件に違反しないシフトが生成されます
- 条件が厳しい場合、生成に失敗する可能性があります`,
        header: "シフト再生成の確認",
        icon: "pi pi-exclamation-triangle",
        acceptClass: "p-button-warning",
        acceptLabel: "再生成実行",
        rejectLabel: "キャンセル",
        accept: async () => {
          await generateAutomaticShift();
        },
      });
    };

    const createShift = async () => {
      const hasStaffData = staffList.value && staffList.value.length > 0;

      if (!hasStaffData) {
        toast.add({
          severity: "warn",
          summary: "注意",
          detail:
            "スタッフが登録されていません。先にスタッフを登録してください。",
          life: 5000,
        });
        return;
      }

      const hasValidStaff = staffList.value.some((staff) => {
        const hasValidDayPreferences =
          staff.dayPreferences &&
          staff.dayPreferences.some((pref) => pref.available);
        return hasValidDayPreferences;
      });

      if (!hasValidStaff) {
        toast.add({
          severity: "warn",
          summary: "注意",
          detail:
            "勤務可能なスタッフがいません。スタッフの勤務設定を確認してください。",
          life: 5000,
        });
      }

      confirm.require({
        message: `シフトの作成方法を選択してください

【AI自動生成】
✅ スタッフの勤務条件を自動で守ります
✅ 効率的なシフトが生成されます
⚠️ 条件が厳しい場合は生成に失敗する場合があります

【手動作成】  
✅ 自由にシフトを組むことができます
⚠️ 勤務条件の確認は手動で行う必要があります`,
        header: "シフト作成方法の選択",
        acceptLabel: "AI自動生成",
        rejectLabel: "手動作成",
        acceptClass: "p-button-primary",
        rejectClass: "p-button-secondary",
        accept: () => {
          generateAutomaticShift();
        },
        reject: () => {
          createEmptyShift();
        },
      });
    };

    const createEmptyShift = async () => {
      try {
        loading.value = true;

        await store.dispatch("shift/createShift", {
          store_id: selectedStore.value.id,
          year: currentYear.value,
          month: currentMonth.value,
          status: "draft",
        });

        await loadShiftData();
        isEditMode.value = true;

        toast.add({
          severity: "success",
          summary: "作成完了",
          detail: "シフトを作成しました。編集モードになりました。",
          life: 3000,
        });
      } catch (error) {
        console.error("シフト作成エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "シフトの作成に失敗しました",
          life: 3000,
        });
      } finally {
        loading.value = false;
      }
    };

    const printShift = () => {
      if (!hasCurrentShift.value) return;

      const printWindow = window.open("", "_blank");

      if (!printWindow) {
        toast.add({
          severity: "error",
          summary: "エラー",
          detail:
            "ポップアップがブロックされました。ブラウザの設定を確認してください。",
          life: 3000,
        });
        return;
      }

      const printContent = generatePrintContent();
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    };

    const generatePrintContent = () => {
      const storeName = selectedStore.value ? selectedStore.value.name : "";
      const period = `${currentYear.value}年${currentMonth.value}月`;

      let printHtml = `
       <!DOCTYPE html>
       <html>
       <head>
         <title>${storeName} - ${period} シフト表</title>
         <meta charset="utf-8">
         <style>
           @media print {
             @page { margin: 1cm; size: A4 landscape; }
             body { font-family: Arial, sans-serif; font-size: 9px; }
           }
           body { font-family: Arial, sans-serif; font-size: 12px; }
           .print-header { 
             text-align: center; 
             margin-bottom: 20px; 
             page-break-after: avoid;
           }
           .print-title { 
             font-size: 16px; 
             font-weight: bold; 
             margin-bottom: 8px;
           }
           .print-period { 
             font-size: 12px; 
             color: #666;
           }
           .print-table { 
             width: 100%; 
             border-collapse: collapse; 
             margin-top: 10px;
             page-break-inside: avoid;
           }
           .print-table th, .print-table td { 
             border: 1px solid #333; 
             padding: 4px 2px; 
             text-align: center; 
             font-size: 8px;
             vertical-align: middle;
             -webkit-print-color-adjust: exact;
             color-adjust: exact;
           }
           .print-table th { 
             background-color: #f0f0f0; 
             font-weight: bold;
             font-size: 8px;
             -webkit-print-color-adjust: exact;
             color-adjust: exact;
           }
           .staff-col { 
             width: 80px; 
             text-align: left;
             padding-left: 4px;
             font-weight: bold;
           }
           .date-col { 
             width: 35px;
             font-weight: bold;
           }
           .shift-cell {
             font-size: 7px;
             line-height: 1.2;
           }
           .holiday { 
             color: #dc2626;
           }
           .store-closed { 
             background-color: #f3f4f6;
             color: #6b7280;
             -webkit-print-color-adjust: exact;
             color-adjust: exact;
           }
           .today { 
             background-color: #e6f3ff; 
             -webkit-print-color-adjust: exact;
             color-adjust: exact;
           }
           .summary-section {
             margin-top: 20px;
             page-break-inside: avoid;
           }
           .summary-title {
             font-size: 12px;
             font-weight: bold;
             margin-bottom: 10px;
           }
           .summary-table {
             width: 50%;
             border-collapse: collapse;
           }
           .summary-table th, .summary-table td {
             border: 1px solid #333;
             padding: 4px 8px;
             font-size: 9px;
           }
           .summary-table th {
             background-color: #f0f0f0;
             font-weight: bold;
             -webkit-print-color-adjust: exact;
             color-adjust: exact;
           }
         </style>
       </head>
       <body>
         <div class="print-header">
           <div class="print-title">${storeName} シフト表</div>
           <div class="print-period">${period}</div>
         </div>
         <table class="print-table">
           <thead>
             <tr>
               <th class="staff-col">スタッフ</th>
     `;

      daysInMonth.value.forEach((day) => {
        const holidayClass = day.isHoliday ? "holiday" : "";
        const todayClass = day.isToday ? "today" : "";
        const storeClosedClass = day.isStoreClosed ? "store-closed" : "";
        const cellClass =
          `${holidayClass} ${todayClass} ${storeClosedClass}`.trim();
        printHtml += `
         <th class="date-col ${cellClass}">
           <div style="${
             day.isWeekend || day.isNationalHoliday
               ? "color: #dc2626;"
               : day.isStoreClosed && !day.isWeekend && !day.isNationalHoliday
               ? "color: #6b7280;"
               : ""
           }">${day.day}</div>
           <div style="font-size: 6px; ${
             day.isWeekend || day.isNationalHoliday
               ? "color: #dc2626;"
               : day.isStoreClosed && !day.isWeekend && !day.isNationalHoliday
               ? "color: #6b7280;"
               : ""
           }">${day.dayOfWeekLabel}</div>
           ${
             day.isNationalHoliday
               ? '<div style="font-size: 5px; color: red;">祝</div>'
               : ""
           }
           ${
             day.isStoreClosed && !day.isNationalHoliday && !day.isWeekend
               ? '<div style="font-size: 5px; color: #6b7280;">休</div>'
               : ""
           }
         </th>
       `;
      });

      printHtml += `
             </tr>
           </thead>
           <tbody>
     `;

      staffList.value.forEach((staff) => {
        printHtml += `<tr>`;
        printHtml += `<td class="staff-col">${staff.last_name} ${staff.first_name}</td>`;

        daysInMonth.value.forEach((day) => {
          const shift = getShiftForStaff(day.date, staff.id);
          const holidayClass = day.isHoliday ? "holiday" : "";
          const todayClass = day.isToday ? "today" : "";
          const storeClosedClass = day.isStoreClosed ? "store-closed" : "";
          const cellClass =
            `shift-cell ${holidayClass} ${todayClass} ${storeClosedClass}`.trim();

          if (shift) {
            printHtml += `<td class="${cellClass}">
             ${formatTime(shift.start_time)}<br>-<br>${formatTime(
              shift.end_time
            )}
           </td>`;
          } else {
            printHtml += `<td class="${cellClass}">-</td>`;
          }
        });

        printHtml += `</tr>`;
      });

      printHtml += `
           </tbody>
         </table>
         
         <div class="summary-section">
           <div class="summary-title">月間勤務時間集計</div>
           <table class="summary-table">
             <thead>
               <tr>
                 <th>スタッフ</th>
                 <th>当店時間</th>
                 <th>全店合計</th>
               </tr>
             </thead>
             <tbody>
     `;

      staffList.value.forEach((staff) => {
        const currentStoreHours = calculateTotalHours(staff.id);
        const allStoreHours = calculateTotalHoursAllStores(staff.id);

        printHtml += `
         <tr>
           <td>${staff.last_name} ${staff.first_name}</td>
           <td>${formatHours(currentStoreHours)}</td>
           <td>${formatHours(allStoreHours)}</td>
         </tr>
       `;
      });

      printHtml += `
             </tbody>
           </table>
         </div>
       </body>
       </html>
     `;

      return printHtml;
    };

    const saveShift = async () => {
      if (!shiftEditorDialog.date || !shiftEditorDialog.staff) return;

      if (shiftEditorDialog.isRestDay) {
        await clearShift();
        return;
      }

      if (
        !shiftEditorDialog.startTimeHour ||
        !shiftEditorDialog.startTimeMinute ||
        !shiftEditorDialog.endTimeHour ||
        !shiftEditorDialog.endTimeMinute
      ) {
        toast.add({
          severity: "warn",
          summary: "入力エラー",
          detail: "開始時間と終了時間を選択してください",
          life: 3000,
        });
        return;
      }

      const startTime = combineTimeComponents(
        shiftEditorDialog.startTimeHour,
        shiftEditorDialog.startTimeMinute
      );
      const endTime = combineTimeComponents(
        shiftEditorDialog.endTimeHour,
        shiftEditorDialog.endTimeMinute
      );

      if (startTime >= endTime) {
        toast.add({
          severity: "warn",
          summary: "入力エラー",
          detail: "終了時間は開始時間より後にしてください",
          life: 3000,
        });
        return;
      }

      if (shiftEditorDialog.isPast && !shiftEditorDialog.changeReason.trim()) {
        toast.add({
          severity: "warn",
          summary: "入力エラー",
          detail: "過去の日付を編集する場合は変更理由を入力してください",
          life: 3000,
        });
        return;
      }

      saving.value = true;

      try {
        const shiftData = {
          store_id: selectedStore.value.id,
          staff_id: shiftEditorDialog.staff.id,
          date: shiftEditorDialog.date,
          start_time: startTime,
          end_time: endTime,
          break_start_time: null,
          break_end_time: null,
          notes: null,
        };

        if (shiftEditorDialog.isPast) {
          shiftData.change_reason = shiftEditorDialog.changeReason;
        }

        console.log("Sending shift data:", shiftData);

        const existingShift = getShiftForStaff(
          shiftEditorDialog.date,
          shiftEditorDialog.staff.id
        );

        if (existingShift) {
          await store.dispatch("shift/updateShiftAssignment", {
            year: currentYear.value,
            month: currentMonth.value,
            assignmentId: existingShift.id,
            assignmentData: shiftData,
          });
        } else {
          await store.dispatch("shift/createShiftAssignment", {
            year: currentYear.value,
            month: currentMonth.value,
            assignmentData: shiftData,
          });
        }

        await loadShiftData();
        shiftEditorDialog.visible = false;

        const successMessage = shiftEditorDialog.isPast
          ? "過去のシフトを変更しました（変更履歴に記録されます）"
          : "シフトを保存しました";

        toast.add({
          severity: "success",
          summary: "保存完了",
          detail: successMessage,
          life: 3000,
        });
      } catch (error) {
        console.error("シフト保存エラー:", error);

        if (error.response) {
          console.error("Response data:", error.response.data);
          console.error("Response status:", error.response.status);
        }

        let errorMessage = "シフトの保存に失敗しました";
        if (
          error.response &&
          error.response.data &&
          error.response.data.message
        ) {
          errorMessage = error.response.data.message;
        }

        toast.add({
          severity: "error",
          summary: "エラー",
          detail: errorMessage,
          life: 3000,
        });
      } finally {
        saving.value = false;
      }
    };

    const clearShift = async () => {
      if (!shiftEditorDialog.hasShift) {
        shiftEditorDialog.visible = false;
        return;
      }

      if (shiftEditorDialog.isPast && !shiftEditorDialog.changeReason.trim()) {
        toast.add({
          severity: "warn",
          summary: "入力エラー",
          detail: "過去の日付を編集する場合は変更理由を入力してください",
          life: 3000,
        });
        return;
      }

      saving.value = true;

      try {
        const existingShift = getShiftForStaff(
          shiftEditorDialog.date,
          shiftEditorDialog.staff.id
        );

        if (existingShift) {
          await store.dispatch("shift/deleteShiftAssignment", {
            year: currentYear.value,
            month: currentMonth.value,
            assignmentId: existingShift.id,
            change_reason: shiftEditorDialog.isPast
              ? shiftEditorDialog.changeReason
              : null,
          });

          await loadShiftData();
          shiftEditorDialog.visible = false;

          const successMessage = shiftEditorDialog.isPast
            ? "過去のシフトを削除しました（変更履歴に記録されます）"
            : "シフトを削除しました";

          toast.add({
            severity: "success",
            summary: "削除完了",
            detail: successMessage,
            life: 3000,
          });
        }
      } catch (error) {
        console.error("シフト削除エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "シフトの削除に失敗しました",
          life: 3000,
        });
      } finally {
        saving.value = false;
      }
    };

    const getShiftForStaff = (date, staffId) => {
      const dayShifts = shifts.value.find((s) => s.date === date);
      if (!dayShifts) return null;

      return dayShifts.assignments.find((a) => a.staff_id === staffId);
    };

    const formatTime = (time) => {
      if (!time) return "";
      return time.slice(0, 5);
    };

    const deleteShift = async () => {
      confirm.require({
        message: `${currentYear.value}年${currentMonth.value}月のシフトを完全に削除しますか？この操作は取り消せません。`,
        header: "シフト削除の確認",
        icon: "pi pi-exclamation-triangle",
        acceptClass: "p-button-danger",
        acceptLabel: "削除",
        rejectLabel: "キャンセル",
        accept: async () => {
          try {
            loading.value = true;

            await store.dispatch("shift/deleteShift", {
              year: currentYear.value,
              month: currentMonth.value,
              storeId: selectedStore.value.id,
            });

            currentShift.value = null;
            shifts.value = [];
            selectedDate.value = null;
            ganttSelectedDate.value = null;
            isEditMode.value = false;

            toast.add({
              severity: "success",
              summary: "削除完了",
              detail: "シフトを削除しました",
              life: 3000,
            });
          } catch (error) {
            console.error("シフト削除エラー:", error);
            toast.add({
              severity: "error",
              summary: "エラー",
              detail: "シフトの削除に失敗しました",
              life: 3000,
            });
          } finally {
            loading.value = false;
          }
        },
      });
    };

    watch([currentYear, currentMonth], () => {
      loadShiftData();
    });

    onMounted(async () => {
      try {
        generateTimeOptions();
        await fetchSystemSettings();
        await fetchHolidays(currentYear.value);

        const storeData = await store.dispatch("store/fetchStores");
        stores.value = storeData;

        if (storeData.length > 0) {
          selectedStore.value = storeData[0];
          await fetchStoreDetails(selectedStore.value.id);
          await loadShiftData();

          const today = new Date();
          const todayString = `${today.getFullYear()}-${(today.getMonth() + 1)
            .toString()
            .padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}`;

          const todayExists = daysInMonth.value.some(
            (day) => day.date === todayString
          );
          if (todayExists) {
            selectedDate.value = todayString;
            ganttSelectedDate.value = new Date(todayString);
          } else if (daysInMonth.value.length > 0) {
            selectedDate.value = daysInMonth.value[0].date;
            ganttSelectedDate.value = new Date(selectedDate.value);
          }
        }
      } catch (error) {
        console.error("初期化エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "データの取得に失敗しました",
          life: 3000,
        });
      }
    });

    return {
      deleteShift,
      loading,
      saving,
      isEditMode,
      viewMode,
      selectedDate,
      ganttSelectedDate,
      onGanttDateSelected,
      previousDate,
      nextDate,
      ganttMinDate,
      ganttMaxDate,
      timelineHours,
      hourOptions,
      minuteOptions,
      currentYear,
      currentMonth,
      selectedStore,
      stores,
      staffList,
      shifts,
      daysInMonth,
      currentShift,
      systemSettings,
      shiftEditorDialog,
      dateOptions,
      ganttContainer,
      ganttTimelineHeader,
      ganttBody,
      storeRequirements,
      currentStore,
      allStoreShifts,
      hasCurrentShift,
      isHoursOutOfRange,
      isHoursOutOfRangeAllStores,
      hasTotalHoursFromOtherStores,
      calculateTotalHoursAllStores,
      hasStaffWarnings,
      hasStaffWarningsAllStores,
      getStaffWarnings,
      getStaffWarningsAllStores,
      setViewMode,
      selectDate,
      syncGanttScroll,
      formatDateForGantt,
      getTimeHeaderStyle,
      getGanttBarStyle,
      parseTimeToFloat,
      parseTimeToComponents,
      combineTimeComponents,
      openGanttShiftEditor,
      isPastDate,
      toggleEditMode,
      openShiftEditor,
      closeShiftEditor,
      previousMonth,
      nextMonth,
      changeStore,
      createShift,
      regenerateShift,
      printShift,
      saveShift,
      clearShift,
      getShiftForStaff,
      formatTime,
      calculateTotalHours,
      getDailyRequirements,
      getConsecutiveWorkDays,
      calculateDayHours,
      fetchStoreDetails,
      hasStaffingShortage,
      getAssignedStaffCount,
      hasShiftViolation,
      getShiftViolations,
      hasDateWarnings,
      getDateWarnings,
      hasHourRequirements,
      hasHourShortage,
      getHourRequirements,
      hasRequirementShortage,
      formatHours,
      canStaffWorkOnDate,
      getWorkAvailabilityTooltip,
      getWorkUnavailabilityReason,
      getGanttAvailabilityStyle,
      getGanttAvailabilityTooltip,
      isStoreClosed,
    };
  },
};
</script>
<style scoped lang="scss">
.shift-management {
  min-height: 100vh;
  background: #f5f7fa;
  padding: 1.5rem;
}

.header-section {
  margin-bottom: 2rem;
}

.page-title {
  font-size: 2rem;
  font-weight: 600;
  color: #2c3e50;
  margin: 0;
}

.control-panel {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.period-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.month-navigator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #f8f9fa;
  padding: 0.5rem;
  border-radius: 8px;
}

.nav-button,
.nav-button-small {
  width: 36px;
  height: 36px;
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

.nav-button-small {
  width: 28px;
  height: 28px;
}

.nav-button:hover:not(:disabled),
.nav-button-small:hover:not(:disabled) {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.nav-button:disabled,
.nav-button-small:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.period-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 100px;
}

.year {
  font-size: 0.8rem;
  color: #666;
}

.month {
  font-size: 1.25rem;
  font-weight: 600;
  color: #2c3e50;
}

.store-selector {
  min-width: 220px;
}

.view-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.view-mode-tabs {
  display: flex;
  background: #f0f0f0;
  border-radius: 8px;
  padding: 0.25rem;
}

.view-tab {
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-weight: 500;
  font-size: 0.875rem;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.view-tab:hover {
  color: #333;
}

.view-tab.active {
  background: white;
  color: #3b82f6;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.date-selector {
  min-width: 200px;
}

.gantt-date-navigator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #f8f9fa;
  padding: 0.5rem;
  border-radius: 8px;
}

.selected-date-display {
  min-width: 120px;
  text-align: center;
  font-weight: 600;
  color: #2c3e50;
  font-size: 0.875rem;
}

.date-picker {
  min-width: 120px;
}

.action-controls {
  display: flex;
  gap: 0.75rem;
}

.action-button {
  padding: 0.5rem 1.25rem;
  border-radius: 8px;
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.2s;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.create-button {
  background: #10b981;
  color: white;
  border: 1px solid #10b981;
}

.create-button:hover:not(:disabled) {
  background: #059669;
  border-color: #059669;
}

.edit-button {
  background: white;
  color: #666;
  border: 1px solid #e0e0e0;
}

.edit-button:hover:not(:disabled) {
  background: #f8f9fa;
  border-color: #ccc;
}

.edit-button.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.regenerate-button,
.print-button {
  background: white;
  color: #666;
  border: 1px solid #e0e0e0;
}

.regenerate-button:hover:not(:disabled),
.print-button:hover:not(:disabled) {
  background: #f8f9fa;
  border-color: #ccc;
}

.loading-state,
.empty-state,
.gantt-no-date {
  background: white;
  border-radius: 12px;
  padding: 4rem 2rem;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.loading-text {
  font-size: 1rem;
  color: #666;
}

.empty-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 1.5rem;
  border-radius: 50%;
  background: #f0f4ff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: #3b82f6;
}

.empty-state h3,
.gantt-no-date h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.empty-state p,
.gantt-no-date p {
  color: #666;
  margin-bottom: 2rem;
}

.shift-content {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
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
  height: calc(100vh - 300px);
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
  background: #1e293b;
  color: white;
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
  min-width: 80px;
  width: 80px;
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
  background: #d9d9d9;
}

.date-cell-header.is-store-closed .date-number,
.date-cell-header.is-store-closed .date-weekday {
  color: #6b7280;
}

.shift-cell.is-store-closed {
  background: #d9d9d9;
}

.date-cell-header.is-selected {
  background: #bfdbfe;
}

.date-cell-header.is-store-closed.is-selected {
  background: #d1d5db;
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
}

.warning-tooltip-item.staff_violation {
  background: #fee2e2;
  color: #7f1d1d;
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
  align-items: baseline;
  gap: 0.25rem;
  margin-top: 0.25rem;
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

.staff-warnings {
  display: flex;
  gap: 0.25rem;
  margin-top: 0.25rem;
}

.warning-indicator-staff {
  color: #f59e0b;
  font-size: 0.8rem;
  cursor: help;
}

.warning-badge {
  font-size: 0.7rem;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  background: #fbbf24;
  color: #78350f;
  font-weight: 600;
  cursor: help;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.shift-cell {
  min-width: 80px;
  width: 80px;
  min-height: 70px;
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

.shift-cell.is-selected {
}

.shift-time-card {
  background: #10b981;
  color: white;
  padding: 0.5rem 0.375rem;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  font-weight: 600;
  font-size: 0.75rem;
  min-width: 60px;
  transition: all 0.2s;
  position: relative;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.shift-time-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.shift-start,
.shift-end {
  font-weight: 700;
  font-size: 0.8rem;
}

.shift-separator {
  font-size: 0.6rem;
  opacity: 0.8;
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

.gantt-info-panel {
  width: 320px;
  background: #f8f9fa;
  border-left: 2px solid #e5e7eb;
  padding: 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.date-info-header {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.date-navigation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.date-navigation-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #1e293b;
  flex: 1;
  text-align: center;
}

.date-warnings {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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

.requirements-section,
.staff-summary-section {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.section-title {
  background: #f3f4f6;
  padding: 0.75rem 1rem;
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section-title i {
  color: #3b82f6;
}

.requirements-list {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.requirement-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f9fafb;
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

.staff-summary-grid {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 400px;
  overflow-y: auto;
}

.staff-summary-card {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 0.75rem;
  transition: all 0.2s;
}

.staff-summary-card:hover {
  background: white;
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
  align-items: baseline;
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

.gantt-view {
  height: calc(100vh - 300px);
  display: flex;
  gap: 1rem;
}

.gantt-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
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
  background: #1e293b;
  color: white;
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
  background: #10b981;
  color: white;
  font-weight: 600;
}

.hour-requirement-badge.shortage {
  background: #ef4444;
}

.gantt-body {
  flex: 1;
  overflow: auto;
  background: white;
  min-height: 0;
}

.gantt-staff-rows {
  min-height: 100%;
  min-width: calc(240px + 24 * 60px);
}

.gantt-staff-row {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
  min-height: 70px;
}

.gantt-staff-row.has-warnings .gantt-timeline {
  background: #fef3c7;
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
  align-items: baseline;
  gap: 0.25rem;
  font-size: 0.75rem;
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
  border-right: 1px solid #f3f4f6;
  height: 100%;
  flex-shrink: 0;
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
}

.gantt-shift-block:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.gantt-shift-block.is-past-editable {
  background: #f59e0b;
}

.shift-time-text {
  font-size: 0.75rem;
  white-space: nowrap;
  padding: 0 0.75rem;
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

.shift-editor-dialog .p-dialog-content {
  padding: 1.5rem;
}

.shift-editor-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.status-alert {
  padding: 1rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 500;
  font-size: 0.875rem;
}

.status-alert.warning {
  background: #fef3c7;
  color: #78350f;
  border: 1px solid #fbbf24;
}

.time-inputs-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.time-input-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-weight: 600;
  color: #1e293b;
  font-size: 0.875rem;
}

.time-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #f9fafb;
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  max-width: 300px;
}

.time-dropdown {
  flex: 1;
}

.time-separator {
  font-size: 1.25rem;
  font-weight: 600;
  color: #64748b;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.875rem;
  resize: vertical;
}

.form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.checkbox-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.checkbox-label {
  font-weight: 500;
  color: #475569;
  cursor: pointer;
  font-size: 0.875rem;
}

.dialog-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding-top: 0.5rem;
}

.delete-button,
.cancel-button,
.save-button {
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.2s;
  cursor: pointer;
}

.delete-button {
  background: #ef4444;
  color: white;
  border: 1px solid #ef4444;
  margin-right: auto;
}

.delete-button:hover:not(:disabled) {
  background: #dc2626;
  border-color: #dc2626;
}

.cancel-button {
  background: white;
  color: #64748b;
  border: 1px solid #e5e7eb;
}

.cancel-button:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #cbd5e1;
}

.save-button {
  background: #10b981;
  color: white;
  border: 1px solid #10b981;
}

.save-button:hover:not(:disabled) {
  background: #059669;
  border-color: #059669;
}

.delete-button {
  background: #ef4444;
  color: white;
  border: 1px solid #ef4444;
}

.delete-button:hover:not(:disabled) {
  background: #dc2626;
  border-color: #dc2626;
  transform: translateY(-1px);
  box-shadow: 0 2px 5px rgba(239, 68, 68, 0.3);
}

.delete-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

@media (max-width: 1280px) {
  .calendar-view,
  .gantt-view {
    flex-direction: column;
  }

  .gantt-info-panel {
    width: 100%;
    flex-direction: row;
    border-left: none;
    border-top: 2px solid #e5e7eb;
    overflow-x: auto;
    padding: 1rem;
  }

  .requirements-section,
  .staff-summary-section {
    min-width: 300px;
  }
}

@media (max-width: 768px) {
  .shift-management {
    padding: 1rem;
  }

  .control-panel {
    flex-direction: column;
    align-items: stretch;
    gap: 1.5rem;
  }

  .period-controls,
  .view-controls,
  .action-controls {
    width: 100%;
    justify-content: center;
  }

  .view-controls {
    flex-direction: column;
  }

  .date-selector {
    width: 100%;
  }

  .gantt-date-navigator {
    justify-content: center;
  }

  .action-controls {
    flex-wrap: wrap;
  }

  .action-button {
    flex: 1;
    min-width: 120px;
  }

  .staff-column-header,
  .staff-info,
  .gantt-staff-header,
  .gantt-staff-info {
    min-width: 160px;
    width: 160px;
  }

  .date-cell-wrapper,
  .shift-cell {
    min-width: 60px;
    width: 60px;
  }

  .gantt-info-panel {
    flex-direction: column;
    max-height: 50vh;
  }
}

@media (max-width: 480px) {
  .page-title {
    font-size: 1.5rem;
  }

  .period-display {
    min-width: 80px;
  }

  .month {
    font-size: 1rem;
  }

  .store-selector {
    min-width: 100%;
  }

  .action-button {
    width: 100%;
    justify-content: center;
  }

  .staff-avatar {
    width: 32px;
    height: 32px;
    font-size: 0.8rem;
  }

  .shift-time-card {
    min-width: 50px;
    font-size: 0.65rem;
    padding: 0.375rem 0.25rem;
  }

  .time-selector {
    flex-direction: column;
    max-width: 100%;
  }

  .time-dropdown {
    width: 100%;
  }

  .gantt-date-navigator {
    flex-wrap: wrap;
    gap: 0.25rem;
  }
}
</style>