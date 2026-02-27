import { useMemo } from "react";

export function StarField() {
  const stars = useMemo(() => {
    const result = [];
    for (let i = 0; i < 80; i++) {
      const size = Math.random() > 0.85 ? "star-lg" : Math.random() > 0.5 ? "star-md" : "star-sm";
      result.push({
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size,
        twinkleDuration: `${2 + Math.random() * 4}s`,
        twinkleDelay: `${Math.random() * 5}s`,
      });
    }
    return result;
  }, []);

  return (
    <div className="star-field">
      {stars.map((star) => (
        <div
          key={star.id}
          className={`star ${star.size} animate-twinkle`}
          style={{
            left: star.left,
            top: star.top,
            "--twinkle-duration": star.twinkleDuration,
            "--twinkle-delay": star.twinkleDelay,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
