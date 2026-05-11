Component({
  options: {
    addGlobalClass: true
  },

  properties: {
    travelMeta: {
      type: Object,
      value: null
    },
    variant: {
      type: String,
      value: 'default'
    }
  },

  methods: {
    onTap() {
      this.triggerEvent('tapmeta')
    }
  }
})
