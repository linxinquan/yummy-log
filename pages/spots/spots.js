// 觅食图 V1 - 景点列表页
const app = getApp()
const util = require('../../utils/util')
const spotData = require('../../utils/spotData')

Page({
  data: {
    spots: [],
    filteredSpots: [],
    categories: [],
    currentCategory: '全部',
    viewMode: 'list',
    mapCenter: { lat: 22.5415, lng: 114.0596 },
    mapMarkers: [],
    activeSpot: null,
    userLocation: null,
    wantSpots: [],
  },

  onLoad() {
    const cats = [...new Set(spotData.spotData.map(s => s.category).filter(Boolean))]
    const wantSpots = util.getWantSpots()
    // 在每个景点上标记是否想去
    const spotsWithWant = spotData.spotData.map(s => ({
      ...s,
      isWanted: wantSpots.indexOf(String(s.id)) > -1
    }))
    this.setData({
      spots: spotsWithWant,
      filteredSpots: spotsWithWant,
      categories: ['全部', ...cats],
      wantSpots: wantSpots
    })
    this._buildMarkers(spotsWithWant)
    this._getUserLocation()
  },

  onShow() {
    // 每次显示时刷新想去状态
    const wantSpots = util.getWantSpots()
    // 更新 filteredSpots 中每个景点的 isWanted
    const updatedSpots = this.data.spots.map(s => ({
      ...s,
      isWanted: wantSpots.indexOf(String(s.id)) > -1
    }))
    this.setData({ 
      wantSpots: wantSpots,
      filteredSpots: updatedSpots,
      spots: updatedSpots
    })
  },

  _getUserLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({ userLocation: { lat: res.latitude, lng: res.longitude } })
      },
      fail: () => {}
    })
  },

  _buildMarkers(spotList) {
    const markers = spotList.map(s => ({
      id: s.id,
      latitude: s.lat,
      longitude: s.lng,
      title: s.name,
      width: 36,
      height: 36,
      iconPath: '/images/tabbar-spots-active.png',
      callout: {
        content: s.name,
        color: '#ffffff',
        bgColor: '#00D9C0',
        padding: 8,
        borderRadius: 8,
        display: 'BYCLICK'
      }
    }))
    this.setData({ mapMarkers: markers })
  },

  onCategoryChange(e) {
    const cat = e.currentTarget.dataset.cat
    const allSpots = this.data.spots
    const filtered = cat === '全部'
      ? allSpots
      : allSpots.filter(s => s.category === cat)
    this.setData({
      currentCategory: cat,
      filteredSpots: filtered,
      activeSpot: null
    })
    this._buildMarkers(filtered)
  },

  onSwitchView(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ viewMode: mode })
    if (mode === 'map' && this.data.filteredSpots.length > 0) {
      const first = this.data.filteredSpots[0]
      this.setData({ mapCenter: { lat: first.lat, lng: first.lng } })
    }
  },

  onMarkerTap(e) {
    const id = e.detail.markerId
    const spot = this.data.spots.find(s => s.id === id)
    if (spot) {
      this.setData({ activeSpot: spot, mapCenter: { lat: spot.lat, lng: spot.lng } })
    }
  },

  onCloseCard() {
    this.setData({ activeSpot: null })
  },

  onGoDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/spot-detail/spot-detail?id=${id}` })
  },

  // 想去按钮
  onWantTap(e) {
    const id = e.currentTarget.dataset.id
    const strId = String(id)
    util.toggleLike(id, 'spot')
    const wantSpots = util.getWantSpots()
    // 更新所有列表中的 isWanted 状态
    const updateWanted = (list) => list.map(s => ({
      ...s,
      isWanted: wantSpots.indexOf(String(s.id)) > -1
    }))
    this.setData({
      wantSpots: wantSpots,
      spots: updateWanted(this.data.spots),
      filteredSpots: updateWanted(this.data.filteredSpots)
    })
    const isLiked = wantSpots.indexOf(strId) > -1
    wx.showToast({ title: isLiked ? '已收藏 ❤️' : '已取消', icon: 'none', duration: 1200 })
  },

  onFindNearbyFood(e) {
    const id = e.currentTarget.dataset.id
    const spot = this.data.spots.find(s => s.id === id)
    if (!spot) return
    app.globalData.nearbySpot = spot
    wx.switchTab({ url: '/pages/index/index' })
  },

  // 跳转到想去清单（景点Tab）
  onOpenWantList() {
    wx.navigateTo({ url: '/pages/wantgo/wantgo?tab=spot' })
  },

  // 规划景点路线（从当前筛选列表选）
  onPlanRoute() {
    const { filteredSpots } = this.data
    if (filteredSpots.length === 0) return
    const ids = filteredSpots.slice(0, 10).map(s => s.id).join(',')
    wx.navigateTo({ url: `/pages/route/route?type=spot&ids=${ids}` })
  },

  stopProp() {}
})
