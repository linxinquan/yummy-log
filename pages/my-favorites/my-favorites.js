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

    // 添加假数据（文化展馆、自然户外、购物、酒店）
    const cultureData = [
      { id: 901, name: '深圳美术馆', category: '文化展馆', type: 'culture', lat: 22.5436, lng: 114.079, rating: 4.5, tags: ['展览', '艺术'], image: '/images/covers/01.jpeg', displayImage: '/images/covers/01.jpeg' },
      { id: 902, name: '关山月美术馆', category: '文化展馆', type: 'culture', lat: 22.541, lng: 114.038, rating: 4.6, tags: ['国画', '收藏'], image: '/images/covers/02.jpeg', displayImage: '/images/covers/02.jpeg' },
      { id: 903, name: '深圳音乐厅', category: '文化展馆', type: 'culture', lat: 22.544, lng: 114.042, rating: 4.7, tags: ['演出', '音乐'], image: '/images/covers/03.jpeg', displayImage: '/images/covers/03.jpeg' },
      { id: 904, name: '何香凝美术馆', category: '文化展馆', type: 'culture', lat: 22.532, lng: 113.986, rating: 4.4, tags: ['美术', '展览'], image: '/images/covers/04.jpeg', displayImage: '/images/covers/04.jpeg' },
    ]
    const outdoorData = [
      { id: 911, name: '梧桐山国家森林公园', category: '自然户外', type: 'outdoor', lat: 22.624, lng: 114.198, rating: 4.8, tags: ['登山', '观景'], image: '/images/covers/01.jpeg', displayImage: '/images/covers/01.jpeg' },
      { id: 912, name: '塘朗山郊野公园', category: '自然户外', type: 'outdoor', lat: 22.542, lng: 113.958, rating: 4.5, tags: ['徒步', '骑行'], image: '/images/covers/02.jpeg', displayImage: '/images/covers/02.jpeg' },
      { id: 913, name: '深圳湾公园', category: '自然户外', type: 'outdoor', lat: 22.498, lng: 113.914, rating: 4.7, tags: ['滨海', '跑步'], image: '/images/covers/03.jpeg', displayImage: '/images/covers/03.jpeg' },
      { id: 914, name: '梅林水库', category: '自然户外', type: 'outdoor', lat: 22.568, lng: 114.032, rating: 4.6, tags: ['水库', '徒步'], image: '/images/covers/04.jpeg', displayImage: '/images/covers/04.jpeg' },
    ]
    const shoppingData = [
      { id: 921, name: '华润万象城', category: '购物', type: 'shopping', lat: 22.541, lng: 114.063, rating: 4.8, tags: ['高端', '奢侈品'], image: '/images/covers/01.jpeg', displayImage: '/images/covers/01.jpeg' },
      { id: 922, name: '海岸城', category: '购物', type: 'shopping', lat: 22.489, lng: 113.921, rating: 4.6, tags: ['餐饮', '娱乐'], image: '/images/covers/02.jpeg', displayImage: '/images/covers/02.jpeg' },
      { id: 923, name: '东门老街', category: '购物', type: 'shopping', lat: 22.543, lng: 114.078, rating: 4.5, tags: ['老街', '小吃'], image: '/images/covers/03.jpeg', displayImage: '/images/covers/03.jpeg' },
      { id: 924, name: '益田假日广场', category: '购物', type: 'shopping', lat: 22.535, lng: 113.988, rating: 4.7, tags: ['品牌', '餐饮'], image: '/images/covers/04.jpeg', displayImage: '/images/covers/04.jpeg' },
    ]
    const hotelData = [
      { id: 931, name: '深圳华侨城洲际大酒店', category: '酒店', type: 'hotel', lat: 22.538, lng: 113.989, rating: 4.8, tags: ['五星', '豪华'], image: '/images/covers/01.jpeg', displayImage: '/images/covers/01.jpeg', price: 1280 },
      { id: 932, name: '深圳湾安达仕酒店', category: '酒店', type: 'hotel', lat: 22.501, lng: 113.912, rating: 4.9, tags: ['海景', '高端'], image: '/images/covers/02.jpeg', displayImage: '/images/covers/02.jpeg', price: 1580 },
      { id: 933, name: '深圳柏悦酒店', category: '酒店', type: 'hotel', lat: 22.542, lng: 114.061, rating: 4.7, tags: ['商务', '舒适'], image: '/images/covers/03.jpeg', displayImage: '/images/covers/03.jpeg', price: 980 },
      { id: 934, name: '深圳大鹏古城民宿', category: '酒店', type: 'hotel', lat: 22.628, lng: 114.335, rating: 4.6, tags: ['民宿', '古村'], image: '/images/covers/04.jpeg', displayImage: '/images/covers/04.jpeg', price: 380 },
    ]

    // 合并所有数据
    const allFoodsExtended = [...allFoods, ...shoppingData, ...hotelData]
    const allSpotsExtended = [...allSpots, ...cultureData, ...outdoorData]

    // 筛选已收藏的美食
    const foodList = collectedFoodIds
      .map(id => {
        const food = allFoodsExtended.find(f => String(f.id) === String(id))
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
        const spot = allSpotsExtended.find(s => String(s.id) === String(id))
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
