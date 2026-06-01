import { processResume } from '../services/resume.service.js';

export const uploadResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { path, filename } = req.file;


    const result = await processResume(path, filename);

    return res.status(200).json({
      message: 'Resume processed successfully',
      data: result
    });
  } catch (error) {
    console.error('Error in uploadResume controller:', error);
    return res.status(500).json({ error: 'Internal server error processing resume' });
  }
};
