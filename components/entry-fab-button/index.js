// 公用悬浮添加按钮组件：
// 统一管理按钮尺寸、位置和中间加号样式，方便多个页面同步复用。
Component({
  properties: {
    // 控制按钮中间图形：默认显示加号，弹窗打开后可切成叉号。
    iconType: {
      type: String,
      value: 'add'
    },
    // 弹窗关闭按钮需要盖在遮罩和面板之上，所以单独提升层级。
    overlay: {
      type: Boolean,
      value: false
    }
  },
  methods: {
    // 对外抛出点击事件，让页面自己决定打开什么菜单。
    onTap() {
      this.triggerEvent('tapentry')
    }
  }
})
