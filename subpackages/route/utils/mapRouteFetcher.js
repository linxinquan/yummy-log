/**
 * 地图路线获取工具
 * 封装腾讯地图路径规划 API 调用、polyline 解析、模拟路线降级
 * 供 route-map-behavior 和 my-route 页面共用
 * 放在子包内，避免主包 → 子包的非法引用
 */

const mapConfig = require('./map-config')

/**
 * 获取真实路线（腾讯地图路径规划）
 * @param {Object} options
 * @param {Array}   options.allPoints     - 所有途经点 [{latitude, longitude}]
 * @param {string}  options.travelMode    - 出行方式: 'drive' | 'transit' | 'walk' | 'ride'
 * @param {string}  options.qqMapKey      - 腾讯地图 API Key
 * @param {Function} options.onSuccess    - 成功回调 (polylinePoints: Array)
 * @param {Function} options.onFallback   - 降级回调 (polylinePoints: Array)
 */
function fetchRealRoute(options) {
  const { allPoints, travelMode, qqMapKey, onSuccess, onFallback } = options
  const mode = mapConfig.TRAVEL_MODE_MAP[travelMode] || mapConfig.TRAVEL_MODE_MAP.drive

  if (mode === 'driving' && allPoints.length > 2) {
    _fetchDrivingRoute(allPoints, qqMapKey, onSuccess, () => {
      _useSimulatedRouteForAll(allPoints, travelMode, onFallback)
    })
  } else {
    _fetchSegmentedRoute(allPoints, qqMapKey, mode, onSuccess, () => {
      _useSimulatedRouteForAll(allPoints, travelMode, onFallback)
    })
  }
}

// ─── 驾车路线（支持 waypoints）──────────────────
function _fetchDrivingRoute(allPoints, key, onSuccess, onFallback) {
  const from = allPoints[0]
  const to = allPoints[allPoints.length - 1]
  const waypoints = allPoints.slice(1, -1).map(p => `${p.latitude},${p.longitude}`).join(';')

  const url = `${mapConfig.QQ_MAP_API_BASE}/driving/?from=${from.latitude},${from.longitude}&to=${to.latitude},${to.longitude}&waypoints=${waypoints}&output=json&key=${key}`

  wx.request({
    url,
    success: (res) => {
      if (res.data && res.data.status === 0 && res.data.result && res.data.result.routes && res.data.result.routes[0]) {
        const points = parsePolyline(res.data.result.routes[0].polyline)
        onSuccess(points)
      } else {
        console.warn('[mapRouteFetcher] 驾车路线 API 失败:', res.data)
        onFallback()
      }
    },
    fail: (err) => {
      console.error('[mapRouteFetcher] 驾车路线请求失败:', err)
      onFallback()
    }
  })
}

// ─── 分段路线（步行/公交/骑行，不支持 waypoints）─────
function _fetchSegmentedRoute(allPoints, key, mode, onSuccess, onFallback) {
  const segments = []
  for (let i = 0; i < allPoints.length - 1; i++) {
    segments.push({ from: allPoints[i], to: allPoints[i + 1], index: i })
  }

  const allRoutePoints = []
  let hasError = false

  const requestSegment = (index) => {
    if (index >= segments.length) {
      if (!hasError && allRoutePoints.length > 0) {
        onSuccess(allRoutePoints)
      } else {
        onFallback()
      }
      return
    }

    const seg = segments[index]
    const url = `${mapConfig.QQ_MAP_API_BASE}/${mode}/?from=${seg.from.latitude},${seg.from.longitude}&to=${seg.to.latitude},${seg.to.longitude}&output=json&key=${key}`

    wx.request({
      url,
      success: (res) => {
        if (res.data && res.data.status === 0 && res.data.result && res.data.result.routes && res.data.result.routes[0]) {
          // transit API 的 polyline 嵌套在 steps[] 中，需要特殊提取
          let points
          if (mode === 'transit') {
            points = _extractTransitPolyline(res.data.result.routes[0])
          } else {
            points = parsePolyline(res.data.result.routes[0].polyline)
          }
          if (points.length > 0) {
            if (index > 0) {
              allRoutePoints.push(...points.slice(1))
            } else {
              allRoutePoints.push(...points)
            }
          } else {
            hasError = true
          }
        } else {
          hasError = true
        }
      },
      fail: () => { hasError = true },
      complete: () => {
        setTimeout(() => requestSegment(index + 1), mapConfig.ROUTE_CONFIG.API_DELAY)
      }
    })
  }

  requestSegment(0)
}

// ─── 模拟路线（降级方案）───────────────────
function _useSimulatedRouteForAll(allPoints, mode, onFallback) {
  const points = generateSimulatedRouteForAll(allPoints, mode)
  onFallback(points)
}

function generateSimulatedRouteForAll(allPoints, mode) {
  let allRoutePoints = []
  for (let i = 0; i < allPoints.length - 1; i++) {
    const segment = generateSimulatedRoute(allPoints[i], allPoints[i + 1], mode)
    if (i === 0) {
      allRoutePoints = allRoutePoints.concat(segment)
    } else {
      allRoutePoints = allRoutePoints.concat(segment.slice(1))
    }
  }
  return allRoutePoints
}

function generateSimulatedRoute(from, to, mode) {
  const points = []
  const steps = mapConfig.ROUTE_CONFIG.SIMULATION_STEPS
  const bendFactor = mapConfig.BEND_FACTOR[mode] || mapConfig.BEND_FACTOR.drive

  const dx = to.longitude - from.longitude
  const dy = to.latitude - from.latitude
  const dist = Math.sqrt(dx * dx + dy * dy)

  const safeDist = Math.max(dist, 0.000001)
  const perpX = -dy / safeDist * bendFactor
  const perpY = dx / safeDist * bendFactor

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const bend = Math.sin(t * Math.PI)
    const lat = from.latitude + (to.latitude - from.latitude) * t + perpY * bend
    const lng = from.longitude + (to.longitude - from.longitude) * t + perpX * bend
    points.push({ latitude: lat, longitude: lng })
  }

  return points
}

// ─── 从 transit API 响应中提取全部 polyline ──────
// transit 的 polyline 嵌套在 steps[] 中，而非 routes[0].polyline
function _extractTransitPolyline(routeResult) {
  if (!routeResult || !routeResult.steps) return []
  const allPoints = []
  routeResult.steps.forEach((step) => {
    let stepPolyline = null
    if (step.mode === 'WALKING' && step.polyline) {
      stepPolyline = step.polyline
    } else if (step.mode === 'TRANSIT' && step.lines && step.lines.length > 0) {
      stepPolyline = step.lines[0].polyline
    }
    if (stepPolyline) {
      const points = parsePolyline(stepPolyline)
      if (points.length > 0) {
        if (allPoints.length > 0) {
          allPoints.push(...points.slice(1))
        } else {
          allPoints.push(...points)
        }
      }
    }
  })
  return allPoints
}

// ─── 混和模式路线（每段各自独立模式 + 颜色）──────
// segments: [{from, to, mode}, ...]  mode 为 'drive'|'transit'|'walk'|'ride'
// 每段用自身模式调用 API，结果合并，每段返回 {points, mode} 用于多色折线
function fetchMixedRoute(segments, qqMapKey, onSuccess, onFallback) {
  if (!segments || segments.length === 0) {
    onFallback([])
    return
  }

  const results = []  // [{points, mode}, ...]
  let hasError = false

  const requestSegment = (index) => {
    if (index >= segments.length) {
      if (!hasError && results.length > 0) {
        onSuccess(results)
      } else {
        onFallback(generateMixedSimulatedRoute(segments))
      }
      return
    }

    const seg = segments[index]
    const mode = mapConfig.TRAVEL_MODE_MAP[seg.mode] || mapConfig.TRAVEL_MODE_MAP.drive

    // 判断是否需要使用驾车 waypoints（仅在单一模式下可能，这里皆单段无需 waypoints）
    const url = `${mapConfig.QQ_MAP_API_BASE}/${mode}/?from=${seg.from.latitude},${seg.from.longitude}&to=${seg.to.latitude},${seg.to.longitude}&output=json&key=${qqMapKey}`

    wx.request({
      url,
      success: (res) => {
        if (res.data && res.data.status === 0 && res.data.result && res.data.result.routes && res.data.result.routes[0]) {
          let points
          if (mode === 'transit') {
            points = _extractTransitPolyline(res.data.result.routes[0])
          } else {
            points = parsePolyline(res.data.result.routes[0].polyline)
          }
          if (points.length > 0) {
            results.push({ points, mode: seg.mode })
          } else {
            hasError = true
          }
        } else {
          console.warn('[mapRouteFetcher] 混合路线单段 API 失败:', res.data)
          hasError = true
        }
      },
      fail: (err) => {
        console.error('[mapRouteFetcher] 混合路线单段请求失败:', err)
        hasError = true
      },
      complete: () => {
        setTimeout(() => requestSegment(index + 1), mapConfig.ROUTE_CONFIG.API_DELAY)
      }
    })
  }

  requestSegment(0)
}

// 混合模式模拟路线降级
function generateMixedSimulatedRoute(segments) {
  return segments.map(seg => ({
    points: generateSimulatedRoute(seg.from, seg.to, seg.mode),
    mode: seg.mode
  }))
}

// ─── 解析腾讯地图 polyline ─────────────────────
function parsePolyline(polyline) {
  // 数组格式（多点路径规划）
  if (Array.isArray(polyline)) {
    const points = []
    for (let i = 0; i < polyline.length; i += 2) {
      if (i + 1 < polyline.length) {
        if (i === 0) {
          points.push({ latitude: polyline[i], longitude: polyline[i + 1] })
        } else {
          const prev = points[points.length - 1]
          points.push({
            latitude: prev.latitude + polyline[i] / 1000000,
            longitude: prev.longitude + polyline[i + 1] / 1000000
          })
        }
      }
    }
    return points
  }

  // 字符串格式（压缩 polyline）
  if (typeof polyline === 'string') {
    return _decodePolylineString(polyline)
  }

  return []
}

function _decodePolylineString(polylineStr) {
  if (!polylineStr || typeof polylineStr !== 'string') return []

  const points = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < polylineStr.length) {
    let b, shift = 0, result = 0
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

    points.push({ latitude: lat / 1e6, longitude: lng / 1e6 })
  }

  return points
}

module.exports = {
  fetchRealRoute,
  fetchMixedRoute,
  parsePolyline,
  generateSimulatedRouteForAll,
  generateSimulatedRoute
}
