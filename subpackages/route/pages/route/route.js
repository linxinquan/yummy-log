// 觅食图 - 路线规划页 v6.0 地图+双模式+Timeline
const app = getApp()
const placesData = require('../../../../utils/placesData')
const util = require('../../../../utils/util')
const checkinUtil = require('../../../../utils/checkinUtil')
const { MODE_CONFIG, applyTravelMeta, buildTravelOptions, formatDurationShort } = require('../../../../utils/travel')
const {
  estimateRouteDuration,
  decorateSelectableItems,
  decorateRouteItems,
  decorateRouteCardItem,
  buildPreviewRouteData,
  getPreviewIndexByDay,
  buildPreviewDaySections,
  flattenDaySections,
} = require('../../../../utils/routeHelper')
const { buildPreviewStateFromRoute } = require('../../utils/routeHelper')

const routeMapBehavior = require('../../utils/route-map-behavior')
const routePreviewBehavior = require('../../utils/route-preview-behavior')
const routeEditBehavior = require('../../utils/route-edit-behavior')
const routeNavBehavior = require('../../utils/route-nav-behavior')
const routePlaceBehavior = require('../../utils/route-place-behavior')


// 只有用户明确点"保存"时，才真正写入 savedRoutes（同时同步云端）。
async function savePreviewRouteData(data, options = {}) {
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
  // 同步云端
  try {
    if (index >= 0 && savedRoute._id) {
      await util.updateRouteAsync(savedRoute._id, savedRoute)
    } else {
      await util.saveRouteAsync(savedRoute)
    }
  } catch (err) {
    console.warn('[route.js] 云端同步失败（已保留本地数据）:', err)
  }
  return savedRoute
}

// 把"当前所在位置"和真实定位地址拼成统一显示文案。
// 有地址时显示：当前所在位置（深圳市南山区xxx）
// 没地址时只显示：当前所在位置
function buildCurrentLocationDisplayName(address = '') {
  const safeAddress = String(address || '').trim()
  return safeAddress ? `当前所在位置（${safeAddress}）` : '当前所在位置'
}

Page({
  behaviors: [routeMapBehavior, routePreviewBehavior, routeEditBehavior, routeNavBehavior, routePlaceBehavior],
  data: {
    // 起点默认使用"当前所在位置"，统一页面里的起点文案。
    currentStart: { name: '当前所在位置', lat: 22.5431, lng: 114.0579, type: 'current' },

    // 出行方式
    travelMode: 'drive',

    // 当前定位
    currentLocation: null,
    viewMode: 'list',
    modeSwitchTop: 44,
    // ★ 主数据：按天分组的路线（嵌套结构）
    daySections: [],
    // 派生数据：扁平数组，用于兼容现有逻辑
    routeShops: [],
    // 列表/预览模式：底部 Tab 选中索引（0=行程总览，1=第1天，2=第2天...）
    currentTab: 0,
    // 地图模式：当前高亮显示第几天的路线（-1=未确定，0=第1天，1=第2天...）
    currentMapDay: -1,
    sheetScrollTarget: '',
    cityText: '深圳市',
    previewRouteId: '',
    hasUnsavedPreview: false,
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
    pendingTransportMode: 'drive',
    transportTargetIndex: -1,
    transportTarget: null,
    exitConfirmVisible: false,

    // 地图相关数据
    mapCenter: { lat: 22.4846, lng: 113.9046 },
    markers: [],
    polyline: [],

    // ★ 自选计数 & 全选状态
    selectedCount: 0,
    isAllSelected: false,

    // 路线
    routeShops: [],
    totalDistance: '0m',
    totalTime: '0分钟',
    isMixedRoute: false,
    
    // 每天起点：dayStartPoints[dayIndex] = { lat, lng, name }
    dayStartPoints: [],
    // 每天起点的显示文本
    dayStartPointTexts: [],
    // 设置起点弹窗
    showDayStartSheet: false,
    dayStartSheetDayIndex: -1,
    dayStartOptions: [],

    // 导览
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
    // ids=1,2,3 参数
    const { ids, dayCount } = options
    const routeType = 'mixed'
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

  // 把当前位置补成"当前所在位置（真实地址）"：
  // 这里只在仍然使用当前定位作为起点时更新，避免覆盖用户手动选的其他起点。
  syncCurrentStartAddress(location) {
    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') return

    // 真正写回页面数据的公共收口，成功和失败都走这里，避免两套分支不一致。
    const applyDisplayName = (displayName) => {
      const currentLocationWithAddress = {
        ...location,
        name: displayName
      }
      const nextData = {
        currentStart: {
          ...this.data.currentStart,
          ...currentLocationWithAddress,
          name: displayName,
          type: 'current'
        }
      }

      // 全局定位对象也同步更新成带地址的版本：
      // 这样后面无论是路线重排，还是第二天以后再次点"使用当前所在位置"，
      // 取到的都会是"当前所在位置（真实地址）"这份最新文案。
      app.globalData.location = {
        ...(app.globalData.location || {}),
        ...currentLocationWithAddress
      }

      const dayStartPointTexts = [...(this.data.dayStartPointTexts || [])]
      // 只有第一天当前仍是"当前所在位置"体系时，才自动更新显示文案。
      // 这样不会把用户已经手动选好的第 1 天起点覆盖掉。
      if (!dayStartPointTexts[0] || /^当前所在位置/.test(dayStartPointTexts[0])) {
        dayStartPointTexts[0] = displayName
        nextData.dayStartPointTexts = dayStartPointTexts
      }

      this.setData(nextData, () => {
        // 地址文案更新后，同步刷新分天结构里的起点显示。
        if (this.data.daySections && this.data.daySections.length) {
          this._updateDayStartPointTexts()
        }
      })
    }

    checkinUtil.reverseGeocode(location.lat, location.lng)
      .then((geo) => {
        // 优先使用逆地理返回的完整地址，没有时再退回更简短的地点名或行政区。
        const resolvedAddress = geo.address || geo.spotName || geo.district || ''
        applyDisplayName(buildCurrentLocationDisplayName(resolvedAddress))
      })
      .catch(() => {
        // 逆地理失败时仍保留基础文案，避免页面出现空白起点。
        applyDisplayName(buildCurrentLocationDisplayName(''))
      })
  },

  // 获取当前位置，作为路线起点。
  getCurrentLocation() {
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      success: (res) => {
        // 先写入基础文案"当前所在位置"，真实地址异步补齐到括号里。
        const location = { lat: res.latitude, lng: res.longitude, name: '当前所在位置' }
        app.globalData.location = location
        this.setData({ currentLocation: location })
        if (this.data.currentStart.type === 'current') {
          this.setData({ currentStart: { ...this.data.currentStart, ...location } })
          // 定位成功后，继续把真实地址补进"当前所在位置（地址）"。
          this.syncCurrentStartAddress(location)
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
    // 清除路线缓存
    this._routeCache = {}
    const { presetIds, selectMode } = this.data

    // 确定要加载的ID列表
    let likedIds = []
    if (presetIds && presetIds.length > 0) {
      // 从想去清单页面传入的ID（按用户拖拽排序）
      likedIds = presetIds
    } else {
      // 新格式：从 userWantList 获取所有想去 ID（不再区分类型）
      likedIds = util.getWantList()
    }

    // 获取对应的数据源（统一使用 mixed 模式：美食+景点）
    // 使用 getAllPlaces() 获取所有地点，并补充用户自己添加的店铺
    const userAddedShops = util.loadData('userAddedShops', [])
    let allItems = [...placesData.getAllPlaces(), ...userAddedShops];
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
      const daySections = this._planRouteByDays(rawItems, presetIds ? true : false)
      const routeShops = flattenDaySections(daySections)
      routeShops.forEach((s, i) => {
        const hit = allLikedShops.find(a => a.id === s.id)
        if (hit) hit.orderNum = i + 1
      })
    this.setData({
      allLikedShops,
      daySections,
      routeShops,
      rawItems,
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
      const daySections = this._planRouteByDays(selectedShops)
      const routeShops = flattenDaySections(daySections)
      allLikedShops.forEach(s => { s.orderNum = '' })
      routeShops.forEach((s, i) => {
        const hit = allLikedShops.find(a => a.id === s.id)
        if (hit) hit.orderNum = i + 1
      })

      this.setData({
        allLikedShops,
        daySections,
        routeShops,
        rawItems,
        selectedCount: selectedShops.length,
        isAllSelected: selectedShops.length === allLikedShops.length
      })
      this.refreshPreviewRoute(routeShops)
    }

    // 只在地图模式或导航模式下才更新地图，列表模式不需要
    const { viewMode, isNavigating } = this.data
    if (viewMode === 'map' || isNavigating) {
      this.updateMap()
    }
  },

  // 对地点做路径规划（按天独立规划），并补上距离、时间、总里程这些信息。
  // 每天使用当天的起点独立调用 planRoute，然后合并结果。
  // 返回 daySections（嵌套结构），调用方需要通过 flattenDaySections() 派生 routeShops。
  _planRouteByDays(shops, preserveOrder = false) {
    if (shops.length === 0) return []

    const { preferredDayCount, dayStartPoints, currentStart } = this.data
    
    // 保存当前 routeShops 中每项的逐段交通方式，重规划后恢复
    const prevTravelModeMap = {}
    if (this.data.routeShops && this.data.routeShops.length > 0) {
      this.data.routeShops.forEach(item => {
        const mode = (item.travelMeta && item.travelMeta.mode) || item.travelMode
        if (mode) prevTravelModeMap[item.id] = mode
      })
    }
    
    // 先按天分组（使用当前的 daySections 分组逻辑）
    const daySections = buildPreviewDaySections(shops, preferredDayCount)
    
    // 对每一天独立规划路线
    let totalDist = 0
    
    const decoratedDaySections = daySections.map((daySection, dayIndex) => {
      // 确定当天的起点
      let dayStartPoint = null
      if (dayIndex === 0) {
        // 第1天：优先使用 currentStart。
        // 这里不能再优先拿 app.globalData.location，
        // 否则可能会把已经补好真实地址的文案又降回"当前所在位置"。
        dayStartPoint = currentStart.type === 'current' 
          ? (currentStart || app.globalData.location || app.globalData.centerLocation)
          : currentStart
      } else {
        // 第2天及以后：使用设置的起点，或默认前一天最后一个地点
        const customStart = dayStartPoints[dayIndex]
        if (customStart) {
          dayStartPoint = customStart
        } else {
          // 默认：前一天最后一个地点
          const prevDaySection = daySections[dayIndex - 1]
          const prevDayItems = prevDaySection ? (prevDaySection.items || []) : []
          const prevDayLastShop = prevDayItems.length > 0 ? prevDayItems[prevDayItems.length - 1] : null
          dayStartPoint = prevDayLastShop 
            ? { lat: prevDayLastShop.lat || prevDayLastShop.latitude, lng: prevDayLastShop.lng || prevDayLastShop.longitude, name: prevDayLastShop.name }
            : (app.globalData.location || app.globalData.centerLocation || currentStart)
        }
      }
      
      // 对当天的地点做路径规划
      const dayShops = util.planRoute(daySection.items, dayStartPoint, preserveOrder)
      if (dayShops.length > 0) {
        dayShops[0].isFirst = true
        dayShops[0].dayIndex = dayIndex
        dayShops[0].dayStartPoint = dayStartPoint
      }
      
      // 标记每个地点属于第几天，并恢复之前设置的逐段交通方式
      const decoratedDayShops = dayShops.map(s => {
        s.dayIndex = dayIndex
        if (prevTravelModeMap[s.id]) {
          s.travelMode = prevTravelModeMap[s.id]
        }
        return s
      })

      // 累加总距离
      decoratedDayShops.forEach(s => { totalDist += s.distanceFromPrev || 0 })

      // 返回当天的 section（嵌套结构）
      return {
        ...daySection,
        startPoint: dayStartPoint,
        startPointText: dayIndex === 0 ? '当前所在位置' : '',
        items: decorateRouteItems(decoratedDayShops)
      }
    })

    this.setData({
      totalDistance: util.formatDistance(totalDist)
    })

    // 计算总时间
    let totalMinutes = 0
    decoratedDaySections.forEach(day => {
      (day.items || []).forEach(item => {
        const modeKey = (item.travelMeta && item.travelMeta.mode) || item.travelMode
        const modeConfig = MODE_CONFIG[modeKey] || MODE_CONFIG.drive
        totalMinutes += (Math.max(0, item.distanceFromPrev || 0) / 1000) * modeConfig.minutesPerKm
      })
    })

    this.setData({
      totalTime: formatDurationShort(totalMinutes)
    })

    return decoratedDaySections
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

    const daySections = this._planRouteByDays(selectedShops)
    const routeShops = flattenDaySections(daySections)
    const updated = allLikedShops.map(s => ({ ...s, orderNum: '' }))
    routeShops.forEach((s, i) => {
      const hit = updated.find(a => a.id === s.id)
      if (hit) hit.orderNum = i + 1
    })

    this.setData({ allLikedShops: updated, daySections, routeShops })
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
      const daySections = this._planRouteByDays(updated)
      const routeShops = flattenDaySections(daySections)
      const withOrder = updated.map(s => ({ ...s, orderNum: '' }))
      routeShops.forEach((s, i) => {
        const hit = withOrder.find(a => a.id === s.id)
        if (hit) hit.orderNum = i + 1
      })
      this.setData({ allLikedShops: withOrder, daySections, routeShops })
      this.refreshPreviewRoute(routeShops)
    } else {
      this.setData({ daySections: [], routeShops: [], totalDistance: '0m', totalTime: '0分钟' })
      this.refreshPreviewRoute([])
    }

    this.updateMap()
  },

  // 切换整条路线的默认交通方式。
  onSelectMode(e) {
    const mode = e.currentTarget.dataset.mode
    console.log('[onSelectMode] 切换到模式:', mode, '当前 travelMode:', this.data.travelMode)
    const routeShops = decorateRouteItems(flattenDaySections(this.data.daySections), mode)
    this.setData({ travelMode: mode, routeShops })
    console.log('[onSelectMode] setData 后 travelMode:', this.data.travelMode)
    this.refreshPreviewRoute(routeShops)
    let totalDist = 0
    routeShops.forEach(s => { totalDist += s.distanceFromPrev || 0 })
    this.setData({ totalTime: estimateRouteDuration(totalDist, mode) })
    console.log('[onSelectMode] 完成，准备调用 updateMap')
    this.updateMap()
  },

  // 打开某一段交通方式弹窗。
  openTransportSheet(dayIndex, itemIndex, previewIndex) {
    const day = (this.data.daySections || [])[dayIndex]
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
    console.log('[route] onOpenPlaceTransportSheet, dataset:', e.currentTarget.dataset)
    const dayIndex = parseInt(e.currentTarget.dataset.dayIndex, 10)
    const itemIndex = parseInt(e.currentTarget.dataset.index, 10)
    this.openTransportSheet(dayIndex, itemIndex, getPreviewIndexByDay(this.data.daySections, dayIndex) + itemIndex)
  },

  // 地图模式里点击交通方式入口
  onOpenMapTransportSheet() {
    console.log('[route] onOpenMapTransportSheet')
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
    console.log('[route] onSelectTransportMode, mode:', mode)
    if (!mode) return
    this.setData({ pendingTransportMode: mode })
  },

  // 确认交通方式后，把结果写回对应地点
  onConfirmTransportMode() {
    console.log('[route] onConfirmTransportMode 开始')
    const { transportTarget, transportTargetIndex, pendingTransportMode, daySections, currentNavIndex, isNavigating } = this.data
    console.log('[route] transportTarget:', transportTarget, 'transportTargetIndex:', transportTargetIndex, 'pendingTransportMode:', pendingTransportMode)
    if (!transportTarget || transportTargetIndex < 0) {
      console.log('[route] onConfirmTransportMode 提前返回')
      return
    }

    // 根据 transportTarget 中的 dayIndex 和 itemIndex 找到对应地点并修改
    const { dayIndex, itemIndex } = transportTarget
    const nextDaySections = daySections.map((day, dIdx) => {
      if (dIdx !== dayIndex) return day
      return {
        ...day,
        items: day.items.map((item, iIdx) => {
          if (iIdx !== itemIndex) return item
          return decorateRouteCardItem(applyTravelMeta(item, pendingTransportMode))
        })
      }
    })

    // 重新计算 routeShops
    const nextRouteShops = flattenDaySections(nextDaySections)

    const nextData = {
      daySections: nextDaySections,
      routeShops: nextRouteShops,
      transportSheetVisible: false,
      transportTargetIndex: -1,
      transportTarget: null
      // 不再覆盖全局 travelMode，每段独立维护自己的交通方式
    }
    if (isNavigating && currentNavIndex === transportTargetIndex) {
      nextData.currentNavShop = nextRouteShops[transportTargetIndex]
    }
    console.log('[route] onConfirmTransportMode 准备 setData, travelMode:', pendingTransportMode)
    this.setData(nextData)
    this.refreshPreviewRoute(nextRouteShops, { markDirty: true })
    if (this.data.viewMode === 'map' || isNavigating) {
      this.focusPreviewByIndex(this.data.mapPreviewIndex)
    }
    console.log('[route] onConfirmTransportMode 完成')
  },

  // 重新定位当前位置，并刷新路线起点。
  onLocateMe() {
    wx.showLoading({ title: '定位中...' })
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      success: (res) => {
        wx.hideLoading()
        // 重新定位后也先使用基础文案，再异步补齐真实地址。
        const location = { lat: res.latitude, lng: res.longitude, name: '当前所在位置' }
        app.globalData.location = location
        this.setData({ currentLocation: location })
        if (this.data.currentStart.type === 'current') {
          this.setData({ currentStart: { ...this.data.currentStart, ...location } })
          // 重新定位后同步刷新"当前所在位置（地址）"的显示。
          this.syncCurrentStartAddress(location)
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
        : (this.data.daySections.length ? 0 : -1)
      this.setData({ currentMapDay: mapDayIndex })
      this.focusPreviewByIndex(mapDayIndex >= 0 ? getPreviewIndexByDay(this.data.daySections, mapDayIndex) : 0, mapDayIndex >= 0 ? mapDayIndex : undefined)
      this.updateMap()
    }
  },

  // 切换"行程总览 / 第一天 / 第二天..."
  onTabTap(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10)
    const sheetScrollTarget = index === 0 ? 'route-overview-anchor' : `route-day-anchor-${index - 1}`
    this.setData({ currentTab: index, sheetScrollTarget })
    if (this.data.viewMode === 'map') {
      const mapDayIndex = index > 0 ? index - 1 : (this.data.daySections.length ? 0 : -1)
      this.setData({ currentMapDay: mapDayIndex })
      this.focusPreviewByIndex(mapDayIndex >= 0 ? getPreviewIndexByDay(this.data.daySections, mapDayIndex) : 0, mapDayIndex >= 0 ? mapDayIndex : undefined)
    }
  },

  // 把当前路线保存到"我的路线"
  async onSaveToMyRoute() {
    const savedRoute = await savePreviewRouteData(this.data)
    if (!savedRoute) return
    this.setData({
      previewRouteId: savedRoute.id,
      hasUnsavedPreview: false
    })
    wx.showToast({ title: '已保存到路线', icon: 'success' })
  },

  // 保存当前规划路线并退出页面。
  async saveAndExit() {
    const savedRoute = await savePreviewRouteData(this.data)
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

  // 底部"路线"按钮：切到地图模式
  onViewRoute() {
    const mapDayIndex = this.data.currentTab > 0
      ? this.data.currentTab - 1
      : (this.data.daySections.length ? 0 : -1)
    this.setData({ viewMode: 'map', currentMapDay: mapDayIndex })
    this.focusPreviewByIndex(mapDayIndex >= 0 ? getPreviewIndexByDay(this.data.daySections, mapDayIndex) : 0, mapDayIndex >= 0 ? mapDayIndex : undefined)
    this.updateMap()
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
  },

  // 设置某天的起点
  onSetDayStart(e) {
    const dayIndex = e.currentTarget.dataset.dayIndex
    if (dayIndex === undefined || dayIndex < 0) return

    // 起点选择改成页面内底部弹窗，沿用现有弹窗交互，不再使用微信原生 ActionSheet。
    const options = [{
      type: 'current',
      icon: 'mgc_aiming_2_line',
        label: '使用当前所在位置'
    }]
    // 如果当天有地点，增加"使用当天第一个地点"选项
    const day = (this.data.daySections || [])[dayIndex]
    const dayHasItems = day && day.items && day.items.length > 0
    if (dayHasItems) {
      options.push({
        type: 'firstPlace',
        icon: 'mgc_map_pin_line',
        label: '使用第一个地点'
      })
    }
    if (dayIndex > 0) {
      options.push({
        type: 'prev',
        icon: 'mgc_route_line',
        label: '使用前一天终点'
      })
    }
    options.push({
      type: 'search',
      icon: 'mgc_search_2_line',
      label: '搜索地点'
    })

    this.setData({
      showDayStartSheet: true,
      dayStartSheetDayIndex: dayIndex,
      dayStartOptions: options
    })
  },

  // 关闭起点选择底部弹窗，同时清空临时选项，避免下次打开沿用旧数据。
  onCloseDayStartSheet() {
    this.setData({
      showDayStartSheet: false,
      dayStartSheetDayIndex: -1,
      dayStartOptions: []
    })
  },

  // 点击起点弹窗里的某个选项后立即执行，对齐当前页面其他"点选即确认"的弹窗规则。
  onSelectDayStartOption(e) {
    const type = e.currentTarget.dataset.type
    const dayIndex = this.data.dayStartSheetDayIndex
    if (!type || dayIndex < 0) return

    this.onCloseDayStartSheet()

    if (type === 'current') {
      this._setDayStartToCurrent(dayIndex)
      return
    }
    if (type === 'prev') {
      this._setDayStartToPrevDayEnd(dayIndex)
      return
    }
    if (type === 'firstPlace') {
      this._setDayStartToFirstPlace(dayIndex)
      return
    }
    if (type === 'search') {
      this._searchDayStartPoint(dayIndex)
    }
  },

  // 路线规划弹窗改成"点选项即确认"：
  // 用户直接点"智能规划"或"手动编辑"就立刻执行，不再需要底部确认按钮。
  onConfirmReorderOption(e) {
    const mode = e.currentTarget.dataset.mode
    if (!mode) return
    if (mode === 'manual') {
      const previewRoute = buildPreviewRouteData(this.data, { isDraft: true })
      if (!previewRoute) return
      this.setData({
        reorderSheetVisible: false,
        previewRouteId: previewRoute.id,
        hasUnsavedPreview: true
      })
      wx.navigateTo({
        url: `/subpackages/route/pages/my-route/my-route?route=${encodeURIComponent(JSON.stringify(previewRoute))}&edit=1&create=1&fromPreview=1`,
        events: {
          // 监听 my-route 页面发送的 previewRouteEdited 事件
          'previewRouteEdited': (updatedRoute) => {
            if (!updatedRoute) return
            const newState = buildPreviewStateFromRoute(updatedRoute, this.data.currentStart)
            this.setData(newState)
            this.updateMap()
            if (updatedRoute.daySections && updatedRoute.daySections.length) {
              this.focusPreviewByIndex(0, -1)
            }
          }
        },
        fail: (err) => {
          console.error('导航失败:', err)
          wx.showToast({ title: '页面跳转失败', icon: 'none' })
        }
      })
      return
    }

    this.onOptimizeRoute()
  },
  // 设置起点为当前位置
  _setDayStartToCurrent(dayIndex) {
    const currentStart = this.data.currentStart
    const startPoint = currentStart.type === 'current' 
      // 这里优先使用 currentStart，确保第二天以后也能拿到带括号地址的最新文案。
      ? (currentStart || app.globalData.location || app.globalData.centerLocation)
      : currentStart

    const dayStartPoints = [...this.data.dayStartPoints]
    dayStartPoints[dayIndex] = {
      lat: startPoint.lat,
      lng: startPoint.lng,
      // 如果当前定位名称不存在，兜底成统一文案"当前所在位置"。
      name: startPoint.name || '当前所在位置'
    }

    const dayStartPointTexts = [...this.data.dayStartPointTexts]
    // 第一天下方地址和按钮状态都基于这里的文字，所以这里也统一成"当前所在位置"。
    dayStartPointTexts[dayIndex] = startPoint.name || '当前所在位置'

    this.setData({
      dayStartPoints,
      dayStartPointTexts
    })

    // 更新 daySections 中的 startPointText
    this._updateDayStartPointTexts()

    // 重新规划路线
    this._replanRoute()
  },

  // 设置起点为前一天最后一个地点
  _setDayStartToPrevDayEnd(dayIndex) {
    const daySections = this.data.daySections
    if (!daySections || dayIndex <= 0 || dayIndex >= daySections.length) return

    const prevDaySection = daySections[dayIndex - 1]
    const prevDayLastShop = prevDaySection.items[prevDaySection.items.length - 1]
    if (!prevDayLastShop) return

    const startPoint = {
      lat: prevDayLastShop.lat || prevDayLastShop.latitude,
      lng: prevDayLastShop.lng || prevDayLastShop.longitude,
      name: prevDayLastShop.name
    }

    const dayStartPoints = [...this.data.dayStartPoints]
    dayStartPoints[dayIndex] = startPoint

    const dayStartPointTexts = [...this.data.dayStartPointTexts]
    dayStartPointTexts[dayIndex] = prevDayLastShop.name

    this.setData({
      dayStartPoints,
      dayStartPointTexts
    })

    // 更新 daySections 中的 startPointText
    this._updateDayStartPointTexts()

    // 重新规划路线
    this._replanRoute()
  },

  // 设置起点为当天第一个地点
  _setDayStartToFirstPlace(dayIndex) {
    const daySections = this.data.daySections
    if (!daySections || dayIndex < 0 || dayIndex >= daySections.length) return

    const day = daySections[dayIndex]
    const firstItem = day && day.items && day.items[0]
    if (!firstItem) return

    const startPoint = {
      lat: firstItem.lat || firstItem.latitude,
      lng: firstItem.lng || firstItem.longitude,
      name: firstItem.name
    }

    const dayStartPoints = [...this.data.dayStartPoints]
    dayStartPoints[dayIndex] = startPoint

    const dayStartPointTexts = [...this.data.dayStartPointTexts]
    dayStartPointTexts[dayIndex] = firstItem.name

    this.setData({
      dayStartPoints,
      dayStartPointTexts
    })

    // 更新 daySections 中的 startPointText
    this._updateDayStartPointTexts()

    // 重新规划路线
    this._replanRoute()
  },

  // 搜索地点作为起点
  _searchDayStartPoint(dayIndex) {
    wx.chooseLocation({
      success: (res) => {
        const startPoint = {
          lat: res.latitude,
          lng: res.longitude,
          name: res.name || '选中的地点'
        }

        const dayStartPoints = [...this.data.dayStartPoints]
        dayStartPoints[dayIndex] = startPoint

        const dayStartPointTexts = [...this.data.dayStartPointTexts]
        dayStartPointTexts[dayIndex] = res.name || '选中的地点'

        this.setData({
          dayStartPoints,
          dayStartPointTexts
        })

        // 更新 daySections 中的 startPointText
        this._updateDayStartPointTexts()

        // 重新规划路线
        this._replanRoute()
      },
      fail: () => {
        wx.showToast({ title: '已取消', icon: 'none' })
      }
    })
  },

  // 更新 daySections 中的 startPointText
  _updateDayStartPointTexts() {
    const { daySections, dayStartPointTexts } = this.data
    if (!daySections || !daySections.length) return

    const updatedSections = daySections.map((section, dayIndex) => {
      // 第一天默认直接显示"当前所在位置"；
      // 第二天及以后如果还没选，就保持空值，让模板走"选择起点"的未选择状态。
      const defaultText = dayIndex === 0 ? '当前所在位置' : ''
      return {
        ...section,
        startPointText: dayStartPointTexts[dayIndex] || defaultText
      }
    })

    this.setData({
      daySections: updatedSections
    })
  },

  // 重新规划路线（使用当前的 dayStartPoints）
  _replanRoute() {
    const { selectMode, rawItems, presetIds } = this.data
    
    if (selectMode === 'all') {
      const daySections = this._planRouteByDays(rawItems, presetIds ? true : false)
      const routeShops = flattenDaySections(daySections)
      // 更新 orderNum
      const allLikedShops = this.data.allLikedShops
      allLikedShops.forEach(s => { s.orderNum = '' })
      routeShops.forEach((s, i) => {
        const hit = allLikedShops.find(a => a.id === s.id)
        if (hit) hit.orderNum = i + 1
      })
      this.setData({
        daySections,
        routeShops,
        allLikedShops: [...allLikedShops]
      })
      this.refreshPreviewRoute(routeShops)
    } else {
      const allLikedShops = this.data.allLikedShops
      const selectedShops = allLikedShops.filter(s => s.selected)
      const daySections = this._planRouteByDays(selectedShops)
      const routeShops = flattenDaySections(daySections)
      allLikedShops.forEach(s => { s.orderNum = '' })
      routeShops.forEach((s, i) => {
        const hit = allLikedShops.find(a => a.id === s.id)
        if (hit) hit.orderNum = i + 1
      })
      this.setData({
        daySections,
        routeShops,
        allLikedShops: [...allLikedShops]
      })
      this.refreshPreviewRoute(routeShops)
    }

    // 如果在地图模式，更新地图
    const { viewMode, isNavigating } = this.data
    if (viewMode === 'map' || isNavigating) {
      this.updateMap()
    }
  }
})
