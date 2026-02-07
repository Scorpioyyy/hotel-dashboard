import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: '花园酒店评论分析',
  description: '酒店评论数据分析与智能问答平台',
};

function Navigation() {
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <span className="text-lg font-semibold text-gray-900">花园酒店评论分析</span>
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/" className="px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600 transition-colors">
              评论浏览
            </Link>
            <Link href="/dashboard" className="px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600 transition-colors">
              数据看板
            </Link>
            <Link href="/qa" className="px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600 transition-colors">
              智能问答
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full overflow-hidden">
      <body className="antialiased bg-gray-50 h-full flex flex-col overflow-hidden">
        <Navigation />
        <main className="flex-1 min-h-0 overflow-auto">{children}</main>
      </body>
    </html>
  );
}
