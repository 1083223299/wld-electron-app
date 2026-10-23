<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fuzzyMatch, highlightHtml } from '../../utils/fuzzyMatch';
import { useUserStore } from '../../stores/user';

const props = defineProps({
  collapsed: {
    type: Boolean,
    default: false,
  },
});

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

/** 当前登录角色（admin=管理员 / service=客服 / audit=审核员 / finance=财务） */
const userRole = computed(() => userStore.role || 'admin');

const openedKeys = ref(new Set());
const hoveredKey = ref('');

function toggleGroup(key) {
  const next = new Set(openedKeys.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  openedKeys.value = next;
}

const isOpen = (key) => {
  if (props.collapsed) {
    return hoveredKey.value === key;
  }

  if (searchingGroupKeys.value.has(key)) return true;
  if (route.path === key || route.path.startsWith(`${key}/`)) return true;
  return openedKeys.value.has(key);
};

const isGroupVisible = (key) => isOpen(key);

const handleMenuEnter = (key) => {
  if (props.collapsed) {
    hoveredKey.value = key;
  }
};

const handleMenuLeave = (event, key) => {
  if (!props.collapsed || hoveredKey.value !== key) return;

  const nextTarget = event?.relatedTarget;
  const current = event?.currentTarget;
  if (nextTarget && current && current.contains(nextTarget)) {
    return;
  }

  hoveredKey.value = '';
};

const groupActive = (menu) =>
  Array.isArray(menu?.children) && menu.children.some((child) => activeKey.value === child.key);

const isVisible = (record) => {
  if (record.meta?.hidden || record.hidden) return false;
  // 角色过滤：meta.roles 配置了可见角色时，当前角色不在其中则不显示
  const roles = record.meta?.roles;
  if (Array.isArray(roles) && !roles.includes(userRole.value)) return false;
  const children = record.children || [];
  if (children.length && !children.some(isVisible)) return false;
  return true;
};

const joinPath = (base, p) =>
  p.startsWith('/') ? p : `${base === '/' ? '' : base}/${p}`;

const menus = computed(() => {
  const root = router.getRoutes().find((r) => r.path === '/');
  return (root?.children || [])
    .filter(isVisible)
    .map((record) => {
      const meta = record.meta || {};
      const fullPath = joinPath('/', record.path);
      const visibleChildren = (record.children || []).filter(isVisible);
      if (visibleChildren.length) {
        return {
          key: fullPath,
          label: meta.title || record.name || fullPath,
          icon: meta.icon || '',
          children: visibleChildren.map((child) => {
            const childPath = joinPath(fullPath, child.path);
            return {
              key: childPath,
              label: child.meta?.title || child.name || child.path,
              to: childPath,
            };
          }),
        };
      }
      return {
        key: fullPath,
        label: meta.title || record.name || fullPath,
        icon: meta.icon || '',
        to: fullPath,
      };
    });
});

const activeKey = computed(() => route.path);

/* ================= 菜单模糊搜索 ================= */
const keyword = ref('');
const isSearching = computed(() => keyword.value.trim() !== '');

const filteredMenus = computed(() => {
  const kw = keyword.value.trim();
  if (!kw) return menus.value;

  const hit = (item) => fuzzyMatch(kw, item.label) || fuzzyMatch(kw, item.to);

  return menus.value.reduce((acc, m) => {
    if (m.children) {
      if (hit(m)) {
        acc.push(m);
      } else {
        const children = m.children.filter(hit);
        if (children.length) acc.push({ ...m, children });
      }
    } else if (hit(m)) {
      acc.push(m);
    }
    return acc;
  }, []);
});

// 搜索时需要自动展开的分组
const searchingGroupKeys = computed(() => {
  const keys = new Set();
  if (!isSearching.value) return keys;
  for (const m of filteredMenus.value) {
    if (m.children) keys.add(m.key);
  }
  return keys;
});

const highlight = (text) => highlightHtml(keyword.value, text);

// 跳转后恢复完整菜单
watch(
  () => route.path,
  () => {
    keyword.value = '';
  }
);

// 折叠态没有搜索框，恢复完整菜单
watch(
  () => props.collapsed,
  (collapsed) => {
    if (collapsed) keyword.value = '';
  }
);
</script>

<template>
  <aside class="sidebar" :class="{ collapsed: props.collapsed }">
    <div class="sidebar-header">
      <div class="brand-wrap">
        <span class="brand-tile">
          <img src="../../assets/images/logo.png" alt="logo" class="brand-logo" />
        </span>
        <span class="brand-text">未来电竞管理后台</span>
      </div>
    </div>

    <div v-if="!props.collapsed" class="sidebar-search">
      <el-input
        v-model="keyword"
        class="menu-search-input"
        placeholder="搜索菜单"
        clearable
        @keydown.esc.stop.prevent="keyword = ''"
      >
        <template #prefix>
          <svg class="search-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.5" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </template>
      </el-input>
    </div>

    <nav class="sidebar-nav" aria-label="主导航">
      <div v-if="isSearching && !filteredMenus.length" class="menu-empty">无匹配菜单</div>
      <ul class="menu">
        <li v-for="m in filteredMenus" :key="m.key" class="menu-item">
          <template v-if="m.children">
            <div
              class="menu-group"
              :class="{ open: isGroupVisible(m.key), active: groupActive(m), collapsed: props.collapsed }"
              @mouseenter="handleMenuEnter(m.key)"
              @mouseleave="handleMenuLeave($event, m.key)"
            >
              <div class="menu-group-title" @click="toggleGroup(m.key)">
                <SvgIcon v-if="m.icon" class="menu-icon" :icon-class="m.icon" />
                <span class="menu-label" v-html="highlight(m.label)"></span>
                <span class="group-arrow" aria-hidden="true"></span>
              </div>
              <ul
                class="submenu"
                @mouseenter="handleMenuEnter(m.key)"
                @mouseleave="handleMenuLeave($event, m.key)"
              >
                <li v-for="child in m.children" :key="child.key">
                  <RouterLink :to="child.to" :class="{ active: activeKey === child.key }">
                    <span class="submenu-dot"></span>
                    <span v-html="highlight(child.label)"></span>
                  </RouterLink>
                </li>
              </ul>
            </div>
          </template>

          <template v-else>
            <RouterLink :to="m.to" :class="{ active: activeKey === m.key, collapsed: props.collapsed }" :title="m.label">
              <SvgIcon v-if="m.icon" class="menu-icon" :icon-class="m.icon" />
              <span class="menu-label" v-html="highlight(m.label)"></span>
            </RouterLink>
          </template>
        </li>
      </ul>
    </nav>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 240px;
  height: 100%;
  background: linear-gradient(180deg, var(--sidebar-bg-1) 0%, var(--sidebar-bg-2) 100%);
  border-right: 1px solid var(--border-soft);
  box-shadow: var(--sidebar-inset);
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease;
}

.sidebar.collapsed {
  width: 72px;
  overflow: visible;
}

.sidebar-header {
  display: flex;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-soft);
  flex-shrink: 0;
  /* 覆盖 layout.css 遗留的全局 .sidebar-header { height: 60px } */
  height: auto;
}

.brand-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
}

.brand-tile {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: var(--primary-soft);
  border: 1px solid var(--primary-faint);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.brand-wrap:hover .brand-tile {
  transform: translateY(-1px);
  box-shadow: 0 6px 14px var(--primary-glow);
}

.brand-logo {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.brand-text {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #8f5eff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.sidebar.collapsed .sidebar-header {
  padding: 16px 0;
  justify-content: center;
}

.sidebar.collapsed .brand-wrap {
  width: auto;
  justify-content: center;
}

.sidebar.collapsed .brand-tile {
  width: 36px;
  height: 36px;
}

.sidebar.collapsed .brand-text {
  display: none;
}

.sidebar-nav {
  flex: 1;
  overflow: auto;
  padding: 12px 10px 16px;
}

/* ================= 菜单搜索 ================= */
.sidebar-search {
  padding: 12px 14px 0;
}

.sidebar-search .menu-search-input :deep(.el-input__wrapper) {
  min-height: 34px;
  padding: 1px 10px;
  border-radius: 10px;
  background: var(--input-bg);
  box-shadow: 0 0 0 1px var(--input-border) inset;
}

.sidebar-search .menu-search-input :deep(.el-input__inner) {
  font-size: 13px;
}

.sidebar-search .menu-search-input :deep(.el-input__inner::placeholder) {
  color: var(--input-placeholder);
}

.sidebar-search .search-icon {
  width: 14px;
  height: 14px;
  color: var(--text-sub);
}

.menu-empty {
  padding: 28px 12px;
  text-align: center;
  font-size: 13px;
  color: var(--text-sub);
}

.menu :deep(.search-hl) {
  color: var(--primary);
  font-weight: 700;
}

.menu a.active :deep(.search-hl) {
  color: inherit;
}
/* ================= 菜单搜索 end ================= */

.sidebar.collapsed .sidebar-nav {
  overflow: visible;
}

.menu {
  list-style: none;
  padding: 0;
  margin: 0;
}

.menu-item {
  margin-bottom: 8px;
  position: relative;
}

.menu a,
.menu-group-title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 12px;
  border-radius: 12px;
  color: var(--text-sidebar);
  text-decoration: none;
  transition: all 0.18s ease;
  cursor: pointer;
}

.sidebar.collapsed .menu a,
.sidebar.collapsed .menu-group-title {
  justify-content: center;
  padding: 0 8px;
}

.menu a:hover,
.menu-group-title:hover {
  background: var(--primary-soft);
  color: var(--primary);
}

.menu a.active {
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  color: var(--text-invert);
  box-shadow: 0 12px 20px var(--primary-glow);
}

.menu a.active .submenu-dot {
  background: var(--primary);
}

.menu-group {
  border-radius: 12px;
  background: var(--sidebar-group-bg);
  padding: 0;
}

.menu-group-title {
  font-weight: 600;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.menu-group.active > .menu-group-title {
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  color: var(--text-invert);
  border-color: var(--primary-border);
  box-shadow: 0 10px 18px var(--primary-glow);
}

.menu-group.active > .menu-group-title .menu-icon,
.menu-group.active > .menu-group-title .group-arrow {
  filter: brightness(0) invert(var(--icon-invert));
}

.group-arrow {
  margin-left: auto;
  width: 8px;
  height: 8px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(45deg);
  transition: transform 0.2s ease;
  opacity: 0.8;
}

.menu-group.open .group-arrow {
  transform: rotate(225deg);
}

.sidebar.collapsed .menu-label,
.sidebar.collapsed .menu-group-title .menu-label,
.sidebar.collapsed .menu-group-title .group-arrow,
.sidebar.collapsed .submenu-dot {
  display: none;
}

.submenu {
  list-style: none;
  margin: 4px 0 0;
  padding: 0 0 0 12px;
  display: none;
}

.menu-group.open .submenu {
  display: block;
}

.sidebar.collapsed .menu-group {
  position: relative;
  overflow: visible;
  width: 44px;
  margin: 0 auto;
}

.sidebar.collapsed .menu-group-title {
  position: relative;
  z-index: 2;
  width: 40px;
  height: 40px;
}

.sidebar.collapsed .menu-group .submenu {
  position: absolute;
  left: 44px;
  top: 50%;
  min-width: 180px;
  width: max-content;
  min-height: 32px;
  background: var(--bg-elevated);
  border: 1px solid var(--primary-border);
  box-shadow: var(--shadow-lg);
  border-radius: 12px;
  padding: 8px;
  display: none;
  opacity: 0;
  transform: translateY(-50%);
  transition: opacity 0.15s ease, transform 0.15s ease;
  z-index: 99;
  pointer-events: auto;
}

.sidebar.collapsed .menu-group .submenu::before {
  content: '';
  position: absolute;
  left: -7px;
  top: 18px;
  width: 12px;
  height: 12px;
  background: var(--bg-elevated);
  border-left: 1px solid var(--primary-border);
  border-bottom: 1px solid var(--primary-border);
  transform: rotate(45deg);
}

.sidebar.collapsed .menu-group:hover .submenu,
.sidebar.collapsed .menu-group:focus-within .submenu,
.sidebar.collapsed .menu-group-title:hover + .submenu,
.sidebar.collapsed .menu-group:has(.submenu:hover) .submenu,
.sidebar.collapsed .menu-group.open .submenu {
  display: block;
  opacity: 1;
  transform: translateY(-50%);
}

.sidebar.collapsed .submenu li {
  margin-top: 0;
}

.sidebar.collapsed .submenu a {
  min-height: 34px;
  padding: 0 12px;
  justify-content: flex-start;
  white-space: nowrap;
  display: flex;
}

.submenu li {
  margin-top: 4px;
}

.submenu a {
  min-height: 34px;
  padding-left: 18px;
  font-size: 13px;
  color: var(--text-submenu);
  border-radius: 10px;
  background: transparent;
}

.submenu a.active {
  background: var(--primary-soft);
  color: var(--primary);
  box-shadow: inset 0 0 0 1px var(--primary-faint);
}

.submenu-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-submenu);
  display: inline-block;
  flex-shrink: 0;
}

.menu-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  /* 普通菜单图标跟随主题：亮色主题保持原色，暗色主题反白 */
  filter: var(--icon-filter);
  transition: filter 0.2s ease;
}

.menu a.active .menu-icon,
.menu-group.active > .menu-group-title .menu-icon {
  filter: brightness(0) invert(var(--icon-invert));
}
</style>
