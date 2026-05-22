
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

// 默认的路线描述词，用于自动生成路线标题。
const TRIP_DESCRIPTORS = ['自由', '漫游', '轻享', '悠游', '随心', '惬意', '探索', '慢享']

// 判断一个地点更像景点还是美食。
function isSpotItem(item) {
  return item.type === 'spot' || item.category === '景点' || item.category === '公园' || !item.price
}

// 统一拿封面图字段。
function getCoverImage(item) {
  return item.coverImage || item.displayImage || item.thumb || '/images/app-logo.jpg'
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
function resolveRouteCoverImage(routeDaySections, fallbackImage = '') {
  const itemCovers = (routeDaySections || []).reduce((result, day) => {
    ;(day.items || []).forEach(item => {
      const cover = item.coverImage || item.image || item.logo || item.thumb
      if (cover) result.push(cover)
    })
    return result
  }, [])

  return itemCovers[0] || fallbackImage || DEFAULT_COVER_POOL[0] || '/images/app-logo.jpg'
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
    image: item.image || item.displayImage || item.thumb || getCoverImage(item),
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

// 生成旧版路线数据格式，兼容历史数据。
function buildLegacyRouteData(daySections) {
  const daySummaries = (daySections || []).map((day, index) => ({
    location: '',
    route: (day.items || []).map(item => item.name).join(' --- '),
    image: (day.items && day.items[0] && (day.items[0].coverImage || day.items[0].image)) || '/images/app-logo.jpg'
  }))

  const dayDetails = (daySections || []).map(day => (day.items || []).map(item => ({
    name: item.name,
    desc: item.travelText,
    travelText: item.travelText,
    tag: item.tagText || item.tag,
    image: item.coverImage || item.image || getCoverImage(item),
    type: item.type || (isSpotItem(item) ? 'spot' : 'food'),
    lat: item.lat || item.latitude,
    lng: item.lng || item.longitude
  })))

  return { daySummaries, dayDetails }
}

// 先把当前预览路线整理成统一对象：
// 这里只负责组装数据，不直接写入 savedRoutes。
function buildPreviewRouteData(data, options = {}) {
  const { routeDaySections, summaryText, cityText, previewRouteId, routeTitle } = data
  if (!routeDaySections || !routeDaySections.length) return null

  const routeId = options.routeId || previewRouteId || `ai-${Date.now()}`
  const timestamp = Date.now()
  const savedRoutes = util.loadData('savedRoutes', [])
  const existingRoute = savedRoutes.find(item => String(item.id) === String(routeId))
  const { daySummaries, dayDetails } = buildLegacyRouteData(routeDaySections)
  return {
    id: routeId,
    title: routeTitle || buildPreviewTitle(cityText, routeDaySections.length, routeDaySections),
    subtitle: summaryText || buildSummaryText(routeDaySections),
    image: resolveRouteCoverImage(routeDaySections, daySummaries[0]?.image),
    coverImage: resolveRouteCoverImage(routeDaySections, daySummaries[0]?.image),
    author: 'AI规划',
    city: cityText,
    sourceType: 'ai',
    daySections: routeDaySections,
    daySummaries,
    dayDetails,
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

// 把一串地点按天数拆成"每天的路线"。
function buildPreviewDaySections(routeShops, preferredDayCount = 1) {
  const items = (routeShops || []).map((item, index) => ({
    ...item,
    id: item.id || `preview-place-${index}`,
    coverImage: item.coverImage || getCoverImage(item),
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

// 根据当前路线类型，判断 toggleLike 时该写 food 还是 spot。
function getLikeType(item, routeType) {
  if (routeType === 'spot') return 'spot'
  if (routeType === 'food') return 'food'
  return item.type === 'spot' ? 'spot' : 'food'
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
  buildLegacyRouteData,
  buildPreviewRouteData,
  getPreviewIndexByDay,
  getLikeType,
  buildPreviewDaySections
}
