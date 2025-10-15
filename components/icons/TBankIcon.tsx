import type { SVGProps } from 'react';

export function TBankIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="16" cy="16" r="15" fill="#FFDD2D" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.6 11.2c0-.884.716-1.6 1.6-1.6h9.6c.884 0 1.6.716 1.6 1.6v1.6c0 .884-.716 1.6-1.6 1.6h-2.4v8c0 .884-.716 1.6-1.6 1.6h-1.6c-.884 0-1.6-.716-1.6-1.6v-8H11.2c-.884 0-1.6-.716-1.6-1.6v-1.6Z"
        fill="#1A1A1A"
      />
      <path
        d="M12 9l-1.5-2.4c-.24-.384.037-.864.48-.864h10.04c.442 0 .718.48.48.864L20 9h-8Z"
        fill="#1A1A1A"
      />
    </svg>
  );
}
