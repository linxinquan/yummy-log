Component({
  options: {
    addGlobalClass: true
  },

  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    options: {
      type: Array,
      value: []
    },
    selectedMode: {
      type: String,
      value: 'walk'
    }
  },

  methods: {
    onClose() {
      this.triggerEvent('close')
    },

    onMaskTap() {
      this.triggerEvent('close')
    },

    onOptionTap(e) {
      const mode = e.currentTarget.dataset.mode
      this.triggerEvent('select', { mode })
    },

    onConfirm() {
      this.triggerEvent('confirm')
    },

    preventBubble() {}
  }
})
