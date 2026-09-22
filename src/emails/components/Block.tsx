import type { CSSProperties, ReactNode } from 'react';


export function Block({
  className,
  style,
  align,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  align?: 'left' | 'center' | 'right';
  children?: ReactNode;
}) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} style={{ width: '100%' }}>
      <tbody>
        <tr>
          <td className={className} align={align} style={style}>
            {children}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
