import api from '@/services/api';

// 初期状態
const state = {
    stores: [],
    currentStore: null,
    loading: false,
    error: null
};

// ゲッター
const getters = {
    allStores: (state) => state.stores,
    currentStore: (state) => state.currentStore,
    loading: (state) => state.loading,
    error: (state) => state.error
};

// アクション
const actions = {
    // 店舗一覧の取得
    async fetchStores({ commit }) {
        commit('setLoading', true);
        commit('clearError');

        try {
            const response = await api.get('/stores');
            commit('setStores', response.data);
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || '店舗一覧の取得に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    // 特定の店舗情報の取得
    async fetchStore({ commit }, id) {
        commit('setLoading', true);
        commit('clearError');

        try {
            const response = await api.get(`/stores/${id}`);
            commit('setCurrentStore', response.data);
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || '店舗情報の取得に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    // 店舗の作成
    async createStore({ commit }, storeData) {
        commit('setLoading', true);
        commit('clearError');

        try {
            const response = await api.post('/stores', storeData);
            commit('addStore', response.data);
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || '店舗の作成に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    // 店舗情報の更新
    async updateStore({ commit }, storeData) {
        commit('setLoading', true);
        commit('clearError');

        try {
            let response;
            if (storeData.id) {
                response = await api.put(`/stores/${storeData.id}`, storeData);
            } else {
                response = await api.post('/stores', storeData);
            }
            commit('updateStoreData', response.data);
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || '店舗の更新に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    // 店舗の削除
    async deleteStore({ commit }, id) {
        commit('setLoading', true);
        commit('clearError');

        try {
            await api.delete(`/stores/${id}`);
            commit('removeStore', id);
            return true;
        } catch (error) {
            const message = error.response?.data?.message || '店舗の削除に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    // store/fetchStoreClosedDays アクション内
    async fetchStoreClosedDays({ commit }, id) {
        commit('setLoading', true);

        try {
            // キャッシュを防ぐために現在時刻をタイムスタンプとして追加
            const timestamp = new Date().getTime();
            const response = await api.get(`/stores/${id}/closed-days?_=${timestamp}`);

            // 明示的にレスポンスをログ出力
            console.log("定休日データ取得結果:", response.data);

            commit('setCurrentStoreClosedDays', response.data);
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || '定休日の取得に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    // store/fetchStoreStaffRequirements アクション内も同様に
    async fetchStoreStaffRequirements({ commit }, id) {
        commit('setLoading', true);

        try {
            // キャッシュを防ぐために現在時刻をタイムスタンプとして追加
            const timestamp = new Date().getTime();
            const response = await api.get(`/stores/${id}/staff-requirements?_=${timestamp}`);

            // 明示的にレスポンスをログ出力
            console.log("人員要件データ取得結果:", response.data);

            commit('setCurrentStoreStaffRequirements', response.data);
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || 'スタッフ要件の取得に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    // 営業時間の取得
    async fetchStoreBusinessHours({ commit }, id) {
        commit('setLoading', true);

        try {
            const response = await api.get(`/stores/${id}/business-hours`);
            commit('setCurrentStoreBusinessHours', response.data);
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || '営業時間の取得に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    // 営業時間の保存
    async saveBusinessHours({ commit }, { storeId, businessHours }) {
        commit('setLoading', true);

        try {
            if (!storeId || storeId === 'null' || storeId === 'undefined') {
                throw new Error('有効な店舗IDが必要です');
            }

            const storeIdNum = parseInt(storeId, 10);
            if (isNaN(storeIdNum)) {
                throw new Error('店舗IDは数値である必要があります');
            }

            const response = await api.post(`/stores/${storeIdNum}/business-hours`, businessHours);
            commit('setStoreBusinessHours', { storeId: storeIdNum, businessHours });
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || error.message || '営業時間の保存に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    // 定休日の保存（修正）
    async saveClosedDays({ commit }, { storeId, closedDays }) {
        commit('setLoading', true);

        try {
            if (!storeId) {
                throw new Error('店舗IDが必要です');
            }

            console.log("API呼び出し: 定休日保存", { storeId, closedDays });
            const response = await api.post(`/stores/${storeId}/closed-days`, closedDays);
            return response.data;
        } catch (error) {
            console.error('定休日保存 API エラー:', error);
            console.error('リクエスト詳細:', {
                url: `/stores/${storeId}/closed-days`,
                data: closedDays,
                error: error.response?.data
            });
            const message = error.response?.data?.message || '定休日の保存に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    // 人員要件の保存（修正）
    async saveStaffRequirements({ commit }, { storeId, requirements }) {
        commit('setLoading', true);

        try {
            if (!storeId) {
                throw new Error('店舗IDが必要です');
            }

            console.log("API呼び出し: 人員要件保存", { storeId, requirements });
            const response = await api.post(`/stores/${storeId}/staff-requirements`, requirements);
            return response.data;
        } catch (error) {
            console.error('人員要件保存 API エラー:', error);
            console.error('リクエスト詳細:', {
                url: `/stores/${storeId}/staff-requirements`,
                data: requirements,
                error: error.response?.data
            });
            const message = error.response?.data?.message || '人員要件の保存に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    // 人員要件の全削除
    async deleteAllStaffRequirements({ commit }, storeId) {
        commit('setLoading', true);

        try {
            await api.delete(`/stores/${storeId}/staff-requirements`);
            return true;
        } catch (error) {
            const message = error.response?.data?.message || '人員要件の削除に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    // 定休日の全削除
    async deleteAllClosedDays({ commit }, storeId) {
        commit('setLoading', true);

        try {
            await api.delete(`/stores/${storeId}/closed-days`);
            return true;
        } catch (error) {
            const message = error.response?.data?.message || '定休日の削除に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    }
};

// ミューテーション
const mutations = {
    setStores(state, stores) {
        state.stores = stores;
    },
    setCurrentStore(state, store) {
        state.currentStore = store;
    },
    addStore(state, store) {
        state.stores.push(store);
    },
    updateStoreData(state, updatedStore) {
        const index = state.stores.findIndex(store => store.id === updatedStore.id);
        if (index !== -1) {
            state.stores.splice(index, 1, updatedStore);
        }
        if (state.currentStore && state.currentStore.id === updatedStore.id) {
            state.currentStore = updatedStore;
        }
    },
    removeStore(state, id) {
        state.stores = state.stores.filter(store => store.id !== id);
        if (state.currentStore && state.currentStore.id === id) {
            state.currentStore = null;
        }
    },
    setCurrentStoreClosedDays(state, closedDays) {
        if (state.currentStore) {
            state.currentStore.closedDays = closedDays;
        }
    },
    setCurrentStoreStaffRequirements(state, staffRequirements) {
        if (state.currentStore) {
            state.currentStore.staffRequirements = staffRequirements;
        }
    },
    setCurrentStoreBusinessHours(state, businessHours) {
        if (state.currentStore) {
            state.currentStore.businessHours = businessHours;
        }
    },
    setStoreBusinessHours(state, { storeId, businessHours }) {
        const storeIndex = state.stores.findIndex(store => store.id === storeId);
        if (storeIndex !== -1) {
            state.stores[storeIndex] = {
                ...state.stores[storeIndex],
                businessHours: businessHours
            };
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