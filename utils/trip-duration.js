// 统一生成“几天几晚”的文案：
// 1 天只显示“1 天”，从 2 天开始显示“2 天 1 晚”“3 天 2 晚”。
function formatTripDuration(dayCount) {
  const safeDayCount = Math.max(1, parseInt(dayCount, 10) || 1)
  if (safeDayCount <= 1) return '1 天'
  return `${safeDayCount} 天 ${safeDayCount - 1} 晚`
}

// 统一生成“几天几晚 + 地点数”的摘要文案。
function formatTripSummary(dayCount, placeCount) {
  const safePlaceCount = Math.max(0, parseInt(placeCount, 10) || 0)
  return `${formatTripDuration(dayCount)} · ${safePlaceCount} 个地点`
}

// 把现有的旅行时间文案统一成新规则：
// 例如旧数据里的“2天”或“2天1晚”都会统一转成“2 天 1 晚”，而“半天”会原样保留。
function normalizeTripDurationText(durationText, fallbackDayCount = 1) {
  const source = String(durationText || '').trim()
  if (/半天/.test(source)) return source
  const matched = source.match(/(\d+)/)
  if (matched) return formatTripDuration(matched[1])
  return formatTripDuration(fallbackDayCount)
}

// 把旧的摘要文案统一成新规则：
// 例如“1 天 0 晚 · 0 个地点”会变成“1 天 · 0 个地点”。
function normalizeTripSummaryText(summaryText, fallbackDayCount = 1, fallbackPlaceCount = 0) {
  const source = String(summaryText || '').trim()
  const placeMatched = source.match(/(\d+)\s*个地点/)
  const placeCount = placeMatched ? parseInt(placeMatched[1], 10) : fallbackPlaceCount
  return formatTripSummary(fallbackDayCount, placeCount)
}

module.exports = {
  formatTripDuration,
  formatTripSummary,
  normalizeTripDurationText,
  normalizeTripSummaryText
}
