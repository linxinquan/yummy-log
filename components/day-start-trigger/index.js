Component({
  options: {
    // 让组件可以继承 app.wxss 里全局引入的图标字体样式，
    // 否则组件内的 mgc_* 图标类不会生效。
    styleIsolation: 'shared'
  },

  properties: {
    // 当前这一天显示的起点文案。
    text: {
      type: String,
      value: ''
    }
  },

  methods: {
    // 统一往外派发 tap，页面自己决定后续打开哪个起点选择逻辑。
    onTap() {
      this.triggerEvent('tap')
    }
  }
})
