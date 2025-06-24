import api from '@/services/api';

const state = {
    stores: [],
    currentStore: null,
    loading: false,
    error: null
};

const mutations = {
    SET_STORES(state, stores) {
        state.stores = stores;
    },
    SET_CURRENT_STORE(state, store) {
        state.currentStore = store;
    },
    SET_LOADING(state, loading) {
        state.loading = loading;
    },
    SET_ERROR(state, error) {
        state.error = error;
    },
    ADD_STORE(state, store) {
        state.stores.push(store);
    },
    UPDATE_STORE(state, updatedStore) {
        const index = state.stores.findIndex(store => store.id === updatedStore.id);
        if (index !== -1) {
            state.stores.splice(index, 1, updatedStore);
        }
    },
    REMOVE_STORE(state, storeId) {
        state.stores = state.stores.filter(store => store.id !== storeId);
    }
};

const actions = {
    async fetchStores({ commit }) {
        try {
            commit('SET_LOADING', true);
            const response = await api.get('/stores');
            commit('SET_STORES', response.data);
            return response.data;
        } catch (error) {
            commit('SET_ERROR', error.message);
            throw error;
        } finally {
            commit('SET_LOADING', false);
        }
    },

    async fetchStore({ commit }, storeId) {
        try {
            const response = await api.get(`/stores/${storeId}`);
            commit('SET_CURRENT_STORE', response.data);
            return response.data;
        } catch (error) {
            commit('SET_ERROR', error.message);
            throw error;
        }
    },

    async fetchStoreBusinessHours({ commit }, storeId) {
        try {
            console.log('[STORE] 営業時間取得開始:', storeId);
            const response = await api.get(`/stores/${storeId}/business-hours`);
            console.log('[STORE] 営業時間取得完了:', response.data);
            return response.data;
        } catch (error) {
            console.error('[STORE] 営業時間取得エラー:', error);
            commit('SET_ERROR', error.message);
            throw error;
        }
    },

    async fetchStoreClosedDays({ commit }, storeId) {
        try {
            console.log('[STORE] 定休日取得開始:', storeId);
            const response = await api.get(`/stores/${storeId}/closed-days`);
            console.log('[STORE] 定休日取得完了:', response.data);
            return response.data;
        } catch (error) {
            console.error('[STORE] 定休日取得エラー:', error);
            commit('SET_ERROR', error.message);
            throw error;
        }
    },

    async fetchStoreStaffRequirements({ commit }, storeId) {
        try {
            console.log('[STORE] 人員要件取得開始:', storeId);
            const response = await api.get(`/stores/${storeId}/staff-requirements`);
            console.log('[STORE] 人員要件取得完了:', response.data);
            return response.data;
        } catch (error) {
            console.error('[STORE] 人員要件取得エラー:', error);
            commit('SET_ERROR', error.message);
            throw error;
        }
    },

    async createStore({ commit }, storeData) {
        try {
            const response = await api.post('/stores', storeData);
            commit('ADD_STORE', response.data);
            return response.data;
        } catch (error) {
            commit('SET_ERROR', error.message);
            throw error;
        }
    },

    async updateStore({ commit }, storeData) {
        try {
            const response = await api.put(`/stores/${storeData.id}`, storeData);
            commit('UPDATE_STORE', response.data);
            return response.data;
        } catch (error) {
            commit('SET_ERROR', error.message);
            throw error;
        }
    },

    async deleteStore({ commit }, storeId) {
        try {
            await api.delete(`/stores/${storeId}`);
            commit('REMOVE_STORE', storeId);
        } catch (error) {
            commit('SET_ERROR', error.message);
            throw error;
        }
    },

    async saveBusinessHours({ commit }, { storeId, businessHours }) {
        try {
            console.log('[STORE] 営業時間保存開始:', { storeId, businessHours });
            const response = await api.post(`/stores/${storeId}/business-hours`, businessHours);
            console.log('[STORE] 営業時間保存完了:', response.data);
            return response.data;
        } catch (error) {
            console.error('[STORE] 営業時間保存エラー:', error);
            commit('SET_ERROR', error.message);
            throw error;
        }
    },


    // frontend/src/store/modules/store.js の saveClosedDays アクションの修正

    async saveClosedDays({ commit }, { storeId, closedDays }) {
        commit('setLoading', true);

        try {
            if (!storeId) {
                throw new Error('店舗IDが必要です');
            }

            console.log('[STORE] 定休日保存開始:', { storeId, closedDays });
            console.log('[STORE] 送信データ詳細:', JSON.stringify(closedDays, null, 2));

            // データの前処理と検証
            const validatedData = closedDays
                .filter(day => {
                    if (!day || typeof day !== 'object') {
                        console.warn('[STORE] 無効なデータをフィルタ:', day);
                        return false;
                    }

                    // day_of_week または specific_date のいずれかが必要
                    const hasValidDayOfWeek = day.day_of_week !== null && day.day_of_week !== undefined;
                    const hasValidSpecificDate = day.specific_date && day.specific_date.trim();

                    if (!hasValidDayOfWeek && !hasValidSpecificDate) {
                        console.warn('[STORE] 必須フィールドなしでフィルタ:', day);
                        return false;
                    }

                    // 両方が指定されている場合はエラー
                    if (hasValidDayOfWeek && hasValidSpecificDate) {
                        console.warn('[STORE] 両方指定でフィルタ:', day);
                        return false;
                    }

                    return true;
                })
                .map(day => {
                    // データの正規化
                    const normalized = {
                        store_id: parseInt(storeId, 10)
                    };

                    if (day.day_of_week !== null && day.day_of_week !== undefined) {
                        // 曜日指定
                        normalized.day_of_week = parseInt(day.day_of_week, 10);
                        normalized.specific_date = null;
                    } else if (day.specific_date && day.specific_date.trim()) {
                        // 特定日指定
                        normalized.day_of_week = null;
                        normalized.specific_date = day.specific_date.trim();
                    }

                    console.log('[STORE] データ正規化:', { original: day, normalized });
                    return normalized;
                });

            console.log('[STORE] 検証済みデータ:', validatedData);

            const response = await api.post(`/stores/${storeId}/closed-days`, validatedData);

            console.log('[STORE] 定休日保存完了:', response.data);
            return response.data;
        } catch (error) {
            console.error('[STORE] 定休日保存エラー:', error);
            console.error('[STORE] エラー詳細:', {
                url: `/stores/${storeId}/closed-days`,
                data: closedDays,
                error: error.response?.data,
                status: error.response?.status,
                message: error.message
            });

            const message = error.response?.data?.message || '定休日の保存に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    // 定休日取得の際のログ追加
    async fetchStoreClosedDays({ commit }, id) {
        commit('setLoading', true);

        try {
            console.log('[STORE] 定休日取得開始:', id);

            // キャッシュを防ぐために現在時刻をタイムスタンプとして追加
            const timestamp = new Date().getTime();
            const response = await api.get(`/stores/${id}/closed-days?_=${timestamp}`);

            console.log('[STORE] 定休日取得完了:', response.data);

            commit('setCurrentStoreClosedDays', response.data);
            return response.data;
        } catch (error) {
            console.error('[STORE] 定休日取得エラー:', error);
            const message = error.response?.data?.message || '定休日の取得に失敗しました';
            commit('setError', message);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },
    

    async saveStaffRequirements({ commit }, { storeId, requirements }) {
        try {
            console.log('[STORE] 人員要件保存開始:', { storeId, requirements });
            const response = await api.post(`/stores/${storeId}/staff-requirements`, requirements);
            console.log('[STORE] 人員要件保存完了:', response.data);
            return response.data;
        } catch (error) {
            console.error('[STORE] 人員要件保存エラー:', error);
            commit('SET_ERROR', error.message);
            throw error;
        }
    }
};

const getters = {
    stores: state => state.stores,
    currentStore: state => state.currentStore,
    loading: state => state.loading,
    error: state => state.error
};

export default {
    namespaced: true,
    state,
    mutations,
    actions,
    getters
};