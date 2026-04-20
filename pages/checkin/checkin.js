// pages/checkin/checkin.js
let checkinUtil = null
try {
  checkinUtil = require('../../utils/checkinUtil')
  console.log('[Checkin] checkinUtil 加载成功')
} catch (e) {
  console.error('[Checkin] checkinUtil 加载失败:', e)
}

Page({
  data: {
    type: 'food',      // 'food' 美食 | 'spot' 景点
    step: 1,           // 1:拍照 2:定位 3:预览 4:成功
    photoPath: '',
    spotName: '',       // 地点名称（逆地理编码POI名）
    address: '',        // 详细地址
    nearbyFood: '',     // 附近美食标签（图片右下角叠加层）
    latitude: null,
    longitude: null,
    description: '',    // AI 生成描述
    title: '',          // AI 生成的标题
    dateInfo: { mm: '', dd: '', yyyy: '' },
    locationLoading: false,
    generating: false,     // 整体生成中（按钮状态）
    generatingTitle: '',   // 标题打字效果
    generatingDesc: '',    // 描述打字效果
    saving: false,
    aiFailed: false,       // AI 生成失败，使用兜底
    editingName: false,    // 地点名内联编辑
    editingAddr: false,    // 地址内联编辑
    mapView: 'map',        // 地图/列表视图
    mapCenter: { latitude: 22.543, longitude: 114.057 },
    mapScale: 13,
    allMarkers: [],
    recentCheckins: []
  },

  onLoad(query) {
    this._updateDate()
    const type = query.type === 'spot' ? 'spot' : 'food'
    this.setData({ type })
  },

  // 更新日期信息
  _updateDate() {
    const d = new Date()
    this.setData({
      dateInfo: {
        mm: String(d.getMonth() + 1).padStart(2, '0'),
        dd: String(d.getDate()).padStart(2, '0'),
        yyyy: String(d.getFullYear())
      }
    })
  },

  // ── STEP 1：选照片 ──────────────────────────────
  onChoosePhoto() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const path = res.tempFilePaths[0]
        this.setData({ photoPath: path })
      },
      fail: (err) => {
        console.warn('chooseImage fail:', err)
        wx.showToast({ title: '请允许相册/相机权限', icon: 'none' })
      }
    })
  },

  onNextStep() {
    if (!this.data.photoPath) return
    this.setData({ step: 2 })
    // 进入第二步后自动定位
    this.onGetLocation()
  },

  onPrevStep() {
    const cur = this.data.step
    if (cur > 1) {
      this.setData({
        step: cur - 1,
        generating: false,
        generatingTitle: '',
        generatingDesc: ''
      })
    }
  },

  // ── STEP 2：定位 ──────────────────────────────
  onGetLocation() {
    if (this.data.locationLoading) return
    this.setData({ locationLoading: true, spotName: '', address: '' })

    console.log('[Checkin] onGetLocation 开始，checkinUtil:', !!checkinUtil)

    // 手动超时兜底：10秒后无论成功失败都进入下一步
    const timeoutTimer = setTimeout(() => {
      console.log('[Checkin] getLocation 超时，启用兜底方案')
      this.setData({ locationLoading: false })
      wx.showToast({ title: '定位超时，使用当前位置', icon: 'none' })
    }, 10000)

    const clearTimer = () => clearTimeout(timeoutTimer)

    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const { latitude, longitude } = res
        this.setData({ latitude, longitude })
        console.log('[Checkin] getLocation 成功:', latitude, longitude)
        if (!checkinUtil) {
          clearTimer()
          this.setData({ spotName: '当前位置', locationLoading: false })
          return
        }
        console.log('[Checkin] 开始调用 reverseGeocode')
        checkinUtil.reverseGeocode(latitude, longitude)
          .then((geo) => {
            clearTimer()
            const spotName = geo.spotName || geo.district || geo.city || '当前位置'
            const description = checkinUtil.generateDescription(spotName, geo.address, this.data.type)
            this.setData({
              spotName,
              address: geo.address || '',
              description,
              locationLoading: false
            })
          })
          .catch(() => {
            clearTimer()
            // 逆地理失败时，根据类型给合理的兜底店名/景点名
            const fallbackName = this.data.type === 'spot' ? '当前位置' : '当前位置'
            const desc = checkinUtil
              ? checkinUtil.generateDescription(fallbackName, '', this.data.type)
              : ''
            this.setData({
              spotName: fallbackName,
              description: desc,
              locationLoading: false
            })
          })
      },
      fail: (err) => {
        clearTimer()
        console.log('[Checkin] getLocation 失败:', err)
        this.setData({ locationLoading: false })
        // 模拟器/超时：直接用默认名称，不弹窗
        const isTimeout = err && (err.errMsg || '').includes('timeout')
        if (isTimeout) {
          wx.showToast({ title: '定位超时，使用当前位置', icon: 'none', duration: 1500 })
        } else {
          wx.showToast({ title: '无法获取位置，使用默认名称', icon: 'none', duration: 1500 })
        }
        // 自动设置兜底名称，让用户可以继续
        setTimeout(() => {
          if (!this.data.spotName) {
            this.setData({
              spotName: '当前位置',
              address: '',
              description: checkinUtil
                ? checkinUtil.generateDescription('当前位置', '', this.data.type)
                : ''
            })
          }
        }, 500)
      }
    })
  },

  // ── STEP 2→3：进入预览（调用混元 AI）──────────────
  onGenerate() {
    if (this.data.generating) return
    if (!this.data.spotName) {
      wx.showToast({ title: '无法获取位置，使用默认名称', icon: 'none' })
      this.setData({ spotName: '未知地点' })
    }
    this.setData({ generating: true, generatingTitle: '', generatingDesc: '', aiFailed: false })
    this._updateDate()

    // 进入第二步后自动加载地图数据
    this._loadMapData()
    // 调用混元 AI 云函数生成内容
    this._generateAIContent()
      .then(result => {
        if (result.success) {
          // 打字机效果展示 AI 内容
          this._typewriterEffect(result.title, result.description)
        } else {
          // AI 失败，启用兜底模板
          const fallback = this._getFallbackContent()
          this._typewriterEffect(fallback.title, fallback.description)
          this.setData({ aiFailed: true })
        }
      })
      .catch(() => {
        const fallback = this._getFallbackContent()
        this._typewriterEffect(fallback.title, fallback.description)
        this.setData({ aiFailed: true })
      })
  },

  // 调用混元 AI 生成打卡内容
  _generateAIContent() {
    return new Promise((resolve) => {
      // 获取城市信息（从 app.globalData）
      const app = getApp()
      const districtInfo = app.globalData.districtInfo || {}
      const city = districtInfo.city || '深圳市'
      const region = app.globalData.locationDesc || ''

      wx.cloud.callFunction({
        name: 'generateAICheckin',
        data: {
          spotName: this.data.spotName,
          address: this.data.address,
          type: this.data.type,
          city: city.replace('市', ''),
          region: region
        },
        success: (res) => {
          console.log('[Checkin] AI 生成结果:', res.result)
          if (res.result && res.result.success !== false) {
            resolve(res.result)
          } else {
            resolve({ success: false, ...res.result })
          }
        },
        fail: (err) => {
          console.error('[Checkin] AI 云函数调用失败:', err)
          // 网络错误时尝试直接调用混元（无需云函数）
          this._callHunyuanDirect().then(resolve).catch(() => resolve({ success: false }))
        }
      })
    })
  },

  // 直接调用混元（云函数不可用时的备选）
  _callHunyuanDirect() {
    return new Promise((resolve) => {
      if (!wx.cloud) {
        resolve({ success: false })
        return
      }
      try {
        const model = wx.cloud.extend.AI.createModel('hunyuan-exp')
        const spotName = this.data.spotName || '当前位置'
        const type = this.data.type === 'spot' ? '景点' : '美食'
        const prompt = `请为"${spotName}"这个${type}生成一段打卡文案，要求：
1. 标题15字以内，有记忆点
2. 正文60字以内，有画面感，像朋友发朋友圈一样自然
3. 格式：{"title":"标题","description":"正文"}
只返回JSON，不要其他内容。`

        model.generateText({
          model: 'hunyuan-2.0-instruct-20251111',
          messages: [{ role: 'user', content: prompt }]
        }).then(res => {
          const raw = res?.choices?.[0]?.message?.content || ''
          let clean = raw.trim().replace(/^```json\n?/, '').replace(/```$/, '').trim()
          const parsed = JSON.parse(clean)
          resolve({
            success: true,
            title: parsed.title || `${spotName}打卡`,
            description: parsed.description || ''
          })
        }).catch(() => resolve({ success: false }))
      } catch (e) {
        resolve({ success: false })
      }
    })
  },

  // 打字机效果展示 AI 内容
  _typewriterEffect(title, description) {
    let tIdx = 0
    let dIdx = 0
    const self = this

    function tick() {
      if (tIdx <= title.length) {
        self.setData({ generatingTitle: title.slice(0, tIdx) })
        tIdx++
        setTimeout(tick, 50)
      } else {
        // 标题打完，开始打描述
        setTimeout(() => {
          function tickDesc() {
            if (dIdx <= description.length) {
              self.setData({ generatingDesc: description.slice(0, dIdx) })
              dIdx++
              setTimeout(tickDesc, 30)
            } else {
              // 全部打完，正式设置内容并进入 step3
              self.setData({
                title: title,
                description: description,
                generating: false,
                generatingTitle: '',
                generatingDesc: '',
                step: 3
              })
            }
          }
          tickDesc()
        }, 200)
      }
    }
    tick()
  },

  // 获取兜底内容（AI 不可用时）
  _getFallbackContent() {
    const app = getApp()
    const city = (app.globalData.districtInfo?.city || '深圳').replace('市', '')
    const name = this.data.spotName || city + '某地'
    const type = this.data.type === 'spot' ? '景点' : '美食'

    const titles = {
      spot: ['🏛 城市漫游', '📍 发现角落', '🌿 安静时光', '✨ 值得一去'],
      food: ['🍽 觅食记录', '😋 吃到了！', '🌟 推荐打卡', '🥢 私藏小店']
    }
    const titleList = titles[this.data.type] || titles.food
    const aiTitle = titleList[Math.floor(Math.random() * titleList.length)]

    return {
      title: `${aiTitle}｜${name}`,
      description: checkinUtil
        ? checkinUtil.generateDescription(name, this.data.address, this.data.type)
        : `在${city}发现了${name}，记录一下这次美好的${type}体验~`
    }
  },

  // ── STEP 3：保存采集 ──────────────────────────
  onSaveCheckin() {
    if (this.data.saving) return
    this.setData({ saving: true })

    try {
      if (!checkinUtil) throw new Error('checkinUtil not loaded')
      checkinUtil.saveCheckin({
        photoPath: this.data.photoPath,
        spotName: this.data.spotName,
        address: this.data.address,
        latitude: this.data.latitude,
        longitude: this.data.longitude,
        description: this.data.description,
        type: this.data.type
      })
      setTimeout(() => {
        this.setData({ saving: false, step: 4 })
      }, 500)
    } catch (e) {
      this.setData({ saving: false })
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    }
  },

  // ── 内联编辑：地点名称 ──────────────────────────
  onToggleNameEdit() {
    this.setData({ editingName: !this.data.editingName })
  },

  // ── 内联编辑：详细地址 ──────────────────────────
  onToggleAddrEdit() {
    this.setData({ editingAddr: !this.data.editingAddr })
  },

  // ── 输入处理 ──────────────────────────────────
  onNameInput(e) {
    this.setData({ spotName: e.detail.value })
  },

  onAddrInput(e) {
    this.setData({ address: e.detail.value })
  },

  // ── 地图视图切换 ──────────────────────────────
  onSwitchView(e) {
    const view = e.currentTarget.dataset.view
    this.setData({ mapView: view })
    if (view === 'map') this._loadMapData()
  },

  _loadMapData() {
    try {
      const records = wx.getStorageSync('checkin_records') || []
      if (!records.length) return
      const latest = records[records.length - 1]
      const lat = latest.latitude || 22.543
      const lng = latest.longitude || 114.057
      this.setData({
        mapCenter: { latitude: lat, longitude: lng },
        mapScale: 13,
        allMarkers: records.filter(r => r.latitude && r.longitude).map(r => ({
          id: r.id,
          latitude: r.latitude,
          longitude: r.longitude,
          width: 32, height: 32,
          iconPath: r.type === 'spot'
            ? '/images/marker-spot.png'
            : '/images/marker-food.png'
        })),
        recentCheckins: records.slice(0, 10)
      })
    } catch (e) {}
  },

  // ── 重置 ──────────────────────────────────────
  onReset() {
    this.setData({
      step: 1,
      photoPath: '',
      spotName: '',
      address: '',
      latitude: null,
      longitude: null,
      description: '',
      title: '',
      generatingTitle: '',
      generatingDesc: '',
      aiFailed: false,
      editingName: false,
      editingAddr: false,
      nearbyFood: ''
    })
  },

  // ── 跳转 ──────────────────────────────────────
  onGoCollection() {
    wx.navigateTo({ url: '/pages/collection/collection' })
  },

  onBack() {
    wx.navigateBack()
  }
})
