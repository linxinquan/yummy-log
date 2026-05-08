Component({
  options: {
    addGlobalClass: true
  },

  properties: {
    travelMeta: {
      type: Object,
      value: null
    }
  },

  methods: {
    onTap() {
      this.triggerEvent('tapmeta')
    }
  }
})
