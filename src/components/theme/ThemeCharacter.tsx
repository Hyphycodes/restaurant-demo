/** Original editorial line illustrations, independent of seasonal client assets. */
export type ThemeCharacterName = 'supper-guests'|'dancer'|'aperitivo'|'selector'|'pasta-couple'|'host'|'martini'|'night-guests'|'record-collector';
const art:Record<ThemeCharacterName,string>={'supper-guests':'sunday-supper','dancer':'after-hours-friday','aperitivo':'aperitivo-club','selector':'vinyl-vermouth','pasta-couple':'sunday-supper','host':'aperitivo-club','martini':'vinyl-vermouth','night-guests':'after-hours-saturday','record-collector':'vinyl-vermouth'};
export function ThemeCharacter({name,className=''}:{name:ThemeCharacterName;className?:string}) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/art/${art[name]}.svg`} alt="" aria-hidden width={180} height={225} loading="lazy" className={`theme-character ${className}`}/>;
}
