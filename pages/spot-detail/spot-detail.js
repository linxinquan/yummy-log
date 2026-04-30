// 觅食图 V1 - 景点详情页逻辑
const app = getApp()
const util = require('../../utils/util')
const shopData = require('../../utils/shopData')
const spotData = require('../../utils/spotData')

Page({
  data: {
    spot: null,
    mapMarkers: [],
    nearbyShops: [],
    isLiked: false,
  },

  onLoad(options) {
    const id = parseInt(options.id)
    const spot = spotData.spotData.find(s => s.id === id)
    if (!spot) {
      wx.showToast({ title: '景点不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }

    const isLiked = util.isLiked(id, 'spot')
    const marker = [{
      id: spot.id,
      latitude: spot.lat,
      longitude: spot.lng,
      title: spot.name,
      width: 44,
      height: 44,
      iconPath: '/images/tabbar-spots-active.png'
    }]

    this.setData({ spot, mapMarkers: marker, isLiked })
    wx.setNavigationBarTitle({ title: spot.name })

    this._loadNearbyShops(spot)
  },

  _loadNearbyShops(spot) {
    // 附近美食：从合并后的全量美食数据中筛选
    const allShops = [...(shopData.shops || []), ...(shopData.foods || [])]
    const nearby = allShops
      .filter(s => s.lat && s.lng)
      .map(s => {
        const lat = s.lat || s.latitude
        const lng = s.lng || s.longitude
        return {
          ...s,
          dist: util.getDistance(spot.lat, spot.lng, lat, lng),
          distText: ''
        }
      })
      .filter(s => s.dist <= 5000)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 8)
      .map(s => ({
        ...s,
        distText: util.formatDistance(s.dist)
      }))
    this.setData({ nearbyShops: nearby })
  },

  onBack() {
    wx.navigateBack()
  },

  // 想去/取消想去
  onWant() {
    const { spot } = this.data
    if (!spot) return
    const isLiked = util.toggleLike(spot.id, 'spot')
    this.setData({ isLiked })
    wx.showToast({
      title: isLiked ? '已收藏 ❤️' : '已取消',
      icon: 'none',
      duration: 1200
    })
  },

  // 导航到景点
  onNavigate() {
    const { spot } = this.data
    if (spot.lat && spot.lng) {
      wx.openLocation({
        latitude: spot.lat,
        longitude: spot.lng,
        name: spot.name,
        address: spot.address,
        scale: 16
      })
    } else {
      wx.showToast({ title: '暂无坐标', icon: 'none' })
    }
  },

  // 跳转到店铺详情
  onGoShop(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/shop-detail/shop-detail?id=${id}` })
  },

  // 附近美食：跳回首页
  onFindFood() {
    const { spot } = this.data
    if (spot) {
      app.globalData.nearbySpot = spot
    }
    wx.switchTab({ url: '/pages/index/index' })
  },

  // 规划景点路线
  onPlanRoute() {
    const { spot } = this.data
    if (!spot) return
    wx.navigateTo({
      url: `/pages/route/route?type=spot&ids=${spot.id}`
    })
  }
})
