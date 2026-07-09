// 觅食图 - 我的攻略页面
const util = require('../../../../utils/util')
const placesData = require('../../../../utils/placesData')
const { normalizeTripDurationText } = require('../../../../utils/trip-duration')
const { backfillStoredGuides } = require('../../../../utils/guide-backfill')

const GUIDE_ROUTE_ACTION_OPTIONS = [
  { key: 'copy', label: '复制到想去路线', icon: 'mgc_copy_2_line' },
  { key: 'edit', label: '编辑信息', icon: 'mgc_pencil_3_line' },
  { key: 'delete', label: '删除路线', icon: 'mgc_delete_2_line', danger: true }
]

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

// 深拷贝 daySections，避免不同页面共用同一份引用导致联动修改。
function cloneDaySections(daySections = []) {
  return JSON.parse(JSON.stringify(daySections || []))
}

// 从已发布攻略里还原出一条可继续编辑 / 复制的路线数据。
function buildRouteFromGuide(guide = {}, overrides = {}) {
  const nextDaySections = cloneDaySections(guide.daySections || [])
  const placeCount = nextDaySections.reduce((sum, day) => sum + ((day.items || []).length), 0)
  const safeDayCount = Math.max(nextDaySections.length || guide.dayCount || 1, 1)
  const cityText = guide.cityText || inferGuideCity(guide)
  const routeId = overrides.id || `guide-route-${Date.now()}`

  return {
    id: routeId,
    title: overrides.title || guide.title || '未命名路线',
    city: overrides.city || cityText,
    cityText,
    subtitle: `${normalizeTripDurationText(guide.duration, safeDayCount)} · ${placeCount} 个地点`,
    image: overrides.coverImage || guide.coverImage || '/images/app-logo.jpg',
    coverImage: overrides.coverImage || guide.coverImage || '/images/app-logo.jpg',
    dayCount: safeDayCount,
    daySections: nextDaySections,
    routeId: guide.routeId || guide.id,
    guideId: guide.id,
    sourceType: 'guide',
    createdAt: overrides.createdAt || Date.now(),
    updatedAt: Date.now()
  }
}

Page({
  data: {
    // 攻略列表
    myGuides: [],
    guideCount: 0,

    // 导航栏
    statusBarHeight: 44,

    // 路线长按操作弹窗
    routeActionSheetVisible: false,
    routeActionOptions: GUIDE_ROUTE_ACTION_OPTIONS,
    routeActionTarget: null,
    deleteRouteConfirmVisible: false
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

  // 初始化导航栏高度。
  initNavigationBar() {
    const windowInfo = wx.getWindowInfo()
    this.setData({
      statusBarHeight: windowInfo.statusBarHeight || 44
    })
  },

  // 从本地缓存读取“我的攻略”，并补全封面、城市、发布时间等展示字段。
  loadMyGuides() {
    const guides = util.loadData('myGuides', [])
    const { guides: fixedGuides, changed } = backfillStoredGuides(guides)
    if (changed) {
      util.saveData('myGuides', fixedGuides)
    }

    const nextGuides = fixedGuides
      .slice()
      .sort((a, b) => (b.date || 0) - (a.date || 0))
      .map(guide => {
        const nextGuide = { ...guide }

        if (!nextGuide.coverImage && nextGuide.content && nextGuide.content.length > 0) {
          const firstItem = nextGuide.content[0]
          const allShops = placesData.getFoods()
          const allSpots = placesData.getSpots()

          const shop = allShops.find(s => String(s.id) === String(firstItem.id))
          if (shop) {
            nextGuide.coverImage = shop.coverImage
          } else {
            const spot = allSpots.find(s => String(s.id) === String(firstItem.id))
            if (spot) {
              nextGuide.coverImage = spot.coverImage
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

    this.setData({
      myGuides: nextGuides,
      guideCount: nextGuides.length
    })
  },

  // 点击攻略卡片：长按刚触发后短时间内不重复进入详情。
  onGuideTap(e) {
    if (Date.now() - (this._lastGuideLongPressTime || 0) < 350) return
    const guide = e.currentTarget.dataset.guide
    if (!guide) return
    wx.navigateTo({
      url: `/subpackages/guide/pages/guide-detail/guide-detail?guide=${encodeURIComponent(JSON.stringify(guide))}`
    })
  },

  // 长按路线卡片：打开“发布路线编辑”弹窗。
  onGuideLongPress(e) {
    const guide = e.currentTarget.dataset.guide
    if (!guide) return
    this._lastGuideLongPressTime = Date.now()
    wx.vibrateShort({ type: 'light' })
    this.setData({
      routeActionSheetVisible: true,
      routeActionTarget: guide
    })
  },

  // 空状态按钮：去路线页导入或创建内容。
  onGoGuidePage() {
    wx.switchTab({
      url: '/pages/wantgo/wantgo'
    })
  },

  // 关闭路线编辑弹窗。
  onCloseRouteActionSheet() {
    this.setData({
      routeActionSheetVisible: false,
      routeActionTarget: null
    })
  },

  // 阻止弹层内容点击冒泡。
  preventBubble() {
  },

  // 点击弹窗操作项。
  onSelectRouteAction(e) {
    const action = e.currentTarget.dataset.action
    const guide = this.data.routeActionTarget
    if (!action || !guide) return

    switch (action) {
      case 'copy':
        this.copyGuideRoute(guide)
        this.onCloseRouteActionSheet()
        break
      case 'edit':
        this.editGuideRouteInfo(guide)
        this.onCloseRouteActionSheet()
        break
      case 'delete':
        this.setData({
          routeActionSheetVisible: false,
          deleteRouteConfirmVisible: true
        })
        break
      default:
        break
    }
  },

  // 把已发布攻略复制成一条新的“我的路线”。
  copyGuideRoute(guide) {
    const copiedRoute = buildRouteFromGuide(guide, {
      id: `guide-copy-${Date.now()}`,
      title: `${guide.title || '未命名路线'} (复制)`,
      createdAt: Date.now()
    })
    util.saveRouteAsync(copiedRoute)
    wx.showToast({ title: '已复制路线', icon: 'success' })
  },

  // 用“临时编辑”方式修改路线基础信息，保存后同步回这条已发布攻略。
  editGuideRouteInfo(guide) {
    const routeForEdit = buildRouteFromGuide(guide)
    wx.navigateTo({
      url: `/subpackages/route/pages/route-basic-edit/route-basic-edit?route=${encodeURIComponent(JSON.stringify(routeForEdit))}&temp=1`,
      success: (res) => {
        res.eventChannel.on('routeBasicSaved', (updatedRoute) => {
          if (!updatedRoute) return
          this.applyEditedGuideRoute(guide, updatedRoute)
        })
      }
    })
  },

  // 把基础信息页保存回来的路线资料同步写回“我的发布”。
  applyEditedGuideRoute(guide, updatedRoute) {
    const guides = util.loadData('myGuides', [])
    const nextGuides = guides.map(item => {
      if (String(item.id) !== String(guide.id)) return item
      const nextDaySections = cloneDaySections(updatedRoute.daySections || item.daySections || [])
      const nextShopCount = nextDaySections.reduce((sum, day) => sum + ((day.items || []).length), 0)
      const nextDayCount = Math.max(nextDaySections.length || updatedRoute.dayCount || 1, 1)
      return {
        ...item,
        title: updatedRoute.title || item.title,
        city: updatedRoute.city || item.city,
        cityText: updatedRoute.city || item.cityText,
        coverImage: updatedRoute.coverImage || updatedRoute.image || item.coverImage,
        duration: normalizeTripDurationText(item.duration, nextDayCount),
        daySections: nextDaySections,
        dayCount: nextDayCount,
        shopCount: nextShopCount || item.shopCount
      }
    })
    util.saveData('myGuides', nextGuides)
    this.loadMyGuides()
    wx.showToast({ title: '已更新信息', icon: 'success' })
  },

  // 关闭删除确认层。
  onCloseDeleteRouteConfirm() {
    this.setData({
      deleteRouteConfirmVisible: false,
      routeActionTarget: null
    })
  },

  // 确认删除当前发布路线。
  onConfirmDeleteRoute() {
    const guide = this.data.routeActionTarget
    if (!guide) return
    const guideId = guide.id
    const guides = util.loadData('myGuides', []).filter(g => String(g.id) !== String(guideId))
    util.saveData('myGuides', guides)
    this.setData({
      deleteRouteConfirmVisible: false,
      routeActionTarget: null
    })
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
