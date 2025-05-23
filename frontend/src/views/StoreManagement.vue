<template>
  <div class="store-management">
    <h1 class="page-title">店舗管理</h1>

    <div class="toolbar">
      <Button
        label="新規店舗"
        icon="pi pi-plus"
        class="p-button-primary"
        @click="openNew"
        v-if="isAdmin"
      />
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

    <div v-else class="stores-container">
      <DataTable
        :value="stores"
        responsiveLayout="scroll"
        stripedRows
        :paginator="true"
        :rows="10"
        :rowsPerPageOptions="[5, 10, 20, 50]"
        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
        currentPageReportTemplate="全 {totalRecords} 件中 {first} 〜 {last} 件を表示"
        filterDisplay="menu"
        class="p-datatable-sm"
      >
        <Column field="name" header="店舗名" sortable style="min-width: 12rem">
          <template #body="{ data }">
            <div class="store-name-cell">{{ data.name }}</div>
          </template>
        </Column>

        <Column field="area" header="エリア" sortable style="min-width: 8rem">
          <template #body="{ data }">
            {{ data.area || "未設定" }}
          </template>
        </Column>

        <Column field="address" header="住所" sortable style="min-width: 16rem">
          <template #body="{ data }">
            {{ data.address || "未設定" }}
          </template>
        </Column>

        <Column
          field="phone"
          header="電話番号"
          sortable
          style="min-width: 10rem"
        >
          <template #body="{ data }">
            {{ data.phone || "未設定" }}
          </template>
        </Column>

        <Column
          field="closedDays"
          header="定休日"
          sortable
          style="min-width: 8rem"
        >
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

        <Column
          field="businessHours"
          header="営業時間"
          style="min-width: 10rem"
        >
          <template #body="{ data }">
            <Button
              icon="pi pi-clock"
              label="詳細表示"
              class="p-button-text p-button-sm"
              @click="showBusinessHoursDialog(data)"
            />
          </template>
        </Column>

        <Column header="操作" style="min-width: 10rem; width: 10rem">
          <template #body="{ data }">
            <div class="store-actions">
              <Button
                icon="pi pi-pencil"
                label="編集"
                class="p-button-outlined p-button-sm mr-2"
                @click="editStore(data)"
              />
              <Button
                icon="pi pi-trash"
                label="削除"
                class="p-button-outlined p-button-danger p-button-sm"
                @click="confirmDeleteStore(data)"
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
      :style="{ width: '800px' }"
    >
      <TabView>
        <TabPanel header="基本情報">
          <div class="store-form">
            <div class="form-section">
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

              <div class="field">
                <label for="new-address">住所</label>
                <Textarea
                  id="new-address"
                  v-model="newStoreDialog.store.address"
                  rows="3"
                />
              </div>

              <div class="field">
                <label for="new-phone">電話番号</label>
                <InputText
                  id="new-phone"
                  v-model="newStoreDialog.store.phone"
                />
              </div>
            </div>
          </div>
        </TabPanel>

        <TabPanel header="営業時間">
          <div class="store-form">
            <div class="form-section">
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
          </div>
        </TabPanel>

        <TabPanel header="特別定休日">
          <div class="store-form">
            <div class="form-section">
              <div class="field">
                <h4>特別定休日指定</h4>
                <div class="specific-dates">
                  <div class="date-picker">
                    <Calendar
                      v-model="selectedSpecificDate"
                      dateFormat="yy-mm-dd"
                      placeholder="日付を選択"
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
          </div>
        </TabPanel>

        <TabPanel header="人員要件">
          <div class="store-form">
            <div class="form-section">
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
          </div>
        </TabPanel>
      </TabView>

      <template #footer>
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
      :style="{ width: '800px' }"
    >
      <TabView>
        <TabPanel header="基本情報">
          <div class="store-form">
            <div class="form-section">
              <div class="field">
                <label for="edit-name"
                  >店舗名 <span class="required-mark">*</span></label
                >
                <InputText
                  id="edit-name"
                  v-model="storeDialog.store.name"
                  :class="{ 'p-invalid': submitted && !storeDialog.store.name }"
                />
                <small
                  v-if="submitted && !storeDialog.store.name"
                  class="p-error"
                  >店舗名は必須です</small
                >
              </div>

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

              <div class="field">
                <label for="edit-address">住所</label>
                <Textarea
                  id="edit-address"
                  v-model="storeDialog.store.address"
                  rows="3"
                />
              </div>

              <div class="field">
                <label for="edit-phone">電話番号</label>
                <InputText id="edit-phone" v-model="storeDialog.store.phone" />
              </div>
            </div>
          </div>
        </TabPanel>

        <TabPanel header="営業時間">
          <div class="store-form">
            <div class="form-section">
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
          </div>
        </TabPanel>

        <TabPanel header="特別定休日">
          <div class="store-form">
            <div class="form-section">
              <div class="field">
                <h4>特別定休日指定</h4>
                <div class="specific-dates">
                  <div class="date-picker">
                    <Calendar
                      v-model="selectedEditSpecificDate"
                      dateFormat="yy-mm-dd"
                      placeholder="日付を選択"
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
          </div>
        </TabPanel>

        <TabPanel header="人員要件">
          <div class="store-form">
            <div class="form-section">
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
          </div>
        </TabPanel>
      </TabView>

      <template #footer>
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
      </template>
    </Dialog>

    <Dialog
      v-model:visible="detailsDialog.visible"
      :header="
        detailsDialog.store ? detailsDialog.store.name + ' - 詳細' : '店舗詳細'
      "
      :modal="true"
      :style="{ width: '800px' }"
      class="store-dialog"
    >
      <div v-if="detailsDialog.store" class="store-details-content">
        <TabView>
          <TabPanel header="基本情報">
            <div class="detail-section">
              <div class="detail-item">
                <span class="detail-label">店舗名:</span>
                <span class="detail-value">{{ detailsDialog.store.name }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">エリア:</span>
                <span class="detail-value">{{
                  detailsDialog.store.area || "未設定"
                }}</span>
              </div>
              <div v-if="detailsDialog.store.postal_code" class="detail-item">
                <span class="detail-label">郵便番号:</span>
                <span class="detail-value">{{
                  detailsDialog.store.postal_code
                }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">住所:</span>
                <span class="detail-value">{{
                  detailsDialog.store.address || "未設定"
                }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">電話番号:</span>
                <span class="detail-value">{{
                  detailsDialog.store.phone || "未設定"
                }}</span>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="営業時間">
            <div class="detail-section">
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
                      detailsDialog.businessHours &&
                      detailsDialog.businessHours[day.value]
                    "
                    :class="[
                      'day-status',
                      detailsDialog.businessHours[day.value].is_closed
                        ? 'closed'
                        : 'open',
                    ]"
                  >
                    {{
                      detailsDialog.businessHours[day.value].is_closed
                        ? "定休日"
                        : "営業日"
                    }}
                  </span>
                </div>
                <div
                  v-if="
                    detailsDialog.businessHours &&
                    detailsDialog.businessHours[day.value] &&
                    !detailsDialog.businessHours[day.value].is_closed
                  "
                  class="day-hours-time"
                >
                  {{
                    formatTime(
                      detailsDialog.businessHours[day.value]?.opening_time
                    )
                  }}
                  -
                  {{
                    formatTime(
                      detailsDialog.businessHours[day.value]?.closing_time
                    )
                  }}
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="特別定休日">
            <div class="detail-section">
              <h4>特別定休日</h4>
              <div class="closed-dates-list">
                <div
                  v-if="
                    detailsDialog.specificDates &&
                    detailsDialog.specificDates.length > 0
                  "
                  class="closed-dates"
                >
                  <Tag
                    v-for="(date, index) in detailsDialog.specificDates"
                    :key="'date-' + index"
                    :value="formatDate(date)"
                    severity="danger"
                    class="mr-2 mb-2"
                  />
                </div>
                <div v-else class="no-closed-dates">
                  特別定休日は設定されていません
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="人員要件">
            <div class="detail-section">
              <h4>曜日ごとの人員要件</h4>
              <div
                v-for="day in daysOfWeek"
                :key="'day-req-' + day.value"
                class="day-req-section"
              >
                <h5>{{ day.label }}曜日</h5>
                <div
                  v-if="
                    detailsDialog.dayRequirements &&
                    detailsDialog.dayRequirements[day.value] &&
                    detailsDialog.dayRequirements[day.value].length > 0
                  "
                  class="requirements-list"
                >
                  <div
                    v-for="(req, index) in detailsDialog.dayRequirements[
                      day.value
                    ]"
                    :key="day.value + '-req-' + index"
                    class="requirement-row"
                  >
                    <span class="req-time"
                      >{{ formatTime(req.start_time) }} -
                      {{ formatTime(req.end_time) }}</span
                    >
                    <span class="req-count"
                      >{{ req.required_staff_count }}名</span
                    >
                  </div>
                </div>
                <div v-else class="no-requirements">
                  人員要件は設定されていません
                </div>
              </div>
            </div>
          </TabPanel>
        </TabView>
      </div>

      <template #footer>
        <Button
          label="閉じる"
          icon="pi pi-times"
          class="p-button-text"
          @click="detailsDialog.visible = false"
        />
        <Button
          v-if="isAdmin"
          label="編集"
          icon="pi pi-pencil"
          class="p-button-primary"
          @click="editFromDetails"
        />
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

    <ConfirmDialog></ConfirmDialog>
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
import ConfirmDialog from "primevue/confirmdialog";
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
    ConfirmDialog,
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

    const generateTimeOptions = () => {
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
    };

    timeOptions.value = generateTimeOptions();

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

    const detailsDialog = reactive({
      visible: false,
      store: null,
      businessHours: {},
      specificDates: [],
      dayRequirements: {},
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

    const initTimeOptions = () => {
      const options = [];
      for (let hour = 0; hour < 24; hour++) {
        for (let minute of ["00", "30"]) {
          const formattedHour = hour.toString().padStart(2, "0");
          const timeValue = `${formattedHour}:${minute}`;
          options.push({
            label: timeValue,
            value: timeValue,
          });
        }
      }
      timeOptions.value = options;
    };

    const daysOfWeek = [
      { value: 0, label: "日" },
      { value: 1, label: "月" },
      { value: 2, label: "火" },
      { value: 3, label: "水" },
      { value: 4, label: "木" },
      { value: 5, label: "金" },
      { value: 6, label: "土" },
    ];

    onMounted(() => {
      initTimeOptions();
      fetchStores();
    });

    const fetchStores = async () => {
      loading.value = true;
      try {
        const response = await store.dispatch("store/fetchStores");
        stores.value = response;

        const uniqueAreas = new Set();
        stores.value.forEach((storeItem) => {
          if (storeItem.area && storeItem.area.trim()) {
            uniqueAreas.add(storeItem.area.trim());
          }
        });
        areaOptions.value = Array.from(uniqueAreas).sort();

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

    const viewStoreDetails = async (storeData) => {
      detailsDialog.store = storeData;

      detailsDialog.businessHours = {};
      detailsDialog.specificDates = [];
      detailsDialog.dayRequirements = {};

      daysOfWeek.forEach((day) => {
        detailsDialog.businessHours[day.value] = {
          is_closed: false,
          opening_time: "09:00",
          closing_time: "18:00",
        };

        detailsDialog.dayRequirements[day.value] = [];
      });

      detailsDialog.visible = true;

      await loadBusinessHoursForDetails(storeData.id);

      await loadClosedDaysForDetails(storeData.id);

      await loadStaffRequirementsForDetails(storeData.id);
    };

    const editFromDetails = () => {
      if (detailsDialog.store) {
        detailsDialog.visible = false;
        editStore(detailsDialog.store);
      }
    };

    const searchArea = (event) => {
      const query = event.query.toLowerCase();
      if (!query) {
        filteredAreas.value = areaOptions.value;
      } else {
        filteredAreas.value = areaOptions.value.filter((area) =>
          area.toLowerCase().includes(query)
        );
      }
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

    const loadBusinessHoursForDetails = async (storeId) => {
      try {
        const businessHours = await store.dispatch(
          "store/fetchStoreBusinessHours",
          storeId
        );

        detailsDialog.businessHours = {};
        daysOfWeek.forEach((day) => {
          detailsDialog.businessHours[day.value] = {
            is_closed: false,
            opening_time: "09:00",
            closing_time: "18:00",
          };
        });

        businessHours.forEach((hour) => {
          if (hour.day_of_week >= 0 && hour.day_of_week <= 6) {
            detailsDialog.businessHours[hour.day_of_week] = {
              is_closed: hour.is_closed,
              opening_time: hour.opening_time || "09:00",
              closing_time: hour.closing_time || "18:00",
            };
          }
        });
      } catch (error) {
        console.error("営業時間データの取得に失敗しました:", error);
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

    const loadClosedDaysForDetails = async (storeId) => {
      try {
        const closedDays = await store.dispatch(
          "store/fetchStoreClosedDays",
          storeId
        );

        detailsDialog.specificDates = closedDays
          .filter((day) => day.specific_date)
          .map((day) => new Date(day.specific_date));
      } catch (error) {
        console.error("定休日データの取得に失敗しました:", error);
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

    const loadStaffRequirementsForDetails = async (storeId) => {
      try {
        const requirements = await store.dispatch(
          "store/fetchStoreStaffRequirements",
          storeId
        );

        detailsDialog.dayRequirements = {};
        daysOfWeek.forEach((day) => {
          detailsDialog.dayRequirements[day.value] = [];
        });

        requirements.forEach((req) => {
          if (req.day_of_week >= 0 && req.day_of_week <= 6) {
            if (!detailsDialog.dayRequirements[req.day_of_week]) {
              detailsDialog.dayRequirements[req.day_of_week] = [];
            }

            detailsDialog.dayRequirements[req.day_of_week].push({
              start_time: req.start_time,
              end_time: req.end_time,
              required_staff_count: req.required_staff_count,
            });
          }
        });
      } catch (error) {
        console.error("人員要件データの取得に失敗しました:", error);
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
      if (timeOptions.value.length === 0) {
        initTimeOptions();
      }
      applyAllTimeDialog.opening_time = "09:00";
      applyAllTimeDialog.closing_time = "18:00";
      applyAllTimeDialog.visible = true;
    };

    const showEditApplyAllTimeDialog = () => {
      if (timeOptions.value.length === 0) {
        initTimeOptions();
      }
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

        const storeData = { ...newStoreDialog.store };
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

        console.log("更新する店舗情報:", storeDialog.store);
        let savedStore = await store.dispatch(
          "store/updateStore",
          storeDialog.store
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

    const saveStaff = async () => {
      submitted.value = true;

      if (!staffDialog.staff.last_name || !staffDialog.staff.first_name) {
        return;
      }

      saving.value = true;

      try {
        const dayPreferences = daysOfWeek.map((day) => ({
          day_of_week: day.value,
          available: staffDialog.dayPreferences[day.value].available,
          preferred_start_time:
            staffDialog.dayPreferences[day.value].preferred_start_time || null,
          preferred_end_time:
            staffDialog.dayPreferences[day.value].preferred_end_time || null,
          break_start_time:
            staffDialog.dayPreferences[day.value].break_start_time || null,
          break_end_time:
            staffDialog.dayPreferences[day.value].break_end_time || null,
        }));

        const dayOffRequests = staffDialog.dayOffRequests.map((request) => ({
          date: request.date,
          reason: request.reason || "requested",
          status: request.status || "pending",
        }));

        if (staffDialog.isNew) {
          const staffData = {
            ...staffDialog.staff,
            day_preferences: dayPreferences,
            day_off_requests: dayOffRequests,
          };

          await store.dispatch("staff/createStaff", staffData);

          toast.add({
            severity: "success",
            summary: "作成完了",
            detail: "スタッフを作成しました",
            life: 3002,
          });
        } else {
          const staffData = {
            ...staffDialog.staff,
            day_preferences: dayPreferences,
            day_off_requests: dayOffRequests,
          };

          await store.dispatch("staff/updateStaff", {
            id: staffDialog.staff.id,
            staffData: staffData,
          });

          toast.add({
            severity: "success",
            summary: "更新完了",
            detail: "スタッフ情報を更新しました",
            life: 3002,
          });
        }

        hideDialog();
        await fetchStaffList();
      } catch (error) {
        console.error("スタッフ保存エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "スタッフの保存に失敗しました: " + error.message,
          life: 3002,
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

    const getDayOfWeekLabel = (dayValue) => {
      const day = daysOfWeek.find((d) => d.value === dayValue);
      return day ? day.label : "";
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

    const hasMultipleBusinessHours = (storeId) => {
      console.log("hasMultipleBusinessHours 呼び出し, storeId:", storeId);

      const storeItem = stores.value.find((s) => s.id === storeId);
      if (!storeItem || !storeItem.businessHours) {
        console.log("店舗または営業時間データがありません");
        return false;
      }

      console.log("営業時間データ:", storeItem.businessHours);

      const openDays = Object.values(storeItem.businessHours).filter(
        (hour) => !hour.is_closed
      );

      if (openDays.length === 0) {
        console.log("営業日がありません");
        return false;
      }

      function normalizeTime(time) {
        if (!time) return "";
        return time.split(":").slice(0, 2).join(":");
      }

      const firstDay = openDays[0];
      const firstOpeningTime = normalizeTime(firstDay.opening_time);
      const firstClosingTime = normalizeTime(firstDay.closing_time);

      const hasMultiple = openDays.some((day) => {
        const dayOpeningTime = normalizeTime(day.opening_time);
        const dayClosingTime = normalizeTime(day.closing_time);

        const isDifferent =
          dayOpeningTime !== firstOpeningTime ||
          dayClosingTime !== firstClosingTime;

        console.log(
          `曜日 ${day.day_of_week} の時間: ${dayOpeningTime}-${dayClosingTime}, ` +
            `基準時間: ${firstOpeningTime}-${firstClosingTime}, 違い: ${isDifferent}`
        );

        return isDifferent;
      });

      console.log("複数の営業時間パターンあり:", hasMultiple);
      return hasMultiple;
    };

    const showBusinessHoursTooltip = (event, storeId) => {
      const storeItem = stores.value.find((s) => s.id === storeId);
      if (!storeItem || !storeItem.businessHours) return;

      let info = "";
      daysOfWeek.forEach((day) => {
        const hourData = storeItem.businessHours[day.value];
        if (!hourData) {
          info += `${day.label}曜日: 情報なし\n`;
          return;
        }

        if (hourData.is_closed) {
          info += `${day.label}曜日: 定休日\n`;
        } else {
          info += `${day.label}曜日: ${formatTime(
            hourData.opening_time
          )} - ${formatTime(hourData.closing_time)}\n`;
        }
      });

      alert(`${storeItem.name}の曜日ごとの営業時間:\n\n${info}`);
    };

    const businessHoursDialog = reactive({
      visible: false,
      store: null,
      specificDates: [],
    });

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
      detailsDialog,
      applyAllTimeDialog,
      editApplyAllTimeDialog,
      daysOfWeek,
      isAdmin,
      timeOptions,
      areaOptions,
      filteredAreas,
      openNew,
      editStore,
      viewStoreDetails,
      editFromDetails,
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
      getDayOfWeekLabel,
      getClosedDaysText,
      getSpecialClosedDaysText,
      loadStoreDetails,
      hasMultipleBusinessHours,
      showBusinessHoursTooltip,
      businessHoursDialog,
      showBusinessHoursDialog,
      searchArea,
      validateStoreName,
    };
  },
};
</script>