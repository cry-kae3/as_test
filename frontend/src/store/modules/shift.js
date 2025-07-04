// frontend/src/store/modules/shift.js
import api from '@/api/api';

const state = {
    shifts: [],
    currentShift: null,
    loading: false,
    error: null,
    systemSettings: null,
    allStoreShiftsCache: {},
    lastFetchParams: null
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

    SET_SYSTEM_SETTINGS(state, settings) {
        state.systemSettings = settings;
    },

    SET_ALL_STORE_SHIFTS_CACHE(state, { key, data }) {
        state.allStoreShiftsCache[key] = data;
    },

    CLEAR_ALL_STORE_SHIFTS_CACHE(state) {
        state.allStoreShiftsCache = {};
    },

    SET_LAST_FETCH_PARAMS(state, params) {
        state.lastFetchParams = params;
    },

    CLEAR_SHIFTS(state) {
        state.shifts = [];
        state.currentShift = null;
    }
};

const actions = {
    async fetchShifts({ commit }, params) {
        commit('SET_LOADING', true);
        commit('SET_ERROR', null);

        try {
            console.log('📊 Vuex: シフト一覧取得開始', params);
            const response = await api.get('/shifts', { params });

            console.log('📊 Vuex: シフト一覧取得レスポンス', response.data);
            commit('SET_SHIFTS', response.data);

            return response.data;
        } catch (error) {
            console.error('❌ Vuex: シフト一覧取得エラー', error);
            commit('SET_ERROR', error.response?.data?.message || 'シフト一覧の取得に失敗しました');
            throw error;
        } finally {
            commit('SET_LOADING', false);
        }
    },

    async fetchShiftById({ commit }, id) {
        commit('SET_LOADING', true);
        commit('SET_ERROR', null);

        try {
            console.log('📊 Vuex: シフト詳細取得開始', { id });
            const response = await api.get(`/shifts/${id}`);

            console.log('📊 Vuex: シフト詳細取得レスポンス', response.data);
            commit('SET_CURRENT_SHIFT', response.data);

            return response.data;
        } catch (error) {
            console.error('❌ Vuex: シフト詳細取得エラー', error);
            commit('SET_ERROR', error.response?.data?.message || 'シフト詳細の取得に失敗しました');
            throw error;
        } finally {
            commit('SET_LOADING', false);
        }
    },

    async fetchShiftByYearMonth({ commit }, { year, month, storeId }) {
        commit('SET_LOADING', true);
        commit('SET_ERROR', null);

        try {
            console.log('📊 Vuex: 年月シフト取得開始', { year, month, storeId });

            const params = { store_id: storeId };
            const response = await api.get(`/shifts/${year}/${month}`, { params });

            console.log('📊 Vuex: 年月シフト取得レスポンス', response.data);

            // レスポンスの構造を確認
            if (response.data && response.data.shifts) {
                commit('SET_SHIFTS', response.data.shifts);
                commit('SET_CURRENT_SHIFT', {
                    id: response.data.id,
                    store_id: response.data.store_id,
                    year: response.data.year,
                    month: response.data.month,
                    status: response.data.status
                });
            } else {
                // シフトが存在しない場合
                commit('CLEAR_SHIFTS');
            }

            // パラメータをキャッシュ
            commit('SET_LAST_FETCH_PARAMS', { year, month, storeId });

            return response.data;
        } catch (error) {
            console.error('❌ Vuex: 年月シフト取得エラー', error);

            if (error.response?.status === 404) {
                // シフトが見つからない場合は正常扱い
                console.log('ℹ️ Vuex: シフトが存在しない', { year, month, storeId });
                commit('CLEAR_SHIFTS');
                return {
                    shifts: [],
                    allStoreHours: null,
                    message: 'シフトが見つかりません'
                };
            }

            commit('SET_ERROR', error.response?.data?.message || '年月シフトの取得に失敗しました');
            throw error;
        } finally {
            commit('SET_LOADING', false);
        }
    },

    async fetchAllStoreShifts({ commit }, { year, month }) {
        const cacheKey = `all-${year}-${month}`;

        try {
            console.log('📊 Vuex: 全店舗シフト取得開始', { year, month });

            const response = await api.get('/shifts', {
                params: { year, month }
            });

            console.log('📊 Vuex: 全店舗シフト取得レスポンス', response.data);

            commit('SET_ALL_STORE_SHIFTS_CACHE', {
                key: cacheKey,
                data: response.data || []
            });

            return response.data || [];
        } catch (error) {
            console.error('❌ Vuex: 全店舗シフト取得エラー', error);
            commit('SET_ALL_STORE_SHIFTS_CACHE', {
                key: cacheKey,
                data: []
            });
            return [];
        }
    },

    async fetchSystemSettings({ commit }) {
        try {
            console.log('⚙️ Vuex: システム設定取得開始');
            const response = await api.get('/shifts/system-settings');

            console.log('⚙️ Vuex: システム設定取得レスポンス', response.data);
            commit('SET_SYSTEM_SETTINGS', response.data);

            return response.data;
        } catch (error) {
            console.error('❌ Vuex: システム設定取得エラー', error);
            commit('SET_ERROR', error.response?.data?.message || 'システム設定の取得に失敗しました');
            throw error;
        }
    },

    async createShift({ commit, dispatch }, shiftData) {
        commit('SET_LOADING', true);
        commit('SET_ERROR', null);

        try {
            console.log('➕ Vuex: シフト作成開始', shiftData);
            const response = await api.post('/shifts', shiftData);

            console.log('➕ Vuex: シフト作成レスポンス', response.data);
            commit('SET_CURRENT_SHIFT', response.data);

            return response.data;
        } catch (error) {
            console.error('❌ Vuex: シフト作成エラー', error);
            commit('SET_ERROR', error.response?.data?.message || 'シフトの作成に失敗しました');
            throw error;
        } finally {
            commit('SET_LOADING', false);
        }
    },

    async generateShift({ commit, dispatch }, { storeId, year, month }) {
        commit('SET_LOADING', true);
        commit('SET_ERROR', null);

        try {
            console.log('🤖 Vuex: AI シフト生成開始', { storeId, year, month });
            const response = await api.post('/shifts/generate', {
                storeId,
                year,
                month
            });

            console.log('🤖 Vuex: AI シフト生成レスポンス', response.data);

            return response.data;
        } catch (error) {
            console.error('❌ Vuex: AI シフト生成エラー', error);
            commit('SET_ERROR', error.response?.data?.message || 'AIシフト生成に失敗しました');
            throw error;
        } finally {
            commit('SET_LOADING', false);
        }
    },

    async deleteShift({ commit, dispatch }, { year, month, storeId }) {
        commit('SET_LOADING', true);
        commit('SET_ERROR', null);

        try {
            console.log('🗑️ Vuex: シフト削除開始', { year, month, storeId });

            const params = { store_id: storeId };
            const response = await api.delete(`/shifts/${year}/${month}`, { params });

            console.log('🗑️ Vuex: シフト削除レスポンス', response.data);

            // シフト削除後、状態をクリア
            commit('CLEAR_SHIFTS');

            // キャッシュもクリア
            commit('CLEAR_ALL_STORE_SHIFTS_CACHE');

            return response.data;
        } catch (error) {
            console.error('❌ Vuex: シフト削除エラー', error);
            commit('SET_ERROR', error.response?.data?.message || 'シフトの削除に失敗しました');
            throw error;
        } finally {
            commit('SET_LOADING', false);
        }
    },

    async updateShift({ commit, dispatch }, { id, ...updateData }) {
        commit('SET_LOADING', true);
        commit('SET_ERROR', null);

        try {
            console.log('🔄 Vuex: シフト更新開始', { id, updateData });
            const response = await api.put(`/shifts/${id}`, updateData);

            console.log('🔄 Vuex: シフト更新レスポンス', response.data);
            commit('SET_CURRENT_SHIFT', response.data);

            return response.data;
        } catch (error) {
            console.error('❌ Vuex: シフト更新エラー', error);
            commit('SET_ERROR', error.response?.data?.message || 'シフトの更新に失敗しました');
            throw error;
        } finally {
            commit('SET_LOADING', false);
        }
    },

    async confirmShift({ commit, dispatch }, { year, month, store_id }) {
        commit('SET_LOADING', true);
        commit('SET_ERROR', null);

        try {
            console.log('✅ Vuex: シフト確定開始', { year, month, store_id });
            const response = await api.post(`/shifts/${year}/${month}/confirm`, { store_id });

            console.log('✅ Vuex: シフト確定レスポンス', response.data);

            if (response.data.shift) {
                commit('SET_CURRENT_SHIFT', response.data.shift);
            }

            return response.data;
        } catch (error) {
            console.error('❌ Vuex: シフト確定エラー', error);
            commit('SET_ERROR', error.response?.data?.message || 'シフトの確定に失敗しました');
            throw error;
        } finally {
            commit('SET_LOADING', false);
        }
    },

    async createShiftAssignment({ commit, dispatch }, { year, month, ...assignmentData }) {
        commit('SET_LOADING', true);
        commit('SET_ERROR', null);

        try {
            console.log('➕ Vuex: シフト割り当て作成開始', { year, month, assignmentData });
            const response = await api.post(`/shifts/${year}/${month}/assignments`, assignmentData);

            console.log('➕ Vuex: シフト割り当て作成レスポンス', response.data);

            return response.data;
        } catch (error) {
            console.error('❌ Vuex: シフト割り当て作成エラー', error);
            commit('SET_ERROR', error.response?.data?.message || 'シフト割り当ての作成に失敗しました');
            throw error;
        } finally {
            commit('SET_LOADING', false);
        }
    },

    async updateShiftAssignment({ commit, dispatch }, { year, month, assignmentId, ...assignmentData }) {
        commit('SET_LOADING', true);
        commit('SET_ERROR', null);

        try {
            console.log('🔄 Vuex: シフト割り当て更新開始', { year, month, assignmentId, assignmentData });
            const response = await api.put(`/shifts/${year}/${month}/assignments/${assignmentId}`, assignmentData);

            console.log('🔄 Vuex: シフト割り当て更新レスポンス', response.data);

            return response.data;
        } catch (error) {
            console.error('❌ Vuex: シフト割り当て更新エラー', error);
            commit('SET_ERROR', error.response?.data?.message || 'シフト割り当ての更新に失敗しました');
            throw error;
        } finally {
            commit('SET_LOADING', false);
        }
    },

    async deleteShiftAssignment({ commit, dispatch }, { year, month, assignmentId, change_reason }) {
        commit('SET_LOADING', true);
        commit('SET_ERROR', null);

        try {
            console.log('🗑️ Vuex: シフト割り当て削除開始', { year, month, assignmentId, change_reason });

            const config = {
                data: { change_reason }
            };

            const response = await api.delete(`/shifts/${year}/${month}/assignments/${assignmentId}`, config);

            console.log('🗑️ Vuex: シフト割り当て削除レスポンス', response.data);

            return response.data;
        } catch (error) {
            console.error('❌ Vuex: シフト割り当て削除エラー', error);
            commit('SET_ERROR', error.response?.data?.message || 'シフト割り当ての削除に失敗しました');
            throw error;
        } finally {
            commit('SET_LOADING', false);
        }
    },

    async validateShift({ commit }, { year, month, storeId }) {
        try {
            console.log('🔍 Vuex: シフト検証開始', { year, month, storeId });
            const params = { store_id: storeId };
            const response = await api.get(`/shifts/${year}/${month}/validate`, { params });

            console.log('🔍 Vuex: シフト検証レスポンス', response.data);

            return response.data;
        } catch (error) {
            console.error('❌ Vuex: シフト検証エラー', error);
            commit('SET_ERROR', error.response?.data?.message || 'シフトの検証に失敗しました');
            throw error;
        }
    },

    async fetchShiftChangeLogs({ commit }, { year, month, storeId }) {
        try {
            console.log('📋 Vuex: シフト変更ログ取得開始', { year, month, storeId });
            const params = { store_id: storeId };
            const response = await api.get(`/shifts/${year}/${month}/logs`, { params });

            console.log('📋 Vuex: シフト変更ログ取得レスポンス', response.data);

            return response.data;
        } catch (error) {
            console.error('❌ Vuex: シフト変更ログ取得エラー', error);
            commit('SET_ERROR', error.response?.data?.message || 'シフト変更ログの取得に失敗しました');
            throw error;
        }
    },

    async fetchStaffTotalHours({ commit }, { year, month, storeId }) {
        try {
            console.log('📊 Vuex: スタッフ総勤務時間取得開始', { year, month, storeId });
            const params = { year, month, store_id: storeId };
            const response = await api.get('/shifts/staff-total-hours', { params });

            console.log('📊 Vuex: スタッフ総勤務時間取得レスポンス', response.data);

            return response.data;
        } catch (error) {
            console.error('❌ Vuex: スタッフ総勤務時間取得エラー', error);
            commit('SET_ERROR', error.response?.data?.message || 'スタッフ総勤務時間の取得に失敗しました');
            throw error;
        }
    },

    // キャッシュ関連のアクション
    clearCache({ commit }) {
        console.log('🧹 Vuex: キャッシュクリア');
        commit('CLEAR_ALL_STORE_SHIFTS_CACHE');
    },

    // エラークリア
    clearError({ commit }) {
        commit('SET_ERROR', null);
    },

    // 状態リセット
    resetState({ commit }) {
        console.log('🔄 Vuex: 状態リセット');
        commit('CLEAR_SHIFTS');
        commit('CLEAR_ALL_STORE_SHIFTS_CACHE');
        commit('SET_ERROR', null);
        commit('SET_LOADING', false);
    }
};

const getters = {
    isLoading: (state) => state.loading,

    hasError: (state) => !!state.error,

    errorMessage: (state) => state.error,

    shifts: (state) => state.shifts || [],

    currentShift: (state) => state.currentShift,

    hasCurrentShift: (state) => !!state.currentShift,

    systemSettings: (state) => state.systemSettings,

    allStoreShiftsCache: (state) => state.allStoreShiftsCache,

    lastFetchParams: (state) => state.lastFetchParams,

    // 特定の日付のシフトを取得
    getShiftsByDate: (state) => (date) => {
        if (!state.shifts || !state.shifts.length) return [];
        return state.shifts.filter(shift => shift.date === date);
    },

    // 特定のスタッフの全シフトを取得
    getShiftsByStaff: (state) => (staffId) => {
        if (!state.shifts || !state.shifts.length) return [];
        const allAssignments = [];

        state.shifts.forEach(shift => {
            if (shift.assignments) {
                const staffAssignments = shift.assignments.filter(assignment =>
                    assignment.staff_id === staffId
                );
                allAssignments.push(...staffAssignments.map(assignment => ({
                    ...assignment,
                    date: shift.date
                })));
            }
        });

        return allAssignments;
    },

    // 特定の日付・スタッフのシフトを取得
    getShiftByDateAndStaff: (state) => (date, staffId) => {
        if (!state.shifts || !state.shifts.length) return null;

        const dayShift = state.shifts.find(shift => shift.date === date);
        if (!dayShift || !dayShift.assignments) return null;

        return dayShift.assignments.find(assignment => assignment.staff_id === staffId) || null;
    },

    // キャッシュから全店舗シフトを取得
    getAllStoreShiftsByKey: (state) => (cacheKey) => {
        return state.allStoreShiftsCache[cacheKey] || [];
    },

    // 月間統計情報
    getMonthlyStats: (state) => {
        if (!state.shifts || !state.shifts.length) {
            return {
                totalDays: 0,
                daysWithShifts: 0,
                totalAssignments: 0,
                uniqueStaff: 0
            };
        }

        const daysWithShifts = state.shifts.filter(shift =>
            shift.assignments && shift.assignments.length > 0
        ).length;

        const totalAssignments = state.shifts.reduce((total, shift) => {
            return total + (shift.assignments ? shift.assignments.length : 0);
        }, 0);

        const uniqueStaffIds = new Set();
        state.shifts.forEach(shift => {
            if (shift.assignments) {
                shift.assignments.forEach(assignment => {
                    uniqueStaffIds.add(assignment.staff_id);
                });
            }
        });

        return {
            totalDays: state.shifts.length,
            daysWithShifts,
            totalAssignments,
            uniqueStaff: uniqueStaffIds.size
        };
    }
};

export default {
    namespaced: true,
    state,
    mutations,
    actions,
    getters
};