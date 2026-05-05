/**
 * markerIcons.js - 地图标记图标管理器
 * 圆周旅迹风格：28x28 透明白色圆底 + emoji图标
 * 
 * 图标已由Python预生成到 /images/markers/ 目录
 * 这里直接返回静态路径，不再运行时生成
 */

// 细分分类 → 聚合分类的映射
const SUB_TO_MAIN = {
  '粤菜': '美食',
  '川菜': '美食',
  '湘菜': '美食',
  '北京菜': '美食',
  '东南亚餐': '美食',
  '日韩料理': '美食',
  '西餐': '美食',
  '小吃': '美食',
  '其他': '美食',
  '海鲜': '美食',
  '烧烤': '美食',
  '牛肉': '美食',
  '粉': '美食',
  '粥': '美食',
  '面食': '美食',
  '糖水': '饮品',
  '景点': '景点',
}

// 聚合分类的图标配置
const CAT_ICONS = {
  '美食':      { emoji: '🥢', bg: '#E67E22' },
  '景点':      { emoji: '🌲', bg: '#27AE60' },
  '酒店':      { emoji: '🏨', bg: '#3498DB' },
  '饮品':      { emoji: '🍹', bg: '#9B59B6' },
  '购物':      { emoji: '🛍️', bg: '#E91E63' },
  '自然户外':  { emoji: '🌲', bg: '#2ECC71' },
  '文化展馆':  { emoji: '🎨', bg: '#F39C12' },
  '全部':      { emoji: '📍', bg: '#9B59B6' },
}

// 分类 → 标记PNG文件名的映射（静态路径，无需生成）
const CAT_TO_FILE = {
  '美食':      '/images/markers/marker_food.png',
  '景点':      '/images/markers/marker_spot.png',
  '酒店':      '/images/markers/marker_hotel.png',
  '饮品':      '/images/markers/marker_drink.png',
  '购物':      '/images/markers/marker_shopping.png',
  '自然户外':  '/images/markers/marker_outdoor.png',
  '文化展馆':  '/images/markers/marker_culture.png',
  '全部':      '/images/markers/marker_default.png',
}

const ICON_SIZE = 28  // PNG实际尺寸

/**
 * 获取聚合分类（细分 → 聚合）
 */
function getMainCategory(category) {
  return SUB_TO_MAIN[category] || category
}

/**
 * 同步获取某分类的图标路径
 */
function getIconPath(category) {
  // 强制所有分类使用景点图标
  return '/images/markers/marker_spot.png'
}

/**
 * 获取某分类的主色调（callout边框用）
 */
function getCategoryColor(category) {
  const mainCat = getMainCategory(category)
  return CAT_ICONS[mainCat]?.bg || '#00D9C0'
}

/**
 * 获取某分类的emoji
 */
function getCategoryEmoji(category) {
  const mainCat = getMainCategory(category)
  return CAT_ICONS[mainCat]?.emoji || '📍'
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
