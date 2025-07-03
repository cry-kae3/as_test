<template>
  <div class="shift-management">
    <div class="shift-management-header">
      <div class="header-content">
        <div class="page-title-section">
          <h1 class="page-title">
            <i class="pi pi-calendar"></i>
            シフト管理
          </h1>
          <div class="store-selector-container">
            <Dropdown
              v-model="selectedStore"
              :options="stores"
              optionLabel="name"
              placeholder="店舗を選択"
              class="store-selector"
              @change="onStoreChange"
            />
          </div>
        </div>

        <div class="management-controls">
          <div class="period-selector">
            <Button
              icon="pi pi-chevron-left"
              class="period-nav-btn"
              @click="previousMonth"
            />
            <Dropdown
              v-model="selectedYear"
              :options="yearOptions"
              optionLabel="label"
              optionValue="value"
              class="year-selector"
              @change="onPeriodChange"
            />
            <Dropdown
              v-model="selectedMonth"
              :options="monthOptions"
              optionLabel="label"
              optionValue="value"
              class="month-selector"
              @change="onPeriodChange"
            />
            <Button
              icon="pi pi-chevron-right"
              class="period-nav-btn"
              @click="nextMonth"
            />
          </div>

          <div class="action-buttons">
            <Button
              icon="pi pi-eye"
              label="プレビュー"
              class="p-button-outlined"
              @click="toggleViewMode"
              :class="{ active: !isEditMode }"
            />
            <Button
              icon="pi pi-pencil"
              label="編集"
              class="p-button-primary"
              @click="toggleEditMode"
              :class="{ active: isEditMode }"
            />
            <Button
              icon="pi pi-cog"
              label="自動生成"
              class="p-button-success"
              @click="generateShift"
              :loading="generating"
            />
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedStore" class="shift-content">
      <TabView v-model:activeIndex="activeTabIndex" class="shift-tabs">
        <TabPanel header="カレンダー表示">
          <ShiftCalendar
            :is-edit-mode="isEditMode"
            :selected-date="selectedDate"
            :selected-store="selectedStore"
            :days-in-month="daysInMonth"
            :staff-list="staffList"
            @select-date="selectDate"
            @open-shift-editor="openShiftEditor"
            @quick-delete-shift="confirmQuickDelete"
          />
        </TabPanel>

        <TabPanel header="ガントチャート">
          <GanttChart
            :selected-date="selectedDate"
            :selected-date-calendar="selectedDateCalendar"
            :min-selectable-date="minSelectableDate"
            :max-selectable-date="maxSelectableDate"
            :selected-store="selectedStore"
            :staff-list="staffList"
            :timeline-hours="timelineHours"
            :loading="loading"
            :is-edit-mode="isEditMode"
            @update:selectedDateCalendar="updateSelectedDateCalendar"
            @previous-date="previousDate"
            @next-date="nextDate"
            @gantt-date-select="onGanttDateSelect"
            @open-gantt-shift-editor="openGanttShiftEditor"
            @open-shift-editor="openShiftEditor"
          />
        </TabPanel>

        <TabPanel header="詳細情報">
          <DailyInfoPanel
            :selected-date="selectedDate"
            :selected-store="selectedStore"
            :staff-list="staffList"
            :shifts="shifts"
          />
        </TabPanel>

        <TabPanel header="全スタッフ集計">
          <AllStaffSummary
            :current-year="selectedYear"
            :current-month="selectedMonth"
            :all-staff="staffList"
          />
        </TabPanel>
      </TabView>
    </div>

    <div v-else class="no-store-selected">
      <Card>
        <template #content>
          <div class="empty-state">
            <i class="pi pi-building empty-icon"></i>
            <h3>店舗を選択してください</h3>
            <p>シフト管理を開始するには、まず店舗を選択してください。</p>
          </div>
        </template>
      </Card>
    </div>

    <ShiftEditorDialog
      :visible="shiftEditorDialog.visible"
      :saving="shiftEditorDialog.saving"
      :shift-data="shiftEditorDialog.data"
      :hour-options="hourOptions"
      :minute-options="minuteOptions"
      @update:visible="updateShiftEditorVisible"
      @close="closeShiftEditor"
      @save="saveShift"
      @clear="clearShift"
    />

    <ConfirmDialog />
    <Toast />
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue'
import { useStore } from 'vuex'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import ShiftCalendar from '@/components/shift/ShiftCalendar.vue'
import GanttChart from '@/components/shift/GanttChart.vue'
import DailyInfoPanel from '@/components/shift/DailyInfoPanel.vue'
import AllStaffSummary from '@/components/shift/AllStaffSummary.vue'
import ShiftEditorDialog from '@/components/shift/ShiftEditorDialog.vue'

export default {
  name: 'ShiftManagement',
  components: {
    ShiftCalendar,
    GanttChart,
    DailyInfoPanel,
    AllStaffSummary,
    ShiftEditorDialog
  },
  setup() {
    const store = useStore()
    const router = useRouter()
    const toast = useToast()
    const confirm = useConfirm()

    const selectedStore = ref(null)
    const stores = ref([])
    const selectedYear = ref(new Date().getFullYear())
    const selectedMonth = ref(new Date().getMonth() + 1)
    const selectedDate = ref('')
    const selectedDateCalendar = ref(null)
    const activeTabIndex = ref(0)
    const isEditMode = ref(false)
    const loading = ref(false)
    const generating = ref(false)

    const staffList = ref([])
    const shifts = ref([])
    const daysInMonth = ref([])
    const timelineHours = ref([])

    const minSelectableDate = ref(null)
    const maxSelectableDate = ref(null)

    const shiftEditorDialog = reactive({
      visible: false,
      saving: false,
      data: {}
    })

    const yearOptions = computed(() => {
      const currentYear = new Date().getFullYear()
      const years = []
      for (let i = currentYear - 2; i <= currentYear + 2; i++) {
        years.push({ label: `${i}年`, value: i })
      }
      return years
    })

    const monthOptions = computed(() => {
      const months = []
      for (let i = 1; i <= 12; i++) {
        months.push({ label: `${i}月`, value: i })
      }
      return months
    })

    const hourOptions = computed(() => {
      const hours = []
      for (let i = 0; i < 24; i++) {
        const hour = i.toString().padStart(2, '0')
        hours.push({ label: hour, value: hour })
      }
      return hours
    })

    const minuteOptions = computed(() => {
      const minutes = []
      for (let i = 0; i < 60; i += 15) {
        const minute = i.toString().padStart(2, '0')
        minutes.push({ label: minute, value: minute })
      }
      return minutes
    })

    const formatDateToString = (date) => {
      if (!date) return ''
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    const generateDaysInMonth = (year, month) => {
      const daysCount = new Date(year, month, 0).getDate()
      const days = []
      
      for (let day = 1; day <= daysCount; day++) {
        const date = new Date(year, month - 1, day)
        const dateStr = formatDateToString(date)
        const dayOfWeek = date.getDay()
        const today = new Date()
        
        days.push({
          date: dateStr,
          day: day,
          dayOfWeek: dayOfWeek,
          dayOfWeekLabel: ['日', '月', '火', '水', '木', '金', '土'][dayOfWeek],
          isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
          isToday: date.toDateString() === today.toDateString(),
          isNationalHoliday: false,
          isStoreClosed: false
        })
      }
      
      return days
    }

    const updateSelectedDateCalendar = (value) => {
      selectedDateCalendar.value = value
      if (value) {
        const selectedDateStr = formatDateToString(value)
        if (daysInMonth.value.some((day) => day.date === selectedDateStr)) {
          selectedDate.value = selectedDateStr
        }
      }
    }

    const updateShiftEditorVisible = (value) => {
      shiftEditorDialog.visible = value
    }

    const fetchStores = async () => {
      try {
        const storeData = await store.dispatch('store/fetchStores')
        stores.value = storeData
        if (storeData.length > 0 && !selectedStore.value) {
          selectedStore.value = storeData[0]
        }
      } catch (error) {
        console.error('店舗取得エラー:', error)
        toast.add({
          severity: 'error',
          summary: 'エラー',
          detail: '店舗一覧の取得に失敗しました',
          life: 3000
        })
      }
    }

    const fetchStaff = async () => {
      if (!selectedStore.value) return
      
      try {
        loading.value = true
        const staffData = await store.dispatch('staff/fetchStaff', selectedStore.value.id)
        staffList.value = staffData
      } catch (error) {
        console.error('スタッフ取得エラー:', error)
        toast.add({
          severity: 'error',
          summary: 'エラー',
          detail: 'スタッフ一覧の取得に失敗しました',
          life: 3000
        })
      } finally {
        loading.value = false
      }
    }

    const fetchShiftData = async () => {
      if (!selectedStore.value) return
      
      try {
        loading.value = true
        const shiftData = await store.dispatch('shift/fetchShiftByYearMonth', {
          year: selectedYear.value,
          month: selectedMonth.value,
          storeId: selectedStore.value.id
        })
        
        if (shiftData) {
          shifts.value = shiftData.shifts || []
        } else {
          shifts.value = []
        }
      } catch (error) {
        console.error('シフトデータ取得エラー:', error)
        shifts.value = []
      } finally {
        loading.value = false
      }
    }

    const onStoreChange = () => {
      fetchStaff()
      fetchShiftData()
    }

    const onPeriodChange = () => {
      daysInMonth.value = generateDaysInMonth(selectedYear.value, selectedMonth.value)
      
      const today = new Date()
      const currentMonthDay = formatDateToString(today)
      
      if (daysInMonth.value.some(day => day.date === currentMonthDay)) {
        selectedDate.value = currentMonthDay
        selectedDateCalendar.value = today
      } else {
        selectedDate.value = daysInMonth.value[0]?.date || ''
        selectedDateCalendar.value = new Date(selectedYear.value, selectedMonth.value - 1, 1)
      }
      
      const monthStart = new Date(selectedYear.value, selectedMonth.value - 1, 1)
      const monthEnd = new Date(selectedYear.value, selectedMonth.value, 0)
      minSelectableDate.value = monthStart
      maxSelectableDate.value = monthEnd
      
      fetchShiftData()
    }

    const previousMonth = () => {
      if (selectedMonth.value === 1) {
        selectedMonth.value = 12
        selectedYear.value--
      } else {
        selectedMonth.value--
      }
      onPeriodChange()
    }

    const nextMonth = () => {
      if (selectedMonth.value === 12) {
        selectedMonth.value = 1
        selectedYear.value++
      } else {
        selectedMonth.value++
      }
      onPeriodChange()
    }

    const previousDate = () => {
      const currentDate = new Date(selectedDate.value)
      currentDate.setDate(currentDate.getDate() - 1)
      
      if (currentDate >= minSelectableDate.value) {
        selectedDate.value = formatDateToString(currentDate)
        selectedDateCalendar.value = currentDate
      }
    }

    const nextDate = () => {
      const currentDate = new Date(selectedDate.value)
      currentDate.setDate(currentDate.getDate() + 1)
      
      if (currentDate <= maxSelectableDate.value) {
        selectedDate.value = formatDateToString(currentDate)
        selectedDateCalendar.value = currentDate
      }
    }

    const selectDate = (date) => {
      selectedDate.value = date
      selectedDateCalendar.value = new Date(date)
    }

    const toggleViewMode = () => {
      isEditMode.value = false
    }

    const toggleEditMode = () => {
      isEditMode.value = true
    }

    const generateShift = async () => {
      if (!selectedStore.value) return
      
      confirm.require({
        message: `${selectedYear.value}年${selectedMonth.value}月のシフトを自動生成しますか？既存のシフトは上書きされます。`,
        header: 'シフト自動生成',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: '生成',
        rejectLabel: 'キャンセル',
        accept: async () => {
          try {
            generating.value = true
            await store.dispatch('shift/generateShift', {
              storeId: selectedStore.value.id,
              year: selectedYear.value,
              month: selectedMonth.value
            })
            
            await fetchShiftData()
            
            toast.add({
              severity: 'success',
              summary: '成功',
              detail: 'シフトを自動生成しました',
              life: 3000
            })
          } catch (error) {
            console.error('シフト生成エラー:', error)
            toast.add({
              severity: 'error',
              summary: 'エラー',
              detail: 'シフトの自動生成に失敗しました',
              life: 3000
            })
          } finally {
            generating.value = false
          }
        }
      })
    }

    const onGanttDateSelect = (event) => {
      if (event && event.value) {
        updateSelectedDateCalendar(event.value)
      }
    }

    const openGanttShiftEditor = (date, staff, event) => {
      openShiftEditor({ date }, staff)
    }

    const openShiftEditor = (day, staff) => {
      const existingShift = getShiftForStaff(day.date, staff.id)
      const isPast = isPastDate(day.date)
      
      shiftEditorDialog.data = {
        title: `${staff.last_name} ${staff.first_name} のシフト編集 - ${formatDateDisplay(day.date)}`,
        date: day.date,
        staff: staff,
        hasShift: !!existingShift,
        isPast: isPast,
        startTimeHour: existingShift?.start_time?.substring(0, 2) || '09',
        startTimeMinute: existingShift?.start_time?.substring(3, 5) || '00',
        endTimeHour: existingShift?.end_time?.substring(0, 2) || '18',
        endTimeMinute: existingShift?.end_time?.substring(3, 5) || '00',
        hasBreak: !!(existingShift?.break_start_time && existingShift?.break_end_time),
        breakStartTimeHour: existingShift?.break_start_time?.substring(0, 2) || '',
        breakStartTimeMinute: existingShift?.break_start_time?.substring(3, 5) || '',
        breakEndTimeHour: existingShift?.break_end_time?.substring(0, 2) || '',
        breakEndTimeMinute: existingShift?.break_end_time?.substring(3, 5) || '',
        changeReason: ''
      }
      shiftEditorDialog.visible = true
    }

    const closeShiftEditor = () => {
      shiftEditorDialog.visible = false
      shiftEditorDialog.data = {}
      shiftEditorDialog.saving = false
    }

    const saveShift = async (shiftData) => {
      try {
        shiftEditorDialog.saving = true
        
        const assignmentData = {
          staff_id: shiftEditorDialog.data.staff.id,
          date: shiftEditorDialog.data.date,
          start_time: `${shiftData.startTimeHour}:${shiftData.startTimeMinute}:00`,
          end_time: `${shiftData.endTimeHour}:${shiftData.endTimeMinute}:00`,
          break_start_time: shiftData.hasBreak && shiftData.breakStartTimeHour && shiftData.breakStartTimeMinute 
            ? `${shiftData.breakStartTimeHour}:${shiftData.breakStartTimeMinute}:00` 
            : null,
          break_end_time: shiftData.hasBreak && shiftData.breakEndTimeHour && shiftData.breakEndTimeMinute 
            ? `${shiftData.breakEndTimeHour}:${shiftData.breakEndTimeMinute}:00` 
            : null,
          store_id: selectedStore.value.id,
          change_reason: shiftData.changeReason || null
        }

        const existingShift = getShiftForStaff(shiftEditorDialog.data.date, shiftEditorDialog.data.staff.id)
        
        if (existingShift) {
          await store.dispatch('shift/updateShiftAssignment', {
            year: selectedYear.value,
            month: selectedMonth.value,
            assignmentId: existingShift.id,
            assignmentData
          })
        } else {
          await store.dispatch('shift/createShiftAssignment', {
            year: selectedYear.value,
            month: selectedMonth.value,
            assignmentData
          })
        }

        await fetchShiftData()
        
        toast.add({
          severity: 'success',
          summary: '成功',
          detail: 'シフトを保存しました',
          life: 3000
        })
        
        closeShiftEditor()
      } catch (error) {
        console.error('シフト保存エラー:', error)
        toast.add({
          severity: 'error',
          summary: 'エラー',
          detail: 'シフトの保存に失敗しました',
          life: 3000
        })
      } finally {
        shiftEditorDialog.saving = false
      }
    }

    const clearShift = async (data) => {
      try {
        const existingShift = getShiftForStaff(shiftEditorDialog.data.date, shiftEditorDialog.data.staff.id)
        
        if (existingShift) {
          await store.dispatch('shift/deleteShiftAssignment', {
            year: selectedYear.value,
            month: selectedMonth.value,
            assignmentId: existingShift.id,
            change_reason: data.changeReason || null
          })

          await fetchShiftData()
          
          toast.add({
            severity: 'success',
            summary: '成功',
            detail: 'シフトを削除しました',
            life: 3000
          })
        }
        
        closeShiftEditor()
      } catch (error) {
        console.error('シフト削除エラー:', error)
        toast.add({
          severity: 'error',
          summary: 'エラー',
          detail: 'シフトの削除に失敗しました',
          life: 3000
        })
      }
    }

    const confirmQuickDelete = (shift) => {
      confirm.require({
        message: 'このシフトを削除しますか？',
        header: 'シフト削除',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: '削除',
        rejectLabel: 'キャンセル',
        acceptClass: 'p-button-danger',
        accept: async () => {
          try {
            await store.dispatch('shift/deleteShiftAssignment', {
              year: selectedYear.value,
              month: selectedMonth.value,
              assignmentId: shift.id
            })

            await fetchShiftData()
            
            toast.add({
              severity: 'success',
              summary: '成功',
              detail: 'シフトを削除しました',
              life: 3000
            })
          } catch (error) {
            console.error('シフト削除エラー:', error)
            toast.add({
              severity: 'error',
              summary: 'エラー',
              detail: 'シフトの削除に失敗しました',
              life: 3000
            })
          }
        }
      })
    }

    const getShiftForStaff = (date, staffId) => {
      const dayShift = shifts.value.find(shift => shift.date === date)
      if (!dayShift || !dayShift.assignments) return null
      
      return dayShift.assignments.find(assignment => assignment.staff_id === staffId)
    }

    const isPastDate = (date) => {
      const today = new Date()
      const checkDate = new Date(date)
      today.setHours(0, 0, 0, 0)
      checkDate.setHours(0, 0, 0, 0)
      return checkDate < today
    }

    const formatDateDisplay = (date) => {
      if (!date) return ''
      const d = new Date(date)
      const month = d.getMonth() + 1
      const day = d.getDate()
      const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
      return `${month}月${day}日(${dayOfWeek})`
    }

    watch(selectedStore, () => {
      if (selectedStore.value) {
        fetchStaff()
        fetchShiftData()
      }
    })

    onMounted(async () => {
      await fetchStores()
      
      daysInMonth.value = generateDaysInMonth(selectedYear.value, selectedMonth.value)
      
      const today = new Date()
      selectedDate.value = formatDateToString(today)
      selectedDateCalendar.value = today
      
      const monthStart = new Date(selectedYear.value, selectedMonth.value - 1, 1)
      const monthEnd = new Date(selectedYear.value, selectedMonth.value, 0)
      minSelectableDate.value = monthStart
      maxSelectableDate.value = monthEnd
      
      timelineHours.value = Array.from({ length: 18 }, (_, i) => i + 6)
      
      if (selectedStore.value) {
        await fetchStaff()
        await fetchShiftData()
      }
    })

    return {
      selectedStore,
      stores,
      selectedYear,
      selectedMonth,
      selectedDate,
      selectedDateCalendar,
      activeTabIndex,
      isEditMode,
      loading,
      generating,
      staffList,
      shifts,
      daysInMonth,
      timelineHours,
      minSelectableDate,
      maxSelectableDate,
      shiftEditorDialog,
      yearOptions,
      monthOptions,
      hourOptions,
      minuteOptions,
      updateSelectedDateCalendar,
      updateShiftEditorVisible,
      onStoreChange,
      onPeriodChange,
      previousMonth,
      nextMonth,
      previousDate,
      nextDate,
      selectDate,
      toggleViewMode,
      toggleEditMode,
      generateShift,
      onGanttDateSelect,
      openGanttShiftEditor,
      openShiftEditor,
      closeShiftEditor,
      saveShift,
      clearShift,
      confirmQuickDelete
    }
  }
}
</script>

<style scoped>
.shift-management {
  background-color: #f8f9fa;
  min-height: 100vh;
}

.shift-management-header {
  background: white;
  border-bottom: 1px solid #e5e7eb;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-title-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.page-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: #1e293b;
}

.page-title i {
  color: #3b82f6;
  font-size: 1.75rem;
}

.store-selector-container {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.store-selector {
  min-width: 200px;
}

.management-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.period-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.period-nav-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.year-selector,
.month-selector {
  min-width: 80px;
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.action-buttons .p-button.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.shift-content {
  padding: 0 1.5rem 1.5rem;
}

.shift-tabs {
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.shift-tabs :deep(.p-tabview-nav) {
  background: #f8f9fa;
  border-bottom: 1px solid #e5e7eb;
}

.shift-tabs :deep(.p-tabview-panels) {
  padding: 0;
}

.no-store-selected {
  padding: 0 1.5rem 1.5rem;
}

.empty-state {
  text-align: center;
  padding: 3rem 2rem;
}

.empty-icon {
  font-size: 4rem;
  color: #94a3b8;
  margin-bottom: 1rem;
}

.empty-state h3 {
  margin: 0 0 0.5rem 0;
  color: #64748b;
  font-size: 1.25rem;
}

.empty-state p {
  margin: 0;
  color: #94a3b8;
}

@media (max-width: 768px) {
  .shift-management-header {
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .header-content {
    gap: 1rem;
  }

  .page-title-section {
    flex-direction: column;
    align-items: flex-start;
  }

  .management-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .period-selector {
    justify-content: center;
  }

  .action-buttons {
    justify-content: center;
  }

  .shift-content {
    padding: 0 1rem 1rem;
  }

  .no-store-selected {
    padding: 0 1rem 1rem;
  }
}

@media (max-width: 480px) {
  .action-buttons {
    flex-direction: column;
  }

  .action-buttons .p-button {
    width: 100%;
    justify-content: center;
  }
}
</style>