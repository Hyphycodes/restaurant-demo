'use client';

import { useEffect, useRef, useState } from 'react';
import type { PublicAsset } from '@/content/media';


export function AssetVideo({
  asset,
  className = '',
  mobileBelow = 768,
  objectPosition,
}: {
  /**
   * Resolved by the server parent. A client component cannot read the media
   * store itself, and passing the record down is what lets a video swapped in
   * the admin actually reach the page.
   */
  asset: PublicAsset;
  className?: string;
  mobileBelow?: number;
  /** Overrides the record's focal point for this placement. */
  objectPosition?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const narrow = window.matchMedia(`(max-width: ${mobileBelow - 1}px)`).matches;

    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
    ).connection;
    const saveData = connection?.saveData === true;
    const slow = connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g';

    setEnabled(!reduced && !narrow && !saveData && !slow);
  }, [mobileBelow]);

  const poster = asset.poster ?? undefined;

  return (
    <div className={`relative overflow-hidden bg-espresso ${className}`}>
      {}
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 size-full object-cover"
          style={{ objectPosition: objectPosition ?? asset.focal }}
        />
      ) : null}

      {enabled && asset.path ? (
        <video
          ref={videoRef}
          className="absolute inset-0 size-full object-cover"
          style={{ objectPosition: objectPosition ?? asset.focal }}
          src={asset.path}
          poster={poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
        />
      ) : null}
    </div>
  );
}
