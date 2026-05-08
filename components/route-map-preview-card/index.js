Component({
  properties: {
    place: {
      type: Object,
      value: null
    },
    dayTabs: {
      type: Array,
      value: []
    },
    currentDay: {
      type: Number,
      value: 0
    },
    currentIndex: {
      type: Number,
      value: 0
    },
    totalCount: {
      type: Number,
      value: 0
    },
    disablePrev: {
      type: Boolean,
      value: false
    },
    disableNext: {
      type: Boolean,
      value: false
    }
  },

  methods: {
    onDayTap(e) {
      const index = parseInt(e.currentTarget.dataset.index, 10)
      this.triggerEvent('daychange', { index })
    },

    onTapMeta() {
      this.triggerEvent('tapmeta')
    },

    onPrevTap() {
      if (this.data.disablePrev) return
      this.triggerEvent('prev')
    },

    onNextTap() {
      if (this.data.disableNext) return
      this.triggerEvent('next')
    }
  }
})
