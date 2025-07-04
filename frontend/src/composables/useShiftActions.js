import { ref } from "vue";
import { useStore } from "vuex";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";

export function useShiftActions() {
    const store = useStore();
    const toast = useToast();
    const confirm = useConfirm();

    const saving = ref(false);
    const loading = ref(false);

    // AI自動シフト生成
    const generateAutomaticShift = async (selectedStore, currentYear, currentMonth, staffList, hasStaffWarningsAllStores, getStaffWarningsAllStores, hasDateWarnings, getDateWarnings, daysInMonth, formatHours, loadShiftData) => {
        try {
            loading.value = true;

            toast.add({
                severity: "info",
                summary: "シフト生成開始",
                detail: "AIによるシフト生成を開始しています...",
                life: 5000,
            });

            const params = {
                storeId: selectedStore.id,
                year: currentYear,
                month: currentMonth,
            };

            const result = await store.dispatch("shift/generateShift", params);

            await loadShiftData();

            const staffViolations = [];
            const dateViolations = [];

            staffList.forEach((staff) => {
                if (hasStaffWarningsAllStores(staff.id)) {
                    const warnings = getStaffWarningsAllStores(staff.id);
                    staffViolations.push(
                        `${staff.last_name} ${staff.first_name}: ${warnings
                            .map((w) => w.message)
                            .join(", ")}`
                    );
                }
            });

            daysInMonth.forEach((day) => {
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
            } else {
                toast.add({
                    severity: "success",
                    summary: "シフト生成完了",
                    detail: "制約を守ったシフトが正常に生成されました",
                    life: 5000,
                });
            }
        } catch (error) {
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
                    createEmptyShift(selectedStore, currentYear, currentMonth, loadShiftData);
                },
            });
        } finally {
            loading.value = false;
        }
    };

    // 空シフト作成
    const createEmptyShift = async (selectedStore, currentYear, currentMonth, loadShiftData) => {
        try {
            loading.value = true;

            await store.dispatch("shift/createShift", {
                store_id: selectedStore.id,
                year: currentYear,
                month: currentMonth,
                status: "draft",
            });

            await loadShiftData();

            toast.add({
                severity: "success",
                summary: "作成完了",
                detail: "シフトを作成しました。編集モードになりました。",
                life: 3000,
            });
        } catch (error) {
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

    // シフト再生成
    const regenerateShift = async (currentYear, currentMonth, generateAutomaticShift) => {
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

    // シフト削除
    const deleteShift = async (currentYear, currentMonth, selectedStore) => {
        confirm.require({
            message: `${currentYear}年${currentMonth}月のシフトを完全に削除しますか？この操作は取り消せません。`,
            header: "シフト削除の確認",
            icon: "pi pi-exclamation-triangle",
            acceptClass: "p-button-danger",
            acceptLabel: "削除",
            rejectLabel: "キャンセル",
            accept: async () => {
                try {
                    loading.value = true;

                    await store.dispatch("shift/deleteShift", {
                        year: currentYear,
                        month: currentMonth,
                        storeId: selectedStore.id,
                    });

                    toast.add({
                        severity: "success",
                        summary: "削除完了",
                        detail: "シフトを削除しました",
                        life: 3000,
                    });

                    return true;
                } catch (error) {
                    toast.add({
                        severity: "error",
                        summary: "エラー",
                        detail: "シフトの削除に失敗しました",
                        life: 3000,
                    });
                    return false;
                } finally {
                    loading.value = false;
                }
            },
        });
    };

    // シフト保存
    const saveShift = async (shiftData, selectedStore, currentYear, currentMonth, getShiftForStaff, combineTimeComponents, loadShiftData, fetchAllSystemStaffAndShifts) => {
        if (!shiftData.date || !shiftData.staff) return;

        if (shiftData.isRestDay) {
            await clearShift(shiftData, currentYear, currentMonth, getShiftForStaff, loadShiftData, fetchAllSystemStaffAndShifts);
            return;
        }

        if (
            !shiftData.startTimeHour ||
            !shiftData.startTimeMinute ||
            !shiftData.endTimeHour ||
            !shiftData.endTimeMinute
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
            shiftData.startTimeHour,
            shiftData.startTimeMinute
        );
        const endTime = combineTimeComponents(
            shiftData.endTimeHour,
            shiftData.endTimeMinute
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

        if (shiftData.isPast && !shiftData.changeReason.trim()) {
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
            const postData = {
                store_id: selectedStore.id,
                staff_id: shiftData.staff.id,
                date: shiftData.date,
                start_time: startTime,
                end_time: endTime,
                break_start_time: null,
                break_end_time: null,
                notes: null,
            };

            if (
                shiftData.hasBreak &&
                shiftData.breakStartTimeHour &&
                shiftData.breakStartTimeMinute &&
                shiftData.breakEndTimeHour &&
                shiftData.breakEndTimeMinute
            ) {
                const breakStartTime = combineTimeComponents(
                    shiftData.breakStartTimeHour,
                    shiftData.breakStartTimeMinute
                );
                const breakEndTime = combineTimeComponents(
                    shiftData.breakEndTimeHour,
                    shiftData.breakEndTimeMinute
                );

                if (
                    breakStartTime >= startTime &&
                    breakEndTime <= endTime &&
                    breakStartTime < breakEndTime
                ) {
                    postData.break_start_time = breakStartTime;
                    postData.break_end_time = breakEndTime;
                }
            }

            if (shiftData.isPast) {
                postData.change_reason = shiftData.changeReason;
            }

            const existingShift = getShiftForStaff(
                shiftData.date,
                shiftData.staff.id
            );

            if (existingShift) {
                await store.dispatch("shift/updateShiftAssignment", {
                    year: currentYear,
                    month: currentMonth,
                    assignmentId: existingShift.id,
                    assignmentData: postData,
                });
            } else {
                await store.dispatch("shift/createShiftAssignment", {
                    year: currentYear,
                    month: currentMonth,
                    assignmentData: postData,
                });
            }

            await loadShiftData();
            await fetchAllSystemStaffAndShifts();

            const successMessage = shiftData.isPast
                ? "過去のシフトを変更しました（変更履歴に記録されます）"
                : "シフトを保存しました";

            toast.add({
                severity: "success",
                summary: "保存完了",
                detail: successMessage,
                life: 3000,
            });

            return true;
        } catch (error) {
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
            return false;
        } finally {
            saving.value = false;
        }
    };

    // シフトクリア
    const clearShift = async (data, currentYear, currentMonth, getShiftForStaff, loadShiftData, fetchAllSystemStaffAndShifts) => {
        if (!data.hasShift) {
            return;
        }

        if (data.isPast && !data?.changeReason?.trim()) {
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
                data.date,
                data.staff.id
            );

            if (existingShift) {
                await store.dispatch("shift/deleteShiftAssignment", {
                    year: currentYear,
                    month: currentMonth,
                    assignmentId: existingShift.id,
                    change_reason: data.isPast
                        ? data.changeReason
                        : null,
                });

                await loadShiftData();
                await fetchAllSystemStaffAndShifts();

                const successMessage = data.isPast
                    ? "過去のシフトを削除しました（変更履歴に記録されます）"
                    : "シフトを削除しました";

                toast.add({
                    severity: "success",
                    summary: "削除完了",
                    detail: successMessage,
                    life: 3000,
                });

                return true;
            }
        } catch (error) {
            toast.add({
                severity: "error",
                summary: "エラー",
                detail: "シフトの削除に失敗しました",
                life: 3000,
            });
            return false;
        } finally {
            saving.value = false;
        }
    };

    // クイック削除確認
    const confirmQuickDelete = async (shift, currentYear, currentMonth, loadShiftData) => {
        if (!shift) return;

        confirm.require({
            message: "このシフトを削除しますか？",
            header: "シフト削除の確認",
            icon: "pi pi-exclamation-triangle",
            acceptClass: "p-button-danger",
            acceptLabel: "削除",
            rejectLabel: "キャンセル",
            accept: async () => {
                try {
                    await store.dispatch("shift/deleteShiftAssignment", {
                        year: currentYear,
                        month: currentMonth,
                        assignmentId: shift.id,
                    });

                    await loadShiftData();

                    toast.add({
                        severity: "success",
                        summary: "削除完了",
                        detail: "シフトを削除しました",
                        life: 3000,
                    });
                } catch (error) {
                    toast.add({
                        severity: "error",
                        summary: "エラー",
                        detail: "シフトの削除に失敗しました",
                        life: 3000,
                    });
                }
            },
        });
    };

    // シフト印刷
    const printShift = (hasCurrentShift, selectedStore, currentYear, currentMonth, daysInMonth, staffList, getShiftForStaff, formatTime, formatHours, calculateTotalHours, calculateTotalHoursAllStores) => {
        if (!hasCurrentShift) return;

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

        const printContent = generatePrintContent(selectedStore, currentYear, currentMonth, daysInMonth, staffList, getShiftForStaff, formatTime, formatHours, calculateTotalHours, calculateTotalHoursAllStores);
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    };

    // 印刷コンテンツ生成
    const generatePrintContent = (selectedStore, currentYear, currentMonth, daysInMonth, staffList, getShiftForStaff, formatTime, formatHours, calculateTotalHours, calculateTotalHoursAllStores) => {
        const storeName = selectedStore ? selectedStore.name : "";
        const period = `${currentYear}年${currentMonth}月`;

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

        daysInMonth.forEach((day) => {
            const holidayClass = day.isHoliday ? "holiday" : "";
            const todayClass = day.isToday ? "today" : "";
            const storeClosedClass = day.isStoreClosed ? "store-closed" : "";
            const cellClass =
                `${holidayClass} ${todayClass} ${storeClosedClass}`.trim();
            printHtml += `
  <th class="date-col ${cellClass}">
    <div style="${day.isWeekend || day.isNationalHoliday
                    ? "color: #dc2626;"
                    : day.isStoreClosed && !day.isWeekend && !day.isNationalHoliday
                        ? "color: #6b7280;"
                        : ""
                }">${day.day}</div>
    <div style="font-size: 6px; ${day.isWeekend || day.isNationalHoliday
                    ? "color: #dc2626;"
                    : day.isStoreClosed && !day.isWeekend && !day.isNationalHoliday
                        ? "color: #6b7280;"
                        : ""
                }">${day.dayOfWeekLabel}</div>
         ${day.isNationalHoliday
                    ? '<div style="font-size: 5px; color: red;">祝</div>'
                    : ""
                }
         ${day.isStoreClosed && !day.isNationalHoliday && !day.isWeekend
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

        staffList.forEach((staff) => {
            printHtml += `<tr>`;
            printHtml += `<td class="staff-col">${staff.last_name} ${staff.first_name}</td>`;

            daysInMonth.forEach((day) => {
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
                } else if (day.isStoreClosed) {
                    printHtml += `<td class="${cellClass}">定休日</td>`;
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
               <th>${selectedStore.name}</th>
               <th>全店合計</th>
             </tr>
           </thead>
           <tbody>
   `;

        staffList.forEach((staff) => {
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

    return {
        // 状態
        saving,
        loading,

        // メソッド
        generateAutomaticShift,
        createEmptyShift,
        regenerateShift,
        deleteShift,
        saveShift,
        clearShift,
        confirmQuickDelete,
        printShift,
        generatePrintContent,
    };
}