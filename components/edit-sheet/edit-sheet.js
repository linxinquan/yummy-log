// components/edit-sheet/edit-sheet.js
// 编辑采集弹窗组件：统一 checkin 确认页和 checkin-detail 详情页的编辑体验
Component({
  properties: {
    visible: { type: Boolean, value: false },
    spotName: { type: String, value: '' },
    address: { type: String, value: '' },
    description: { type: String, value: '' },
    latitude: { type: Number, value: null },
    longitude: { type: Number, value: null }
  },

  observers: {
    'visible'(val) {
      if (val) {
        this.setData({
          editSpotName: this.properties.spotName,
          editAddress: this.properties.address,
          editDescription: this.properties.description,
          editLatitude: this.properties.latitude,
          editLongitude: this.properties.longitude,
          editGeneratingSpotName: false,
          editGeneratingDescription: false
        })
      }
    }
  },

  data: {
    editSpotName: '',
    editAddress: '',
    editDescription: '',
    editLatitude: null,
    editLongitude: null,
    editGeneratingSpotName: false,
    editGeneratingDescription: false
  },

  methods: {
    onClose() {
      this.triggerEvent('close')
    },

    preventBubble() {},

    onSpotNameInput(e) {
      this.setData({ editSpotName: e.detail.value })
    },

    onAddressInput(e) {
      this.setData({ editAddress: e.detail.value })
    },

    onDescriptionInput(e) {
      this.setData({ editDescription: e.detail.value })
    },

    // AI 生成打卡名称：触发事件让页面处理
    onGenerateSpotName() {
      if (this.data.editGeneratingSpotName) return
      this.setData({ editGeneratingSpotName: true })
      this.triggerEvent('generateSpotName')
    },

    // AI 生成打卡内容：触发事件让页面处理
    onGenerateDescription() {
      if (this.data.editGeneratingDescription) return
      this.setData({ editGeneratingDescription: true })
      this.triggerEvent('generateDescription')
    },

    // 页面调用，返回 AI 生成的打卡名称
    onAISpotNameResult(name) {
      this.setData({
        editSpotName: name || '',
        editGeneratingSpotName: false
      })
    },

    // 页面调用，返回 AI 生成的打卡内容
    onAIDescriptionResult(desc) {
      this.setData({
        editDescription: desc || '',
        editGeneratingDescription: false
      })
    },

    // AI 生成失败时页面调用
    onAIGenerateFailed() {
      this.setData({
        editGeneratingSpotName: false,
        editGeneratingDescription: false
      })
    },

    // 地图选点
    onPickLocation() {
      wx.chooseLocation({
        success: (res) => {
          this.setData({
            editAddress: res.address || res.name || '',
            editLatitude: res.latitude || null,
            editLongitude: res.longitude || null
          })
        }
      })
    },

    // 确认保存
    onConfirm() {
      this.triggerEvent('confirm', {
        spotName: this.data.editSpotName,
        address: this.data.editAddress,
        description: this.data.editDescription,
        latitude: this.data.editLatitude,
        longitude: this.data.editLongitude
      })
    }
  }
})
