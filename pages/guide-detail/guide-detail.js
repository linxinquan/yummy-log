const util = require('../../utils/util')
const { shops, shopNameMap } = require('../../utils/shopData')
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

function parseDayCount(duration) {
  const matched = String(duration || '').match(/(\d+)/)
  if (!matched) return 1
  return Math.max(parseInt(matched[1], 10) || 1, 1)
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
  let mode = 'walk'
  let label = '步行'
  let minutesPerKm = 12

  if (safeDistance >= 10000) {
    mode = 'drive'
    label = '打车'
    minutesPerKm = 3
  } else if (safeDistance >= 3500) {
    mode = 'transit'
    label = '地铁'
    minutesPerKm = 5
  } else if (safeDistance >= 900) {
    mode = 'bike'
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

function buildCoverPool(guide) {
  return [...new Set([guide.coverImage].concat(DEFAULT_COVERS).filter(Boolean))]
}

function getCityInfo(guide) {
  const source = [guide.title || '', (guide.tags || []).join(' ')].join(' ')
  for (let i = 0; i < CITY_PRESETS.length; i += 1) {
    if (CITY_PRESETS[i].match.test(source)) {
      return CITY_PRESETS[i]
    }
  }
  return { name: '深圳市', lat: 22.5431, lng: 114.0579 }
}

function inferTag(name) {
  if (/博物馆|展馆|美术馆/.test(name)) return '文化展馆'
  if (/演出|剧场|音乐会/.test(name)) return '演出'
  if (/商场|购物中心|步行街/.test(name)) return '购物'
  if (/店|馆|面|饭|咖啡|茶|酒|餐|小吃|甜品|火锅|奶茶|烧烤|糖水|包|饼|馍/.test(name)) return '美食'
  return '景点'
}

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
        image: item.image || matched?.image || matched?.logo || DEFAULT_COVERS[(dayIndex + itemIndex) % DEFAULT_COVERS.length],
        type: item.type || matched?.type || (tag === '美食' ? 'food' : 'spot'),
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
      items: plannedItems.map((item, itemIndex) => ({
        ...item,
        travelText: buildTravelMeta(item.distanceFromPrev || 0),
        image: item.image || DEFAULT_COVERS[(dayIndex + itemIndex) % DEFAULT_COVERS.length]
      }))
    }
  })
}

function buildSummaryText(guide, daySections) {
  const dayCount = daySections.length
  const nightCount = Math.max(dayCount - 1, 0)
  const placeCount = daySections.reduce((sum, day) => sum + day.items.length, 0)
  return `${dayCount} 天 ${nightCount} 晚 · ${placeCount} 个地点`
}

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
        image: covers[(cursor + itemIndex) % covers.length],
        type: tag === '美食' ? 'food' : 'spot'
      }
    })
    sections.push({ id: `day-${dayIndex}`, items })
    cursor += takeCount
  }

  return sections
}

function buildDaySections(guide, cityInfo) {
  const covers = buildCoverPool(guide)
  const content = [guide.title || '', (guide.tags || []).join(' '), (guide.desc || '')].join(' ')
  if (/西安|长安/.test(content)) {
    return syncDaySections(buildXianSections(covers), cityInfo)
  }
  return syncDaySections(buildGenericSections(guide, covers), cityInfo)
}

function buildLegacyRouteData(daySections) {
  const daySummaries = daySections.map((day, index) => ({
    location: '',
    route: (day.items || []).map(item => item.name).join(' --- '),
    image: (day.items && day.items[0] && day.items[0].image) || DEFAULT_COVERS[index % DEFAULT_COVERS.length]
  }))

  const dayDetails = daySections.map(day => (day.items || []).map(item => ({
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
    sheetScrollTarget: '',
    cityText: '深圳市',
    summaryText: '',
    daySections: [],
    tabs: [],
    mapCenter: { lat: 22.5431, lng: 114.0579 },
    mapMarkers: [],
    polyline: [],
    isEditing: false,
    dragging: false,
    dragDay: -1,
    dragIndex: -1,
    dragTouchStartY: 0
  },

  onLoad(options) {
    const sysInfo = wx.getSystemInfoSync()
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const menuTop = menuButtonInfo ? menuButtonInfo.top : (sysInfo.statusBarHeight || 44) + 4
    const menuHeight = menuButtonInfo ? menuButtonInfo.height : 32
    const modeSwitchTop = menuTop
    const tabStickyTop = menuTop + menuHeight + 24

    if (!options.guide) {
      wx.showToast({ title: '攻略不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack({ delta: 1 }), 1200)
      return
    }

    const guide = JSON.parse(decodeURIComponent(options.guide))
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

    this.updateMapData(daySections, cityInfo, -1)
  },

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
    const mode = e.currentTarget.dataset.mode
    if (mode === this.data.viewMode) return
    this.setData({ viewMode: mode })
    if (mode === 'map') {
      const mapDayIndex = this.data.currentTab > 0 ? this.data.currentTab - 1 : -1
      this.updateMapData(this.data.daySections, this.data.cityInfo, mapDayIndex)
    }
  },

  onOpenMapMode() {
    this.setData({ viewMode: 'map' })
    const mapDayIndex = this.data.currentTab > 0 ? this.data.currentTab - 1 : -1
    this.updateMapData(this.data.daySections, this.data.cityInfo, mapDayIndex)
  },

  onAddToMyRoute() {
    const { guide, daySections, summaryText } = this.data
    const { daySummaries, dayDetails } = buildLegacyRouteData(daySections)
    const routeCard = {
      id: guide.id,
      title: guide.title,
      subtitle: summaryText,
      image: guide.coverImage || daySummaries[0]?.image || DEFAULT_COVERS[0],
      author: guide.author || '匿名',
      city: this.data.cityText,
      guideId: guide.id,
      daySections,
      daySummaries,
      dayDetails,
      createdAt: Date.now()
    }

    const savedRoutes = util.loadData('savedRoutes', [])
    const exists = savedRoutes.find(item => String(item.id) === String(routeCard.id))
    if (exists) {
      wx.showToast({ title: '已在我的路线中', icon: 'none' })
      return
    }

    savedRoutes.push(routeCard)
    wx.setStorageSync('savedRoutes', savedRoutes)
    wx.showToast({ title: '已添加到我的路线', icon: 'success' })
  },

  onSelectMapDay(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10)
    this.updateMapData(this.data.daySections, this.data.cityInfo, index)
  },

  onTabTap(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10)
    const sheetScrollTarget = index === 0 ? 'guide-scroll-top' : `day-anchor-${index - 1}`
    this.setData({ currentTab: index, sheetScrollTarget })

    if (this.data.viewMode === 'map') {
      this.updateMapData(this.data.daySections, this.data.cityInfo, index - 1)
    }
  },

  onShareAppMessage() {
    const { guide } = this.data
    return {
      title: guide ? `${guide.title} · 旅行路线` : '旅行路线',
      path: guide ? `/pages/guide-detail/guide-detail?guide=${encodeURIComponent(JSON.stringify(guide))}` : '/pages/index/index'
    }
  }
})
