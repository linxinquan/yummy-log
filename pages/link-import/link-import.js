// 暂存待解析链接的本地缓存键。
const PENDING_GUIDE_LINKS_KEY = 'pendingGuideLinks'

// 根据链接内容简单判断它来自哪里。
function inferLinkType(url = '') {
  if (/mp\.weixin\.qq\.com/i.test(url)) return '公众号'
  if (/xiaohongshu\.com|xhslink\.com/i.test(url)) return '小红书'
  return '文本'
}

Page({
  data: {
    guideLink: ''
  },

  // 输入框内容同步到页面数据
  onLinkInput(e) {
    this.setData({ guideLink: e.detail.value || '' })
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

    wx.showToast({ title: '内容已添加', icon: 'success' })
    setTimeout(() => {
      wx.navigateBack({ delta: 1 })
    }, 300)
  },

  // 返回上一页
  onBack() {
    wx.navigateBack({ delta: 1 })
  }
})
