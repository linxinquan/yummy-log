// 一周展示文案：用于首页问候下面那一排日期标签。
const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']
// 暂存待解析链接的本地缓存键。
const PENDING_GUIDE_LINKS_KEY = 'pendingGuideLinks'

// 根据链接内容简单判断它来自哪里。
function inferLinkType(url = '') {
  if (/mp\.weixin\.qq\.com/i.test(url)) return '公众号'
  if (/xiaohongshu\.com|xhslink\.com/i.test(url)) return '小红书'
  return '文本'
}

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
    guideLink: ''
  },

  // 页面初始化：计算顶部安全区、问候语和日期条。
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

  // 确认导入链接：先存到本地待处理列表里
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

  // 点击“创建路线”后进入基础信息页
  onCreateRoute() {
    wx.navigateTo({
      url: '/pages/route-basic-edit/route-basic-edit?create=1'
    })
  }
})
