Component({
  // 允许页面给遮罩、面板和内容区透传自定义类名，方便按场景补充差异样式。
  externalClasses: ['custom-mask-class', 'custom-panel-class', 'custom-body-class'],

  properties: {
    // 控制弹窗显示/隐藏。
    visible: {
      type: Boolean,
      value: false
    },
    // 顶部标题文案。
    title: {
      type: String,
      value: ''
    },
    // 是否显示右上角关闭按钮。
    showClose: {
      type: Boolean,
      value: true
    }
  },

  methods: {
    // 点击遮罩时，统一向外派发 close 事件。
    onMaskTap() {
      this.triggerEvent('close')
    },

    // 点击关闭图标时，同样向外派发 close 事件。
    onClose() {
      this.triggerEvent('close')
    },

    // 阻止面板内部点击冒泡到遮罩层。
    preventBubble() {}
  }
})
