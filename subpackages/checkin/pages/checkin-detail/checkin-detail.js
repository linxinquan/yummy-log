// pages/checkin-detail/checkin-detail.js
// 采集详情页：承接"我的采集"里的邮票点击，只在这里展示时间和完整信息
let checkinUtil = null
try {
  checkinUtil = require('../../../../utils/checkinUtil')
} catch (e) {
  console.warn('checkinUtil load fail', e)
}

let recognizePhotoUtil = null
try {
  recognizePhotoUtil = require('../../utils/recognizePhoto')
} catch (e) {
  console.warn('recognizePhotoUtil load fail', e)
}

let photoStorage = null
try {
  photoStorage = require('../../utils/photoStorage')
} catch (e) {
  console.warn('photoStorage load fail', e)
}

Page({
  data: {
    detail: null,
    currentId: '',
    editSheetVisible: false,
    editSheetData: {
      spotName: '',
      address: '',
      description: '',
      latitude: null,
      longitude: null
    },
    actionSheetVisible: false,
    // 删除确认也统一走自定义底部弹窗。
    deleteConfirmVisible: false,
  },

  onLoad(options) {
    this.setData({
      currentId: options.id || ''
    })
    this.loadDetail(options.id || '')
  },

  async loadDetail(id) {
    if (!checkinUtil || !id) return
    const checkins = await checkinUtil.getCheckinsAsync()
    const detail = checkins.find(item => String(item.id) === String(id))
    if (!detail) {
      wx.showToast({
        title: '未找到采集内容',
        icon: 'none'
      })
      return
    }

    const date = new Date(detail.date)
    const yyyy = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hh = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    const second = String(date.getSeconds()).padStart(2, '0')

    // 详情页只展示用户需要的基础信息，去掉采集类型等冗余字段。
    this.setData({
      detail: {
        ...detail,
        displayPath: photoStorage ? photoStorage.getDisplayPath(detail) : (detail.photoPath || ''),
        recordTimeLabel: detail.customRecordTimeLabel || `${yyyy}年${month}月${day}日 ${hh}:${minute}:${second}`
      }
    })
  },

  onPreviewPhoto() {
    const { detail } = this.data
    if (!detail || !detail.photoPath) return
    const previewPath = (photoStorage ? photoStorage.getDisplayPath(detail) : detail.photoPath) || detail.photoPath
    wx.previewImage({
      urls: [previewPath],
      current: previewPath
    })
  },

  // 裁剪按钮先保留交互入口，后续接入真实编辑能力。
  onCrop() {
    wx.showToast({
      title: '裁剪功能待接入',
      icon: 'none'
    })
  },

  // 详情页编辑：打开底部弹窗组件
  onOpenEditSheet() {
    const { detail } = this.data
    if (!detail) return
    this.setData({
      editSheetVisible: true,
      editSheetData: {
        spotName: detail.spotName || '',
        address: detail.address || '',
        description: detail.description || '',
        latitude: detail.latitude || null,
        longitude: detail.longitude || null
      },
      actionSheetVisible: false
    })
  },

  onOpenActionSheet() {
    this.setData({
      actionSheetVisible: true,
      editSheetVisible: false
    })
  },

  onCloseActionSheet() {
    this.setData({
      actionSheetVisible: false
    })
  },

  // 关闭删除确认弹窗。
  onCloseDeleteConfirm() {
    this.setData({
      deleteConfirmVisible: false
    })
  },

  onDeleteCheckin() {
    const { currentId } = this.data
    if (!checkinUtil || !currentId) return

    // 关闭动作面板，改成展示自定义删除确认层。
    this.setData({
      actionSheetVisible: false,
      editNameSheetVisible: false,
      deleteConfirmVisible: true
    })
  },

  // 用户确认后，再真正执行删除。
  async onConfirmDeleteCheckin() {
    const { currentId } = this.data
    if (!checkinUtil || !currentId) return

    this.setData({
      deleteConfirmVisible: false
    })
    await checkinUtil.deleteCheckinAsync(currentId)
    wx.navigateBack()
  },

  onCloseEditSheet() {
    this.setData({ editSheetVisible: false })
  },

  preventBubble() {},

  // 组件确认事件：保存编辑到数据库
  async onConfirmEditSheet(e) {
    const { currentId, detail } = this.data
    if (!checkinUtil || !detail || !currentId) return
    const { spotName, address, description, latitude, longitude } = e.detail

    const updated = await checkinUtil.updateCheckinAsync(currentId, {
      spotName,
      address,
      description,
      latitude,
      longitude
    })

    if (!updated) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
      return
    }

    this.setData({
      editSheetVisible: false,
      detail: { ...updated, recordTimeLabel: detail.recordTimeLabel }
    })
  },

  // 组件触发 AI 生成打卡名称
  async onEditGenerateSpotName() {
    const detail = this.data.detail || {}
    const aiResult = await this._generateAIContent(detail.photoPath, detail.type || 'food')
    const name = aiResult.success ? (aiResult.title || detail.spotName || '当前位置') : (detail.spotName || '当前位置')
    const sheet = this.selectComponent('#editSheet')
    if (sheet) sheet.onAISpotNameResult(name)
  },

  // 组件触发 AI 生成打卡内容
  async onEditGenerateDescription() {
    const detail = this.data.detail || {}
    const spotName = detail.spotName || '当前位置'
    const address = detail.address || ''
    const aiResult = await this._generateAIContent(detail.photoPath, detail.type || 'food')
    const fallback = checkinUtil
      ? checkinUtil.generateDescription(spotName, address, detail.type || 'food')
      : '记录下这一刻，下次再看仍然会想起当时的心情'
    const desc = aiResult.success ? (aiResult.description || fallback) : fallback
    const sheet = this.selectComponent('#editSheet')
    if (sheet) sheet.onAIDescriptionResult(desc)
  },

  // 详情页的 AI 生成使用公共函数 generateAIContent
  _generateAIContent(photoPath, type) {
    return new Promise((resolve) => {
      if (!recognizePhotoUtil || !recognizePhotoUtil.generateAIContent) {
        console.warn('[CheckinDetail] recognizePhotoUtil 不可用')
        resolve({ success: false })
        return
      }

      recognizePhotoUtil.generateAIContent(photoPath, type)
        .then(result => {
          resolve(result) // result: {success, title, description}
        })
        .catch(err => {
          console.error('[CheckinDetail] generateAIContent 失败:', err)
          resolve({ success: false })
        })
    })
  },

  // 自定义分享内容，让详情页可以直接分享当前采集。
  onShareAppMessage() {
    const { detail, currentId } = this.data
    return {
      title: detail && detail.spotName ? detail.spotName : '查看采集详情',
      path: `/subpackages/checkin/pages/checkin-detail/checkin-detail?id=${encodeURIComponent(currentId || '')}`
    }
  }
})
