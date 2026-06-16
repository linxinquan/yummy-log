// behaviors/route-place-behavior.js
// 地点交互相关行为的 Behavior
// 包含：打开地点简介、导航、关闭弹窗等功能

const util = require('../../../utils/util')
const {
  buildPlaceIntroData
} = require('../../../utils/route-place-card')


module.exports = Behavior({
  data: {
    // 地点简介
    placeIntroVisible: false,
    placeIntroData: null,
    
    // 导航地图选择
    navMapSheetVisible: false,
    navMapTarget: null
  },


methods: {
      // 点击地点卡片，进入对应详情页
      onOpenPlaceIntro(e) {
        if (this.data.isEditing) return
        const dayIndex = parseInt(e.currentTarget.dataset.dayIndex, 10)
        const itemIndex = parseInt(e.currentTarget.dataset.index, 10)
        const day = (this.data.daySections || [])[dayIndex]
        const item = ((day || {}).items || [])[itemIndex]
        if (!item) return
        this.setData({
          placeIntroVisible: true,
          placeIntroData: buildPlaceIntroData(item, this.data.cityText, '/images/app-logo.jpg')
        })
      },
    
      // 关闭地点简介底部弹窗。
      onClosePlaceIntro() {
        this.setData({
          placeIntroVisible: false,
          placeIntroData: null
        })
      },
    
      // 点击右侧导航图标：打开导航地图选择弹窗。
      onOpenPlaceNavigation(e) {
        if (this.data.isEditing) return
        const dayIndex = parseInt(e.currentTarget.dataset.dayIndex, 10)
        const itemIndex = parseInt(e.currentTarget.dataset.index, 10)
        const day = (this.data.daySections || [])[dayIndex]
        const item = ((day || {}).items || [])[itemIndex]
        if (!item) return
        this.setData({
          navMapSheetVisible: true,
          navMapTarget: {
            lat: item.lat,
            lng: item.lng,
            name: item.name,
            address: item.address || `${this.data.cityText || ''}${item.name || ''}`
          }
        })
      },


       // 点击地点简介里的地址：
  // 继续复用同一个"请选择导航地图"弹窗，避免两套导航逻辑不一致。
  onOpenPlaceIntroNavigation() {
    const target = this.data.placeIntroData
    if (!target) return
    this.setData({
      navMapSheetVisible: true,
      navMapTarget: {
        lat: target.lat,
        lng: target.lng,
        name: target.name,
        address: target.address || `${this.data.cityText || ''}${target.name || ''}`
      }
    })
  },

  // 关闭导航地图选择弹窗。
  onCloseNavMapSheet() {
    this.setData({
      navMapSheetVisible: false,
      navMapTarget: null
    })
  },

  // 在导航弹窗里选择地图应用或复制地址。
  onSelectNavMapOption(e) {
    const type = e.currentTarget.dataset.type
    const target = this.data.navMapTarget
    if (!type || !target) return

    if (type === 'tencent') {
      util.openWechatNavigation(target)
      this.onCloseNavMapSheet()
      return
    }

    if (type === 'gaode') {
      util.openGaodeNavigation(target.lat, target.lng, target.name)
      this.onCloseNavMapSheet()
      return
    }

    if (type === 'copy') {
      wx.setClipboardData({
        data: target.address || target.name,
        success: () => {
          wx.showToast({ title: '地址已复制', icon: 'success' })
          this.onCloseNavMapSheet()
        }
      })
    }
  },
    // 直接导航到某个地点
  onNavigateToShop(e) {
    const shop = e.currentTarget.dataset.shop
    util.openWechatNavigation(shop)
  },

},
})