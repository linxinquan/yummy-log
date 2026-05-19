// 独立拍照页：用于从路线入口直接进入拍照，不再先显示“记录美食”页面。
Page({
  data: {
    type: 'food',
    menuTop: 44,
    menuHeight: 32
  },

  onLoad(query) {
    const windowInfo = wx.getWindowInfo()
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const menuTop = menuButtonInfo ? menuButtonInfo.top : (windowInfo.statusBarHeight || 44) + 4
    const menuHeight = menuButtonInfo ? menuButtonInfo.height : 32
    this.setData({
      type: query.type === 'spot' ? 'spot' : 'food',
      menuTop,
      menuHeight
    })
  },

  onReady() {
    // 页面渲染完成后创建相机上下文，后续拍照直接复用。
    this.cameraContext = wx.createCameraContext()
  },

  // 拍照成功后，把临时照片带到采集流程页继续识别和生成内容。
  onTakePhoto() {
    if (!this.cameraContext) return
    this.cameraContext.takePhoto({
      quality: 'high',
      success: (res) => {
        this.openCheckinFlow(res.tempImagePath)
      },
      fail: () => {
        wx.showToast({ title: '拍照失败，请重试', icon: 'none' })
      }
    })
  },

  // 从相册选择照片，后续仍然复用现有采集流程。
  onChooseAlbum() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: (res) => {
        const path = res.tempFilePaths && res.tempFilePaths[0]
        if (!path) return
        this.openCheckinFlow(path)
      },
      fail: (err) => {
        if (err && (err.errMsg || '').includes('cancel')) return
        wx.showToast({ title: '读取相册失败', icon: 'none' })
      }
    })
  },

  // 点击采集本，直接进入“我的采集本”详情页。
  onGoCollection() {
    wx.navigateTo({
      url: '/pages/collection/collection'
    })
  },

  // 相机异常时给用户明确提示。
  onCameraError() {
    wx.showToast({ title: '相机暂不可用，可改用相册上传', icon: 'none' })
  },

  // 关闭独立拍照页，直接回到上一页。
  onBack() {
    wx.navigateBack()
  },

  // 把临时照片交给采集流程页，并跳过“选照片”这一步。
  openCheckinFlow(photoPath) {
    const app = getApp()
    app.globalData.pendingCheckinPhoto = photoPath
    wx.redirectTo({
      url: `/pages/checkin/checkin?type=${this.data.type}&prefillPhoto=1&source=routeEntry`
    })
  }
})
