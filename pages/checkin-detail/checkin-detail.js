// pages/checkin-detail/checkin-detail.js
// 采集详情页：承接“我的采集”里的邮票点击，只在这里展示时间和完整信息
let checkinUtil = null
try {
  checkinUtil = require('../../utils/checkinUtil')
} catch (e) {
  console.warn('checkinUtil load fail', e)
}

Page({
  data: {
    detail: null,
    currentId: '',
    editSheetVisible: false,
    editAddress: '',
    editDescription: '',
    editLatitude: null,
    editLongitude: null,
    editGeneratingDescription: false
  },

  onLoad(options) {
    this.setData({
      currentId: options.id || ''
    })
    this.loadDetail(options.id || '')
  },

  loadDetail(id) {
    if (!checkinUtil || !id) return
    const checkins = checkinUtil.getCheckins()
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
        recordTimeLabel: detail.customRecordTimeLabel || `${yyyy}年${month}月${day}日 ${hh}:${minute}:${second}`
      }
    })
  },

  onPreviewPhoto() {
    const { detail } = this.data
    if (!detail || !detail.photoPath) return
    wx.previewImage({
      urls: [detail.photoPath],
      current: detail.photoPath
    })
  },

  // 裁剪按钮先保留交互入口，后续接入真实编辑能力。
  onCrop() {
    wx.showToast({
      title: '裁剪功能待接入',
      icon: 'none'
    })
  },

  // 详情页编辑也统一改为底部弹窗编辑。
  onOpenEditSheet() {
    const { detail } = this.data
    if (!detail) return
    this.setData({
      editSheetVisible: true,
      editAddress: detail.address || '',
      editDescription: detail.description || '',
      editLatitude: detail.latitude || null,
      editLongitude: detail.longitude || null,
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

  // 详情编辑弹窗也支持一键重新生成打卡内容。
  async onGenerateEditDescription() {
    if (this.data.editGeneratingDescription) return

    const detail = this.data.detail || {}
    const spotName = detail.spotName || '当前位置'
    const address = this.data.editAddress || detail.address || ''
    this.setData({
      editGeneratingDescription: true
    })

    const aiResult = await this._generateAIContent({
      spotName,
      address,
      type: detail.type || 'food'
    })
    const fallback = checkinUtil
      ? checkinUtil.generateDescription(spotName, address, detail.type || 'food')
      : '记录下这一刻，下次再看仍然会想起当时的心情'

    this.setData({
      editDescription: aiResult.success ? (aiResult.description || fallback) : fallback,
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
    const { currentId, detail, editAddress, editDescription, editLatitude, editLongitude } = this.data
    if (!checkinUtil || !detail || !currentId) return

    const updated = checkinUtil.updateCheckin(currentId, {
      address: editAddress,
      description: editDescription,
      latitude: editLatitude,
      longitude: editLongitude
    })

    if (!updated) {
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      })
      return
    }

    this.setData({
      editSheetVisible: false,
      detail: {
        ...updated,
        recordTimeLabel: detail.recordTimeLabel
      }
    })
  },

  // 详情页的 AI 生成保持和确认页同一套调用路径，失败时退回本地文案。
  _generateAIContent({ spotName, address, type }) {
    return new Promise((resolve) => {
      const app = getApp()
      const districtInfo = app.globalData.districtInfo || {}
      const city = districtInfo.city || '深圳市'
      const region = app.globalData.locationDesc || ''

      wx.cloud.callFunction({
        name: 'generateAICheckin',
        data: {
          spotName,
          address,
          type,
          city: city.replace('市', ''),
          region
        },
        success: (res) => {
          if (res.result && res.result.success !== false) {
            resolve(res.result)
            return
          }
          resolve({ success: false })
        },
        fail: () => resolve({ success: false })
      })
    })
  },

  // 自定义分享内容，让详情页可以直接分享当前采集。
  onShareAppMessage() {
    const { detail, currentId } = this.data
    return {
      title: detail && detail.spotName ? detail.spotName : '查看采集详情',
      path: `/pages/checkin-detail/checkin-detail?id=${encodeURIComponent(currentId || '')}`
    }
  }
})
