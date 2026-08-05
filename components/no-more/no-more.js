// 列表底部"没有更多了"提示组件
Component({
  properties: {
    // 自定义提示文字，默认"已经没有更多了"
    text: {
      type: String,
      value: '已经没有更多了'
    },
    // 自定义容器顶部外边距
    marginTop: {
      type: String,
      value: '48rpx'
    }
  }
})
