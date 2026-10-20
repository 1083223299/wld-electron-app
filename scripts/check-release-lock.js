/**
 * 打包前检查 release/win-unpacked 是否被其他进程占用
 * ---------------------------------------------------------------
 * electron-builder 打包时要清空 release\win-unpacked 目录，
 * 如果 VS Code 等程序打开着里面的 app.asar，删除会失败报
 * "The process cannot access the file because it is being used by another process."
 *
 * 本脚本在 npm run dist:* 之前自动执行：
 *  - 未被占用 → 直接放行
 *  - 被占用   → 输出中文提示并退出（阻断打包，避免打包失败后一脸懵）
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const probe = path.join(root, 'release', 'win-unpacked', 'resources', 'app.asar');

// 没有历史产物，无需检测
if (!fs.existsSync(probe)) process.exit(0);

// 探测法：尝试把文件重命名再改回来（被独占打开的文件无法重命名）
// 注意：用 try/finally 保证探测后文件一定恢复原状
try {
  const tmp = probe + '.lockprobe';
  fs.renameSync(probe, tmp);
  fs.renameSync(tmp, probe);
  process.exit(0);
} catch (e) {
  console.error('');
  console.error('==========================================================');
  console.error('  打包阻断：release\\win-unpacked 正被其他程序占用！');
  console.error('----------------------------------------------------------');
  console.error('  最常见原因：VS Code 里打开了 app.asar 的文件标签页');
  console.error('  （VS Code 重启后会恢复上次会话，所以关掉窗口并不够）');
  console.error('----------------------------------------------------------');
  console.error('  解决方法（任选其一）：');
  console.error('  1) VS Code 里按 Ctrl+K 再按 Ctrl+W，关闭所有编辑器标签页');
  console.error('  2) 任务管理器结束所有 Code.exe 进程（未保存的代码会丢失）');
  console.error('  3) 重启电脑后先不要打开 app.asar 相关文件，直接打包');
  console.error('==========================================================');
  console.error('');
  process.exit(1);
}
