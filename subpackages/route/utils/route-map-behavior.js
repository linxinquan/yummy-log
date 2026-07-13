// behaviors/route-map-behavior.js
// 地图相关行为的 Behavior
// 包含：地图更新、路线规划、地图预览等功能

const app = getApp()
const mapConfig = require('../../../utils/map-config')
const { fetchRealRoute, fetchMixedRoute } = require('../../../utils/mapRouteFetcher')

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
      const currentDaySection = (this.data.daySections || [])[effectiveDayIndex] || {}
      const routeShops = (currentDaySection.items || []).length ? currentDaySection.items : (this.data.routeShops || [])
      
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
      
      // 根据出行方式设置路线颜色
      const modeColors = {
        drive: mapConfig.THEME_COLORS.drive,
        transit: mapConfig.THEME_COLORS.transit,
        walk: mapConfig.THEME_COLORS.walk,
        ride: mapConfig.THEME_COLORS.ride
      }

      // 逐段获取交通方式
      const segmentModes = routeShops.map(shop => {
        return (shop.travelMeta && shop.travelMeta.mode) || shop.travelMode || travelMode
      })
      const uniqueModes = [...new Set(segmentModes)]
      const isMixedMode = uniqueModes.length > 1

      // 构建缓存键
      const modeKey = isMixedMode ? segmentModes.join(',') : uniqueModes[0]
      const cacheKey = `${effectiveDayIndex}-${modeKey}-${startPoint.lat}-${startPoint.lng}`
      
      // 检查缓存
      if (this._routeCache[cacheKey]) {
        const cachedData = this._routeCache[cacheKey]
        this._setMapData(cachedData.markers, cachedData.polyline, startPoint, routeShops)
        return
      }

    const markers = routeShops.map((shop, index) => {
      // 防御性代码：确保经纬度不是 NaN
      let lat = 0, lng = 0
      if (typeof shop.lat === 'number' && !isNaN(shop.lat)) {
        lat = shop.lat
      } else if (typeof shop.latitude === 'number' && !isNaN(shop.latitude)) {
        lat = shop.latitude
      }
      if (typeof shop.lng === 'number' && !isNaN(shop.lng)) {
        lng = shop.lng
      } else if (typeof shop.longitude === 'number' && !isNaN(shop.longitude)) {
        lng = shop.longitude
      }
      
      return {
        id: shop.id,
        latitude: lat,
        longitude: lng,
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
          bgColor: '#25BBE7',
          padding: 8,
          borderWidth: 2,
          borderColor: '#FFFFFF',
          anchorX: 0,
          // 去掉底部图片后，把数字标签拉回到点位本身，避免悬空显示。
          anchorY: 0
        },
        callout: {
          content: shop.name,
          color: '#1A2739',
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

      // 构建所有途经点（起点 + 各店铺，不返回起点）
      const allPoints = [
        { latitude: startPoint.lat, longitude: startPoint.lng },
        ...routeShops.map(shop => { 
          let lat = typeof shop.lat === 'number' && !isNaN(shop.lat) ? shop.lat : 
                   typeof shop.latitude === 'number' && !isNaN(shop.latitude) ? shop.latitude : 0
          let lng = typeof shop.lng === 'number' && !isNaN(shop.lng) ? shop.lng : 
                   typeof shop.longitude === 'number' && !isNaN(shop.longitude) ? shop.longitude : 0
          return { latitude: lat, longitude: lng }
        })
      ]
      
      // 调试：打印 allPoints 数据
      console.log('[updateMap] allPoints:', allPoints.map(p => ({ lat: p.latitude, lng: p.longitude })))
      console.log('[updateMap] isMixedMode:', isMixedMode, 'segmentModes:', segmentModes)

      // 如果只有起点和一个店铺（或更少），直接画直线
      if (allPoints.length <= 2) {
        const routeColor = modeColors[segmentModes[0]] || mapConfig.THEME_COLORS.primary
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
          this._routeCache[cacheKey] = { polyline, markers }
        }
        return
      }

      if (isMixedMode) {
        // 混合模式：逐段按各自出行方式请求路线
        this._fetchMixedModeRoute(allPoints, segmentModes, modeColors, markers, startPoint, routeShops, cacheKey)
      } else {
        // 单一模式：使用现有逻辑
        const routeColor = modeColors[uniqueModes[0]] || mapConfig.THEME_COLORS.primary
        this._fetchRealRoute(allPoints, routeColor, markers, startPoint, routeShops, cacheKey)
      }
    },

    // 让地图自动缩放到能看见当前路线的全部点位。
    onFitRoute() {
      const effectiveDayIndex = this.data.currentMapDay >= 0 ? this.data.currentMapDay : 0
      const currentDaySection = (this.data.daySections || [])[effectiveDayIndex] || {}
      const currentItems = (currentDaySection.items || []).length ? currentDaySection.items : (this.data.routeShops || [])
      if (currentItems.length === 0) return
      const { currentStart, dayStartPoints } = this.data

      // “全览”需要把当前这一天真正的起点一起纳入范围，
      // 否则地图只会框住中间地点，看起来像只轻微移动了一点点。
      let startPoint = null
      if (dayStartPoints && dayStartPoints[effectiveDayIndex]) {
        startPoint = dayStartPoints[effectiveDayIndex]
      } else if (currentStart) {
        startPoint = currentStart
        if (currentStart.type === 'current') {
          startPoint = app.globalData.location || mapConfig.DEFAULT_CENTER
        }
      }

      const points = [
        ...(startPoint && typeof startPoint.lat === 'number' && typeof startPoint.lng === 'number'
          ? [{ latitude: startPoint.lat, longitude: startPoint.lng }]
          : []),
        ...currentItems
          .map(item => {
            let lat = typeof item.lat === 'number' && !isNaN(item.lat) ? item.lat : 
                     typeof item.latitude === 'number' && !isNaN(item.latitude) ? item.latitude : 0
            let lng = typeof item.lng === 'number' && !isNaN(item.lng) ? item.lng : 
                     typeof item.longitude === 'number' && !isNaN(item.longitude) ? item.longitude : 0
            return { latitude: lat, longitude: lng }
          })
      ]
        // 去掉无效点位，避免 includePoints 被脏数据影响。
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

    // 地图放大一级：
    // 这里只改缩放级别，不主动改中心点，手感更接近双指缩放。
    onMapZoomIn() {
      const currentScale = Number(this.data.mapScale) || 14
      if (currentScale >= 20) return
      this.setData({
        mapScale: Math.min(currentScale + 1, 20)
      })
    },

    // 地图缩小一级：
    // 这里只改缩放级别，不主动改中心点，手感更接近双指缩放。
    onMapZoomOut() {
      const currentScale = Number(this.data.mapScale) || 14
      if (currentScale <= 3) return
      this.setData({
        mapScale: Math.max(currentScale - 1, 3)
      })
    },

    // 地图区域变化结束后，同步真实中心点。
    // 这样后续继续缩放时，就会围绕当前屏幕中心，而不是旧中心点。
    onMapRegionChange(e) {
      if (!e || e.type !== 'end') return

      if (!this._routeMapCtx) {
        this._routeMapCtx = wx.createMapContext('routeMap', this)
      }

      this._routeMapCtx.getCenterLocation({
        success: (res) => {
          if (
            typeof res.latitude !== 'number' ||
            Number.isNaN(res.latitude) ||
            typeof res.longitude !== 'number' ||
            Number.isNaN(res.longitude)
          ) {
            return
          }

          const nextCenter = {
            lat: res.latitude,
            lng: res.longitude
          }
          const currentCenter = this.data.mapCenter || {}
          if (
            Math.abs((currentCenter.lat || 0) - nextCenter.lat) < 0.000001 &&
            Math.abs((currentCenter.lng || 0) - nextCenter.lng) < 0.000001
          ) {
            return
          }

          this.setData({
            mapCenter: nextCenter
          })
        }
      })
    },

    // ─── 设置地图数据 ─────────────────────────────
    _setMapData(markers, polyline, startPoint, routeShops) {
      console.log('[_setMapData] markers:', markers.length, 'polyline点数:', polyline[0]?.points?.length, '颜色:', polyline[0]?.color)

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

      // 如果有焦点店铺，地图中心对准它；否则不设置 mapCenter（让地图自己决定）
      const focusShop = this.data.mapPreviewShop
      const setDataPayload = {
        markers: nextMarkers,
        polyline
      }
      if (focusShop) {
        let lat = typeof focusShop.lat === 'number' && !isNaN(focusShop.lat) ? focusShop.lat : 
                 typeof focusShop.latitude === 'number' && !isNaN(focusShop.latitude) ? focusShop.latitude : 0
        let lng = typeof focusShop.lng === 'number' && !isNaN(focusShop.lng) ? focusShop.lng : 
                 typeof focusShop.longitude === 'number' && !isNaN(focusShop.longitude) ? focusShop.longitude : 0
        setDataPayload.mapCenter = {
          lat: lat,
          lng: lng
        }
      }

      this.setData(setDataPayload, () => {
        console.log('[_setMapData] 地图数据已设置', focusShop ? '中心对准焦点店铺' : '未设置中心')
      })
    },

    // ─── 获取真实路线（腾讯地图路径规划）───────────
    _fetchRealRoute(allPoints, routeColor, markers, startPoint, routeShops, cacheKey) {
      const key = app.globalData.qqMapKey
      // 单模式时所有段交通方式相同，取第一个 shop 的 mode 即可
      const travelMode = routeShops.length > 0
        ? ((routeShops[0].travelMeta && routeShops[0].travelMeta.mode) || routeShops[0].travelMode || this.data.travelMode)
        : this.data.travelMode

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
            this._routeCache[cacheKey] = { polyline, markers }
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
            this._routeCache[cacheKey] = { polyline, markers }
          }
        }
      })
    },

    // ─── 混合模式路线获取（每段各自出行方式，多色折线）──
    _fetchMixedModeRoute(allPoints, segmentModes, modeColors, markers, startPoint, routeShops, cacheKey) {
      const key = app.globalData.qqMapKey

      // 构建逐段请求参数
      const segments = []
      for (let i = 0; i < allPoints.length - 1; i++) {
        segments.push({
          from: allPoints[i],
          to: allPoints[i + 1],
          mode: segmentModes[i] || 'drive'
        })
      }

      console.log('[混合模式路线] segments:', segments.length)

      fetchMixedRoute(segments, key,
        (results) => {
          // results: [{points, mode}, ...]
          // 拼接为多色折线数组
          const polyline = results.map((seg, i) => ({
            points: seg.points,
            color: (modeColors[seg.mode] || mapConfig.THEME_COLORS.primary) + 'CC',
            width: 5,
            dottedLine: false,
            arrowLine: (i === results.length - 1)  // 只有最后一段显示箭头
          }))
          console.log('[混合模式路线] 成功，折线段数:', polyline.length)
          this._setMapData(markers, polyline, startPoint, routeShops)
          if (cacheKey) {
            if (!this._routeCache) this._routeCache = {}
            this._routeCache[cacheKey] = { polyline, markers }
          }
        },
        (fallbackResults) => {
          // fallbackResults: [{points, mode}, ...]
          console.log('[混合模式路线] 降级使用模拟路线')
          const polyline = fallbackResults.map((seg, i) => ({
            points: seg.points,
            color: (modeColors[seg.mode] || mapConfig.THEME_COLORS.primary) + 'CC',
            width: 5,
            dottedLine: false,
            arrowLine: (i === fallbackResults.length - 1)
          }))
          this._setMapData(markers, polyline, startPoint, routeShops)
          if (cacheKey) {
            if (!this._routeCache) this._routeCache = {}
            this._routeCache[cacheKey] = { polyline, markers }
          }
        }
      )
    }
  }
})
