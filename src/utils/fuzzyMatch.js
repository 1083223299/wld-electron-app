/**
 * 模糊匹配工具
 * 支持大小写不敏感的「子串匹配」与「子序列匹配」（字符按顺序出现即可命中）
 */

const normalize = (v) => String(v ?? '').trim().toLowerCase();

/**
 * 判断 keyword 是否模糊命中 target
 * @param {string} keyword 用户输入
 * @param {string} target 被匹配文本（如菜单标题、路由路径）
 * @returns {boolean}
 */
export function fuzzyMatch(keyword, target) {
  const k = normalize(keyword);
  if (!k) return true;
  const t = normalize(target);
  if (!t) return false;
  if (t.includes(k)) return true;
  let i = 0;
  for (let j = 0; j < t.length && i < k.length; j += 1) {
    if (t[j] === k[i]) i += 1;
  }
  return i === k.length;
}

/**
 * 转义 HTML 特殊字符，防止 v-html 注入
 */
export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 生成带 <span class="search-hl"> 高亮标记的 HTML（已转义，可直接 v-html）
 */
export function highlightHtml(keyword, target) {
  const raw = String(target ?? '');
  const k = normalize(keyword);
  if (!k) return escapeHtml(raw);

  const lower = raw.toLowerCase();
  if (lower.length === raw.length) {
    const idx = lower.indexOf(k);
    if (idx !== -1) {
      return (
        escapeHtml(raw.slice(0, idx)) +
        `<span class="search-hl">${escapeHtml(raw.slice(idx, idx + k.length))}</span>` +
        escapeHtml(raw.slice(idx + k.length))
      );
    }
  }

  let ki = 0;
  let out = '';
  for (let j = 0; j < raw.length; j += 1) {
    const ch = raw[j];
    if (ki < k.length && ch.toLowerCase() === k[ki]) {
      out += `<span class="search-hl">${escapeHtml(ch)}</span>`;
      ki += 1;
    } else {
      out += escapeHtml(ch);
    }
  }
  return ki === k.length ? out : escapeHtml(raw);
}
