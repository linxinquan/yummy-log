/**
 * 打字机效果工具函数
 * 用于在页面上实现逐字显示的打字机动画效果
 */

/**
 * 创建打字机效果
 * @param {Object} options - 配置选项
 * @param {Object} options.page - 页面实例（this）
 * @param {string} options.title - 标题文本
 * @param {string} options.description - 描述文本
 * @param {number} options.titleSpeed - 标题打字速度（ms），默认 50
 * @param {number} options.descSpeed - 描述打字速度（ms），默认 30
 * @param {number} options.delayBetween - 标题和描述之间的延迟（ms），默认 200
 * @param {Function} options.onComplete - 完成回调
 * @returns {Object} 包含 stop 方法的对象，用于停止动画
 */
function createTypewriter(options) {
  const {
    page,
    title = '',
    description = '',
    titleSpeed = 50,
    descSpeed = 30,
    delayBetween = 200,
    onComplete = null
  } = options

  let tIdx = 0
  let dIdx = 0
  let stopped = false
  let titleTimer = null
  let descTimer = null
  let delayTimer = null

  // 打字标题
  function tickTitle() {
    if (stopped) return
    if (tIdx <= title.length) {
      page.setData({ generatingTitle: title.slice(0, tIdx) })
      tIdx++
      titleTimer = setTimeout(tickTitle, titleSpeed)
    } else {
      // 标题打完，延迟后开始打描述
      delayTimer = setTimeout(() => {
        if (!stopped) tickDesc()
      }, delayBetween)
    }
  }

  // 打字描述
  function tickDesc() {
    if (stopped) return
    if (dIdx <= description.length) {
      page.setData({ generatingDesc: description.slice(0, dIdx) })
      dIdx++
      descTimer = setTimeout(tickDesc, descSpeed)
    } else {
      // 全部打完
      if (onComplete && !stopped) {
        onComplete()
      }
    }
  }

  // 开始动画
  tickTitle()

  // 返回控制对象
  return {
    stop() {
      stopped = true
      if (titleTimer) clearTimeout(titleTimer)
      if (descTimer) clearTimeout(descTimer)
      if (delayTimer) clearTimeout(delayTimer)
    }
  }
}

/**
 * 默认的打字机效果
 * @param {Object} page - 页面实例
 * @param {string} title - 标题
 * @param {string} description - 描述
 * @param {Object} options - 可选配置
 * @param {Function} options.onComplete - 完成回调，接收 (title, description) 参数
 * @returns {Object} 包含 stop 方法的对象
 */
function typewriterForCheckin(page, title, description, options = {}) {
  const { onComplete } = options
  return createTypewriter({
    page,
    title,
    description,
    onComplete: () => {
      page.setData({
        title: title,
        description: description,
        generating: false,
        generatingTitle: '',
        generatingDesc: ''
      })
      // 由调用方决定后续逻辑（通过回调通知）
      if (onComplete) {
        onComplete(title, description)
      }
    }
  })
}

module.exports = {
  createTypewriter,
  typewriterForCheckin
}
