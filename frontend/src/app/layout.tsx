import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GoPratle | Post an event requirement',
  description: 'Tell GoPratle exactly what your event needs.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
