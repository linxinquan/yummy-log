/**
 * 定位工具函数
 * 从 pages/route/route.js 提取的重复定位逻辑
 */

const app = getApp()

/**
 * 获取当前定位（Promise封装）
 * @param {Object} options - 可选配置
 * @param {string} options.type - 坐标类型，默认'gcj02'
 * @param {boolean} options.isHighAccuracy - 是否高精度，默认true
 * @returns {Promise<Object>} { lat, lng, name }
 */
const getCurrentLocation = (options = {}) => {
  const { type = 'gcj02', isHighAccuracy = true } = options

  return new Promise((resolve, reject) => {
    wx.getLocation({
      type,
      isHighAccuracy,
      success: (res) => {
        const location = {
          lat: res.latitude,
          lng: res.longitude,
          name: '当前位置'
        }
        // 更新全局数据
        if (app.globalData) {
          app.globalData.location = location
        }
        resolve(location)
      },
      fail: (err) => {
        reject(err)
      }
    })
  })
}

/**
 * 获取定位（带降级）
 * 优先使用新定位，失败则使用全局数据中的缓存位置
 * @param {Object} fallback - 降级位置，默认使用 globalData.centerLocation
 * @returns {Promise<Object>} { lat, lng, name }
 */
const getLocationWithFallback = async (fallback = null) => {
  try {
    const location = await getCurrentLocation()
    return location
  } catch (err) {
    console.warn('[定位] 获取失败，使用缓存位置', err)
    // 使用传入的降级位置或全局缓存
    const cached = fallback ||
      (app.globalData && (app.globalData.location || app.globalData.centerLocation))

    if (cached) {
      return cached
    }
    throw new Error('无法获取定位，且无非缓存位置')
  }
}

/**
 * 获取定位并自动更新全局数据
 * @param {Object} options - 可选配置
 * @returns {Promise<Object>} { lat, lng, name }
 */
const getCurrentLocationWithUpdate = async (options = {}) => {
  try {
    const location = await getCurrentLocation(options)
    return location
  } catch (err) {
    console.warn('[定位] 获取失败，使用缓存位置', err)
    const cached = app.globalData && (app.globalData.location || app.globalData.centerLocation)
    if (cached) {
      return cached
    }
    throw err
  }
}

/**
 * 选择地图位置
 * @returns {Promise<Object>} { name, address, latitude, longitude }
 */
const chooseLocation = () => {
  return new Promise((resolve, reject) => {
    wx.chooseLocation({
      success: (res) => {
        if (res.name || res.address) {
          resolve(res)
        } else {
          reject(new Error('请选择有效位置'))
        }
      },
      fail: () => {
        reject(new Error('用户取消选择'))
      }
    })
  })
}

/**
 * 显示定位加载提示
 * @param {string} title - 加载提示文字
 */
const showLocationLoading = (title = '定位中...') => {
  wx.showLoading({ title })
}

/**
 * 隐藏加载提示
 */
const hideLocationLoading = () => {
  wx.hideLoading()
}

module.exports = {
  getCurrentLocation,
  getLocationWithFallback,
  chooseLocation,
  showLocationLoading,
  hideLocationLoading
}
