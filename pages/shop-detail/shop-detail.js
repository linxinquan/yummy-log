// 觅食图 - 店铺详情页
// 这个页面复用了景点详情页的模板，所以这里主要负责把“店铺数据”
// 转成那个模板能直接使用的格式。
const shopData = require('../../utils/shopData')
const spotData = require('../../utils/spotData')
const util = require('../../utils/util')

// 读取系统里所有可作为“美食详情”来源的店铺。
function buildAllFoodItems() {
  const userAddedShops = util.loadData('userAddedShops', [])
  return [...(shopData.shops || []), ...(shopData.foods || []), ...userAddedShops]
}

// 给“推荐菜”准备封面图池。
// 如果菜品本身没有图，就从现有美食/景点图片里兜底取。
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
    isFoodDetail: true,
    navMapSheetVisible: false,
    navMapTarget: null
  },

  // 页面初始化：
  // 1. 找到当前店铺
  // 2. 转成详情模板通用字段
  // 3. 加载地图、收藏状态、推荐菜
  onLoad(options) {
    const sysInfo = wx.getSystemInfoSync()
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const menuTop = menuButtonInfo ? menuButtonInfo.top : (sysInfo.statusBarHeight || 44) + 4
    const menuHeight = menuButtonInfo ? menuButtonInfo.height : 32
    const menuRightInset = menuButtonInfo
      ? Math.max(sysInfo.windowWidth - menuButtonInfo.left + 8, 24)
      : 103

    // 兼容多种进入方式：直接传对象、传 shopData、只传 id。
    const shop = this.resolveShop(options)
    if (!shop) {
      wx.showToast({ title: '店铺不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack({ delta: 1 }), 1200)
      return
    }

    const coverImage = shop.logo || shop.image || shop.thumb || '/images/app-logo.jpg'
    const hoursText = shop.hours || '暂无营业时间'
    const priceText = shop.price ? `￥${shop.price}/人` : '暂无均价'

    // 因为模板复用了 spot-detail，所以这里把店铺数据改造成同一套字段。
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

  // 统一解析页面参数，尽量找到当前店铺对象。
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

  // 初始化地图标记点
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

  // 读取当前用户对这家店的想去/收藏状态
  loadUserData(shopId) {
    const likedIds = util.loadData('userWantFoods', [])
    const collectedIds = util.loadData('userCollectedFoods', [])
    
    this.setData({
      isLiked: likedIds.some(id => String(id) === String(shopId)),
      isCollected: collectedIds.some(id => String(id) === String(shopId))
    })
  },

  // 这里预留图片报错回调，当前不需要特殊处理。
  onImageError() {},

  // 美食详情页底部显示的是“推荐菜”，不是附近美食。
  // 所以这里把 dishes 数组转换成卡片数据。
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

  // 返回上一页
  onBack() {
    wx.navigateBack()
  },

  // 提示用户使用系统分享
  onShareTap() {
    wx.showToast({ title: '请点击右上角分享', icon: 'none' })
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
        address: spot.address || spot.name
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
        address: spot.address,
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

  // 有电话时直接拨号
  onCall() {
    if (this.data.shop.phone) {
      wx.makePhoneCall({ phoneNumber: this.data.shop.phone })
    }
  },

  // 收藏/取消收藏当前店铺
  onCollect() {
    const { spot } = this.data
    if (!spot) return
    if (!util.requireLogin()) return
    
    const isCollected = util.toggleCollect(spot.id, 'food')
    
    this.setData({ isCollected })
    wx.showToast({
      title: isCollected ? '已收藏' : '已取消收藏',
      icon: 'none',
      duration: 1200
    })
  },

  // 添加到想去 / 取消想去
  onWant() {
    const shopId = this.data.spot.id
    if (!util.requireLogin()) return
    const isLiked = util.toggleLike(shopId, 'food')
    this.setData({ isLiked })

    wx.showToast({
      title: isLiked ? '已添加到想去' : '已移出想去',
      icon: 'none',
      duration: 1000
    })
  },

  // 小程序右上角分享文案
  onShareAppMessage() {
    const { spot } = this.data
    return {
      title: spot ? `${spot.name} · 美食详情` : '美食详情',
      path: spot ? `/pages/shop-detail/shop-detail?id=${spot.id}` : '/pages/index/index'
    }
  }
})
