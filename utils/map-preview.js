function getBaseIndex(dayTabs, dayIndex) {
  let total = 0
  for (let i = 0; i < dayIndex; i += 1) {
    total += (((dayTabs || [])[i] || {}).items || []).length
  }
  return total
}

function flattenTabs(dayTabs) {
  const result = []
  ;(dayTabs || []).forEach((day, dayIndex) => {
    ;(day.items || []).forEach((item, itemIndex) => {
      result.push({
        ...item,
        dayIndex,
        itemIndex,
        globalIndex: getBaseIndex(dayTabs, dayIndex) + itemIndex
      })
    })
  })
  return result
}

function buildPreviewPlaces(dayTabs, currentDay) {
  if (currentDay < 0) return flattenTabs(dayTabs)
  const day = (dayTabs || [])[currentDay] || {}
  const baseIndex = getBaseIndex(dayTabs, currentDay)
  return (day.items || []).map((item, itemIndex) => ({
    ...item,
    dayIndex: currentDay,
    itemIndex,
    globalIndex: baseIndex + itemIndex
  }))
}

function buildStationLabel(index) {
  return `第 ${index + 1} 站`
}

function formatRating(value) {
  if (value === undefined || value === null || value === '') return ''
  const num = Number(value)
  if (Number.isNaN(num)) return String(value)
  return num.toFixed(1).replace(/\.0$/, '.0')
}

function buildTagList(place) {
  const sourceTags = Array.isArray(place && place.tags) ? place.tags : []
  if (sourceTags.length) {
    return sourceTags
      .filter(tag => tag && tag !== place.category && tag !== place.tag && tag !== place.tagText)
      .slice(0, 2)
  }

  const metaParts = String((place && place.metaText) || '')
    .split('·')
    .map(item => item.trim())
    .filter(Boolean)
    .filter(item => !/^★/.test(item))
    .filter(item => !/^¥/.test(item))

  if (metaParts.length) return metaParts.slice(0, 2)

  const fallbackTags = [place && place.tag, place && place.tagText, place && place.category]
    .filter(Boolean)
  return [...new Set(fallbackTags)].slice(0, 2)
}

function buildDisplayMeta(place) {
  if (!place) return []
  const chips = []
  chips.push({ type: 'score', text: formatRating(place.score || place.rating || 4.5) })
  buildTagList(place).forEach(tag => chips.push({ type: 'tag', text: tag }))
  return chips.slice(0, 3)
}

function buildDescription(place) {
  if (!place) return ''
  const hours = place.businessText || place.openTimeText || place.openingHours || place.openHours || place.hours
  if (hours) {
    return `营业时间:${hours}`
  }
  return '营业时间待补充'
}

function buildFeeText(place) {
  if (!place) return ''
  if (place.free === true) return '免费'
  if (place.price) return `¥${place.price}/人`
  return '收费待定'
}

function decoratePreviewPlace(place) {
  return {
    ...place,
    displayMeta: buildDisplayMeta(place),
    descriptionText: buildDescription(place),
    feeText: buildFeeText(place),
    stationText: buildStationLabel(place.itemIndex || 0),
    countText: `${(place.globalIndex || 0) + 1}`
  }
}

function buildPreviewTabs(dayTabs) {
  return (dayTabs || []).map((day, index) => ({
    label: day.title || day.label || `第${index + 1}天`,
    index
  }))
}

function buildMapPreviewViewData(dayTabs, currentDay, currentIndex, place, totalCount) {
  const allPlaces = flattenTabs(dayTabs).map(decoratePreviewPlace)
  const globalCurrentIndex = allPlaces.findIndex(item => item.globalIndex === currentIndex)
  const safeGlobalIndex = globalCurrentIndex >= 0 ? globalCurrentIndex : 0
  const currentPlace = allPlaces[safeGlobalIndex] || (place ? decoratePreviewPlace(place) : null)
  const prevPlace = allPlaces[safeGlobalIndex - 1] || null
  const nextPlace = allPlaces[safeGlobalIndex + 1] || null

  return {
    previewTabs: buildPreviewTabs(dayTabs),
    previewDisplayMeta: currentPlace ? currentPlace.displayMeta : [],
    previewDescriptionText: currentPlace ? currentPlace.descriptionText : '',
    previewFeeText: currentPlace ? currentPlace.feeText : '',
    previewStationText: currentPlace ? currentPlace.stationText : '',
    previewCountText: place ? `${currentIndex + 1}/${totalCount || 0}` : '',
    previewPrevIndex: prevPlace ? prevPlace.globalIndex : -1,
    previewNextIndex: nextPlace ? nextPlace.globalIndex : -1,
    previewDisablePrev: !prevPlace,
    previewDisableNext: !nextPlace
  }
}

module.exports = {
  buildMapPreviewViewData
}
