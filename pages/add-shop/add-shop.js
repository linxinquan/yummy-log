// 觅食迹 - 添加店铺页
const util = require('../../utils/util')

// 蛇口中心坐标
const CENTER_COORD = { lat: 22.4846, lng: 113.9046 }

Page({
  data: {
    isBatchMode: false,
    batchShops: [],

    // 表单数据
    shopForm: {
      name: '',
      category: '粤菜',
      emoji: '🍜',
      address: '',
      price: '',
      hours: '',
      dishesText: '',
      lat: '',
      lng: ''
    },

    categories: ['粤菜', '糖水', '小吃', '东南亚', '其他'],
    emojiList: ['🍜', '🍲', '🥘', '🍗', '🍖', '🦐', '🐟', '🦆', '🥟', '🍰', '🧁', '🍵'],

    // 地图选点
    pickerCenter: CENTER_COORD,
    pickerMarkers: []
  },

  onLoad(options) {
    // 批量模式
    if (options.batch) {
      const batchShops = JSON.parse(decodeURIComponent(options.batch))
      batchShops.forEach(shop => {
        shop.selectedCategory = '粤菜'
      })
      this.setData({
        isBatchMode: true,
        batchShops
      })
      wx.setNavigationBarTitle({ title: '批量添加店铺' })
    }

    // 单个模式，预填数据
    if (options.shop) {
      const shop = JSON.parse(decodeURIComponent(options.shop))
      this.setData({
        'shopForm.name': shop.name || '',
        'shopForm.address': shop.address || '',
        'shopForm.dishesText': shop.dishes ? shop.dishes.join('、') : ''
      })

      if (shop.lat && shop.lng) {
        this.setData({
          pickerCenter: { lat: shop.lat, lng: shop.lng },
          pickerMarkers: [{
            id: 1,
            latitude: shop.lat,
            longitude: shop.lng,
            width: 36,
            height: 36
          }]
        })
      }
    }

    this.updatePickerMarker()
  },

  onNameInput(e) {
    this.setData({ 'shopForm.name': e.detail.value })
  },

  onSelectSingleCategory(e) {
    this.setData({ 'shopForm.category': e.currentTarget.dataset.category })
  },

  onSelectEmoji(e) {
    this.setData({ 'shopForm.emoji': e.currentTarget.dataset.emoji })
  },

  onAddressInput(e) {
    this.setData({ 'shopForm.address': e.detail.value })
  },

  onPriceInput(e) {
    this.setData({ 'shopForm.price': e.detail.value })
  },

  onHoursInput(e) {
    this.setData({ 'shopForm.hours': e.detail.value })
  },

  onDishesInput(e) {
    this.setData({ 'shopForm.dishesText': e.detail.value })
  },

  onLatInput(e) {
    this.setData({ 'shopForm.lat': e.detail.value })
    this.updatePickerMarker()
  },

  onLngInput(e) {
    this.setData({ 'shopForm.lng': e.detail.value })
    this.updatePickerMarker()
  },

  onUseCenterCoord() {
    this.setData({
      'shopForm.lat': CENTER_COORD.lat.toString(),
      'shopForm.lng': CENTER_COORD.lng.toString(),
      pickerCenter: CENTER_COORD
    })
    this.updatePickerMarker()
  },

  onChooseLocation() {
    const app = getApp()
    const currentLat = this.data.shopForm.lat ? parseFloat(this.data.shopForm.lat) : null
    const currentLng = this.data.shopForm.lng ? parseFloat(this.data.shopForm.lng) : null

    wx.chooseLocation({
      latitude: currentLat || (app.globalData.location ? app.globalData.location.lat : CENTER_COORD.lat),
      longitude: currentLng || (app.globalData.location ? app.globalData.location.lng : CENTER_COORD.lng),
      success: (res) => {
        const { latitude, longitude, name, address } = res
        const update = {
          'shopForm.lat': latitude.toFixed(6),
          'shopForm.lng': longitude.toFixed(6),
          pickerCenter: { lat: latitude, lng: longitude }
        }

        if (!this.data.shopForm.name && name) {
          update['shopForm.name'] = name
        }
        if (!this.data.shopForm.address && address) {
          update['shopForm.address'] = address
        }

        this.setData(update)
        this.updatePickerMarker()
        wx.showToast({ title: '选点成功', icon: 'success', duration: 1000 })
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.includes('cancel')) return
        wx.showToast({ title: '选点失败，请手动输入', icon: 'none' })
      }
    })
  },

  onMapTap(e) {
    const { latitude, longitude } = e.detail
    this.setData({
      'shopForm.lat': latitude.toFixed(6),
      'shopForm.lng': longitude.toFixed(6),
      pickerCenter: { lat: latitude, lng: longitude }
    })
    this.updatePickerMarker()
  },

  updatePickerMarker() {
    const { lat, lng } = this.data.shopForm
    if (lat && lng) {
      this.setData({
        pickerMarkers: [{
          id: 1,
          latitude: parseFloat(lat),
          longitude: parseFloat(lng),
          width: 36,
          height: 36
        }],
        pickerCenter: { lat: parseFloat(lat), lng: parseFloat(lng) }
      })
    } else {
      this.setData({ pickerMarkers: [] })
    }
  },

  onSelectCategory(e) {
    const index = e.currentTarget.dataset.index
    const category = e.currentTarget.dataset.category
    const batchShops = [...this.data.batchShops]
    batchShops[index].selectedCategory = category
    this.setData({ batchShops })
  },

  onSubmit() {
    if (this.data.isBatchMode) {
      this.submitBatch()
    } else {
      this.submitSingle()
    }
  },

  submitSingle() {
    const { name, category, emoji, address, price, hours, dishesText, lat, lng } = this.data.shopForm

    if (!name.trim()) {
      wx.showToast({ title: '请输入店铺名称', icon: 'none' })
      return
    }

    const dishes = dishesText.split(/[、,，]/).map(d => d.trim()).filter(Boolean)
    const shopLat = lat ? parseFloat(lat) : CENTER_COORD.lat
    const shopLng = lng ? parseFloat(lng) : CENTER_COORD.lng

    const newShop = {
      id: Date.now(),
      name: name.trim(),
      emoji,
      rating: 0,
      price: price ? parseInt(price, 10) : 0,
      category,
      tags: ['用户添加'],
      address: address.trim(),
      lat: shopLat,
      lng: shopLng,
      hours: hours.trim(),
      dishes,
      isUserAdded: true
    }

    const shops = util.loadData('userAddedShops', [])
    shops.push(newShop)
    util.saveData('userAddedShops', shops)
    util.toggleLike(newShop.id, 'food')

    wx.showToast({ title: '添加成功', icon: 'success' })
    setTimeout(() => {
      wx.navigateBack()
    }, 1500)
  },

  submitBatch() {
    const validShops = this.data.batchShops.filter(s => s.name && s.name.trim())
    if (validShops.length === 0) {
      wx.showToast({ title: '没有有效店铺', icon: 'none' })
      return
    }

    const shops = util.loadData('userAddedShops', [])
    const newShops = validShops.map((shop, index) => {
      const newShop = {
        id: Date.now() + index,
        name: shop.name.trim(),
        emoji: '🍜',
        rating: 0,
        price: 0,
        category: shop.selectedCategory || '粤菜',
        tags: ['用户添加'],
        address: shop.address || '',
        lat: CENTER_COORD.lat + (Math.random() - 0.5) * 0.01,
        lng: CENTER_COORD.lng + (Math.random() - 0.5) * 0.01,
        hours: shop.hours || '',
        dishes: shop.dishes || [],
        isUserAdded: true
      }

      util.toggleLike(newShop.id, 'food')
      return newShop
    })

    util.saveData('userAddedShops', [...shops, ...newShops])

    wx.showToast({
      title: `成功添加 ${newShops.length} 家`,
      icon: 'success'
    })

    setTimeout(() => {
      wx.navigateBack()
    }, 1500)
  }
})
