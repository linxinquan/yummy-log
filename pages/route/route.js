// 觅食图 - 路线规划页 v6.0 地图+双模式+Timeline
const app = getApp()
const shopData = require('../../utils/shopData')
const util = require('../../utils/util')
const { MODE_CONFIG, applyTravelMeta, buildTravelOptions, formatDurationShort } = require('../../utils/travel')
const { buildMapPreviewViewData } = require('../../utils/map-preview')

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

const CITY_PRESETS = [
  { match: /西安|长安/, name: '西安市', lat: 34.3416, lng: 108.9398 },
  { match: /广州/, name: '广州市', lat: 23.1291, lng: 113.2644 },
  { match: /汕头/, name: '汕头市', lat: 23.3541, lng: 116.6819 },
  { match: /湛江/, name: '湛江市', lat: 21.2707, lng: 110.3594 },
  { match: /佛山/, name: '佛山市', lat: 23.0218, lng: 113.1219 },
  { match: /珠海/, name: '珠海市', lat: 22.2707, lng: 113.5767 },
  { match: /深圳|南山|福田|罗湖|宝安|龙岗|盐田|龙华|光明|坪山|大鹏/, name: '深圳市', lat: 22.5431, lng: 114.0579 }
]

function isSpotItem(item) {
  return item.type === 'spot' || item.category === '景点' || item.category === '公园' || !item.price
}

function getCoverImage(item) {
  return item.logo || item.image || item.thumb || '/images/covers/01.jpeg'
}

function getModeLabel(mode) {
  return (MODE_CONFIG[mode] || MODE_CONFIG.drive).label
}

function estimateRouteDuration(meters, mode = 'drive') {
  const config = MODE_CONFIG[mode] || MODE_CONFIG.drive
  return formatDurationShort((Math.max(0, meters || 0) / 1000) * config.minutesPerKm)
}

function getItemTagText(item) {
  if (isSpotItem(item)) {
    if ((item.category || '').includes('展馆') || (item.name || '').includes('博物馆')) {
      return '文化展馆'
    }
    return '景点'
  }
  return '美食'
}

function getItemMetaText(item) {
  const parts = []
  if (item.category) parts.push(item.category)
  if (item.price) parts.push(`¥${item.price}/人`)
  if (item.rating || item.score) parts.push(`★${item.rating || item.score}`)
  return parts.join(' · ')
}

function decorateSelectableItems(items) {
  return (items || []).map(item => ({
    ...item,
    coverImage: getCoverImage(item),
    tagText: getItemTagText(item),
    metaText: getItemMetaText(item)
  }))
}

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
      timeStr: nextItem.travelMeta ? nextItem.travelMeta.timeText : estimateRouteDuration(distance, mode)
    }
  })
}

function buildFoodItems() {
  const userShops = util.loadData('userAddedShops', [])
  return [...(shopData.shops || []), ...(shopData.foods || []), ...userShops]
    .map(item => ({ ...item, type: 'food' }))
}

function buildSpotItems() {
  return util.getSpotData().map(item => ({ ...item, type: 'spot' }))
}

function buildDayLabel(dayNumber) {
  const labels = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
  if (dayNumber <= 10) return `第${labels[dayNumber - 1]}天`
  return `第${dayNumber}天`
}

function buildTabs(dayCount) {
  const tabs = [{ key: 'overview', label: '行程总览' }]
  for (let i = 0; i < dayCount; i += 1) {
    tabs.push({ key: `day-${i}`, label: buildDayLabel(i + 1) })
  }
  return tabs
}

function buildSummaryText(daySections) {
  const dayCount = daySections.length
  const nightCount = Math.max(dayCount - 1, 0)
  const placeCount = daySections.reduce((sum, day) => sum + (day.items || []).length, 0)
  return `${dayCount} 天 ${nightCount} 晚 · ${placeCount} 个地点`
}

function getCityInfo(text) {
  const source = String(text || '')
  for (let i = 0; i < CITY_PRESETS.length; i += 1) {
    if (CITY_PRESETS[i].match.test(source)) {
      return CITY_PRESETS[i]
    }
  }
  return { name: '深圳市', lat: 22.5431, lng: 114.0579 }
}

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

function buildPreviewTitle(cityText, routeType) {
  const cityName = String(cityText || '').replace(/市$/, '')
  if (cityName) {
    if (routeType === 'spot') return `${cityName}景点智能规划路线`
    if (routeType === 'food') return `${cityName}美食智能规划路线`
    return `${cityName}智能规划路线`
  }
  return '智能规划路线'
}

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

function getPreviewIndexByDay(routeDaySections, dayIndex) {
  if (!routeDaySections || dayIndex < 0 || dayIndex >= routeDaySections.length) return 0
  let offset = 0
  for (let i = 0; i < dayIndex; i += 1) {
    offset += (routeDaySections[i].items || []).length
  }
  return offset
}

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

function getLikeType(item, routeType) {
  if (routeType === 'spot') return 'spot'
  if (routeType === 'food') return 'food'
  return item.type === 'spot' ? 'spot' : 'food'
}

function savePreviewRouteData(data) {
  const { routeDaySections, summaryText, cityText, routeType, previewRouteId } = data
  if (!routeDaySections || !routeDaySections.length) return null

  const routeId = previewRouteId || `ai-${Date.now()}`
  const { daySummaries, dayDetails } = buildLegacyRouteData(routeDaySections)
  const savedRoute = {
    id: routeId,
    title: buildPreviewTitle(cityText, routeType),
    subtitle: summaryText,
    image: daySummaries[0]?.image || DEFAULT_COVERS[0],
    author: 'AI规划',
    city: cityText,
    sourceType: 'ai',
    daySections: routeDaySections,
    daySummaries,
    dayDetails,
    createdAt: Date.now()
  }

  const savedRoutes = util.loadData('savedRoutes', [])
  const index = savedRoutes.findIndex(item => String(item.id) === String(routeId))
  if (index >= 0) {
    savedRoutes[index] = savedRoute
  } else {
    savedRoutes.push(savedRoute)
  }
  wx.setStorageSync('savedRoutes', savedRoutes)
  return savedRoute
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
    reorderSheetVisible: false,
    pendingReorderMode: 'smart',
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
    routeModes: ['walk', 'transit', 'ride', 'bus', 'drive'].map(key => ({
      key,
      label: MODE_CONFIG[key].label,
      icon: MODE_CONFIG[key].icon
    }))
  },

  onLoad(options) {
    // 接收 type=food/spot 和 ids=1,2,3 参数
    const { type, ids, dayCount } = options
    const routeType = type === 'spot' ? 'spot' : type === 'plan' ? 'mixed' : 'food'
    const sysInfo = wx.getSystemInfoSync()
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const menuTop = menuButtonInfo ? menuButtonInfo.top : (sysInfo.statusBarHeight || 44) + 4
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

  onShow() {
    this.loadRoute()
  },

  // ─── 获取定位 ─────────────────────────────────
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

  // ─── 加载路线 ─────────────────────────────────
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

  refreshPreviewRoute(routeShops) {
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
      routeTitle: buildPreviewTitle(cityInfo.name, this.data.routeType),
      mapPreviewShop: routeShops && routeShops.length ? routeShops[0] : null,
      mapPreviewIndex: 0
    }, () => {
      if (!this.data.isEditing) {
        const savedRoute = savePreviewRouteData(this.data)
        if (savedRoute) {
          this.setData({ previewRouteId: savedRoute.id })
        }
      }
    })
  },

  // ─── 贪心排序并注入距离 ───────────────────────
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

  // ─── 更新地图 markers + polyline ─────────────
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

  // ─── 地图适配所有标记 ─────────────────────────
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

    const sysInfo = wx.getSystemInfoSync()
    const mapCtx = wx.createMapContext('routeMap', this)
    mapCtx.includePoints({
      points,
      padding: [96, 24, Math.round((sysInfo.windowHeight || 812) * 0.34), 24]
    })
  },

  onMapRegionChange() {
    // 可扩展：地图区域变化时的处理
  },

  // ─── 切换选择模式 ─────────────────────────────
  onSwitchSelectMode(e) {
    const mode = e.currentTarget.dataset.mode
    if (mode === this.data.selectMode) return
    this.setData({ selectMode: mode, isEditing: false }, () => {
      this.loadRoute()
    })
  },

  // ─── 自选：切换单家店铺 ───────────────────────
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

  // ─── 自选：全选 / 取消全选 ────────────────────
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

  // ─── 出行方式 ─────────────────────────────────
  onSelectMode(e) {
    const mode = e.currentTarget.dataset.mode
    const routeShops = decorateRouteItems(this.data.routeShops, mode)
    this.setData({ travelMode: mode, routeShops })
    this.refreshPreviewRoute(routeShops)
    let totalDist = 0
    routeShops.forEach(s => { totalDist += s.distanceFromPrev || 0 })
    this.setData({ totalTime: estimateRouteDuration(totalDist, mode) })
  },

  openTransportSheet(index) {
    const item = (this.data.routeShops || [])[index]
    if (!item) return
    this.setData({
      transportSheetVisible: true,
      transportOptions: buildTravelOptions(item.distanceFromPrev || 0),
      pendingTransportMode: item.travelMode || (item.travelMeta && item.travelMeta.mode) || 'walk',
      transportTargetIndex: index
    })
  },

  onOpenPlaceTransportSheet(e) {
    this.openTransportSheet(parseInt(e.currentTarget.dataset.index, 10))
  },

  onOpenMapTransportSheet() {
    this.openTransportSheet(this.data.mapPreviewIndex)
  },

  onOpenNavTransportSheet() {
    this.openTransportSheet(this.data.currentNavIndex)
  },

  onCloseTransportSheet() {
    this.setData({ transportSheetVisible: false, transportTargetIndex: -1 })
  },

  onSelectTransportMode(e) {
    const mode = e.detail && e.detail.mode
    if (!mode) return
    this.setData({ pendingTransportMode: mode })
  },

  onConfirmTransportMode() {
    const { transportTargetIndex, pendingTransportMode, routeShops, currentNavIndex, isNavigating } = this.data
    if (transportTargetIndex < 0 || !routeShops[transportTargetIndex]) return

    const nextRouteShops = (routeShops || []).map((item, index) => (
      index === transportTargetIndex ? applyTravelMeta(item, pendingTransportMode) : item
    ))
    const nextData = {
      routeShops: nextRouteShops,
      transportSheetVisible: false,
      transportTargetIndex: -1
    }
    if (isNavigating && currentNavIndex === transportTargetIndex) {
      nextData.currentNavShop = nextRouteShops[transportTargetIndex]
    }
    this.setData(nextData)
    this.refreshPreviewRoute(nextRouteShops)
    if (this.data.viewMode === 'map' || isNavigating) {
      this.focusPreviewByIndex(this.data.mapPreviewIndex)
    }
  },

  // ─── ⚡ 重新贪心优化 ─────────────────────────
  onOptimizeRoute() {
    wx.showLoading({ title: '优化中...' })
    setTimeout(() => {
      const shops = this.data.selectMode === 'all'
        ? this.data.allLikedShops
        : this.data.allLikedShops.filter(s => s.selected)
      const routeShops = this._planAndAnnotate(shops)
      this.setData({ routeShops, isEditing: false, reorderSheetVisible: false })
      this.refreshPreviewRoute(routeShops)
      this.updateMap()
      wx.hideLoading()
      wx.showToast({ title: '路线已优化', icon: 'success' })
    }, 400)
  },

  // ─── 顺序调整 ─────────────────────────────────
  onToggleEdit() {
    const isEditing = !this.data.isEditing
    this.setData({ isEditing })
    if (!isEditing) {
      wx.showToast({ title: '顺序已保存', icon: 'success' })
    }
  },

  onOpenReorderSheet() {
    this.setData({
      reorderSheetVisible: true,
      pendingReorderMode: this.data.isEditing ? 'manual' : 'smart'
    })
  },

  onCloseReorderSheet() {
    this.setData({ reorderSheetVisible: false })
  },

  onSelectReorderMode(e) {
    const { mode } = e.currentTarget.dataset
    if (!mode) return
    this.setData({ pendingReorderMode: mode })
  },

  onConfirmReorderMode() {
    if (this.data.pendingReorderMode === 'manual') {
      const savedRoute = savePreviewRouteData(this.data)
      if (!savedRoute) return
      this.setData({
        reorderSheetVisible: false,
        previewRouteId: savedRoute.id
      })
      wx.navigateTo({
        url: `/pages/my-route/my-route?route=${encodeURIComponent(JSON.stringify(savedRoute))}&edit=1`
      })
      return
    }

    this.onOptimizeRoute()
  },

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

  onMoveUp(e) {
    const index = e.currentTarget.dataset.index
    if (index <= 0) return
    const shops = [...this.data.routeShops]
    ;[shops[index], shops[index - 1]] = [shops[index - 1], shops[index]]
    this.setData({ routeShops: shops })
    this.refreshPreviewRoute(shops)
    this.updateMap()
  },

  onMoveDown(e) {
    const index = e.currentTarget.dataset.index
    if (index >= this.data.routeShops.length - 1) return
    const shops = [...this.data.routeShops]
    ;[shops[index], shops[index + 1]] = [shops[index + 1], shops[index]]
    this.setData({ routeShops: shops })
    this.refreshPreviewRoute(shops)
    this.updateMap()
  },

  // ─── 移除店铺 ─────────────────────────────────
  onRemoveShop(e) {
    const shopId = e.currentTarget.dataset.shopid
    const shop = this.data.allLikedShops.find(item => String(item.id) === String(shopId))
    util.toggleLike(shopId, getLikeType(shop || {}, this.data.routeType))
    this.loadRoute()
    wx.showToast({ title: '已从路线移除', icon: 'none' })
  },

  // ─── 导览模式 ─────────────────────────────────
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

  onNavToCurrent() {
    const { currentNavShop } = this.data
    if (!currentNavShop) return
    util.openDirectNavigation(currentNavShop)
  },

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

  onExitNav() {
    this.setData({
      isNavigating: false,
      isNavComplete: false,
      currentNavIndex: 0,
      currentNavShop: null
    })
    this.updateMap()
  },

  onNavigateToShop(e) {
    const shop = e.currentTarget.dataset.shop
    util.openWechatNavigation(shop)
  },

  // ─── 清空路线 ─────────────────────────────────
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

  // ─── 定位 ─────────────────────────────────────
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

  onBackToHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

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

  onOpenPlaceDetail(e) {
    if (this.data.isEditing) return
    const item = e.currentTarget.dataset.item
    if (!item) return
    const isSpot = item.type === 'spot' || isSpotItem(item)
    if (isSpot) {
      wx.navigateTo({ url: `/pages/spot-detail/spot-detail?id=${item.id}` })
      return
    }
    const shopStr = encodeURIComponent(JSON.stringify(item))
    wx.navigateTo({ url: `/pages/shop-detail/shop-detail?shopData=${shopStr}&id=${item.id}` })
  },

  onSaveToMyRoute() {
    const savedRoute = savePreviewRouteData(this.data)
    if (!savedRoute) return
    this.setData({ previewRouteId: savedRoute.id })
    wx.showToast({ title: '已保存到路线', icon: 'success' })
  },

  onViewRoute() {
    const mapDayIndex = this.data.currentTab > 0
      ? this.data.currentTab - 1
      : (this.data.routeDaySections.length ? 0 : -1)
    this.setData({ viewMode: 'map', currentMapDay: mapDayIndex })
    this.focusPreviewByIndex(mapDayIndex >= 0 ? getPreviewIndexByDay(this.data.routeDaySections, mapDayIndex) : 0, mapDayIndex >= 0 ? mapDayIndex : undefined)
    this.updateMap()
  },

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

  onChangeMapPreview(e) {
    const nextIndex = parseInt(
      (e.detail && e.detail.index) !== undefined ? e.detail.index : e.currentTarget.dataset.index,
      10
    )
    if (Number.isNaN(nextIndex)) return
    const nextDayIndex = getDayIndexByPreview(this.data.routeDaySections, nextIndex)
    this.focusPreviewByIndex(nextIndex, nextDayIndex)
  },

  onMapPreviewStep(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10)
    if (Number.isNaN(index) || index < 0) return
    this.onChangeMapPreview({ detail: { index } })
  },

  onBack() {
    wx.navigateBack()
  }
})
