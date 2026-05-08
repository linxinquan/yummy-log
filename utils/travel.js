const util = require('./util')

const MODE_CONFIG = {
  walk: { key: 'walk', label: '步行', shortLabel: '步', icon: 'mgc_walk_line', minutesPerKm: 12 },
  ride: { key: 'ride', label: '骑行', shortLabel: '骑', icon: 'mgc_riding_line', minutesPerKm: 4 },
  transit: { key: 'transit', label: '地铁', shortLabel: '铁', icon: 'mgc_train_2_line', minutesPerKm: 5 },
  bus: { key: 'bus', label: '公交', shortLabel: '公', icon: 'mgc_bus_line', minutesPerKm: 6 },
  drive: { key: 'drive', label: '驾车', shortLabel: '车', icon: 'mgc_car_3_line', minutesPerKm: 3 }
}

const MODE_ORDER = ['walk', 'ride', 'transit', 'bus', 'drive']

function formatDurationShort(minutes) {
  const safeMinutes = Math.max(1, Math.round(minutes || 0))
  if (safeMinutes < 60) return `${safeMinutes}min`
  const hours = Math.floor(safeMinutes / 60)
  const mins = safeMinutes % 60
  return mins ? `${hours}h ${mins}min` : `${hours}h`
}

function inferDefaultMode(distance) {
  const safeDistance = Math.max(Math.round(distance || 0), 1)
  if (safeDistance >= 12000) return 'drive'
  if (safeDistance >= 6000) return 'bus'
  if (safeDistance >= 3500) return 'transit'
  if (safeDistance >= 900) return 'ride'
  return 'walk'
}

function buildTravelMeta(distance, mode) {
  const safeDistance = Math.max(Math.round(distance || 0), 1)
  const modeKey = MODE_CONFIG[mode] ? mode : inferDefaultMode(safeDistance)
  const config = MODE_CONFIG[modeKey]
  const distanceText = util.formatDistance(safeDistance)
  const timeText = formatDurationShort((safeDistance / 1000) * config.minutesPerKm)
  return {
    mode: modeKey,
    label: config.label,
    shortLabel: config.shortLabel,
    icon: config.icon,
    distance: safeDistance,
    distanceText,
    timeText,
    text: `${config.label} | ${distanceText} · ${timeText}`
  }
}

function buildTravelOptions(distance) {
  return MODE_ORDER.map(mode => buildTravelMeta(distance, mode))
}

function applyTravelMeta(item, mode) {
  const distance = item.distanceFromPrev || (item.travelMeta && item.travelMeta.distance) || 0
  const travelMeta = buildTravelMeta(distance, mode || item.travelMode)
  return {
    ...item,
    travelMode: travelMeta.mode,
    travelMeta,
    travelText: travelMeta.text
  }
}

module.exports = {
  MODE_CONFIG,
  MODE_ORDER,
  formatDurationShort,
  inferDefaultMode,
  buildTravelMeta,
  buildTravelOptions,
  applyTravelMeta
}
