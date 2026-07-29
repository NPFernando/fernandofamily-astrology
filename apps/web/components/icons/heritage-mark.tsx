import type { SVGProps } from "react";

// A code-native, scalable app mark. The moonstone-inspired rings and lotus
// geometry are cultural cues, not sacred religious emblems.
export function HeritageMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className} fill="none" {...props}>
      <defs>
        <linearGradient id="heritage-mark-brass" x1="12" y1="10" x2="53" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f4d58a" />
          <stop offset="0.48" stopColor="#b88a35" />
          <stop offset="1" stopColor="#87591a" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="#13213f" stroke="url(#heritage-mark-brass)" strokeWidth="2" />
      <circle cx="32" cy="32" r="20" stroke="url(#heritage-mark-brass)" strokeWidth="1.5" opacity="0.9" />
      <path d="M32 15c5.6 6.9 8.5 12.8 8.5 17.6A8.5 8.5 0 1 1 23.5 32.6C23.5 27.8 26.4 21.9 32 15Z" fill="url(#heritage-mark-brass)" />
      <path d="M16 43c6.2-1 11.5 1.2 16 6.5 4.5-5.3 9.8-7.5 16-6.5-3.8 5.7-9.1 8.5-16 8.5S19.8 48.7 16 43Z" fill="url(#heritage-mark-brass)" opacity="0.95" />
      <path d="M22 39c3.8-1.2 7.1-.5 10 2.1M42 39c-3.8-1.2-7.1-.5-10 2.1" stroke="url(#heritage-mark-brass)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="32" cy="32" r="3.5" fill="#13213f" stroke="#f4d58a" strokeWidth="1.2" />
    </svg>
  );
}
