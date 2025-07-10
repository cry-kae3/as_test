import api from '@/services/api';

const state = {
    sessionToken: localStorage.getItem('sessionToken') || null,
    currentUser: JSON.parse(localStorage.getItem('currentUser')) || null,
    loading: false,
    error: null,
    isImpersonating: false,
    impersonatedUser: null,
    originalUser: null,
    sessionExpiresAt: localStorage.getItem('sessionExpiresAt') || null
};

const getters = {
    isAuthenticated: state => !!state.sessionToken,
    currentUser: state => state.currentUser,
    isAdmin: state => state.currentUser && state.currentUser.role === 'admin',
    isOwner: state => state.currentUser && state.currentUser.role === 'owner',
    isStaff: state => state.currentUser && state.currentUser.role === 'staff',
    loading: state => state.loading,
    error: state => state.error,
    isImpersonating: state => state.isImpersonating,
    impersonatedUser: state => state.impersonatedUser,
    originalUser: state => state.originalUser,
    sessionExpiresAt: state => state.sessionExpiresAt,
    effectiveUser: state => {
        if (state.isImpersonating && state.impersonatedUser) {
            return state.impersonatedUser;
        }
        return state.currentUser;
    },
    effectiveUserRole: (state, getters) => {
        const user = getters.effectiveUser;
        if (!user) return null;
        if (user.role === 'manager' || user.role === 'customer') {
            return 'owner';
        }
        return user.role;
    },
    displayUser: (state, getters) => {
        return getters.effectiveUser;
    },
    hasAdminAccess: (state, getters) => {
        return getters.effectiveUserRole === 'admin' || (state.originalUser && state.originalUser.role === 'admin');
    },
    hasOwnerAccess: (state, getters) => {
        const role = getters.effectiveUserRole;
        return role === 'admin' || role === 'owner';
    },
    hasStoreAccess: (state, getters) => {
        const role = getters.effectiveUserRole;
        return role === 'admin' || role === 'owner' || role === 'staff';
    }
};

const actions = {
    async fetchUsers({ commit }) {
        commit('setLoading', true);
        try {
            const response = await api.get('/auth/users');
            return response.data;
        } catch (error) {
            console.error('ユーザー一覧取得エラー:', error);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    async getCurrentUser({ commit }) {
        commit('setLoading', true);
        try {
            const response = await api.get('/auth/me');
            const user = response.data;
            if (user.role === 'manager' || user.role === 'customer') {
                user.role = 'owner';
            }
            commit('setCurrentUser', user);
            localStorage.setItem('currentUser', JSON.stringify(user));
            return user;
        } catch (error) {
            console.error('ユーザー情報取得エラー:', error);
            commit('setSessionToken', null);
            commit('setCurrentUser', null);
            localStorage.removeItem('sessionToken');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('sessionExpiresAt');
            return null;
        } finally {
            commit('setLoading', false);
        }
    },

    async login({ commit }, credentials) {
        commit('setLoading', true);
        commit('clearError');
        try {
            const response = await api.post('/auth/login', credentials);
            const { sessionToken, user, expiresAt } = response.data;
            localStorage.setItem('sessionToken', sessionToken);
            localStorage.setItem('currentUser', JSON.stringify(user));
            localStorage.setItem('sessionExpiresAt', expiresAt);
            commit('setSessionToken', sessionToken);
            commit('setCurrentUser', user);
            commit('setSessionExpiresAt', expiresAt);
            return user;
        } catch (error) {
            console.error('ログインエラー:', error);
            let errorMessage = 'ログインに失敗しました';
            if (error.response && error.response.data && error.response.data.message) {
                errorMessage = error.response.data.message;
            }
            commit('setError', errorMessage);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    async logout({ commit }) {
        try {
            await api.post('/auth/logout');
        } catch (error) {
            console.error('ログアウトエラー:', error);
        } finally {
            localStorage.removeItem('sessionToken');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('sessionExpiresAt');
            commit('setSessionToken', null);
            commit('setCurrentUser', null);
            commit('setSessionExpiresAt', null);
            commit('resetImpersonation');
        }
    },

    async refreshSession({ commit, state }) {
        if (!state.sessionToken) return false;
        try {
            const response = await api.post('/auth/refresh');
            const { expiresAt } = response.data;
            localStorage.setItem('sessionExpiresAt', expiresAt);
            commit('setSessionExpiresAt', expiresAt);
            return true;
        } catch (error) {
            console.error('セッション延長エラー:', error);
            return false;
        }
    },

    async register({ commit }, userData) {
        commit('setLoading', true);
        try {
            if (userData.role === 'manager' || userData.role === 'customer') {
                userData.role = 'owner';
            }
            const response = await api.post('/auth/register', userData);
            return response.data;
        } catch (error) {
            console.error('ユーザー登録エラー:', error);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    async updateUser({ commit }, userData) {
        commit('setLoading', true);
        try {
            if (userData.role === 'manager' || userData.role === 'customer') {
                userData.role = 'owner';
            }
            const response = await api.put(`/auth/users/${userData.id}`, userData);
            return response.data;
        } catch (error) {
            console.error('ユーザー更新エラー:', error);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    async deleteUser({ commit }, userId) {
        commit('setLoading', true);
        try {
            const response = await api.delete(`/auth/users/${userId}`);
            return response.data;
        } catch (error) {
            console.error('ユーザー削除エラー:', error);
            throw error;
        } finally {
            commit('setLoading', false);
        }
    },

    async startImpersonating({ commit, state }, user) {
        if (!state.currentUser || state.currentUser.role !== 'admin') {
            throw new Error('管理者権限が必要です');
        }
        commit('setOriginalUser', state.currentUser);
        commit('setImpersonatedUser', user);
        commit('setIsImpersonating', true);
    },

    async stopImpersonating({ commit, state }) {
        if (!state.originalUser) return;
        commit('setIsImpersonating', false);
        commit('setImpersonatedUser', null);
        commit('setOriginalUser', null);
    },

    async checkSessionExpiry({ dispatch, state }) {
        if (!state.sessionExpiresAt) return;
        const expiresAt = new Date(state.sessionExpiresAt);
        const now = new Date();
        const timeUntilExpiry = expiresAt.getTime() - now.getTime();
        if (timeUntilExpiry <= 5 * 60 * 1000) {
            const refreshed = await dispatch('refreshSession');
            if (!refreshed) {
                await dispatch('logout');
            }
        }
    }
};

const mutations = {
    setSessionToken(state, sessionToken) {
        state.sessionToken = sessionToken;
    },
    setCurrentUser(state, user) {
        state.currentUser = user;
    },
    setSessionExpiresAt(state, expiresAt) {
        state.sessionExpiresAt = expiresAt;
    },
    setLoading(state, loading) {
        state.loading = loading;
    },
    setError(state, error) {
        state.error = error;
    },
    setImpersonatedUser(state, user) {
        state.impersonatedUser = user;
    },
    setOriginalUser(state, user) {
        state.originalUser = user;
    },
    setIsImpersonating(state, isImpersonating) {
        state.isImpersonating = isImpersonating;
    },
    resetImpersonation(state) {
        state.isImpersonating = false;
        state.impersonatedUser = null;
        state.originalUser = null;
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