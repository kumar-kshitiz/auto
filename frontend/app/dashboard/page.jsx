'use client';

import React, { useEffect, useState } from 'react';
import { 
  FileText, CheckCircle2, Calendar, File, 
  Briefcase, GraduationCap, MapPin, Target,
  ExternalLink, Sparkles, Award
} from 'lucide-react';
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

  if (!data || !data.extractedProfile) {
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

  const { extractedProfile, jobResults, filename, createdAt } = data;
  const date = new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Your Career Matches</h1>
          <p className="text-gray-500 mt-2 flex items-center">
            <File className="h-4 w-4 mr-2" />
            Analyzed {filename} on {date}
          </p>
        </div>
        <Link 
          href="/" 
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
        >
          Upload New Resume
        </Link>
      </div>

      {/* Profile Summary */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-8 text-white">
          <h2 className="text-2xl font-bold mb-1">{extractedProfile.name || "Candidate Profile"}</h2>
          <div className="flex flex-wrap gap-4 mt-4 text-blue-100 text-sm">
            <div className="flex items-center">
              <GraduationCap className="h-4 w-4 mr-2" />
              {extractedProfile.educationLevel} • {extractedProfile.educationDomain}
            </div>
            <div className="flex items-center">
              <Briefcase className="h-4 w-4 mr-2" />
              {extractedProfile.yearsOfExperience} years exp. • {extractedProfile.jobType}
            </div>
            <div className="flex items-center">
              <MapPin className="h-4 w-4 mr-2" />
              {(extractedProfile.preferredLocations || []).join(", ") || "India"}
            </div>
          </div>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3 flex items-center">
              <Target className="h-4 w-4 mr-2 text-blue-500" />
              Target Roles
            </h3>
            <div className="flex flex-wrap gap-2">
              {(extractedProfile.targetRoles || []).map((role, idx) => (
                <span key={idx} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium border border-blue-100">
                  {role}
                </span>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3 flex items-center">
              <Sparkles className="h-4 w-4 mr-2 text-purple-500" />
              Top Skills
            </h3>
            <div className="flex flex-wrap gap-2">
              {(extractedProfile.skills || []).map((skill, idx) => (
                <span key={idx} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-md text-sm">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Job Listings */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <Briefcase className="h-6 w-6 mr-3 text-indigo-600" />
            Top Matching Opportunities
          </h2>
          <span className="bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full">
            {jobResults?.length || 0} found
          </span>
        </div>

        {(!jobResults || jobResults.length === 0) ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
            <h3 className="text-xl font-medium text-gray-800">No strong matches found yet.</h3>
            <p className="text-gray-500 mt-2">Try updating your resume with more specific skills and roles.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {jobResults.map((job, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex flex-col h-full relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-50 border border-green-100">
                    <span className="text-green-700 font-bold text-sm">{job.score}</span>
                  </div>
                </div>
                
                <div className="pr-12 mb-4">
                  <p className="text-sm text-indigo-600 font-medium mb-1">{job.portal}</p>
                  <h3 className="text-lg font-bold text-gray-900 leading-tight">
                    {job.title}
                  </h3>
                </div>
                
                <div className="flex-grow">
                  <div className="bg-blue-50/50 rounded-xl p-4 text-sm text-gray-700 mb-6 border border-blue-50">
                    <p className="flex items-start">
                      <CheckCircle2 className="h-4 w-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span>{job.reason}</span>
                    </p>
                  </div>
                </div>
                
                <a 
                  href={job.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="mt-auto inline-flex items-center justify-center w-full px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                  Apply Now
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}