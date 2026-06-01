import { Router } from 'express';
import { uploadResume } from '../controllers/resume.controller.js';
import { upload } from '../middleware/upload.middleware.js';

const router = Router();

// Endpoint for uploading and parsing resume
router.post('/upload', upload.single('resume'), uploadResume);

export default router;
