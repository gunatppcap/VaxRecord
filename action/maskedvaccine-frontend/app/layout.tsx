import './globals.css'

export const metadata = {
  title: 'MaskedVaccine - 疫苗接种加密记录',
  description: '基于 FHEVM 的隐私优先疫苗接种记录系统',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body>{children}</body>
    </html>
  );
}



