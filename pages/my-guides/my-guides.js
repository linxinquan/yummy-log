// 觅食图 - 我的攻略页面
const util = require('../../utils/util')
const shopData = require('../../utils/shopData')
const spotData = require('../../utils/spotData')
const { normalizeTripDurationText } = require('../../utils/trip-duration')
const { backfillStoredGuides } = require('../../utils/guide-backfill')

// 左滑删除区域的宽度，单位是 rpx。
const DELETE_ACTION_WIDTH_RPX = 176

// 给每条攻略补一个左滑偏移量，方便做删除交互。
function withSwipeState(items) {
  return (items || []).map(item => ({
    ...item,
    swipeOffset: 0
  }))
}

// 关闭其他已经打开的左滑项，只保留当前这一项。
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

// 从攻略的标题、城市等字段里尽量推断出城市名称。
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

// 统计“这篇攻略被保存成路线多少次”。
function getSavedGuideCount(guideId) {
  const savedRoutes = wx.getStorageSync('savedRoutes') || []
  return savedRoutes.filter(item => String(item.guideId || item.id) === String(guideId)).length
}

// 把数字补成两位，例如 3 -> 03。
function padNumber(value) {
  return String(value).padStart(2, '0')
}

// 把发布时间格式化成“年/月/日 时:分”。
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

  // 页面初始化：计算顶部高度，并加载我的攻略。
  onLoad() {
    this.initNavigationBar()
    this.loadMyGuides()
  },

  // 每次回到页面时都重新读取一遍，保证列表最新。
  onShow() {
    this.loadMyGuides()
  },

  // 初始化导航栏高度和左滑删除宽度。
  initNavigationBar() {
    const sysInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight || 44,
      deleteActionWidthPx: sysInfo.windowWidth * DELETE_ACTION_WIDTH_RPX / 750
    })
  },

  // 从本地缓存读取“我的攻略”，并补全封面、城市、发布时间等展示字段。
  loadMyGuides() {
    const guides = util.loadData('myGuides', [])
    const { guides: fixedGuides, changed } = backfillStoredGuides(guides)
    if (changed) {
      util.saveData('myGuides', fixedGuides)
    }

    const nextGuides = withSwipeState(
      fixedGuides
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
          nextGuide.duration = normalizeTripDurationText(nextGuide.duration, Math.max((nextGuide.daySections || []).length, 1))
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

  // 点击攻略卡片：如果当前有左滑打开，先关闭；否则进入详情页。
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

  // 左滑开始：记录起点和当前偏移量。
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

  // 左滑过程：跟着手指移动更新偏移量。
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

  // 左滑结束：决定停在打开状态，还是回弹关闭。
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

  // 空状态按钮：去路线页导入或创建内容。
  onGoGuidePage() {
    wx.switchTab({
      url: '/pages/wantgo/wantgo'
    })
  },

  // 删除一篇已发布攻略。
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
