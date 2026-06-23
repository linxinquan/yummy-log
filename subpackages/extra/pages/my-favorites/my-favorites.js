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
  async loadData() {
    // 加载所有收藏 ID（不区分类型）
    const allCollectedIds = await util.getCollectedListAsync()

    const userAddedShops = await util.getUserShopsAsync()

    // 用 getPlaceById 跨类型查找，避免 type 字段不匹配漏掉
    const findItem = (id) => {
      const fromPlaces = placesData.getPlaceById(id)
      if (fromPlaces) return fromPlaces
      return userAddedShops.find(s => String(s.id) === String(id))
    }

    // 统一查找、构建卡片、按距离排序
    const seen = new Set()
    const allList = allCollectedIds
      .map(id => {
        const item = findItem(id)
        if (!item) return null
        // 防重复
        const key = String(item.id)
        if (seen.has(key)) return null
        seen.add(key)

        const distance = util.getDistance(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng, item.lat || DEFAULT_CENTER.lat, item.lng || DEFAULT_CENTER.lng)
        const filteredTags = (item.tags || []).filter(tag => !tag.endsWith('区')).slice(0, 2)
        return {
          ...item,
          tags: filteredTags,
          displayCategory: item.displayCategory || resolveDisplayCategory(item),
          displayWantCount: formatWantCount(item.wantCount),
          distance,
          distanceText: util.formatDistance(distance),
        }
      })
      .filter(Boolean)
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

    wx.navigateTo({ url: `/subpackages/extra/pages/spot-detail/spot-detail?id=${item.id}` })
  },

  // 取消收藏
  async onRemoveCollect(e) {
    const item = e.currentTarget.dataset.item
    if (!item) return

    await util.toggleCollectAsync(item.id)

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
    const key = `allList[${index}].coverImage`
    this.setData({ [key]: '/images/app-logo.jpg' })
  }
})
