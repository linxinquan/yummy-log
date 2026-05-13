const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']
const PENDING_GUIDE_LINKS_KEY = 'pendingGuideLinks'

function inferLinkType(url = '') {
  if (/mp\.weixin\.qq\.com/i.test(url)) return '公众号'
  if (/xiaohongshu\.com|xhslink\.com/i.test(url)) return '小红书'
  return '文本'
}

function getGreetingText(date = new Date()) {
  const hour = date.getHours()
  if (hour < 6) return '凌晨好'
  if (hour < 12) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

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
    guideLink: ''
  },

  onLoad() {
    const now = new Date()
    const sysInfo = wx.getSystemInfoSync()
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const menuTop = menuButtonInfo ? menuButtonInfo.top : (sysInfo.statusBarHeight || 44) + 4
    const menuHeight = menuButtonInfo ? menuButtonInfo.height : 32
    const menuRightInset = menuButtonInfo
      ? Math.max(sysInfo.windowWidth - menuButtonInfo.left + 8, 24)
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

  onShow() {
    const now = new Date()
    this.setData({
      greetingText: getGreetingText(now),
      weekdayItems: buildWeekdayItems(now)
    })
  },

  onOpenLinkImport() {
    this.setData({
      importSheetVisible: true
    })
  },

  onCloseLinkImport() {
    this.setData({
      importSheetVisible: false
    })
  },

  preventBubble() {},

  onLinkInput(e) {
    this.setData({
      guideLink: (e.detail && e.detail.value) || ''
    })
  },

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

  onConfirmLink() {
    const guideLink = (this.data.guideLink || '').trim()
    if (!guideLink) {
      wx.showToast({ title: '请先粘贴链接', icon: 'none' })
      return
    }

    const links = wx.getStorageSync(PENDING_GUIDE_LINKS_KEY) || []
    links.unshift({
      id: `guide-link-${Date.now()}`,
      url: guideLink,
      content: guideLink,
      type: inferLinkType(guideLink),
      createdAt: Date.now(),
      status: 'pending'
    })
    wx.setStorageSync(PENDING_GUIDE_LINKS_KEY, links)

    this.setData({
      guideLink: '',
      importSheetVisible: false
    })
    wx.showToast({ title: '内容已添加', icon: 'success' })
  },

  onCreateRoute() {
    wx.navigateTo({
      url: '/pages/route-basic-edit/route-basic-edit?create=1'
    })
  }
})
