import { defineStore } from 'pinia';

export const useUserStore = defineStore('user', {
  state: () => ({
    token: '',
    user: {},
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
    displayName: (state) => state.user?.name || state.user?.username || '未登录',
    role: (state) => state.user?.role || '',
  },
  actions: {
    setToken(token) {
      this.token = token || '';
    },
    setUser(user) {
      this.user = user || {};
    },
    setSession({ token, user }) {
      this.setToken(token);
      this.setUser(user);
    },
    reset() {
      this.token = '';
      this.user = {};
    },
    logout() {
      this.reset();
    },
  },
  persist: {
    key: 'futurecave-auth',
    storage: localStorage,
    pick: ['token', 'user'],
  },
});
