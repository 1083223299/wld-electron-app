/**
 * @提及高亮工具
 * 把文本按 @提及 拆成片段，供页面渲染成高亮 chips
 */

const MENTION_RE = /(@[^\s@，。！？,.;；：、]+)/g;

/**
 * 拆分文本中的 @提及
 * @param {string} content
 * @returns {Array<{text: string, mention: boolean}>}
 * 示例：'订单 2455417 卡单 @全量客服 @管理员' →
 *   [{text:'订单 2455417 卡单 '},{text:'@全量客服 ',mention:true},{text:'@管理员',mention:true}]
 */
export function splitMentions(content = '') {
  return String(content)
    .split(MENTION_RE)
    .filter((seg) => seg !== '')
    .map((seg) => ({ text: seg, mention: seg.startsWith('@') }));
}
