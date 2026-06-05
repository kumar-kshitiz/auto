import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

export const uploadResume = async (file) => {
  const formData = new FormData();
  formData.append('resume', file);

  const response = await apiClient.post('/resume/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

export const findJobs = async (resumeId) => {
  const response = await apiClient.get(`/resume/${resumeId}/jobs`);
  return response.data;
};
