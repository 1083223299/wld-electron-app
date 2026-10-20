/** 全局水印覆盖层：canvas 生成半透明斜向水印，平铺覆盖整个页面（防截图泄密） */

let watermarkEl = null; // 当前水印 DOM（单例）

/**
 * 挂载水印。重复调用会先移除旧水印再重建。
 * @param {string} text 水印文字
 */
export function applyWatermark(text) {
  removeWatermark();

  const canvas = document.createElement('canvas');
  canvas.width = 280;
  canvas.height = 200;
  const ctx = canvas.getContext('2d');

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((-Math.PI / 18)); // 逆时针 10°，斜向水印
  ctx.font = '14px "Microsoft YaHei", "PingFang SC", sans-serif';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.07)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  ctx.restore();

  const dataUrl = canvas.toDataURL('image/png');

  const el = document.createElement('div');
  el.id = 'app-watermark';
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = [
    'position: fixed',
    'inset: 0',
    'z-index: 9999',
    'pointer-events: none', // 不拦截任何点击 / 选择
    'user-select: none',
    'background-image: url(' + dataUrl + ')',
    'background-repeat: repeat',
    'background-size: 280px 200px',
  ].join(';');

  document.body.appendChild(el);
  watermarkEl = el;
}

/** 移除水印覆盖层 */
export function removeWatermark() {
  if (watermarkEl && watermarkEl.parentNode) {
    watermarkEl.parentNode.removeChild(watermarkEl);
  }
  watermarkEl = null;
}
