import api from '../../services/api';

const state = {
    shifts: [],
    currentShift: null,
    loading: false,
    error: null,
};

const mutations = {
    SET_LOADING(state, loading) {
        state.loading = loading;
    },
    SET_ERROR(state, error) {
        state.error = error;
    },
    SET_SHIFTS(state, shifts) {
        state.shifts = shifts || [];
    },
    SET_CURRENT_SHIFT(state, shift) {
        state.currentShift = shift;
    },
    CLEAR_CURRENT_SHIFT(state) {
        state.currentShift = null;
    },
    ADD_SHIFT_ASSIGNMENT(state, assignment) {
        if (state.shifts) {
            state.shifts.push(assignment);
        }
    },
    UPDATE_SHIFT_ASSIGNMENT(state, updatedAssignment) {
        if (state.shifts) {
            const index = state.shifts.findIndex(shift => shift.id === updatedAssignment.id);
            if (index !== -1) {
                state.shifts.splice(index, 1, updatedAssignment);
            }
        }
    },
    REMOVE_SHIFT_ASSIGNMENT(state, assignmentId) {
        if (state.shifts) {
            state.shifts = state.shifts.filter(shift => shift.id !== assignmentId);
        }
    },
};

const actions = {
    async fetchShifts({ commit }) {
        commit('SET_LOADING', true);
        commit('SET_ERROR', null);

        try {
            const response = await api.get('/shifts');
            commit('SET_SHIFTS', response.data);
            return response.data;
        } catch (error) {
            commit('SET_ERROR', error.message);
            throw error;
        } finally {
            commit('SET_LOADING', false);
        }
    },

    async fetchShiftByYearMonth({ commit }, { year, month, storeId }) {
        commit('SET_LOADING', true);
        commit('SET_ERROR', null);

        try {
            console.log('🔄 Vuex fetchShiftByYearMonth:', { year, month, storeId });

            const response = await api.get(`/shifts/${year}/${month}`, {
                params: { store_id: storeId }
            });

            console.log('📊 fetchShiftByYearMonth レスポンス:', response.data);

            commit('SET_CURRENT_SHIFT', response.data);
            commit('SET_SHIFTS', response.data.shifts || []);

            return response.data;
        } catch (error) {
            console.error('❌ fetchShiftByYearMonth エラー:', error);

            // 404エラー（シフトが存在しない）の場合は状態をクリア
            if (error.response?.status === 404) {
                commit('CLEAR_CURRENT_SHIFT');
                commit('SET_SHIFTS', []);
                return null;
            }

            commit('SET_ERROR', error.message);
            throw error;
        } finally {
            commit('SET_LOADING', false);
        }
    },

    async createShift({ commit }, shiftData) {
        commit('SET_LOADING', true);
        commit('SET_ERROR', null);

        try {
            console.log('➕ Vuex createShift:', shiftData);

            const response = await api.post('/shifts', shiftData);

            console.log('✅ createShift レスポンス:', response.data);

            commit('SET_CURRENT_SHIFT', response.data);

            return response.data;
        } catch (error) {
            console.error('❌ createShift エラー:', error);
            commit('SET_ERROR', error.message);
            const errorMessage = error.response?.data?.message || 'シフトの作成に失敗しました';
            throw new Error(errorMessage);
        } finally {
            commit('SET_LOADING', false);
        }
    },

    async deleteShift({ commit }, { year, month, storeId }) {
        commit('SET_LOADING', true);
        commit('SET_ERROR', null);

        try {
            console.log('🗑️ Vuex deleteShift action:', { year, month, storeId });

            const response = await api.delete(`/shifts/${year}/${month}`, {
                params: { store_id: storeId }
            });

            console.log('✅ deleteShift API レスポンス:', response.data);

            // ストアの状態をクリア
            commit('CLEAR_CURRENT_SHIFT');
            commit('SET_SHIFTS', []);

            return response.data;
        } catch (error) {
            console.error('❌ deleteShift API エラー:', error);
            commit('SET_ERROR', error.message);
            const errorMessage = error.response?.data?.message || 'シフトの削除に失敗しました';
            throw new Error(errorMessage);
        } finally {
            commit('SET_LOADING', false);
        }
    },

    async generateShift({ commit }, { storeId, year, month }) {
        commit('SET_LOADING', true);
        commit('SET_ERROR', null);

        try {
            console.log('🤖 Vuex generateShift:', { storeId, year, month });

            const response = await api.post('/shifts/generate', {
                storeId,
                year,
                month,
            });

            console.log('✅ generateShift レスポンス:', response.data);

            return response.data;
        } catch (error) {
            console.error('❌ generateShift エラー:', error);
            commit('SET_ERROR', error.message);
            const errorMessage = error.response?.data?.message || 'AIシフト生成に失敗しました';
            throw new Error(errorMessage);
        } finally {
            commit('SET_LOADING', false);
        }
    },

    async createShiftAssignment({ commit }, assignmentData) {
        commit('SET_LOADING', true);
        commit('SET_ERROR', null);

        try {
            console.log('➕ Vuex createShiftAssignment:', assignmentData);

            const { year, month, ...payload } = assignmentData;
            const response = await api.post(`/shifts/${year}/${month}/assignments`, payload);

            console.log('✅ createShiftAssignment レスポンス:', response.data);

            commit('ADD_SHIFT_ASSIGNMENT', response.data);

            return response.data;
        } catch (error) {
            console.error('❌ createShiftAssignment エラー:', error);
            commit('SET_ERROR', error.message);
            throw error;
        } finally {
            commit('SET_LOADING', false);
        }
    },

    async updateShiftAssignment({ commit }, { year, month, assignmentId, ...assignmentData }) {
        commit('SET_LOADING', true);
        commit('SET_ERROR', null);

        try {
            console.log('📝 Vuex updateShiftAssignment:', { year, month, assignmentId, assignmentData });

            const response = await api.put(`/shifts/${year}/${month}/assignments/${assignmentId}`, assignmentData);

            console.log('✅ updateShiftAssignment レスポンス:', response.data);

            commit('UPDATE_SHIFT_ASSIGNMENT', response.data);

            return response.data;
        } catch (error) {
            console.error('❌ updateShiftAssignment エラー:', error);
            commit('SET_ERROR', error.message);
            throw error;
        } finally {
            commit('SET_LOADING', false);
        }
    },

    async deleteShiftAssignment({ commit }, { year, month, assignmentId, change_reason }) {
        commit('SET_LOADING', true);
        commit('SET_ERROR', null);

        try {
            console.log('🗑️ Vuex deleteShiftAssignment:', { year, month, assignmentId, change_reason });

            await api.delete(`/shifts/${year}/${month}/assignments/${assignmentId}`, {
                data: { change_reason }
            });

            console.log('✅ deleteShiftAssignment 完了');

            commit('REMOVE_SHIFT_ASSIGNMENT', assignmentId);

            return true;
        } catch (error) {
            console.error('❌ deleteShiftAssignment エラー:', error);
            commit('SET_ERROR', error.message);
            const errorMessage = error.response?.data?.message || 'シフト割り当ての削除に失敗しました';
            throw new Error(errorMessage);
        } finally {
            commit('SET_LOADING', false);
        }
    },

    async validateShift({ commit }, { year, month, storeId }) {
        commit('SET_LOADING', true);
        commit('SET_ERROR', null);

        try {
            console.log('🔍 Vuex validateShift:', { year, month, storeId });

            const response = await api.get(`/shifts/${year}/${month}/validate`, {
                params: { store_id: storeId }
            });

            console.log('✅ validateShift レスポンス:', response.data);

            return response.data;
        } catch (error) {
            console.error('❌ validateShift エラー:', error);
            commit('SET_ERROR', error.message);
            const errorMessage = error.response?.data?.message || 'シフト検証に失敗しました';
            throw new Error(errorMessage);
        } finally {
            commit('SET_LOADING', false);
        }
    },

    async confirmShift({ commit }, { year, month, storeId }) {
        commit('SET_LOADING', true);
        commit('SET_ERROR', null);

        try {
            console.log('✅ Vuex confirmShift:', { year, month, storeId });

            const response = await api.post(`/shifts/${year}/${month}/confirm`, {
                store_id: storeId
            });

            console.log('✅ confirmShift レスポンス:', response.data);

            // 現在のシフトステータスを更新
            if (state.currentShift) {
                commit('SET_CURRENT_SHIFT', {
                    ...state.currentShift,
                    status: 'confirmed'
                });
            }

            return response.data;
        } catch (error) {
            console.error('❌ confirmShift エラー:', error);
            commit('SET_ERROR', error.message);
            const errorMessage = error.response?.data?.message || 'シフト確定に失敗しました';
            throw new Error(errorMessage);
        } finally {
            commit('SET_LOADING', false);
        }
    },

    async fetchShiftChangeLogs({ commit }, { year, month, storeId }) {
        commit('SET_LOADING', true);
        commit('SET_ERROR', null);

        try {
            console.log('📋 Vuex fetchShiftChangeLogs:', { year, month, storeId });

            const response = await api.get(`/shifts/${year}/${month}/logs`, {
                params: { store_id: storeId }
            });

            console.log('✅ fetchShiftChangeLogs レスポンス:', response.data);

            return response.data;
        } catch (error) {
            console.error('❌ fetchShiftChangeLogs エラー:', error);
            commit('SET_ERROR', error.message);
            const errorMessage = error.response?.data?.message || 'シフト変更ログの取得に失敗しました';
            throw new Error(errorMessage);
        } finally {
            commit('SET_LOADING', false);
        }
    },
};

const getters = {
    shifts: state => state.shifts,
    currentShift: state => state.currentShift,
    loading: state => state.loading,
    error: state => state.error,
    hasCurrentShift: state => !!(state.currentShift && state.currentShift.id),
};

export default {
    namespaced: true,
    state,
    mutations,
    actions,
    getters,
};