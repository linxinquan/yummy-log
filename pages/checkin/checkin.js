// pages/checkin/checkin.js
let checkinUtil = null
try {
  checkinUtil = require('../../utils/checkinUtil')
  console.log('[Checkin] checkinUtil 加载成功')
} catch (e) {
  console.error('[Checkin] checkinUtil 加载失败:', e)
}

let recognizePhoto = null
try {
  recognizePhoto = require('../../utils/recognizePhoto')
  console.log('[Checkin] recognizePhoto 加载成功')
} catch (e) {
  console.error('[Checkin] recognizePhoto 加载失败:', e)
}

// 导入打字机效果工具
const { typewriterForCheckin } = require('../../utils/typewriter')

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
    recentCheckins: [],
    forceBase64: false     // 测试用：强制使用 base64（跳过云存储）
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
        // 递增请求版本号，使旧请求自动失效
        if (recognizePhoto && recognizePhoto._requestId !== undefined) {
          recognizePhoto._requestId++
          console.log('[Checkin] 新请求，递增版本号')
        }
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
      // 使用流式识别，实现打字机效果
      const result = await recognizePhoto.recognizePhoto(
        photoPath, 
        type, 
        (token, fullContent) => {
          // 实时更新 UI，展示打字机效果
          console.log('[Checkin] 收到 token:', token)
          console.log('[Checkin] 当前完整内容:', fullContent)

          // 尝试实时解析 JSON（可能不完整）
          try {
            const clean = fullContent.trim()
              .replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim()
            const parsed = JSON.parse(clean)
            // 实时更新识别结果
            if (parsed.name) {
              console.log('[Checkin] 图片识别实时更新...')
              this.setData({
                recognizeResult: parsed.name,
                recognizeDesc: parsed.desc || ''
              })
            }
          } catch (parseErr) {
            // JSON 还未完整，继续等待
            console.log('[Checkin] JSON 解析中...')
          }
        }, 
      )

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
    // step 2 已生成文案，直接跳到 step 3 预览
    if (this.data.step === 2 && this.data.title) {
      this.setData({ step: 3 })
      return
    }
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
    // 调用混元 AI 生成内容（前端直接调用）
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

  // 调用混元 AI 生成打卡内容（直接调用，不使用云函数）
  _generateAIContent() {
    return new Promise((resolve) => {
      if (!wx.cloud) {
        console.error('[Checkin] wx.cloud 不可用')
        resolve({ success: false })
        return
      }

      const app = getApp()
      const districtInfo = app.globalData.districtInfo || {}
      const city = (districtInfo.city || '深圳市').replace('市', '')
      const region = app.globalData.locationDesc || ''

      // 将图片识别结果一并传入，让文案更精准
      const recognizeResult = this.data.recognizeResult || ''
      const recognizeDesc = this.data.recognizeDesc || ''
      const spotName = this.data.spotName || '未知地点'
      const type = this.data.type === 'spot' ? '景点' : '美食'

      console.log('[Checkin] 开始生成 AI 文案，参数:', { spotName, type, recognizeResult, recognizeDesc })

      try {
        const model = wx.cloud.extend.AI.createModel('hunyuan-exp')

        // 如果有图片识别结果，融入 prompt 提升文案精准度
        const recognizePart = recognizeResult
          ? `\n【重要：图片识别结果】\n识别到的内容：${recognizeResult}${recognizeDesc ? `\n识别描述：${recognizeDesc}` : ''}\n请基于以上识别结果生成文案，标题或正文中必须体现识别到的具体事物。`
          : ''

        const systemPrompt = `你是「资深美食/生活记录者」，笔触精致而有温度。

        核心原则：
        - 写作风格：诗意、轻盈、带有淡淡的感叹感
        - 标题：10-14字，有记忆点，可用1个emoji点缀
        - 正文：严格控制在25-35字，诗意轻盈
        - 美食类：香气、鲜味、舌尖触感优先
        - 景点类：光影、时空感、城市肌理优先

        重要：如果提供了"图片识别结果"，你必须在文案中体现识别到的具体内容。

        禁止出现：
        ❌ 口语化表达（如"真的太好吃了"）
        ❌ "来到这里""打卡成功"等流水账开头`

                const userPrompt = `地点：${spotName}
        地址：${this.data.address || '未知'}
        城市：${city}
        类型：${type}${recognizePart}

        请严格按以下 JSON 格式返回（只返回 JSON，无其他内容）：
        {
          "title": "10-14字，有画面感，1个emoji",
          "description": "25-35字，诗意轻盈，结尾带感叹感"
        }`

        console.log('[Checkin] SystemPrompt:', systemPrompt)
        console.log('[Checkin] UserPrompt:', userPrompt)

        model.generateText({
          model: 'hunyuan-2.0-instruct-20251111',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.8,
          max_tokens: 300
        }).then(res => {
          console.log('[Checkin] AI 原始返回:', JSON.stringify(res))
          const raw = res?.choices?.[0]?.message?.content || ''
          console.log('[Checkin] AI 返回内容:', raw)
          try {
            const clean = raw.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
            const parsed = JSON.parse(clean)
            console.log('[Checkin] JSON 解析成功:', parsed)
            resolve({
              success: true,
              title: parsed.title || `${spotName}打卡`,
              description: parsed.description || ''
            })
          } catch (parseErr) {
            console.error('[Checkin] JSON 解析失败:', parseErr, '原始内容:', raw)
            resolve({ success: false })
          }
        }).catch((err) => {
          console.error('[Checkin] 模型调用失败:', err)
          resolve({ success: false })
        })
      } catch (e) {
        console.error('[Checkin] 初始化失败:', e)
        resolve({ success: false })
      }
    })
  },

  // 打字机效果展示 AI 内容（使用公共函数）
  _typewriterEffect(title, description) {
    // 停止之前的动画（如果有）
    if (this._typewriterControl) {
      this._typewriterControl.stop()
    }

    // 使用公共打字机函数，完成后跳转 step 3
    this._typewriterControl = typewriterForCheckin(this, title, description, {
      onComplete: () => {
        // this.setData({ step: 3 })
      }
    })
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
  },

})
