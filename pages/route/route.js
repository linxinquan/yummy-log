// 觅食图 - 路线规划页 v6.0 地图+双模式+Timeline
const app = getApp()
const placesData = require('../../utils/placesData')
const util = require('../../utils/util')
const { MODE_CONFIG, applyTravelMeta, buildTravelOptions, formatDurationShort } = require('../../utils/travel')
const {
  estimateRouteDuration,
  decorateSelectableItems,
  decorateRouteItems,
  decorateRouteCardItem,
  buildPreviewRouteData,
  getPreviewIndexByDay,
  getLikeType
} = require('../../utils/routeHelper')

const routeMapBehavior = require('../../utils/route/route-map-behavior')
const routePreviewBehavior = require('../../utils/route/route-preview-behavior')
const routeEditBehavior = require('../../utils/route/route-edit-behavior')
const routeNavBehavior = require('../../utils/route/route-nav-behavior')
const routePlaceBehavior = require('../../utils/route/route-place-behavior')


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
    travelMode: 'ride',

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
})