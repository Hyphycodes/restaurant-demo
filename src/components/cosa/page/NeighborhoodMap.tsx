/**
 * An illustrated street plan of an imagined West Loop block — deliberately
 * not a real map, because Cosa Nostra has no real address.
 */
export function NeighborhoodMap() {
  const streets = [
    { d: 'M0 90 H600', name: 'W Randolph St', x: 18, y: 84 },
    { d: 'M0 210 H600', name: 'W Lake St', x: 18, y: 204 },
    { d: 'M0 330 H600', name: 'W Fulton Market', x: 18, y: 324 },
    { d: 'M140 0 V420', name: 'N Morgan St', x: 146, y: 408, vertical: true },
    { d: 'M330 0 V420', name: 'N Carpenter St', x: 336, y: 408, vertical: true },
    { d: 'M500 0 V420', name: 'N May St', x: 506, y: 408, vertical: true },
  ];
  return (
    <svg className="cn-map" viewBox="0 0 600 420" role="img" aria-label="Illustrated street plan: Cosa Nostra sits mid-block between Morgan and Carpenter, south of Lake Street, near the Morgan L stop.">
      <defs>
        <radialGradient id="cn-map-glow">
          <stop offset="0" stopColor="#e8b86b" stopOpacity="0.55" />
          <stop offset="1" stopColor="#e8b86b" stopOpacity="0" />
        </radialGradient>
        <pattern id="cn-map-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="rgb(241 230 210 / 0.06)" strokeWidth="2" />
        </pattern>
      </defs>
      {[[0, 0, 140, 90], [140, 0, 190, 90], [330, 0, 170, 90], [0, 90, 140, 120], [330, 90, 170, 120], [0, 210, 140, 120], [140, 210, 190, 120], [330, 210, 170, 120]].map(([x, y, w, h], i) => (
        <rect key={i} x={x! + 10} y={y! + 10} width={w! - 20} height={h! - 20} fill="url(#cn-map-hatch)" stroke="rgb(241 230 210 / 0.08)" />
      ))}
      <rect x="150" y="100" width="170" height="100" fill="rgb(109 29 40 / 0.35)" stroke="rgb(232 184 107 / 0.5)" />
      {streets.map((street) => (
        <g key={street.name}>
          <path d={street.d} stroke="rgb(241 230 210 / 0.22)" strokeWidth="14" />
          <text
            x={street.x}
            y={street.y}
            fill="rgb(241 230 210 / 0.5)"
            fontSize="9"
            letterSpacing="2"
            transform={street.vertical ? `rotate(-90 ${street.x} ${street.y})` : undefined}
          >
            {street.name.toUpperCase()}
          </text>
        </g>
      ))}
      <path d="M0 212 H600" stroke="rgb(147 48 61 / 0.9)" strokeWidth="3" strokeDasharray="10 6" />
      <g transform="translate(140 212)">
        <circle r="11" fill="#120d0a" stroke="#93303d" strokeWidth="3" />
        <text x="16" y="-12" fill="#f3c6cc" fontSize="10" letterSpacing="1.5">
          MORGAN · GREEN &amp; PINK LINES
        </text>
      </g>
      <circle cx="245" cy="150" r="70" fill="url(#cn-map-glow)" />
      <g transform="translate(245 150)">
        <circle r="7" fill="#e8b86b" />
        <circle r="16" fill="none" stroke="#e8b86b" strokeOpacity="0.5" />
        <text y="-26" textAnchor="middle" fill="#f1e6d2" fontSize="15" fontFamily="var(--cn-serif)" fontStyle="italic">
          Cosa Nostra
        </text>
      </g>
      <text x="252" y="186" textAnchor="middle" fill="rgb(232 184 107 / 0.8)" fontSize="8" letterSpacing="2">
        THE GREEN DOOR
      </text>
    </svg>
  );
}
