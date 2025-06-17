<template>
  <div class="store-management">
    <div class="page-header">
      <h1 class="page-title">店舗管理</h1>
    </div>

    <div class="toolbar">
      <div class="search-container">
        <span class="p-input-icon-left">
          <i class="pi pi-search" />
          <InputText placeholder="検索..." />
        </span>
      </div>

      <div class="actions">
        <Button
          label="新規店舗"
          icon="pi pi-plus"
          class="p-button-primary"
          @click="openNew"
          v-if="isAdmin"
        />
      </div>
    </div>

    <div v-if="loading" class="loading-container">
      <ProgressSpinner />
      <span class="loading-text">読み込み中...</span>
    </div>

    <div v-else-if="stores.length === 0" class="empty-message">
      <Message severity="info">
        <div class="message-content">
          <i class="pi pi-info-circle mr-2"></i>
          <span
            >店舗情報がまだ登録されていません。「新規店舗」ボタンをクリックして店舗を登録してください。</span
          >
        </div>
      </Message>
    </div>

    <div v-else class="table-container">
      <DataTable
        :value="stores"
        :loading="loading"
        dataKey="id"
        :paginator="true"
        :rows="10"
        :rowsPerPageOptions="[5, 10, 25, 50]"
        stripedRows
        removableSort
        :scrollable="true"
        scrollHeight="flex"
        responsiveLayout="scroll"
      >
        <template #empty>
          <div class="text-center py-4">店舗が見つかりません</div>
        </template>
        <template #loading>
          <div class="text-center py-4">データを読み込み中...</div>
        </template>

        <Column field="name" header="店舗名" sortable>
          <template #body="{ data }">
            <div class="store-name-cell">{{ data.name }}</div>
          </template>
        </Column>

        <Column field="area" header="エリア" sortable>
          <template #body="{ data }">
            {{ data.area || "未設定" }}
          </template>
        </Column>

        <Column field="postal_code" header="郵便番号" sortable>
          <template #body="{ data }">
            {{ data.postal_code || "未設定" }}
          </template>
        </Column>

        <Column field="address" header="住所" sortable>
          <template #body="{ data }">
            {{ data.address || "未設定" }}
          </template>
        </Column>

        <Column field="phone" header="電話番号" sortable>
          <template #body="{ data }">
            {{ data.phone || "未設定" }}
          </template>
        </Column>

        <Column field="closedDays" header="定休日" sortable>
          <template #body="{ data }">
            <div>
              <div>{{ getClosedDaysText(data.id) }}</div>
              <div
                v-if="getSpecialClosedDaysText(data.id)"
                class="special-closed-days"
              >
                <span class="special-closed-label">特別定休日:</span>
                {{ getSpecialClosedDaysText(data.id) }}
              </div>
            </div>
          </template>
        </Column>

        <Column field="businessHours" header="営業時間">
          <template #body="{ data }">
            <Button
              icon="pi pi-clock"
              label="詳細表示"
              class="p-button-text p-button-sm"
              @click="showBusinessHoursDialog(data)"
            />
          </template>
        </Column>

        <Column header="操作" :exportable="false">
          <template #body="{ data }">
            <div class="action-buttons">
              <Button
                icon="pi pi-pencil"
                class="p-button-rounded p-button-text p-button-plain"
                @click="editStore(data)"
                title="編集"
              />
              <Button
                icon="pi pi-trash"
                class="p-button-rounded p-button-text p-button-danger"
                @click="confirmDeleteStore(data)"
                title="削除"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <Dialog
      v-model:visible="newStoreDialog.visible"
      header="新規店舗"
      :modal="true"
      class="p-fluid store-dialog"
      :style="{ width: '96vw', maxWidth: '1000px', height: '95vh' }"
      :maximizable="true"
    >
      <div class="dialog-content">
        <TabView class="full-height-tabs">
          <TabPanel header="基本情報">
            <div class="tab-content">
              <div class="p-grid p-formgrid">
                <div class="p-col-12">
                  <div class="field">
                    <label for="new-name"
                      >店舗名 <span class="required-mark">*</span></label
                    >
                    <InputText
                      id="new-name"
                      v-model="newStoreDialog.store.name"
                      :class="{
                        'p-invalid': submitted && !newStoreDialog.store.name,
                      }"
                    />
                    <small
                      v-if="submitted && !newStoreDialog.store.name"
                      class="p-error"
                      >店舗名は必須です</small
                    >
                  </div>
                </div>

                <div class="p-col-12">
                  <div class="field">
                    <label for="new-area">エリア</label>
                    <AutoComplete
                      id="new-area"
                      v-model="newStoreDialog.store.area"
                      :suggestions="filteredAreas"
                      @complete="searchArea"
                      placeholder="例: 東京都心エリア"
                      :dropdown="true"
                      :minLength="0"
                    />
                  </div>
                </div>

                <div class="p-col-12">
                  <div class="field">
                    <label for="new-zip-input">郵便番号</label>
                    <div class="postal-row">
                      <InputText
                        id="new-zip-input"
                        v-model="newZipCode"
                        placeholder="（ハイフンなし）"
                        class="zip-input"
                        maxlength="7"
                      />
                      <Button
                        label="検索"
                        icon="pi pi-search"
                        class="p-button-sm ml-2"
                        style="width: 100px; font-size: 0.85rem"
                        @click="searchWithNewZip"
                      />
                    </div>
                    <small class="form-text text-muted"
                      >ハイフンなしで7桁の数字を入力</small
                    >
                  </div>
                </div>

                <div class="p-col-12">
                  <div class="field">
                    <label for="new-address">住所</label>
                    <Textarea
                      id="new-address"
                      v-model="newStoreDialog.store.address"
                      rows="3"
                    />
                  </div>
                </div>

                <div class="p-col-12">
                  <div class="field">
                    <label for="new-phone">電話番号</label>
                    <InputText
                      id="new-phone"
                      v-model="newStoreDialog.store.phone"
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="営業時間">
            <div class="tab-content">
              <div class="field">
                <h4>曜日ごとの営業時間</h4>

                <div
                  v-for="day in daysOfWeek"
                  :key="'biz-hours-' + day.value"
                  class="business-hours-item"
                >
                  <div class="day-header">
                    <h5>{{ day.label }}曜日</h5>
                    <div class="day-closed-toggle">
                      <Checkbox
                        v-model="
                          newStoreDialog.businessHours[day.value].is_closed
                        "
                        binary
                        :inputId="'closed-' + day.value"
                      />
                      <label :for="'closed-' + day.value" class="ml-2"
                        >定休日</label
                      >
                    </div>
                  </div>

                  <div
                    v-if="!newStoreDialog.businessHours[day.value].is_closed"
                    class="time-inputs"
                  >
                    <div class="time-field">
                      <label :for="'opening-time-' + day.value"
                        >営業開始時間</label
                      >
                      <Dropdown
                        :id="'opening-time-' + day.value"
                        v-model="
                          newStoreDialog.businessHours[day.value].opening_time
                        "
                        :options="timeOptions"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="開始時間を選択"
                        class="w-full"
                      />
                    </div>
                    <span class="time-separator">〜</span>
                    <div class="time-field">
                      <label :for="'closing-time-' + day.value"
                        >営業終了時間</label
                      >
                      <Dropdown
                        :id="'closing-time-' + day.value"
                        v-model="
                          newStoreDialog.businessHours[day.value].closing_time
                        "
                        :options="timeOptions"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="終了時間を選択"
                        class="w-full"
                      />
                    </div>
                  </div>
                  <div v-else class="closed-message">定休日</div>
                </div>

                <div class="business-hours-actions mt-3">
                  <Button
                    label="すべての曜日に同じ時間を設定"
                    icon="pi pi-clock"
                    class="p-button-outlined"
                    @click="showApplyAllTimeDialog"
                  />
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="特別定休日">
            <div class="tab-content">
              <div class="field">
                <h4>特別定休日指定</h4>
                <div class="specific-dates">
                  <div class="date-picker">
                    <Calendar
                      v-model="selectedSpecificDate"
                      dateFormat="yy-mm-dd"
                      placeholder="日付を選択"
                      showIcon
                    />
                    <Button
                      icon="pi pi-plus"
                      class="p-button-sm"
                      @click="addSpecificDateNew"
                      :disabled="!selectedSpecificDate"
                    />
                  </div>

                  <div class="selected-dates">
                    <div
                      v-for="(date, index) in newStoreDialog.specificDates"
                      :key="index"
                      class="date-tag"
                    >
                      {{ formatDate(date) }}
                      <Button
                        icon="pi pi-times"
                        class="p-button-rounded p-button-text p-button-sm p-button-danger"
                        @click="removeSpecificDateNew(index)"
                      />
                    </div>
                    <div
                      v-if="newStoreDialog.specificDates.length === 0"
                      class="no-dates"
                    >
                      特別定休日は設定されていません
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="人員要件">
            <div class="tab-content">
              <h4 class="section-title">曜日ごとの人員要件</h4>

              <div
                v-for="(day, dayIndex) in daysOfWeek"
                :key="'req-' + day.value"
                class="day-requirements"
              >
                <h5 class="day-title">{{ day.label }}曜日</h5>

                <div
                  v-for="(req, reqIndex) in getRequirementsForDayNew(day.value)"
                  :key="dayIndex + '-' + reqIndex"
                  class="requirement-item"
                >
                  <div class="time-range">
                    <Dropdown
                      v-model="req.start_time"
                      :options="timeOptions"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="開始時間"
                      class="time-dropdown"
                    />
                    <span class="time-separator">〜</span>
                    <Dropdown
                      v-model="req.end_time"
                      :options="timeOptions"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="終了時間"
                      class="time-dropdown"
                    />
                  </div>

                  <div class="staff-count">
                    <InputNumber
                      v-model="req.required_staff_count"
                      :min="1"
                      showButtons
                      :step="1"
                      class="staff-input"
                    />
                    <span class="staff-unit">名</span>
                  </div>

                  <Button
                    icon="pi pi-trash"
                    class="p-button-danger p-button-sm remove-button"
                    @click="removeRequirementNew(day.value, reqIndex)"
                  />
                </div>

                <div class="add-requirement">
                  <Button
                    label="時間帯を追加"
                    icon="pi pi-plus"
                    class="p-button-sm p-button-outlined"
                    @click="addRequirementNew(day.value)"
                  />
                </div>
              </div>
            </div>
          </TabPanel>
        </TabView>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <Button
            label="キャンセル"
            icon="pi pi-times"
            class="p-button-text"
            @click="hideNewDialog"
          />
          <Button
            label="保存"
            icon="pi pi-check"
            class="p-button-primary"
            @click="saveNewStore"
            :loading="saving"
          />
        </div>
      </template>
    </Dialog>

    <Dialog
      v-model:visible="businessHoursDialog.visible"
      :header="`${businessHoursDialog.store?.name || '店舗'} - 営業時間詳細`"
      :modal="true"
      :style="{ width: '500px' }"
      :closeOnEscape="true"
    >
      <div class="business-hours-detail">
        <h4>曜日ごとの営業時間</h4>
        <div
          v-for="day in daysOfWeek"
          :key="'detail-hours-' + day.value"
          class="day-hours-item"
        >
          <div class="day-hours-header">
            <span class="day-name">{{ day.label }}曜日</span>

            <span
              v-if="
                businessHoursDialog.store?.businessHours &&
                businessHoursDialog.store.businessHours[day.value]
              "
              :class="[
                'day-status',
                businessHoursDialog.store.businessHours[day.value].is_closed
                  ? 'closed'
                  : 'open',
              ]"
            >
              {{
                businessHoursDialog.store.businessHours[day.value].is_closed
                  ? "定休日"
                  : "営業日"
              }}
            </span>
          </div>
          <div
            v-if="
              businessHoursDialog.store?.businessHours &&
              businessHoursDialog.store.businessHours[day.value] &&
              !businessHoursDialog.store.businessHours[day.value].is_closed
            "
            class="day-hours-time"
          >
            {{
              formatTime(
                businessHoursDialog.store.businessHours[day.value]?.opening_time
              )
            }}
            -
            {{
              formatTime(
                businessHoursDialog.store.businessHours[day.value]?.closing_time
              )
            }}
          </div>
        </div>

        <h4 class="mt-4">特別定休日</h4>
        <div
          v-if="
            businessHoursDialog.specificDates &&
            businessHoursDialog.specificDates.length > 0
          "
          class="special-closed-days-list"
        >
          <div
            v-for="(date, index) in businessHoursDialog.specificDates"
            :key="'special-date-' + index"
            class="special-date-tag"
          >
            {{ formatDate(date) }}
          </div>
        </div>
        <div v-else class="no-special-days">特別定休日は設定されていません</div>
      </div>
    </Dialog>

    <Dialog
      v-model:visible="storeDialog.visible"
      header="店舗編集"
      :modal="true"
      class="p-fluid store-dialog"
      :style="{ width: '90vw', maxWidth: '800px', height: '90vh' }"
      :maximizable="true"
    >
      <div class="dialog-content">
        <TabView class="full-height-tabs">
          <TabPanel header="基本情報">
            <div class="tab-content">
              <div class="p-grid p-formgrid">
                <div class="p-col-12">
                  <div class="field">
                    <label for="edit-name"
                      >店舗名 <span class="required-mark">*</span></label
                    >
                    <InputText
                      id="edit-name"
                      v-model="storeDialog.store.name"
                      :class="{
                        'p-invalid': submitted && !storeDialog.store.name,
                      }"
                    />
                    <small
                      v-if="submitted && !storeDialog.store.name"
                      class="p-error"
                      >店舗名は必須です</small
                    >
                  </div>
                </div>

                <div class="p-col-12">
                  <div class="field">
                    <label for="edit-area">エリア</label>
                    <AutoComplete
                      id="edit-area"
                      v-model="storeDialog.store.area"
                      :suggestions="filteredAreas"
                      @complete="searchArea"
                      placeholder="例: 東京都心エリア"
                      :dropdown="true"
                      :minLength="0"
                    />
                  </div>
                </div>

                <div class="p-col-12">
                  <div class="field">
                    <label for="edit-zip-input">郵便番号</label>
                    <div class="postal-row">
                      <InputText
                        id="edit-zip-input"
                        v-model="editZipCode"
                        placeholder="（ハイフンなし）"
                        class="zip-input"
                        maxlength="7"
                      />
                      <Button
                        label="検索"
                        icon="pi pi-search"
                        class="p-button-sm ml-2"
                        style="width: 100px; font-size: 0.85rem"
                        @click="searchWithEditZip"
                      />
                    </div>
                    <small class="form-text text-muted"
                      >ハイフンなしで7桁の数字を入力</small
                    >
                  </div>
                </div>

                <div class="p-col-12">
                  <div class="field">
                    <label for="edit-address">住所</label>
                    <Textarea
                      id="edit-address"
                      v-model="storeDialog.store.address"
                      rows="3"
                    />
                  </div>
                </div>

                <div class="p-col-12">
                  <div class="field">
                    <label for="edit-phone">電話番号</label>
                    <InputText
                      id="edit-phone"
                      v-model="storeDialog.store.phone"
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="営業時間">
            <div class="tab-content">
              <div class="field">
                <h4>曜日ごとの営業時間</h4>
                <div
                  v-for="day in daysOfWeek"
                  :key="'edit-biz-hours-' + day.value"
                  class="business-hours-item"
                >
                  <div class="day-header">
                    <h5>{{ day.label }}曜日</h5>
                    <div class="day-closed-toggle">
                      <Checkbox
                        v-model="storeDialog.businessHours[day.value].is_closed"
                        binary
                        :inputId="'edit-closed-' + day.value"
                      />
                      <label :for="'edit-closed-' + day.value" class="ml-2"
                        >定休日</label
                      >
                    </div>
                  </div>

                  <div
                    v-if="!storeDialog.businessHours[day.value].is_closed"
                    class="time-inputs"
                  >
                    <div class="time-field">
                      <label :for="'edit-opening-time-' + day.value"
                        >営業開始時間</label
                      >
                      <Dropdown
                        :id="'edit-opening-time-' + day.value"
                        v-model="
                          storeDialog.businessHours[day.value].opening_time
                        "
                        :options="timeOptions"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="開始時間を選択"
                        class="w-full"
                      />
                    </div>
                    <span class="time-separator">〜</span>
                    <div class="time-field">
                      <label :for="'edit-closing-time-' + day.value"
                        >営業終了時間</label
                      >
                      <Dropdown
                        :id="'edit-closing-time-' + day.value"
                        v-model="
                          storeDialog.businessHours[day.value].closing_time
                        "
                        :options="timeOptions"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="終了時間を選択"
                        class="w-full"
                      />
                    </div>
                  </div>
                  <div v-else class="closed-message">定休日</div>
                </div>

                <div class="business-hours-actions mt-3">
                  <Button
                    label="すべての曜日に同じ時間を設定"
                    icon="pi pi-clock"
                    class="p-button-outlined"
                    @click="showEditApplyAllTimeDialog"
                  />
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="特別定休日">
            <div class="tab-content">
              <div class="field">
                <h4>特別定休日指定</h4>
                <div class="specific-dates">
                  <div class="date-picker">
                    <Calendar
                      v-model="selectedEditSpecificDate"
                      dateFormat="yy-mm-dd"
                      placeholder="日付を選択"
                      showIcon
                    />
                    <Button
                      icon="pi pi-plus"
                      class="p-button-sm"
                      @click="addSpecificDateEdit"
                      :disabled="!selectedEditSpecificDate"
                    />
                  </div>

                  <div class="selected-dates">
                    <div
                      v-for="(date, index) in storeDialog.specificDates"
                      :key="index"
                      class="date-tag"
                    >
                      {{ formatDate(date) }}
                      <Button
                        icon="pi pi-times"
                        class="p-button-rounded p-button-text p-button-sm p-button-danger"
                        @click="removeSpecificDateEdit(index)"
                      />
                    </div>
                    <div
                      v-if="storeDialog.specificDates.length === 0"
                      class="no-dates"
                    >
                      特別定休日は設定されていません
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="人員要件">
            <div class="tab-content">
              <h4 class="section-title">曜日ごとの人員要件</h4>

              <div
                v-for="(day, dayIndex) in daysOfWeek"
                :key="'edit-req-' + day.value"
                class="day-requirements"
              >
                <h5 class="day-title">{{ day.label }}曜日</h5>

                <div
                  v-for="(req, reqIndex) in getRequirementsForDayEdit(
                    day.value
                  )"
                  :key="dayIndex + '-' + reqIndex"
                  class="requirement-item"
                >
                  <div class="time-range">
                    <Dropdown
                      v-model="req.start_time"
                      :options="timeOptions"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="開始時間"
                      class="time-dropdown"
                    />
                    <span class="time-separator">〜</span>
                    <Dropdown
                      v-model="req.end_time"
                      :options="timeOptions"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="終了時間"
                      class="time-dropdown"
                    />
                  </div>

                  <div class="staff-count">
                    <InputNumber
                      v-model="req.required_staff_count"
                      :min="1"
                      showButtons
                      :step="1"
                      class="staff-input"
                    />
                    <span class="staff-unit">名</span>
                  </div>

                  <Button
                    icon="pi pi-trash"
                    class="p-button-danger p-button-sm remove-button"
                    @click="removeRequirementEdit(day.value, reqIndex)"
                  />
                </div>

                <div class="add-requirement">
                  <Button
                    label="時間帯を追加"
                    icon="pi pi-plus"
                    class="p-button-sm p-button-outlined time-band-add-button"
                    @click="addRequirementEdit(day.value)"
                  />
                </div>
              </div>
            </div>
          </TabPanel>
        </TabView>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <Button
            label="キャンセル"
            icon="pi pi-times"
            class="p-button-text"
            @click="hideDialog"
          />
          <Button
            label="保存"
            icon="pi pi-check"
            class="p-button-primary"
            @click="saveStore"
            :loading="saving"
          />
        </div>
      </template>
    </Dialog>

    <Dialog
      v-model:visible="applyAllTimeDialog.visible"
      header="すべての曜日に同じ時間を設定"
      :modal="true"
      class="p-fluid"
      :style="{ width: '450px' }"
    >
      <div class="field">
        <label for="all-opening-time">営業開始時間</label>
        <Dropdown
          id="all-opening-time"
          v-model="applyAllTimeDialog.opening_time"
          :options="timeOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="開始時間を選択"
        />
      </div>

      <div class="field">
        <label for="all-closing-time">営業終了時間</label>
        <Dropdown
          id="all-closing-time"
          v-model="applyAllTimeDialog.closing_time"
          :options="timeOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="終了時間を選択"
        />
      </div>

      <template #footer>
        <Button
          label="キャンセル"
          icon="pi pi-times"
          class="p-button-text"
          @click="applyAllTimeDialog.visible = false"
        />
        <Button
          label="適用"
          icon="pi pi-check"
          class="p-button-primary"
          @click="applyTimeToAllDays"
        />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="editApplyAllTimeDialog.visible"
      header="すべての曜日に同じ時間を設定"
      :modal="true"
      class="p-fluid"
      :style="{ width: '450px' }"
    >
      <div class="field">
        <label for="edit-all-opening-time">営業開始時間</label>
        <Dropdown
          id="edit-all-opening-time"
          v-model="editApplyAllTimeDialog.opening_time"
          :options="timeOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="開始時間を選択"
        />
      </div>

      <div class="field">
        <label for="edit-all-closing-time">営業終了時間</label>
        <Dropdown
          id="edit-all-closing-time"
          v-model="editApplyAllTimeDialog.closing_time"
          :options="timeOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="終了時間を選択"
        />
      </div>

      <template #footer>
        <Button
          label="キャンセル"
          icon="pi pi-times"
          class="p-button-text"
          @click="editApplyAllTimeDialog.visible = false"
        />
        <Button
          label="適用"
          icon="pi pi-check"
          class="p-button-primary"
          @click="applyTimeToAllDaysEdit"
        />
      </template>
    </Dialog>

    <Toast />
  </div>
</template>


<script>
import { ref, reactive, computed, onMounted } from "vue";
import { useStore } from "vuex";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import InputMask from "primevue/inputmask";
import InputNumber from "primevue/inputnumber";
import Divider from "primevue/divider";
import Textarea from "primevue/textarea";
import Card from "primevue/card";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import TabView from "primevue/tabview";
import TabPanel from "primevue/tabpanel";
import Calendar from "primevue/calendar";
import ProgressSpinner from "primevue/progressspinner";
import Message from "primevue/message";
import Toast from "primevue/toast";
import InputText from "primevue/inputtext";
import Checkbox from "primevue/checkbox";
import Tag from "primevue/tag";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import AutoComplete from "primevue/autocomplete";
import { formatDateToJP } from "@/utils/date";

export default {
  name: "StoreManagement",
  components: {
    InputMask,
    InputNumber,
    Divider,
    Textarea,
    Card,
    Button,
    Dialog,
    TabView,
    TabPanel,
    Calendar,
    ProgressSpinner,
    Message,
    Toast,
    InputText,
    Checkbox,
    Tag,
    DataTable,
    Column,
    AutoComplete,
  },

  setup() {
    const store = useStore();
    const toast = useToast();
    const confirm = useConfirm();

    const loading = ref(true);
    const saving = ref(false);
    const submitted = ref(false);
    const stores = ref([]);
    const newZipCode = ref("");
    const editZipCode = ref("");
    const selectedSpecificDate = ref(null);
    const selectedEditSpecificDate = ref(null);
    const areaOptions = ref([]);
    const filteredAreas = ref([]);

    const isAdmin = computed(() => {
      return store.getters["auth/isAdmin"];
    });

    const timeOptions = computed(() => {
      const options = [];
      for (let hour = 0; hour < 24; hour++) {
        for (let minute of ["00", "30"]) {
          const formattedHour = hour.toString().padStart(2, "0");
          options.push({
            label: `${formattedHour}:${minute}`,
            value: `${formattedHour}:${minute}`,
          });
        }
      }
      return options;
    });

    const newStoreDialog = reactive({
      visible: false,
      store: {
        name: "",
        address: "",
        phone: "",
        postal_code: "",
        area: "",
        opening_time: "09:00",
        closing_time: "18:00",
      },
      businessHours: {},
      specificDates: [],
      dayRequirements: {},
    });

    const storeDialog = reactive({
      visible: false,
      store: {
        id: null,
        name: "",
        address: "",
        phone: "",
        postal_code: "",
        area: "",
        opening_time: "09:00",
        closing_time: "18:00",
      },
      businessHours: {},
      specificDates: [],
      dayRequirements: {},
    });

    const businessHoursDialog = reactive({
      visible: false,
      store: null,
      specificDates: [],
    });

    const applyAllTimeDialog = reactive({
      visible: false,
      opening_time: "09:00",
      closing_time: "18:00",
    });

    const editApplyAllTimeDialog = reactive({
      visible: false,
      opening_time: "09:00",
      closing_time: "18:00",
    });

    const daysOfWeek = [
      { value: 0, label: "日" },
      { value: 1, label: "月" },
      { value: 2, label: "火" },
      { value: 3, label: "水" },
      { value: 4, label: "木" },
      { value: 5, label: "金" },
      { value: 6, label: "土" },
    ];

    const fetchStores = async () => {
      loading.value = true;
      try {
        const response = await store.dispatch("store/fetchStores");
        stores.value = response;

        await generateAreaOptions();

        const detailPromises = stores.value.map((storeItem) =>
          loadStoreDetails(storeItem.id)
        );

        await Promise.all(detailPromises);
      } catch (error) {
        console.error("店舗データの取得に失敗しました:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "店舗データの取得に失敗しました",
          life: 3000,
        });
      } finally {
        loading.value = false;
      }
    };

    const generateAreaOptions = async () => {
      try {
        const currentUser = store.getters["auth/currentUser"];
        const effectiveUser = store.getters["auth/effectiveUser"];
        const isAdminUser = store.getters["auth/isAdmin"];
        const isImpersonating = store.getters["auth/isImpersonating"];

        console.log("エリア候補生成 - ユーザー情報:", {
          currentUser: currentUser?.id,
          effectiveUser: effectiveUser?.id,
          isAdmin: isAdminUser,
          isImpersonating,
        });

        const uniqueAreas = new Set();

        if (
          isAdminUser &&
          (!isImpersonating ||
            (isImpersonating && currentUser?.role === "admin"))
        ) {
          stores.value.forEach((storeItem) => {
            if (storeItem.area && storeItem.area.trim()) {
              uniqueAreas.add(storeItem.area.trim());
            }
          });

          console.log("管理者権限 - 全エリアを表示:", Array.from(uniqueAreas));
        } else {
          let ownerId = effectiveUser?.id;
          if (
            effectiveUser?.role === "staff" &&
            effectiveUser?.parent_user_id
          ) {
            ownerId = effectiveUser.parent_user_id;
          }

          console.log("権限フィルタリング - オーナーID:", ownerId);

          stores.value.forEach((storeItem) => {
            console.log("店舗チェック:", {
              storeId: storeItem.id,
              storeName: storeItem.name,
              storeOwnerId: storeItem.owner_id,
              storeArea: storeItem.area,
              match: storeItem.owner_id === ownerId,
            });

            if (
              storeItem.owner_id === ownerId &&
              storeItem.area &&
              storeItem.area.trim()
            ) {
              uniqueAreas.add(storeItem.area.trim());
            }
          });

          console.log("権限フィルタリング後のエリア:", Array.from(uniqueAreas));
        }

        areaOptions.value = Array.from(uniqueAreas).sort();
        filteredAreas.value = areaOptions.value;

        console.log("最終的なエリア候補:", areaOptions.value);
      } catch (error) {
        console.error("エリア候補の生成に失敗しました:", error);
        areaOptions.value = [];
        filteredAreas.value = [];
      }
    };

    const openNew = () => {
      submitted.value = false;
      newStoreDialog.store = {
        name: "",
        address: "",
        phone: "",
        postal_code: "",
        area: "",
        opening_time: "09:00",
        closing_time: "18:00",
      };
      newZipCode.value = "";
      selectedSpecificDate.value = null;
      newStoreDialog.specificDates = [];

      generateAreaOptions();

      newStoreDialog.businessHours = {};
      daysOfWeek.forEach((day) => {
        newStoreDialog.businessHours[day.value] = {
          is_closed: day.value === 0,
          opening_time: "09:00",
          closing_time: "18:00",
        };
      });

      newStoreDialog.dayRequirements = {};
      daysOfWeek.forEach((day) => {
        if (day.value !== 0) {
          newStoreDialog.dayRequirements[day.value] = [
            {
              start_time: "09:00",
              end_time: "18:00",
              required_staff_count: 2,
            },
          ];
        } else {
          newStoreDialog.dayRequirements[day.value] = [];
        }
      });

      newStoreDialog.visible = true;
    };

    const editStore = async (storeData) => {
      submitted.value = false;

      loading.value = true;

      try {
        storeDialog.store = { ...storeData };

        if (storeData.postal_code) {
          editZipCode.value = storeData.postal_code.replace(/-/g, "");
        } else {
          editZipCode.value = "";
        }

        selectedEditSpecificDate.value = null;

        storeDialog.businessHours = {};
        storeDialog.specificDates = [];
        storeDialog.dayRequirements = {};

        daysOfWeek.forEach((day) => {
          storeDialog.businessHours[day.value] = {
            is_closed: false,
            opening_time: "09:00",
            closing_time: "18:00",
          };

          storeDialog.dayRequirements[day.value] = [];
        });

        await generateAreaOptions();

        console.log("店舗ID:", storeData.id, "のデータを取得中...");

        await loadStoreBusinessHours(storeData.id);
        await loadStoreClosedDays(storeData.id);
        await loadStaffRequirements(storeData.id);

        console.log("読み込み完了 - storeDialog:", {
          store: storeDialog.store,
          businessHours: storeDialog.businessHours,
          specificDates: storeDialog.specificDates,
          dayRequirements: storeDialog.dayRequirements,
        });

        storeDialog.visible = true;
      } catch (error) {
        console.error("店舗データ読み込みエラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "店舗データの読み込みに失敗しました",
          life: 3000,
        });
      } finally {
        loading.value = false;
      }
    };

    const searchArea = (event) => {
      const query = event.query.toLowerCase();

      console.log("エリア検索:", {
        query,
        availableAreas: areaOptions.value,
        inputValue: query,
      });

      if (!query || query.trim() === "") {
        filteredAreas.value = [...areaOptions.value];
      } else {
        filteredAreas.value = areaOptions.value.filter((area) =>
          area.toLowerCase().includes(query)
        );
      }

      console.log("フィルタリング結果:", filteredAreas.value);
    };

    const validateStoreName = (name, excludeId = null) => {
      const trimmedName = name.trim();
      return stores.value.some((store) => {
        if (excludeId && store.id === excludeId) {
          return false;
        }
        return store.name.trim().toLowerCase() === trimmedName.toLowerCase();
      });
    };

    const loadStoreBusinessHours = async (storeId) => {
      try {
        let businessHours = [];
        try {
          businessHours = await store.dispatch(
            "store/fetchStoreBusinessHours",
            storeId
          );
        } catch (error) {
          console.error("営業時間データの取得に失敗しました:", error);

          businessHours = [];
          for (let i = 0; i < 7; i++) {
            businessHours.push({
              day_of_week: i,
              is_closed: i === 0,
              opening_time: "09:00",
              closing_time: "18:00",
            });
          }
        }

        storeDialog.businessHours = {};

        businessHours.forEach((hour) => {
          if (hour && hour.day_of_week >= 0 && hour.day_of_week <= 6) {
            storeDialog.businessHours[hour.day_of_week] = {
              is_closed: !!hour.is_closed,
              opening_time: formatTime(hour.opening_time) || "09:00",
              closing_time: formatTime(hour.closing_time) || "18:00",
              day_of_week: hour.day_of_week,
            };
          }
        });

        daysOfWeek.forEach((day) => {
          if (!storeDialog.businessHours[day.value]) {
            storeDialog.businessHours[day.value] = {
              is_closed: day.value === 0,
              opening_time: "09:00",
              closing_time: "18:00",
              day_of_week: day.value,
            };
          }
        });
      } catch (error) {
        console.error("営業時間データの処理中にエラーが発生しました:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "営業時間データの取得に失敗しました",
          life: 3000,
        });

        storeDialog.businessHours = {};
        daysOfWeek.forEach((day) => {
          storeDialog.businessHours[day.value] = {
            is_closed: day.value === 0,
            opening_time: "09:00",
            closing_time: "18:00",
            day_of_week: day.value,
          };
        });
      }
    };

    const loadStoreDetails = async (storeId) => {
      try {
        const businessHours = await store.dispatch(
          "store/fetchStoreBusinessHours",
          storeId
        );

        const storeIndex = stores.value.findIndex((s) => s.id === storeId);
        if (storeIndex !== -1) {
          const businessHoursMap = {};

          if (Array.isArray(businessHours)) {
            businessHours.forEach((hour) => {
              if (
                hour &&
                typeof hour.day_of_week === "number" &&
                hour.day_of_week >= 0 &&
                hour.day_of_week <= 6
              ) {
                businessHoursMap[hour.day_of_week] = {
                  ...hour,
                  day_of_week: hour.day_of_week,
                  is_closed: !!hour.is_closed,
                  opening_time: formatTime(hour.opening_time) || "09:00",
                  closing_time: formatTime(hour.closing_time) || "18:00",
                };
              }
            });
          }

          daysOfWeek.forEach((day) => {
            if (!businessHoursMap[day.value]) {
              businessHoursMap[day.value] = {
                day_of_week: day.value,
                is_closed: day.value === 0,
                opening_time: "09:00",
                closing_time: "18:00",
              };
            }
          });

          stores.value[storeIndex] = {
            ...stores.value[storeIndex],
            businessHours: businessHoursMap,
          };
        }

        const closedDays = await store.dispatch(
          "store/fetchStoreClosedDays",
          storeId
        );

        if (storeIndex !== -1) {
          stores.value[storeIndex] = {
            ...stores.value[storeIndex],
            closedDays: closedDays,
          };
        }
      } catch (error) {
        console.error(`店舗ID ${storeId} の詳細情報取得エラー:`, error);
      }
    };

    const getClosedDaysText = (storeId) => {
      const storeItem = stores.value.find((s) => s.id === storeId);
      if (!storeItem || !storeItem.businessHours) {
        return "情報なし";
      }

      const closedDays = [];
      for (const [dayIndex, hours] of Object.entries(storeItem.businessHours)) {
        if (hours.is_closed) {
          const day = daysOfWeek.find((d) => d.value === parseInt(dayIndex));
          if (day) {
            closedDays.push(day.label);
          }
        }
      }

      return closedDays.length > 0 ? closedDays.join("・") + "曜日" : "なし";
    };

    const getSpecialClosedDaysText = (storeId) => {
      const storeItem = stores.value.find((s) => s.id === storeId);
      if (!storeItem || !storeItem.closedDays) {
        return "";
      }

      const specialDates = storeItem.closedDays
        .filter((day) => day.specific_date)
        .map((day) => formatDate(new Date(day.specific_date)));

      return specialDates.length > 0 ? specialDates.join(", ") : "";
    };

    const loadStoreClosedDays = async (storeId) => {
      try {
        const closedDays = await store.dispatch(
          "store/fetchStoreClosedDays",
          storeId
        );

        console.log("取得した定休日データ:", closedDays);

        storeDialog.specificDates = [];

        if (closedDays && closedDays.length > 0) {
          closedDays.forEach((day) => {
            if (day.specific_date) {
              storeDialog.specificDates.push(new Date(day.specific_date));
            }
          });
        }

        console.log("変換後の定休日データ:", storeDialog.specificDates);
      } catch (error) {
        console.error("定休日データの取得に失敗しました:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "定休日データの取得に失敗しました",
          life: 3000,
        });
      }
    };

    const loadStaffRequirements = async (storeId) => {
      try {
        const requirements = await store.dispatch(
          "store/fetchStoreStaffRequirements",
          storeId
        );

        console.log("取得した人員要件データ:", requirements);

        storeDialog.dayRequirements = {};
        daysOfWeek.forEach((day) => {
          storeDialog.dayRequirements[day.value] = [];
        });

        if (requirements && requirements.length > 0) {
          requirements.forEach((req) => {
            if (
              req.day_of_week !== null &&
              req.day_of_week >= 0 &&
              req.day_of_week <= 6
            ) {
              if (!storeDialog.dayRequirements[req.day_of_week]) {
                storeDialog.dayRequirements[req.day_of_week] = [];
              }

              storeDialog.dayRequirements[req.day_of_week].push({
                start_time: formatTime(req.start_time),
                end_time: formatTime(req.end_time),
                required_staff_count: req.required_staff_count,
              });
            }
          });
        }

        daysOfWeek.forEach((day) => {
          if (storeDialog.dayRequirements[day.value].length === 0) {
            storeDialog.dayRequirements[day.value].push({
              start_time: "09:00",
              end_time: "18:00",
              required_staff_count: 2,
            });
          }
        });

        console.log("変換後の人員要件データ:", storeDialog.dayRequirements);
      } catch (error) {
        console.error("人員要件データの取得に失敗しました:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "人員要件データの取得に失敗しました",
          life: 3000,
        });
      }
    };

    const hideNewDialog = () => {
      newStoreDialog.visible = false;
      submitted.value = false;
    };

    const hideDialog = () => {
      storeDialog.visible = false;
      submitted.value = false;
    };

    const showApplyAllTimeDialog = () => {
      applyAllTimeDialog.opening_time = "09:00";
      applyAllTimeDialog.closing_time = "18:00";
      applyAllTimeDialog.visible = true;
    };

    const showEditApplyAllTimeDialog = () => {
      editApplyAllTimeDialog.opening_time = "09:00";
      editApplyAllTimeDialog.closing_time = "18:00";
      editApplyAllTimeDialog.visible = true;
    };

    const applyTimeToAllDays = () => {
      daysOfWeek.forEach((day) => {
        if (!newStoreDialog.businessHours[day.value].is_closed) {
          newStoreDialog.businessHours[day.value].opening_time =
            applyAllTimeDialog.opening_time;
          newStoreDialog.businessHours[day.value].closing_time =
            applyAllTimeDialog.closing_time;
        }
      });

      applyAllTimeDialog.visible = false;

      toast.add({
        severity: "success",
        summary: "設定完了",
        detail: "すべての営業日に同じ時間を設定しました",
        life: 2000,
      });
    };

    const applyTimeToAllDaysEdit = () => {
      daysOfWeek.forEach((day) => {
        if (!storeDialog.businessHours[day.value].is_closed) {
          storeDialog.businessHours[day.value].opening_time =
            editApplyAllTimeDialog.opening_time;
          storeDialog.businessHours[day.value].closing_time =
            editApplyAllTimeDialog.closing_time;
        }
      });

      editApplyAllTimeDialog.visible = false;

      toast.add({
        severity: "success",
        summary: "設定完了",
        detail: "すべての営業日に同じ時間を設定しました",
        life: 2000,
      });
    };

    const getRequirementsForDayNew = (dayValue) => {
      if (!newStoreDialog.dayRequirements[dayValue]) {
        newStoreDialog.dayRequirements[dayValue] = [];
      }
      return newStoreDialog.dayRequirements[dayValue];
    };

    const getRequirementsForDayEdit = (dayValue) => {
      if (!storeDialog.dayRequirements[dayValue]) {
        storeDialog.dayRequirements[dayValue] = [];
      }
      return storeDialog.dayRequirements[dayValue];
    };

    const addRequirementNew = (dayValue) => {
      if (!newStoreDialog.dayRequirements[dayValue]) {
        newStoreDialog.dayRequirements[dayValue] = [];
      }

      newStoreDialog.dayRequirements[dayValue].push({
        start_time: "09:00",
        end_time: "18:00",
        required_staff_count: 2,
      });
    };

    const addRequirementEdit = (dayValue) => {
      if (!storeDialog.dayRequirements[dayValue]) {
        storeDialog.dayRequirements[dayValue] = [];
      }

      storeDialog.dayRequirements[dayValue].push({
        start_time: "09:00",
        end_time: "18:00",
        required_staff_count: 2,
      });
    };

    const removeRequirementNew = (dayValue, index) => {
      if (newStoreDialog.dayRequirements[dayValue]) {
        newStoreDialog.dayRequirements[dayValue].splice(index, 1);
      }
    };

    const removeRequirementEdit = (dayValue, index) => {
      if (storeDialog.dayRequirements[dayValue]) {
        storeDialog.dayRequirements[dayValue].splice(index, 1);
      }
    };

    const addSpecificDateNew = () => {
      if (!selectedSpecificDate.value) return;

      const exists = newStoreDialog.specificDates.some(
        (date) => formatDate(date) === formatDate(selectedSpecificDate.value)
      );

      if (exists) {
        toast.add({
          severity: "warn",
          summary: "重複",
          detail: "この日付は既に追加されています",
          life: 2000,
        });
        return;
      }

      newStoreDialog.specificDates.push(new Date(selectedSpecificDate.value));
      selectedSpecificDate.value = null;
    };

    const addSpecificDateEdit = () => {
      if (!selectedEditSpecificDate.value) return;

      const exists = storeDialog.specificDates.some(
        (date) =>
          formatDate(date) === formatDate(selectedEditSpecificDate.value)
      );

      if (exists) {
        toast.add({
          severity: "warn",
          summary: "重複",
          detail: "この日付は既に追加されています",
          life: 2000,
        });
        return;
      }

      storeDialog.specificDates.push(new Date(selectedEditSpecificDate.value));
      selectedEditSpecificDate.value = null;
    };

    const removeSpecificDateNew = (index) => {
      newStoreDialog.specificDates.splice(index, 1);
    };

    const removeSpecificDateEdit = (index) => {
      storeDialog.specificDates.splice(index, 1);
    };

    const saveNewStore = async () => {
      submitted.value = true;

      if (!newStoreDialog.store.name.trim()) {
        toast.add({
          severity: "error",
          summary: "入力エラー",
          detail: "店舗名は必須項目です",
          life: 3000,
        });
        return;
      }

      if (validateStoreName(newStoreDialog.store.name)) {
        toast.add({
          severity: "error",
          summary: "入力エラー",
          detail: "同じ名前の店舗が既に存在します",
          life: 3000,
        });
        return;
      }

      saving.value = true;

      try {
        if (newZipCode.value) {
          newStoreDialog.store.postal_code = newZipCode.value.replace(
            /(\d{3})(\d{4})/,
            "$1-$2"
          );
        }

        const storeData = {
          name: newStoreDialog.store.name.trim(),
          address: newStoreDialog.store.address || null,
          phone: newStoreDialog.store.phone || null,
          email: newStoreDialog.store.email || null,
          opening_time: newStoreDialog.store.opening_time,
          closing_time: newStoreDialog.store.closing_time,
          postal_code: newStoreDialog.store.postal_code || null,
          area: newStoreDialog.store.area || null,
        };

        console.log("送信する店舗基本情報:", storeData);
        const createdStore = await store.dispatch(
          "store/createStore",
          storeData
        );
        console.log("作成された店舗情報:", createdStore);

        if (!createdStore || !createdStore.id) {
          throw new Error("店舗情報の作成に失敗しました");
        }

        const storeId = parseInt(createdStore.id, 10);

        const businessHoursData = [];
        daysOfWeek.forEach((day) => {
          businessHoursData.push({
            store_id: storeId,
            day_of_week: parseInt(day.value, 10),
            is_closed: newStoreDialog.businessHours[day.value].is_closed,
            opening_time: newStoreDialog.businessHours[day.value].opening_time,
            closing_time: newStoreDialog.businessHours[day.value].closing_time,
          });
        });

        console.log("送信する営業時間データ:", businessHoursData);
        await store.dispatch("store/saveBusinessHours", {
          storeId: storeId,
          businessHours: businessHoursData,
        });

        if (newStoreDialog.specificDates.length > 0) {
          const closedDaysData = newStoreDialog.specificDates.map((date) => ({
            store_id: storeId,
            specific_date: formatDate(date),
          }));

          console.log("送信する定休日データ:", closedDaysData);
          await store.dispatch("store/saveClosedDays", {
            storeId: storeId,
            closedDays: closedDaysData,
          });
        }

        const requirementsData = [];
        daysOfWeek.forEach((day) => {
          if (
            newStoreDialog.dayRequirements[day.value] &&
            newStoreDialog.dayRequirements[day.value].length > 0
          ) {
            newStoreDialog.dayRequirements[day.value].forEach((req) => {
              requirementsData.push({
                store_id: storeId,
                day_of_week: parseInt(day.value, 10),
                start_time: req.start_time,
                end_time: req.end_time,
                required_staff_count: parseInt(req.required_staff_count, 10),
              });
            });
          }
        });

        if (requirementsData.length > 0) {
          console.log("送信する人員要件データ:", requirementsData);
          await store.dispatch("store/saveStaffRequirements", {
            storeId: storeId,
            requirements: requirementsData,
          });
        }

        await fetchStores();

        newStoreDialog.visible = false;
        submitted.value = false;

        toast.add({
          severity: "success",
          summary: "保存完了",
          detail: `${createdStore.name}を登録しました`,
          life: 3000,
        });
      } catch (error) {
        console.error("店舗登録エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "店舗の登録に失敗しました: " + error.message,
          life: 3000,
        });
      } finally {
        saving.value = false;
      }
    };

    const saveStore = async () => {
      submitted.value = true;

      if (!storeDialog.store.name.trim()) {
        toast.add({
          severity: "error",
          summary: "入力エラー",
          detail: "店舗名は必須項目です",
          life: 3000,
        });
        return;
      }

      if (validateStoreName(storeDialog.store.name, storeDialog.store.id)) {
        toast.add({
          severity: "error",
          summary: "入力エラー",
          detail: "同じ名前の店舗が既に存在します",
          life: 3000,
        });
        return;
      }

      saving.value = true;

      try {
        if (editZipCode.value) {
          storeDialog.store.postal_code = editZipCode.value.replace(
            /(\d{3})(\d{4})/,
            "$1-$2"
          );
        }

        const storeDataToUpdate = {
          id: storeDialog.store.id,
          name: storeDialog.store.name.trim(),
          address: storeDialog.store.address || null,
          phone: storeDialog.store.phone || null,
          email: storeDialog.store.email || null,
          opening_time: storeDialog.store.opening_time,
          closing_time: storeDialog.store.closing_time,
          postal_code: storeDialog.store.postal_code || null,
          area: storeDialog.store.area || null,
        };

        console.log("更新する店舗情報:", storeDataToUpdate);
        let savedStore = await store.dispatch(
          "store/updateStore",
          storeDataToUpdate
        );
        let storeId = parseInt(savedStore.id, 10);

        if (!storeId) {
          throw new Error("店舗IDが取得できませんでした");
        }

        const businessHoursData = [];
        daysOfWeek.forEach((day) => {
          businessHoursData.push({
            store_id: storeId,
            day_of_week: parseInt(day.value, 10),
            is_closed: storeDialog.businessHours[day.value].is_closed,
            opening_time: storeDialog.businessHours[day.value].opening_time,
            closing_time: storeDialog.businessHours[day.value].closing_time,
          });
        });

        console.log("更新する営業時間データ:", businessHoursData);
        await store.dispatch("store/saveBusinessHours", {
          storeId: storeId,
          businessHours: businessHoursData,
        });

        const closedDaysData = storeDialog.specificDates.map((date) => ({
          store_id: storeId,
          specific_date: formatDate(date),
        }));

        console.log("更新する定休日データ:", closedDaysData);
        await store.dispatch("store/saveClosedDays", {
          storeId: storeId,
          closedDays: closedDaysData,
        });

        const requirementsData = [];
        daysOfWeek.forEach((day) => {
          if (
            storeDialog.dayRequirements[day.value] &&
            storeDialog.dayRequirements[day.value].length > 0
          ) {
            storeDialog.dayRequirements[day.value].forEach((req) => {
              requirementsData.push({
                store_id: storeId,
                day_of_week: parseInt(day.value, 10),
                start_time: req.start_time,
                end_time: req.end_time,
                required_staff_count: parseInt(req.required_staff_count, 10),
              });
            });
          }
        });

        console.log("更新する人員要件データ:", requirementsData);
        await store.dispatch("store/saveStaffRequirements", {
          storeId: storeId,
          requirements: requirementsData,
        });

        await fetchStores();

        storeDialog.visible = false;
        submitted.value = false;

        toast.add({
          severity: "success",
          summary: "保存完了",
          detail: `${storeDialog.store.name}を更新しました`,
          life: 3000,
        });
      } catch (error) {
        console.error("店舗更新エラー:", error);
        console.error("詳細エラー情報:", {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          stack: error.stack,
        });

        let errorMessage = "店舗の更新に失敗しました";
        if (error.response?.data?.message) {
          errorMessage = error.response.data.message + ": " + error.message;
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

    const confirmDeleteStore = (storeData) => {
      confirm.require({
        message: `${storeData.name}を削除してもよろしいですか？`,
        header: "店舗削除の確認",
        icon: "pi pi-exclamation-triangle",
        acceptClass: "p-button-danger",
        accept: () => deleteStore(storeData),
      });
    };

    const deleteStore = async (storeData) => {
      try {
        await store.dispatch("store/deleteStore", storeData.id);

        await fetchStores();

        toast.add({
          severity: "success",
          summary: "削除完了",
          detail: `${storeData.name}を削除しました`,
          life: 3000,
        });
      } catch (error) {
        console.error("店舗削除エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "店舗の削除に失敗しました",
          life: 3000,
        });
      }
    };

    const searchWithNewZip = async () => {
      if (!newZipCode.value || !/^\d{7}$/.test(newZipCode.value)) {
        toast.add({
          severity: "warn",
          summary: "形式エラー",
          detail: "郵便番号はハイフンなしの7桁の数字で入力してください",
          life: 3000,
        });
        return;
      }

      try {
        const response = await fetch(
          `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${newZipCode.value}`
        );
        const data = await response.json();

        if (data.results && data.results.length > 0) {
          const result = data.results[0];
          const fullAddress = `${result.address1}${result.address2}${result.address3}`;

          newStoreDialog.store.address = fullAddress;
          newStoreDialog.store.postal_code = `${newZipCode.value.slice(
            0,
            3
          )}-${newZipCode.value.slice(3)}`;

          toast.add({
            severity: "success",
            summary: "成功",
            detail: "住所を取得しました",
            life: 2000,
          });
        } else {
          toast.add({
            severity: "error",
            summary: "検索失敗",
            detail: "該当する住所が見つかりません",
            life: 3000,
          });
        }
      } catch (error) {
        console.error("住所取得エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "住所の取得に失敗しました",
          life: 3000,
        });
      }
    };

    const searchWithEditZip = async () => {
      if (!editZipCode.value || !/^\d{7}$/.test(editZipCode.value)) {
        toast.add({
          severity: "warn",
          summary: "形式エラー",
          detail: "郵便番号はハイフンなしの7桁の数字で入力してください",
          life: 3000,
        });
        return;
      }

      try {
        const response = await fetch(
          `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${editZipCode.value}`
        );
        const data = await response.json();

        if (data.results && data.results.length > 0) {
          const result = data.results[0];
          const fullAddress = `${result.address1}${result.address2}${result.address3}`;

          storeDialog.store.address = fullAddress;
          storeDialog.store.postal_code = `${editZipCode.value.slice(
            0,
            3
          )}-${editZipCode.value.slice(3)}`;

          toast.add({
            severity: "success",
            summary: "成功",
            detail: "住所を取得しました",
            life: 2000,
          });
        } else {
          toast.add({
            severity: "error",
            summary: "検索失敗",
            detail: "該当する住所が見つかりません",
            life: 3000,
          });
        }
      } catch (error) {
        console.error("住所取得エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "住所の取得に失敗しました",
          life: 3000,
        });
      }
    };

    const formatDate = (date) => {
      if (!date) return "";

      const d = date instanceof Date ? date : new Date(date);

      if (isNaN(d.getTime())) return "";

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");

      return `${year}-${month}-${day}`;
    };

    const formatTime = (time) => {
      if (!time) return "00:00";

      if (typeof time === "string") {
        if (time.includes(":")) {
          const parts = time.split(":");
          if (parts.length >= 2) {
            const hours = parts[0].padStart(2, "0");
            const minutes = parts[1].padStart(2, "0");
            return `${hours}:${minutes}`;
          }
        }

        return time;
      }

      if (time instanceof Date) {
        const hours = time.getHours().toString().padStart(2, "0");
        const minutes = time.getMinutes().toString().padStart(2, "0");
        return `${hours}:${minutes}`;
      }

      return "00:00";
    };

    const showBusinessHoursDialog = async (storeData) => {
      businessHoursDialog.store = storeData;
      businessHoursDialog.specificDates = [];

      if (storeData.id) {
        try {
          const closedDays = await store.dispatch(
            "store/fetchStoreClosedDays",
            storeData.id
          );

          businessHoursDialog.specificDates = closedDays
            .filter((day) => day.specific_date)
            .map((day) => new Date(day.specific_date));
        } catch (error) {
          console.error("特別定休日データの取得に失敗しました:", error);
        }
      }

      businessHoursDialog.visible = true;
    };

    onMounted(() => {
      fetchStores();
    });

    return {
      loading,
      saving,
      submitted,
      stores,
      newZipCode,
      editZipCode,
      selectedSpecificDate,
      selectedEditSpecificDate,
      newStoreDialog,
      storeDialog,
      applyAllTimeDialog,
      editApplyAllTimeDialog,
      businessHoursDialog,
      daysOfWeek,
      isAdmin,
      timeOptions,
      areaOptions,
      filteredAreas,
      generateAreaOptions,
      openNew,
      editStore,
      hideNewDialog,
      hideDialog,
      showApplyAllTimeDialog,
      showEditApplyAllTimeDialog,
      applyTimeToAllDays,
      applyTimeToAllDaysEdit,
      saveNewStore,
      saveStore,
      confirmDeleteStore,
      deleteStore,
      searchWithNewZip,
      searchWithEditZip,
      addSpecificDateNew,
      addSpecificDateEdit,
      removeSpecificDateNew,
      removeSpecificDateEdit,
      getRequirementsForDayNew,
      getRequirementsForDayEdit,
      addRequirementNew,
      addRequirementEdit,
      removeRequirementNew,
      removeRequirementEdit,
      formatDate,
      formatTime,
      getClosedDaysText,
      getSpecialClosedDaysText,
      loadStoreDetails,
      showBusinessHoursDialog,
      searchArea,
      validateStoreName,
    };
  },
};
</script>

<style scoped>
.store-management {
  padding: 1rem;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
}

.page-header {
  margin-bottom: 1rem;
  flex-shrink: 0;
}

.page-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  gap: 1rem;
  flex-shrink: 0;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow: visible;
}

.search-container {
  flex: 1;
  max-width: 400px;
  min-width: 200px;
}

.actions {
  flex-shrink: 0;
  white-space: nowrap;
}

.table-container {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  gap: 1rem;
}

.loading-text {
  color: var(--text-color-secondary);
  font-size: 1rem;
}

.empty-message {
  padding: 2rem;
}

.message-content {
  display: flex;
  align-items: center;
}

.store-name-cell {
  font-weight: 500;
  color: var(--text-color);
}

.special-closed-days {
  font-size: 0.8rem;
  color: var(--text-color-secondary);
  margin-top: 0.25rem;
}

.special-closed-label {
  font-weight: 500;
}

.action-buttons {
  display: flex;
  gap: 0.25rem;
  justify-content: center;
}

.store-dialog {
  max-height: 90vh;
}

:deep(.store-dialog .p-dialog) {
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

:deep(.store-dialog .p-dialog-content) {
  flex: 1;
  overflow: hidden;
  padding: 0;
}

.dialog-content {
  height: 60vh;
  min-height: 400px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.full-height-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
}

:deep(.full-height-tabs .p-tabview-panels) {
  flex: 1;
  overflow: hidden;
}

:deep(.full-height-tabs .p-tabview-panel) {
  height: 100%;
  overflow: hidden;
}

.tab-content {
  height: 100%;
  overflow-y: auto;
  padding: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 1rem;
}

.field label {
  font-weight: 500;
  color: var(--text-color);
  font-size: 0.9rem;
}

.required-mark {
  color: var(--red-500);
}

.postal-row {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
}

.zip-input {
  flex: 1;
}

.form-text {
  font-size: 0.8rem;
  color: var(--text-color-secondary);
  margin-top: 0.25rem;
}

.business-hours-item {
  padding: 1rem;
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  background-color: var(--surface-ground);
  margin-bottom: 1rem;
}

.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.day-header h5 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-color);
}

.day-closed-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.day-closed-toggle label {
  font-size: 0.9rem;
  color: var(--text-color-secondary);
}

.time-inputs {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 1rem;
  align-items: end;
}

.time-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.time-field label {
  font-size: 0.8rem;
  color: var(--text-color-secondary);
}

.time-separator {
  font-size: 1.2rem;
  font-weight: 500;
  color: var(--text-color-secondary);
  padding-bottom: 0.5rem;
}

.closed-message {
  text-align: center;
  color: var(--text-color-secondary);
  font-style: italic;
  padding: 1rem;
  background-color: var(--red-50);
  border-radius: 4px;
  border: 1px solid var(--red-200);
}

.business-hours-actions {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
}

.specific-dates {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.date-picker {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
}

.date-picker .p-calendar {
  flex: 1;
}

.selected-dates {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  min-height: 3rem;
  padding: 1rem;
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  background-color: var(--surface-ground);
}

.date-tag {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background-color: var(--blue-100);
  color: var(--blue-700);
  border-radius: 4px;
  font-size: 0.9rem;
  font-weight: 500;
}

.no-dates {
  color: var(--text-color-secondary);
  font-style: italic;
  align-self: center;
  margin: auto;
}

.section-title {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-color);
}

.day-requirements {
  margin-bottom: 2rem;
  padding: 1rem;
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  background-color: var(--surface-ground);
}

.day-title {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-color);
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--surface-border);
}

.requirement-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
  padding: 0.75rem;
  background-color: var(--surface-card);
  border-radius: 4px;
  border: 1px solid var(--surface-border);
}

.time-range {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.time-dropdown {
  min-width: 100px;
}

.staff-count {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 120px;
}

.staff-input {
  width: 120px !important;
}

.staff-unit {
  font-size: 0.9rem;
  color: var(--text-color-secondary);
}

.remove-button {
  flex-shrink: 0;
}

.add-requirement {
  display: flex;
  justify-content: center;
  margin-top: 0.5rem;
}

.time-band-add-button {
  width: 100%;
}

.business-hours-detail {
  padding: 1rem 0;
}

.business-hours-detail h4 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-color);
}

.day-hours-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  border: 1px solid var(--surface-border);
  border-radius: 4px;
  background-color: var(--surface-ground);
}

.day-hours-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.day-name {
  font-weight: 500;
  color: var(--text-color);
  min-width: 60px;
}

.day-status {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
}

.day-status.open {
  background-color: var(--green-100);
  color: var(--green-700);
}

.day-status.closed {
  background-color: var(--red-100);
  color: var(--red-700);
}

.day-hours-time {
  font-family: monospace;
  font-size: 0.9rem;
  color: var(--text-color-secondary);
  margin-top: 0.25rem;
}

.special-closed-days-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.special-date-tag {
  padding: 0.25rem 0.5rem;
  background-color: var(--red-100);
  color: var(--red-700);
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
}

.no-special-days {
  color: var(--text-color-secondary);
  font-style: italic;
  text-align: center;
  padding: 1rem;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

:deep(.p-datatable) {
  height: 100%;
}

:deep(.p-datatable .p-datatable-wrapper) {
  overflow-x: auto;
  overflow-y: visible;
}

:deep(.p-datatable-thead > tr > th) {
  padding: 0.75rem;
  font-weight: 600;
}

:deep(.p-datatable-tbody > tr > td) {
  padding: 0.75rem;
}

@media (max-width: 1200px) {
  .store-management {
    padding: 0.5rem;
  }
  
  .toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }
  
  .search-container {
    max-width: none;
    width: 100%;
  }
  
  .store-dialog {
    width: 95vw !important;
    max-width: none !important;
  }
}

@media (max-width: 768px) {
  .store-management {
    padding: 0.25rem;
    height: 100vh;
  }
  
  :deep(.p-datatable-thead > tr > th),
  :deep(.p-datatable-tbody > tr > td) {
    padding: 0.5rem 0.25rem;
    font-size: 0.9rem;
  }
  
  .store-dialog {
    width: 100vw !important;
    height: 100vh !important;
    max-height: 100vh !important;
  }

  :deep(.store-dialog .p-dialog) {
    margin: 0;
    border-radius: 0;
    max-height: 100vh;
  }

  .dialog-content {
    height: calc(100vh - 120px);
  }

  .time-inputs {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .time-separator {
    display: none;
  }

  .requirement-item {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }

  .time-range {
    justify-content: space-between;
  }

  .staff-count {
    justify-content: center;
  }

  .postal-row {
    flex-direction: column;
    align-items: stretch;
  }

  .day-hours-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
}

@media (max-width: 480px) {
  .page-title {
    font-size: 1.25rem;
  }
  
  .store-management {
    padding: 0.125rem;
    height: 100vh;
  }

  .requirement-item {
    padding: 0.5rem;
  }

  .time-dropdown {
    min-width: 80px;
  }

  .staff-input {
    width: 80px !important;
  }
}

.staff-input :deep(.p-inputnumber) {
  min-width: 120px !important;
}

.staff-input :deep(.p-inputnumber-input) {
  min-width: 80px !important;
}

:deep(.p-tabview .p-tabview-panels) {
  padding: 0;
  height: calc(60vh - 100px);
  overflow: hidden;
}

:deep(.p-tabview .p-tabview-panel) {
  height: 100%;
  overflow-y: auto;
}

:deep(.p-autocomplete .p-autocomplete-dropdown) {
  border-left: 1px solid var(--surface-border);
}

:deep(.p-autocomplete-panel) {
  max-height: 200px;
}

:deep(.p-calendar .p-inputtext) {
  width: 100%;
}
</style>