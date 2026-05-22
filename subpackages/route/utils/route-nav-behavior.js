const app = getApp()
const util = require('../../../utils/util')

module.exports = Behavior({
data: {    
  // 导览
    isNavigating: false,
    isNavComplete: false,
    currentNavIndex: 0,
    currentNavShop: null,
    visitedCount: 0
  },

methods: {
    
  // 开始逐站导览模式。
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

  // 导览模式下刷新地图：只显示"当前位置 -> 下一站"。
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

  // 直接调用系统导航去当前这一站
  onNavToCurrent() {
    const { currentNavShop } = this.data
    if (!currentNavShop) return
    util.openDirectNavigation(currentNavShop)
  },

  // 标记"当前这一站已到达"，并进入下一站
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

  // 退出导览模式，恢复普通路线地图
  onExitNav() {
    this.setData({
      isNavigating: false,
      isNavComplete: false,
      currentNavIndex: 0,
      currentNavShop: null
    })
    this.updateMap()
  },

},
})