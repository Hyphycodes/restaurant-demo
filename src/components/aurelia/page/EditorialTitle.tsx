/**
 * Sets an admin-written heading in the house style: the first sentence in
 * roman, the rest in candlelit italic. A single sentence italicises its last
 * two words. Editors write plain text; the page does the typography.
 */
export function EditorialTitle({ text }: { text: string }) {
  const sentences = text.match(/[^.!?]+[.!?]+["”’]?\s*|[^.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) ?? [text];
  if (sentences.length > 1) {
    return (
      <>
        {sentences[0]} <em>{sentences.slice(1).join(' ')}</em>
      </>
    );
  }
  const words = text.trim().split(/\s+/);
  if (words.length < 4) return <>{text}</>;
  return (
    <>
      {words.slice(0, -2).join(' ')} <em>{words.slice(-2).join(' ')}</em>
    </>
  );
}
