// frontend/src/composables/useShiftActions.js
import { ref } from 'vue';
import { useStore } from 'vuex';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

export function useShiftActions() {
    const store = useStore();
    const toast = useToast();
    const confirm = useConfirm();

    const loading = ref(false);

    const generateAutomaticShift = async (
        selectedStore,
        currentYear,
        currentMonth,
        staffList,
        hasStaffWarningsAllStores,
        getStaffWarningsAllStores,
        hasDateWarnings,
        getDateWarnings,
        daysInMonth,
        formatHours,
        loadShiftData
    ) => {
        if (!selectedStore) {
            toast.add({
                severity: 'error',
                summary: 'エラー',
                detail: '店舗が選択されていません',
                life: 3000
            });
            return false;
        }

        if (!staffList || staffList.length === 0) {
            toast.add({
                severity: 'error',
                summary: 'エラー',
                detail: 'スタッフが登録されていません',
                life: 3000
            });
            return false;
        }

        loading.value = true;

        try {
            console.log('🤖 AI自動生成開始:', {
                store: selectedStore.name,
                year: currentYear,
                month: currentMonth,
                staffCount: staffList.length
            });

            toast.add({
                severity: 'info',
                summary: 'AI生成中',
                detail: 'シフトを自動生成しています...',
                life: 3000
            });

            const response = await store.dispatch('shift/generateShift', {
                storeId: selectedStore.id,
                year: currentYear,
                month: currentMonth
            });

            console.log('🤖 AI生成レスポンス:', response);

            if (response && response.success) {
                await loadShiftData();

                let messageDetail = 'AIによるシフト自動生成が完了しました。';
                let severity = 'success';

                if (response.hasWarnings) {
                    messageDetail += '\n\n⚠️ 制約違反があります：\n';
                    if (response.warningMessage) {
                        messageDetail += response.warningMessage;
                    }
                    severity = 'warn';
                }

                if (hasStaffWarningsAllStores && getStaffWarningsAllStores) {
                    const staffWarnings = [];
                    staffList.forEach(staff => {
                        if (hasStaffWarningsAllStores(staff.id)) {
                            const warnings = getStaffWarningsAllStores(staff.id);
                            staffWarnings.push(`${staff.last_name} ${staff.first_name}: ${warnings.join(', ')}`);
                        }
                    });

                    if (staffWarnings.length > 0) {
                        messageDetail += '\n\n📋 スタッフ勤務時間の警告:\n' + staffWarnings.slice(0, 3).join('\n');
                        if (staffWarnings.length > 3) {
                            messageDetail += `\n...他${staffWarnings.length - 3}件`;
                        }
                        severity = 'warn';
                    }
                }

                if (hasDateWarnings && getDateWarnings && daysInMonth) {
                    const dateWarnings = [];
                    daysInMonth.forEach(day => {
                        if (hasDateWarnings(day)) {
                            const warnings = getDateWarnings(day);
                            dateWarnings.push(`${day.date}: ${warnings.join(', ')}`);
                        }
                    });

                    if (dateWarnings.length > 0) {
                        messageDetail += '\n\n📅 日別の警告:\n' + dateWarnings.slice(0, 3).join('\n');
                        if (dateWarnings.length > 3) {
                            messageDetail += `\n...他${dateWarnings.length - 3}件`;
                        }
                        severity = 'warn';
                    }
                }

                messageDetail += '\n\n必要に応じて手動で調整してください。';

                toast.add({
                    severity: severity,
                    summary: severity === 'success' ? 'シフト生成完了' : 'シフト生成完了（要確認）',
                    detail: messageDetail,
                    life: severity === 'success' ? 5000 : 10000
                });

                return true;
            } else {
                throw new Error(response?.message || 'シフト生成に失敗しました');
            }
        } catch (error) {
            console.error('❌ AI生成エラー:', error);

            let errorMessage = 'シフトの自動生成に失敗しました。';

            if (error.response?.data?.message) {
                errorMessage += `\n詳細: ${error.response.data.message}`;
            } else if (error.message) {
                errorMessage += `\n詳細: ${error.message}`;
            }

            toast.add({
                severity: 'error',
                summary: 'AI生成エラー',
                detail: errorMessage,
                life: 8000
            });

            return false;
        } finally {
            loading.value = false;
        }
    };

    const createEmptyShift = async (selectedStore, currentYear, currentMonth, loadShiftData) => {
        if (!selectedStore) {
            toast.add({
                severity: 'error',
                summary: 'エラー',
                detail: '店舗が選択されていません',
                life: 3000
            });
            return false;
        }

        loading.value = true;

        try {
            console.log('📝 空シフト作成開始:', {
                store: selectedStore.name,
                year: currentYear,
                month: currentMonth
            });

            await store.dispatch('shift/createShift', {
                store_id: selectedStore.id,
                year: currentYear,
                month: currentMonth,
                status: 'draft'
            });

            await loadShiftData();

            toast.add({
                severity: 'success',
                summary: '作成完了',
                detail: '空のシフト表を作成しました。編集モードでシフトを追加してください。',
                life: 5000
            });

            return true;
        } catch (error) {
            console.error('❌ 空シフト作成エラー:', error);

            let errorMessage = 'シフトの作成に失敗しました。';

            if (error.response?.data?.message) {
                errorMessage += `\n詳細: ${error.response.data.message}`;
            }

            toast.add({
                severity: 'error',
                summary: '作成エラー',
                detail: errorMessage,
                life: 5000
            });

            return false;
        } finally {
            loading.value = false;
        }
    };

    const regenerateShift = async (currentYear, currentMonth, generateFunction) => {
        return new Promise((resolve) => {
            confirm.require({
                message: `${currentYear}年${currentMonth}月のシフトを再生成しますか？\n\n現在のシフトは削除され、新しいシフトが自動生成されます。`,
                header: 'シフト再生成の確認',
                icon: 'pi pi-refresh',
                rejectClass: 'p-button-secondary p-button-outlined',
                rejectLabel: 'キャンセル',
                acceptLabel: '再生成',
                accept: async () => {
                    const success = await generateFunction();
                    resolve(success);
                },
                reject: () => {
                    resolve(false);
                }
            });
        });
    };

    const deleteShift = async (currentYear, currentMonth, selectedStore) => {
        if (!selectedStore) {
            toast.add({
                severity: 'error',
                summary: 'エラー',
                detail: '店舗が選択されていません',
                life: 3000
            });
            return false;
        }

        return new Promise((resolve) => {
            confirm.require({
                message: `${currentYear}年${currentMonth}月のシフトを削除しますか？\n\nこの操作は取り消せません。`,
                header: 'シフト削除の確認',
                icon: 'pi pi-trash',
                rejectClass: 'p-button-secondary p-button-outlined',
                rejectLabel: 'キャンセル',
                acceptClass: 'p-button-danger',
                acceptLabel: '削除',
                accept: async () => {
                    loading.value = true;
                    try {
                        console.log('🗑️ シフト削除開始:', {
                            store: selectedStore.name,
                            year: currentYear,
                            month: currentMonth
                        });

                        const response = await store.dispatch('shift/deleteShift', {
                            year: currentYear,
                            month: currentMonth,
                            storeId: selectedStore.id
                        });

                        console.log('🗑️ シフト削除レスポンス:', response);

                        toast.add({
                            severity: 'success',
                            summary: '削除完了',
                            detail: 'シフトを削除しました',
                            life: 3000
                        });

                        resolve(true);
                    } catch (error) {
                        console.error('❌ シフト削除エラー:', error);

                        let errorMessage = 'シフトの削除に失敗しました。';

                        if (error.response?.data?.message) {
                            errorMessage += `\n詳細: ${error.response.data.message}`;
                        }

                        toast.add({
                            severity: 'error',
                            summary: '削除エラー',
                            detail: errorMessage,
                            life: 5000
                        });

                        resolve(false);
                    } finally {
                        loading.value = false;
                    }
                },
                reject: () => {
                    resolve(false);
                }
            });
        });
    };

    const saveShift = async (
        shiftData,
        selectedStore,
        currentYear,
        currentMonth,
        getShiftForStaff,
        combineTimeComponents,
        loadShiftData,
        fetchAllSystemStaffAndShifts
    ) => {
        if (!selectedStore) {
            toast.add({
                severity: 'error',
                summary: 'エラー',
                detail: '店舗が選択されていません',
                life: 3000
            });
            return false;
        }

        loading.value = true;

        try {
            console.log('💾 シフト保存開始:', shiftData);

            const existingShift = getShiftForStaff(shiftData.staff, shiftData.date);

            if (existingShift && existingShift.id !== shiftData.assignmentId) {
                toast.add({
                    severity: 'error',
                    summary: 'エラー',
                    detail: 'この日付には既にシフトが設定されています',
                    life: 3000
                });
                return false;
            }

            const startTime = combineTimeComponents(shiftData.startHour, shiftData.startMinute);
            const endTime = combineTimeComponents(shiftData.endHour, shiftData.endMinute);
            const breakStartTime = shiftData.breakStartHour && shiftData.breakStartMinute
                ? combineTimeComponents(shiftData.breakStartHour, shiftData.breakStartMinute)
                : null;
            const breakEndTime = shiftData.breakEndHour && shiftData.breakEndMinute
                ? combineTimeComponents(shiftData.breakEndHour, shiftData.breakEndMinute)
                : null;

            const payload = {
                store_id: selectedStore.id,
                staff_id: shiftData.staff.id,
                date: shiftData.date,
                start_time: startTime,
                end_time: endTime,
                break_start_time: breakStartTime,
                break_end_time: breakEndTime,
                notes: shiftData.notes || null,
                change_reason: shiftData.changeReason || null,
                force: shiftData.force || false
            };

            let response;
            if (shiftData.isEdit && shiftData.assignmentId) {
                console.log('🔄 シフト更新:', payload);
                response = await store.dispatch('shift/updateShiftAssignment', {
                    year: currentYear,
                    month: currentMonth,
                    assignmentId: shiftData.assignmentId,
                    ...payload
                });
            } else {
                console.log('➕ シフト新規作成:', payload);
                response = await store.dispatch('shift/createShiftAssignment', {
                    year: currentYear,
                    month: currentMonth,
                    ...payload
                });
            }

            console.log('💾 シフト保存レスポンス:', response);

            await loadShiftData();
            await fetchAllSystemStaffAndShifts(currentYear, currentMonth);

            let message = shiftData.isEdit ? 'シフトを更新しました' : 'シフトを作成しました';
            let severity = 'success';

            if (response?.validation) {
                if (response.validation.errors?.length > 0) {
                    message += '\n⚠️ 制約違反: ' + response.validation.errors.slice(0, 2).join(', ');
                    severity = 'warn';
                }
                if (response.validation.warnings?.length > 0) {
                    message += '\n💡 注意: ' + response.validation.warnings.slice(0, 2).join(', ');
                }
            }

            toast.add({
                severity: severity,
                summary: shiftData.isEdit ? '更新完了' : '作成完了',
                detail: message,
                life: severity === 'success' ? 3000 : 6000
            });

            return true;
        } catch (error) {
            console.error('❌ シフト保存エラー:', error);

            if (error.response?.status === 400 && error.response?.data?.canForce) {
                const errorDetails = error.response.data;
                console.log('🔍 制約違反検出:', errorDetails);

                return new Promise((resolve) => {
                    const errorMessage = `制約違反が検出されました：\n\n${errorDetails.errors?.slice(0, 3).join('\n') || '詳細不明'}\n\n強制的に保存しますか？`;

                    confirm.require({
                        message: errorMessage,
                        header: '制約違反の確認',
                        icon: 'pi pi-exclamation-triangle',
                        rejectClass: 'p-button-secondary p-button-outlined',
                        rejectLabel: 'キャンセル',
                        acceptClass: 'p-button-warning',
                        acceptLabel: '強制保存',
                        accept: async () => {
                            const forceResult = await saveShift(
                                { ...shiftData, force: true },
                                selectedStore,
                                currentYear,
                                currentMonth,
                                getShiftForStaff,
                                combineTimeComponents,
                                loadShiftData,
                                fetchAllSystemStaffAndShifts
                            );
                            resolve(forceResult);
                        },
                        reject: () => {
                            resolve(false);
                        }
                    });
                });
            }

            let errorMessage = shiftData.isEdit ? 'シフトの更新に失敗しました' : 'シフトの作成に失敗しました';

            if (error.response?.data?.message) {
                errorMessage += `\n詳細: ${error.response.data.message}`;
            }

            toast.add({
                severity: 'error',
                summary: shiftData.isEdit ? '更新エラー' : '作成エラー',
                detail: errorMessage,
                life: 5000
            });

            return false;
        } finally {
            loading.value = false;
        }
    };

    const clearShift = async (
        shiftEditorDialog,
        currentYear,
        currentMonth,
        getShiftForStaff,
        loadShiftData,
        fetchAllSystemStaffAndShifts
    ) => {
        if (!shiftEditorDialog.value.isEdit || !shiftEditorDialog.value.assignmentId) {
            toast.add({
                severity: 'error',
                summary: 'エラー',
                detail: '削除対象のシフトが見つかりません',
                life: 3000
            });
            return false;
        }

        return new Promise((resolve) => {
            const shiftInfo = getShiftForStaff(shiftEditorDialog.value.staff, shiftEditorDialog.value.date);
            const staffName = `${shiftEditorDialog.value.staff.last_name} ${shiftEditorDialog.value.staff.first_name}`;

            confirm.require({
                message: `${staffName}の${shiftEditorDialog.value.date}のシフトを削除しますか？\n\nこの操作は取り消せません。`,
                header: 'シフト削除の確認',
                icon: 'pi pi-trash',
                rejectClass: 'p-button-secondary p-button-outlined',
                rejectLabel: 'キャンセル',
                acceptClass: 'p-button-danger',
                acceptLabel: '削除',
                accept: async () => {
                    loading.value = true;
                    try {
                        console.log('🗑️ シフト個別削除開始:', {
                            assignmentId: shiftEditorDialog.value.assignmentId,
                            staff: staffName,
                            date: shiftEditorDialog.value.date
                        });

                        await store.dispatch('shift/deleteShiftAssignment', {
                            year: currentYear,
                            month: currentMonth,
                            assignmentId: shiftEditorDialog.value.assignmentId,
                            change_reason: shiftEditorDialog.value.changeReason || 'シフト削除'
                        });

                        await loadShiftData();
                        await fetchAllSystemStaffAndShifts(currentYear, currentMonth);

                        toast.add({
                            severity: 'success',
                            summary: '削除完了',
                            detail: `${staffName}のシフトを削除しました`,
                            life: 3000
                        });

                        resolve(true);
                    } catch (error) {
                        console.error('❌ シフト個別削除エラー:', error);

                        let errorMessage = 'シフトの削除に失敗しました。';

                        if (error.response?.data?.message) {
                            errorMessage += `\n詳細: ${error.response.data.message}`;
                        }

                        toast.add({
                            severity: 'error',
                            summary: '削除エラー',
                            detail: errorMessage,
                            life: 5000
                        });

                        resolve(false);
                    } finally {
                        loading.value = false;
                    }
                },
                reject: () => {
                    resolve(false);
                }
            });
        });
    };

    const confirmQuickDelete = async (shift, currentYear, currentMonth, loadShiftData) => {
        return new Promise((resolve) => {
            const staffName = shift.staff_name || `スタッフ${shift.staff_id}`;

            confirm.require({
                message: `${staffName}の${shift.date}のシフトを削除しますか？\n\nこの操作は取り消せません。`,
                header: 'シフト削除の確認',
                icon: 'pi pi-trash',
                rejectClass: 'p-button-secondary p-button-outlined',
                rejectLabel: 'キャンセル',
                acceptClass: 'p-button-danger',
                acceptLabel: '削除',
                accept: async () => {
                    loading.value = true;
                    try {
                        console.log('🗑️ クイック削除開始:', shift);

                        await store.dispatch('shift/deleteShiftAssignment', {
                            year: currentYear,
                            month: currentMonth,
                            assignmentId: shift.id,
                            change_reason: 'クイック削除'
                        });

                        await loadShiftData();

                        toast.add({
                            severity: 'success',
                            summary: '削除完了',
                            detail: `${staffName}のシフトを削除しました`,
                            life: 3000
                        });

                        resolve(true);
                    } catch (error) {
                        console.error('❌ クイック削除エラー:', error);

                        let errorMessage = 'シフトの削除に失敗しました。';

                        if (error.response?.data?.message) {
                            errorMessage += `\n詳細: ${error.response.data.message}`;
                        }

                        toast.add({
                            severity: 'error',
                            summary: '削除エラー',
                            detail: errorMessage,
                            life: 5000
                        });

                        resolve(false);
                    } finally {
                        loading.value = false;
                    }
                },
                reject: () => {
                    resolve(false);
                }
            });
        });
    };

    const printShift = (
        hasCurrentShift,
        selectedStore,
        currentYear,
        currentMonth,
        daysInMonth,
        staffList,
        getShiftForStaff,
        formatTime,
        formatHours,
        calculateTotalHours,
        calculateTotalHoursAllStores
    ) => {
        if (!hasCurrentShift) {
            toast.add({
                severity: 'error',
                summary: 'エラー',
                detail: '印刷対象のシフトがありません',
                life: 3000
            });
            return;
        }

        try {
            console.log('🖨️ シフト印刷開始');

            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                throw new Error('ポップアップがブロックされました');
            }

            // 印刷用HTMLの生成
            const printHTML = generatePrintHTML(
                selectedStore,
                currentYear,
                currentMonth,
                daysInMonth,
                staffList,
                getShiftForStaff,
                formatTime,
                formatHours,
                calculateTotalHours,
                calculateTotalHoursAllStores
            );

            printWindow.document.write(printHTML);
            printWindow.document.close();

            // 印刷ダイアログを開く
            printWindow.onload = () => {
                printWindow.print();
                printWindow.close();
            };

            toast.add({
                severity: 'success',
                summary: '印刷準備完了',
                detail: '印刷ダイアログを開きました',
                life: 3000
            });
        } catch (error) {
            console.error('❌ 印刷エラー:', error);
            toast.add({
                severity: 'error',
                summary: '印刷エラー',
                detail: '印刷の準備に失敗しました',
                life: 3000
            });
        }
    };

    const generatePrintHTML = (
        selectedStore,
        currentYear,
        currentMonth,
        daysInMonth,
        staffList,
        getShiftForStaff,
        formatTime,
        formatHours,
        calculateTotalHours,
        calculateTotalHoursAllStores
    ) => {
        const title = `${selectedStore.name} ${currentYear}年${currentMonth}月シフト表`;
        const printDate = new Date().toLocaleDateString('ja-JP');

        let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        @page { margin: 20mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Hiragino Sans', 'Yu Gothic', sans-serif; font-size: 12px; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { font-size: 18px; margin-bottom: 10px; }
        .header .info { font-size: 12px; color: #666; }
        .shift-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .shift-table th, .shift-table td { border: 1px solid #ddd; padding: 6px; text-align: center; }
        .shift-table th { background-color: #f5f5f5; font-weight: bold; }
        .staff-name { min-width: 80px; text-align: left; }
        .shift-cell { font-size: 10px; min-width: 25px; }
        .summary { margin-top: 20px; }
        .summary h3 { margin-bottom: 10px; }
        .summary-table { width: 100%; border-collapse: collapse; }
        .summary-table th, .summary-table td { border: 1px solid #ddd; padding: 4px; }
        .summary-table th { background-color: #f5f5f5; }
        .weekend { background-color: #ffe6e6; }
        .holiday { background-color: #e6f3ff; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${title}</h1>
        <div class="info">印刷日: ${printDate}</div>
    </div>
    
    <table class="shift-table">
        <thead>
            <tr>
                <th class="staff-name">スタッフ</th>`;

        // 日付ヘッダー
        daysInMonth.forEach(day => {
            const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][day.dayOfWeek];
            const className = day.dayOfWeek === 0 || day.dayOfWeek === 6 ? 'weekend' : '';
            html += `<th class="shift-cell ${className}">${day.day}<br>${dayOfWeek}</th>`;
        });

        html += `<th>合計時間</th></tr></thead><tbody>`;

        // スタッフ行
        staffList.forEach(staff => {
            html += `<tr><td class="staff-name">${staff.last_name} ${staff.first_name}</td>`;

            daysInMonth.forEach(day => {
                const shift = getShiftForStaff(staff, day.date);
                const className = day.dayOfWeek === 0 || day.dayOfWeek === 6 ? 'weekend' : '';

                if (shift) {
                    html += `<td class="shift-cell ${className}">${formatTime(shift.start_time)}-${formatTime(shift.end_time)}</td>`;
                } else {
                    html += `<td class="shift-cell ${className}">-</td>`;
                }
            });

            const totalHours = calculateTotalHours(staff);
            const allStoreHours = calculateTotalHoursAllStores(staff.id);
            const displayHours = allStoreHours > totalHours ?
                `${formatHours(totalHours)}h (全店${formatHours(allStoreHours)}h)` :
                `${formatHours(totalHours)}h`;

            html += `<td>${displayHours}</td></tr>`;
        });

        html += `</tbody></table>
    
    <div class="summary">
        <h3>勤務時間サマリー</h3>
        <table class="summary-table">
            <thead>
                <tr>
                    <th>スタッフ</th>
                    <th>月間勤務時間</th>
                    <th>他店舗含む</th>
                    <th>勤務可能範囲</th>
                </tr>
            </thead>
            <tbody>`;

        staffList.forEach(staff => {
            const totalHours = calculateTotalHours(staff);
            const allStoreHours = calculateTotalHoursAllStores(staff.id);
            const minHours = staff.min_hours_per_month || 0;
            const maxHours = staff.max_hours_per_month || 0;
            const range = `${minHours}h - ${maxHours}h`;

            html += `<tr>
                <td>${staff.last_name} ${staff.first_name}</td>
                <td>${formatHours(totalHours)}h</td>
                <td>${formatHours(allStoreHours)}h</td>
                <td>${range}</td>
               </tr>`;
        });

        html += `</tbody></table></div></body></html>`;

        return html;
    };

    return {
        loading,
        generateAutomaticShift,
        createEmptyShift,
        regenerateShift,
        deleteShift,
        saveShift,
        clearShift,
        confirmQuickDelete,
        printShift
    };
}