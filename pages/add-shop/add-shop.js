const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

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
    weekdayItems: []
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
    wx.navigateTo({
      url: '/pages/link-import/link-import'
    })
  },

  onCreateRoute() {
    wx.showToast({
      title: '创建路线稍后接入',
      icon: 'none'
    })
  }
})
