import { processResume, findJobsForResume } from '../services/resume.service.js';

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

export const findJobs = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Resume ID is required' });
    }
    const result = await findJobsForResume(id);
    return res.status(200).json({
      message: 'Jobs found successfully',
      data: result
    });
  } catch (error) {
    console.error('Error in findJobs controller:', error);
    return res.status(500).json({ error: 'Internal server error finding jobs' });
  }
};
