
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
  { match: /香港/, name: '香港特别行政区', lat: 22.3193, lng: 114.1694 },
  { match: /上海/, name: '上海市', lat: 31.2304, lng: 121.4737 },
  { match: /北京/, name: '北京市', lat: 39.9042, lng: 116.4074 },
  { match: /广州/, name: '广州市', lat: 23.1291, lng: 113.2644 },
  { match: /杭州/, name: '杭州市', lat: 30.2741, lng: 120.1551 },
  { match: /台北/, name: '台北市', lat: 25.0330, lng: 121.5654 },
  { match: /澳门/, name: '澳门特别行政区', lat: 22.1987, lng: 113.5439 },
  { match: /成都/, name: '成都市', lat: 30.5728, lng: 104.0668 },
  { match: /厦门/, name: '厦门市', lat: 24.4798, lng: 118.0894 },
  { match: /南京/, name: '南京市', lat: 32.0603, lng: 118.7969 },
  { match: /苏州/, name: '苏州市', lat: 31.2990, lng: 120.5853 },
  { match: /福州/, name: '福州市', lat: 26.0745, lng: 119.2965 },
  { match: /台州/, name: '台州市', lat: 28.6564, lng: 121.4208 },
  { match: /台南/, name: '台南市', lat: 22.9999, lng: 120.2270 },
  { match: /台中/, name: '台中市', lat: 24.1477, lng: 120.6736 },
  { match: /高雄/, name: '高雄市', lat: 22.6273, lng: 120.3014 },
  { match: /温州/, name: '温州市', lat: 27.9939, lng: 120.6994 },
  { match: /泉州/, name: '泉州市', lat: 24.8746, lng: 118.6759 },
  { match: /扬州/, name: '扬州市', lat: 32.3936, lng: 119.4213 },
  { match: /常州/, name: '常州市', lat: 31.8101, lng: 119.9736 },
  { match: /新北/, name: '新北市', lat: 25.0620, lng: 121.4570 },
  { match: /新竹县/, name: '新竹县', lat: 24.8393, lng: 121.0020 },
  { match: /新竹/, name: '新竹市', lat: 24.8036, lng: 120.9686 },
  { match: /宁德/, name: '宁德市', lat: 26.6657, lng: 119.5482 },
  { match: /惠州/, name: '惠州市', lat: 23.1118, lng: 114.4168 },
  { match: /乌兰察布/, name: '乌兰察布市', lat: 41.0006, lng: 113.1336 },
  { match: /深圳|南山|福田|罗湖|宝安|龙岗|盐田|龙华|光明|坪山|大鹏/, name: '深圳市', lat: 22.5431, lng: 114.0579 }
]

// 默认的路线描述词，用于自动生成路线标题。
const TRIP_DESCRIPTORS = ['自由', '漫游', '轻享', '悠游', '随心', '惬意', '探索', '慢享']

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

// 自动生成路线标题，例如"深圳市三天两夜自由之旅"。
function buildPreviewTitle(cityText, dayCount = 1, routeDaySections = []) {
  const cityName = String(cityText || '').trim() || '深圳市'
  const safeDayCount = Math.max(1, parseInt(dayCount, 10) || 1)
  const nightCount = Math.max(safeDayCount - 1, 0)
  const durationText = nightCount > 0
    ? `${toChineseNumber(safeDayCount)}天${toChineseNumber(nightCount)}夜`
    : `${toChineseNumber(safeDayCount)}天`
  const seedText = (routeDaySections || [])
    .flatMap(day => (day.items || []).map(item => item.id || item.name || ''))
    .join('|')
  const descriptor = TRIP_DESCRIPTORS[hashText(`${cityName}-${durationText}-${seedText}`) % TRIP_DESCRIPTORS.length]
  return `${cityName}${durationText}${descriptor}之旅`
}

// 生成"第几天"文案。
function buildDayLabel(dayNumber) {
  const labels = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
  if (dayNumber <= 10) return `第${labels[dayNumber - 1]}天`
  return `第${dayNumber}天`
}

// 把阿拉伯数字转成中文数字，给默认路线标题用。
function toChineseNumber(num) {
  const digitMap = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  const value = Math.max(0, parseInt(num, 10) || 0)
  if (value <= 10) return value === 10 ? '十' : digitMap[value]
  if (value < 20) return `十${digitMap[value % 10]}`
  if (value < 100) {
    const tens = Math.floor(value / 10)
    const ones = value % 10
    return `${digitMap[tens]}十${ones ? digitMap[ones] : ''}`
  }
  return String(value)
}

// 生成稳定 hash，让同一条路线每次得到相同的描述词。
function hashText(text) {
  const source = String(text || '')
  let hash = 0
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

// 生成路线顶部 Tab：行程总览 + 每一天。
function buildTabs(dayCount) {
  const tabs = [{ key: 'overview', label: '行程总览' }]
  for (let i = 0; i < dayCount; i += 1) {
    tabs.push({ key: `day-${i}`, label: buildDayLabel(i + 1) })
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
  TRIP_DESCRIPTORS,
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
  toChineseNumber,
  hashText,
  buildTabs,
  buildSummaryText,
  getCityInfo,
  buildPreviewRouteData,
  getPreviewIndexByDay,
  getDayIndexByPreview,
  buildPreviewDaySections,
  flattenDaySections,
  stripEditState
}
