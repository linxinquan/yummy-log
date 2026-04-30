// 觅食图 - 路线规划页 v6.0 地图+双模式+Timeline
const app = getApp()
const shopData = require('../../utils/shopData')
const util = require('../../utils/util')

Page({
  data: {
    // 地图
    mapCenter: { lat: 22.4846, lng: 113.9046 },
    mapScale: 14,
    markers: [],
    polyline: [],

    // 起点
    startPoints: shopData.startPoints,
    currentStart: { name: '海上世界', lat: 22.4798, lng: 113.9125 },
    startExpanded: false,

    // 终点（默认返回起点）
    currentEnd: { name: '返回海上世界', lat: 22.4798, lng: 113.9125 },
    endExpanded: false,

    // 出行方式
    travelMode: 'drive',

    // 当前定位
    currentLocation: null,

    // 编辑模式
    isEditing: false,

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

    // 导览
    isNavigating: false,
    isNavComplete: false,
    currentNavIndex: 0,
    currentNavShop: null,
    visitedCount: 0
  },

  onLoad(options) {
    // 接收 type=food/spot 和 ids=1,2,3 参数
    const { type, ids } = options
    this.setData({ routeType: type || 'food', presetIds: ids ? ids.split(',').map(Number) : null })
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
    } else {
      likedIds = util.loadData('userWantFoods', [])
    }

    // 获取对应的数据源
    let allItems = []
    if (routeType === 'spot') {
      allItems = util.getSpotData()
    } else {
      const userShops = util.loadData('userAddedShops', [])
      allItems = [...(shopData.shops || []), ...(shopData.foods || []), ...userShops]
    }
    const rawItems = likedIds.map(id => allItems.find(s => s.id === id)).filter(Boolean)

    if (rawItems.length === 0) {
      this.setData({ allLikedShops: [], routeShops: [], selectedCount: 0 })
      return
    }

    // 支持景点(lat/lng)和美食(latitude/longitude)两种格式
    if (selectMode === 'all') {
      const allLikedShops = rawItems.map(s => ({ ...s, selected: true, orderNum: '' }))
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
    } else {
      const prev = this.data.allLikedShops
      const prevMap = {}
      prev.forEach(s => prevMap[s.id] = s)

      const allLikedShops = rawItems.map(s => {
        const old = prevMap[s.id]
        return { ...s, selected: old ? old.selected : true, orderNum: old ? old.orderNum : '' }
      })

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
    }

    this.updateMap()
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
      totalDistance: util.formatDistance(totalDist),
      totalTime: util.estimateTime(totalDist, this.data.travelMode)
    })

    return routeShops
  },

  // ─── 更新地图 markers + polyline ─────────────
  updateMap() {
    const { routeShops, currentStart, currentEnd } = this.data
    let startPoint = currentStart
    if (currentStart.type === 'current') {
      startPoint = app.globalData.location || { lat: 22.4846, lng: 113.9046 }
    }
    // 终点：如果 type === 'return' 则终点 = 起点
    let endPoint = currentEnd
    if (currentEnd.type === 'return') {
      endPoint = { ...startPoint, name: '返回' + startPoint.name }
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

    // 终点加红色标记（仅当终点与起点不同）
    if (Math.abs(endPoint.lat - startPoint.lat) > 0.00001 || Math.abs(endPoint.lng - startPoint.lng) > 0.00001) {
      markers.push({
        id: 8888,
        latitude: endPoint.lat,
        longitude: endPoint.lng,
        width: 28,
        height: 28,
        label: {
          content: '终',
          color: '#ffffff',
          fontSize: 12,
          borderRadius: 10,
          bgColor: '#FF5722',
          padding: 4,
          anchorX: 0,
          anchorY: -32
        }
      })
    }

    // 路线折线：起点 → 各店铺 → 终点
    const points = [
      { latitude: startPoint.lat, longitude: startPoint.lng },
      ...routeShops.map(shop => ({ latitude: shop.lat || shop.latitude, longitude: shop.lng || shop.longitude })),
      { latitude: endPoint.lat, longitude: endPoint.lng }
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
    const { routeShops, currentStart, currentEnd } = this.data
    if (routeShops.length === 0) return

    let startPoint = currentStart
    if (currentStart.type === 'current') {
      startPoint = app.globalData.location || { lat: 22.4846, lng: 113.9046 }
    }
    let endPoint = currentEnd
    if (currentEnd.type === 'return') {
      endPoint = startPoint
    }

    const lats = [startPoint.lat, endPoint.lat, ...routeShops.map(s => s.lat || s.latitude)]
    const lngs = [startPoint.lng, endPoint.lng, ...routeShops.map(s => s.lng || s.longitude)]
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
    const centerLat = (minLat + maxLat) / 2
    const centerLng = (minLng + maxLng) / 2

    // 根据跨度估算缩放级别
    const latSpan = maxLat - minLat
    const lngSpan = maxLng - minLng
    const span = Math.max(latSpan, lngSpan)
    let scale = 14
    if (span > 0.1) scale = 11
    else if (span > 0.05) scale = 12
    else if (span > 0.02) scale = 13
    else if (span > 0.01) scale = 14
    else scale = 15

    this.setData({ mapCenter: { lat: centerLat, lng: centerLng }, mapScale: scale })
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
    } else {
      this.setData({ routeShops: [], totalDistance: '0m', totalTime: '0分钟' })
    }

    this.updateMap()
  },

  // ─── 起点选择 ─────────────────────────────────
  onToggleStart() {
    this.setData({ startExpanded: !this.data.startExpanded })
  },

  onSelectStart(e) {
    const start = e.currentTarget.dataset.start
    if (start.type === 'current') {
      wx.showLoading({ title: '定位中...' })
      wx.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        success: (res) => {
          wx.hideLoading()
          const loc = { lat: res.latitude, lng: res.longitude }
          app.globalData.location = loc
          this.setData({
            currentStart: { ...start, lat: loc.lat, lng: loc.lng },
            startExpanded: false
          })
          this.loadRoute()
        },
        fail: () => {
          wx.hideLoading()
          const fallback = app.globalData.location || app.globalData.centerLocation
          this.setData({
            currentStart: { ...start, lat: fallback.lat, lng: fallback.lng },
            startExpanded: false
          })
          this.loadRoute()
          wx.showToast({ title: '使用上次位置', icon: 'none' })
        }
      })
      } else {
      this.setData({ currentStart: start, startExpanded: false })
      // 如果终点是"返回起点"，同步更新
      if (this.data.currentEnd.type === 'return') {
        const newEnd = { ...start, name: '返回' + start.name, type: 'return' }
        this.setData({ currentEnd: newEnd })
      }
      this.loadRoute()
    }
  },

  onChooseStartOnMap() {
    wx.chooseLocation({
      success: (res) => {
        if (res.name || res.address) {
          const customStart = {
            name: res.name || '自定义位置',
            lat: res.latitude,
            lng: res.longitude,
            type: 'custom'
          }
          this.setData({ currentStart: customStart, startExpanded: false })
          this.loadRoute()
          wx.showToast({ title: '起点已设置', icon: 'success' })
        }
      },
      fail: () => {
        wx.showToast({ title: '请选择有效位置', icon: 'none' })
      }
    })
  },

  // ─── 终点选择 ─────────────────────────────────
  onToggleEnd() {
    this.setData({ endExpanded: !this.data.endExpanded })
  },

  onSelectEnd(e) {
    const endtype = e.currentTarget.dataset.endtype
    const end = e.currentTarget.dataset.end

    // 返回起点
    if (endtype === 'return') {
      const { currentStart } = this.data
      this.setData({
        currentEnd: { name: '返回' + currentStart.name, lat: currentStart.lat, lng: currentStart.lng, type: 'return' },
        endExpanded: false
      })
      this.updateMap()
      wx.showToast({ title: '终点已设置为起点', icon: 'success' })
      return
    }

    if (!end) return

    if (end.type === 'current') {
      // 获取当前位置作为终点
      wx.showLoading({ title: '定位中...' })
      wx.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        success: (res) => {
          wx.hideLoading()
          const loc = { lat: res.latitude, lng: res.longitude }
          app.globalData.location = loc
          this.setData({
            currentEnd: { ...end, lat: loc.lat, lng: loc.lng },
            endExpanded: false
          })
          this.updateMap()
          wx.showToast({ title: '终点已设置', icon: 'success' })
        },
        fail: () => {
          wx.hideLoading()
          const fallback = app.globalData.location || app.globalData.centerLocation
          this.setData({
            currentEnd: { ...end, lat: fallback.lat, lng: fallback.lng },
            endExpanded: false
          })
          this.updateMap()
          wx.showToast({ title: '使用上次位置', icon: 'none' })
        }
      })
    } else {
      this.setData({ currentEnd: end, endExpanded: false })
      this.updateMap()
      wx.showToast({ title: '终点已设置', icon: 'success' })
    }
  },

  onChooseEndOnMap() {
    wx.chooseLocation({
      success: (res) => {
        if (res.name || res.address) {
          const customEnd = {
            name: res.name || '自定义位置',
            lat: res.latitude,
            lng: res.longitude,
            type: 'custom'
          }
          this.setData({ currentEnd: customEnd, endExpanded: false })
          this.updateMap()
          wx.showToast({ title: '终点已设置', icon: 'success' })
        }
      },
      fail: () => {
        wx.showToast({ title: '请选择有效位置', icon: 'none' })
      }
    })
  },

  // ─── 出行方式 ─────────────────────────────────
  onSelectMode(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ travelMode: mode })
    let totalDist = 0
    this.data.routeShops.forEach(s => { totalDist += s.distanceFromPrev || 0 })
    this.setData({ totalTime: util.estimateTime(totalDist, mode) })
  },

  // ─── ⚡ 重新贪心优化 ─────────────────────────
  onOptimizeRoute() {
    wx.showLoading({ title: '优化中...' })
    setTimeout(() => {
      const shops = this.data.selectMode === 'all'
        ? this.data.allLikedShops
        : this.data.allLikedShops.filter(s => s.selected)
      const routeShops = this._planAndAnnotate(shops)
      this.setData({ routeShops, isEditing: false })
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

  onMoveUp(e) {
    const index = e.currentTarget.dataset.index
    if (index <= 0) return
    const shops = [...this.data.routeShops]
    ;[shops[index], shops[index - 1]] = [shops[index - 1], shops[index]]
    this.setData({ routeShops: shops })
    this.updateMap()
  },

  onMoveDown(e) {
    const index = e.currentTarget.dataset.index
    if (index >= this.data.routeShops.length - 1) return
    const shops = [...this.data.routeShops]
    ;[shops[index], shops[index + 1]] = [shops[index + 1], shops[index]]
    this.setData({ routeShops: shops })
    this.updateMap()
  },

  // ─── 移除店铺 ─────────────────────────────────
  onRemoveShop(e) {
    const shopId = e.currentTarget.dataset.shopid
    const type = this.data.routeType
    util.toggleLike(shopId, type)
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
    wx.showModal({
      title: '退出导览',
      content: '确定退出导览模式吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            isNavigating: false,
            isNavComplete: false,
            currentNavIndex: 0,
            currentNavShop: null
          })
          this.updateMap()
        }
      }
    })
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
          this.data.allLikedShops.forEach(shop => util.toggleLike(shop.id, this.data.routeType))
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

  onBack() {
    wx.navigateBack()
  }
})
