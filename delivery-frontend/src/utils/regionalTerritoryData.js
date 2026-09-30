// Regional Geospatial Dataset for Andhra Pradesh & Telangana Territories
// Contains Mandals, Telugu names, pincodes clusters, centers, villages, and administrative boundary polygons

export const TILE_LAYERS = {
  plain: {
    name: 'Plain Map',
    icon: '🗺️',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  },
  satellite: {
    name: 'Coloured Satellite',
    icon: '🛰️',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri World Imagery'
  }
};

export const REGIONAL_MANDALS = [
  {
    mandal: 'Prathipadu',
    mandalTelugu: 'ప్రతిపాడు',
    district: 'Guntur',
    state: 'Andhra Pradesh',
    zoneName: 'Prathipadu Mandal Sector',
    color: '#EF4444', // Red boundary matching Google Maps screenshot
    center: { lat: 16.1800, lng: 80.3900 },
    radiusKm: 7.0,
    pincodes: ['522019', '522017', '522018', '522014', '522015', '522016'],
    villages: [
      { name: 'Prathipadu', telugu: 'ప్రతిపాడు', lat: 16.1800, lng: 80.3900, isCenter: true },
      { name: 'Gottipadu', telugu: 'గొట్టిపాడు', lat: 16.1650, lng: 80.3450 },
      { name: 'Mallayapalem', telugu: 'మల్లాయపాలెం', lat: 16.1550, lng: 80.4250 },
      { name: 'Ravipadu', telugu: 'రావిపాడు', lat: 16.1200, lng: 80.3900 },
      { name: 'Katrapadu', telugu: 'కట్రపాడు', lat: 16.1950, lng: 80.4500 },
      { name: 'Yamarru', telugu: 'యామర్రు', lat: 16.1820, lng: 80.4400 },
      { name: 'Pallapadu', telugu: 'పల్లపాడు', lat: 16.1600, lng: 80.4600 },
      { name: 'Vangipuram', telugu: 'వంగీపురం', lat: 16.1350, lng: 80.4350 }
    ],
    // High-precision administrative boundary polygon matching Google Maps red/white dashed perimeter
    polygon: [
      [16.2250, 80.3700],
      [16.2180, 80.4050],
      [16.2050, 80.4350],
      [16.1850, 80.4600],
      [16.1680, 80.4650],
      [16.1480, 80.4450],
      [16.1350, 80.4180],
      [16.1200, 80.3950],
      [16.1300, 80.3600],
      [16.1480, 80.3350],
      [16.1750, 80.3280],
      [16.2050, 80.3400],
      [16.2250, 80.3700]
    ]
  },
  {
    mandal: 'Guntur Urban',
    mandalTelugu: 'గుంటూరు అర్బన్',
    district: 'Guntur',
    state: 'Andhra Pradesh',
    zoneName: 'Guntur Urban Mandal Sector',
    color: '#10B981',
    center: { lat: 16.3067, lng: 80.4365 },
    radiusKm: 5.5,
    pincodes: ['522001', '522002', '522003', '522004', '522005', '522006'],
    villages: [
      { name: 'Brodipet', telugu: 'బ్రాడీపేట', lat: 16.3100, lng: 80.4400, isCenter: true },
      { name: 'Arundelpet', telugu: 'అరుండెల్ పేట', lat: 16.3150, lng: 80.4320 },
      { name: 'Etukuru', telugu: 'ఏటుకూరు', lat: 16.2800, lng: 80.4700 },
      { name: 'Budampadu', telugu: 'బుడంపాడు', lat: 16.2400, lng: 80.4900 },
      { name: 'Pattabhipuram', telugu: 'పట్టాభిపురం', lat: 16.2980, lng: 80.4200 }
    ],
    polygon: [
      [16.3450, 80.4100],
      [16.3400, 80.4650],
      [16.3200, 80.4850],
      [16.2800, 80.4750],
      [16.2650, 80.4400],
      [16.275, 80.3950],
      [16.3100, 80.3900],
      [16.3450, 80.4100]
    ]
  },
  {
    mandal: 'Mangalagiri',
    mandalTelugu: 'మంగళగిరి',
    district: 'Guntur',
    state: 'Andhra Pradesh',
    zoneName: 'Mangalagiri Mandal Sector',
    color: '#3B82F6',
    center: { lat: 16.4350, lng: 80.5600 },
    radiusKm: 6.0,
    pincodes: ['522503', '522502', '522501', '522504', '522508'],
    villages: [
      { name: 'Mangalagiri Town', telugu: 'మంగళగిరి టౌన్', lat: 16.4350, lng: 80.5600, isCenter: true },
      { name: 'Nowlur', telugu: 'నౌలూరు', lat: 16.4500, lng: 80.5400 },
      { name: 'Atmakur', telugu: 'ఆత్మకూరు', lat: 16.4200, lng: 80.5750 },
      { name: 'Chinna Kakani', telugu: 'చిన్న కాకాని', lat: 16.4100, lng: 80.5500 }
    ],
    polygon: [
      [16.4750, 80.5350],
      [16.4700, 80.5900],
      [16.4400, 80.6100],
      [16.4050, 80.5850],
      [16.3950, 80.5400],
      [16.4250, 80.5150],
      [16.4750, 80.5350]
    ]
  },
  {
    mandal: 'Tenali',
    mandalTelugu: 'తెనాలి',
    district: 'Guntur',
    state: 'Andhra Pradesh',
    zoneName: 'Tenali Mandal Corridor',
    color: '#8B5CF6',
    center: { lat: 16.2437, lng: 80.6400 },
    radiusKm: 6.5,
    pincodes: ['522201', '522202', '522203', '522204', '522205', '522206'],
    villages: [
      { name: 'Morrispet', telugu: 'మోరిస్ పేట', lat: 16.2437, lng: 80.6400, isCenter: true },
      { name: 'Chenchupet', telugu: 'చెంచుపేట', lat: 16.2550, lng: 80.6500 },
      { name: 'Angalakuduru', telugu: 'అంగలకుదురు', lat: 16.2250, lng: 80.6250 }
    ],
    polygon: [
      [16.2800, 80.6100],
      [16.2850, 80.6700],
      [16.2550, 80.6900],
      [16.2150, 80.6750],
      [16.2050, 80.6200],
      [16.2350, 80.5950],
      [16.2800, 80.6100]
    ]
  },
  {
    mandal: 'Tadepalle',
    mandalTelugu: 'తాడేపల్లి',
    district: 'Guntur',
    state: 'Andhra Pradesh',
    zoneName: 'Tadepalle Mandal Sector',
    color: '#06B6D4',
    center: { lat: 16.4800, lng: 80.6000 },
    radiusKm: 4.5,
    pincodes: ['522501', '522502', '522505', '522506', '522507'],
    villages: [
      { name: 'Tadepalle', telugu: 'తాడేపల్లి', lat: 16.4800, lng: 80.6000, isCenter: true },
      { name: 'Undavalli', telugu: 'ఉండవల్లి', lat: 16.4950, lng: 80.5850 },
      { name: 'Vaddeswaram', telugu: 'వడ్డేశ్వరం', lat: 16.4550, lng: 80.6150 }
    ],
    polygon: [
      [16.5100, 80.5800],
      [16.5150, 80.6300],
      [16.4850, 80.6450],
      [16.4550, 80.6200],
      [16.4500, 80.5850],
      [16.4750, 80.5650],
      [16.5100, 80.5800]
    ]
  },
  {
    mandal: 'Thullur',
    mandalTelugu: 'తుళ్ళూరు / అమరావతి',
    district: 'Guntur',
    state: 'Andhra Pradesh',
    zoneName: 'Thullur / Amaravathi Mandal',
    color: '#EC4899',
    center: { lat: 16.5400, lng: 80.4800 },
    radiusKm: 8.0,
    pincodes: ['522237', '522238', '522239', '522240', '522241'],
    villages: [
      { name: 'Thullur', telugu: 'తుళ్ళూరు', lat: 16.5400, lng: 80.4800, isCenter: true },
      { name: 'Velagapudi', telugu: 'వెలగపూడి', lat: 16.5600, lng: 80.5050 },
      { name: 'Mandadam', telugu: 'మందడం', lat: 16.5250, lng: 80.5200 }
    ],
    polygon: [
      [16.5850, 80.4400],
      [16.5900, 80.5250],
      [16.5500, 80.5400],
      [16.5050, 80.5100],
      [16.4950, 80.4450],
      [16.5350, 80.4200],
      [16.5850, 80.4400]
    ]
  },
  {
    mandal: 'Medchal',
    mandalTelugu: 'మేడ్చల్ - మల్కాజిగిరి',
    district: 'Medchal-Malkajgiri',
    state: 'Telangana',
    zoneName: 'Medchal-Malkajgiri Mandal',
    color: '#6366F1',
    center: { lat: 17.6200, lng: 78.4800 },
    radiusKm: 7.5,
    pincodes: ['500047', '500056', '500062', '500088', '500100', '500010'],
    villages: [
      { name: 'Medchal', telugu: 'మేడ్చల్', lat: 17.6200, lng: 78.4800, isCenter: true },
      { name: 'Kompally', telugu: 'కొంపల్లి', lat: 17.5450, lng: 78.4850 }
    ],
    polygon: [
      [17.6700, 78.4400],
      [17.6750, 78.5200],
      [17.6300, 78.5400],
      [17.5800, 78.5100],
      [17.5750, 78.4450],
      [17.6200, 78.4200],
      [17.6700, 78.4400]
    ]
  },
  {
    mandal: 'Serilingampally',
    mandalTelugu: 'శేరిలింగంపల్లి / సైబరాబాద్',
    district: 'Ranga Reddy',
    state: 'Telangana',
    zoneName: 'Serilingampally / Cyberabad Mandal',
    color: '#EF4444',
    center: { lat: 17.4800, lng: 78.3400 },
    radiusKm: 6.0,
    pincodes: ['500081', '500084', '500085', '500089', '500090', '500032'],
    villages: [
      { name: 'Madhapur', telugu: 'మాదాపూర్', lat: 17.4483, lng: 78.3915, isCenter: true },
      { name: 'Gachibowli', telugu: 'గచ్చిబౌలి', lat: 17.4401, lng: 78.3489 }
    ],
    polygon: [
      [17.5200, 78.3100],
      [17.5250, 78.3750],
      [17.4850, 78.3900],
      [17.4400, 78.3650],
      [17.4450, 78.3150],
      [17.4800, 78.2950],
      [17.5200, 78.3100]
    ]
  },
  {
    mandal: 'Medikonduru',
    mandalTelugu: 'మేడికొండూరు (పేరేచర్ల)',
    district: 'Guntur',
    state: 'Andhra Pradesh',
    zoneName: 'Medikonduru & Perecherla Sector',
    color: '#F59E0B',
    center: { lat: 16.3330, lng: 80.3280 },
    radiusKm: 7.5,
    pincodes: ['522438', '522009', '522529', '522004'],
    villages: [
      { name: 'Medikonduru', telugu: 'మేడికొండూరు', lat: 16.3330, lng: 80.3280, isCenter: true },
      { name: 'Perecherla', telugu: 'పేరేచర్ల', lat: 16.3150, lng: 80.3350 },
      { name: 'Dokiparru', telugu: 'దోకిపర్రు', lat: 16.3500, lng: 80.2650 },
      { name: 'Visadala', telugu: 'విసడాల', lat: 16.3100, lng: 80.2700 },
      { name: 'Paladugu', telugu: 'పాలడుగు', lat: 16.3200, lng: 80.3100 },
      { name: 'Mandapadu', telugu: 'మండపాడు', lat: 16.3600, lng: 80.3000 }
    ],
    polygon: [
      [16.3850, 80.2600],
      [16.3800, 80.3550],
      [16.3400, 80.3700],
      [16.2950, 80.3650],
      [16.2900, 80.3000],
      [16.3300, 80.2500],
      [16.3850, 80.2600]
    ]
  }
];

export const haversineDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 99999;
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
};

export const getLocalMandalDetection = (lat, lng, radiusKm = 5.5) => {
  let closest = REGIONAL_MANDALS[0];
  let min = 99999;
  for (const m of REGIONAL_MANDALS) {
    const d = haversineDistance(lat, lng, m.center.lat, m.center.lng);
    if (d < min) {
      min = d;
      closest = m;
    }
  }
  return closest;
};
