export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-lockup" aria-label="Dot">
      <span className="brand-orbit" aria-hidden="true">
        <span />
      </span>
      {!compact && <span className="brand-word">dot</span>}
    </span>
  );
}
