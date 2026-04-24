// pages/checkin/checkin.js
let checkinUtil = null
try {
  checkinUtil = require('../../utils/checkinUtil')
  console.log('[Checkin] checkinUtil 加载成功')
} catch (e) {
  console.error('[Checkin] checkinUtil 加载失败:', e)
}

let recognizeFood = null
try {
  recognizeFood = require('../../utils/recognizeFood')
  console.log('[Checkin] recognizeFood 加载成功')
} catch (e) {
  console.error('[Checkin] recognizeFood 加载失败:', e)
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
    recognizing: false,    // 图片识别中
    recognizeResult: '',   // 识别到的物体/地标名称
    recognizeDesc: '',     // 识别生成的一句描述
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
        this.setData({ photoPath: path, recognizeResult: '', recognizeDesc: '' })
        // 选完照片后立即触发识别，不等用户手动操作
        this._recognizePhoto(path)
      },
      fail: (err) => {
        console.warn('chooseImage fail:', err)
        wx.showToast({ title: '请允许相册/相机权限', icon: 'none' })
      }
    })
  },

  // ── 图片识别 ─────────────────────────────────────
  async _recognizePhoto(photoPath) {
    if (!photoPath) return
    this.setData({ recognizing: true, recognizeResult: '', recognizeDesc: '' })

    const type = this.data.type

    try {
      const result = await recognizeFood.recognizePhoto(photoPath, type)

      if (result.name) {
        this.setData({ recognizing: false, recognizeResult: result.name, recognizeDesc: result.desc })
        if (type === 'food' && !this.data.spotName) {
          this.setData({ spotName: result.name })
        }
      } else {
        this.setData({ recognizing: false })
        wx.showToast({ title: '未能识别图片内容，请手动输入', icon: 'none', duration: 2000 })
      }
    } catch (err) {
      console.error('[Checkin] AI 识别失败:', err)
      this.setData({ recognizing: false })
      wx.showToast({ title: 'AI 识别失败: ' + (err.message || err), icon: 'none', duration: 3000 })
    }
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

    // 手动超时兜底：12秒后无论成功失败都进入下一步
    const timeoutTimer = setTimeout(() => {
      console.log('[Checkin] getLocation 超时，启用兜底方案')
      this.setData({ locationLoading: false })
      wx.showToast({ title: '定位超时，可手动选择位置', icon: 'none' })
    }, 12000)
    const clearTimer = () => clearTimeout(timeoutTimer)

    // ── 第一层：检查权限状态 ──
    wx.getSetting({
      success: (settingRes) => {
        const authSetting = settingRes.authSetting || {}
        console.log('[Checkin] 权限状态:', authSetting)

        // 曾经被拒绝过 → 直接引导用户去设置
        if (authSetting['scope.userLocation'] === false) {
          clearTimer()
          this.setData({ locationLoading: false })
          wx.showModal({
            title: '位置权限被关闭',
            content: '请在「右上角 → 设置」中开启位置权限，才能正常使用打卡定位。',
            confirmText: '去设置',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.openSetting({
                  success: (openRes) => {
                    // 用户从设置页返回后，重新尝试定位
                    if (openRes.authSetting['scope.userLocation']) {
                      this._doAutoLocation(clearTimer)
                    } else {
                      // 仍然拒绝 → 引导手动选位置
                      this._fallbackToChooseLocation()
                    }
                  }
                })
              } else {
                // 取消 → 手动选位置
                this._fallbackToChooseLocation()
              }
            }
          })
          return
        }

        // 尚未决定或已授权 → 尝试自动定位
        this._doAutoLocation(clearTimer)
      },
      fail: () => {
        // getSetting 本身失败，直接尝试自动定位
        this._doAutoLocation(clearTimer)
      }
    })
  },

  // ── 自动定位（调用 wx.getLocation + 逆地理）──
  _doAutoLocation(clearTimer) {
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
        checkinUtil.reverseGeocode(latitude, longitude, this.data.type)
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
            const fallbackName = '当前位置'
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
        const errMsg = err && (err.errMsg || '')
        // auth deny 或明确拒绝 → 引导去设置
        if (errMsg.includes('auth deny') || errMsg.includes('auth refuse')) {
          wx.showModal({
            title: '需要位置权限',
            content: '请允许位置权限，以便记录打卡地点。',
            confirmText: '去设置',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.openSetting({
                  success: (openRes) => {
                    if (openRes.authSetting['scope.userLocation']) {
                      this._doAutoLocation(() => {})
                    } else {
                      this._fallbackToChooseLocation()
                    }
                  }
                })
              } else {
                this._fallbackToChooseLocation()
              }
            }
          })
        } else {
          // 其他错误（超时、系统错误等）→ 自动引导手动选位置
          this._fallbackToChooseLocation()
        }
      }
    })
  },

  // ── 手动选位置兜底（chooseLocation）──
  _fallbackToChooseLocation() {
    wx.showToast({ title: '请手动选择位置', icon: 'none', duration: 1500 })
    setTimeout(() => {
      wx.chooseLocation({
        success: (res) => {
          console.log('[Checkin] chooseLocation 成功:', res)
          const { name, address, latitude, longitude } = res
          if (!name || !latitude) {
            wx.showToast({ title: '未选择位置', icon: 'none' })
            return
          }
          const spotName = (name && name !== '我的位置') ? name : address || '已选位置'
          const description = checkinUtil
            ? checkinUtil.generateDescription(spotName, address, this.data.type)
            : ''
          this.setData({
            latitude,
            longitude,
            spotName,
            address: address || '',
            description,
            locationLoading: false
          })
        },
        fail: (err) => {
          console.log('[Checkin] chooseLocation 取消/失败:', err)
          // 用户取消选择 → 允许继续，用模糊名称
          this.setData({
            spotName: '当前位置',
            address: '',
            description: checkinUtil
              ? checkinUtil.generateDescription('当前位置', '', this.data.type)
              : '',
            locationLoading: false
          })
        }
      })
    }, 600)
  },

  // ── 手动定位入口（UI按钮触发）──
  onManualLocation() {
    this._fallbackToChooseLocation()
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
      const app = getApp()
      const districtInfo = app.globalData.districtInfo || {}
      const city = districtInfo.city || '深圳市'
      const region = app.globalData.locationDesc || ''

      // 将图片识别结果一并传入，让文案更精准
      const recognizeResult = this.data.recognizeResult || ''
      const recognizeDesc = this.data.recognizeDesc || ''
      console.log('recognizeResult', recognizeResult)
      wx.cloud.callFunction({
        name: 'generateAICheckin',
        data: {
          spotName: this.data.spotName,
          address: this.data.address,
          type: this.data.type,
          city: city.replace('市', ''),
          region: region,
          recognizeResult,   // 图片识别到的物体名称
          recognizeDesc      // 图片识别生成的描述
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
        // 识别结果融入 prompt
        const recognizePart = this.data.recognizeResult
          ? `，图片中识别到的是"${this.data.recognizeResult}"`
          : ''
        const prompt = `请为"${spotName}"这个${type}生成打卡文案${recognizePart}，要求：
1. 标题10-14字，有记忆点，带 emoji
2. 正文25-35字，诗意温暖，避免口语化
3. 格式：{"title":"标题","description":"正文"}
只返回JSON，不要其他内容。`

        model.generateText({
          model: 'hunyuan-2.0-instruct-20251111',
          messages: [{ role: 'user', content: prompt }]
        }).then(res => {
          const raw = res?.choices?.[0]?.message?.content || ''
          const clean = raw.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
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
      nearbyFood: '',
      recognizing: false,
      recognizeResult: '',
      recognizeDesc: ''
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
