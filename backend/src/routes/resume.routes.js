import { Router } from 'express';
import { uploadResume, findJobs, scoreJD } from '../controllers/resume.controller.js';
import { upload } from '../middleware/upload.middleware.js';

const router = Router();

// Endpoint for uploading and parsing resume
router.post('/upload', upload.single('resume'), uploadResume);

// Endpoint for fetching and ranking jobs
router.get('/:id/jobs', findJobs);

// Endpoint for scoring a pasted JD against the parsed resume
router.post('/:id/score-jd', scoreJD);

export default router;
