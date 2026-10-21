import { createRouter, createWebHashHistory } from 'vue-router';
import { getToken } from '../utils/auth';
import { useUserStore } from '../stores/user';
import Layout from '../layout/index.vue';

/**
 * 路由结构同 ss（vue-element-admin 风格）：
 * - hidden: true    不在侧边栏显示
 * - alwaysShow: true 始终显示父级菜单（有子菜单时）
 * - meta.title      侧边栏/面包屑名称
 * - meta.icon       侧边栏图标
 * - meta.roles      可见角色（admin=管理员 / service=客服 / audit=审核员 / finance=财务）；
 *                   不配置 roles 视为所有角色可见；侧边栏与路由守卫均按此过滤
 * 侧边栏由 Sidebar 直接遍历该树生成，顺序 = 数组顺序（无需后端接口）
 */
const ALL_ROLES = ['admin', 'service', 'audit', 'finance'];
const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    hidden: true,
    meta: { title: '登录', requiresAuth: false },
  },
  {
    path: '/',
    component: Layout,
    redirect: '/home',
    children: [
      {
        path: 'home',
        name: 'Home',
        component: () => import('../views/HomeView.vue'),
        meta: { title: '首页', icon: 'layout_icon1', roles: ALL_ROLES },
      },
      {
        path: 'notify',
        name: 'SystemNotify',
        component: () => import('../views/handoverCenter/SystemNotifyView/index.vue'),
        hidden: true, // 独立入口：侧边栏不展示，仅通过右上角铃铛进入（不影响工作协作菜单展开/收起）
        meta: { title: '系统通知', roles: ALL_ROLES },
      },
      {
        path: 'users',
        name: 'Users',
        redirect: '/users/player-list',
        alwaysShow: true,
        meta: { title: '用户管理', icon: 'layout_icon11', roles: ['admin', 'service', 'audit'] },
        children: [
          {
            path: 'player-list',
            name: 'PlayerList',
            component: () => import('../views/userManagement/PlayerListView/index.vue'),
            meta: { title: '打手列表', roles: ['admin', 'service', 'audit'] },
          },
          {
            path: 'club-list',
            name: 'ClubList',
            component: () => import('../views/userManagement/ClubListView/index.vue'),
            meta: { title: '俱乐部列表', roles: ['admin', 'service', 'audit'] },
          },
        ],
      },
      {
        path: 'orders',
        name: 'Orders',
        redirect: '/orders/manage',
        alwaysShow: true,
        meta: { title: '订单管理', icon: 'layout_icon4', roles: ALL_ROLES },
        children: [
          {
            path: 'manage',
            name: 'OrderManage',
            component: () => import('../views/orderManagement/OrderManageView/index.vue'),
            meta: { title: '订单管理', roles: ALL_ROLES },
          },
        ],
      },
      {
        path: 'finance',
        name: 'Finance',
        redirect: '/finance/wallet-detail',
        alwaysShow: true,
        meta: { title: '财务管理', icon: 'layout_icon6', roles: ['admin', 'finance'] },
        children: [
          {
            path: 'wallet-detail',
            name: 'WalletDetail',
            component: () => import('../views/financialManagement/WalletDetailView/index.vue'),
            meta: { title: '钱包明细', roles: ['admin', 'finance'] },
          },
          {
            path: 'withdrawal-detail',
            name: 'WithdrawalDetail',
            component: () => import('../views/financialManagement/WithdrawalDetailView/index.vue'),
            meta: { title: '提现明细', roles: ['admin', 'finance'] },
          },
        ],
      },
      {
        path: 'handover',
        name: 'Handover',
        redirect: '/handover/log',
        alwaysShow: true,
        meta: { title: '工作协作', icon: 'layout_icon5', roles: ['admin', 'service'] },
        children: [
          {
            path: 'log',
            name: 'HandoverLog',
            component: () => import('../views/handoverCenter/HandoverLogView/index.vue'),
            meta: { title: '交接日志', roles: ['admin', 'service'] },
          },
        ],
      },
      {
        path: 'configuration',
        name: 'Configuration',
        redirect: '/configuration/game-list',
        alwaysShow: true,
        meta: { title: '配置管理', icon: 'layout_icon2', roles: ['admin'] },
        children: [
          {
            path: 'game-list',
            name: 'GameList',
            component: () => import('../views/configurationManagement/GameListView/index.vue'),
            meta: { title: '游戏管理', roles: ['admin'] },
          },
          {
            path: 'channel-list',
            name: 'ChannelList',
            component: () => import('../views/configurationManagement/ChannelListView/index.vue'),
            meta: { title: '渠道配置', roles: ['admin'] },
          },
          {
            path: 'order-config',
            name: 'OrderConfig',
            component: () => import('../views/configurationManagement/OrderConfigView/index.vue'),
            meta: { title: '卡单时长配置', roles: ['admin'] },
          },
        ],
      },
      // {
      //   path: 'settings',
      //   name: 'Settings',
      //   component: () => import('../views/SettingsView.vue'),
      //   meta: { title: '系统设置', icon: 'layout_icon2' },
      // },
    ],
  },
  // 兼容旧地址
  {
    path: '/user-list',
    redirect: '/users/list',
  },
  {
    path: '/player-list',
    redirect: '/users/player-list',
  },
  {
    path: '/club-list',
    redirect: '/users/club-list',
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/home',
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const token = getToken();
  const needsAuth = to.meta.requiresAuth !== false;

  if (!needsAuth) {
    if (token && to.path === '/login') {
      next('/home');
      return;
    }
    next();
    return;
  }

  if (!token) {
    next({ path: '/login', query: { redirect: to.fullPath } });
    return;
  }

  // 角色权限校验：目标路由 meta.roles 不含当前角色时拦截回首页
  const userRole = useUserStore().role || 'admin';
  const matchedRoles = [...to.matched].reverse().find((record) => record.meta?.roles);
  if (matchedRoles && !matchedRoles.meta.roles.includes(userRole)) {
    next('/home');
    return;
  }

  next();
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} - 未来洞` : '未来洞';
  // 通知主进程：当前是否停在系统通知页
  // 在通知页时来新消息 → 不闪托盘（正在看不需要闪烁提醒），但声音和冒泡仍然保留
  if (window.notifyBridge && window.notifyBridge.setPageStatus) {
    window.notifyBridge.setPageStatus(to.path === '/notify');
  }
});

export default router;