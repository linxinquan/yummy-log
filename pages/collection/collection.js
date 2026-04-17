// pages/collection/collection.js
let checkinUtil = null
try {
  checkinUtil = require('../../utils/checkinUtil')
} catch (e) {
  console.warn('checkinUtil load fail', e)
}

Page({
  data: {
    checkins: [],
    stats: { totalCount: 0, cityCount: 0, spotCount: 0 },
    viewMode: 'list',
    mapCenter: { lat: 22.543, lng: 114.057 },
    mapMarkers: []
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    if (!checkinUtil) return

    const raw = checkinUtil.getCheckins()
    const stats = checkinUtil.getCheckinStats()

    // 预处理日期和地址，避免在 WXML 里调用函数
    const checkins = raw.map((c) => {
      const d = new Date(c.date)
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const yyyy = d.getFullYear()
      // 短地址：取地址前16个字
      const shortAddr = c.address ? c.address.substring(0, 20) : ''
      return Object.assign({}, c, {
        dateStr: mm + '/' + dd + '/' + yyyy,
        shortAddr: shortAddr,
        typeIcon: c.type === 'spot' ? '🏞️' : '🍜',
        typeLabel: c.type === 'spot' ? '景点' : '美食',
        // 地图标记用 spotName（店名/景点名）或地址
        mapTitle: c.spotName || c.address || '未知地点'
      })
    })

    // 统计
    const spotCount = raw.filter(c => c.type === 'spot').length

    // 地图标记
    const mapMarkers = checkins
      .filter((c) => c.latitude && c.longitude)
      .map((c, i) => ({
        id: i,
        latitude: parseFloat(c.latitude),
        longitude: parseFloat(c.longitude),
        width: 36,
        height: 36,
        iconPath: '/images/markers/marker-food.png',
        title: c.spotName || c.address || '采集点',
        callout: {
          content: c.spotName || c.address || '采集点',
          padding: 8,
          borderRadius: 8,
          display: 'BYCLICK'
        }
      }))

    // 地图中心：取最新一条，否则用深圳
    let mapCenter = { lat: 22.543, lng: 114.057 }
    if (checkins.length > 0 && checkins[0].latitude) {
      mapCenter = {
        lat: parseFloat(checkins[0].latitude),
        lng: parseFloat(checkins[0].longitude)
      }
    }

    this.setData({
      checkins,
      stats: { totalCount: checkins.length, cityCount: stats.cityCount, spotCount: spotCount },
      mapMarkers,
      mapCenter
    })
  },

  onSwitchView(e) {
    this.setData({ viewMode: e.currentTarget.dataset.view })
  },

  onCheckinTap(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.checkins.find((c) => c.id === id)
    if (!item) return
    if (item.photoPath) {
      wx.previewImage({
        urls: [item.photoPath],
        current: item.photoPath
      })
    }
  },

  onGoCheckin() {
    wx.navigateTo({ url: '/pages/checkin/checkin?type=food' })
  },

  onGoCheckinFood() {
    wx.navigateTo({ url: '/pages/checkin/checkin?type=food' })
  },

  onGoCheckinSpot() {
    wx.navigateTo({ url: '/pages/checkin/checkin?type=spot' })
  }
})
