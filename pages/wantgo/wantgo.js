// 觅食图 V1 - 想去清单页（支持美食/景点/到访，拖拽排序）
const app = getApp()
const util = require('../../utils/util')
const shopData = require('../../utils/shopData')

// 每项高度(px) = 卡片高度120rpx + gap 16rpx 换算
const ITEM_H = 60 // px，每项高度用于计算排序

Page({
  data: {
    // 当前Tab
    tab: 'want',
    titles: {
      want: '想去',
      plan: '路线',
      visited: '足迹'
    },
    // 数据
    items: [],
    empty: true,
    // 导航栏高度（动态计算）
    statusBarHeight: 44,
    navBarHeight: 88,
    tabBarTop: 88,
    contentTop: 108,
    // 拖拽状态
    dragging: false,
    dragIndex: -1,
    dragY: 0,
  },

  onLoad(options) {
    // 支持从外部传入 tab 参数
    const tab = options.tab || 'want'
    // 动态获取状态栏高度，解决刘海屏遮挡问题
    const sysInfo = wx.getSystemInfoSync()
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const menuTop = menuButtonInfo ? menuButtonInfo.top : (sysInfo.statusBarHeight || 44) + 4
    const menuHeight = menuButtonInfo ? menuButtonInfo.height : 32
    const menuRightInset = menuButtonInfo
      ? Math.max(sysInfo.windowWidth - menuButtonInfo.left + 8, 24)
      : 103
    
    // 顶部内容预留的高度（留出一些下边距）
    const contentTop = menuTop + menuHeight + 12
    
    this.setData({ 
      tab, 
      menuTop,
      menuHeight,
      menuRightInset,
      contentTop 
    })
  },

  // ─── 返回 ─────────────────────────────
  onBack() {
    wx.navigateBack({ fail: () => {
      wx.switchTab({ url: '/pages/index/index' })
    }})
  },

  // ─── 跳转首页 ─────────────────────────────
  onGoHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  onShow() {
    this._loadData()
  },

  // ─── Tab切换 ─────────────────────────────
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.tab) return
    this.setData({ tab, items: [], empty: true })
    this._loadData()
  },

  _loadData() {
    const { tab } = this.data
    let items = []

    if (tab === 'want') {
      // 想去页面暂为空白，后续开发
      this.setData({ items: [], empty: true })
    } else if (tab === 'plan') {
      const foodIds = util.loadData('userWantFoods', [])
      const spotIds = util.loadData('userWantSpots', [])
      
      const foods = shopData.foods || []
      const shops = shopData.shops || []
      const userShops = util.loadData('userAddedShops', [])
      const spots = util.getSpotData()
      
      const allFoodItems = [...shops, ...foods, ...userShops]
      
      const foodItems = foodIds.map(id => allFoodItems.find(s => String(s.id) === String(id))).filter(Boolean)
      const spotItems = spotIds.map(id => spots.find(s => String(s.id) === String(id))).filter(Boolean)
      
      items = [...foodItems, ...spotItems].map(item => {
        const baseWant = item.wantCount || 1024
        const actualWant = baseWant + 1 // 既然在想去列表里，那就是想去状态，人数+1
        let displayWantCount = actualWant
        if (actualWant >= 10000) {
          displayWantCount = (actualWant / 10000).toFixed(1).replace('.0', '') + 'w'
        } else if (actualWant >= 1000) {
          displayWantCount = (actualWant / 1000).toFixed(1).replace('.0', '') + 'k'
        }
        return { ...item, displayWantCount }
      })
      this.setData({ items, empty: items.length === 0 })
    } else {
      // 足迹
      const ids = util.loadData('userCheckedIn', [])
      const foods = shopData.foods || []
      const shops = shopData.shops || []
      const userShops = util.loadData('userAddedShops', [])
      const spots = util.getSpotData()
      const allItems = [...shops, ...foods, ...userShops, ...spots]
      
      // 统一用字符串比较
      items = ids.map(id => allItems.find(s => String(s.id) === String(id))).filter(Boolean).map(item => {
        const baseWant = item.wantCount || 1024
        let displayWantCount = baseWant
        if (baseWant >= 10000) {
          displayWantCount = (baseWant / 10000).toFixed(1).replace('.0', '') + 'w'
        } else if (baseWant >= 1000) {
          displayWantCount = (baseWant / 1000).toFixed(1).replace('.0', '') + 'k'
        }
        return { ...item, displayWantCount }
      })
      this.setData({ items, empty: items.length === 0 })
    }
  },

  // ─── 点击项目 ─────────────────────────────
  onItemTap(e) {
    const item = e.currentTarget.dataset.item
    
    // 判断是否为景点：根据 category 是否包含'景点'、'公园'等，或者是否存在特定的字段
    const isSpot = item.category === '景点' || item.category === '公园' || item.type === 'spot' || !item.price
    
    if (isSpot) {
      wx.navigateTo({ url: `/pages/spot-detail/spot-detail?id=${item.id}` })
    } else {
      const shopStr = encodeURIComponent(JSON.stringify(item))
      wx.navigateTo({ url: `/pages/shop-detail/shop-detail?shopData=${shopStr}&id=${item.id}` })
    }
  },

  // ─── 拖拽开始（长按）────────────────────────────
  onDragStart(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ dragging: true, dragIndex: index })
    wx.vibrateShort()
  },

  // ─── 拖拽移动 ─────────────────────────────
  onDragMove(e) {
    const { dragIndex, items } = this.data
    if (dragIndex < 0 || items.length <= 1) return

    const touchY = e.touches[0].clientY
    const startY = this.data.touchStartY || touchY
    const deltaY = touchY - startY
    const step = Math.round(deltaY / ITEM_H)
    let targetIndex = dragIndex + step
    targetIndex = Math.max(0, Math.min(items.length - 1, targetIndex))

    if (targetIndex !== dragIndex) {
      const newItems = [...items]
      const [moved] = newItems.splice(dragIndex, 1)
      newItems.splice(targetIndex, 0, moved)
      this.setData({ items: newItems, dragIndex: targetIndex })
    }
  },

  // ─── 拖拽结束 ─────────────────────────────
  onDragEnd() {
    const { tab, items } = this.data
    if (!this.data.dragging) return
    // 保存排序后的顺序
    if (tab === 'plan') {
      // 区分出 spot 和 food 并分别保存
      const spotIds = items.filter(item => item.category === '景点' || item.category === '公园' || item.type === 'spot' || !item.price).map(s => s.id)
      const foodIds = items.filter(item => !(item.category === '景点' || item.category === '公园' || item.type === 'spot' || !item.price)).map(s => s.id)
      util.saveData('userWantSpots', spotIds)
      util.saveData('userWantFoods', foodIds)
    }
    this.setData({ dragging: false, dragIndex: -1 })
  },

  // ─── 导航 ─────────────────────────────
  onNavigate(e) {
    const item = e.currentTarget.dataset.item
    e.stopPropagation()
    const lat = item.lat || item.latitude
    const lng = item.lng || item.longitude
    if (lat && lng) {
      wx.openLocation({ latitude: lat, longitude: lng, name: item.name, scale: 16 })
    } else {
      wx.showToast({ title: '暂无坐标', icon: 'none' })
    }
  },

  // ─── 移除想去 ─────────────────────────────
  onRemove(e) {
    e.stopPropagation()
    const id = e.currentTarget.dataset.id
    const { items } = this.data
    const item = items.find(i => i.id === id)
    if (!item) return

    const isSpot = item.category === '景点' || item.category === '公园' || item.type === 'spot' || !item.price
    const type = isSpot ? 'spot' : 'food'
    util.toggleLike(id, type)
    this._loadData()
    wx.showToast({ title: '已移除', icon: 'none', duration: 1000 })
  },

  // ─── 规划路线 ─────────────────────────────
  onPlanRoute() {
    const { items, tab } = this.data
    if (items.length === 0) {
      wx.showToast({ title: '清单为空', icon: 'none' })
      return
    }
    const ids = items.map(i => i.id).join(',')
    // 如果是合并列表，传递 type 为 plan，在 route 页内可能需要额外处理。
    // 目前 route 页是根据 ids 在全局里查找对应的点，所以传混合 ids 应该也可以。
    wx.navigateTo({ url: `/pages/route/route?type=plan&ids=${ids}` })
  },

  onGoHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  onBack() {
    wx.navigateBack()
  }
})
