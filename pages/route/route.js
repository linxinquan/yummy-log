// 觅食图 - 路线规划页 v6.0 地图+双模式+Timeline
const app = getApp()
const shopData = require('../../utils/shopData')
const util = require('../../utils/util')

Page({
  data: {
    // 地图
    mapCenter: { lat: 22.4846, lng: 113.9046 },
    mapScale: 14,
    markers: [],
    polyline: [],

    // 起点（默认使用当前位置）
    startPoints: shopData.startPoints,
    currentStart: { name: '当前位置', type: 'current', lat: 22.4798, lng: 113.9125 },
    startExpanded: false,

    // 终点（默认返回起点）
    currentEnd: { name: '返回起点', type: 'return', lat: 22.4798, lng: 113.9125 },
    endExpanded: false,

    // 出行方式
    travelMode: 'drive',

    // 当前定位
    currentLocation: null,

    // 编辑模式
    isEditing: false,

    // ★ 所有想去店铺候选池
    allLikedShops: [],

    // ★ 选择模式：all=最优路径, custom=自定义
    selectMode: 'all',

    // ★ 优化算法：greedy=贪心, dp=全局最优
    optimizeMode: 'dp',

    // ★ 自选计数 & 全选状态
    selectedCount: 0,
    isAllSelected: false,

    // 路线
    routeShops: [],
    totalDistance: '0m',
    totalTime: '0分钟',

    // 导览
    isNavigating: false,
    isNavComplete: false,
    currentNavIndex: 0,
    currentNavShop: null,
    visitedCount: 0
  },

  onLoad(options) {
    // 接收 type=food/spot 和 ids=1,2,3 参数
    const { type, ids } = options
    this.setData({ routeType: type || 'food', presetIds: ids ? ids.split(',').map(Number) : null })
    this._isLoadingRoute = false
    this.getCurrentLocation()
  },

  onShow() {
    // 避免与onLoad重复加载，只在有数据时刷新
    if (this.data.allLikedShops.length > 0 && !this._isLoadingRoute) {
      this.loadRoute()
    }
  },

  // ─── 获取定位 ─────────────────────────────────
  getCurrentLocation() {
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      success: (res) => {
        const location = { lat: res.latitude, lng: res.longitude, name: '当前位置' }
        app.globalData.location = location
        this.setData({ currentLocation: location })
        if (this.data.currentStart.type === 'current') {
          this.setData({ currentStart: { ...this.data.currentStart, ...location } })
        }
        if (this.data.currentEnd.type === 'return') {
          this.setData({ currentEnd: { name: '返回起点', type: 'return', lat: res.latitude, lng: res.longitude } })
        }
        this.loadRoute()
      },
      fail: () => {
        const fallback = app.globalData.location || app.globalData.centerLocation
        if (fallback) {
          this.setData({ currentLocation: fallback })
          if (this.data.currentStart.type === 'current') {
            this.setData({ currentStart: { ...this.data.currentStart, lat: fallback.lat, lng: fallback.lng } })
          }
        }
      }
    })
  },

  // ─── 加载路线 ─────────────────────────────────
  loadRoute() {
    // 防止并发调用
    if (this._isLoadingRoute) {
      console.log('[loadRoute] 正在加载中，跳过')
      return
    }
    this._isLoadingRoute = true
    
    const { routeType, presetIds, selectMode } = this.data

    // 确定要加载的ID列表
    let likedIds = []
    if (presetIds && presetIds.length > 0) {
      // 从想去清单页面传入的ID（按用户拖拽排序）
      likedIds = presetIds
    } else if (routeType === 'spot') {
      likedIds = util.loadData('userWantSpots', [])
    } else {
      likedIds = util.loadData('userWantFoods', [])
    }

    // 获取对应的数据源
    let allItems = []
    if (routeType === 'spot') {
      allItems = util.getSpotData()
    } else {
      const userShops = util.loadData('userAddedShops', [])
      allItems = [...(shopData.shops || []), ...(shopData.foods || []), ...userShops]
    }
    const rawItems = likedIds.map(id => allItems.find(s => s.id === id)).filter(Boolean)

    if (rawItems.length === 0) {
      this.setData({ allLikedShops: [], routeShops: [], selectedCount: 0 })
      return
    }

    // 支持景点(lat/lng)和美食(latitude/longitude)两种格式
    if (selectMode === 'all') {
      const allLikedShops = rawItems.map(s => ({ ...s, selected: true, orderNum: '' }))
      const routeShops = this._planAndAnnotate(rawItems, presetIds ? true : false)
      routeShops.forEach((s, i) => {
        const hit = allLikedShops.find(a => a.id === s.id)
        if (hit) hit.orderNum = i + 1
      })
      this.setData({
        allLikedShops,
        routeShops,
        selectedCount: rawItems.length,
        isAllSelected: true
      })
    } else {
      const prev = this.data.allLikedShops
      const prevMap = {}
      prev.forEach(s => prevMap[s.id] = s)

      const allLikedShops = rawItems.map(s => {
        const old = prevMap[s.id]
        return { ...s, selected: old ? old.selected : true, orderNum: old ? old.orderNum : '' }
      })

      const selectedShops = allLikedShops.filter(s => s.selected)
      const routeShops = this._planAndAnnotate(selectedShops)
      allLikedShops.forEach(s => { s.orderNum = '' })
      routeShops.forEach((s, i) => {
        const hit = allLikedShops.find(a => a.id === s.id)
        if (hit) hit.orderNum = i + 1
      })

      this.setData({
        allLikedShops,
        routeShops,
        selectedCount: selectedShops.length,
        isAllSelected: selectedShops.length === allLikedShops.length
      })
    }

    this.updateMap()
    
    // 延迟重置标志，确保updateMap完成
    setTimeout(() => {
      this._isLoadingRoute = false
    }, 100)
  },

  // ─── 贪心排序并注入距离 ───────────────────────
  _planAndAnnotate(shops, preserveOrder = false) {
    if (shops.length === 0) return []

    let startPoint = this.data.currentStart
    if (startPoint.type === 'current') {
      startPoint = app.globalData.location || app.globalData.centerLocation || startPoint
    }

    const routeShops = util.planRoute(shops, startPoint, preserveOrder)
    if (routeShops.length > 0) routeShops[0].isFirst = true

    let totalDist = 0
    routeShops.forEach(s => { totalDist += s.distanceFromPrev || 0 })

    this.setData({
      totalDistance: util.formatDistance(totalDist),
      totalTime: util.estimateTime(totalDist, this.data.travelMode)
    })

    return routeShops
  },

  // ─── 更新地图 markers + polyline ─────────────
  updateMap() {
    console.log('[updateMap] 开始更新, 出行方式:', this.data.travelMode)
    const { routeShops, currentStart, currentEnd, travelMode } = this.data
    let startPoint = currentStart
    if (currentStart.type === 'current') {
      startPoint = app.globalData.location || { lat: 22.4846, lng: 113.9046 }
    }
    // 终点：如果 type === 'return' 则终点 = 起点
    let endPoint = currentEnd
    if (currentEnd.type === 'return') {
      endPoint = { ...startPoint, name: '返回起点' }
    }

    const markers = routeShops.map((shop, index) => ({
      id: Number(shop.id),
      latitude: shop.lat || shop.latitude,
      longitude: shop.lng || shop.longitude,
      width: 36,
      height: 36,
      label: {
        content: String(index + 1),
        color: '#ffffff',
        fontSize: 14,
        borderRadius: 12,
        bgColor: '#00D9C0',
        padding: 5,
        anchorX: 0,
        anchorY: -40
      },
      callout: {
        content: shop.name,
        color: '#1A1A2E',
        fontSize: 12,
        borderRadius: 6,
        padding: 6,
        display: 'BYCLICK',
        bgColor: '#ffffff'
      }
    }))

    // 起点加绿色标记
    markers.unshift({
      id: 9999,
      latitude: startPoint.lat,
      longitude: startPoint.lng,
      width: 28,
      height: 28,
      label: {
        content: '起',
        color: '#ffffff',
        fontSize: 12,
        borderRadius: 10,
        bgColor: '#4CAF50',
        padding: 4,
        anchorX: 0,
        anchorY: -32
      }
    })

    // 终点加红色标记（仅当终点与起点不同）
    if (Math.abs(endPoint.lat - startPoint.lat) > 0.00001 || Math.abs(endPoint.lng - startPoint.lng) > 0.00001) {
      markers.push({
        id: 8888,
        latitude: endPoint.lat,
        longitude: endPoint.lng,
        width: 28,
        height: 28,
        label: {
          content: '终',
          color: '#ffffff',
          fontSize: 12,
          borderRadius: 10,
          bgColor: '#FF5722',
          padding: 4,
          anchorX: 0,
          anchorY: -32
        }
      })
    }

    // 根据出行方式设置路线颜色
    const modeColors = {
      drive: '#4A90D9',   // 驾车 - 蓝色
      transit: '#9B59B6', // 地铁 - 紫色
      walk: '#27AE60'     // 步行 - 绿色
    }
    const routeColor = modeColors[travelMode] || '#00D9C0'

    // 构建所有途经点
    const allPoints = [
      { latitude: startPoint.lat, longitude: startPoint.lng },
      ...routeShops.map(shop => ({ latitude: shop.lat || shop.latitude, longitude: shop.lng || shop.longitude })),
      { latitude: endPoint.lat, longitude: endPoint.lng }
    ]

    // 如果只有起点和终点（或更少），直接画直线
    if (allPoints.length <= 2) {
      const polyline = [{
        points: allPoints,
        color: routeColor + 'CC',
        width: 5,
        dottedLine: false,
        arrowLine: true
      }]
      this._setMapData(markers, polyline, startPoint, routeShops)
      return
    }

    // 调用腾讯地图路径规划API获取真实路线
    this._fetchRealRoute(allPoints, routeColor, markers, startPoint, routeShops)
  },

  // ─── 设置地图数据 ─────────────────────────────
  _setMapData(markers, polyline, startPoint, routeShops) {
    console.log('[_setMapData] markers:', markers.length, 'polyline点数:', polyline[0]?.points?.length, '颜色:', polyline[0]?.color)
    
    // 地图中心取路线中间点
    let centerLat = startPoint.lat
    let centerLng = startPoint.lng
    if (routeShops.length > 0) {
      const midIdx = Math.floor(routeShops.length / 2)
      centerLat = routeShops[midIdx].lat || routeShops[midIdx].latitude
      centerLng = routeShops[midIdx].lng || routeShops[midIdx].longitude
    }

    this.setData({
      markers,
      polyline,
      mapCenter: { lat: centerLat, lng: centerLng }
    }, () => {
      console.log('[_setMapData] 地图数据已设置')
    })
  },

  // ─── 获取真实路线（腾讯地图路径规划）───────────
  _fetchRealRoute(allPoints, routeColor, markers, startPoint, routeShops) {
    const key = app.globalData.qqMapKey
    const { travelMode, currentEnd } = this.data
    
    // 腾讯地图路径规划模式: driving(驾车), transit(公交), walking(步行)
    const modeMap = {
      drive: 'driving',
      transit: 'transit',
      walk: 'walking'
    }
    const mode = modeMap[travelMode] || 'driving'

    // 处理终点是"返回起点"的情况
    let effectivePoints = [...allPoints]
    const from = allPoints[0]
    const to = allPoints[allPoints.length - 1]
    
    if (currentEnd.type === 'return' && 
        Math.abs(from.latitude - to.latitude) < 0.00001 && 
        Math.abs(from.longitude - to.longitude) < 0.00001 &&
        allPoints.length > 2) {
      // 终点返回起点且坐标相同，去掉最后一个重复的起点
      effectivePoints = allPoints.slice(0, -1)
      console.log('[路线规划] 终点返回起点，去掉重复终点，有效点数:', effectivePoints.length)
    }

    // 驾车模式支持waypoints，可以一次请求
    if (mode === 'driving' && effectivePoints.length > 2) {
      this._fetchDrivingRoute(effectivePoints, routeColor, markers, startPoint, routeShops, key)
    } else {
      // 步行/公交不支持waypoints，需要分段请求
      this._fetchSegmentedRoute(effectivePoints, routeColor, markers, startPoint, routeShops, key, mode)
    }
  },

  // ─── 驾车路线（支持waypoints）──────────────────
  _fetchDrivingRoute(allPoints, routeColor, markers, startPoint, routeShops, key) {
    const from = allPoints[0]
    const to = allPoints[allPoints.length - 1]
    const waypoints = allPoints.slice(1, -1).map(p => `${p.latitude},${p.longitude}`).join(';')
    
    const url = `https://apis.map.qq.com/ws/direction/v1/driving/?from=${from.latitude},${from.longitude}&to=${to.latitude},${to.longitude}&waypoints=${waypoints}&key=${key}`
    
    console.log('[驾车路线] 请求URL:', url)

    wx.request({
      url,
      success: (res) => {
        console.log('[驾车路线] API返回:', res.data)
        if (res.data?.status === 0 && res.data.result?.routes?.[0]) {
          const points = this._parsePolyline(res.data.result.routes[0].polyline)
          const polyline = [{
            points,
            color: routeColor + 'CC',
            width: 5,
            dottedLine: false,
            arrowLine: true
          }]
          this._setMapData(markers, polyline, startPoint, routeShops)
        } else {
          console.warn('[驾车路线] API失败，使用模拟路线:', res.data)
          this._useSimulatedRoute(allPoints, routeColor, markers, startPoint, routeShops)
        }
      },
      fail: (err) => {
        console.error('[驾车路线] 请求失败:', err)
        this._useSimulatedRoute(allPoints, routeColor, markers, startPoint, routeShops)
      }
    })
  },

  // ─── 分段路线（步行/公交，不支持waypoints）─────
  _fetchSegmentedRoute(allPoints, routeColor, markers, startPoint, routeShops, key, mode) {
    console.log(`[分段路线] ${mode}模式，共${allPoints.length}个点，${allPoints.length - 1}段路线`)
    
    const segments = []
    for (let i = 0; i < allPoints.length - 1; i++) {
      segments.push({
        from: allPoints[i],
        to: allPoints[i + 1],
        index: i
      })
    }

    const allRoutePoints = []
    let completedCount = 0
    let hasError = false

    // 串行请求避免限流
    const requestSegment = (index) => {
      if (index >= segments.length) {
        // 所有段完成
        if (!hasError && allRoutePoints.length > 0) {
          const polyline = [{
            points: allRoutePoints,
            color: routeColor + 'CC',
            width: 5,
            dottedLine: false,
            arrowLine: true
          }]
          this._setMapData(markers, polyline, startPoint, routeShops)
        } else {
          this._useSimulatedRoute(allPoints, routeColor, markers, startPoint, routeShops)
        }
        return
      }

      const seg = segments[index]
      const url = `https://apis.map.qq.com/ws/direction/v1/${mode}/?from=${seg.from.latitude},${seg.from.longitude}&to=${seg.to.latitude},${seg.to.longitude}&key=${key}`
      
      console.log(`[分段路线] 请求第${index + 1}/${segments.length}段:`, url)

      wx.request({
        url,
        success: (res) => {
          if (res.data?.status === 0 && res.data.result?.routes?.[0]) {
            const points = this._parsePolyline(res.data.result.routes[0].polyline)
            // 避免重复添加连接点（除了第一段）
            if (index > 0 && points.length > 0) {
              allRoutePoints.push(...points.slice(1))
            } else {
              allRoutePoints.push(...points)
            }
            console.log(`[分段路线] 第${index + 1}段成功，点数:`, points.length)
          } else {
            console.warn(`[分段路线] 第${index + 1}段失败:`, res.data)
            hasError = true
          }
        },
        fail: (err) => {
          console.error(`[分段路线] 第${index + 1}段请求失败:`, err)
          hasError = true
        },
        complete: () => {
          completedCount++
          // 延迟1100ms请求下一段，避免限流
          setTimeout(() => requestSegment(index + 1), 1100)
        }
      })
    }

    // 开始请求第一段
    requestSegment(0)
  },

  // ─── 使用模拟路线（降级方案）───────────────────
  _useSimulatedRoute(allPoints, routeColor, markers, startPoint, routeShops) {
    console.log('[模拟路线] 使用模拟路线')
    const points = this._generateSimulatedRouteForAll(allPoints, this.data.travelMode)
    const polyline = [{
      points,
      color: routeColor + 'CC',
      width: 5,
      dottedLine: false,
      arrowLine: true
    }]
    this._setMapData(markers, polyline, startPoint, routeShops)
  },

  // ─── 生成完整模拟路线（所有点）─────────────────
  _generateSimulatedRouteForAll(allPoints, mode) {
    let allRoutePoints = []
    
    for (let i = 0; i < allPoints.length - 1; i++) {
      const from = allPoints[i]
      const to = allPoints[i + 1]
      const segment = this._generateSimulatedRoute(from, to, mode)
      
      if (i === 0) {
        allRoutePoints = allRoutePoints.concat(segment)
      } else {
        // 跳过重复点
        allRoutePoints = allRoutePoints.concat(segment.slice(1))
      }
    }
    
    return allRoutePoints
  },

  // ─── 生成模拟真实路线（带弯曲效果）─────────────
  _generateSimulatedRoute(from, to, mode) {
    const points = []
    const steps = 20 // 插值点数
    
    // 计算中点，添加随机偏移模拟道路弯曲
    const midLat = (from.latitude + to.latitude) / 2
    const midLng = (from.longitude + to.longitude) / 2
    
    // 根据出行方式调整弯曲程度
    const bendFactor = {
      drive: 0.0003,    // 驾车弯曲度小
      transit: 0.0005,  // 地铁弯曲度中等
      walk: 0.0002      // 步行弯曲度最小
    }[mode] || 0.0003
    
    // 添加垂直于直线的偏移
    const dx = to.longitude - from.longitude
    const dy = to.latitude - from.latitude
    const dist = Math.sqrt(dx * dx + dy * dy)
    
    // 垂直方向单位向量
    const perpX = -dy / dist * bendFactor
    const perpY = dx / dist * bendFactor
    
    // 生成带弯曲的路线点
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      // 使用贝塞尔曲线效果：t*(1-t)*4 在0.5处达到最大值
      const bend = Math.sin(t * Math.PI) 
      
      const lat = from.latitude + (to.latitude - from.latitude) * t + perpY * bend
      const lng = from.longitude + (to.longitude - from.longitude) * t + perpX * bend
      
      points.push({ latitude: lat, longitude: lng })
    }
    
    return points
  },

  // ─── 解析腾讯地图polyline ─────────────────────
  // 支持两种格式：1) 已解码的数组 [lat, lng, lat, lng, ...]（第一个是绝对坐标度，后面是增量百万分之一度）  2) 压缩字符串
  _parsePolyline(polyline) {
    // 如果是数组格式（多点路径规划返回的）
    // 腾讯地图返回：第一个点是绝对坐标（单位：度），后面的是相对增量（单位：百万分之一度）
    if (Array.isArray(polyline)) {
      const points = []
      
      for (let i = 0; i < polyline.length; i += 2) {
        if (i + 1 < polyline.length) {
          if (i === 0) {
            // 第一个点是绝对坐标（单位：度）
            points.push({
              latitude: polyline[i],
              longitude: polyline[i + 1]
            })
          } else {
            // 后面的点是相对增量（单位：百万分之一度，需要除以1000000）
            const prev = points[points.length - 1]
            const deltaLat = polyline[i] / 1000000
            const deltaLng = polyline[i + 1] / 1000000
            
            points.push({
              latitude: prev.latitude + deltaLat,
              longitude: prev.longitude + deltaLng
            })
          }
        }
      }
      
      // 调试：打印前几个和后几个点
      if (points.length > 0) {
        console.log('[polyline] 首点:', points[0], '尾点:', points[points.length - 1], '总数:', points.length)
      }
      
      return points
    }
    
    // 如果是字符串格式（单点路径规划返回的压缩字符串）
    if (typeof polyline === 'string') {
      return this._decodePolylineString(polyline)
    }
    
    return []
  },

  // ─── 解码压缩的polyline字符串 ──────────────────
  _decodePolylineString(polylineStr) {
    if (!polylineStr || typeof polylineStr !== 'string') {
      return []
    }
    
    const points = []
    let index = 0
    let lat = 0
    let lng = 0

    while (index < polylineStr.length) {
      let b
      let shift = 0
      let result = 0

      do {
        b = polylineStr.charCodeAt(index++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)

      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1))
      lat += dlat

      shift = 0
      result = 0

      do {
        b = polylineStr.charCodeAt(index++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)

      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1))
      lng += dlng

      points.push({
        latitude: lat / 1e6,
        longitude: lng / 1e6
      })
    }

    return points
  },

  // ─── 地图适配所有标记 ─────────────────────────
  onFitRoute() {
    const { routeShops, currentStart, currentEnd } = this.data
    if (routeShops.length === 0) return

    let startPoint = currentStart
    if (currentStart.type === 'current') {
      startPoint = app.globalData.location || { lat: 22.4846, lng: 113.9046 }
    }
    let endPoint = currentEnd
    if (currentEnd.type === 'return') {
      endPoint = startPoint
    }

    const lats = [startPoint.lat, endPoint.lat, ...routeShops.map(s => s.lat || s.latitude)]
    const lngs = [startPoint.lng, endPoint.lng, ...routeShops.map(s => s.lng || s.longitude)]
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
    const centerLat = (minLat + maxLat) / 2
    const centerLng = (minLng + maxLng) / 2

    // 根据跨度估算缩放级别
    const latSpan = maxLat - minLat
    const lngSpan = maxLng - minLng
    const span = Math.max(latSpan, lngSpan)
    let scale = 14
    if (span > 0.1) scale = 11
    else if (span > 0.05) scale = 12
    else if (span > 0.02) scale = 13
    else if (span > 0.01) scale = 14
    else scale = 15

    this.setData({ mapCenter: { lat: centerLat, lng: centerLng }, mapScale: scale })
  },

  onMapRegionChange() {
    // 可扩展：地图区域变化时的处理
  },

  // ─── 切换选择模式 ─────────────────────────────
  onSwitchSelectMode(e) {
    const mode = e.currentTarget.dataset.mode
    if (mode === this.data.selectMode) return
    this.setData({ selectMode: mode, isEditing: false }, () => {
      this.loadRoute()
    })
  },

  // ─── 自选：切换单家店铺 ───────────────────────
  onToggleCandidate(e) {
    const shopId = e.currentTarget.dataset.shopid
    const allLikedShops = this.data.allLikedShops.map(s =>
      s.id === shopId ? { ...s, selected: !s.selected } : s
    )
    const selectedShops = allLikedShops.filter(s => s.selected)
    const selectedCount = selectedShops.length
    const isAllSelected = selectedCount === allLikedShops.length

    this.setData({ allLikedShops, selectedCount, isAllSelected })

    const routeShops = this._planAndAnnotate(selectedShops)
    const updated = allLikedShops.map(s => ({ ...s, orderNum: '' }))
    routeShops.forEach((s, i) => {
      const hit = updated.find(a => a.id === s.id)
      if (hit) hit.orderNum = i + 1
    })

    this.setData({ allLikedShops: updated, routeShops })
    this.updateMap()
  },

  // ─── 自选：全选 / 取消全选 ────────────────────
  onToggleSelectAll() {
    const { isAllSelected, allLikedShops } = this.data
    const newSelected = !isAllSelected
    const updated = allLikedShops.map(s => ({ ...s, selected: newSelected }))
    const selectedCount = newSelected ? updated.length : 0

    this.setData({ allLikedShops: updated, selectedCount, isAllSelected: newSelected })

    if (newSelected) {
      const routeShops = this._planAndAnnotate(updated)
      const withOrder = updated.map(s => ({ ...s, orderNum: '' }))
      routeShops.forEach((s, i) => {
        const hit = withOrder.find(a => a.id === s.id)
        if (hit) hit.orderNum = i + 1
      })
      this.setData({ allLikedShops: withOrder, routeShops })
    } else {
      this.setData({ routeShops: [], totalDistance: '0m', totalTime: '0分钟' })
    }

    this.updateMap()
  },

  // ─── 起点选择 ─────────────────────────────────
  onToggleStart() {
    this.setData({ startExpanded: !this.data.startExpanded })
  },

  onSelectStart(e) {
    const start = e.currentTarget.dataset.start
    if (start.type === 'current') {
      wx.showLoading({ title: '定位中...' })
      wx.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        success: (res) => {
          wx.hideLoading()
          const loc = { lat: res.latitude, lng: res.longitude }
          app.globalData.location = loc
          this.setData({
            currentStart: { ...start, lat: loc.lat, lng: loc.lng },
            startExpanded: false
          })
          this.loadRoute()
        },
        fail: () => {
          wx.hideLoading()
          const fallback = app.globalData.location || app.globalData.centerLocation
          this.setData({
            currentStart: { ...start, lat: fallback.lat, lng: fallback.lng },
            startExpanded: false
          })
          this.loadRoute()
          wx.showToast({ title: '使用上次位置', icon: 'none' })
        }
      })
      } else {
      this.setData({ currentStart: start, startExpanded: false })
      // 如果终点是"返回起点"，同步更新
      if (this.data.currentEnd.type === 'return') {
        const newEnd = { ...start, name: '返回起点', type: 'return' }
        this.setData({ currentEnd: newEnd })
      }
      this.loadRoute()
    }
  },

  onChooseStartOnMap() {
    wx.chooseLocation({
      success: (res) => {
        if (res.name || res.address) {
          const customStart = {
            name: res.name || '自定义位置',
            lat: res.latitude,
            lng: res.longitude,
            type: 'custom'
          }
          this.setData({ currentStart: customStart, startExpanded: false })
          this.loadRoute()
          wx.showToast({ title: '起点已设置', icon: 'success' })
        }
      },
      fail: () => {
        wx.showToast({ title: '请选择有效位置', icon: 'none' })
      }
    })
  },

  // ─── 终点选择 ─────────────────────────────────
  onToggleEnd() {
    this.setData({ endExpanded: !this.data.endExpanded })
  },

  onSelectEnd(e) {
    const endtype = e.currentTarget.dataset.endtype
    const end = e.currentTarget.dataset.end

    // 返回起点
    if (endtype === 'return') {
      const { currentStart } = this.data
      this.setData({
        currentEnd: { name: '返回起点', type: 'return', lat: currentStart.lat, lng: currentStart.lng },
        endExpanded: false
      })
      this.updateMap()
      wx.showToast({ title: '终点已设置为起点', icon: 'success' })
      return
    }

    if (!end) return

    if (end.type === 'current') {
      // 获取当前位置作为终点
      wx.showLoading({ title: '定位中...' })
      wx.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        success: (res) => {
          wx.hideLoading()
          const loc = { lat: res.latitude, lng: res.longitude }
          app.globalData.location = loc
          this.setData({
            currentEnd: { ...end, lat: loc.lat, lng: loc.lng },
            endExpanded: false
          })
          this.updateMap()
          wx.showToast({ title: '终点已设置', icon: 'success' })
        },
        fail: () => {
          wx.hideLoading()
          const fallback = app.globalData.location || app.globalData.centerLocation
          this.setData({
            currentEnd: { ...end, lat: fallback.lat, lng: fallback.lng },
            endExpanded: false
          })
          this.updateMap()
          wx.showToast({ title: '使用上次位置', icon: 'none' })
        }
      })
    } else {
      this.setData({ currentEnd: end, endExpanded: false })
      this.updateMap()
      wx.showToast({ title: '终点已设置', icon: 'success' })
    }
  },

  onChooseEndOnMap() {
    wx.chooseLocation({
      success: (res) => {
        if (res.name || res.address) {
          const customEnd = {
            name: res.name || '自定义位置',
            lat: res.latitude,
            lng: res.longitude,
            type: 'custom'
          }
          this.setData({ currentEnd: customEnd, endExpanded: false })
          this.updateMap()
          wx.showToast({ title: '终点已设置', icon: 'success' })
        }
      },
      fail: () => {
        wx.showToast({ title: '请选择有效位置', icon: 'none' })
      }
    })
  },

  // ─── 出行方式 ─────────────────────────────────
  onSelectMode(e) {
    const mode = e.currentTarget.dataset.mode
    console.log('[onSelectMode] 切换出行方式:', mode)
    if (mode === this.data.travelMode) {
      console.log('[onSelectMode] 相同模式，跳过')
      return
    }
    // 如果正在加载路线，延迟切换
    if (this._isLoadingRoute) {
      console.log('[onSelectMode] 路线加载中，延迟切换')
      setTimeout(() => this.onSelectMode(e), 300)
      return
    }
    this.setData({ travelMode: mode })
    let totalDist = 0
    this.data.routeShops.forEach(s => { totalDist += s.distanceFromPrev || 0 })
    this.setData({ totalTime: util.estimateTime(totalDist, mode) })
    this.updateMap()
  },

  // ─── ⚡ 重新贪心优化 ─────────────────────────
  onOptimizeRoute() {
    wx.showLoading({ title: '优化中...' })
    setTimeout(() => {
      const shops = this.data.selectMode === 'all'
        ? this.data.allLikedShops
        : this.data.allLikedShops.filter(s => s.selected)
      const routeShops = this._planAndAnnotate(shops)
      this.setData({ routeShops, isEditing: false, optimizeMode: 'greedy' })
      this.updateMap()
      wx.hideLoading()
      wx.showToast({ title: '贪心优化完成', icon: 'success' })
    }, 400)
  },

  // ─── 🎯 全局最优（DP）────────────────────────
  onOptimizeRouteDP() {
    const shops = this.data.selectMode === 'all'
      ? this.data.allLikedShops
      : this.data.allLikedShops.filter(s => s.selected)

    if (shops.length > 15) {
      wx.showToast({ title: '地点超过15个，使用贪心算法', icon: 'none', duration: 2500 })
    }

    if (shops.length === 0) {
      wx.showToast({ title: '请先选择地点', icon: 'none' })
      return
    }

    wx.showLoading({ title: shops.length > 15 ? '贪心优化中...' : '全局最优计算中...' })

    // DP计算需要一些时间，使用setTimeout避免阻塞UI
    setTimeout(() => {
      let startPoint = this.data.currentStart
      if (startPoint.type === 'current') {
        startPoint = app.globalData.location || app.globalData.centerLocation || startPoint
      }

      // 使用DP算法规划路线
      const routeShops = util.planRouteDP(shops, startPoint)
      if (routeShops.length > 0) routeShops[0].isFirst = true

      // 更新allLikedShops中的序号
      const allLikedShops = this.data.allLikedShops.map(s => ({ ...s, orderNum: '' }))
      routeShops.forEach((s, i) => {
        const hit = allLikedShops.find(a => a.id === s.id)
        if (hit) hit.orderNum = i + 1
      })

      // 更新总距离
      let totalDist = 0
      routeShops.forEach(s => { totalDist += s.distanceFromPrev || 0 })

      this.setData({
        allLikedShops,
        routeShops,
        totalDistance: util.formatDistance(totalDist),
        totalTime: util.estimateTime(totalDist, this.data.travelMode),
        isEditing: false,
        optimizeMode: 'dp'
      })

      this.updateMap()
      wx.hideLoading()
      wx.showToast({
        title: shops.length > 15 ? '贪心优化完成' : '全局最优路线',
        icon: 'success'
      })
    }, 100)
  },

  // ─── 顺序调整 ─────────────────────────────────
  onToggleEdit() {
    const isEditing = !this.data.isEditing
    this.setData({ isEditing })
    if (!isEditing) {
      wx.showToast({ title: '顺序已保存', icon: 'success' })
    }
  },

  onMoveUp(e) {
    const index = e.currentTarget.dataset.index
    if (index <= 0) return
    const shops = [...this.data.routeShops]
    ;[shops[index], shops[index - 1]] = [shops[index - 1], shops[index]]
    this.setData({ routeShops: shops })
    this.updateMap()
  },

  onMoveDown(e) {
    const index = e.currentTarget.dataset.index
    if (index >= this.data.routeShops.length - 1) return
    const shops = [...this.data.routeShops]
    ;[shops[index], shops[index + 1]] = [shops[index + 1], shops[index]]
    this.setData({ routeShops: shops })
    this.updateMap()
  },

  // ─── 移除店铺 ─────────────────────────────────
  onRemoveShop(e) {
    const shopId = e.currentTarget.dataset.shopid
    const type = this.data.routeType
    util.toggleLike(shopId, type)
    this.loadRoute()
    wx.showToast({ title: '已从路线移除', icon: 'none' })
  },

  // ─── 导览模式 ─────────────────────────────────
  onStartNavigation() {
    if (this.data.routeShops.length === 0) return
    const firstShop = this.data.routeShops[0]
    this.setData({
      isNavigating: true,
      isNavComplete: false,
      currentNavIndex: 0,
      currentNavShop: firstShop,
      visitedCount: 0
    })
    this._updateNavMap()
    wx.showToast({ title: '开始美食之旅！', icon: 'success' })
  },

  _updateNavMap() {
    const { routeShops, currentNavIndex, currentStart } = this.data
    const currentShop = routeShops[currentNavIndex]
    if (!currentShop) return

    const currentLoc = app.globalData.location || currentStart
    const markers = [
      {
        id: 0,
        latitude: currentLoc.lat,
        longitude: currentLoc.lng,
        width: 24,
        height: 24,
        iconPath: '/images/location-dot.png'
      },
      {
        id: Number(currentShop.id),
        latitude: currentShop.lat || currentShop.latitude,
        longitude: currentShop.lng || currentShop.longitude,
        width: 44,
        height: 44,
        label: {
          content: String(currentNavIndex + 1),
          color: '#ffffff',
          fontSize: 16,
          borderRadius: 14,
          bgColor: '#00D9C0',
          padding: 6,
          anchorX: 0,
          anchorY: -50
        }
      }
    ]
    const polyline = [{
      points: [
        { latitude: currentLoc.lat, longitude: currentLoc.lng },
        { latitude: currentShop.lat || currentShop.latitude, longitude: currentShop.lng || currentShop.longitude }
      ],
      color: '#00D9C0',
      width: 6,
      dottedLine: true
    }]
    this.setData({
      markers,
      polyline,
      mapCenter: { lat: currentShop.lat, lng: currentShop.lng }
    })
  },

  onNavToCurrent() {
    const { currentNavShop } = this.data
    if (!currentNavShop) return
    util.openDirectNavigation(currentNavShop)
  },

  onVisitNav() {
    const { currentNavIndex, routeShops, visitedCount } = this.data
    const newVisitedCount = visitedCount + 1
    if (currentNavIndex >= routeShops.length - 1) {
      this.setData({ isNavComplete: true, isNavigating: false, visitedCount: newVisitedCount })
    } else {
      const nextIndex = currentNavIndex + 1
      const nextShop = routeShops[nextIndex]
      this.setData({ currentNavIndex: nextIndex, currentNavShop: nextShop, visitedCount: newVisitedCount })
      this._updateNavMap()
      wx.showToast({ title: `下一站：${nextShop.name}`, icon: 'none', duration: 2000 })
    }
  },

  onExitNav() {
    wx.showModal({
      title: '退出导览',
      content: '确定退出导览模式吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            isNavigating: false,
            isNavComplete: false,
            currentNavIndex: 0,
            currentNavShop: null
          })
          this.updateMap()
        }
      }
    })
  },

  onNavigateToShop(e) {
    const shop = e.currentTarget.dataset.shop
    util.openWechatNavigation(shop)
  },

  // ─── 清空路线 ─────────────────────────────────
  onClearRoute() {
    wx.showModal({
      title: '确认清空',
      content: '清空后将取消所有「想去」记录，确定吗？',
      success: (res) => {
        if (res.confirm) {
          this.data.allLikedShops.forEach(shop => util.toggleLike(shop.id, this.data.routeType))
          this.loadRoute()
          wx.showToast({ title: '已清空', icon: 'none' })
        }
      }
    })
  },

  // ─── 定位 ─────────────────────────────────────
  onLocateMe() {
    wx.showLoading({ title: '定位中...' })
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      success: (res) => {
        wx.hideLoading()
        const location = { lat: res.latitude, lng: res.longitude, name: '我的位置' }
        app.globalData.location = location
        this.setData({ currentLocation: location })
        if (this.data.currentStart.type === 'current') {
          this.setData({ currentStart: { ...this.data.currentStart, ...location } })
          this.loadRoute()
        }
        wx.showToast({ title: '定位成功', icon: 'success' })
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '定位失败，请检查权限', icon: 'none' })
      }
    })
  },

  onBackToHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  onBack() {
    wx.navigateBack()
  }
})
