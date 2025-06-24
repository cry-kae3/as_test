export default {
    namespaced: true,

    state: {
        availableAccounts: [],
        selectedAccount: null
    },

    mutations: {
        setAvailableAccounts(state, accounts) {
            state.availableAccounts = accounts;
        },
        setSelectedAccount(state, account) {
            state.selectedAccount = account;
        }
    },

    actions: {
        async fetchAvailableAccounts({ commit }) {
            try {
                // APIからアカウント一覧を取得
                const response = await fetch('/api/admin/accounts');
                const accounts = await response.json();

                commit('setAvailableAccounts', accounts);
                return accounts;
            } catch (error) {
                console.error('アカウント一覧取得エラー:', error);
                throw error;
            }
        }
    },

    getters: {
        selectedAccountId: state => state.selectedAccount ? state.selectedAccount.id : null
    }
  };