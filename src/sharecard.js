// ──────────────────────────────────────────────────────────────────────────
// Score card image generator.
//
// Renders a shareable 1080×1080 PNG of the learner's level / XP / stats onto an
// offscreen canvas. Pure canvas 2D — no external assets, no network — so it
// works offline and inside the strict PWA. Fonts fall back to system if the
// web fonts aren't ready; that's fine for an exported image.
// ──────────────────────────────────────────────────────────────────────────

const W = 1080
const H = 1080

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// data: { level, title, xp, pct, answered, accuracy, streak, bestCombo, dateStr, name }
export function drawScoreCard(canvas, data) {
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // Background: deep navy with warm brand glow (mirrors the app's dark bg).
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#141d2e')
  bg.addColorStop(1, '#080c14')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W * 0.15, -80, 60, W * 0.15, -80, 900)
  glow.addColorStop(0, 'rgba(255,153,0,0.20)')
  glow.addColorStop(1, 'rgba(255,153,0,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // Card frame
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 2
  roundRect(ctx, 48, 48, W - 96, H - 96, 40)
  ctx.stroke()

  const cx = W / 2

  // Header
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ff9900'
  ctx.font = '700 34px Inter, "Noto Sans TC", system-ui, sans-serif'
  ctx.fillText('QUEST · 學習成績卡', cx, 138)

  // Level ring
  const ringY = 360
  const R = 120
  ctx.lineWidth = 20
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'
  ctx.beginPath()
  ctx.arc(cx, ringY, R, 0, Math.PI * 2)
  ctx.stroke()
  const pct = Math.max(0, Math.min(1, data.pct ?? 0))
  const grad = ctx.createLinearGradient(cx - R, ringY - R, cx + R, ringY + R)
  grad.addColorStop(0, '#ff9900')
  grad.addColorStop(1, '#ec7211')
  ctx.strokeStyle = grad
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(cx, ringY, R, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2)
  ctx.stroke()

  // Level number in ring
  ctx.fillStyle = '#94a3b8'
  ctx.font = '600 28px Inter, system-ui, sans-serif'
  ctx.fillText('LV', cx, ringY - 32)
  ctx.fillStyle = '#ffffff'
  ctx.font = '800 110px Inter, system-ui, sans-serif'
  ctx.fillText(String(data.level ?? 1), cx, ringY + 52)

  // Title
  ctx.fillStyle = '#fbbf24'
  ctx.font = '700 52px Inter, "Noto Sans TC", system-ui, sans-serif'
  ctx.fillText(data.title || '', cx, ringY + 190)

  // XP line
  ctx.fillStyle = '#cbd5e1'
  ctx.font = '500 30px Inter, "Noto Sans TC", system-ui, sans-serif'
  ctx.fillText(`${(data.xp ?? 0).toLocaleString()} XP`, cx, ringY + 244)

  // Stat tiles (2×2)
  const tiles = [
    { label: '已作答', value: String(data.answered ?? 0) },
    { label: '正確率', value: `${data.accuracy ?? 0}%` },
    { label: '連續學習', value: `${data.streak ?? 0} 天` },
    { label: '最佳連對', value: String(data.bestCombo ?? 0) },
  ]
  const tw = 456, th = 132, gap = 24
  const startX = cx - tw - gap / 2
  const startY = 700
  tiles.forEach((t, i) => {
    const col = i % 2, row = Math.floor(i / 2)
    const x = startX + col * (tw + gap)
    const y = startY + row * (th + gap)
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    roundRect(ctx, x, y, tw, th, 24)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'
    ctx.lineWidth = 1.5
    roundRect(ctx, x, y, tw, th, 24)
    ctx.stroke()
    ctx.textAlign = 'left'
    ctx.fillStyle = '#94a3b8'
    ctx.font = '500 26px Inter, "Noto Sans TC", system-ui, sans-serif'
    ctx.fillText(t.label, x + 32, y + 52)
    ctx.fillStyle = '#ffffff'
    ctx.font = '800 56px Inter, system-ui, sans-serif'
    ctx.fillText(t.value, x + 32, y + 108)
  })

  // Footer
  ctx.textAlign = 'center'
  ctx.fillStyle = '#64748b'
  ctx.font = '500 26px Inter, "Noto Sans TC", system-ui, sans-serif'
  const who = data.name ? `${data.name} · ` : ''
  ctx.fillText(`${who}${data.dateStr || ''}`, cx, H - 46)
}

// Render the card and return a PNG blob.
export function scoreCardBlob(data) {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas')
      drawScoreCard(canvas, data)
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
    } catch (e) {
      reject(e)
    }
  })
}

// Share (Web Share API with files) or fall back to a download.
export async function shareScoreCard(data, filename = 'quest-score.png') {
  const blob = await scoreCardBlob(data)
  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'QUEST 學習成績卡' })
      return 'shared'
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled'
      // fall through to download
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
