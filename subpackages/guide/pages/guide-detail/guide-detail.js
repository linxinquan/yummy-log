const util = require('../../../../utils/util')
const placesData = require('../../../../utils/placesData')
const { applyTravelMeta, buildTravelOptions } = require('../../../../utils/travel')
const { buildMapPreviewViewData } = require('../../../../utils/map-preview')
const { resolveDisplayCategory } = require('../../../../utils/displayCategory')
const { formatTripSummary } = require('../../../../utils/trip-duration')
const {
  buildPlaceCardTags,
  buildRouteTravelDisplay,
  buildPlaceIntroData: buildPlaceIntroSheetData
} = require('../../../../utils/route-place-card')
const { fetchRealRoute } = require('../../../../utils/mapRouteFetcher')
const mapConfig = require('../../../../utils/map-config')
const { buildDayLabel, buildTabs } = require("../../../../utils/routeHelper");

// 地图模式统一使用当前位置 PNG 图标，和探索页保持一致。
const CURRENT_LOCATION_ICON_PATH = '/images/markers/marker_current_location.png'
const CURRENT_LOCATION_FOCUS_SCALE = 15

// 根据攻略标题、城市等字段推断城市和中心点。
const CITY_PRESETS = [
  { match: /西安|长安/, name: '西安市', lat: 34.3416, lng: 108.9398 },
  { match: /广州/, name: '广州市', lat: 23.1291, lng: 113.2644 },
  { match: /汕头/, name: '汕头市', lat: 23.3541, lng: 116.6819 },
  { match: /湛江/, name: '湛江市', lat: 21.2707, lng: 110.3594 },
  { match: /佛山/, name: '佛山市', lat: 23.0218, lng: 113.1219 },
  { match: /珠海/, name: '珠海市', lat: 22.2707, lng: 113.5767 },
  { match: /深圳|南山|福田|罗湖|宝安|龙岗|盐田|龙华|光明|坪山|大鹏/, name: '深圳市', lat: 22.5431, lng: 114.0579 }
]

// 给西安这组经典点位补固定坐标，避免旧攻略没有定位信息。
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

// 从"3天""2天1夜"这类文案里取出天数。
function parseDayCount(duration) {
  const matched = String(duration || '').match(/(\d+)/)
  if (!matched) return 1
  return Math.max(parseInt(matched[1], 10) || 1, 1)
}

// 把分天路线拍平成普通数组，方便地图预览使用。
function flattenDaySections(daySections) {
  const places = []
  ;(daySections || []).forEach((day, dayIndex) => {
    ;(day.items || []).forEach((item, itemIndex) => {
      places.push({
        ...item,
        dayIndex,
        itemIndex
      })
    })
  })
  return places
}

// 根据"第几天"找到它在预览数组里的起始位置。
function getPreviewIndexByDay(daySections, dayIndex) {
  if (dayIndex <= 0) return 0
  let count = 0
  for (let i = 0; i < dayIndex; i += 1) {
    count += ((daySections[i] || {}).items || []).length
  }
  return count
}

// 根据预览数组下标，反推出属于第几天。
function getDayIndexByPreview(daySections, previewIndex) {
  let cursor = 0
  for (let dayIndex = 0; dayIndex < daySections.length; dayIndex += 1) {
    const items = (daySections[dayIndex] || {}).items || []
    const nextCursor = cursor + items.length
    if (previewIndex < nextCursor) return dayIndex
    cursor = nextCursor
  }
  return Math.max(daySections.length - 1, 0)
}

// 标准化名称，方便做模糊匹配。
function normalizeName(name) {
  return String(name || '')
    .replace(/\s+/g, '')
    .replace(/[()（）·,，.。]/g, '')
    .toLowerCase()
}

// 当地点缺少坐标时，按城市中心生成临时坐标。
function buildSyntheticLatLng(cityInfo, dayIndex, itemIndex) {
  return {
    lat: cityInfo.lat + ((dayIndex * 0.018) - 0.018) + (itemIndex * 0.0035),
    lng: cityInfo.lng + ((itemIndex * 0.016) - 0.016) + (dayIndex * 0.004)
  }
}

// 尝试把地点名称匹配到系统已有的数据。
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

// 给详情页准备封面图池。
function buildCoverPool(guide) {
  return [guide.coverImage].filter(Boolean)
}

// 根据攻略信息推断城市和中心点。
function getCityInfo(guide) {
  const source = [guide.city || '', guide.cityText || '', guide.title || '', (guide.tags || []).join(' ')].join(' ')
  for (let i = 0; i < CITY_PRESETS.length; i += 1) {
    if (CITY_PRESETS[i].match.test(source)) {
      return CITY_PRESETS[i]
    }
  }
  return { name: '深圳市', lat: 22.5431, lng: 114.0579 }
}

// 根据地点名称猜一个大类标签。
function inferTag(name) {
  if (/博物馆|展馆|美术馆/.test(name)) return '文化展馆'
  if (/演出|剧场|音乐会/.test(name)) return '演出'
  if (/商场|购物中心|步行街/.test(name)) return '购物'
  if (/店|馆|面|饭|咖啡|茶|酒|餐|小吃|甜品|火锅|奶茶|烧烤|糖水|包|饼|馍/.test(name)) return '美食'
  return '景点'
}

// 把攻略详情里的地点补齐成新卡片需要的展示字段。
function decorateGuidePlaceItem(item = {}) {
  const displayCategory = item.displayCategory || resolveDisplayCategory(item)
  return {
    ...item,
    displayCategory,
    tags: buildPlaceCardTags({ ...item, displayCategory }),
    ...buildRouteTravelDisplay(item.travelMeta, item.distanceFromPrev)
  }
}

// 把攻略里的 daySections 整理成详情页可直接展示的结构。
function syncDaySections(daySections, cityInfo) {
  const fallbackCity = cityInfo || { lat: 22.5431, lng: 114.0579 }
  return (daySections || []).map((day, dayIndex) => {
    const rawItems = (day.items || []).map((item, itemIndex) => {
      const matched = findMatchedPlace(item.name)
      const synthetic = buildSyntheticLatLng(fallbackCity, dayIndex, itemIndex)
      const lat = item.lat || item.latitude || (matched && matched.lat) || synthetic.lat
      const lng = item.lng || item.longitude || (matched && matched.lng) || synthetic.lng
      const tag = item.tag || inferTag(item.name)
      return {
        ...item,
        id: item.id || `day-${dayIndex}-item-${itemIndex}`,
        name: item.name || '待补充地点',
        tag,
        image: item.coverImage || '/images/app-logo.jpg',
        type: item.type || matched?.type || (tag === '美食' ? 'food' : 'spot'),
        rating: item.rating || matched?.rating || matched?.score || '',
        tags: item.tags || matched?.tags || [],
        desc: item.desc || matched?.desc || '',
        hours: item.hours || matched?.hours || '',
        openHours: item.openHours || matched?.openHours || '',
        free: item.free !== undefined ? item.free : matched?.free,
        price: item.price || matched?.price || '',
        category: item.category || matched?.category || '',
        address: item.address || matched?.address || `${fallbackCity.name || ''}${item.name || ''}`,
        lat,
        lng,
        distanceFromPrev: item.distanceFromPrev || 0
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
      items: plannedItems.map((item, itemIndex) => {
        const nextItem = applyTravelMeta(item, item.travelMode)
        return decorateGuidePlaceItem({
          ...nextItem,
          image: nextItem.image || '/images/app-logo.jpg'
        })
      })
    }
  })
}

// 生成顶部摘要文案。
function buildSummaryText(guide, daySections) {
  const dayCount = daySections.length
  const placeCount = daySections.reduce((sum, day) => sum + day.items.length, 0)
  return formatTripSummary(dayCount, placeCount)
}

// 西安攻略的默认分天模板。
function buildXianSections(covers) {
  return [
    {
      id: 'day-0',
      items: [
        { name: '西安城墙永宁门城楼', tag: '景点', image: covers[0], type: 'spot' },
        { name: '西安钟楼', tag: '景点', image: covers[1], type: 'spot' },
        { name: '西安鼓楼', tag: '景点', image: covers[2], type: 'spot' },
        { name: '回民街', tag: '景点', image: covers[3], type: 'spot' }
      ]
    },
    {
      id: 'day-1',
      items: [
        { name: '秦始皇兵马俑博物馆', tag: '文化展馆', image: covers[4], type: 'spot' },
        { name: '华清宫', tag: '景点', image: covers[5], type: 'spot' },
        { name: '长恨歌演出', tag: '景点', image: covers[6], type: 'spot' }
      ]
    },
    {
      id: 'day-2',
      items: [
        { name: '大雁塔', tag: '景点', image: covers[7], type: 'spot' },
        { name: '陕西历史博物馆', tag: '文化展馆', image: covers[8], type: 'spot' },
        { name: '大唐不夜城', tag: '景点', image: covers[9], type: 'spot' }
      ]
    }
  ]
}

// 普通攻略的默认分天模板。
function buildGenericSections(guide, covers) {
  const dayCount = parseDayCount(guide.duration)
  const sourceNames = (guide.shops && guide.shops.length ? guide.shops.slice() : [
    '城市地标',
    '人气街区',
    '本地老店',
    '热门打卡点',
    '城市展馆',
    '夜游路线'
  ]).filter(Boolean)

  const targetCount = Math.max(sourceNames.length, Math.max(dayCount * 3, guide.shopCount || 0))
  while (sourceNames.length < targetCount) {
    sourceNames.push(`${guide.tags && guide.tags[0] ? guide.tags[0] : '城市'}精选地点${sourceNames.length + 1}`)
  }

  const sections = []
  let cursor = 0
  for (let dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
    const remainingNames = sourceNames.length - cursor
    const remainingDays = dayCount - dayIndex
    const takeCount = Math.max(remainingDays === 1 ? remainingNames : Math.ceil(remainingNames / remainingDays), 1)
    const items = sourceNames.slice(cursor, cursor + takeCount).map((name, itemIndex) => {
      const tag = inferTag(name)
      return {
        id: `day-${dayIndex}-item-${itemIndex}`,
        name,
        tag,
        image: covers.length ? covers[(cursor + itemIndex) % covers.length] : '/images/app-logo.jpg',
        type: tag === '美食' ? 'food' : 'spot'
      }
    })
    sections.push({ id: `day-${dayIndex}`, items })
    cursor += takeCount
  }

  return sections
}

// 将 routes 数据结构转换为 daySections 结构。
// routes: [{ id, title, countText, places: [id1, id2, ...] }]
function convertRoutesToDaySections(routes) {
  return (routes || []).map((route, dayIndex) => {
    const items = (route.places || [])
      .map(id => placesData.getPlaceById(id))
      .filter(Boolean)
      .map((place, itemIndex) => ({
        id: place.id || `day-${dayIndex}-item-${itemIndex}`,
        name: place.name || '待补充地点',
        tag: place.tag || inferTag(place.name),
        coverImage: place.coverImage || '/images/app-logo.jpg',
        type: place.type || (place.tag === '美食' ? 'food' : 'spot'),
        rating: place.rating || place.score || '',
        tags: place.tags || [],
        desc: place.desc || '',
        hours: place.hours || '',
        openHours: place.openHours || '',
        free: place.free,
        price: place.price || '',
        category: place.category || '',
        address: place.address || '',
        lat: place.lat || place.latitude || 0,
        lng: place.lng || place.longitude || 0,
        distanceFromPrev: place.distanceFromPrev || 0
      }))
    
    return {
      id: route.id || `day-${dayIndex}`,
      title: route.title || buildDayLabel(dayIndex + 1),
      countText: route.countText || `${items.length} 个地点`,
      items
    }
  })
}

// 构建详情页最终要展示的 daySections。
function buildDaySections(guide, cityInfo) {
  // 优先处理 routes 数据结构（新版数据格式）
  if (guide.routes && guide.routes.length) {
    const convertedSections = convertRoutesToDaySections(guide.routes)
    return syncDaySections(convertedSections, cityInfo)
  }
  // 兼容旧版 daySections 数据结构
  if (guide.daySections && guide.daySections.length) {
    return syncDaySections(guide.daySections, cityInfo)
  }
  const covers = buildCoverPool(guide)
  console.log(covers)
  const content = [guide.title || '', (guide.tags || []).join(' '), (guide.desc || '')].join(' ')
  if (/西安|长安/.test(content)) {
    return syncDaySections(buildXianSections(covers), cityInfo)
  }
  return syncDaySections(buildGenericSections(guide, covers), cityInfo)
}

Page({
  data: {
    guide: null,
    menuTop: 0,
    menuHeight: 32,
    modeSwitchTop: 110,
    tabStickyTop: 150,
    viewMode: 'list',
    currentTab: 0,
    currentMapDay: -1,
    detailScrollTop: 0,
    sheetScrollTarget: '',
    cityText: '深圳市',
    summaryText: '',
    currentLocation: null,
    daySections: [],
    tabs: [],
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
    mapCenter: { lat: 22.5431, lng: 114.0579 },
    mapMarkers: [],
    polyline: [],
    isEditing: false,
    dragging: false,
    dragDay: -1,
    dragIndex: -1,
    dragTouchStartY: 0,
    transportSheetVisible: false,
    transportOptions: [],
    pendingTransportMode: 'walk',
    transportTarget: null,
    navMapSheetVisible: false,
    navMapTarget: null,
    placeIntroVisible: false,
    placeIntroData: null,
    isRouteSaved: false
  },

  // 页面初始化：解析攻略数据，并同步列表、地图和预览卡片。
  onLoad(options) {
    const windowInfo = wx.getWindowInfo()
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const menuTop = menuButtonInfo ? menuButtonInfo.top : (windowInfo.statusBarHeight || 44) + 4
    const menuHeight = menuButtonInfo ? menuButtonInfo.height : 32
    const modeSwitchTop = menuTop
    const tabStickyTop = menuTop + menuHeight + 24
    if (!options.guide) {
      wx.showToast({ title: '攻略不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack({ delta: 1 }), 1200)
      return
    }

    const guide = JSON.parse(decodeURIComponent(options.guide))
    console.log('guide', guide)

    const cityInfo = getCityInfo(guide)
    const daySections = buildDaySections(guide, cityInfo)

    this.setData({
      guide,
      cityText: cityInfo.name,
      cityInfo,
      menuTop,
      menuHeight,
      modeSwitchTop,
      tabStickyTop,
      daySections,
      tabs: buildTabs(daySections.length),
      summaryText: buildSummaryText(guide, daySections)
    })

    // 进入攻略路线详情时，先同步一次“是否已经保存到我的路线”。
    this.syncSavedRouteState(guide)

    // this.updateMapData(daySections, cityInfo, 0)
    this.refreshMapPreview(daySections, 0)
    this.syncCurrentLocation()
  },

  // 页面再次显示时，重新读取本地 savedRoutes，
  // 避免用户从别处返回后，底部按钮状态还是旧的。
  onShow() {
    this.syncSavedRouteState()
  },

  // 根据当前攻略 id，判断这条攻略路线是否已经保存到“我的路线”。
  syncSavedRouteState(guideData) {
    const guide = guideData || this.data.guide
    if (!guide || !guide.id) {
      this.setData({ isRouteSaved: false })
      return
    }

    const savedRoutes = util.loadData('savedRoutes', [])
    const isRouteSaved = savedRoutes.some((item) => {
      return (
        String(item.id) === String(guide.id) ||
        String(item.guideId || '') === String(guide.id)
      )
    })

    this.setData({ isRouteSaved })
  },

  // 刷新详情页地图：包括标记点、折线和当前选中的天数。
  updateMapData(daySections, cityInfo, mapDayIndex) {
    const sections = typeof mapDayIndex === 'number' && mapDayIndex >= 0
      ? [daySections[mapDayIndex]].filter(Boolean)
      : daySections

    const flattened = []
    sections.forEach((day, dayIndex) => {
      ;(day.items || []).forEach((item, itemIndex) => {
        flattened.push({
          ...item,
          dayIndex,
          itemIndex
        })
      })
    })

    const markers = flattened.map((item, index) => {
      return {
        id: index,
        latitude: item.lat || item.latitude,
        longitude: item.lng || item.longitude,
        width: 28,
        height: 28,
        // 攻略详情的查看路线地图模式，也统一只保留数字顺序，
        // 不再显示分类图片，避免和数字标记冲突。
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
          bgColor: '#25BBE7',
          padding: 8,
          borderWidth: 2,
          borderColor: '#FFFFFF',
          // 去掉图片底图后，把数字标签位置贴回点位本身。
          anchorY: 0
        }
      }
    })

    // 不显示直线折线，等待 API 返回真实路线
    const routeColor = mapConfig.THEME_COLORS.drive
    const initialPolyline = []

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

    // 如果有焦点地点，地图中心对准它；否则对准城市中心
    const focusPlace = this.data.mapPreviewPlace
    const mapCenter = focusPlace && (focusPlace.lat !== undefined || focusPlace.latitude !== undefined)
      ? {
          lat: focusPlace.lat !== undefined ? focusPlace.lat : focusPlace.latitude,
          lng: focusPlace.lng !== undefined ? focusPlace.lng : focusPlace.longitude,
        }
      : { lat: cityInfo.lat, lng: cityInfo.lng }
    console.log('focusPlace', focusPlace)
    this.setData({
      mapCenter,
      mapScale: focusPlace ? 14 : 12,
      mapMarkers,
      polyline: initialPolyline,
      currentMapDay: typeof mapDayIndex === 'number' ? mapDayIndex : -1
    })

    // 有 2+ 个地点时才请求真实路线
    if (flattened.length > 1) {
      const qqMapKey = getApp().globalData && getApp().globalData.qqMapKey
      if (!qqMapKey) return

      const allPoints = flattened.map((item) => ({
        latitude: item.lat || item.latitude,
        longitude: item.lng || item.longitude
      }))
      fetchRealRoute({
        allPoints,
        travelMode: 'drive',
        qqMapKey,
        onSuccess: (points) => {
          this.setData({
            polyline: [
              {
                points,
                color: routeColor + 'CC',
                width: 5,
                dottedLine: false,
                arrowLine: true
              }
            ]
          })
        },
        onFallback: () => {
          // 降级时不展示路线
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
        getApp().globalData.location = currentLocation
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

  // 地图自动缩放到当前路线可见范围。
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
    const mapCtx = wx.createMapContext('guideDetailMap', this)
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

  // 地图放大一级：
  // 这里只改缩放级别，不主动改中心点，手感更接近双指缩放。
  onMapZoomIn() {
    const currentScale = Number(this.data.mapScale) || 12
    if (currentScale >= 20) return
    this.setData({
      mapScale: Math.min(currentScale + 1, 20)
    })
  },

  // 地图缩小一级：
  // 这里只改缩放级别，不主动改中心点，手感更接近双指缩放。
  onMapZoomOut() {
    const currentScale = Number(this.data.mapScale) || 12
    if (currentScale <= 3) return
    this.setData({
      mapScale: Math.max(currentScale - 1, 3)
    })
  },

  // 地图区域变化结束后，同步真实中心点。
  // 这样点完缩放按钮后，下一次继续缩放会围绕当前屏幕中心。
  onMapRegionChange(e) {
    if (!e || e.type !== 'end') return

    if (!this._guideDetailMapCtx) {
      this._guideDetailMapCtx = wx.createMapContext('guideDetailMap', this)
    }

    this._guideDetailMapCtx.getCenterLocation({
      success: (res) => {
        if (
          typeof res.latitude !== 'number' ||
          Number.isNaN(res.latitude) ||
          typeof res.longitude !== 'number' ||
          Number.isNaN(res.longitude)
        ) {
          return
        }

        const nextCenter = {
          lat: res.latitude,
          lng: res.longitude
        }
        const currentCenter = this.data.mapCenter || {}
        if (
          Math.abs((currentCenter.lat || 0) - nextCenter.lat) < 0.000001 &&
          Math.abs((currentCenter.lng || 0) - nextCenter.lng) < 0.000001
        ) {
          return
        }

        this.setData({
          mapCenter: nextCenter
        })
      }
    })
  },

  // 刷新地图模式顶部的预览卡片。
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
    // 增加聚焦功能：设置 mapCenter 使地图聚焦到当前预览地点
    if (currentPlace) {
      const lat = currentPlace.lat !== undefined ? currentPlace.lat : currentPlace.latitude
      const lng = currentPlace.lng !== undefined ? currentPlace.lng : currentPlace.longitude
      if (lat !== undefined && lng !== undefined) {
        nextData.mapCenter = { lat, lng }
      }
    }
    this.setData(nextData)
  },

  // 切换当前预览地点。
  changeMapPreview(index) {
    const nextIndex = parseInt(index, 10)
    if (Number.isNaN(nextIndex)) return
    const places = this.data.mapPreviewPlaces || []
    if (!places.length || nextIndex < 0 || nextIndex >= places.length) return
    this.refreshMapPreview(this.data.daySections, nextIndex)
  },

  // 返回上一页
  onBack() {
    wx.navigateBack()
  },

  // 阻止弹窗面板的点击冒泡到遮罩层。
  preventBubble() {},

  // 提示用户使用右上角分享
  onShareTap() {
    wx.showToast({ title: '请点击右上角分享', icon: 'none' })
  },

  // 列表 / 地图 两种查看模式切换
  onSwitchMode(e) {
    const mode = e.currentTarget.dataset.mode
    if (mode === this.data.viewMode) return
    this.setData({ viewMode: mode })
    if (mode === 'map') {
      const mapDayIndex = this.data.currentTab > 0
        ? this.data.currentTab - 1
        : (this.data.daySections.length ? 0 : -1)
      this.setData({ currentMapDay: mapDayIndex })
      this.refreshMapPreview(
        this.data.daySections,
        mapDayIndex >= 0 ? getPreviewIndexByDay(this.data.daySections, mapDayIndex) : this.data.mapPreviewIndex,
        mapDayIndex
      )
      this.updateMapData(this.data.daySections, this.data.cityInfo, mapDayIndex)
    }
  },

  // 底部"路线"按钮：直接切到地图模式
  onOpenMapMode() {
    const mapDayIndex = this.data.currentTab > 0
      ? this.data.currentTab - 1
      : (this.data.daySections.length ? 0 : -1)
    this.setData({ viewMode: 'map', currentMapDay: mapDayIndex })
    this.refreshMapPreview(
      this.data.daySections,
      mapDayIndex >= 0 ? getPreviewIndexByDay(this.data.daySections, mapDayIndex) : this.data.mapPreviewIndex,
      mapDayIndex
    )
    this.updateMapData(this.data.daySections, this.data.cityInfo, mapDayIndex)
  },

  // 把这篇攻略保存成"我的路线"（本地优先 + 后台同步）
  onSaveRoute() {
    const { guide, daySections, summaryText, isRouteSaved } = this.data
    if (isRouteSaved) {
      wx.showToast({ title: '路线已保存，请去我的路线查看', icon: 'none' })
      return
    }

    const routeCard = {
      id: guide.id,
      title: guide.title,
      subtitle: summaryText,
      image: guide.coverImage || '/images/app-logo.jpg',
      author: guide.author || '匿名',
      city: this.data.cityText,
      guideId: guide.id,
      daySections,
      createdAt: Date.now()
    }

    const savedRoutes = util.loadData('savedRoutes', [])
    const exists = savedRoutes.find(item => String(item.id) === String(routeCard.id))
    if (exists) {
      this.setData({ isRouteSaved: true })
      wx.showToast({ title: '路线已保存，请去我的路线查看', icon: 'none' })
      return
    }

    // saveRouteAsync 内部会立即写本地 + 后台推云端
    util.saveRouteAsync(routeCard)

    // 本地已立即写入，直接把按钮切到“已保存路线”状态。
    this.setData({ isRouteSaved: true })
    wx.showToast({ title: '已保存到路线', icon: 'success' })
  },

  // 兼容入口：查看路线时切到地图模式
  onViewRoute() {
    this.onOpenMapMode()
  },

  // 地图模式里切换某一天
  onSelectMapDay(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10)
    this.setData({ currentMapDay: index })
    this.refreshMapPreview(
      this.data.daySections,
      index >= 0 ? getPreviewIndexByDay(this.data.daySections, index) : 0,
      index
    )
    this.updateMapData(this.data.daySections, this.data.cityInfo, index)
  },

  // 地图预览卡片顶部的每天 Tab 切换
  onSelectMapPreviewDay(e) {
    const index = parseInt(
      (e.detail && e.detail.index) !== undefined ? e.detail.index : e.currentTarget.dataset.index,
      10
    )
    this.refreshMapPreview(
      this.data.daySections,
      index >= 0 ? getPreviewIndexByDay(this.data.daySections, index) : this.data.mapPreviewIndex,
      index
    )
    // 用 setTimeout 确保 refreshMapPreview 里的 setData 完成后，updateMapData 能读到最新的 currentMapDay
    setTimeout(() => {
      if (this.data.viewMode === 'map') {
        this.updateMapData(this.data.daySections, this.data.cityInfo, this.data.currentMapDay)
      }
    }, 0)
  },

  // 列表模式顶部 Tab 切换
  onTabTap(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10)
    this.setData(
      {
        currentTab: index,
        sheetScrollTarget: '',
      },
      () => {
        wx.nextTick(() => {
          this.scrollListToTab(index)
        })
      }
    )

    if (this.data.viewMode === 'map') {
      const nextMapDay = index > 0 ? index - 1 : (this.data.daySections.length ? 0 : -1)
      this.setData({ currentMapDay: nextMapDay })
      this.refreshMapPreview(
        this.data.daySections,
        nextMapDay >= 0 ? getPreviewIndexByDay(this.data.daySections, nextMapDay) : this.data.mapPreviewIndex,
        nextMapDay
      )
      this.updateMapData(this.data.daySections, this.data.cityInfo, nextMapDay)
    }
  },

  // 把 rpx 换算成当前设备下的 px，用来保持标题距离吸顶 Tab 固定 48rpx 的留白。
  rpxToPx(rpx) {
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : {}
    const windowWidth = windowInfo.windowWidth || 375
    return (Number(rpx) * windowWidth) / 750
  },

  // 点击“行程总览 / 第几天”时，直接按真实渲染位置滚动，不再依赖固定负锚点。
  scrollListToTab(index) {
    const safeIndex = Number(index) || 0
    const fallbackTarget = safeIndex === 0 ? 'guide-overview-anchor' : `day-anchor-${safeIndex - 1}`
    const targetSelector = safeIndex === 0 ? '#guide-overview-title' : `#guide-day-header-${safeIndex - 1}`
    const query = wx.createSelectorQuery().in(this)
    query.select('.detail-scroll').boundingClientRect()
    query.select('.detail-scroll').scrollOffset()
    query.select('.tab-sticky-wrap').boundingClientRect()
    query.select(targetSelector).boundingClientRect()
    query.exec((result) => {
      const [scrollRect, scrollOffset, stickyRect, targetRect] = result || []
      if (!scrollRect || !scrollOffset || !stickyRect || !targetRect) {
        this.setData({ sheetScrollTarget: fallbackTarget })
        return
      }

      const gapPx = this.rpxToPx(48)
      const nextScrollTop = Math.max(
        0,
        Math.round(
          (scrollOffset.scrollTop || 0) +
          (targetRect.top - scrollRect.top) -
          (stickyRect.height || 0) -
          gapPx
        )
      )

      this.setData({
        detailScrollTop: nextScrollTop,
      })
    })
  },

  // 切换地图预览中的当前地点
  onChangeMapPreview(e) {
    const nextIndex = parseInt(
      (e.detail && e.detail.index) !== undefined ? e.detail.index : e.currentTarget.dataset.index,
      10
    )
    if (Number.isNaN(nextIndex)) return
    const nextDayIndex = getDayIndexByPreview(this.data.daySections, nextIndex)
    // 在 refreshMapPreview 之前保存旧值，因为 setData 会同步更新 this.data
    const oldMapDay = this.data.currentMapDay
    this.refreshMapPreview(this.data.daySections, nextIndex, nextDayIndex)
    // 只有跨天时才重新渲染地图路径，同天内只切换焦点不需要重绘路线
    if (nextDayIndex !== oldMapDay && this.data.viewMode === 'map') {
      setTimeout(() => {
        this.updateMapData(this.data.daySections, this.data.cityInfo, this.data.currentMapDay)
      }, 0)
    }
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

  // 打开某一段交通方式弹窗
  openTransportSheet(dayIndex, itemIndex, previewIndex) {
    const day = (this.data.daySections || [])[dayIndex]
    const item = ((day || {}).items || [])[itemIndex]
    if (!item) return
    this.setData({
      transportSheetVisible: true,
      transportOptions: buildTravelOptions(item.distanceFromPrev || 0),
      pendingTransportMode: item.travelMode || (item.travelMeta && item.travelMeta.mode) || 'drive',
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

  // 确认交通方式，并把结果写回对应地点
  onConfirmTransportMode() {
    const { transportTarget, pendingTransportMode, daySections } = this.data
    if (!transportTarget) return
    const nextSections = (daySections || []).map((day, dayIndex) => ({
      ...day,
      items: (day.items || []).map((item, itemIndex) => {
        if (dayIndex !== transportTarget.dayIndex || itemIndex !== transportTarget.itemIndex) {
          return item
        }
        return decorateGuidePlaceItem(applyTravelMeta(item, pendingTransportMode))
      })
    }))

    this.setData({
      daySections: nextSections,
      transportSheetVisible: false,
      transportTarget: null
    })
    this.refreshMapPreview(nextSections, transportTarget.previewIndex)
  },

  // 点击地点主体：打开地点简介底部弹窗。
  onOpenPlaceIntro(e) {
    const dayIndex = parseInt(e.currentTarget.dataset.dayIndex, 10)
    const itemIndex = parseInt(e.currentTarget.dataset.index, 10)
    const day = (this.data.daySections || [])[dayIndex]
    const item = ((day || {}).items || [])[itemIndex]
    if (!item) return
    this.setData({
      placeIntroVisible: true,
      placeIntroData: buildPlaceIntroSheetData(item, this.data.cityText, '/images/app-logo.jpg')
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
  // 继续复用现有的导航地图选择弹窗，保证交互一致。
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

  // 小程序右上角分享文案
  onShareAppMessage() {
    const { guide } = this.data
    return {
      title: guide ? `${guide.title} · 旅行路线` : '旅行路线',
      path: guide ? `/subpackages/guide/pages/guide-detail/guide-detail?guide=${encodeURIComponent(JSON.stringify(guide))}` : '/pages/index/index'
    }
  }
})
