 'use client';

import React, { useEffect, useState } from 'react';
import { FileText, CheckCircle2, Calendar, File } from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const storedData = localStorage.getItem('lastParsedResume');
    if (storedData) {
      try {
        setData(JSON.parse(storedData));
      } catch (e) {
        console.error('Failed to parse stored resume data');
      }
    }
  }, []);

  if (!isMounted) return null;

  if (!data) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center max-w-md w-full">
          <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">No Resume Found</h2>
          <p className="text-gray-500 mb-6">
            You haven't uploaded a resume yet, or your session has expired.
          </p>
          <Link 
            href="/" 
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 transition-colors w-full"
          >
            Upload Resume
          </Link>
        </div>
      </div>
    );
  }

  const date = new Date(data.createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-2">View your parsed resume details and extracted skills.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column - Metadata & Skills */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-3 mb-4 flex items-center">
              <File className="h-5 w-5 mr-2 text-blue-500" />
              File Details
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Filename</p>
                <p className="text-sm text-gray-800 mt-1 truncate" title={data.filename}>
                  {data.filename}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Parsed On</p>
                <p className="text-sm text-gray-800 mt-1 flex items-center">
                  <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                  {date}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Database ID</p>
                <p className="text-xs text-gray-500 mt-1 truncate font-mono">
                  {data.id}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-3 mb-4 flex items-center">
              <CheckCircle2 className="h-5 w-5 mr-2 text-green-500" />
              Extracted Skills
            </h3>
            
            {data.extractedSkills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {data.extractedSkills.map((skill, index) => (
                  <span 
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-100"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No targeted skills were found in this resume.</p>
            )}
          </div>
        </div>

        {/* Right Column - Text Preview */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-full flex flex-col">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-3 mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-gray-500" />
              Parsed Text Preview
            </h3>
            <div className="bg-gray-50 rounded-xl p-4 flex-grow overflow-auto max-h-[600px]">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                {data.extractedText}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}