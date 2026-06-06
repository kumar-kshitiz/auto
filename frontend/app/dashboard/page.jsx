'use client';

import React, { useEffect, useState } from 'react';
import { 
  FileText, CheckCircle2, Calendar, File, 
  Briefcase, GraduationCap, MapPin, Target,
  ExternalLink, Sparkles, Award, Search, Loader2
} from 'lucide-react';
import Link from 'next/link';
import { findJobs, scoreJD } from '../../services/api';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [jdText, setJdText] = useState("");
  const [jdScore, setJdScore] = useState(null);
  const [scoreError, setScoreError] = useState("");

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

  const handleFindJobs = async () => {
    if (!data || !data.id) {
      toast.error("Resume ID not found. Please upload again.");
      return;
    }
    
    setIsSearching(true);
    const toastId = toast.loading("Searching and ranking jobs...");
    
    try {
      const response = await findJobs(data.id);
      
      const updatedData = { ...data, jobResults: response.data.jobResults };
      setData(updatedData);
      localStorage.setItem('lastParsedResume', JSON.stringify(updatedData));
      
      toast.success("Jobs found successfully!", { id: toastId });
    } catch (error) {
      console.error("Error finding jobs:", error);
      toast.error("Failed to find jobs. Try again.", { id: toastId });
    } finally {
      setIsSearching(false);
    }
  };

  const handleScoreJD = async () => {
    if (!data || !data.id) {
      toast.error("Resume ID not found. Please upload again.");
      return;
    }

    if (!jdText.trim()) {
      setScoreError("Please paste the job description text to score it.");
      return;
    }

    setScoreError("");
    setIsScoring(true);
    const toastId = toast.loading("Scoring JD against your resume...");

    try {
      const response = await scoreJD(data.id, jdText);
      setJdScore(response);
      toast.success("JD scored successfully!", { id: toastId });
    } catch (error) {
      console.error("Error scoring JD:", error);
      setScoreError("Failed to score JD. Try again.");
      toast.error("Failed to score JD. Try again.", { id: toastId });
    } finally {
      setIsScoring(false);
    }
  };

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

  const formatRequiredExperience = (exp) => {
    if (!exp) return 'Not specified';
    if (typeof exp === 'string') return exp;
    if (typeof exp === 'number') return `${exp} year${exp === 1 ? '' : 's'}`;
    if (typeof exp === 'object') {
      if (exp.min != null || exp.max != null) {
        const minText = exp.min != null ? `${exp.min}${exp.max == null ? '+' : ''}` : null;
        const maxText = exp.max != null ? `${exp.max}` : null;
        if (minText && maxText) return `${minText} - ${maxText} years`;
        if (minText) return `${minText} years`;
        if (maxText) return `Up to ${maxText} years`;
      }
      return JSON.stringify(exp);
    }
    return String(exp);
  };

  const renderScoreDetail = (detail) => {
    if (detail == null) return 'No detail available';
    if (typeof detail === 'object') return JSON.stringify(detail);
    return detail;
  };

  const experienceDisplay = (() => {
    const exp = extractedProfile.experience;
    if (exp && typeof exp === 'object' && exp.totalMonths != null) {
      const years = exp.years || 0;
      const months = exp.months || 0;
      if (years > 0 && months > 0) return `${years}y ${months}m`;
      if (years > 0) return `${years} year${years === 1 ? '' : 's'}`;
      if (months > 0) return `${months} month${months === 1 ? '' : 's'}`;
    }

    const raw = extractedProfile.yearsOfExperience;
    if (typeof raw === 'number') return `${raw} year${raw === 1 ? '' : 's'}`;
    return `${raw || 0} years`;
  })();

  const isJdNotEligible = jdScore?.eligibility?.status === 'notEligible';
  const jdEligibilityReason = jdScore?.eligibility?.reason || "";

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
              {experienceDisplay} exp. • {extractedProfile.jobType}
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

      {/* JD Scoring */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Score a Job Description</h2>
            <p className="text-gray-500 mt-2 max-w-2xl">
              Paste the JD text below after your resume has been parsed. The system will score it using the built-in resume ↔ JD ranking logic.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleScoreJD}
              disabled={isScoring || !jdText.trim() || !data?.id}
              className="inline-flex items-center justify-center px-5 py-3 rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isScoring ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                  Scoring JD...
                </>
              ) : (
                "Score JD"
              )}
            </button>
            <button
              type="button"
              onClick={() => { setJdText(""); setJdScore(null); setScoreError(""); }}
              className="inline-flex items-center justify-center px-5 py-3 rounded-xl text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        <textarea
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          placeholder="Paste the full job description here..."
          className="w-full min-h-[180px] rounded-2xl border border-gray-200 p-4 text-sm text-gray-900 resize-none focus:border-indigo-500 focus:ring-indigo-100 focus:outline-none"
        />

        {scoreError ? (
          <p className="mt-3 text-sm text-red-600">{scoreError}</p>
        ) : null}

        {isJdNotEligible ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm font-semibold text-red-700">Not Eligible</p>
            <p className="mt-3 text-sm text-red-600">{jdEligibilityReason || 'Your resume does not match the job description eligibility requirements.'}</p>
          </div>
        ) : null}

        {jdScore && !isJdNotEligible ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-gray-100 p-5 bg-slate-50">
              <p className="text-sm text-gray-500">Overall JD Fit</p>
              <p className="mt-3 text-4xl font-bold text-indigo-700">{jdScore.scoreReport.total}%</p>
              <p className="mt-2 text-sm text-gray-600">{jdScore.scoreReport.tier === 'fresher' ? 'Fresher match' : 'Experienced match'}</p>
            </div>
            <div className="rounded-2xl border border-gray-100 p-5 bg-slate-50">
              <p className="text-sm text-gray-500">Recommendation</p>
              <p className="mt-3 text-base font-semibold text-gray-900">{jdScore.scoreReport.recommendation}</p>
            </div>
            <div className="rounded-2xl border border-gray-100 p-5 bg-slate-50">
              <p className="text-sm text-gray-500">JD Title</p>
              <p className="mt-3 text-base font-semibold text-gray-900">{jdScore.jdProfile.title || 'Parsed JD'}</p>
              <p className="mt-2 text-sm text-gray-600">Required exp: {formatRequiredExperience(jdScore.jdProfile.requiredExperience)}</p>
            </div>
          </div>
        ) : null}

        {jdScore && !isJdNotEligible ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 p-5 bg-white">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Strengths</h3>
              <ul className="list-disc pl-5 text-sm text-gray-700 space-y-2">
                {jdScore.scoreReport.strengths.length > 0 ? (
                  jdScore.scoreReport.strengths.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))
                ) : (
                  <li>No strong matches detected yet.</li>
                )}
              </ul>
            </div>
            <div className="rounded-2xl border border-gray-100 p-5 bg-white">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Gaps</h3>
              <ul className="list-disc pl-5 text-sm text-gray-700 space-y-2">
                {jdScore.scoreReport.gaps.length > 0 ? (
                  jdScore.scoreReport.gaps.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))
                ) : (
                  <li>No major gaps detected.</li>
                )}
              </ul>
            </div>
          </div>
        ) : null}

        {jdScore && !isJdNotEligible ? (
          <div className="mt-6 bg-gray-50 rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Score Breakdown</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(jdScore.scoreReport.breakdown).map(([key, value]) => (
                <div key={key} className="rounded-2xl border border-gray-200 p-4 bg-white">
                  <p className="text-sm text-gray-500 uppercase tracking-wide">{key}</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">{value.score}%</p>
                  <p className="mt-2 text-sm text-gray-600">{renderScoreDetail(value.detail)}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
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
            <Search className="h-16 w-16 text-indigo-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-800">Ready to find matches?</h3>
            <p className="text-gray-500 mt-2 mb-6 max-w-md mx-auto">
              Your profile is parsed and ready. Click below to search for the best job matches based on your skills and experience.
            </p>
            <button
              onClick={handleFindJobs}
              disabled={isSearching}
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSearching ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                  Searching Jobs...
                </>
              ) : (
                <>
                  Find Jobs
                  <Search className="ml-2 h-5 w-5" />
                </>
              )}
            </button>
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