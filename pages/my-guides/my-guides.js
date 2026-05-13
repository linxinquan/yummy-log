// 觅食图 - 我的攻略页面
const util = require('../../utils/util')
const shopData = require('../../utils/shopData')
const spotData = require('../../utils/spotData')

const DELETE_ACTION_WIDTH_RPX = 176

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

function inferGuideCity(guide = {}) {
  const sourceText = [
    guide.city,
    guide.cityText,
    guide.districtName,
    guide.title,
    guide.desc,
    ...(guide.tags || [])
  ].join(' ')

  if (/西安|长安/.test(sourceText)) return '西安市'
  if (/广州/.test(sourceText)) return '广州市'
  if (/汕头/.test(sourceText)) return '汕头市'
  if (/佛山/.test(sourceText)) return '佛山市'
  if (/珠海/.test(sourceText)) return '珠海市'
  return '深圳市'
}

function getSavedGuideCount(guideId) {
  const savedRoutes = wx.getStorageSync('savedRoutes') || []
  return savedRoutes.filter(item => String(item.guideId || item.id) === String(guideId)).length
}

function padNumber(value) {
  return String(value).padStart(2, '0')
}

function formatPublishedAt(timestamp) {
  const date = new Date(timestamp || Date.now())
  if (Number.isNaN(date.getTime())) return '刚刚发布'
  return `${date.getFullYear()}/${padNumber(date.getMonth() + 1)}/${padNumber(date.getDate())} ${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`
}

Page({
  data: {
    // 攻略列表
    myGuides: [],
    guideCount: 0,

    // 导航栏
    statusBarHeight: 44,
    deleteActionWidthPx: 84
  },

  onLoad() {
    this.initNavigationBar()
    this.loadMyGuides()
  },

  onShow() {
    this.loadMyGuides()
  },

  // 初始化导航栏
  initNavigationBar() {
    const sysInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight || 44,
      deleteActionWidthPx: sysInfo.windowWidth * DELETE_ACTION_WIDTH_RPX / 750
    })
  },

  // 加载我的攻略
  loadMyGuides() {
    const guides = util.loadData('myGuides', [])

    const nextGuides = withSwipeState(
      guides
        .slice()
        .sort((a, b) => (b.date || 0) - (a.date || 0))
        .map(guide => {
          const nextGuide = { ...guide }

          if (!nextGuide.coverImage && nextGuide.content && nextGuide.content.length > 0) {
            const firstItem = nextGuide.content[0]
            const allShops = [...(shopData.shops || []), ...(shopData.foods || [])]
            const allSpots = spotData.spotData || []

            const shop = allShops.find(s => String(s.id) === String(firstItem.id))
            if (shop) {
              nextGuide.coverImage = shop.logo || shop.image || shop.thumb
            } else {
              const spot = allSpots.find(s => String(s.id) === String(firstItem.id))
              if (spot) {
                nextGuide.coverImage = spot.image || spot.logo || spot.thumb
              }
            }
          }

          if (!nextGuide.coverImage) {
            nextGuide.coverImage = '/images/app-logo.jpg'
          }

          nextGuide.shopCount = nextGuide.shopCount || ((nextGuide.content || []).length || 0)
          nextGuide.duration = nextGuide.duration || `${Math.max((nextGuide.daySections || []).length, 1)}天`
          nextGuide.cityText = nextGuide.cityText || inferGuideCity(nextGuide)
          nextGuide.useRouteCount = (nextGuide.baseUseCount || 0) + getSavedGuideCount(nextGuide.id)
          nextGuide.publishedAtText = formatPublishedAt(nextGuide.date)

          return nextGuide
        })
    )

    this.setData({
      myGuides: nextGuides,
      guideCount: nextGuides.length
    })
  },

  onGuideTap(e) {
    if (Date.now() - (this._lastSwipeTime || 0) < 250) return

    const guide = e.currentTarget.dataset.guide
    const index = parseInt(e.currentTarget.dataset.index, 10)
    const guides = this.data.myGuides || []
    const tappedGuide = guides[index]
    const hasOpenItem = guides.some(item => item && item.swipeOffset)

    if (hasOpenItem) {
      const { nextItems, changed } = closeSwipeItems(guides)
      if (changed) {
        this.setData({ myGuides: nextItems })
      }
      if (tappedGuide && tappedGuide.swipeOffset) {
        return
      }
    }

    if (!guide) return
    wx.navigateTo({
      url: `/pages/guide-detail/guide-detail?guide=${encodeURIComponent(JSON.stringify(guide))}`
    })
  },

  onCardTouchStart(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10)
    const touch = e.touches && e.touches[0]
    if (Number.isNaN(index) || !touch) return

    const guides = this.data.myGuides || []
    const currentItem = guides[index]
    const { nextItems, changed } = closeSwipeItems(guides, index)
    if (changed) {
      this.setData({ myGuides: nextItems })
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

    const guides = [...(this.data.myGuides || [])]
    const currentItem = guides[gesture.index]
    if (!currentItem) return

    let nextOffset = gesture.startOffset + deltaX
    const minOffset = -this.data.deleteActionWidthPx
    nextOffset = Math.max(minOffset, Math.min(0, nextOffset))

    if (currentItem.swipeOffset === nextOffset) return
    guides[gesture.index] = {
      ...currentItem,
      swipeOffset: nextOffset
    }
    gesture.moved = true
    this.setData({ myGuides: guides })
  },

  onCardTouchEnd() {
    if (!this._swipeGesture) return

    const gesture = this._swipeGesture
    const guides = [...(this.data.myGuides || [])]
    const currentItem = guides[gesture.index]
    if (!currentItem) {
      this._swipeGesture = null
      return
    }

    const minOffset = -this.data.deleteActionWidthPx
    const shouldOpen = Math.abs(currentItem.swipeOffset || 0) > this.data.deleteActionWidthPx / 2
    const finalOffset = shouldOpen ? minOffset : 0

    if (currentItem.swipeOffset !== finalOffset) {
      guides[gesture.index] = {
        ...currentItem,
        swipeOffset: finalOffset
      }
      this.setData({ myGuides: guides })
    }

    if (gesture.moved) {
      this._lastSwipeTime = Date.now()
    }
    this._swipeGesture = null
  },

  onGoGuidePage() {
    wx.switchTab({
      url: '/pages/wantgo/wantgo'
    })
  },

  onDeleteGuide(e) {
    const guideId = e.currentTarget.dataset.id
    const guides = util.loadData('myGuides', []).filter(g => String(g.id) !== String(guideId))
    util.saveData('myGuides', guides)
    this.loadMyGuides()
    wx.showToast({ title: '已删除', icon: 'success' })
  },

  // 图片加载失败
  onImageError(e) {
    const index = e.currentTarget.dataset.index
    const key = `myGuides[${index}].coverImage`
    this.setData({ [key]: '/images/app-logo.jpg' })
  }
})
