// 觅食图 - 我的页面 v5.1 觅食迹版
const placesData = require('../../utils/placesData')
const util = require('../../utils/util')
const { DEFAULT_COVER_POOL } = require('../../config/cover-pool')
const { getCheckinsAsync, getCheckinStatsAsync } = require('../../utils/checkinUtil')
const migration = require('../../utils/db/migration')
// “我的”页属于主包页面，这里只引用主包 utils。
// 避免主包直接加载分包脚本，导致切到“我的”时页面初始化白屏。
const photoStorage = require('../../utils/photoStorage')

const DATA_MIGRATED_KEY = 'data_migrated'

// 登录用户没有上传头像时，随机从美食 / 景点封面里挑一张，避免回退到项目 Logo。
function getRandomProfileImage() {
  const imagePool = DEFAULT_COVER_POOL

  if (!imagePool.length) {
    return '/images/app-logo.jpg'
  }
  const randomIndex = Math.floor(Math.random() * imagePool.length)
  
  return imagePool[randomIndex]
}

Page({
  data: {
    // 登录状态
    isLoggedIn: false,
    nickName: '',
    avatarUrl: '', // 登录后没有自定义头像时，使用随机美食 / 景点图
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

    // 列表数据
    currentTab: 'liked',
    likedShops: [],
    visitedList: [],
    userAddedShops: [],

    // 打卡采集统计
    checkinStats: { totalCount: 0, cityCount: 0, visitedCount: 0 },

    // 采集展示
    latestStamp: null,
    recentStamps: [],

    // 深圳地图打卡点
    mapCenter: { latitude: 22.543099, longitude: 114.057868 },
    mapMarkers: [],

    // 登录弹窗
    showLoginModal: false,

    // 设置弹窗
    showSettingsModal: false,

    // 资料完善弹窗
    showProfileDialog: false,
    profileNickname: '',
    profileAvatarUrl: ''
  },

  // 页面初始化：加载用户信息和统计数据。
  async onLoad() {
    await this.loadUserInfo()
    this.loadData()
    this.loadCheckinStats()
  },

  // 回到页面时重新刷新用户和打卡数据。
  async onShow() {
    await this.loadUserInfo()
    this.loadData()
    this.loadCheckinStats()
  },

  onUnload() {
  },

  // ========== 登录弹窗相关方法 ==========

  // 显示登录弹窗
  showLoginModal() {
    this.setData({
      showLoginModal: true
    })
  },

  // 隐藏登录弹窗
  hideLoginModal() {
    this.setData({
      showLoginModal: false
    })
  },

  // 点击弹窗遮罩层关闭
  onModalMaskTap() {
    this.hideLoginModal()
  },

  // 阻止弹窗内容点击冒泡
  onModalContentTap() {
    // 什么都不做，只是阻止冒泡
  },

  // ========== 设置弹窗相关方法 ==========

  // 显示设置弹窗
  showSettingsModal() {
    this.setData({ showSettingsModal: true })
  },

  // 隐藏设置弹窗
  hideSettingsModal() {
    this.setData({ showSettingsModal: false })
  },

  // 点击弹窗遮罩层关闭
  onSettingsModalMaskTap() {
    this.hideSettingsModal()
  },

  // 阻止弹窗内容点击冒泡
  onSettingsModalContentTap() {
    // 什么都不做，只是阻止冒泡
  },

  // 点击隐私协议
  onTapPrivacyPolicy() {
    wx.navigateTo({
      url: '/subpackages/extra/pages/privacy/privacy'
    })
  },

  // 点击用户协议
  onTapUserAgreement() {
    wx.navigateTo({
      url: '/subpackages/extra/pages/agreement/agreement'
    })
  },

  // 静默登录：仅通过 openid 登录，不收集头像昵称
  // openid 由云函数后端通过 wxContext 获取，无需用户授权
  async onWechatLogin() {
    wx.showLoading({ title: '登录中...' })

    try {
      // 直接调用云函数登录，不传 nickName/avatarUrl
      const res = await wx.cloud.callFunction({
        name: 'login',
        data: {}
      })

      if (res.result.success) {
        const userInfo = res.result.user

        // 保存到本地
        util.saveData('userInfo', userInfo)

        // 判断头像昵称是否完整（云端已有则直接使用，否则等待用户补充）
        const hasNickname = !!userInfo.nickName && userInfo.nickName !== '微信用户'
        const hasAvatar = !!userInfo.avatarUrl

        const fallbackAvatar = userInfo.avatarUrl || getRandomProfileImage()

        // 更新页面状态
        this.setData({
          isLoggedIn: true,
          userInfo: userInfo,
          nickName: userInfo.nickName || '微信用户',
          avatarUrl: fallbackAvatar,
          hasNickname,
          hasAvatar,
          showLoginModal: false
        })

        // 资料不完整 → 弹出资料完善弹窗，让用户一次性完成
        if (!hasNickname || !hasAvatar) {
          this.setData({
            showProfileDialog: true,
            profileNickname: userInfo.nickName || '',
            profileAvatarUrl: fallbackAvatar
          })
        } else {
          wx.showToast({ title: '登录成功', icon: 'success' })
        }

        // 异步从云端恢复数据
        const restore = require('../../utils/db/restore')
        restore.restoreFromCloud()

        // 如果是新用户，询问是否同步本地数据
        if (res.result.isNew) {
          this.askSyncData()
        }
      } else {
        wx.showToast({ title: res.result.error || '登录失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[my.js] 微信登录失败:', err)
      wx.showToast({ title: '登录失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // ========== 资料完善弹窗方法 ==========

  // 选择头像：立即持久化到本地沙盒，避免临时路径失效
  async onProfileChooseAvatar(e) {
    if (!e.detail.avatarUrl) return
    const tempPath = e.detail.avatarUrl
    // 持久化图片
    const { localPath } = await photoStorage.persistPhoto(tempPath).catch(() => ({ localPath: tempPath }))
    this.setData({ profileAvatarUrl: localPath })
  },

  // 昵称选择完成后取值（用 bindblur 避免在弹窗中引发页面白屏）
  onProfileNicknameBlur(e) {
    this.setData({ profileNickname: e.detail.value || '' })
  },

  // 隐藏资料完善弹窗
  hideProfileDialog() {
    this.setData({ showProfileDialog: false })
  },

  // 保存资料（头像 + 昵称）
  async onSaveProfile() {
    const { profileNickname, profileAvatarUrl, userInfo } = this.data

    if (!profileNickname) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })

    try {
      // 准备更新数据
      const updateData = {}
      let changed = false

      // 昵称有变化或为空
      if (profileNickname && profileNickname !== userInfo.nickName) {
        updateData.nickName = profileNickname
        userInfo.nickName = profileNickname
        changed = true
      }

      // 头像有变化：持久化本地 + 上传云存储，用 cloudFileID 同步到云端
      if (profileAvatarUrl && profileAvatarUrl !== userInfo.avatarUrl) {
        const { localPath, cloudFileID } = await photoStorage.persistPhoto(profileAvatarUrl)
        userInfo.avatarUrl = localPath
        updateData.avatarUrl = cloudFileID || localPath
        changed = true
      }

      // 有变化时通过 login 云函数同步更新到云端
      // （login 已内置 nickName/avatarUrl 更新逻辑 + 返回最新数据）
      if (changed && userInfo._id) {
        const res = await wx.cloud.callFunction({
          name: 'login',
          data: updateData
        })
        if (!res.result.success) throw new Error(res.result.error || '更新失败')
        // 用云函数返回的最新数据更新本地
        if (res.result.user) {
          Object.assign(userInfo, res.result.user)
        }
      }

      // 更新本地缓存
      util.saveData('userInfo', userInfo)

      // 更新页面状态
      this.setData({
        userInfo: userInfo,
        nickName: userInfo.nickName,
        avatarUrl: userInfo.avatarUrl,
        hasNickname: true,
        hasAvatar: true,
        showProfileDialog: false
      })

      wx.hideLoading()
      wx.showToast({ title: '资料完善成功', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      console.error('[my.js] 保存资料失败:', err)
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    }
  },

  // ========== 读取打卡统计 ==========
  loadCheckinStats() {
    // 未登录不显示用户数据
    if (!this.data.isLoggedIn) {
      this.setData({
        checkinStats: { totalCount: 0, cityCount: 0, visitedCount: 0 },
        latestStamp: null,
        recentStamps: [],
        mapMarkers: [],
        mapCenter: { latitude: 22.543099, longitude: 114.057868 }
      })
      return
    }
    const stats = getCheckinStatsAsync() || { totalCount: 0, cityCount: 0, visitedCount: 0 }
    const allCheckins = getCheckinsAsync() || []

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

    // 地图打卡点：只用有坐标的采集记录
    const mapMarkers = []
    allCheckins.forEach((c) => {
      if (c.latitude && c.longitude) {
        const marker = {
          id: c.id,
          latitude: c.latitude,
          longitude: c.longitude,
          width: 36,
          height: 36,
          callout: {
            content: c.spotName || '采集点',
            color: '#ffffff',
            fontSize: 11,
            borderRadius: 6,
            padding: 4,
            display: 'BYCLICK',
            bgColor: '#FF8B7E',
            textAlign: 'center'
          }
        }
        mapMarkers.push(marker)
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

    this.setData({
      checkinStats: {
        totalCount: stats.totalCount || 0,
        cityCount: stats.cityCount || 0,
        visitedCount: stats.visitedCount || 0
      },
      latestStamp,
      recentStamps,
      mapMarkers,
      mapCenter
    })
  },

  // 从本地缓存 + 云端拉取最新用户信息。
  async loadUserInfo() {
    const isCloudLogin = util.isCloudMode()
    if (isCloudLogin) {
      let userInfo = util.loadData('userInfo', null)

      // 从云端拉取最新用户数据，确保头像/昵称是最新的
      try {
        const usersDal = require('../../utils/db/users')
        const { success, data } = await usersDal.getById(userInfo._id)
        if (success && data) {
          // 用云端数据覆盖本地缓存，但保留本地持久化头像路径（更快，可离线）
          const localAvatar = userInfo.avatarUrl
          userInfo = {
            ...userInfo,
            ...data,
          }
          // 本地有持久化路径则优先使用，否则用云端 cloudFileID
          if (localAvatar && !localAvatar.startsWith('http://tmp')) {
            userInfo.avatarUrl = localAvatar
          }
          util.saveData('userInfo', userInfo)
        }
      } catch (err) {
        console.warn('[my] 从云端拉取用户信息失败，使用本地缓存:', err)
      }

      // 兼容：如果云端/本地都没有头像，补一张随机封面
      const fallbackAvatar = userInfo.avatarUrl || getRandomProfileImage()
      const nextUserInfo = userInfo.avatarUrl
        ? userInfo
        : Object.assign({}, userInfo, { avatarUrl: fallbackAvatar })

      if (!userInfo.avatarUrl) {
        util.saveData('userInfo', nextUserInfo)
      }

      this.setData({
        isLoggedIn: true,
        hasNickname: !!(nextUserInfo.nickName),
        hasAvatar: !!(nextUserInfo.avatarUrl),
        userInfo: nextUserInfo,
        nickName: nextUserInfo.nickName,
        avatarUrl: fallbackAvatar
      })
    } else {
      // 旧版假登录数据（无 _id/openid）→ 清除并视为未登录
      if (util.loadData('userInfo', null)) {
        util.saveData('userInfo', null)
        console.log('[my] 检测到旧版假登录数据，已清除，需重新登录')
      }
      this.setData({
        isLoggedIn: false,
        userInfo: {},
        nickName: '',
        avatarUrl: ''
      })
    }
  },

  // 询问是否同步本地打卡数据到云端
  askSyncData() {
    // 已迁移过则跳过
    if (wx.getStorageSync(DATA_MIGRATED_KEY)) {
      return
    }

    // 登录后直接丢弃路线/店铺/想去/收藏等旧列表数据
    migration.discardLocalLists()

    const hasCheckins = this.checkHasLocalData()
    if (!hasCheckins) return

    wx.showModal({
      title: '采集数据同步',
      content: '检测到本地有采集记录，是否将照片上传并同步到云端？同步后可在其他设备查看。',
      confirmText: '立即同步',
      cancelText: '暂时不同步',
      success: (res) => {
        if (res.confirm) {
          this.syncLocalDataToCloud()
        }
      }
    })
  },

  // 检查本地是否有打卡记录需要迁移
  checkHasLocalData() {
    const records = util.loadData('checkin_records', []) || []
    return records.length > 0
  },

  // 同步打卡记录到云端（两阶段：处理图片 → 写入云端）
  async syncLocalDataToCloud() {
    wx.showLoading({ title: '正在处理...', mask: true })

    try {
      const { success, data, error } = await migration.migrateAll({
        onProgress: (phase, current, total) => {
          const phaseName = {
            photos:   '处理图片',
            checkins: '同步记录',
          }[phase]
          if (phase !== 'done' && phaseName) {
            wx.showLoading({ title: `${phaseName} ${current}/${total}`, mask: true })
          }
        }
      })

      wx.hideLoading()

      if (success) {
        const { count } = data
        if (count > 0) {
          wx.showModal({
            title: '同步完成',
            content: `已同步 ${count} 条采集记录，照片已上传到云端`,
            showCancel: false,
          })
        }

        // 记录迁移完成标记
        wx.setStorageSync(DATA_MIGRATED_KEY, true)
      } else {
        wx.showToast({ title: '同步失败：' + (error && error.message || '未知错误'), icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      console.error('[my.js] 数据迁移失败:', err)
      wx.showToast({ title: '同步失败，请重试', icon: 'none' })
    }
  },

  // 点击顶部资料区：已登录走资料编辑。
  onTapUserProfile() {
    if (!this.data.isLoggedIn) {
      return
    }
    this.onEditProfile()
  },

  // 已登录后点击资料区：可修改昵称
  onEditProfile() {
    wx.showActionSheet({
      itemList: ['修改昵称'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.showEditNickname()
        }
      }
    })
  },

  // 弹出昵称编辑框，并把结果写回缓存。
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

  // 更新昵称
  async onUpdateNickname(e) {
    const newNickName = e.detail.value
    if (!newNickName || newNickName === this.data.userInfo.nickName) {
      return
    }

    try {
      // 通过 login 云函数更新昵称（服务端写入 + 验证通过 openid 都无需传）
      const res = await wx.cloud.callFunction({
        name: 'login',
        data: { nickName: newNickName }
      })

      if (!res.result.success) throw new Error(res.result.error || '更新失败')

      // 更新本地数据
      const userInfo = { ...this.data.userInfo, nickName: newNickName }
      util.saveData('userInfo', userInfo)
      this.setData({ userInfo, nickName: newNickName })

      wx.showToast({ title: '昵称已更新', icon: 'success' })
    } catch (err) {
      console.error('[my.js] 更新昵称失败:', err)
      wx.showToast({ title: '更新失败', icon: 'none' })
    }
  },

  // 更新头像
  async onUpdateAvatar(e) {
    const rawUrl = e.detail.avatarUrl
    if (!rawUrl || rawUrl === this.data.userInfo.avatarUrl) {
      return
    }

    try {
      // 持久化临时头像（本地沙盒 + 云存储）
      const { localPath, cloudFileID } = await photoStorage.persistPhoto(rawUrl)

      // 通过 login 云函数更新头像（传 cloudFileID 确保跨设备可用）
      const res = await wx.cloud.callFunction({
        name: 'login',
        data: { avatarUrl: cloudFileID || localPath }
      })

      if (!res.result.success) throw new Error(res.result.error || '更新失败')

      // 更新本地数据（用持久化路径）
      const userInfo = { ...this.data.userInfo, avatarUrl: localPath }
      util.saveData('userInfo', userInfo)
      this.setData({ userInfo, avatarUrl: localPath })

      wx.showToast({ title: '头像已更新', icon: 'success' })
    } catch (err) {
      console.error('[my.js] 更新头像失败:', err)
      wx.showToast({ title: '更新失败', icon: 'none' })
    }
  },

  // 退出登录，但不清掉历史打卡等业务数据。
  onLogout() {
    this.hideSettingsModal()
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
            avatarUrl: '',
            hasNickname: false,
            hasAvatar: false,
            userInfo: {}
          })
          wx.showToast({ title: '已退出登录', icon: 'none' })
          this.loadCheckinStats()
        }
      }
    })
  },

  // 我的页快捷入口：收藏、我的发布、设置、分享等。
  onMenuTap(e) {
    const type = e.currentTarget.dataset.type
    
    if (type === 'favorites') {
      if (!this.data.isLoggedIn) {
        wx.showToast({ title: '请先登录', icon: 'none' })
        return
      }
      // 跳转到我的收藏页面
      wx.navigateTo({ url: '/subpackages/extra/pages/my-favorites/my-favorites' })
      return
    }
    
    if (type === 'guides') {
      // 跳转到我的攻略页面
      wx.navigateTo({ url: '/subpackages/guide/pages/my-guides/my-guides' })
      return
    }
    
    if (type === 'share') {
      wx.showToast({ title: '分享我们', icon: 'none' })
      return
    }
  },

  // 读取"想去 / 到访 / 自己添加的地点"等统计数据（同步读本地）。
  loadData() {
    // 未登录不显示用户数据
    if (!this.data.isLoggedIn) {
      this.setData({
        likedShops: [],
        visitedList: [],
        userAddedShops: [],
        stats: { likedCount: 0, visitedCount: 0, userAddedCount: 0 }
      })
      return
    }
    const userAddedShops = util.getUserShopsAsync()
    const allItems = [...placesData.getAllPlaces(), ...userAddedShops]
    const itemMap = {}
    allItems.forEach(item => {
      itemMap[String(item.id)] = item
    })

    // 新格式：userWantList 存储所有想去的 ID（美食+景点）
    const wantIds = util.getWantListAsync()
    const likedShops = wantIds
      .map(id => {
        // 先查 placesData（美食+景点）
        let place = placesData.getPlaceById(id)
        // 如果找不到，再查用户自己添加的店铺
        if (!place) {
          place = userAddedShops.find(s => String(s.id) === String(id))
        }
        return place
      })
      .filter(Boolean)  // 过滤掉找不到的数据（防护数据不一致）
      .map(item => ({
        ...item,
        // 确保有 type 字段（美食或景点）
        type: item.type || (item.category === '景点' || item.category === '公园' ? 'spot' : 'food')
      }))

    const footprintItems = util.getFootprintItemsAsync()
    const visitedList = footprintItems.map(item => ({
      shopId: item.id,
      shop: itemMap[String(item.id)] || item,
      data: {
        dateStr: item.checkedInAt
          ? new Date(item.checkedInAt).toLocaleDateString('zh-CN')
          : '已标记到访'
      }
    }))
    
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

  // 跳到采集本页面。
  onGoCollection() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/subpackages/extra/pages/collection/collection' })
  }

})
