export interface MapProvider {
  name: string
  url: string
}

function isApplePlatform(): boolean {
  return /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent)
}

export function buildMapProviders(lat: number, lon: number, label?: string): MapProvider[] {
  const q = label ? encodeURIComponent(label) : ''
  const providers: MapProvider[] = [
    {
      name: 'Яндекс Карты',
      url: `https://yandex.ru/maps/?pt=${lon},${lat}&z=17&l=map${label ? `&text=${q}` : ''}`,
    },
    { name: '2ГИС', url: `https://2gis.ru/geo/${lon},${lat}` },
    {
      name: 'Google Карты',
      // старый формат q= (а не /search/?api=1&query=) поддерживает метку рядом
      // с координатами: пин ставится точно в (lat,lon), а подписывается label
      url: `https://maps.google.com/?q=${lat},${lon}${label ? `(${q})` : ''}`,
    },
  ]
  if (isApplePlatform()) {
    providers.push({
      name: 'Apple Карты',
      url: `https://maps.apple.com/?ll=${lat},${lon}${label ? `&q=${q}` : ''}`,
    })
  }
  return providers
}
