'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import { UploadCloud, File, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadResume } from '../services/api';

export default function ResumeUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds 5MB limit.');
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading('Uploading and analyzing your resume...');

    try {
      const response = await uploadResume(file);
      toast.success('Resume parsed successfully!', { id: toastId });
      
      // Store result in localStorage for dashboard to pick up
      localStorage.setItem('lastParsedResume', JSON.stringify(response.data));
      
      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      console.error(error);
      const errorMessage = error?.response?.data?.error || 'Failed to process resume. Please try again.';
      toast.error(errorMessage, { id: toastId });
    } finally {
      setIsUploading(false);
    }
  }, [router]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    disabled: isUploading
  });

  return (
    <div className="w-full max-w-2xl mx-auto mt-10">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300 ${
          isDragActive ? 'border-blue-500 bg-blue-50/50' : 
          isDragReject ? 'border-red-500 bg-red-50/50' : 
          'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center space-y-4">
          {isUploading ? (
            <Loader2 className="h-16 w-16 text-blue-500 animate-spin" />
          ) : isDragReject ? (
            <AlertCircle className="h-16 w-16 text-red-500" />
          ) : isDragActive ? (
            <CheckCircle className="h-16 w-16 text-blue-500" />
          ) : (
            <UploadCloud className="h-16 w-16 text-gray-400" />
          )}
          
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-gray-800">
              {isUploading ? 'Processing...' : 
               isDragActive ? 'Drop your resume here' : 
               'Drag & drop your resume here'}
            </h3>
            <p className="text-gray-500">
              {isUploading ? 'Extracting skills and text from your PDF' : 
               'or click to browse from your computer'}
            </p>
          </div>
          
          {!isUploading && (
            <div className="text-sm text-gray-400 mt-4">
              Supported format: PDF (Max size: 5MB)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
