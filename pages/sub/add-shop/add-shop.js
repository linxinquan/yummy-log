// 觅食迹 - 添加店铺页
const shopData = require('../../utils/shopData')
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
      // 初始化分类
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
      
      // 如果有坐标，设置地图中心
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

  // 单个添加 - 名称输入
  onNameInput(e) {
    this.setData({ 'shopForm.name': e.detail.value })
  },

  // 单个添加 - 分类选择
  onSelectSingleCategory(e) {
    this.setData({ 'shopForm.category': e.currentTarget.dataset.category })
  },

  // Emoji 选择
  onSelectEmoji(e) {
    this.setData({ 'shopForm.emoji': e.currentTarget.dataset.emoji })
  },

  // 地址输入
  onAddressInput(e) {
    this.setData({ 'shopForm.address': e.detail.value })
  },

  // 价格输入
  onPriceInput(e) {
    this.setData({ 'shopForm.price': e.detail.value })
  },

  // 营业时间输入
  onHoursInput(e) {
    this.setData({ 'shopForm.hours': e.detail.value })
  },

  // 推荐菜输入
  onDishesInput(e) {
    this.setData({ 'shopForm.dishesText': e.detail.value })
  },

  // 纬度输入
  onLatInput(e) {
    this.setData({ 'shopForm.lat': e.detail.value })
    this.updatePickerMarker()
  },

  // 经度输入
  onLngInput(e) {
    this.setData({ 'shopForm.lng': e.detail.value })
    this.updatePickerMarker()
  },

  // 使用中心坐标
  onUseCenterCoord() {
    this.setData({
      'shopForm.lat': CENTER_COORD.lat.toString(),
      'shopForm.lng': CENTER_COORD.lng.toString(),
      pickerCenter: CENTER_COORD
    })
    this.updatePickerMarker()
  },

  // 🆕 使用 wx.chooseLocation 在地图上选点（接口已开通）
  onChooseLocation() {
    const app = getApp()
    // 以当前表单坐标或用户位置作为初始显示点
    const currentLat = this.data.shopForm.lat ? parseFloat(this.data.shopForm.lat) : null
    const currentLng = this.data.shopForm.lng ? parseFloat(this.data.shopForm.lng) : null
    
    wx.chooseLocation({
      latitude: currentLat || (app.globalData.location ? app.globalData.location.lat : CENTER_COORD.lat),
      longitude: currentLng || (app.globalData.location ? app.globalData.location.lng : CENTER_COORD.lng),
      success: (res) => {
        const { latitude, longitude, name, address } = res
        // 自动填入坐标
        const update = {
          'shopForm.lat': latitude.toFixed(6),
          'shopForm.lng': longitude.toFixed(6),
          pickerCenter: { lat: latitude, lng: longitude }
        }
        // 如果店铺名和地址为空，自动填入
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

  // 地图点击选点（内嵌地图备用方案）
  onMapTap(e) {
    const { latitude, longitude } = e.detail
    this.setData({
      'shopForm.lat': latitude.toFixed(6),
      'shopForm.lng': longitude.toFixed(6),
      pickerCenter: { lat: latitude, lng: longitude }
    })
    this.updatePickerMarker()
  },

  // 更新地图标记
  updatePickerMarker() {
    const { lat, lng } = this.data.shopForm
    if (lat && lng) {
      const marker = {
        id: 1,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        width: 36,
        height: 36
      }
      this.setData({
        pickerMarkers: [marker],
        pickerCenter: { lat: parseFloat(lat), lng: parseFloat(lng) }
      })
    } else {
      this.setData({ pickerMarkers: [] })
    }
  },

  // 批量模式 - 分类选择
  onSelectCategory(e) {
    const index = e.currentTarget.dataset.index
    const category = e.currentTarget.dataset.category
    const batchShops = [...this.data.batchShops]
    batchShops[index].selectedCategory = category
    this.setData({ batchShops })
  },

  // 提交
  onSubmit() {
    if (this.data.isBatchMode) {
      this.submitBatch()
    } else {
      this.submitSingle()
    }
  },

  // 单个提交
  submitSingle() {
    const { name, category, emoji, address, price, hours, dishesText, lat, lng } = this.data.shopForm
    
    if (!name.trim()) {
      wx.showToast({ title: '请输入店铺名称', icon: 'none' })
      return
    }
    
    // 解析推荐菜
    const dishes = dishesText.split(/[、,，]/).map(d => d.trim()).filter(d => d)
    
    // 坐标，默认使用中心点
    const shopLat = lat ? parseFloat(lat) : CENTER_COORD.lat
    const shopLng = lng ? parseFloat(lng) : CENTER_COORD.lng
    
    // 创建店铺对象
    const newShop = {
      id: Date.now(),
      name: name.trim(),
      emoji: emoji,
      rating: 0,
      price: price ? parseInt(price) : 0,
      category: category,
      tags: ['用户添加'],
      address: address.trim(),
      lat: shopLat,
      lng: shopLng,
      hours: hours.trim(),
      dishes: dishes,
      isUserAdded: true
    }
    
    // 保存
    const shops = util.loadData('userAddedShops', [])
    shops.push(newShop)
    util.saveData('userAddedShops', shops)
    
    // 同时添加到想去
    util.toggleLike(newShop.id)
    
    wx.showToast({ title: '添加成功', icon: 'success' })
    setTimeout(() => {
      wx.navigateBack()
    }, 1500)
  },

  // 批量提交
  submitBatch() {
    const batchShops = this.data.batchShops
    
    // 检查是否都有名称
    const validShops = batchShops.filter(s => s.name && s.name.trim())
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
      
      // 添加到想去
      util.toggleLike(newShop.id)
      
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
