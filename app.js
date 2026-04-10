// 觅食图 - 小程序入口
// 版本：V1.0.2（2026-04-01）
// 更新：路线规划页支持起点/终点自定义选择；首页想去浮动按钮跳转清单页

App({
  globalData: {
    userInfo: null,
    location: null,
    locationReady: false,          // 定位是否已就绪
    locationCallbacks: [],           // 等待定位的回调队列
    // 蛇口区域中心坐标（定位失败时使用）
    centerLocation: {
      lat: 22.4846,
      lng: 113.9046
    },
    // 地图 Key
    qqMapKey: 'YLBBZ-VLNWJ-HFSFO-5QBUJ-SJ633-CTBFF',
    // 百度地图 Key（用于全景图）
    baiduMapKey: 'KuGlOjdoC0kmGUbU1Tw2OQyK6LKQ6gGa',
    // 用户行政区划信息
    districtInfo: {
      city: '深圳市',      // 城市
      district: '南山区'   // 区
    },
    // 用户详细位置描述
    locationDesc: '',  // 如 "南山街道" 或 "海上世界附近"
  },

  onLaunch() {
    // 启动时获取用户位置
    this.getUserLocation()
  },

  // 获取用户位置（返回 Promise）
  getUserLocation() {
    return new Promise((resolve) => {
      wx.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        success: (res) => {
          const loc = {
            lat: res.latitude,
            lng: res.longitude,
            accuracy: res.accuracy
          }
          this.globalData.location = loc
          this.globalData.locationReady = true
          console.log('✅ 定位成功', loc)
          // 逆地址解析获取行政区划
          this.reverseGeocode(loc.lat, loc.lng)
          // 通知所有等待回调
          this.globalData.locationCallbacks.forEach(cb => cb(loc))
          this.globalData.locationCallbacks = []
          resolve(loc)
        },
        fail: (err) => {
          console.log('❌ 获取位置失败，使用蛇口中心坐标', err)
          const defaultLoc = this.globalData.centerLocation
          this.globalData.location = defaultLoc
          this.globalData.locationReady = true
          // 使用默认的行政区划
          this.reverseGeocode(defaultLoc.lat, defaultLoc.lng)
          this.globalData.locationCallbacks.forEach(cb => cb(defaultLoc))
          this.globalData.locationCallbacks = []
          resolve(defaultLoc)
        }
      })
    })
  },

  // 逆地址解析：经纬度 → 行政区划 + 详细位置
  reverseGeocode(lat, lng) {
    const key = this.globalData.qqMapKey
    const url = `https://apis.map.qq.com/ws/geocoder/v1/?location=${lat},${lng}&key=${key}&get_poi=0`
    
    wx.request({
      url: url,
      success: (res) => {
        if (res.data && res.data.status === 0 && res.data.result) {
          const addr = res.data.result.address_component
          const city = addr.city || '深圳市'
          const district = addr.district || '南山区'
          const street = addr.street || ''  // 街道
          const street_number = addr.street_number || ''  // 门牌号
          
          // 生成详细位置描述
          let locationDesc = ''
          if (street) {
            // 优先使用街道名
            locationDesc = street.replace(district, '').trim() || district
            if (!locationDesc) locationDesc = district
          } else {
            locationDesc = district
          }
          
          this.globalData.districtInfo = {
            city: city,
            district: district
          }
          this.globalData.locationDesc = locationDesc
          console.log('📍 位置描述:', locationDesc, city, district)
          
          // 通知所有等待区划信息的回调
          if (this.globalData.districtCallbacks) {
            this.globalData.districtCallbacks.forEach(cb => cb(this.globalData.districtInfo, locationDesc))
            this.globalData.districtCallbacks = []
          }
        }
      },
      fail: (err) => {
        console.log('❌ 逆地址解析失败，使用默认区划', err)
        // 使用默认区划
        this.globalData.districtInfo = {
          city: '深圳市',
          district: '南山区'
        }
        this.globalData.locationDesc = '南山区'
      }
    })
  },

  // 等待定位就绪后执行（供各页面调用）
  whenLocationReady(callback) {
    if (this.globalData.locationReady && this.globalData.location) {
      callback(this.globalData.location)
    } else {
      this.globalData.locationCallbacks.push(callback)
    }
  },

  // 等待区划信息就绪后执行
  whenDistrictReady(callback) {
    if (this.globalData.districtInfo && this.globalData.districtInfo.district) {
      callback(this.globalData.districtInfo)
    } else {
      if (!this.globalData.districtCallbacks) {
        this.globalData.districtCallbacks = []
      }
      this.globalData.districtCallbacks.push(callback)
    }
  }
})
