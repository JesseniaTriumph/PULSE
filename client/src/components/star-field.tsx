import { useMemo } from "react";

const STAR_COLORS = [
  { color: "white", glow: "rgba(255, 255, 255, 0.5)" },
  { color: "#c8c8ff", glow: "rgba(180, 170, 255, 0.5)" },
  { color: "#ffe8c8", glow: "rgba(255, 220, 180, 0.5)" },
  { color: "#c8dfff", glow: "rgba(180, 200, 255, 0.5)" },
  { color: "#ffd0d0", glow: "rgba(255, 200, 200, 0.4)" },
];

type StarAnim = "anim-soft" | "anim-flash" | "anim-flicker" | "anim-sparkle";

function pickStarProps(i: number) {
  const rand = Math.random();
  const colorPick = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];

  let size: string;
  let anim: StarAnim;
  let duration: string;
  let minOpacity: number;
  let maxOpacity: number;

  if (rand < 0.50) {
    size = "star-sm";
    anim = "anim-soft";
    duration = `${4 + Math.random() * 6}s`;
    minOpacity = 0.1 + Math.random() * 0.15;
    maxOpacity = 0.35 + Math.random() * 0.2;
  } else if (rand < 0.78) {
    size = "star-md";
    anim = Math.random() > 0.6 ? "anim-flicker" : "anim-soft";
    duration = `${3 + Math.random() * 5}s`;
    minOpacity = 0.12 + Math.random() * 0.13;
    maxOpacity = 0.5 + Math.random() * 0.2;
  } else if (rand < 0.93) {
    size = "star-lg";
    anim = Math.random() > 0.6 ? "anim-flicker" : "anim-soft";
    duration = `${4 + Math.random() * 5}s`;
    minOpacity = 0.1 + Math.random() * 0.1;
    maxOpacity = 0.6 + Math.random() * 0.2;
  } else if (rand < 0.97) {
    size = "star-lg";
    anim = "anim-flash";
    duration = `${8 + Math.random() * 10}s`;
    minOpacity = 0.05 + Math.random() * 0.1;
    maxOpacity = 0.8 + Math.random() * 0.2;
  } else {
    size = "star-bright";
    anim = "anim-sparkle";
    duration = `${12 + Math.random() * 10}s`;
    minOpacity = 0.03 + Math.random() * 0.07;
    maxOpacity = 0.85 + Math.random() * 0.15;
  }

  return {
    id: i,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    size,
    anim,
    duration,
    delay: `${Math.random() * 10}s`,
    color: colorPick.color,
    glow: colorPick.glow,
    minOpacity,
    maxOpacity,
  };
}

export function StarField() {
  const stars = useMemo(() => {
    const result = [];
    for (let i = 0; i < 120; i++) {
      result.push(pickStarProps(i));
    }
    return result;
  }, []);

  return (
    <div className="star-field">
      {stars.map((star) => (
        <div
          key={star.id}
          className={`star ${star.size} ${star.anim}`}
          style={{
            left: star.left,
            top: star.top,
            "--twinkle-duration": star.duration,
            "--twinkle-delay": star.delay,
            "--star-color": star.color,
            "--star-glow": star.glow,
            "--star-min-opacity": star.minOpacity,
            "--star-max-opacity": star.maxOpacity,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
