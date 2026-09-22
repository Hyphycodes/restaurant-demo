import { ratioOf, type PublicAsset } from '@/content/media';


export function Placeholder({
  asset,
  id,
  className = '',
  tone = 'light',
}: {
  asset: Pick<PublicAsset, 'ratio' | 'width' | 'height'>;
  id: string;
  className?: string;
  tone?: 'light' | 'dark';
}) {
  const surface = tone === 'dark' ? 'bg-espresso-lift' : 'bg-sand-deep';
  const mark = tone === 'dark' ? 'text-night-text opacity-[0.10]' : 'text-brown opacity-[0.08]';

  return (
    <div
      aria-hidden="true"
      className={`relative flex items-center justify-center overflow-hidden ${surface} ${className}`}
      style={{ aspectRatio: ratioOf(asset) }}
      data-asset-placeholder={id}
    >
      <svg viewBox="0 0 100 100" className={`w-[22%] max-w-24 ${mark}`} fill="currentColor">
        <path d="M50 4a46 46 0 1 0 0 92 46 46 0 0 0 0-92Zm0 16a30 30 0 1 1 0 60 30 30 0 0 1 0-60Z" />
      </svg>
    </div>
  );
}
