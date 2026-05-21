Component({
  data: {
    selected: 0,
    color: "#E1E1E1",
    selectedColor: "#3D403F",
    list: [
      {
        pagePath: "/pages/index/index",
        text: "探索",
        iconPath: "cloud://cloud1-9grc0ja0405b042a.636c-cloud1-9grc0ja0405b042a-1420912402/images/tabbar-home.png",
        selectedIconPath: "cloud://cloud1-9grc0ja0405b042a.636c-cloud1-9grc0ja0405b042a-1420912402/images/tabbar-home-active.png"
      },
      {
        pagePath: "/pages/wantgo/wantgo",
        text: "想去",
        iconPath: "cloud://cloud1-9grc0ja0405b042a.636c-cloud1-9grc0ja0405b042a-1420912402/images/tabbar-spots.png",
        selectedIconPath: "cloud://cloud1-9grc0ja0405b042a.636c-cloud1-9grc0ja0405b042a-1420912402/images/tabbar-spots-active.png"
      },
      {
        pagePath: "/pages/route-entry/route-entry",
        text: "",
        iconPath: "cloud://cloud1-9grc0ja0405b042a.636c-cloud1-9grc0ja0405b042a-1420912402/images/tabbar-add.png",
        selectedIconPath: "cloud://cloud1-9grc0ja0405b042a.636c-cloud1-9grc0ja0405b042a-1420912402/images/tabbar-add.png"
      },
      {
        pagePath: "/pages/discover/discover",
        text: "攻略",
        iconPath: "cloud://cloud1-9grc0ja0405b042a.636c-cloud1-9grc0ja0405b042a-1420912402/images/tabbar-discover.png",
        selectedIconPath: "cloud://cloud1-9grc0ja0405b042a.636c-cloud1-9grc0ja0405b042a-1420912402/images/tabbar-discover-active.png"
      },
      {
        pagePath: "/pages/my/my",
        text: "我的",
        iconPath: "cloud://cloud1-9grc0ja0405b042a.636c-cloud1-9grc0ja0405b042a-1420912402/images/tabbar-my.png",
        selectedIconPath: "cloud://cloud1-9grc0ja0405b042a.636c-cloud1-9grc0ja0405b042a-1420912402/images/tabbar-my-active.png"
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
    updateSelected() {
      const pages = getCurrentPages()
      const currentPage = pages[pages.length - 1]
      const route = "/" + currentPage.route
      const list = this.data.list
      for (let i = 0; i < list.length; i++) {
        if (list[i].pagePath === route) {
          this.setData({
            selected: i
          })
          break
        }
      }
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

        if (url === centerEntryPath) {
          const fallbackPath = currentRoute && currentRoute !== centerEntryPath
            ? currentRoute
            : (wx.getStorageSync('tabbarLastNormalPath') || '/pages/index/index')
          wx.setStorageSync('tabbarLastNormalPath', fallbackPath)
        } else {
          wx.setStorageSync('tabbarLastNormalPath', url)
        }

        this.setData({
          selected: data.index
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
