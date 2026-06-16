// 觅食图 - 地点详情页（统一美食和景点）
const app = getApp()
const util = require('../../../../utils/util')
const placesData = require('../../../../utils/placesData')
const { DEFAULT_FOOD_COVERS } = require('../../../../config/cover-pool')

// 统一生成地址文案
function resolveSpotAddress(spot = {}) {
  return (
    spot.address ||
    spot.formattedAddress ||
    spot.addr ||
    spot.poiAddress ||
    `${spot.city || ''}${spot.district || ''}${spot.name || ''}`.trim()
  )
}

// 统一解析详情页入参：支持 spot/spotData/shop/shopData/id 多种格式
function resolveItem(options = {}) {
  if (options.spotData) {
    return JSON.parse(decodeURIComponent(options.spotData))
  }
  if (options.spot) {
    return JSON.parse(decodeURIComponent(options.spot))
  }
  if (options.shop) {
    return JSON.parse(decodeURIComponent(options.shop))
  }
  if (options.shopData) {
    return JSON.parse(decodeURIComponent(options.shopData))
  }
  if (options.id !== undefined) {
    const id = String(options.id)
    // 先从 placesData 查（涵盖美食+景点）
    const place = placesData.getPlaceById(id)
    if (place) return place
    // 查用户添加的店铺
    const userAddedShops = util.loadData('userAddedShops', [])
    return userAddedShops.find(item => String(item.id) === id) || null
  }
  return null
}

// 判断是否美食类地点
function isFoodItem(item) {
  if (item.type === 'food') return true
  if (item.type === 'spot') return false
  // 无 type 时通过 category 推断
  return item.category !== '景点' && item.category !== '公园'
}

// 给推荐菜准备封面图池
function buildCoverPool(currentCover) {
  const foodCovers = DEFAULT_FOOD_COVERS
  return [...new Set([currentCover, ...foodCovers].filter(Boolean))]
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
    phoneText: '',
    relatedItems: [],
    relatedSectionTitle: '附近美食',
    showRelatedMore: true,
    showDesc: true,
    showDivider: true,
    navMapSheetVisible: false,
    navMapTarget: null,
    addressText: '',
    isFoodDetail: false
  },

  onLoad(options) {
    const windowInfo = wx.getWindowInfo()
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const menuTop = menuButtonInfo ? menuButtonInfo.top : (windowInfo.statusBarHeight || 44) + 4
    const menuHeight = menuButtonInfo ? menuButtonInfo.height : 32
    const menuRightInset = menuButtonInfo
      ? Math.max(windowInfo.windowWidth - menuButtonInfo.left + 8, 24)
      : 103

    const sourceItem = resolveItem(options)
    if (!sourceItem) {
      wx.showToast({ title: '地点不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }

    const isFood = isFoodItem(sourceItem)
    const spot = {
      ...sourceItem,
      coverImage: sourceItem.coverImage || '/images/app-logo.jpg',
      wantCount: sourceItem.wantCount || 4232,
      category: sourceItem.category || (isFood ? '美食' : '景点')
    }

    const addressText = resolveSpotAddress(spot)
    const hoursText = spot.openHours || (isFood ? '暂无营业时间' : '全天')
    const priceText = isFood
      ? (spot.avgPrice ? `￥${spot.avgPrice}/人` : '暂无均价')
      : ((spot.free || !spot.avgPrice) ? '免费' : '收费')
    const phoneText = isFood ? (spot.phone || '') : ''

    const isLiked = util.isWant(spot.id)
    const collectedKey = isFood ? 'userCollectedFoods' : 'userCollectedSpots'
    const isCollected = util.loadData(collectedKey, []).some(id => String(id) === String(spot.id))

    this.setData({
      spot,
      addressText,
      mapMarkers: [],
      isLiked,
      isCollected,
      menuTop,
      menuHeight,
      menuRightInset,
      secondaryTag: (spot.tags && spot.tags[0]) || spot.district || (isFood ? '热门店铺' : '热门地点'),
      wantStatText: `${spot.wantCount || 4232} 人想去`,
      openTimeText: `营业时间：${hoursText} · ${priceText}`,
      phoneText,
      showDesc: !isFood,
      showDivider: !isFood,
      relatedSectionTitle: isFood ? '推荐菜' : '附近美食',
      showRelatedMore: !isFood,
      relatedItems: [],
      isFoodDetail: isFood
    })

    wx.setNavigationBarTitle({ title: spot.name || '地点详情' })
    this.initMap(spot)
    this._loadNearbyShops(spot, isFood)
  },

  initMap(spot) {
    this.setData({
      mapMarkers: [{
        id: spot.id,
        latitude: spot.lat || spot.latitude,
        longitude: spot.lng || spot.longitude,
        width: 36,
        height: 36
      }]
    })
  },

  // 加载相关项：美食显示推荐菜，景点显示附近美食
  _loadNearbyShops(spot, isFood) {
    if (isFood) {
      const coverPool = buildCoverPool(spot.image || spot.coverImage)
      const dishes = spot.dishes || []
      const relatedItems = dishes.map((name, index) => ({
        name,
        coverImage: coverPool[index % coverPool.length] || '/images/app-logo.jpg'
      }))
      const displayAvatars = coverPool.slice(0, 6)

      this.setData({ relatedItems, nearbyShops: [], displayAvatars })
      return
    }

    // 景点：附近美食
    const userAddedShops = util.loadData('userAddedShops', [])
    const allShops = [...placesData.getFoods(), ...userAddedShops]
    let candidates = allShops

    if (spot.city || spot.district) {
      let filtered = allShops.filter(s => {
        if (spot.city && s.city && s.city !== spot.city) return false
        if (spot.district && s.district && s.district !== spot.district) return false
        return true
      })
      if (filtered.length === 0 && spot.city) {
        filtered = allShops.filter(s => {
          if (s.city && s.city !== spot.city) return false
          return true
        })
      }
      if (filtered.length > 0) {
        candidates = filtered
      } else {
        this.setData({
          nearbyShops: [],
          displayAvatars: [spot.coverImage || '/images/app-logo.jpg'].slice(0, 6)
        })
        return
      }
    }

    const nearby = candidates
      .filter(s => (s.lat || s.latitude) && (s.lng || s.longitude))
      .map(s => ({
        ...s,
        dist: util.getDistance(spot.lat, spot.lng, s.lat || s.latitude, s.lng || s.longitude),
        distText: '',
        coverImage: s.coverImage || '/images/app-logo.jpg'
      }))
      .filter(s => s.dist <= 5000)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 8)
      .map(s => ({
        ...s,
        distText: util.formatDistance(s.dist).replace('.00', '').replace(/\.0+km/, 'km')
      }))

    const displayAvatars = [
      ...nearby.map(item => item.coverImage).filter(Boolean),
      spot.coverImage || '/images/app-logo.jpg'
    ].slice(0, 6)

    this.setData({ nearbyShops: nearby, displayAvatars, relatedItems: [] })
  },

  onBack() { wx.navigateBack() },

  onShareTap() { wx.showToast({ title: '请点击右上角分享', icon: 'none' }) },

  onOpenNavMapSheet() {
    const { spot, addressText } = this.data
    if (!spot) return
    this.setData({
      navMapSheetVisible: true,
      navMapTarget: {
        lat: spot.lat || spot.latitude || 0,
        lng: spot.lng || spot.longitude || 0,
        name: spot.name,
        address: addressText || spot.name
      }
    })
  },

  onNavigate() {
    const { spot, addressText } = this.data
    const latitude = spot && (spot.lat || spot.latitude)
    const longitude = spot && (spot.lng || spot.longitude)
    if (latitude && longitude) {
      wx.openLocation({
        latitude,
        longitude,
        name: spot.name,
        address: addressText || spot.name,
        scale: 16
      })
      return
    }
    wx.showToast({ title: '暂无坐标', icon: 'none' })
  },

  onCloseNavMapSheet() {
    this.setData({ navMapSheetVisible: false, navMapTarget: null })
  },

  onSelectNavMapOption(e) {
    const type = e.currentTarget.dataset.type
    const target = this.data.navMapTarget
    if (!type || !target) return

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

  preventBubble() {},

  onCall() {
    if (this.data.spot.phone) {
      wx.makePhoneCall({ phoneNumber: this.data.spot.phone })
    }
  },

  onCollect() {
    const { spot, isFoodDetail } = this.data
    if (!spot) return
    if (!util.requireLogin()) return

    const type = isFoodDetail ? 'food' : 'spot'
    const isCollected = util.toggleCollect(spot.id, type)
    this.setData({ isCollected })
    wx.showToast({
      title: isCollected ? '已收藏' : '已取消收藏',
      icon: 'none',
      duration: 1200
    })
  },

  onWant() {
    const { spot } = this.data
    if (!spot) return
    if (!util.requireLogin()) return
    const isLiked = util.toggleWant(spot.id)
    this.setData({ isLiked })
    wx.showToast({
      title: isLiked ? '已添加到想去' : '已移出想去',
      icon: 'none',
      duration: 1000
    })
  },

  onGoShop(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/subpackages/extra/pages/spot-detail/spot-detail?id=${id}` })
  },

  onFindFood() {
    const { spot } = this.data
    if (spot) {
      app.globalData.nearbySpot = spot
    }
    wx.switchTab({ url: '/pages/index/index' })
  },

  onShareAppMessage() {
    const { spot } = this.data
    return {
      title: spot ? `${spot.name} · 地点详情` : '地点详情',
      path: spot ? `/subpackages/extra/pages/spot-detail/spot-detail?id=${spot.id}` : '/pages/index/index'
    }
  }
})
