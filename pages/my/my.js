// 觅食图 - 我的页面 v5.1 觅食迹版
const app = getApp()
const shopData = require('../../utils/shopData')
const util = require('../../utils/util')
let checkinUtil = null
try {
  checkinUtil = require('../../utils/checkinUtil')
} catch (e) {
  console.warn('checkinUtil 加载失败:', e)
}

Page({
  data: {
    // 登录状态
    isLoggedIn: false,
    nickName: '',
    avatarUrl: '/images/app-logo.jpg', // 未登录默认头像
    hasNickname: false, // 是否有昵称
    hasAvatar: false,   // 是否选择了头像

    // 用户信息
    userInfo: {
      nickName: '',
      avatarUrl: '',
      uid: '',
      level: '',
      isVip: false,
      visits: 0
    },

    // 统计数据
    stats: {
      likedCount: 0,
      visitedCount: 0,
      userAddedCount: 0
    },

    // 列表数据
    currentTab: 'liked',
    likedShops: [],
    visitedList: [],
    userAddedShops: [],

    // 当前行政区划
    currentDistrict: '南山区',  // 默认值，等待定位更新
    currentCity: '深圳市',

    // 天气信息
    weatherIcon: '☀️',
    weatherTemp: '25°C',

    // 打卡采集统计
    checkinStats: { totalCount: 0, cityCount: 0, spotCount: 0, foodCount: 0 },

    // 采集展示
    latestStamp: null,
    recentStamps: [],

    // 深圳地图打卡点（统一 + 分类）
    mapCenter: { latitude: 22.543099, longitude: 114.057868 },
    mapMarkers: [],
    spotMarkers: [],
    foodMarkers: [],

    // 双地图滚动指示
    journeyIndex: 0
  },

  onLoad() {
    this.loadUserInfo()
    this.loadData()
    // 获取行政区划信息
    this.loadDistrictInfo()
    // 获取天气
    this.loadWeather()
  },

  onShow() {
    this.loadUserInfo()
    this.loadData()
    this.loadCheckinStats()
  },

  loadCheckinStats() {
    if (!checkinUtil) return
    try {
      const stats = checkinUtil.getCheckinStats()
      const allCheckins = checkinUtil.getCheckins()

      // 最新邮票（第一条）
      let latestStamp = null
      if (allCheckins.length > 0) {
        const first = allCheckins[0]
        const d = new Date(first.date)
        latestStamp = {
          ...first,
          dateStr: `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`
        }
      }

      // 近期邮票（最多6条）
      const recentStamps = allCheckins.slice(0, 6).map(c => {
        const d = new Date(c.date)
        return {
          ...c,
          shortDate: `${d.getMonth()+1}/${d.getDate()}`,
          dateStr: `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`
        }
      })

      // 地图打卡点：只用有坐标的采集记录，分景点/美食两组
      const mapMarkers = []
      const spotMarkers = []
      const foodMarkers = []
      allCheckins.forEach((c) => {
        if (c.latitude && c.longitude) {
          const marker = {
            id: c.id,
            latitude: c.latitude,
            longitude: c.longitude,
            width: 36,
            height: 36,
            callout: {
              content: c.spotName || (c.type === 'spot' ? '🏞️' : '🍜'),
              color: '#ffffff',
              fontSize: 11,
              borderRadius: 6,
              padding: 4,
              display: 'BYCLICK',
              bgColor: c.type === 'spot' ? '#00D9C0' : '#FF8B7E',
              textAlign: 'center'
            }
          }
          mapMarkers.push(marker)
          if (c.type === 'spot') {
            spotMarkers.push(marker)
          } else {
            foodMarkers.push(marker)
          }
        }
      })

      // 地图中心：取所有打卡点的边界中心，无数据时默认深圳
      let mapCenter = { latitude: 22.543099, longitude: 114.057868 }
      if (mapMarkers.length > 0) {
        const lats = mapMarkers.map(m => m.latitude)
        const lngs = mapMarkers.map(m => m.longitude)
        mapCenter = {
          latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
          longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2
        }
      }

      // 景点/美食各自的地图中心
      const getCenter = (markers) => {
        if (markers.length === 0) return { latitude: 22.543099, longitude: 114.057868 }
        const lats = markers.map(m => m.latitude)
        const lngs = markers.map(m => m.longitude)
        return {
          latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
          longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2
        }
      }

      this.setData({
        checkinStats: {
          totalCount: stats.totalCount || 0,
          cityCount: stats.cityCount || 0,
          spotCount: stats.spotCount || 0,
          foodCount: stats.foodCount || 0
        },
        latestStamp,
        recentStamps,
        mapMarkers,
        spotMarkers,
        foodMarkers,
        mapCenter,
        spotMapCenter: getCenter(spotMarkers),
        foodMapCenter: getCenter(foodMarkers)
      })
    } catch (e) {
      console.warn('getCheckinStats 失败:', e)
    }
  },

  // 预览邮票大图
  onPreviewStamp(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.recentStamps.find(c => c.id === id)
    if (item && item.photoPath) {
      wx.previewImage({ urls: [item.photoPath], current: item.photoPath })
    }
  },

  // 统一采集入口
  onGoCheckin() {
    wx.showActionSheet({
      itemList: ['🍜 美食采集', '🏞️ 景点采集'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({ url: '/pages/checkin/checkin?type=food' })
        } else {
          wx.navigateTo({ url: '/pages/checkin/checkin?type=spot' })
        }
      }
    })
  },

  // 加载行政区划信息
  loadDistrictInfo() {
    app.whenDistrictReady((info) => {
      this.setData({
        currentDistrict: info.district,
        currentCity: info.city
      })
      // 区划更新后重新获取天气
      this.loadWeather()
    })
  },

  // 加载天气信息
  loadWeather() {
    const location = app.globalData.location
    if (!location) return
    
    // 使用和风天气API（免费版）
    wx.request({
      url: 'https://devapi.qweather.com/v7/weather/now',
      data: {
        location: `${Math.round(location.lng * 100) / 100},${Math.round(location.lat * 100) / 100}`,
        key: '6e62e8e03d5e4e7ebc4e95e9e7e0a5e5'  // 和风天气API Key
      },
      success: (res) => {
        if (res.data && res.data.code === '200') {
          const now = res.data.now
          const iconMap = {
            '100': '☀️', '101': '☁️', '102': '⛅', '103': '🌤️',
            '104': '☁️', '200': '🌬️', '201': '🌬️', '202': '🌬️',
            '300': '🌦️', '301': '🌧️', '302': '⛈️', '303': '🌨️',
            '304': '❄️', '305': '🌧️', '306': '🌧️', '307': '🌨️',
            '308': '🌨️', '309': '🌧️', '310': '🌧️', '311': '🌧️',
            '312': '⛈️', '313': '⛈️', '314': '🌧️', '315': '🌧️',
            '316': '🌨️', '317': '🌨️', '318': '🌨️', '400': '🌙',
            '401': '☁️', '402': '🌨️', '403': '❄️', '404': '❄️',
            '405': '🌨️', '406': '🌨️', '407': '❄️', '408': '❄️',
            '409': '🌨️', '410': '❄️', '456': '🌧️', '457': '🌨️'
          }
          this.setData({
            weatherIcon: iconMap[now.icon] || '🌡️',
            weatherTemp: now.temp + '°C'
          })
        }
      },
      fail: () => {
        // 静默失败，保持默认天气
      }
    })
  },

  // 加载用户信息
  loadUserInfo() {
    const userInfo = util.loadData('userInfo', null)
    if (userInfo) {
      this.setData({
        isLoggedIn: true,
        userInfo: userInfo,
        nickName: userInfo.nickName,
        avatarUrl: userInfo.avatarUrl
      })
    }
  },

  // 选择头像（微信一键登录）
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    console.log('选择了头像:', avatarUrl)

    const hasNickname = !!this.data.nickName

    this.setData({
      avatarUrl,
      hasAvatar: true
    })

    // 如果已有昵称，显示登录按钮状态
    if (hasNickname) {
      this.setData({ hasNickname: true })
    }
  },

  // 输入昵称
  onInputNickname(e) {
    const nickName = e.detail.value.trim()
    const hasNickname = nickName.length > 0
    this.setData({
      nickName,
      hasNickname
    })
  },

  // 昵称输入框失焦
  onNicknameBlur(e) {
    const nickName = e.detail.value.trim()
    const hasNickname = nickName.length > 0
    this.setData({
      nickName: nickName || this.data.nickName,
      hasNickname
    })
  },

  // 快速登录
  onQuickLogin() {
    const { nickName, avatarUrl, hasNickname, hasAvatar } = this.data

    if (!hasNickname) {
      wx.showToast({ title: '请先设置昵称', icon: 'none' })
      return
    }

    this.completeLogin(avatarUrl)
  },

  // 完成登录/注册
  onCompleteLogin() {
    const { nickName, avatarUrl } = this.data
    if (!nickName) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    this.completeLogin(avatarUrl)
  },

  // 完成注册流程
  completeLogin(avatarUrl) {
    const userInfo = {
      uid: 'MS' + Date.now().toString(36).toUpperCase(),
      nickName: this.data.nickName || '觅食者',
      avatarUrl: avatarUrl || '/images/app-logo.jpg',
      phone: this.data.userInfo?.phone || '',
      level: 'Lv.1 入门吃货',
      isVip: false,
      visits: this.data.stats.visitedCount,
      createdAt: new Date().toISOString()
    }

    // 保存到本地
    util.saveData('userInfo', userInfo)
    
    this.setData({
      isLoggedIn: true,
      userInfo: userInfo
    })

    wx.showToast({ 
      title: '登录成功', 
      icon: 'success',
      duration: 2000
    })

    // 显示用户菜单
    this.animateUserMenu()
  },

  // 用户菜单动画
  animateUserMenu() {
    setTimeout(() => {
      this.setData({ showUserMenu: true })
    }, 300)
  },

  // 编辑资料
  onEditProfile() {
    wx.showActionSheet({
      itemList: ['修改昵称', '更换头像', '退出登录'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0: // 修改昵称
            this.showEditNickname()
            break
          case 1: // 更换头像
            // 头像修改通过点击头像区域
            break
          case 2: // 退出登录
            this.onLogout()
            break
        }
      }
    })
  },

  // 显示修改昵称弹窗
  showEditNickname() {
    wx.showModal({
      title: '修改昵称',
      editable: true,
      placeholderText: '请输入新昵称',
      success: (res) => {
        if (res.confirm && res.content) {
          const userInfo = this.data.userInfo
          userInfo.nickName = res.content.trim()
          util.saveData('userInfo', userInfo)
          this.setData({ 
            nickName: userInfo.nickName,
            userInfo: userInfo
          })
          wx.showToast({ title: '修改成功', icon: 'success' })
        }
      }
    })
  },

  // 退出登录
  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除登录状态（保留觅食记录数据）
          util.saveData('userInfo', null)
          this.setData({
            isLoggedIn: false,
            nickName: '',
            avatarUrl: '/images/app-logo.jpg',
            hasNickname: false,
            hasAvatar: false,
            userInfo: {},
            showUserMenu: false
          })
          wx.showToast({ title: '已退出登录', icon: 'none' })
        }
      }
    })
  },

  // 菜单点击
  onMenuTap(e) {
    const type = e.currentTarget.dataset.type
    const labels = ['我的收藏', '觅食足迹', '我的攻略', '设置']
    wx.showToast({ 
      title: labels[['favorites', 'history', 'guides', 'settings'].indexOf(type)],
      icon: 'none' 
    })
  },

  // 加载数据
  loadData() {
    const userData = util.getUserShops()
    const userAddedShops = util.loadData('userAddedShops', [])
    
    // 所有店铺
    const allShops = [...shopData.shops, ...userAddedShops]
    const shopMap = {}
    allShops.forEach(s => shopMap[s.id] = s)
    
    // 想去列表
    const likedShops = (userData.likedShops || [])
      .map(id => shopMap[id])
      .filter(s => s)
    
    // 到访列表（觅食记录）
    const visitedList = Object.entries(userData.checkedInShops || {})
      .map(([shopId, data]) => ({
        shopId: parseInt(shopId),
        shop: shopMap[parseInt(shopId)],
        data: {
          ...data,
          dateStr: new Date(data.date).toLocaleDateString('zh-CN')
        }
      }))
      .filter(item => item.shop)
      .sort((a, b) => new Date(b.data.date) - new Date(a.data.date))
    
    this.setData({
      likedShops,
      visitedList,
      userAddedShops,
      stats: {
        likedCount: likedShops.length,
        visitedCount: visitedList.length,
        userAddedCount: userAddedShops.length
      }
    })

    // 更新用户觅食次数
    if (this.data.isLoggedIn) {
      const userInfo = this.data.userInfo
      userInfo.visits = visitedList.length
      util.saveData('userInfo', userInfo)
      this.setData({ userInfo })
    }
  },

  // Tab 切换
  onSwitchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ currentTab: tab })
  },

  // 店铺点击
  onShopTap(e) {
    const shop = e.currentTarget.dataset.shop
    wx.navigateTo({
      url: `/pages/sub/shop-detail/shop-detail?shop=${encodeURIComponent(JSON.stringify(shop))}`
    })
  },

  // 移除想去
  onRemoveLiked(e) {
    const shopId = e.currentTarget.dataset.shopid
    util.toggleLike(shopId)
    this.loadData()
    wx.showToast({ title: '已取消', icon: 'none' })
  },

  // 删除店铺
  onDeleteShop(e) {
    const shopId = e.currentTarget.dataset.shopid
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个店铺吗？',
      success: (res) => {
        if (res.confirm) {
          let shops = util.loadData('userAddedShops', [])
          shops = shops.filter(s => s.id !== shopId)
          util.saveData('userAddedShops', shops)
          this.loadData()
          wx.showToast({ title: '已删除', icon: 'success' })
        }
      }
    })
  },

  // 添加店铺
  onAddShop() {
    wx.navigateTo({
      url: '/pages/add-shop/add-shop'
    })
  },

  // 前往「想去清单」独立页面
  onGoWantgo() {
    wx.navigateTo({ url: '/pages/wantgo/wantgo' })
  },

  // 前往路线规划页
  onGoRoute() {
    wx.navigateTo({ url: '/pages/route/route' })
  },

  // 前往打卡采集列表
  onGoCollection() {
    wx.navigateTo({ url: '/pages/collection/collection' })
  },

  // 美食打卡
  onGoCheckinFood() {
    wx.navigateTo({ url: '/pages/checkin/checkin?type=food' })
  },

  // 景点打卡
  onGoCheckinSpot() {
    wx.navigateTo({ url: '/pages/checkin/checkin?type=spot' })
  },

  // 点击地图卡片
  onMapTap() {
    // 有打卡点时提示，无打卡点时引导采集
    if (this.data.mapMarkers.length === 0) {
      wx.showModal({
        title: '还没有点亮',
        content: '先去采集美食或景点吧～',
        confirmText: '去采集',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/checkin/checkin?type=food' })
          }
        }
      })
    }
  },

  // 标题栏未登录点击
  onShowLogin() {
    // 滚动到统计条以下位置，那里还有未登录表单
    wx.pageScrollTo({ scrollTop: 200, duration: 300 })
  },

  // 景点地图点击
  onSpotMapTap() {
    if (this.data.spotMarkers.length === 0) {
      wx.navigateTo({ url: '/pages/checkin/checkin?type=spot' })
    }
  },

  // 美食地图点击
  onFoodMapTap() {
    if (this.data.foodMarkers.length === 0) {
      wx.navigateTo({ url: '/pages/checkin/checkin?type=food' })
    }
  },

  // 双地图横向滚动处理
  onJourneyScroll(e) {
    const scrollLeft = e.detail.scrollLeft
    const cardWidth = wx.getSystemInfoSync().windowWidth - 80 // 减去边距
    const index = Math.round(scrollLeft / cardWidth)
    if (index !== this.data.journeyIndex) {
      this.setData({ journeyIndex: index })
    }
  }
})
