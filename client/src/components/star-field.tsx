import { useMemo } from "react";
import { useTheme } from "./theme-provider";

const STAR_COLORS = [
  { color: "white", glow: "rgba(255, 255, 255, 0.5)" },
  { color: "#c8c8ff", glow: "rgba(180, 170, 255, 0.5)" },
  { color: "#ffe8c8", glow: "rgba(255, 220, 180, 0.5)" },
  { color: "#c8dfff", glow: "rgba(180, 200, 255, 0.5)" },
  { color: "#ffd0d0", glow: "rgba(255, 200, 200, 0.4)" },
];

const LIGHT_SPARKLE_COLORS = [
  { color: "rgba(139, 92, 246, 0.5)", glow: "rgba(139, 92, 246, 0.3)" },
  { color: "rgba(99, 102, 241, 0.4)", glow: "rgba(99, 102, 241, 0.25)" },
  { color: "rgba(168, 85, 247, 0.45)", glow: "rgba(168, 85, 247, 0.25)" },
];

type StarAnim = "anim-soft" | "anim-flash" | "anim-flicker" | "anim-sparkle";

function pickDarkStarProps(i: number) {
  const rand = Math.random();
  const colorPick = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];

  let size: string;
  let anim: StarAnim;
  let duration: string;
  let minOpacity: number;
  let maxOpacity: number;

  if (rand < 0.45) {
    size = "star-sm";
    anim = "anim-soft";
    duration = `${3 + Math.random() * 5}s`;
    minOpacity = 0.1 + Math.random() * 0.15;
    maxOpacity = 0.4 + Math.random() * 0.2;
  } else if (rand < 0.75) {
    size = "star-md";
    anim = Math.random() > 0.5 ? "anim-soft" : "anim-flicker";
    duration = `${2.5 + Math.random() * 4}s`;
    minOpacity = 0.15 + Math.random() * 0.15;
    maxOpacity = 0.6 + Math.random() * 0.25;
  } else if (rand < 0.9) {
    size = "star-lg";
    anim = Math.random() > 0.4 ? "anim-flicker" : "anim-flash";
    duration = `${4 + Math.random() * 6}s`;
    minOpacity = 0.1 + Math.random() * 0.15;
    maxOpacity = 0.7 + Math.random() * 0.3;
  } else {
    size = "star-bright";
    anim = Math.random() > 0.5 ? "anim-sparkle" : "anim-flash";
    duration = `${6 + Math.random() * 8}s`;
    minOpacity = 0.05 + Math.random() * 0.1;
    maxOpacity = 0.9 + Math.random() * 0.1;
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

function pickCornerSparkle(i: number) {
  const colorPick = LIGHT_SPARKLE_COLORS[Math.floor(Math.random() * LIGHT_SPARKLE_COLORS.length)];
  const corner = Math.floor(Math.random() * 4);

  let left: string;
  let top: string;

  if (corner === 0) {
    left = `${Math.random() * 15}%`;
    top = `${Math.random() * 15}%`;
  } else if (corner === 1) {
    left = `${85 + Math.random() * 15}%`;
    top = `${Math.random() * 15}%`;
  } else if (corner === 2) {
    left = `${Math.random() * 15}%`;
    top = `${85 + Math.random() * 15}%`;
  } else {
    left = `${85 + Math.random() * 15}%`;
    top = `${85 + Math.random() * 15}%`;
  }

  const anim: StarAnim = Math.random() > 0.4 ? "anim-sparkle" : "anim-flash";

  return {
    id: i,
    left,
    top,
    size: Math.random() > 0.5 ? "star-bright" : "star-lg",
    anim,
    duration: `${8 + Math.random() * 12}s`,
    delay: `${Math.random() * 15}s`,
    color: colorPick.color,
    glow: colorPick.glow,
    minOpacity: 0,
    maxOpacity: 0.6 + Math.random() * 0.4,
  };
}

export function StarField() {
  const { theme } = useTheme();

  const darkStars = useMemo(() => {
    const result = [];
    for (let i = 0; i < 120; i++) {
      result.push(pickDarkStarProps(i));
    }
    return result;
  }, []);

  const lightSparkles = useMemo(() => {
    const result = [];
    for (let i = 0; i < 20; i++) {
      result.push(pickCornerSparkle(i));
    }
    return result;
  }, []);

  const stars = theme === "dark" ? darkStars : lightSparkles;

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
