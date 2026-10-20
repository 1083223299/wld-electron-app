import { useUserStore } from '../stores/user';

export function getToken() {
  return useUserStore().token || '';
}

export function setToken(token) {
  useUserStore().setToken(token);
}

export function removeToken() {
  useUserStore().setToken('');
}

export function getUser() {
  return useUserStore().user || {};
}

export function setUser(user) {
  useUserStore().setUser(user);
}

export function clearAuth() {
  useUserStore().logout();
}
