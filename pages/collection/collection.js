// pages/collection/collection.js
let checkinUtil = null
const util = require('../../utils/util')
try {
  checkinUtil = require('../../utils/checkinUtil')
} catch (e) {
  console.warn('checkinUtil load fail', e)
}

Page({
  data: {
    checkins: [],
    stats: { totalCount: 0, cityCount: 0, footprintCount: 0 },
    viewMode: 'list',
    mapCenter: { lat: 22.543, lng: 114.057 },
    mapMarkers: [],
    mapScale: 12,
    actionSheetVisible: false,
    editNameSheetVisible: false,
    activeCheckinId: '',
    activeCheckinName: '',
    editNameValue: '',
    selectedAction: ''
  },

  onLoad() {
    this._markerIconCache = {}
    this._markerIdMap = {}
    this._loadToken = 0
  },

  onShow() {
    this.loadData()
  },

  async loadData() {
    if (!checkinUtil) return
    const loadToken = ++this._loadToken

    const raw = checkinUtil.getCheckins()
    const stats = checkinUtil.getCheckinStats()
    const footprintItems = util.getFootprintItems()

    // 预处理日期和地址，避免在 WXML 里调用函数
    const checkins = raw.map((c) => {
      const d = new Date(c.date)
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const yyyy = d.getFullYear()
      const hh = String(d.getHours()).padStart(2, '0')
      const minute = String(d.getMinutes()).padStart(2, '0')
      // 短地址：取地址前16个字
      const shortAddr = c.address ? c.address.substring(0, 20) : ''
      return Object.assign({}, c, {
        dateStr: mm + '/' + dd + '/' + yyyy,
        monthDay: mm + '.' + dd,
        yearText: String(yyyy),
        timeText: hh + ':' + minute,
        dateTimeText: yyyy + '.' + mm + '.' + dd + ' ' + hh + ':' + minute,
        shortAddr: shortAddr,
        addressLine: c.address || '',
        typeIcon: c.type === 'spot' ? 'mgc_scenery_line' : 'mgc_fork_spoon_line',
        typeLabel: c.type === 'spot' ? '景点' : '美食',
        // 地图标记用 spotName（店名/景点名）或地址
        mapTitle: c.spotName || c.address || '未知地点'
      })
    })

    // 统计
    const spotCount = raw.filter(c => c.type === 'spot').length

    // 地图模式：直接在地图上叠邮票和定位点，不再使用默认 marker 图标
    const mapCheckins = checkins.filter(c => c.latitude && c.longitude)
    const mapMarkers = await this.buildMapMarkers(mapCheckins)
    if (loadToken !== this._loadToken) return

    // 地图中心：取最新一条，否则用深圳
    let mapCenter = { lat: 22.543, lng: 114.057 }
    if (mapCheckins.length > 0) {
      const centerLat = mapCheckins.reduce((sum, item) => sum + parseFloat(item.latitude), 0) / mapCheckins.length
      const centerLng = mapCheckins.reduce((sum, item) => sum + parseFloat(item.longitude), 0) / mapCheckins.length
      mapCenter = {
        lat: centerLat,
        lng: centerLng
      }
    }

    this.setData({
      checkins,
      stats: {
        totalCount: checkins.length,
        cityCount: stats.cityCount,
        footprintCount: footprintItems.length || spotCount
      },
      mapMarkers,
      mapCenter
    })
  },

  // 地图改成真实 marker：
  // 先把邮票和蓝点绘成 marker 图，再用经纬度绑定到地图上
  async buildMapMarkers(items = []) {
    const markers = []
    this._markerIdMap = {}

    for (let index = 0; index < (items || []).length; index += 1) {
      const item = items[index]
      const markerId = index + 1
      const iconPath = await this.generateMapMarkerIcon(item)
      this._markerIdMap[markerId] = item.id

      markers.push({
        id: markerId,
        latitude: parseFloat(item.latitude),
        longitude: parseFloat(item.longitude),
        iconPath,
        width: 85,
        height: 132,
        anchor: {
          x: 0.5,
          y: 1
        }
      })
    }

    return markers
  },

  // 使用隐藏 canvas 生成半尺寸地图邮票图标，保证 marker 能跟着地图缩放和拖动。
  generateMapMarkerIcon(item) {
    return new Promise((resolve) => {
      const cacheKey = `${item.id}_${item.photoPath || ''}`
      if (this._markerIconCache[cacheKey]) {
        resolve(this._markerIconCache[cacheKey])
        return
      }

      const shellPath = '/images/collection/stamp-ticket.png'
      const photoPath = item.photoPath
      const ctx = wx.createCanvasContext('mapMarkerCanvas', this)

      ctx.clearRect(0, 0, 170, 264)
      ctx.setShadow(0, 8, 36, 'rgba(0, 0, 0, 0.10)')
      ctx.drawImage(shellPath, 0, 0, 170, 221)
      ctx.setShadow(0, 0, 0, 'rgba(0, 0, 0, 0)')

      if (photoPath) {
        ctx.drawImage(photoPath, 16, 16, 138, 184)
      }

      ctx.beginPath()
      ctx.setFillStyle('#47BFFE')
      ctx.arc(85, 240, 16, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.setLineWidth(4)
      ctx.setStrokeStyle('#FFFFFF')
      ctx.arc(85, 240, 16, 0, Math.PI * 2)
      ctx.stroke()

      ctx.draw(false, () => {
        wx.canvasToTempFilePath({
          canvasId: 'mapMarkerCanvas',
          x: 0,
          y: 0,
          width: 170,
          height: 264,
          destWidth: 170,
          destHeight: 264,
          fileType: 'png',
          success: (res) => {
            this._markerIconCache[cacheKey] = res.tempFilePath
            resolve(res.tempFilePath)
          },
          fail: () => {
            resolve(shellPath)
          }
        }, this)
      })
    })
  },

  onSwitchView(e) {
    this.setData({ viewMode: e.currentTarget.dataset.view })
  },

  // 地图 marker 点击后，进入对应采集详情页。
  onMarkerTap(e) {
    const markerId = e.detail.markerId
    const checkinId = this._markerIdMap[markerId]
    if (!checkinId) return

    wx.navigateTo({
      url: '/pages/checkin-detail/checkin-detail?id=' + encodeURIComponent(checkinId)
    })
  },

  onCheckinTap(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.checkins.find((c) => c.id === id)
    if (!item) return
    // 点击邮票进入详情页，再展示采集时间和完整内容
    wx.navigateTo({
      url: '/pages/checkin-detail/checkin-detail?id=' + encodeURIComponent(id)
    })
  },

  // 长按邮票打开底部操作弹窗，统一承接编辑名称和删除。
  onCheckinLongPress(e) {
    const { id, name } = e.currentTarget.dataset
    if (!id) return
    this.setData({
      actionSheetVisible: true,
      editNameSheetVisible: false,
      activeCheckinId: id,
      activeCheckinName: name || '',
      editNameValue: name || '',
      selectedAction: ''
    })
  },

  onCloseActionSheet() {
    this.setData({
      actionSheetVisible: false,
      selectedAction: ''
    })
  },

  onSelectAction(e) {
    const action = e.currentTarget.dataset.action
    if (!action) return
    this.setData({
      selectedAction: action
    })
  },

  onConfirmSelectedAction() {
    if (!this.data.selectedAction) {
      wx.showToast({
        title: '请选择操作',
        icon: 'none'
      })
      return
    }

    if (this.data.selectedAction === 'delete') {
      this.onDeleteCheckin()
      return
    }

    this.setData({
      actionSheetVisible: false,
      editNameSheetVisible: true,
      editNameValue: this.data.activeCheckinName || ''
    })
  },

  onCloseEditNameSheet() {
    this.setData({
      editNameSheetVisible: false
    })
  },

  preventBubble() {},

  onEditNameInput(e) {
    this.setData({
      editNameValue: e.detail.value
    })
  },

  // 编辑名称只更新邮票标题，保存后立即刷新列表。
  onConfirmEditName() {
    const { activeCheckinId, editNameValue } = this.data
    if (!activeCheckinId || !checkinUtil) return

    const nextName = String(editNameValue || '').trim()
    if (!nextName) {
      wx.showToast({
        title: '名称不能为空',
        icon: 'none'
      })
      return
    }

    const updated = checkinUtil.updateCheckin(activeCheckinId, {
      spotName: nextName
    })

    if (!updated) {
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      })
      return
    }

    this.setData({
      editNameSheetVisible: false,
      activeCheckinName: nextName
    })
    this.loadData()
  },

  // 删除前再确认一次，避免长按误触直接删掉采集。
  onDeleteCheckin() {
    const { activeCheckinId } = this.data
    if (!activeCheckinId || !checkinUtil) return

    wx.showModal({
      title: '删除采集',
      content: '删除后这张邮票会从我的采集中移除',
      confirmText: '删除',
      confirmColor: '#E05252',
      success: (res) => {
        if (!res.confirm) return

        checkinUtil.deleteCheckin(activeCheckinId)
        this.setData({
          actionSheetVisible: false,
          editNameSheetVisible: false,
          activeCheckinId: '',
          activeCheckinName: '',
          editNameValue: '',
          selectedAction: ''
        })
        this.loadData()
      }
    })
  },

  onGoCheckin() {
    wx.navigateTo({ url: '/pages/checkin-camera/checkin-camera?type=food&source=collection' })
  },

  onGoCheckinFood() {
    this.onGoCheckin()
  },

  onGoCheckinSpot() {
    this.onGoCheckin()
  }
})
