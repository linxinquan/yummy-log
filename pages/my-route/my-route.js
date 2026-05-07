const util = require('../../utils/util')
const shopDataModule = require('../../utils/shopData')
const { shops, shopNameMap } = shopDataModule
const { spotData } = require('../../utils/spotData')

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
const DRAG_STEP = 88
const GUANGDONG_CITIES = [
  { id: 1, name: '广州', fullName: '广州市', lat: 23.1291, lng: 113.2644 },
  { id: 2, name: '深圳', fullName: '深圳市', lat: 22.5431, lng: 114.0579 },
  { id: 3, name: '汕头', fullName: '汕头市', lat: 23.3541, lng: 116.6819 },
  { id: 4, name: '湛江', fullName: '湛江市', lat: 21.2707, lng: 110.3594 },
  { id: 5, name: '汕尾', fullName: '汕尾市', lat: 22.7862, lng: 115.3751 },
  { id: 6, name: '清远', fullName: '清远市', lat: 23.6817, lng: 113.056 },
  { id: 7, name: '佛山', fullName: '佛山市', lat: 23.0215, lng: 113.1214 },
  { id: 8, name: '东莞', fullName: '东莞市', lat: 23.0207, lng: 113.7518 },
  { id: 9, name: '珠海', fullName: '珠海市', lat: 22.271, lng: 113.5767 },
  { id: 10, name: '中山', fullName: '中山市', lat: 22.5176, lng: 113.3928 },
  { id: 11, name: '江门', fullName: '江门市', lat: 22.5787, lng: 113.0819 },
  { id: 12, name: '惠州', fullName: '惠州市', lat: 23.1118, lng: 114.4168 },
  { id: 13, name: '肇庆', fullName: '肇庆市', lat: 23.0472, lng: 112.4651 },
  { id: 14, name: '茂名', fullName: '茂名市', lat: 21.6633, lng: 110.9255 },
  { id: 15, name: '阳江', fullName: '阳江市', lat: 21.8579, lng: 111.9822 },
  { id: 16, name: '梅州', fullName: '梅州市', lat: 24.2886, lng: 116.1176 },
  { id: 17, name: '河源', fullName: '河源市', lat: 23.7437, lng: 114.7004 },
  { id: 18, name: '韶关', fullName: '韶关市', lat: 24.8104, lng: 113.5972 },
  { id: 19, name: '揭阳', fullName: '揭阳市', lat: 23.5498, lng: 116.3728 },
  { id: 20, name: '潮州', fullName: '潮州市', lat: 23.6567, lng: 116.6226 },
  { id: 21, name: '云浮', fullName: '云浮市', lat: 22.9153, lng: 112.0445 }
]

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

function normalizeName(name) {
  return String(name || '')
    .replace(/\s+/g, '')
    .replace(/[()（）·,，.。]/g, '')
    .toLowerCase()
}

function formatTravelDuration(minutes) {
  const safeMinutes = Math.max(1, Math.round(minutes))
  if (safeMinutes < 60) return `${safeMinutes}min`
  const hours = Math.floor(safeMinutes / 60)
  const mins = safeMinutes % 60
  return mins ? `${hours}h ${mins}min` : `${hours}h`
}

function buildTravelMeta(distance) {
  const safeDistance = Math.max(Math.round(distance || 0), 1)
  let label = '步行'
  let minutesPerKm = 12

  if (safeDistance >= 10000) {
    label = '打车'
    minutesPerKm = 3
  } else if (safeDistance >= 3500) {
    label = '地铁'
    minutesPerKm = 5
  } else if (safeDistance >= 900) {
    label = '自行车'
    minutesPerKm = 4
  }

  const duration = formatTravelDuration((safeDistance / 1000) * minutesPerKm)
  return `${label} | ${util.formatDistance(safeDistance)} · ${duration}`
}

function buildSyntheticLatLng(cityInfo, dayIndex, itemIndex) {
  return {
    lat: cityInfo.lat + ((dayIndex * 0.018) - 0.018) + (itemIndex * 0.0035),
    lng: cityInfo.lng + ((itemIndex * 0.016) - 0.016) + (dayIndex * 0.004)
  }
}

function inferTag(name) {
  if (/博物馆|展馆|美术馆/.test(name)) return '文化展馆'
  if (/演出|剧场|音乐会/.test(name)) return '演出'
  if (/商场|购物中心|步行街/.test(name)) return '购物'
  if (/店|馆|面|饭|咖啡|茶|酒|餐|小吃|甜品|火锅|奶茶|烧烤|糖水|包|饼|馍/.test(name)) return '美食'
  return '景点'
}

function findMatchedPlace(name) {
  const normalized = normalizeName(name)
  if (!normalized) return null

  const matchedShop = shops.find(item => normalizeName(item.name) === normalized)
  if (matchedShop) return matchedShop

  const aliasTarget = Object.keys(shopNameMap).find(alias => {
    const normalizedAlias = normalizeName(alias)
    return normalized.includes(normalizedAlias) || normalizedAlias.includes(normalized)
  })
  if (aliasTarget) {
    const shopName = shopNameMap[aliasTarget]
    const aliasShop = shops.find(item => item.name === shopName)
    if (aliasShop) return aliasShop
  }

  const matchedSpot = (spotData || []).find(item => normalizeName(item.name) === normalized)
  if (matchedSpot) return matchedSpot

  const xianPoi = Object.keys(XIAN_POI_MAP).find(key => normalizeName(key) === normalized)
  return xianPoi ? XIAN_POI_MAP[xianPoi] : null
}

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

function syncDaySections(daySections, cityInfo) {
  const fallbackCity = cityInfo || { lat: 22.5431, lng: 114.0579 }
  return stripEditState(daySections).map((day, dayIndex) => {
    const rawItems = (day.items || []).map((item, itemIndex) => {
      const matched = findMatchedPlace(item.name)
      const synthetic = buildSyntheticLatLng(fallbackCity, dayIndex, itemIndex)
      const tag = item.tag || inferTag(item.name)
      return {
        ...item,
        id: item.id || `day-${dayIndex}-item-${itemIndex}`,
        name: item.name || '待补充地点',
        tag,
        image: item.image || matched?.image || matched?.logo || DEFAULT_COVERS[(dayIndex + itemIndex) % DEFAULT_COVERS.length],
        type: item.type || matched?.type || (tag === '美食' ? 'food' : 'spot'),
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
      items: plannedItems.map(item => ({
        ...item,
        travelText: buildTravelMeta(item.distanceFromPrev || 0),
        swipeOffset: item.swipeOffset || 0
      }))
    }
  })
}

function alignDaySections(daySections, targetCount, cityInfo) {
  const sections = stripEditState(daySections).slice(0, targetCount)
  while (sections.length < targetCount) {
    sections.push({
      id: `day-${Date.now()}-${sections.length}`,
      items: []
    })
  }
  return syncDaySections(sections, cityInfo)
}

function buildLegacyRouteData(daySections) {
  const cleanSections = stripEditState(daySections)
  const daySummaries = cleanSections.map((day, index) => ({
    location: '',
    route: (day.items || []).map(item => item.name).join(' --- '),
    image: (day.items && day.items[0] && day.items[0].image) || DEFAULT_COVERS[index % DEFAULT_COVERS.length]
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

function buildSummaryText(daySections) {
  const dayCount = daySections.length
  const nightCount = Math.max(dayCount - 1, 0)
  const placeCount = daySections.reduce((sum, day) => sum + (day.items || []).length, 0)
  return `${dayCount} 天 ${nightCount} 晚 · ${placeCount} 个地点`
}

function removeEmptyDaysOnSave(daySections) {
  const sections = (daySections || []).filter(day => (day.items || []).length > 0)
  if (sections.length) return sections
  return (daySections || []).slice(0, 1)
}

function getCityInfo(text) {
  const source = String(text || '')
  for (let i = 0; i < CITY_PRESETS.length; i += 1) {
    if (CITY_PRESETS[i].match.test(source)) {
      return CITY_PRESETS[i]
    }
  }
  return { name: source || '深圳市', lat: 22.5431, lng: 114.0579 }
}

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

function buildPlaceCandidate(item, type, source) {
  if (!item) return null
  const displayImage = item.displayImage || item.image || item.logo || item.thumb || DEFAULT_COVERS[0]
  return {
    id: String(item.id),
    sourceKey: `${type}-${item.id}`,
    sourceType: source,
    type,
    name: item.name,
    tag: type === 'food' ? '美食' : inferTag(item.name),
    image: displayImage,
    lat: item.lat || item.latitude,
    lng: item.lng || item.longitude
  }
}

function buildPlacePickerData() {
  const userAddedShops = util.loadData('userAddedShops', [])
  const allFoods = [...(shops || []), ...((shopDataModule && shopDataModule.foods) || []), ...userAddedShops]
  const allSpots = spotData || []
  const wantFoodIds = util.loadData('userWantFoods', []).map(item => String(item))
  const wantSpotIds = util.loadData('userWantSpots', []).map(item => String(item))
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
          sourceType: existed.sourceType === source ? source : 'all'
        })
      } else {
        allMap.set(candidate.sourceKey, candidate)
      }
    })
  }

  appendItems(wantFoodIds, allFoods, 'food', 'want', wantItems)
  appendItems(wantSpotIds, allSpots, 'spot', 'want', wantItems)
  appendItems(collectFoodIds, allFoods, 'food', 'collect', collectItems)
  appendItems(collectSpotIds, allSpots, 'spot', 'collect', collectItems)

  return {
    all: Array.from(allMap.values()),
    want: wantItems,
    collect: collectItems
  }
}

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

Page({
  data: {
    route: null,
    routeId: '',
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
    daySections: [],
    originalDaySections: [],
    tabs: [],
    mapCenter: { lat: 22.5431, lng: 114.0579 },
    mapMarkers: [],
    polyline: [],
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
    placePickerDayIndex: -1
  },

  onLoad(options) {
    const sysInfo = wx.getSystemInfoSync()
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const menuTop = menuButtonInfo ? menuButtonInfo.top : (sysInfo.statusBarHeight || 44) + 4
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
      routeId: String(route.id)
    })
    this.refreshPlacePickerItems()
    this.applyRoute(route)
  },

  onShow() {
    const { routeId, isEditing } = this.data
    if (!routeId || isEditing) return
    const savedRoutes = util.loadData('savedRoutes', [])
    const latestRoute = savedRoutes.find(item => String(item.id) === String(routeId))
    if (latestRoute) {
      this.applyRoute(latestRoute)
    }
  },

  applyRoute(route) {
    const cityText = route.city || route.cityText || getCityInfo(route.title).name
    const cityInfo = getCityInfo(cityText)
    const daySections = syncDaySections(buildDaySectionsFromLegacy(route), cityInfo)
    const summaryText = route.subtitle || buildSummaryText(daySections)

    this.setData({
      route,
      routeId: String(route.id),
      cityInfo,
      cityText,
      daySections,
      originalDaySections: JSON.parse(JSON.stringify(stripEditState(daySections))),
      tabs: buildTabs(daySections.length),
      summaryText,
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
      swipeStartOffset: 0
    })

    this.updateMapData(daySections, cityInfo, -1)
  },

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
      image: route.image || daySummaries[0]?.image || DEFAULT_COVERS[0],
      updatedAt: Date.now()
    }
  },

  resetSwipeOffsets(daySections, keepDay = -1, keepIndex = -1, keepOffset = 0) {
    return (daySections || []).map((day, dayIndex) => ({
      ...day,
      items: (day.items || []).map((item, itemIndex) => ({
        ...item,
        swipeOffset: dayIndex === keepDay && itemIndex === keepIndex ? keepOffset : 0
      }))
    }))
  },

  updateMapData(daySections, cityInfo, mapDayIndex) {
    const sections = typeof mapDayIndex === 'number' && mapDayIndex >= 0
      ? [daySections[mapDayIndex]].filter(Boolean)
      : daySections

    const flattened = []
    sections.forEach((day, dayIndex) => {
      ;(day.items || []).forEach((item, itemIndex) => {
        flattened.push({ ...item, dayIndex, itemIndex })
      })
    })

    const markers = flattened.map((item, index) => ({
      id: index,
      latitude: item.lat,
      longitude: item.lng,
      iconPath: index === 0
        ? '/images/markers/marker_start.png'
        : index === flattened.length - 1
          ? '/images/markers/marker_end.png'
          : '/images/markers/marker_food.png',
      width: 32,
      height: 32,
      label: {
        content: String(index + 1),
        fontSize: 10,
        color: '#FFFFFF',
        fontWeight: 'bold',
        anchorY: -42
      }
    }))

    const polyline = markers.length > 1 ? [{
      points: markers.map(marker => ({ latitude: marker.latitude, longitude: marker.longitude })),
      color: '#47BFFE',
      width: 4,
      dottedLine: false,
      borderColor: '#FFFFFF',
      borderWidth: 1
    }] : []

    this.setData({
      mapCenter: { lat: cityInfo.lat, lng: cityInfo.lng },
      mapMarkers: markers,
      polyline,
      currentMapDay: typeof mapDayIndex === 'number' ? mapDayIndex : -1
    })
  },

  onBack() {
    wx.navigateBack()
  },

  onShareTap() {
    wx.showToast({ title: '请点击右上角分享', icon: 'none' })
  },

  onSwitchMode(e) {
    if (this.data.isEditing) return
    const mode = e.currentTarget.dataset.mode
    if (mode === this.data.viewMode) return
    this.setData({ viewMode: mode })
    if (mode === 'map') {
      const mapDayIndex = this.data.currentTab > 0 ? this.data.currentTab - 1 : -1
      this.updateMapData(this.data.daySections, this.data.cityInfo, mapDayIndex)
    }
  },

  onOpenMapMode() {
    if (this.data.isEditing) return
    this.setData({ viewMode: 'map' })
    const mapDayIndex = this.data.currentTab > 0 ? this.data.currentTab - 1 : -1
    this.updateMapData(this.data.daySections, this.data.cityInfo, mapDayIndex)
  },

  onSelectMapDay(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10)
    this.updateMapData(this.data.daySections, this.data.cityInfo, index)
  },

  onTabTap(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10)
    const sheetScrollTarget = index === 0 ? 'route-scroll-top' : `route-day-anchor-${index - 1}`
    this.setData({ currentTab: index, sheetScrollTarget })

    if (this.data.viewMode === 'map') {
      this.updateMapData(this.data.daySections, this.data.cityInfo, index - 1)
    }
  },

  onEditMeta() {
    const routeForEdit = this.buildUpdatedRoute(this.data.daySections)
    wx.navigateTo({
      url: `/pages/route-basic-edit/route-basic-edit?route=${encodeURIComponent(JSON.stringify(routeForEdit))}`
    })
  },

  onStartRouteEdit() {
    const daySections = this.resetSwipeOffsets(this.data.daySections)
    this.refreshPlacePickerItems()
    this.setData({
      isEditing: true,
      viewMode: 'list',
      dragging: false,
      dragDay: -1,
      dragIndex: -1,
      dragTouchStartY: 0,
      dragOffsetY: 0,
      swipeDay: -1,
      swipeIndex: -1,
      swipeStartOffset: 0,
      sheetScrollTarget: '',
      daySections,
      originalDaySections: JSON.parse(JSON.stringify(stripEditState(daySections))),
      placePickerVisible: false,
      placePickerTab: 'all',
      placePickerDayIndex: -1
    })
    wx.showToast({ title: '进入修改路线', icon: 'none' })
  },

  onCancelEdit() {
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
      sheetScrollTarget: '',
      placePickerVisible: false,
      placePickerDayIndex: -1
    })
    this.updateMapData(restored, this.data.cityInfo, this.data.currentMapDay)
  },

  onSave() {
    const cleanedSections = syncDaySections(this.data.daySections, this.data.cityInfo)
    const savedSections = removeEmptyDaysOnSave(cleanedSections)
    const summaryText = buildSummaryText(savedSections)
    const updatedRoute = {
      ...this.buildUpdatedRoute(savedSections),
      subtitle: summaryText
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
      placePickerDayIndex: -1
    })
    this.updateMapData(savedSections, this.data.cityInfo, nextMapDay)
  },

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

  onHandleTouchStart(e) {
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || {}
    this.setData({ handleTouchStartY: touch.clientY || 0 })
  },

  refreshPlacePickerItems() {
    const pickerData = buildPlacePickerData()
    this.setData({
      placePickerItems: pickerData.all || [],
      placePickerWantItems: pickerData.want || [],
      placePickerCollectItems: pickerData.collect || []
    })
  },

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
    })
    wx.vibrateShort()
  },

  onDragMove(e) {
    if (!this.data.isEditing || !this.data.dragging) return

    const dayIndex = parseInt(e.currentTarget.dataset.dayIndex, 10)
    if (dayIndex !== this.data.dragDay) return

    const daySections = this.data.daySections.slice()
    const currentItems = daySections[dayIndex] && daySections[dayIndex].items ? daySections[dayIndex].items.slice() : []
    if (currentItems.length <= 1) return

    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || {}
    const currentY = touch.clientY || 0
    const deltaY = currentY - this.data.dragTouchStartY
    let step = 0
    if (Math.abs(deltaY) >= DRAG_STEP) {
      step = deltaY > 0 ? Math.floor(deltaY / DRAG_STEP) : Math.ceil(deltaY / DRAG_STEP)
    }

    if (!step) {
      this.setData({ dragOffsetY: deltaY })
      return
    }

    let targetIndex = this.data.dragIndex + step
    targetIndex = Math.max(0, Math.min(currentItems.length - 1, targetIndex))
    if (targetIndex === this.data.dragIndex) {
      this.setData({ dragOffsetY: deltaY })
      return
    }

    const movingItems = currentItems.slice()
    const moved = movingItems.splice(this.data.dragIndex, 1)[0]
    movingItems.splice(targetIndex, 0, moved)
    daySections[dayIndex] = { ...daySections[dayIndex], items: movingItems }

    const syncedSections = syncDaySections(daySections, this.data.cityInfo)
    const consumedStep = targetIndex - this.data.dragIndex
    const nextTouchStartY = this.data.dragTouchStartY + (consumedStep * DRAG_STEP)
    this.setData({
      daySections: syncedSections,
      dragIndex: targetIndex,
      dragTouchStartY: nextTouchStartY,
      dragOffsetY: currentY - nextTouchStartY,
      summaryText: buildSummaryText(syncedSections)
    })
  },

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
  },

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

  onOpenPlacePicker(e) {
    if (!this.data.isEditing) return
    this.refreshPlacePickerItems()
    this.setData({
      placePickerVisible: true,
      placePickerTab: 'all',
      placePickerDayIndex: parseInt(e.currentTarget.dataset.dayIndex, 10)
    })
  },

  onClosePlacePicker() {
    this.setData({
      placePickerVisible: false,
      placePickerDayIndex: -1
    })
  },

  onSwitchPlacePickerTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ placePickerTab: tab })
  },

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

  preventBubble() {
  },

  noop() {
  },

  onShareAppMessage() {
    const { route } = this.data
    return {
      title: route ? `${route.title} · 我的路线` : '我的路线',
      path: route ? `/pages/my-route/my-route?route=${encodeURIComponent(JSON.stringify(route))}` : '/pages/index/index'
    }
  }
})
