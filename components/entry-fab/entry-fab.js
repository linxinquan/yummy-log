// 公用悬浮添加入口组件：FAB 按钮 + 三卡片菜单 + 解析路线弹窗
// 统一管理"想去"和"攻略"页的添加入口逻辑
const {
  parseRouteTextToIds,
  resolveRouteImportText
} = require('../../utils/route-import')

Component({
  options: {
    addGlobalClass: true
  },

  properties: {
    // 来源标识，影响跳转参数：discover / wantgo
    source: {
      type: String,
      value: 'discover'
    },
    // 解析路线弹窗底部间距（rpx）
    bottomPadding: {
      type: Number,
      value: 48
    }
  },

  data: {
    addEntryVisible: false,
    importEntryVisible: false,
    guideLink: '',
    parsingRoute: false
  },

  methods: {
    preventBubble() {},

    openAddEntrySheet() {
      this.setData({
        addEntryVisible: true,
        importEntryVisible: false
      })
    },

    closeAddEntrySheet() {
      this.setData({ addEntryVisible: false })
    },

    onEntryFabTap() {
      if (this.data.addEntryVisible || this.data.importEntryVisible) {
        this.closeActiveEntryOverlay()
        return
      }
      this.openAddEntrySheet()
    },

    closeActiveEntryOverlay() {
      this.setData({
        addEntryVisible: false,
        importEntryVisible: false
      })
    },

    onOpenLinkImport() {
      this.setData({
        addEntryVisible: false,
        importEntryVisible: true
      })
    },

    onCloseLinkImport() {
      this.setData({ importEntryVisible: false })
    },

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
          wx.showToast({
            title: resolvedInput.message || '解析失败',
            icon: 'none'
          })
          return
        }

        const parseResult = await parseRouteTextToIds(resolvedInput.text)
        if (!parseResult.totalCount) {
          wx.showToast({ title: '暂未识别到可规划地点', icon: 'none' })
          return
        }

        if (parseResult.warning) {
          console.warn(`[entry-fab/${this.data.source}]`, parseResult.warning)
        }

        let successMsg = `已识别 ${parseResult.totalCount} 个地点`
        if (parseResult.geoStats && parseResult.geoStats.total > 0) {
          const unresolved = parseResult.geoStats.total - parseResult.geoStats.resolved
          if (unresolved > 0) {
            successMsg += `（${unresolved}个使用估算坐标）`
          }
        }

        this.setData({
          guideLink: '',
          importEntryVisible: false
        })

        wx.showToast({
          title: successMsg,
          icon: 'success'
        })

        // 发送 confirmlink 事件，由父页面处理导航（可添加 returnTo 等参数）
        const navUrl = `/subpackages/route/pages/my-route/my-route?ids=${parseResult.routeIds.join(',')}&dayCount=${parseResult.dayCount}`
        this.triggerEvent('confirmlink', { url: navUrl, parseResult })
      } finally {
        wx.hideLoading()
        this.setData({ parsingRoute: false })
      }
    },

    onCreateRouteFromFab() {
      this.setData({ addEntryVisible: false })
      // 发送事件，父页面可覆盖默认导航
      this.triggerEvent('createroute')
    },

    onOpenCheckinFromFab() {
      this.setData({ addEntryVisible: false })
      const source = this.data.source
      const checkinSource = source === 'wantgo' ? 'wantgoFab' : 'discoverFab'
      const url = `/subpackages/checkin/pages/checkin-camera/checkin-camera?type=food&source=${checkinSource}`
      wx.navigateTo({ url })
    }
  }
})
