// 觅食图 - 路线规划页 v6.0 地图+双模式+Timeline
const app = getApp()
const placesData = require('../../../../utils/placesData')
const util = require('../../../../utils/util')
const { MODE_CONFIG, applyTravelMeta, buildTravelOptions, formatDurationShort } = require('../../../../utils/travel')
const {
  estimateRouteDuration,
  decorateSelectableItems,
  decorateRouteItems,
  decorateRouteCardItem,
  buildPreviewRouteData,
  getPreviewIndexByDay,
  getLikeType,
  buildPreviewDaySections
} = require('../../../../utils/routeHelper')

const routeMapBehavior = require('../../utils/route-map-behavior')
const routePreviewBehavior = require('../../utils/route-preview-behavior')
const routeEditBehavior = require('../../utils/route-edit-behavior')
const routeNavBehavior = require('../../utils/route-nav-behavior')
const routePlaceBehavior = require('../../utils/route-place-behavior')


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

// 只有用户明确点"保存"时，才真正写入 savedRoutes。
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

Page({
  behaviors: [routeMapBehavior, routePreviewBehavior, routeEditBehavior, routeNavBehavior, routePlaceBehavior],
  data: {
    // 起点默认使用当前位置
    currentStart: { name: '当前位置', lat: 22.5431, lng: 114.0579, type: 'current' },

    // 出行方式
    travelMode: 'drive',

    // 当前定位
    currentLocation: null,

    // 编辑模式
    isEditing: false,
    viewMode: 'list',
    modeSwitchTop: 44,
    routeDaySections: [],
    currentTab: 0,
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
    pendingTransportMode: 'walk',
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
    // 清除路线缓存
    this._routeCache = {}
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
      const routeShops = this._planRouteByDays(rawItems, presetIds ? true : false)
      routeShops.forEach((s, i) => {
        const hit = allLikedShops.find(a => a.id === s.id)
        if (hit) hit.orderNum = i + 1
      })
    this.setData({
      allLikedShops,
      routeShops,
      rawItems,
      selectedCount: rawItems.length,
      isAllSelected: true
    })
    
    // 调试：打印 routeShops 数据
    console.log('[loadRoute] routeShops:', routeShops.map(s => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng })))
    
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
      const routeShops = this._planRouteByDays(selectedShops)
      allLikedShops.forEach(s => { s.orderNum = '' })
      routeShops.forEach((s, i) => {
        const hit = allLikedShops.find(a => a.id === s.id)
        if (hit) hit.orderNum = i + 1
      })

      this.setData({
        allLikedShops,
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
  _planRouteByDays(shops, preserveOrder = false) {
    if (shops.length === 0) return []

    const { preferredDayCount, dayStartPoints, currentStart } = this.data
    
    // 先按天分组（使用当前的 routeDaySections 分组逻辑）
    const routeDaySections = buildPreviewDaySections(shops, preferredDayCount)
    
    // 对每一天独立规划路线
    const allRouteShops = []
    let totalDist = 0
    
    routeDaySections.forEach((daySection, dayIndex) => {
      // 确定当天的起点
      let dayStartPoint = null
      if (dayIndex === 0) {
        // 第1天：使用全局起点
        dayStartPoint = currentStart.type === 'current' 
          ? (app.globalData.location || app.globalData.centerLocation || currentStart)
          : currentStart
      } else {
        // 第2天及以后：使用设置的起点，或默认前一天最后一个地点
        const customStart = dayStartPoints[dayIndex]
        if (customStart) {
          dayStartPoint = customStart
        } else {
          // 默认：前一天最后一个地点
          const prevDaySection = routeDaySections[dayIndex - 1]
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
      
      // 标记每个地点属于第几天
      dayShops.forEach(s => { s.dayIndex = dayIndex })
      
      // 累加总距离
      dayShops.forEach(s => { totalDist += s.distanceFromPrev || 0 })
      
      allRouteShops.push(...dayShops)
    })
    
    this.setData({
      totalDistance: util.formatDistance(totalDist)
    })

    const decoratedRouteShops = decorateRouteItems(allRouteShops)
    let totalMinutes = 0
    decoratedRouteShops.forEach(item => {
      const modeKey = (item.travelMeta && item.travelMeta.mode) || item.travelMode
      const modeConfig = MODE_CONFIG[modeKey] || MODE_CONFIG.drive
      totalMinutes += (Math.max(0, item.distanceFromPrev || 0) / 1000) * modeConfig.minutesPerKm
    })

    this.setData({
      totalTime: formatDurationShort(totalMinutes)
    })

    return decoratedRouteShops
  },

  // 切换"最优路径 / 自定义选择"模式。
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
    console.log('[onSelectMode] 切换到模式:', mode, '当前 travelMode:', this.data.travelMode)
    const routeShops = decorateRouteItems(this.data.routeShops, mode)
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
    console.log('[route] openTransportSheet, dayIndex:', dayIndex, 'itemIndex:', itemIndex, 'previewIndex:', previewIndex)
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
    console.log('[route] transportSheetVisible:', true)
  },

  // 列表模式里点击交通方式入口
  onOpenPlaceTransportSheet(e) {
    console.log('[route] onOpenPlaceTransportSheet, dataset:', e.currentTarget.dataset)
    const dayIndex = parseInt(e.currentTarget.dataset.dayIndex, 10)
    const itemIndex = parseInt(e.currentTarget.dataset.index, 10)
    this.openTransportSheet(dayIndex, itemIndex, getPreviewIndexByDay(this.data.routeDaySections, dayIndex) + itemIndex)
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
    const { transportTarget, transportTargetIndex, pendingTransportMode, routeShops, currentNavIndex, isNavigating } = this.data
    console.log('[route] transportTarget:', transportTarget, 'transportTargetIndex:', transportTargetIndex, 'pendingTransportMode:', pendingTransportMode)
    if (!transportTarget || transportTargetIndex < 0 || !routeShops[transportTargetIndex]) {
      console.log('[route] onConfirmTransportMode 提前返回')
      return
    }

    const nextRouteShops = (routeShops || []).map((item, index) => {
      if (index !== transportTargetIndex) return item
      return decorateRouteCardItem(applyTravelMeta(item, pendingTransportMode))
    })
    const nextData = {
      routeShops: nextRouteShops,
      transportSheetVisible: false,
      transportTargetIndex: -1,
      transportTarget: null,
      travelMode: pendingTransportMode // 同时更新整条路线的默认交通方式
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

  // 清空整条路线，并移除相关"想去"记录。
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

  // 切换"行程总览 / 第一天 / 第二天..."
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

  // 把当前路线保存到"我的路线"
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

  // 底部"路线"按钮：切到地图模式
  onViewRoute() {
    const mapDayIndex = this.data.currentTab > 0
      ? this.data.currentTab - 1
      : (this.data.routeDaySections.length ? 0 : -1)
    this.setData({ viewMode: 'map', currentMapDay: mapDayIndex })
    this.focusPreviewByIndex(mapDayIndex >= 0 ? getPreviewIndexByDay(this.data.routeDaySections, mapDayIndex) : 0, mapDayIndex >= 0 ? mapDayIndex : undefined)
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

    const options = ['使用当前位置']
    if (dayIndex > 0) {
      options.push('使用前一天终点')
    }
    options.push('搜索地点', '取消')

    wx.showActionSheet({
      itemList: options,
      success: (res) => {
        const selectedIndex = res.tapIndex
        if (selectedIndex === options.length - 1) return // 取消

        if (selectedIndex === 0) {
          // 使用当前位置
          this._setDayStartToCurrent(dayIndex)
        } else if (selectedIndex === 1 && dayIndex > 0) {
          // 使用前一天终点
          this._setDayStartToPrevDayEnd(dayIndex)
        } else if ((selectedIndex === 1 && dayIndex === 0) || (selectedIndex === 2 && dayIndex > 0)) {
          // 搜索地点
          this._searchDayStartPoint(dayIndex)
        }
      }
    })
  },

  // 设置起点为当前位置
  _setDayStartToCurrent(dayIndex) {
    const currentStart = this.data.currentStart
    const startPoint = currentStart.type === 'current' 
      ? (app.globalData.location || app.globalData.centerLocation || currentStart)
      : currentStart

    const dayStartPoints = [...this.data.dayStartPoints]
    dayStartPoints[dayIndex] = {
      lat: startPoint.lat,
      lng: startPoint.lng,
      name: startPoint.name || '当前位置'
    }

    const dayStartPointTexts = [...this.data.dayStartPointTexts]
    dayStartPointTexts[dayIndex] = startPoint.name || '当前位置'

    this.setData({
      dayStartPoints,
      dayStartPointTexts
    })

    // 更新 routeDaySections 中的 startPointText
    this._updateDayStartPointTexts()

    // 重新规划路线
    this._replanRoute()
  },

  // 设置起点为前一天最后一个地点
  _setDayStartToPrevDayEnd(dayIndex) {
    const routeDaySections = this.data.routeDaySections
    if (!routeDaySections || dayIndex <= 0 || dayIndex >= routeDaySections.length) return

    const prevDaySection = routeDaySections[dayIndex - 1]
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

    // 更新 routeDaySections 中的 startPointText
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

        // 更新 routeDaySections 中的 startPointText
        this._updateDayStartPointTexts()

        // 重新规划路线
        this._replanRoute()
      },
      fail: () => {
        wx.showToast({ title: '已取消', icon: 'none' })
      }
    })
  },

  // 更新 routeDaySections 中的 startPointText
  _updateDayStartPointTexts() {
    const { routeDaySections, dayStartPointTexts } = this.data
    if (!routeDaySections || !routeDaySections.length) return

    const updatedSections = routeDaySections.map((section, dayIndex) => {
      const defaultText = dayIndex === 0 ? '当前位置' : '设置起点'
      return {
        ...section,
        startPointText: dayStartPointTexts[dayIndex] || defaultText
      }
    })

    this.setData({
      routeDaySections: updatedSections
    })
  },

  // 重新规划路线（使用当前的 dayStartPoints）
  _replanRoute() {
    const { selectMode, rawItems, presetIds } = this.data
    
    if (selectMode === 'all') {
      const routeShops = this._planRouteByDays(rawItems, presetIds ? true : false)
      // 更新 orderNum
      const allLikedShops = this.data.allLikedShops
      allLikedShops.forEach(s => { s.orderNum = '' })
      routeShops.forEach((s, i) => {
        const hit = allLikedShops.find(a => a.id === s.id)
        if (hit) hit.orderNum = i + 1
      })
      this.setData({
        routeShops,
        allLikedShops: [...allLikedShops]
      })
      this.refreshPreviewRoute(routeShops)
    } else {
      const allLikedShops = this.data.allLikedShops
      const selectedShops = allLikedShops.filter(s => s.selected)
      const routeShops = this._planRouteByDays(selectedShops)
      allLikedShops.forEach(s => { s.orderNum = '' })
      routeShops.forEach((s, i) => {
        const hit = allLikedShops.find(a => a.id === s.id)
        if (hit) hit.orderNum = i + 1
      })
      this.setData({
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