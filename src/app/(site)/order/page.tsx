import type { Metadata } from 'next';
import { PickupOrder, type PickupItem } from '@/components/cosa/guest/PickupOrder';
import { PageHero } from '@/components/cosa/page/PageHero';
import { getAllMenus } from '@/content/resolve';

export const metadata: Metadata = {
  title: 'Order for pickup — Cosa Nostra',
  description: 'Build a sample pickup order from the Cosa Nostra menu. A demonstration: no payment is collected.',
};

const TRAVELS = new Set(['antipasti', 'pasta', 'mains', 'sides', 'dessert']);

export default async function OrderPage() {
  const menus = await getAllMenus();
  const items: PickupItem[] = (menus.find((menu) => menu.slug === 'food')?.categories ?? [])
    .filter((category) => TRAVELS.has(category.id))
    .flatMap((category) =>
      category.items
        .filter((item) => item.available && item.priceCents != null)
        .map((item) => ({ id: item.id, name: item.name, description: item.description, priceCents: item.priceCents!, course: category.name })),
    );

  return (
    <>
      <PageHero
        eyebrow="Pickup"
        title={
          <>
            Bring a little of <em>the evening home.</em>
          </>
        }
        lede="The same kitchen, packed to travel. Order from the live menu; pick up at the side door from four."
        asset="pastaNight"
        focus={{ x: '55%', y: '40%' }}
        compact
      />
      <section className="cn-night cn-section-tight" aria-label="Build your order">
        <div className="cn-wrap">
          <PickupOrder items={items} />
        </div>
      </section>
    </>
  );
}
