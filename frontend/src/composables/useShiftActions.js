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
                life: 3000,
            });
            return;
        }

        loading.value = true;

        try {
            console.log('🤖 AI自動生成開始:', {
                store: selectedStore.name,
                year: currentYear,
                month: currentMonth,
                staffCount: staffList?.length || 0
            });

            const response = await store.dispatch('shift/generateShift', {
                storeId: selectedStore.id,
                year: currentYear,
                month: currentMonth,
            });

            console.log('🎯 AI生成結果:', response);

            if (response && response.success) {
                let toastMessage = 'AI シフト生成が完了しました';
                let severity = 'success';

                if (response.hasWarnings) {
                    severity = 'warn';
                    toastMessage = 'AI シフト生成が完了しましたが、調整が必要な箇所があります';
                }

                toast.add({
                    severity: severity,
                    summary: 'シフト生成完了',
                    detail: toastMessage,
                    life: 5000,
                });

                if (response.hasWarnings && response.warningMessage) {
                    toast.add({
                        severity: 'warn',
                        summary: '調整が必要',
                        detail: response.warningMessage,
                        life: 8000,
                    });
                }

                // データの再読み込み
                await loadShiftData();

                // 警告がある場合の詳細表示
                if (response.hasWarnings) {
                    const validationDetails = [];

                    staffList.forEach((staff) => {
                        if (hasStaffWarningsAllStores(staff.id)) {
                            const warnings = getStaffWarningsAllStores(staff.id);
                            if (warnings.length > 0) {
                                validationDetails.push(`${staff.last_name} ${staff.first_name}: ${warnings.join(', ')}`);
                            }
                        }
                    });

                    daysInMonth.forEach((day) => {
                        if (hasDateWarnings(day.date)) {
                            const warnings = getDateWarnings(day.date);
                            if (warnings.length > 0) {
                                validationDetails.push(`${day.date}: ${warnings.join(', ')}`);
                            }
                        }
                    });

                    if (validationDetails.length > 0) {
                        console.log('⚠️ 生成されたシフトの警告:', validationDetails);
                    }
                }
            } else {
                throw new Error(response?.message || 'シフト生成に失敗しました');
            }
        } catch (error) {
            console.error('❌ AI生成エラー:', error);
            toast.add({
                severity: 'error',
                summary: 'エラー',
                detail: error.message || 'AIシフト生成中にエラーが発生しました',
                life: 5000,
            });
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
                life: 3000,
            });
            return;
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
                status: 'draft',
            });

            toast.add({
                severity: 'success',
                summary: '成功',
                detail: '空のシフトが作成されました',
                life: 3000,
            });

            await loadShiftData();
            console.log('✅ 空シフト作成完了');
        } catch (error) {
            console.error('❌ 空シフト作成エラー:', error);
            toast.add({
                severity: 'error',
                summary: 'エラー',
                detail: error.message || 'シフトの作成に失敗しました',
                life: 5000,
            });
        } finally {
            loading.value = false;
        }
    };

    const regenerateShift = async (currentYear, currentMonth, generateFunction) => {
        confirm.require({
            message: `${currentYear}年${currentMonth}月のシフトを再生成しますか？\n現在のシフト内容はすべて削除されます。`,
            header: 'シフト再生成の確認',
            icon: 'pi pi-refresh',
            rejectClass: 'p-button-secondary p-button-outlined',
            rejectLabel: 'キャンセル',
            acceptLabel: '再生成',
            accept: async () => {
                console.log('🔄 シフト再生成開始');
                await generateFunction();
            },
        });
    };

    const deleteShift = async (currentYear, currentMonth, selectedStore) => {
        return new Promise((resolve) => {
            confirm.require({
                message: `${currentYear}年${currentMonth}月のシフトを削除しますか？\nこの操作は取り消せません。`,
                header: 'シフト削除の確認',
                icon: 'pi pi-trash',
                rejectClass: 'p-button-secondary p-button-outlined',
                rejectLabel: 'キャンセル',
                acceptLabel: '削除',
                acceptClass: 'p-button-danger',
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
                            storeId: selectedStore.id,
                        });

                        console.log('✅ シフト削除API応答:', response);

                        toast.add({
                            severity: 'success',
                            summary: '成功',
                            detail: 'シフトを削除しました',
                            life: 3000,
                        });

                        resolve(true);
                    } catch (error) {
                        console.error('❌ シフト削除エラー:', error);
                        toast.add({
                            severity: 'error',
                            summary: 'エラー',
                            detail: error.message || 'シフトの削除に失敗しました',
                            life: 5000,
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
        loading.value = true;

        try {
            console.log('💾 シフト保存開始:', shiftData);

            const payload = {
                year: currentYear,
                month: currentMonth,
                store_id: selectedStore.id,
                staff_id: shiftData.staff.id,
                date: shiftData.date,
                start_time: combineTimeComponents(shiftData.startHour, shiftData.startMinute),
                end_time: combineTimeComponents(shiftData.endHour, shiftData.endMinute),
                break_start_time: shiftData.hasBreak ? combineTimeComponents(shiftData.breakStartHour, shiftData.breakStartMinute) : null,
                break_end_time: shiftData.hasBreak ? combineTimeComponents(shiftData.breakEndHour, shiftData.breakEndMinute) : null,
                notes: shiftData.notes || null,
                change_reason: shiftData.changeReason || null,
                force: shiftData.forceUpdate || false,
            };

            console.log('📤 保存ペイロード:', payload);

            let response;
            const existingShift = getShiftForStaff(shiftData.staff.id, shiftData.date);

            if (existingShift) {
                console.log('📝 既存シフト更新');
                response = await store.dispatch('shift/updateShiftAssignment', {
                    year: currentYear,
                    month: currentMonth,
                    assignmentId: existingShift.id,
                    ...payload,
                });
            } else {
                console.log('➕ 新規シフト作成');
                response = await store.dispatch('shift/createShiftAssignment', payload);
            }

            console.log('✅ シフト保存完了:', response);

            if (response?.validation?.warnings?.length > 0) {
                toast.add({
                    severity: 'warn',
                    summary: '警告',
                    detail: `シフトを保存しましたが警告があります: ${response.validation.warnings.join(', ')}`,
                    life: 5000,
                });
            } else {
                toast.add({
                    severity: 'success',
                    summary: '成功',
                    detail: 'シフトを保存しました',
                    life: 3000,
                });
            }

            await loadShiftData();
            await fetchAllSystemStaffAndShifts(currentYear, currentMonth);

            return true;
        } catch (error) {
            console.error('❌ シフト保存エラー:', error);

            if (error.response?.data?.canForce && !shiftData.forceUpdate) {
                const errorDetails = error.response.data.errors?.join('\n') || 'エラーの詳細が不明です';
                const warningDetails = error.response.data.warnings?.join('\n') || '';

                const message = `${errorDetails}${warningDetails ? '\n\n警告:\n' + warningDetails : ''}\n\n制約を無視して保存しますか？`;

                confirm.require({
                    message: message,
                    header: '制約違反の確認',
                    icon: 'pi pi-exclamation-triangle',
                    rejectClass: 'p-button-secondary p-button-outlined',
                    rejectLabel: 'キャンセル',
                    acceptLabel: '強制保存',
                    acceptClass: 'p-button-warning',
                    accept: async () => {
                        const forceShiftData = { ...shiftData, forceUpdate: true };
                        await saveShift(
                            forceShiftData,
                            selectedStore,
                            currentYear,
                            currentMonth,
                            getShiftForStaff,
                            combineTimeComponents,
                            loadShiftData,
                            fetchAllSystemStaffAndShifts
                        );
                    },
                });
                return false;
            }

            toast.add({
                severity: 'error',
                summary: 'エラー',
                detail: error.message || 'シフトの保存に失敗しました',
                life: 5000,
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
        return new Promise((resolve) => {
            const existingShift = getShiftForStaff(shiftEditorDialog.staff.id, shiftEditorDialog.date);

            if (!existingShift) {
                toast.add({
                    severity: 'info',
                    summary: '情報',
                    detail: 'この日にシフトは設定されていません',
                    life: 3000,
                });
                resolve(true);
                return;
            }

            confirm.require({
                message: `${shiftEditorDialog.staff.last_name} ${shiftEditorDialog.staff.first_name}さんの${shiftEditorDialog.date}のシフトを削除しますか？`,
                header: 'シフト削除の確認',
                icon: 'pi pi-trash',
                rejectClass: 'p-button-secondary p-button-outlined',
                rejectLabel: 'キャンセル',
                acceptLabel: '削除',
                acceptClass: 'p-button-danger',
                accept: async () => {
                    loading.value = true;
                    try {
                        console.log('🗑️ 個別シフト削除:', existingShift);

                        await store.dispatch('shift/deleteShiftAssignment', {
                            year: currentYear,
                            month: currentMonth,
                            assignmentId: existingShift.id,
                            change_reason: shiftEditorDialog.changeReason || '管理者による削除',
                        });

                        toast.add({
                            severity: 'success',
                            summary: '成功',
                            detail: 'シフトを削除しました',
                            life: 3000,
                        });

                        await loadShiftData();
                        await fetchAllSystemStaffAndShifts(currentYear, currentMonth);

                        resolve(true);
                    } catch (error) {
                        console.error('❌ 個別シフト削除エラー:', error);
                        toast.add({
                            severity: 'error',
                            summary: 'エラー',
                            detail: error.message || 'シフトの削除に失敗しました',
                            life: 5000,
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

    const confirmQuickDelete = async (shift, currentYear, currentMonth, loadShiftData, fetchAllSystemStaffAndShifts) => {
        confirm.require({
            message: `${shift.staff_name}さんの${shift.date}のシフトを削除しますか？`,
            header: 'シフト削除の確認',
            icon: 'pi pi-trash',
            rejectClass: 'p-button-secondary p-button-outlined',
            rejectLabel: 'キャンセル',
            acceptLabel: '削除',
            acceptClass: 'p-button-danger',
            accept: async () => {
                loading.value = true;
                try {
                    console.log('⚡ クイック削除:', shift);

                    await store.dispatch('shift/deleteShiftAssignment', {
                        year: currentYear,
                        month: currentMonth,
                        assignmentId: shift.id,
                        change_reason: '管理者によるクイック削除',
                    });

                    toast.add({
                        severity: 'success',
                        summary: '成功',
                        detail: 'シフトを削除しました',
                        life: 3000,
                    });

                    await loadShiftData();
                    await fetchAllSystemStaffAndShifts(currentYear, currentMonth);
                } catch (error) {
                    console.error('❌ クイック削除エラー:', error);
                    toast.add({
                        severity: 'error',
                        summary: 'エラー',
                        detail: error.message || 'シフトの削除に失敗しました',
                        life: 5000,
                    });
                } finally {
                    loading.value = false;
                }
            },
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
                severity: 'warn',
                summary: '警告',
                detail: 'シフトが作成されていません',
                life: 3000,
            });
            return;
        }

        try {
            console.log('🖨️ 印刷処理開始');

            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                throw new Error('ポップアップブロッカーにより印刷ウィンドウを開けませんでした');
            }

            const printContent = generatePrintContent(
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

            printWindow.document.write(printContent);
            printWindow.document.close();

            printWindow.onload = () => {
                printWindow.print();
                printWindow.close();
            };

            console.log('✅ 印刷処理完了');
        } catch (error) {
            console.error('❌ 印刷エラー:', error);
            toast.add({
                severity: 'error',
                summary: 'エラー',
                detail: error.message || '印刷処理に失敗しました',
                life: 5000,
            });
        }
    };

    const generatePrintContent = (
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
        const monthName = `${currentYear}年${currentMonth}月`;
        const storeName = selectedStore?.name || '店舗名';

        let tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>スタッフ</th>
        `;

        daysInMonth.forEach(day => {
            const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][day.dayOfWeek];
            tableHTML += `<th>${day.day}<br><small>${dayOfWeek}</small></th>`;
        });

        tableHTML += `
                        <th>合計時間</th>
                        <th>全店舗合計</th>
                    </tr>
                </thead>
                <tbody>
        `;

        staffList.forEach(staff => {
            tableHTML += `<tr><td><strong>${staff.last_name} ${staff.first_name}</strong></td>`;

            daysInMonth.forEach(day => {
                const shift = getShiftForStaff(staff.id, day.date);
                if (shift) {
                    const hours = calculateTotalHours(shift.start_time, shift.end_time, shift.break_start_time, shift.break_end_time);
                    tableHTML += `
                        <td>
                            ${formatTime(shift.start_time)}-${formatTime(shift.end_time)}<br>
                            <small>${formatHours(hours)}</small>
                        </td>
                    `;
                } else {
                    tableHTML += '<td>-</td>';
                }
            });

            const monthlyHours = staffList
                .filter(s => s.id === staff.id)
                .reduce((total, s) => {
                    return total + daysInMonth.reduce((dayTotal, day) => {
                        const shift = getShiftForStaff(s.id, day.date);
                        return shift ? dayTotal + calculateTotalHours(shift.start_time, shift.end_time, shift.break_start_time, shift.break_end_time) : dayTotal;
                    }, 0);
                }, 0);

            const allStoreHours = calculateTotalHoursAllStores(staff.id);

            tableHTML += `
                <td><strong>${formatHours(monthlyHours)}</strong></td>
                <td><strong>${formatHours(allStoreHours)}</strong></td>
            </tr>`;
        });

        tableHTML += '</tbody></table>';

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${storeName} ${monthName} シフト表</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        margin: 20px; 
                        font-size: 12px; 
                    }
                    h1 { 
                        text-align: center; 
                        margin-bottom: 20px; 
                        font-size: 18px;
                    }
                    table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        margin: 0 auto;
                    }
                    th, td { 
                        border: 1px solid #ddd; 
                        padding: 4px; 
                        text-align: center; 
                        vertical-align: middle;
                        font-size: 10px;
                    }
                    th { 
                        background-color: #f5f5f5; 
                        font-weight: bold; 
                    }
                    small { 
                        font-size: 8px; 
                        color: #666; 
                    }
                    .print-info {
                        text-align: right;
                        margin-top: 20px;
                        font-size: 10px;
                        color: #666;
                    }
                    @media print {
                        body { margin: 0; }
                        table { page-break-inside: avoid; }
                    }
                </style>
            </head>
            <body>
                <h1>${storeName} ${monthName} シフト表</h1>
                ${tableHTML}
                <div class="print-info">
                    印刷日時: ${new Date().toLocaleString('ja-JP')}
                </div>
            </body>
            </html>
        `;
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
        printShift,
    };
}