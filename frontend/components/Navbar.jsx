import Link from 'next/link';
import { Briefcase } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="border-b border-gray-200 bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <Briefcase className="h-8 w-8 text-blue-600" />
              <span className="font-bold text-xl text-gray-900 tracking-tight">
                AI Matcher
              </span>
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/" className="text-gray-500 hover:text-gray-900 font-medium">
              Upload
            </Link>
            <Link href="/dashboard" className="text-gray-500 hover:text-gray-900 font-medium">
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
