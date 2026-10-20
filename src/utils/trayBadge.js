import logoUrl from '../assets/images/logo16.png';

/**
 * 托盘图标角标生成器
 * 在渲染进程用 Canvas 把 logo 叠加「红色数字气泡」角标，输出 PNG dataURL，
 * 再由主进程 nativeImage.createFromDataURL 设置为托盘图标。
 * 渲染进程有完整字体/抗锯齿能力，比主进程拼像素可靠得多。
 *
 * @param {number} count 未读数（>0 才生成）
 * @returns {Promise<string|null>} PNG dataURL；count<=0 或绘制失败返回 null
 */
export function renderTrayBadgeDataUrl(count) {
  const n = Number(count) || 0;
  if (n <= 0) return Promise.resolve(null);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const size = 256; // 高清画布：把 8x8 托盘底图放大绘制，便于 Windows 托盘缩小时仍清晰
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // 1) 底图：logo
        ctx.drawImage(img, 0, 0, size, size);

        // 2) 右上角红色气泡（圆角胶囊，容纳 1~3 位数字）
        const text = n > 99 ? '99+' : String(n);
        const isLong = text.length >= 3;
        const rad = isLong ? 48 : 42;
        const cx = size - rad; // 紧贴右边缘
        const cy = rad; // 紧贴上边缘

        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        // 3) 白色数字
        ctx.font = `bold ${isLong ? 42 : 50}px "Microsoft YaHei", Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, cx, cy + 2);

        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = logoUrl;
  });
}
