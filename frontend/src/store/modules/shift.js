import api from '@/services/api';

const state = {
    shifts: [],
    currentShift: null,
    currentShiftData: null,
    validationResults: null,
    changeLogs: [],
    allStoreHours: null,
    loading: false,
    error: null,
    generating: false
};

const getters = {
    allShifts: (state) => state.shifts,
    currentShift: (state) => state.currentShift,
    currentShiftData: (state) => state.currentShiftData,
    validationResults: (state) => state.validationResults,
    changeLogs: (state) => state.changeLogs,
    allStoreHours: (state) => state.allStoreHours,
    loading: (state) => state.loading,
    generating: (state) => state.generating,
    error: (state) => state.error
};

const actions = {
    async fetchShifts({ commit }, params = {}) {
        commit('setLoading', true);
        commit('clearError');
        try {
            const queryParams = Object.entries(params).filter(([_, value]) => value !== null && value !== undefined).map(([key, value]) => `${key}=${value}`).join('&');
            const url = queryParams ? `/shifts?${queryParams}` : '/shifts';
            const response = await api.get(url);
            commit('setShifts', response.data);
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || 'シフト一覧の取得に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    async fetchShiftById({ commit }, id) {
        commit('setLoading', true);
        commit('clearError');
        try {
            const response = await api.get(`/shifts/${id}`);
            commit('setCurrentShift', response.data);
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || 'シフト情報の取得に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    async fetchShiftByYearMonth({ commit }, { year, month, storeId }) {
        commit('setLoading', true);
        commit('clearError');
        try {
            const response = await api.get(`/shifts/${year}/${month}?store_id=${storeId}`);
            commit('setCurrentShiftData', response.data);
            commit('setCurrentShift', { id: response.data.id, store_id: response.data.store_id, year: response.data.year, month: response.data.month, status: response.data.status });
            if (response.data.allStoreHours) {
                commit('setAllStoreHours', response.data.allStoreHours);
            }
            return response.data;
        } catch (error) {
            if (error.response && error.response.status === 404) {
                commit('setCurrentShiftData', null);
                commit('setCurrentShift', null);
                commit('setAllStoreHours', null);
                return null;
            } else {
                const message = error.response?.data?.message || 'シフト情報の取得に失敗しました';
                commit('setError', message);
                throw error;
            }
        } finally {
            commit('setLoading', false);
        }
    },

    async fetchStaffTotalHoursAllStores({ commit }, { year, month, storeId }) {
        commit('setLoading', true);
        commit('clearError');
        try {
            const response = await api.get('/shifts/staff-total-hours', { params: { year, month, store_id: storeId } });
            commit('setAllStoreHours', response.data);
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || '全店舗時間集計の取得に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    async createShift({ commit }, shiftData) {
        commit('setLoading', true);
        commit('clearError');
        try {
            const response = await api.post('/shifts', shiftData);
            commit('setCurrentShift', response.data);
            commit('addShift', response.data);
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || 'シフトの作成に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    async deleteShift({ commit }, { year, month, storeId }) {
        commit('setLoading', true);
        commit('clearError');
        try {
            await api.delete(`/shifts/${year}/${month}?store_id=${storeId}`);
            commit('removeShift', { year, month, storeId });
            commit('setCurrentShift', null);
            commit('setCurrentShiftData', null);
            commit('setAllStoreHours', null);
            return true;
        } catch (error) {
            const message = error.response?.data?.message || 'シフトの削除に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    async generateShift({ commit }, { storeId, year, month }) {
        commit('setGenerating', true);
        commit('clearError');
        try {
            const response = await api.post('/shifts/generate', { storeId, year, month });
            commit('setCurrentShiftData', response.data);
            commit('setCurrentShift', { id: response.data.id, store_id: response.data.store_id, year: response.data.year, month: response.data.month, status: response.data.status });
            if (response.data.allStoreHours) {
                commit('setAllStoreHours', response.data.allStoreHours);
            }
            if (response.data.summary && response.data.summary.staffingWarnings) {
                commit('setValidationResults', { isValid: response.data.summary.staffingWarnings.length === 0, warnings: response.data.summary.staffingWarnings });
            }
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || 'シフト生成に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setGenerating', false);
        }
    },

    async validateShift({ commit }, { year, month, storeId }) {
        commit('setLoading', true);
        commit('clearError');
        try {
            const response = await api.get(`/shifts/${year}/${month}/validate?store_id=${storeId}`);
            commit('setValidationResults', response.data);
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || 'シフト検証に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    async confirmShift({ commit }, { year, month, storeId }) {
        commit('setLoading', true);
        commit('clearError');
        try {
            await api.post(`/shifts/${year}/${month}/confirm`, { store_id: storeId });
            commit('updateShiftStatus', { year, month, storeId, status: 'confirmed' });
            return true;
        } catch (error) {
            const message = error.response?.data?.message || 'シフト確定に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    async createShiftAssignment({ commit }, { year, month, assignmentData }) {
        commit('setLoading', true);
        commit('clearError');
        try {
            const response = await api.post(`/shifts/${year}/${month}/assignments`, assignmentData);
            commit('addShiftAssignment', { date: assignmentData.date, assignment: response.data });
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || 'シフト割り当ての作成に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    async updateShiftAssignment({ commit }, { year, month, assignmentId, assignmentData }) {
        commit('setLoading', true);
        commit('clearError');
        try {
            const response = await api.put(`/shifts/${year}/${month}/assignments/${assignmentId}`, assignmentData);
            commit('updateShiftAssignmentData', response.data);
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || 'シフト割り当ての更新に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    async deleteShiftAssignment({ commit }, { year, month, assignmentId, change_reason }) {
        commit('setLoading', true);
        commit('clearError');
        try {
            const requestData = change_reason ? { change_reason } : {};
            await api.delete(`/shifts/${year}/${month}/assignments/${assignmentId}`, { data: requestData });
            commit('removeShiftAssignment', assignmentId);
            return true;
        } catch (error) {
            const message = error.response?.data?.message || 'シフト割り当ての削除に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    async fetchShiftChangeLogs({ commit }, { year, month, storeId }) {
        commit('setLoading', true);
        commit('clearError');
        try {
            const response = await api.get(`/shifts/${year}/${month}/logs?store_id=${storeId}`);
            commit('setChangeLogs', response.data);
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || 'シフト変更履歴の取得に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    }
};

const mutations = {
    setShifts(state, shifts) {
        state.shifts = shifts;
    },
    setCurrentShift(state, shift) {
        state.currentShift = shift;
    },
    setCurrentShiftData(state, shiftData) {
        state.currentShiftData = shiftData;
    },
    setAllStoreHours(state, allStoreHours) {
        state.allStoreHours = allStoreHours;
    },
    addShift(state, shift) {
        const existingIndex = state.shifts.findIndex(s => s.store_id === shift.store_id && s.year === shift.year && s.month === shift.month);
        if (existingIndex !== -1) {
            state.shifts.splice(existingIndex, 1, shift);
        } else {
            state.shifts.push(shift);
        }
    },
    removeShift(state, { year, month, storeId }) {
        state.shifts = state.shifts.filter(shift => !(shift.year === parseInt(year) && shift.month === parseInt(month) && shift.store_id === parseInt(storeId)));
    },
    setValidationResults(state, results) {
        state.validationResults = results;
    },
    setChangeLogs(state, logs) {
        state.changeLogs = logs;
    },
    updateShiftStatus(state, { year, month, storeId, status }) {
        if (state.currentShift && state.currentShift.year === parseInt(year) && state.currentShift.month === parseInt(month) && state.currentShift.store_id === parseInt(storeId)) {
            state.currentShift.status = status;
        }
        if (state.currentShiftData) {
            state.currentShiftData.status = status;
        }
        const index = state.shifts.findIndex(shift => shift.year === parseInt(year) && shift.month === parseInt(month) && shift.store_id === parseInt(storeId));
        if (index !== -1) {
            state.shifts[index].status = status;
        }
    },
    addShiftAssignment(state, { date, assignment }) {
        if (!state.currentShiftData) return;
        const dayShift = state.currentShiftData.shifts.find(shift => shift.date === date);
        if (dayShift) {
            dayShift.assignments.push(assignment);
        } else {
            state.currentShiftData.shifts.push({ date, assignments: [assignment] });
        }
        const staffSummary = state.currentShiftData.summary.totalHoursByStaff.find(summary => summary.staff_id === assignment.staff_id);
        if (staffSummary) {
            const startTime = new Date(`2000-01-01T${assignment.start_time}`);
            const endTime = new Date(`2000-01-01T${assignment.end_time}`);
            let duration = (endTime - startTime) / (1000 * 60 * 60);
            if (assignment.break_start_time && assignment.break_end_time) {
                const breakStart = new Date(`2000-01-01T${assignment.break_start_time}`);
                const breakEnd = new Date(`2000-01-01T${assignment.break_end_time}`);
                const breakDuration = (breakEnd - breakStart) / (1000 * 60 * 60);
                duration -= breakDuration;
            }
            staffSummary.total_hours += parseFloat(duration.toFixed(2));
        } else {
            const startTime = new Date(`2000-01-01T${assignment.start_time}`);
            const endTime = new Date(`2000-01-01T${assignment.end_time}`);
            let duration = (endTime - startTime) / (1000 * 60 * 60);
            if (assignment.break_start_time && assignment.break_end_time) {
                const breakStart = new Date(`2000-01-01T${assignment.break_start_time}`);
                const breakEnd = new Date(`2000-01-01T${assignment.break_end_time}`);
                const breakDuration = (breakEnd - breakStart) / (1000 * 60 * 60);
                duration -= breakDuration;
            }
            state.currentShiftData.summary.totalHoursByStaff.push({ staff_id: assignment.staff_id, staff_name: assignment.staff_name, total_hours: parseFloat(duration.toFixed(2)) });
        }
    },
    updateShiftAssignmentData(state, updatedAssignment) {
        if (!state.currentShiftData) return;
        let found = false;
        let oldStaffId = null;
        let oldDuration = 0;
        let newDuration = 0;
        for (const dayShift of state.currentShiftData.shifts) {
            const index = dayShift.assignments.findIndex(a => a.id === updatedAssignment.id);
            if (index !== -1) {
                const oldAssignment = dayShift.assignments[index];
                oldStaffId = oldAssignment.staff_id;
                const oldStartTime = new Date(`2000-01-01T${oldAssignment.start_time}`);
                const oldEndTime = new Date(`2000-01-01T${oldAssignment.end_time}`);
                oldDuration = (oldEndTime - oldStartTime) / (1000 * 60 * 60);
                if (oldAssignment.break_start_time && oldAssignment.break_end_time) {
                    const oldBreakStart = new Date(`2000-01-01T${oldAssignment.break_start_time}`);
                    const oldBreakEnd = new Date(`2000-01-01T${oldAssignment.break_end_time}`);
                    const oldBreakDuration = (oldBreakEnd - oldBreakStart) / (1000 * 60 * 60);
                    oldDuration -= oldBreakDuration;
                }
                const newStartTime = new Date(`2000-01-01T${updatedAssignment.start_time}`);
                const newEndTime = new Date(`2000-01-01T${updatedAssignment.end_time}`);
                newDuration = (newEndTime - newStartTime) / (1000 * 60 * 60);
                if (updatedAssignment.break_start_time && updatedAssignment.break_end_time) {
                    const newBreakStart = new Date(`2000-01-01T${updatedAssignment.break_start_time}`);
                    const newBreakEnd = new Date(`2000-01-01T${updatedAssignment.break_end_time}`);
                    const newBreakDuration = (newBreakEnd - newBreakStart) / (1000 * 60 * 60);
                    newDuration -= newBreakDuration;
                }
                dayShift.assignments.splice(index, 1, updatedAssignment);
                found = true;
                break;
            }
        }
        if (found && state.currentShiftData.summary) {
            if (oldStaffId === updatedAssignment.staff_id) {
                const staffSummary = state.currentShiftData.summary.totalHoursByStaff.find(summary => summary.staff_id === updatedAssignment.staff_id);
                if (staffSummary) {
                    staffSummary.total_hours = parseFloat((staffSummary.total_hours - oldDuration + newDuration).toFixed(2));
                }
            } else {
                const oldStaffSummary = state.currentShiftData.summary.totalHoursByStaff.find(summary => summary.staff_id === oldStaffId);
                if (oldStaffSummary) {
                    oldStaffSummary.total_hours = parseFloat((oldStaffSummary.total_hours - oldDuration).toFixed(2));
                }
                const newStaffSummary = state.currentShiftData.summary.totalHoursByStaff.find(summary => summary.staff_id === updatedAssignment.staff_id);
                if (newStaffSummary) {
                    newStaffSummary.total_hours = parseFloat((newStaffSummary.total_hours + newDuration).toFixed(2));
                } else {
                    state.currentShiftData.summary.totalHoursByStaff.push({ staff_id: updatedAssignment.staff_id, staff_name: updatedAssignment.staff_name, total_hours: parseFloat(newDuration.toFixed(2)) });
                }
            }
        }
    },
    removeShiftAssignment(state, assignmentId) {
        if (!state.currentShiftData) return;
        let removedAssignment = null;
        let removedDate = null;
        for (const dayShift of state.currentShiftData.shifts) {
            const index = dayShift.assignments.findIndex(a => a.id === assignmentId);
            if (index !== -1) {
                removedAssignment = dayShift.assignments[index];
                removedDate = dayShift.date;
                dayShift.assignments.splice(index, 1);
                if (dayShift.assignments.length === 0) {
                    const dayIndex = state.currentShiftData.shifts.findIndex(s => s.date === dayShift.date);
                    if (dayIndex !== -1) {
                        state.currentShiftData.shifts.splice(dayIndex, 1);
                    }
                }
                break;
            }
        }
        if (removedAssignment && state.currentShiftData.summary) {
            const staffSummary = state.currentShiftData.summary.totalHoursByStaff.find(summary => summary.staff_id === removedAssignment.staff_id);
            if (staffSummary) {
                const startTime = new Date(`2000-01-01T${removedAssignment.start_time}`);
                const endTime = new Date(`2000-01-01T${removedAssignment.end_time}`);
                let duration = (endTime - startTime) / (1000 * 60 * 60);
                if (removedAssignment.break_start_time && removedAssignment.break_end_time) {
                    const breakStart = new Date(`2000-01-01T${removedAssignment.break_start_time}`);
                    const breakEnd = new Date(`2000-01-01T${removedAssignment.break_end_time}`);
                    const breakDuration = (breakEnd - breakStart) / (1000 * 60 * 60);
                    duration -= breakDuration;
                }
                staffSummary.total_hours = parseFloat((staffSummary.total_hours - duration).toFixed(2));
                if (staffSummary.total_hours <= 0) {
                    const summaryIndex = state.currentShiftData.summary.totalHoursByStaff.findIndex(summary => summary.staff_id === removedAssignment.staff_id);
                    if (summaryIndex !== -1) {
                        state.currentShiftData.summary.totalHoursByStaff.splice(summaryIndex, 1);
                    }
                }
            }
        }
    },
    setLoading(state, loading) {
        state.loading = loading;
    },
    setGenerating(state, generating) {
        state.generating = generating;
    },
    setError(state, error) {
        state.error = error;
    },
    clearError(state) {
        state.error = null;
    }
};

export default {
    namespaced: true,
    state,
    getters,
    actions,
    mutations
};