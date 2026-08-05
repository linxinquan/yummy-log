// 一周展示文案：用于首页问候下面那一排日期标签。
const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']
const { parseRouteTextToIds, resolveRouteImportText } = require('../../utils/route-import')

// 根据当前时间返回问候语。
function getGreetingText(date = new Date()) {
  const hour = date.getHours()
  if (hour < 6) return '凌晨好'
  if (hour < 12) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

// 生成顶部日期条，今天会单独高亮显示。
function buildWeekdayItems(date = new Date()) {
  const currentDay = date.getDay()
  const currentIndex = currentDay === 0 ? 6 : currentDay - 1
  return WEEKDAY_LABELS.map((label, index) => ({
    label: index === currentIndex ? '今天' : label,
    isToday: index === currentIndex
  }))
}

Page({
  data: {
    menuTop: 44,
    menuHeight: 32,
    menuRightInset: 24,
    listTop: 133,
    greetingText: '下午好',
    weekdayItems: [],
    importSheetVisible: false,
    guideLink: '',
    parsingRoute: false
  },

  // 页面初始化：计算顶部安全区、问候语和日期条。
  onLoad() {
    const now = new Date()
    const windowInfo = wx.getWindowInfo()
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const menuTop = menuButtonInfo ? menuButtonInfo.top : (windowInfo.statusBarHeight || 44) + 4
    const menuHeight = menuButtonInfo ? menuButtonInfo.height : 32
    const menuRightInset = menuButtonInfo
      ? Math.max(windowInfo.windowWidth - menuButtonInfo.left + 8, 24)
      : 103
    const contentTop = menuTop + menuHeight + 12
    const listTop = contentTop

    this.setData({
      menuTop,
      menuHeight,
      menuRightInset,
      listTop,
      greetingText: getGreetingText(now),
      weekdayItems: buildWeekdayItems(now)
    })
  },

  // 每次回到页面时，刷新问候语和“今天”的位置。
  onShow() {
    const now = new Date()
    this.setData({
      greetingText: getGreetingText(now),
      weekdayItems: buildWeekdayItems(now)
    })
  },

  // 打开“解析路线”底部弹窗
  onOpenLinkImport() {
    this.setData({
      importSheetVisible: true
    })
  },

  // 关闭“解析路线”底部弹窗
  onCloseLinkImport() {
    this.setData({
      importSheetVisible: false
    })
  },

  // 阻止弹窗内部点击冒泡到遮罩层
  preventBubble() {},

  // 输入框内容同步到页面数据
  onLinkInput(e) {
    this.setData({
      guideLink: (e.detail && e.detail.value) || ''
    })
  },

  // 一键读取剪贴板内容
  onPasteLink() {
    wx.getClipboardData({
      success: ({ data }) => {
        this.setData({ guideLink: data || '' })
      },
      fail: () => {
        wx.showToast({ title: '未获取到剪贴板内容', icon: 'none' })
      }
    })
  },

  // 确认导入内容：
  // 这里会直接解析地点（含逆地理编码），并跳去路线规划页。
  async onConfirmLink() {
    const guideLink = (this.data.guideLink || '').trim()
    if (!guideLink) {
      wx.showToast({ title: '请先粘贴链接或正文', icon: 'none' })
      return
    }

    if (this.data.parsingRoute) return
    this.setData({ parsingRoute: true })
    wx.showLoading({ title: '解析中...' })
    try {
      const resolvedInput = await resolveRouteImportText(guideLink)
      if (!resolvedInput.success || !resolvedInput.text) {
        wx.showToast({ title: resolvedInput.message || '解析失败', icon: 'none' })
        return
      }

      const parseResult = await parseRouteTextToIds(resolvedInput.text)
      if (!parseResult.totalCount) {
        wx.showToast({ title: '暂未识别到可规划地点', icon: 'none' })
        return
      }

      // 显示输入过长警告（如有）
      if (parseResult.warning) {
        console.warn('[route-entry]', parseResult.warning)
      }

      // 显示地理编码统计
      let successMsg = `已识别 ${parseResult.totalCount} 个地点`
      if (parseResult.geoStats && parseResult.geoStats.total > 0) {
        const unresolved = parseResult.geoStats.total - parseResult.geoStats.resolved
        if (unresolved > 0) {
          successMsg += `（${unresolved}个使用估算坐标）`
        }
      }

      this.setData({
        guideLink: '',
        importSheetVisible: false
      })

      wx.showToast({
        title: successMsg,
        icon: 'success'
      })
      setTimeout(() => {
        wx.navigateTo({
          url: `/subpackages/route/pages/my-route/my-route?ids=${parseResult.routeIds.join(',')}&dayCount=${parseResult.dayCount}`
        })
      }, 300)
    } finally {
      wx.hideLoading()
      this.setData({ parsingRoute: false })
    }
  },

  // 点击“创建路线”后进入基础信息页
  onCreateRoute() {
    wx.navigateTo({
      url: '/subpackages/route/pages/route-basic-edit/route-basic-edit?create=1'
    })
  },

  // 打开独立拍照页：先进入相机页，不再先经过“记录美食”页面。
  onOpenCheckin() {
    wx.navigateTo({
      url: '/subpackages/checkin/pages/checkin-camera/checkin-camera?type=food&source=routeEntry'
    })
  }
})
