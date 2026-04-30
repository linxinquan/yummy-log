/**
 * markerIcons.js - 地图标记图标管理器
 * 圆周旅迹风格：28x28 透明白色圆底 + emoji图标
 * 
 * 图标已由Python预生成到 /images/markers/ 目录
 * 这里直接返回静态路径，不再运行时生成
 */

const CAT_ICONS = {
  '粤菜':      { emoji: '🥢', bg: '#00D9C0' },
  '川菜':      { emoji: '🌶️', bg: '#FF6B6B' },
  '湘菜':      { emoji: '🔥', bg: '#E74C3C' },
  '北京菜':    { emoji: '🥟', bg: '#E67E22' },
  '东南亚餐':  { emoji: '🍜', bg: '#3498DB' },
  '日韩料理':  { emoji: '🍣', bg: '#9B59B6' },
  '西餐':      { emoji: '🥩', bg: '#C0392B' },
  '小吃':      { emoji: '🍡', bg: '#27AE60' },
  '其他':      { emoji: '🍽️', bg: '#7F8C8D' },
  '海鲜':      { emoji: '🦐', bg: '#1ABC9C' },
  '烧烤':      { emoji: '🍖', bg: '#D35400' },
  '牛肉':      { emoji: '🥩', bg: '#C0392B' },
  '粉':        { emoji: '🍜', bg: '#F39C12' },
  '粥':        { emoji: '🥣', bg: '#F1C40F' },
  '面食':      { emoji: '🍝', bg: '#E67E22' },
  '糖水':      { emoji: '🍮', bg: '#9B59B6' },
  '景点':      { emoji: '🌲', bg: '#27AE60' },
}

// 分类 → 标记PNG文件名的映射（静态路径，无需生成）
const CAT_TO_FILE = {
  '粤菜':      '/images/markers/marker_粤菜.png',
  '川菜':      '/images/markers/marker_川菜.png',
  '湘菜':      '/images/markers/marker_湘菜.png',
  '北京菜':    '/images/markers/marker_北京菜.png',
  '东南亚餐':  '/images/markers/marker_东南亚餐.png',
  '日韩料理':  '/images/markers/marker_日韩料理.png',
  '西餐':      '/images/markers/marker_西餐.png',
  '小吃':      '/images/markers/marker_小吃.png',
  '其他':      '/images/markers/marker_其他.png',
  '海鲜':      '/images/markers/marker_海鲜.png',
  '烧烤':      '/images/markers/marker_烧烤.png',
  '牛肉':      '/images/markers/marker_牛肉.png',
  '粉':        '/images/markers/marker_粉.png',
  '粥':        '/images/markers/marker_粥.png',
  '面食':      '/images/markers/marker_面食.png',
  '糖水':      '/images/markers/marker_默认.png',
  '景点':      '/images/markers/marker_景点.png',
}

const ICON_SIZE = 28  // PNG实际尺寸

/**
 * 同步获取某分类的图标路径
 */
function getIconPath(category) {
  return CAT_TO_FILE[category] || ''
}

/**
 * 获取某分类的主色调（callout边框用）
 */
function getCategoryColor(category) {
  return CAT_ICONS[category]?.bg || '#00D9C0'
}

/**
 * 获取某分类的emoji
 */
function getCategoryEmoji(category) {
  return CAT_ICONS[category]?.emoji || '📍'
}

/**
 * 兼容旧接口：确保图标就绪（现在是同步的，直接回调）
 */
function ensureIcons(callback) {
  callback && callback(CAT_TO_FILE)
  return CAT_TO_FILE
}

module.exports = {
  CAT_ICONS,
  ICON_SIZE,
  ensureIcons,
  getIconPath,
  getCategoryColor,
  getCategoryEmoji,
}
