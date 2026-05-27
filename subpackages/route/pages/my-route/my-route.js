const app = getApp()
const util = require('../../../../utils/util')
const placesData = require('../../../../utils/placesData')
const { applyTravelMeta, buildTravelOptions } = require('../../../../utils/travel')
const { buildMapPreviewViewData } = require('../../../../utils/map-preview')
const { resolveDisplayCategory } = require('../../../../utils/displayCategory')
const mapConfig = require('../../utils/map-config')
const { fetchRealRoute } = require('../../utils/mapRouteFetcher')
const { formatTripSummary, normalizeTripSummaryText } = require('../../../../utils/trip-duration')
const {
  buildPlaceCardTags,
  buildRouteTravelDisplay,
  buildPlaceIntroData
} = require('../../../../utils/route-place-card')

// 地图模式统一使用当前位置 PNG 图标，和探索页保持一致。
const CURRENT_LOCATION_ICON_PATH = '/images/markers/marker_current_location.png'
const CURRENT_LOCATION_FOCUS_SCALE = 15

// 城市预设：根据路线标题或城市文案，尽量反推路线所在城市和中心坐标。
const CITY_PRESETS = [
  { match: /西安|长安/, name: '西安市', lat: 34.3416, lng: 108.9398 },
  { match: /广州/, name: '广州市', lat: 23.1291, lng: 113.2644 },
  { match: /汕头/, name: '汕头市', lat: 23.3541, lng: 116.6819 },
  { match: /湛江/, name: '湛江市', lat: 21.2707, lng: 110.3594 },
  { match: /佛山/, name: '佛山市', lat: 23.0218, lng: 113.1219 },
  { match: /珠海/, name: '珠海市', lat: 22.2707, lng: 113.5767 },
  { match: /深圳|南山|福田|罗湖|宝安|龙岗|盐田|龙华|光明|坪山|大鹏/, name: '深圳市', lat: 22.5431, lng: 114.0579 }
]

// 西安这组点位是给旧攻略和示例路线补坐标用的。
const XIAN_POI_MAP = {
  '西安城墙永宁门城楼': { lat: 34.2476, lng: 108.9461, type: 'spot' },
  '西安钟楼': { lat: 34.259, lng: 108.9488, type: 'spot' },
  '西安鼓楼': { lat: 34.2597, lng: 108.9434, type: 'spot' },
  '回民街': { lat: 34.2622, lng: 108.9426, type: 'spot' },
  '秦始皇兵马俑博物馆': { lat: 34.3849, lng: 109.2786, type: 'spot' },
  '华清宫': { lat: 34.3639, lng: 109.2139, type: 'spot' },
  '长恨歌演出': { lat: 34.3622, lng: 109.2147, type: 'spot' },
  '大雁塔': { lat: 34.2236, lng: 108.9631, type: 'spot' },
  '陕西历史博物馆': { lat: 34.2241, lng: 108.9537, type: 'spot' },
  '大唐不夜城': { lat: 34.2174, lng: 108.968, type: 'spot' }
}

const MAX_DELETE_OFFSET = -72


// 生成"第几天"的展示文字。
function buildDayLabel(dayNumber) {
  const labels = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
  if (dayNumber <= 10) return `第${labels[dayNumber - 1]}天`
  return `第${dayNumber}天`
}

// 生成顶部 Tab：包含"行程总览"和每天的标签。
function buildTabs(dayCount) {
  const tabs = [{ key: 'overview', label: '行程总览' }]
  for (let i = 0; i < dayCount; i += 1) {
    tabs.push({ key: `day-${i}`, label: buildDayLabel(i + 1) })
  }
  return tabs
}

// 统一处理名称，方便做模糊匹配。
function normalizeName(name) {
  return String(name || '')
    .replace(/\s+/g, '')
    .replace(/[()（）·,，.。]/g, '')
    .toLowerCase()
}

// 当地点缺坐标时，按城市中心生成一组临时坐标，避免地图和路线失效。
function buildSyntheticLatLng(cityInfo, dayIndex, itemIndex) {
  return {
    lat: cityInfo.lat + ((dayIndex * 0.018) - 0.018) + (itemIndex * 0.0035),
    lng: cityInfo.lng + ((itemIndex * 0.016) - 0.016) + (dayIndex * 0.004)
  }
}

// 根据地点名称猜一个大概标签，主要用于旧数据兜底。
function inferTag(name) {
  if (/博物馆|展馆|美术馆/.test(name)) return '文化展馆'
  if (/演出|剧场|音乐会/.test(name)) return '演出'
  if (/商场|购物中心|步行街/.test(name)) return '购物'
  if (/店|馆|面|饭|咖啡|茶|酒|餐|小吃|甜品|火锅|奶茶|烧烤|糖水|包|饼|馍/.test(name)) return '美食'
  return '景点'
}

// 尝试把地点名称匹配到系统已有的美食或景点数据。
function findMatchedPlace(name) {
  const normalized = normalizeName(name)
  if (!normalized) return null

  const allPlaces = placesData.getAllPlaces()
  const matchedPlace = allPlaces.find(item => normalizeName(item.name) === normalized)
  if (matchedPlace) return matchedPlace

  // 尝试匹配别名（简化逻辑：直接在allPlaces中查找）
  const matchedPlace2 = allPlaces.find(item => {
    const itemName = normalizeName(item.name)
    return normalized.includes(itemName) || itemName.includes(normalized)
  })
  if (matchedPlace2) return matchedPlace2

  const xianPoi = Object.keys(XIAN_POI_MAP).find(key => normalizeName(key) === normalized)
  return xianPoi ? XIAN_POI_MAP[xianPoi] : null
}

// 去掉编辑态临时字段，避免把左滑偏移量之类的界面状态保存进正式数据。
function stripEditState(daySections) {
  return (daySections || []).map(day => ({
    ...day,
    items: (day.items || []).map(item => {
      const nextItem = { ...item }
      delete nextItem.swipeOffset
      return nextItem
    })
  }))
}

// 给路线详情列表补齐展示字段：
// 1. 封面上的大类标签
// 2. 评分和普通标签
// 3. 底部中文距离和中文时间
function decorateRoutePlaceItem(item = {}) {
  const displayCategory = item.displayCategory || resolveDisplayCategory(item)
  const travelDisplay = buildRouteTravelDisplay(item.travelMeta, item.distanceFromPrev)
  return {
    ...item,
    displayCategory,
    tags: buildPlaceCardTags({ ...item, displayCategory }),
    ...travelDisplay
  }
}

// 把路线每天的地点整理成统一结构，并补全坐标、标签、图片、交通信息。
function syncDaySections(daySections, cityInfo) {
  const fallbackCity = cityInfo || { lat: 22.5431, lng: 114.0579 }
  return stripEditState(daySections).map((day, dayIndex) => {
    const rawItems = (day.items || []).map((item, itemIndex) => {
      const matched = findMatchedPlace(item.name)
      const synthetic = buildSyntheticLatLng(fallbackCity, dayIndex, itemIndex)
      const rawTags = Array.isArray(item.tags) && item.tags.length
        ? item.tags
        : ((matched && Array.isArray(matched.tags)) ? matched.tags : [])
      const itemType = item.type || matched?.type || ((item.tag || inferTag(item.name)) === '美食' ? 'food' : 'spot')
      return {
        ...item,
        id: item.id || `day-${dayIndex}-item-${itemIndex}`,
        name: item.name || '待补充地点',
        tag: item.tag || inferTag(item.name),
        image: item.image || matched?.image || matched?.logo || '/images/app-logo.jpg',
        type: itemType,
        rating: item.rating || matched?.rating || matched?.score || '',
        tags: rawTags,
        displayCategory: item.displayCategory || resolveDisplayCategory({ ...matched, ...item, type: itemType }),
        desc: item.desc || matched?.desc || '',
        hours: item.hours || matched?.hours || '',
        openHours: item.openHours || matched?.openHours || '',
        free: item.free !== undefined ? item.free : matched?.free,
        price: item.price || matched?.price || '',
        address: item.address || matched?.address || `${fallbackCity.name || ''}${item.name || ''}`,
        lat: item.lat || item.latitude || matched?.lat || synthetic.lat,
        lng: item.lng || item.longitude || matched?.lng || synthetic.lng,
        swipeOffset: item.swipeOffset || 0
      }
    })

    const plannedItems = util.planRoute(
      rawItems.map(item => ({ ...item })),
      { lat: fallbackCity.lat, lng: fallbackCity.lng },
      true
    )

    return {
      id: day.id || `day-${dayIndex}`,
      title: buildDayLabel(dayIndex + 1),
      countText: `${plannedItems.length} 个地点`,
      items: plannedItems.map(item => decorateRoutePlaceItem({
        ...applyTravelMeta(item, item.travelMode),
        swipeOffset: item.swipeOffset || 0
      }))
    }
  })
}


// 兼容旧版路线结构，给老数据继续生成 daySummaries / dayDetails。
function buildLegacyRouteData(daySections) {
  const cleanSections = stripEditState(daySections)
  const daySummaries = cleanSections.map((day, index) => ({
    location: '',
    route: (day.items || []).map(item => item.name).join(' --- '),
    image: (day.items && day.items[0] && day.items[0].image) || '/images/app-logo.jpg',
  }))

  const dayDetails = cleanSections.map(day => (day.items || []).map(item => ({
    name: item.name,
    desc: item.travelText,
    travelText: item.travelText,
    tag: item.tag,
    image: item.image,
    type: item.type,
    lat: item.lat,
    lng: item.lng
  })))

  return { daySummaries, dayDetails }
}

// 把"按天分组"的路线拍平成普通数组，方便地图预览和统计。
function flattenDaySections(daySections) {
  const flattened = []
  ;(daySections || []).forEach((day, dayIndex) => {
    ;(day.items || []).forEach((item, itemIndex) => {
      flattened.push({ ...item, dayIndex, itemIndex })
    })
  })
  return flattened
}

// 根据"第几天"算出它在地图预览列表里的起始下标。
function getPreviewIndexByDay(daySections, dayIndex) {
  if (!daySections || dayIndex < 0 || dayIndex >= daySections.length) return 0
  let offset = 0
  for (let i = 0; i < dayIndex; i += 1) {
    offset += (daySections[i].items || []).length
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

// 生成顶部摘要文案，例如"3 天 2 晚 · 8 个地点"。
function buildSummaryText(daySections) {
  const dayCount = daySections.length
  const placeCount = daySections.reduce((sum, day) => sum + (day.items || []).length, 0)
  return formatTripSummary(dayCount, placeCount)
}

// 保存时去掉完全空白的天数，但至少保留 1 天。
function removeEmptyDaysOnSave(daySections) {
  const sections = (daySections || []).filter(day => (day.items || []).length > 0)
  if (sections.length) return sections
  return (daySections || []).slice(0, 1)
}

// 从标题或城市文字里尽量推断出城市信息。
function getCityInfo(text) {
  const source = String(text || '')
  for (let i = 0; i < CITY_PRESETS.length; i += 1) {
    if (CITY_PRESETS[i].match.test(source)) {
      return CITY_PRESETS[i]
    }
  }
  return { name: source || '深圳市', lat: 22.5431, lng: 114.0579 }
}

// 兼容旧路线数据：如果没有 daySections，就从旧字段里重建出来。
function buildDaySectionsFromLegacy(route) {
  if (route.daySections && route.daySections.length) {
    return route.daySections
  }

  const dayDetails = route.dayDetails || []
  const fallbackCount = Math.max(route.dayCount || 0, dayDetails.length || 0, 1)
  const sections = dayDetails.map((items, dayIndex) => ({
    id: `day-${dayIndex}`,
    items: (items || []).map((item, itemIndex) => ({
      id: item.id || `day-${dayIndex}-item-${itemIndex}`,
      name: item.name,
      tag: item.tag,
      image: item.image,
      travelText: item.travelText || item.desc || '',
      lat: item.lat,
      lng: item.lng,
      type: item.type || (item.tag === '美食' ? 'food' : 'spot')
    }))
  }))
  while (sections.length < fallbackCount) {
    sections.push({
      id: `day-${sections.length}`,
      items: []
    })
  }
  return sections
}


// 把"想去 / 收藏 / 全部"来源的地点，统一整理成添加地点弹窗可用的数据格式。
// 这样弹窗里就不用分别兼容很多不同字段名了。
function buildPlaceCandidate(item, type, source) {
  if (!item) return null
  const resolvedType = item.type || type || 'spot'
  const displayImage = item.displayImage || item.image || item.logo || item.thumb || '/images/app-logo.jpg'
  const sourceTextMap = {
    want: '来自想去',
    collect: '来自收藏',
    all: '已在想去和收藏'
  }
  // 标签里只保留真实有值的内容，避免出现空标签。
  const rawTags = Array.isArray(item.tags) ? item.tags.filter(Boolean) : []
  return {
    id: String(item.id),
    sourceKey: `${resolvedType}-${item.id}`,
    sourceType: source,
    sourceText: sourceTextMap[source] || '已加入来源列表',
    type: resolvedType,
    name: item.name,
    // 这里显示的是大类标签，不显示"粤菜""面馆"这种细分类。
    tag: resolveDisplayCategory({ ...item, type: resolvedType }),
    image: displayImage,
    rating: item.rating || item.score || '',
    price: item.price || '',
    tags: rawTags.slice(0, 2),
    lat: item.lat || item.latitude,
    lng: item.lng || item.longitude
  }
}

// 汇总"想去 / 收藏 / 全部"三类来源，给添加地点弹窗使用。
function buildPlacePickerData() {
  const userAddedShops = util.loadData('userAddedShops', [])
  const allFoods = [...placesData.getFoods(), ...userAddedShops]
  const allSpots = placesData.getSpots()
  const allNonFoodPlaces = allSpots
  
  // 新格式：从 userWantList 获取所有想去 ID，然后分离 food 和 spot
  const allWantIds = util.getWantList()
  const wantFoodIds = []
  const wantSpotIds = []
  allWantIds.forEach(id => {
    const place = placesData.getPlaceById(id)
    if (place) {
      if (place.type === 'food') {
        wantFoodIds.push(String(id))
      } else if (place.type === 'spot') {
        wantSpotIds.push(String(id))
      }
    }
  })
  
  const collectFoodIds = util.loadData('userCollectedFoods', []).map(item => String(item))
  const collectSpotIds = util.loadData('userCollectedSpots', []).map(item => String(item))

  const wantItems = []
  const collectItems = []
  const allMap = new Map()

  const appendItems = (ids, dataset, type, source, targetList) => {
    ids.forEach(id => {
      const found = dataset.find(entry => String(entry.id) === String(id))
      const candidate = buildPlaceCandidate(found, type, source)
      if (!candidate) return
      targetList.push(candidate)
      const existed = allMap.get(candidate.sourceKey)
      if (existed) {
        allMap.set(candidate.sourceKey, {
          ...existed,
          sourceType: existed.sourceType === source ? source : 'all',
          sourceText: existed.sourceType === source ? candidate.sourceText : '已在想去和收藏'
        })
      } else {
        allMap.set(candidate.sourceKey, candidate)
      }
    })
  }

  appendItems(wantFoodIds, allFoods, 'food', 'want', wantItems)
  appendItems(wantSpotIds, allNonFoodPlaces, 'spot', 'want', wantItems)
  appendItems(collectFoodIds, allFoods, 'food', 'collect', collectItems)
  appendItems(collectSpotIds, allNonFoodPlaces, 'spot', 'collect', collectItems)

  return {
    all: Array.from(allMap.values()),
    want: wantItems,
    collect: collectItems
  }
}

// 把弹窗里选中的地点转换成正式加入路线的数据格式。
function buildAddedPlace(item) {
  return {
    id: `manual-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    originalId: item.id,
    name: item.name,
    tag: item.tag,
    image: item.image,
    type: item.type,
    lat: item.lat,
    lng: item.lng
  }
}

// 把地图选点结果也转换成和普通地点一致的格式。
function buildMapPickedPlace(location) {
  const latitude = Number(location.latitude)
  const longitude = Number(location.longitude)
  return {
    id: `map-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    name: location.name || location.address || '地图选点',
    tag: '地点',
    image: '/images/app-logo.jpg',
    type: 'spot',
    lat: latitude,
    lng: longitude
  }
}

// 跨天拖拽时，把某个地点从原来那天移动到目标那天。
function moveItemAcrossDays(daySections, fromDayIndex, fromItemIndex, toDayIndex, toItemIndex) {
  const nextSections = (daySections || []).map(day => ({
    ...day,
    items: [...((day && day.items) || [])]
  }))
  const sourceDay = nextSections[fromDayIndex]
  const targetDay = nextSections[toDayIndex]
  if (!sourceDay || !targetDay || !sourceDay.items[fromItemIndex]) {
    return nextSections
  }

  const [movedItem] = sourceDay.items.splice(fromItemIndex, 1)
  let safeTargetIndex = Math.max(0, Math.min(parseInt(toItemIndex, 10) || 0, targetDay.items.length))

  if (fromDayIndex === toDayIndex && safeTargetIndex > fromItemIndex) {
    safeTargetIndex -= 1
  }

  targetDay.items.splice(safeTargetIndex, 0, movedItem)
  return nextSections
}

Page({
  data: {
    route: null,
    routeId: '',
    returnTo: '',
    menuTop: 0,
    menuHeight: 32,
    modeSwitchTop: 110,
    tabStickyTop: 150,
    editTabStickyTop: 90,
    viewMode: 'list',
    currentTab: 0,
    currentMapDay: -1,
    sheetScrollTarget: '',
    cityText: '深圳市',
    summaryText: '',
    hasRoutePlaces: false,
    currentLocation: null,
    daySections: [],
    originalDaySections: [],
    tabs: [],
    mapCenter: { lat: 22.5431, lng: 114.0579 },
    mapMarkers: [],
    polyline: [],
    mapPreviewPlaces: [],
    mapPreviewPlace: null,
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
    mapScale: 12,
    isEditing: false,
    dragging: false,
    dragDay: -1,
    dragIndex: -1,
    dragTouchStartY: 0,
    dragOffsetY: 0,
    handleTouchStartY: 0,
    swipeStartX: 0,
    swipeStartY: 0,
    swipeDay: -1,
    swipeIndex: -1,
    swipeStartOffset: 0,
    cityInfo: { name: '深圳市', lat: 22.5431, lng: 114.0579 },
    placePickerVisible: false,
    placePickerTab: 'all',
    placePickerItems: [],
    placePickerWantItems: [],
    placePickerCollectItems: [],
    placePickerCurrentItems: [],
    placePickerDayIndex: -1,
    autoEnterEdit: false,
    isNewRouteDraft: false,
    fromPreview: false,
    transportSheetVisible: false,
    transportOptions: [],
    pendingTransportMode: 'walk',
    transportTarget: null,
    reorderSheetVisible: false,
    navMapSheetVisible: false,
    navMapTarget: null,
    placeIntroVisible: false,
    placeIntroData: null,
    exitConfirmVisible: false
  },

  // 页面初始化：
  // 1. 读取路线数据
  // 2. 计算顶部布局高度
  // 3. 预先准备添加地点弹窗数据
  onLoad(options) {
    const windowInfo = wx.getWindowInfo()
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const menuTop = menuButtonInfo ? menuButtonInfo.top : (windowInfo.statusBarHeight || 44) + 4
    const menuHeight = menuButtonInfo ? menuButtonInfo.height : 32
    const modeSwitchTop = menuTop
    const tabStickyTop = menuTop + menuHeight + 24
    const editTabStickyTop = menuTop + menuHeight + 20

    if (!options.route) {
      wx.showToast({ title: '路线不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack({ delta: 1 }), 1200)
      return
    }

    const route = JSON.parse(decodeURIComponent(options.route))
    this.setData({
      menuTop,
      menuHeight,
      modeSwitchTop,
      tabStickyTop,
      editTabStickyTop,
      routeId: String(route.id),
      returnTo: options.returnTo || '',
      autoEnterEdit: options.edit === '1',
      isNewRouteDraft: options.create === '1' || Boolean(route.isDraft),
      fromPreview: options.fromPreview === '1'
    })
    this.refreshPlacePickerItems()
    this.applyRoute(route)
    this.syncCurrentLocation()
  },

  // 页面重新显示时，如果路线已经被别的页面改过，就重新同步最新数据。
  onShow() {
    const { routeId, isEditing, isNewRouteDraft } = this.data
    if (isNewRouteDraft) return
    if (!routeId || isEditing) return
    const savedRoutes = util.loadData('savedRoutes', [])
    const latestRoute = savedRoutes.find(item => String(item.id) === String(routeId))
    if (latestRoute) {
      this.applyRoute(latestRoute)
      return
    }
    wx.showToast({ title: '路线不存在', icon: 'none' })
    setTimeout(() => {
      wx.navigateBack({
        delta: 1,
        fail: () => {
          wx.switchTab({ url: '/pages/wantgo/wantgo' })
        }
      })
    }, 300)
  },

  // 把一条路线真正应用到页面上：
  // 会同时刷新列表、地图、顶部摘要和预览卡片。
  applyRoute(route) {
    const cityText = route.city || route.cityText || getCityInfo(route.title).name
    const cityInfo = getCityInfo(cityText)
    const daySections = syncDaySections(buildDaySectionsFromLegacy(route), cityInfo)
    const summaryText = normalizeTripSummaryText(
      route.subtitle,
      daySections.length,
      daySections.reduce((sum, day) => sum + (day.items || []).length, 0)
    )
    const flattenedPlaces = flattenDaySections(daySections)

    this.setData({
      route,
      routeId: String(route.id),
      cityInfo,
      cityText,
      daySections,
      originalDaySections: JSON.parse(JSON.stringify(stripEditState(daySections))),
      tabs: buildTabs(daySections.length),
      summaryText,
      hasRoutePlaces: flattenedPlaces.length > 0,
      currentTab: 0,
      currentMapDay: -1,
      sheetScrollTarget: '',
      isEditing: false,
      dragging: false,
      dragDay: -1,
      dragIndex: -1,
      dragOffsetY: 0,
      swipeDay: -1,
      swipeIndex: -1,
      swipeStartOffset: 0,
      mapPreviewPlaces: flattenedPlaces,
      mapPreviewPlace: flattenedPlaces[0] || null,
      mapPreviewIndex: 0
    }, () => {
      this.updateMapData(daySections, cityInfo, -1)
      if (this.data.autoEnterEdit) {
        this.setData({ autoEnterEdit: false })
        setTimeout(() => {
          if (!this.data.isEditing) {
            this.onStartRouteEdit()
          }
        }, 0)
      }
    })
  },

  // 写回本地存储：这是"保存路线"的真正落盘入口。
  saveRouteToStorage(route, showToastTitle) {
    const savedRoutes = util.loadData('savedRoutes', [])
    const index = savedRoutes.findIndex(item => String(item.id) === String(route.id))
    if (index > -1) {
      savedRoutes[index] = route
    } else {
      savedRoutes.push(route)
    }
    wx.setStorageSync('savedRoutes', savedRoutes)
    if (showToastTitle) {
      wx.showToast({ title: showToastTitle, icon: 'success' })
    }
  },

  // 从"路线规划详情"临时进入手动编辑时：
  // 保存结果不直接落库，而是回传给上一页，再返回上一页。
  handoffPreviewRoute(route, showToastTitle) {
    const eventChannel = this.getOpenerEventChannel ? this.getOpenerEventChannel() : null
    if (eventChannel) {
      eventChannel.emit('previewRouteEdited', route)
    } else {
      console.error('[my-route] handoffPreviewRoute: eventChannel is null, cannot emit event')
    }
    
    if (showToastTitle) {
      wx.showToast({ title: showToastTitle, icon: 'success' })
    }
    setTimeout(() => {
      wx.navigateBack({
        delta: 1,
        fail: () => {
          wx.switchTab({ url: '/pages/wantgo/wantgo' })
        }
      })
    }, 300)
  },

  // 判断编辑态是否真的有改动：
  // 只有内容结构发生变化，才算"未保存修改"。
  hasEditingChanges() {
    const currentSections = stripEditState(this.data.daySections || [])
    const originalSections = stripEditState(this.data.originalDaySections || [])
    return JSON.stringify(currentSections) !== JSON.stringify(originalSections)
  },

  // 丢弃当前编辑改动：
  // 普通路线恢复到进入编辑前；从路线规划页进入时直接返回上一页。
  discardRouteEdits() {
    if (this.data.fromPreview) {
      wx.navigateBack({
        delta: 1,
        fail: () => {
          wx.switchTab({ url: '/pages/wantgo/wantgo' })
        }
      })
      return
    }
    const restored = syncDaySections(this.data.originalDaySections || [], this.data.cityInfo)
    this.setData({
      isEditing: false,
      dragging: false,
      dragDay: -1,
      dragIndex: -1,
      dragTouchStartY: 0,
      swipeDay: -1,
      swipeIndex: -1,
      swipeStartOffset: 0,
      daySections: restored,
      tabs: buildTabs(restored.length),
      summaryText: buildSummaryText(restored),
      hasRoutePlaces: flattenDaySections(restored).length > 0,
      sheetScrollTarget: '',
      currentTab: 0,
      placePickerVisible: false,
      placePickerDayIndex: -1,
      placeIntroVisible: false,
      navMapSheetVisible: false
    })
    this.updateMapData(restored, this.data.cityInfo, this.data.currentMapDay)
    this.refreshMapPreview(restored, this.data.mapPreviewIndex)
  },

  // 按当前编辑结果组装出一份最新路线对象，方便保存或跳去编辑基础信息。
  buildUpdatedRoute(daySections) {
    const { route, cityText, summaryText } = this.data
    const cleanSections = stripEditState(daySections)
    const { daySummaries, dayDetails } = buildLegacyRouteData(cleanSections)
    return {
      ...route,
      city: cityText,
      subtitle: summaryText,
      dayCount: cleanSections.length,
      daySections: cleanSections,
      daySummaries,
      dayDetails,
      image: route.image || daySummaries[0]?.image || '/images/app-logo.jpg',
      isDraft: Boolean(route.isDraft),
      updatedAt: Date.now()
    }
  },

  // 关闭其他左滑卡片，只保留当前这一个的偏移量。
  resetSwipeOffsets(daySections, keepDay = -1, keepIndex = -1, keepOffset = 0) {
    return (daySections || []).map((day, dayIndex) => ({
      ...day,
      items: (day.items || []).map((item, itemIndex) => ({
        ...item,
        swipeOffset: dayIndex === keepDay && itemIndex === keepIndex ? keepOffset : 0
      }))
    }))
  },

  // 刷新地图数据：包括地图中心点、标记点和路线线条。
  updateMapData(daySections, cityInfo, mapDayIndex) {
    const sections = typeof mapDayIndex === 'number' && mapDayIndex >= 0
      ? [daySections[mapDayIndex]].filter(Boolean)
      : daySections
    const flattened = flattenDaySections(sections)

    const markers = flattened.map((item, index) => {
      return {
        id: index,
        latitude: item.lat,
        longitude: item.lng,
        // 我的路线地图模式只保留数字顺序，不再显示分类图片底图，
        // 避免分类图标和数字标签叠在一起影响识别。
        label: {
          content: String(index + 1),
          // 继续按用户确认的新参数微调成更接近正圆：
          // 数字 14px、内容宽高 14px、水平居中、padding 8px、白色 2px 描边。
          fontSize: 14,
          width: 14,
          height: 14,
          textAlign: 'center',
          color: '#FFFFFF',
          fontWeight: 'bold',
          borderRadius: 15,
          bgColor: '#47BFFE',
          padding: 8,
          borderWidth: 2,
          borderColor: '#FFFFFF',
          // 去掉图片底图后，把数字标签贴回点位本身。
          anchorY: 0
        }
      }
    })

    // 初始折线：直连线作为占位，后续 API 返回真实路线后更新
    const straightPoints = markers.map(m => ({ latitude: m.latitude, longitude: m.longitude }))
    const routeColor = mapConfig.THEME_COLORS.drive
    const initialPolyline = markers.length > 1 ? [{
      points: straightPoints,
      color: routeColor + 'CC',
      width: 5,
      dottedLine: false,
      arrowLine: true
    }] : []

    const mapMarkers = markers.slice()
    if (this.data.currentLocation && typeof this.data.currentLocation.lat === 'number' && typeof this.data.currentLocation.lng === 'number') {
      mapMarkers.unshift({
        id: -1001,
        latitude: this.data.currentLocation.lat,
        longitude: this.data.currentLocation.lng,
        iconPath: CURRENT_LOCATION_ICON_PATH,
        width: 36,
        height: 36,
        anchor: { x: 0.5, y: 0.5 }
      })
    }

    this.setData({
      mapCenter: { lat: cityInfo.lat, lng: cityInfo.lng },
      mapScale: 12,
      mapMarkers,
      polyline: initialPolyline,
      currentMapDay: typeof mapDayIndex === 'number' ? mapDayIndex : -1
    })

    // 有 2+ 个地点时才请求真实路线（与路线规划页行为一致）
    if (markers.length > 1) {
      const qqMapKey = app.globalData && app.globalData.qqMapKey
      if (!qqMapKey) return

      const allPoints = straightPoints.slice()
      fetchRealRoute({
        allPoints,
        travelMode: 'drive',
        qqMapKey,
        onSuccess: (points) => {
          this.setData({
            polyline: [{
              points,
              color: routeColor + 'CC',
              width: 5,
              dottedLine: false,
              arrowLine: true
            }]
          })
        },
        onFallback: () => {
          // 降级时初始直连线已展示，无需额外处理
        }
      })
    }
  },

  // 同步当前位置，供地图模式显示当前位置图标和重新定位使用。
  syncCurrentLocation(showToast = false, onDone) {
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      success: (res) => {
        const currentLocation = { lat: res.latitude, lng: res.longitude, name: '我的位置' }
        app.globalData.location = currentLocation
        this.setData({
          currentLocation,
          mapCenter: { lat: currentLocation.lat, lng: currentLocation.lng }
        }, () => {
          if (this.data.daySections.length) {
            this.updateMapData(this.data.daySections, this.data.cityInfo, this.data.currentMapDay)
          }
          if (typeof onDone === 'function') {
            onDone(currentLocation)
          }
        })
        if (showToast) {
          wx.showToast({ title: '定位成功', icon: 'success' })
        }
      },
      fail: () => {
        if (typeof onDone === 'function') {
          onDone(null)
        }
        if (showToast) {
          wx.showToast({ title: '定位失败，请检查权限', icon: 'none' })
        }
      }
    })
  },

  // 让地图自动缩放到能看见当前路线的全部地点。
  onFitRoute() {
    const effectiveDayIndex = this.data.currentMapDay >= 0
      ? this.data.currentMapDay
      : ((this.data.mapPreviewPlace && this.data.mapPreviewPlace.dayIndex) || 0)
    const dayItems = ((((this.data.daySections || [])[effectiveDayIndex] || {}).items) || [])
    const places = dayItems.length ? dayItems : (this.data.mapPreviewPlaces || [])
    if (!places.length) return
    const points = places
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
    const mapCtx = wx.createMapContext('myRouteMap', this)
    mapCtx.includePoints({
      points,
      padding: [96, 24, Math.round((windowInfo.windowHeight || 812) * 0.34), 24]
    })
  },

  // 地图模式重新定位到当前位置，并拉近到当前位置附近。
  onLocateMe() {
    wx.showLoading({ title: '定位中...' })
    this.syncCurrentLocation(false, (currentLocation) => {
      wx.hideLoading()
      if (!currentLocation) {
        wx.showToast({ title: '定位失败，请检查权限', icon: 'none' })
        return
      }
      this.setData({
        mapCenter: {
          lat: currentLocation.lat,
          lng: currentLocation.lng
        },
        mapScale: CURRENT_LOCATION_FOCUS_SCALE
      })
      wx.showToast({ title: '定位成功', icon: 'success' })
    })
  },

  // 刷新地图模式上方的预览卡片内容。
  refreshMapPreview(daySections, previewIndex = 0, currentDayOverride) {
    const places = flattenDaySections(daySections)
    const safeIndex = places.length ? Math.max(0, Math.min(previewIndex, places.length - 1)) : 0
    const currentPlace = places[safeIndex] || null
    const resolvedDayIndex = typeof currentDayOverride === 'number'
      ? currentDayOverride
      : (places.length ? getDayIndexByPreview(daySections, safeIndex) : -1)
    const previewViewData = buildMapPreviewViewData(
      daySections,
      resolvedDayIndex,
      safeIndex,
      currentPlace,
      places.length
    )
    const nextData = {
      mapPreviewPlaces: places,
      mapPreviewPlace: currentPlace,
      mapPreviewIndex: safeIndex,
      currentMapDay: resolvedDayIndex,
      ...previewViewData
    }
    if (currentPlace && currentPlace.lat && currentPlace.lng) {
      nextData.mapCenter = { lat: currentPlace.lat, lng: currentPlace.lng }
    }
    this.setData(nextData)
  },

  // 切换地图预览中的当前地点。
  changeMapPreview(index) {
    const nextIndex = parseInt(index, 10)
    if (Number.isNaN(nextIndex)) return
    const places = this.data.mapPreviewPlaces || []
    if (!places.length || nextIndex < 0 || nextIndex >= places.length) return
    this.refreshMapPreview(this.data.daySections, nextIndex)
  },

  // 顶部返回逻辑：
  // 新建路线、从路线页进入、普通返回，这三种来源处理不一样。
  goBackBySource() {
    if (this.data.isNewRouteDraft && !this.data.isEditing) {
      wx.navigateBack({
        delta: 1,
        fail: () => {
          // 兜底回首页，避免误回到不存在的中间入口上下文。
          wx.switchTab({ url: '/pages/index/index' })
        }
      })
      return
    }
    if (this.data.returnTo === 'plan') {
      wx.setStorageSync('pendingWantgoTab', 'plan')
      wx.switchTab({ url: '/pages/wantgo/wantgo' })
      return
    }
    wx.navigateBack()
  },

  // 顶部返回逻辑：
  // 编辑态下单独走"保持并退出 / 直接退出"，其余情况按来源正常返回。
  onBack() {
    if (this.data.isEditing) {
      const changed = this.hasEditingChanges()
      if (!changed) {
        this.goBackBySource()
        return
      }
      this.setData({ exitConfirmVisible: true })
      return
    }
    this.goBackBySource()
  },

  // 关闭编辑返回确认弹窗
  onCloseExitConfirm() {
    this.setData({ exitConfirmVisible: false })
  },

  // 编辑态下直接退出，不保留这次修改
  onConfirmDirectExit() {
    this.setData({ exitConfirmVisible: false })
    this.goBackBySource()
  },

  // 编辑态下保持并退出：先保存，再离开当前页面
  onConfirmSaveExit() {
    this.setData({ exitConfirmVisible: false })
    this.onSaveAndExit()
  },

  // 提示用户使用右上角分享
  onShareTap() {
    wx.showToast({ title: '请点击右上角分享', icon: 'none' })
  },

  // 列表 / 地图 两种查看模式切换
  onSwitchMode(e) {
    if (this.data.isEditing) return
    const mode = e.currentTarget.dataset.mode
    if (mode === this.data.viewMode) return
    this.setData({ viewMode: mode })
    if (mode === 'map') {
      const mapDayIndex = this.data.currentTab > 0
        ? this.data.currentTab - 1
        : (this.data.daySections.length ? 0 : -1)
      this.updateMapData(this.data.daySections, this.data.cityInfo, mapDayIndex)
      this.refreshMapPreview(
        this.data.daySections,
        mapDayIndex >= 0 ? getPreviewIndexByDay(this.data.daySections, mapDayIndex) : this.data.mapPreviewIndex
      )
    }
  },

  // 底部"路线"按钮：直接切到地图模式
  onOpenMapMode() {
    if (this.data.isEditing) return
    this.setData({ viewMode: 'map' })
    const mapDayIndex = this.data.currentTab > 0
      ? this.data.currentTab - 1
      : (this.data.daySections.length ? 0 : -1)
    this.updateMapData(this.data.daySections, this.data.cityInfo, mapDayIndex)
    this.refreshMapPreview(
      this.data.daySections,
      mapDayIndex >= 0 ? getPreviewIndexByDay(this.data.daySections, mapDayIndex) : this.data.mapPreviewIndex
    )
  },

  // 在地图模式里切换某一天
  onSelectMapDay(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10)
    this.updateMapData(this.data.daySections, this.data.cityInfo, index)
  },

  // 地图预览卡片顶部的"每天 Tab"切换
  onSelectMapPreviewDay(e) {
    const index = parseInt(
      (e.detail && e.detail.index) !== undefined ? e.detail.index : e.currentTarget.dataset.index,
      10
    )
    this.updateMapData(this.data.daySections, this.data.cityInfo, index)
    this.refreshMapPreview(
      this.data.daySections,
      index >= 0 ? getPreviewIndexByDay(this.data.daySections, index) : this.data.mapPreviewIndex,
      index
    )
  },

  // 列表模式顶部 Tab 切换：行程总览 / 第一天 / 第二天...
  onTabTap(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10)
    const sheetScrollTarget = index === 0 ? 'route-overview-anchor' : `route-day-anchor-${index - 1}`
    this.setData({ currentTab: index, sheetScrollTarget })

    if (this.data.viewMode === 'map') {
      const nextMapDay = index > 0 ? index - 1 : (this.data.daySections.length ? 0 : -1)
      this.updateMapData(this.data.daySections, this.data.cityInfo, nextMapDay)
      this.refreshMapPreview(
        this.data.daySections,
        nextMapDay >= 0 ? getPreviewIndexByDay(this.data.daySections, nextMapDay) : this.data.mapPreviewIndex
      )
    }
  },

  // 兼容旧入口：点击"路线"时进入地图模式
  onViewRoute() {
    this.onOpenMapMode()
  },

  // 点击预览卡片或箭头时切换当前预览地点
  onChangeMapPreview(e) {
    const nextIndex = parseInt(
      (e.detail && e.detail.index) !== undefined ? e.detail.index : e.currentTarget.dataset.index,
      10
    )
    if (Number.isNaN(nextIndex)) return
    const nextDayIndex = getDayIndexByPreview(this.data.daySections, nextIndex)
    this.updateMapData(this.data.daySections, this.data.cityInfo, nextDayIndex)
    this.refreshMapPreview(this.data.daySections, nextIndex, nextDayIndex)
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

  // 去基础信息页编辑路线名称、天数、城市这些基础资料
  onEditMeta() {
    const routeForEdit = this.buildUpdatedRoute(this.data.daySections)
    wx.navigateTo({
      url: `/subpackages/route/pages/route-basic-edit/route-basic-edit?route=${encodeURIComponent(JSON.stringify(routeForEdit))}`
    })
  },

  // 从路线的第一个地点开始导航
  onStartNavigation() {
    const firstDayWithPlace = (this.data.daySections || []).find(day => (day.items || []).length)
    const firstPlace = firstDayWithPlace && firstDayWithPlace.items && firstDayWithPlace.items[0]
    if (!firstPlace || !firstPlace.lat || !firstPlace.lng) {
      wx.showToast({ title: '暂无可导航地点', icon: 'none' })
      return
    }

    util.openNavigation({
      lat: firstPlace.lat,
      lng: firstPlace.lng,
      name: firstPlace.name,
      address: this.data.cityText || firstPlace.name
    })
  },

  // 打开"编辑路线规划"底部弹窗：
  // 用户可以先选"智能规划"还是"手动编辑"。
  onOpenReorderSheet() {
    this.setData({
      reorderSheetVisible: true,
    })
  },

  // 关闭"编辑路线规划"底部弹窗
  onCloseReorderSheet() {
    this.setData({
      reorderSheetVisible: false,
    })
  },

  // 进入编辑态：允许拖拽、删除、加地点
  onStartRouteEdit() {
    const daySections = this.resetSwipeOffsets(this.data.daySections)
    this.refreshPlacePickerItems()
    this.setData({
      isEditing: true,
      reorderSheetVisible: false,
      viewMode: 'list',
      dragging: false,
      currentTab: Math.min(daySections.length, 1),
      dragDay: -1,
      dragIndex: -1,
      dragTouchStartY: 0,
      dragOffsetY: 0,
      swipeDay: -1,
      swipeIndex: -1,
      swipeStartOffset: 0,
      sheetScrollTarget: daySections.length ? 'route-day-anchor-0' : '',
      daySections,
      originalDaySections: JSON.parse(JSON.stringify(stripEditState(daySections))),
      placePickerVisible: false,
      placePickerTab: 'all',
      placePickerDayIndex: -1,
      placeIntroVisible: false,
      navMapSheetVisible: false
    })
    wx.showToast({ title: '进入编辑路线', icon: 'none' })
  },

  // 取消编辑：恢复到进入编辑前的状态
  onCancelEdit() {
    const changed = this.hasEditingChanges()
    if (!changed) {
      this.discardRouteEdits()
      return
    }
    wx.showModal({
      title: '是否保存当前修改？',
      content: '保存后会更新当前路线，不保存将丢弃本次编辑',
      confirmText: '保存',
      cancelText: '不保存',
      success: (res) => {
        if (res.confirm) {
          this.onSave()
          return
        }
        this.discardRouteEdits()
      }
    })
  },

  // 保存编辑结果，并退出编辑态
  buildSavedRoutePayload() {
    const cleanedSections = syncDaySections(this.data.daySections, this.data.cityInfo)
    const savedSections = removeEmptyDaysOnSave(cleanedSections)
    const summaryText = buildSummaryText(savedSections)
    const updatedRoute = {
      ...this.buildUpdatedRoute(savedSections),
      subtitle: summaryText,
      isDraft: this.data.fromPreview
    }
    return {
      savedSections,
      summaryText,
      updatedRoute
    }
  },

  // 保存当前编辑，但停留在当前页面。
  onSave() {
    const { savedSections, summaryText, updatedRoute } = this.buildSavedRoutePayload()

    if (this.data.fromPreview) {
      this.setData({
        route: updatedRoute,
        daySections: savedSections
      })
      this.handoffPreviewRoute(updatedRoute, '保存成功')
      return
    }

    this.saveRouteToStorage(updatedRoute, '保存成功')

    const nextMapDay = this.data.currentMapDay >= savedSections.length ? -1 : this.data.currentMapDay

    this.setData({
      route: updatedRoute,
      isEditing: false,
      dragging: false,
      daySections: savedSections,
      summaryText,
      tabs: buildTabs(savedSections.length),
      sheetScrollTarget: '',
      currentTab: Math.min(this.data.currentTab, savedSections.length),
      originalDaySections: JSON.parse(JSON.stringify(stripEditState(savedSections))),
      dragDay: -1,
      dragIndex: -1,
      dragTouchStartY: 0,
      dragOffsetY: 0,
      placePickerVisible: false,
      placePickerDayIndex: -1,
      isNewRouteDraft: false,
      hasRoutePlaces: flattenDaySections(savedSections).length > 0,
      placeIntroVisible: false,
      navMapSheetVisible: false
    })
    this.updateMapData(savedSections, this.data.cityInfo, nextMapDay)
    this.refreshMapPreview(savedSections, this.data.mapPreviewIndex)
  },

  // 保存当前编辑，并直接离开当前页。
  onSaveAndExit() {
    const { savedSections, summaryText, updatedRoute } = this.buildSavedRoutePayload()

    if (this.data.fromPreview) {
      this.setData({
        route: updatedRoute,
        daySections: savedSections
      })
      this.handoffPreviewRoute(updatedRoute, '保存成功')
      return
    }

    const nextMapDay = this.data.currentMapDay >= savedSections.length ? -1 : this.data.currentMapDay
    this.saveRouteToStorage(updatedRoute, '保存成功')
    this.setData({
      route: updatedRoute,
      isEditing: false,
      dragging: false,
      daySections: savedSections,
      summaryText,
      tabs: buildTabs(savedSections.length),
      sheetScrollTarget: '',
      currentTab: Math.min(this.data.currentTab, savedSections.length),
      originalDaySections: JSON.parse(JSON.stringify(stripEditState(savedSections))),
      dragDay: -1,
      dragIndex: -1,
      dragTouchStartY: 0,
      dragOffsetY: 0,
      placePickerVisible: false,
      placePickerDayIndex: -1,
      isNewRouteDraft: false,
      hasRoutePlaces: flattenDaySections(savedSections).length > 0,
      placeIntroVisible: false,
      navMapSheetVisible: false
    })
    this.updateMapData(savedSections, this.data.cityInfo, nextMapDay)
    this.refreshMapPreview(savedSections, this.data.mapPreviewIndex)
    setTimeout(() => {
      this.goBackBySource()
    }, 300)
  },

  // 打开交通方式弹窗：既支持列表里的地点，也支持地图预览卡片里的地点
  openTransportSheet(dayIndex, itemIndex, previewIndex) {
    const day = (this.data.daySections || [])[dayIndex]
    const item = ((day || {}).items || [])[itemIndex]
    if (!item) return
    this.setData({
      transportSheetVisible: true,
      transportOptions: buildTravelOptions(item.distanceFromPrev || 0),
      pendingTransportMode: item.travelMode || (item.travelMeta && item.travelMeta.mode) || 'walk',
      transportTarget: { dayIndex, itemIndex, previewIndex }
    })
  },

  // 列表模式里点击交通方式入口
  onOpenPlaceTransportSheet(e) {
    const dayIndex = parseInt(e.currentTarget.dataset.dayIndex, 10)
    const itemIndex = parseInt(e.currentTarget.dataset.index, 10)
    this.openTransportSheet(dayIndex, itemIndex, getPreviewIndexByDay(this.data.daySections, dayIndex) + itemIndex)
  },

  // 地图模式里点击交通方式入口
  onOpenMapTransportSheet() {
    const currentPlace = this.data.mapPreviewPlace
    if (!currentPlace) return
    this.openTransportSheet(currentPlace.dayIndex, currentPlace.itemIndex, this.data.mapPreviewIndex)
  },

  // 关闭交通方式弹窗
  onCloseTransportSheet() {
    this.setData({ transportSheetVisible: false, transportTarget: null })
  },

  // 交通方式弹窗里切换选项
  onSelectTransportMode(e) {
    const mode = e.detail && e.detail.mode
    if (!mode) return
    this.setData({ pendingTransportMode: mode })
  },

  // 确认交通方式后，把新的方式写回具体地点
  onConfirmTransportMode() {
    const { transportTarget, pendingTransportMode, daySections } = this.data
    if (!transportTarget) return

    const nextSections = (daySections || []).map((day, dayIndex) => ({
      ...day,
      items: (day.items || []).map((item, itemIndex) => {
        if (dayIndex !== transportTarget.dayIndex || itemIndex !== transportTarget.itemIndex) {
          return item
        }
        return decorateRoutePlaceItem(applyTravelMeta(item, pendingTransportMode))
      })
    }))
    const updatedRoute = this.buildUpdatedRoute(nextSections)

    this.setData({
      route: updatedRoute,
      daySections: nextSections,
      originalDaySections: JSON.parse(JSON.stringify(stripEditState(nextSections))),
      transportSheetVisible: false,
      transportTarget: null
    })
    this.saveRouteToStorage(updatedRoute)
    this.refreshMapPreview(nextSections, transportTarget.previewIndex)
  },

  // 点击地点主体：打开地点简介底部弹窗。
  onOpenPlaceIntro(e) {
    if (this.data.isEditing) return
    const dayIndex = parseInt(e.currentTarget.dataset.dayIndex, 10)
    const itemIndex = parseInt(e.currentTarget.dataset.index, 10)
    const day = (this.data.daySections || [])[dayIndex]
    const item = ((day || {}).items || [])[itemIndex]
    if (!item) return
    this.setData({
      placeIntroVisible: true,
      placeIntroData: buildPlaceIntroData(item, this.data.cityText)
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
    const day = (this.data.daySections || [])[dayIndex]
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
  // 和右侧导航图标共用同一个地图选择弹窗。
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

  // 新增一天行程
  onAddDay() {
    if (!this.data.isEditing) return

    const nextSections = this.data.daySections.slice()
    nextSections.push({ id: `day-${Date.now()}`, items: [] })
    const syncedSections = syncDaySections(nextSections, this.data.cityInfo)
    const nextTabIndex = syncedSections.length

    this.setData({
      daySections: syncedSections,
      tabs: buildTabs(syncedSections.length),
      summaryText: buildSummaryText(syncedSections),
      currentTab: nextTabIndex,
      sheetScrollTarget: `route-day-anchor-${syncedSections.length - 1}`
    })
  },

  // 记录拖拽把手按下时的起始位置
  onHandleTouchStart(e) {
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || {}
    this.setData({ handleTouchStartY: touch.clientY || 0 })
  },


  // 路线规划弹窗改成“点选项即确认”：
  // 直接点“智能规划”或“手动编辑”就执行，不再需要底部确认按钮。
  onConfirmReorderOption(e) {
    const mode = e.currentTarget.dataset.mode
    if (!mode) return

    if (mode === 'manual') {
      this.setData({ reorderSheetVisible: false })
      this.onStartRouteEdit()
      return
    }

    const currentSections = stripEditState(this.data.daySections || [])
    const hasPlaces = flattenDaySections(currentSections).length > 0
    if (!hasPlaces) {
      wx.showToast({ title: '当前没有可规划地点', icon: 'none' })
      return
    }

    const optimizedSections = syncDaySections(currentSections, this.data.cityInfo)
    const summaryText = buildSummaryText(optimizedSections)
    const updatedRoute = {
      ...this.buildUpdatedRoute(optimizedSections),
      subtitle: summaryText,
      isDraft: this.data.fromPreview
    }
    const nextMapDay = this.data.currentMapDay >= optimizedSections.length ? -1 : this.data.currentMapDay

    if (this.data.fromPreview) {
      this.setData({
        reorderSheetVisible: false,
        route: updatedRoute,
        daySections: optimizedSections,
        summaryText,
        tabs: buildTabs(optimizedSections.length),
        originalDaySections: JSON.parse(JSON.stringify(stripEditState(optimizedSections))),
        hasRoutePlaces: flattenDaySections(optimizedSections).length > 0
      })
      this.refreshMapPreview(optimizedSections, this.data.mapPreviewIndex)
      this.updateMapData(optimizedSections, this.data.cityInfo, nextMapDay)
      this.handoffPreviewRoute(updatedRoute, '已智能规划')
      return
    }

    this.saveRouteToStorage(updatedRoute, '已智能规划')
    this.setData({
      reorderSheetVisible: false,
      route: updatedRoute,
      daySections: optimizedSections,
      summaryText,
      tabs: buildTabs(optimizedSections.length),
      originalDaySections: JSON.parse(JSON.stringify(stripEditState(optimizedSections))),
      hasRoutePlaces: flattenDaySections(optimizedSections).length > 0
    })
    this.refreshMapPreview(optimizedSections, this.data.mapPreviewIndex)
    this.updateMapData(optimizedSections, this.data.cityInfo, nextMapDay)
  },

  // 读取页面里每一天、每个地点当前的位置，
  // 供拖拽排序时判断"应该放到哪里"。
  captureDragLayout(callback) {
    const query = wx.createSelectorQuery().in(this)
    query.selectAll('.day-section').fields({ rect: true, dataset: true })
    query.selectAll('.place-swipe-cell').fields({ rect: true, dataset: true })
    query.exec(res => {
      const dayRects = (res && res[0]) || []
      const placeRects = (res && res[1]) || []
      const dayLayouts = (dayRects || []).map(rect => ({
        dayIndex: parseInt(rect.dataset && rect.dataset.dayIndex, 10),
        top: rect.top,
        bottom: rect.bottom,
        center: (rect.top + rect.bottom) / 2,
        items: []
      }))

      ;(placeRects || []).forEach(rect => {
        const dayIndex = parseInt(rect.dataset && rect.dataset.dayIndex, 10)
        const placeIndex = parseInt(rect.dataset && rect.dataset.placeIndex, 10)
        const targetDay = dayLayouts.find(item => item.dayIndex === dayIndex)
        if (!targetDay) return
        targetDay.items.push({
          placeIndex,
          top: rect.top,
          bottom: rect.bottom,
          center: (rect.top + rect.bottom) / 2
        })
      })

      dayLayouts.forEach(day => {
        day.items.sort((a, b) => a.placeIndex - b.placeIndex)
      })

      this._dragLayouts = dayLayouts.sort((a, b) => a.dayIndex - b.dayIndex)
      if (typeof callback === 'function') callback()
    })
  },

  // 根据手指当前 Y 坐标，推算拖拽目标落点。
  resolveDragTarget(currentY) {
    const layouts = this._dragLayouts || []
    if (!layouts.length) {
      return {
        dayIndex: this.data.dragDay,
        placeIndex: this.data.dragIndex
      }
    }

    let targetDay = layouts.find(day => currentY >= day.top && currentY <= day.bottom)
    if (!targetDay) {
      targetDay = layouts.reduce((nearest, day) => {
        if (!nearest) return day
        return Math.abs(day.center - currentY) < Math.abs(nearest.center - currentY) ? day : nearest
      }, null)
    }

    if (!targetDay) {
      return {
        dayIndex: this.data.dragDay,
        placeIndex: this.data.dragIndex
      }
    }

    const items = targetDay.items || []
    if (!items.length) {
      return { dayIndex: targetDay.dayIndex, placeIndex: 0 }
    }

    let targetIndex = items.length
    for (let i = 0; i < items.length; i += 1) {
      if (currentY < items[i].center) {
        targetIndex = items[i].placeIndex
        break
      }
    }

    if (targetIndex === items.length) {
      const lastItem = items[items.length - 1]
      targetIndex = lastItem.placeIndex + 1
    }

    return { dayIndex: targetDay.dayIndex, placeIndex: targetIndex }
  },

  // 刷新添加地点弹窗的数据源
  refreshPlacePickerItems() {
    const pickerData = buildPlacePickerData()
    const placePickerCurrentItems = this.resolvePlacePickerItems(this.data.placePickerTab, pickerData)
    this.setData({
      placePickerItems: pickerData.all || [],
      placePickerWantItems: pickerData.want || [],
      placePickerCollectItems: pickerData.collect || [],
      placePickerCurrentItems
    })
  },

  // 根据当前弹窗 Tab，切换显示"全部 / 想去 / 收藏"
  resolvePlacePickerItems(tab, pickerData) {
    const source = pickerData || this.data
    if (tab === 'want') return source.want || source.placePickerWantItems || []
    if (tab === 'collect') return source.collect || source.placePickerCollectItems || []
    return source.all || source.placePickerItems || []
  },

  // 开始拖拽某个地点
  onDragStart(e) {
    if (!this.data.isEditing) return
    const dayIndex = parseInt(e.currentTarget.dataset.dayIndex, 10)
    const index = parseInt(e.currentTarget.dataset.index, 10)
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || {}

    this.setData({
      dragging: true,
      dragDay: dayIndex,
      dragIndex: index,
      dragTouchStartY: this.data.handleTouchStartY || touch.clientY || 0,
      dragOffsetY: 0,
      swipeDay: -1,
      swipeIndex: -1,
      daySections: this.resetSwipeOffsets(this.data.daySections)
    }, () => {
      this.captureDragLayout()
    })
    wx.vibrateShort()
  },

  // 拖拽移动中：根据当前位置动态换位
  onDragMove(e) {
    if (!this.data.isEditing || !this.data.dragging) return

    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || {}
    const currentY = touch.clientY || 0
    const deltaY = currentY - this.data.dragTouchStartY
    const target = this.resolveDragTarget(currentY)
    if (!target || target.dayIndex < 0 || target.placeIndex < 0) {
      this.setData({ dragOffsetY: deltaY })
      return
    }

    const fromDay = this.data.dragDay
    const fromIndex = this.data.dragIndex
    const effectiveTargetIndex = target.dayIndex === fromDay && target.placeIndex > fromIndex
      ? target.placeIndex - 1
      : target.placeIndex

    if (target.dayIndex === fromDay && effectiveTargetIndex === fromIndex) {
      this.setData({ dragOffsetY: deltaY })
      return
    }

    const movedSections = moveItemAcrossDays(
      this.data.daySections,
      fromDay,
      fromIndex,
      target.dayIndex,
      target.placeIndex
    )
    const syncedSections = syncDaySections(movedSections, this.data.cityInfo)
    this.setData({
      daySections: syncedSections,
      dragDay: target.dayIndex,
      dragIndex: effectiveTargetIndex,
      dragTouchStartY: currentY,
      dragOffsetY: 0,
      summaryText: buildSummaryText(syncedSections)
    }, () => {
      this.captureDragLayout()
    })
  },

  // 拖拽结束：清理临时状态
  onDragEnd() {
    if (!this.data.dragging) return
    this.setData({
      dragging: false,
      dragDay: -1,
      dragIndex: -1,
      dragTouchStartY: 0,
      dragOffsetY: 0,
      handleTouchStartY: 0
    })
    this._dragLayouts = null
  },

  // 左滑开始：记录手指起点
  onSwipeStart(e) {
    if (!this.data.isEditing || this.data.dragging) return
    const touch = e.touches && e.touches[0]
    if (!touch) return
    const dayIndex = parseInt(e.currentTarget.dataset.dayIndex, 10)
    const index = parseInt(e.currentTarget.dataset.index, 10)
    const item = (((this.data.daySections || [])[dayIndex] || {}).items || [])[index] || {}
    this.setData({
      swipeStartX: touch.clientX,
      swipeStartY: touch.clientY,
      swipeDay: dayIndex,
      swipeIndex: index,
      swipeStartOffset: item.swipeOffset || 0
    })
  },

  // 左滑移动：只更新当前卡片的删除偏移量
  onSwipeMove(e) {
    if (!this.data.isEditing) return
    if (this.data.dragging) {
      this.onDragMove(e)
      return
    }
    const touch = e.touches && e.touches[0]
    if (!touch) return
    const dayIndex = parseInt(e.currentTarget.dataset.dayIndex, 10)
    const index = parseInt(e.currentTarget.dataset.index, 10)
    if (dayIndex !== this.data.swipeDay || index !== this.data.swipeIndex) return

    const deltaX = touch.clientX - this.data.swipeStartX
    const deltaY = touch.clientY - this.data.swipeStartY
    if (Math.abs(deltaY) > Math.abs(deltaX)) return

    let offset = this.data.swipeStartOffset + deltaX
    offset = Math.max(MAX_DELETE_OFFSET, Math.min(0, offset))

    this.setData({
      daySections: this.resetSwipeOffsets(this.data.daySections, dayIndex, index, offset)
    })
  },

  // 左滑结束：决定是停在打开状态，还是自动关回去
  onSwipeEnd(e) {
    if (!this.data.isEditing) return
    if (this.data.dragging) {
      this.onDragEnd()
      return
    }
    const dayIndex = parseInt(e.currentTarget.dataset.dayIndex, 10)
    const index = parseInt(e.currentTarget.dataset.index, 10)
    if (dayIndex !== this.data.swipeDay || index !== this.data.swipeIndex) return

    const item = (((this.data.daySections || [])[dayIndex] || {}).items || [])[index] || {}
    const isOpen = (item.swipeOffset || 0) < -36
    this.setData({
      daySections: this.resetSwipeOffsets(
        this.data.daySections,
        isOpen ? dayIndex : -1,
        isOpen ? index : -1,
        isOpen ? MAX_DELETE_OFFSET : 0
      ),
      swipeStartOffset: isOpen ? MAX_DELETE_OFFSET : 0
    })
  },

  // 删除某一天里的一个地点
  onDeletePlace(e) {
    if (!this.data.isEditing) return
    const dayIndex = parseInt(e.currentTarget.dataset.dayIndex, 10)
    const index = parseInt(e.currentTarget.dataset.index, 10)
    const daySections = this.data.daySections.slice()
    const items = ((daySections[dayIndex] || {}).items || []).slice()
    if (!items[index]) return

    items.splice(index, 1)
    daySections[dayIndex] = { ...daySections[dayIndex], items }
    const syncedSections = syncDaySections(daySections, this.data.cityInfo)

    this.setData({
      daySections: syncedSections,
      summaryText: buildSummaryText(syncedSections),
      swipeDay: -1,
      swipeIndex: -1,
      swipeStartOffset: 0
    })
    wx.showToast({ title: '已删除地点', icon: 'none' })
  },

  // 打开"添加地点"底部弹窗
  onOpenPlacePicker(e) {
    if (!this.data.isEditing) return
    this.refreshPlacePickerItems()
    this.setData({
      placePickerVisible: true,
      placePickerTab: 'all',
      placePickerCurrentItems: this.resolvePlacePickerItems('all'),
      placePickerDayIndex: parseInt(e.currentTarget.dataset.dayIndex, 10)
    })
  },

  // 关闭"添加地点"底部弹窗
  onClosePlacePicker() {
    this.setData({
      placePickerVisible: false,
      placePickerDayIndex: -1
    })
  },

  // 切换添加地点弹窗里的筛选 Tab
  onSwitchPlacePickerTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({
      placePickerTab: tab,
      placePickerCurrentItems: this.resolvePlacePickerItems(tab)
    })
  },

  // 通过系统地图选点，把地点加进某一天
  onChoosePlaceFromMap() {
    const dayIndex = this.data.placePickerDayIndex
    if (dayIndex < 0) return
    const { cityInfo } = this.data
    wx.chooseLocation({
      latitude: cityInfo.lat,
      longitude: cityInfo.lng,
      success: (res) => {
        if (typeof res.latitude !== 'number' || typeof res.longitude !== 'number') return
        const nextSections = this.data.daySections.slice()
        const targetDay = nextSections[dayIndex] || { id: `day-${dayIndex}`, items: [] }
        const nextItems = (targetDay.items || []).slice()
        nextItems.push(buildMapPickedPlace(res))
        nextSections[dayIndex] = {
          ...targetDay,
          items: nextItems
        }
        const syncedSections = syncDaySections(nextSections, this.data.cityInfo)
        this.setData({
          daySections: syncedSections,
          tabs: buildTabs(syncedSections.length),
          summaryText: buildSummaryText(syncedSections),
          currentTab: dayIndex + 1,
          sheetScrollTarget: `route-day-anchor-${dayIndex}`,
          placePickerVisible: false,
          placePickerDayIndex: -1
        })
        wx.showToast({ title: '已添加地点', icon: 'success' })
      },
      fail: (err) => {
        if (err && err.errMsg && err.errMsg.includes('cancel')) return
        wx.showToast({ title: '地图选点失败', icon: 'none' })
      }
    })
  },

  // 从弹窗列表里选一个地点，加进当前这一天
  onAddPlaceToDay(e) {
    const dayIndex = this.data.placePickerDayIndex
    const item = e.currentTarget.dataset.item
    if (dayIndex < 0 || !item) return

    const nextSections = this.data.daySections.slice()
    const targetDay = nextSections[dayIndex] || { id: `day-${dayIndex}`, items: [] }
    const nextItems = (targetDay.items || []).slice()
    nextItems.push(buildAddedPlace(item))
    nextSections[dayIndex] = {
      ...targetDay,
      items: nextItems
    }

    const syncedSections = syncDaySections(nextSections, this.data.cityInfo)
    this.setData({
      daySections: syncedSections,
      tabs: buildTabs(syncedSections.length),
      summaryText: buildSummaryText(syncedSections),
      currentTab: dayIndex + 1,
      sheetScrollTarget: `route-day-anchor-${dayIndex}`,
      placePickerVisible: false,
      placePickerDayIndex: -1
    })
    wx.showToast({ title: '已添加地点', icon: 'success' })
  },

  // 阻止弹窗内部点击冒泡到遮罩层
  preventBubble() {
  },

  // 预留空函数，主要给模板占位用
  noop() {
  },

  // 小程序右上角分享文案
  onShareAppMessage() {
    const { route } = this.data
    return {
      title: route ? `${route.title} · 我的路线` : '我的路线',
      path: route ? `/subpackages/route/pages/my-route/my-route?route=${encodeURIComponent(JSON.stringify(route))}` : '/pages/index/index'
    }
  }
})
