const util = require('../../utils/util')

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

const MAX_DELETE_OFFSET = -72

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

function syncDaySections(daySections) {
  return stripEditState(daySections).map((day, dayIndex) => ({
    id: day.id || `day-${dayIndex}`,
    title: buildDayLabel(dayIndex + 1),
    countText: `${(day.items || []).length} 个地点`,
    items: (day.items || []).map((item, itemIndex) => ({
      id: item.id || `day-${dayIndex}-item-${itemIndex}`,
      name: item.name || '待补充地点',
      tag: item.tag || '景点',
      image: item.image || DEFAULT_COVERS[(dayIndex + itemIndex) % DEFAULT_COVERS.length],
      travelText: item.travelText || item.desc || '',
      type: item.type || (item.tag === '美食' ? 'food' : 'spot'),
      swipeOffset: 0
    }))
  }))
}

function alignDaySections(daySections, targetCount) {
  const sections = stripEditState(daySections).slice(0, targetCount)
  while (sections.length < targetCount) {
    sections.push({
      id: `day-${Date.now()}-${sections.length}`,
      items: []
    })
  }
  return syncDaySections(sections)
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
    tag: item.tag,
    image: item.image,
    type: item.type
  })))

  return { daySummaries, dayDetails }
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
  return { name: source || '深圳市', lat: 22.5431, lng: 114.0579 }
}

function buildDaySectionsFromLegacy(route) {
  if (route.daySections && route.daySections.length) {
    return syncDaySections(route.daySections)
  }

  const dayDetails = route.dayDetails || []
  return syncDaySections(dayDetails.map((items, dayIndex) => ({
    id: `day-${dayIndex}`,
    items: (items || []).map((item, itemIndex) => ({
      id: item.id || `day-${dayIndex}-item-${itemIndex}`,
      name: item.name,
      tag: item.tag,
      image: item.image,
      travelText: item.travelText || item.desc || '',
      type: item.type || (item.tag === '美食' ? 'food' : 'spot')
    }))
  })))
}

Page({
  data: {
    route: null,
    routeId: '',
    menuTop: 0,
    menuHeight: 32,
    modeSwitchTop: 110,
    viewMode: 'list',
    currentTab: 0,
    currentMapDay: -1,
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
    handleTouchStartY: 0,
    swipeStartX: 0,
    swipeStartY: 0,
    swipeDay: -1,
    swipeIndex: -1,
    swipeStartOffset: 0,
    cityInfo: { name: '深圳市', lat: 22.5431, lng: 114.0579 }
  },

  onLoad(options) {
    const sysInfo = wx.getSystemInfoSync()
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const menuTop = menuButtonInfo ? menuButtonInfo.top : (sysInfo.statusBarHeight || 44) + 4
    const menuHeight = menuButtonInfo ? menuButtonInfo.height : 32
    const modeSwitchTop = menuTop + menuHeight + 24

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
      routeId: String(route.id)
    })
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
    const daySections = buildDaySectionsFromLegacy(route)
    const cityText = route.city || route.cityText || getCityInfo(route.title).name
    const cityInfo = getCityInfo(cityText)
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
      isEditing: false,
      dragging: false,
      dragDay: -1,
      dragIndex: -1,
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
      latitude: cityInfo.lat + ((item.dayIndex * 0.018) - 0.018) + (item.itemIndex * 0.0035),
      longitude: cityInfo.lng + ((item.itemIndex * 0.016) - 0.016) + (item.dayIndex * 0.004),
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
    const selector = index === 0 ? '#route-top-anchor' : `#route-day-section-${index - 1}`
    this.setData({ currentTab: index })

    if (this.data.viewMode === 'map') {
      this.updateMapData(this.data.daySections, this.data.cityInfo, index - 1)
      return
    }

    wx.pageScrollTo({ selector, duration: 280 })
  },

  onEditMeta() {
    const routeForEdit = this.buildUpdatedRoute(this.data.daySections)
    wx.navigateTo({
      url: `/pages/route-basic-edit/route-basic-edit?route=${encodeURIComponent(JSON.stringify(routeForEdit))}`
    })
  },

  onStartRouteEdit() {
    const daySections = this.resetSwipeOffsets(this.data.daySections)
    this.setData({
      isEditing: true,
      viewMode: 'list',
      dragging: false,
      dragDay: -1,
      dragIndex: -1,
      dragTouchStartY: 0,
      swipeDay: -1,
      swipeIndex: -1,
      swipeStartOffset: 0,
      daySections,
      originalDaySections: JSON.parse(JSON.stringify(stripEditState(daySections)))
    })
    wx.showToast({ title: '进入修改路线', icon: 'none' })
  },

  onCancelEdit() {
    const restored = syncDaySections(this.data.originalDaySections || [])
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
      summaryText: buildSummaryText(restored)
    })
    this.updateMapData(restored, this.data.cityInfo, this.data.currentMapDay)
  },

  onSave() {
    const cleanedSections = syncDaySections(this.data.daySections)
    const summaryText = buildSummaryText(cleanedSections)
    const updatedRoute = {
      ...this.buildUpdatedRoute(cleanedSections),
      subtitle: summaryText
    }

    this.saveRouteToStorage(updatedRoute, '保存成功')

    this.setData({
      route: updatedRoute,
      isEditing: false,
      daySections: cleanedSections,
      summaryText,
      tabs: buildTabs(cleanedSections.length),
      originalDaySections: JSON.parse(JSON.stringify(stripEditState(cleanedSections)))
    })
    this.updateMapData(cleanedSections, this.data.cityInfo, this.data.currentMapDay)
  },

  onAddDay() {
    if (!this.data.isEditing) return

    const nextSections = this.data.daySections.slice()
    nextSections.push({ id: `day-${Date.now()}`, items: [] })
    const syncedSections = syncDaySections(nextSections)
    const nextTabIndex = syncedSections.length

    this.setData({
      daySections: syncedSections,
      tabs: buildTabs(syncedSections.length),
      summaryText: buildSummaryText(syncedSections),
      currentTab: nextTabIndex
    })

    setTimeout(() => {
      wx.pageScrollTo({ selector: `#route-day-section-${syncedSections.length - 1}`, duration: 280 })
    }, 60)
  },

  onHandleTouchStart(e) {
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || {}
    this.setData({ handleTouchStartY: touch.clientY || 0 })
  },

  onDragStart(e) {
    if (!this.data.isEditing) return
    const dayIndex = parseInt(e.currentTarget.dataset.dayIndex, 10)
    const index = parseInt(e.currentTarget.dataset.index, 10)

    this.setData({
      dragging: true,
      dragDay: dayIndex,
      dragIndex: index,
      dragTouchStartY: this.data.handleTouchStartY || 0,
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
    const step = Math.round(deltaY / 72)
    if (!step) return

    let targetIndex = this.data.dragIndex + step
    targetIndex = Math.max(0, Math.min(currentItems.length - 1, targetIndex))
    if (targetIndex === this.data.dragIndex) return

    const movingItems = currentItems.slice()
    const moved = movingItems.splice(this.data.dragIndex, 1)[0]
    movingItems.splice(targetIndex, 0, moved)
    daySections[dayIndex] = { ...daySections[dayIndex], items: movingItems }

    this.setData({
      daySections,
      dragIndex: targetIndex,
      dragTouchStartY: currentY,
      summaryText: buildSummaryText(daySections)
    })
  },

  onDragEnd() {
    if (!this.data.dragging) return
    this.setData({ dragging: false, dragDay: -1, dragIndex: -1, dragTouchStartY: 0, handleTouchStartY: 0 })
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
    if (!this.data.isEditing || this.data.dragging) return
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
    if (!this.data.isEditing || this.data.dragging) return
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
    const syncedSections = syncDaySections(daySections)

    this.setData({
      daySections: syncedSections,
      summaryText: buildSummaryText(syncedSections),
      swipeDay: -1,
      swipeIndex: -1,
      swipeStartOffset: 0
    })
    wx.showToast({ title: '已删除地点', icon: 'none' })
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
