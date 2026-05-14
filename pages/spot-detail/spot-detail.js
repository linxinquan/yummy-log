// 觅食图 V1 - 景点详情页逻辑
// 这个页面负责：展示景点详情、底部附近美食、收藏/想去、导航和去规划路线。
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
    isCollected: false,
    displayAvatars: [],
    secondaryTag: '',
    wantStatText: '',
    openTimeText: '',
  },

  // 页面初始化：
  // 1. 读取景点 id
  // 2. 组装详情页需要的数据
  // 3. 加载附近美食和用户状态
  onLoad(options) {
    const sysInfo = wx.getSystemInfoSync()
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const menuTop = menuButtonInfo ? menuButtonInfo.top : (sysInfo.statusBarHeight || 44) + 4
    const menuHeight = menuButtonInfo ? menuButtonInfo.height : 32
    const menuRightInset = menuButtonInfo
      ? Math.max(sysInfo.windowWidth - menuButtonInfo.left + 8, 24)
      : 103

    // 兼容没传参情况，默认给一个可展示的景点。
    const id = parseInt(options.id) || 101 // 默认 101 是中山公园
    const sourceSpot = spotData.spotData.find(s => s.id === id) || spotData.spotData[0]
    const spot = sourceSpot ? {
      ...sourceSpot,
      wantCount: sourceSpot.wantCount || 4232
    } : null
    if (!spot) {
      wx.showToast({ title: '景点不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }

    // 读取当前用户对这个景点的状态：是否想去、是否收藏。
    const isLiked = util.loadData('userWantSpots', []).some(id => String(id) === String(spot.id))
    const isCollected = util.loadData('userCollectedSpots', []).some(id => String(id) === String(spot.id))

    this.setData({ 
      spot, 
      mapMarkers: [],
      isLiked,
      isCollected,
      menuTop,
      menuHeight,
      menuRightInset,
      secondaryTag: (spot.tags && spot.tags[0]) || spot.district || '热门地点',
      wantStatText: `${spot.wantCount || 4232} 人想去 · 883m`,
      openTimeText: `营业时间：${spot.openHours || '全天'} · ${spot.free ? '免费' : '收费'}`
    })
    wx.setNavigationBarTitle({ title: spot.name })

    this._loadNearbyShops(spot)
  },

  // 读取景点附近的美食卡片。
  // 这里会从全量美食数据里按距离筛选最近的一批。
  _loadNearbyShops(spot) {
    // 把系统内置美食和用户自己添加的店一起纳入附近美食候选池。
    const userAddedShops = util.loadData('userAddedShops', [])
    const allShops = [...(shopData.shops || []), ...(shopData.foods || []), ...userAddedShops]
    const nearby = allShops
      .filter(s => (s.lat || s.latitude) && (s.lng || s.longitude))
      .map(s => {
        const lat = s.lat || s.latitude
        const lng = s.lng || s.longitude
        return {
          ...s,
          dist: util.getDistance(spot.lat, spot.lng, lat, lng),
          distText: '',
          coverImage: s.logo || s.image || s.thumb || '/images/app-logo.jpg'
        }
      })
      .filter(s => s.dist <= 5000) // 只保留 5 公里内的地点
      .sort((a, b) => a.dist - b.dist) // 离得近的排前面
      .slice(0, 8) // 最多显示 8 个
      .map(s => ({
        ...s,
        distText: util.formatDistance(s.dist).replace('.00', '').replace(/\.0+km/, 'km')
      }))

    // 顶部头像组直接复用附近美食或景点本身的封面图。
    const displayAvatars = [
      ...nearby.map(item => item.coverImage).filter(Boolean),
      spot.image || '/images/app-logo.jpg'
    ].slice(0, 6)

    this.setData({
      nearbyShops: nearby,
      displayAvatars
    })
  },

  // 返回上一页
  onBack() {
    wx.navigateBack()
  },

  // 提示用户使用右上角系统分享
  onShareTap() {
    wx.showToast({ title: '请点击右上角分享', icon: 'none' })
  },

  // 收藏/取消收藏景点
  onCollect() {
    const { spot } = this.data
    if (!spot) return
    
    const isCollected = util.toggleCollect(spot.id, 'spot')
    
    this.setData({ isCollected })
    wx.showToast({
      title: isCollected ? '已收藏' : '已取消收藏',
      icon: 'none',
      duration: 1200
    })
  },

  // 想去/取消想去景点
  onWant() {
    const { spot } = this.data
    if (!spot) return
    const isLiked = util.toggleLike(spot.id, 'spot')
    this.setData({ isLiked })
    wx.showToast({
      title: isLiked ? '已添加到想去' : '已移出想去',
      icon: 'none',
      duration: 1200
    })
  },

  // 打开系统地图导航到当前景点
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

  // 点击附近美食卡片，进入对应的美食详情页
  onGoShop(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/shop-detail/shop-detail?id=${id}` })
  },

  // 点击“更多”时回到探索页，并把当前景点暂存下来，
  // 这样探索页后面可以按这个景点做附近推荐。
  onFindFood() {
    const { spot } = this.data
    if (spot) {
      app.globalData.nearbySpot = spot
    }
    wx.switchTab({ url: '/pages/index/index' })
  },

  // 把当前景点直接带去路线规划页
  onPlanRoute() {
    const { spot } = this.data
    if (!spot) return
    wx.navigateTo({
      url: `/pages/route/route?type=spot&ids=${spot.id}`
    })
  },

  // 小程序右上角分享文案
  onShareAppMessage() {
    const { spot } = this.data
    return {
      title: spot ? `${spot.name} · 景点详情` : '景点详情',
      path: spot ? `/pages/spot-detail/spot-detail?id=${spot.id}` : '/pages/index/index'
    }
  }
})
