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
    menuHeight: 32
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

    this.setData({
      guide: {
        ...guide,
        tags,
        shops: shopNames
      },
      matchedShops,
      unmatchedShopNames,
      menuTop,
      menuHeight
    })
  },

  onBack() {
    wx.navigateBack()
  },

  onShareTap() {
    wx.showToast({ title: '请点击右上角分享', icon: 'none' })
  },

  onShopTap(e) {
    const shop = e.currentTarget.dataset.shop
    if (!shop) return
    wx.navigateTo({
      url: `/pages/shop-detail/shop-detail?shopData=${encodeURIComponent(JSON.stringify(shop))}`
    })
  }
})