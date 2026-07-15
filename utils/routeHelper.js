
const { resolveDisplayCategory } = require('./displayCategory')
const { formatTripSummary } = require('./trip-duration')
const {
  buildPlaceCardTags,
  buildRouteTravelDisplay,
} = require('./route-place-card')
const { MODE_CONFIG, formatDurationShort, applyTravelMeta } = require('./travel')
const util = require('./util')
const { DEFAULT_COVER_POOL } = require('../config/cover-pool')

// 根据路线标题或地点文案，推断城市和中心坐标。
const CITY_PRESETS = [
  { match: /西安|长安/, name: '西安市', lat: 34.3416, lng: 108.9398 },
  { match: /广州/, name: '广州市', lat: 23.1291, lng: 113.2644 },
  { match: /汕头/, name: '汕头市', lat: 23.3541, lng: 116.6819 },
  { match: /湛江/, name: '湛江市', lat: 21.2707, lng: 110.3594 },
  { match: /佛山/, name: '佛山市', lat: 23.0218, lng: 113.1219 },
  { match: /珠海/, name: '珠海市', lat: 22.2707, lng: 113.5767 },
  { match: /深圳|南山|福田|罗湖|宝安|龙岗|盐田|龙华|光明|坪山|大鹏/, name: '深圳市', lat: 22.5431, lng: 114.0579 }
]

// 自动路线标题的关键词规则：
// 先按“美食 / 景点 / 吃逛”判断主类型，再从地点关键词里提炼细主题。
const ROUTE_TITLE_THEME_RULES = {
  food: [
    // 广州、佛山这类老广路线，优先提炼更有辨识度的茶点主题。
    { label: '广式美食', keywords: ['早茶', '点心', '虾饺', '烧卖', '叉烧包', '流沙包', '云吞面', '双皮奶', '肠粉'] },
    // 潮汕路线常见的牛肉火锅、粿条、蚝烙统一归到潮味主题。
    { label: '潮味美食', keywords: ['潮汕', '牛肉火锅', '粿条', '蚝烙', '卤鹅', '砂锅粥', '甘草水果'] },
    { label: '海鲜美食', keywords: ['海鲜', '生蚝', '蚝', '鱼生', '海鲜火锅'] },
    { label: '老广小吃', keywords: ['肠粉', '牛杂', '煲仔饭', '艇仔粥', '云吞面', '糖水'] }
    ,
    // 甜品和糖水路线单独提炼，避免总被归到“老广小吃”。
    { label: '糖水甜品', keywords: ['双皮奶', '姜撞奶', '糖水', '甜品', '杨枝甘露', '芝麻糊', '豆花', '凉粉'] },
    // 烧味是广东路线里很高频的独立主题。
    { label: '烧味茶点', keywords: ['烧鹅', '烧腊', '烧味', '叉烧', '乳鸽', '豉油鸡', '点心', '茶楼'] },
    // 宵夜和路边摊路线，经常和白天正餐完全不是一类体验。
    { label: '宵夜小吃', keywords: ['夜宵', '宵夜', '烧烤', '串串', '小龙虾', '排档', '夜市', '大排档'] },
    // 咖啡、面包、brunch 这种轻餐路线，单独给一个更轻松的主题。
    { label: '咖啡轻食', keywords: ['咖啡', '面包', '甜点', 'brunch', '贝果', '轻食', '下午茶', '烘焙'] }
  ],
  spot: [
    { label: '海边', keywords: ['海', '湾', '沙滩', '海岸', '海滨', '海岛', '岛', '码头', '滨海'] },
    { label: '城市公园', keywords: ['公园', '植物园', '绿道', '湿地', '森林公园', '郊野公园'] },
    { label: '岭南人文', keywords: ['古镇', '古村', '祠堂', '书院', '故居', '博物馆', '纪念馆', '寺', '庙'] },
    { label: '山野徒步', keywords: ['山', '徒步', '步道', '栈道', '郊野', '瀑布', '溪谷'] },
    { label: '城市地标', keywords: ['广场', '塔', '地标', '步行街', '夜景', '摩天轮', '观景'] }
    ,
    // 展馆、美术馆、艺术中心这类更偏城市文化体验。
    { label: '展馆艺术', keywords: ['美术馆', '艺术馆', '展馆', '展览', '音乐厅', '剧院', '创意园', '艺术中心'] },
    // 亲子路线和普通公园路线的体验差别比较大，单独区分。
    { label: '亲子乐园', keywords: ['乐园', '动物园', '海洋馆', '儿童公园', '亲子', '游乐场', '水族馆', '欢乐世界'] },
    // 海岛类地点单独提炼，避免都落到“海边”。
    { label: '海岛休闲', keywords: ['海岛', '小岛', '离岛', '外伶仃', '东澳岛', '桂山岛', '南澳', '岛'] },
    // 古镇古村是广东路线里很常见的单独玩法。
    { label: '古镇漫游', keywords: ['古镇', '古村', '骑楼', '老街', '古街', '牌坊', '巷子', '旧址'] },
    // 夜景路线通常会和白天的城市地标体验不同。
    { label: '夜游观景', keywords: ['夜景', '灯光秀', '江景', '夜游', '观景台', '天际线', '夜市', '摩天轮'] }
  ],
  mixed: [
    { label: '海边吃逛', keywords: ['海', '湾', '沙滩', '海岸', '海滨', '海鲜', '生蚝', '码头'] },
    { label: '岭南吃逛', keywords: ['古镇', '祠堂', '书院', '博物馆', '双皮奶', '早茶', '点心'] },
    { label: '城市吃逛', keywords: ['步行街', '广场', '地标', '夜景', '商圈', '咖啡', '甜品'] },
    // 古镇+小吃、骑楼+老店这类混合路线很适合单独给主题。
    { label: '古镇吃逛', keywords: ['古镇', '古村', '老街', '骑楼', '小吃', '糖水', '茶楼', '巷子'] },
    // 公园散步配轻食咖啡，是很常见的周末路线。
    { label: '公园轻逛', keywords: ['公园', '绿道', '植物园', '咖啡', 'brunch', '面包', '甜品', '散步'] },
    // 夜游和夜宵放在一起，更符合晚上路线的真实命名习惯。
    { label: '夜游夜宵', keywords: ['夜景', '夜游', '夜市', '宵夜', '烧烤', '大排档', '酒吧', '灯光秀'] },
    // 适合珠海、深圳沿海城市的海岛+海鲜混合路线。
    { label: '海岛吃逛', keywords: ['海岛', '岛', '码头', '海鲜', '生蚝', '沙滩', '海边', '船'] }
  ]
}

// 判断一个地点更像景点还是美食。
function isSpotItem(item) {
  return item.type === 'spot' || item.category === '景点' || item.category === '公园' || !item.price
}

// 统一拿封面图字段。
function getCoverImage(item) {
  return item.coverImage || '/images/app-logo.jpg'
}

// 把交通方式 key 转成可读文案。
function getModeLabel(mode) {
  return (MODE_CONFIG[mode] || MODE_CONFIG.drive).label
}

// 估算路线时长，返回可读文案。
function estimateRouteDuration(meters, mode = 'drive') {
  const config = MODE_CONFIG[mode] || MODE_CONFIG.drive
  return formatDurationShort((Math.max(0, meters || 0) / 1000) * config.minutesPerKm)
}

// 给地点生成一个简短的大类标签。
function getItemTagText(item) {
  if (isSpotItem(item)) {
    if ((item.category || '').includes('展馆') || (item.name || '').includes('博物馆')) {
      return '文化展馆'
    }
    return '景点'
  }
  return '美食'
}

// 从路线里的地点图、回退图池中挑一张路线封面。
function resolveRouteCoverImage(routeDaySections) {
  const itemCovers = (routeDaySections || []).reduce((result, day) => {
    (day.items || []).forEach(item => {
      const cover = item.coverImage
      if (cover) result.push(cover)
    })
    return result
  }, [])

  return itemCovers[0] || DEFAULT_COVER_POOL[0] || '/images/app-logo.jpg'
}

// 生成地点卡片的补充信息，例如价格、评分、分类。
function getItemMetaText(item) {
  const parts = []
  if (item.category) parts.push(item.category)
  if (item.price) parts.push(`¥${item.price}/人`)
  if (item.rating || item.score) parts.push(`★${item.rating || item.score}`)
  return parts.join(' · ')
}

// 给待选地点补齐封面、标签、辅助文案。
function decorateSelectableItems(items) {
  return (items || []).map(item => ({
    ...item,
    coverImage: getCoverImage(item),
    tagText: getItemTagText(item),
    displayCategory: item.displayCategory || resolveDisplayCategory(item),
    rating: item.rating || item.score || '',
    tags: buildPlaceCardTags(item),
    metaText: getItemMetaText(item)
  }))
}

// 给已经入路线的地点补齐交通信息和显示文案。
function decorateRouteItems(items, mode) {
  return decorateSelectableItems(items).map(item => {
    const distance = item.distanceFromPrev || 0
    const nextItem = applyTravelMeta({
      ...item,
      distanceStr: util.formatDistance(distance),
      timeStr: estimateRouteDuration(distance, mode)
    }, mode || item.travelMode)
    return {
      ...nextItem,
      timeStr: nextItem.travelMeta ? nextItem.travelMeta.timeText : estimateRouteDuration(distance, mode),
      displayCategory: nextItem.displayCategory || resolveDisplayCategory(nextItem),
      rating: nextItem.rating || nextItem.score || '',
      tags: buildPlaceCardTags(nextItem),
      ...buildRouteTravelDisplay(nextItem.travelMeta, distance)
    }
  })
}

// 单个地点卡片也走同一套展示字段，避免局部更新后样式数据不同步。
function decorateRouteCardItem(item = {}) {
  return {
    ...item,
    displayCategory: item.displayCategory || resolveDisplayCategory(item),
    rating: item.rating || item.score || '',
    tags: buildPlaceCardTags(item),
    ...buildRouteTravelDisplay(item.travelMeta, item.distanceFromPrev)
  }
}

// 统一把路线里的地点信息拼成一段检索文案，供标题主题提取复用。
function buildRouteTitleSearchText(item = {}) {
  const tagsText = Array.isArray(item.tags) ? item.tags.join('|') : ''
  return [
    item.name,
    item.category,
    item.displayCategory,
    item.tagText,
    item.address,
    item.district,
    tagsText
  ].filter(Boolean).join('|')
}

// 路线标题里只区分“美食”和“非美食”两大类：
// 购物、公园、展馆这类都归到“景点/逛”的方向，避免标题过碎。
function getRouteTitleItemType(item = {}) {
  return item.type === 'food' ? 'food' : 'spot'
}

// 根据地点类型占比，判断这条路线更像“美食 / 景点 / 吃逛”哪一种。
function resolveRouteTitleType(items = []) {
  if (!items.length) return 'mixed'
  let foodCount = 0
  items.forEach((item) => {
    if (getRouteTitleItemType(item) === 'food') {
      foodCount += 1
    }
  })
  const foodRatio = foodCount / items.length
  if (foodRatio >= 0.7) return 'food'
  if (foodRatio <= 0.3) return 'spot'
  return 'mixed'
}

// 统计某条主题规则命中了多少个地点。
// 这里按“命中了几个地点”来算分，避免单个地点重复堆词把主题带偏。
function getRouteThemeScore(items = [], keywords = []) {
  return items.reduce((score, item) => {
    const searchText = buildRouteTitleSearchText(item)
    if (!searchText) return score
    const hit = keywords.some(keyword => searchText.indexOf(keyword) !== -1)
    return hit ? score + 1 : score
  }, 0)
}

// 从关键词规则里挑一个最适合当前路线的细主题。
function resolveRouteThemeLabel(items = [], routeType = 'mixed') {
  const rules = ROUTE_TITLE_THEME_RULES[routeType] || []
  let bestRule = null

  rules.forEach((rule) => {
    const score = getRouteThemeScore(items, rule.keywords)
    if (!bestRule || score > bestRule.score) {
      bestRule = {
        label: rule.label,
        score
      }
    }
  })

  if (!bestRule || bestRule.score <= 0) {
    if (routeType === 'food') return '美食'
    if (routeType === 'spot') return '景点'
    return '吃逛'
  }

  // 混合路线至少命中 2 个地点，再使用细主题；
  // 否则直接回退成“吃逛”，避免只靠一个词生成过窄标题。
  if (routeType === 'mixed' && bestRule.score < 2) {
    return '吃逛'
  }

  return bestRule.label
}

// 把天数整理成更适合路线标题的短文案。
// 例如：1 -> “1 日”，2 -> “2 天”。
function buildRouteDurationLabel(dayCount = 1) {
  const safeDayCount = Math.max(1, parseInt(dayCount, 10) || 1)
  return safeDayCount === 1 ? '1 日' : `${safeDayCount} 天`
}

// 自动生成路线标题，例如“深圳海边 1 日路线”。
function buildPreviewTitle(cityText, dayCount = 1, routeDaySections = []) {
  const cityName = util.getCityShortName(String(cityText || '').trim() || '深圳市')
  const routeItems = (routeDaySections || []).flatMap(day => (day.items || []))
  const routeType = resolveRouteTitleType(routeItems)
  const themeLabel = resolveRouteThemeLabel(routeItems, routeType)
  const durationLabel = buildRouteDurationLabel(dayCount)
  return `${cityName}${themeLabel} ${durationLabel}路线`
}

// 生成"第几天"文案。
// 用户要求统一改成阿拉伯数字写法，例如：第 1 天。
function buildDayLabel(dayNumber) {
  const safeDayNumber = Math.max(1, parseInt(dayNumber, 10) || 1)
  return `第 ${safeDayNumber} 天`
}

// 生成路线顶部 Tab：行程总览 + 每一天（含待计划虚拟天）。
// daySections 包含正常天数和末尾的待计划虚拟天，每个 day.title 作为 Tab 标签。
function buildTabs(dayCount) {
  const tabs = [{ key: 'overview', label: '行程总览' }]
  for (let i = 0; i < dayCount; i += 1) {
    tabs.push({ key: `day-${i}`, label: buildDayLabel(i + 1) })
  }
  return tabs
}

// 重载版：接受 daySections 数组，根据每个天的 title 生成 Tab 标签。
function buildTabsFromSections(daySections) {
  const tabs = [{ key: 'overview', label: '行程总览' }]
  for (let i = 0; i < (daySections || []).length; i += 1) {
    const day = daySections[i]
    // 待计划天强制显示"待计划"，不管数据里 title 怎么写。
    const label = day.id === '__pending__' ? '待计划' : (day.title || buildDayLabel(i + 1))
    tabs.push({ key: `day-${i}`, label })
  }
  return tabs
}

// 生成顶部摘要文案。
function buildSummaryText(daySections) {
  const dayCount = daySections.length
  const placeCount = daySections.reduce((sum, day) => sum + (day.items || []).length, 0)
  return formatTripSummary(dayCount, placeCount)
}

// 根据路线相关文案推断城市信息。
function getCityInfo(text) {
  const source = String(text || '')
  for (let i = 0; i < CITY_PRESETS.length; i += 1) {
    if (CITY_PRESETS[i].match.test(source)) {
      return CITY_PRESETS[i]
    }
  }
  return { name: '深圳市', lat: 22.5431, lng: 114.0579 }
}

// 把"按天分组"的路线拍平成普通数组，方便地图预览和统计
function flattenDaySections(daySections) {
  const flattened = []
  ;(daySections || []).forEach((day, dayIndex) => {
    ;(day.items || []).forEach((item, itemIndex) => {
      flattened.push({ ...item, dayIndex, itemIndex })
    })
  })
  return flattened
}

// 先把当前预览路线整理成统一对象：
// 这里只负责组装数据，不直接写入 savedRoutes。
function buildPreviewRouteData(data, options = {}) {
  // 兼容新旧属性名：routeDaySections (旧) 或 daySections (新)
  const routeDaySections = data.daySections || data.routeDaySections || []
  const { summaryText, cityText, previewRouteId, routeTitle } = data
  if (!routeDaySections || !routeDaySections.length) return null

  const routeId = options.routeId || previewRouteId || `ai-${Date.now()}`
  const timestamp = Date.now()
  const savedRoutes = util.loadData('savedRoutes', [])
  const existingRoute = savedRoutes.find(item => String(item.id) === String(routeId))
  return {
    id: routeId,
    title: routeTitle || buildPreviewTitle(cityText, routeDaySections.length, routeDaySections),
    subtitle: summaryText || buildSummaryText(routeDaySections),
    image: resolveRouteCoverImage(routeDaySections),
    coverImage: resolveRouteCoverImage(routeDaySections),
    author: 'AI规划',
    city: cityText,
    sourceType: 'ai',
    daySections: routeDaySections,
    createdAt: existingRoute && existingRoute.createdAt ? existingRoute.createdAt : timestamp,
    updatedAt: timestamp,
    isDraft: Boolean(options.isDraft)
  }
}

// 根据某一天找到它在预览列表里的起始位置。
function getPreviewIndexByDay(routeDaySections, dayIndex) {
  if (!routeDaySections || dayIndex < 0 || dayIndex >= routeDaySections.length) return 0
  let offset = 0
  for (let i = 0; i < dayIndex; i += 1) {
    offset += (routeDaySections[i].items || []).length
  }
  return offset
}

// 反过来：根据地图预览的下标，找到它属于第几天。
function getDayIndexByPreview(daySections, previewIndex) {
  if (!daySections || !daySections.length) return -1
  let offset = 0
  for (let i = 0; i < daySections.length; i += 1) {
    const count = (daySections[i].items || []).length
    if (previewIndex < offset + count) return i
    offset += count
  }
  return daySections.length - 1
}

// 把一串地点按天数拆成"每天的路线"。
function buildPreviewDaySections(routeShops, preferredDayCount = 1) {
  const items = (routeShops || []).map((item, index) => ({
    ...item,
    id: item.id || `preview-place-${index}`,
    coverImage: item.coverImage,
    tagText: item.tagText || getItemTagText(item)
  }))
  if (!items.length) return []

  const dayCount = Math.max(1, Math.min(parseInt(preferredDayCount, 10) || 1, items.length))
  const sections = []
  let startIndex = 0

  for (let dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
    const remainingItems = items.length - startIndex
    const remainingDays = dayCount - dayIndex
    const currentCount = Math.max(1, Math.ceil(remainingItems / remainingDays))
    const dayItems = items.slice(startIndex, startIndex + currentCount)
    sections.push({
      id: `preview-day-${dayIndex}`,
      title: buildDayLabel(dayIndex + 1),
      countText: `${dayItems.length} 个地点`,
      items: dayItems
    })
    startIndex += currentCount
  }

  return sections
}

// 去掉编辑态临时字段，避免把左滑偏移量之类的界面状态保存进正式数据。
function stripEditState(daySections) {
 return (daySections || []).map((day) => ({
  ...day,
  items: (day.items || []).map((item) => {
   const nextItem = { ...item };
   delete nextItem.swipeOffset;
   return nextItem;
  }),
 }));
}

module.exports = {
  CITY_PRESETS,
  ROUTE_TITLE_THEME_RULES,
  isSpotItem,
  getCoverImage,
  getModeLabel,
  estimateRouteDuration,
  getItemTagText,
  DEFAULT_COVER_POOL,
  resolveRouteCoverImage,
  getItemMetaText,
  decorateSelectableItems,
  decorateRouteItems,
  decorateRouteCardItem,
  buildPreviewTitle,
  buildDayLabel,
  buildTabs,
  buildTabsFromSections,
  buildSummaryText,
  getCityInfo,
  buildPreviewRouteData,
  getPreviewIndexByDay,
  getDayIndexByPreview,
  buildPreviewDaySections,
  flattenDaySections,
  stripEditState
}
