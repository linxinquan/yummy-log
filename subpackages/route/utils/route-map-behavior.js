// behaviors/route-map-behavior.js
// 地图相关行为的 Behavior
// 包含：地图更新、路线规划、地图预览等功能

const app = getApp()
const mapConfig = require('./map-config')
const { fetchRealRoute } = require('./mapRouteFetcher')

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

    const markers = routeShops.map((shop, index) => {
      return {
        id: shop.id,
        latitude: shop.lat || shop.latitude,
        longitude: shop.lng || shop.longitude,
        // 地图模式只保留数字顺序，不再显示分类图片底图，
        // 避免分类图标和数字标签叠在一起发生冲突。
        label: {
          content: String(index + 1),
          // 继续按用户确认的新参数微调成更接近正圆：
          // 1. 数字大小 14px
          // 2. 内容宽高都按 14px 设置
          // 3. 文本水平居中
          // 4. padding 8px，形成约 30px 的蓝底圆点视觉
          // 5. 白色描边仍保留 2px
          color: '#ffffff',
          fontSize: 14,
          width: 14,
          height: 14,
          textAlign: 'center',
          borderRadius: 15,
          bgColor: '#47BFFE',
          padding: 8,
          borderWidth: 2,
          borderColor: '#FFFFFF',
          anchorX: 0,
          // 去掉底部图片后，把数字标签拉回到点位本身，避免悬空显示。
          anchorY: 0
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
      }
    })

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

      // 路线地图额外显示当前位置图标，和探索页保持同一套资源。
      if (app.globalData.location) {
        markers.unshift({
          id: 9998,
          latitude: app.globalData.location.lat,
          longitude: app.globalData.location.lng,
          iconPath: CURRENT_LOCATION_ICON_PATH,
          width: 36,
          height: 36,
          anchor: { x: 0.5, y: 0.5 }
        })
      }
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

      fetchRealRoute({
        allPoints,
        travelMode,
        qqMapKey: key,
        onSuccess: (points) => {
          const polyline = [{
            points,
            color: routeColor + 'CC',
            width: 5,
            dottedLine: false,
            arrowLine: true
          }]
          this._setMapData(markers, polyline, startPoint, routeShops)
          if (cacheKey) {
            if (!this._routeCache) this._routeCache = {}
            this._routeCache[cacheKey] = { points, markers, color: routeColor }
          }
        },
        onFallback: (points) => {
          console.log('[模拟路线] 使用模拟路线')
          const polyline = [{
            points,
            color: routeColor + 'CC',
            width: 5,
            dottedLine: false,
            arrowLine: true
          }]
          this._setMapData(markers, polyline, startPoint, routeShops)
          if (cacheKey) {
            if (!this._routeCache) this._routeCache = {}
            this._routeCache[cacheKey] = { points, markers, color: routeColor }
          }
        }
      })
    }
  }
})
