// pages/my-favorites/my-favorites.js
const app = getApp()
const shopData = require('../../utils/shopData')
const spotData = require('../../utils/spotData')
const util = require('../../utils/util')

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
    const sysInfo = wx.getSystemInfoSync()
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const menuTop = menuButtonInfo ? menuButtonInfo.top : (sysInfo.statusBarHeight || 44) + 4
    const menuHeight = menuButtonInfo ? menuButtonInfo.height : 32

    this.setData({
      statusBarHeight: sysInfo.statusBarHeight || 44,
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
    const allFoods = [...(shopData.shops || []), ...(shopData.foods || []), ...userAddedShops]
    
    // 构建所有景点数据
    const allSpots = spotData.spotData || []

    // 筛选已收藏的美食
    const foodList = collectedFoodIds
      .map(id => {
        const food = allFoods.find(f => String(f.id) === String(id))
        if (food) {
          return {
            ...food,
            displayImage: food.logo || food.image || food.thumb,
            displayCategory: food.category || '美食',
            type: 'food'
          }
        }
        return null
      })
      .filter(Boolean)

    // 筛选已收藏的景点
    const spotList = collectedSpotIds
      .map(id => {
        const spot = allSpots.find(s => String(s.id) === String(id))
        if (spot) {
          return {
            ...spot,
            displayImage: spot.image || spot.logo || spot.thumb,
            displayCategory: spot.category || '景点',
            type: 'spot'
          }
        }
        return null
      })
      .filter(Boolean)

    // 合并列表
    const allList = [...foodList, ...spotList]

    this.setData({
      allList,
      showEmpty: allList.length === 0,
      emptyText: '还没有收藏哦～\n去探索页发现喜欢的美食和景点吧'
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
      wx.navigateTo({ url: `/pages/spot-detail/spot-detail?id=${item.id}` })
    } else {
      wx.navigateTo({
        url: `/pages/shop-detail/shop-detail?shopData=${encodeURIComponent(JSON.stringify(item))}`
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
