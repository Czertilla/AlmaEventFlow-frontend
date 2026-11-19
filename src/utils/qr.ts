import qrcode from 'qrcode-generator'

const QUIET_ZONE = 4

export function qrModules(text: string): boolean[][] {
  const qr = qrcode(0, 'M')
  qr.addData(text, 'Byte')
  qr.make()
  const size = qr.getModuleCount()
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => qr.isDark(row, col)))
}

export function qrSvg(text: string): string {
  const modules = qrModules(text)
  const side = modules.length + QUIET_ZONE * 2
  let path = ''
  modules.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) path += `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`
    })
  })
  // A scanner needs dark modules on a light ground whatever the theme, and the file is saved as is.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" shape-rendering="crispEdges">`
    + `<rect width="${side}" height="${side}" fill="#ffffff"/><path d="${path}" fill="#000000"/></svg>`
  )
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
