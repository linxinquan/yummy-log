const { parseRouteTextToIds, resolveRouteImportText } = require('../../../../utils/route-import')

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

  // 确认导入内容：直接解析并跳去路线规划页。
  async onConfirmLink() {
    const guideLink = (this.data.guideLink || '').trim()
    if (!guideLink) {
      wx.showToast({ title: '请先粘贴链接或正文', icon: 'none' })
      return
    }

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

      wx.showToast({ title: `已识别 ${parseResult.totalCount} 个地点`, icon: 'success' })
      setTimeout(() => {
        wx.navigateTo({
          url: `/subpackages/route/pages/my-route/my-route?ids=${parseResult.routeIds.join(',')}&dayCount=${parseResult.dayCount}`
        })
      }, 300)
    } finally {
      wx.hideLoading()
    }
  },

  // 返回上一页
  onBack() {
    wx.navigateBack({ delta: 1 })
  }
})
