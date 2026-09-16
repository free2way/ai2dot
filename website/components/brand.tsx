import Link from "next/link";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link className="brand" href={href} aria-label="AI2Dot home">
      <span className="brand-mark" aria-hidden="true">
        <span />
      </span>
      <span className="brand-name">AI2DOT</span>
    </Link>
  );
}
