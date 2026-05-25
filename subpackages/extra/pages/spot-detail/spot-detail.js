// 觅食图 V1 - 景点详情页逻辑
// 这个页面负责：展示景点详情、底部附近美食、收藏/想去、导航和去规划路线。
const app = getApp()
const util = require('../../../../utils/util')
const placesData = require('../../../../utils/placesData')

// 统一生成景点详情页要显示的地址文案：
// 1. 优先使用真实 address
// 2. 兼容少量历史字段名
// 3. 如果都没有，就回退到“城市/区域 + 名称”，避免页面只剩“地址”标题没有内容
function resolveSpotAddress(spot = {}) {
  return (
    spot.address ||
    spot.formattedAddress ||
    spot.addr ||
    spot.poiAddress ||
    `${spot.city || ''}${spot.district || ''}${spot.name || ''}`.trim()
  )
}

// 统一解析景点详情入参：
// 既支持传统 id，也支持足迹里传进来的完整 spotData。
function resolveSpot(options = {}) {
  if (options.spotData) {
    return JSON.parse(decodeURIComponent(options.spotData))
  }
  if (options.spot) {
    return JSON.parse(decodeURIComponent(options.spot))
  }
  const id = parseInt(options.id, 10)
  if (!Number.isNaN(id)) {
    return placesData.getPlaceById(id) || null
  }
  return null
}

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
    navMapSheetVisible: false,
    navMapTarget: null
  },

  // 页面初始化：
  // 1. 读取景点 id
  // 2. 组装详情页需要的数据
  // 3. 加载附近美食和用户状态
  onLoad(options) {
    const windowInfo = wx.getWindowInfo()
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const menuTop = menuButtonInfo ? menuButtonInfo.top : (windowInfo.statusBarHeight || 44) + 4
    const menuHeight = menuButtonInfo ? menuButtonInfo.height : 32
    const menuRightInset = menuButtonInfo
      ? Math.max(windowInfo.windowWidth - menuButtonInfo.left + 8, 24)
      : 103

    // 优先读取真实入参；没有入参时，才回退到默认景点。
    const sourceSpot = resolveSpot(options) || placesData.getSpots()[0]
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
    // 地址显示、复制地址、系统导航统一使用同一份兜底后的文案，避免页面和弹窗出现不一致。
    const addressText = resolveSpotAddress(spot)

    this.setData({ 
      spot, 
      addressText,
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
    const allShops = [...placesData.getFoods(), ...userAddedShops]
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
    if (!util.requireLogin()) return
    
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
    if (!util.requireLogin()) return
    const isLiked = util.toggleLike(spot.id, 'spot')
    this.setData({ isLiked })
    wx.showToast({
      title: isLiked ? '已添加到想去' : '已移出想去',
      icon: 'none',
      duration: 1200
    })
  },

  // 地址卡片点击后，打开“请选择导航地图”底部弹窗。
  onOpenNavMapSheet() {
    const { spot } = this.data
    if (!spot) return
    this.setData({
      navMapSheetVisible: true,
      navMapTarget: {
        lat: spot.lat || spot.latitude || 0,
        lng: spot.lng || spot.longitude || 0,
        name: spot.name,
        // 导航弹窗里也复用同一份地址兜底文案，保证复制地址和页面显示一致。
        address: this.data.addressText || spot.name
      }
    })
  },

  // 位置地图点击后，继续使用微信原生地图。
  onNavigate() {
    const { spot } = this.data
    const latitude = spot && (spot.lat || spot.latitude)
    const longitude = spot && (spot.lng || spot.longitude)
    if (latitude && longitude) {
      wx.openLocation({
        latitude,
        longitude,
        name: spot.name,
        // 系统地图里也带上兜底后的地址，避免出现空地址。
        address: this.data.addressText || spot.name,
        scale: 16
      })
      return
    }
    wx.showToast({ title: '暂无坐标', icon: 'none' })
  },

  // 关闭导航地图选择弹窗。
  onCloseNavMapSheet() {
    this.setData({
      navMapSheetVisible: false,
      navMapTarget: null
    })
  },

  // 在导航弹窗里选择地图应用或复制地址。
  onSelectNavMapOption(e) {
    const type = e.currentTarget.dataset.type
    const target = this.data.navMapTarget
    if (!type || !target) return

    // 复制地址不依赖坐标，所以单独放行。
    if (type === 'copy') {
      wx.setClipboardData({
        data: target.address || target.name,
        success: () => {
          wx.showToast({ title: '地址已复制', icon: 'success' })
          this.onCloseNavMapSheet()
        }
      })
      return
    }

    if (!target.lat || !target.lng) {
      wx.showToast({ title: '暂无坐标', icon: 'none' })
      return
    }

    if (type === 'tencent') {
      util.openWechatNavigation(target)
      this.onCloseNavMapSheet()
      return
    }

    if (type === 'gaode') {
      util.openGaodeNavigation(target.lat, target.lng, target.name)
      this.onCloseNavMapSheet()
    }
  },

  // 阻止弹窗面板点击冒泡到遮罩层。
  preventBubble() {
  },

  // 点击附近美食卡片，进入对应的美食详情页
  onGoShop(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/subpackages/extra/pages/shop-detail/shop-detail?id=${id}` })
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
      url: `/subpackages/route/pages/route/route?type=spot&ids=${spot.id}`
    })
  },

  // 小程序右上角分享文案
  onShareAppMessage() {
    const { spot } = this.data
    return {
      title: spot ? `${spot.name} · 景点详情` : '景点详情',
      path: spot ? `/subpackages/extra/pages/spot-detail/spot-detail?id=${spot.id}` : '/pages/index/index'
    }
  }
})
