import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import path from 'node:path';

// Run after downloading the licensed originals documented in docs/MEDIA.md into /tmp/cosa-media.
async function main() {
const ROOT=process.cwd();
const svg=(body:string,w=900,h=1125,bg='#eee5d6')=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 900 1125"><rect width="900" height="1125" fill="${bg}"/>${body}</svg>`;
const person=(x:number,y:number,rotation=0)=>`<g transform="translate(${x} ${y}) rotate(${rotation})" stroke="#d4b88a" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="0" cy="0" rx="29" ry="36" fill="#d4b88a"/><path d="M-22 42 Q-66 100 -53 193 L39 193 Q56 96 20 42Z" fill="#6f292d"/><path d="M-30 82 L-102 148 L-149 96 M34 80 L95 30 L121 -7 M-32 193 L-64 317 L-117 324 M27 193 L74 310 L119 326" fill="none"/><path d="M91 -40 L152 -40 L123 -7 L123 24 M108 25 L138 25" fill="none" stroke-width="5"/></g>`;
const plate=`<g stroke="#b99b69" fill="none" stroke-width="4"><ellipse cx="450" cy="750" rx="200" ry="90"/><ellipse cx="450" cy="750" rx="157" ry="58"/><path d="M380 725q100-110 130 10q-140 85-123 0q160-66 125 0q-130 40-87 20" stroke-width="13"/></g>`;
const themes=[['vinyl-vermouth','#23382f',`<g stroke="#b99b69" fill="none"><circle cx="680" cy="330" r="145" stroke-width="3"/><circle cx="680" cy="330" r="117"/><circle cx="680" cy="330" r="88"/><circle cx="680" cy="330" r="31" fill="#6f292d"/></g>${person(360,460,-10)}`],['sunday-supper','#6f292d',`${person(240,400,-8)}${person(650,430,12)}${plate}`],['after-hours-friday','#241b19',`${person(320,450,-20)}${person(620,470,18)}`],['after-hours-saturday','#241b19',`${person(320,450,15)}${person(620,470,-18)}`],['aperitivo-club','#444531',`${person(390,420,7)}<path d="M520 790h160m-80 0v-130m-70-60h140l-70 70Z" stroke="#d4b88a" stroke-width="6" fill="none"/>`]];
await mkdir('public/events',{recursive:true});await mkdir('public/art',{recursive:true});await mkdir('public/media',{recursive:true});
for(const [slug,bg,body] of themes){
 const art=svg(`<path d="M40 40h820v1045H40z" stroke="#b99b69" fill="none" opacity=".35"/>${body}`,900,1125,bg);
 for(const [suffix,width,height] of [['',1600,900],['-640',640,360],['-tall',900,1125],['-tall-448',448,560]] as const) await sharp(Buffer.from(art)).resize(width,height,{fit:'cover'}).webp({quality:85}).toFile(`public/events/${slug}${suffix}.webp`);
 await writeFile(`public/art/${slug}.svg`,art);
}
const data:Record<string,unknown>={};
const entries=[['brandLogo','logo','Cosa Nostra Italian Supper Club',1000,260],['heroImage','room','An intimate dining room with dark upholstery and softly lit tables',1800,1200],['backBar','bartender','Cocktail preparation in warm evening light',1000,1200],['exteriorSign','sign','Cosa Nostra fictional supper club entrance artwork',900,1125],['diningRoom','room','Candlelit tables and upholstered chairs in an elegant dining room',1000,1200],['signaturePasta','pasta','Spaghetti and meatballs with tomato sauce and fresh basil',1200,1000],['roomAtmosphere','room','An intimate corner with warm light and dark furniture',1200,800],['bartender','bartender','A bartender measuring a cocktail beside elegant glassware',900,1000],['dishPasta','pasta','Italian pasta served with meatballs and herbs',1200,900],['burrataPlate','burrata','Burrata, prosciutto and basil on a decorative Italian plate',1200,900],['cocktailPour','bartender','Hands preparing a cocktail at the bar',1000,1000],['houseNegroni','negroni','A red Negroni over a large ice cube on a marble table',1000,1200],['roomCrowd','room','The supper club dining atmosphere, set for an evening together',1200,900],['cocktailPair','negroni','A classic Italian aperitivo in a low glass',1200,900],['flyerFridays','after-hours-friday','Editorial illustration of guests dancing with cocktails',900,1125],['flyerSaturday','after-hours-saturday','Two illustrated supper club guests enjoying the evening',900,1125],['privateEvents','room','Elegant tables for a private dinner',1200,900],['birthdayCelebration','burrata','Italian antipasti made for a celebratory table',1200,900],['flyerVinyl','vinyl-vermouth','Vinyl and Vermouth editorial illustration',900,1125],['flyerSupper','sunday-supper','Sunday Supper editorial illustration',900,1125],['flyerAperitivo','aperitivo-club','Aperitivo Club editorial illustration',900,1125],['teamEnergy','bartender','Thoughtful cocktail service for the evening',1200,800]] as const;
for(const [id,source,alt,width,height] of entries){
 const dest=`/media/${id}.webp`;
 let input:Buffer;
 if(source==='logo') input=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="260"><rect width="1000" height="260" fill="#eee5d6"/><text x="500" y="139" text-anchor="middle" font-family="Georgia,serif" font-size="95" letter-spacing="10" fill="#341f1c">COSA NOSTRA</text><text x="500" y="207" text-anchor="middle" font-family="Arial,sans-serif" font-size="23" letter-spacing="12" fill="#713239">ITALIAN SUPPER CLUB</text></svg>`);
 else if(source==='sign') input=Buffer.from(svg(`<rect x="140" y="150" width="620" height="825" rx="300" fill="#241b19" stroke="#b99b69" stroke-width="4"/><text x="450" y="510" text-anchor="middle" fill="#eee5d6" font-family="Georgia" font-size="78">COSA</text><text x="450" y="605" text-anchor="middle" fill="#eee5d6" font-family="Georgia" font-size="78">NOSTRA</text><text x="450" y="708" text-anchor="middle" fill="#b99b69" font-family="Arial" font-size="23" letter-spacing="7">WEST LOOP · CHICAGO</text><path d="M350 785h200" stroke="#b99b69"/>`,900,1125,'#4a3029'));
 else if(themes.some(([slug])=>slug===source)) input=await readFile(`public/art/${source}.svg`);
 else input=await readFile(`/tmp/cosa-media/${source}.jpg`);
 await sharp(input).resize(width,height,{fit:'cover'}).webp({quality:80}).toFile(path.join(ROOT,'public',dest));
 data[id]={path:dest,kind:'image',alt,width,height,ratio:`${width}:${height}`,focal:'50% 50%',status:source==='logo'?'brand':'final',usage:[`Cosa Nostra ${id} semantic slot`],containsText:['logo','sign'].includes(source)?'brand':'none',maxBytes:500000};
}
const old=await readFile('src/content/assets.ts','utf8');
const header=old.slice(0,old.indexOf('export const assets ='));
await writeFile('src/content/assets.ts',header+`export const assets = ${JSON.stringify(data,null,2)} as const satisfies Record<string, AssetRecord>;\nexport type AssetId = keyof typeof assets;\nexport function getAsset(id: AssetId):AssetRecord {return assets[id];}\nexport function ratioToCss(record:Pick<AssetRecord,'ratio'>):string{return record.ratio.replace(':',' / ');}\n`);
const icon='<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="20" fill="#341f1c"/><text x="64" y="84" text-anchor="middle" font-family="Georgia" font-size="65" fill="#eee5d6">CN</text></svg>';
await writeFile('public/favicon.svg',icon);await sharp(Buffer.from(icon)).resize(180,180).png().toFile('public/apple-touch-icon.png');
console.log('Created new local media and editorial illustrations.');

}
main().catch(e=>{console.error(e);process.exit(1)});
