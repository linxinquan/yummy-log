// pages/my-favorites/my-favorites.js
const app = getApp()
const placesData = require('../../../../utils/placesData')
const util = require('../../../../utils/util')
const { resolveDisplayCategory } = require('../../../../utils/displayCategory')

const DEFAULT_CENTER = {
  lat: 22.4846,
  lng: 113.9046
}
// 左滑打开距离单独调成 168rpx。
// 删除按钮本身仍是 120rpx，这样打开后会留下 48rpx 的间距。
const DELETE_ACTION_WIDTH_RPX = 168

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

// 给收藏列表补一个左滑偏移量字段，方便卡片记住当前是否已打开删除按钮。
function withSwipeState(items) {
  return (items || []).map(item => ({
    ...item,
    swipeOffset: 0
  }))
}

// 打开一张卡片时，把其他已经左滑打开的卡片顺手收起。
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

Page({
  data: {
    // 数据
    allList: [],
    
    // 空状态
    showEmpty: false,
    emptyText: '',
    // 删除按钮真实像素宽度，需要根据屏幕宽动态换算。
    deleteActionWidthPx: 72
  },

  onLoad() {
    this.initNavigationBar()
  },

  onUnload() {
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
    // 把 rpx 的删除按钮宽度换算成当前设备上的 px，给左滑距离判断使用。
    const deleteActionWidthPx = windowInfo.windowWidth * DELETE_ACTION_WIDTH_RPX / 750

    this.setData({
      statusBarHeight: windowInfo.statusBarHeight || 44,
      menuTop,
      menuHeight,
      deleteActionWidthPx
    })
  },

  // 加载收藏数据（同步读本地 + 后台同步）
  loadData() {
    const allCollectedIds = util.getCollectedListAsync()
    const userAddedShops = util.getUserShopsAsync()

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
          // 收藏页右侧心形按钮需要知道当前是否已经加入“想去”。
          isWanted: util.isWant(item.id),
          distance,
          distanceText: util.formatDistance(distance),
        }
      })
      .filter(Boolean)
      .sort((a, b) => (a.distance || 0) - (b.distance || 0))

    this.setData({
      allList: withSwipeState(allList),
      showEmpty: allList.length === 0,
      emptyText: '去探索页收藏喜欢的地点吧'
    })
  },

  // 空状态按钮：去首页探索页，而不是回到上一个页面。
  onGoExplore() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  // 点击收藏卡片：如果当前有左滑打开项，先收起；否则进入详情页。
  onItemTap(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10)
    const items = this.data.allList || []
    const tappedItem = items[index]
    const hasOpenItem = items.some(item => item && item.swipeOffset)
    if (Date.now() - (this._lastSwipeTime || 0) < 250) {
      return
    }
    if (hasOpenItem) {
      const { nextItems } = closeSwipeItems(items)
      this.setData({ allList: nextItems })
      if (tappedItem && tappedItem.swipeOffset) {
        return
      }
    }

    const item = e.currentTarget.dataset.item
    if (!item) return

    wx.navigateTo({ url: `/subpackages/extra/pages/spot-detail/spot-detail?id=${item.id}` })
  },

  // 右侧心形按钮：点击后切换“想去”状态，和首页、详情页保持一致。
  onAddWant(e) {
    const item = e.currentTarget.dataset.item
    if (!item) return

    // 没登录时先走统一登录拦截，避免本地状态和其他页面行为不一致。
    if (!util.requireLogin()) return

    // 直接切换想去状态，已加入时再次点击会移出。
    const isWanted = util.toggleWantAsync(item.id)
    this.loadData()
    wx.showToast({
      title: isWanted ? '已添加到想去' : '已移出想去',
      icon: 'none',
      duration: 1000
    })
  },

  // 左滑删除收藏：本地即时移除，再异步同步到后台。
  onRemoveCollect(e) {
    const itemId = e.currentTarget.dataset.id
    if (!itemId) return

    util.toggleCollectAsync(itemId)

    // 立即刷新列表（读本地缓存，零等待）
    this.loadData()

    wx.showToast({
      title: '已取消收藏',
      icon: 'none',
      duration: 1000
    })
  },

  // 左滑开始：记录起点坐标和当前卡片状态。
  onCardTouchStart(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10)
    const touch = e.touches && e.touches[0]
    if (Number.isNaN(index) || !touch) return

    const items = this.data.allList || []
    const currentItem = items[index]
    const { nextItems, changed } = closeSwipeItems(items, index)
    if (changed) {
      this.setData({ allList: nextItems })
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

  // 左滑过程：根据手指移动距离更新卡片偏移量。
  onCardTouchMove(e) {
    if (!this._swipeGesture) return
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

    const items = [...(this.data.allList || [])]
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
    this.setData({ allList: items })
  },

  // 左滑结束：自动决定是展开删除按钮，还是回弹关闭。
  onCardTouchEnd() {
    if (!this._swipeGesture) return

    const gesture = this._swipeGesture
    const items = [...(this.data.allList || [])]
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
      this.setData({ allList: items })
    }

    if (gesture.moved) {
      this._lastSwipeTime = Date.now()
    }
    this._swipeGesture = null
  },

  // 图片加载失败
  onImageError(e) {
    const index = e.currentTarget.dataset.index
    const key = `allList[${index}].coverImage`
    this.setData({ [key]: '/images/app-logo.jpg' })
  }
})
