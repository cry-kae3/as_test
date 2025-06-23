import api from '@/services/api';

const state = {
    staff: [],
    currentStaff: null,
    loading: false,
    error: null
};

const getters = {
    allStaff: (state) => state.staff,
    currentStaff: (state) => state.currentStaff,
    loading: (state) => state.loading,
    error: (state) => state.error,
    staffCount: (state) => state.staff.length,
    pendingDayOffRequests: (state) => {
        if (!state.staff) return [];
        return state.staff.flatMap(s => s.dayOffRequests || []).filter(r => r.status === 'pending');
    }
};

const actions = {
    async fetchDayOffRequests({ commit, rootGetters }, params) {
        try {
            let url = '/staff/day-off-requests';
            const queryParams = [];

            if (params && params.status) {
                queryParams.push(`status=${params.status}`);
            }

            const effectiveUser = rootGetters['auth/effectiveUser'];
            if (effectiveUser && (effectiveUser.role === 'owner' || effectiveUser.role === 'staff')) {
                const ownerId = effectiveUser.role === 'staff' ? effectiveUser.parent_user_id : effectiveUser.id;
                if (ownerId) {
                    queryParams.push(`owner_id=${ownerId}`);
                }
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

    async fetchStaff({ commit }, storeId) {
        commit('setLoading', true);
        commit('clearError');
        try {
            const url = storeId ? `/staff?store_id=${storeId}` : '/staff';
            const response = await api.get(url);
            commit('setStaff', response.data);
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || 'スタッフ一覧の取得に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    async fetchStaffById({ commit }, id) {
        commit('setLoading', true);
        commit('clearError');
        try {
            const response = await api.get(`/staff/${id}`);
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

    async createStaff({ commit }, staffData) {
        commit('setLoading', true);
        commit('clearError');
        try {
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

    async updateStaff({ commit }, { id, staffData }) {
        commit('setLoading', true);
        commit('clearError');
        try {
            if (staffData.day_preferences && !Array.isArray(staffData.day_preferences)) {
                throw new Error('希望シフトデータの形式が正しくありません');
            }
            if (staffData.day_off_requests && !Array.isArray(staffData.day_off_requests)) {
                throw new Error('休み希望データの形式が正しくありません');
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

    async deleteStaff({ commit }, id) {
        commit('setLoading', true);
        commit('clearError');
        try {
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