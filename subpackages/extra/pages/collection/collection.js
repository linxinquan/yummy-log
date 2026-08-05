// pages/collection/collection.js
let checkinUtil = null
const util = require('../../../../utils/util')
let photoStorage = null
try {
  photoStorage = require('../../utils/photoStorage')
} catch (e) {
  console.warn('photoStorage load fail', e)
}
try {
  checkinUtil = require('../../../../utils/checkinUtil')
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
    // 删除确认也改成自定义底部弹窗，避免再走原生确认框。
    deleteConfirmVisible: false,
    activeCheckinId: '',
    activeCheckinName: '',
    editNameValue: ''
  },

  onLoad() {
    this._markerIconCache = {}
    this._markerIdMap = {}
    this._markerClusterMap = {}
    this._markerMetaMap = {}
    this._baseMapMarkers = []
    this._baseMarkerIdMap = {}
    this._baseMarkerClusterMap = {}
    this._baseMarkerMetaMap = {}
    this._expandedClusterMarkerId = null
    this._loadToken = 0

  },

  onUnload() {
  },

  onShow() {
    this.loadData()
  },

  async loadData() {
    if (!checkinUtil) return
    const loadToken = ++this._loadToken

    // 只读本地缓存，不同步。同步由 onShow 里的 enqueue 统一负责，
    // 避免在 await buildMapMarkers 期间同步覆盖本地数据造成竞争条件。
    const raw = checkinUtil.getCheckins()
    const stats = checkinUtil.getCheckinStats()
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
        displayPath: photoStorage ? photoStorage.getDisplayPath(c) : (c.photoPath || ''),
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
    // “我的采集”页只统计采集本身，不把手动足迹混进来。
    const collectedFootprintKeys = new Set(
      raw.map(item => `${item.type || 'food'}:${item.spotName || ''}:${item.address || ''}`)
    )

    // ── 第一步：列表数据先 setData，用户立刻能看到邮票 ──
    if (loadToken !== this._loadToken) return
    this.setData({
      checkins,
      stats: {
        totalCount: checkins.length,
        cityCount: stats.cityCount,
        footprintCount: collectedFootprintKeys.size || spotCount
      },
    })

    // ── 第二步：异步生成地图标记，不阻塞列表渲染 ──
    const mapCheckins = checkins.filter(c => c.latitude && c.longitude)
    const mapMarkers = await this.buildMapMarkers(mapCheckins)
    if (loadToken !== this._loadToken) return

    // 地图中心：取所有标记平均坐标，无数据则用深圳
    let mapCenter = { lat: 22.543, lng: 114.057 }
    if (mapCheckins.length > 0) {
      const centerLat = mapCheckins.reduce((sum, item) => sum + parseFloat(item.latitude), 0) / mapCheckins.length
      const centerLng = mapCheckins.reduce((sum, item) => sum + parseFloat(item.longitude), 0) / mapCheckins.length
      mapCenter = { lat: centerLat, lng: centerLng }
    }
    this.setData({ mapMarkers, mapCenter })
  },

  // 地图改成真实 marker：
  // 同一地点如果有多张采集，默认直接按扇形排开显示，不再先合并成 1 张。
  async buildMapMarkers(items = []) {
    const markers = []
    this._markerIdMap = {}
    this._markerClusterMap = {}
    this._markerMetaMap = {}
    // 第一步：把同一位置的多张采集合并成一个 marker，并记录数量。
    const clusters = this.buildMarkerClusters(items)
    // 第二步：如果多个 cluster 之间距离太近，再做轻微错位，避免 marker 互相压住。
    const displayPoints = this.buildClusterDisplayPoints(clusters)

    for (let index = 0; index < clusters.length; index += 1) {
      const cluster = clusters[index]
      const point = displayPoints[index] || {}
      const clusterItems = cluster.items || []
      const total = clusterItems.length

      // 同一地点多张采集：直接按扇形展开显示。
      const fanPoints = total > 1
        ? clusterItems.map((_, itemIndex) => {
          const startAngle = total === 2 ? -Math.PI * 0.78 : -Math.PI * 0.92
          const endAngle = total === 2 ? -Math.PI * 0.22 : -Math.PI * 0.08
          const angle = total === 1
            ? -Math.PI / 2
            : startAngle + ((endAngle - startAngle) / (total - 1)) * itemIndex
          return this.getFanPoint(point.latitude, point.longitude, angle, 120)
        })
        : [{ latitude: point.latitude, longitude: point.longitude }]

      for (let itemIndex = 0; itemIndex < clusterItems.length; itemIndex += 1) {
        const item = clusterItems[itemIndex]
        const markerId = markers.length + 1
        const iconPath = await this.generateMapMarkerIcon(item, 1, false)
        const markerPoint = fanPoints[itemIndex] || { latitude: point.latitude, longitude: point.longitude }

        this._markerIdMap[markerId] = item.id
        this._markerClusterMap[markerId] = [item]
        this._markerMetaMap[markerId] = {
          type: 'single',
          item
        }

        markers.push({
          id: markerId,
          latitude: markerPoint.latitude,
          longitude: markerPoint.longitude,
          iconPath,
          width: 85,
          height: 132,
          anchor: {
            x: 0.5,
            y: 1
          }
        })
      }
    }

    this._baseMapMarkers = markers.map((item) => Object.assign({}, item))
    this._baseMarkerIdMap = Object.assign({}, this._markerIdMap)
    this._baseMarkerClusterMap = Object.assign({}, this._markerClusterMap)
    this._baseMarkerMetaMap = Object.assign({}, this._markerMetaMap)
    this._expandedClusterMarkerId = null
    return markers
  },

  // 把“同一位置”的采集合并成一个 marker：
  // 白点里的数字代表这个位置有几张采集邮票。
  buildMarkerClusters(items = []) {
    const clusters = []

    ;(items || []).forEach((item) => {
      const latitude = parseFloat(item.latitude)
      const longitude = parseFloat(item.longitude)

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return
      }

      const cluster = clusters.find((group) => this.isSameLocation(
        latitude,
        longitude,
        group.latitude,
        group.longitude
      ))

      if (!cluster) {
        clusters.push({
          latitude,
          longitude,
          items: [item],
          coverItem: item,
          primaryItem: item,
          count: 1
        })
        return
      }

      cluster.items.push(item)
      cluster.count += 1
    })

    return clusters
  },

  // 判断是否属于“同一位置”：
  // 这里阈值更小，只把几乎重合的采集合并为一个数字 marker。
  isSameLocation(lat1, lng1, lat2, lng2) {
    const latDiff = Math.abs(lat1 - lat2)
    const lngDiff = Math.abs(lng1 - lng2)
    return latDiff < 0.00008 && lngDiff < 0.00008
  },

  // 判断两个 cluster 是否太近：
  // 太近时再做一圈轻微错位，避免 marker 图本身压在一起。
  isNearbyCluster(lat1, lng1, lat2, lng2) {
    const latDiff = Math.abs(lat1 - lat2)
    const lngDiff = Math.abs(lng1 - lng2)
    return latDiff < 0.00035 && lngDiff < 0.00035
  },

  // 为 cluster 生成显示坐标：
  // 同一簇的第一个 marker 保持原位，后面的 marker 沿圆周轻微错开。
  // 这里把白点之间的视觉间距加大到约 32rpx，尽量避免看起来挤在一起。
  buildClusterDisplayPoints(clusters = []) {
    const displayGroups = []
    const displayPoints = []

    ;(clusters || []).forEach((cluster, index) => {
      const latitude = cluster.latitude
      const longitude = cluster.longitude

      const group = displayGroups.find((item) => this.isNearbyCluster(
        latitude,
        longitude,
        item.originLat,
        item.originLng
      ))

      if (!group) {
        displayGroups.push({
          originLat: latitude,
          originLng: longitude,
          indexes: [index]
        })
        displayPoints[index] = { latitude, longitude }
        return
      }

      group.indexes.push(index)
      const offsetIndex = group.indexes.length - 1
      displayPoints[index] = this.offsetCoordinate(
        group.originLat,
        group.originLng,
        offsetIndex
      )
    })

    return displayPoints
  },

  // 把附近的 marker 稍微错开：
  // 目的是让底部白点之间至少留出更明显的可辨识间距。
  offsetCoordinate(lat, lng, offsetIndex) {
    if (!offsetIndex) {
      return { latitude: lat, longitude: lng }
    }

    const angleStep = Math.PI / 3
    const ringIndex = Math.floor((offsetIndex - 1) / 6)
    const positionInRing = (offsetIndex - 1) % 6
    const angle = positionInRing * angleStep
    const radiusMeters = 56 + ringIndex * 32
    const latOffset = (radiusMeters * Math.sin(angle)) / 111000
    const lngOffset = (radiusMeters * Math.cos(angle)) / (111000 * Math.cos(lat * Math.PI / 180) || 1)

    return {
      latitude: lat + latOffset,
      longitude: lng + lngOffset
    }
  },

  // 使用隐藏 canvas 生成半尺寸地图邮票图标，保证 marker 能跟着地图缩放和拖动。
  // 底部白点里的数字表示这个位置聚合了多少张采集。
  generateMapMarkerIcon(item, markerCount, showCount) {
    return new Promise((resolve) => {
      const photoSrc = item.displayPath || item.photoPath || ''
      const cacheKey = `${item.id}_${photoSrc}_${markerCount || ''}_${showCount ? 'count' : 'plain'}`
      if (this._markerIconCache[cacheKey]) {
        resolve(this._markerIconCache[cacheKey])
        return
      }

      const shellPath = '/images/collection/stamp-ticket.png'

      // 安全超时：防止 canvas 绘制失败时 Promise 永不 resolve
      let settled = false
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        console.warn('[generateMapMarkerIcon] canvas 绘制超时，回退到壳图')
        resolve(shellPath)
      }, 3000)

      const finish = (path) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (path) this._markerIconCache[cacheKey] = path
        resolve(path || shellPath)
      }

      const ctx = wx.createCanvasContext('mapMarkerCanvas', this)

      ctx.clearRect(0, 0, 170, 318)
      ctx.setShadow(0, 8, 36, 'rgba(0, 0, 0, 0.10)')
      ctx.drawImage(shellPath, 0, 0, 170, 221)
      ctx.setShadow(0, 0, 0, 'rgba(0, 0, 0, 0)')

      if (photoSrc) {
        ctx.drawImage(photoSrc, 16, 16, 138, 184)
      }

      ctx.draw(false, () => {
        wx.canvasToTempFilePath({
          canvasId: 'mapMarkerCanvas',
          x: 0,
          y: 0,
          width: 170,
          height: 221,
          destWidth: 170,
          destHeight: 221,
          fileType: 'png',
          success: (res) => finish(res.tempFilePath),
          fail: () => finish(shellPath),
        }, this)
      })
    })
  },

  onSwitchView(e) {
    this.setData({ viewMode: e.currentTarget.dataset.view })
  },

  // 如果一个聚合点里有多张采集，就在地图上扇形展开这些邮票。
  async expandCluster(markerId) {
    const meta = this._baseMarkerMetaMap[markerId]
    if (!meta || meta.type !== 'cluster') return
    const clusterItems = meta.cluster.items || []
    if (clusterItems.length <= 1) return

    const basePoint = meta.basePoint || {
      latitude: meta.cluster.latitude,
      longitude: meta.cluster.longitude
    }
    const otherMarkers = (this._baseMapMarkers || []).filter((item) => item.id !== markerId)
    const nextMarkers = otherMarkers.map((item) => Object.assign({}, item))
    this._markerIdMap = Object.assign({}, this._baseMarkerIdMap)
    this._markerClusterMap = Object.assign({}, this._baseMarkerClusterMap)
    this._markerMetaMap = Object.assign({}, this._baseMarkerMetaMap)

    const total = clusterItems.length
    const startAngle = total === 2 ? -Math.PI * 0.78 : -Math.PI * 0.92
    const endAngle = total === 2 ? -Math.PI * 0.22 : -Math.PI * 0.08
    const radiusMeters = 120

    for (let index = 0; index < total; index += 1) {
      const item = clusterItems[index]
      const angle = total === 1
        ? -Math.PI / 2
        : startAngle + ((endAngle - startAngle) / (total - 1)) * index
      const point = this.getFanPoint(basePoint.latitude, basePoint.longitude, angle, radiusMeters)
      const expandedMarkerId = 1000 + markerId * 100 + index
      const iconPath = await this.generateMapMarkerIcon(item, 1, false)

      nextMarkers.push({
        id: expandedMarkerId,
        latitude: point.latitude,
        longitude: point.longitude,
        iconPath,
        width: 85,
        height: 132,
        anchor: {
          x: 0.5,
          y: 1
        }
      })
      this._markerIdMap[expandedMarkerId] = item.id
      this._markerClusterMap[expandedMarkerId] = [item]
      this._markerMetaMap[expandedMarkerId] = {
        type: 'expanded-item',
        item,
        parentMarkerId: markerId
      }
    }

    this._expandedClusterMarkerId = markerId
    this.setData({
      mapMarkers: nextMarkers
    })
  },

  // 把多个展开邮票按扇形排开。
  getFanPoint(lat, lng, angle, radiusMeters) {
    const latOffset = (radiusMeters * Math.sin(angle)) / 111000
    const lngOffset = (radiusMeters * Math.cos(angle)) / (111000 * Math.cos(lat * Math.PI / 180) || 1)
    return {
      latitude: lat + latOffset,
      longitude: lng + lngOffset
    }
  },

  // 恢复地图默认 marker 状态，收起扇形展开的邮票。
  collapseExpandedCluster() {
    if (!this._expandedClusterMarkerId) return
    this._expandedClusterMarkerId = null
    this._markerIdMap = Object.assign({}, this._baseMarkerIdMap)
    this._markerClusterMap = Object.assign({}, this._baseMarkerClusterMap)
    this._markerMetaMap = Object.assign({}, this._baseMarkerMetaMap)
    this.setData({
      mapMarkers: (this._baseMapMarkers || []).map((item) => Object.assign({}, item))
    })
  },

  // 地图 marker 点击后，直接进入当前这张采集详情。
  async onMarkerTap(e) {
    const markerId = e.detail.markerId
    const meta = this._markerMetaMap[markerId]
    if (!meta) return

    const clusterItems = this._markerClusterMap[markerId] || []
    const checkinId = this._markerIdMap[markerId]
    const targetId = (clusterItems[0] && clusterItems[0].id) || checkinId
    if (!targetId) return
    wx.navigateTo({
      url: '/subpackages/checkin/pages/checkin-detail/checkin-detail?id=' + encodeURIComponent(targetId)
    })
  },

  // 当前改成默认展开后，点击地图空白区域不再做额外处理。
  onMapTapBackground() {
    return
  },

  onCheckinTap(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.checkins.find((c) => c.id === id)
    if (!item) return
    // 点击邮票进入详情页，再展示采集时间和完整内容
    wx.navigateTo({
      url: '/subpackages/checkin/pages/checkin-detail/checkin-detail?id=' + encodeURIComponent(id)
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
      editNameValue: name || ''
    })
  },

  onCloseActionSheet() {
    this.setData({
      actionSheetVisible: false
    })
  },

  // 关闭自定义删除确认弹窗。
  onCloseDeleteConfirm() {
    this.setData({
      deleteConfirmVisible: false
    })
  },

  onEditCheckin() {
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

  // 编辑名称只更新邮票标题（本地优先 + 后台同步）。
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

    const updated = checkinUtil.updateCheckinAsync(activeCheckinId, {
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
    // 立即刷新列表（读本地，零等待）
    this.loadData()
  },

  // 删除前再确认一次，避免长按误触直接删掉采集。
  onDeleteCheckin() {
    const { activeCheckinId } = this.data
    if (!activeCheckinId || !checkinUtil) return

    // 先关闭编辑操作面板，再打开删除确认面板。
    this.setData({
      actionSheetVisible: false,
      editNameSheetVisible: false,
      deleteConfirmVisible: true
    })
  },

  // 真正执行删除动作，只在用户点了自定义确认按钮后触发。
  onConfirmDeleteCheckin() {
    const { activeCheckinId } = this.data
    if (!activeCheckinId || !checkinUtil) return

    checkinUtil.deleteCheckinAsync(activeCheckinId)
    this.setData({
      deleteConfirmVisible: false,
      activeCheckinId: '',
      activeCheckinName: '',
      editNameValue: ''
    })
    this.loadData()
  },

  onGoCheckin() {
    wx.navigateTo({ url: '/subpackages/checkin/pages/checkin-camera/checkin-camera?type=food&source=collection' })
  },

  onGoCheckinFood() {
    this.onGoCheckin()
  },

  onGoCheckinSpot() {
    this.onGoCheckin()
  }
})
