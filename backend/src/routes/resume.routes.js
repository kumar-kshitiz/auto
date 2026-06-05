import { Router } from 'express';
import { uploadResume, findJobs } from '../controllers/resume.controller.js';
import { upload } from '../middleware/upload.middleware.js';

const router = Router();

// Endpoint for uploading and parsing resume
router.post('/upload', upload.single('resume'), uploadResume);

// Endpoint for fetching and ranking jobs
router.get('/:id/jobs', findJobs);

export default router;
