// 统一处理“封面角标显示什么大类”
// 这样探索、想去、收藏等页面就不会各写各的规则。
function resolveDisplayCategory(item = {}) {
  const type = String(item.type || '').toLowerCase()
  const category = String(item.category || '')

  // 先判断特殊大类，再判断普通景点，最后默认归到美食。
  if (type === 'culture' || /展馆|博物馆|美术馆|音乐厅/.test(category)) return '文化展馆'
  if (type === 'outdoor' || /自然户外|公园|山|徒步|滨海|水库/.test(category)) return '自然户外'
  if (type === 'shopping' || /购物|商场|广场|老街/.test(category)) return '购物'
  if (type === 'hotel' || /酒店|民宿/.test(category)) return '酒店'
  if (type === 'spot') return '景点'
  return '美食'
}

module.exports = {
  resolveDisplayCategory
}
