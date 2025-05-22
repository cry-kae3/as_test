// frontend/src/store/modules/staff.js
import api from '@/services/api';

// 初期状態
const state = {
    staff: [],
    currentStaff: null,
    loading: false,
    error: null
};

// ゲッター
const getters = {
    allStaff: (state) => state.staff,
    currentStaff: (state) => state.currentStaff,
    loading: (state) => state.loading,
    error: (state) => state.error
};

// アクション
const actions = {
    // スタッフの休み希望を取得
    async fetchDayOffRequests({ commit, rootGetters }, params) {
        try {
            let url = '/staff/day-off-requests';
            const queryParams = [];

            if (params && params.status) {
                queryParams.push(`status=${params.status}`);
            }

            // 権限に基づく店舗フィルタリング
            const visibleStoreId = rootGetters['auth/visibleStoreId'];
            if (visibleStoreId) {
                queryParams.push(`store_id=${visibleStoreId}`);
            } else if (params && params.store_id) {
                queryParams.push(`store_id=${params.store_id}`);
            }

            if (queryParams.length > 0) {
                url += `?${queryParams.join('&')}`;
            }

            const response = await api.get(url);
            return response.data || [];
        } catch (error) {
            console.error('休み希望取得エラー:', error);
            return [];
        }
    },

    // 休み希望のステータスを更新
    async updateDayOffRequestStatus({ commit }, { staffId, requestId, status }) {
        try {
            const response = await api.patch(`/staff/${staffId}/day-off-requests/${requestId}`, { status });
            return response.data;
        } catch (error) {
            console.error('休み希望ステータス更新エラー:', error);
            throw error;
        }
    },

    // スタッフ一覧の取得（権限フィルタリング付き）
    async fetchStaff({ commit, rootGetters }, storeId) {
        commit('setLoading', true);
        commit('clearError');

        try {
            // 権限に基づく店舗IDの決定
            const visibleStoreId = rootGetters['auth/visibleStoreId'];
            const targetStoreId = visibleStoreId || storeId;

            const url = targetStoreId ? `/staff?store_id=${targetStoreId}` : '/staff';
            const response = await api.get(url);

            // 追加の権限フィルタリング（念のため）
            let filteredStaff = response.data;
            if (rootGetters['auth/shouldFilterByUser']) {
                const effectiveUser = rootGetters['auth/effectiveUser'];
                if (effectiveUser && effectiveUser.store_id) {
                    filteredStaff = response.data.filter(staff => staff.store_id === effectiveUser.store_id);
                }
            }

            commit('setStaff', filteredStaff);
            return filteredStaff;
        } catch (error) {
            const message = error.response?.data?.message || 'スタッフ一覧の取得に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    // 特定のスタッフ情報の取得
    async fetchStaffById({ commit, rootGetters }, id) {
        commit('setLoading', true);
        commit('clearError');

        try {
            const response = await api.get(`/staff/${id}`);

            // 権限チェック：自分の店舗のスタッフのみアクセス可能
            if (rootGetters['auth/shouldFilterByUser']) {
                const effectiveUser = rootGetters['auth/effectiveUser'];
                if (effectiveUser && effectiveUser.store_id && response.data.store_id !== effectiveUser.store_id) {
                    throw new Error('このスタッフの情報にアクセスする権限がありません');
                }
            }

            // 希望シフトデータの型を確認・修正
            if (response.data.dayPreferences && Array.isArray(response.data.dayPreferences)) {
                response.data.dayPreferences = response.data.dayPreferences.map(pref => ({
                    ...pref,
                    day_of_week: parseInt(pref.day_of_week, 10),
                    available: pref.available === true || pref.available === 'true'
                }));
            }

            commit('setCurrentStaff', response.data);
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || 'スタッフ情報の取得に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    // スタッフの作成
    async createStaff({ commit, rootGetters }, staffData) {
        commit('setLoading', true);
        commit('clearError');

        try {
            // 権限チェック：管理者以外は自分の店舗にのみスタッフを作成可能
            if (rootGetters['auth/shouldFilterByUser']) {
                const effectiveUser = rootGetters['auth/effectiveUser'];
                if (effectiveUser && effectiveUser.store_id) {
                    staffData.store_id = effectiveUser.store_id;
                }
            }

            const response = await api.post('/staff', staffData);
            commit('addStaff', response.data);
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || 'スタッフの作成に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    // スタッフ情報の更新
    async updateStaff({ commit, rootGetters }, { id, staffData }) {
        commit('setLoading', true);
        commit('clearError');

        try {
            // dayPreferences が配列であることを確認
            if (staffData.day_preferences && !Array.isArray(staffData.day_preferences)) {
                console.error('day_preferences は配列でなければなりません');
                throw new Error('希望シフトデータの形式が正しくありません');
            }

            // dayOffRequests が配列であることを確認
            if (staffData.day_off_requests && !Array.isArray(staffData.day_off_requests)) {
                console.error('day_off_requests は配列でなければなりません');
                throw new Error('休み希望データの形式が正しくありません');
            }

            // 権限チェック：管理者以外は自分の店舗のスタッフのみ更新可能
            if (rootGetters['auth/shouldFilterByUser']) {
                const effectiveUser = rootGetters['auth/effectiveUser'];
                if (effectiveUser && effectiveUser.store_id) {
                    staffData.store_id = effectiveUser.store_id;
                }
            }

            const response = await api.put(`/staff/${id}`, staffData);

            commit('updateStaffData', response.data);
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || '希望シフトの更新に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    // スタッフの削除
    async deleteStaff({ commit, rootGetters }, id) {
        commit('setLoading', true);
        commit('clearError');

        try {
            // 権限チェック：削除前にスタッフ情報を取得して権限確認
            const staffResponse = await api.get(`/staff/${id}`);

            if (rootGetters['auth/shouldFilterByUser']) {
                const effectiveUser = rootGetters['auth/effectiveUser'];
                if (effectiveUser && effectiveUser.store_id && staffResponse.data.store_id !== effectiveUser.store_id) {
                    throw new Error('このスタッフを削除する権限がありません');
                }
            }

            await api.delete(`/staff/${id}`);
            commit('removeStaff', id);
            return true;
        } catch (error) {
            const message = error.response?.data?.message || 'スタッフの削除に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    // スタッフの曜日ごとの希望シフトの取得
    async fetchStaffDayPreferences({ commit }, id) {
        commit('setLoading', true);

        try {
            const response = await api.get(`/staff/${id}/day-preferences`);
            commit('setCurrentStaffDayPreferences', response.data);
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || '希望シフトの取得に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    // スタッフの休み希望の取得
    async fetchStaffDayOffRequests({ commit }, { id, year, month, status }) {
        commit('setLoading', true);

        try {
            let url = `/staff/${id}/day-off-requests`;
            const params = [];
            if (year && month) {
                params.push(`year=${year}`);
                params.push(`month=${month}`);
            }
            if (status) {
                params.push(`status=${status}`);
            }
            if (params.length > 0) {
                url += `?${params.join('&')}`;
            }

            const response = await api.get(url);
            commit('setCurrentStaffDayOffRequests', response.data);
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || '休み希望の取得に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    // 休み希望のステータス更新
    async updateDayOffRequestStatus({ commit }, { staffId, requestId, status }) {
        commit('setLoading', true);

        try {
            const response = await api.patch(`/staff/${staffId}/day-off-requests/${requestId}`, { status });
            commit('updateDayOffRequestStatusData', response.data);
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || '休み希望ステータスの更新に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    }
};

// ミューテーション
const mutations = {
    setStaff(state, staff) {
        state.staff = staff;
    },
    setCurrentStaff(state, staff) {
        state.currentStaff = staff;
    },
    addStaff(state, staff) {
        state.staff.push(staff);
    },
    updateStaffData(state, updatedStaff) {
        const index = state.staff.findIndex(staff => staff.id === updatedStaff.id);
        if (index !== -1) {
            state.staff.splice(index, 1, updatedStaff);
        }
        if (state.currentStaff && state.currentStaff.id === updatedStaff.id) {
            state.currentStaff = updatedStaff;
        }
    },
    removeStaff(state, id) {
        state.staff = state.staff.filter(staff => staff.id !== id);
        if (state.currentStaff && state.currentStaff.id === id) {
            state.currentStaff = null;
        }
    },
    setCurrentStaffDayPreferences(state, dayPreferences) {
        if (state.currentStaff) {
            state.currentStaff.dayPreferences = dayPreferences;
        }
    },
    setCurrentStaffDayOffRequests(state, dayOffRequests) {
        if (state.currentStaff) {
            state.currentStaff.dayOffRequests = dayOffRequests;
        }
    },
    updateDayOffRequestStatusData(state, updatedRequest) {
        if (state.currentStaff && state.currentStaff.dayOffRequests) {
            const index = state.currentStaff.dayOffRequests.findIndex(req => req.id === updatedRequest.id);
            if (index !== -1) {
                state.currentStaff.dayOffRequests.splice(index, 1, updatedRequest);
            }
        }
    },
    setLoading(state, loading) {
        state.loading = loading;
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