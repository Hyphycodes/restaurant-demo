'use client';

import { useEffect, useState } from 'react';

/** The course index: follows the reader down the menu. */
export function MenuIndex({ groups }: { groups: { label: string; items: { id: string; name: string }[] }[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const ids = groups.flatMap((group) => group.items.map((item) => item.id));
    const nodes = ids.map((id) => document.getElementById(id)).filter((node): node is HTMLElement => Boolean(node));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [groups]);

  return (
    <nav className="cn-menu-index" aria-label="Menu sections">
      {groups.map((group) => (
        <div key={group.label} className="cn-menu-index-group">
          <span className="cn-eyebrow">{group.label}</span>
          <ul>
            {group.items.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} aria-current={active === item.id ? 'true' : undefined}>
                  {item.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
