// 移植自 ss/src/icons + ss/src/components/SvgIcon（Vue2 + svg-sprite-loader）
// 本项目为 Vue3 + Vite，无 svg-sprite-loader，改用 import.meta.glob 读取原始 SVG，
// 运行时拼装为 <symbol> 精灵图注入 body，供 <SvgIcon> 的 <use xlink:href="#icon-xxx"> 使用。
const modules = import.meta.glob('./svg/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function buildSymbol(name, raw) {
  const tagMatch = raw.match(/<svg([^>]*)>/i);
  const attrs = tagMatch ? tagMatch[1] : '';
  let viewBox = (attrs.match(/viewBox\s*=\s*"([^"]+)"/i) || [])[1] || '';
  if (!viewBox) {
    const w = (attrs.match(/width\s*=\s*"([\d.]+)"/i) || [])[1];
    const h = (attrs.match(/height\s*=\s*"([\d.]+)"/i) || [])[1];
    if (w && h) viewBox = `0 0 ${w} ${h}`;
  }
  const inner = raw
    .replace(/^[\s\S]*?<svg[^>]*>/i, '')
    .replace(/<\/svg>\s*$/i, '')
    .trim();
  return `<symbol id="icon-${name}"${viewBox ? ` viewBox="${viewBox}"` : ''}>${inner}</symbol>`;
}

export function registerIcons() {
  if (typeof document === 'undefined' || document.getElementById('svg-sprite')) return;
  const symbols = Object.entries(modules)
    .map(([path, raw]) => {
      const name = path.split('/').pop().replace(/\.svg$/, '');
      return buildSymbol(name, raw);
    })
    .join('');
  const container = document.createElement('div');
  container.id = 'svg-sprite';
  container.setAttribute('aria-hidden', 'true');
  container.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  container.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">${symbols}</svg>`;
  document.body.insertBefore(container, document.body.firstChild);
}

export default registerIcons;
