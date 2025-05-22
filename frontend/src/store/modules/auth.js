import api from '@/services/api';

const state = {
    token: localStorage.getItem('token') || null,
    currentUser: JSON.parse(localStorage.getItem('currentUser')) || null,
    loading: false,
    error: null,
    isImpersonating: false,
    impersonatedUser: null,
    originalUser: null
};

const getters = {
    isAuthenticated: state => !!state.token,
    currentUser: state => state.currentUser,
    isAdmin: state => state.currentUser && state.currentUser.role === 'admin',
    isOwner: state => state.currentUser && state.currentUser.role === 'owner',
    isStaff: state => state.currentUser && state.currentUser.role === 'staff',
    loading: state => state.loading,
    error: state => state.error,
    isImpersonating: state => state.isImpersonating,
    impersonatedUser: state => state.impersonatedUser,
    originalUser: state => state.originalUser,
    effectiveUser: state => {
        // なりすまし中は被なりすましユーザーを返す
        if (state.isImpersonating && state.impersonatedUser) {
            return state.impersonatedUser;
        }
        // 通常時は現在のユーザーを返す
        return state.currentUser;
    },
    effectiveUserRole: (state, getters) => {
        const user = getters.effectiveUser;
        if (!user) return null;

        // manager または customer を owner に正規化
        if (user.role === 'manager' || user.role === 'customer') {
            return 'owner';
        }

        return user.role;
    },
    // 表示に使用するユーザー情報
    displayUser: (state, getters) => {
        return getters.effectiveUser;
    },
    // 権限チェック用のヘルパー
    hasAdminAccess: (state, getters) => {
        // 管理者、または管理者によるなりすまし
        return getters.effectiveUserRole === 'admin' ||
            (state.originalUser && state.originalUser.role === 'admin');
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
            commit('setToken', null);
            commit('setCurrentUser', null);
            localStorage.removeItem('token');
            localStorage.removeItem('currentUser');
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
            const { token, user } = response.data;

            localStorage.setItem('token', token);
            localStorage.setItem('currentUser', JSON.stringify(user));

            commit('setToken', token);
            commit('setCurrentUser', user);

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

    async startImpersonating({ commit, state }, user) {
        if (!state.currentUser || state.currentUser.role !== 'admin') {
            throw new Error('管理者権限が必要です');
        }

        console.log('なりすまし開始:', user);
        commit('setOriginalUser', state.currentUser);
        commit('setImpersonatedUser', user);
        commit('setIsImpersonating', true);

        console.log('なりすまし状態更新後:', {
            isImpersonating: state.isImpersonating,
            impersonatedUser: state.impersonatedUser,
            originalUser: state.originalUser
        });
    },

    async stopImpersonating({ commit, state }) {
        if (!state.originalUser) return;

        commit('setIsImpersonating', false);
        commit('setImpersonatedUser', null);
        commit('setOriginalUser', null);
    },

    async logout({ commit }) {
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        commit('setToken', null);
        commit('setCurrentUser', null);
        commit('resetImpersonation');
    }
};

const mutations = {
    setToken(state, token) {
        state.token = token;
    },

    setCurrentUser(state, user) {
        state.currentUser = user;
    },

    setLoading(state, loading) {
        state.loading = loading;
    },

    setError(state, error) {
        state.error = error;
    },

    setImpersonatedUser(state, user) {
        console.log('setImpersonatedUser:', user);
        state.impersonatedUser = user;
    },

    setOriginalUser(state, user) {
        console.log('setOriginalUser:', user);
        state.originalUser = user;
    },

    setIsImpersonating(state, isImpersonating) {
        console.log('setIsImpersonating:', isImpersonating);
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

api.interceptors.response.use(
    response => response,
    error => {
        console.error('API エラー:', error.response || error);
        return Promise.reject(error);
    }
);

export default {
    namespaced: true,
    state,
    getters,
    actions,
    mutations
};