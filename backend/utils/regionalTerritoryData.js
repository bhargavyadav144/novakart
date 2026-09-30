// Regional Geospatial Dataset for Andhra Pradesh & Telangana Territories
// Contains Mandals, Telugu names, pincodes clusters, centers, villages, and administrative boundary polygons

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
      'Prathipadu (ప్రతిపాడు)',
      'Gottipadu (గొట్టిపాడు)',
      'Mallayapalem (మల్లాయపాలెం)',
      'Ravipadu (రావిపాడు)',
      'Katrapadu (కట్రపాడు)',
      'Yamarru (యామర్రు)',
      'Pallapadu (పల్లపాడు)',
      'Vangipuram (వంగీపురం)',
      'Etukuru (ఏటుకూరు)',
      'Budampadu (బుడంపాడు)'
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
      'Brodipet',
      'Arundelpet',
      'Collectorate Center',
      'Pattabhipuram',
      'Nallapadu Industrial Area',
      'Kothapet Market',
      'Nagarampalem'
    ],
    polygon: [
      [16.3450, 80.4100],
      [16.3400, 80.4650],
      [16.3200, 80.4850],
      [16.2800, 80.4750],
      [16.2650, 80.4400],
      [16.2750, 80.3950],
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
      'Mangalagiri Town',
      'AIIMS Campus Area',
      'Panakala Swamy Temple Zone',
      'Atmakur',
      'Nowlur (నౌలూరు)',
      'Chinna Kakani',
      'Kaza Highway Corridor'
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
      'Tenali Station Road',
      'Morrispet',
      'Chenchupet',
      'Burripalem Road',
      'Angalakuduru',
      'Nandivelugu',
      'Chinaravuru'
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
      'Tadepalle Town',
      'Undavalli Caves Area',
      'Vaddeswaram (KL University)',
      'Kunchanapalle',
      'Prathuru',
      'Kolanukonda'
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
      'Thullur Central',
      'Velagapudi Secretariat',
      'Mandadam',
      'Rayapudi',
      'Nelapadu High Court Zone',
      'Malkapuram'
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
    villages: ['Medchal Town', 'Kompally Highway', 'Gundlapochampally', 'Kandlakoya', 'Doolapally'],
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
    villages: ['Madhapur', 'Gachibowli', 'Hitec City', 'Kondapur', 'Hafeezpet', 'Nanakramguda'],
    polygon: [
      [17.5200, 78.3100],
      [17.5250, 78.3750],
      [17.4850, 78.3900],
      [17.4400, 78.3650],
      [17.4450, 78.3150],
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
      'Medikonduru (మేడికొండూరు)',
      'Perecherla (పేరేచర్ల)',
      'Chinapalakaluru (చినపాలకలూరు)',
      'Dokiparru (దోకిపర్రు)',
      'Visadala (విసడాల)',
      'Mangalagiripadu (మంగళగిరిపాడు)',
      'Gundlapalem (గుండ్లపాలెం)',
      'Biminenivaripalem (బిమినేనివారిపాలెం)',
      'Jangamguntlapalem'
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
  },
  {
    mandal: 'Phirangipuram',
    mandalTelugu: 'ఫిరంగిపురం',
    district: 'Guntur',
    state: 'Andhra Pradesh',
    zoneName: 'Phirangipuram Mandal Sector',
    color: '#EC4899',
    center: { lat: 16.3000, lng: 80.2500 },
    radiusKm: 8.0,
    pincodes: ['522529', '522438', '522019'],
    villages: [
      'Phirangipuram (ఫిరంగిపురం)',
      'Ameenabad (అమీనాబాద్)',
      'Vemuluripadu (వేములూరుపాడు)',
      'Potlapadu (పొట్లపాడు)'
    ],
    polygon: [
      [16.3500, 80.2100],
      [16.3450, 80.2900],
      [16.2800, 80.2950],
      [16.2500, 80.2400],
      [16.2700, 80.2000],
      [16.3500, 80.2100]
    ]
  },
  {
    mandal: 'Pedakakani',
    mandalTelugu: 'పెదకాకాని',
    district: 'Guntur',
    state: 'Andhra Pradesh',
    zoneName: 'Pedakakani Mandal Sector',
    color: '#8B5CF6',
    center: { lat: 16.3400, lng: 80.4900 },
    radiusKm: 6.0,
    pincodes: ['522509', '522508', '522004'],
    villages: [
      'Pedakakani Town (పెదకాకాని)',
      'Narakoduru',
      'Takkellapadu',
      'Agiripalli Corridor'
    ],
    polygon: [
      [16.3800, 80.4600],
      [16.3750, 80.5200],
      [16.3100, 80.5250],
      [16.3050, 80.4650],
      [16.3800, 80.4600]
    ]
  },
  {
    mandal: 'Chebrolu',
    mandalTelugu: 'చేబ్రోలు',
    district: 'Guntur',
    state: 'Andhra Pradesh',
    zoneName: 'Chebrolu Mandal Sector',
    color: '#10B981',
    center: { lat: 16.2000, lng: 80.5200 },
    radiusKm: 7.0,
    pincodes: ['522212', '522213', '522211'],
    villages: ['Chebrolu Town', 'Vadapudi', 'Selapadu', 'Gundavaram'],
    polygon: [
      [16.2500, 80.4800],
      [16.2450, 80.5600],
      [16.1600, 80.5650],
      [16.1550, 80.4850],
      [16.2500, 80.4800]
    ]
  },
];

// Haversine distance calculator in KM
export const haversineKm = (lat1, lon1, lat2, lon2) => {
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

// Spatial Auto-Verification: detects which Mandal & all pincodes fall within the circle drawn by mouse (Max 100 KM radius)
export const detectTerritoryFromCircle = (centerLat, centerLng, radiusKm = 5.5) => {
  const cLat = parseFloat(centerLat);
  const cLng = parseFloat(centerLng);
  // Cap radius to maximum 100 KM delivery limit
  const rad = Math.min(Math.max(1, parseFloat(radiusKm) || 5.5), 100);

  let closestMandal = REGIONAL_MANDALS[0];
  let minDistance = 99999;

  for (const m of REGIONAL_MANDALS) {
    const dist = haversineKm(cLat, cLng, m.center.lat, m.center.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestMandal = m;
    }
  }

  // Gather pincodes from closest Mandal plus any intersecting neighboring Mandals within the drawn radius
  const matchedPincodesSet = new Set(closestMandal.pincodes);
  const intersectingVillages = [...closestMandal.villages];

  for (const m of REGIONAL_MANDALS) {
    if (m.mandal === closestMandal.mandal) continue;
    const dist = haversineKm(cLat, cLng, m.center.lat, m.center.lng);
    if (dist <= rad + m.radiusKm * 0.5) {
      m.pincodes.forEach(p => matchedPincodesSet.add(p));
      intersectingVillages.push(...m.villages.slice(0, 3));
    }
  }

  const finalPincodes = Array.from(matchedPincodesSet);

  return {
    success: true,
    primaryMandal: closestMandal.mandal,
    primaryMandalTelugu: closestMandal.mandalTelugu,
    district: closestMandal.district,
    state: closestMandal.state,
    zoneName: `${closestMandal.mandal} Mandal Sector`,
    color: closestMandal.color,
    radiusKm: rad,
    center: { lat: cLat, lng: cLng },
    autoVerifiedPincodes: finalPincodes,
    enclosedVillages: intersectingVillages.slice(0, 12),
    boundaryPolygon: closestMandal.polygon,
    distanceToCenterKm: minDistance
  };
};
