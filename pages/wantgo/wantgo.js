// 觅食图 V1 - 想去清单页（支持美食/景点/到访，拖拽排序）
const app = getApp()
const util = require('../../utils/util')
const shopData = require('../../utils/shopData')

// 每项高度(px) = 卡片高度120rpx + gap 16rpx 换算
const ITEM_H = 60 // px，每项高度用于计算排序

Page({
  data: {
    // 当前Tab
    tab: 'food',
    titles: {
      food: '想去的美食',
      spot: '想去的景点',
      visited: '已到访'
    },
    // 数据
    items: [],
    empty: true,
    // 导航栏高度（动态计算）
    statusBarHeight: 44,
    navBarHeight: 88,
    tabBarTop: 88,
    contentTop: 132,
    // 拖拽状态
    dragging: false,
    dragIndex: -1,
    dragY: 0,
  },

  onLoad(options) {
    // 支持从外部传入 tab 参数
    const tab = options.tab || 'food'
    // 动态获取状态栏高度，解决刘海屏遮挡问题
    const { statusBarHeight } = wx.getSystemInfoSync()
    const navBarHeight = statusBarHeight + 44 // 状态栏 + 导航栏内容区
    const tabBarTop = navBarHeight            // Tab栏紧跟导航栏
    const contentTop = navBarHeight + 44      // 内容区在Tab栏下方
    this.setData({ tab, navBarHeight, statusBarHeight, tabBarTop, contentTop })
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
    let ids = []
    let allItems = []

    if (tab === 'food') {
      ids = util.loadData('userWantFoods', [])
      const foods = shopData.foods || []
      const shops = shopData.shops || []
      const userShops = util.loadData('userAddedShops', [])
      allItems = [...shops, ...foods, ...userShops]
      // 统一用字符串比较，避免类型不一致
      const items = ids.map(id => allItems.find(s => String(s.id) === String(id))).filter(Boolean)
      this.setData({ items, empty: items.length === 0 })
    } else if (tab === 'spot') {
      ids = util.loadData('userWantSpots', [])
      const spots = util.getSpotData()
      // 统一用字符串比较
      const items = ids.map(id => spots.find(s => String(s.id) === String(id))).filter(Boolean)
      this.setData({ items, empty: items.length === 0 })
    } else {
      // 已到访
      ids = util.loadData('userCheckedIn', [])
      const foods = shopData.foods || []
      const shops = shopData.shops || []
      const userShops = util.loadData('userAddedShops', [])
      const spots = util.getSpotData()
      allItems = [...shops, ...foods, ...userShops, ...spots]
      // 统一用字符串比较
      const items = ids.map(id => allItems.find(s => String(s.id) === String(id))).filter(Boolean)
      this.setData({ items, empty: items.length === 0 })
    }
  },

  // ─── 点击项目 ─────────────────────────────
  onItemTap(e) {
    const item = e.currentTarget.dataset.item
    const { tab } = this.data
    if (tab === 'spot') {
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
    if (tab === 'spot') {
      util.saveData('userWantSpots', items.map(s => s.id))
    } else if (tab === 'food') {
      util.saveData('userWantFoods', items.map(s => s.id))
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
    const { tab } = this.data
    const type = tab === 'spot' ? 'spot' : 'food'
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
    const type = tab === 'spot' ? 'spot' : 'food'
    const ids = items.map(i => i.id).join(',')
    wx.navigateTo({ url: `/pages/route/route?type=${type}&ids=${ids}` })
  },

  onGoHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  onBack() {
    wx.navigateBack()
  }
})
