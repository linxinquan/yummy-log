// 地点简介底部弹窗组件
Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    data: {
      type: Object,
      value: null
    }
  },

  methods: {
    onClose() {
      this.triggerEvent('close')
    },

    preventBubble() {},

    onNav() {
      this.triggerEvent('nav')
    }
  }
})
