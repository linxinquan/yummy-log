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
const DEFAULT_ROUTE_AVATAR = '/images/app-logo.jpg'
const ROUTE_ACTION_OPTIONS = [
  { key: 'publish', label: '发布攻略', icon: 'mgc_send_plane_line' },
  { key: 'copy', label: '复制路线', icon: 'mgc_copy_2_line' },
  { key: 'edit', label: '编辑信息', icon: 'mgc_pencil_3_line' },
  { key: 'delete', label: '删除路线', icon: 'mgc_delete_2_line', danger: true }
]

function getCurrentUserProfile() {
  const userInfo = util.loadData('userInfo', null) || {}
  return {
    nickName: userInfo.nickName || '觅食者',
    avatarUrl: userInfo.avatarUrl || DEFAULT_ROUTE_AVATAR
  }
}

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

function buildRouteCoverPool() {
  const foodCovers = [...(shopData.shops || []), ...(shopData.foods || []), ...(util.loadData('userAddedShops', []) || [])]
    .map(item => item.logo || item.image || item.thumb || item.coverImage)
    .filter(Boolean)
  const spotCovers = (util.getSpotData() || [])
    .map(item => item.image || item.logo || item.thumb || item.coverImage)
    .filter(Boolean)
  return [...foodCovers, ...spotCovers, DEFAULT_COVER]
}

function resolveRouteCardCover(item, index = 0) {
  const daySectionCover = (item.daySections || []).reduce((cover, day) => {
    if (cover) return cover
    const firstItem = (day.items || []).find(place => place && (place.coverImage || place.image || place.logo || place.thumb))
    return firstItem ? (firstItem.coverImage || firstItem.image || firstItem.logo || firstItem.thumb) : ''
  }, '')
  const dayDetailCover = (item.dayDetails || []).reduce((cover, day) => {
    if (cover) return cover
    const firstItem = (day || []).find(place => place && (place.coverImage || place.image || place.logo || place.thumb))
    return firstItem ? (firstItem.coverImage || firstItem.image || firstItem.logo || firstItem.thumb) : ''
  }, '')
  const localPool = buildRouteCoverPool()
  return item.coverImage || item.image || daySectionCover || dayDetailCover || localPool[index % localPool.length] || DEFAULT_COVER
}

function buildRouteCards(items) {
  const currentUser = getCurrentUserProfile()
  return (items || [])
    .slice()
    .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
    .map((item, index) => {
    const hasOwnAuthor = Boolean(item.author)
    const ownAvatar = item.authorAvatar || item.avatarUrl
    const routeCover = resolveRouteCardCover(item, index)
    return {
      ...item,
      subtitle: item.subtitle || '',
      city: item.city || '未设置城市',
      author: hasOwnAuthor ? item.author : currentUser.nickName,
      authorAvatar: hasOwnAuthor
        ? (ownAvatar || routeCover || DEFAULT_ROUTE_AVATAR)
        : currentUser.avatarUrl,
      image: routeCover,
      coverImage: routeCover
    }
  })
}

function flattenRouteGuideContent(route) {
  const daySections = route.daySections || []
  const dayDetails = route.dayDetails || []
  if (daySections.length) {
    return daySections.reduce((result, day, dayIndex) => {
      const items = (day.items || []).map((item, itemIndex) => ({
        ...item,
        dayIndex,
        itemIndex
      }))
      return result.concat(items)
    }, [])
  }
  if (dayDetails.length) {
    return dayDetails.reduce((result, day, dayIndex) => {
      const items = (day.items || []).map((item, itemIndex) => ({
        ...item,
        dayIndex,
        itemIndex
      }))
      return result.concat(items)
    }, [])
  }
  return []
}

function buildGuideDraftFromRoute(route, copy = false) {
  const currentUser = getCurrentUserProfile()
  const daySections = route.daySections || []
  const flatContent = flattenRouteGuideContent(route)
  const title = copy ? `${route.title || '未命名路线'}-副本` : (route.title || '未命名路线')
  return {
    id: `guide-${Date.now()}-${copy ? 'copy' : 'publish'}`,
    routeId: route.id,
    title,
    coverImage: route.coverImage || route.image || DEFAULT_COVER,
    content: flatContent,
    daySections,
    date: Date.now(),
    city: route.city || '',
    duration: `${Math.max(daySections.length || route.dayCount || 1, 1)}天`,
    shopCount: flatContent.length,
    author: route.author || currentUser.nickName,
    authorAvatar: route.authorAvatar || currentUser.avatarUrl
  }
}

function buildCopiedRoute(route) {
  const timestamp = Date.now()
  const title = String(route.title || '未命名路线')
  const normalizedTitle = title.startsWith('（复制）') ? title : `（复制）${title}`
  return {
    ...route,
    id: `route-copy-${timestamp}`,
    title: normalizedTitle,
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

function getEmptyStateMeta(tab) {
  if (tab === 'plan') {
    return {
      emptyIcon: 'mgc_route_line',
      emptyHint: '去攻略页导入或复制路线吧'
    }
  }
  if (tab === 'visited') {
    return {
      emptyIcon: 'mgc_foot_line',
      emptyHint: '去探索页记录你的足迹吧'
    }
  }
  return {
    emptyIcon: 'mgc_heart_line',
    emptyHint: '去探索页添加想去地点吧'
  }
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
    emptyIcon: 'mgc_heart_line',
    emptyHint: '去探索页添加想去地点吧',
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
    selectedPlanDayCount: 3,
    selectedPlanDayIndex: 2,
    deleteActionWidthPx: 72,
    routeActionSheetVisible: false,
    routeActionOptions: ROUTE_ACTION_OPTIONS,
    selectedRouteAction: 'publish',
    routeActionTarget: null
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
    const emptyStateMeta = getEmptyStateMeta(tab)
    
    this.setData({ 
      tab, 
      ...emptyStateMeta,
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
      this.setData({ tab: pendingTab, ...getEmptyStateMeta(pendingTab), items: [], empty: true })
    }
    this._loadData()
  },

  // ─── Tab切换 ─────────────────────────────
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.tab) return
    this.setData({ tab, ...getEmptyStateMeta(tab), items: [], empty: true })
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
      
      const foodItems = foodIds
        .map(id => allFoodItems.find(s => String(s.id) === String(id)))
        .filter(Boolean)
        .map(item => ({ ...item, type: 'food' }))
      const spotItems = spotIds
        .map(id => spots.find(s => String(s.id) === String(id)))
        .filter(Boolean)
        .map(item => ({ ...item, type: 'spot' }))
      
      items = withSwipeState(buildPreviewItems([...foodItems, ...spotItems]))
      this.setData({ items, empty: items.length === 0 })
    } else if (tab === 'plan') {
      const savedRoutes = util.loadData('savedRoutes', [])
      const normalizedRoutes = savedRoutes.map((item, index) => {
        const routeCover = resolveRouteCardCover(item, index)
        return {
          ...item,
          image: item.image || routeCover,
          coverImage: routeCover
        }
      })
      if (JSON.stringify(normalizedRoutes) !== JSON.stringify(savedRoutes)) {
        util.saveData('savedRoutes', normalizedRoutes)
      }
      const visibleRoutes = normalizedRoutes.filter(item => !item.isDraft)
      const routeCards = buildRouteCards(visibleRoutes)
      this.setData({ items: routeCards, empty: routeCards.length === 0 })
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
    if (Date.now() - (this._lastRouteLongPressTime || 0) < 350) return
    const route = e.currentTarget.dataset.route
    const routeStr = encodeURIComponent(JSON.stringify(route))
    wx.navigateTo({ url: `/pages/my-route/my-route?route=${routeStr}` })
  },

  onRouteCardLongPress(e) {
    const route = e.currentTarget.dataset.route
    if (!route) return
    this._lastRouteLongPressTime = Date.now()
    wx.vibrateShort({ type: 'light' })
    this.setData({
      routeActionSheetVisible: true,
      selectedRouteAction: 'publish',
      routeActionTarget: route
    })
  },

  onCloseRouteActionSheet() {
    this.setData({
      routeActionSheetVisible: false,
      selectedRouteAction: 'publish',
      routeActionTarget: null
    })
  },

  onSelectRouteAction(e) {
    const action = e.currentTarget.dataset.action
    if (!action) return
    this.setData({ selectedRouteAction: action })
  },

  publishRouteAsGuide(route, copy = false) {
    const guides = util.loadData('myGuides', [])
    if (!copy) {
      const exists = guides.find(item => String(item.routeId) === String(route.id))
      if (exists) {
        wx.showToast({ title: '已发布过攻略', icon: 'none' })
        return
      }
    }
    const nextGuides = [buildGuideDraftFromRoute(route, copy)].concat(guides)
    util.saveData('myGuides', nextGuides)
    wx.showToast({ title: copy ? '已复制攻略' : '已发布为攻略', icon: 'success' })
  },

  copyRouteCard(route) {
    const savedRoutes = util.loadData('savedRoutes', [])
    const copiedRoute = buildCopiedRoute(route)
    util.saveData('savedRoutes', [copiedRoute].concat(savedRoutes))
    wx.showToast({ title: '已复制路线', icon: 'success' })
  },

  onConfirmRouteAction() {
    const { selectedRouteAction, routeActionTarget } = this.data
    if (!selectedRouteAction || !routeActionTarget) return

    if (selectedRouteAction === 'delete') {
      wx.showModal({
        title: '删除路线',
        content: '删除后无法恢复，确认删除吗？',
        confirmColor: '#FF5A5F',
        success: (res) => {
          if (!res.confirm) return
          const savedRoutes = util.loadData('savedRoutes', [])
          const nextRoutes = savedRoutes.filter(item => String(item.id) !== String(routeActionTarget.id))
          util.saveData('savedRoutes', nextRoutes)
          this.onCloseRouteActionSheet()
          this._loadData()
          wx.showToast({ title: '已删除', icon: 'success' })
        }
      })
      return
    }

    if (selectedRouteAction === 'publish') {
      this.publishRouteAsGuide(routeActionTarget, false)
    } else if (selectedRouteAction === 'copy') {
      this.copyRouteCard(routeActionTarget)
      this._loadData()
    } else if (selectedRouteAction === 'edit') {
      const routeStr = encodeURIComponent(JSON.stringify(routeActionTarget))
      wx.navigateTo({
        url: `/pages/route-basic-edit/route-basic-edit?route=${routeStr}`
      })
    }

    this.onCloseRouteActionSheet()
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
    const id = String(e.currentTarget.dataset.id)
    const { items } = this.data
    const item = items.find(i => String(i.id) === id)
    if (!item) return
    const type = item.type === 'spot' ? 'spot' : 'food'
    const key = type === 'spot' ? 'userWantSpots' : 'userWantFoods'
    const nextIds = util.loadData(key, []).filter(savedId => String(savedId) !== id)
    util.saveData(key, nextIds)
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
      selectedPlanDayCount: Math.max(1, Math.min(this.data.selectedPlanDayCount || 3, 30)),
      selectedPlanDayIndex: Math.max(Math.max(1, Math.min(this.data.selectedPlanDayCount || 3, 30)) - 1, 0)
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
