// 觅食图 - 路线规划页 v6.0 地图+双模式+Timeline
const app = getApp()
const placesData = require('../../utils/placesData')
const util = require('../../utils/util')
const { MODE_CONFIG, applyTravelMeta, buildTravelOptions, formatDurationShort } = require('../../utils/travel')
const { buildMapPreviewViewData } = require('../../utils/map-preview')
const { resolveDisplayCategory } = require('../../utils/displayCategory')
const { formatTripSummary } = require('../../utils/trip-duration')
const {
  buildPlaceCardTags,
  buildRouteTravelDisplay,
  buildPlaceIntroData
} = require('../../utils/route-place-card')

// 默认封面图池：路线或地点缺图时，从这里兜底。
const DEFAULT_COVERS = [
  '/images/covers/01.jpeg',
  '/images/covers/02.jpeg',
  '/images/covers/03.jpeg',
  '/images/covers/04.jpeg',
  '/images/covers/05.jpeg',
  '/images/covers/06.jpeg',
  '/images/covers/07.jpeg',
  '/images/covers/08.jpeg',
  '/images/covers/09.jpeg',
  '/images/covers/10.jpeg',
  '/images/covers/11.jpeg',
  '/images/covers/12.jpeg'
]

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
  return item.logo || item.image || item.thumb || '/images/covers/01.jpeg'
}

// 把交通方式 key 转成可读文案。
function getModeLabel(mode) {
  return (MODE_CONFIG[mode] || MODE_CONFIG.drive).label
}

// 按距离和交通方式估算时长。
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

// 构建本地图片池，给路线封面兜底。
function buildLocalCoverPool() {
  const foodCovers = placesData.getFoods()
    .map(item => item.coverImage || item.displayImage || item.logo || item.image || item.thumb)
    .filter(Boolean)
  const spotCovers = placesData.getSpots()
    .map(item => item.coverImage || item.displayImage || item.image || item.logo || item.thumb)
    .filter(Boolean)
  return [...foodCovers, ...spotCovers, ...DEFAULT_COVERS]
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

  const localCoverPool = buildLocalCoverPool()
  return itemCovers[0] || fallbackImage || localCoverPool[0] || DEFAULT_COVERS[0]
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
    image: item.image || item.logo || item.thumb || getCoverImage(item),
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

// 读取所有美食数据源。
function buildFoodItems() {
  const userShops = util.loadData('userAddedShops', [])
  return [...placesData.getFoods(), ...userShops]
    .map(item => ({ ...item, type: 'food' }))
}

// 读取所有景点数据源。
function buildSpotItems() {
  return placesData.getSpots().map(item => ({ ...item, type: 'spot' }))
}

// 生成“第几天”文案。
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

// 把一串地点按天数拆成“每天的路线”。
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

// 自动生成路线标题，例如“深圳市三天两夜自由之旅”。
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

// 兼容旧结构，生成 daySummaries / dayDetails。
function buildLegacyRouteData(daySections) {
  const daySummaries = (daySections || []).map((day, index) => ({
    location: '',
    route: (day.items || []).map(item => item.name).join(' --- '),
    image: (day.items && day.items[0] && (day.items[0].coverImage || day.items[0].image)) || DEFAULT_COVERS[index % DEFAULT_COVERS.length]
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

// 根据某一天找到它在预览列表里的起始位置。
function getPreviewIndexByDay(routeDaySections, dayIndex) {
  if (!routeDaySections || dayIndex < 0 || dayIndex >= routeDaySections.length) return 0
  let offset = 0
  for (let i = 0; i < dayIndex; i += 1) {
    offset += (routeDaySections[i].items || []).length
  }
  return offset
}

// 根据预览下标反推属于第几天。
function getDayIndexByPreview(routeDaySections, previewIndex) {
  if (!routeDaySections || !routeDaySections.length) return -1
  let offset = 0
  for (let i = 0; i < routeDaySections.length; i += 1) {
    const count = (routeDaySections[i].items || []).length
    if (previewIndex < offset + count) return i
    offset += count
  }
  return routeDaySections.length - 1
}

// 根据当前路线类型，判断 toggleLike 时该写 food 还是 spot。
function getLikeType(item, routeType) {
  if (routeType === 'spot') return 'spot'
  if (routeType === 'food') return 'food'
  return item.type === 'spot' ? 'spot' : 'food'
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

// 只有用户明确点“保存”时，才真正写入 savedRoutes。
function savePreviewRouteData(data, options = {}) {
  const savedRoute = buildPreviewRouteData(data, options)
  if (!savedRoute) return null
  const savedRoutes = util.loadData('savedRoutes', [])
  const index = savedRoutes.findIndex(item => String(item.id) === String(savedRoute.id))
  if (index >= 0) {
    savedRoutes[index] = savedRoute
  } else {
    savedRoutes.push(savedRoute)
  }
  wx.setStorageSync('savedRoutes', savedRoutes)
  return savedRoute
}

// 把临时路线重新应用回当前预览页：
// 这样从“基础信息”页回来后，不需要先落库也能立刻看到修改结果。
function buildPreviewStateFromRoute(route = {}, currentStart = null) {
  const citySource = route.city || route.cityText || route.title || ''
  const cityInfo = getCityInfo(citySource)
  const routeDaySections = (route.daySections || []).map((day, dayIndex) => ({
    ...day,
    id: day.id || `preview-day-${dayIndex}`,
    title: day.title || buildDayLabel(dayIndex + 1),
    countText: `${(day.items || []).length} 个地点`,
    items: (day.items || []).map((item, itemIndex) => {
      const lat = item.lat || item.latitude
      const lng = item.lng || item.longitude
      const decorated = decorateRouteCardItem({
        ...item,
        coverImage: item.coverImage || getCoverImage(item),
        image: item.image || item.coverImage || getCoverImage(item),
        tagText: item.tagText || getItemTagText(item),
        distanceStr: item.distanceStr || util.formatDistance(item.distanceFromPrev || 0),
        timeStr: item.timeStr || estimateRouteDuration(item.distanceFromPrev || 0, item.travelMode)
      })
      return {
        ...decorated,
        lat,
        lng,
        latitude: lat,
        longitude: lng,
        dayIndex,
        itemIndex
      }
    })
  }))
  const routeShops = routeDaySections.reduce((result, day) => result.concat(day.items || []), [])
  const totalDistanceValue = routeShops.reduce((sum, item) => sum + (item.distanceFromPrev || 0), 0)
  const totalMinutes = routeShops.reduce((sum, item) => {
    const modeKey = (item.travelMeta && item.travelMeta.mode) || item.travelMode
    const modeConfig = MODE_CONFIG[modeKey] || MODE_CONFIG.ride
    return sum + ((Math.max(0, item.distanceFromPrev || 0) / 1000) * modeConfig.minutesPerKm)
  }, 0)
  const previewViewData = routeShops.length
    ? buildMapPreviewViewData(routeDaySections, -1, 0, routeShops[0], routeShops.length)
    : {}

  return {
    routeShops,
    routeDaySections,
    tabs: routeDaySections.length ? buildTabs(routeDaySections.length) : [],
    currentTab: 0,
    currentMapDay: -1,
    sheetScrollTarget: '',
    summaryText: route.subtitle || buildSummaryText(routeDaySections),
    cityText: cityInfo.name,
    routeTitle: route.title || buildPreviewTitle(cityInfo.name, routeDaySections.length, routeDaySections),
    previewRouteId: route.id ? String(route.id) : '',
    hasUnsavedPreview: true,
    preferredDayCount: Math.max(routeDaySections.length || route.dayCount || 1, 1),
    totalDistance: util.formatDistance(totalDistanceValue),
    totalTime: formatDurationShort(totalMinutes),
    mapPreviewShop: routeShops[0] || null,
    mapPreviewIndex: 0,
    mapCenter: routeShops.length
      ? {
          lat: routeShops[0].lat || routeShops[0].latitude,
          lng: routeShops[0].lng || routeShops[0].longitude
        }
      : {
          lat: (currentStart && currentStart.lat) || cityInfo.lat,
          lng: (currentStart && currentStart.lng) || cityInfo.lng
        },
    ...previewViewData
  }
}

Page({
  data: {
    // 地图
    mapCenter: { lat: 22.4846, lng: 113.9046 },
    mapScale: 14,
    markers: [],
    polyline: [],

    // 起点默认使用当前位置
    currentStart: { name: '当前位置', lat: 22.5431, lng: 114.0579, type: 'current' },

    // 出行方式
  travelMode: 'ride',

    // 当前定位
    currentLocation: null,

    // 编辑模式
    isEditing: false,
    viewMode: 'list',
    modeSwitchTop: 44,
    routeDaySections: [],
    tabs: [],
    currentTab: 0,
    currentMapDay: -1,
    sheetScrollTarget: '',
    routeTitle: '智能规划路线',
    summaryText: '',
    cityText: '深圳市',
    previewRouteId: '',
    hasUnsavedPreview: false,
    reorderSheetVisible: false,
    // 路线规划弹窗默认不选中任何方式，需用户手动选择
    pendingReorderMode: '',
    routeShopsBackup: [],
    routeDaySectionsBackup: [],
    mapPreviewShop: null,
    mapPreviewIndex: 0,
    previewTabs: [],
    previewDisplayMeta: [],
    previewDescriptionText: '',
    previewFeeText: '',
    previewStationText: '',
    previewCountText: '',
    previewPrevIndex: -1,
    previewNextIndex: -1,
    previewDisablePrev: true,
    previewDisableNext: true,
    transportSheetVisible: false,
    transportOptions: [],
    pendingTransportMode: 'walk',
    transportTargetIndex: -1,
    transportTarget: null,
    navMapSheetVisible: false,
    navMapTarget: null,
    placeIntroVisible: false,
    placeIntroData: null,
    exitConfirmVisible: false,

    // ★ 所有想去店铺候选池
    allLikedShops: [],

    // ★ 选择模式：all=最优路径, custom=自定义
    selectMode: 'all',

    // ★ 自选计数 & 全选状态
    selectedCount: 0,
    isAllSelected: false,

    // 路线
    routeShops: [],
    totalDistance: '0m',
    totalTime: '0分钟',
    isMixedRoute: false,

    // 导览
    isNavigating: false,
    isNavComplete: false,
    currentNavIndex: 0,
    currentNavShop: null,
    visitedCount: 0,
    menuTop: 44,
    menuHeight: 32,
    // 这里只保留 4 个大类：步行 / 公共交通 / 骑行 / 驾车。
    routeModes: ['walk', 'transit', 'ride', 'drive'].map(key => ({
      key,
      label: MODE_CONFIG[key].label,
      icon: MODE_CONFIG[key].icon
    }))
  },

  // 页面初始化：
  // 1. 读取来源类型和地点 id
  // 2. 计算顶部安全区
  // 3. 获取定位并生成路线
  onLoad(options) {
    // 接收 type=food/spot 和 ids=1,2,3 参数
    const { type, ids, dayCount } = options
    const routeType = type === 'spot' ? 'spot' : type === 'plan' ? 'mixed' : 'food'
    const windowInfo = wx.getWindowInfo()
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const menuTop = menuButtonInfo ? menuButtonInfo.top : (windowInfo.statusBarHeight || 44) + 4
    const menuHeight = menuButtonInfo ? menuButtonInfo.height : 32
    const modeSwitchTop = menuTop

    this.setData({
      routeType,
      isMixedRoute: routeType === 'mixed',
      presetIds: ids ? ids.split(',') : null,
      preferredDayCount: Math.max(1, parseInt(dayCount, 10) || 1),
      menuTop,
      menuHeight,
      modeSwitchTop
    })
    this.getCurrentLocation()
    this.loadRoute()
    app.whenLocationReady && app.whenLocationReady((loc) => {
      if (this.data.currentStart.type === 'current') {
        this.loadRoute()
      }
    })
  },

  // 回到页面时重新加载一次，保证基础信息页改动后这里同步更新。
  onShow() {
    if (this.data.hasUnsavedPreview) return
    this.loadRoute()
  },

  // 获取当前位置，作为路线起点。
  getCurrentLocation() {
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      success: (res) => {
        const location = { lat: res.latitude, lng: res.longitude, name: '我的位置' }
        app.globalData.location = location
        this.setData({ currentLocation: location })
        if (this.data.currentStart.type === 'current') {
          this.setData({ currentStart: { ...this.data.currentStart, ...location } })
          this.loadRoute()
        }
      },
      fail: () => {
        const fallback = app.globalData.location || app.globalData.centerLocation
        if (fallback) this.setData({ currentLocation: fallback })
      }
    })
  },

  // 读取想去数据或传入的地点 id，生成当前路线。
  loadRoute() {
    const { routeType, presetIds, selectMode } = this.data

    // 确定要加载的ID列表
    let likedIds = []
    if (presetIds && presetIds.length > 0) {
      // 从想去清单页面传入的ID（按用户拖拽排序）
      likedIds = presetIds
    } else if (routeType === 'spot') {
      likedIds = util.loadData('userWantSpots', [])
    } else if (routeType === 'mixed') {
      likedIds = [
        ...util.loadData('userWantFoods', []),
        ...util.loadData('userWantSpots', [])
      ]
    } else {
      likedIds = util.loadData('userWantFoods', [])
    }

    // 获取对应的数据源
    let allItems = []
    if (routeType === 'spot') {
      allItems = buildSpotItems()
    } else if (routeType === 'mixed') {
      allItems = [...buildFoodItems(), ...buildSpotItems()]
    } else {
      allItems = buildFoodItems()
    }
    const rawItems = likedIds
      .map(id => allItems.find(s => String(s.id) === String(id)))
      .filter(Boolean)

    if (rawItems.length === 0) {
      this.setData({ allLikedShops: [], routeShops: [], selectedCount: 0, isAllSelected: false })
      this.refreshPreviewRoute([])
      return
    }

    // 支持景点(lat/lng)和美食(latitude/longitude)两种格式
    if (selectMode === 'all') {
      const allLikedShops = decorateSelectableItems(rawItems.map(s => ({ ...s, selected: true, orderNum: '' })))
      const routeShops = this._planAndAnnotate(rawItems, presetIds ? true : false)
      routeShops.forEach((s, i) => {
        const hit = allLikedShops.find(a => a.id === s.id)
        if (hit) hit.orderNum = i + 1
      })
      this.setData({
        allLikedShops,
        routeShops,
        selectedCount: rawItems.length,
        isAllSelected: true
      })
      this.refreshPreviewRoute(routeShops)
    } else {
      const prev = this.data.allLikedShops
      const prevMap = {}
      prev.forEach(s => prevMap[s.id] = s)

      const allLikedShops = decorateSelectableItems(rawItems.map(s => {
        const old = prevMap[s.id]
        return { ...s, selected: old ? old.selected : true, orderNum: old ? old.orderNum : '' }
      }))

      const selectedShops = allLikedShops.filter(s => s.selected)
      const routeShops = this._planAndAnnotate(selectedShops)
      allLikedShops.forEach(s => { s.orderNum = '' })
      routeShops.forEach((s, i) => {
        const hit = allLikedShops.find(a => a.id === s.id)
        if (hit) hit.orderNum = i + 1
      })

      this.setData({
        allLikedShops,
        routeShops,
        selectedCount: selectedShops.length,
        isAllSelected: selectedShops.length === allLikedShops.length
      })
      this.refreshPreviewRoute(routeShops)
    }

    this.updateMap()
  },

  // 把当前路线转成“按天展示”的预览结构，并更新标题、摘要、预览卡片。
  refreshPreviewRoute(routeShops, options = {}) {
    const shouldMarkDirty = options.markDirty !== undefined
      ? Boolean(options.markDirty)
      : Boolean(this.data.hasUnsavedPreview || !this.data.previewRouteId)
    const citySource = [
      this.data.currentStart && this.data.currentStart.name,
      ...(routeShops || []).map(item => item.city || item.address || item.name)
    ].filter(Boolean).join(' ')
    const cityInfo = getCityInfo(citySource)
    const routeDaySections = routeShops.length ? buildPreviewDaySections(routeShops, this.data.preferredDayCount) : []
    const tabs = routeDaySections.length ? buildTabs(routeDaySections.length) : []
    this.setData({
      routeDaySections,
      tabs,
      currentTab: 0,
      currentMapDay: -1,
      sheetScrollTarget: '',
      summaryText: routeDaySections.length ? buildSummaryText(routeDaySections) : '',
      cityText: cityInfo.name,
      routeTitle: buildPreviewTitle(cityInfo.name, routeDaySections.length, routeDaySections),
      // 只有真正发生了新的路线改动时，才标记为“未保存”。
      hasUnsavedPreview: routeDaySections.length > 0 ? shouldMarkDirty : false,
      mapPreviewShop: routeShops && routeShops.length ? routeShops[0] : null,
      mapPreviewIndex: 0
    })
  },

  // 对地点做路径规划，并补上距离、时间、总里程这些信息。
  _planAndAnnotate(shops, preserveOrder = false) {
    if (shops.length === 0) return []

    let startPoint = this.data.currentStart
    if (startPoint.type === 'current') {
      startPoint = app.globalData.location || app.globalData.centerLocation || startPoint
    }

    const routeShops = util.planRoute(shops, startPoint, preserveOrder)
    if (routeShops.length > 0) routeShops[0].isFirst = true

    let totalDist = 0
    routeShops.forEach(s => { totalDist += s.distanceFromPrev || 0 })

    this.setData({
      totalDistance: util.formatDistance(totalDist)
    })

    const decoratedRouteShops = decorateRouteItems(routeShops)
    let totalMinutes = 0
    decoratedRouteShops.forEach(item => {
      const modeKey = (item.travelMeta && item.travelMeta.mode) || item.travelMode
      const modeConfig = MODE_CONFIG[modeKey] || MODE_CONFIG.ride
      totalMinutes += (Math.max(0, item.distanceFromPrev || 0) / 1000) * modeConfig.minutesPerKm
    })

    this.setData({
      totalTime: formatDurationShort(totalMinutes)
    })

    return decoratedRouteShops
  },

  // 刷新地图上的点位和折线。
  updateMap() {
    const { routeShops, currentStart } = this.data
    let startPoint = currentStart
    if (currentStart.type === 'current') {
      startPoint = app.globalData.location || { lat: 22.4846, lng: 113.9046 }
    }

    const markers = routeShops.map((shop, index) => ({
      id: shop.id,
      latitude: shop.lat || shop.latitude,
      longitude: shop.lng || shop.longitude,
      width: 36,
      height: 36,
      label: {
        content: String(index + 1),
        color: '#ffffff',
        fontSize: 14,
        borderRadius: 12,
        bgColor: '#00D9C0',
        padding: 5,
        anchorX: 0,
        anchorY: -40
      },
      callout: {
        content: shop.name,
        color: '#1A1A2E',
        fontSize: 12,
        borderRadius: 6,
        padding: 6,
        display: 'BYCLICK',
        bgColor: '#ffffff'
      }
    }))

    // 起点加绿色标记
    markers.unshift({
      id: 9999,
      latitude: startPoint.lat,
      longitude: startPoint.lng,
      width: 28,
      height: 28,
      label: {
        content: '起',
        color: '#ffffff',
        fontSize: 12,
        borderRadius: 10,
        bgColor: '#4CAF50',
        padding: 4,
        anchorX: 0,
        anchorY: -32
      }
    })

    // 路线折线：当前位置/起点 → 各地点
    const points = [
      { latitude: startPoint.lat, longitude: startPoint.lng },
      ...routeShops.map(shop => ({ latitude: shop.lat || shop.latitude, longitude: shop.lng || shop.longitude }))
    ]

    const polyline = [{
      points,
      color: '#00D9C0CC',
      width: 5,
      dottedLine: false,
      arrowLine: true
    }]

    // 地图中心取路线中间点
    let centerLat = startPoint.lat
    let centerLng = startPoint.lng
    if (routeShops.length > 0) {
      const midIdx = Math.floor(routeShops.length / 2)
      centerLat = routeShops[midIdx].lat || routeShops[midIdx].latitude
      centerLng = routeShops[midIdx].lng || routeShops[midIdx].longitude
    }

    this.setData({
      markers,
      polyline,
      mapCenter: { lat: centerLat, lng: centerLng }
    })
  },

  // 让地图自动缩放到能看见当前路线的全部点位。
  onFitRoute() {
    const effectiveDayIndex = this.data.currentMapDay >= 0 ? this.data.currentMapDay : 0
    const currentDay = (this.data.routeDaySections || [])[effectiveDayIndex] || {}
    const currentItems = (currentDay.items || []).length ? currentDay.items : (this.data.routeShops || [])
    if (currentItems.length === 0) return
    const points = currentItems
      .map(item => ({
        latitude: item.lat || item.latitude,
        longitude: item.lng || item.longitude
      }))
      .filter(item => typeof item.latitude === 'number' && typeof item.longitude === 'number')
    if (!points.length) return

    if (points.length === 1) {
      this.setData({
        mapCenter: { lat: points[0].latitude, lng: points[0].longitude },
        mapScale: 15
      })
      return
    }

    const windowInfo = wx.getWindowInfo()
    const mapCtx = wx.createMapContext('routeMap', this)
    mapCtx.includePoints({
      points,
      padding: [96, 24, Math.round((windowInfo.windowHeight || 812) * 0.34), 24]
    })
  },

  // 地图区域变化的预留入口，当前暂时不处理。
  onMapRegionChange() {
    // 可扩展：地图区域变化时的处理
  },

  // 切换“最优路径 / 自定义选择”模式。
  onSwitchSelectMode(e) {
    const mode = e.currentTarget.dataset.mode
    if (mode === this.data.selectMode) return
    this.setData({ selectMode: mode, isEditing: false }, () => {
      this.loadRoute()
    })
  },

  // 自定义模式下，单独勾选或取消某个地点。
  onToggleCandidate(e) {
    const shopId = e.currentTarget.dataset.shopid
    const allLikedShops = this.data.allLikedShops.map(s =>
      s.id === shopId ? { ...s, selected: !s.selected } : s
    )
    const selectedShops = allLikedShops.filter(s => s.selected)
    const selectedCount = selectedShops.length
    const isAllSelected = selectedCount === allLikedShops.length

    this.setData({ allLikedShops, selectedCount, isAllSelected })

    const routeShops = this._planAndAnnotate(selectedShops)
    const updated = allLikedShops.map(s => ({ ...s, orderNum: '' }))
    routeShops.forEach((s, i) => {
      const hit = updated.find(a => a.id === s.id)
      if (hit) hit.orderNum = i + 1
    })

    this.setData({ allLikedShops: updated, routeShops })
    this.refreshPreviewRoute(routeShops)
    this.updateMap()
  },

  // 自定义模式下，全选或取消全选所有候选地点。
  onToggleSelectAll() {
    const { isAllSelected, allLikedShops } = this.data
    const newSelected = !isAllSelected
    const updated = allLikedShops.map(s => ({ ...s, selected: newSelected }))
    const selectedCount = newSelected ? updated.length : 0

    this.setData({ allLikedShops: updated, selectedCount, isAllSelected: newSelected })

    if (newSelected) {
      const routeShops = this._planAndAnnotate(updated)
      const withOrder = updated.map(s => ({ ...s, orderNum: '' }))
      routeShops.forEach((s, i) => {
        const hit = withOrder.find(a => a.id === s.id)
        if (hit) hit.orderNum = i + 1
      })
      this.setData({ allLikedShops: withOrder, routeShops })
      this.refreshPreviewRoute(routeShops)
    } else {
      this.setData({ routeShops: [], totalDistance: '0m', totalTime: '0分钟' })
      this.refreshPreviewRoute([])
    }

    this.updateMap()
  },

  // 切换整条路线的默认交通方式。
  onSelectMode(e) {
    const mode = e.currentTarget.dataset.mode
    const routeShops = decorateRouteItems(this.data.routeShops, mode)
    this.setData({ travelMode: mode, routeShops })
    this.refreshPreviewRoute(routeShops)
    let totalDist = 0
    routeShops.forEach(s => { totalDist += s.distanceFromPrev || 0 })
    this.setData({ totalTime: estimateRouteDuration(totalDist, mode) })
  },

  // 打开某一段交通方式弹窗。
  openTransportSheet(dayIndex, itemIndex, previewIndex) {
    const day = (this.data.routeDaySections || [])[dayIndex]
    const item = ((day || {}).items || [])[itemIndex]
    if (!item) return
    this.setData({
      transportSheetVisible: true,
      transportOptions: buildTravelOptions(item.distanceFromPrev || 0),
      pendingTransportMode: item.travelMode || (item.travelMeta && item.travelMeta.mode) || 'walk',
      transportTargetIndex: previewIndex,
      transportTarget: { dayIndex, itemIndex, previewIndex }
    })
  },

  // 列表模式里点击交通方式入口
  onOpenPlaceTransportSheet(e) {
    const dayIndex = parseInt(e.currentTarget.dataset.dayIndex, 10)
    const itemIndex = parseInt(e.currentTarget.dataset.index, 10)
    this.openTransportSheet(dayIndex, itemIndex, getPreviewIndexByDay(this.data.routeDaySections, dayIndex) + itemIndex)
  },

  // 地图模式里点击交通方式入口
  onOpenMapTransportSheet() {
    const currentShop = this.data.mapPreviewShop
    if (!currentShop) return
    this.openTransportSheet(currentShop.dayIndex, currentShop.itemIndex, this.data.mapPreviewIndex)
  },

  // 导览模式里点击交通方式入口
  onOpenNavTransportSheet() {
    const currentShop = this.data.currentNavShop
    if (!currentShop) return
    this.openTransportSheet(currentShop.dayIndex, currentShop.itemIndex, this.data.currentNavIndex)
  },

  // 关闭交通方式弹窗
  onCloseTransportSheet() {
    this.setData({ transportSheetVisible: false, transportTargetIndex: -1, transportTarget: null })
  },

  // 在交通方式弹窗里切换当前选项
  onSelectTransportMode(e) {
    const mode = e.detail && e.detail.mode
    if (!mode) return
    this.setData({ pendingTransportMode: mode })
  },

  // 确认交通方式后，把结果写回对应地点
  onConfirmTransportMode() {
    const { transportTarget, transportTargetIndex, pendingTransportMode, routeShops, currentNavIndex, isNavigating } = this.data
    if (!transportTarget || transportTargetIndex < 0 || !routeShops[transportTargetIndex]) return

    const nextRouteShops = (routeShops || []).map((item, index) => {
      if (index !== transportTargetIndex) return item
      return decorateRouteCardItem(applyTravelMeta(item, pendingTransportMode))
    })
    const nextData = {
      routeShops: nextRouteShops,
      transportSheetVisible: false,
      transportTargetIndex: -1,
      transportTarget: null
    }
    if (isNavigating && currentNavIndex === transportTargetIndex) {
      nextData.currentNavShop = nextRouteShops[transportTargetIndex]
    }
    this.setData(nextData)
    this.refreshPreviewRoute(nextRouteShops, { markDirty: true })
    if (this.data.viewMode === 'map' || isNavigating) {
      this.focusPreviewByIndex(this.data.mapPreviewIndex)
    }
  },

  // 重新做一次智能排序优化。
  onOptimizeRoute() {
    wx.showLoading({ title: '优化中...' })
    setTimeout(() => {
      const shops = this.data.selectMode === 'all'
        ? this.data.allLikedShops
        : this.data.allLikedShops.filter(s => s.selected)
      const routeShops = this._planAndAnnotate(shops)
      this.setData({ routeShops, isEditing: false, reorderSheetVisible: false })
      this.refreshPreviewRoute(routeShops, { markDirty: true })
      this.updateMap()
      wx.hideLoading()
      wx.showToast({ title: '路线已优化', icon: 'success' })
    }, 400)
  },

  // 进入或退出当前页内的简易编辑模式。
  onToggleEdit() {
    const isEditing = !this.data.isEditing
    this.setData({ isEditing })
    if (!isEditing) {
      wx.showToast({ title: '顺序已保存', icon: 'success' })
    }
  },

  // 打开“编辑路线规划”弹窗
  onOpenReorderSheet() {
    this.setData({
      reorderSheetVisible: true,
      // 每次打开都重置为未选择状态
      pendingReorderMode: ''
    })
  },

  // 去基础信息页
  onEditBasicInfo() {
    const previewRoute = buildPreviewRouteData(this.data, { isDraft: true })
    if (!previewRoute) return
    this.setData({ previewRouteId: previewRoute.id, hasUnsavedPreview: true })
    wx.navigateTo({
      url: `/pages/route-basic-edit/route-basic-edit?route=${encodeURIComponent(JSON.stringify(previewRoute))}&temp=1`,
      success: (res) => {
        res.eventChannel.on('routeBasicSaved', (updatedRoute) => {
          if (!updatedRoute) return
          this.setData(buildPreviewStateFromRoute(updatedRoute, this.data.currentStart))
          this.updateMap()
          if (updatedRoute.daySections && updatedRoute.daySections.length) {
            this.focusPreviewByIndex(0, -1)
          }
        })
      }
    })
  },

  // 关闭“编辑路线规划”弹窗
  onCloseReorderSheet() {
    this.setData({
      reorderSheetVisible: false,
      // 关闭时清空选择，避免下次打开沿用上一次状态
      pendingReorderMode: ''
    })
  },

  // 在弹窗里选择“智能重排”还是“手动编辑”
  onSelectReorderMode(e) {
    const { mode } = e.currentTarget.dataset
    if (!mode) return
    this.setData({ pendingReorderMode: mode })
  },

  // 确认重排方式：智能重排直接优化，手动编辑跳到我的路线编辑页。
  onConfirmReorderMode() {
    if (!this.data.pendingReorderMode) {
      wx.showToast({ title: '请先选择操作', icon: 'none' })
      return
    }

    if (this.data.pendingReorderMode === 'manual') {
      const previewRoute = buildPreviewRouteData(this.data, { isDraft: true })
      if (!previewRoute) return
      this.setData({
        reorderSheetVisible: false,
        previewRouteId: previewRoute.id,
        hasUnsavedPreview: true
      })
      wx.navigateTo({
        url: `/pages/my-route/my-route?route=${encodeURIComponent(JSON.stringify(previewRoute))}&edit=1&create=1&fromPreview=1`,
        success: (res) => {
          // 手动编辑保存后，把最新路线回传给当前预览页；取消则直接回到这里。
          res.eventChannel.on('previewRouteEdited', (updatedRoute) => {
            if (!updatedRoute) return
            this.setData(buildPreviewStateFromRoute(updatedRoute, this.data.currentStart))
            this.updateMap()
            if (updatedRoute.daySections && updatedRoute.daySections.length) {
              this.focusPreviewByIndex(0, -1)
            }
          })
        }
      })
      return
    }

    this.onOptimizeRoute()
  },

  // 取消页内顺序编辑，恢复备份数据。
  onCancelEdit() {
    const routeShops = JSON.parse(JSON.stringify(this.data.routeShopsBackup || []))
    this.setData({
      isEditing: false,
      routeShops,
      routeShopsBackup: [],
      currentTab: 0,
      sheetScrollTarget: ''
    })
    this.refreshPreviewRoute(routeShops)
    this.updateMap()
  },

  // 确认页内顺序编辑。
  onConfirmEdit() {
    this.setData({
      isEditing: false,
      routeShopsBackup: [],
      currentTab: 0,
      sheetScrollTarget: ''
    })
    this.refreshPreviewRoute(this.data.routeShops)
    this.updateMap()
    wx.showToast({ title: '顺序已保存', icon: 'success' })
  },

  // 某个地点上移一位
  onMoveUp(e) {
    const index = e.currentTarget.dataset.index
    if (index <= 0) return
    const shops = [...this.data.routeShops]
    ;[shops[index], shops[index - 1]] = [shops[index - 1], shops[index]]
    this.setData({ routeShops: shops })
    this.refreshPreviewRoute(shops)
    this.updateMap()
  },

  // 某个地点下移一位
  onMoveDown(e) {
    const index = e.currentTarget.dataset.index
    if (index >= this.data.routeShops.length - 1) return
    const shops = [...this.data.routeShops]
    ;[shops[index], shops[index + 1]] = [shops[index + 1], shops[index]]
    this.setData({ routeShops: shops })
    this.refreshPreviewRoute(shops)
    this.updateMap()
  },

  // 从当前路线里移除某个地点，同时取消它的“想去”状态。
  onRemoveShop(e) {
    const shopId = e.currentTarget.dataset.shopid
    const shop = this.data.allLikedShops.find(item => String(item.id) === String(shopId))
    util.toggleLike(shopId, getLikeType(shop || {}, this.data.routeType))
    this.loadRoute()
    wx.showToast({ title: '已从路线移除', icon: 'none' })
  },

  // 开始逐站导览模式。
  onStartNavigation() {
    if (this.data.routeShops.length === 0) return
    const firstShop = this.data.routeShops[0]
    this.setData({
      isNavigating: true,
      isNavComplete: false,
      currentNavIndex: 0,
      currentNavShop: firstShop,
      visitedCount: 0
    })
    this._updateNavMap()
    wx.showToast({ title: '开始美食之旅！', icon: 'success' })
  },

  // 导览模式下刷新地图：只显示“当前位置 -> 下一站”。
  _updateNavMap() {
    const { routeShops, currentNavIndex, currentStart } = this.data
    const currentShop = routeShops[currentNavIndex]
    if (!currentShop) return

    const currentLoc = app.globalData.location || currentStart
    const markers = [
      {
        id: 0,
        latitude: currentLoc.lat,
        longitude: currentLoc.lng,
        width: 24,
        height: 24,
        iconPath: '/images/location-dot.png'
      },
      {
        id: currentShop.id,
        latitude: currentShop.lat || currentShop.latitude,
        longitude: currentShop.lng || currentShop.longitude,
        width: 44,
        height: 44,
        label: {
          content: String(currentNavIndex + 1),
          color: '#ffffff',
          fontSize: 16,
          borderRadius: 14,
          bgColor: '#00D9C0',
          padding: 6,
          anchorX: 0,
          anchorY: -50
        }
      }
    ]
    const polyline = [{
      points: [
        { latitude: currentLoc.lat, longitude: currentLoc.lng },
        { latitude: currentShop.lat || currentShop.latitude, longitude: currentShop.lng || currentShop.longitude }
      ],
      color: '#00D9C0',
      width: 6,
      dottedLine: true
    }]
    this.setData({
      markers,
      polyline,
      mapCenter: { lat: currentShop.lat, lng: currentShop.lng }
    })
  },

  // 直接调用系统导航去当前这一站
  onNavToCurrent() {
    const { currentNavShop } = this.data
    if (!currentNavShop) return
    util.openDirectNavigation(currentNavShop)
  },

  // 标记“当前这一站已到达”，并进入下一站
  onVisitNav() {
    const { currentNavIndex, routeShops, visitedCount } = this.data
    const newVisitedCount = visitedCount + 1
    if (currentNavIndex >= routeShops.length - 1) {
      this.setData({ isNavComplete: true, isNavigating: false, visitedCount: newVisitedCount })
    } else {
      const nextIndex = currentNavIndex + 1
      const nextShop = routeShops[nextIndex]
      this.setData({ currentNavIndex: nextIndex, currentNavShop: nextShop, visitedCount: newVisitedCount })
      this._updateNavMap()
      wx.showToast({ title: `下一站：${nextShop.name}`, icon: 'none', duration: 2000 })
    }
  },

  // 退出导览模式，恢复普通路线地图
  onExitNav() {
    this.setData({
      isNavigating: false,
      isNavComplete: false,
      currentNavIndex: 0,
      currentNavShop: null
    })
    this.updateMap()
  },

  // 直接导航到某个地点
  onNavigateToShop(e) {
    const shop = e.currentTarget.dataset.shop
    util.openWechatNavigation(shop)
  },

  // 清空整条路线，并移除相关“想去”记录。
  onClearRoute() {
    wx.showModal({
      title: '确认清空',
      content: '清空后将取消所有「想去」记录，确定吗？',
      success: (res) => {
        if (res.confirm) {
          this.data.allLikedShops.forEach(shop => {
            util.toggleLike(shop.id, getLikeType(shop, this.data.routeType))
          })
          this.loadRoute()
          wx.showToast({ title: '已清空', icon: 'none' })
        }
      }
    })
  },

  // 重新定位当前位置，并刷新路线起点。
  onLocateMe() {
    wx.showLoading({ title: '定位中...' })
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      success: (res) => {
        wx.hideLoading()
        const location = { lat: res.latitude, lng: res.longitude, name: '我的位置' }
        app.globalData.location = location
        this.setData({ currentLocation: location })
        if (this.data.currentStart.type === 'current') {
          this.setData({ currentStart: { ...this.data.currentStart, ...location } })
          this.loadRoute()
        }
        wx.showToast({ title: '定位成功', icon: 'success' })
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '定位失败，请检查权限', icon: 'none' })
      }
    })
  },

  // 空状态按钮：回到探索首页
  onBackToHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  // 列表 / 地图 两种查看模式切换
  onSwitchMode(e) {
    const mode = e.currentTarget.dataset.mode
    if (mode === this.data.viewMode) return
    this.setData({ viewMode: mode })
    if (mode === 'map') {
      const mapDayIndex = this.data.currentTab > 0
        ? this.data.currentTab - 1
        : (this.data.routeDaySections.length ? 0 : -1)
      this.setData({ currentMapDay: mapDayIndex })
      this.focusPreviewByIndex(mapDayIndex >= 0 ? getPreviewIndexByDay(this.data.routeDaySections, mapDayIndex) : 0, mapDayIndex >= 0 ? mapDayIndex : undefined)
      this.updateMap()
    }
  },

  // 切换“行程总览 / 第一天 / 第二天...”
  onTabTap(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10)
    const sheetScrollTarget = index === 0 ? 'route-overview-anchor' : `route-day-anchor-${index - 1}`
    this.setData({ currentTab: index, sheetScrollTarget })
    if (this.data.viewMode === 'map') {
      const mapDayIndex = index > 0 ? index - 1 : (this.data.routeDaySections.length ? 0 : -1)
      this.setData({ currentMapDay: mapDayIndex })
      this.focusPreviewByIndex(mapDayIndex >= 0 ? getPreviewIndexByDay(this.data.routeDaySections, mapDayIndex) : 0, mapDayIndex >= 0 ? mapDayIndex : undefined)
    }
  },

  // 点击地点卡片，进入对应详情页
  onOpenPlaceIntro(e) {
    if (this.data.isEditing) return
    const dayIndex = parseInt(e.currentTarget.dataset.dayIndex, 10)
    const itemIndex = parseInt(e.currentTarget.dataset.index, 10)
    const day = (this.data.routeDaySections || [])[dayIndex]
    const item = ((day || {}).items || [])[itemIndex]
    if (!item) return
    this.setData({
      placeIntroVisible: true,
      placeIntroData: buildPlaceIntroData(item, this.data.cityText, DEFAULT_COVERS[0])
    })
  },

  // 关闭地点简介底部弹窗。
  onClosePlaceIntro() {
    this.setData({
      placeIntroVisible: false,
      placeIntroData: null
    })
  },

  // 点击右侧导航图标：打开导航地图选择弹窗。
  onOpenPlaceNavigation(e) {
    if (this.data.isEditing) return
    const dayIndex = parseInt(e.currentTarget.dataset.dayIndex, 10)
    const itemIndex = parseInt(e.currentTarget.dataset.index, 10)
    const day = (this.data.routeDaySections || [])[dayIndex]
    const item = ((day || {}).items || [])[itemIndex]
    if (!item) return
    this.setData({
      navMapSheetVisible: true,
      navMapTarget: {
        lat: item.lat,
        lng: item.lng,
        name: item.name,
        address: item.address || `${this.data.cityText || ''}${item.name || ''}`
      }
    })
  },

  // 点击地点简介里的地址：
  // 继续复用同一个“请选择导航地图”弹窗，避免两套导航逻辑不一致。
  onOpenPlaceIntroNavigation() {
    const target = this.data.placeIntroData
    if (!target) return
    this.setData({
      navMapSheetVisible: true,
      navMapTarget: {
        lat: target.lat,
        lng: target.lng,
        name: target.name,
        address: target.address || `${this.data.cityText || ''}${target.name || ''}`
      }
    })
  },

  // 关闭导航地图选择弹窗。
  onCloseNavMapSheet() {
    this.setData({
      navMapSheetVisible: false,
      navMapTarget: null
    })
  },

  // 在导航弹窗里选择地图应用或复制地址。
  onSelectNavMapOption(e) {
    const type = e.currentTarget.dataset.type
    const target = this.data.navMapTarget
    if (!type || !target) return

    if (type === 'tencent') {
      util.openWechatNavigation(target)
      this.onCloseNavMapSheet()
      return
    }

    if (type === 'gaode') {
      util.openGaodeNavigation(target.lat, target.lng, target.name)
      this.onCloseNavMapSheet()
      return
    }

    if (type === 'copy') {
      wx.setClipboardData({
        data: target.address || target.name,
        success: () => {
          wx.showToast({ title: '地址已复制', icon: 'success' })
          this.onCloseNavMapSheet()
        }
      })
    }
  },

  // 把当前路线保存到“我的路线”
  onSaveToMyRoute() {
    const savedRoute = savePreviewRouteData(this.data)
    if (!savedRoute) return
    this.setData({
      previewRouteId: savedRoute.id,
      hasUnsavedPreview: false
    })
    wx.showToast({ title: '已保存到路线', icon: 'success' })
  },

  // 保存当前规划路线并退出页面。
  saveAndExit() {
    const savedRoute = savePreviewRouteData(this.data)
    if (!savedRoute) {
      wx.navigateBack()
      return
    }
    this.setData({
      previewRouteId: savedRoute.id,
      hasUnsavedPreview: false
    })
    wx.showToast({ title: '已保存到路线', icon: 'success' })
    setTimeout(() => {
      wx.navigateBack({
        delta: 1,
        fail: () => {
          wx.switchTab({ url: '/pages/wantgo/wantgo' })
        }
      })
    }, 300)
  },

  // 底部“路线”按钮：切到地图模式
  onViewRoute() {
    const mapDayIndex = this.data.currentTab > 0
      ? this.data.currentTab - 1
      : (this.data.routeDaySections.length ? 0 : -1)
    this.setData({ viewMode: 'map', currentMapDay: mapDayIndex })
    this.focusPreviewByIndex(mapDayIndex >= 0 ? getPreviewIndexByDay(this.data.routeDaySections, mapDayIndex) : 0, mapDayIndex >= 0 ? mapDayIndex : undefined)
    this.updateMap()
  },

  // 根据预览下标聚焦当前地点，并刷新顶部预览卡片
  focusPreviewByIndex(index, currentDayOverride) {
    const { routeShops, routeDaySections } = this.data
    if (!routeShops.length) return
    const parsedIndex = parseInt(index, 10)
    if (Number.isNaN(parsedIndex)) return
    const safeIndex = Math.max(0, Math.min(parsedIndex, routeShops.length - 1))
    const target = routeShops[safeIndex]
    const resolvedDayIndex = typeof currentDayOverride === 'number'
      ? currentDayOverride
      : getDayIndexByPreview(routeDaySections, safeIndex)
    const previewViewData = buildMapPreviewViewData(
      routeDaySections,
      resolvedDayIndex,
      safeIndex,
      target,
      routeShops.length
    )
    this.setData({
      mapPreviewIndex: safeIndex,
      mapPreviewShop: target,
      currentMapDay: resolvedDayIndex,
      ...previewViewData,
      mapCenter: {
        lat: target.lat || target.latitude,
        lng: target.lng || target.longitude
      }
    })
  },

  // 在地图预览卡片顶部切换某一天
  onSelectMapPreviewDay(e) {
    const dayIndex = parseInt(
      (e.detail && e.detail.index) !== undefined ? e.detail.index : e.currentTarget.dataset.index,
      10
    )
    this.setData({ currentMapDay: dayIndex })
    this.focusPreviewByIndex(
      dayIndex >= 0 ? getPreviewIndexByDay(this.data.routeDaySections, dayIndex) : 0,
      dayIndex
    )
  },

  // 切换地图预览中的当前地点
  onChangeMapPreview(e) {
    const nextIndex = parseInt(
      (e.detail && e.detail.index) !== undefined ? e.detail.index : e.currentTarget.dataset.index,
      10
    )
    if (Number.isNaN(nextIndex)) return
    const nextDayIndex = getDayIndexByPreview(this.data.routeDaySections, nextIndex)
    this.focusPreviewByIndex(nextIndex, nextDayIndex)
  },

  // 点击上一站 / 下一站
  onMapPreviewStep(e) {
    const index = parseInt(
      (e.detail && e.detail.index) !== undefined ? e.detail.index : e.currentTarget.dataset.index,
      10
    )
    if (Number.isNaN(index) || index < 0) return
    this.onChangeMapPreview({ detail: { index } })
  },

  // 阻止弹窗面板点击冒泡到遮罩层。
  preventBubble() {},

  // 关闭返回确认弹窗
  onCloseExitConfirm() {
    this.setData({ exitConfirmVisible: false })
  },

  // 直接退出当前规划页，不保存当前路线
  onConfirmDirectExit() {
    this.setData({ exitConfirmVisible: false })
    wx.navigateBack({
      delta: 1,
      fail: () => {
        wx.switchTab({ url: '/pages/wantgo/wantgo' })
      }
    })
  },

  // 保持并退出：先保存路线，再离开当前页面
  onConfirmSaveExit() {
    this.setData({ exitConfirmVisible: false })
    this.saveAndExit()
  },

  // 返回上一页
  onBack() {
    if (!this.data.hasUnsavedPreview) {
      wx.navigateBack({
        delta: 1,
        fail: () => {
          wx.switchTab({ url: '/pages/wantgo/wantgo' })
        }
      })
      return
    }
    this.setData({ exitConfirmVisible: true })
  }
})
