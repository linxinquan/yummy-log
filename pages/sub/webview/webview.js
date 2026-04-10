// 觅食图 - WebView页面
Page({
  data: {
    webUrl: '',
    title: ''
  },

  onLoad(options) {
    if (options.url) {
      this.setData({
        webUrl: decodeURIComponent(options.url),
        title: options.title || '导航'
      })
      wx.setNavigationBarTitle({ title: this.data.title })
    }
  },

  onWebViewMessage(e) {
    console.log('WebView消息:', e.detail)
  }
})
