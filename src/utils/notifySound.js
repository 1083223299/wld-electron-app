/**
 * 系统通知提示音（微信式"叮咚"）
 * 使用 Web Audio API 合成两声木琴式音阶，无需任何音频资源文件。
 * - 首次用户交互后自动解锁（Chromium 自动播放策略）
 * - 300ms 内连续触发只响一次，避免消息轰炸时声音叠成噪音
 */

let ctx = null;
let lastPlayAt = 0;
const MIN_GAP = 300; // 两次播放最小间隔（毫秒）

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  return ctx;
}

/** 播放单音：正弦波 + 快起音 + 指数衰减（木琴感） */
function tone(ac, freq, startOffset, duration, volume) {
  const t0 = ac.currentTime + startOffset;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.06);
}

/** 播放微信式"叮咚"提示音 */
export function playNotifySound() {
  const now = Date.now();
  if (now - lastPlayAt < MIN_GAP) return;
  lastPlayAt = now;

  const ac = getCtx();
  if (!ac) return;

  // 自动播放策略：被挂起时等待用户交互解锁，不强制播放
  if (ac.state === 'suspended') {
    ac.resume().catch(() => {});
    return;
  }

  // 微信经典"叮咚"：D6(1174.7Hz) → A5(880Hz)，两声快速连奏
  tone(ac, 1174.66, 0, 0.38, 0.2);
  tone(ac, 880.0, 0.13, 0.42, 0.18);
}

/** 解锁音频上下文（供首次用户交互时调用，自动挂载在模块内） */
if (typeof window !== 'undefined') {
  const unlock = () => {
    const ac = getCtx();
    if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
}
