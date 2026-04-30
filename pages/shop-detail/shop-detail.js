// 觅食图 - 店铺详情页
const shopData = require('../../utils/shopData')
const spotData = require('../../utils/spotData')
const util = require('../../utils/util')

function buildAllFoodItems() {
  const userAddedShops = util.loadData('userAddedShops', [])
  return [...(shopData.shops || []), ...(shopData.foods || []), ...userAddedShops]
}

function buildCoverPool(currentCover) {
  const foodCovers = buildAllFoodItems()
    .map(item => item.logo || item.image || item.thumb)
    .filter(Boolean)
  const spotCovers = (spotData.spotData || [])
    .map(item => item.image)
    .filter(Boolean)

  const uniqueCovers = [...new Set([currentCover, ...foodCovers, ...spotCovers].filter(Boolean))]
  return uniqueCovers
}

Page({
  data: {
    shop: {},
    mapMarkers: [],
    isLiked: false,
    isCollected: false,
    displayAvatars: [],
    relatedItems: [],
    isFoodDetail: true
  },

  onLoad(options) {
    const sysInfo = wx.getSystemInfoSync()
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const menuTop = menuButtonInfo ? menuButtonInfo.top : (sysInfo.statusBarHeight || 44) + 4
    const menuHeight = menuButtonInfo ? menuButtonInfo.height : 32
    const menuRightInset = menuButtonInfo
      ? Math.max(sysInfo.windowWidth - menuButtonInfo.left + 8, 24)
      : 103

    const shop = this.resolveShop(options)
    if (!shop) {
      wx.showToast({ title: '店铺不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack({ delta: 1 }), 1200)
      return
    }

    const coverImage = shop.logo || shop.image || shop.thumb || '/images/app-logo.jpg'
    const hoursText = shop.hours || '暂无营业时间'
    const priceText = shop.price ? `￥${shop.price}/人` : '暂无均价'

    // 适配为景点详情模板需要的数据结构
    const spot = {
      ...shop,
      image: coverImage,
      coverImage,
      wantCount: shop.wantCount || 4232,
      category: shop.category || '美食'
    }

    this.setData({ 
      spot, 
      shop, 
      menuTop,
      menuHeight,
      menuRightInset,
      secondaryTag: (spot.tags && spot.tags[0]) || spot.district || '热门店铺',
      wantStatText: `${spot.wantCount} 人想去`,
      openTimeText: `营业时间：${hoursText} · 人均：${priceText}`,
      phoneText: '',
      showDesc: false,
      showDivider: false,
      relatedSectionTitle: '推荐菜',
      showRelatedMore: false,
      relatedItems: []
    })

    this.initMap(spot)
    this.loadUserData(spot.id)
    wx.setNavigationBarTitle({ title: spot.name || '店铺详情' })

    this._loadNearbyShops(spot)
  },

  resolveShop(options) {
    if (options.shop) {
      return JSON.parse(decodeURIComponent(options.shop))
    }
    if (options.shopData) {
      return JSON.parse(decodeURIComponent(options.shopData))
    }
    if (options.id) {
      const id = String(options.id)
      return buildAllFoodItems().find(item => String(item.id) === id) || null
    }
    return null
  },

  initMap(shop) {
    this.setData({
      mapMarkers: [{
        id: shop.id,
        latitude: shop.lat || shop.latitude,
        longitude: shop.lng || shop.longitude,
        width: 36,
        height: 36
      }]
    })
  },

  loadUserData(shopId) {
    const likedIds = util.loadData('userWantFoods', [])
    const collectedIds = util.loadData('userCollectedFoods', [])
    
    this.setData({
      isLiked: likedIds.some(id => String(id) === String(shopId)),
      isCollected: collectedIds.some(id => String(id) === String(shopId))
    })
  },

  onImageError() {},

  _loadNearbyShops(spot) {
    const coverPool = buildCoverPool(spot.image || spot.coverImage || '/images/app-logo.jpg')
    const dishes = this.data.shop.dishes || []
    const relatedItems = dishes.map((name, index) => ({
      name,
      coverImage: coverPool[index % coverPool.length] || '/images/app-logo.jpg'
    }))
    const displayAvatars = coverPool.slice(0, 6)

    this.setData({
      relatedItems,
      nearbyShops: [],
      displayAvatars
    })
  },

  onBack() {
    wx.navigateBack()
  },

  onShareTap() {
    wx.showToast({ title: '请点击右上角分享', icon: 'none' })
  },

  onNavigate() {
    const { spot } = this.data
    if ((spot.lat || spot.latitude) && (spot.lng || spot.longitude)) {
      wx.openLocation({
        latitude: spot.lat || spot.latitude,
        longitude: spot.lng || spot.longitude,
        name: spot.name,
        address: spot.address,
        scale: 16
      })
    } else {
      wx.showToast({ title: '暂无坐标', icon: 'none' })
    }
  },

  onCall() {
    if (this.data.shop.phone) {
      wx.makePhoneCall({ phoneNumber: this.data.shop.phone })
    }
  },

  // 收藏/取消收藏
  onCollect() {
    const { spot } = this.data
    if (!spot) return
    
    let collects = util.loadData('userCollectedFoods', [])
    const index = collects.findIndex(id => String(id) === String(spot.id))
    let isCollected = false
    
    if (index > -1) {
      collects.splice(index, 1)
    } else {
      collects.push(spot.id)
      isCollected = true
    }
    wx.setStorageSync('userCollectedFoods', collects)
    
    this.setData({ isCollected })
    wx.showToast({
      title: isCollected ? '已收藏' : '已取消收藏',
      icon: 'none',
      duration: 1200
    })
  },

  // 添加到想去
  onWant() {
    const shopId = this.data.spot.id
    const isLiked = util.toggleLike(shopId, 'food')
    this.setData({ isLiked })

    wx.showToast({
      title: isLiked ? '已添加到想去' : '已移出想去',
      icon: 'none',
      duration: 1000
    })
  },

  onShareAppMessage() {
    const { spot } = this.data
    return {
      title: spot ? `${spot.name} · 美食详情` : '美食详情',
      path: spot ? `/pages/shop-detail/shop-detail?id=${spot.id}` : '/pages/index/index'
    }
  }
})
