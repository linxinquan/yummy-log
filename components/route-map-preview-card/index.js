Component({
  options: {
    // 允许父页面传入的通用类继续生效，方便页面控制外层位置。
    addGlobalClass: true
  },

  properties: {
    // 当前正在展示的地点数据。
    currentItem: {
      type: Object,
      value: null
    },
    // 顶部每天 Tab 数据。
    previewTabs: {
      type: Array,
      value: []
    },
    // 当前选中的天数索引。
    currentMapDay: {
      type: Number,
      value: -1
    },
    // 标题下面的小标签，例如评分、分类标签。
    previewDisplayMeta: {
      type: Array,
      value: []
    },
    // 中间简介左侧文字。
    previewDescriptionText: {
      type: String,
      value: ''
    },
    // 中间简介右侧文字。
    previewFeeText: {
      type: String,
      value: ''
    },
    // 底部左侧统计文案。
    previewStationText: {
      type: String,
      value: ''
    },
    // 底部右侧统计文案。
    previewCountText: {
      type: String,
      value: ''
    },
    // 上一站索引。
    previewPrevIndex: {
      type: Number,
      value: -1
    },
    // 下一站索引。
    previewNextIndex: {
      type: Number,
      value: -1
    },
    // 上一站按钮是否禁用。
    previewDisablePrev: {
      type: Boolean,
      value: true
    },
    // 下一站按钮是否禁用。
    previewDisableNext: {
      type: Boolean,
      value: true
    }
  },

  methods: {
    // 点击顶部某一天时，把索引抛给父页面处理。
    onSelectDay(e) {
      const index = parseInt(e.currentTarget.dataset.index, 10)
      if (Number.isNaN(index)) return
      this.triggerEvent('selectday', { index })
    },

    // 点击上一站 / 下一站时，把目标索引抛给父页面。
    onStep(e) {
      const index = parseInt(e.currentTarget.dataset.index, 10)
      if (Number.isNaN(index) || index < 0) return
      this.triggerEvent('step', { index })
    },

    // 点击交通信息时，交给父页面打开交通方式弹窗。
    onTapTravelMeta() {
      this.triggerEvent('tapmeta')
    }
  }
})
