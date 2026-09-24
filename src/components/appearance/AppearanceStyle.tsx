import { cssFor, resolveLook, type Appearance } from '@/lib/appearance/presets';


export function AppearanceStyle({ appearance }: { appearance: Appearance }) {
  const look = resolveLook(appearance);
  const css = [
    cssFor(':root', look.vars),
    appearance.adminFollowsSite ? cssFor("[data-admin-look='site']", look.vars) : '',
  ].join('');
  return <style id="casa-aurelia-appearance" data-preset={look.preset}>{css}</style>;
}
