// 觅食图 V1 - 想去清单页（支持美食/景点/到访，拖拽排序）
const app = getApp()
const util = require('../../utils/util')
const placesData = require('../../utils/placesData')
const { applyTravelMeta, buildTravelOptions } = require('../../utils/travel')
const { resolveDisplayCategory } = require('../../utils/displayCategory')
const { formatTripDuration, normalizeTripSummaryText } = require('../../utils/trip-duration')
const { DEFAULT_COVER_POOL } = require('../../config/cover-pool')


const DEFAULT_DAY = 2; // 默认天数
// 每项高度(px) = 卡片高度120rpx + gap 16rpx 换算
const ITEM_H = 60 // px，每项高度用于计算排序
const DEFAULT_COVER = '/images/app-logo.jpg'
const DAY_OPTIONS = Array.from({ length: 10 }, (_, index) => index + 1)
const DELETE_ACTION_WIDTH_RPX = 144
const DEFAULT_ROUTE_AVATAR = '/images/app-logo.jpg'
const ROUTE_ACTION_OPTIONS = [
  { key: 'publish', label: '发布攻略', icon: 'mgc_send_plane_line' },
  { key: 'copy', label: '复制路线', icon: 'mgc_copy_2_line' },
  { key: 'edit', label: '编辑信息', icon: 'mgc_pencil_3_line' },
  { key: 'delete', label: '删除路线', icon: 'mgc_delete_2_line', danger: true }
]

// 读取当前登录用户的信息。
// 路线卡片没有作者时，会回退用这里的头像和昵称。
function getCurrentUserProfile() {
  const userInfo = util.loadData('userInfo', null) || {}
  return {
    nickName: userInfo.nickName || '觅食者',
    avatarUrl: userInfo.avatarUrl || DEFAULT_ROUTE_AVATAR
  }
}

// 给列表项补一个"左滑偏移量"字段。
// 这样卡片才能记住自己当前是否被左滑打开。
function withSwipeState(items) {
  return (items || []).map(item => ({
    ...item,
    swipeOffset: 0
  }))
}

// 打开某一项左滑时，顺手把其他已经打开的卡片关掉。
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

// 用比较宽松的规则判断"这是景点还是美食"。
// 这个项目里有些历史数据字段不完全统一，所以这里要多做几层兜底。
function isSpotItem(item) {
  return item.category === '景点' || item.category === '公园' || item.type === 'spot' || !item.price
}

// 给角标或标签提供一个简单的兜底文案。
function inferTagText(item) {
  if (isSpotItem(item)) {
    if ((item.category || '').includes('展馆') || (item.name || '').includes('博物馆')) {
      return '文化展馆'
    }
    return '景点'
  }
  return '美食'
}

// 把"想去人数"格式化成更短的文案，避免数字太长撑坏布局。
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

// 如果原始数据没有坐标，就生成一组临时坐标，
// 这样路线规划和距离展示不会直接失效。
function buildSyntheticLatLng(basePoint, index) {
  const seed = index + 1
  return {
    lat: Number((basePoint.lat + seed * 0.0023).toFixed(6)),
    lng: Number((basePoint.lng + seed * 0.0021).toFixed(6))
  }
}

// 把想去/足迹的原始地点数据整理成卡片可直接使用的格式。
function buildPreviewItems(items) {
  const basePoint = app.globalData.location || app.globalData.centerLocation || { lat: 22.4846, lng: 113.9046 }
  const prepared = (items || []).map((item, index) => {
    const lat = item.lat || item.latitude
    const lng = item.lng || item.longitude
    const fallback = buildSyntheticLatLng(basePoint, index)
    const nextLat = lat || fallback.lat
    const nextLng = lng || fallback.lng
    const distance = util.getDistance(basePoint.lat, basePoint.lng, nextLat, nextLng)
    const filteredTags = (item.tags || []).filter(tag => !String(tag || '').endsWith('区')).slice(0, 2)
    return {
      ...item,
      lat: nextLat,
      lng: nextLng,
      tagText: inferTagText(item),
      displayWantCount: formatWantCount(item.wantCount),
      distance,
      distanceText: util.formatDistance(distance),
      tags: filteredTags
    }
  })

  const routeItems = util.planRoute(prepared.map(item => ({ ...item })), basePoint, true)
  return routeItems.map(item => applyTravelMeta(item, item.travelMode))
}

// 再做一层兜底，确保卡片一定能拿到角标、人数、距离这些字段。
function normalizePlaceCardItems(items) {
  return (items || []).map(item => {
    const fallbackDistance = Number(item.distance || item.distanceFromPrev || 0)
    return {
      ...item,
      displayCategory: item.displayCategory || resolveDisplayCategory(item),
      displayWantCount: item.displayWantCount || formatWantCount(item.wantCount),
      distanceText: item.distanceText || util.formatDistance(fallbackDistance),
      tags: Array.isArray(item.tags) ? item.tags.slice(0, 2) : []
    }
  })
}

// 给路线卡片准备一组本地封面兜底池。
function buildRouteCoverPool() {
  return [...DEFAULT_COVER_POOL, DEFAULT_COVER]
}

// 优先从路线自己的地点里找封面，找不到再回退到本地图片池。
function resolveRouteCardCover(item, index = 0) {
  const daySectionCover = (item.daySections || []).reduce((cover, day) => {
    if (cover) return cover
    const firstItem = (day.items || []).find(place => place && place.coverImage)
    return firstItem ? firstItem.coverImage : ''
  }, '')

  const localPool = buildRouteCoverPool()
  return item.coverImage || daySectionCover || localPool[index % localPool.length]
}

// 把"我的路线"里的原始数据整理成列表卡片需要的字段。
function buildRouteCards(items) {
  const currentUser = getCurrentUserProfile()
  return (items || [])
    .slice()
    .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
    .map((item, index) => {
    const hasOwnAuthor = Boolean(item.author)
    const ownAvatar = item.authorAvatar || item.avatarUrl
    const routeCover = resolveRouteCardCover(item, index)
    const fallbackDayCount = Math.max((item.daySections || []).length || item.dayCount || 1, 1)
    const fallbackPlaceCount = (item.daySections || []).reduce((sum, day) => sum + (day.items || []).length, 0)
    return {
      ...item,
      subtitle: normalizeTripSummaryText(item.subtitle, fallbackDayCount, fallbackPlaceCount),
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

// 发布攻略前，先把每个地点的展示字段补齐。
// 这样攻略详情页就不用依赖"再次猜测"才能拿到评分和标签。
function normalizeGuideDaySections(daySections) {
  return (daySections || []).map(day => ({
    ...day,
    items: (day.items || []).map(item => {
      const displayCategory = item.displayCategory || resolveDisplayCategory(item)
      const safeTags = Array.isArray(item.tags) && item.tags.length
        ? item.tags.filter(Boolean).slice(0, 2)
        : [item.tag || item.tagText || displayCategory].filter(Boolean).slice(0, 2)
      return {
        ...item,
        image: item.coverImage || DEFAULT_COVER,
        coverImage: item.coverImage || DEFAULT_COVER,
        displayCategory,
        rating: item.rating || item.score || '',
        tags: safeTags,
        address: item.address || '',
        desc: item.desc || '',
        openHours: item.openHours || item.hours || '',
        free: item.free,
        price: item.price || ''
      }
    })
  }))
}

// 把路线数据转换成攻略数据，这是"发布攻略"的核心映射。
function buildGuideDraftFromRoute(route, copy = false) {
  const currentUser = getCurrentUserProfile()
  const daySections = normalizeGuideDaySections(route.daySections || [])
  const flatContent = daySections.reduce((result, day, dayIndex) => {
    const items = (day.items || []).map((item, itemIndex) => ({
      ...item,
      dayIndex,
      itemIndex
    }))
    return result.concat(items)
  }, [])
  const title = copy ? `${route.title || '未命名路线'}-副本` : (route.title || '未命名路线')
  return {
    id: `guide-${Date.now()}-${copy ? 'copy' : 'publish'}`,
    routeId: route.id,
    title,
    coverImage: route.coverImage || DEFAULT_COVER,
    content: flatContent,
    daySections,
    date: Date.now(),
    city: route.city || '',
    duration: formatTripDuration(Math.max(daySections.length || route.dayCount || 1, 1)),
    shopCount: flatContent.length,
    author: route.author || currentUser.nickName,
    authorAvatar: route.authorAvatar || currentUser.avatarUrl
  }
}

// 复制路线时，自动在标题前面加"（复制）"。
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

// 根据当前 Tab，返回对应的空状态图标和提示文案。
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

// 统一打开地点详情：
// 足迹里如果是"系统未收录但用户采集过的地点"，就把完整对象直接带去详情页。
function openPlaceDetail(item) {
  if (!item) return
  if (item.detailSource === 'record') {
    const spotStr = encodeURIComponent(JSON.stringify(item))
    wx.navigateTo({ url: `/subpackages/extra/pages/spot-detail/spot-detail?spotData=${spotStr}` })
    return
  }
  wx.navigateTo({ url: `/subpackages/extra/pages/spot-detail/spot-detail?id=${item.id}` })
}

Page({
  data: {
    // 加载状态
    loading: false,
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
    transportOptions: [],
    pendingTransportMode: 'drive',
    transportTargetIndex: -1,
    planDaySheetVisible: false,
    dayOptions: DAY_OPTIONS,
    selectedPlanDayCount: DEFAULT_DAY,
    deleteActionWidthPx: 72,
    routeActionSheetVisible: false,
    routeActionOptions: ROUTE_ACTION_OPTIONS,
    // 路线编辑弹窗默认不选中任何操作，需用户手动选择
    selectedRouteAction: '',
    routeActionTarget: null
  },

  // 页面初始化：
  // 1. 接收外部传入的 tab
  // 2. 计算顶部安全区域高度
  // 3. 计算左滑删除的真实宽度
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

  // 页面重新显示时，刷新当前 Tab 的列表数据。
  onShow() {
    const pendingTab = wx.getStorageSync('pendingWantgoTab')
    if (pendingTab) {
      wx.removeStorageSync('pendingWantgoTab')
      this.setData({ tab: pendingTab, ...getEmptyStateMeta(pendingTab), items: [], empty: true })
    }
    this._loadData()
  },

  // ─── Tab切换：想去 / 路线 / 足迹 ─────────────────────────────
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.tab) return
    this.setData({ tab, ...getEmptyStateMeta(tab), items: [], empty: true })
    this._loadData()
  },

  // 按当前 Tab 读取不同的数据源：
  // want 读想去地点，plan 读我的路线，visited 读足迹。
  async _loadData() {
    this.setData({ loading: true })
    const { tab } = this.data
    let items = []

    if (tab === 'want') {
      // 新格式：userWantList 存储所有想去的 ID（美食+景点）
      const wantIds = await util.getWantListAsync()
      const userShops = await util.getUserShopsAsync()
      
      // 通过 placesData.getPlaceById 一次性读取所有想去地点的完整数据
      const wantItems = wantIds
        .map(id => {
          // 先查 placesData（美食+景点）
          let place = placesData.getPlaceById(id)
          // 如果找不到，再查用户自己添加的店铺
          if (!place) {
            place = userShops.find(s => String(s.id) === String(id))
          }
          return place
        })
        .filter(Boolean)  // 过滤掉找不到的数据（防护数据不一致）
        .map(item => ({
          ...item,
          // 确保有 type 字段（美食或景点）
          type: item.type || (item.category === '景点' || item.category === '公园' ? 'spot' : 'food')
        }))
      
      items = withSwipeState(normalizePlaceCardItems(buildPreviewItems(wantItems)))
      console.log('wantgo', items)
      this.setData({ items, empty: items.length === 0, loading: false })
    } else if (tab === 'plan') {
      const savedRoutes = await util.getRoutesAsync()
      const normalizedRoutes = savedRoutes.map((item, index) => {
        const routeCover = resolveRouteCardCover(item, index)
        const fallbackDayCount = Math.max((item.daySections || []).length || item.dayCount || 1, 1)
        const fallbackPlaceCount = (item.daySections || []).reduce((sum, day) => sum + (day.items || []).length, 0)
        return {
          ...item,
          subtitle: normalizeTripSummaryText(item.subtitle, fallbackDayCount, fallbackPlaceCount),
          // TODO: 看看非image不可？
          image: item.image || routeCover,
          coverImage: routeCover
        }
      })
      if (JSON.stringify(normalizedRoutes) !== JSON.stringify(savedRoutes)) {
        util.saveData('savedRoutes', normalizedRoutes)
      }
      const visibleRoutes = normalizedRoutes.filter(item => !item.isDraft)
      const routeCards = buildRouteCards(visibleRoutes)
      this.setData({ items: routeCards, empty: routeCards.length === 0, loading: false })
    } else {
      // tab === 'visited'
      // 足迹统一以 checkin_records 为准，再在这里转成卡片展示数据。
      items = withSwipeState(normalizePlaceCardItems(buildPreviewItems(await util.getFootprintItemsAsync())))
      this.setData({ items, empty: items.length === 0, loading: false })
    }
  },

  // ─── 点击路线卡片：进入我的路线详情 ─────────────────────────────
  onRouteCardTap(e) {
    if (Date.now() - (this._lastRouteLongPressTime || 0) < 350) return
    const route = e.currentTarget.dataset.route
    const routeStr = encodeURIComponent(JSON.stringify(route))
    wx.navigateTo({ url: `/subpackages/route/pages/my-route/my-route?route=${routeStr}` })
  },

  // 长按路线卡片：打开路线操作弹窗
  onRouteCardLongPress(e) {
    const route = e.currentTarget.dataset.route
    if (!route) return
    this._lastRouteLongPressTime = Date.now()
    wx.vibrateShort({ type: 'light' })
    this.setData({
      routeActionSheetVisible: true,
      // 每次打开都重置为未选择状态
      selectedRouteAction: '',
      routeActionTarget: route
    })
  },

  // 关闭路线操作弹窗
  onCloseRouteActionSheet() {
    this.setData({
      routeActionSheetVisible: false,
      // 关闭弹窗时清空选择，避免下次打开沿用上次状态
      selectedRouteAction: '',
      routeActionTarget: null
    })
  },

  // 点击操作项：执行对应操作并关闭弹窗
  onSelectRouteAction(e) {
    const action = e.currentTarget.dataset.action
    if (!action) return
    
    const route = this.data.routeActionTarget
    if (!route) return
    
    switch (action) {
      case 'publish':
        this.publishRouteAsGuide(route, false)
        this.onCloseRouteActionSheet()
        break
      case 'copy':
        this.copyRoute(route)
        this.onCloseRouteActionSheet()
        break
      case 'edit':
        this.editRoute(route)
        this.onCloseRouteActionSheet()
        break
      case 'delete':
        // deleteRoute 会自己处理关闭弹窗的逻辑
        this.deleteRoute(route)
        break
      default:
        break
    }
  },

  // 复制路线
  async copyRoute(route) {
    const savedRoutes = await util.getRoutesAsync()
    const newRoute = {
      ...route,
      id: Date.now(), // 生成新ID
      title: route.title + ' (复制)',
      createTime: Date.now()
    }
    savedRoutes.push(newRoute)
    util.saveData('savedRoutes', savedRoutes)
    wx.showToast({ title: '已复制路线', icon: 'success' })
    // 刷新列表
    this.onShow()
  },

  // 编辑路线
  editRoute(route) {
    // 跳转到路线编辑页面，并自动进入编辑模式
    const routeStr = encodeURIComponent(JSON.stringify(route))
    wx.navigateTo({ url: `/subpackages/route/pages/my-route/my-route?route=${routeStr}&edit=1&returnTo=plan` })
  },

  // 删除路线
  deleteRoute(route) {
    const that = this // 保存 this 引用
    wx.showModal({
      title: '确认删除',
      content: `确定要删除路线"${route.title}"吗？`,
      success: async (res) => {
        if (res.confirm) {
          await util.deleteRouteAsync(route._id || route.id)
          wx.showToast({ title: '已删除', icon: 'success' })
          // 刷新列表
          that.onShow()
          // 关闭弹窗
          that.onCloseRouteActionSheet()
        }
      }
    })
  },

  // 把一条路线发布成攻略，并保存到 myGuides 里
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

  // ─── 点击地点卡片：进入详情页；如果有左滑打开，先帮用户收起 ─────────────────────────────
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
    openPlaceDetail(item)
  },

  // 左滑开始：记录起点坐标和当前卡片状态
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

  // 左滑过程：根据手指移动距离更新卡片偏移量
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

  // 左滑结束：自动决定是打开删除按钮，还是回弹关闭
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

  // 阻止点击弹窗内容时触发遮罩层关闭
  preventBubble() {
  },

  // 关闭旅行天数弹窗
  onClosePlanDaySheet() {
    this.setData({ planDaySheetVisible: false })
  },

  // 选择路线规划的旅行天数
  onSelectPlanDay(e) {
    const value = e.detail && e.detail.value
    const pickerIndex = Array.isArray(value) ? parseInt(value[0], 10) : parseInt(value, 10)
    if (Number.isNaN(pickerIndex)) return
    const dayCount = this.data.dayOptions[pickerIndex]
    if (!dayCount) return
    this.setData({ selectedPlanDayCount: dayCount })
  },

  // ─── 拖拽开始（长按）：用于调整路线列表顺序 ─────────────────────────────
  onDragStart(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ dragging: true, dragIndex: index })
    wx.vibrateShort()
  },

  // ─── 拖拽移动：实时换位 ─────────────────────────────
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

  // ─── 拖拽结束：把新顺序保存回本地缓存 ─────────────────────────────
  onDragEnd() {
    const { tab, items } = this.data
    if (!this.data.dragging) return
    // 保存排序后的顺序
    if (tab === 'plan') {
      // 新格式：直接保存所有 ID 到 userWantList（不区分 spot/food）
      const sortedIds = items.map(item => String(item.id))
      util.saveData('userWantList', sortedIds)
    }
    this.setData({ dragging: false, dragIndex: -1 })
  },


  // ─── 从"想去"里删除当前地点 ─────────────────────────────
  async onRemove(e) {
    const id = String(e.currentTarget.dataset.id)
    await util.toggleWantAsync(id)
    this._loadData()
    wx.showToast({ title: '已移除', icon: 'none', duration: 1000 })
  },

  // ─── 打开路线规划天数弹窗 ─────────────────────────────
  onPlanRoute() {
    const { items } = this.data
    if (items.length === 0) {
      wx.showToast({ title: '清单为空', icon: 'none' })
      return
    }
    this.setData({
      planDaySheetVisible: true,
      selectedPlanDayCount: Math.max(1, Math.min(this.data.selectedPlanDayCount || DEFAULT_DAY, 10))
    })
  },

  // 确认天数后，带着地点 id 去路线规划页
  onConfirmPlanRoute() {
    const { items, selectedPlanDayCount } = this.data
    if (items.length === 0) {
      wx.showToast({ title: '清单为空', icon: 'none' })
      return
    }
    const ids = items.map(i => i.id).join(',')
    const dayCount = Math.max(1, parseInt(selectedPlanDayCount, 10) || 1)
    console.log('dayCount', dayCount)
    this.setData({ planDaySheetVisible: false })
    wx.navigateTo({ url: `/subpackages/route/pages/route/route?&ids=${ids}&dayCount=${dayCount}` })
  },

})
