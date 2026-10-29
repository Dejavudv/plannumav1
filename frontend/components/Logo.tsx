export function Logo({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" style={{ flex: "none" }}>
      <defs>
        <linearGradient id="plg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4A2A7A" /><stop offset="1" stopColor="#25133F" /></linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#plg)" />
      {Array.from({ length: 9 }, (_, i) => {
        const r = Math.floor(i / 3), c = i % 3, acc = r === 0 && c === 2;
        return <rect key={i} x={106 + c * 108} y={106 + r * 108} width="84" height="84" rx="26" fill={acc ? "#B8F25B" : "#E9E0FA"} />;
      })}
    </svg>
  );
}
