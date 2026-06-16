// pages/my-favorites/my-favorites.js
const app = getApp()
const placesData = require('../../../../utils/placesData')
const util = require('../../../../utils/util')
const { resolveDisplayCategory } = require('../../../../utils/displayCategory')

const DEFAULT_CENTER = {
  lat: 22.4846,
  lng: 113.9046
}

// 把“想去人数”格式化成更短的展示形式。
// 例如 1200 -> 1.2k，12000 -> 1.2w。
function formatWantCount(count) {
  const value = Number(count) || 1024
  if (value >= 10000) {
    return (value / 10000).toFixed(1).replace('.0', '') + 'w'
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1).replace('.0', '') + 'k'
  }
  return String(value)
}

Page({
  data: {
    // 数据
    allList: [],
    
    // 空状态
    showEmpty: false,
    emptyText: ''
  },

  onLoad() {
    this.initNavigationBar()
  },

  onShow() {
    this.loadData()
  },

  // 初始化导航栏
  initNavigationBar() {
    const windowInfo = wx.getWindowInfo()
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const menuTop = menuButtonInfo ? menuButtonInfo.top : (windowInfo.statusBarHeight || 44) + 4
    const menuHeight = menuButtonInfo ? menuButtonInfo.height : 32

    this.setData({
      statusBarHeight: windowInfo.statusBarHeight || 44,
      menuTop,
      menuHeight
    })
  },

  // 加载收藏数据
  loadData() {
    // 加载收藏的美食ID
    const collectedFoodIds = util.loadData('userCollectedFoods', [])
    // 加载收藏的景点ID
    const collectedSpotIds = util.loadData('userCollectedSpots', [])

    // 构建所有美食数据
    const userAddedShops = util.loadData('userAddedShops', [])
    const allFoods = [...placesData.getFoods(), ...userAddedShops]
    
    // 构建所有景点数据
    const allSpots = placesData.getSpots()

    // 筛选已收藏的商业类（美食、饮品、购物、酒店）
    const businessCategoryList = collectedFoodIds
      .map(id => {
        const item = allFoods.find(f => String(f.id) === String(id))
        if (item) {
          const distance = util.getDistance(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng, item.lat || DEFAULT_CENTER.lat, item.lng || DEFAULT_CENTER.lng)
          // 标签最多只显示 2 个，避免撑破卡片布局。
          const filteredTags = (item.tags || []).filter(tag => !tag.endsWith('区')).slice(0, 2)
          return {
            ...item,
            tags: filteredTags,
            displayCategory: item.displayCategory || resolveDisplayCategory(item),
            displayWantCount: formatWantCount(item.wantCount),
            distance,
            distanceText: util.formatDistance(distance),
            type: item.type || 'food'
          }
        }
        return null
      })
      .filter(Boolean)

    // 筛选已收藏的景点类（景点、文化展馆、自然户外）
    const attractionCategoryList = collectedSpotIds
      .map(id => {
        const item = allSpots.find(s => String(s.id) === String(id))
        if (item) {
          const distance = util.getDistance(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng, item.lat || DEFAULT_CENTER.lat, item.lng || DEFAULT_CENTER.lng)
          // 标签最多只显示 2 个，和探索页保持一致。
          const filteredTags = (item.tags || []).filter(tag => !tag.endsWith('区')).slice(0, 2)
          return {
            ...item,
            displayImage: item.coverImage,
            displayCategory: resolveDisplayCategory(item),
            displayWantCount: formatWantCount(item.wantCount),
            distance,
            distanceText: util.formatDistance(distance),
            tags: filteredTags,
            type: item.type || 'spot'
          }
        }
        return null
      })
      .filter(Boolean)

    // 合并后再按距离排序，让离用户更近的收藏排在前面。
    const allList = [...businessCategoryList, ...attractionCategoryList]
      .sort((a, b) => (a.distance || 0) - (b.distance || 0))

    this.setData({
      allList,
      showEmpty: allList.length === 0,
      emptyText: '去探索页收藏喜欢的地点吧'
    })
  },

  // 点击返回
  onBack() {
    wx.navigateBack()
  },

  // 点击收藏项
  onItemTap(e) {
    const item = e.currentTarget.dataset.item
    if (!item) return

    if (item.type === 'spot') {
      wx.navigateTo({ url: `/subpackages/extra/pages/spot-detail/spot-detail?id=${item.id}` })
    } else {
      wx.navigateTo({
        url: `/subpackages/extra/pages/shop-detail/shop-detail?shopData=${encodeURIComponent(JSON.stringify(item))}`
      })
    }
  },

  // 取消收藏
  onRemoveCollect(e) {
    const item = e.currentTarget.dataset.item
    if (!item) return

    const key = item.type === 'spot' ? 'userCollectedSpots' : 'userCollectedFoods'
    let collects = util.loadData(key, [])
    
    collects = collects.filter(id => String(id) !== String(item.id))
    util.saveData(key, collects)

    wx.showToast({
      title: '已取消收藏',
      icon: 'none',
      duration: 1000
    })

    // 重新加载数据
    setTimeout(() => {
      this.loadData()
    }, 500)
  },

  // 图片加载失败
  onImageError(e) {
    const index = e.currentTarget.dataset.index
    const key = `allList[${index}].displayImage`
    this.setData({ [key]: '/images/app-logo.jpg' })
  }
})
