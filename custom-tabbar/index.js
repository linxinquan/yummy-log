// 中间“添加”弹窗里的解析路线，直接复用原来添加页的解析工具。
const { parseRouteTextToIds, resolveRouteImportText } = require('../utils/route-import')

Component({
  options: {
    // 只让全局 app.wxss 的图标样式作用到组件里，
    // 保持和原页面一致的图标引用方式，同时尽量避免样式互相污染。
    styleIsolation: 'apply-shared'
  },
  data: {
    selected: 0,
    color: "#BAC4CC",
    selectedColor: "#25bbe7",
    // 控制“添加”底部弹窗显示。
    addSheetVisible: false,
    // 控制“解析路线”输入弹窗显示。
    importSheetVisible: false,
    // 保存用户粘贴的链接或正文。
    guideLink: '',
    // 防止重复点击“确认”触发并发解析。
    parsingRoute: false,
    list: [
      {
        pagePath: "/pages/index/index",
        text: "探索",
        iconPath: "/assets/icons/tabbar-home.png",
        selectedIconPath: "/assets/icons/tabbar-home-active.png"
      },
      {
        pagePath: "/pages/wantgo/wantgo",
        text: "想去",
        iconPath: "/assets/icons/tabbar-spots.png",
        selectedIconPath: "/assets/icons/tabbar-spots-active.png"
      },
      {
        pagePath: "/pages/route-entry/route-entry",
        text: "",
        iconPath: "/assets/icons/tabbar-add.png",
        selectedIconPath: "/assets/icons/tabbar-add.png"
      },
      {
        pagePath: "/pages/discover/discover",
        text: "攻略",
        iconPath: "/assets/icons/tabbar-discover.png",
        selectedIconPath: "/assets/icons/tabbar-discover-active.png"
      },
      {
        pagePath: "/pages/my/my",
        text: "我的",
        iconPath: "/assets/icons/tabbar-my.png",
        selectedIconPath: "/assets/icons/tabbar-my-active.png"
      }
    ]
  },
  attached() {
    this.updateSelected()
  },
  pageLifetimes: {
    show() {
      this.updateSelected()
    }
  },
  methods: {
    // 更新当前选中的普通 Tab。
    // 中间“添加”按钮不是独立内容页时，不让它长期处于选中态。
    updateSelected() {
      const pages = getCurrentPages()
      const currentPage = pages[pages.length - 1]
      if (!currentPage) return // 页面栈为空时跳过
      const route = "/" + currentPage.route
      const list = this.data.list

      // 如果当前正好停留在旧的 route-entry 页，
      // 就回退到上一次正常 Tab，避免中间按钮被高亮。
      if (route === '/pages/route-entry/route-entry') {
        const fallbackPath = wx.getStorageSync('tabbarLastNormalPath') || '/pages/index/index'
        const fallbackIndex = list.findIndex(item => item.pagePath === fallbackPath)
        this.setData({
          selected: fallbackIndex >= 0 ? fallbackIndex : 0
        })
        return
      }

      for (let i = 0; i < list.length; i++) {
        if (list[i].pagePath === route) {
          this.setData({
            selected: i
          })
          break
        }
      }
    },
    // 打开中间“添加”底部弹窗。
    openAddSheet() {
      this.setData({
        addSheetVisible: true,
        importSheetVisible: false
      })
    },
    // 关闭中间“添加”底部弹窗。
    closeAddSheet() {
      this.setData({
        addSheetVisible: false
      })
    },
    // 打开“解析路线”输入弹窗，同时收起入口卡片弹窗。
    onOpenLinkImport() {
      this.setData({
        addSheetVisible: false,
        importSheetVisible: true
      })
    },
    // 关闭“解析路线”输入弹窗。
    onCloseLinkImport() {
      this.setData({
        importSheetVisible: false
      })
    },
    // 阻止面板内部点击冒泡到遮罩层。
    preventBubble() {},
    // 同步输入框内容。
    onLinkInput(e) {
      this.setData({
        guideLink: (e.detail && e.detail.value) || ''
      })
    },
    // 一键读取剪贴板内容。
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
    // 确认解析内容，并直接跳去路线规划页。
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

        if (parseResult.warning) {
          console.warn('[custom-tabbar]', parseResult.warning)
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
          importSheetVisible: false
        })

        wx.showToast({
          title: successMsg,
          icon: 'success'
        })
        setTimeout(() => {
          wx.navigateTo({
            url: `/subpackages/route/pages/route/route?ids=${parseResult.routeIds.join(',')}&dayCount=${parseResult.dayCount}`
          })
        }, 300)
      } finally {
        wx.hideLoading()
        this.setData({ parsingRoute: false })
      }
    },
    // 进入“创建路线”编辑页。
    onCreateRoute() {
      this.setData({
        addSheetVisible: false
      })
      wx.navigateTo({
        url: '/subpackages/route/pages/route-basic-edit/route-basic-edit?create=1'
      })
    },
    // 打开采集打卡页。
    onOpenCheckin() {
      this.setData({
        addSheetVisible: false
      })
      wx.navigateTo({
        url: '/subpackages/checkin/pages/checkin-camera/checkin-camera?type=food&source=routeEntry'
      })
    },
    switchTab(e) {
      const data = e.currentTarget.dataset
      const url = data.path
      if (url) {
        // 中间按钮是“路线入口页”，需要单独记住上一个正常 Tab。
        const centerEntryPath = '/pages/route-entry/route-entry'
        const pages = getCurrentPages()
        const currentPage = pages[pages.length - 1]
        const currentRoute = currentPage ? `/${currentPage.route}` : ''

        // 点击中间“添加”按钮时，改成打开弹窗，不再跳独立页面。
        if (url === centerEntryPath || data.index === 2) {
          const fallbackPath = currentRoute && currentRoute !== centerEntryPath
            ? currentRoute
            : (wx.getStorageSync('tabbarLastNormalPath') || '/pages/index/index')
          wx.setStorageSync('tabbarLastNormalPath', fallbackPath)
          this.openAddSheet()
          return
        }

        wx.setStorageSync('tabbarLastNormalPath', url)

        this.setData({
          selected: data.index,
          addSheetVisible: false,
          importSheetVisible: false
        })
        wx.switchTab({
          url: url,
          fail: (err) => {
            console.log('switchTab fail:', err)
            wx.reLaunch({
              url: url
            })
          }
        })
      }
    }
  }
})
