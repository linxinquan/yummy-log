// 觅食图 - 店铺详情页
const app = getApp()
const util = require('../../utils/util')

Page({
  data: {
    shop: {},
    markers: [],
    isLiked: false,
    recordData: null  // 觅食记录数据
  },

  onLoad(options) {
    // 解析店铺数据
    if (options.shop) {
      const shop = JSON.parse(decodeURIComponent(options.shop))
      this.setData({ shop })
      this.initMap(shop)
      this.loadUserData(shop.id)
    }
  },

  // 初始化地图
  initMap(shop) {
    const markers = [{
      id: shop.id,
      latitude: shop.lat || shop.latitude,
      longitude: shop.lng || shop.longitude,
      width: 36,
      height: 36
    }]
    
    this.setData({ markers })
  },

  // 加载用户数据
  loadUserData(shopId) {
    const userData = util.getUserShops()
    const isLiked = userData.likedShops.includes(shopId)
    const recordData = userData.checkedInShops[shopId]
    
    if (recordData) {
      recordData.dateStr = new Date(recordData.date).toLocaleDateString('zh-CN')
    }
    
    this.setData({ isLiked, recordData })
  },

  // 复制地址
  onCopyAddress() {
    wx.setClipboardData({
      data: this.data.shop.address,
      success: () => {
        wx.showToast({ title: '地址已复制', icon: 'none' })
      }
    })
  },

  // 拨打电话
  onCall() {
    if (this.data.shop.phone) {
      wx.makePhoneCall({
        phoneNumber: this.data.shop.phone
      })
    }
  },

  // 预览大地图
  onPreviewMap() {
    const { shop } = this.data
    wx.openLocation({
      latitude: shop.lat || shop.latitude,
      longitude: shop.lng || shop.longitude,
      name: shop.name,
      address: shop.address,
      scale: 16
    })
  },

  // 想去/取消想去
  onToggleLike() {
    const shopId = this.data.shop.id
    const isLiked = util.toggleLike(shopId)
    this.setData({ isLiked })
    
    wx.showToast({
      title: isLiked ? '已添加到想去' : '已取消',
      icon: 'none',
      duration: 1000
    })
  },

  // 标记到访（简单记录，不上传照片/评价）
  onAddRecord() {
    const shopId = this.data.shop.id
    const recordData = {
      rating: this.data.shop.rating || 5,
      comment: '',
      photos: [],
      location: '',
      date: new Date().toISOString(),
      dateStr: new Date().toLocaleDateString('zh-CN')
    }
    
    // 保存到本地
    const userData = util.getUserShops()
    userData.checkedInShops[shopId] = recordData
    util.saveData('userShops', userData)
    
    this.setData({ recordData })
    wx.showToast({ title: '已标记到访', icon: 'success' })
  },

  // 切换到访状态
  onToggleRecord() {
    if (this.data.recordData) {
      // 已到访，点击取消
      wx.showModal({
        title: '取消到访记录',
        content: '确定要取消这条到访记录吗？',
        success: (res) => {
          if (res.confirm) {
            this.removeRecord()
          }
        }
      })
    } else {
      this.onAddRecord()
    }
  },

  // 删除记录
  onRemoveRecord() {
    wx.showModal({
      title: '删除记录',
      content: '确定要删除这条觅食记录吗？',
      success: (res) => {
        if (res.confirm) {
          this.removeRecord()
        }
      }
    })
  },

  // 执行删除记录
  removeRecord() {
    const shopId = this.data.shop.id
    const userData = util.getUserShops()
    delete userData.checkedInShops[shopId]
    util.saveData('userShops', userData)
    
    this.setData({ recordData: null })
    wx.showToast({ title: '已删除记录', icon: 'none' })
  },

  // 导航
  onNavigate() {
    util.openNavigation(this.data.shop)
  }
})
