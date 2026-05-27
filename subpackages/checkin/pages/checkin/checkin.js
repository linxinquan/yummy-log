// pages/checkin/checkin.js
// 采集打卡页：重构为"拍照 -> 确认采集 -> 保存"的两步流程
let checkinUtil = null
try {
  checkinUtil = require('../../../../utils/checkinUtil')
} catch (e) {
  console.error('[Checkin] checkinUtil 加载失败:', e)
}

let recognizePhotoUtil = null
try {
  recognizePhotoUtil = require('../../utils/recognizePhoto')
} catch (e) {
  console.error('[Checkin] recognizePhotoUtil 加载失败:', e)
}

Page({
  data: {
    type: 'food',
    step: 1,
    photoPath: '',
    spotName: '',
    address: '',
    latitude: null,
    longitude: null,
    description: '',
    title: '',
    recordTimeISO: '',
    recordTimeLabel: '',
    typedRecordTime: '',
    typedAddress: '',
    typedDescription: '',
    recordTimeStatusText: '记录时间',
    addressStatusText: '已识别地址',
    descriptionStatusText: '打卡内容',
    recordTimeRunning: false,
    addressRunning: false,
    descriptionRunning: false,
    confirmLoading: false,
    saving: false,
    editSheetVisible: false,
    editAddress: '',
    editDescription: '',
    editLatitude: null,
    editLongitude: null,
    editGeneratingDescription: false,
    autoCamera: false,
    navTitle: '采集打卡'
  },

  onLoad(query) {
    const app = getApp()
    const pendingPhoto = query.prefillPhoto === '1'
      ? (app.globalData && app.globalData.pendingCheckinPhoto) || ''
      : ''

    if (app.globalData) {
      app.globalData.pendingCheckinPhoto = ''
    }

    // 记录这两个标记，分别处理"自动拉相机"和"带图直接进确认页"。
    this._pendingAutoCamera = query.autoCamera === '1'
    this._pendingAutoConfirm = Boolean(pendingPhoto)
    this._flowToken = 0
    this._timers = []

    // 这个页面现在只负责"确认采集"；
    // 如果没有照片，直接跳独立拍照页，不再展示中间页。
    if (!pendingPhoto) {
      wx.redirectTo({
        url: '/subpackages/checkin/pages/checkin-camera/checkin-camera',
        fail: () => {
          wx.navigateTo({
            url: '/subpackages/checkin/pages/checkin-camera/checkin-camera'
          })
        }
      })
      return
    }

    this.setData({
      autoCamera: query.autoCamera === '1',
      navTitle: '采集打卡',
      photoPath: pendingPhoto,
      step: pendingPhoto ? 2 : 1
    })
  },

  onShow() {
    // 从独立拍照页带图回来后，自动启动确认页生成流程。
    if (!this._pendingAutoConfirm || !this.data.photoPath) return
    this._pendingAutoConfirm = false
    setTimeout(() => {
      this._startConfirmFlow()
    }, 80)
  },

  onReady() {
    // 当前页已不再承担拍照入口，这里保留空实现避免后续生命周期误触发旧逻辑。
  },

  onUnload() {
    this._stopTyping()
  },

  // 选照片：拍完或选完图后，直接进入新的确认采集页。
  onChoosePhoto(e) {
    const dataset = (e && e.currentTarget && e.currentTarget.dataset) || {}
    const source = dataset.source || ''
    const isAutoTrigger = dataset.auto === '1'
    const sourceType = source === 'camera'
      ? ['camera']
      : source === 'album'
        ? ['album']
        : ['album', 'camera']

    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType,
      success: (res) => {
        const path = res.tempFilePaths[0]
        this.setData({ photoPath: path })
        this.onNextStep()
      },
      fail: (err) => {
        if (err && (err.errMsg || '').includes('cancel')) return
        if (isAutoTrigger) {
          wx.showToast({ title: '可以改用相册上传', icon: 'none' })
          return
        }
        wx.showToast({ title: '请允许相册或相机权限', icon: 'none' })
      }
    })
  },

  // 相册入口仍然复用同一套选图逻辑。
  onChooseAlbum() {
    this.onChoosePhoto({
      currentTarget: {
        dataset: {
          source: 'album'
        }
      }
    })
  },

  // 进入确认采集页后，自动开始识别地址和生成文案。
  onNextStep() {
    if (!this.data.photoPath) return
    this.setData({ step: 2 })
    this._startConfirmFlow()
  },

  // 重拍：回到拍照动作本身，而不是只回到上一步空白页。
  onRetake() {
    this._stopTyping()
    const app = getApp()
    if (app && app.globalData) {
      app.globalData.pendingCheckinPhoto = ''
    }

    wx.redirectTo({
      url: '/subpackages/checkin/pages/checkin-camera/checkin-camera',
      fail: () => {
        wx.navigateTo({
          url: '/subpackages/checkin/pages/checkin-camera/checkin-camera'
        })
      }
    })
  },

  // 编辑按钮改为打开底部弹窗，在弹窗里统一修改三项内容。
  onOpenEditSheet() {
    if (this.data.confirmLoading) {
      wx.showToast({
        title: '内容生成中，请稍候',
        icon: 'none'
      })
      return
    }

    this.setData({
      editSheetVisible: true,
      editAddress: this.data.address,
      editDescription: this.data.description,
      editLatitude: this.data.latitude,
      editLongitude: this.data.longitude,
      editGeneratingDescription: false
    })
  },

  onCloseEditSheet() {
    this.setData({
      editSheetVisible: false
    })
  },

  preventBubble() {},

  onEditAddressInput(e) {
    this.setData({
      editAddress: e.detail.value
    })
  },

  onEditDescriptionInput(e) {
    this.setData({
      editDescription: e.detail.value
    })
  },

  // 编辑弹窗里的 AI 生成：只重写打卡内容，不改地址。
  async onGenerateEditDescription() {
    if (this.data.editGeneratingDescription) return

    this.setData({
      editGeneratingDescription: true
    })

    const address = this.data.editAddress || this.data.address || ''
    const spotName = this.data.spotName || '当前位置'
    const aiResult = await this._generateAIContent()
    const fallback = this._getFallbackContent(spotName, address)
    const nextDescription = aiResult.success
      ? (aiResult.description || fallback.description)
      : fallback.description
    console.log('aiResult', aiResult.type)

    this.setData({
      editDescription: nextDescription,
      editGeneratingDescription: false
    })
  },

  onPickEditLocation() {
    wx.chooseLocation({
      success: (res) => {
        const nextAddress = res.address || res.name || ''
        this.setData({
          editAddress: nextAddress,
          editLatitude: res.latitude || null,
          editLongitude: res.longitude || null
        })
      }
    })
  },

  onConfirmEditSheet() {
    this.setData({
      address: this.data.editAddress,
      description: this.data.editDescription,
      typedAddress: this.data.editAddress,
      typedDescription: this.data.editDescription,
      latitude: this.data.editLatitude,
      longitude: this.data.editLongitude,
      editSheetVisible: false
    })
  },

  onAddrInput(e) {
    const value = e.detail.value
    this.setData({
      address: value,
      typedAddress: value
    })
  },

  onDescInput(e) {
    const value = e.detail.value
    this.setData({
      description: value,
      typedDescription: value
    })
  },

  // 重新生成只重跑打卡内容，不影响已生成的时间和地址。
  async onRegenerateDescription() {
    if (this.data.confirmLoading) return
    if (!this.data.spotName && !this.data.address) {
      wx.showToast({
        title: '请先等待地址识别完成',
        icon: 'none'
      })
      return
    }

    this._clearTimers()
    const token = ++this._flowToken
    this.setData({
      confirmLoading: true,
      editSheetVisible: false,
      descriptionStatusText: '正在生成打卡内容',
      descriptionRunning: true,
      typedDescription: '',
      description: ''
    })

    const aiResult = await this._generateAIContent()
    if (token !== this._flowToken) return

    const fallback = this._getFallbackContent(
      this.data.spotName || '当前位置',
      this.data.address || ''
    )
    const finalTitle = aiResult.success ? (aiResult.title || this.data.spotName || '当前位置') : fallback.title
    const finalDescription = aiResult.success ? (aiResult.description || fallback.description) : fallback.description

    this.setData({
      title: finalTitle,
      description: finalDescription
    })

    await this._typeToField('typedDescription', finalDescription, 24, token)
    if (token !== this._flowToken) return

    this.setData({
      confirmLoading: false,
      descriptionStatusText: '打卡内容',
      descriptionRunning: false
    })
  },

  // 新确认页的自动流程：时间 -> 地址 -> 打卡内容，三段都做打字机显示。
  async _startConfirmFlow() {
    const token = ++this._flowToken
    this._clearTimers()

    const nowISO = new Date().toISOString()
    const nowLabel = this._formatRecordTime(nowISO)
    this.setData({
      confirmLoading: true,
      saving: false,
      editSheetVisible: false,
      editGeneratingDescription: false,
      spotName: '',
      address: '',
      description: '',
      title: '',
      recordTimeISO: nowISO,
      recordTimeLabel: nowLabel,
      typedRecordTime: '',
      typedAddress: '',
      typedDescription: '',
      recordTimeStatusText: '正在记录时间',
      addressStatusText: '正在识别地址',
      descriptionStatusText: '正在生成打卡内容',
      recordTimeRunning: true,
      addressRunning: false,
      descriptionRunning: false
    })

    await this._typeToField('typedRecordTime', nowLabel, 36, token)
    if (token !== this._flowToken) return

    this.setData({
      recordTimeStatusText: '已记录时间',
      recordTimeRunning: false,
      addressRunning: true
    })

    const locationResult = await this._resolveLocation()
    if (token !== this._flowToken) return

    const spotName = locationResult.spotName || '当前位置'
    const address = locationResult.address || '暂未识别到地址'
    this.setData({
      spotName,
      address,
      latitude: locationResult.latitude,
      longitude: locationResult.longitude
    })

    await this._typeToField('typedAddress', address, 30, token)
    if (token !== this._flowToken) return

    this.setData({
      addressStatusText: '已识别地址',
      addressRunning: false,
      descriptionRunning: true
    })

    const aiResult = await this._generateAIContent()
    if (token !== this._flowToken) return

    const fallback = this._getFallbackContent(spotName, address)
    const finalTitle = aiResult.success ? (aiResult.title || spotName) : fallback.title
    const finalDescription = aiResult.success ? (aiResult.description || fallback.description) : fallback.description
    console.log('aiResult', aiResult.type)
    this.setData({
      title: finalTitle,
      description: finalDescription
    })

    await this._typeToField('typedDescription', finalDescription, 24, token)
    if (token !== this._flowToken) return

    this.setData({
      confirmLoading: false,
      descriptionStatusText: '打卡内容',
      descriptionRunning: false
    })
  },

  // 定位和逆地理识别统一收口成 Promise，方便自动流程顺序执行。
  _resolveLocation() {
    return new Promise((resolve) => {
      let finished = false
      const finish = (payload) => {
        if (finished) return
        finished = true
        clearTimeout(timeoutTimer)
        resolve(payload)
      }

      // 获取 app 实例，用于读取全局位置描述
      const app = getApp()

      // 构建 fallback 的 spotName：优先用全局 locationDesc，其次用 district，最后用"当前位置"
      const getFallbackSpotName = () => {
        const globalData = app.globalData || {}
        return (globalData.locationDesc || (globalData.districtInfo && globalData.districtInfo.district) || '当前位置')
      }

      const timeoutTimer = setTimeout(() => {
        finish({
          spotName: getFallbackSpotName(),
          address: '',
          latitude: this.data.latitude,
          longitude: this.data.longitude
        })
      }, 10000)

      wx.getLocation({
        type: 'gcj02',
        success: (res) => {
          const { latitude, longitude } = res
          if (!checkinUtil) {
            finish({
              spotName: getFallbackSpotName(),
              address: '',
              latitude,
              longitude
            })
            return
          }

          checkinUtil.reverseGeocode(latitude, longitude)
            .then((geo) => {
              finish({
                spotName: geo.spotName || geo.district || geo.city || '当前位置',
                address: geo.address || '',
                latitude,
                longitude
              })
            })
            .catch(() => {
              finish({
                spotName: getFallbackSpotName(),
                address: '',
                latitude,
                longitude
              })
            })
        },
        fail: () => {
          finish({
            spotName: getFallbackSpotName(),
            address: '',
            latitude: this.data.latitude,
            longitude: this.data.longitude
          })
        }
      })
    })
  },

  // 调用 AI 生成打卡内容，使用公共函数 generateAIContent
  _generateAIContent() {
    return new Promise((resolve) => {
      if (!recognizePhotoUtil || !recognizePhotoUtil.generateAIContent) {
        console.warn('[Checkin] recognizePhotoUtil 不可用')
        resolve({ success: false })
        return
      }

      recognizePhotoUtil.generateAIContent(this.data.photoPath)
        .then(result => {
          // TODO: 用AI识别type
          resolve(result) // result: {success, title, description,}
        })
        .catch(err => {
          console.error('[Checkin] generateAIContent 失败:', err)
          resolve({ success: false })
        })
    })
  },

  // 本地兜底内容：保证在 AI 异常时确认页也能继续保存。

  _getFallbackContent(spotName, address) {
    return {
      title: spotName || '当前位置',
      description: checkinUtil
        ? checkinUtil.generateDescription(spotName || '当前位置', address || '')
        : '记录下这一刻，下次再看仍然会想起当时的心情'
    }
  },

  // 打字机效果：逐字更新某个字段，用于时间、地址和打卡内容三段文案。
  _typeToField(field, text, speed, token) {
    return new Promise((resolve) => {
      const finalText = text || ''
      let index = 0

      const tick = () => {
        if (token !== this._flowToken) {
          resolve(false)
          return
        }

        this.setData({
          [field]: finalText.slice(0, index)
        })

        if (index >= finalText.length) {
          resolve(true)
          return
        }

        index += 1
        const timer = setTimeout(tick, speed)
        this._timers.push(timer)
      }

      tick()
    })
  },

  // 停止旧的打字和旧流程，避免重拍或离开页面后还在继续写入。
  _stopTyping() {
    this._flowToken += 1
    this._clearTimers()
  },

  _clearTimers() {
    ;(this._timers || []).forEach(timer => clearTimeout(timer))
    this._timers = []
  },

  // 显示用时间格式：和详情页统一。
  _formatRecordTime(isoString) {
    const date = new Date(isoString)
    const yyyy = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hh = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    const second = String(date.getSeconds()).padStart(2, '0')
    return `${yyyy}年${month}月${day}日 ${hh}:${minute}:${second}`
  },

  // 把用户编辑后的时间文案尽量转回可存储时间，不合法时退回原始时间。
  _parseRecordTime(label) {
    const match = String(label || '').match(/^(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/)
    if (!match) return this.data.recordTimeISO || new Date().toISOString()

    const [, year, month, day, hour, minute, second] = match
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    )

    if (Number.isNaN(date.getTime())) {
      return this.data.recordTimeISO || new Date().toISOString()
    }

    return date.toISOString()
  },

  // 保存采集：不再进入成功页，直接完成并跳去采集本。
  onSaveCheckin() {
    if (this.data.saving) return
    if (this.data.confirmLoading) {
      wx.showToast({
        title: '内容生成中，请稍候',
        icon: 'none'
      })
      return
    }

    this.setData({ saving: true })

    try {
      if (!checkinUtil) throw new Error('checkinUtil not loaded')

      checkinUtil.saveCheckin({
        photoPath: this.data.photoPath,
        spotName: this.data.spotName || '当前位置',
        address: this.data.address || '',
        latitude: this.data.latitude,
        longitude: this.data.longitude,
        description: this.data.description || this.data.typedDescription,
        type: this.data.type,
        date: this._parseRecordTime(this.data.recordTimeLabel),
        customRecordTimeLabel: this.data.recordTimeLabel
      })

      wx.showToast({
        title: '已保存采集',
        icon: 'success'
      })

      setTimeout(() => {
        wx.redirectTo({
          url: '/subpackages/extra/pages/collection/collection',
          fail: () => {
            wx.navigateTo({
              url: '/subpackages/extra/pages/collection/collection'
            })
          }
        })
      }, 360)
    } catch (e) {
      this.setData({ saving: false })
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      })
      return
    }
  },

  onPreviewPhoto() {
    const { photoPath } = this.data
    if (!photoPath) return
    wx.previewImage({
      urls: [photoPath],
      current: photoPath
    })
  },

  onGoCollection() {
    wx.navigateTo({ url: '/subpackages/extra/pages/collection/collection' })
  }
})
