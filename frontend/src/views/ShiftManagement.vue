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
              :disabled="loading"
            />
            <Dropdown
              v-model="selectedYear"
              :options="yearOptions"
              optionLabel="label"
              optionValue="value"
              class="year-selector"
              @change="onPeriodChange"
              :disabled="loading"
            />
            <Dropdown
              v-model="selectedMonth"
              :options="monthOptions"
              optionLabel="label"
              optionValue="value"
              class="month-selector"
              @change="onPeriodChange"
              :disabled="loading"
            />
            <Button
              icon="pi pi-chevron-right"
              class="period-nav-btn"
              @click="nextMonth"
              :disabled="loading"
            />
          </div>

          <div class="action-buttons">
            <Button
              v-if="!hasCurrentShift"
              icon="pi pi-plus"
              label="シフト作成"
              class="p-button-success"
              @click="createShift"
              :disabled="loading || !selectedStore"
            />
            
            <template v-if="hasCurrentShift">
              <Button
                icon="pi pi-eye"
                label="プレビュー"
                class="p-button-outlined"
                @click="toggleViewMode"
                :class="{ active: !isEditMode }"
                :disabled="loading"
              />
              <Button
                icon="pi pi-pencil"
                :label="isEditMode ? '編集完了' : 'シフト編集'"
                class="p-button-primary"
                @click="toggleEditMode"
                :class="{ active: isEditMode }"
                :disabled="loading"
              />
              <Button
                icon="pi pi-refresh"
                label="AI再生成"
                class="p-button-warning"
                @click="regenerateShift"
                :loading="generating"
                :disabled="loading"
              />
              <Button
                icon="pi pi-trash"
                label="シフト削除"
                class="p-button-danger"
                @click="deleteShift"
                :disabled="loading"
              />
              <Button
                icon="pi pi-print"
                label="印刷"
                class="p-button-info"
                @click="printShift"
                :disabled="loading"
              />
            </template>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="loading-content">
        <ProgressSpinner />
        <span class="loading-text">データを読み込み中...</span>
      </div>
    </div>

    <div v-else-if="selectedStore" class="shift-content">
      <div v-if="!hasCurrentShift" class="no-shift-container">
        <Card>
          <template #content>
            <div class="empty-state">
              <i class="pi pi-calendar-plus empty-icon"></i>
              <h3>シフトがありません</h3>
              <p>{{ selectedYear }}年{{ selectedMonth }}月のシフトはまだ作成されていません</p>
              <Button
                icon="pi pi-plus"
                label="シフトを作成"
                class="p-button-success"
                @click="createShift"
              />
            </div>
          </template>
        </Card>
      </div>

      <div v-else>
        <TabView v-model:activeIndex="activeTabIndex" class="shift-tabs">
          <TabPanel header="カレンダー表示">
            <ShiftCalendar
              :is-edit-mode="isEditMode"
              :selected-date="selectedDate"
              :selected-store="selectedStore"
              :days-in-month="daysInMonth"
              :staff-list="staffList"
              :shifts="shifts"
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
              :shifts="shifts"
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
              :all-store-shifts="allStoreShifts"
            />
          </TabPanel>
        </TabView>
      </div>
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

    <!-- シフト作成方法選択ダイアログ -->
    <Dialog
      v-model:visible="selectionDialogVisible"
      header="シフト作成方法の選択"
      :modal="true"
      :style="{ width: '50rem' }"
      :breakpoints="{ '960px': '75vw', '640px': '90vw' }"
    >
      <div class="grid">
        <div class="col-12 md:col-6 p-3">
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
        <div class="col-12 md:col-6 p-3">
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
    const selectionDialogVisible = ref(false)

    const staffList = ref([])
    const shifts = ref([])
    const daysInMonth = ref([])
    const timelineHours = ref([])
    const currentShift = ref(null)
    const allStoreShifts = ref({})
    const systemSettings = ref(null)

    const minSelectableDate = ref(null)
    const maxSelectableDate = ref(null)

    const shiftEditorDialog = reactive({
      visible: false,
      saving: false,
      data: {}
    })

    const hasCurrentShift = computed(() => {
      return currentShift.value !== null
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

    const fetchSystemSettings = async () => {
      try {
        const response = await store.dispatch('shift/fetchSystemSettings')
        systemSettings.value = response
      } catch (error) {
        console.error('システム設定取得エラー:', error)
        systemSettings.value = { closing_day: 25 }
      }
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
          currentShift.value = {
            id: shiftData.id,
            store_id: shiftData.store_id,
            year: shiftData.year,
            month: shiftData.month,
            status: shiftData.status
          }
          shifts.value = shiftData.shifts || []
        } else {
          currentShift.value = null
          shifts.value = []
        }
      } catch (error) {
        console.error('シフトデータ取得エラー:', error)
        if (error.response && error.response.status === 404) {
          currentShift.value = null
          shifts.value = []
        } else {
          toast.add({
            severity: 'error',
            summary: 'エラー',
            detail: 'シフトデータの取得に失敗しました',
            life: 3000
          })
        }
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
      toast.add({
        severity: 'info',
        summary: 'プレビューモード',
        detail: 'プレビューモードに切り替えました',
        life: 2000
      })
    }

    const toggleEditMode = () => {
      isEditMode.value = !isEditMode.value
      toast.add({
        severity: 'info',
        summary: isEditMode.value ? '編集モード開始' : '編集モード終了',
        detail: isEditMode.value
          ? 'シフトセルをクリックして編集できます'
          : '編集モードを終了しました',
        life: 3000
      })
    }

    const createShift = () => {
      const hasStaffData = staffList.value && staffList.value.length > 0

      if (!hasStaffData) {
        toast.add({
          severity: 'warn',
          summary: '注意',
          detail: 'スタッフが登録されていません。先にスタッフを登録してください。',
          life: 5000
        })
        return
      }

      selectionDialogVisible.value = true
    }

    const selectAIGeneration = () => {
      selectionDialogVisible.value = false
      generateShift()
    }

    const selectManualCreation = () => {
      selectionDialogVisible.value = false
      createEmptyShift()
    }

    const createEmptyShift = async () => {
      try {
        loading.value = true

        await store.dispatch('shift/createShift', {
          store_id: selectedStore.value.id,
          year: selectedYear.value,
          month: selectedMonth.value,
          status: 'draft'
        })

        await fetchShiftData()
        isEditMode.value = true

        toast.add({
          severity: 'success',
          summary: '作成完了',
          detail: 'シフトを作成しました。編集モードになりました。',
          life: 3000
        })
      } catch (error) {
        console.error('シフト作成エラー:', error)
        toast.add({
          severity: 'error',
          summary: 'エラー',
          detail: 'シフトの作成に失敗しました',
          life: 3000
        })
      } finally {
        loading.value = false
      }
    }

    const generateShift = async () => {
      try {
        generating.value = true

        toast.add({
          severity: 'info',
          summary: 'シフト生成開始',
          detail: 'AIによるシフト生成を開始しています...',
          life: 5000
        })

        await store.dispatch('shift/generateShift', {
          storeId: selectedStore.value.id,
          year: selectedYear.value,
          month: selectedMonth.value
        })

        await fetchShiftData()

        toast.add({
          severity: 'success',
          summary: 'シフト生成完了',
          detail: 'AIシフト生成が完了しました',
          life: 5000
        })
      } catch (error) {
        console.error('シフト生成エラー:', error)
        
        let errorMessage = 'AIシフト生成に失敗しました'
        if (error.response?.data?.message) {
          errorMessage = error.response.data.message
        }

        toast.add({
          severity: 'error',
          summary: '生成エラー',
          detail: errorMessage,
          life: 8000
        })

        confirm.require({
          message: 'AIシフト生成に失敗しました。空のシフトを作成して手動で編集しますか？',
          header: '代替手段の提案',
          icon: 'pi pi-question-circle',
          acceptLabel: '空シフト作成',
          rejectLabel: 'キャンセル',
          accept: () => {
            createEmptyShift()
          }
        })
      } finally {
        generating.value = false
      }
    }

    const regenerateShift = () => {
      confirm.require({
        message: `現在のシフトを削除してAIで再生成しますか？

⚠️ 注意：
- 現在のシフトは完全に削除されます
- スタッフの勤務条件に違反しないシフトが生成されます
- 条件が厳しい場合、生成に失敗する可能性があります`,
        header: 'シフト再生成の確認',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-warning',
        acceptLabel: '再生成実行',
        rejectLabel: 'キャンセル',
        accept: async () => {
          await generateShift()
        }
      })
    }

    const deleteShift = () => {
      confirm.require({
        message: `${selectedYear.value}年${selectedMonth.value}月のシフトを完全に削除しますか？この操作は取り消せません。`,
        header: 'シフト削除の確認',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        acceptLabel: '削除',
        rejectLabel: 'キャンセル',
        accept: async () => {
          try {
            loading.value = true

            await store.dispatch('shift/deleteShift', {
              year: selectedYear.value,
              month: selectedMonth.value,
              storeId: selectedStore.value.id
            })

            currentShift.value = null
            shifts.value = []
            selectedDate.value = null
            isEditMode.value = false

            toast.add({
              severity: 'success',
              summary: '削除完了',
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
          } finally {
            loading.value = false
          }
        }
      })
    }

    const printShift = () => {
      if (!hasCurrentShift.value) return

      const printWindow = window.open('', '_blank')

      if (!printWindow) {
        toast.add({
          severity: 'error',
          summary: 'エラー',
          detail: 'ポップアップがブロックされました。ブラウザの設定を確認してください。',
          life: 3000
        })
        return
      }

      const printContent = generatePrintContent()
      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
    }

    const generatePrintContent = () => {
      const storeName = selectedStore.value ? selectedStore.value.name : ''
      const period = `${selectedYear.value}年${selectedMonth.value}月`

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
            .print-header { text-align: center; margin-bottom: 20px; }
            .print-title { font-size: 16px; font-weight: bold; margin-bottom: 8px; }
            .print-period { font-size: 12px; color: #666; }
            .print-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .print-table th, .print-table td { 
              border: 1px solid #333; 
              padding: 4px 2px; 
              text-align: center; 
              font-size: 8px;
              vertical-align: middle;
            }
            .print-table th { background-color: #f0f0f0; font-weight: bold; }
            .staff-col { width: 80px; text-align: left; padding-left: 4px; font-weight: bold; }
            .date-col { width: 35px; font-weight: bold; }
            .shift-cell { font-size: 7px; line-height: 1.2; }
            .holiday { color: #dc2626; }
            .store-closed { background-color: #f3f4f6; color: #6b7280; }
            .today { background-color: #e6f3ff; }
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
                <th class="staff-col">スタッフ</th>`

      daysInMonth.value.forEach((day) => {
        const holidayClass = day.isHoliday ? 'holiday' : ''
        const todayClass = day.isToday ? 'today' : ''
        const storeClosedClass = day.isStoreClosed ? 'store-closed' : ''
        const cellClass = `${holidayClass} ${todayClass} ${storeClosedClass}`.trim()
        
        printHtml += `
                <th class="date-col ${cellClass}">
                  <div>${day.day}</div>
                  <div style="font-size: 6px;">${day.dayOfWeekLabel}</div>
                </th>`
      })

      printHtml += `
              </tr>
            </thead>
            <tbody>`

      staffList.value.forEach((staff) => {
        printHtml += `<tr>`
        printHtml += `<td class="staff-col">${staff.last_name} ${staff.first_name}</td>`

        daysInMonth.value.forEach((day) => {
          const shift = getShiftForStaff(day.date, staff.id)
          const holidayClass = day.isHoliday ? 'holiday' : ''
          const todayClass = day.isToday ? 'today' : ''
          const storeClosedClass = day.isStoreClosed ? 'store-closed' : ''
          const cellClass = `shift-cell ${holidayClass} ${todayClass} ${storeClosedClass}`.trim()

          if (shift) {
            printHtml += `<td class="${cellClass}">
              ${formatTime(shift.start_time)}<br>-<br>${formatTime(shift.end_time)}
            </td>`
          } else if (day.isStoreClosed) {
            printHtml += `<td class="${cellClass}">定休日</td>`
          } else {
            printHtml += `<td class="${cellClass}">-</td>`
          }
        })

        printHtml += `</tr>`
      })

      printHtml += `
            </tbody>
          </table>
        </body>
        </html>`

      return printHtml
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
      if (!isEditMode.value) {
        toast.add({
          severity: 'info',
          summary: '編集不可',
          detail: '「シフト編集」ボタンを押して編集モードにしてください',
          life: 2000
        })
        return
      }

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
      if (!shiftData.startTimeHour || !shiftData.startTimeMinute || 
          !shiftData.endTimeHour || !shiftData.endTimeMinute) {
        toast.add({
          severity: 'warn',
          summary: '入力エラー',
          detail: '開始時間と終了時間を選択してください',
          life: 3000
        })
        return
      }

      const startTime = `${shiftData.startTimeHour}:${shiftData.startTimeMinute}`
      const endTime = `${shiftData.endTimeHour}:${shiftData.endTimeMinute}`

      if (startTime >= endTime) {
        toast.add({
          severity: 'warn',
          summary: '入力エラー',
          detail: '終了時間は開始時間より後にしてください',
          life: 3000
        })
        return
      }

      if (shiftEditorDialog.data.isPast && !shiftData.changeReason?.trim()) {
        toast.add({
          severity: 'warn',
          summary: '入力エラー',
          detail: '過去の日付を編集する場合は変更理由を入力してください',
          life: 3000
        })
        return
      }

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

        if (shiftData.hasBreak && assignmentData.break_start_time && assignmentData.break_end_time) {
          const breakStartTime = `${shiftData.breakStartTimeHour}:${shiftData.breakStartTimeMinute}`
          const breakEndTime = `${shiftData.breakEndTimeHour}:${shiftData.breakEndTimeMinute}`

          if (breakStartTime < startTime || breakEndTime > endTime || breakStartTime >= breakEndTime) {
            toast.add({
              severity: 'warn',
              summary: '入力エラー',
              detail: '休憩時間は勤務時間内に収まるように設定してください',
              life: 3000
            })
            return
          }
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
        
        const successMessage = shiftEditorDialog.data.isPast
          ? '過去のシフトを変更しました（変更履歴に記録されます）'
          : 'シフトを保存しました'
        
        toast.add({
          severity: 'success',
          summary: '保存完了',
          detail: successMessage,
          life: 3000
        })
        
        closeShiftEditor()
      } catch (error) {
        console.error('シフト保存エラー:', error)
        
        let errorMessage = 'シフトの保存に失敗しました'
        if (error.response?.data?.message) {
          errorMessage = error.response.data.message
        }

        toast.add({
          severity: 'error',
          summary: 'エラー',
          detail: errorMessage,
          life: 3000
        })
      } finally {
        shiftEditorDialog.saving = false
      }
    }

    const clearShift = async (data) => {
      if (!shiftEditorDialog.data.hasShift) {
        closeShiftEditor()
        return
      }

      if (shiftEditorDialog.data.isPast && !data.changeReason?.trim()) {
        toast.add({
          severity: 'warn',
          summary: '入力エラー',
          detail: '過去の日付を編集する場合は変更理由を入力してください',
          life: 3000
        })
        return
      }

      try {
        const existingShift = getShiftForStaff(shiftEditorDialog.data.date, shiftEditorDialog.data.staff.id)
        
        if (existingShift) {
          await store.dispatch('shift/deleteShiftAssignment', {
            year: selectedYear.value,
            month: selectedMonth.value,
            assignmentId: existingShift.id,
            change_reason: shiftEditorDialog.data.isPast ? data.changeReason : null
          })

          await fetchShiftData()
          
          const successMessage = shiftEditorDialog.data.isPast
            ? '過去のシフトを削除しました（変更履歴に記録されます）'
            : 'シフトを削除しました'
          
          toast.add({
            severity: 'success',
            summary: '削除完了',
            detail: successMessage,
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
      if (!shift) return

      confirm.require({
        message: 'このシフトを削除しますか？',
        header: 'シフト削除の確認',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        acceptLabel: '削除',
        rejectLabel: 'キャンセル',
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
              summary: '削除完了',
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

    const formatTime = (time) => {
      if (!time) return ''
      return time.slice(0, 5)
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
      await fetchSystemSettings()
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
      selectionDialogVisible,
      staffList,
      shifts,
      daysInMonth,
      timelineHours,
      currentShift,
      allStoreShifts,
      minSelectableDate,
      maxSelectableDate,
      shiftEditorDialog,
      hasCurrentShift,
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
      createShift,
      selectAIGeneration,
      selectManualCreation,
      generateShift,
      regenerateShift,
      deleteShift,
      printShift,
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
  flex-wrap: wrap;
}

.action-buttons .p-button.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
  padding: 2rem;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.loading-text {
  font-size: 1rem;
  color: #666;
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

.no-store-selected,
.no-shift-container {
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
  margin: 0 0 1.5rem 0;
  color: #94a3b8;
}

.selection-card {
  border-radius: 8px;
  padding: 1.5rem;
  height: 100%;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  display: flex;
  flex-direction: column;
  text-align: center;
  background-color: var(--surface-a);
  box-shadow: 0px 0px 2px rgb(103, 103, 103);
}

.selection-card:hover {
  transform: translate(0, -2px);
  box-shadow: 0px 0px 6px rgb(69, 146, 213);
}

.selection-card .card-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  font-size: 1.25rem;
  margin-bottom: 1rem;
}

.selection-card .card-header i {
  font-size: 1.75rem;
  color: var(--primary-color);
}

.selection-card .card-header h3 {
  margin: 0;
  font-weight: 600;
  color: var(--text-color);
}

.selection-card .card-content {
  color: var(--text-color-secondary);
  flex-grow: 1;
  line-height: 1.6;
  margin-bottom: 1.5rem;
  white-space: pre-line;
  text-align: left;
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

  .no-store-selected,
  .no-shift-container {
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

:deep(.p-confirm-dialog-message) {
  white-space: pre-line;
}
</style>