/** Turn a camera/file name into a friendly label staff can recognise. */
export function friendlyFileName(name: string): string {
  const words = name
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return words ? words.replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Casa Aurelia media';
}
