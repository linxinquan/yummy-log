// 觅食图 V1 - 想去清单页（支持美食/景点/到访，拖拽排序）
const app = getApp()
const util = require('../../utils/util')
const placesData = require('../../utils/placesData')
const { applyTravelMeta, buildTravelOptions } = require('../../utils/travel')
const { resolveDisplayCategory } = require('../../utils/displayCategory')
const { formatTripDuration, normalizeTripSummaryText } = require('../../utils/trip-duration')
const { DEFAULT_COVER_POOL } = require('../../config/cover-pool')


const DEFAULT_DAY = 2; // 默认天数
// 每项高度(px) = 卡片高度120rpx + gap 16rpx 换算
const ITEM_H = 60 // px，每项高度用于计算排序
const DEFAULT_COVER = '/images/app-logo.jpg'
const DAY_OPTIONS = Array.from({ length: 10 }, (_, index) => index + 1)
// picker-view 在快速滑动后，最后一次 bindchange 可能会晚一点到。
// 点击"确定"时固定等待这一小段时间，再读取最终天数，避免拿到旧值。
const PLAN_DAY_CONFIRM_DELAY_MS = 220
// 删除按钮本身是 120rpx，这里额外多滑出 48rpx，统一所有页面的删除间距。
const DELETE_ACTION_WIDTH_RPX = 168
const DEFAULT_ROUTE_AVATAR = '/images/app-logo.jpg'
const DEFAULT_VISITED_MAP_CENTER = { latitude: 22.543099, longitude: 114.057868 }
// 足迹页地图统一使用这张脚印标记图，只影响"足迹"页，不改其他页面地图图标。
const VISITED_MARKER_ICON_PATH = '/images/markers/visited_footprint_marker.png'
// 切图原始尺寸是 72x72，这里按 24 x 24 展示，避免脚印标记压住周边点位。
const VISITED_MARKER_SIZE = 24
// 同坐标足迹点在地图上容易完全叠住，这里给它们一个很轻的展开半径。
const VISITED_MARKER_SPREAD_RADIUS_METERS = 36
const UNPLANNED_WANT_FILTER = '__unplanned__'
const PLANNED_WANT_FILTER = '__planned__'
const ROUTE_ACTION_OPTIONS = [
  { key: 'publish', label: '发布攻略', icon: 'mgc_send_plane_line' },
  { key: 'copy', label: '复制路线', icon: 'mgc_copy_2_line' },
  { key: 'edit', label: '编辑信息', icon: 'mgc_pencil_3_line' },
  { key: 'delete', label: '删除路线', icon: 'mgc_delete_2_line', danger: true }
]

// 读取当前登录用户的信息。
// 路线卡片没有作者时，会回退用这里的头像和昵称。
function getCurrentUserProfile() {
  const userInfo = util.loadData('userInfo', null) || {}
  return {
    nickName: userInfo.nickName || '觅食者',
    avatarUrl: userInfo.avatarUrl || DEFAULT_ROUTE_AVATAR
  }
}

// 给列表项补一个"左滑偏移量"字段。
// 这样卡片才能记住自己当前是否被左滑打开。
function withSwipeState(items) {
  return (items || []).map(item => ({
    ...item,
    swipeOffset: 0
  }))
}

// 打开某一项左滑时，顺手把其他已经打开的卡片关掉。
function closeSwipeItems(items, keepIndex = -1) {
  let changed = false
  const nextItems = (items || []).map((item, index) => {
    if (index !== keepIndex && item && item.swipeOffset) {
      changed = true
      return {
        ...item,
        swipeOffset: 0
      }
    }
    return item
  })
  return { nextItems, changed }
}

// 用比较宽松的规则判断"这是景点还是美食"。
// 这个项目里有些历史数据字段不完全统一，所以这里要多做几层兜底。
function isSpotItem(item) {
  return item.category === '景点' || item.category === '公园' || item.type === 'spot' || !item.price
}

// 给角标或标签提供一个简单的兜底文案。
function inferTagText(item) {
  if (isSpotItem(item)) {
    if ((item.category || '').includes('展馆') || (item.name || '').includes('博物馆')) {
      return '文化展馆'
    }
    return '景点'
  }
  return '美食'
}

// 把"想去人数"格式化成更短的文案，避免数字太长撑坏布局。
function formatWantCount(count) {
  const value = Number(count) || 1024
  if (value >= 10000) {
    return (value / 10000).toFixed(1).replace('.0', '') + 'w'
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1).replace('.0', '') + 'k'
  }
  return String(value)
}

// 如果原始数据没有坐标，就生成一组临时坐标，
// 这样路线规划和距离展示不会直接失效。
function buildSyntheticLatLng(basePoint, index) {
  const seed = index + 1
  return {
    lat: Number((basePoint.lat + seed * 0.0023).toFixed(6)),
    lng: Number((basePoint.lng + seed * 0.0021).toFixed(6))
  }
}

// 把想去/足迹的原始地点数据整理成卡片可直接使用的格式。
function buildPreviewItems(items) {
  const basePoint = app.globalData.location || app.globalData.centerLocation || { lat: 22.4846, lng: 113.9046 }
  const prepared = (items || []).map((item, index) => {
    const lat = item.lat || item.latitude
    const lng = item.lng || item.longitude
    const fallback = buildSyntheticLatLng(basePoint, index)
    const nextLat = lat || fallback.lat
    const nextLng = lng || fallback.lng
    const distance = util.getDistance(basePoint.lat, basePoint.lng, nextLat, nextLng)
    const filteredTags = (item.tags || []).filter(tag => !String(tag || '').endsWith('区')).slice(0, 2)
    return {
      ...item,
      lat: nextLat,
      lng: nextLng,
      tagText: inferTagText(item),
      displayWantCount: formatWantCount(item.wantCount),
      distance,
      distanceText: util.formatDistance(distance),
      tags: filteredTags
    }
  })

  const routeItems = util.planRoute(prepared.map(item => ({ ...item })), basePoint, true)
  return routeItems.map(item => applyTravelMeta(item, item.travelMode))
}

// 再做一层兜底，确保卡片一定能拿到角标、人数、距离这些字段。
function normalizePlaceCardItems(items) {
  return (items || []).map(item => {
    const fallbackDistance = Number(item.distance || item.distanceFromPrev || 0)
    return {
      ...item,
      displayCategory: item.displayCategory || resolveDisplayCategory(item),
      displayWantCount: item.displayWantCount || formatWantCount(item.wantCount),
      distanceText: item.distanceText || util.formatDistance(fallbackDistance),
      tags: Array.isArray(item.tags) ? item.tags.slice(0, 2) : []
    }
  })
}

// 给路线卡片准备一组本地封面兜底池。
function buildRouteCoverPool() {
  return [...DEFAULT_COVER_POOL, DEFAULT_COVER]
}

// 优先从路线自己的地点里找封面，找不到再回退到本地图片池。
function resolveRouteCardCover(item, index = 0) {
  const daySectionCover = (item.daySections || []).reduce((cover, day) => {
    if (cover) return cover
    const firstItem = (day.items || []).find(place => place && place.coverImage)
    return firstItem ? firstItem.coverImage : ''
  }, '')

  const localPool = buildRouteCoverPool()
  return item.coverImage || daySectionCover || localPool[index % localPool.length]
}

// 把"我的路线"里的原始数据整理成列表卡片需要的字段。
function buildRouteCards(items) {
  const currentUser = getCurrentUserProfile()
  return (items || [])
    .slice()
    .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
    .map((item, index) => {
    const hasOwnAuthor = Boolean(item.author)
    const ownAvatar = item.authorAvatar || item.avatarUrl
    const routeCover = resolveRouteCardCover(item, index)
    const fallbackDayCount = Math.max((item.daySections || []).length || item.dayCount || 1, 1)
    const fallbackPlaceCount = (item.daySections || []).reduce((sum, day) => sum + (day.items || []).length, 0)
    return {
      ...item,
      subtitle: normalizeTripSummaryText(item.subtitle, fallbackDayCount, fallbackPlaceCount),
      city: item.city || '未设置城市',
      author: hasOwnAuthor ? item.author : currentUser.nickName,
      authorAvatar: hasOwnAuthor
        ? (ownAvatar || routeCover || DEFAULT_ROUTE_AVATAR)
        : currentUser.avatarUrl,
      image: routeCover,
      coverImage: routeCover
    }
  })
}

// 想去卡片右侧点击"添加到路线"后，需要把地点塞进目标路线。
// 这里统一把地点整理成路线 daySections 可直接接收的结构，避免各页面字段不一致。
function buildRoutePlaceFromWantItem(item = {}) {
  const lat = item.lat || item.latitude || 0
  const lng = item.lng || item.longitude || 0
  return {
    id: item.id,
    name: item.name || '未命名地点',
    tag: inferTagText(item),
    coverImage: item.coverImage || item.image || DEFAULT_COVER,
    type: item.type || (isSpotItem(item) ? 'spot' : 'food'),
    rating: item.rating || item.score || '',
    tags: Array.isArray(item.tags) ? item.tags.slice(0, 2) : [],
    displayCategory: item.displayCategory || resolveDisplayCategory(item),
    desc: item.desc || '',
    hours: item.hours || '',
    openHours: item.openHours || '',
    free: item.free,
    price: item.price || '',
    address: item.address || '',
    lat,
    lng,
    latitude: lat,
    longitude: lng
  }
}

// 发布攻略前，先把每个地点的展示字段补齐。
// 这样攻略详情页就不用依赖"再次猜测"才能拿到评分和标签。
function normalizeGuideDaySections(daySections) {
  return (daySections || []).map(day => ({
    ...day,
    items: (day.items || []).map(item => {
      const displayCategory = item.displayCategory || resolveDisplayCategory(item)
      const safeTags = Array.isArray(item.tags) && item.tags.length
        ? item.tags.filter(Boolean).slice(0, 2)
        : [item.tag || item.tagText || displayCategory].filter(Boolean).slice(0, 2)
      return {
        ...item,
        image: item.coverImage || DEFAULT_COVER,
        coverImage: item.coverImage || DEFAULT_COVER,
        displayCategory,
        rating: item.rating || item.score || '',
        tags: safeTags,
        address: item.address || '',
        desc: item.desc || '',
        openHours: item.openHours || item.hours || '',
        free: item.free,
        price: item.price || ''
      }
    })
  }))
}

// 把路线数据转换成攻略数据，这是"发布攻略"的核心映射。
function buildGuideDraftFromRoute(route, copy = false) {
  const currentUser = getCurrentUserProfile()
  const daySections = normalizeGuideDaySections(route.daySections || [])
  const flatContent = daySections.reduce((result, day, dayIndex) => {
    const items = (day.items || []).map((item, itemIndex) => ({
      ...item,
      dayIndex,
      itemIndex
    }))
    return result.concat(items)
  }, [])
  const title = copy ? `${route.title || '未命名路线'}-副本` : (route.title || '未命名路线')
  return {
    id: `guide-${Date.now()}-${copy ? 'copy' : 'publish'}`,
    routeId: route.id,
    title,
    coverImage: route.coverImage || DEFAULT_COVER,
    content: flatContent,
    daySections,
    date: Date.now(),
    city: route.city || '',
    duration: formatTripDuration(Math.max(daySections.length || route.dayCount || 1, 1)),
    shopCount: flatContent.length,
    author: route.author || currentUser.nickName,
    authorAvatar: route.authorAvatar || currentUser.avatarUrl
  }
}

// 复制路线时，自动在标题前面加"（复制）"。
function buildCopiedRoute(route) {
  const timestamp = Date.now()
  const title = String(route.title || '未命名路线')
  const normalizedTitle = title.startsWith('（复制）') ? title : `（复制）${title}`
  return {
    ...route,
    id: `route-copy-${timestamp}`,
    title: normalizedTitle,
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

// 根据当前 Tab，返回对应的空状态图标、提示文案和插图。
function getEmptyStateMeta(tab) {
  if (tab === 'plan') {
    return {
      emptyIcon: 'mgc_route_line',
      emptyHint: '去攻略页导入或复制路线吧',
      emptyImage: '/images/empty/暂无数据.webp'
    }
  }
  if (tab === 'visited') {
    return {
      emptyIcon: 'mgc_foot_line',
      emptyHint: '去探索页记录你的足迹吧',
      emptyImage: '/images/empty/暂无采集.webp'
    }
  }
  return {
    emptyIcon: 'mgc_heart_line',
    emptyHint: '去探索页添加想去地点吧',
    emptyImage: '/images/empty/暂无数据.webp'
  }
}

// 足迹统计卡片统一走这一份默认值。
// 这样未登录、无数据、切换 Tab 时都能保持页面结构稳定。
function buildDefaultVisitedStats() {
  return [
    // 足迹统计图标和"我的"页保持同一套语义更明确的线性图标。
    { key: 'province', value: 0, label: '地区', icon: 'mgc_earth_3_line' },
    { key: 'city', value: 0, label: '城市', icon: 'mgc_building_2_line' },
    { key: 'place', value: 0, label: '地点', icon: 'mgc_location_line' },
    { key: 'checkin', value: 0, label: '采集', icon: 'mgc_flower_4_line' }
  ]
}

// 地点范围筛选统一在这里做文案映射，避免页面里散落多份判断。
function getWantFilterLabel(filterValue = '') {
  if (filterValue === UNPLANNED_WANT_FILTER) return '未规划地点'
  if (filterValue === PLANNED_WANT_FILTER) return '已规划地点'
  return filterValue || '全部'
}

// 省级地区目前没有单独字段，所以这里优先从地址里提取。
// 直辖市 / 特别行政区直接按完整名称统计，避免被归错。
function extractVisitedProvince(record = {}, place = {}) {
  const address = String(record.address || place.address || '').trim()
  if (!address) return ''

  const municipalityMatch = address.match(/(北京市|天津市|上海市|重庆市)/)
  if (municipalityMatch) return municipalityMatch[1]

  const specialRegionMatch = address.match(/(香港特别行政区|澳门特别行政区)/)
  if (specialRegionMatch) return specialRegionMatch[1]

  const autonomousRegionMatch = address.match(/((?:内蒙古自治区|广西壮族自治区|西藏自治区|宁夏回族自治区|新疆维吾尔自治区))/)
  if (autonomousRegionMatch) return autonomousRegionMatch[1]

  const provinceMatch = address.match(/([^省]+省)/)
  return provinceMatch ? provinceMatch[1] : ''
}

// 城市优先用打卡时已经存下来的 city；
// 历史数据缺 city 时，再从地址里补提取。
function extractVisitedCity(record = {}, place = {}) {
  const savedCity = String(record.city || place.city || '').trim()
  if (savedCity) return savedCity

  const address = String(record.address || place.address || '').trim()
  if (!address) return ''

  const municipalityMatch = address.match(/(北京市|天津市|上海市|重庆市)/)
  if (municipalityMatch) return municipalityMatch[1]

  const cityPatterns = [
    /省([^省]+?市)/,
    /自治区([^区]+?市)/,
    /特别行政区([^区]+?市)/,
    /([^省]+?市)/
  ]

  for (let index = 0; index < cityPatterns.length; index += 1) {
    const match = address.match(cityPatterns[index])
    if (match && match[1]) {
      return match[1]
    }
  }

  return ''
}

// 这里不用特别精细地算缩放级别，只要让全国 / 跨城 / 同城几种场景都能大致看全。
function resolveVisitedMapScale(markers = []) {
  if (!markers.length) return 11
  if (markers.length === 1) return 14

  const latitudes = markers.map(item => item.latitude)
  const longitudes = markers.map(item => item.longitude)
  const maxSpan = Math.max(
    Math.max(...latitudes) - Math.min(...latitudes),
    Math.max(...longitudes) - Math.min(...longitudes)
  )

  if (maxSpan > 20) return 4
  if (maxSpan > 10) return 5
  if (maxSpan > 5) return 6
  if (maxSpan > 2) return 7
  if (maxSpan > 1) return 8
  if (maxSpan > 0.5) return 9
  if (maxSpan > 0.2) return 10
  if (maxSpan > 0.08) return 11
  if (maxSpan > 0.03) return 12
  return 13
}

// 把完全相同坐标的足迹 marker 稍微错开，避免用户视觉上只看到一个点。
function spreadOverlappingVisitedMarkers(markers = []) {
  const groupedMarkers = {}
  const nextMarkers = (markers || []).map(item => ({ ...item }))

  nextMarkers.forEach((item, index) => {
    const coordinateKey = `${Number(item.latitude).toFixed(6)},${Number(item.longitude).toFixed(6)}`
    if (!groupedMarkers[coordinateKey]) groupedMarkers[coordinateKey] = []
    groupedMarkers[coordinateKey].push({ index, marker: item })
  })

  Object.keys(groupedMarkers).forEach((coordinateKey) => {
    const group = groupedMarkers[coordinateKey]
    if (!group || group.length <= 1) return

    const baseMarker = group[0].marker
    const baseLatitude = Number(baseMarker.latitude)
    const baseLongitude = Number(baseMarker.longitude)
    const angleStep = 360 / group.length
    const safeCos = Math.max(Math.abs(Math.cos(baseLatitude * Math.PI / 180)), 0.2)
    const latitudeOffsetUnit = VISITED_MARKER_SPREAD_RADIUS_METERS / 111320
    const longitudeOffsetUnit = VISITED_MARKER_SPREAD_RADIUS_METERS / (111320 * safeCos)

    group.forEach((entry, groupIndex) => {
      const angle = (-90 + angleStep * groupIndex) * Math.PI / 180
      nextMarkers[entry.index] = {
        ...entry.marker,
        latitude: baseLatitude + latitudeOffsetUnit * Math.cos(angle),
        longitude: baseLongitude + longitudeOffsetUnit * Math.sin(angle)
      }
    })
  })

  return nextMarkers
}

// 足迹页顶部的地图和统计卡片都从这里统一组装。
// 这样页面只负责展示，不需要在 WXML 里再拼复杂逻辑。
function buildVisitedOverview() {
  const footprintItems = util.getFootprintItemsAsync() || []
  const footprintSourceRecords = util.getFootprintSourceRecordsAsync() || []
  const checkinRecords = util.loadData('checkin_records', []) || []
  const provinceSet = new Set()
  const citySet = new Set()
  const rawMapMarkers = []

  footprintSourceRecords.forEach(record => {
    const province = extractVisitedProvince(record)
    const city = extractVisitedCity(record)

    if (province) provinceSet.add(province)
    if (city) citySet.add(city)
  })

  footprintItems.forEach((item, index) => {
    const latitude = typeof item.lat === 'number' ? item.lat : Number(item.lat || item.latitude)
    const longitude = typeof item.lng === 'number' ? item.lng : Number(item.lng || item.longitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return

    rawMapMarkers.push({
      id: item.checkedInRecordId || item.id || `visited-marker-${index}`,
      latitude,
      longitude,
      // 足迹页改成设计给定的脚印切图，避免再跟通用分类 marker 混用。
      iconPath: VISITED_MARKER_ICON_PATH,
      width: VISITED_MARKER_SIZE,
      height: VISITED_MARKER_SIZE,
      anchor: { x: 0.5, y: 0.5 }
    })
  })
  const mapMarkers = spreadOverlappingVisitedMarkers(rawMapMarkers)

  let mapCenter = DEFAULT_VISITED_MAP_CENTER
  if (rawMapMarkers.length) {
    const latitudes = rawMapMarkers.map(item => item.latitude)
    const longitudes = rawMapMarkers.map(item => item.longitude)
    mapCenter = {
      latitude: (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
      longitude: (Math.min(...longitudes) + Math.max(...longitudes)) / 2
    }
  }

  return {
    hasVisited: footprintItems.length > 0,
    items: footprintItems,
    visitedStats: [
      // 统计卡片图标和默认态保持一致，避免空态/有数据态图标不统一。
      { key: 'province', value: provinceSet.size, label: '地区', icon: 'mgc_earth_3_line' },
      { key: 'city', value: citySet.size, label: '城市', icon: 'mgc_building_2_line' },
      { key: 'place', value: footprintItems.length, label: '地点', icon: 'mgc_location_line' },
      // "采集"只统计拍照采集记录，不把手动足迹算进去。
      { key: 'checkin', value: checkinRecords.length, label: '采集', icon: 'mgc_flower_4_line' }
    ],
    visitedMapMarkers: mapMarkers,
    visitedMapCenter: mapCenter,
    visitedMapScale: resolveVisitedMapScale(mapMarkers)
  }
}

// 足迹页现在固定展示地图和统计卡片，不再走空状态页。
function shouldKeepVisitedLayout(tab) {
  return tab === 'visited'
}

// 统一打开地点详情：
// 足迹里如果是"系统未收录但用户采集过的地点"，就把完整对象直接带去详情页。
function openPlaceDetail(item) {
  if (!item) return
  if (item.detailSource === 'record') {
    const spotStr = encodeURIComponent(JSON.stringify(item))
    wx.navigateTo({ url: `/subpackages/extra/pages/spot-detail/spot-detail?spotData=${spotStr}` })
    return
  }
  wx.navigateTo({ url: `/subpackages/extra/pages/spot-detail/spot-detail?id=${item.id}` })
}

Page({
  data: {
    // 登录状态
    isLoggedIn: false,
    // 加载状态
    loading: false,
    // 当前Tab
    tab: 'want',
    titles: {
      want: '想去',
      plan: '路线',
      visited: '足迹'
    },
    emptyIcon: 'mgc_heart_line',
    emptyHint: '去探索页添加想去地点吧',
    // 数据
    items: [],
    empty: true,
    // 导航栏高度（动态计算）
    statusBarHeight: 44,
    navBarHeight: 88,
    tabBarTop: 88,
    contentTop: 108,
    // 拖拽状态
    dragging: false,
    dragIndex: -1,
    dragY: 0,
    transportOptions: [],
    pendingTransportMode: 'drive',
    transportTargetIndex: -1,
    planDaySheetVisible: false,
    dayOptions: DAY_OPTIONS,
    selectedPlanDayCount: DEFAULT_DAY,
    deleteActionWidthPx: 72,
    routeActionSheetVisible: false,
    routeActionOptions: ROUTE_ACTION_OPTIONS,
    // 删除路线确认统一改成自定义底部弹窗。
    deleteRouteConfirmVisible: false,
    // 路线编辑弹窗默认不选中任何操作，需用户手动选择
    selectedRouteAction: '',
    routeActionTarget: null,
    // 想去地点右侧加号：弹出"添加到路线"底部卡片列表。
    routePickerVisible: false,
    routePickerRoutes: [],
    routePickerTargetPlace: null,
    // 地点范围筛选：
    // "全部 / 未规划地点 / 已规划地点 / 城市" 都统一放到左上角底部弹窗里。
    cityFilter: '',
    cityFilterLabel: '全部',
    cityFilterVisible: false,
    cityOptions: [],
    // 足迹页顶部展示区：地图 + 3 张统计卡片。
    visitedStats: buildDefaultVisitedStats(),
    visitedMapMarkers: [],
    visitedMapCenter: DEFAULT_VISITED_MAP_CENTER,
    visitedMapScale: 11
  },

  // 检查登录状态
  _checkLogin() {
    const isLoggedIn = util.isCloudMode() && !!util.loadData('userInfo', null)
    this.setData({ isLoggedIn })
    return isLoggedIn
  },

  // 页面初始化：
  // 1. 接收外部传入的 tab
  // 2. 计算顶部安全区域高度
  // 3. 计算左滑删除的真实宽度
  onLoad(options) {
    // 支持从外部传入 tab 参数
    const tab = options.tab || 'want'
    // 动态获取状态栏高度，解决刘海屏遮挡问题
    const sysInfo = wx.getSystemInfoSync()
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const menuTop = menuButtonInfo ? menuButtonInfo.top : (sysInfo.statusBarHeight || 44) + 4
    const menuHeight = menuButtonInfo ? menuButtonInfo.height : 32
    const menuRightInset = menuButtonInfo
      ? Math.max(sysInfo.windowWidth - menuButtonInfo.left + 8, 24)
      : 103
    
    // 顶部内容预留的高度（留出一些下边距）
    const contentTop = menuTop + menuHeight + 12
    const listTop = contentTop + 25
    const deleteActionWidthPx = sysInfo.windowWidth * DELETE_ACTION_WIDTH_RPX / 750
    const emptyStateMeta = getEmptyStateMeta(tab)

    this.setData({ 
      tab, 
      ...emptyStateMeta,
      menuTop,
      menuHeight,
      menuRightInset,
      contentTop,
      listTop,
      deleteActionWidthPx
    })
  },

  onUnload() {
    // 页面销毁前，顺手把悬浮入口相关弹层状态清掉。
    this.setData({
      addEntryVisible: false,
      importEntryVisible: false
    })
  },

  onHide() {
    // 离开页面时关闭悬浮入口，避免返回时残留半开的弹层状态。
    this.setData({
      addEntryVisible: false,
      importEntryVisible: false
    })
  },

  // ─── 返回 ─────────────────────────────
  onBack() {
    wx.navigateBack({ fail: () => {
      wx.switchTab({ url: '/pages/index/index' })
    }})
  },

  // ─── 跳转首页 ─────────────────────────────
  onGoHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  // ─── 跳转个人页登录 ─────────────────────────────
  onGoLogin() {
    wx.switchTab({ url: '/pages/my/my' })
  },

  // 足迹地图右上角：重新定位到用户当前位置。
  // 这里只更新足迹地图自己的中心点和缩放，不改其他页面状态。
  onVisitedMapMyLocation() {
    wx.showLoading({ title: '定位中...' })
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      success: (res) => {
        wx.hideLoading()
        this.setData({
          visitedMapCenter: {
            latitude: res.latitude,
            longitude: res.longitude
          },
          // 重新定位后顺手拉近一些，方便看到当前位置周边。
          visitedMapScale: 14
        })
        wx.showToast({
          title: '已定位到当前位置',
          icon: 'success',
          duration: 1500
        })
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({
          title: '定位失败',
          icon: 'none'
        })
      }
    })
  },

  // 足迹地图右下角：添加足迹。
  // 这是独立于"采集"的一套记录，只存地点，不存照片。
  onOpenVisitedCheckin() {
    // 足迹属于用户自己的记录，先走统一登录校验。
    if (!util.requireLogin({ toastText: '请先登录后添加足迹' })) return

    wx.chooseLocation({
      success: (res) => {
        // 地图返回的地点名有时会为空，这里统一做兜底，保证足迹记录可展示。
        const spotName = String(res.name || res.address || '未命名地点').trim()
        const address = String(res.address || res.name || '').trim()
        const latitude = Number(res.latitude)
        const longitude = Number(res.longitude)

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          wx.showToast({
            title: '地点信息不完整',
            icon: 'none'
          })
          return
        }

        wx.showLoading({ title: '添加中...' })

        // 手动足迹单独存储，避免"我的采集"页面误把它当成采集记录。
        util.saveManualFootprintAsync({
          type: 'spot',
          spotName,
          address,
          latitude,
          longitude,
          description: ''
        })

        wx.hideLoading()
        this._loadData('visited')
        wx.showToast({
          title: '已添加足迹',
          icon: 'success'
        })
      },
      fail: (err) => {
        // 用户主动取消选点时不提示，避免打断操作节奏。
        if (err && String(err.errMsg || '').includes('cancel')) return
        wx.showToast({
          title: '打开地图失败',
          icon: 'none'
        })
      }
    })
  },

  // 页面重新显示时，检查登录状态并加载数据。
  onShow() {
    const pendingTab = wx.getStorageSync('pendingWantgoTab')

    // 从 localStorage 恢复上次的 cityFilter（防页面重建丢失）
    const savedFilter = wx.getStorageSync('wantgoCityFilter') || ''

    // 关闭悬浮入口弹层（始终需要）
    const baseUpdate = {
      addEntryVisible: false,
      importEntryVisible: false
    }

    // 是否需要重新加载数据：有 pendingTab 切换 或 首次进入/页面重建时
    const needsDataLoad = !!pendingTab || this.data.items.length === 0

    if (!needsDataLoad) {
      // 已在当前页且有数据：只做轻量更新，不重新加载，避免闪烁。
      this._checkLogin()
      if (savedFilter !== this.data.cityFilter) {
        baseUpdate.cityFilter = savedFilter
        baseUpdate.cityFilterLabel = getWantFilterLabel(savedFilter)
      }
      this.setData(baseUpdate)
      return
    }

    // 需要加载数据：有 pendingTab 切 tab，没有则沿用当前 tab。
    const effectiveTab = pendingTab || this.data.tab
    if (pendingTab) {
      wx.removeStorageSync('pendingWantgoTab')
    }
    if (savedFilter !== this.data.cityFilter) {
      baseUpdate.cityFilter = savedFilter
      baseUpdate.cityFilterLabel = getWantFilterLabel(savedFilter)
    }
    this.setData({
      ...baseUpdate,
      tab: effectiveTab,
      ...getEmptyStateMeta(effectiveTab),
      items: [],
      loading: true,
      // 足迹页固定展示，不再显示空状态页。
      empty: shouldKeepVisitedLayout(effectiveTab) ? false : true
    })
    this._checkLogin()
    this._loadData(effectiveTab)
  },

  // ─── Tab切换：想去 / 路线 / 足迹 ─────────────────────────────
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.tab) return
    this.setData({
      tab,
      ...getEmptyStateMeta(tab),
      items: [],
      loading: true,
      // 切到足迹时直接保留页面骨架，避免先闪一下空状态。
      empty: shouldKeepVisitedLayout(tab) ? false : true,
      addEntryVisible: false,
      importEntryVisible: false
    })
    this._loadData(tab)
  },

  // 按当前 Tab 读取不同的数据源（同步读本地 + 后台同步）：
  // want 读想去地点，plan 读我的路线，visited 读足迹。
  // tab 由调用方传入，不从 this.data 读取，避免 setData 批处理导致的脏读。
  _loadData(tab) {
    const isLoggedIn = this._checkLogin()
    if (!isLoggedIn) {
      if (shouldKeepVisitedLayout(tab)) {
        // 足迹页未登录时也保留地图和统计卡片，只展示 0 数据。
        this.setData({
          items: [],
          empty: false,
          loading: false,
          visitedStats: buildDefaultVisitedStats(),
          visitedMapMarkers: [],
          visitedMapCenter: DEFAULT_VISITED_MAP_CENTER,
          visitedMapScale: 11,
          emptyIcon: 'mgc_user_3_line',
          emptyHint: '请先登录，查看你的清单'
        })
        return
      }

      this.setData({
        items: [],
        empty: true,
        loading: false,
        visitedStats: buildDefaultVisitedStats(),
        visitedMapMarkers: [],
        visitedMapCenter: DEFAULT_VISITED_MAP_CENTER,
        visitedMapScale: 11,
        emptyIcon: 'mgc_user_3_line',
        emptyHint: '请先登录，查看你的清单'
      })
      return
    }
    // 所有数据都是同步读取，先构建完整数据对象，再一次性 setData，避免 loading → 内容之间的闪烁。
    const nextState = { loading: false }

    if (tab === 'want') {
      // 新格式：userWantList 存储所有想去的 ID（美食+景点）
      const wantIds = util.getWantListAsync()
      const userShops = util.getUserShopsAsync()
      const savedRoutes = util.getRoutesAsync()
      const plannedWantIds = new Set(
        savedRoutes.reduce((result, route) => {
          ;(route.daySections || []).forEach(day => {
            ;(day.items || []).forEach(item => {
              if (item && item.id !== undefined && item.id !== null) {
                result.push(String(item.id))
              }
            })
          })
          return result
        }, [])
      )
      
      // 通过 placesData.getPlaceById 一次性读取所有想去地点的完整数据
      const wantItems = wantIds
        .map(id => {
          // 先查 placesData（美食+景点）
          let place = placesData.getPlaceById(id)
          // 如果找不到，再查用户自己添加的店铺
          if (!place) {
            place = userShops.find(s => String(s.id) === String(id))
          }
          return place
        })
        .filter(Boolean)  // 过滤掉找不到的数据（防护数据不一致）
        .map(item => ({
          ...item,
          // 确保有 type 字段（美食或景点）
          type: item.type || (item.category === '景点' || item.category === '公园' ? 'spot' : 'food'),
          isPlannedRoute: plannedWantIds.has(String(item.id))
        }))
      
      const plannedWantItems = wantItems.filter(item => item.isPlannedRoute)
      const unplannedWantItems = wantItems.filter(item => !item.isPlannedRoute)
      const cities = [...new Set(wantItems.map(item => item.city || '其他').filter(Boolean))].sort()

      // 如果当前筛选已失效，就自动重置为"全部"。
      const cityFilter = this.data.cityFilter
      const effectiveFilter = cityFilter === PLANNED_WANT_FILTER || cityFilter === UNPLANNED_WANT_FILTER
        ? cityFilter
        : (cityFilter && cities.includes(cityFilter) ? cityFilter : '')
      
      const filteredItems = effectiveFilter === PLANNED_WANT_FILTER
        ? plannedWantItems
        : (
          effectiveFilter === UNPLANNED_WANT_FILTER
            ? unplannedWantItems
            : (
              effectiveFilter
                ? wantItems.filter(item => (item.city || '其他') === effectiveFilter)
                : wantItems
            )
        )
      
      Object.assign(nextState, {
        items: withSwipeState(normalizePlaceCardItems(buildPreviewItems(filteredItems))),
        empty: wantItems.length === 0,
        cityOptions: cities,
        cityFilter: effectiveFilter,
        cityFilterLabel: getWantFilterLabel(effectiveFilter)
      })
      // 把有效筛选同步到 localStorage，保持和显示一致
      wx.setStorageSync('wantgoCityFilter', effectiveFilter)
    } else if (tab === 'plan') {
      const savedRoutes = util.getRoutesAsync()
      const normalizedRoutes = savedRoutes.map((item, index) => {
        const routeCover = resolveRouteCardCover(item, index)
        const fallbackDayCount = Math.max((item.daySections || []).length || item.dayCount || 1, 1)
        const fallbackPlaceCount = (item.daySections || []).reduce((sum, day) => sum + (day.items || []).length, 0)
        return {
          ...item,
          subtitle: normalizeTripSummaryText(item.subtitle, fallbackDayCount, fallbackPlaceCount),
          image: item.image || routeCover,
          coverImage: routeCover
        }
      })
      if (JSON.stringify(normalizedRoutes) !== JSON.stringify(savedRoutes)) {
        util.saveData('savedRoutes', normalizedRoutes)
      }
      const visibleRoutes = normalizedRoutes.filter(item => !item.isDraft)
      const routeCards = buildRouteCards(visibleRoutes)
      Object.assign(nextState, { items: routeCards, empty: routeCards.length === 0 })
    } else {
      // tab === 'visited'
      const visitedOverview = buildVisitedOverview()
      Object.assign(nextState, {
        items: visitedOverview.items,
        empty: false,
        visitedStats: visitedOverview.visitedStats,
        visitedMapMarkers: visitedOverview.visitedMapMarkers,
        visitedMapCenter: visitedOverview.visitedMapCenter,
        visitedMapScale: visitedOverview.visitedMapScale
      })
    }

    this.setData(nextState)
  },

  // ─── 点击路线卡片：进入我的路线详情 ─────────────────────────────
  onRouteCardTap(e) {
    if (Date.now() - (this._lastRouteLongPressTime || 0) < 350) return
    const route = e.currentTarget.dataset.route
    const routeStr = encodeURIComponent(JSON.stringify(route))
    wx.navigateTo({ url: `/subpackages/route/pages/my-route/my-route?route=${routeStr}` })
  },

  // 长按路线卡片：打开路线操作弹窗
  onRouteCardLongPress(e) {
    const route = e.currentTarget.dataset.route
    if (!route) return
    this._lastRouteLongPressTime = Date.now()
    wx.vibrateShort({ type: 'light' })
    this.setData({
      routeActionSheetVisible: true,
      // 每次打开都重置为未选择状态
      selectedRouteAction: '',
      routeActionTarget: route
    })
  },

  // 关闭路线操作弹窗
  onCloseRouteActionSheet() {
    this.setData({
      routeActionSheetVisible: false,
      // 关闭弹窗时清空选择，避免下次打开沿用上次状态
      selectedRouteAction: '',
      routeActionTarget: null
    })
  },

  // 点击操作项：执行对应操作并关闭弹窗
  onSelectRouteAction(e) {
    const action = e.currentTarget.dataset.action
    if (!action) return
    
    const route = this.data.routeActionTarget
    if (!route) return
    
    switch (action) {
      case 'publish':
        this.publishRouteAsGuide(route, false)
        this.onCloseRouteActionSheet()
        break
      case 'copy':
        this.copyRoute(route)
        this.onCloseRouteActionSheet()
        break
      case 'edit':
        this.editRoute(route)
        this.onCloseRouteActionSheet()
        break
      case 'delete':
        // deleteRoute 会自己处理关闭弹窗的逻辑
        this.deleteRoute(route)
        break
      default:
        break
    }
  },

  // 复制路线（本地优先 + 后台同步）
  copyRoute(route) {
    const savedRoutes = util.getRoutesAsync()
    const newRoute = {
      ...route,
      id: Date.now(), // 生成新ID
      title: route.title + ' (复制)',
      createTime: Date.now()
    }
    savedRoutes.push(newRoute)
    util.saveData('savedRoutes', savedRoutes)
    wx.showToast({ title: '已复制路线', icon: 'success' })
    // 同步推云端
    util.saveRouteAsync(newRoute)
    // 刷新列表（读本地，零等待）
    this._loadData(this.data.tab)
  },

  // 编辑路线
  editRoute(route) {
    // 跳转到路线编辑页面，并自动进入编辑模式
    const routeStr = encodeURIComponent(JSON.stringify(route))
    wx.navigateTo({ url: `/subpackages/route/pages/my-route/my-route?route=${routeStr}&edit=1&returnTo=plan` })
  },

  // 删除路线（本地优先 + 后台同步）
  deleteRoute(route) {
    if (!route) return
    // 关闭路线操作弹层后，改为展示自定义删除确认层。
    this.setData({
      routeActionSheetVisible: false,
      selectedRouteAction: '',
      routeActionTarget: route,
      deleteRouteConfirmVisible: true
    })
  },

  // 关闭删除路线确认层。
  onCloseDeleteRouteConfirm() {
    this.setData({
      deleteRouteConfirmVisible: false,
      routeActionTarget: null
    })
  },

  // 用户确认后再真正执行删除。
  onConfirmDeleteRoute() {
    const route = this.data.routeActionTarget
    if (!route) return

    util.deleteRouteAsync(route._id || route.id)
    wx.showToast({ title: '已删除', icon: 'success' })
    this.setData({
      deleteRouteConfirmVisible: false,
      routeActionTarget: null
    })
    // 刷新列表（读本地，零等待）
    this._loadData(this.data.tab)
  },

  // 把一条路线发布成攻略，并保存到 myGuides 里
  publishRouteAsGuide(route, copy = false) {
    const guides = util.loadData('myGuides', [])
    if (!copy) {
      const exists = guides.find(item => String(item.routeId) === String(route.id))
      if (exists) {
        wx.showToast({ title: '已发布过攻略', icon: 'none' })
        return
      }
    }
    const nextGuides = [buildGuideDraftFromRoute(route, copy)].concat(guides)
    util.saveData('myGuides', nextGuides)
    wx.showToast({ title: copy ? '已复制攻略' : '已发布为攻略', icon: 'success' })
  },

  // ─── 点击地点卡片：进入详情页；如果有左滑打开，先帮用户收起 ─────────────────────────────
  onItemTap(e) {
    if (this.data.tab === 'want') {
      const index = parseInt(e.currentTarget.dataset.index, 10)
      const items = this.data.items || []
      const tappedItem = items[index]
      const hasOpenItem = items.some(item => item && item.swipeOffset)
      if (Date.now() - (this._lastSwipeTime || 0) < 250) {
        return
      }
      if (hasOpenItem) {
        const { nextItems } = closeSwipeItems(items)
        this.setData({ items: nextItems })
        if (tappedItem && tappedItem.swipeOffset) {
          return
        }
      }
    }

    const item = e.currentTarget.dataset.item
    openPlaceDetail(item)
  },

  // 想去卡片右侧"+"按钮：打开路线卡片弹窗，把当前地点添加到指定路线。
  onOpenRoutePicker(e) {
    const item = e.currentTarget.dataset.item
    if (!item) return

    const savedRoutes = util.getRoutesAsync().filter(route => !route.isDraft)
    if (!savedRoutes.length) {
      wx.showToast({ title: '还没有路线', icon: 'none' })
      return
    }
    const routeCards = buildRouteCards(savedRoutes)
    this.setData({
      routePickerVisible: true,
      routePickerRoutes: routeCards,
      routePickerTargetPlace: item
    })
  },

  // 关闭"添加到路线"弹窗。
  onCloseRoutePicker() {
    this.setData({
      routePickerVisible: false,
      routePickerRoutes: [],
      routePickerTargetPlace: null
    })
  },

  // 选中一条路线后，直接把当前地点追加进去并保存。
  onSelectRoutePickerCard(e) {
    const route = e.currentTarget.dataset.route
    const place = this.data.routePickerTargetPlace
    if (!route || !place) return

    const savedRoutes = util.getRoutesAsync()
    const routeIndex = savedRoutes.findIndex(item => String(item.id) === String(route.id))
    if (routeIndex < 0) {
      wx.showToast({ title: '路线不存在', icon: 'none' })
      return
    }

    const targetRoute = savedRoutes[routeIndex]
    const nextSections = (targetRoute.daySections || []).map(day => ({
      ...day,
      items: Array.isArray(day.items) ? day.items.slice() : []
    }))

    // 没有天数时自动补第一天；已有天数时默认加到最后一天，避免打乱前面行程。
    if (!nextSections.length) {
      nextSections.push({
        id: `day-0`,
        title: '第1天',
        items: []
      })
    }

    const routePlace = buildRoutePlaceFromWantItem(place)
    const hasExistingPlace = nextSections.some(day =>
      (day.items || []).some(item => String(item.id) === String(routePlace.id))
    )
    if (hasExistingPlace) {
      wx.showToast({ title: '该地点已在路线中', icon: 'none' })
      return
    }

    const lastDayIndex = Math.max(nextSections.length - 1, 0)
    nextSections[lastDayIndex].items.push(routePlace)

    const totalPlaceCount = nextSections.reduce((sum, day) => sum + ((day.items || []).length), 0)
    const updatedRoute = {
      ...targetRoute,
      daySections: nextSections,
      dayCount: Math.max(nextSections.length, 1),
      subtitle: normalizeTripSummaryText(targetRoute.subtitle, nextSections.length, totalPlaceCount),
      updatedAt: Date.now()
    }

    savedRoutes[routeIndex] = updatedRoute
    util.saveData('savedRoutes', savedRoutes)
    util.updateRouteAsync(updatedRoute._id || updatedRoute.id, updatedRoute)

    wx.showToast({ title: '已添加到路线', icon: 'success' })
    this.onCloseRoutePicker()
    if (this.data.tab === 'plan') {
      this._loadData('plan')
    }
  },

  // 左滑开始：记录起点坐标和当前卡片状态
  onCardTouchStart(e) {
    if (this.data.tab !== 'want') return
    const index = parseInt(e.currentTarget.dataset.index, 10)
    const touch = e.touches && e.touches[0]
    if (Number.isNaN(index) || !touch) return

    const items = this.data.items || []
    const currentItem = items[index]
    const { nextItems, changed } = closeSwipeItems(items, index)
    if (changed) {
      this.setData({ items: nextItems })
    }

    this._swipeGesture = {
      index,
      startX: touch.clientX,
      startY: touch.clientY,
      startOffset: (currentItem && currentItem.swipeOffset) || 0,
      isHorizontal: false,
      locked: false,
      moved: false
    }
  },

  // 左滑过程：根据手指移动距离更新卡片偏移量
  onCardTouchMove(e) {
    if (this.data.tab !== 'want' || !this._swipeGesture) return
    const touch = e.touches && e.touches[0]
    if (!touch) return

    const gesture = this._swipeGesture
    const deltaX = touch.clientX - gesture.startX
    const deltaY = touch.clientY - gesture.startY

    if (!gesture.isHorizontal && !gesture.locked) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        gesture.locked = true
        return
      }
      gesture.isHorizontal = true
    }

    if (!gesture.isHorizontal) return

    const items = [...(this.data.items || [])]
    const currentItem = items[gesture.index]
    if (!currentItem) return

    let nextOffset = gesture.startOffset + deltaX
    const minOffset = -this.data.deleteActionWidthPx
    nextOffset = Math.max(minOffset, Math.min(0, nextOffset))

    if (currentItem.swipeOffset === nextOffset) return
    items[gesture.index] = {
      ...currentItem,
      swipeOffset: nextOffset
    }
    gesture.moved = true
    this.setData({ items })
  },

  // 左滑结束：自动决定是打开删除按钮，还是回弹关闭
  onCardTouchEnd() {
    if (this.data.tab !== 'want' || !this._swipeGesture) return

    const gesture = this._swipeGesture
    const items = [...(this.data.items || [])]
    const currentItem = items[gesture.index]
    if (!currentItem) {
      this._swipeGesture = null
      return
    }

    const minOffset = -this.data.deleteActionWidthPx
    const shouldOpen = Math.abs(currentItem.swipeOffset || 0) > this.data.deleteActionWidthPx / 2
    const finalOffset = shouldOpen ? minOffset : 0

    if (currentItem.swipeOffset !== finalOffset) {
      items[gesture.index] = {
        ...currentItem,
        swipeOffset: finalOffset
      }
      this.setData({ items })
    }

    if (gesture.moved) {
      this._lastSwipeTime = Date.now()
    }
    this._swipeGesture = null
  },

  // 创建路线：由组件 emit 事件触发
  onEntryCreateRoute() {
    wx.navigateTo({
      url: '/subpackages/route/pages/route-basic-edit/route-basic-edit?create=1'
    })
  },

  // 解析确认后跳转：由组件 emit confirmlink 事件触发
  onEntryConfirmLink(e) {
    const { url } = e.detail
    wx.navigateTo({ url: `${url}&returnTo=plan` })
  },

  // 关闭旅行天数弹窗
  onClosePlanDaySheet() {
    // 关闭弹窗时一并清掉延时确认，避免用户取消后还继续跳转。
    if (this._planRouteConfirmTimer) {
      clearTimeout(this._planRouteConfirmTimer)
      this._planRouteConfirmTimer = null
    }
    this._isConfirmingPlanRoute = false
    this.setData({ planDaySheetVisible: false })
  },

  // 选择路线规划的旅行天数
  onSelectPlanDay(e) {
    const value = e.detail && e.detail.value
    const pickerIndex = Array.isArray(value) ? parseInt(value[0], 10) : parseInt(value, 10)
    if (Number.isNaN(pickerIndex)) return
    const dayCount = this.data.dayOptions[pickerIndex]
    if (!dayCount) return
    // picker-view 切换后，先把最新值同步到实例字段。
    // 这样用户刚滑到"1 天"就立刻点确定时，也不会因为 setData 还没完成而读到旧值 2。
    this._lastPlanDayChangeAt = Date.now()
    this._pendingPlanDayCount = dayCount
    this.setData({ selectedPlanDayCount: dayCount })
  },

  // ─── 拖拽开始（长按）：用于调整路线列表顺序 ─────────────────────────────
  onDragStart(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ dragging: true, dragIndex: index })
    wx.vibrateShort()
  },

  // ─── 拖拽移动：实时换位 ─────────────────────────────
  onDragMove(e) {
    const { dragIndex, items } = this.data
    if (dragIndex < 0 || items.length <= 1) return

    const touchY = e.touches[0].clientY
    const startY = this.data.touchStartY || touchY
    const deltaY = touchY - startY
    const step = Math.round(deltaY / ITEM_H)
    let targetIndex = dragIndex + step
    targetIndex = Math.max(0, Math.min(items.length - 1, targetIndex))

    if (targetIndex !== dragIndex) {
      const newItems = [...items]
      const [moved] = newItems.splice(dragIndex, 1)
      newItems.splice(targetIndex, 0, moved)
      this.setData({ items: newItems, dragIndex: targetIndex })
    }
  },

  // ─── 拖拽结束：把新顺序保存回本地缓存 ─────────────────────────────
  onDragEnd() {
    const { tab, items } = this.data
    if (!this.data.dragging) return
    // 保存排序后的顺序
    if (tab === 'plan') {
      // 新格式：直接保存所有 ID 到 userWantList（不区分 spot/food）
      const sortedIds = items.map(item => String(item.id))
      util.saveData('userWantList', sortedIds)
      const syncManager = require('../../utils/db/syncManager')
      syncManager.enqueuePush('wantList')
    }
    this.setData({ dragging: false, dragIndex: -1 })
  },


  // ─── 从"想去"里删除当前地点（本地优先 + 后台同步）─────────────────────────────
  onRemove(e) {
    const id = String(e.currentTarget.dataset.id)
    util.toggleWantAsync(id)
    // 立即刷新列表（读本地缓存，零等待）
    this._loadData(this.data.tab)
    wx.showToast({ title: '已移除', icon: 'none', duration: 1000 })
  },

  // ─── 打开路线规划天数弹窗 ─────────────────────────────
  onPlanRoute() {
    const { items } = this.data
    if (items.length === 0) {
      wx.showToast({ title: '清单为空', icon: 'none' })
      return
    }
    const selectedPlanDayCount = Math.max(1, Math.min(this.data.selectedPlanDayCount || DEFAULT_DAY, 10))
    // 每次打开弹窗时，把当前天数同步到实例字段，作为确认时的兜底最新值。
    this._lastPlanDayChangeAt = 0
    this._pendingPlanDayCount = selectedPlanDayCount
    this.setData({
      planDaySheetVisible: true,
      selectedPlanDayCount
    })
  },

  // ─── 城市筛选 ─────────────────────────────
  onCityFilterTap() {
    // 顶部入口点击后，打开底部弹窗供用户选择地点范围。
    this.setData({ cityFilterVisible: !this.data.cityFilterVisible })
  },

  onCloseCityFilter() {
    this.setData({ cityFilterVisible: false })
  },

  onSelectCityFilter(e) {
    const city = e.currentTarget.dataset.city || ''
    if (city === this.data.cityFilter) {
      this.setData({ cityFilterVisible: false })
      return
    }
    wx.setStorageSync('wantgoCityFilter', city)
    this.setData({
      cityFilter: city,
      cityFilterLabel: getWantFilterLabel(city),
      cityFilterVisible: false
    })
    this._loadData('want')
  },

  // 确认天数后，带着地点 id 去路线规划页
  onConfirmPlanRoute() {
    const { items, selectedPlanDayCount } = this.data
    if (items.length === 0) {
      wx.showToast({ title: '清单为空', icon: 'none' })
      return
    }
    if (this._isConfirmingPlanRoute) return
    this._isConfirmingPlanRoute = true
    const ids = items.map(i => i.id).join(',')
    this.setData({ planDaySheetVisible: false })
    if (this._planRouteConfirmTimer) {
      clearTimeout(this._planRouteConfirmTimer)
    }
    // 给 picker-view 一个固定收敛窗口，让最后一次变更事件先落地。
    this._planRouteConfirmTimer = setTimeout(() => {
      const latestSelectedPlanDayCount = this._pendingPlanDayCount || this.data.selectedPlanDayCount || selectedPlanDayCount
      const dayCount = Math.max(1, parseInt(latestSelectedPlanDayCount, 10) || 1)
      this._planRouteConfirmTimer = null
      this._isConfirmingPlanRoute = false
      wx.navigateTo({
        // 从"想去"页发起规划，给详情页带上返回来源，返回时自动切到"我的路线"Tab。
        url: `/subpackages/route/pages/my-route/my-route?ids=${ids}&dayCount=${dayCount}&returnTo=plan`
      })
    }, PLAN_DAY_CONFIRM_DELAY_MS)
  },

})
