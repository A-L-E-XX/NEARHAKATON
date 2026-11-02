import { useEffect, useState } from "react";

interface BowlProps {
  score: number;
  frozen: boolean;
  activeDrills: number;
  size?: number;
}

// The bowl's body is a circle centred at (120, 132) with radius 98.
const BOTTOM = 230;
const TOP_OF_WATER_AT_100 = 58;

/**
 * The agent's score as water in a fishbowl. More water means more spending
 * power. A frozen vault ices over. Each running drill is a lure on a line.
 */
export function Bowl({ score, frozen, activeDrills, size = 300 }: BowlProps) {
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const level = Math.max(0, Math.min(100, score));
  const waterTop = BOTTOM - (level / 100) * (BOTTOM - TOP_OF_WATER_AT_100);
  const lures = Math.min(activeDrills, 3);
  const label = `Agent score ${level} of 100${frozen ? ", vault frozen" : ""}${
    activeDrills ? `, ${activeDrills} scam drill${activeDrills === 1 ? "" : "s"} running` : ""
  }`;

  return (
    <svg
      className={`bowl${frozen ? " bowl--frozen" : ""}`}
      viewBox="0 0 240 244"
      width={size}
      height={size * (244 / 240)}
      role="img"
      aria-label={label}
    >
      <defs>
        <clipPath id="bowl-inside">
          <path d="M84 40 C 40 58 22 96 22 132 C 22 186 66 230 120 230 C 174 230 218 186 218 132 C 218 96 200 58 156 40 Z" />
        </clipPath>
        <linearGradient id="bowl-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3CC4BC" />
          <stop offset="1" stopColor="#17807C" />
        </linearGradient>
      </defs>

      <g clipPath="url(#bowl-inside)">
        <rect x="0" y="0" width="240" height="244" className="bowl__air" />
        <g
          className="bowl__water"
          style={{ transform: `translateY(${filled ? 0 : BOTTOM - waterTop + 20}px)` }}
        >
          <path
            d={`M0 ${waterTop} q 20 -7 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 V 244 H 0 Z`}
            fill={frozen ? "#CFE8F7" : "url(#bowl-water)"}
          />
          {frozen && (
            <g className="bowl__frost" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" fill="none">
              <path d={`M70 ${waterTop + 30} l 14 14 m 0 -14 l -14 14 m 7 -10 v 20`} />
              <path d={`M150 ${waterTop + 50} l 12 12 m 0 -12 l -12 12 m 6 -9 v 18`} />
              <path d={`M112 ${waterTop + 18} l 9 9 m 0 -9 l -9 9`} />
              <path d={`M40 ${waterTop + 60} L 200 ${waterTop + 40}`} opacity="0.5" />
            </g>
          )}
        </g>
      </g>

      {Array.from({ length: lures }, (_, i) => {
        const x = 98 + i * 22;
        const depth = Math.max(waterTop + 26, 110) + i * 14;
        return (
          <g key={i} className="bowl__lure">
            <line x1={x} y1="8" x2={x} y2={depth} stroke="#0E2F44" strokeWidth="1.2" opacity="0.55" />
            <path
              d={`M${x} ${depth} v 10 a 5 5 0 1 1 -9 3`}
              fill="none"
              stroke="#F2773A"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          </g>
        );
      })}

      <path
        className="bowl__glass"
        d="M84 40 C 40 58 22 96 22 132 C 22 186 66 230 120 230 C 174 230 218 186 218 132 C 218 96 200 58 156 40"
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path className="bowl__rim" d="M76 36 H 164" strokeWidth="6" strokeLinecap="round" />
      <path
        className="bowl__shine"
        d="M48 104 C 42 122 42 146 52 166"
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}
