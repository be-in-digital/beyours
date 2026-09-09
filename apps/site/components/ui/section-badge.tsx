export function SectionBadge({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-3 mb-6">
      <div className="badge-line" />
      <span className="text-xs sm:text-sm font-medium text-primary-ink tracking-widest uppercase">
        {text}
      </span>
      <div className="badge-line" />
    </div>
  );
}
