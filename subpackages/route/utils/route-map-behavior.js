// behaviors/route-map-behavior.js
// 地图相关行为的 Behavior
// 包含：地图更新、路线规划、地图预览等功能

const app = getApp()
const mapConfig = require('../../../../config/map-config')

// 路线地图统一复用探索页同一张当前位置图标。
const CURRENT_LOCATION_ICON_PATH = '/images/markers/marker_current_location.png'

module.exports = Behavior({
  data: {
    // 地图相关数据
    mapScale: 14
  },

  methods: {
    // 刷新地图上的点位和折线。
    updateMap() {
      // 初始化缓存对象
      if (!this._routeCache) this._routeCache = {}
      
      // 根据 currentMapDay 决定显示哪一天的路线
      const effectiveDayIndex = this.data.currentMapDay >= 0 ? this.data.currentMapDay : 0
      const currentDay = (this.data.routeDaySections || [])[effectiveDayIndex] || {}
      const routeShops = (currentDay.items || []).length ? currentDay.items : (this.data.routeShops || [])
      
      if (routeShops.length === 0) {
        this.setData({ markers: [], polyline: [] })
        return
      }
      
      const { currentStart, travelMode, dayStartPoints } = this.data
      
      // 使用当天设置的起点，如果没有设置则使用 currentStart
      let startPoint = null
      if (dayStartPoints && dayStartPoints[effectiveDayIndex]) {
        startPoint = dayStartPoints[effectiveDayIndex]
      } else {
        startPoint = currentStart
        if (currentStart.type === 'current') {
          startPoint = app.globalData.location || mapConfig.DEFAULT_CENTER
        }
      }
      
      // 终点：默认返回起点
      const endPoint = { ...startPoint, name: '返回起点' }

      // 检查缓存：如果已有缓存的路线数据，直接使用
      const cacheKey = `${effectiveDayIndex}-${travelMode}-${startPoint.lat}-${startPoint.lng}`
      if (this._routeCache[cacheKey]) {
        const cachedData = this._routeCache[cacheKey]
        const polyline = [{
          points: cachedData.points,
          color: cachedData.color + 'CC',
          width: 5,
          dottedLine: false,
          arrowLine: true
        }]
        this._setMapData(cachedData.markers, polyline, startPoint, routeShops)
        return
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
          bgColor: mapConfig.THEME_COLORS.primary,
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
          bgColor: mapConfig.THEME_COLORS.start,
          padding: 4,
          anchorX: 0,
          anchorY: -32
        }
      })

      // 根据出行方式设置路线颜色
      const modeColors = {
        drive: mapConfig.THEME_COLORS.drive,
        transit: mapConfig.THEME_COLORS.transit,
        walk: mapConfig.THEME_COLORS.walk,
        ride: mapConfig.THEME_COLORS.ride
      }
      const routeColor = modeColors[travelMode] || mapConfig.THEME_COLORS.primary

      // 构建所有途经点
      const allPoints = [
        { latitude: startPoint.lat, longitude: startPoint.lng },
        ...routeShops.map(shop => ({ latitude: shop.lat || shop.latitude, longitude: shop.lng || shop.longitude })),
        { latitude: endPoint.lat, longitude: endPoint.lng }
      ]
      
      // 调试：打印 allPoints 数据
      console.log('[updateMap] allPoints:', allPoints.map(p => ({ lat: p.latitude, lng: p.longitude })))

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
        // 保存到缓存
        if (cacheKey) {
          if (!this._routeCache) this._routeCache = {}
          this._routeCache[cacheKey] = { points: allPoints, markers, color: routeColor }
        }
        return
      }

      // 调用腾讯地图路径规划API获取真实路线
      this._fetchRealRoute(allPoints, routeColor, markers, startPoint, routeShops, cacheKey)
    },

    // 让地图自动缩放到能看见当前路线的全部点位。
    onFitRoute() {
      const effectiveDayIndex = this.data.currentMapDay >= 0 ? this.data.currentMapDay : 0
      const currentDay = (this.data.routeDaySections || [])[effectiveDayIndex] || {}
      const currentItems = (currentDay.items || []).length ? currentDay.items : (this.data.routeShops || [])
      if (currentItems.length === 0) return
      const points = currentItems
        .map(item => ({
          latitude: item.lat || item.latitude,
          longitude: item.lng || item.longitude
        }))
        .filter(item => typeof item.latitude === 'number' && typeof item.longitude === 'number')
      if (!points.length) return

      if (points.length === 1) {
        this.setData({
          mapCenter: { lat: points[0].latitude, lng: points[0].longitude },
          mapScale: 15
        })
        return
      }

      const windowInfo = wx.getWindowInfo()
      const mapCtx = wx.createMapContext('routeMap', this)
      mapCtx.includePoints({
        points,
        padding: [96, 24, Math.round((windowInfo.windowHeight || 812) * 0.34), 24]
      })
    },

    // 地图区域变化的预留入口，当前暂时不处理。
    onMapRegionChange() {
      // 可扩展：地图区域变化时的处理
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

      const nextMarkers = Array.isArray(markers) ? markers.slice() : []
      const currentLocation = this.data.currentLocation || app.globalData.location
      if (currentLocation && typeof currentLocation.lat === 'number' && typeof currentLocation.lng === 'number') {
        nextMarkers.unshift({
          id: -1001,
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
          iconPath: CURRENT_LOCATION_ICON_PATH,
          width: 36,
          height: 36,
          anchor: { x: 0.5, y: 0.5 }
        })
      }

      this.setData({
        markers: nextMarkers,
        polyline,
        mapCenter: { lat: centerLat, lng: centerLng }
      }, () => {
        console.log('[_setMapData] 地图数据已设置')
      })
    },

    // ─── 获取真实路线（腾讯地图路径规划）───────────
    _fetchRealRoute(allPoints, routeColor, markers, startPoint, routeShops, cacheKey) {
      const key = app.globalData.qqMapKey
      const { travelMode } = this.data

      // 腾讯地图路径规划模式（从配置获取）
      const mode = mapConfig.TRAVEL_MODE_MAP[travelMode] || mapConfig.TRAVEL_MODE_MAP.drive
      
      // 调试：打印 mode 和 travelMode
      console.log('[_fetchRealRoute] travelMode:', travelMode, 'mode:', mode, 'allPoints.length:', allPoints.length)

      // 构建有效的途经点（去掉重复的终点）
      let effectivePoints = [...allPoints]
      const from = allPoints[0]
      const to = allPoints[allPoints.length - 1]
      
      if (Math.abs(from.latitude - to.latitude) < 0.00001 && 
          Math.abs(from.longitude - to.longitude) < 0.00001 &&
          allPoints.length > 2) {
        // 终点返回起点且坐标相同，去掉最后一个重复的起点
        effectivePoints = allPoints.slice(0, -1)
        console.log('[路线规划] 终点返回起点，去掉重复终点，有效点数:', effectivePoints.length)
      }

      // 驾车模式支持waypoints，可以一次请求
      console.log('[_fetchRealRoute] 检查是否调用驾车路线: mode=', mode, 'effectivePoints.length=', effectivePoints.length, '条件=', mode === 'driving' && effectivePoints.length > 2)
      if (mode === 'driving' && effectivePoints.length > 2) {
        this._fetchDrivingRoute(effectivePoints, routeColor, markers, startPoint, routeShops, key, cacheKey)
      } else {
        // 步行/公交不支持waypoints，需要分段请求
        this._fetchSegmentedRoute(effectivePoints, routeColor, markers, startPoint, routeShops, key, mode, cacheKey)
      }
    },

    // ─── 驾车路线（支持waypoints）──────────────────
    _fetchDrivingRoute(allPoints, routeColor, markers, startPoint, routeShops, key, cacheKey) {
      const from = allPoints[0]
      const to = allPoints[allPoints.length - 1]
      const waypoints = allPoints.slice(1, -1).map(p => `${p.latitude},${p.longitude}`).join(';')

      const url = `${mapConfig.QQ_MAP_API_BASE}/driving/?from=${from.latitude},${from.longitude}&to=${to.latitude},${to.longitude}&waypoints=${waypoints}&key=${key}`

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
            // 保存到缓存
            if (cacheKey) {
              if (!this._routeCache) this._routeCache = {}
              this._routeCache[cacheKey] = { points, markers, color: routeColor }
            }
          } else {
            console.warn('[驾车路线] API失败，使用模拟路线:', res.data)
            this._useSimulatedRoute(allPoints, routeColor, markers, startPoint, routeShops, cacheKey)
          }
        },
        fail: (err) => {
          console.error('[驾车路线] 请求失败:', err)
          this._useSimulatedRoute(allPoints, routeColor, markers, startPoint, routeShops, cacheKey)
        }
      })
    },

    // ─── 分段路线（步行/公交，不支持waypoints）─────
    _fetchSegmentedRoute(allPoints, routeColor, markers, startPoint, routeShops, key, mode, cacheKey) {
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
            // 保存到缓存
            if (cacheKey) {
              if (!this._routeCache) this._routeCache = {}
              this._routeCache[cacheKey] = { points: allRoutePoints, markers, color: routeColor }
            }
          } else {
            this._useSimulatedRoute(allPoints, routeColor, markers, startPoint, routeShops, cacheKey)
          }
          return
        }

        const seg = segments[index]
        const url = `${mapConfig.QQ_MAP_API_BASE}/${mode}/?from=${seg.from.latitude},${seg.from.longitude}&to=${seg.to.latitude},${seg.to.longitude}&key=${key}`

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
            // 延迟请求下一段，避免限流
            setTimeout(() => requestSegment(index + 1), mapConfig.ROUTE_CONFIG.API_DELAY)
          }
        })
      }

      // 开始请求第一段
      requestSegment(0)
    },

    // ─── 使用模拟路线（降级方案）───────────────────
    _useSimulatedRoute(allPoints, routeColor, markers, startPoint, routeShops, cacheKey) {
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
      // 保存到缓存
      if (cacheKey) {
        if (!this._routeCache) this._routeCache = {}
        this._routeCache[cacheKey] = { points, markers, color: routeColor }
      }
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
      const steps = mapConfig.ROUTE_CONFIG.SIMULATION_STEPS // 插值点数

      // 根据出行方式调整弯曲程度
      const bendFactor = mapConfig.BEND_FACTOR[mode] || mapConfig.BEND_FACTOR.drive
      
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
    _parsePolyline(polyline) {
      // 如果是数组格式（多点路径规划返回的）
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
    }
  }
})
