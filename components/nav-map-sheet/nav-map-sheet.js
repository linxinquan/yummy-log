// 导航地图选择弹窗组件
const util = require('../../utils/util')

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    target: {
      type: Object,
      value: null
    }
  },

  methods: {
    onClose() {
      this.triggerEvent('close')
    },

    onSelectMapOption(e) {
      const type = e.currentTarget.dataset.type
      const target = this.properties.target
      if (!type || !target) return

      if (type === 'tencent') {
        util.openWechatNavigation(target)
        this.onClose()
        return
      }

      if (type === 'gaode') {
        util.openGaodeNavigation(target.lat, target.lng, target.name)
        this.onClose()
        return
      }

      if (type === 'copy') {
        wx.setClipboardData({
          data: target.address || target.name,
          success: () => {
            wx.showToast({ title: '地址已复制', icon: 'success' })
            this.onClose()
          }
        })
      }
    }
  }
})
