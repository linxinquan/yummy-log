const app = getApp()
const shopData = require('../../utils/shopData')
const util = require('../../utils/util')

function normalizeName(value) {
  return String(value || '')
    .replace(/\s+/g, '')
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[·•]/g, '')
    .replace(/店$/g, '')
    .toLowerCase()
}

function buildAllFoodItems() {
  const userAddedShops = util.loadData('userAddedShops', [])
  return [...(shopData.shops || []), ...(shopData.foods || []), ...userAddedShops]
}

function matchShop(name, allItems) {
  const aliasMap = shopData.shopNameMap || {}
  const aliasTarget = aliasMap[name]
  if (aliasTarget) {
    return allItems.find(item => item.name === aliasTarget) || null
  }

  const normalized = normalizeName(name)
  return allItems.find(item => {
    const itemName = normalizeName(item.name)
    return itemName === normalized || itemName.includes(normalized) || normalized.includes(itemName)
  }) || null
}

Page({
  data: {
    guide: null,
    matchedShops: [],
    unmatchedShopNames: [],
    menuTop: 0,
    menuHeight: 32,
    isLiked: false,
    isCollected: false,
    displayAvatars: [],
    wantStatText: '',
  },

  onLoad(options) {
    const sysInfo = wx.getSystemInfoSync()
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const menuTop = menuButtonInfo ? menuButtonInfo.top : (sysInfo.statusBarHeight || 44) + 4
    const menuHeight = menuButtonInfo ? menuButtonInfo.height : 32

    if (!options.guide) {
      wx.showToast({ title: '攻略不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack({ delta: 1 }), 1200)
      return
    }

    const guide = JSON.parse(decodeURIComponent(options.guide))
    const tags = Array.isArray(guide.tags) ? guide.tags : (guide.tag ? [guide.tag] : [])
    const shopNames = Array.isArray(guide.shops) ? guide.shops : []
    const allItems = buildAllFoodItems()
    const matchedShops = []
    const unmatchedShopNames = []

    shopNames.forEach(name => {
      const shop = matchShop(name, allItems)
      if (shop) {
        matchedShops.push(shop)
      } else {
        unmatchedShopNames.push(name)
      }
    })

    const isLiked = util.loadData('userWantGuides', []).some(id => String(id) === String(guide.id))
    const isCollected = util.loadData('userCollectedGuides', []).some(id => String(id) === String(guide.id))

    const displayAvatars = [
      ...matchedShops.map(item => item.logo || item.image || item.thumb).filter(Boolean),
      guide.coverImage || '/images/app-logo.jpg'
    ].slice(0, 6)

    this.setData({
      guide: {
        ...guide,
        tags,
        shops: shopNames
      },
      matchedShops,
      unmatchedShopNames,
      menuTop,
      menuHeight,
      isLiked,
      isCollected,
      displayAvatars,
      wantStatText: `${shopNames.length} 家店铺 · ${guide.author || '匿名'} 发布`
    })
  },

  onBack() {
    wx.navigateBack()
  },

  onShareTap() {
    wx.showToast({ title: '请点击右上角分享', icon: 'none' })
  },

  // 收藏/取消收藏
  onCollect() {
    const { guide } = this.data
    if (!guide) return
    
    let collects = util.loadData('userCollectedGuides', [])
    const index = collects.findIndex(id => String(id) === String(guide.id))
    let isCollected = false
    
    if (index > -1) {
      collects.splice(index, 1)
    } else {
      collects.push(guide.id)
      isCollected = true
    }
    wx.setStorageSync('userCollectedGuides', collects)
    
    this.setData({ isCollected })
    wx.showToast({
      title: isCollected ? '已收藏' : '已取消收藏',
      icon: 'none',
      duration: 1200
    })
  },

  // 想去/取消想去
  onWant() {
    const { guide } = this.data
    if (!guide) return
    
    let wants = util.loadData('userWantGuides', [])
    const index = wants.findIndex(id => String(id) === String(guide.id))
    let isLiked = false
    
    if (index > -1) {
      wants.splice(index, 1)
    } else {
      wants.push(guide.id)
      isLiked = true
    }
    wx.setStorageSync('userWantGuides', wants)
    
    this.setData({ isLiked })
    wx.showToast({
      title: isLiked ? '已添加到想去' : '已移出想去',
      icon: 'none',
      duration: 1200
    })
  },

  // 跳转到店铺详情
  onShopTap(e) {
    const shop = e.currentTarget.dataset.shop
    if (!shop) return
    wx.navigateTo({
      url: `/pages/shop-detail/shop-detail?shopData=${encodeURIComponent(JSON.stringify(shop))}`
    })
  },

  // 更多：跳回首页
  onFindFood() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  onShareAppMessage() {
    const { guide } = this.data
    return {
      title: guide ? `${guide.title} · 攻略详情` : '攻略详情',
      path: guide ? `/pages/guide-detail/guide-detail?guide=${encodeURIComponent(JSON.stringify(guide))}` : '/pages/index/index'
    }
  }
})