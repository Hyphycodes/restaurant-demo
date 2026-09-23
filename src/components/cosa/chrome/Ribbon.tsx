import Link from 'next/link';

/**
 * The one honest line on every public page. Tasteful, never hidden: this is a
 * fictional supper club running on a real restaurant platform.
 */
export function Ribbon() {
  return (
    <div className="cn-ribbon">
      <span className="cn-ribbon-dot" aria-hidden="true" />
      <span>
        <strong>A fictional supper club.</strong> A real restaurant platform.
      </span>
      <Link href="/demo">
        Explore the platform <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
