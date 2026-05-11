// 觅食图 V1 - 想去清单页（支持美食/景点/到访，拖拽排序）
const app = getApp()
const util = require('../../utils/util')
const shopData = require('../../utils/shopData')
const { applyTravelMeta, buildTravelOptions } = require('../../utils/travel')

// 每项高度(px) = 卡片高度120rpx + gap 16rpx 换算
const ITEM_H = 60 // px，每项高度用于计算排序
const DEFAULT_COVER = '/images/covers/01.jpeg'
const DAY_OPTIONS = Array.from({ length: 30 }, (_, index) => index + 1)
const DELETE_ACTION_WIDTH_RPX = 144

function withSwipeState(items) {
  return (items || []).map(item => ({
    ...item,
    swipeOffset: 0
  }))
}

function closeSwipeItems(items, keepIndex = -1) {
  let changed = false
  const nextItems = (items || []).map((item, index) => {
    if (index !== keepIndex && item && item.swipeOffset) {
      changed = true
      return {
        ...item,
        swipeOffset: 0
      }
    }
    return item
  })
  return { nextItems, changed }
}

function isSpotItem(item) {
  return item.category === '景点' || item.category === '公园' || item.type === 'spot' || !item.price
}

function inferTagText(item) {
  if (isSpotItem(item)) {
    if ((item.category || '').includes('展馆') || (item.name || '').includes('博物馆')) {
      return '文化展馆'
    }
    return '景点'
  }
  return '美食'
}

function buildSyntheticLatLng(basePoint, index) {
  const seed = index + 1
  return {
    lat: Number((basePoint.lat + seed * 0.0023).toFixed(6)),
    lng: Number((basePoint.lng + seed * 0.0021).toFixed(6))
  }
}

function buildPreviewItems(items) {
  const basePoint = app.globalData.location || app.globalData.centerLocation || { lat: 22.4846, lng: 113.9046 }
  const prepared = (items || []).map((item, index) => {
    const lat = item.lat || item.latitude
    const lng = item.lng || item.longitude
    const fallback = buildSyntheticLatLng(basePoint, index)
    return {
      ...item,
      lat: lat || fallback.lat,
      lng: lng || fallback.lng,
      coverImage: item.logo || item.image || item.thumb || DEFAULT_COVER,
      tagText: inferTagText(item)
    }
  })

  const routeItems = util.planRoute(prepared.map(item => ({ ...item })), basePoint, true)
  return routeItems.map(item => applyTravelMeta(item, item.travelMode))
}

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
    transportSheetVisible: false,
    transportOptions: [],
    pendingTransportMode: 'walk',
    transportTargetIndex: -1,
    planDaySheetVisible: false,
    dayOptions: DAY_OPTIONS,
    selectedPlanDayCount: 1,
    selectedPlanDayIndex: 0,
    deleteActionWidthPx: 72
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
    const listTop = contentTop + 25
    const deleteActionWidthPx = sysInfo.windowWidth * DELETE_ACTION_WIDTH_RPX / 750
    
    this.setData({ 
      tab, 
      menuTop,
      menuHeight,
      menuRightInset,
      contentTop,
      listTop,
      deleteActionWidthPx
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
    const pendingTab = wx.getStorageSync('pendingWantgoTab')
    if (pendingTab) {
      wx.removeStorageSync('pendingWantgoTab')
      this.setData({ tab: pendingTab, items: [], empty: true })
    }
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
      const foodIds = util.loadData('userWantFoods', [])
      const spotIds = util.loadData('userWantSpots', [])
      
      const foods = shopData.foods || []
      const shops = shopData.shops || []
      const userShops = util.loadData('userAddedShops', [])
      const spots = util.getSpotData()
      
      const allFoodItems = [...shops, ...foods, ...userShops]
      
      const foodItems = foodIds.map(id => allFoodItems.find(s => String(s.id) === String(id))).filter(Boolean)
      const spotItems = spotIds.map(id => spots.find(s => String(s.id) === String(id))).filter(Boolean)
      
      items = withSwipeState(buildPreviewItems([...foodItems, ...spotItems]))
      this.setData({ items, empty: items.length === 0 })
    } else if (tab === 'plan') {
      const savedRoutes = util.loadData('savedRoutes', [])
      this.setData({ items: savedRoutes, empty: savedRoutes.length === 0 })
    } else {
      // 足迹
      const ids = util.loadData('userCheckedIn', [])
      const foods = shopData.foods || []
      const shops = shopData.shops || []
      const userShops = util.loadData('userAddedShops', [])
      const spots = util.getSpotData()
      const allItems = [...shops, ...foods, ...userShops, ...spots]
      
      // 统一用字符串比较
      items = withSwipeState(buildPreviewItems(ids.map(id => allItems.find(s => String(s.id) === String(id))).filter(Boolean)))
      this.setData({ items, empty: items.length === 0 })
    }
  },

  // ─── 点击路线卡片 ─────────────────────────────
  onRouteCardTap(e) {
    const route = e.currentTarget.dataset.route
    const routeStr = encodeURIComponent(JSON.stringify(route))
    wx.navigateTo({ url: `/pages/my-route/my-route?route=${routeStr}` })
  },

  // ─── 点击项目 ─────────────────────────────
  onItemTap(e) {
    if (this.data.tab === 'want') {
      const index = parseInt(e.currentTarget.dataset.index, 10)
      const items = this.data.items || []
      const tappedItem = items[index]
      const hasOpenItem = items.some(item => item && item.swipeOffset)
      if (Date.now() - (this._lastSwipeTime || 0) < 250) {
        return
      }
      if (hasOpenItem) {
        const { nextItems } = closeSwipeItems(items)
        this.setData({ items: nextItems })
        if (tappedItem && tappedItem.swipeOffset) {
          return
        }
      }
    }

    const item = e.currentTarget.dataset.item
    
    // 判断是否为景点：根据 category 是否包含'景点'、'公园'等，或者是否存在特定的字段
    const isSpot = isSpotItem(item)
    
    if (isSpot) {
      wx.navigateTo({ url: `/pages/spot-detail/spot-detail?id=${item.id}` })
    } else {
      const shopStr = encodeURIComponent(JSON.stringify(item))
      wx.navigateTo({ url: `/pages/shop-detail/shop-detail?shopData=${shopStr}&id=${item.id}` })
    }
  },

  onOpenTransportSheet(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10)
    const item = (this.data.items || [])[index]
    if (!item) return
    this.setData({
      transportSheetVisible: true,
      transportOptions: buildTravelOptions(item.distanceFromPrev || 0),
      pendingTransportMode: item.travelMode || (item.travelMeta && item.travelMeta.mode) || 'walk',
      transportTargetIndex: index
    })
  },

  onCloseTransportSheet() {
    this.setData({ transportSheetVisible: false, transportTargetIndex: -1 })
  },

  onCardTouchStart(e) {
    if (this.data.tab !== 'want') return
    const index = parseInt(e.currentTarget.dataset.index, 10)
    const touch = e.touches && e.touches[0]
    if (Number.isNaN(index) || !touch) return

    const items = this.data.items || []
    const currentItem = items[index]
    const { nextItems, changed } = closeSwipeItems(items, index)
    if (changed) {
      this.setData({ items: nextItems })
    }

    this._swipeGesture = {
      index,
      startX: touch.clientX,
      startY: touch.clientY,
      startOffset: (currentItem && currentItem.swipeOffset) || 0,
      isHorizontal: false,
      locked: false,
      moved: false
    }
  },

  onCardTouchMove(e) {
    if (this.data.tab !== 'want' || !this._swipeGesture) return
    const touch = e.touches && e.touches[0]
    if (!touch) return

    const gesture = this._swipeGesture
    const deltaX = touch.clientX - gesture.startX
    const deltaY = touch.clientY - gesture.startY

    if (!gesture.isHorizontal && !gesture.locked) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        gesture.locked = true
        return
      }
      gesture.isHorizontal = true
    }

    if (!gesture.isHorizontal) return

    const items = [...(this.data.items || [])]
    const currentItem = items[gesture.index]
    if (!currentItem) return

    let nextOffset = gesture.startOffset + deltaX
    const minOffset = -this.data.deleteActionWidthPx
    nextOffset = Math.max(minOffset, Math.min(0, nextOffset))

    if (currentItem.swipeOffset === nextOffset) return
    items[gesture.index] = {
      ...currentItem,
      swipeOffset: nextOffset
    }
    gesture.moved = true
    this.setData({ items })
  },

  onCardTouchEnd() {
    if (this.data.tab !== 'want' || !this._swipeGesture) return

    const gesture = this._swipeGesture
    const items = [...(this.data.items || [])]
    const currentItem = items[gesture.index]
    if (!currentItem) {
      this._swipeGesture = null
      return
    }

    const minOffset = -this.data.deleteActionWidthPx
    const shouldOpen = Math.abs(currentItem.swipeOffset || 0) > this.data.deleteActionWidthPx / 2
    const finalOffset = shouldOpen ? minOffset : 0

    if (currentItem.swipeOffset !== finalOffset) {
      items[gesture.index] = {
        ...currentItem,
        swipeOffset: finalOffset
      }
      this.setData({ items })
    }

    if (gesture.moved) {
      this._lastSwipeTime = Date.now()
    }
    this._swipeGesture = null
  },

  onSelectTransportMode(e) {
    const mode = e.detail && e.detail.mode
    if (!mode) return
    this.setData({ pendingTransportMode: mode })
  },

  onConfirmTransportMode() {
    const { transportTargetIndex, pendingTransportMode, items } = this.data
    if (transportTargetIndex < 0 || !items[transportTargetIndex]) return
    const nextItems = (items || []).map((item, index) => (
      index === transportTargetIndex ? applyTravelMeta(item, pendingTransportMode) : item
    ))
    this.setData({
      items: nextItems,
      transportSheetVisible: false,
      transportTargetIndex: -1
    })
  },

  preventBubble() {
  },

  onClosePlanDaySheet() {
    this.setData({ planDaySheetVisible: false })
  },

  onSelectPlanDay(e) {
    const value = e.detail && e.detail.value
    const pickerIndex = Array.isArray(value) ? parseInt(value[0], 10) : parseInt(value, 10)
    if (Number.isNaN(pickerIndex)) return
    const dayCount = this.data.dayOptions[pickerIndex]
    if (!dayCount) return
    this.setData({
      selectedPlanDayIndex: pickerIndex,
      selectedPlanDayCount: dayCount
    })
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
    const id = e.currentTarget.dataset.id
    const { items } = this.data
    const item = items.find(i => i.id === id)
    if (!item) return

    const isSpot = isSpotItem(item)
    const type = isSpot ? 'spot' : 'food'
    util.toggleLike(id, type)
    this._loadData()
    wx.showToast({ title: '已移除', icon: 'none', duration: 1000 })
  },

  // ─── 规划路线 ─────────────────────────────
  onPlanRoute() {
    const { items } = this.data
    if (items.length === 0) {
      wx.showToast({ title: '清单为空', icon: 'none' })
      return
    }
    this.setData({
      planDaySheetVisible: true,
      selectedPlanDayCount: Math.max(1, Math.min(this.data.selectedPlanDayCount || 1, 30)),
      selectedPlanDayIndex: Math.max(Math.max(1, Math.min(this.data.selectedPlanDayCount || 1, 30)) - 1, 0)
    })
  },

  onConfirmPlanRoute() {
    const { items, selectedPlanDayCount } = this.data
    if (items.length === 0) {
      wx.showToast({ title: '清单为空', icon: 'none' })
      return
    }
    const ids = items.map(i => i.id).join(',')
    const dayCount = Math.max(1, parseInt(selectedPlanDayCount, 10) || 1)
    this.setData({ planDaySheetVisible: false })
    wx.navigateTo({ url: `/pages/route/route?type=plan&ids=${ids}&dayCount=${dayCount}` })
  },

  onGoHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  onBack() {
    wx.navigateBack()
  }
})
