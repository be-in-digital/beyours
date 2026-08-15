interface NoiseLayerProps {
  opacity?: number;
  className?: string;
}

export function NoiseLayer({ opacity = 0.025, className }: NoiseLayerProps) {
  return (
    <div
      aria-hidden="true"
      className={`noise-overlay ${className ?? ""}`}
      style={{ opacity }}
    />
  );
}
